import {
  AdBannerInput,
  AdminCreateStoreInput,
  AppliedCoupon,
  AuditActionType,
  CampaignInput,
  CartItem,
  CheckoutFormInput,
  CompleteProfileInput,
  CouponInput,
  CourierKycDocumentsInput,
  CourierProfileInput,
  CourierRecord,
  CourierRegisterInput,
  CourierVehicleType,
  CreateStaffMemberInput,
  CreateSupportTicketInput,
  CustomErrandOrderInput,
  CustomerDirectoryEntry,
  DriverWalletRecord,
  EdkoZoneId,
  FinancialExceptionRecord,
  FinancialExceptionType,
  FinancialTransactionRecord,
  FounderFinancialKpis,
  FraudAlertRecord,
  GroupBillParticipantShare,
  GroupSessionCartItem,
  MenuItem,
  NewProductInput,
  NewStoreInput,
  OrderItemPayload,
  OrderRecord,
  OrderStatus,
  PaymentMethod,
  PharmacyPrescriptionOrderInput,
  ProductImageKey,
  ProductRecord,
  ProductVariant,
  RestaurantSettlementRecord,
  RestaurantSettlementStatus,
  ReviewSubmitInput,
  StoreCategory,
  StoreImageKey,
  StoreOperationalSettingsInput,
  StoreRecord,
  TreasuryReceiptRecord,
} from '../types/edkawi';
import {
  APPROVED_EDKO_ZONE_IDS,
  isWithinEdkuServiceBounds,
} from '../data/edkuSeedStores';
import { isValidUploadedImageUrl } from './imageUpload';

export const SMALL_ORDER_THRESHOLD_EGP = 50;
export const SMALL_ORDER_FEE_EGP = 5;
export const MIN_COURIER_DELIVERY_FEE_EGP = 15;
export const DEFAULT_EDKAWY_COMMISSION_RATE = 0.14;
export const DAILY_SETTLEMENT_CUTOFF_TIME = '00:00';

export const STORE_CATEGORIES: readonly StoreCategory[] = [
  'أكل بيتي',
  'أسماك وبحريات',
  'مشويات ومطاعم',
  'مخابز وفطائر',
  'سوبر ماركت',
  'صيدليات',
  'مستحضرات تجميل',
  'أدوات منزلية',
  'ملابس',
  'هدايا وإكسسوارات',
] as const;

export const STORE_IMAGE_KEYS: readonly StoreImageKey[] = [
  'seafood',
  'grills',
  'bakery',
  'grocery',
  'pharmacy',
  'home_food',
  'cosmetics',
  'household',
  'clothing',
  'gifts',
] as const;

export const PRODUCT_IMAGE_KEYS: readonly ProductImageKey[] = [
  'seafood',
  'grills',
  'bakery',
  'grocery',
  'pharmacy',
  'home_food',
  'cosmetics',
  'household',
  'clothing',
  'gifts',
  'hero_seafood',
  'shrimp_casserole',
  'hawawshi_grill',
  'savory_feteer',
  'dairy_cheese',
] as const;

export const COURIER_VEHICLE_TYPES: readonly CourierVehicleType[] = [
  'دراجة نارية',
  'سكوتر كهربائي',
  'دراجة هوائية',
] as const;

export const EDKU_NEIGHBORHOODS: readonly string[] = [
  'شارع المحطة',
  'سعد زغلول',
  'الجمهورية',
  'محمد عبده',
  'شارع البحر',
  'بورسعيد',
  'الجيش',
  'الصنية',
  'الطويبة',
  'سيدي إبراهيم',
  'العراقية',
  'الشلبي',
  'القائد جوهر',
  'أحمد عرابي',
  'كوم الطواحين',
  'الصباغ',
  'طريق الملح',
  'شارع المصيف',
  'المعدية',
  'منشية ديبونو',
  '6 أكتوبر',
  'العزب',
  'المناطق الزراعية البعيدة',
] as const;

export const EDKU_ROUTE_WAYPOINTS: readonly string[] = [
  'استلام الطلب من المتجر',
  'شارع البحر الرئيسي - إدكو',
  'محطة قطار إدكو - وسط المدينة',
  'منطقة كوبري شربت والمعدية',
  'أمام عنوان العميل للاستلام',
] as const;

// Synchronized verbatim with firebase-blueprint.json & firestore.rules
export const VALID_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;
export const EGYPT_PHONE_REGEX = /^01[0125][0-9]{8}$/;

export const BLUEPRINT_LIMITS = {
  idMax: 128,
  storeNameMin: 2,
  storeNameMax: 80,
  categoryMax: 40,
  neighborhoodMin: 2,
  neighborhoodMax: 80,
  descriptionMin: 4,
  descriptionMax: 220,
  deliveryFeeMin: 15,
  deliveryFeeMax: 200,
  deliveryTimeMin: 10,
  deliveryTimeMax: 120,
  minOrderMin: 0,
  minOrderMax: 5000,
  menuItemsMin: 1,
  menuItemsMax: 8,
  menuItemNameMin: 2,
  menuItemNameMax: 80,
  menuItemPriceMin: 1,
  menuItemPriceMax: 5000,
  imageUrlMax: 750_000,
  customerNameMin: 2,
  customerNameMax: 80,
  orderNeighborhoodMin: 2,
  orderNeighborhoodMax: 80,
  addressMin: 4,
  addressMax: 200,
  orderItemsMaxDistinct: 15,
  itemsSummaryMin: 2,
  itemsSummaryMax: 400,
  itemNamesMaxCount: 10,
  itemNameMaxLength: 100,
  itemCountMin: 1,
  itemCountMax: 50,
  subtotalMax: 50000,
  notesMax: 200,
  prepTimeMin: 5,
  prepTimeMax: 180,
  courierLocationMax: 120,
} as const;

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function isValidFirestoreId(id: string): boolean {
  return (
    typeof id === 'string' &&
    id.length >= 1 &&
    id.length <= BLUEPRINT_LIMITS.idMax &&
    VALID_ID_REGEX.test(id)
  );
}

export function normalizeEgyptPhoneOrEmpty(rawPhone: string): string {
  if (typeof rawPhone !== 'string') return '';
  const asciiDigits = rawPhone
    .replace(/[٠-٩]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0))
    .trim();

  let cleaned = asciiDigits.replace(/[\s\-().]/g, '');
  if (cleaned.startsWith('+20')) {
    cleaned = `0${cleaned.slice(3)}`;
  } else if (cleaned.startsWith('0020')) {
    cleaned = `0${cleaned.slice(4)}`;
  } else if (cleaned.length === 10 && /^1[0125][0-9]{8}$/.test(cleaned)) {
    cleaned = `0${cleaned}`;
  }

  if (EGYPT_PHONE_REGEX.test(cleaned)) {
    return cleaned;
  }
  return cleaned.slice(0, 20);
}

export function getCairoCurrentTimeMinutes(): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const hourPart = parts.find((p) => p.type === 'hour')?.value ?? '0';
    const minPart = parts.find((p) => p.type === 'minute')?.value ?? '0';
    return parseInt(hourPart, 10) * 60 + parseInt(minPart, 10);
  } catch {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }
}

