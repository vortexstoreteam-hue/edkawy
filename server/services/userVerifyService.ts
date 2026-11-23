import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { MAX_OTP_ATTEMPTS, OTP_TTL_MS } from '../config/env.js';
import { maskEmailForUi, sendUserVerificationOtpEmail } from './mailerService.js';

interface OtpChallengeRecord {
  codeHash: Buffer;
  expiresAt: number;
  attempts: number;
  createdAt: number;
  lockedUntil?: number;
}

interface PersistedResetState {
  registeredHashes: Record<string, 'customer' | 'courier' | 'store' | 'sales_agent'>;
  resetLocks: Record<string, number>;
}

const RESET_STORE_FILE = path.join(process.cwd(), '.edkawy-reset-locks.json');
const LEGACY_RESET_STORE_FILE = path.join(process.cwd(), '.adkawy-reset-locks.json');

const activeUserVerificationOtpByEmail = new Map<string, OtpChallengeRecord>();

function hashUserVerificationOtp(email: string, code: string): Buffer {
  return crypto
    .createHash('sha256')
    .update(`edkawy-user-verify-otp:${email.trim().toLowerCase()}:${code}`)
    .digest();
}

export function hashEmailForReset(email: string): string {
  return crypto
    .createHash('sha256')
    .update(`edkawy-email-v1:${email.trim().toLowerCase()}`)
    .digest('hex');
}

function readPersistedResetState(): PersistedResetState {
  try {
    const targetFile = fs.existsSync(RESET_STORE_FILE)
      ? RESET_STORE_FILE
      : LEGACY_RESET_STORE_FILE;
    if (!fs.existsSync(targetFile)) {
      return { registeredHashes: {}, resetLocks: {} };
    }
    const raw = JSON.parse(fs.readFileSync(targetFile, 'utf8')) as Partial<PersistedResetState>;
    return {
      registeredHashes: raw.registeredHashes ?? {},
      resetLocks: raw.resetLocks ?? {},
    };
  } catch {
    return { registeredHashes: {}, resetLocks: {} };
  }
}

function writePersistedResetState(state: PersistedResetState): void {
  try {
    fs.writeFileSync(RESET_STORE_FILE, JSON.stringify(state, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    });
  } catch {
    // Non-fatal in read-only containers
  }
}

const persistedResetState = readPersistedResetState();

export function registerAccountResetHash(
  email: string,
  role: 'customer' | 'courier' | 'store' | 'sales_agent'
) {
  const emailHash = hashEmailForReset(email);
  persistedResetState.registeredHashes[emailHash] = role;
  writePersistedResetState(persistedResetState);
  return { ok: true, emailHash };
}

export function checkPasswordResetEmail(email: string) {
  const emailHash = hashEmailForReset(email);
  const isKnownOnServer = Boolean(persistedResetState.registeredHashes[emailHash]);
  return {
    ok: true,
    emailHash,
    isKnownOnServer,
    registered: isKnownOnServer,
    allowed: true,
    cooldownActive: false,
    remainingMs: 0,
  };
}

export function recordPasswordResetRequest(email: string) {
  const emailHash = hashEmailForReset(email);
  persistedResetState.resetLocks[emailHash] = Date.now();
  if (!persistedResetState.registeredHashes[emailHash]) {
    persistedResetState.registeredHashes[emailHash] = 'customer';
  }
  writePersistedResetState(persistedResetState);
  return { ok: true, emailHash, cooldownMs: 0 };
}

export async function requestUserEmailVerification(
  email: string,
  name: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  const normalizedEmail = email.trim().toLowerCase();
  const now = Date.now();
  const existingChallenge = activeUserVerificationOtpByEmail.get(normalizedEmail);

  if (existingChallenge?.lockedUntil && existingChallenge.lockedUntil > now) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existingChallenge.lockedUntil - now) / 1000)
    );
    return {
      status: 429,
      body: {
        ok: false,
        retryAfterSeconds,
        lockedUntilIso: new Date(existingChallenge.lockedUntil).toISOString(),
        error: `تم قفل طلب الكود مؤقتاً لمدة ${Math.ceil(
          retryAfterSeconds / 60
        )} دقيقة بسبب محاولات خاطئة متكررة.`,
      },
    };
  }

  const otpCode = String(crypto.randomInt(1000, 10000));
  activeUserVerificationOtpByEmail.set(normalizedEmail, {
    codeHash: hashUserVerificationOtp(normalizedEmail, otpCode),
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
    createdAt: now,
  });

  const smtpOutcome = await sendUserVerificationOtpEmail(
    normalizedEmail,
    name,
    otpCode
  );

  if (!smtpOutcome.sentViaSmtp) {
    activeUserVerificationOtpByEmail.delete(normalizedEmail);
    return {
      status: 503,
      body: {
        ok: false,
        sentViaSmtp: false,
        canUseFirebaseEmailLink: true,
        maskedEmail: maskEmailForUi(normalizedEmail),
        error:
          'خدمة إرسال أكواد البريد غير متوفرة حالياً على الخادم. يمكنك تفعيل حسابك بأمان عبر رابط التفعيل الرسمي من Firebase.',
      },
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      sentViaSmtp: true,
      maskedEmail: maskEmailForUi(normalizedEmail),
      digits: 4,
    },
  };
}

export function verifyUserEmailOtp(
  email: string,
  code: string
): { status: number; body: Record<string, unknown> } {
  const normalizedEmail = email.trim().toLowerCase();
  const now = Date.now();
  const challenge = activeUserVerificationOtpByEmail.get(normalizedEmail);

  if (!challenge) {
    return {
      status: 400,
      body: {
        ok: false,
        error: 'لا يوجد كود تفعيل نشط حالياً. يرجى طلب كود جديد.',
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
        lockedUntilIso: new Date(challenge.lockedUntil).toISOString(),
        error: `الحساب مقفل مؤقتاً بعد 5 محاولات خاطئة. حاول بعد ${retryAfterSeconds} ثانية.`,
      },
    };
  }

  if (now > challenge.expiresAt) {
    activeUserVerificationOtpByEmail.delete(normalizedEmail);
    return {
      status: 400,
      body: {
        ok: false,
        error: 'انتهت صلاحية كود التفعيل. يرجى طلب كود جديد.',
      },
    };
  }

  const candidateHash = hashUserVerificationOtp(normalizedEmail, code);
  const isMatch =
    candidateHash.length === challenge.codeHash.length &&
    crypto.timingSafeEqual(candidateHash, challenge.codeHash);

  if (!isMatch) {
    challenge.attempts += 1;
    if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
      const lockDurationMs = 3 * 60 * 1000;
      challenge.lockedUntil = now + lockDurationMs;
      const retryAfterSeconds = Math.ceil(lockDurationMs / 1000);
      return {
        status: 429,
        body: {
          ok: false,
          retryAfterSeconds,
          lockedUntilIso: new Date(challenge.lockedUntil).toISOString(),
          remainingAttempts: 0,
          error:
            'تم تجاوز الحد الأقصى (5 محاولات خاطئة). تم قفل التحقق مؤقتاً لمدة 3 دقائق.',
        },
      };
    }

    const remainingAttempts = Math.max(0, MAX_OTP_ATTEMPTS - challenge.attempts);
    return {
      status: 400,
      body: {
        ok: false,
        remainingAttempts,
        error: `كود التفعيل غير صحيح. المحاولات المتبقية: ${remainingAttempts}.`,
      },
    };
  }

  activeUserVerificationOtpByEmail.delete(normalizedEmail);
  return {
    status: 200,
    body: {
      ok: true,
      verifiedEmail: normalizedEmail,
    },
  };
}
