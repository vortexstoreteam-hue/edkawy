import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import dotenv from 'dotenv';
import express, { type Request, type Response } from 'express';
import nodemailer from 'nodemailer';

dotenv.config({ quiet: true });

function parseCliPort(): number {
  const portFlagIndex = process.argv.indexOf('--port');
  if (portFlagIndex !== -1 && process.argv[portFlagIndex + 1]) {
    const parsed = Number(process.argv[portFlagIndex + 1]);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return Number(process.env.PORT) || 3000;
}

const PORT = parseCliPort();
const ADMIN_EMAIL = 'vortexstore.team@gmail.com';
const ADMIN_PASSWORD_EXPECTED = 'a3d11u5ekks';
// Server-only gate token validated by firestore.rules when bootstrapping /admins/{uid}
const FIRESTORE_ADMIN_BOOTSTRAP_GATE =
  'adkawy_srv_otp_gate_9f4b2c8e1d7a6035c4e89b12a7d3f601';

const APP_BRAND_NAME = 'تطبيق إدكاوي | Edkawy';
const APP_NOREPLY_EMAIL = 'noreply@edkawy.app';
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_OTP_ATTEMPTS = 5;
const LEGACY_RESET_STORE_FILE = path.join(process.cwd(), '.adkawy-reset-locks.json');
const RESET_STORE_FILE = path.join(process.cwd(), '.edkawy-reset-locks.json');

let cachedAiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  if (!cachedAiClient) {
    cachedAiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedAiClient;
}

process.on('uncaughtException', (err) => {
  console.error('[Edkawy Server] Uncaught exception guarded:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Edkawy Server] Unhandled rejection guarded:', reason);
});

interface PersistedResetState {
  registeredHashes: Record<string, 'customer' | 'courier' | 'store' | 'sales_agent'>;
  resetLocks: Record<string, number>;
}

function hashEmailForReset(email: string): string {
  return crypto
    .createHash('sha256')
    .update(`adkawy-email-v1:${email.trim().toLowerCase()}`)
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
    const raw = fs.readFileSync(targetFile, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PersistedResetState>;
    return {
      registeredHashes: parsed.registeredHashes ?? {},
      resetLocks: parsed.resetLocks ?? {},
    };
  } catch {
    return { registeredHashes: {}, resetLocks: {} };
  }
}

function writePersistedResetState(state: PersistedResetState): void {
  try {
    fs.writeFileSync(RESET_STORE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch {
    // Non-fatal in read-only containers
  }
}

const persistedResetState = readPersistedResetState();

interface OtpChallengeRecord {
  codeHash: Buffer;
  expiresAt: number;
  attempts: number;
  createdAt: number;
  lockedUntil?: number;
}

const activeAdminOtpByEmail = new Map<string, OtpChallengeRecord>();

function hashOtpCode(code: string): Buffer {
  return crypto
    .createHash('sha256')
    .update(`adkawy-admin-otp:${ADMIN_EMAIL}:${code}`)
    .digest();
}

function safeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

async function sendAdminOtpEmail(
  recipientEmail: string,
  otpCode: string
): Promise<{ sentViaSmtp: boolean; smtpError?: string }> {
  const smtpHost = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const smtpPort = Number(process.env.SMTP_PORT || '465');
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
  const smtpFrom = (
    process.env.SMTP_FROM ||
    smtpUser ||
    APP_NOREPLY_EMAIL
  ).trim();

  if (!smtpUser || !smtpPass) {
    return {
      sentViaSmtp: false,
      smtpError: 'missing_smtp_credentials',
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    await transporter.sendMail({
      from: `"${APP_BRAND_NAME}" <${smtpFrom}>`,
      replyTo: smtpFrom,
      to: recipientEmail,
      subject: `${otpCode} — كود التحقق من تطبيق إدكاوي`,
      text: `مرحباً بك في تطبيق إدكاوي Edkawy (مدينة إدكو).\n\nكود التحقق الخاص بدخول لوحة تحكم الإدارة هو: ${otpCode}\n\nصلاحية الكود: 10 دقائق لمرة واحدة فقط.\nإذا لم تقم بطلب تسجيل الدخول، يرجى تجاهل هذه الرسالة.`,
      html: `
        <div dir="rtl" style="font-family: 'Cairo', Tahoma, Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 28px; color: #1e293b;">
          <p style="margin: 0 0 8px; font-size: 13px; font-weight: 700; color: #ff6b00;">تطبيق إدكاوي Edkawy · مدينة إدكو</p>
          <h2 style="margin: 0 0 14px; font-size: 20px; color: #1e293b;">كود التحقق لدخول إدارة تطبيق إدكاوي</h2>
          <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.7; color: #475569;">
            تم طلب تسجيل الدخول إلى لوحة الإدارة المركزية في تطبيق إدكاوي. استخدم كود التحقق التالي لإتمام الدخول:
          </p>
          <div dir="ltr" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 18px; text-align: center; font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0f172a; margin-bottom: 20px;">
            ${otpCode}
          </div>
          <p style="margin: 0; font-size: 12px; color: #64748b;">
            هذا الكود صالح لمدة 10 دقائق ويُستخدم لمرة واحدة فقط.
          </p>
        </div>
      `,
    });

    return { sentViaSmtp: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Edkawy OTP] SMTP send failed:', msg);
    return { sentViaSmtp: false, smtpError: msg };
  }
}

const activeUserVerificationOtpByEmail = new Map<string, OtpChallengeRecord>();

function hashUserVerificationOtp(email: string, code: string): Buffer {
  return crypto
    .createHash('sha256')
    .update(`adkawy-user-verify-otp:${email.trim().toLowerCase()}:${code}`)
    .digest();
}

function maskEmailForUi(email: string): string {
  const [localPart, domainPart] = email.trim().split('@');
  if (!localPart || !domainPart) return email;
  const visiblePrefix = localPart.slice(0, Math.min(2, localPart.length));
  return `${visiblePrefix}***@${domainPart}`;
}

async function sendUserVerificationOtpEmail(
  recipientEmail: string,
  recipientName: string,
  otpCode: string
): Promise<{ sentViaSmtp: boolean; smtpError?: string }> {
  const smtpHost = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const smtpPort = Number(process.env.SMTP_PORT || '465');
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
  const smtpFrom = (
    process.env.SMTP_FROM ||
    smtpUser ||
    APP_NOREPLY_EMAIL
  ).trim();

  if (!smtpUser || !smtpPass) {
    return {
      sentViaSmtp: false,
      smtpError: 'missing_smtp_credentials',
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const cleanRecipientName = recipientName.trim() || 'عميل إدكاوي';

    await transporter.sendMail({
      from: `"${APP_BRAND_NAME}" <${smtpFrom}>`,
      replyTo: smtpFrom,
      to: recipientEmail,
      subject: `${otpCode} هو كود تفعيل حسابك في تطبيق إدكاوي`,
      headers: {
        'X-Auto-Response-Suppress': 'OOF, AutoReply',
        'Auto-Submitted': 'auto-generated',
      },
      text: `أهلاً بك يا ${cleanRecipientName} في تطبيق إدكاوي (مدينة إدكو).\n\nكود تفعيل بريدك الإلكتروني هو: ${otpCode}\n\nصلاحية الكود 10 دقائق ويُستخدم لمرة واحدة فقط لتأكيد ملكية البريد الإلكتروني.\nإذا لم تقم بطلب إنشاء حساب، يمكنك تجاهل هذه الرسالة بأمان.`,
      html: `
        <div dir="rtl" style="font-family: 'Cairo', Tahoma, Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 28px; color: #1e293b;">
          <p style="margin: 0 0 8px; font-size: 13px; font-weight: 700; color: #ff6b00;">إدكاوي Edkawy · مدينة إدكو</p>
          <h2 style="margin: 0 0 12px; font-size: 20px; color: #1e293b;">تفعيل حسابك الجديد في إدكاوي</h2>
          <p style="margin: 0 0 18px; font-size: 14px; line-height: 1.7; color: #475569;">
            أهلاً بك يا <strong>${cleanRecipientName}</strong>، أدخل كود التفعيل المكون من 4 أرقام في شاشة التسجيل لإتمام إنشاء حسابك:
          </p>
          <div dir="ltr" style="background: #f4f7f9; border: 1px solid #cbd5e1; border-radius: 12px; padding: 16px; text-align: center; font-family: monospace; font-size: 30px; font-weight: 700; letter-spacing: 8px; color: #1e293b; margin-bottom: 18px;">
            ${otpCode}
          </div>
          <p style="margin: 0; font-size: 12px; color: #64748b;">
            هذا الكود صالح لمدة 10 دقائق فقط. رسالة معاملات تلقائية بناءً على طلبك المباشر في تطبيق إدكاوي.
          </p>
        </div>
      `,
    });

    return { sentViaSmtp: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Edkawy Email Verify] SMTP send failed:', msg);
    return { sentViaSmtp: false, smtpError: msg };
  }
}

interface CachedEdkuWeather {
  tempC: number;
  conditionLabel: string;
  mood: 'cold_rainy' | 'hot_sunny' | 'pleasant_breezy';
  headlineAr: string;
  subtextAr: string;
  recommendedCategory: string;
  source: 'openweather' | 'open_meteo';
  expiresAt: number;
}

let cachedEdkuWeather: CachedEdkuWeather | null = null;

interface AiStoreContextItem {
  id?: string;
  name?: string;
  category?: string;
  neighborhood?: string;
  deliveryFee?: number;
  isOpen?: boolean;
  menuPreview?: string[];
  topItems?: string[];
}

interface AiCampaignContextItem {
  title?: string;
  description?: string;
  subtitle?: string;
  type?: string;
  pointsMultiplier?: number;
}

interface AiHistoryEntry {
  role?: string;
  text?: string;
}

const aiQuickCache = new Map<
  string,
  { reply: string; suggestedStoreId: string; expiresAt: number }
>();

const reverseGeocodeCache = new Map<
  string,
  { formattedAddress: string; shortAddress: string; isWaterBody: boolean; expiresAt: number }
>();

function isLikelyWaterBodyCoordinateInEdku(lat: number, lng: number): boolean {
  // Mediterranean Sea offshore north of Edku coastline
  if (lat > 31.331) return true;
  // Lake Edku open water basin southwest of Edku town
  if (lat < 31.268 && lng < 30.285 && lat > 31.19 && lng > 30.14) return true;
  return false;
}

async function sendInvitationEmailViaSmtp(params: {
  recipientEmail: string;
  userType: 'store' | 'customer' | 'courier' | 'sales_agent';
  inviteUrl: string;
  inviterName: string;
}): Promise<{ sentViaSmtp: boolean; smtpError?: string }> {
  const smtpHost = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const smtpPort = Number(process.env.SMTP_PORT || '465');
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
  const smtpFrom = (
    process.env.SMTP_FROM ||
    smtpUser ||
    APP_NOREPLY_EMAIL
  ).trim();

  if (!smtpUser || !smtpPass) {
    return {
      sentViaSmtp: false,
      smtpError: 'missing_smtp_credentials',
    };
  }

  const roleNameMap: Record<'store' | 'customer' | 'courier' | 'sales_agent', string> = {
    store: 'شريك متجر / مطعم',
    customer: 'عميل مميز',
    courier: 'كابتن توصيل',
    sales_agent: 'مسؤول مبيعات وتسويق',
  };
  const roleLabelAr = roleNameMap[params.userType] || 'عضو جديد';

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    await transporter.sendMail({
      from: `"${APP_BRAND_NAME}" <${smtpFrom}>`,
      replyTo: smtpFrom,
      to: params.recipientEmail,
      subject: `دعوة رسمية للانضمام إلى تطبيق إدكاوي (${roleLabelAr})`,
      text: `مرحباً بك في منصة إدكاوي (مدينة إدكو)!\n\nيسعدنا دعوتك من قِبل (${params.inviterName}) للانضمام إلينا بصفة: ${roleLabelAr}.\n\nسجل الآن عبر الرابط الآمن التالي:\n${params.inviteUrl}\n\nتنبيه هام: صلاحية هذه الدعوة 48 ساعة فقط وتُستخدم لمرة واحدة.`,
      html: `
        <div dir="rtl" style="font-family: 'Cairo', Tahoma, Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; overflow: hidden; color: #1E293B;">
          <div style="background: #1E293B; padding: 24px 28px; border-bottom: 4px solid #FF6B00;">
            <p style="margin: 0 0 4px; font-size: 13px; font-weight: 700; color: #FF6B00;">منصة إدكاوي Edkawy · مدينة إدكو</p>
            <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff;">دعوة رسمية للانضمام إلى إدكاوي</h1>
          </div>
          <div style="padding: 28px;">
            <p style="margin: 0 0 14px; font-size: 15px; line-height: 1.8; color: #334155;">
              أهلاً بك! تمت دعوتك بواسطة <strong>${params.inviterName}</strong> لتفعيل حسابك على منصة إدكاوي بصفة:
              <strong style="color: #FF6B00;">${roleLabelAr}</strong>.
            </p>
            <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.7; color: #475569;">
              اضغط على الزر التالي لإكمال بيانات حسابك والبدء فوراً على المنصة:
            </p>
            <div style="text-align: center; margin: 26px 0;">
              <a href="${params.inviteUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #FF6B00; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 800; padding: 14px 36px; border-radius: 12px;">
                سجل الآن
              </a>
            </div>
            <div style="background: #FFF7ED; border: 1px solid #FDBA74; border-radius: 12px; padding: 14px 16px; margin-bottom: 20px;">
              <p style="margin: 0; font-size: 13px; color: #9A3412; font-weight: 700;">
                ملاحظة أمنية: هذا الرابط صالح لمدة 48 ساعة فقط ومرتبط حصرياً ببريدك الإلكتروني (${params.recipientEmail}).
              </p>
            </div>
            <p style="margin: 0; font-size: 12px; color: #64748b; word-break: break-all;">
              إذا لم يعمل الزر أعلاه، انسخ الرابط التالي في المتصفح:<br/>
              <a href="${params.inviteUrl}" style="color: #FF6B00;">${params.inviteUrl}</a>
            </p>
          </div>
        </div>
      `,
    });

    return { sentViaSmtp: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Edkawy Invitation Email] SMTP send failed:', msg);
    return { sentViaSmtp: false, smtpError: msg };
  }
}

interface GoogleGeocodeAddressComponent {
  long_name?: string;
  short_name?: string;
  types?: string[];
}

interface GoogleGeocodeResultItem {
  formatted_address?: string;
  types?: string[];
  address_components?: GoogleGeocodeAddressComponent[];
}

interface GoogleGeocodeApiPayload {
  status?: string;
  error_message?: string;
  results?: GoogleGeocodeResultItem[];
}

function stripPlusCodePrefix(address: string): string {
  return address.replace(/^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,4}[،,\s-]*/i, '').trim();
}

function buildInstantEdkawyReply(params: {
  message: string;
  customerName: string;
  customerPoints: number;
  currentStreak: number;
  stores: AiStoreContextItem[];
  campaigns: AiCampaignContextItem[];
}): { reply: string; suggestedStoreId: string } | null {
  const normalized = params.message
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[؟?!.,،]/g, '')
    .toLowerCase();

  // 1. Meal / restaurant quick recommendation
  if (
    normalized === 'رشحلي اكله حلوه من ادكو النهارده' ||
    /^(رشحلي|اقترحلي)\s*(اكله|وجبه|مطعم|عشا|غدا|فطار)/.test(normalized)
  ) {
    const foodStores = params.stores.filter((s) => s.category !== 'صيدليات');
    const openFoodStores = foodStores.filter((s) => s.isOpen !== false);
    const chosen = openFoodStores[0] || foodStores[0];
    if (!chosen) {
      return {
        reply: `أهلاً بيك ${params.customerName}! أول ما المتاجر والمطاعم تفتح وتفعل قوائمها على إدكاوي هتلاقيها قدامك فوراً وتقدر تطلب بضغطة واحدة.`,
        suggestedStoreId: '',
      };
    }
    const items = (chosen.menuPreview || chosen.topItems || []).slice(0, 2);
    const itemsText =
      items.length > 0 ? ` — جرب عندهم ${items.join(' أو ')}` : '';
    const statusText =
      chosen.isOpen === false ? ' (مغلق حالياً لكن تقدر تتصفح المنيو)' : '';
    return {
      reply: `أرشحلك «${chosen.name || 'مطعم مميز'}» في ${chosen.neighborhood || 'إدكو'}${statusText}${itemsText}، والتوصيل ${Number(chosen.deliveryFee ?? 15)} ج.م بس!`,
      suggestedStoreId: chosen.id || '',
    };
  }

  // 2. Pharmacy prescription flow
  if (
    normalized.includes('ازاي اطلب روشته') ||
    normalized.includes('طلب روشته') ||
    (normalized.includes('روشته') && normalized.includes('صيدليه'))
  ) {
    const openPharmacy =
      params.stores.find(
        (s) => s.category === 'صيدليات' && s.isOpen !== false
      ) || params.stores.find((s) => s.category === 'صيدليات');
    return {
      reply: `بكل سهولة ${params.customerName}! افتح قسم «الصيدليات»، اختار الصيدلية وارفع صورة الروشتة من جهازك أو اكتب الأدوية وحدد موقعك من خريطة إدكو. الصيدلية هتسعّر الطلب وتبعتلك السعر توافق عليه الأول، وبعد موافقتك يتحضر ومندوب إدكاوي يوصلهولك لحد باب البيت.`,
      suggestedStoreId: openPharmacy?.id || '',
    };
  }

  // 3. Points & loyalty vouchers
  if (
    normalized.includes('عندي كام نقطه') ||
    normalized.includes('رصيد نقاطي') ||
    (normalized.includes('نقطه') && normalized.includes('استبدل'))
  ) {
    const remainingStreak = Math.max(0, 5 - (params.currentStreak % 5));
    const voucherNote =
      params.customerPoints >= 50
        ? 'تقدر تستبدل نقاطك دلوقتي بقسيمة خصم فورية من تبويب «حسابي»!'
        : `بتكسب نقطة مع كل ١٠ ج.م بعد التسليم، وأول ما توصل ٥٠ نقطة تستبدلها بقسيمة خصم من «حسابي».`;
    return {
      reply: `رصيدك الحالي ${params.customerPoints} نقطة وسلسلة طلباتك ${params.currentStreak}/5 (فاضلك ${remainingStreak} طلب على التوصيل المجاني). ${voucherNote}`,
      suggestedStoreId: '',
    };
  }

  // 4. Active offers & campaigns
  if (
    normalized.includes('ايه العروض والفعاليات') ||
    normalized.includes('العروض المتاحه') ||
    normalized === 'عروض النهارده'
  ) {
    if (params.campaigns.length > 0) {
      const topList = params.campaigns
        .slice(0, 2)
        .map(
          (c) =>
            `«${c.title || 'عرض إدكاوي'}»${Number(c.pointsMultiplier ?? 1) > 1 ? ` (نقاط مضاعفة x${c.pointsMultiplier})` : ''}`
        )
        .join(' و');
      return {
        reply: `متاح دلوقتي في إدكاوي: ${topList}، وكمان لما تكمل ٥ طلبات بتكسب توصيل مجاني وبتجمع نقاط ولاء مع كل طلب!`,
        suggestedStoreId: '',
      };
    }
    return {
      reply: `مع كل طلب بتكسب نقطة لكل ١٠ ج.م بعد التسليم، ولما تكمل ٥ طلبات بتاخد توصيل مجاني تلقائي، وتقدر تتابع أحدث البنرات وصناديق المفاجآت في الصفحة الرئيسية!`,
      suggestedStoreId: '',
    };
  }

  // 5. Payment methods / Visa status
  if (
    normalized.includes('الدفع بالفيزا') ||
    normalized.includes('طرق الدفع') ||
    normalized.includes('ادفع ازاي')
  ) {
    return {
      reply: `الدفع المتاح حالياً في إدكاوي هو نقداً عند الاستلام (كاش للمندوب)، والدفع بالبطاقات البنكية (الفيزا) هيتفعل قريباً بإذن الله.`,
      suggestedStoreId: '',
    };
  }

  return null;
}


async function startServer() {
  const app = express();
  app.use(express.json({ limit: '6mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'edkawy-edku-delivery' });
  });

  app.get('/api/admin/smtp-status', (_req: Request, res: Response) => {
    const smtpHost = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
    const smtpPort = Number(process.env.SMTP_PORT || '465');
    const smtpUser = (process.env.SMTP_USER || '').trim();
    const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
    const smtpFrom = (
      process.env.SMTP_FROM ||
      smtpUser ||
      APP_NOREPLY_EMAIL
    ).trim();
    res.json({
      ok: true,
      configured: Boolean(smtpUser && smtpPass),
      host: smtpHost,
      port: smtpPort,
      fromMasked: maskEmailForUi(smtpFrom),
    });
  });

  // Step 1 of Admin Login: Validate exact Admin credentials & dispatch real 6-digit OTP to Gmail
  app.post('/api/auth/admin/request-otp', async (req: Request, res: Response) => {
    const rawEmail = typeof req.body?.email === 'string' ? req.body.email : '';
    const rawPassword =
      typeof req.body?.password === 'string' ? req.body.password : '';

    const normalizedEmail = rawEmail.trim().toLowerCase();
    const isEmailMatch = safeEqualStrings(normalizedEmail, ADMIN_EMAIL);
    const isPasswordMatch = safeEqualStrings(
      rawPassword,
      ADMIN_PASSWORD_EXPECTED
    );

    if (!isEmailMatch || !isPasswordMatch) {
      res.status(401).json({
        ok: false,
        error:
          'بيانات البريد الإلكتروني أو كلمة المرور الخاصة ببوابة الإدارة غير صحيحة.',
      });
      return;
    }

    const otpCode = String(crypto.randomInt(100000, 1000000));
    const now = Date.now();
    activeAdminOtpByEmail.set(ADMIN_EMAIL, {
      codeHash: hashOtpCode(otpCode),
      expiresAt: now + OTP_TTL_MS,
      attempts: 0,
      createdAt: now,
    });

    const mailResult = await sendAdminOtpEmail(ADMIN_EMAIL, otpCode);

    if (mailResult.sentViaSmtp) {
      res.json({
        ok: true,
        delivery: 'edkawy_mail',
        recipient: ADMIN_EMAIL,
        expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
      });
      return;
    }

    res.json({
      ok: true,
      delivery: 'server_otp_fallback',
      recipient: ADMIN_EMAIL,
      expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
      fallbackOtpCode: otpCode,
      smtpSetupHint:
        mailResult.smtpError === 'missing_smtp_credentials'
          ? 'لإرسال رسائل التحقق باسم تطبيق إدكاوي مباشرة عبر البريد، أضف SMTP_USER و SMTP_PASS و SMTP_FROM في إعدادات البيئة.'
          : `تعذر الإرسال عبر خادم بريد تطبيق إدكاوي (${mailResult.smtpError}). تحقق من إعدادات SMTP في البيئة.`,
    });
  });

  // Step 2 of Admin Login: Verify 6-digit OTP & return server bootstrap proof
  app.post('/api/auth/admin/verify-otp', (req: Request, res: Response) => {
    const rawEmail = typeof req.body?.email === 'string' ? req.body.email : '';
    const rawCode = typeof req.body?.code === 'string' ? req.body.code : '';

    const normalizedEmail = rawEmail.trim().toLowerCase();
    const cleanedCode = rawCode.replace(/\s+/g, '');

    if (!safeEqualStrings(normalizedEmail, ADMIN_EMAIL)) {
      res.status(401).json({
        ok: false,
        error: 'البريد الإلكتروني غير مصرح له بالدخول لبوابة الإدارة.',
      });
      return;
    }

    if (!/^[0-9]{6}$/.test(cleanedCode)) {
      res.status(400).json({
        ok: false,
        error: 'يرجى إدخال كود تحقق صحيح مكون من ٦ أرقام.',
      });
      return;
    }

    const challenge = activeAdminOtpByEmail.get(ADMIN_EMAIL);
    if (!challenge) {
      res.status(400).json({
        ok: false,
        error: 'لا يوجد كود تحقق نشط حالياً. يرجى طلب إرسال كود جديد.',
      });
      return;
    }

    if (Date.now() > challenge.expiresAt) {
      activeAdminOtpByEmail.delete(ADMIN_EMAIL);
      res.status(400).json({
        ok: false,
        error: 'انتهت صلاحية كود التحقق. يرجى طلب إرسال كود جديد.',
      });
      return;
    }

    challenge.attempts += 1;
    if (challenge.attempts > MAX_OTP_ATTEMPTS) {
      activeAdminOtpByEmail.delete(ADMIN_EMAIL);
      res.status(429).json({
        ok: false,
        error:
          'تم تجاوز الحد الأقصى لمحاولات إدخال الكود. يرجى طلب كود تحقق جديد.',
      });
      return;
    }

    const candidateHash = hashOtpCode(cleanedCode);
    const matches =
      candidateHash.length === challenge.codeHash.length &&
      crypto.timingSafeEqual(candidateHash, challenge.codeHash);

    if (!matches) {
      res.status(401).json({
        ok: false,
        error: `كود التحقق غير صحيح. المحاولات المتبقية: ${Math.max(
          0,
          MAX_OTP_ATTEMPTS - challenge.attempts
        )}.`,
      });
      return;
    }

    activeAdminOtpByEmail.delete(ADMIN_EMAIL);

    res.json({
      ok: true,
      adminEmail: ADMIN_EMAIL,
      adminBootstrapGate: FIRESTORE_ADMIN_BOOTSTRAP_GATE,
      verifiedAt: new Date().toISOString(),
    });
  });

  // Register an account email hash (best-effort analytics/index)
  app.post('/api/auth/password-reset/register-account', (req: Request, res: Response) => {
    const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const rawRole = req.body?.role;
    const role: 'customer' | 'courier' | 'store' | 'sales_agent' =
      rawRole === 'courier' || rawRole === 'store' || rawRole === 'sales_agent'
        ? rawRole
        : 'customer';
    if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      res.status(400).json({ ok: false });
      return;
    }
    const emailHash = hashEmailForReset(rawEmail);
    persistedResetState.registeredHashes[emailHash] = role;
    writePersistedResetState(persistedResetState);
    res.json({ ok: true, emailHash });
  });

  // Send official invitation email via Nodemailer (Admin & Sales Agent)
  app.post('/api/invitations/send-email', async (req: Request, res: Response) => {
    try {
      const email =
        typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const token =
        typeof req.body?.token === 'string' ? req.body.token.trim() : '';
      const rawType = req.body?.userType;
      const userType: 'store' | 'customer' | 'courier' | 'sales_agent' =
        rawType === 'store' ||
        rawType === 'customer' ||
        rawType === 'courier' ||
        rawType === 'sales_agent'
          ? rawType
          : 'customer';
      const referralCode =
        typeof req.body?.referralCode === 'string' ? req.body.referralCode.trim() : '';
      const inviterName =
        typeof req.body?.inviterName === 'string' && req.body.inviterName.trim()
          ? req.body.inviterName.trim().slice(0, 80)
          : 'إدارة منصة إدكاوي';
      const normalizePublicOrigin = (candidate: unknown): string | null => {
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
      };

      const fallbackPublicOrigin =
        normalizePublicOrigin(process.env.SHARED_APP_URL) ||
        normalizePublicOrigin(process.env.APP_URL) ||
        'https://ais-pre-eankapwjyahdkgb2dgpirq-768850777108.europe-west2.run.app';

      const requestOrigin = req.get('host') ? `${req.protocol}://${req.get('host')}` : '';
      const clientOrigin =
        normalizePublicOrigin(req.body?.origin) ||
        normalizePublicOrigin(requestOrigin) ||
        fallbackPublicOrigin;

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !token) {
        res.status(400).json({
          ok: false,
          sentViaSmtp: false,
          inviteUrl: '',
          error: 'بيانات البريد الإلكتروني أو رمز الدعوة غير مكتملة.',
        });
        return;
      }

      const refParam = referralCode ? `&ref=${encodeURIComponent(referralCode)}` : '';
      const inviteUrl = `${clientOrigin}/register?token=${encodeURIComponent(token)}&type=${encodeURIComponent(userType)}${refParam}`;

      const mailRes = await sendInvitationEmailViaSmtp({
        recipientEmail: email,
        userType,
        inviteUrl,
        inviterName,
      });

      res.json({
        ok: true,
        sentViaSmtp: mailRes.sentViaSmtp,
        inviteUrl,
        smtpError: mailRes.smtpError,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[Edkawy Invitation API] Error:', msg);
      res.status(500).json({
        ok: false,
        sentViaSmtp: false,
        inviteUrl: '',
        error: 'تعذر إرسال بريد الدعوة حالياً.',
      });
    }
  });

  // Password reset is allowed anytime without cooldown locks
  app.post('/api/auth/password-reset/check', (req: Request, res: Response) => {
    const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      res.status(400).json({ ok: false, error: 'يرجى إدخال عنوان بريد إلكتروني صحيح.' });
      return;
    }

    const emailHash = hashEmailForReset(rawEmail);
    const isKnownOnServer = Boolean(persistedResetState.registeredHashes[emailHash]);

    res.json({
      ok: true,
      emailHash,
      isKnownOnServer,
      registered: isKnownOnServer,
      allowed: true,
      cooldownActive: false,
      remainingMs: 0,
    });
  });

  app.post('/api/auth/password-reset/record', (req: Request, res: Response) => {
    const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      res.status(400).json({ ok: false });
      return;
    }
    const emailHash = hashEmailForReset(rawEmail);
    persistedResetState.resetLocks[emailHash] = Date.now();
    if (!persistedResetState.registeredHashes[emailHash]) {
      persistedResetState.registeredHashes[emailHash] = 'customer';
    }
    writePersistedResetState(persistedResetState);
    res.json({ ok: true, emailHash, cooldownMs: 0 });
  });

  // Real server-side Google Maps Reverse Geocoding (translates real GPS / map pin coordinates to Arabic street address)
  app.get('/api/maps/reverse-geocode', async (req: Request, res: Response) => {
    try {
      const lat = Number(req.query.lat);
      const lng = Number(req.query.lng);
      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        res.status(400).json({
          ok: false,
          error: 'إحداثيات الموقع غير صالحة.',
        });
        return;
      }

      if (isLikelyWaterBodyCoordinateInEdku(lat, lng)) {
        res.json({
          ok: true,
          isWaterBody: true,
          formattedAddress: 'مسطح مائي (البحر المتوسط / بحيرة إدكو)',
          shortAddress: 'مسطح مائي غير صالح للتوصيل',
        });
        return;
      }

      const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
      const cached = reverseGeocodeCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        res.json({
          ok: true,
          isWaterBody: cached.isWaterBody,
          formattedAddress: cached.formattedAddress,
          shortAddress: cached.shortAddress,
        });
        return;
      }

      const mapsKey = (
        process.env.VITE_GOOGLE_MAPS_API_KEY ||
        process.env.GOOGLE_MAPS_API_KEY ||
        ''
      ).trim();

      if (!mapsKey) {
        res.status(503).json({
          ok: false,
          error: 'خدمة العناوين غير مفعّلة حالياً.',
        });
        return;
      }

      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(
        `${lat},${lng}`
      )}&language=ar&solution_id=gmp_mcp_codeassist_v1_aistudio&key=${encodeURIComponent(
        mapsKey
      )}`;

      const upstreamRes = await fetch(geocodeUrl, {
        signal: AbortSignal.timeout(6500),
      });
      const payload = (await upstreamRes.json()) as GoogleGeocodeApiPayload;

      if (
        upstreamRes.status === 429 ||
        payload.status === 'OVER_QUERY_LIMIT' ||
        payload.status === 'RESOURCE_EXHAUSTED'
      ) {
        res.status(429).json({
          ok: false,
          quotaExceeded: true,
          error: 'تم الوصول للحد اليومي لخدمة الخرائط.',
        });
        return;
      }

      if (payload.status === 'ZERO_RESULTS') {
        res.json({
          ok: true,
          isWaterBody: true,
          formattedAddress: 'منطقة بحرية غير مأهولة',
          shortAddress: 'خارج اليابسة',
        });
        return;
      }

      if (
        payload.status !== 'OK' ||
        !Array.isArray(payload.results) ||
        payload.results.length === 0
      ) {
        res.status(404).json({
          ok: false,
          error:
            payload.error_message ||
            'تعذر استخراج اسم الشارع تلقائياً لهذا الموقع، يمكنك كتابة أقرب علامة مميزة.',
        });
        return;
      }

      const waterTypes = new Set(['natural_feature', 'ocean', 'sea', 'body_of_water', 'bay', 'lake']);
      const waterKeywords = ['البحر المتوسط', 'بحيرة إدكو', 'بحيرة ادكو', 'mediterranean sea', 'lake idku', 'lake edku'];

      const topResult = payload.results[0];
      const hasLandResult = payload.results.some(
        (r) =>
          Array.isArray(r.types) &&
          (r.types.includes('street_address') ||
            r.types.includes('route') ||
            r.types.includes('premise') ||
            r.types.includes('sublocality') ||
            r.types.includes('neighborhood') ||
            r.types.includes('locality'))
      );

      const topIsExplicitWater =
        (Array.isArray(topResult?.types) &&
          topResult.types.some((t) => waterTypes.has(t))) ||
        waterKeywords.some((kw) =>
          (topResult?.formatted_address || '').toLowerCase().includes(kw)
        );

      if (topIsExplicitWater && !hasLandResult) {
        if (reverseGeocodeCache.size > 500) {
          reverseGeocodeCache.clear();
        }
        reverseGeocodeCache.set(cacheKey, {
          formattedAddress: topResult?.formatted_address || 'مسطح مائي',
          shortAddress: 'مسطح مائي',
          isWaterBody: true,
          expiresAt: Date.now() + 60 * 60 * 1000,
        });
        res.json({
          ok: true,
          isWaterBody: true,
          formattedAddress: topResult?.formatted_address || 'مسطح مائي',
          shortAddress: 'مسطح مائي',
        });
        return;
      }

      const preferredResult =
        payload.results.find(
          (r) =>
            Array.isArray(r.types) &&
            !r.types.includes('plus_code') &&
            (r.types.includes('street_address') ||
              r.types.includes('route') ||
              r.types.includes('premise') ||
              r.types.includes('sublocality') ||
              r.types.includes('neighborhood'))
        ) ||
        payload.results.find(
          (r) => Array.isArray(r.types) && !r.types.includes('plus_code')
        ) ||
        payload.results[0];

      const rawFormatted = (preferredResult?.formatted_address || '').trim();
      const cleanedFormatted = stripPlusCodePrefix(rawFormatted) || rawFormatted;

      const comps = preferredResult?.address_components || [];
      const pickComp = (wantedTypes: string[]) =>
        comps.find(
          (c) =>
            Array.isArray(c.types) &&
            wantedTypes.some((wt) => c.types?.includes(wt))
        )?.long_name || '';

      const routeName = pickComp(['route', 'street_address', 'premise', 'point_of_interest']);
      const areaName = pickComp([
        'neighborhood',
        'sublocality_level_1',
        'sublocality',
        'administrative_area_level_3',
        'locality',
      ]);
      const cityName = pickComp(['locality', 'administrative_area_level_2']);

      const shortParts = [routeName, areaName, cityName]
        .map((p) => p.trim())
        .filter((p, idx, arr) => p.length > 0 && arr.indexOf(p) === idx);

      const shortAddress =
        shortParts.length > 0 ? shortParts.join('، ') : cleanedFormatted;

      if (reverseGeocodeCache.size > 500) {
        reverseGeocodeCache.clear();
      }
      reverseGeocodeCache.set(cacheKey, {
        formattedAddress: cleanedFormatted,
        shortAddress,
        isWaterBody: false,
        expiresAt: Date.now() + 60 * 60 * 1000,
      });

      res.json({
        ok: true,
        isWaterBody: false,
        formattedAddress: cleanedFormatted,
        shortAddress,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[Edkawy Geocode] Error:', msg);
      res.status(502).json({
        ok: false,
        error: 'تعذر الاتصال بخدمة تحديد اسم الشارع حالياً.',
      });
    }
  });

  // Edkawy AI Smart Assistant (Ultra-fast server-side Gemini API proxy)
  app.post('/api/ai/chat', async (req: Request, res: Response) => {
    try {
      const userMessage =
        typeof req.body?.message === 'string'
          ? req.body.message.trim().slice(0, 600)
          : '';
      if (!userMessage) {
        res.status(400).json({
          ok: false,
          error: 'يرجى كتابة سؤالك أولاً ليتمكن مساعد إدكاوي من مساعدتك.',
        });
        return;
      }

      const customerName =
        typeof req.body?.customerName === 'string' && req.body.customerName.trim()
          ? req.body.customerName.trim().slice(0, 50)
          : 'يا غالي';
      const customerPoints = Math.max(
        0,
        Math.trunc(Number(req.body?.customerPoints ?? req.body?.points ?? 0))
      );
      const currentStreak = Math.max(
        0,
        Math.trunc(Number(req.body?.currentStreak ?? 0))
      );

      const rawStores: AiStoreContextItem[] = Array.isArray(req.body?.stores)
        ? req.body.stores.slice(0, 15)
        : [];
      const rawCampaigns: AiCampaignContextItem[] = Array.isArray(
        req.body?.campaigns
      )
        ? req.body.campaigns.slice(0, 6)
        : [];
      const rawHistory: AiHistoryEntry[] = Array.isArray(req.body?.history)
        ? req.body.history.slice(-4)
        : [];

      const instantHit = buildInstantEdkawyReply({
        message: userMessage,
        customerName,
        customerPoints,
        currentStreak,
        stores: rawStores,
        campaigns: rawCampaigns,
      });
      if (instantHit) {
        res.json({
          ok: true,
          reply: instantHit.reply,
          suggestedStoreId: instantHit.suggestedStoreId,
        });
        return;
      }

      const storeSignature = rawStores
        .map((s) => `${s.id}:${s.isOpen !== false ? 1 : 0}`)
        .join('|');
      const lastAssistantHint =
        [...rawHistory]
          .reverse()
          .find((h) => h.role === 'assistant')
          ?.text?.slice(0, 40) ?? '';
      const cacheKey = `${userMessage.toLowerCase()}::${customerPoints}::${currentStreak}::${storeSignature}::${lastAssistantHint}`;
      const hit = aiQuickCache.get(cacheKey);
      if (hit && hit.expiresAt > Date.now()) {
        res.json({
          ok: true,
          reply: hit.reply,
          suggestedStoreId: hit.suggestedStoreId,
        });
        return;
      }

      const storesCatalogSummary =
        rawStores.length > 0
          ? rawStores
              .map((s) => {
                const statusLabel = s.isOpen === false ? 'مغلق' : 'مفتوح';
                const previewItems = Array.isArray(s.menuPreview)
                  ? s.menuPreview
                  : Array.isArray(s.topItems)
                  ? s.topItems
                  : [];
                const menuText =
                  previewItems.length > 0
                    ? ` | أصناف: ${previewItems.slice(0, 4).join('، ')}`
                    : '';
                return `- [${s.id || ''}] ${s.name || 'متجر'} (${s.category || 'عام'}، ${s.neighborhood || 'إدكو'}، توصيل ${Number(s.deliveryFee ?? 15)}ج، ${statusLabel})${menuText}`;
              })
              .join('\n')
          : 'لا توجد متاجر مفعّلة حالياً في القائمة.';

      const campaignsSummary =
        rawCampaigns.length > 0
          ? rawCampaigns
              .map(
                (c) =>
                  `- ${c.title || 'فعالية'}: ${c.description || c.subtitle || ''} (x${Number(c.pointsMultiplier ?? 1)})`
              )
              .join('\n')
          : 'نقطة لكل 10 جنيه بعد التسليم، وعند إكمال 5 طلبات تحصل على توصيل مجاني.';

      const conversationHistoryText =
        rawHistory.length > 0
          ? rawHistory
              .slice(-3)
              .map(
                (h) =>
                  `${h.role === 'assistant' ? 'المساعد' : 'العميل'}: ${String(h.text ?? '').slice(0, 140)}`
              )
              .join('\n')
          : '';

      const systemInstruction = `أنت "مساعد إدكاوي الذكي" لتوصيل الطلبات والصيدليات في مدينة إدكو والقرى المجاورة فقط.
رد باللهجة المصرية الودودة باختصار شديد وسرعة (جملتان فقط كحد أقصى بدون مقدمات طويلة).
العميل: ${customerName} | نقاطه: ${customerPoints} | سلسلة الطلبات: ${currentStreak}/5.
المتاجر:
${storesCatalogSummary}
العروض:
${campaignsSummary}
القواعد:
1. رشّح من المتاجر المذكورة فقط ولا تخترع أسماء غير موجودة.
2. التوصيل متاح داخل مدينة إدكو والقرى المجاورة فقط، والدفع نقداً عند الاستلام حالياً (الفيزا قريباً).
3. للصيدليات: العميل يرفع صورة الروشتة من جهازه أو يكتب الدواء، الصيدلية تحدد السعر، والعميل يوافق قبل التحضير والتوصيل.
4. إذا رشحت متجراً محدداً من القائمة، اكتب في نهاية ردك تماماً الرمز [STORE:معرف_المتجر] فقط.`;

      const fullPrompt = conversationHistoryText
        ? `سياق سابق:\n${conversationHistoryText}\nسؤال العميل: ${userMessage}`
        : userMessage;

      const aiClient = getAiClient();
      let rawText = '';
      if (aiClient) {
        let response;
        try {
          response = await aiClient.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: fullPrompt,
            config: {
              systemInstruction,
              maxOutputTokens: 180,
              thinkingConfig: {
                thinkingLevel: ThinkingLevel.MINIMAL,
              },
            },
          });
        } catch {
          response = await aiClient.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: fullPrompt,
            config: {
              systemInstruction,
              maxOutputTokens: 180,
              thinkingConfig: {
                thinkingLevel: ThinkingLevel.LOW,
              },
            },
          });
        }
        rawText = (response.text ?? '').trim();
      }
      let parsedReply =
        'أهلاً بيك في إدكاوي! تقدر تسألني عن أحسن الأكلات في إدكو، الصيدليات والروشتات، أو رصيد نقاطك.';
      let suggestedStoreId = '';

      if (rawText) {
        const tagMatch = rawText.match(/\[STORE:([^\]]+)\]/i);
        if (tagMatch?.[1]) {
          const candidateId = tagMatch[1].trim();
          if (rawStores.some((s) => s.id === candidateId)) {
            suggestedStoreId = candidateId;
          }
        }
        const cleanedReply = rawText.replace(/\[STORE:[^\]]*\]/gi, '').trim();
        if (cleanedReply) {
          parsedReply = cleanedReply;
        }
      }

      if (aiQuickCache.size > 300) {
        aiQuickCache.clear();
      }
      aiQuickCache.set(cacheKey, {
        reply: parsedReply,
        suggestedStoreId,
        expiresAt: Date.now() + 90 * 1000,
      });

      res.json({
        ok: true,
        reply: parsedReply,
        suggestedStoreId,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[Edkawy AI] Error:', msg);
      res.status(500).json({
        ok: false,
        error:
          'مساعد إدكاوي مشغول لحظة واحدة، جرب تبعت رسالتك تاني بعد ثواني.',
      });
    }
  });

  // Real Email Verification OTP Request (4-digit OTP + 5-attempt temporary lockout)
  app.post(
    '/api/auth/email-verification/request',
    async (req: Request, res: Response) => {
      const rawEmail = typeof req.body?.email === 'string' ? req.body.email : '';
      const rawName = typeof req.body?.name === 'string' ? req.body.name : '';
      const normalizedEmail = rawEmail.trim().toLowerCase();

      if (
        !normalizedEmail ||
        normalizedEmail.length > 100 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
      ) {
        res.status(400).json({
          ok: false,
          error: 'يرجى إدخال عنوان بريد إلكتروني صحيح لإرسال كود التفعيل.',
        });
        return;
      }

      const now = Date.now();
      const existingChallenge =
        activeUserVerificationOtpByEmail.get(normalizedEmail);
      if (
        existingChallenge?.lockedUntil &&
        existingChallenge.lockedUntil > now
      ) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((existingChallenge.lockedUntil - now) / 1000)
        );
        res.status(429).json({
          ok: false,
          retryAfterSeconds,
          lockedUntilIso: new Date(existingChallenge.lockedUntil).toISOString(),
          error: `تم قفل طلب الكود مؤقتاً لمدة ${Math.ceil(retryAfterSeconds / 60)} دقيقة بسبب محاولات خاطئة متكررة.`,
        });
        return;
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
        rawName,
        otpCode
      );

      res.json({
        ok: true,
        sentViaSmtp: smtpOutcome.sentViaSmtp,
        maskedEmail: maskEmailForUi(normalizedEmail),
        digits: 4,
        ...(smtpOutcome.sentViaSmtp ? {} : { fallbackOtpCode: otpCode }),
      });
    }
  );

  // Real Email Verification OTP Verify (4-digit + 5-attempt 3-minute temporary lock)
  app.post(
    '/api/auth/email-verification/verify',
    (req: Request, res: Response) => {
      const rawEmail = typeof req.body?.email === 'string' ? req.body.email : '';
      const rawCode = typeof req.body?.code === 'string' ? req.body.code : '';
      const normalizedEmail = rawEmail.trim().toLowerCase();
      const cleanedCode = rawCode.trim();

      if (!normalizedEmail || !/^\d{4}$/.test(cleanedCode)) {
        res.status(400).json({
          ok: false,
          error: 'يرجى إدخال كود التفعيل المكون من 4 أرقام بشكل صحيح.',
        });
        return;
      }

      const now = Date.now();
      const challenge = activeUserVerificationOtpByEmail.get(normalizedEmail);
      if (!challenge) {
        res.status(400).json({
          ok: false,
          error: 'لا يوجد كود تفعيل نشط حالياً. يرجى طلب كود جديد.',
        });
        return;
      }

      if (challenge.lockedUntil && challenge.lockedUntil > now) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((challenge.lockedUntil - now) / 1000)
        );
        res.status(429).json({
          ok: false,
          retryAfterSeconds,
          lockedUntilIso: new Date(challenge.lockedUntil).toISOString(),
          error: `الحساب مقفل مؤقتاً بعد 5 محاولات خاطئة. حاول بعد ${retryAfterSeconds} ثانية.`,
        });
        return;
      }

      if (now > challenge.expiresAt) {
        activeUserVerificationOtpByEmail.delete(normalizedEmail);
        res.status(400).json({
          ok: false,
          error: 'انتهت صلاحية كود التفعيل. يرجى طلب كود جديد.',
        });
        return;
      }

      const candidateHash = hashUserVerificationOtp(
        normalizedEmail,
        cleanedCode
      );
      const isMatch =
        candidateHash.length === challenge.codeHash.length &&
        crypto.timingSafeEqual(candidateHash, challenge.codeHash);

      if (!isMatch) {
        challenge.attempts += 1;
        if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
          const lockDurationMs = 3 * 60 * 1000;
          challenge.lockedUntil = now + lockDurationMs;
          const retryAfterSeconds = Math.ceil(lockDurationMs / 1000);
          res.status(429).json({
            ok: false,
            retryAfterSeconds,
            lockedUntilIso: new Date(challenge.lockedUntil).toISOString(),
            remainingAttempts: 0,
            error:
              'تم تجاوز الحد الأقصى (5 محاولات خاطئة). تم قفل التحقق مؤقتاً لمدة 3 دقائق.',
          });
          return;
        }
        const remainingAttempts = Math.max(
          0,
          MAX_OTP_ATTEMPTS - challenge.attempts
        );
        res.status(400).json({
          ok: false,
          remainingAttempts,
          error: `كود التفعيل غير صحيح. المحاولات المتبقية: ${remainingAttempts}.`,
        });
        return;
      }

      activeUserVerificationOtpByEmail.delete(normalizedEmail);
      res.json({ ok: true, verifiedEmail: normalizedEmail });
    }
  );

  // Live Edku Weather Promo Endpoint (OpenWeather + Live Open-Meteo Fallback for Edku 31.3069, 30.2981)
  app.get('/api/weather/edku', async (_req: Request, res: Response) => {
    try {
      if (cachedEdkuWeather && cachedEdkuWeather.expiresAt > Date.now()) {
        res.json({
          ok: true,
          tempC: cachedEdkuWeather.tempC,
          conditionLabel: cachedEdkuWeather.conditionLabel,
          mood: cachedEdkuWeather.mood,
          headlineAr: cachedEdkuWeather.headlineAr,
          subtextAr: cachedEdkuWeather.subtextAr,
          recommendedCategory: cachedEdkuWeather.recommendedCategory,
          source: cachedEdkuWeather.source,
        });
        return;
      }

      const EDKU_LAT = 31.3069;
      const EDKU_LON = 30.2981;
      let tempC = 24;
      let isRainy = false;
      let source: 'openweather' | 'open_meteo' = 'open_meteo';

      const openWeatherKey = (process.env.OPENWEATHER_API_KEY || '').trim();
      let fetchedOk = false;

      if (openWeatherKey) {
        try {
          const owRes = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${EDKU_LAT}&lon=${EDKU_LON}&units=metric&lang=ar&appid=${encodeURIComponent(
              openWeatherKey
            )}`
          );
          if (owRes.ok) {
            const owData = (await owRes.json()) as {
              main?: { temp?: number };
              weather?: Array<{ main?: string; id?: number }>;
            };
            if (typeof owData.main?.temp === 'number') {
              tempC = Math.round(owData.main.temp);
              const weatherMain = String(
                owData.weather?.[0]?.main || ''
              ).toLowerCase();
              isRainy =
                weatherMain.includes('rain') ||
                weatherMain.includes('drizzle') ||
                weatherMain.includes('thunderstorm');
              source = 'openweather';
              fetchedOk = true;
            }
          }
        } catch {
          // Fall through to Open-Meteo
        }
      }

      if (!fetchedOk) {
        const omRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${EDKU_LAT}&longitude=${EDKU_LON}&current=temperature_2m,weather_code,wind_speed_10m`
        );
        if (!omRes.ok) {
          res.status(502).json({
            ok: false,
            error: 'تعذر قراءة حالة الطقس الحية في إدكو حالياً.',
          });
          return;
        }
        const omData = (await omRes.json()) as {
          current?: { temperature_2m?: number; weather_code?: number };
        };
        tempC = Math.round(Number(omData.current?.temperature_2m ?? 24));
        const wCode = Number(omData.current?.weather_code ?? 0);
        isRainy = wCode >= 51 && wCode <= 99;
        source = 'open_meteo';
      }

      let mood: 'cold_rainy' | 'hot_sunny' | 'pleasant_breezy' =
        'pleasant_breezy';
      let conditionLabel = 'أجواء معتدلة على بحر إدكو';
      let headlineAr = `الطقس الآن في إدكو ${tempC}°م — أجواء مثالية لأكلة بحرية أو مشويات سخنة!`;
      let subtextAr =
        'استمتع بأسرع توصيل لحد باب البيت في كل أحياء إدكو والقرى المجاورة.';
      let recommendedCategory = 'مشويات ومطاعم';

      if (isRainy || tempC <= 18) {
        mood = 'cold_rainy';
        conditionLabel = isRainy ? 'أجواء ممطرة وباردة في إدكو' : 'أجواء شتوية باردة في إدكو';
        headlineAr = `الجو في إدكو دلوقتي ${tempC}°م — محتاج مشروب دافي، شوربة سي فود أو مخبوزات وحلويات سخنة تدفيك!`;
        subtextAr = 'اطلبها دلوقتي وكابتن إدكاوي يوصلهالك سخنة لحد باب بيتك.';
        recommendedCategory = 'مخابز وفطائر';
      } else if (tempC >= 29) {
        mood = 'hot_sunny';
        conditionLabel = 'أجواء مشمسة وحارة في إدكو';
        headlineAr = `الحرارة في إدكو ${tempC}°م — روّق على نفسك بمشروبات وحلويات باردة ومنعشة!`;
        subtextAr = 'توصيل سريع يحافظ على انتعاش طلبك في كل شوارع إدكو.';
        recommendedCategory = 'مخابز وفطائر';
      } else {
        mood = 'pleasant_breezy';
        conditionLabel = 'نسيم معتدل في مدينة إدكو';
        headlineAr = `الجو في إدكو رائع (${tempC}°م) — وقت مثالي لوجبة مشويات أو أسماك إدكاوية طازة مع العيلة!`;
        subtextAr = 'تصفح المطاعم المفتوحة الآن واطلب بضغطة واحدة.';
        recommendedCategory = 'أسماك وبحريات';
      }

      cachedEdkuWeather = {
        tempC,
        conditionLabel,
        mood,
        headlineAr,
        subtextAr,
        recommendedCategory,
        source,
        expiresAt: Date.now() + 10 * 60 * 1000,
      };

      res.json({
        ok: true,
        tempC,
        conditionLabel,
        mood,
        headlineAr,
        subtextAr,
        recommendedCategory,
        source,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[Edkawy Weather] Error:', msg);
      res.status(500).json({
        ok: false,
        error: 'تعذر جلب حالة طقس إدكو حالياً.',
      });
    }
  });

  // Exclusive Feature #2: Multimodal Visual Food Search (Camera/Device Photo -> Real Edku Products)
  app.post('/api/ai/visual-search', async (req: Request, res: Response) => {
    try {
      const rawImageDataUrl =
        typeof req.body?.imageDataUrl === 'string' ? req.body.imageDataUrl : '';
      const rawCatalog: Array<Record<string, unknown>> = Array.isArray(
        req.body?.productsCatalog
      )
        ? (req.body.productsCatalog as Array<Record<string, unknown>>)
        : [];

      const match = rawImageDataUrl.match(
        /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/
      );
      if (!match) {
        res.status(400).json({
          ok: false,
          error: 'يرجى اختيار أو التقاط صورة واضحة للأكلة من جهازك أولاً.',
        });
        return;
      }

      const mimeType = match[1];
      const base64Data = match[2].replace(/\s+/g, '');

      const sanitizedCatalog = rawCatalog.slice(0, 120).map(
        (item: Record<string, unknown>) => ({
          id: String(item.id ?? '').slice(0, 80),
          name: String(item.name ?? '').slice(0, 80),
          category: String(item.category ?? '').slice(0, 50),
          description: String(item.description ?? '').slice(0, 100),
          storeName: String(item.storeName ?? '').slice(0, 60),
          price: Number(item.price ?? 0),
        })
      );

      const aiClient = getAiClient();
      if (!aiClient) {
        res.status(503).json({
          ok: false,
          error: 'خدمة البحث الذكي بالصور غير مفعلة حالياً على الخادم.',
        });
        return;
      }

      const catalogText =
        sanitizedCatalog.length > 0
          ? sanitizedCatalog
              .map(
                (p) =>
                  `ID:${p.id} | ${p.name} (${p.category}) لدى ${p.storeName} - ${p.price} ج.م`
              )
              .join('\n')
          : 'لا توجد أصناف مسجلة حالياً.';

      const response = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            {
              text: `حلل صورة الطعام أو المشروب أو المنتج المرفقة، وحدد اسم الصنف باللهجة المصرية، ثم اختر أفضل الأصناف المطابقة أو القريبة له من قائمة أصناف متاجر مدينة إدكو الحقيقية التالية فقط (لا تخترع معرّفات غير موجودة في القائمة):\n\n${catalogText}`,
            },
          ],
        },
        config: {
          systemInstruction:
            'أنت خبير طعام وتوصيل في تطبيق إدكاوي بمدينة إدكو. أرجع JSON دقيق يحتوي على اسم الأكلة المكتشفة بالعربية، كلمات مفتاحية للبحث، ومعرّفات الأصناف المطابقة من القائمة المرسلة فقط بحد أقصى 6 أصناف، مع جملة ترحيبية قصيرة.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              detectedDishAr: {
                type: Type.STRING,
                description: 'اسم الأكلة أو الصنف في الصورة بالعربية',
              },
              keywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'كلمات مفتاحية عربية للبحث في المنيو',
              },
              matchedProductIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'معرّفات الأصناف المطابقة من القائمة الحقيقية فقط',
              },
              summaryAr: {
                type: Type.STRING,
                description: 'ملخص ودود قصير للعميل بالعربية',
              },
            },
            required: [
              'detectedDishAr',
              'keywords',
              'matchedProductIds',
              'summaryAr',
            ],
          },
        },
      });

      const rawJson = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawJson) as {
        detectedDishAr?: string;
        keywords?: string[];
        matchedProductIds?: string[];
        summaryAr?: string;
      };

      const validIdSet = new Set(sanitizedCatalog.map((c) => c.id));
      let matchedIds = (parsed.matchedProductIds ?? []).filter((id) =>
        validIdSet.has(id)
      );

      // Fallback keyword match against real catalog if model found keywords but no exact IDs
      if (matchedIds.length === 0 && Array.isArray(parsed.keywords)) {
        const kwList = parsed.keywords
          .map((k) => String(k).trim().toLowerCase())
          .filter((k) => k.length >= 2);
        matchedIds = sanitizedCatalog
          .filter((p) => {
            const hay = `${p.name} ${p.category} ${p.description}`.toLowerCase();
            return kwList.some((kw) => hay.includes(kw));
          })
          .slice(0, 6)
          .map((p) => p.id);
      }

      res.json({
        ok: true,
        detectedDishAr: parsed.detectedDishAr || 'وجبة شهية',
        keywords: Array.isArray(parsed.keywords)
          ? parsed.keywords.slice(0, 6)
          : [],
        matchedProductIds: matchedIds.slice(0, 6),
        summaryAr:
          parsed.summaryAr ||
          (matchedIds.length > 0
            ? 'لقينا لك أقرب الأصناف المتاحة حالياً في مطاعم ومتاجر إدكو!'
            : 'تعرفنا على الصورة، ولكن لا يوجد صنف مطابق تماماً متاح حالياً في المتاجر المفتوحة.'),
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[Edkawy Visual Search] Error:', msg);
      res.status(500).json({
        ok: false,
        error: `تعذر تحليل الصورة حالياً (${msg.slice(0, 120)}). يرجى المحاولة مرة أخرى.`,
      });
    }
  });

  // Exclusive Feature #5: AI Smart Meal Planner grounded in real Edku products
  app.post('/api/ai/meal-plan', async (req: Request, res: Response) => {
    try {
      const budgetEgp = Math.max(
        50,
        Math.min(20000, Math.trunc(Number(req.body?.budgetEgp ?? 300)))
      );
      const daysCount = Math.max(
        1,
        Math.min(7, Math.trunc(Number(req.body?.daysCount ?? 3)))
      );
      const dietaryStyle =
        typeof req.body?.dietaryStyle === 'string'
          ? req.body.dietaryStyle.trim().slice(0, 30)
          : 'متوازن';
      const rawCatalog: Array<Record<string, unknown>> = Array.isArray(
        req.body?.productsCatalog
      )
        ? (req.body.productsCatalog as Array<Record<string, unknown>>)
        : [];

      const sanitizedCatalog = rawCatalog
        .slice(0, 120)
        .map((item: Record<string, unknown>) => ({
          id: String(item.id ?? '').slice(0, 80),
          name: String(item.name ?? '').slice(0, 80),
          category: String(item.category ?? '').slice(0, 50),
          storeId: String(item.storeId ?? '').slice(0, 80),
          storeName: String(item.storeName ?? '').slice(0, 60),
          price: Math.max(1, Math.trunc(Number(item.price ?? 0))),
        }))
        .filter((item) => item.id && item.storeId && item.price > 0);

      if (sanitizedCatalog.length === 0) {
        res.status(400).json({
          ok: false,
          error:
            'لا توجد أصناف متاحة حالياً في المتاجر المفتوحة لبناء خطة وجبات حقيقية.',
        });
        return;
      }

      const aiClient = getAiClient();
      if (!aiClient) {
        res.status(503).json({
          ok: false,
          error: 'خدمة مخطط الوجبات الذكي غير مفعلة حالياً على الخادم.',
        });
        return;
      }

      const catalogLines = sanitizedCatalog
        .map(
          (p) =>
            `PRODUCT_ID:${p.id} | STORE_ID:${p.storeId} | ${p.name} لدى ${p.storeName} (${p.category}) = ${p.price} ج.م`
        )
        .join('\n');

      const response = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `صمّم جدول وجبات عملي لمدة ${daysCount} أيام بميزانية إجمالية تقريبية ${budgetEgp} ج.م وأسلوب غذائي "${dietaryStyle}" للعميل في مدينة إدكو، باستخدام الأصناف الحقيقية التالية فقط (التزم تماماً بـ PRODUCT_ID و STORE_ID والأسعار الفعلية):\n\n${catalogLines}`,
        config: {
          systemInstruction:
            'أنت خبير تغذية وتوفير ذكي في تطبيق إدكاوي بمدينة إدكو. اختَر وجبة حقيقية لكل يوم من القائمة المرسلة بحيث يناسب مجموع الأسعار الميزانية المطلوبة قدر الإمكان دون اختراع أي صنف خارج القائمة.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              planTitleAr: {
                type: Type.STRING,
                description: 'عنوان جذاب للخطة بالعربية',
              },
              summaryNoteAr: {
                type: Type.STRING,
                description: 'ملخص سريع للميزانية والتوازن الغذائي',
              },
              days: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    dayNumber: { type: Type.INTEGER },
                    dayLabelAr: { type: Type.STRING },
                    mealDescriptionAr: { type: Type.STRING },
                    productId: { type: Type.STRING },
                  },
                  required: [
                    'dayNumber',
                    'dayLabelAr',
                    'mealDescriptionAr',
                    'productId',
                  ],
                },
              },
            },
            required: ['planTitleAr', 'summaryNoteAr', 'days'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        planTitleAr?: string;
        summaryNoteAr?: string;
        days?: Array<{
          dayNumber?: number;
          dayLabelAr?: string;
          mealDescriptionAr?: string;
          productId?: string;
        }>;
      };

      const catalogById = new Map(sanitizedCatalog.map((p) => [p.id, p]));
      const fallbackSorted = [...sanitizedCatalog].sort(
        (a, b) => a.price - b.price
      );

      const resolvedDays = Array.from({ length: daysCount }, (_, idx) => {
        const aiDay = parsed.days?.[idx];
        const matchedProd =
          (aiDay?.productId ? catalogById.get(aiDay.productId) : undefined) ??
          fallbackSorted[idx % fallbackSorted.length];

        return {
          dayNumber: idx + 1,
          dayLabelAr: aiDay?.dayLabelAr || `اليوم ${idx + 1}`,
          mealDescriptionAr:
            aiDay?.mealDescriptionAr ||
            `وجبة مختارة من ${matchedProd.storeName} تناسب نظام (${dietaryStyle})`,
          productId: matchedProd.id,
          productName: matchedProd.name,
          storeId: matchedProd.storeId,
          storeName: matchedProd.storeName,
          priceEgp: matchedProd.price,
        };
      });

      const totalEstimatedEgp = resolvedDays.reduce(
        (sum, d) => sum + d.priceEgp,
        0
      );

      res.json({
        ok: true,
        planTitleAr:
          parsed.planTitleAr ||
          `خطة وجبات ${dietaryStyle} لمدة ${daysCount} أيام`,
        totalEstimatedEgp,
        budgetEgp,
        summaryNoteAr:
          parsed.summaryNoteAr ||
          `إجمالي تكلفة الوجبات المقترحة ${totalEstimatedEgp} ج.م من متاجر إدكو المتاحة الآن.`,
        days: resolvedDays,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[Edkawy Meal Plan] Error:', msg);
      res.status(500).json({
        ok: false,
        error: `تعذر إنشاء خطة الوجبات حالياً (${msg.slice(0, 120)}).`,
      });
    }
  });

  // AI Menu OCR Scanner for Merchants (POST /api/ocr-menu & /api/ai/ocr-menu)
  const handleMenuOcrRequest = async (req: Request, res: Response) => {
    try {
      const rawImageDataUrl =
        typeof req.body?.imageDataUrl === 'string'
          ? req.body.imageDataUrl
          : typeof req.body?.imageBase64 === 'string'
          ? req.body.imageBase64
          : '';
      const storeCategoryHint =
        typeof req.body?.storeCategory === 'string'
          ? req.body.storeCategory.trim().slice(0, 50)
          : 'عام';

      const match = rawImageDataUrl.match(
        /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/
      );
      if (!match) {
        res.status(400).json({
          ok: false,
          items: [],
          error:
            'يرجى رفع صورة واضحة لقائمة الطعام أو كتالوج المنتجات من جهازك أولاً.',
        });
        return;
      }

      const mimeType = match[1];
      const base64Data = match[2].replace(/\s+/g, '');

      const aiClient = getAiClient();
      if (!aiClient) {
        res.status(503).json({
          ok: false,
          items: [],
          error: 'خدمة مسح المنيو بالذكاء الاصطناعي غير مفعلة حالياً على الخادم.',
        });
        return;
      }

      const response = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            {
              text: `استخرج جميع الأصناف والمنتجات الواضحة مع أسعارها بالجنيه المصري من صورة المنيو أو الكتالوج المرفقة لمتجر بتصنيف "${storeCategoryHint}". إذا كان للصنف أكثر من حجم، اكتب الحجم الأساسي وسعره بوضوح، وضع وصفاً مختصراً وتصنيفاً فرعياً مناسباً بالعربية.`,
            },
          ],
        },
        config: {
          systemInstruction:
            'أنت محلل قوائم طعام ومنتجات دقيق لمنصة إدكاوي في مدينة إدكو. استخرج الأصناف الموجودة فعلياً في الصورة فقط بدون اختراع أي بيانات وهمية، وأرجع الأسعار كأرقام صحيحة بالجنيه المصري.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: {
                      type: Type.STRING,
                      description: 'اسم الصنف أو المنتج بالعربية (من 2 إلى 80 حرفاً)',
                    },
                    price: {
                      type: Type.INTEGER,
                      description: 'سعر الصنف بالجنيه المصري كرقم صحيح',
                    },
                    category: {
                      type: Type.STRING,
                      description: 'القسم الفرعي داخل المتجر (مثل: مشويات، طواجن، عناية بالبشرة)',
                    },
                    description: {
                      type: Type.STRING,
                      description: 'وصف مختصر للصنف بالعربية (من 6 إلى 160 حرفاً)',
                    },
                  },
                  required: ['name', 'price', 'category', 'description'],
                },
              },
            },
            required: ['items'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{"items":[]}').trim()) as {
        items?: Array<{
          name?: string;
          price?: number;
          category?: string;
          description?: string;
        }>;
      };

      const sanitizedItems = (Array.isArray(parsed.items) ? parsed.items : [])
        .slice(0, 35)
        .map((raw) => {
          const name = String(raw.name ?? '')
            .trim()
            .slice(0, 80);
          const rawPrice = Math.round(Number(raw.price ?? 0));
          const price =
            Number.isFinite(rawPrice) && rawPrice >= 1
              ? Math.min(5000, rawPrice)
              : 0;
          const category =
            String(raw.category ?? '')
              .trim()
              .slice(0, 40) || storeCategoryHint || 'أصناف متنوعة';
          const rawDesc = String(raw.description ?? '').trim();
          const description =
            rawDesc.length >= 4
              ? rawDesc.slice(0, 200)
              : `${name} — متاح طازجاً عبر منصة إدكاوي`.slice(0, 200);
          return { name, price, category, description };
        })
        .filter((item) => item.name.length >= 2 && item.price >= 1);

      if (sanitizedItems.length === 0) {
        res.status(422).json({
          ok: false,
          items: [],
          error:
            'لم نتمكن من قراءة أصناف وأسعار واضحة من هذه الصورة. يرجى تجربة صورة أوضح للقائمة.',
        });
        return;
      }

      res.json({
        ok: true,
        items: sanitizedItems,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[Edkawy Menu OCR] Error:', msg);
      res.status(500).json({
        ok: false,
        items: [],
        error: `تعذر استخراج الأصناف من الصورة حالياً (${msg.slice(0, 120)}).`,
      });
    }
  };

  app.post('/api/ocr-menu', handleMenuOcrRequest);
  app.post('/api/ai/ocr-menu', handleMenuOcrRequest);

  // Paymob Payment Webhook Gateway (/api/webhook)
  app.post('/api/webhook', async (req: Request, res: Response) => {
    try {
      const hmacSecret = process.env.PAYMOB_HMAC_SECRET || 'edkawy_paymob_hmac_secret_2026';
      const signature = String(req.query.hmac || req.headers['x-paymob-hmac'] || '').trim();
      const body = req.body || {};
      const obj = body.obj || body;

      // Concatenate Paymob standard HMAC values in exact order
      const amountCents = String(obj.amount_cents ?? '');
      const createdAt = String(obj.created_at ?? '');
      const currency = String(obj.currency ?? 'EGP');
      const errorOccurred = String(obj.error_occured ?? false);
      const hasParentTrans = String(obj.has_parent_transaction ?? false);
      const id = String(obj.id ?? '');
      const integrationId = String(obj.integration_id ?? '');
      const is3dSecure = String(obj.is_3d_secure ?? false);
      const isAuth = String(obj.is_auth ?? false);
      const isCapture = String(obj.is_capture ?? false);
      const isRefunded = String(obj.is_refunded ?? false);
      const isStandalonePayment = String(obj.is_standalone_payment ?? false);
      const isVoided = String(obj.is_voided ?? false);
      const orderId = String(obj.order?.id ?? obj.order_id ?? obj.special_reference ?? '');
      const owner = String(obj.owner ?? '');
      const pending = String(obj.pending ?? false);
      const sourceDataPan = String(obj.source_data?.pan ?? '');
      const sourceDataSubType = String(obj.source_data?.sub_type ?? '');
      const sourceDataType = String(obj.source_data?.type ?? '');
      const success = String(obj.success ?? false);

      const concatenated = `${amountCents}${createdAt}${currency}${errorOccurred}${hasParentTrans}${id}${integrationId}${is3dSecure}${isAuth}${isCapture}${isRefunded}${isStandalonePayment}${isVoided}${orderId}${owner}${pending}${sourceDataPan}${sourceDataSubType}${sourceDataType}${success}`;
      const calculatedHmac = crypto.createHmac('sha512', hmacSecret).update(concatenated).digest('hex');

      const isSignatureValid = signature ? safeEqualStrings(signature, calculatedHmac) : true;
      const isTransactionSuccess = obj.success === true || obj.success === 'true';

      console.log(`[Paymob Webhook] Received webhook for order ${orderId}: success=${isTransactionSuccess}, sigValid=${isSignatureValid}`);

      res.status(200).json({
        received: true,
        orderId,
        status: isTransactionSuccess ? 'confirmed' : 'payment_failed',
        signatureValid: isSignatureValid,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[Paymob Webhook] Processing error:', err);
      res.status(400).json({ received: false, error: 'Webhook processing failed' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(import.meta.dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Edkawy server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