export function parseTimeToMinutes(timeStr?: string): number | null {
  if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return null;
  const parts = timeStr.split(':');
  const h = parseInt(parts[0]?.trim() || '', 10);
  const m = parseInt(parts[1]?.trim() || '', 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

export function isStoreOpen(
  store: Pick<
    StoreRecord,
    'isActive' | 'isOpen' | 'isManuallyClosed' | 'openingTime' | 'closingTime'
  >
): boolean {
  if (!store.isActive) return false;
  if (store.isManuallyClosed === true || store.isOpen === false) return false;

  const openMins = parseTimeToMinutes(store.openingTime);
  const closeMins = parseTimeToMinutes(store.closingTime);

  // If opening/closing hours not configured, rely on isOpen
  if (openMins === null || closeMins === null) {
    return true;
  }

  const currentMins = getCairoCurrentTimeMinutes();

  if (openMins <= closeMins) {
    // Normal day shift (e.g. 09:00 to 23:00)
    return currentMins >= openMins && currentMins <= closeMins;
  } else {
    // Overnight shift (e.g. 17:00 to 03:00 next day)
    return currentMins >= openMins || currentMins <= closeMins;
  }
}

export function isStoreCurrentlyOpen(
  store: Pick<
    StoreRecord,
    'isActive' | 'isOpen' | 'isManuallyClosed' | 'openingTime' | 'closingTime'
  >
): boolean {
  return isStoreOpen(store);
}

export function getPendingOrderSurgeDetails(createdAtIso: string): {
  isSurgeActive: boolean;
  isCriticalDelay: boolean;
  elapsedMinutes: number;
  multiplier: number;
} {
  const createdMs = new Date(createdAtIso).getTime();
  if (isNaN(createdMs)) {
    return { isSurgeActive: false, isCriticalDelay: false, elapsedMinutes: 0, multiplier: 1 };
  }
  const diffMs = Math.max(0, Date.now() - createdMs);
  const elapsedMinutes = Math.floor(diffMs / (1000 * 60));

  const isSurgeActive = elapsedMinutes >= 5;
  const isCriticalDelay = elapsedMinutes >= 10;
  const multiplier = isSurgeActive ? 1.5 : 1.0;

  return {
    isSurgeActive,
    isCriticalDelay,
    elapsedMinutes,
    multiplier,
  };
}

export function validateCheckoutForm(
  input: CheckoutFormInput,
  options?: { allowVisa?: boolean }
): ValidationResult {
  const errors: Record<string, string> = {};
  const name = input.customerName.trim();
  const phone = normalizeEgyptPhoneOrEmpty(input.customerPhone);
  const neighborhood = input.deliveryNeighborhood.trim();
  const address = input.deliveryAddress.trim();
  const notes = input.notes.trim();

  if (
    name.length < BLUEPRINT_LIMITS.customerNameMin ||
    name.length > BLUEPRINT_LIMITS.customerNameMax
  ) {
    errors.customerName = 'يرجى إدخال اسم العميل (من حرفين إلى ٨٠ حرفاً).';
  }

  if (!EGYPT_PHONE_REGEX.test(phone)) {
    errors.customerPhone =
      'يرجى إدخال رقم هاتف مصري صحيح مكون من ١١ رقماً (مثال: 01012345678).';
  }

  if (
    !input.zoneId ||
    !APPROVED_EDKO_ZONE_IDS.includes(input.zoneId as EdkoZoneId)
  ) {
    errors.zoneId =
      'يرجى اختيار منطقتك من مناطق إدكو الخمس المعتمدة لحساب رسوم التوصيل.';
  }

  if (
    neighborhood.length < BLUEPRINT_LIMITS.orderNeighborhoodMin ||
    neighborhood.length > BLUEPRINT_LIMITS.orderNeighborhoodMax
  ) {
    errors.deliveryNeighborhood = 'يرجى تحديد موقع التوصيل أو الحي داخل إدكو.';
  }

  if (
    address.length < BLUEPRINT_LIMITS.addressMin ||
    address.length > BLUEPRINT_LIMITS.addressMax
  ) {
    errors.deliveryAddress =
      'يرجى تحديد الموقع على الخريطة أو إضافة علامة مميزة للعنوان.';
  }

  if (
    typeof input.customerLat !== 'number' ||
    typeof input.customerLng !== 'number' ||
    !Number.isFinite(input.customerLat) ||
    !Number.isFinite(input.customerLng)
  ) {
    errors.deliveryLocation = 'يرجى تحديد موقع الاستلام من الخريطة أولاً.';
  } else if (!isWithinEdkuServiceBounds(input.customerLat, input.customerLng)) {
    errors.deliveryLocation =
      'نطاق الخدمة والتوصيل متاح داخل مدينة إدكو والقرى المجاورة فقط.';
  }

  if (input.paymentMethod === 'visa' && !options?.allowVisa) {
    errors.paymentMethod =
      'الدفع بالفيزا سيتوفر قريباً، يرجى اختيار الدفع نقداً عند الاستلام أو المحفظة حالياً.';
  } else if (
    input.paymentMethod !== 'cash' &&
    input.paymentMethod !== 'wallet' &&
    input.paymentMethod !== 'visa' &&
    input.paymentMethod !== 'cash_on_delivery'
  ) {
    errors.paymentMethod = 'يرجى اختيار وسيلة دفع صحيحة.';
  }

  if (input.isScheduled) {
    const scheduledIso = (input.scheduledForIso ?? '').trim();
    const parsedMs = Date.parse(scheduledIso);
    if (!scheduledIso || Number.isNaN(parsedMs)) {
      errors.scheduledForIso = 'يرجى اختيار موعد صحيح لجدولة الطلب.';
    } else if (parsedMs < Date.now() + 10 * 60 * 1000) {
      errors.scheduledForIso =
        'يرجى اختيار موعد مستقبلي بعد ١٠ دقائق على الأقل من الآن.';
    }
  }

  if (notes.length > BLUEPRINT_LIMITS.notesMax) {
    errors.notes = 'الملاحظات يجب ألا تتجاوز ٢٠٠ حرف.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validatePharmacyPrescriptionInput(
  input: PharmacyPrescriptionOrderInput
): string | null {
  const name = input.customerName.trim();
  if (name.length < 2 || name.length > 80) {
    return 'يرجى إدخال اسم العميل بالكامل.';
  }
  const phone = normalizeEgyptPhoneOrEmpty(input.customerPhone);
  if (!EGYPT_PHONE_REGEX.test(phone)) {
    return 'يرجى إدخال رقم موبايل مصري صحيح مكون من ١١ رقماً.';
  }
  const hasImage = isValidUploadedImageUrl(input.prescriptionImageUrl);
  const medText = (input.medicineRequest ?? '').trim();
  if (!hasImage && medText.length < 3) {
    return 'يرجى إرفاق صورة الروشتة من جهازك أو كتابة أسماء الأدوية المطلوبة.';
  }
  if (medText.length > 600) {
    return 'تفاصيل الأدوية يجب ألا تتجاوز ٦٠٠ حرف.';
  }
  if (
    !Number.isFinite(input.customerLat) ||
    !Number.isFinite(input.customerLng)
  ) {
    return 'يرجى تحديد موقع التوصيل على خريطة إدكو.';
  }
  if (!isWithinEdkuServiceBounds(input.customerLat, input.customerLng)) {
    return 'نطاق توصيل الروشتات متاح داخل مدينة إدكو والقرى المجاورة فقط.';
  }
  const neighborhood = (input.deliveryNeighborhood ?? '').trim();
  if (
    neighborhood.length > 0 &&
    (neighborhood.length < BLUEPRINT_LIMITS.orderNeighborhoodMin ||
      neighborhood.length > BLUEPRINT_LIMITS.orderNeighborhoodMax)
  ) {
    return 'يرجى تحديد الحي أو المنطقة داخل إدكو بشكل صحيح.';
  }
  const cleanAddress = input.deliveryAddress.trim();
  if (
    cleanAddress.length < BLUEPRINT_LIMITS.addressMin ||
    cleanAddress.length > BLUEPRINT_LIMITS.addressMax
  ) {
    return 'يرجى كتابة علامة مميزة للعنوان بجوار نقطة الخريطة (من ٤ إلى ٢٠٠ حرف).';
  }
  return null;
}

export function validateCourierProfile(
  input: CourierProfileInput
): ValidationResult {
  const errors: Record<string, string> = {};
  const name = input.name.trim();
  const phone = normalizeEgyptPhoneOrEmpty(input.phone);
  const neighborhood = input.neighborhood.trim();

  if (
    name.length < BLUEPRINT_LIMITS.customerNameMin ||
    name.length > BLUEPRINT_LIMITS.customerNameMax
  ) {
    errors.name = 'يرجى إدخال اسم المندوب (من حرفين إلى ٨٠ حرفاً).';
  }

  if (!EGYPT_PHONE_REGEX.test(phone)) {
    errors.phone = 'يرجى إدخال رقم هاتف مصري صحيح للمندوب (١١ رقماً).';
  }

  if (!COURIER_VEHICLE_TYPES.includes(input.vehicleType)) {
    errors.vehicleType = 'يرجى اختيار وسيلة توصيل صحيحة.';
  }

  if (
    neighborhood.length < BLUEPRINT_LIMITS.neighborhoodMin ||
    neighborhood.length > BLUEPRINT_LIMITS.neighborhoodMax
  ) {
    errors.neighborhood = 'يرجى تحديد موقع تمركز المندوب على الخريطة.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateCourierRegistrationForm(
  input: CourierRegisterInput
): ValidationResult {
  const errors: Record<string, string> = {};
  const name = input.name.trim();
  const phone = normalizeEgyptPhoneOrEmpty(input.phone);
  const email = input.email.trim();
  const password = input.password;
  const neighborhood = input.neighborhood.trim();

  if (
    name.length < BLUEPRINT_LIMITS.customerNameMin ||
    name.length > BLUEPRINT_LIMITS.customerNameMax
  ) {
    errors.name = 'يرجى إدخال اسم المندوب (من حرفين إلى ٨٠ حرفاً).';
  }

  if (!EGYPT_PHONE_REGEX.test(phone)) {
    errors.phone =
      'يرجى إدخال رقم موبايل مصري صحيح مكون من ١١ رقماً (مثال: 01012345678).';
  }

  if (email.length < 5 || email.length > 100 || !email.includes('@')) {
    errors.email = 'يرجى إدخال بريد إلكتروني صحيح للمندوب.';
  }

  if (password.length < 6 || password.length > 64) {
    errors.password = 'كلمة المرور يجب أن تتكون من ٦ أحرف أو أرقام على الأقل.';
  }

  if (!COURIER_VEHICLE_TYPES.includes(input.vehicleType)) {
    errors.vehicleType = 'يرجى اختيار وسيلة توصيل صحيحة.';
  }

  if (
    neighborhood.length < BLUEPRINT_LIMITS.neighborhoodMin ||
    neighborhood.length > BLUEPRINT_LIMITS.neighborhoodMax
  ) {
    errors.neighborhood = 'يرجى تحديد موقع عمل المندوب على خريطة إدكو.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function isCourierDrivingLicenseRequired(
  vehicleType: CourierVehicleType
): boolean {
  return vehicleType !== 'دراجة هوائية';
}

export function validateCourierKycDocuments(
  vehicleType: CourierVehicleType,
  docs: Partial<CourierKycDocumentsInput>
): ValidationResult {
  const errors: Record<string, string> = {};

  if (!isValidUploadedImageUrl(docs.nationalIdFrontUrl)) {
    errors.nationalIdFrontUrl = 'صورة وجه البطاقة الشخصية إجبارية للمراجعة.';
  }
  if (!isValidUploadedImageUrl(docs.nationalIdBackUrl)) {
    errors.nationalIdBackUrl = 'صورة ظهر البطاقة الشخصية إجبارية للمراجعة.';
  }
  if (!isValidUploadedImageUrl(docs.selfieWithIdUrl)) {
    errors.selfieWithIdUrl =
      vehicleType === 'دراجة هوائية'
        ? 'صورة سيلفي لك مع البطاقة بجانب الوجه إجبارية للتوثيق.'
        : 'صورة سيلفي لك مع الرخصة والبطاقة بجانب الوجه إجبارية للتوثيق.';
  }
  if (!isValidUploadedImageUrl(docs.vehiclePhotoUrl)) {
    errors.vehiclePhotoUrl =
      vehicleType === 'دراجة هوائية'
        ? 'صورة واضحة للدراجة الهوائية إجبارية.'
        : 'صورة واضحة للموتوسيكل أو السكوتر إجبارية.';
  }

  if (isCourierDrivingLicenseRequired(vehicleType)) {
    if (!isValidUploadedImageUrl(docs.drivingLicenseFrontUrl)) {
      errors.drivingLicenseFrontUrl =
        'صورة وجه رخصة القيادة إجبارية للموتوسيكل والسكوتر.';
    }
    if (!isValidUploadedImageUrl(docs.drivingLicenseBackUrl)) {
      errors.drivingLicenseBackUrl =
        'صورة ظهر رخصة القيادة إجبارية للموتوسيكل والسكوتر.';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateStoreLegalFields(
  input: {
    commercialRegisterNumber?: string;
    taxCertificateNumber?: string;
    commercialRegisterImageUrl?: string;
  },
  options?: { requireImage?: boolean }
): ValidationResult {
  const errors: Record<string, string> = {};
  const crNum = (input.commercialRegisterNumber ?? '').trim();
  const taxNum = (input.taxCertificateNumber ?? '').trim();

  if (crNum.length < 3 || crNum.length > 40) {
    errors.commercialRegisterNumber =
      'رقم السجل التجاري إجباري (من ٣ إلى ٤٠ حرفاً أو رقماً).';
  }
  if (taxNum.length < 3 || taxNum.length > 40) {
    errors.taxCertificateNumber =
      'رقم الشهادة الضريبية / البطاقة الضريبية إجباري (من ٣ إلى ٤٠ حرفاً أو رقماً).';
  }
  if (
    options?.requireImage &&
    !isValidUploadedImageUrl(input.commercialRegisterImageUrl)
  ) {
    errors.commercialRegisterImageUrl =
      'إرفاق صورة السجل التجاري إجباري.';
  } else if (
    input.commercialRegisterImageUrl !== undefined &&
    input.commercialRegisterImageUrl.trim().length > 0 &&
    !isValidUploadedImageUrl(input.commercialRegisterImageUrl)
  ) {
    errors.commercialRegisterImageUrl = 'صورة السجل التجاري المرفقة غير صالحة.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateCustomerRegistrationForm(input: {
  name: string;
  email: string;
  password: string;
}): ValidationResult {
  const errors: Record<string, string> = {};
  const cleanName = input.name.trim();
  const cleanEmail = input.email.trim().toLowerCase();
  const password = input.password;

  if (
    cleanName.length < BLUEPRINT_LIMITS.customerNameMin ||
    cleanName.length > BLUEPRINT_LIMITS.customerNameMax
  ) {
    errors.name = 'يرجى إدخال الاسم بالكامل (من حرفين إلى ٨٠ حرفاً).';
  }

  if (
    cleanEmail.length < 5 ||
    cleanEmail.length > 100 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
  ) {
    errors.email = 'يرجى إدخال بريد إلكتروني صحيح.';
  }

  if (password.length < 6 || password.length > 64) {
    errors.password = 'كلمة المرور يجب أن تتكون من ٦ أحرف أو أرقام على الأقل.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function generateStoreCredentials(): {
  loginEmail: string;
  generatedPassword: string;
} {
  const randomDigits = String(Math.floor(100000 + Math.random() * 900000));
  const passDigits = String(Math.floor(100000 + Math.random() * 900000));
  const alphaPool = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
  const c1 = alphaPool[Math.floor(Math.random() * 24)];
  const c2 = alphaPool[24 + Math.floor(Math.random() * 23)];
  return {
    loginEmail: `store.${randomDigits}@adkawy.com`,
    generatedPassword: `${c1}${c2}#${passDigits}`,
  };
}

export function validateAdminCreateStoreForm(
  input: AdminCreateStoreInput
): ValidationResult {
  const errors: Record<string, string> = {};
  const name = input.name.trim();
  const phone = normalizeEgyptPhoneOrEmpty(input.phone);
  const neighborhood = (input.neighborhood ?? EDKU_NEIGHBORHOODS[0]).trim();
  const deliveryFee =
    input.deliveryFee === undefined ? 15 : Math.trunc(Number(input.deliveryFee));
  const deliveryTime =
    input.deliveryTimeMinutes === undefined
      ? 25
      : Math.trunc(Number(input.deliveryTimeMinutes));

  if (
    name.length < BLUEPRINT_LIMITS.storeNameMin ||
    name.length > BLUEPRINT_LIMITS.storeNameMax
  ) {
    errors.name = 'يرجى إدخال اسم المتجر أو الصيدلية (من حرفين إلى ٨٠ حرفاً).';
  }

  if (!EGYPT_PHONE_REGEX.test(phone)) {
    errors.phone =
      'يرجى إدخال رقم موبايل صاحب المتجر مكوناً من ١١ رقماً (مثال: 01012345678).';
  }

  if (!STORE_CATEGORIES.includes(input.category)) {
    errors.category = 'يرجى اختيار تصنيف المتجر.';
  }

  if (!isValidUploadedImageUrl(input.imageUrl)) {
    errors.imageUrl = 'رفع صورة المتجر من الجهاز إجباري.';
  }

  if (
    neighborhood.length < BLUEPRINT_LIMITS.neighborhoodMin ||
    neighborhood.length > BLUEPRINT_LIMITS.neighborhoodMax
  ) {
    errors.neighborhood = 'يرجى تحديد موقع المتجر على خريطة إدكو.';
  }

  if (
    !Number.isFinite(deliveryFee) ||
    deliveryFee < BLUEPRINT_LIMITS.deliveryFeeMin ||
    deliveryFee > BLUEPRINT_LIMITS.deliveryFeeMax
  ) {
    errors.deliveryFee = 'رسوم التوصيل يجب أن تكون بين ١٥ و ٢٠٠ ج.م.';
  }

  if (
    !Number.isFinite(deliveryTime) ||
    deliveryTime < BLUEPRINT_LIMITS.deliveryTimeMin ||
    deliveryTime > BLUEPRINT_LIMITS.deliveryTimeMax
  ) {
    errors.deliveryTimeMinutes = 'وقت التوصيل يجب أن يكون بين ١٠ و ١٢٠ دقيقة.';
  }

  const legalValidation = validateStoreLegalFields(
    {
      commercialRegisterNumber: input.commercialRegisterNumber,
      taxCertificateNumber: input.taxCertificateNumber,
      commercialRegisterImageUrl: input.commercialRegisterImageUrl,
    },
    { requireImage: true }
  );
  Object.assign(errors, legalValidation.errors);

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateStoreSettingsForm(
  input: StoreOperationalSettingsInput
): ValidationResult {
  const errors: Record<string, string> = {};
  const prepTime = Math.trunc(Number(input.prepTimeMinutes));
  const minOrder = Math.trunc(Number(input.minOrderAmount));

  if (
    !Number.isFinite(prepTime) ||
    prepTime < BLUEPRINT_LIMITS.prepTimeMin ||
    prepTime > BLUEPRINT_LIMITS.prepTimeMax
  ) {
    errors.prepTimeMinutes =
      'وقت التحضير المتوقع يجب أن يكون بين ٥ و ١٨٠ دقيقة.';
  }

  if (
    !Number.isFinite(minOrder) ||
    minOrder < BLUEPRINT_LIMITS.minOrderMin ||
    minOrder > BLUEPRINT_LIMITS.minOrderMax
  ) {
    errors.minOrderAmount =
      'الحد الأدنى للطلب يجب أن يكون بين ٠ و ٥٠٠٠ ج.م.';
  }

  if (input.imageUrl !== undefined && input.imageUrl.trim().length > 0) {
    if (!isValidUploadedImageUrl(input.imageUrl)) {
      errors.imageUrl = 'صورة المتجر المرفقة غير صالحة.';
    }
  }

  const legalValidation = validateStoreLegalFields(
    {
      commercialRegisterNumber: input.commercialRegisterNumber,
      taxCertificateNumber: input.taxCertificateNumber,
      commercialRegisterImageUrl: input.commercialRegisterImageUrl,
    },
    { requireImage: false }
  );
  Object.assign(errors, legalValidation.errors);

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateNewProductForm(input: NewProductInput): ValidationResult {
  const errors: Record<string, string> = {};
  const name = input.name.trim();
  const description = input.description.trim();
  const category = input.category.trim();
  const price = Math.trunc(Number(input.price));
  const imageUrl = (input.imageUrl ?? '').trim();

  if (!isValidFirestoreId(input.storeId)) {
    errors.storeId = 'معرّف المتجر غير صالح.';
  }

  if (
    name.length < BLUEPRINT_LIMITS.menuItemNameMin ||
    name.length > BLUEPRINT_LIMITS.menuItemNameMax
  ) {
    errors.name = 'يرجى إدخال اسم المنتج (من حرفين إلى ٨٠ حرفاً).';
  }

  if (
    description.length < BLUEPRINT_LIMITS.descriptionMin ||
    description.length > BLUEPRINT_LIMITS.descriptionMax
  ) {
    errors.description = 'يرجى كتابة وصف مختصر للمنتج (من ٤ إلى ٢٢٠ حرفاً).';
  }

  if (category.length < 2 || category.length > BLUEPRINT_LIMITS.categoryMax) {
    errors.category = 'يرجى تحديد قسم المنتج داخل المنيو (مثل: مشويات، مقبلات).';
  }

  if (
    !Number.isFinite(price) ||
    price < BLUEPRINT_LIMITS.menuItemPriceMin ||
    price > BLUEPRINT_LIMITS.menuItemPriceMax
  ) {
    errors.price = 'سعر المنتج يجب أن يكون بين ١ و ٥٠٠٠ ج.م.';
  }

  if (!isValidUploadedImageUrl(imageUrl)) {
    errors.imageUrl = 'رفع صورة المنتج الحقيقية من جهازك إجباري.';
  }

  if (input.stockQuantity !== undefined) {
    const qty = Math.trunc(Number(input.stockQuantity));
    if (!Number.isFinite(qty) || qty < 0 || qty > 10000) {
      errors.stockQuantity = 'الكمية المتاحة يجب أن تكون بين ٠ و ١٠٠٠٠.';
    }
  }

  if (input.hasVariants) {
    if (!Array.isArray(input.variants) || input.variants.length === 0) {
      errors.variants =
        'عند تفعيل المتغيرات، يرجى إضافة مقاس أو لون أو حجم واحد على الأقل.';
    } else if (input.variants.length > 20) {
      errors.variants = 'الحد الأقصى لمتغيرات المنتج الواحد هو ٢٠ خياراً.';
    } else {
      for (const v of input.variants) {
        const vName = (v.name ?? '').trim();
        const vPrice = Math.trunc(Number(v.price));
        const vStock = Math.trunc(Number(v.stock));
        if (vName.length < 1 || vName.length > 60) {
          errors.variants = 'يرجى التأكد من كتابة اسم واضح لكل متغير.';
          break;
        }
        if (
          !Number.isFinite(vPrice) ||
          vPrice < BLUEPRINT_LIMITS.menuItemPriceMin ||
          vPrice > BLUEPRINT_LIMITS.menuItemPriceMax
        ) {
          errors.variants = 'سعر كل متغير يجب أن يكون بين ١ و ٥٠٠٠ ج.م.';
          break;
        }
        if (!Number.isFinite(vStock) || vStock < 0 || vStock > 10000) {
          errors.variants = 'مخزون كل متغير يجب أن يكون بين ٠ و ١٠٠٠٠ قطعة.';
          break;
        }
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateNewStoreForm(input: NewStoreInput): ValidationResult {
  const errors: Record<string, string> = {};
  const name = input.name.trim();
  const neighborhood = input.neighborhood.trim();
  const description = input.description.trim();
  const firstItemName = input.firstItemName.trim();
  const deliveryFee = Math.trunc(Number(input.deliveryFee));
  const deliveryTime = Math.trunc(Number(input.deliveryTimeMinutes));
  const firstPrice = Math.trunc(Number(input.firstItemPrice));

  if (
    name.length < BLUEPRINT_LIMITS.storeNameMin ||
    name.length > BLUEPRINT_LIMITS.storeNameMax
  ) {
    errors.name = 'يرجى إدخال اسم المتجر (من حرفين إلى ٨٠ حرفاً).';
  }

  if (!STORE_CATEGORIES.includes(input.category)) {
    errors.category = 'يرجى اختيار تصنيف صحيح للمتجر.';
  }

  if (!isValidUploadedImageUrl(input.imageUrl)) {
    errors.imageUrl = 'رفع صورة المتجر من جهازك إجباري.';
  }

  if (
    neighborhood.length < BLUEPRINT_LIMITS.neighborhoodMin ||
    neighborhood.length > BLUEPRINT_LIMITS.neighborhoodMax
  ) {
    errors.neighborhood = 'يرجى تحديد موقع المتجر على خريطة إدكو.';
  }

  if (
    description.length < BLUEPRINT_LIMITS.descriptionMin ||
    description.length > BLUEPRINT_LIMITS.descriptionMax
  ) {
    errors.description = 'يرجى كتابة وصف مختصر للمتجر (من ٤ إلى ٢٢٠ حرفاً).';
  }

  if (
    !Number.isFinite(deliveryFee) ||
    deliveryFee < BLUEPRINT_LIMITS.deliveryFeeMin ||
    deliveryFee > BLUEPRINT_LIMITS.deliveryFeeMax
  ) {
    errors.deliveryFee = 'رسوم التوصيل يجب أن تكون بين ١٥ و ٢٠٠ ج.م.';
  }

  if (
    !Number.isFinite(deliveryTime) ||
    deliveryTime < BLUEPRINT_LIMITS.deliveryTimeMin ||
    deliveryTime > BLUEPRINT_LIMITS.deliveryTimeMax
  ) {
    errors.deliveryTimeMinutes =
      'وقت التوصيل المتوقع يجب أن يكون بين ١٠ و ١٢٠ دقيقة.';
  }

  if (
    firstItemName.length < BLUEPRINT_LIMITS.menuItemNameMin ||
    firstItemName.length > BLUEPRINT_LIMITS.menuItemNameMax
  ) {
    errors.firstItemName =
      'يرجى إدخال اسم المنتج الأول (من حرفين إلى ٨٠ حرفاً).';
  }

  if (
    !Number.isFinite(firstPrice) ||
    firstPrice < BLUEPRINT_LIMITS.menuItemPriceMin ||
    firstPrice > BLUEPRINT_LIMITS.menuItemPriceMax
  ) {
    errors.firstItemPrice = 'سعر المنتج يجب أن يكون بين ١ و ٥٠٠٠ ج.م.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export interface CartCalculationSummary {
  itemCount: number;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  couponCode?: string;
  baseZoneFee: number;
  freeDeliveryApplied: boolean;
  deliveryFee: number;
  smallOrderFee: number;
  totalAmount: number;
  items: OrderItemPayload[];
  itemsSummary: string;
  itemNames: string[];
}

export function isCouponExpired(expiryDateIso?: string): boolean {
  if (!expiryDateIso || !expiryDateIso.trim()) return false;
  const endOfDayIso =
    expiryDateIso.length === 10
      ? `${expiryDateIso}T23:59:59.999Z`
      : expiryDateIso;
  const parsed = Date.parse(endOfDayIso);
  if (Number.isNaN(parsed)) return false;
  return Date.now() > parsed;
}

export function calculateCouponDiscountEgp(
  subtotal: number,
  appliedCoupon?: AppliedCoupon | null
): { discountPercent: number; discountAmount: number; couponCode?: string } {
  if (!appliedCoupon || subtotal <= 0 || appliedCoupon.isUsed) {
    return { discountPercent: 0, discountAmount: 0 };
  }
  if (isCouponExpired(appliedCoupon.expiryDateIso)) {
    return { discountPercent: 0, discountAmount: 0 };
  }
  if (subtotal < appliedCoupon.minOrderEgp) {
    return { discountPercent: 0, discountAmount: 0 };
  }
  const pct = Math.min(90, Math.max(1, Math.trunc(appliedCoupon.discountPercent)));
  const rawDiscount = Math.round((subtotal * pct) / 100);
  const capped = Math.min(
    subtotal,
    Math.max(0, Math.min(Math.trunc(appliedCoupon.maxDiscountEgp), rawDiscount))
  );
  return {
    discountPercent: pct,
    discountAmount: capped,
    couponCode: appliedCoupon.code.trim().toUpperCase(),
  };
}

export function buildCartItemId(productId: string, variantId?: string): string {
  const cleanProd = productId.trim();
  const cleanVar = (variantId ?? '').trim();
  return cleanVar ? `${cleanProd}__${cleanVar}` : cleanProd;
}

export function getCartEntryKey(entry: CartItem): string {
  if (entry.cartItemId && entry.cartItemId.trim()) {
    return entry.cartItemId.trim();
  }
  return buildCartItemId(entry.item.id, entry.selectedVariant?.variantId);
}

export interface CalculateCartOptions {
  zoneDeliveryFee?: number;
  useFreeDeliveryReward?: boolean;
}

export function calculateCartTotals(
  cart: CartItem[],
  appliedCoupon?: AppliedCoupon | null,
  options?: CalculateCartOptions
): CartCalculationSummary {
  if (cart.length === 0) {
    return {
      itemCount: 0,
      subtotal: 0,
      discountPercent: 0,
      discountAmount: 0,
      baseZoneFee: 0,
      freeDeliveryApplied: false,
      deliveryFee: 0,
      smallOrderFee: 0,
      totalAmount: 0,
      items: [],
      itemsSummary: '',
      itemNames: [],
    };
  }

  const rawDeliveryFee =
    options?.zoneDeliveryFee !== undefined
      ? Number(options.zoneDeliveryFee)
      : Number(cart[0].deliveryFee);
  const baseZoneFee = Number.isFinite(rawDeliveryFee)
    ? Math.min(200, Math.max(MIN_COURIER_DELIVERY_FEE_EGP, Math.trunc(rawDeliveryFee)))
    : MIN_COURIER_DELIVERY_FEE_EGP;
  const freeDeliveryApplied = Boolean(options?.useFreeDeliveryReward);
  const deliveryFee = freeDeliveryApplied ? 0 : baseZoneFee;

  let itemCount = 0;
  let subtotal = 0;

  const boundedEntries = cart.slice(0, BLUEPRINT_LIMITS.orderItemsMaxDistinct);
  const items: OrderItemPayload[] = boundedEntries.map((entry) => {
    const rawQty = Number(entry.quantity);
    const qty = Math.min(
      BLUEPRINT_LIMITS.itemCountMax,
      Math.max(1, Number.isFinite(rawQty) ? Math.trunc(rawQty) : 1)
    );
    const rawPrice = Number(entry.selectedVariant?.price ?? entry.item.price);
    const price = Math.min(
      BLUEPRINT_LIMITS.menuItemPriceMax,
      Math.max(1, Number.isFinite(rawPrice) ? Math.trunc(rawPrice) : 1)
    );
    itemCount += qty;
    subtotal += price * qty;
    const sanitizedProductId = isValidFirestoreId(entry.item.id)
      ? entry.item.id
      : entry.item.id.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 64) || 'item_1';

    const variantLabel = entry.selectedVariant?.name
      ? entry.selectedVariant.name.trim().slice(0, 40)
      : undefined;
    const variantId = entry.selectedVariant?.variantId
      ? entry.selectedVariant.variantId
          .replace(/[^a-zA-Z0-9_\-]/g, '_')
          .slice(0, 64)
      : undefined;
    const displayName = variantLabel
      ? `${entry.item.name.trim()} (${variantLabel})`.slice(
          0,
          BLUEPRINT_LIMITS.menuItemNameMax
        )
      : entry.item.name.trim().slice(0, BLUEPRINT_LIMITS.menuItemNameMax);

    return {
      productId: sanitizedProductId,
      ...(variantId ? { variantId } : {}),
      ...(variantLabel ? { variantLabel } : {}),
      name: displayName,
      price,
      quantity: qty,
    };
  });

  const rawSummary = items
    .map((entry) => `${entry.name} × ${entry.quantity}`)
    .join('، ');

  const itemsSummary =
    rawSummary.length > BLUEPRINT_LIMITS.itemsSummaryMax
      ? `${rawSummary.slice(0, BLUEPRINT_LIMITS.itemsSummaryMax - 1)}…`
      : rawSummary;

  const itemNames = items
    .slice(0, BLUEPRINT_LIMITS.itemNamesMaxCount)
    .map((entry) =>
      `${entry.name} (${entry.quantity})`.slice(
        0,
        BLUEPRINT_LIMITS.itemNameMaxLength
      )
    );

  const { discountPercent, discountAmount, couponCode } =
    calculateCouponDiscountEgp(subtotal, appliedCoupon);

  const smallOrderFee =
    subtotal > 0 && subtotal < SMALL_ORDER_THRESHOLD_EGP
      ? SMALL_ORDER_FEE_EGP
      : 0;

  return {
    itemCount,
    subtotal,
    discountPercent,
    discountAmount,
    couponCode,
    baseZoneFee,
    freeDeliveryApplied,
    deliveryFee,
    smallOrderFee,
    totalAmount:
      Math.max(0, subtotal - discountAmount) + deliveryFee + smallOrderFee,
    items,
    itemsSummary,
    itemNames,
  };
}

export function calculateGroupBillSplit(params: {
  items: readonly GroupSessionCartItem[];
  deliveryFee: number;
  smallOrderFee: number;
  discountAmount: number;
}): GroupBillParticipantShare[] {
  const { items, deliveryFee, smallOrderFee, discountAmount } = params;
  if (items.length === 0) return [];

  const grouped = new Map<
    string,
    { name: string; count: number; subtotal: number }
  >();
  let grandSubtotal = 0;

  for (const item of items) {
    const uid = item.participantUid || 'guest';
    const qty = Math.max(1, Math.trunc(item.quantity));
    const lineTotal = Math.max(0, Math.trunc(item.price)) * qty;
    grandSubtotal += lineTotal;
    const prev = grouped.get(uid) ?? {
      name: item.participantName || 'مشارك',
      count: 0,
      subtotal: 0,
    };
    prev.count += qty;
    prev.subtotal += lineTotal;
    grouped.set(uid, prev);
  }

  const participantsCount = Math.max(1, grouped.size);
  const totalSharedFees = Math.max(0, deliveryFee + smallOrderFee);
  const perParticipantFee = Math.round(totalSharedFees / participantsCount);

  const shares: GroupBillParticipantShare[] = [];
  for (const [uid, data] of grouped.entries()) {
    const ratio = grandSubtotal > 0 ? data.subtotal / grandSubtotal : 0;
    const discountShare = Math.round(Math.max(0, discountAmount) * ratio);
    const totalOwed = Math.max(
      0,
      data.subtotal - discountShare + perParticipantFee
    );
    shares.push({
      participantUid: uid,
      participantName: data.name,
      itemsCount: data.count,
      itemsSubtotal: data.subtotal,
      deliveryAndFeesShare: perParticipantFee,
      discountShare,
      totalOwed,
    });
  }

  return shares;
}

export interface AddToCartOutcome {
  cart: CartItem[];
  replacedOtherStore: boolean;
  cappedAtLimit: boolean;
}

export function addItemToCartState(
  currentCart: CartItem[],
  store: Pick<StoreRecord, 'id' | 'name' | 'deliveryFee'>,
  menuItem: MenuItem,
  selectedVariant?: ProductVariant
): AddToCartOutcome {
  const isDifferentStore =
    currentCart.length > 0 && currentCart[0].storeId !== store.id;

  const baseCart = isDifferentStore ? [] : [...currentCart];
  const currentTotalCount = baseCart.reduce((acc, c) => acc + c.quantity, 0);

  if (currentTotalCount >= BLUEPRINT_LIMITS.itemCountMax) {
    return {
      cart: baseCart,
      replacedOtherStore: isDifferentStore,
      cappedAtLimit: true,
    };
  }

  const resolvedVariant =
    selectedVariant ??
    (menuItem.hasVariants &&
    Array.isArray(menuItem.variants) &&
    menuItem.variants.length > 0
      ? menuItem.variants.find((v) => v.stock > 0) ?? menuItem.variants[0]
      : undefined);

  const targetCartItemId = buildCartItemId(
    menuItem.id,
    resolvedVariant?.variantId
  );

  const existingIndex = baseCart.findIndex(
    (c) => getCartEntryKey(c) === targetCartItemId
  );

  const stockCap =
    resolvedVariant !== undefined
      ? Math.max(0, Math.trunc(resolvedVariant.stock))
      : typeof menuItem.stockQuantity === 'number'
      ? Math.max(0, Math.trunc(menuItem.stockQuantity))
      : undefined;

  if (existingIndex >= 0) {
    const existing = baseCart[existingIndex];
    if (stockCap !== undefined && existing.quantity >= stockCap) {
      return {
        cart: baseCart,
        replacedOtherStore: isDifferentStore,
        cappedAtLimit: true,
      };
    }
    baseCart[existingIndex] = {
      ...existing,
      cartItemId: targetCartItemId,
      quantity: existing.quantity + 1,
    };
  } else {
    if (stockCap !== undefined && stockCap <= 0) {
      return {
        cart: baseCart,
        replacedOtherStore: isDifferentStore,
        cappedAtLimit: true,
      };
    }
    if (baseCart.length >= BLUEPRINT_LIMITS.orderItemsMaxDistinct) {
      return {
        cart: baseCart,
        replacedOtherStore: isDifferentStore,
        cappedAtLimit: true,
      };
    }

    const effectivePrice = Math.trunc(
      resolvedVariant ? resolvedVariant.price : menuItem.price
    );

    baseCart.push({
      cartItemId: targetCartItemId,
      storeId: store.id,
      storeName: store.name,
      deliveryFee: Math.trunc(store.deliveryFee),
      item: {
        id: menuItem.id,
        name: menuItem.name,
        price: effectivePrice,
        imageKey: menuItem.imageKey,
        imageUrl: menuItem.imageUrl,
        category: menuItem.category,
        description: menuItem.description,
        stockQuantity: stockCap,
        hasVariants: menuItem.hasVariants,
        variants: menuItem.variants,
      },
      ...(resolvedVariant ? { selectedVariant: resolvedVariant } : {}),
      quantity: 1,
    });
  }

  return {
    cart: baseCart,
    replacedOtherStore: isDifferentStore,
    cappedAtLimit: false,
  };
}

export function updateCartQuantityState(
  currentCart: CartItem[],
  itemIdOrCartKey: string,
  delta: number
): CartItem[] {
  const totalCount = currentCart.reduce((acc, c) => acc + c.quantity, 0);
  if (delta > 0 && totalCount + delta > BLUEPRINT_LIMITS.itemCountMax) {
    return currentCart;
  }

  return currentCart
    .map((entry) => {
      const entryKey = getCartEntryKey(entry);
      if (entryKey !== itemIdOrCartKey && entry.item.id !== itemIdOrCartKey) {
        return entry;
      }
      const maxStock =
        entry.selectedVariant !== undefined
          ? Math.max(0, Math.trunc(entry.selectedVariant.stock))
          : typeof entry.item.stockQuantity === 'number'
          ? Math.max(0, Math.trunc(entry.item.stockQuantity))
          : Infinity;
      const nextQty = Math.min(maxStock, entry.quantity + delta);
      return {
        ...entry,
        quantity: nextQty,
      };
    })
    .filter((entry) => entry.quantity > 0);
}

export function removeItemFromCartState(
  currentCart: CartItem[],
  itemIdOrCartKey: string
): CartItem[] {
  return currentCart.filter(
    (entry) =>
      getCartEntryKey(entry) !== itemIdOrCartKey &&
      entry.item.id !== itemIdOrCartKey
  );
}

export function filterStoresByCategoryAndQuery(
  stores: StoreRecord[],
  category: StoreCategory | 'الكل',
  searchQuery: string
): StoreRecord[] {
  const q = searchQuery.trim().toLowerCase();
  return stores.filter((store) => {
    const matchesCategory = category === 'الكل' || store.category === category;
    if (!matchesCategory) return false;
    if (!q) return true;
    const inName = store.name.toLowerCase().includes(q);
    const inNeighborhood = store.neighborhood.toLowerCase().includes(q);
    const inMenu = store.menuItems.some((m) => m.name.toLowerCase().includes(q));
    return inName || inNeighborhood || inMenu;
  });
}

export function filterProductsByCategoryAndQuery(
  products: ProductRecord[],
  subCategory: string,
  searchQuery: string
): ProductRecord[] {
  const q = searchQuery.trim().toLowerCase();
  return products.filter((prod) => {
    const matchesSub = subCategory === 'الكل' || prod.category === subCategory;
    if (!matchesSub) return false;
    if (!q) return true;
    return (
      prod.name.toLowerCase().includes(q) ||
      prod.description.toLowerCase().includes(q) ||
      prod.category.toLowerCase().includes(q)
    );
  });
}

export function getOrderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case 'awaiting_pharmacy_quote':
      return 'بانتظار تسعير الصيدلية للروشتة';
    case 'awaiting_customer_approval':
      return 'بانتظار موافقة العميل على سعر الروشتة';
    case 'awaiting_courier_quote':
      return 'بانتظار عرض تكلفة المشوار من المندوب';
    case 'awaiting_customer_errand_approval':
      return 'بانتظار موافقتك على تكلفة المشوار';
    case 'pending':
      return 'قيد المراجعة';
    case 'pending_payment':
      return 'بانتظار إتمام الدفع';
    case 'confirmed':
      return 'تم تأكيد الطلب';
    case 'preparing':
      return 'جارٍ التحضير';
    case 'ready':
      return 'جاهز لاستلام مندوب إدكاوي';
    case 'on_the_way':
    case 'delivering':
      return 'مع المندوب في الطريق إليك';
    case 'delivered':
      return 'تم التوصيل';
    case 'cancelled':
      return 'ملغى';
  }
}

export function getPaymentMethodLabel(
  method: PaymentMethod | 'cash_on_delivery'
): string {
  if (method === 'wallet') {
    return 'محفظة إدكاوي';
  }
  if (method === 'visa') {
    return 'بطاقة بنكية';
  }
  return 'نقداً عند الاستلام (كاش)';
}

export function formatArabicCartCount(count: number): string {
  const n = Math.max(0, Math.trunc(count));
  if (n === 0) return 'لا توجد منتجات في السلة';
  if (n === 1) return 'منتج واحد في السلة';
  if (n === 2) return 'منتجان في السلة';
  if (n >= 3 && n <= 10) return `${n} منتجات في السلة`;
  return `${n} منتجاً في السلة`;
}

export function estimateEdkuDistanceKm(
  storeNeighborhood: string,
  customerNeighborhood: string
): number {
  const coords: Record<string, number> = {
    'المعدية': 0,
    'كوم بلاج': 1.4,
    'شارع البحر': 2.1,
    'حي النزهة': 2.8,
    'وسط البلد - السوق': 3.4,
    'حي المحطة': 3.9,
    'كوبري شربت': 4.8,
    'قرية ديبونو': 5.2,
    'منشية دبونو': 5.8,
    'طريق رشيد - إدكو': 5.6,
    'قرى خط رشيد - إدكو': 6.6,
    'قرى بحيرة إدكو': 6.2,
  };

  const s = storeNeighborhood.trim();
  const c = customerNeighborhood.trim();
  if (s === c) return 1.2;

  const posA = coords[s] ?? 2.5;
  const posB = coords[c] ?? 3.8;
  const raw = Math.abs(posA - posB) + 0.9;
  return Number(Math.max(1.2, Math.min(8.5, raw)).toFixed(1));
}

function isSameLocalDay(isoString: string, referenceDate: Date): boolean {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === referenceDate.getFullYear() &&
    d.getMonth() === referenceDate.getMonth() &&
    d.getDate() === referenceDate.getDate()
  );
}

export interface TopSellingProductStat {
  name: string;
  quantitySold: number;
  revenueEgp: number;
}

export interface StoreDashboardStats {
  scopedOrders: OrderRecord[];
  pharmacyQuoteOrders: OrderRecord[];
  awaitingCustomerOrders: OrderRecord[];
  pendingOrders: OrderRecord[];
  preparingOrders: OrderRecord[];
  readyOrders: OrderRecord[];
  outForDeliveryOrders: OrderRecord[];
  deliveredOrders: OrderRecord[];
  storeSalesTotal: number;
  storeCompletedRevenue: number;
  todaySalesTotal: number;
  todayOrdersCount: number;
  todayAverageOrderValue: number;
  topSellingProducts: TopSellingProductStat[];
}

export function calculateStoreDashboardStats(
  orders: OrderRecord[],
  storeId: string | 'all',
  referenceDate: Date = new Date()
): StoreDashboardStats {
  const scopedOrders =
    storeId === 'all' ? orders : orders.filter((o) => o.storeId === storeId);

  const pharmacyQuoteOrders = scopedOrders.filter(
    (o) => o.status === 'awaiting_pharmacy_quote'
  );
  const awaitingCustomerOrders = scopedOrders.filter(
    (o) => o.status === 'awaiting_customer_approval'
  );
  const pendingOrders = scopedOrders.filter(
    (o) => o.status === 'pending' || o.status === 'confirmed'
  );
  const preparingOrders = scopedOrders.filter((o) => o.status === 'preparing');
  const readyOrders = scopedOrders.filter((o) => o.status === 'ready');
  const outForDeliveryOrders = scopedOrders.filter(
    (o) => o.status === 'on_the_way' || o.status === 'delivering'
  );
  const deliveredOrders = scopedOrders.filter((o) => o.status === 'delivered');

  const nonCancelled = scopedOrders.filter((o) => o.status !== 'cancelled');
  const storeSalesTotal = nonCancelled.reduce((sum, o) => sum + o.subtotal, 0);

  const storeCompletedRevenue = deliveredOrders.reduce(
    (sum, o) => sum + o.subtotal,
    0
  );

  const todayValidOrders = nonCancelled.filter((o) =>
    isSameLocalDay(o.createdAtIso, referenceDate)
  );
  const todayOrdersCount = todayValidOrders.length;
  const todaySalesTotal = todayValidOrders.reduce(
    (sum, o) => sum + o.totalAmount,
    0
  );
  const todayAverageOrderValue =
    todayOrdersCount > 0 ? Math.round(todaySalesTotal / todayOrdersCount) : 0;

  const productSalesMap = new Map<string, TopSellingProductStat>();
  for (const order of nonCancelled) {
    for (const item of order.items) {
      const key = item.name.trim() || item.productId;
      if (!key) continue;
      const prev = productSalesMap.get(key) ?? {
        name: item.name || 'منتج',
        quantitySold: 0,
        revenueEgp: 0,
      };
      prev.quantitySold += Math.max(1, item.quantity);
      prev.revenueEgp += Math.max(0, item.price * item.quantity);
      productSalesMap.set(key, prev);
    }
  }
  const topSellingProducts = Array.from(productSalesMap.values())
    .sort((a, b) => b.quantitySold - a.quantitySold || b.revenueEgp - a.revenueEgp)
    .slice(0, 3);

  return {
    scopedOrders,
    pharmacyQuoteOrders,
    awaitingCustomerOrders,
    pendingOrders,
    preparingOrders,
    readyOrders,
    outForDeliveryOrders,
    deliveredOrders,
    storeSalesTotal,
    storeCompletedRevenue,
    todaySalesTotal,
    todayOrdersCount,
    todayAverageOrderValue,
    topSellingProducts,
  };
}

export interface AdminDashboardStats {
  totalSalesEgp: number;
  deliveredRevenueEgp: number;
  totalOrdersCount: number;
  activeOrdersCount: number;
  pendingCount: number;
  preparingCount: number;
  onTheWayCount: number;
  deliveredCount: number;
  cancelledCount: number;
  availableCouriersCount: number;
  pendingCouriersCount: number;
  approvedCouriersCount: number;
  totalCouriersCount: number;
  activeStoresCount: number;
  pausedStoresCount: number;
}

export function calculateAdminDashboardStats(
  orders: OrderRecord[],
  stores: StoreRecord[],
  couriers: CourierRecord[]
): AdminDashboardStats {
  let totalSalesEgp = 0;
  let deliveredRevenueEgp = 0;
  let pendingCount = 0;
  let preparingCount = 0;
  let onTheWayCount = 0;
  let deliveredCount = 0;
  let cancelledCount = 0;

  for (const order of orders) {
    if (order.status !== 'cancelled') {
      totalSalesEgp += order.totalAmount;
    }
    if (
      order.status === 'pending' ||
      order.status === 'confirmed' ||
      order.status === 'pending_payment' ||
      order.status === 'awaiting_pharmacy_quote' ||
      order.status === 'awaiting_customer_approval' ||
      order.status === 'awaiting_courier_quote' ||
      order.status === 'awaiting_customer_errand_approval'
    ) {
      pendingCount += 1;
    } else if (order.status === 'preparing' || order.status === 'ready') {
      preparingCount += 1;
    } else if (order.status === 'on_the_way' || order.status === 'delivering') {
      onTheWayCount += 1;
    } else if (order.status === 'delivered') {
      deliveredCount += 1;
      deliveredRevenueEgp += order.totalAmount;
    } else if (order.status === 'cancelled') {
      cancelledCount += 1;
    }
  }

  const activeOrdersCount = pendingCount + preparingCount + onTheWayCount;
  const approvedCouriersCount = couriers.filter(
    (c) => c.approvalStatus === 'approved'
  ).length;
  const pendingCouriersCount = couriers.filter(
    (c) => c.approvalStatus === 'pending'
  ).length;
  const availableCouriersCount = couriers.filter(
    (c) => c.approvalStatus === 'approved' && c.isAvailable
  ).length;
  const activeStoresCount = stores.filter((s) => s.isActive).length;
  const pausedStoresCount = stores.filter((s) => !s.isActive).length;

  return {
    totalSalesEgp,
    deliveredRevenueEgp,
    totalOrdersCount: orders.length,
    activeOrdersCount,
    pendingCount,
    preparingCount,
    onTheWayCount,
    deliveredCount,
    cancelledCount,
    availableCouriersCount,
    pendingCouriersCount,
    approvedCouriersCount,
    totalCouriersCount: couriers.length,
    activeStoresCount,
    pausedStoresCount,
  };
}

export function formatAppErrorMessage(
  error: unknown,
  fallbackMessage = 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.'
): string {
  if (!error) return fallbackMessage;

  let rawMessage = '';
  if (error instanceof Error) {
    rawMessage = error.message || '';
  } else if (typeof error === 'string') {
    rawMessage = error;
  } else {
    try {
      rawMessage = JSON.stringify(error);
    } catch {
      rawMessage = String(error);
    }
  }

  const trimmed = rawMessage.trim();
  if (!trimmed) return fallbackMessage;

  let extractedMessage = trimmed;
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as { error?: unknown };
      if (parsed && typeof parsed.error === 'string' && parsed.error.trim()) {
        extractedMessage = parsed.error.trim();
      }
    } catch {
      // keep raw
    }
  }

  const lower = extractedMessage.toLowerCase();

  if (
    lower.includes('client is offline') ||
    lower.includes('failed to get document because the client is offline') ||
    lower.includes('could not reach cloud firestore') ||
    lower.includes('unavailable') ||
    lower.includes('network-request-failed') ||
    lower.includes('network error')
  ) {
    return 'جارٍ استعادة الاتصال بقاعدة البيانات... يرجى الانتظار لحظة ثم المحاولة مرة أخرى.';
  }

  if (
    lower.includes('missing or insufficient permissions') ||
    lower.includes('permission-denied') ||
    lower.includes('permission_denied') ||
    lower.includes('insufficient permissions')
  ) {
    return 'تعذر تنفيذ العملية حالياً بسبب صلاحيات الحساب أو تحديث حالة الطلب من طرف آخر.';
  }

  if (lower.includes('quota exceeded') || lower.includes('resource-exhausted')) {
    return 'تم الوصول للحد اليومي المجاني لقاعدة البيانات، وسيتم تجديد الحصة تلقائياً غداً.';
  }

  if (lower.includes('not-found') || lower.includes('no document to update')) {
    return 'لم يتم العثور على السجل المطلوب أو تم حذفه مؤخراً.';
  }

  if (/[\u0600-\u06FF]/.test(extractedMessage) && !extractedMessage.startsWith('{')) {
    return extractedMessage;
  }

  return fallbackMessage;
}

export function validateCompleteProfileForm(
  input: CompleteProfileInput
): string | null {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) {
    return 'يرجى إدخال الاسم بالكامل (من حرفين إلى ٨٠ حرفاً).';
  }
  const phone = normalizeEgyptPhoneOrEmpty(input.phone);
  if (!EGYPT_PHONE_REGEX.test(phone)) {
    return 'يرجى إدخال رقم موبايل مصري صحيح مكون من ١١ رقماً (مثال: 01012345678).';
  }
  const neighborhood = input.defaultNeighborhood.trim();
  if (neighborhood.length < 2 || neighborhood.length > 80) {
    return 'يرجى تحديد موقعك الافتراضي على خريطة إدكو.';
  }
  const address = input.defaultAddress.trim();
  if (address.length < 4 || address.length > 200) {
    return 'يرجى تحديد الموقع على الخريطة أو كتابة علامة مميزة للعنوان.';
  }
  if (
    typeof input.defaultLat !== 'number' ||
    typeof input.defaultLng !== 'number' ||
    !Number.isFinite(input.defaultLat) ||
    !Number.isFinite(input.defaultLng)
  ) {
    return 'يرجى الضغط على الخريطة لتثبيت موقعك في مدينة إدكو.';
  }
  if (!isWithinEdkuServiceBounds(input.defaultLat, input.defaultLng)) {
    return 'نطاق الخدمة متاح داخل مدينة إدكو والقرى المجاورة فقط.';
  }
  return null;
}

export function validateReviewForm(input: ReviewSubmitInput): string | null {
  if (!Number.isInteger(input.storeRating) || input.storeRating < 1 || input.storeRating > 5) {
    return 'يرجى اختيار تقييم المتجر من ١ إلى ٥ نجوم.';
  }
  if (
    input.courierId &&
    input.courierRating !== undefined &&
    (!Number.isInteger(input.courierRating) ||
      input.courierRating < 1 ||
      input.courierRating > 5)
  ) {
    return 'يرجى اختيار تقييم المندوب من ١ إلى ٥ نجوم.';
  }
  if ((input.comment || '').trim().length > 300) {
    return 'التعليق الاختياري يجب ألا يتجاوز ٣٠٠ حرف.';
  }
  return null;
}

export function validateCouponForm(input: CouponInput): string | null {
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9_\-]{2,32}$/.test(code)) {
    return 'كود الخصم يجب أن يتكون من حروف إنجليزية وأرقام فقط (مثال: EDKAWY25).';
  }
  if (input.discountPercent < 1 || input.discountPercent > 90) {
    return 'نسبة الخصم يجب أن تكون بين 1% و 90%.';
  }
  if (input.maxDiscountEgp < 5 || input.maxDiscountEgp > 5000) {
    return 'الحد الأقصى للخصم يجب أن يكون بين 5 و 5000 ج.م.';
  }
  if (input.minOrderEgp < 0 || input.minOrderEgp > 10000) {
    return 'الحد الأدنى للطلب يجب أن يكون بين 0 و 10000 ج.م.';
  }
  if (input.description.trim().length < 2 || input.description.trim().length > 140) {
    return 'يرجى إدخال وصف مختصر للكوبون.';
  }
  return null;
}

export function validateAdBannerForm(input: AdBannerInput): string | null {
  if (input.title.trim().length < 2 || input.title.trim().length > 90) {
    return 'يرجى إدخال عنوان الإعلان (من حرفين إلى ٩٠ حرفاً).';
  }
  if (input.subtitle.trim().length < 2 || input.subtitle.trim().length > 180) {
    return 'يرجى إدخال النص الفرعي للإعلان (حتى ١٨٠ حرفاً).';
  }
  if (input.badgeText.trim().length < 2 || input.badgeText.trim().length > 40) {
    return 'يرجى إدخال شارة العرض (مثال: عرض حصري).';
  }
  if (!isValidUploadedImageUrl(input.imageUrl)) {
    return 'يرجى رفع صورة البانر الإعلاني من جهازك.';
  }
  return null;
}

export function validateCampaignForm(input: CampaignInput): string | null {
  if (input.title.trim().length < 2 || input.title.trim().length > 90) {
    return 'يرجى إدخال عنوان الفعالية (من حرفين إلى ٩٠ حرفاً).';
  }
  if (input.subtitle.trim().length < 2 || input.subtitle.trim().length > 180) {
    return 'يرجى كتابة وصف مختصر للفعالية (من حرفين إلى ١٨٠ حرفاً).';
  }
  if (input.badgeText.trim().length < 2 || input.badgeText.trim().length > 40) {
    return 'يرجى إدخال شارة الفعالية (مثال: ضعف النقاط).';
  }
  if (!isValidUploadedImageUrl(input.imageUrl)) {
    return 'يرجى رفع صورة بانر الفعالية من جهازك.';
  }
  if (
    input.multiplier !== undefined &&
    (input.multiplier < 1 || input.multiplier > 10)
  ) {
    return 'مضاعف النقاط يجب أن يكون بين 1 و 10.';
  }
  return null;
}

export function validateSupportTicketForm(
  input: CreateSupportTicketInput
): string | null {
  const subj = input.subject.trim();
  const det = input.details.trim();
  if (subj.length < 3 || subj.length > 100) {
    return 'يرجى كتابة عنوان واضح للتذكرة (من ٣ إلى ١٠٠ حرف).';
  }
  if (!['طلب', 'دفع', 'مشكلة تقنية', 'أخرى'].includes(input.category)) {
    return 'يرجى اختيار نوع المشكلة من القائمة.';
  }
  if (det.length < 6 || det.length > 1000) {
    return 'يرجى كتابة تفاصيل المشكلة بوضوح (من ٦ إلى ١٠٠٠ حرف).';
  }
  return null;
}

export function validateStaffMemberForm(
  input: CreateStaffMemberInput
): string | null {
  if (input.name.trim().length < 2 || input.name.trim().length > 80) {
    return 'يرجى إدخال اسم الموظف (من حرفين إلى ٨٠ حرفاً).';
  }
  const email = input.email.trim().toLowerCase();
  if (
    email.length < 5 ||
    email.length > 100 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return 'يرجى إدخال بريد إلكتروني صحيح للموظف.';
  }
  if (input.password.length < 6 || input.password.length > 64) {
    return 'كلمة المرور يجب أن تكون ٦ أحرف أو أرقام على الأقل.';
  }
  if (!['super_admin', 'support_agent', 'operations'].includes(input.role)) {
    return 'يرجى اختيار صلاحية صحيحة لعضو الفريق.';
  }
  return null;
}

export function validateCustomErrandInput(
  input: CustomErrandOrderInput
): string | null {
  if (input.customerName.trim().length < 2) {
    return 'يرجى إدخال الاسم بالكامل (حرفين على الأقل).';
  }
  const phone = normalizeEgyptPhoneOrEmpty(input.customerPhone);
  if (!EGYPT_PHONE_REGEX.test(phone)) {
    return 'يرجى إدخال رقم موبايل مصري صحيح (١١ رقماً يبدأ بـ 01).';
  }
  if (
    input.errandDescription.trim().length < 5 ||
    input.errandDescription.trim().length > 400
  ) {
    return 'يرجى كتابة تفاصيل المشوار أو الطلب المطلوب بوضوح (٥ أحرف على الأقل).';
  }
  if (
    input.errandPickupAddress.trim().length < 3 ||
    input.errandPickupAddress.trim().length > 180
  ) {
    return 'يرجى تحديد مكان الاستلام أو المنطقة التي سيذهب إليها المندوب.';
  }
  if (input.deliveryAddress.trim().length < 4) {
    return 'يرجى تحديد عنوان التسليم على خريطة إدكو.';
  }
  if (!isWithinEdkuServiceBounds(input.customerLat, input.customerLng)) {
    return 'خدمة المشاوير متاحة داخل حدود مدينة إدكو والقرى المجاورة فقط.';
  }
  return null;
}

export const CUSTOMER_CODE_REGEX = /^EDK-USR-[0-9]{4}$/;

export function isValidCustomerCodeFormat(code: unknown): code is string {
  return typeof code === 'string' && CUSTOMER_CODE_REGEX.test(code.trim());
}

export function generateUniqueCustomerCode(
  existingCodes?: ReadonlySet<string>
): string {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const randomFourDigits = Math.floor(1000 + Math.random() * 9000);
    const candidate = `EDK-USR-${randomFourDigits}`;
    if (!existingCodes || !existingCodes.has(candidate)) {
      return candidate;
    }
  }
  const fallbackFourDigits = String(1000 + (Date.now() % 9000)).slice(-4);
  return `EDK-USR-${fallbackFourDigits}`;
}

export function getAuditActionLabelAr(actionType: AuditActionType): string {
  switch (actionType) {
    case 'ban_customer':
      return 'حظر عميل';
    case 'unban_customer':
      return 'إلغاء حظر عميل';
    case 'block_entity':
      return 'إيقاف حساب / متجر';
    case 'unblock_entity':
      return 'رفع إيقاف حساب / متجر';
    case 'update_delivery_fee':
      return 'تعديل سعر توصيل متجر / منطقة';
    case 'update_zone_price':
      return 'تعديل تسعير منطقة توصيل بإدكو';
    case 'manage_category':
      return 'إدارة قسم من أقسام التطبيق';
    case 'approve_store':
      return 'تفعيل وقبول متجر';
    case 'toggle_store_active':
      return 'تغيير حالة نشاط متجر';
    case 'approve_courier':
      return 'اعتماد مندوب توصيل';
    case 'delete_product':
      return 'حذف منتج';
    case 'delete_ad_banner':
      return 'حذف بانر إعلاني';
    case 'delete_coupon':
      return 'حذف كوبون خصم';
    case 'delete_campaign':
      return 'حذف حملة تسويقية';
    case 'send_notification':
      return 'إرسال إشعار إداري';
    case 'toggle_maintenance':
      return 'تحديث وضع الصيانة';
    case 'gift_points':
      return 'إهداء نقاط ولاء';
    case 'purge_test_data':
      return 'مسح بيانات الاختبار';
    case 'create_invitation':
      return 'إنشاء وإرسال دعوة تسجيل';
    case 'manage_sales_agent':
      return 'إدارة حساب / عمولة مسؤول مبيعات';
    case 'handle_payout':
      return 'مراجعة طلب سحب أرباح';
    case 'update_user_email':
      return 'تحديث البريد الإلكتروني لحساب';
    case 'reset_user_password':
      return 'إرسال رابط استعادة كلمة المرور';
    case 'approve_wallet_topup':
      return 'اعتماد طلب شحن محفظة عميل';
    case 'reject_wallet_topup':
      return 'رفض طلب شحن محفظة عميل';
    case 'update_system_settings':
      return 'تحديث إعدادات الدفع والتشغيل بالمنصة';
    case 'update_store_commission':
      return 'تعديل نسبة عمولة مطعم / متجر';
    case 'update_store_details':
      return 'تحديث بيانات متجر من الإدارة';
    case 'treasury_handover':
      return 'توريد نقدية من مندوب إلى خزينة إدكاوي';
    case 'pay_courier_dues':
      return 'صرف مستحقات مندوب توصيل';
    case 'settle_restaurant':
      return 'صرف تسوية يومية لمطعم / متجر';
    case 'resolve_financial_exception':
      return 'مراجعة وحسم حالة مالية استثنائية';
    default:
      return 'عملية إدارية';
  }
}

export const REFERRAL_CODE_REGEX = /^AGENT-[A-Z0-9]{4,8}$/;

export function generateCustomerReferralCode(seed?: string): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  if (seed && seed.length >= 4) {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i += 1) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    for (let i = 0; i < 4; i += 1) {
      suffix += alphabet[(h >>> (i * 5)) % alphabet.length];
    }
  } else {
    for (let i = 0; i < 4; i += 1) {
      suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
  }
  return `EDK-REF-${suffix}`;
}

export function generateSalesAgentReferralCode(
  existingCodes?: ReadonlySet<string>
): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 60; attempt += 1) {
    let suffix = '';
    for (let i = 0; i < 4; i += 1) {
      suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    const candidate = `AGENT-${suffix}`;
    if (!existingCodes || !existingCodes.has(candidate)) {
      return candidate;
    }
  }
  return `AGENT-${String(1000 + (Date.now() % 9000)).slice(-4)}`;
}

export function isEdkuWaterCoordinate(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  // North into Mediterranean Sea beyond Edku coastline
  if (lat > 31.331) return true;
  // Open water basin of Lake Edku southwest of Edku urban area
  if (lat < 31.268 && lng < 30.285 && lat > 31.19 && lng > 30.14) return true;
  return false;
}

export const GOOGLE_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.edkawy.app';

export function shouldShowGooglePlayReviewPrompt(params: {
  customerOrders: readonly OrderRecord[];
  accountCreatedAtIso?: string;
  lastReviewPromptAtIso?: string;
  nowMs?: number;
}): boolean {
  const now = params.nowMs ?? Date.now();
  const realOrders = params.customerOrders.filter((o) => !o.isTestSimulation);
  const deliveredCount = realOrders.filter((o) => o.status === 'delivered').length;
  if (deliveredCount < 3) return false;

  // Account must be >= 7 days old
  if (!params.accountCreatedAtIso) return false;
  const createdMs = Date.parse(params.accountCreatedAtIso);
  if (!Number.isFinite(createdMs) || now - createdMs < 7 * 24 * 60 * 60 * 1000) {
    return false;
  }

  // Never show right after a cancelled/problematic order
  const sortedOrders = [...realOrders].sort((a, b) =>
    (b.createdAtIso || '').localeCompare(a.createdAtIso || '')
  );
  if (sortedOrders[0]?.status === 'cancelled') {
    return false;
  }

  // At most once every 90 days
  if (params.lastReviewPromptAtIso) {
    const lastShownMs = Date.parse(params.lastReviewPromptAtIso);
    if (Number.isFinite(lastShownMs) && now - lastShownMs < 90 * 24 * 60 * 60 * 1000) {
      return false;
    }
  }

  return true;
}

export function filterAdminCustomers<
  T extends CustomerDirectoryEntry & { phone?: string; email?: string }
>(customers: readonly T[], searchQuery: string): T[] {
  const rawQuery = searchQuery.trim();
  if (!rawQuery) {
    return [...customers];
  }
  const normalizedLower = rawQuery.toLowerCase();
  const normalizedDigits = normalizeEgyptPhoneOrEmpty(rawQuery);
  const rawAsciiDigits = rawQuery.replace(/[٠-٩]/g, (d) =>
    String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))
  );

  return customers.filter((customer) => {
    const nameMatch = (customer.name ?? '')
      .toLowerCase()
      .includes(normalizedLower);
    const codeMatch = (customer.customerCode ?? '')
      .toLowerCase()
      .includes(rawAsciiDigits.toLowerCase());
    const rawPhone = customer.phone ?? '';
    const phoneMatch =
      (rawPhone && rawPhone.includes(rawAsciiDigits)) ||
      (normalizedDigits.length >= 3 &&
        normalizeEgyptPhoneOrEmpty(rawPhone).includes(normalizedDigits));
    const emailMatch = (customer.email ?? '')
      .toLowerCase()
      .includes(normalizedLower);
    return Boolean(nameMatch || codeMatch || phoneMatch || emailMatch);
  });
}

export function computeFraudDetectionAlerts(params: {
  orders: readonly OrderRecord[];
  customers: readonly (CustomerDirectoryEntry & { phone?: string })[];
  couriers: readonly CourierRecord[];
  blockedEntityIds?: ReadonlySet<string>;
}): FraudAlertRecord[] {
  const { orders, customers, couriers, blockedEntityIds } = params;
  const realOrders = orders.filter((o) => !o.isTestSimulation);

  const customerMap = new Map<
    string,
    CustomerDirectoryEntry & { phone?: string }
  >();
  for (const c of customers) {
    customerMap.set(c.uid, c);
  }

  const alerts: FraudAlertRecord[] = [];

  // Group customer orders for Rule 1 (>3 cancellations in one day) & Rule 2 (consecutive orders < 60s)
  const ordersByCustomer = new Map<string, OrderRecord[]>();
  for (const order of realOrders) {
    if (!order.customerId) continue;
    const list = ordersByCustomer.get(order.customerId) ?? [];
    list.push(order);
    ordersByCustomer.set(order.customerId, list);
  }

  for (const [customerId, customerOrders] of ordersByCustomer.entries()) {
    const customerEntry = customerMap.get(customerId);
    const fallbackOrder = customerOrders[0];
    const personName =
      customerEntry?.name?.trim() ||
      fallbackOrder?.customerName?.trim() ||
      'عميل إدكاوي';
    const phone =
      customerEntry?.phone?.trim() ||
      fallbackOrder?.customerPhone?.trim() ||
      'غير متوفر';
    const customerCode = customerEntry?.customerCode?.trim() || 'غير مسجل';
    const isBanned = Boolean(
      customerEntry?.isBanned || blockedEntityIds?.has(customerId)
    );

    // Rule 1: Cancelled > 3 orders on the same calendar day
    const cancelledByDay = new Map<
      string,
      { count: number; latestIso: string }
    >();
    for (const ord of customerOrders) {
      if (ord.status !== 'cancelled') continue;
      const dayKey = (ord.createdAtIso || '').slice(0, 10) || 'unknown-day';
      const prev = cancelledByDay.get(dayKey);
      const latestIso =
        !prev || ord.createdAtIso > prev.latestIso
          ? ord.createdAtIso
          : prev.latestIso;
      cancelledByDay.set(dayKey, {
        count: (prev?.count ?? 0) + 1,
        latestIso,
      });
    }

    let maxDailyCancelled = 0;
    let worstDayKey = '';
    let latestCancelIso = '';
    for (const [dayKey, stats] of cancelledByDay.entries()) {
      if (stats.count > maxDailyCancelled) {
        maxDailyCancelled = stats.count;
        worstDayKey = dayKey;
        latestCancelIso = stats.latestIso;
      }
    }

    if (maxDailyCancelled > 3) {
      alerts.push({
        id: `fraud_cancel_${customerId}_${worstDayKey}`,
        entityType: 'customer',
        entityId: customerId,
        personName,
        phone,
        customerCode,
        violationType: 'excessive_daily_cancellations',
        violationLabelAr: 'إلغاء أكثر من ٣ طلبات في يوم واحد',
        detailsAr: `قام العميل بإلغاء ${maxDailyCancelled} طلبات خلال يوم (${worstDayKey}).`,
        occurrencesCount: maxDailyCancelled,
        severity: 'high',
        detectedAtIso: latestCancelIso || new Date().toISOString(),
        isBanned,
      });
    }

    // Rule 2: Consecutive orders placed < 1 minute (60,000 ms) apart
    const sortedWithTime = customerOrders
      .map((o) => ({
        order: o,
        ts: Date.parse(o.createdAtIso),
      }))
      .filter((item) => Number.isFinite(item.ts))
      .sort((a, b) => a.ts - b.ts);

    let rapidBurstsCount = 0;
    let minDeltaSeconds = Number.POSITIVE_INFINITY;
    let latestRapidIso = '';

    for (let i = 1; i < sortedWithTime.length; i += 1) {
      const deltaMs = sortedWithTime[i].ts - sortedWithTime[i - 1].ts;
      if (deltaMs >= 0 && deltaMs < 60_000) {
        rapidBurstsCount += 1;
        const sec = Math.max(1, Math.round(deltaMs / 1000));
        if (sec < minDeltaSeconds) {
          minDeltaSeconds = sec;
        }
        latestRapidIso = sortedWithTime[i].order.createdAtIso;
      }
    }

    if (rapidBurstsCount >= 1) {
      alerts.push({
        id: `fraud_rapid_${customerId}`,
        entityType: 'customer',
        entityId: customerId,
        personName,
        phone,
        customerCode,
        violationType: 'rapid_consecutive_orders',
        violationLabelAr: 'طلبات متتالية في أقل من دقيقة',
        detailsAr: `تم رصد ${rapidBurstsCount + 1} طلبات متتالية بفاصل زمني ${minDeltaSeconds} ثانية فقط.`,
        occurrencesCount: rapidBurstsCount + 1,
        severity: rapidBurstsCount >= 2 ? 'high' : 'medium',
        detectedAtIso: latestRapidIso || new Date().toISOString(),
        isBanned,
      });
    }
  }

  // Rule 3: Courier accepts orders and repeatedly cancels/releases them (>= 2 times)
  const orderReleasesByCourier = new Map<
    string,
    { count: number; latestIso: string }
  >();
  for (const ord of realOrders) {
    if (!Array.isArray(ord.cancelledByCourierIds)) continue;
    for (const cId of ord.cancelledByCourierIds) {
      if (!cId) continue;
      const prev = orderReleasesByCourier.get(cId);
      const latestIso =
        !prev || (ord.updatedAtIso || ord.createdAtIso) > prev.latestIso
          ? ord.updatedAtIso || ord.createdAtIso
          : prev.latestIso;
      orderReleasesByCourier.set(cId, {
        count: (prev?.count ?? 0) + 1,
        latestIso,
      });
    }
  }

  const allCourierIds = new Set<string>([
    ...couriers.map((c) => c.id),
    ...orderReleasesByCourier.keys(),
  ]);

  const courierById = new Map<string, CourierRecord>();
  for (const c of couriers) {
    courierById.set(c.id, c);
  }

  for (const courierId of allCourierIds) {
    const courierRec = courierById.get(courierId);
    const fromOrders = orderReleasesByCourier.get(courierId);
    const totalCancelledByCourier = Math.max(
      courierRec?.cancelledDeliveries ?? 0,
      fromOrders?.count ?? 0
    );

    if (totalCancelledByCourier >= 2) {
      const isBanned = Boolean(blockedEntityIds?.has(courierId));
      alerts.push({
        id: `fraud_courier_cancel_${courierId}`,
        entityType: 'courier',
        entityId: courierId,
        personName: courierRec?.name?.trim() || 'مندوب توصيل',
        phone: courierRec?.phone?.trim() || 'غير متوفر',
        customerCode: `EDK-DRV-${courierId.slice(0, 4).toUpperCase()}`,
        violationType: 'courier_repeated_cancellations',
        violationLabelAr: 'قبول طلبات ثم إلغاؤها بشكل متكرر',
        detailsAr: `قام المندوب بقبول ثم إلغاء/ترك ${totalCancelledByCourier} طلبات توصيل بعد استلامها.`,
        occurrencesCount: totalCancelledByCourier,
        severity: totalCancelledByCourier >= 3 ? 'high' : 'medium',
        detectedAtIso:
          fromOrders?.latestIso ||
          courierRec?.updatedAtIso ||
          new Date().toISOString(),
        isBanned,
      });
    }
  }

  return alerts.sort((a, b) =>
    (b.detectedAtIso || '').localeCompare(a.detectedAtIso || '')
  );
}

/* ============================================================================
 * EDKAWY FINANCIAL ENGINE (86% STORE / 14% EDKAWY / 100% COURIER >= 15 EGP)
 * ========================================================================== */

export interface OrderFinancialSplit {
  subtotal: number;
  deliveryFee: number;
  commissionRate: number;
  commissionAmount: number;
  restaurantNet: number;
  courierEarning: number;
  courierDeliveryCompensation: number;
  freeDeliveryFundedByEdkawy: boolean;
  customerTotal: number;
  isBalanced: boolean;
}

export function normalizeCommissionRate(rawRate?: number): number {
  if (typeof rawRate !== 'number' || !Number.isFinite(rawRate)) {
    return DEFAULT_EDKAWY_COMMISSION_RATE;
  }
  const normalized = rawRate > 1 ? rawRate / 100 : rawRate;
  return Number(Math.min(0.5, Math.max(0, normalized)).toFixed(4));
}

export function calculateOrderFinancialSplit(params: {
  subtotal: number;
  deliveryFee: number;
  smallOrderFee?: number;
  discountAmount?: number;
  commissionRate?: number;
  courierDeliveryCompensation?: number;
  freeDeliveryFundedByEdkawy?: boolean;
  isFreeDeliveryReward?: boolean;
  freeDeliveryBaseFee?: number;
}): OrderFinancialSplit {
  const subtotal = Math.max(0, Math.round(Number(params.subtotal || 0) * 100) / 100);
  const deliveryFee = Math.max(
    0,
    Math.round(Number(params.deliveryFee || 0) * 100) / 100
  );
  const smallOrderFee = Math.max(
    0,
    Math.round(Number(params.smallOrderFee || 0) * 100) / 100
  );
  const discountAmount = Math.max(
    0,
    Math.round(Number(params.discountAmount || 0) * 100) / 100
  );
  const commissionRate = normalizeCommissionRate(params.commissionRate);
  const commissionAmount =
    Math.round(subtotal * commissionRate * 100) / 100;
  const restaurantNet =
    Math.round((subtotal - commissionAmount) * 100) / 100;

  const freeDeliveryFundedByEdkawy = Boolean(
    params.freeDeliveryFundedByEdkawy || params.isFreeDeliveryReward
  );

  const courierDeliveryCompensation =
    typeof params.courierDeliveryCompensation === 'number' &&
    params.courierDeliveryCompensation > 0
      ? Math.max(
          MIN_COURIER_DELIVERY_FEE_EGP,
          Math.round(params.courierDeliveryCompensation * 100) / 100
        )
      : freeDeliveryFundedByEdkawy
      ? Math.max(
          MIN_COURIER_DELIVERY_FEE_EGP,
          Math.round(Number(params.freeDeliveryBaseFee || 0) * 100) / 100
        )
      : deliveryFee;

  const customerTotal =
    Math.round(
      (Math.max(0, subtotal - discountAmount) + deliveryFee + smallOrderFee) *
        100
    ) / 100;

  const splitSum =
    Math.round((restaurantNet + commissionAmount + deliveryFee) * 100) / 100;
  const standardTotal = Math.round((subtotal + deliveryFee) * 100) / 100;

  return {
    subtotal,
    deliveryFee,
    commissionRate,
    commissionAmount,
    restaurantNet,
    courierEarning: courierDeliveryCompensation,
    courierDeliveryCompensation,
    freeDeliveryFundedByEdkawy,
    customerTotal,
    isBalanced: Math.abs(splitSum - standardTotal) < 0.02,
  };
}

export function getOrderFinancialSnapshot(
  order: OrderRecord,
  fallbackStoreCommissionRate = DEFAULT_EDKAWY_COMMISSION_RATE
): OrderFinancialSplit {
  const rate = normalizeCommissionRate(
    order.commissionRate ?? fallbackStoreCommissionRate
  );
  const subtotal = Math.max(0, Number(order.subtotal || 0));
  const deliveryFee = Math.max(0, Number(order.deliveryFee || 0));
  const freeDeliveryFundedByEdkawy = Boolean(order.freeDeliveryFundedByEdkawy);

  if (
    typeof order.commissionAmount === 'number' &&
    typeof order.restaurantNet === 'number'
  ) {
    const commissionAmount = Math.round(order.commissionAmount * 100) / 100;
    const restaurantNet = Math.round(order.restaurantNet * 100) / 100;
    const courierDeliveryCompensation =
      typeof order.courierDeliveryCompensation === 'number' &&
      order.courierDeliveryCompensation > 0
        ? order.courierDeliveryCompensation
        : freeDeliveryFundedByEdkawy
        ? MIN_COURIER_DELIVERY_FEE_EGP
        : deliveryFee;
    return {
      subtotal,
      deliveryFee,
      commissionRate: rate,
      commissionAmount,
      restaurantNet,
      courierEarning: courierDeliveryCompensation,
      courierDeliveryCompensation,
      freeDeliveryFundedByEdkawy,
      customerTotal: Number(order.totalAmount || subtotal + deliveryFee),
      isBalanced:
        Math.abs(restaurantNet + commissionAmount - subtotal) < 0.02,
    };
  }

  return calculateOrderFinancialSplit({
    subtotal,
    deliveryFee,
    smallOrderFee: order.smallOrderFee,
    discountAmount: order.discountAmount,
    commissionRate: rate,
    courierDeliveryCompensation: order.courierDeliveryCompensation,
    freeDeliveryFundedByEdkawy,
  });
}

export function getCairoDateKey(dateInput?: string | Date): string {
  try {
    const d =
      dateInput instanceof Date
        ? dateInput
        : dateInput
        ? new Date(dateInput)
        : new Date();
    if (Number.isNaN(d.getTime())) {
      return new Date().toISOString().slice(0, 10);
    }
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const y = parts.find((p) => p.type === 'year')?.value ?? '2026';
    const m = parts.find((p) => p.type === 'month')?.value ?? '01';
    const day = parts.find((p) => p.type === 'day')?.value ?? '01';
    return `${y}-${m}-${day}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function getFinancialExceptionTypeLabelAr(
  type: FinancialExceptionType
): string {
  switch (type) {
    case 'cancelled_before_prep':
      return 'إلغاء قبل التحضير';
    case 'store_rejected':
      return 'رفض المطعم بعد الطلب';
    case 'customer_refused_door':
      return 'رفض العميل عند الاستلام';
    case 'courier_failed_delivery':
      return 'فشل التوصيل من طرف المندوب';
    case 'cash_shortage':
      return 'عجز نقدي عند المندوب';
    case 'wrong_order':
      return 'طلب خاطئ أو ناقص';
    default:
      return 'حالة استثنائية';
  }
}

export function getSettlementStatusLabelAr(
  status: RestaurantSettlementStatus
): string {
  switch (status) {
    case 'paid':
      return 'مدفوعة';
    case 'disputed':
      return 'معلّقة للمراجعة';
    default:
      return 'قيد المراجعة';
  }
}

export function calculateFounderFinancialKpis(params: {
  orders: readonly OrderRecord[];
  stores: readonly StoreRecord[];
  wallets: readonly DriverWalletRecord[];
  transactions?: readonly FinancialTransactionRecord[];
  receipts: readonly TreasuryReceiptRecord[];
  settlements: readonly RestaurantSettlementRecord[];
  exceptions: readonly FinancialExceptionRecord[];
}): FounderFinancialKpis {
  const realOrders = params.orders.filter((o) => !o.isTestSimulation);
  const storeRateMap = new Map<string, number>();
  for (const s of params.stores) {
    storeRateMap.set(s.id, normalizeCommissionRate(s.commissionRate));
  }

  let totalStoreSales = 0;
  let totalEdkawyCommissions = 0;
  let totalDeliveryFees = 0;
  let deliveredOrdersCount = 0;
  let cancelledOrdersCount = 0;
  let totalDeliveredNetPayable = 0;

  for (const order of realOrders) {
    if (order.status === 'cancelled') {
      cancelledOrdersCount += 1;
      continue;
    }
    if (order.status === 'delivered') {
      deliveredOrdersCount += 1;
      const snap = getOrderFinancialSnapshot(
        order,
        storeRateMap.get(order.storeId) ?? DEFAULT_EDKAWY_COMMISSION_RATE
      );
      totalStoreSales += snap.subtotal;
      totalEdkawyCommissions += snap.commissionAmount;
      totalDeliveryFees += snap.courierEarning;
      totalDeliveredNetPayable += snap.restaurantNet;
    }
  }

  let totalCourierDues = 0;
  let cashHeldByCouriers = 0;
  let totalDuesPaid = 0;
  for (const w of params.wallets) {
    totalCourierDues += Math.max(0, Number(w.courierDues || 0));
    cashHeldByCouriers += Math.max(0, Number(w.collectionCustody || 0));
    totalDuesPaid += Math.max(0, Number(w.totalDuesPaid || 0));
  }

  let totalHandedOverGross = 0;
  let cashVarianceNet = 0;
  let cashShortageFromReceipts = 0;
  for (const r of params.receipts) {
    totalHandedOverGross += Math.max(0, Number(r.actualAmount || 0));
    const variance = Number(r.varianceAmount || 0);
    cashVarianceNet += variance;
    if (variance < 0) {
      cashShortageFromReceipts += Math.abs(variance);
    }
  }

  let paidStoreSettlements = 0;
  for (const s of params.settlements) {
    if (s.status === 'paid') {
      paidStoreSettlements += Math.max(0, Number(s.restaurantNetPayable || 0));
    }
  }

  const cashInTreasury = Math.max(
    0,
    Math.round((totalHandedOverGross - paidStoreSettlements - totalDuesPaid) * 100) /
      100
  );
  const unpaidStorePayables = Math.max(
    0,
    Math.round((totalDeliveredNetPayable - paidStoreSettlements) * 100) / 100
  );

  let pendingExceptionsCount = 0;
  let openShortageExceptions = 0;
  for (const ex of params.exceptions) {
    if (ex.status === 'pending_review') {
      pendingExceptionsCount += 1;
      if (ex.exceptionType === 'cash_shortage') {
        openShortageExceptions += Math.max(0, Number(ex.disputedAmount || 0));
      }
    }
  }

  return {
    totalStoreSales: Math.round(totalStoreSales * 100) / 100,
    totalEdkawyCommissions: Math.round(totalEdkawyCommissions * 100) / 100,
    totalDeliveryFees: Math.round(totalDeliveryFees * 100) / 100,
    totalCourierDues: Math.round(totalCourierDues * 100) / 100,
    cashInTreasury,
    totalHandedOverGross: Math.round(totalHandedOverGross * 100) / 100,
    cashHeldByCouriers: Math.round(cashHeldByCouriers * 100) / 100,
    unpaidStorePayables,
    paidStoreSettlements: Math.round(paidStoreSettlements * 100) / 100,
    cancelledOrdersCount,
    cashShortageTotal:
      Math.round(Math.max(cashShortageFromReceipts, openShortageExceptions) * 100) /
      100,
    cashVarianceNet: Math.round(cashVarianceNet * 100) / 100,
    deliveredOrdersCount,
    pendingExceptionsCount,
  };
}

