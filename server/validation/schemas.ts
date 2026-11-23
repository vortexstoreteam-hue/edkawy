import { type NextFunction, type Request, type Response } from 'express';
import { z, type ZodSchema } from 'zod';

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, 'البريد الإلكتروني قصير جداً.')
  .max(100, 'البريد الإلكتروني يتجاوز الحد المسموح.')
  .email('يرجى إدخال عنوان بريد إلكتروني صحيح.');

export const adminInitialSetupSchema = z
  .object({
    email: emailSchema,
    password: z
      .string()
      .min(10, 'يجب أن تتكون كلمة المرور الإدارية من 10 أحرف على الأقل.')
      .max(128, 'كلمة المرور طويلة جداً.')
      .refine(
        (val) => /[a-zA-Z]/.test(val) && /\d/.test(val),
        'يجب أن تحتوي كلمة المرور على حروف وأرقام لزيادة الأمان.'
      ),
    confirmPassword: z.string().min(1, 'يرجى تأكيد كلمة المرور.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'كلمتا المرور غير متطابقتين.',
    path: ['confirmPassword'],
  });

export const adminRequestOtpSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, 'يرجى إدخال كلمة المرور.')
    .max(128, 'كلمة المرور غير صالحة.'),
});

export const adminVerifyOtpSchema = z.object({
  email: emailSchema,
  code: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, ''))
    .refine((v) => /^\d{6}$/.test(v), 'يرجى إدخال كود تحقق صحيح مكون من 6 أرقام.'),
});

export const emailVerificationRequestSchema = z.object({
  email: emailSchema,
  name: z
    .string()
    .trim()
    .max(60)
    .optional()
    .default('عميل إدكاوي'),
});

export const emailVerificationVerifySchema = z.object({
  email: emailSchema,
  code: z
    .string()
    .trim()
    .refine((v) => /^\d{4}$/.test(v), 'يرجى إدخال كود التفعيل المكون من 4 أرقام بشكل صحيح.'),
});

export const sendInvitationEmailSchema = z.object({
  email: emailSchema,
  token: z
    .string()
    .trim()
    .min(16, 'رمز الدعوة غير صالح.')
    .max(128, 'رمز الدعوة غير صالح.')
    .regex(/^[a-zA-Z0-9_-]+$/, 'صيغة رمز الدعوة غير صالحة.'),
  userType: z
    .enum(['store', 'customer', 'courier', 'sales_agent'])
    .optional()
    .default('customer'),
  referralCode: z.string().trim().max(24).optional().default(''),
  inviterName: z.string().trim().max(80).optional().default('إدارة منصة إدكاوي'),
  origin: z.string().trim().max(240).optional(),
});

export const passwordResetEmailSchema = z.object({
  email: emailSchema,
});

export const passwordResetRegisterSchema = z.object({
  email: emailSchema,
  role: z
    .enum(['customer', 'courier', 'store', 'sales_agent'])
    .optional()
    .default('customer'),
});

export const reverseGeocodeQuerySchema = z.object({
  lat: z.coerce
    .number()
    .refine((n) => Number.isFinite(n) && n >= -90 && n <= 90, 'خط العرض غير صالح.'),
  lng: z.coerce
    .number()
    .refine((n) => Number.isFinite(n) && n >= -180 && n <= 180, 'خط الطول غير صالح.'),
});

const aiStoreItemSchema = z.object({
  id: z.string().max(80).optional(),
  name: z.string().max(80).optional(),
  category: z.string().max(50).optional(),
  neighborhood: z.string().max(60).optional(),
  deliveryFee: z.coerce.number().min(0).max(500).optional(),
  isOpen: z.boolean().optional(),
  menuPreview: z.array(z.string().max(80)).max(15).optional(),
  topItems: z.array(z.string().max(80)).max(15).optional(),
});

const aiCampaignItemSchema = z.object({
  title: z.string().max(100).optional(),
  description: z.string().max(240).optional(),
  subtitle: z.string().max(160).optional(),
  type: z.string().max(40).optional(),
  pointsMultiplier: z.coerce.number().min(1).max(10).optional(),
});

const aiHistoryEntrySchema = z.object({
  role: z.string().max(20).optional(),
  text: z.string().max(600).optional(),
});

export const aiChatSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'يرجى كتابة سؤالك أولاً ليتمكن مساعد إدكاوي من مساعدتك.')
    .max(600, 'الرسالة طويلة جداً (الحد الأقصى 600 حرف).'),
  customerName: z.string().trim().max(50).optional().default('يا غالي'),
  customerPoints: z.coerce.number().int().min(0).max(10_000_000).optional(),
  points: z.coerce.number().int().min(0).max(10_000_000).optional(),
  currentStreak: z.coerce.number().int().min(0).max(100).optional().default(0),
  stores: z.array(aiStoreItemSchema).max(25).optional().default([]),
  campaigns: z.array(aiCampaignItemSchema).max(10).optional().default([]),
  history: z.array(aiHistoryEntrySchema).max(10).optional().default([]),
});

const base64ImageRegex = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/;

const aiCatalogProductSchema = z.object({
  id: z.string().max(80).optional(),
  name: z.string().max(80).optional(),
  category: z.string().max(50).optional(),
  description: z.string().max(120).optional(),
  storeId: z.string().max(80).optional(),
  storeName: z.string().max(60).optional(),
  price: z.coerce.number().min(0).max(50_000).optional(),
});

export const aiVisualSearchSchema = z.object({
  imageDataUrl: z
    .string()
    .max(6_000_000, 'حجم الصورة يتجاوز الحد المسموح.')
    .refine(
      (v) => base64ImageRegex.test(v),
      'يرجى اختيار أو التقاط صورة واضحة للأكلة من جهازك أولاً.'
    ),
  productsCatalog: z.array(aiCatalogProductSchema).max(150).optional().default([]),
});

export const aiMealPlanSchema = z.object({
  budgetEgp: z.coerce.number().min(50).max(20_000).optional().default(300),
  daysCount: z.coerce.number().int().min(1).max(7).optional().default(3),
  dietaryStyle: z.string().trim().max(30).optional().default('متوازن'),
  productsCatalog: z.array(aiCatalogProductSchema).min(1).max(150),
});

export const aiOcrMenuSchema = z
  .object({
    imageDataUrl: z.string().max(6_000_000).optional(),
    imageBase64: z.string().max(6_000_000).optional(),
    storeCategory: z.string().trim().max(50).optional().default('عام'),
  })
  .refine(
    (data) => {
      const candidate = data.imageDataUrl || data.imageBase64 || '';
      return base64ImageRegex.test(candidate);
    },
    {
      message: 'يرجى رفع صورة واضحة لقائمة الطعام أو كتالوج المنتجات من جهازك أولاً.',
    }
  );

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      res.status(400).json({
        ok: false,
        error: firstIssue?.message || 'بيانات الطلب غير صالحة.',
      });
      return;
    }
    req.body = parsed.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      res.status(400).json({
        ok: false,
        error: firstIssue?.message || 'معاملات الاستعلام غير صالحة.',
      });
      return;
    }
    (req as Request & { validatedQuery?: T }).validatedQuery = parsed.data;
    next();
  };
}
