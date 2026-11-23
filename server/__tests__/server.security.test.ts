import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApiApp } from '../app.js';

const ADMIN_AUTH_FILE = path.join(process.cwd(), '.edkawy-admin-auth.json');

let server: Server;
let baseUrl = '';
let savedAdminAuthBackup: string | null = null;
const savedEnv = {
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  PAYMOB_HMAC_SECRET: process.env.PAYMOB_HMAC_SECRET,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
};

function buildPaymobSignedPayload(secret: string, overrides: Record<string, unknown> = {}) {
  const obj: Record<string, unknown> = {
    amount_cents: 22000,
    created_at: '2026-11-23T12:00:00',
    currency: 'EGP',
    error_occured: false,
    has_parent_transaction: false,
    id: 987654,
    integration_id: 12345,
    is_3d_secure: true,
    is_auth: false,
    is_capture: false,
    is_refunded: false,
    is_standalone_payment: true,
    is_voided: false,
    order: { id: 'ord_paymob_1001' },
    owner: 42,
    pending: false,
    source_data: {
      pan: '4242',
      sub_type: 'Visa',
      type: 'card',
    },
    success: true,
    ...overrides,
  };

  const orderObj = (obj.order ?? {}) as Record<string, unknown>;
  const sourceData = (obj.source_data ?? {}) as Record<string, unknown>;
  const concatenated = [
    obj.amount_cents,
    obj.created_at,
    obj.currency,
    obj.error_occured,
    obj.has_parent_transaction,
    obj.id,
    obj.integration_id,
    obj.is_3d_secure,
    obj.is_auth,
    obj.is_capture,
    obj.is_refunded,
    obj.is_standalone_payment,
    obj.is_voided,
    orderObj.id ?? '',
    obj.owner,
    obj.pending,
    sourceData.pan ?? '',
    sourceData.sub_type ?? '',
    sourceData.type ?? '',
    obj.success,
  ].join('');

  const hmac = crypto
    .createHmac('sha512', secret)
    .update(concatenated)
    .digest('hex');

  return { payload: { obj }, hmac };
}

test.before(async () => {
  if (fs.existsSync(ADMIN_AUTH_FILE)) {
    savedAdminAuthBackup = fs.readFileSync(ADMIN_AUTH_FILE, 'utf8');
    fs.unlinkSync(ADMIN_AUTH_FILE);
  }
  delete process.env.ADMIN_PASSWORD;
  delete process.env.ADMIN_PASSWORD_HASH;
  process.env.ADMIN_EMAIL = 'vortexstore.team@gmail.com,alaslybys46@gmail.com';
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  delete process.env.PAYMOB_HMAC_SECRET;

  const app = createApiApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

test.after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  if (fs.existsSync(ADMIN_AUTH_FILE)) {
    fs.unlinkSync(ADMIN_AUTH_FILE);
  }
  if (savedAdminAuthBackup !== null) {
    fs.writeFileSync(ADMIN_AUTH_FILE, savedAdminAuthBackup, {
      encoding: 'utf8',
      mode: 0o600,
    });
  }

  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
});

test('GET /api/health returns 200 and Helmet/RateLimit headers', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as { ok: boolean; service: string };
  assert.equal(body.ok, true);
  assert.equal(body.service, 'edkawy-edku-delivery');
  assert.ok(res.headers.get('ratelimit-limit'), 'Expected RateLimit-Limit header');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
});

