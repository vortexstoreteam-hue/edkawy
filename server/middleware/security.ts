import cors from 'cors';
import { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import helmet from 'helmet';
import { resolveAllowedCorsOrigins, resolveFirebaseProjectId } from '../config/env.js';

export interface VerifiedFirebaseUser {
  uid: string;
  email?: string;
  emailVerified: boolean;
  isAnonymous: boolean;
  signInProvider?: string;
}

export interface AuthenticatedRequest extends Request {
  firebaseUser?: VerifiedFirebaseUser;
}

let adminAuthInitialized = false;
function getFirebaseAdminAuth() {
  if (!adminAuthInitialized) {
    if (getApps().length === 0) {
      initializeApp({
        projectId: resolveFirebaseProjectId(),
      });
    }
    adminAuthInitialized = true;
  }
  return getAuth();
}

export function createSecurityHeadersMiddleware() {
  return helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    frameguard: false, // Allows preview inside AI Studio iframe while protecting headers
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });
}

export function createCorsMiddleware() {
  const allowedOrigins = resolveAllowedCorsOrigins();

  return cors({
    origin(origin, callback) {
      // Allow same-origin / server-to-server requests with no Origin header
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      try {
        const parsed = new URL(origin);
        if (
          parsed.protocol === 'https:' &&
          parsed.hostname.endsWith('.run.app') &&
          (parsed.hostname.startsWith('ais-dev-') || parsed.hostname.startsWith('ais-pre-'))
        ) {
          callback(null, true);
          return;
        }
        if (
          process.env.NODE_ENV !== 'production' &&
          (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
        ) {
          callback(null, true);
          return;
        }
      } catch {
        // Fall through to reject
      }

      callback(new Error('CORS_ORIGIN_NOT_ALLOWED'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Paymob-Hmac'],
    maxAge: 600,
  });
}

export const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: 'تم تجاوز حد الطلبات المسموح به حالياً. يرجى المحاولة بعد دقيقة.',
  },
});

export const authOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: 'تم تجاوز الحد الأقصى لمحاولات التحقق. يرجى الانتظار 15 دقيقة والمحاولة لاحقاً.',
  },
});

export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: 'تم تجاوز الحد المسموح به لطلبات استعادة كلمة المرور.',
  },
});

export const inviteEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: 'تم إرسال عدد كبير من رسائل الدعوة. يرجى الانتظار قليلاً قبل الإرسال مجدداً.',
  },
});

export const aiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: 'تم استهلاك الحد المؤقت لطلبات الذكاء الاصطناعي. حاول مجدداً بعد دقائق.',
  },
});

async function extractVerifiedFirebaseUser(
  req: Request
): Promise<VerifiedFirebaseUser | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  if (!token || token.length < 20) {
    return null;
  }
  const decoded = await getFirebaseAdminAuth().verifyIdToken(token, false);
  const provider = decoded.firebase?.sign_in_provider;
  return {
    uid: decoded.uid,
    email: typeof decoded.email === 'string' ? decoded.email.toLowerCase() : undefined,
    emailVerified: Boolean(decoded.email_verified),
    isAnonymous: provider === 'anonymous',
    signInProvider: provider,
  };
}

export async function requireFirebaseAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const verified = await extractVerifiedFirebaseUser(req);
    if (!verified) {
      res.status(401).json({
        ok: false,
        error: 'يلزم تسجيل الدخول وإرفاق رمز مصادقة Firebase صالح.',
      });
      return;
    }
    req.firebaseUser = verified;
    next();
  } catch {
    res.status(401).json({
      ok: false,
      error: 'انتهت صلاحية الجلسة أو رمز المصادقة غير صالح.',
    });
  }
}

export async function requireNonAnonymousFirebaseAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const verified = await extractVerifiedFirebaseUser(req);
    if (!verified) {
      res.status(401).json({
        ok: false,
        error: 'يلزم تسجيل الدخول بحساب معتمد لإتمام هذه العملية.',
      });
      return;
    }
    if (verified.isAnonymous) {
      res.status(403).json({
        ok: false,
        error: 'هذه العملية غير متاحة لحسابات الضيوف.',
      });
      return;
    }
    req.firebaseUser = verified;
    next();
  } catch {
    res.status(401).json({
      ok: false,
      error: 'انتهت صلاحية الجلسة أو رمز المصادقة غير صالح.',
    });
  }
}

export function apiErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof Error && err.message === 'CORS_ORIGIN_NOT_ALLOWED') {
    res.status(403).json({
      ok: false,
      error: 'مصدر الطلب غير مصرح به.',
    });
    return;
  }

  console.error('[Edkawy API Error]', err instanceof Error ? err.message : 'Unknown error');
  res.status(500).json({
    ok: false,
    error: 'حدث خطأ داخلي في الخادم. يرجى المحاولة مرة أخرى.',
  });
}
