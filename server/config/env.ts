import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export const APP_BRAND_NAME = 'تطبيق إدكاوي | Edkawy';
export const APP_NOREPLY_EMAIL = 'noreply@edkawy.app';
export const OTP_TTL_MS = 10 * 60 * 1000;
export const MAX_OTP_ATTEMPTS = 5;
export const INVITE_DEFAULT_ORIGIN =
  'https://ais-pre-eankapwjyahdkgb2dgpirq-768850777108.europe-west2.run.app';

export function parseCliPort(): number {
  const portFlagIndex = process.argv.indexOf('--port');
  if (portFlagIndex !== -1 && process.argv[portFlagIndex + 1]) {
    const parsed = Number(process.argv[portFlagIndex + 1]);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return Number(process.env.PORT) || 3000;
}

export function resolveFirebaseProjectId(): string {
  const fromEnv = (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    ''
  ).trim();
  if (fromEnv) return fromEnv;

  try {
    const cfgPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as {
        projectId?: string;
      };
      if (parsed.projectId?.trim()) {
        return parsed.projectId.trim();
      }
    }
  } catch {
    // Fallback below
  }
  return 'utility-tempest-x01dl';
}

export function getAllowedAdminEmails(): string[] {
  const raw = (
    process.env.ADMIN_EMAIL ||
    'vortexstore.team@gmail.com,alaslybys46@gmail.com'
  )
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return raw.length > 0
    ? raw
    : ['vortexstore.team@gmail.com', 'alaslybys46@gmail.com'];
}

export function getPrimaryAdminEmail(): string {
  return getAllowedAdminEmails()[0] || 'vortexstore.team@gmail.com';
}

export function isAuthorizedAdminEmail(email: string): boolean {
  const clean = email.trim().toLowerCase();
  return getAllowedAdminEmails().some((allowed) => safeEqualStrings(clean, allowed));
}

export function safeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function hashPasswordScrypt(password: string, existingSalt?: string): string {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

export function verifyPasswordScrypt(password: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, salt, hexDigest] = parts;
  if (!salt || !hexDigest) return false;
  try {
    const expectedBuf = Buffer.from(hexDigest, 'hex');
    const actualBuf = crypto.scryptSync(password, salt, expectedBuf.length, {
      N: 16384,
      r: 8,
      p: 1,
    });
    if (actualBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(actualBuf, expectedBuf);
  } catch {
    return false;
  }
}

const ADMIN_AUTH_STORE_FILE = path.join(process.cwd(), '.edkawy-admin-auth.json');

interface PersistedAdminAuthRecord {
  email: string;
  passwordHash: string;
  configuredAtIso: string;
}

function readPersistedAdminAuth(): PersistedAdminAuthRecord | null {
  try {
    if (!fs.existsSync(ADMIN_AUTH_STORE_FILE)) return null;
    const raw = JSON.parse(
      fs.readFileSync(ADMIN_AUTH_STORE_FILE, 'utf8')
    ) as Partial<PersistedAdminAuthRecord>;
    if (
      typeof raw.email === 'string' &&
      typeof raw.passwordHash === 'string' &&
      raw.passwordHash.startsWith('scrypt$')
    ) {
      return {
        email: raw.email.trim().toLowerCase(),
        passwordHash: raw.passwordHash,
        configuredAtIso: raw.configuredAtIso || new Date().toISOString(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

let cachedEnvPlaintextHash: { rawPassword: string; hash: string } | null = null;

export function getActiveAdminPasswordHash(): string | null {
  const envHash = (process.env.ADMIN_PASSWORD_HASH || '').trim();
  if (envHash.startsWith('scrypt$')) {
    return envHash;
  }

  const envPassword = (process.env.ADMIN_PASSWORD || '').trim();
  if (envPassword.length >= 6) {
    if (!cachedEnvPlaintextHash || cachedEnvPlaintextHash.rawPassword !== envPassword) {
      cachedEnvPlaintextHash = {
        rawPassword: envPassword,
        hash: hashPasswordScrypt(envPassword),
      };
    }
    return cachedEnvPlaintextHash.hash;
  }

  const persisted = readPersistedAdminAuth();
  return persisted?.passwordHash || null;
}

export function getAdminSetupSource(): 'env' | 'initial_setup' | 'unconfigured' {
  if (
    (process.env.ADMIN_PASSWORD_HASH || '').trim().startsWith('scrypt$') ||
    (process.env.ADMIN_PASSWORD || '').trim().length >= 6
  ) {
    return 'env';
  }
  return readPersistedAdminAuth() ? 'initial_setup' : 'unconfigured';
}

export function saveInitialAdminPasswordSetup(
  email: string,
  plainPassword: string
): void {
  if (getAdminSetupSource() !== 'unconfigured') {
    throw new Error('ALREADY_CONFIGURED');
  }
  const passwordHash = hashPasswordScrypt(plainPassword);
  const record: PersistedAdminAuthRecord = {
    email: email.trim().toLowerCase(),
    passwordHash,
    configuredAtIso: new Date().toISOString(),
  };
  fs.writeFileSync(ADMIN_AUTH_STORE_FILE, JSON.stringify(record, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  });
}

export function resolveAllowedCorsOrigins(): Set<string> {
  const allowed = new Set<string>();
  const envCandidates = [
    process.env.APP_URL,
    process.env.SHARED_APP_URL,
    process.env.VITE_PUBLIC_APP_URL,
    ...(process.env.ALLOWED_ORIGINS || '').split(','),
  ];

  for (const raw of envCandidates) {
    const trimmed = (raw || '').trim().replace(/\/+$/, '');
    if (!trimmed) continue;
    try {
      const parsed = new URL(trimmed);
      allowed.add(parsed.origin);
      if (parsed.hostname.startsWith('ais-dev-')) {
        const pre = new URL(parsed.origin);
        pre.hostname = pre.hostname.replace(/^ais-dev-/, 'ais-pre-');
        allowed.add(pre.origin);
      } else if (parsed.hostname.startsWith('ais-pre-')) {
        const dev = new URL(parsed.origin);
        dev.hostname = dev.hostname.replace(/^ais-pre-/, 'ais-dev-');
        allowed.add(dev.origin);
      }
    } catch {
      // ignore invalid URL
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    allowed.add('http://localhost:3000');
    allowed.add('http://127.0.0.1:3000');
  }
  return allowed;
}

export function getPaymobHmacSecret(): string | null {
  const secret = (process.env.PAYMOB_HMAC_SECRET || '').trim();
  return secret.length >= 8 ? secret : null;
}