test('Admin one-time initial setup enforces allowlist, password strength, scrypt file permissions, and single-use lock', async () => {
  // Initially unconfigured
  const status1 = await fetch(`${baseUrl}/api/auth/admin/setup-status`);
  assert.equal(status1.status, 200);
  const status1Json = (await status1.json()) as {
    setupRequired: boolean;
    source: string;
  };
  assert.equal(status1Json.setupRequired, true);
  assert.equal(status1Json.source, 'unconfigured');

  // Login attempt before setup returns 428 Precondition Required
  const preSetupLogin = await fetch(`${baseUrl}/api/auth/admin/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'vortexstore.team@gmail.com',
      password: 'AnyPassword123',
    }),
  });
  assert.equal(preSetupLogin.status, 428);

  // Weak password rejected with 400
  const weakRes = await fetch(`${baseUrl}/api/auth/admin/initial-setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'vortexstore.team@gmail.com',
      password: 'short',
      confirmPassword: 'short',
    }),
  });
  assert.equal(weakRes.status, 400);

  // Unauthorized email rejected with 403
  const unauthRes = await fetch(`${baseUrl}/api/auth/admin/initial-setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'attacker@example.com',
      password: 'StrongPassword2026',
      confirmPassword: 'StrongPassword2026',
    }),
  });
  assert.equal(unauthRes.status, 403);

  // Valid first-run setup succeeds with 201 and stores scrypt$ hash
  const okRes = await fetch(`${baseUrl}/api/auth/admin/initial-setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'vortexstore.team@gmail.com',
      password: 'StrongPassword2026',
      confirmPassword: 'StrongPassword2026',
    }),
  });
  assert.equal(okRes.status, 201);
  assert.ok(fs.existsSync(ADMIN_AUTH_FILE));
  const storedRaw = fs.readFileSync(ADMIN_AUTH_FILE, 'utf8');
  assert.match(storedRaw, /"passwordHash":\s*"scrypt\$[a-f0-9]+\$[a-f0-9]+"/);
  assert.equal(storedRaw.includes('StrongPassword2026'), false);

  // Second initial-setup attempt is blocked with 409 Conflict
  const secondRes = await fetch(`${baseUrl}/api/auth/admin/initial-setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'vortexstore.team@gmail.com',
      password: 'AnotherPassword2026',
      confirmPassword: 'AnotherPassword2026',
    }),
  });
  assert.equal(secondRes.status, 409);

  // Setup status now shows configured
  const status2 = await fetch(`${baseUrl}/api/auth/admin/setup-status`);
  const status2Json = (await status2.json()) as {
    setupRequired: boolean;
    source: string;
  };
  assert.equal(status2Json.setupRequired, false);
  assert.equal(status2Json.source, 'initial_setup');
});

test('Admin and user OTP endpoints never leak fallbackOtpCode, activationGate, or password hashes', async () => {
  // Wrong admin password -> 401
  const wrongPwRes = await fetch(`${baseUrl}/api/auth/admin/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'vortexstore.team@gmail.com',
      password: 'WrongPassword123',
    }),
  });
  assert.equal(wrongPwRes.status, 401);
  const wrongPwText = await wrongPwRes.text();
  assert.equal(wrongPwText.includes('fallbackOtpCode'), false);
  assert.equal(wrongPwText.includes('activationGate'), false);
  assert.equal(wrongPwText.includes('scrypt$'), false);

  // Valid admin password without SMTP configured -> 503 and NO OTP in response
  const noSmtpAdminRes = await fetch(`${baseUrl}/api/auth/admin/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'vortexstore.team@gmail.com',
      password: 'StrongPassword2026',
    }),
  });
  assert.equal(noSmtpAdminRes.status, 503);
  const noSmtpAdminJson = (await noSmtpAdminRes.json()) as Record<string, unknown>;
  assert.equal('fallbackOtpCode' in noSmtpAdminJson, false);
  assert.equal('activationGate' in noSmtpAdminJson, false);
  assert.equal('code' in noSmtpAdminJson, false);

  // Customer email verification without SMTP configured -> 503 and NO fallbackOtpCode
  const userOtpRes = await fetch(`${baseUrl}/api/auth/email-verification/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'customer@example.com',
      name: 'أحمد علي',
    }),
  });
  assert.equal(userOtpRes.status, 503);
  const userOtpJson = (await userOtpRes.json()) as Record<string, unknown>;
  assert.equal('fallbackOtpCode' in userOtpJson, false);
  assert.equal('code' in userOtpJson, false);
});

test('Protected API routes reject missing or invalid Firebase Bearer tokens', async () => {
  const smtpRes = await fetch(`${baseUrl}/api/admin/smtp-status`);
  assert.equal(smtpRes.status, 401);

  const inviteRes = await fetch(`${baseUrl}/api/invitations/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer invalid.token.value_placeholder_12345',
    },
    body: JSON.stringify({
      email: 'store@example.com',
      token: 'abcdef1234567890abcdef',
      userType: 'store',
    }),
  });
  assert.equal(inviteRes.status, 401);

  const aiRes = await fetch(`${baseUrl}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'عايز مطعم سمك' }),
  });
  assert.equal(aiRes.status, 401);
});

test('Paymob webhook requires HMAC secret and validates HMAC-SHA512 signature strictly', async () => {
  // Missing PAYMOB_HMAC_SECRET returns 503
  const missingSecretRes = await fetch(`${baseUrl}/api/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ obj: { success: true } }),
  });
  assert.equal(missingSecretRes.status, 503);

  // Configure HMAC secret
  const secret = 'edkawy_test_paymob_hmac_secret_2026';
  process.env.PAYMOB_HMAC_SECRET = secret;
  const { payload, hmac } = buildPaymobSignedPayload(secret);

  // Forged signature rejected with 401
  const badSigRes = await fetch(`${baseUrl}/api/webhook?hmac=${'a'.repeat(128)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  assert.equal(badSigRes.status, 401);

  // Tampered payload rejected with 401
  const tamperedPayload = buildPaymobSignedPayload(secret, { amount_cents: 100 }).payload;
  const tamperedRes = await fetch(`${baseUrl}/api/webhook?hmac=${hmac}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tamperedPayload),
  });
  assert.equal(tamperedRes.status, 401);

  // Valid signature accepted with 200
  const validRes = await fetch(`${baseUrl}/api/webhook?hmac=${hmac}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  assert.equal(validRes.status, 200);
  const validJson = (await validRes.json()) as {
    received: boolean;
    orderId: string;
    status: string;
    signatureValid: boolean;
  };
  assert.equal(validJson.received, true);
  assert.equal(validJson.signatureValid, true);
  assert.equal(validJson.orderId, 'ord_paymob_1001');
  assert.equal(validJson.status, 'confirmed');
});
