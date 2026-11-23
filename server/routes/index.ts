import { Router, type Request, type Response } from 'express';
import { INVITE_DEFAULT_ORIGIN } from '../config/env.js';
import {
  type AuthenticatedRequest,
  aiLimiter,
  authOtpLimiter,
  inviteEmailLimiter,
  passwordResetLimiter,
  requireFirebaseAuth,
  requireNonAnonymousFirebaseAuth,
} from '../middleware/security.js';
import {
  getAdminSetupStatus,
  performInitialAdminSetup,
  requestAdminOtpChallenge,
  verifyAdminOtpChallenge,
} from '../services/adminAuthService.js';
import {
  handleAiChat,
  handleMealPlan,
  handleMenuOcr,
  handleVisualSearch,
} from '../services/aiService.js';
import { getEdkuWeatherPromo, reverseGeocodeEdku } from '../services/geoService.js';
import {
  getSmtpConfig,
  maskEmailForUi,
  sendInvitationEmailViaSmtp,
} from '../services/mailerService.js';
import { verifyAndParsePaymobWebhook } from '../services/paymobService.js';
import {
  checkPasswordResetEmail,
  recordPasswordResetRequest,
  registerAccountResetHash,
  requestUserEmailVerification,
  verifyUserEmailOtp,
} from '../services/userVerifyService.js';
import {
  adminInitialSetupSchema,
  adminRequestOtpSchema,
  adminVerifyOtpSchema,
  aiChatSchema,
  aiMealPlanSchema,
  aiOcrMenuSchema,
  aiVisualSearchSchema,
  emailVerificationRequestSchema,
  emailVerificationVerifySchema,
  passwordResetEmailSchema,
  passwordResetRegisterSchema,
  reverseGeocodeQuerySchema,
  sendInvitationEmailSchema,
  validateBody,
  validateQuery,
} from '../validation/schemas.js';

function normalizePublicOrigin(candidate: unknown): string | null {
  if (typeof candidate !== 'string') return null;
  const trimmed = candidate.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return null;
    }
    if (parsed.hostname.startsWith('ais-dev-')) {
      parsed.hostname = parsed.hostname.replace(/^ais-dev-/, 'ais-pre-');
    }
    return parsed.origin.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

