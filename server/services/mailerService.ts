import nodemailer from 'nodemailer';
import { APP_BRAND_NAME, APP_NOREPLY_EMAIL } from '../config/env.js';

export function maskEmailForUi(email: string): string {
  const [localPart, domainPart] = email.trim().split('@');
  if (!localPart || !domainPart) return email;
  const visiblePrefix = localPart.slice(0, Math.min(2, localPart.length));
  return `${visiblePrefix}***@${domainPart}`;
}

export function getSmtpConfig() {
  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = Number(process.env.SMTP_PORT || '465');
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
  const from = (process.env.SMTP_FROM || user || APP_NOREPLY_EMAIL).trim();

  return {
    configured: Boolean(user && pass),
    host,
    port,
    user,
    pass,
    from,
  };
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendAdminOtpEmail(
  recipientEmail: string,
  otpCode: string
): Promise<{ sentViaSmtp: boolean; smtpError?: string }> {
  const cfg = getSmtpConfig();
  if (!cfg.configured) {
    return { sentViaSmtp: false, smtpError: 'missing_smtp_credentials' };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      auth: { user: cfg.user, pass: cfg.pass },
    });

    await transporter.sendMail({
      from: `"${APP_BRAND_NAME}" <${cfg.from}>`,
      replyTo: cfg.from,
      to: recipientEmail,
      subject: `${otpCode} — كود التحقق من تطبيق إدكاوي`,
      text: `مرحباً بك في تطبيق إدكاوي Edkawy (مدينة إدكو).\n\nكود التحقق الخاص بدخول لوحة تحكم الإدارة هو: ${otpCode}\n\nصلاحية الكود: 10 دقائق لمرة واحدة فقط.\nإذا لم تقم بطلب تسجيل الدخول، يرجى تجاهل هذه الرسالة.`,
      html: `
        <div dir="rtl" style="font-family: 'Cairo', Tahoma, Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #10192D; border: 1px solid #334155; border-radius: 16px; padding: 28px; color: #F8FAFC;">
          <p style="margin: 0 0 8px; font-size: 13px; font-weight: 700; color: #FF7100;">تطبيق إدكاوي Edkawy · مدينة إدكو</p>
          <h2 style="margin: 0 0 14px; font-size: 20px; color: #F8FAFC;">كود التحقق لدخول إدارة تطبيق إدكاوي</h2>
          <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.7; color: #CBD5E1;">
            تم طلب تسجيل الدخول إلى لوحة الإدارة المركزية في تطبيق إدكاوي. استخدم كود التحقق التالي لإتمام الدخول:
          </p>
          <div dir="ltr" style="background: #18233C; border: 1px solid #334155; border-radius: 12px; padding: 18px; text-align: center; font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #FF7100; margin-bottom: 20px;">
            ${escapeHtml(otpCode)}
          </div>
          <p style="margin: 0; font-size: 12px; color: #94A3B8;">
            هذا الكود صالح لمدة 10 دقائق ويُستخدم لمرة واحدة فقط.
          </p>
        </div>
      `,
    });

    return { sentViaSmtp: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Edkawy OTP] SMTP send failed:', msg);
    return { sentViaSmtp: false, smtpError: 'smtp_delivery_failed' };
  }
}

export async function sendUserVerificationOtpEmail(
  recipientEmail: string,
  recipientName: string,
  otpCode: string
): Promise<{ sentViaSmtp: boolean; smtpError?: string }> {
  const cfg = getSmtpConfig();
  if (!cfg.configured) {
    return { sentViaSmtp: false, smtpError: 'missing_smtp_credentials' };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      auth: { user: cfg.user, pass: cfg.pass },
    });

    const cleanRecipientName = escapeHtml(recipientName.trim() || 'عميل إدكاوي');

    await transporter.sendMail({
      from: `"${APP_BRAND_NAME}" <${cfg.from}>`,
      replyTo: cfg.from,
      to: recipientEmail,
      subject: `${otpCode} هو كود تفعيل حسابك في تطبيق إدكاوي`,
      headers: {
        'X-Auto-Response-Suppress': 'OOF, AutoReply',
        'Auto-Submitted': 'auto-generated',
      },
      text: `أهلاً بك يا ${recipientName.trim() || 'عميل إدكاوي'} في تطبيق إدكاوي (مدينة إدكو).\n\nكود تفعيل بريدك الإلكتروني هو: ${otpCode}\n\nصلاحية الكود 10 دقائق ويُستخدم لمرة واحدة فقط لتأكيد ملكية البريد الإلكتروني.`,
      html: `
        <div dir="rtl" style="font-family: 'Cairo', Tahoma, Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #10192D; border: 1px solid #334155; border-radius: 16px; padding: 28px; color: #F8FAFC;">
          <p style="margin: 0 0 8px; font-size: 13px; font-weight: 700; color: #FF7100;">إدكاوي Edkawy · مدينة إدكو</p>
          <h2 style="margin: 0 0 12px; font-size: 20px; color: #F8FAFC;">تفعيل حسابك الجديد في إدكاوي</h2>
          <p style="margin: 0 0 18px; font-size: 14px; line-height: 1.7; color: #CBD5E1;">
            أهلاً بك يا <strong>${cleanRecipientName}</strong>، أدخل كود التفعيل المكون من 4 أرقام في شاشة التسجيل لإتمام إنشاء حسابك:
          </p>
          <div dir="ltr" style="background: #18233C; border: 1px solid #334155; border-radius: 12px; padding: 16px; text-align: center; font-family: monospace; font-size: 30px; font-weight: 700; letter-spacing: 8px; color: #FF7100; margin-bottom: 18px;">
            ${escapeHtml(otpCode)}
          </div>
          <p style="margin: 0; font-size: 12px; color: #94A3B8;">
            هذا الكود صالح لمدة 10 دقائق فقط. رسالة معاملات تلقائية بناءً على طلبك المباشر في تطبيق إدكاوي.
          </p>
        </div>
      `,
    });

    return { sentViaSmtp: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Edkawy Email Verify] SMTP send failed:', msg);
    return { sentViaSmtp: false, smtpError: 'smtp_delivery_failed' };
  }
}

