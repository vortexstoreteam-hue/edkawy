import crypto from 'node:crypto';
import {
  MAX_OTP_ATTEMPTS,
  OTP_TTL_MS,
  getActiveAdminPasswordHash,
  getAdminSetupSource,
  getPrimaryAdminEmail,
  isAuthorizedAdminEmail,
  saveInitialAdminPasswordSetup,
  verifyPasswordScrypt,
} from '../config/env.js';
import { maskEmailForUi, sendAdminOtpEmail } from './mailerService.js';

interface AdminOtpChallengeRecord {
  codeHash: Buffer;
  expiresAt: number;
  attempts: number;
  createdAt: number;
  lockedUntil?: number;
}

const activeAdminOtpByEmail = new Map<string, AdminOtpChallengeRecord>();

function hashAdminOtpCode(email: string, code: string): Buffer {
  return crypto
    .createHash('sha256')
    .update(`edkawy-admin-otp-v2:${email.trim().toLowerCase()}:${code}`)
    .digest();
}

export function getAdminSetupStatus() {
  const source = getAdminSetupSource();
  return {
    ok: true,
    setupRequired: source === 'unconfigured',
    source,
    adminEmail: getPrimaryAdminEmail(),
  };
}

export function performInitialAdminSetup(
  email: string,
  password: string
): { status: number; body: Record<string, unknown> } {
  const normalizedEmail = email.trim().toLowerCase();
  if (!isAuthorizedAdminEmail(normalizedEmail)) {
    return {
      status: 403,
      body: {
        ok: false,
        error: 'هذا البريد الإلكتروني غير مصرح له بتهيئة بوابة الإدارة.',
      },
    };
  }

  if (getAdminSetupSource() !== 'unconfigured') {
    return {
      status: 409,
      body: {
        ok: false,
        error: 'تمت تهيئة كلمة مرور الإدارة مسبقاً ولا يمكن إعادة تعيينها من هنا.',
      },
    };
  }

  saveInitialAdminPasswordSetup(normalizedEmail, password);
  return {
    status: 201,
    body: {
      ok: true,
      adminEmail: normalizedEmail,
      message: 'تم حفظ كلمة مرور الإدارة المشفرة بنجاح. يمكنك تسجيل الدخول الآن.',
    },
  };
}

export async function requestAdminOtpChallenge(
  email: string,
  password: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!isAuthorizedAdminEmail(normalizedEmail)) {
    return {
      status: 401,
      body: {
        ok: false,
        error: 'بيانات البريد الإلكتروني أو كلمة المرور الخاصة ببوابة الإدارة غير صحيحة.',
      },
    };
  }

  const storedHash = getActiveAdminPasswordHash();
  if (!storedHash) {
    return {
      status: 428,
      body: {
        ok: false,
        setupRequired: true,
        error: 'يلزم إعداد كلمة مرور الإدارة لأول مرة قبل تسجيل الدخول.',
      },
    };
  }

  if (!verifyPasswordScrypt(password, storedHash)) {
    return {
      status: 401,
      body: {
        ok: false,
        error: 'بيانات البريد الإلكتروني أو كلمة المرور الخاصة ببوابة الإدارة غير صحيحة.',
      },
    };
  }

  const now = Date.now();
  const existing = activeAdminOtpByEmail.get(normalizedEmail);
  if (existing?.lockedUntil && existing.lockedUntil > now) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.lockedUntil - now) / 1000)
    );
    return {
      status: 429,
      body: {
        ok: false,
        retryAfterSeconds,
        error: `تم تقييد طلبات التحقق مؤقتاً بعد محاولات فاشلة متكررة. حاول بعد ${retryAfterSeconds} ثانية.`,
      },
    };
  }

  const otpCode = String(crypto.randomInt(100000, 1000000));
  activeAdminOtpByEmail.set(normalizedEmail, {
    codeHash: hashAdminOtpCode(normalizedEmail, otpCode),
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
    createdAt: now,
  });

  const mailResult = await sendAdminOtpEmail(normalizedEmail, otpCode);
  if (!mailResult.sentViaSmtp) {
    activeAdminOtpByEmail.delete(normalizedEmail);
    return {
      status: 503,
      body: {
        ok: false,
        smtpConfigured: false,
        error:
          'خدمة إرسال البريد الإلكتروني (SMTP) غير مفعلة أو تعذر الإرسال. يرجى ضبط SMTP_USER و SMTP_PASS في متغيرات البيئة لتلقي رمز التحقق بأمان.',
      },
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      delivery: 'edkawy_mail',
      recipient: maskEmailForUi(normalizedEmail),
      expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
    },
  };
}

export function verifyAdminOtpChallenge(
  email: string,
  code: string
): { status: number; body: Record<string, unknown> } {
  const normalizedEmail = email.trim().toLowerCase();
  if (!isAuthorizedAdminEmail(normalizedEmail)) {
    return {
      status: 401,
      body: {
        ok: false,
        error: 'البريد الإلكتروني غير مصرح له بالدخول لبوابة الإدارة.',
      },
    };
  }

  const now = Date.now();
  const challenge = activeAdminOtpByEmail.get(normalizedEmail);
  if (!challenge) {
    return {
      status: 400,
      body: {
        ok: false,
        error: 'لا يوجد كود تحقق نشط حالياً. يرجى طلب إرسال كود جديد.',
      },
    };
  }

  if (challenge.lockedUntil && challenge.lockedUntil > now) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((challenge.lockedUntil - now) / 1000)
    );
    return {
      status: 429,
      body: {
        ok: false,
        retryAfterSeconds,
        error: `تم القفل المؤقت بعد محاولات فاشلة متكررة. حاول بعد ${retryAfterSeconds} ثانية.`,
      },
    };
  }

  if (now > challenge.expiresAt) {
    activeAdminOtpByEmail.delete(normalizedEmail);
    return {
      status: 400,
      body: {
        ok: false,
        error: 'انتهت صلاحية كود التحقق. يرجى طلب إرسال كود جديد.',
      },
    };
  }

  const candidateHash = hashAdminOtpCode(normalizedEmail, code);
  const matches =
    candidateHash.length === challenge.codeHash.length &&
    crypto.timingSafeEqual(candidateHash, challenge.codeHash);

  if (!matches) {
    challenge.attempts += 1;
    if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
      const lockDurationMs = 5 * 60 * 1000;
      challenge.lockedUntil = now + lockDurationMs;
      return {
        status: 429,
        body: {
          ok: false,
          retryAfterSeconds: Math.ceil(lockDurationMs / 1000),
          error: 'تم تجاوز الحد الأقصى لمحاولات إدخال الكود. تم قفل التحقق لمدة 5 دقائق.',
        },
      };
    }

    return {
      status: 401,
      body: {
        ok: false,
        remainingAttempts: Math.max(0, MAX_OTP_ATTEMPTS - challenge.attempts),
        error: `كود التحقق غير صحيح. المحاولات المتبقية: ${Math.max(
          0,
          MAX_OTP_ATTEMPTS - challenge.attempts
        )}.`,
      },
    };
  }

  activeAdminOtpByEmail.delete(normalizedEmail);
  return {
    status: 200,
    body: {
      ok: true,
      adminEmail: normalizedEmail,
      verifiedAt: new Date().toISOString(),
    },
  };
}