export function createApiRouter(): Router {
  const router = Router();

  router.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'edkawy-edku-delivery' });
  });

  router.get(
    '/admin/smtp-status',
    requireNonAnonymousFirebaseAuth,
    (_req: AuthenticatedRequest, res: Response) => {
      const smtp = getSmtpConfig();
      res.json({
        ok: true,
        configured: smtp.configured,
        host: smtp.host,
        port: smtp.port,
        fromMasked: maskEmailForUi(smtp.from),
      });
    }
  );

  // Admin First-Run Setup & 2FA OTP Auth
  router.get('/auth/admin/setup-status', (_req: Request, res: Response) => {
    res.json(getAdminSetupStatus());
  });

  router.post(
    '/auth/admin/initial-setup',
    authOtpLimiter,
    validateBody(adminInitialSetupSchema),
    (req: Request, res: Response) => {
      const { email, password } = req.body as { email: string; password: string };
      const outcome = performInitialAdminSetup(email, password);
      res.status(outcome.status).json(outcome.body);
    }
  );

  router.post(
    '/auth/admin/request-otp',
    authOtpLimiter,
    validateBody(adminRequestOtpSchema),
    async (req: Request, res: Response) => {
      const { email, password } = req.body as { email: string; password: string };
      const outcome = await requestAdminOtpChallenge(email, password);
      res.status(outcome.status).json(outcome.body);
    }
  );

  router.post(
    '/auth/admin/verify-otp',
    authOtpLimiter,
    validateBody(adminVerifyOtpSchema),
    (req: Request, res: Response) => {
      const { email, code } = req.body as { email: string; code: string };
      const outcome = verifyAdminOtpChallenge(email, code);
      res.status(outcome.status).json(outcome.body);
    }
  );

  // Customer Email Verification OTP (Never leaks fallback OTP codes!)
  router.post(
    '/auth/email-verification/request',
    authOtpLimiter,
    validateBody(emailVerificationRequestSchema),
    async (req: Request, res: Response) => {
      const { email, name } = req.body as { email: string; name: string };
      const outcome = await requestUserEmailVerification(email, name);
      res.status(outcome.status).json(outcome.body);
    }
  );

  router.post(
    '/auth/email-verification/verify',
    authOtpLimiter,
    validateBody(emailVerificationVerifySchema),
    (req: Request, res: Response) => {
      const { email, code } = req.body as { email: string; code: string };
      const outcome = verifyUserEmailOtp(email, code);
      res.status(outcome.status).json(outcome.body);
    }
  );

  // Password Reset Index & Checks
  router.post(
    '/auth/password-reset/register-account',
    passwordResetLimiter,
    requireFirebaseAuth,
    validateBody(passwordResetRegisterSchema),
    (req: AuthenticatedRequest, res: Response) => {
      const { email, role } = req.body as {
        email: string;
        role: 'customer' | 'courier' | 'store' | 'sales_agent';
      };
      res.json(registerAccountResetHash(email, role));
    }
  );

  router.post(
    '/auth/password-reset/check',
    passwordResetLimiter,
    validateBody(passwordResetEmailSchema),
    (req: Request, res: Response) => {
      const { email } = req.body as { email: string };
      res.json(checkPasswordResetEmail(email));
    }
  );

  router.post(
    '/auth/password-reset/record',
    passwordResetLimiter,
    validateBody(passwordResetEmailSchema),
    (req: Request, res: Response) => {
      const { email } = req.body as { email: string };
      res.json(recordPasswordResetRequest(email));
    }
  );

  // Invitations Email Dispatch (Requires non-anonymous Firebase ID token)
  router.post(
    '/invitations/send-email',
    inviteEmailLimiter,
    requireNonAnonymousFirebaseAuth,
    validateBody(sendInvitationEmailSchema),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const body = req.body as {
          email: string;
          token: string;
          userType: 'store' | 'customer' | 'courier' | 'sales_agent';
          referralCode: string;
          inviterName: string;
          origin?: string;
        };

        const fallbackPublicOrigin =
          normalizePublicOrigin(process.env.SHARED_APP_URL) ||
          normalizePublicOrigin(process.env.APP_URL) ||
          INVITE_DEFAULT_ORIGIN;

        const requestOrigin = req.get('host')
          ? `${req.protocol}://${req.get('host')}`
          : '';
        const clientOrigin =
          normalizePublicOrigin(body.origin) ||
          normalizePublicOrigin(requestOrigin) ||
          fallbackPublicOrigin;

        const refParam = body.referralCode
          ? `&ref=${encodeURIComponent(body.referralCode)}`
          : '';
        const inviteUrl = `${clientOrigin}/register?token=${encodeURIComponent(
          body.token
        )}&type=${encodeURIComponent(body.userType)}${refParam}`;

        const mailRes = await sendInvitationEmailViaSmtp({
          recipientEmail: body.email,
          userType: body.userType,
          inviteUrl,
          inviterName: body.inviterName,
        });

        res.json({
          ok: true,
          sentViaSmtp: mailRes.sentViaSmtp,
          inviteUrl,
          smtpError: mailRes.smtpError,
        });
      } catch (err) {
        console.error(
          '[Edkawy Invitation API] Error:',
          err instanceof Error ? err.message : 'Unknown error'
        );
        res.status(500).json({
          ok: false,
          sentViaSmtp: false,
          inviteUrl: '',
          error: 'تعذر إرسال بريد الدعوة حالياً.',
        });
      }
    }
  );

  // Geo & Weather Proxies
  router.get(
    '/maps/reverse-geocode',
    validateQuery(reverseGeocodeQuerySchema),
    async (req: Request, res: Response) => {
      try {
        const { lat, lng } = (
          req as Request & { validatedQuery: { lat: number; lng: number } }
        ).validatedQuery;
        const outcome = await reverseGeocodeEdku(lat, lng);
        res.status(outcome.status).json(outcome.body);
      } catch (err) {
        console.error(
          '[Edkawy Geocode] Error:',
          err instanceof Error ? err.message : 'Unknown error'
        );
        res.status(502).json({
          ok: false,
          error: 'تعذر الاتصال بخدمة تحديد اسم الشارع حالياً.',
        });
      }
    }
  );

  router.get('/weather/edku', async (_req: Request, res: Response) => {
    try {
      const outcome = await getEdkuWeatherPromo();
      res.status(outcome.status).json(outcome.body);
    } catch (err) {
      console.error(
        '[Edkawy Weather] Error:',
        err instanceof Error ? err.message : 'Unknown error'
      );
      res.status(500).json({
        ok: false,
        error: 'تعذر جلب حالة طقس إدكو حالياً.',
      });
    }
  });

  // Gemini AI Proxies (Authenticated & Rate Limited)
  router.post(
    '/ai/chat',
    aiLimiter,
    requireFirebaseAuth,
    validateBody(aiChatSchema),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const body = req.body as {
          message: string;
          customerName: string;
          customerPoints?: number;
          points?: number;
          currentStreak: number;
          stores: Array<Record<string, unknown>>;
          campaigns: Array<Record<string, unknown>>;
          history: Array<Record<string, unknown>>;
        };
        const outcome = await handleAiChat({
          message: body.message,
          customerName: body.customerName || 'يا غالي',
          customerPoints: Number(body.customerPoints ?? body.points ?? 0),
          currentStreak: body.currentStreak ?? 0,
          stores: body.stores,
          campaigns: body.campaigns,
          history: body.history,
        });
        res.status(outcome.status).json(outcome.body);
      } catch (err) {
        console.error(
          '[Edkawy AI Chat] Error:',
          err instanceof Error ? err.message : 'Unknown error'
        );
        res.status(500).json({
          ok: false,
          error: 'مساعد إدكاوي مشغول لحظة واحدة، جرب تبعت رسالتك تاني بعد ثواني.',
        });
      }
    }
  );

  router.post(
    '/ai/visual-search',
    aiLimiter,
    requireFirebaseAuth,
    validateBody(aiVisualSearchSchema),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const body = req.body as {
          imageDataUrl: string;
          productsCatalog: Array<Record<string, unknown>>;
        };
        const outcome = await handleVisualSearch(body);
        res.status(outcome.status).json(outcome.body);
      } catch (err) {
        console.error(
          '[Edkawy Visual Search] Error:',
          err instanceof Error ? err.message : 'Unknown error'
        );
        res.status(500).json({
          ok: false,
          error: 'تعذر تحليل الصورة حالياً. يرجى المحاولة مرة أخرى.',
        });
      }
    }
  );

  router.post(
    '/ai/meal-plan',
    aiLimiter,
    requireFirebaseAuth,
    validateBody(aiMealPlanSchema),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const body = req.body as {
          budgetEgp: number;
          daysCount: number;
          dietaryStyle: string;
          productsCatalog: Array<Record<string, unknown>>;
        };
        const outcome = await handleMealPlan(body);
        res.status(outcome.status).json(outcome.body);
      } catch (err) {
        console.error(
          '[Edkawy Meal Plan] Error:',
          err instanceof Error ? err.message : 'Unknown error'
        );
        res.status(500).json({
          ok: false,
          error: 'تعذر إنشاء خطة الوجبات حالياً. يرجى المحاولة لاحقاً.',
        });
      }
    }
  );

  const ocrHandler = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const body = req.body as {
        imageDataUrl?: string;
        imageBase64?: string;
        storeCategory: string;
      };
      const outcome = await handleMenuOcr({
        rawImageDataUrl: body.imageDataUrl || body.imageBase64 || '',
        storeCategoryHint: body.storeCategory || 'عام',
      });
      res.status(outcome.status).json(outcome.body);
    } catch (err) {
      console.error(
        '[Edkawy Menu OCR] Error:',
        err instanceof Error ? err.message : 'Unknown error'
      );
      res.status(500).json({
        ok: false,
        items: [],
        error: 'تعذر استخراج الأصناف من الصورة حالياً. يرجى المحاولة بصورة أوضح.',
      });
    }
  };

  router.post(
    '/ocr-menu',
    aiLimiter,
    requireNonAnonymousFirebaseAuth,
    validateBody(aiOcrMenuSchema),
    ocrHandler
  );
  router.post(
    '/ai/ocr-menu',
    aiLimiter,
    requireNonAnonymousFirebaseAuth,
    validateBody(aiOcrMenuSchema),
    ocrHandler
  );

  // Paymob Webhook Gateway (Mandatory HMAC-SHA512 Verification)
  router.post('/webhook', (req: Request, res: Response) => {
    const signature = String(req.query.hmac || req.headers['x-paymob-hmac'] || '');
    const body =
      typeof req.body === 'object' && req.body !== null
        ? (req.body as Record<string, unknown>)
        : {};
    const outcome = verifyAndParsePaymobWebhook({ signature, body });
    res.status(outcome.status).json(outcome.body);
  });

  return router;
}