export async function sendInvitationEmailViaSmtp(params: {
  recipientEmail: string;
  userType: 'store' | 'customer' | 'courier' | 'sales_agent';
  inviteUrl: string;
  inviterName: string;
}): Promise<{ sentViaSmtp: boolean; smtpError?: string }> {
  const cfg = getSmtpConfig();
  if (!cfg.configured) {
    return { sentViaSmtp: false, smtpError: 'missing_smtp_credentials' };
  }

  const roleNameMap: Record<'store' | 'customer' | 'courier' | 'sales_agent', string> = {
    store: 'شريك متجر / مطعم',
    customer: 'عميل مميز',
    courier: 'كابتن توصيل',
    sales_agent: 'مسؤول مبيعات وتسويق',
  };
  const roleLabelAr = roleNameMap[params.userType] || 'عضو جديد';
  const safeInviter = escapeHtml(params.inviterName);
  const safeEmail = escapeHtml(params.recipientEmail);
  const safeInviteUrl = escapeHtml(params.inviteUrl);

  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      auth: { user: cfg.user, pass: cfg.pass },
    });

    await transporter.sendMail({
      from: `"${APP_BRAND_NAME}" <${cfg.from}>`,
      replyTo: cfg.from,
      to: params.recipientEmail,
      subject: `دعوة رسمية للانضمام إلى تطبيق إدكاوي (${roleLabelAr})`,
      text: `مرحباً بك في منصة إدكاوي (مدينة إدكو)!\n\nيسعدنا دعوتك من قِبل (${params.inviterName}) للانضمام إلينا بصفة: ${roleLabelAr}.\n\nسجل الآن عبر الرابط الآمن التالي:\n${params.inviteUrl}\n\nتنبيه هام: صلاحية هذه الدعوة 48 ساعة فقط وتُستخدم لمرة واحدة.`,
      html: `
        <div dir="rtl" style="font-family: 'Cairo', Tahoma, Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #10192D; border: 1px solid #334155; border-radius: 18px; overflow: hidden; color: #F8FAFC;">
          <div style="background: #18233C; padding: 24px 28px; border-bottom: 4px solid #FF7100;">
            <p style="margin: 0 0 4px; font-size: 13px; font-weight: 700; color: #FF7100;">منصة إدكاوي Edkawy · مدينة إدكو</p>
            <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #F8FAFC;">دعوة رسمية للانضمام إلى إدكاوي</h1>
          </div>
          <div style="padding: 28px;">
            <p style="margin: 0 0 14px; font-size: 15px; line-height: 1.8; color: #E2E8F0;">
              أهلاً بك! تمت دعوتك بواسطة <strong>${safeInviter}</strong> لتفعيل حسابك على منصة إدكاوي بصفة:
              <strong style="color: #FF7100;">${roleLabelAr}</strong>.
            </p>
            <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.7; color: #94A3B8;">
              اضغط على الزر التالي لإكمال بيانات حسابك والبدء فوراً على المنصة:
            </p>
            <div style="text-align: center; margin: 26px 0;">
              <a href="${safeInviteUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #FF7100; color: #F8FAFC; text-decoration: none; font-size: 16px; font-weight: 800; padding: 14px 36px; border-radius: 12px;">
                سجل الآن
              </a>
            </div>
            <div style="background: #18233C; border: 1px solid #334155; border-radius: 12px; padding: 14px 16px; margin-bottom: 20px;">
              <p style="margin: 0; font-size: 13px; color: #FDBA74; font-weight: 700;">
                ملاحظة أمنية: هذا الرابط صالح لمدة 48 ساعة فقط ومرتبط حصرياً ببريدك الإلكتروني (${safeEmail}).
              </p>
            </div>
            <p style="margin: 0; font-size: 12px; color: #94A3B8; word-break: break-all;">
              إذا لم يعمل الزر أعلاه، انسخ الرابط التالي في المتصفح:<br/>
              <a href="${safeInviteUrl}" style="color: #FF7100;">${safeInviteUrl}</a>
            </p>
          </div>
        </div>
      `,
    });

    return { sentViaSmtp: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Edkawy Invitation Email] SMTP send failed:', msg);
    return { sentViaSmtp: false, smtpError: 'smtp_delivery_failed' };
  }
}
