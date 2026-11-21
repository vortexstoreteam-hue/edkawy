import {
  createUserWithEmailAndPassword,
  deleteUser,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
  User,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  enableNetwork,
  getDoc,
  getDocFromServer,
  getDocs,
  limit,
  onSnapshot,
  Query,
  query,
  QueryDocumentSnapshot,
  QuerySnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  createMerchantAuthUser,
  createSecondaryAuthUser,
  db,
  googleProvider,
  handleFirestoreError,
  waitForFirestoreWarmup,
} from '../firebase';
import {
  APPROVED_EDKO_ZONE_IDS,
  APPROVED_EDKO_ZONES,
  DEFAULT_SUPER_APP_CATEGORIES,
  EDKU_CITY_CENTER,
  LEGACY_DEMO_AD_IDS,
  LEGACY_DEMO_COUPON_IDS,
  LEGACY_DEMO_PRODUCT_IDS,
  LEGACY_DEMO_STORE_IDS,
  resolveCategoryIdForStoreCategory,
  resolveEdkuCoordsForNeighborhood,
  resolveNearestEdkuNeighborhood,
  resolveProductImageKeyForStoreCategory,
  resolveStoreImageKeyForCategory,
  resolveZoneForNeighborhood,
} from '../data/edkuSeedStores';
import {
  AdBannerInput,
  AdBannerRecord,
  AdImageKey,
  AdminCreateCourierInput,
  AdminCreateSalesAgentInput,
  AdminCreateStoreInput,
  AdminCustomerRecord,
  AdminNotificationSendInput,
  AdminOtpRequestResult,
  AdminOtpVerifyResult,
  AiAssistantApiResponse,
  AiChatMessage,
  AppliedCoupon,
  AppNotificationRecord,
  AppNotificationType,
  AuditActionType,
  AuditLogRecord,
  BlockedEntityRecord,
  BlockedEntityType,
  BroadcastAudience,
  CampaignInput,
  CampaignRecord,
  CartItem,
  CheckoutFormInput,
  CommissionRecord,
  CompleteProfileInput,
  CouponInput,
  CouponRecord,
  CourierApprovalStatus,
  CourierCredentialRecord,
  CourierProfileInput,
  CourierRecord,
  CourierRegisterInput,
  CreateInvitationInput,
  CreatePayoutRequestInput,
  CreateStaffMemberInput,
  CreateSupportTicketInput,
  CustomerBanType,
  CustomerDirectoryEntry,
  CustomErrandOrderInput,
  DailySpinResult,
  DispatchTicketRecord,
  EdkoZoneId,
  EdkoZoneRecord,
  EdkuWeatherPromoResponse,
  EmailVerificationRequestResult,
  EmailVerificationVerifyResult,
  FirebaseConnectionHealthResult,
  GroupSessionCartItem,
  GroupSessionChatMessage,
  GroupSessionParticipant,
  GroupSessionRecord,
  InvitationEmailApiResponse,
  InvitationRecord,
  InvitationRegisterPayload,
  InvitationStatus,
  InvitationUserType,
  LiveEventRecord,
  MealPlanApiResponse,
  MealPlanRequestInput,
  MenuItem,
  MenuOcrApiResponse,
  NewProductInput,
  NewStoreInput,
  OcrExtractedMenuItem,
  OperationType,
  OrderItemPayload,
  OrderRecord,
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentMethodsConfig,
  PayoutMethod,
  PayoutRequestRecord,
  PayoutStatus,
  PharmacyPrescriptionOrderInput,
  PortalRole,
  ProductImageKey,
  ProductRecord,
  ProductVariant,
  QaSimulationReport,
  QaSimulationStep,
  ReferralAccountRecord,
  ReverseGeocodeApiResponse,
  ReviewRecord,
  ReviewSubmitInput,
  SalesAgentProfileRecord,
  SalesAgentRecord,
  SavedAddressItem,
  SharedCartChatMessage,
  SharedCartItemEntry,
  SharedCartRecord,
  StaffMemberRecord,
  StaffRole,
  StoreCategory,
  StoreCredentialRecord,
  StoreJoinRequestInput,
  StoreJoinRequestRecord,
  StoreImageKey,
  StoreOperationalSettingsInput,
  StoreRecord,
  SuperAppCategoryRecord,
  SupportMessageRecord,
  SupportTicketCategory,
  SupportTicketRecord,
  SupportTicketStatus,
  SystemMaintenanceConfig,
  UserProfileRecord,
  UserRole,
  VisualSearchApiResponse,
  WalletTopupRequestInput,
  WalletTopupRequestRecord,
  WalletTransactionRecord,
} from '../types/edkawi';
import {
  buildCartItemId,
  calculateCartTotals,
  EDKU_NEIGHBORHOODS,
  EDKU_ROUTE_WAYPOINTS,
  EGYPT_PHONE_REGEX,
  generateCustomerReferralCode,
  generateSalesAgentReferralCode,
  generateStoreCredentials,
  generateUniqueCustomerCode,
  getAuditActionLabelAr,
  isCouponExpired,
  isEdkuWaterCoordinate,
  isStoreOpen,
  isValidCustomerCodeFormat,
  isValidFirestoreId,
  normalizeEgyptPhoneOrEmpty,
  REFERRAL_CODE_REGEX,
  validateAdBannerForm,
  validateAdminCreateStoreForm,
  validateCampaignForm,
  validateCheckoutForm,
  validateCompleteProfileForm,
  validateCouponForm,
  validateCourierProfile,
  validateCourierRegistrationForm,
  validateCustomErrandInput,
  validateCustomerRegistrationForm,
  validateNewProductForm,
  validateNewStoreForm,
  validatePharmacyPrescriptionInput,
  validateReviewForm,
  validateStaffMemberForm,
  validateStoreSettingsForm,
  validateSupportTicketForm,
} from '../utils/orderLogic';

export const OFFICIAL_ADMIN_PORTAL_EMAIL = 'vortexstore.team@gmail.com';
const VERIFIED_ADMIN_FALLBACK_EMAIL = 'vortexstore.admin@adkawy.com';
const LEGACY_ADMIN_PASSWORDS_FOR_MIGRATION = [
  '963835#274193#38763#54',
] as const;

function isInternalAdminAliasEmail(email: string): boolean {
  return email.trim().toLowerCase().startsWith('vortexstore.admin');
}

function buildDeterministicAdminAliasEmail(password: string): string {
  let hash = 2166136261;
  for (let i = 0; i < password.length; i += 1) {
    hash ^= password.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const suffix = (hash >>> 0).toString(36);
  return `vortexstore.admin.${suffix}@adkawy.com`;
}

const CATEGORY_TO_STORE_IMAGE: Record<StoreCategory, StoreImageKey> = {
  'أسماك وبحريات': 'seafood',
  'مشويات ومطاعم': 'grills',
  'مخابز وفطائر': 'bakery',
  'سوبر ماركت': 'grocery',
  'صيدليات': 'pharmacy',
  'أكل بيتي': 'home_food',
  'مستحضرات تجميل': 'cosmetics',
  'أدوات منزلية': 'household',
  'ملابس': 'clothing',
  'هدايا وإكسسوارات': 'gifts',
};

export interface AuthErrorGuidance {
  message: string;
  needsConsoleProviderEnable: boolean;
  providerLabel?: string;
}

export function formatFirebaseAuthError(error: unknown): AuthErrorGuidance {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';

  if (
    code === 'auth/operation-not-allowed' ||
    code === 'auth/admin-restricted-operation'
  ) {
    return {
      message:
        'طريقة الدخول هذه غير مفعّلة بعد في لوحة تحكم Firebase للمشروع. يرجى تفعيل Email/Password و Anonymous من قسم Authentication > Sign-in method في Firebase Console.',
      needsConsoleProviderEnable: true,
      providerLabel: 'Anonymous / Email-Password',
    };
  }

  switch (code) {
    case 'auth/invalid-email':
      return {
        message: 'صيغة البريد الإلكتروني غير صحيحة.',
        needsConsoleProviderEnable: false,
      };
    case 'auth/missing-email':
      return {
        message: 'يرجى إدخال البريد الإلكتروني أولاً.',
        needsConsoleProviderEnable: false,
      };
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return {
        message:
          'بيانات البريد الإلكتروني أو كلمة المرور غير صحيحة، أو الحساب غير مسجل بعد.',
        needsConsoleProviderEnable: false,
      };
    case 'auth/email-already-in-use':
      return {
        message: 'هذا البريد الإلكتروني مسجل بالفعل في النظام.',
        needsConsoleProviderEnable: false,
      };
    case 'auth/weak-password':
      return {
        message: 'كلمة المرور ضعيفة؛ يرجى اختيار ٦ أحرف أو أرقام على الأقل.',
        needsConsoleProviderEnable: false,
      };
    case 'auth/too-many-requests':
      return {
        message:
          'تم إرسال طلبات متكررة في وقت قصير. يرجى الانتظار قليلاً ثم المحاولة مرة أخرى.',
        needsConsoleProviderEnable: false,
      };
    case 'auth/network-request-failed':
      return {
        message:
          'تعذر الاتصال بالخادم حالياً. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.',
        needsConsoleProviderEnable: false,
      };
    case 'auth/popup-closed-by-user':
      return {
        message: 'تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية.',
        needsConsoleProviderEnable: false,
      };
    case 'auth/popup-blocked':
      return {
        message:
          'قام المتصفح بحظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع.',
        needsConsoleProviderEnable: false,
      };
    default:
      return {
        message:
          error instanceof Error
            ? error.message
            : 'حدث خطأ غير متوقع أثناء المصادقة.',
        needsConsoleProviderEnable: false,
      };
  }
}

/* ============================================================================
 * STRUCTURED FIRESTORE HELPERS
 * ========================================================================== */

function splitFirestorePath(path: string | null | undefined): {
  collectionId: string;
  documentId: string;
} {
  const clean = (path ?? '').replace(/^\/+|\/+$/g, '');
  if (!clean) {
    return { collectionId: 'unknown', documentId: '*' };
  }
  const parts = clean.split('/');
  if (parts.length === 1) {
    return { collectionId: parts[0], documentId: '*' };
  }
  return {
    collectionId: parts.slice(0, parts.length - 1).join('/'),
    documentId: parts[parts.length - 1],
  };
}

function logFirestoreFailure(
  collectionId: string,
  documentId: string,
  operation: string,
  error: unknown
): void {
  console.error('[Edkawy Firestore][ERROR]', {
    collectionId,
    documentId,
    operation,
    error,
  });
}

function toIsoString(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

function isValidEdkuCoordPair(lat?: number, lng?: number): boolean {
  return (
    typeof lat === 'number' &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    typeof lng === 'number' &&
    Number.isFinite(lng) &&
    lng >= -180 &&
    lng <= 180 &&
    !(Math.abs(lat) < 0.000001 && Math.abs(lng) < 0.000001)
  );
}

function sanitizeOptionalImage(url?: string): string | undefined {
  const trimmed = (url ?? '').trim();
  if (!trimmed || trimmed.length < 16 || trimmed.length > 750000) {
    return undefined;
  }
  if (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://')
  ) {
    return trimmed;
  }
  return undefined;
}

async function assertSystemWritableForUser(
  uid: string,
  options?: { storeId?: string; checkMaintenance?: boolean }
): Promise<void> {
  if (!uid || !isValidFirestoreId(uid)) return;

  const checks: Promise<void>[] = [];

  checks.push(
    Promise.all([
      getDoc(doc(db, 'users', uid)).catch(() => null),
      getDoc(doc(db, 'blockedUsers', uid)).catch(() => null),
    ])
      .then(([userSnap, blockSnap]) => {
        if (userSnap?.exists() && userSnap.data()?.isBanned === true) {
          throw new Error('حسابك محظور، تواصل مع الدعم');
        }
        if (blockSnap?.exists() && blockSnap.data()?.isBlocked === true) {
          const targetType = String(blockSnap.data()?.targetType ?? 'customer');
          if (targetType === 'customer') {
            throw new Error('حسابك محظور، تواصل مع الدعم');
          }
          const reason = String(blockSnap.data()?.reason ?? '').trim();
          throw new Error(
            reason
              ? `تم إيقاف هذا الحساب مؤقتاً من قِبل إدارة إدكاوي (${reason}).`
              : 'تم إيقاف هذا الحساب مؤقتاً من قِبل إدارة إدكاوي.'
          );
        }
      })
      .catch((err) => {
        if (
          err instanceof Error &&
          (err.message.includes('حسابك محظور') ||
            err.message.startsWith('تم إيقاف'))
        ) {
          throw err;
        }
      })
  );

  if (options?.storeId && isValidFirestoreId(options.storeId)) {
    checks.push(
      getDoc(doc(db, 'blockedUsers', options.storeId))
        .then((snap) => {
          if (snap.exists() && snap.data()?.isBlocked === true) {
            throw new Error(
              'هذا المتجر متوقف مؤقتاً من قِبل إدارة المنصة ولا يستقبل طلبات حالياً.'
            );
          }
        })
        .catch((err) => {
          if (err instanceof Error && err.message.startsWith('هذا المتجر متوقف')) {
            throw err;
          }
        })
    );
  }

  if (options?.checkMaintenance) {
    checks.push(
      getDoc(doc(db, 'appConfig', 'system'))
        .then((snap) => {
          if (snap.exists() && snap.data()?.maintenanceMode === true) {
            const msg = String(snap.data()?.maintenanceMessage ?? '').trim();
            throw new Error(
              msg ||
                'التطبيق في وضع الصيانة والتحديث حالياً، يرجى المحاولة بعد قليل.'
            );
          }
        })
        .catch((err) => {
          if (
            err instanceof Error &&
            /[\u0600-\u06FF]/.test(err.message) &&
            !err.message.startsWith('{')
          ) {
            throw err;
          }
        })
    );
  }

  await Promise.all(checks);
}

function parseProductVariantsArray(
  rawVariants: unknown
): ProductVariant[] | undefined {
  if (!Array.isArray(rawVariants) || rawVariants.length === 0) {
    return undefined;
  }
  const parsed: ProductVariant[] = rawVariants
    .map((v: unknown, idx: number): ProductVariant | null => {
      if (typeof v !== 'object' || v === null) return null;
      const entry = v as Record<string, unknown>;
      const name = typeof entry.name === 'string' ? entry.name.trim() : '';
      const size =
        typeof entry.size === 'string' && entry.size.trim()
          ? entry.size.trim().slice(0, 40)
          : undefined;
      const color =
        typeof entry.color === 'string' && entry.color.trim()
          ? entry.color.trim().slice(0, 40)
          : undefined;
      const shade =
        typeof entry.shade === 'string' && entry.shade.trim()
          ? entry.shade.trim().slice(0, 40)
          : undefined;
      const labelFallback = [size, color, shade].filter(Boolean).join(' · ');
      const finalName = (name || labelFallback || `خيار ${idx + 1}`).slice(0, 80);
      const price = Math.max(1, Math.trunc(Number(entry.price ?? 50)));
      const stock = Math.max(0, Math.trunc(Number(entry.stock ?? 0)));
      const variantId =
        typeof entry.variantId === 'string' && entry.variantId.trim()
          ? entry.variantId.trim().slice(0, 64)
          : `var_${idx + 1}`;
      return {
        variantId,
        name: finalName,
        ...(size ? { size } : {}),
        ...(color ? { color } : {}),
        ...(shade ? { shade } : {}),
        price,
        stock,
      };
    })
    .filter((item): item is ProductVariant => item !== null)
    .slice(0, 25);

  return parsed.length > 0 ? parsed : undefined;
}

function parseStoreSnapshotDoc(
  docSnap: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>
): StoreRecord {
  const d = docSnap.data() ?? {};
  const rawMenu = Array.isArray(d.menuItems) ? d.menuItems : [];
  const menuItems: MenuItem[] = rawMenu.map(
    (m: Record<string, unknown>, idx: number) => {
      const variants = parseProductVariantsArray(m.variants);
      return {
        id: typeof m.id === 'string' ? m.id : `item_${idx + 1}`,
        name: typeof m.name === 'string' ? m.name : 'منتج',
        price: typeof m.price === 'number' ? Math.trunc(m.price) : 50,
        ...(variants && variants.length > 0
          ? { hasVariants: true, variants }
          : {}),
      };
    }
  );

  const deliveryTimeMinutes = Math.trunc(Number(d.deliveryTimeMinutes ?? 25));
  const neighborhoodStr = String(d.neighborhood ?? '');
  const fallbackCoords = resolveEdkuCoordsForNeighborhood(neighborhoodStr);
  const storeCategory: StoreCategory = d.category ?? 'مشويات ومطاعم';

  return {
    id: docSnap.id,
    name: String(d.name ?? ''),
    category: storeCategory,
    categoryId:
      typeof d.categoryId === 'string' && d.categoryId.trim()
        ? d.categoryId.trim()
        : resolveCategoryIdForStoreCategory(storeCategory),
    isHomeFood:
      typeof d.isHomeFood === 'boolean'
        ? d.isHomeFood
        : storeCategory === 'أكل بيتي',
    neighborhood: neighborhoodStr,
    description: String(d.description ?? ''),
    deliveryFee: Math.trunc(Number(d.deliveryFee ?? 0)),
    deliveryTimeMinutes,
    rating: Number(Number(d.rating ?? 4.8).toFixed(1)),
    reviewCount:
      typeof d.reviewCount === 'number'
        ? Math.max(0, Math.trunc(d.reviewCount))
        : undefined,
    ratingSum:
      typeof d.ratingSum === 'number' ? Number(d.ratingSum) : undefined,
    lat: typeof d.lat === 'number' ? d.lat : fallbackCoords.lat,
    lng: typeof d.lng === 'number' ? d.lng : fallbackCoords.lng,
    imageKey: d.imageKey ?? resolveStoreImageKeyForCategory(storeCategory),
    imageUrl: sanitizeOptionalImage(
      typeof d.imageUrl === 'string' ? d.imageUrl : undefined
    ),
    isActive: Boolean(d.isActive),
    isOpen: typeof d.isOpen === 'boolean' ? d.isOpen : true,
    openingTime:
      typeof d.openingTime === 'string' && d.openingTime.trim()
        ? d.openingTime.trim().slice(0, 10)
        : undefined,
    closingTime:
      typeof d.closingTime === 'string' && d.closingTime.trim()
        ? d.closingTime.trim().slice(0, 10)
        : undefined,
    isManuallyClosed:
      typeof d.isManuallyClosed === 'boolean'
        ? d.isManuallyClosed
        : undefined,
    prepTimeMinutes:
      typeof d.prepTimeMinutes === 'number'
        ? Math.trunc(d.prepTimeMinutes)
        : deliveryTimeMinutes,
    minOrderAmount:
      typeof d.minOrderAmount === 'number'
        ? Math.max(0, Math.trunc(d.minOrderAmount))
        : 0,
    menuItems,
    ownerUid: typeof d.ownerUid === 'string' ? d.ownerUid : undefined,
    loginEmail: typeof d.loginEmail === 'string' ? d.loginEmail : undefined,
    referredByAgentId:
      typeof d.referredByAgentId === 'string' ? d.referredByAgentId : undefined,
    referredByCode:
      typeof d.referredByCode === 'string' ? d.referredByCode : undefined,
    createdBy: String(d.createdBy ?? ''),
    createdAtIso: toIsoString(d.createdAt),
  };
}

function parseProductSnapshotDoc(
  docSnap: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>,
  fallbackStoreId: string
): ProductRecord {
  const d = docSnap.data() ?? {};
  const variants = parseProductVariantsArray(d.variants);
  const hasVariants =
    typeof d.hasVariants === 'boolean'
      ? d.hasVariants && Boolean(variants && variants.length > 0)
      : Boolean(variants && variants.length > 0);
  const variantTotalStock =
    hasVariants && variants
      ? variants.reduce((sum, v) => sum + v.stock, 0)
      : undefined;
  const stockQuantity =
    typeof d.stockQuantity === 'number'
      ? Math.max(0, Math.trunc(d.stockQuantity))
      : variantTotalStock;

  return {
    id: docSnap.id,
    storeId: String(d.storeId ?? fallbackStoreId),
    storeOwnerId:
      typeof d.storeOwnerId === 'string' ? d.storeOwnerId : undefined,
    name: String(d.name ?? ''),
    description: String(d.description ?? ''),
    category: String(d.category ?? 'أصناف المتجر'),
    price: Math.trunc(Number(d.price ?? 50)),
    imageKey: (d.imageKey as ProductImageKey) ?? 'seafood',
    imageUrl: sanitizeOptionalImage(
      typeof d.imageUrl === 'string' ? d.imageUrl : undefined
    ),
    isAvailable:
      stockQuantity !== undefined && stockQuantity <= 0
        ? false
        : Boolean(d.isAvailable),
    stockQuantity,
    hasVariants,
    variants,
    isMysteryBox:
      typeof d.isMysteryBox === 'boolean' ? d.isMysteryBox : undefined,
    originalValueEgp:
      typeof d.originalValueEgp === 'number'
        ? Math.max(0, Math.trunc(d.originalValueEgp))
        : undefined,
    isFlashSale:
      typeof d.isFlashSale === 'boolean' ? d.isFlashSale : undefined,
    flashDiscountPercent:
      typeof d.flashDiscountPercent === 'number'
        ? Math.min(90, Math.max(0, Math.trunc(d.flashDiscountPercent)))
        : undefined,
    flashSaleEndsAtIso:
      typeof d.flashSaleEndsAtIso === 'string' && d.flashSaleEndsAtIso.trim()
        ? d.flashSaleEndsAtIso.trim()
        : undefined,
    createdBy: String(d.createdBy ?? ''),
    createdAtIso: toIsoString(d.createdAt),
  };
}

function parseOrderSnapshotDoc(
  docSnap: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>
): OrderRecord {
  const d = docSnap.data() ?? {};
  const rawItems = Array.isArray(d.items) ? d.items : [];
  const items: OrderItemPayload[] = rawItems.map(
    (entry: Record<string, unknown>, idx: number) => ({
      productId:
        typeof entry.productId === 'string'
          ? entry.productId
          : `item_${idx + 1}`,
      ...(typeof entry.variantId === 'string' && entry.variantId.trim()
        ? { variantId: entry.variantId.trim() }
        : {}),
      ...(typeof entry.variantLabel === 'string' && entry.variantLabel.trim()
        ? { variantLabel: entry.variantLabel.trim() }
        : {}),
      ...(typeof entry.participantUid === 'string' && entry.participantUid.trim()
        ? { participantUid: entry.participantUid.trim() }
        : {}),
      ...(typeof entry.participantName === 'string' && entry.participantName.trim()
        ? { participantName: entry.participantName.trim() }
        : {}),
      name: typeof entry.name === 'string' ? entry.name : 'منتج',
      price: Math.trunc(Number(entry.price ?? 0)),
      quantity: Math.max(1, Math.trunc(Number(entry.quantity ?? 1))),
    })
  );

  const rawMethod = String(d.paymentMethod ?? 'cash');
  const paymentMethod =
    rawMethod === 'visa'
      ? 'visa'
      : rawMethod === 'cash_on_delivery'
      ? 'cash_on_delivery'
      : 'cash';

  const rawType = String(d.orderType ?? 'standard');
  const orderType: OrderType =
    rawType === 'pharmacy_prescription'
      ? 'pharmacy_prescription'
      : rawType === 'custom_errand'
      ? 'custom_errand'
      : 'standard';

  const rawZoneId = typeof d.zoneId === 'string' ? d.zoneId.trim() : '';
  const zoneId = APPROVED_EDKO_ZONE_IDS.includes(rawZoneId as EdkoZoneId)
    ? (rawZoneId as EdkoZoneId)
    : undefined;

  return {
    id: docSnap.id,
    orderType,
    prescriptionImageUrl: sanitizeOptionalImage(
      typeof d.prescriptionImageUrl === 'string'
        ? d.prescriptionImageUrl
        : undefined
    ),
    prescriptionMedicineRequest:
      typeof d.prescriptionMedicineRequest === 'string'
        ? d.prescriptionMedicineRequest
        : undefined,
    pharmacistNote:
      typeof d.pharmacistNote === 'string' ? d.pharmacistNote : undefined,
    errandDescription:
      typeof d.errandDescription === 'string' ? d.errandDescription : undefined,
    errandPickupAddress:
      typeof d.errandPickupAddress === 'string'
        ? d.errandPickupAddress
        : undefined,
    customerId: String(d.customerId ?? ''),
    storeId: String(d.storeId ?? ''),
    storeOwnerId:
      typeof d.storeOwnerId === 'string' ? d.storeOwnerId : undefined,
    storeName: String(d.storeName ?? ''),
    storeLat: typeof d.storeLat === 'number' ? d.storeLat : undefined,
    storeLng: typeof d.storeLng === 'number' ? d.storeLng : undefined,
    customerName: String(d.customerName ?? ''),
    customerPhone: String(d.customerPhone ?? ''),
    deliveryNeighborhood: String(d.deliveryNeighborhood ?? ''),
    deliveryAddress: String(d.deliveryAddress ?? ''),
    zoneId,
    zoneName: typeof d.zoneName === 'string' ? d.zoneName : undefined,
    customerLat: typeof d.customerLat === 'number' ? d.customerLat : undefined,
    customerLng: typeof d.customerLng === 'number' ? d.customerLng : undefined,
    isScheduled:
      typeof d.isScheduled === 'boolean' ? d.isScheduled : undefined,
    scheduledForIso:
      typeof d.scheduledForIso === 'string' ? d.scheduledForIso : undefined,
    groupCartId: typeof d.groupCartId === 'string' ? d.groupCartId : undefined,
    groupSessionId:
      typeof d.groupSessionId === 'string' ? d.groupSessionId : undefined,
    items,
    itemsSummary: String(d.itemsSummary ?? ''),
    itemNames: Array.isArray(d.itemNames) ? d.itemNames.map(String) : [],
    itemCount: Math.max(1, Math.trunc(Number(d.itemCount ?? 1))),
    subtotal: Math.trunc(Number(d.subtotal ?? 0)),
    couponCode: typeof d.couponCode === 'string' ? d.couponCode : undefined,
    discountPercent:
      typeof d.discountPercent === 'number'
        ? Math.trunc(d.discountPercent)
        : undefined,
    discountAmount:
      typeof d.discountAmount === 'number'
        ? Math.trunc(d.discountAmount)
        : undefined,
    deliveryFee: Math.trunc(Number(d.deliveryFee ?? 0)),
    smallOrderFee:
      typeof d.smallOrderFee === 'number'
        ? Math.max(0, Math.trunc(d.smallOrderFee))
        : undefined,
    totalAmount: Math.trunc(Number(d.totalAmount ?? 0)),
    paymentMethod,
    status: d.status ?? 'pending',
    prepTimeMinutes:
      typeof d.prepTimeMinutes === 'number'
        ? Math.trunc(d.prepTimeMinutes)
        : undefined,
    courierId: typeof d.courierId === 'string' ? d.courierId : undefined,
    courierName: typeof d.courierName === 'string' ? d.courierName : undefined,
    courierPhone:
      typeof d.courierPhone === 'string' ? d.courierPhone : undefined,
    courierLocation:
      typeof d.courierLocation === 'string' ? d.courierLocation : undefined,
    courierLat: typeof d.courierLat === 'number' ? d.courierLat : undefined,
    courierLng: typeof d.courierLng === 'number' ? d.courierLng : undefined,
    cancelledByCourierIds: Array.isArray(d.cancelledByCourierIds)
      ? d.cancelledByCourierIds
          .filter((x: unknown): x is string => typeof x === 'string')
          .slice(0, 20)
      : undefined,
    rejectedBy: Array.isArray(d.rejectedBy)
      ? d.rejectedBy
          .filter((x: unknown): x is string => typeof x === 'string')
          .slice(0, 30)
      : undefined,
    tipAmountEgp:
      typeof d.tipAmountEgp === 'number'
        ? Math.max(0, Math.trunc(d.tipAmountEgp))
        : undefined,
    isTipped: typeof d.isTipped === 'boolean' ? d.isTipped : false,
    isTestSimulation:
      typeof d.isTestSimulation === 'boolean' ? d.isTestSimulation : undefined,
    isReviewed: typeof d.isReviewed === 'boolean' ? d.isReviewed : false,
    pointsEarned:
      typeof d.pointsEarned === 'number'
        ? Math.trunc(d.pointsEarned)
        : undefined,
    pointsAwarded:
      typeof d.pointsAwarded === 'boolean' ? d.pointsAwarded : false,
    notes: String(d.notes ?? ''),
    createdAtIso: toIsoString(d.createdAt),
    updatedAtIso: toIsoString(d.updatedAt),
  };
}

function parseDispatchTicketDoc(
  docSnap: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>
): DispatchTicketRecord {
  const d = docSnap.data() ?? {};
  const rawMethod = String(d.paymentMethod ?? 'cash');
  const paymentMethod =
    rawMethod === 'visa'
      ? 'visa'
      : rawMethod === 'cash_on_delivery'
      ? 'cash_on_delivery'
      : 'cash';

  const rawType = String(d.orderType ?? 'standard');
  const orderType: OrderType =
    rawType === 'pharmacy_prescription'
      ? 'pharmacy_prescription'
      : rawType === 'custom_errand'
      ? 'custom_errand'
      : 'standard';

  const rawZoneId = typeof d.zoneId === 'string' ? d.zoneId.trim() : '';
  const zoneId = APPROVED_EDKO_ZONE_IDS.includes(rawZoneId as EdkoZoneId)
    ? (rawZoneId as EdkoZoneId)
    : undefined;

  return {
    id: docSnap.id,
    orderId: String(d.orderId ?? docSnap.id),
    orderType,
    pharmacistNote:
      typeof d.pharmacistNote === 'string' ? d.pharmacistNote : undefined,
    errandDescription:
      typeof d.errandDescription === 'string' ? d.errandDescription : undefined,
    errandPickupAddress:
      typeof d.errandPickupAddress === 'string'
        ? d.errandPickupAddress
        : undefined,
    customerId: String(d.customerId ?? ''),
    storeId: String(d.storeId ?? ''),
    storeOwnerId:
      typeof d.storeOwnerId === 'string' ? d.storeOwnerId : undefined,
    storeName: String(d.storeName ?? ''),
    storeNeighborhood: String(d.storeNeighborhood ?? 'شارع البحر'),
    storeLat: typeof d.storeLat === 'number' ? d.storeLat : undefined,
    storeLng: typeof d.storeLng === 'number' ? d.storeLng : undefined,
    deliveryNeighborhood: String(d.deliveryNeighborhood ?? ''),
    zoneId,
    zoneName: typeof d.zoneName === 'string' ? d.zoneName : undefined,
    customerLat: typeof d.customerLat === 'number' ? d.customerLat : undefined,
    customerLng: typeof d.customerLng === 'number' ? d.customerLng : undefined,
    isScheduled:
      typeof d.isScheduled === 'boolean' ? d.isScheduled : undefined,
    scheduledForIso:
      typeof d.scheduledForIso === 'string' ? d.scheduledForIso : undefined,
    itemsSummary: String(d.itemsSummary ?? ''),
    subtotal: Math.trunc(Number(d.subtotal ?? 0)),
    couponCode: typeof d.couponCode === 'string' ? d.couponCode : undefined,
    discountPercent:
      typeof d.discountPercent === 'number'
        ? Math.trunc(d.discountPercent)
        : undefined,
    discountAmount:
      typeof d.discountAmount === 'number'
        ? Math.trunc(d.discountAmount)
        : undefined,
    deliveryFee: Math.trunc(Number(d.deliveryFee ?? 0)),
    smallOrderFee:
      typeof d.smallOrderFee === 'number'
        ? Math.max(0, Math.trunc(d.smallOrderFee))
        : undefined,
    totalAmount: Math.trunc(Number(d.totalAmount ?? 0)),
    paymentMethod,
    status: d.status ?? 'pending',
    prepTimeMinutes:
      typeof d.prepTimeMinutes === 'number'
        ? Math.trunc(d.prepTimeMinutes)
        : undefined,
    courierId: typeof d.courierId === 'string' ? d.courierId : undefined,
    courierName: typeof d.courierName === 'string' ? d.courierName : undefined,
    courierLat: typeof d.courierLat === 'number' ? d.courierLat : undefined,
    courierLng: typeof d.courierLng === 'number' ? d.courierLng : undefined,
    cancelledByCourierIds: Array.isArray(d.cancelledByCourierIds)
      ? d.cancelledByCourierIds
          .filter((x: unknown): x is string => typeof x === 'string')
          .slice(0, 20)
      : undefined,
    rejectedBy: Array.isArray(d.rejectedBy)
      ? d.rejectedBy
          .filter((x: unknown): x is string => typeof x === 'string')
          .slice(0, 30)
      : undefined,
    isTestSimulation:
      typeof d.isTestSimulation === 'boolean' ? d.isTestSimulation : undefined,
    createdAtIso: toIsoString(d.createdAt),
    updatedAtIso: toIsoString(d.updatedAt),
  };
}

function dispatchTicketToPreviewOrder(ticket: DispatchTicketRecord): OrderRecord {
  return {
    id: ticket.orderId,
    orderType: ticket.orderType,
    pharmacistNote: ticket.pharmacistNote,
    errandDescription: ticket.errandDescription,
    errandPickupAddress: ticket.errandPickupAddress,
    customerId: ticket.customerId,
    storeId: ticket.storeId,
    storeOwnerId: ticket.storeOwnerId,
    storeName: ticket.storeName,
    storeLat: ticket.storeLat,
    storeLng: ticket.storeLng,
    customerName: `عميل منطقة ${ticket.deliveryNeighborhood}`,
    customerPhone: '',
    deliveryNeighborhood: ticket.deliveryNeighborhood,
    zoneId: ticket.zoneId,
    zoneName: ticket.zoneName,
    deliveryAddress:
      ticket.orderType === 'custom_errand'
        ? ticket.errandPickupAddress
          ? `استلام من: ${ticket.errandPickupAddress} — التسليم: ${ticket.deliveryNeighborhood}`
          : 'تظهر تفاصيل عنوان العميل ورقم الهاتف فور قبول المشوار'
        : 'يظهر العنوان التفصيلي ورقم العميل فور استلام الطلب من المتجر',
    customerLat: ticket.customerLat,
    customerLng: ticket.customerLng,
    isScheduled: ticket.isScheduled,
    scheduledForIso: ticket.scheduledForIso,
    items: [],
    itemsSummary: ticket.itemsSummary,
    itemNames: [ticket.itemsSummary],
    itemCount: 1,
    subtotal: ticket.subtotal,
    couponCode: ticket.couponCode,
    discountPercent: ticket.discountPercent,
    discountAmount: ticket.discountAmount,
    deliveryFee: ticket.deliveryFee,
    smallOrderFee: ticket.smallOrderFee,
    totalAmount: ticket.totalAmount,
    paymentMethod: ticket.paymentMethod,
    status: ticket.status,
    prepTimeMinutes: ticket.prepTimeMinutes,
    courierId: ticket.courierId,
    courierName: ticket.courierName,
    courierLat: ticket.courierLat,
    courierLng: ticket.courierLng,
    cancelledByCourierIds: ticket.cancelledByCourierIds,
    rejectedBy: ticket.rejectedBy,
    isTestSimulation: ticket.isTestSimulation,
    notes: '',
    createdAtIso: ticket.createdAtIso,
    updatedAtIso: ticket.updatedAtIso,
  };
}

function parseCourierDoc(
  docSnap: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>,
  fallbackPhone = '01000000000'
): CourierRecord {
  const d = docSnap.data() ?? {};
  const rawStatus = String(d.approvalStatus ?? 'approved');
  const approvalStatus: CourierApprovalStatus =
    rawStatus === 'pending' || rawStatus === 'rejected'
      ? rawStatus
      : 'approved';
  const neighborhoodStr = String(d.neighborhood ?? 'شارع البحر');
  const fallbackCoords = resolveEdkuCoordsForNeighborhood(neighborhoodStr);

  return {
    id: docSnap.id,
    name: String(d.name ?? 'مندوب إدكاوي'),
    phone: typeof d.phone === 'string' ? d.phone : fallbackPhone,
    email: typeof d.email === 'string' ? d.email : undefined,
    vehicleType: d.vehicleType ?? 'دراجة نارية',
    neighborhood: neighborhoodStr,
    lat: typeof d.lat === 'number' ? d.lat : fallbackCoords.lat,
    lng: typeof d.lng === 'number' ? d.lng : fallbackCoords.lng,
    rating:
      typeof d.rating === 'number' ? Number(d.rating.toFixed(1)) : undefined,
    reviewCount:
      typeof d.reviewCount === 'number'
        ? Math.max(0, Math.trunc(d.reviewCount))
        : undefined,
    ratingSum:
      typeof d.ratingSum === 'number' ? Number(d.ratingSum) : undefined,
    walletBalance:
      typeof d.walletBalance === 'number'
        ? Math.max(0, Math.trunc(d.walletBalance))
        : 0,
    totalTipsEgp:
      typeof d.totalTipsEgp === 'number'
        ? Math.max(0, Math.trunc(d.totalTipsEgp))
        : 0,
    isAvailable: Boolean(d.isAvailable),
    approvalStatus,
    completedDeliveries: Math.max(
      0,
      Math.trunc(Number(d.completedDeliveries ?? 0))
    ),
    cancelledDeliveries:
      typeof d.cancelledDeliveries === 'number'
        ? Math.max(0, Math.trunc(d.cancelledDeliveries))
        : 0,
    updatedBy: String(d.updatedBy ?? docSnap.id),
    updatedAtIso: toIsoString(d.updatedAt),
  };
}

/* ============================================================================
 * UNIFIED AUTHENTICATION & UNLIMITED PASSWORD RESET
 * ========================================================================== */

async function computeEmailSha256Hex(rawEmail: string): Promise<string> {
  const normalized = rawEmail.trim().toLowerCase();
  const encoded = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function syncRegisteredAccountMarker(
  email: string | null | undefined,
  role: PortalRole
): Promise<void> {
  if (
    role !== 'customer' &&
    role !== 'courier' &&
    role !== 'store' &&
    role !== 'sales_agent'
  ) {
    return;
  }
  const normalized = (email ?? '').trim().toLowerCase();
  if (
    !normalized ||
    !normalized.includes('@') ||
    normalized === OFFICIAL_ADMIN_PORTAL_EMAIL ||
    normalized.endsWith('@adkawy.com')
  ) {
    return;
  }

  fetch('/api/auth/password-reset/register-account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalized, role }),
  }).catch(() => {});

  if (!auth.currentUser || auth.currentUser.isAnonymous) return;
  try {
    const emailHash = await computeEmailSha256Hex(normalized);
    await setDoc(doc(db, 'registeredAccounts', emailHash), {
      role,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal
  }
}

async function allocateFreshCustomerCode(): Promise<string> {
  try {
    const dirSnap = await getDocs(
      query(collection(db, 'customerDirectory'), where('points', '>=', 0))
    );
    const existingCodes = new Set<string>();
    for (const d of dirSnap.docs) {
      const code = d.data()?.customerCode;
      if (isValidCustomerCodeFormat(code)) {
        existingCodes.add(code.trim());
      }
    }
    return generateUniqueCustomerCode(existingCodes);
  } catch {
    return generateUniqueCustomerCode();
  }
}

async function syncCustomerDirectoryEntry(
  uid: string,
  patch: {
    name?: string;
    customerCode?: string;
    isBanned?: boolean;
    banType?: CustomerBanType;
    banUntilIso?: string;
    banReason?: string;
    neighborhood?: string;
    points?: number;
    totalSpentEgp?: number;
    currentStreak?: number;
    freeDeliveryRewards?: number;
    totalDeliveredOrders?: number;
    lastDeliveredOrderAtIso?: string;
  }
): Promise<void> {
  if (!uid || !isValidFirestoreId(uid)) return;
  try {
    const dirRef = doc(db, 'customerDirectory', uid);
    const existing = await getDoc(dirRef).catch(() => null);
    const prev = existing?.exists() ? existing.data() ?? {} : {};

    const cleanName = (
      patch.name?.trim() ||
      (typeof prev.name === 'string' && prev.name.trim()
        ? prev.name.trim()
        : auth.currentUser?.displayName?.trim() || 'عميل إدكاوي')
    ).slice(0, 80);

    const cleanNeighborhood = (
      patch.neighborhood?.trim() ||
      (typeof prev.neighborhood === 'string' ? prev.neighborhood.trim() : '')
    ).slice(0, 80);

    const resolvedCustomerCode = isValidCustomerCodeFormat(patch.customerCode)
      ? patch.customerCode.trim()
      : isValidCustomerCodeFormat(prev.customerCode)
      ? String(prev.customerCode).trim()
      : undefined;

    const resolvedIsBanned =
      typeof patch.isBanned === 'boolean'
        ? patch.isBanned
        : typeof prev.isBanned === 'boolean'
        ? prev.isBanned
        : undefined;

    const resolvedBanType =
      patch.banType !== undefined
        ? patch.banType
        : typeof prev.banType === 'string'
        ? (prev.banType as CustomerBanType)
        : undefined;

    const resolvedBanUntilIso =
      patch.banUntilIso !== undefined
        ? patch.banUntilIso
        : typeof prev.banUntilIso === 'string'
        ? prev.banUntilIso
        : undefined;

    const resolvedBanReason =
      patch.banReason !== undefined
        ? patch.banReason.trim().slice(0, 240)
        : typeof prev.banReason === 'string'
        ? prev.banReason.trim().slice(0, 240)
        : undefined;

    const resolvedTotalSpent =
      patch.totalSpentEgp !== undefined || typeof prev.totalSpentEgp === 'number'
        ? Math.max(0, Math.trunc(Number(patch.totalSpentEgp ?? prev.totalSpentEgp ?? 0)))
        : undefined;

    const payload: Record<string, unknown> = {
      uid,
      name: cleanName,
      ...(resolvedCustomerCode ? { customerCode: resolvedCustomerCode } : {}),
      ...(typeof resolvedIsBanned === 'boolean'
        ? { isBanned: resolvedIsBanned }
        : {}),
      ...(resolvedIsBanned && resolvedBanType ? { banType: resolvedBanType } : {}),
      ...(resolvedIsBanned && resolvedBanUntilIso ? { banUntilIso: resolvedBanUntilIso.slice(0, 40) } : {}),
      ...(resolvedBanReason !== undefined ? { banReason: resolvedBanReason } : {}),
      ...(cleanNeighborhood ? { neighborhood: cleanNeighborhood } : {}),
      points: Math.max(
        0,
        Math.trunc(Number(patch.points ?? prev.points ?? 0))
      ),
      ...(resolvedTotalSpent !== undefined ? { totalSpentEgp: resolvedTotalSpent } : {}),
      currentStreak: Math.min(
        5,
        Math.max(
          0,
          Math.trunc(Number(patch.currentStreak ?? prev.currentStreak ?? 0))
        )
      ),
      freeDeliveryRewards: Math.max(
        0,
        Math.trunc(
          Number(patch.freeDeliveryRewards ?? prev.freeDeliveryRewards ?? 0)
        )
      ),
      totalDeliveredOrders: Math.max(
        0,
        Math.trunc(
          Number(patch.totalDeliveredOrders ?? prev.totalDeliveredOrders ?? 0)
        )
      ),
      ...(patch.lastDeliveredOrderAtIso || prev.lastDeliveredOrderAtIso
        ? {
            lastDeliveredOrderAtIso: String(
              patch.lastDeliveredOrderAtIso ?? prev.lastDeliveredOrderAtIso
            ).slice(0, 40),
          }
        : {}),
      updatedAt: serverTimestamp(),
    };

    await setDoc(dirRef, payload);
  } catch {
    // Non-fatal directory sync
  }
}

async function ensureUserProfileDoc(
  uid: string,
  role: PortalRole,
  options?: {
    email?: string | null;
    name?: string;
    storeId?: string;
    profileCompleted?: boolean;
    referralCode?: string;
    referredByCode?: string;
    referredByAgentId?: string;
    requiresEmailVerification?: boolean;
  }
): Promise<void> {
  if (!isValidFirestoreId(uid)) return;
  const userRef = doc(db, 'users', uid);
  try {
    const existingSnap = await getDocWithRetry(userRef, 'users', uid);
    const cleanEmail = (options?.email ?? '').trim().toLowerCase().slice(0, 100);
    const cleanName = (options?.name ?? '').trim().slice(0, 80);
    const cleanStoreId = options?.storeId?.trim();
    const cleanReferralCode = options?.referralCode?.trim().slice(0, 24);
    const cleanReferredByCode = options?.referredByCode?.trim().slice(0, 24);
    const cleanReferredByAgentId = options?.referredByAgentId?.trim();
    const isRealCustomer =
      role === 'customer' && Boolean(auth.currentUser && !auth.currentUser.isAnonymous);

    let assignedCustomerCode: string | undefined;

    if (!existingSnap.exists()) {
      if (isRealCustomer) {
        assignedCustomerCode = await allocateFreshCustomerCode();
      }
      await setDoc(userRef, {
        role,
        ...(assignedCustomerCode ? { customerCode: assignedCustomerCode } : {}),
        ...(cleanReferralCode ? { referralCode: cleanReferralCode } : {}),
        ...(cleanReferredByCode ? { referredByCode: cleanReferredByCode } : {}),
        ...(cleanReferredByAgentId && isValidFirestoreId(cleanReferredByAgentId)
          ? { referredByAgentId: cleanReferredByAgentId }
          : {}),
        ...(typeof options?.requiresEmailVerification === 'boolean'
          ? { requiresEmailVerification: options.requiresEmailVerification }
          : {}),
        ...(cleanEmail ? { email: cleanEmail } : {}),
        ...(cleanName ? { name: cleanName } : {}),
        ...(typeof options?.profileCompleted === 'boolean'
          ? { profileCompleted: options.profileCompleted }
          : {}),
        ...(cleanStoreId && isValidFirestoreId(cleanStoreId)
          ? { storeId: cleanStoreId }
          : {}),
        ...(role === 'customer' ? { points: 0, currentStreak: 0 } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existingData = existingSnap.data() ?? {};
      const existingRole = existingData.role;
      const existingStoreId = existingData.storeId;
      const existingCode = existingData.customerCode;
      if (isValidCustomerCodeFormat(existingCode)) {
        assignedCustomerCode = existingCode.trim();
      } else if (isRealCustomer) {
        assignedCustomerCode = await allocateFreshCustomerCode();
      }

      const needsRoleSync = existingRole !== role;
      const needsStoreSync =
        role === 'store' &&
        Boolean(cleanStoreId && isValidFirestoreId(cleanStoreId)) &&
        existingStoreId !== cleanStoreId;
      const needsCodeBackfill =
        isRealCustomer &&
        !isValidCustomerCodeFormat(existingCode) &&
        Boolean(assignedCustomerCode);

      if (needsRoleSync || needsStoreSync || needsCodeBackfill) {
        await updateDoc(userRef, {
          role,
          ...(needsCodeBackfill && assignedCustomerCode
            ? { customerCode: assignedCustomerCode }
            : {}),
          ...(cleanStoreId && isValidFirestoreId(cleanStoreId)
            ? { storeId: cleanStoreId }
            : {}),
          updatedAt: serverTimestamp(),
        });
      }
    }

    if (isRealCustomer) {
      void syncCustomerDirectoryEntry(uid, {
        name: cleanName || undefined,
        customerCode: assignedCustomerCode,
      });
    }

    if (
      cleanEmail &&
      (role === 'customer' ||
        role === 'courier' ||
        role === 'store' ||
        role === 'sales_agent')
    ) {
      void syncRegisteredAccountMarker(cleanEmail, role);
    }
  } catch (error) {
    logFirestoreFailure('users', uid, 'ensureUserProfileDoc', error);
  }
}

export async function loginAnonymously(): Promise<User> {
  const credential = await signInAnonymously(auth);
  return credential.user;
}

export async function loginWithGoogle(): Promise<User> {
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

export async function loginWithGoogleCustomer(): Promise<{
  user: User;
  role: PortalRole;
  needsProfileCompletion: boolean;
}> {
  const credential = await signInWithPopup(auth, googleProvider);
  const normalizedEmail = (credential.user.email ?? '').trim().toLowerCase();

  if (
    normalizedEmail === OFFICIAL_ADMIN_PORTAL_EMAIL ||
    isInternalAdminAliasEmail(normalizedEmail)
  ) {
    await signOut(auth);
    throw new Error(
      'بريد الإدارة الرسمي يتطلب تسجيل الدخول عبر البريد الإلكتروني وكلمة المرور وكود التحقق المكوّن من ٦ أرقام.'
    );
  }

  const resolvedRole = await resolveUserPortalRole(credential.user);
  let needsProfileCompletion = false;

  if (resolvedRole === 'customer') {
    const existingProfileSnap = await getDocWithRetry(
      doc(db, 'users', credential.user.uid),
      'users',
      credential.user.uid
    ).catch(() => null);

    const existingData = existingProfileSnap?.exists()
      ? existingProfileSnap.data()
      : null;

    const hasPhoneAndAddress = Boolean(
      existingData &&
        typeof existingData.phone === 'string' &&
        existingData.phone.trim().length >= 10 &&
        typeof existingData.defaultAddress === 'string' &&
        existingData.defaultAddress.trim().length >= 4
    );

    needsProfileCompletion = !hasPhoneAndAddress;

    await ensureUserProfileDoc(credential.user.uid, 'customer', {
      email: normalizedEmail,
      name: credential.user.displayName ?? undefined,
      profileCompleted: hasPhoneAndAddress,
    });
  }
  return {
    user: credential.user,
    role: resolvedRole,
    needsProfileCompletion,
  };
}

export async function loginWithEmail(
  email: string,
  password: string
): Promise<User> {
  const credential = await signInWithEmailAndPassword(
    auth,
    email.trim().toLowerCase(),
    password
  );
  return credential.user;
}

export async function registerWithEmail(
  email: string,
  password: string
): Promise<User> {
  const credential = await createUserWithEmailAndPassword(
    auth,
    email.trim().toLowerCase(),
    password
  );
  return credential.user;
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Sends a real Firebase Authentication password reset email in Arabic anytime
 * without any 6-day cooldown lock or false-negative pre-check block.
 */
export async function sendPasswordResetEmailForUser(
  email: string
): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase();
  if (
    !normalizedEmail ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
  ) {
    throw new Error('يرجى إدخال عنوان بريد إلكتروني صحيح لإرسال رابط الاستعادة.');
  }

  if (
    normalizedEmail === OFFICIAL_ADMIN_PORTAL_EMAIL ||
    isInternalAdminAliasEmail(normalizedEmail)
  ) {
    throw new Error(
      'بريد الإدارة الرسمي محمي بتحقق ثنائي (OTP) ولا يدعم إعادة التعيين عبر هذا النموذج.'
    );
  }

  if (normalizedEmail.endsWith('@adkawy.com')) {
    throw new Error(
      'هذا الحساب يستخدم بريداً افتراضياً داخلياً (@adkawy.com). يرجى التواصل مع الإدارة لتحديث البريد الإلكتروني إلى بريدك الحقيقي واستلام رابط إعادة تعيين كلمة المرور.'
    );
  }

  auth.languageCode = 'ar';
  const actionCodeSettings = {
    url: resolvePublicAppOrigin(),
    handleCodeInApp: false,
  };
  try {
    await sendPasswordResetEmail(auth, normalizedEmail, actionCodeSettings);
  } catch (err) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code)
        : '';
    if (code === 'auth/user-not-found') {
      throw new Error(
        'هذا البريد الإلكتروني غير مسجل لدينا، يرجى التأكد أو إنشاء حساب جديد.'
      );
    }
    if (code === 'auth/invalid-email') {
      throw new Error('صيغة البريد الإلكتروني غير صحيحة.');
    }
    if (code === 'auth/too-many-requests') {
      throw new Error(
        'تم إرسال طلبات متكررة في وقت قصير جداً من Firebase. يرجى الانتظار دقيقة والمحاولة مرة أخرى.'
      );
    }
    throw err;
  }

  const sentAtMs = Date.now();
  fetch('/api/auth/password-reset/record', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizedEmail, sentAtMs }),
  }).catch(() => {});

  return 'تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني بنجاح! راجع صندوق الوارد (Inbox) أو الرسائل غير المرغوبة (Spam).';
}

export async function loginUnifiedWithEmailAndPassword(
  email: string,
  password: string
): Promise<{ user: User; role: PortalRole }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (
    normalizedEmail === OFFICIAL_ADMIN_PORTAL_EMAIL ||
    isInternalAdminAliasEmail(normalizedEmail)
  ) {
    throw new Error(
      'دخول لوحة الإدارة يتم حصرياً عبر بريد الإدارة الرسمي وكود التحقق المكوّن من ٦ أرقام.'
    );
  }

  const credential = await signInWithEmailAndPassword(
    auth,
    normalizedEmail,
    password
  );
  const resolvedRole = await resolveUserPortalRole(credential.user);
  return { user: credential.user, role: resolvedRole };
}

export async function registerCustomerWithEmailAndPassword(
  name: string,
  email: string,
  password: string,
  referralCode?: string
): Promise<{ user: User; role: PortalRole }> {
  const validation = validateCustomerRegistrationForm({
    name,
    email,
    password,
  });
  if (!validation.valid) {
    throw new Error(Object.values(validation.errors)[0]);
  }

  const cleanName = name.trim().slice(0, 80);
  const normalizedEmail = email.trim().toLowerCase();

  if (
    normalizedEmail === OFFICIAL_ADMIN_PORTAL_EMAIL ||
    isInternalAdminAliasEmail(normalizedEmail) ||
    normalizedEmail.endsWith('@adkawy.com')
  ) {
    throw new Error(
      'لا يمكن إنشاء حساب عميل بهذا البريد الإلكتروني. يرجى استخدام بريدك الشخصي.'
    );
  }

  const candidateRef = (
    referralCode?.trim() || readPendingSessionReferralCode()
  )
    .toUpperCase()
    .trim();
  const resolvedRef = candidateRef
    ? await resolveReferralCodeInFirestore(candidateRef).catch(() => null)
    : null;

  await waitForFirestoreWarmup();
  const credential = await createUserWithEmailAndPassword(
    auth,
    normalizedEmail,
    password
  );
  await updateProfile(credential.user, { displayName: cleanName }).catch(
    () => {}
  );
  await ensureUserProfileDoc(credential.user.uid, 'customer', {
    email: normalizedEmail,
    name: cleanName,
    referredByCode: resolvedRef?.code,
    referredByAgentId: resolvedRef?.agentId,
  });
  if (resolvedRef) {
    await recordReferralOnSignupBestEffort({
      agentId: resolvedRef.agentId,
      referralCode: resolvedRef.code,
      referredUid: credential.user.uid,
      accountName: cleanName,
      accountType: 'customer',
    });
    clearPendingSessionReferralCode();
  }
  writeCachedUserRole(credential.user.uid, 'customer');
  return { user: credential.user, role: 'customer' };
}

export async function requestAdminOtpFromServer(
  email: string,
  password: string
): Promise<AdminOtpRequestResult> {
  const response = await fetch('/api/auth/admin/request-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password }),
  });

  const data = (await response.json()) as AdminOtpRequestResult;
  if (!response.ok || !data.ok) {
    throw new Error(
      data.error ||
        'بيانات البريد الإلكتروني أو كلمة المرور الخاصة بالإدارة غير صحيحة.'
    );
  }
  return data;
}

export async function verifyAdminOtpFromServer(
  email: string,
  code: string
): Promise<AdminOtpVerifyResult> {
  const response = await fetch('/api/auth/admin/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), code: code.trim() }),
  });

  const data = (await response.json()) as AdminOtpVerifyResult;
  if (!response.ok || !data.ok || !data.adminBootstrapGate) {
    throw new Error(data.error || 'كود التحقق غير صحيح أو منتهي الصلاحية.');
  }
  return data;
}

async function signInOrCreateEmailIdentity(
  targetEmail: string,
  targetPassword: string,
  tryLegacyMigration = false
): Promise<User> {
  try {
    const cred = await signInWithEmailAndPassword(
      auth,
      targetEmail,
      targetPassword
    );
    return cred.user;
  } catch (err) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code)
        : '';

    if (
      code === 'auth/invalid-credential' ||
      code === 'auth/wrong-password' ||
      code === 'auth/user-not-found'
    ) {
      if (tryLegacyMigration) {
        for (const legacyPass of LEGACY_ADMIN_PASSWORDS_FOR_MIGRATION) {
          try {
            const legacyCred = await signInWithEmailAndPassword(
              auth,
              targetEmail,
              legacyPass
            );
            await updatePassword(legacyCred.user, targetPassword);
            return legacyCred.user;
          } catch {
            // Continue
          }
        }
      }

      const created = await createUserWithEmailAndPassword(
        auth,
        targetEmail,
        targetPassword
      );
      return created.user;
    }

    throw err;
  }
}

async function purgeConflictingAccountsForAdminEmail(
  adminUid: string
): Promise<void> {
  try {
    const staleCourierSnap = await getDocWithRetry(
      doc(db, 'couriers', adminUid),
      'couriers',
      adminUid
    );
    if (staleCourierSnap.exists()) {
      await deleteDoc(doc(db, 'couriers', adminUid)).catch(() => {});
    }
    const staleDirSnap = await getDocWithRetry(
      doc(db, 'courierDirectory', adminUid),
      'courierDirectory',
      adminUid
    );
    if (staleDirSnap.exists()) {
      await deleteDoc(doc(db, 'courierDirectory', adminUid)).catch(() => {});
    }
  } catch {
    // Non-fatal
  }

  try {
    const dirSnap = await getDocsWithRetry(
      query(
        collection(db, 'courierDirectory'),
        where('approvalStatus', 'in', ['pending', 'approved', 'rejected'])
      ),
      'courierDirectory',
      '*'
    );
    await Promise.all(
      dirSnap.docs.map(async (entry) => {
        const candidateId = entry.id;
        try {
          const privateSnap = await getDocWithRetry(
            doc(db, 'couriers', candidateId),
            'couriers',
            candidateId
          );
          const candidateEmail = String(privateSnap.data()?.email ?? '')
            .trim()
            .toLowerCase();
          if (
            candidateId === adminUid ||
            candidateEmail === OFFICIAL_ADMIN_PORTAL_EMAIL
          ) {
            await deleteDoc(doc(db, 'couriers', candidateId)).catch(() => {});
            await deleteDoc(doc(db, 'courierDirectory', candidateId)).catch(
              () => {}
            );
            if (candidateId !== adminUid) {
              await deleteDoc(doc(db, 'users', candidateId)).catch(() => {});
            }
          }
        } catch {
          // Non-fatal
        }
      })
    );
  } catch {
    // Non-fatal
  }
}

export async function signInAndBootstrapAdmin(
  email: string,
  password: string,
  adminBootstrapGate: string
): Promise<User> {
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail !== OFFICIAL_ADMIN_PORTAL_EMAIL) {
    throw new Error('البريد الإلكتروني غير مصرح له بصلاحيات الإدارة.');
  }

  let adminUser: User;

  try {
    adminUser = await signInOrCreateEmailIdentity(
      normalizedEmail,
      password,
      true
    );
  } catch (primaryErr) {
    const primaryCode =
      typeof primaryErr === 'object' &&
      primaryErr !== null &&
      'code' in primaryErr
        ? String((primaryErr as { code?: unknown }).code)
        : '';

    if (
      primaryCode === 'auth/email-already-in-use' ||
      primaryCode === 'auth/invalid-credential' ||
      primaryCode === 'auth/wrong-password'
    ) {
      try {
        adminUser = await signInOrCreateEmailIdentity(
          VERIFIED_ADMIN_FALLBACK_EMAIL,
          password,
          true
        );
      } catch (fallbackErr) {
        const fallbackCode =
          typeof fallbackErr === 'object' &&
          fallbackErr !== null &&
          'code' in fallbackErr
            ? String((fallbackErr as { code?: unknown }).code)
            : '';

        if (
          fallbackCode === 'auth/email-already-in-use' ||
          fallbackCode === 'auth/invalid-credential' ||
          fallbackCode === 'auth/wrong-password'
        ) {
          adminUser = await signInOrCreateEmailIdentity(
            buildDeterministicAdminAliasEmail(password),
            password,
            false
          );
        } else {
          throw fallbackErr;
        }
      }
    } else {
      throw primaryErr;
    }
  }

  const adminDocPath = `admins/${adminUser.uid}`;
  try {
    await waitForFirestoreWarmup();
    const adminRef = doc(db, 'admins', adminUser.uid);
    const existingAdminSnap = await getDocWithRetry(
      adminRef,
      'admins',
      adminUser.uid
    );
    if (!existingAdminSnap.exists()) {
      const batch = writeBatch(db);
      batch.set(adminRef, {
        role: 'admin',
        email: OFFICIAL_ADMIN_PORTAL_EMAIL,
        activationGate: adminBootstrapGate,
        createdAt: serverTimestamp(),
      });
      batch.set(doc(db, 'appConfig', 'bootstrap'), {
        adminUid: adminUser.uid,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    }

    await ensureUserProfileDoc(adminUser.uid, 'admin', {
      email: OFFICIAL_ADMIN_PORTAL_EMAIL,
      name: 'إدارة إدكاوي المركزية',
    });

    await purgeConflictingAccountsForAdminEmail(adminUser.uid);
    writeCachedUserRole(adminUser.uid, 'admin');
    return adminUser;
  } catch (error) {
    logFirestoreFailure('admins', adminUser.uid, 'signInAndBootstrapAdmin', error);
    handleFirestoreError(error, OperationType.WRITE, adminDocPath);
  }
}

export async function registerCourierAccount(
  input: CourierRegisterInput,
  referralCode?: string
): Promise<User> {
  const validation = validateCourierRegistrationForm(input);
  if (!validation.valid) {
    throw new Error(Object.values(validation.errors)[0]);
  }

  const normalizedEmail = input.email.trim().toLowerCase();
  if (normalizedEmail === OFFICIAL_ADMIN_PORTAL_EMAIL) {
    throw new Error('هذا البريد الإلكتروني مخصص حصرياً للإدارة.');
  }

  const candidateRef = (
    referralCode?.trim() || readPendingSessionReferralCode()
  )
    .toUpperCase()
    .trim();
  const resolvedRef = candidateRef
    ? await resolveReferralCodeInFirestore(candidateRef).catch(() => null)
    : null;

  const credential = await createUserWithEmailAndPassword(
    auth,
    normalizedEmail,
    input.password
  );
  const uid = credential.user.uid;
  const courierPath = `couriers/${uid}`;
  const coords = isValidEdkuCoordPair(input.lat, input.lng)
    ? { lat: Number(input.lat!.toFixed(6)), lng: Number(input.lng!.toFixed(6)) }
    : resolveEdkuCoordsForNeighborhood(input.neighborhood);

  try {
    await waitForFirestoreWarmup();
    const batch = writeBatch(db);
    batch.set(doc(db, 'couriers', uid), {
      name: input.name.trim().slice(0, 80),
      phone: normalizeEgyptPhoneOrEmpty(input.phone),
      email: normalizedEmail.slice(0, 100),
      vehicleType: input.vehicleType,
      neighborhood: input.neighborhood.trim().slice(0, 80),
      lat: coords.lat,
      lng: coords.lng,
      isAvailable: false,
      approvalStatus: 'pending',
      completedDeliveries: 0,
      updatedBy: uid,
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'courierDirectory', uid), {
      name: input.name.trim().slice(0, 80),
      vehicleType: input.vehicleType,
      neighborhood: input.neighborhood.trim().slice(0, 80),
      lat: coords.lat,
      lng: coords.lng,
      isAvailable: false,
      approvalStatus: 'pending',
      completedDeliveries: 0,
      updatedBy: uid,
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'users', uid), {
      role: 'courier',
      email: normalizedEmail.slice(0, 100),
      name: input.name.trim().slice(0, 80),
      ...(resolvedRef
        ? {
            referredByCode: resolvedRef.code,
            referredByAgentId: resolvedRef.agentId,
          }
        : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    void syncRegisteredAccountMarker(normalizedEmail, 'courier');
    if (resolvedRef) {
      await recordReferralOnSignupBestEffort({
        agentId: resolvedRef.agentId,
        referralCode: resolvedRef.code,
        referredUid: uid,
        accountName: input.name.trim().slice(0, 80),
        accountType: 'courier',
      });
      clearPendingSessionReferralCode();
    }
    return credential.user;
  } catch (error) {
    logFirestoreFailure('couriers', uid, 'registerCourierAccount', error);
    handleFirestoreError(error, OperationType.CREATE, courierPath);
  }
}

const ROLE_SESSION_CACHE_KEY = 'edkawy_verified_role_v2';

function readCachedUserRole(uid: string): PortalRole | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(ROLE_SESSION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { uid?: string; role?: string };
    if (
      parsed.uid === uid &&
      (parsed.role === 'admin' ||
        parsed.role === 'support_agent' ||
        parsed.role === 'operations' ||
        parsed.role === 'sales_agent' ||
        parsed.role === 'store' ||
        parsed.role === 'courier' ||
        parsed.role === 'customer')
    ) {
      return parsed.role;
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

function writeCachedUserRole(uid: string, role: PortalRole): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      ROLE_SESSION_CACHE_KEY,
      JSON.stringify({ uid, role })
    );
  } catch {
    // Ignore storage errors
  }
}

function isTransientFirestoreOfflineError(err: unknown): boolean {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code)
      : '';
  const msg = err instanceof Error ? err.message.toLowerCase() : '';
  return (
    code === 'unavailable' ||
    msg.includes('client is offline') ||
    msg.includes('could not reach cloud firestore')
  );
}

async function getDocWithRetry(
  ref: DocumentReference<DocumentData>,
  collectionOverride?: string,
  documentOverride?: string
): Promise<DocumentSnapshot<DocumentData>> {
  const parsed = splitFirestorePath(ref.path);
  const collectionId = collectionOverride ?? parsed.collectionId;
  const documentId = documentOverride ?? parsed.documentId;

  await waitForFirestoreWarmup();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await getDoc(ref);
    } catch (err) {
      if (attempt < 2 && isTransientFirestoreOfflineError(err)) {
        await enableNetwork(db).catch(() => {});
        await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
        continue;
      }
      logFirestoreFailure(collectionId, documentId, 'getDoc', err);
      throw err;
    }
  }
  throw new Error('Failed to read document after retries.');
}

async function getDocsWithRetry(
  q: Query<DocumentData>,
  collectionId = 'query',
  documentId = '*'
): Promise<QuerySnapshot<DocumentData>> {
  await waitForFirestoreWarmup();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await getDocs(q);
    } catch (err) {
      if (attempt < 2 && isTransientFirestoreOfflineError(err)) {
        await enableNetwork(db).catch(() => {});
        await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
        continue;
      }
      logFirestoreFailure(collectionId, documentId, 'getDocs', err);
      throw err;
    }
  }
  throw new Error('Failed to query collection after retries.');
}

function isArabicBusinessError(err: unknown): err is Error {
  return (
    err instanceof Error &&
    /[\u0600-\u06FF]/.test(err.message) &&
    !err.message.trim().startsWith('{')
  );
}

async function runWriteWithNetworkRetry<T>(fn: () => Promise<T>): Promise<T> {
  await waitForFirestoreWarmup();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === 0 && isTransientFirestoreOfflineError(err)) {
        await enableNetwork(db).catch(() => {});
        await new Promise((resolve) => setTimeout(resolve, 700));
        continue;
      }
      throw err;
    }
  }
  throw new Error('تعذر إتمام العملية بعد إعادة المحاولة.');
}

export async function resolveUserPortalRole(user: User): Promise<PortalRole> {
  if (user.isAnonymous) {
    return 'customer';
  }

  await waitForFirestoreWarmup();
  const normalizedEmail = (user.email ?? '').trim().toLowerCase();
  let hadTransientOfflineFailure = false;

  // 1. Authoritative Admin Registry (/admins/{uid})
  try {
    const adminSnap = await getDocWithRetry(
      doc(db, 'admins', user.uid),
      'admins',
      user.uid
    );
    if (adminSnap.exists()) {
      await ensureUserProfileDoc(user.uid, 'admin', {
        email: OFFICIAL_ADMIN_PORTAL_EMAIL,
        name: 'إدارة إدكاوي المركزية',
      });
      writeCachedUserRole(user.uid, 'admin');
      return 'admin';
    }
  } catch (err) {
    if (isTransientFirestoreOfflineError(err)) {
      hadTransientOfflineFailure = true;
    }
  }

  // 1b. Internal Staff Team Registry (/staff/{uid}) — Super Admin, Support Agent, Operations
  try {
    const staffSnap = await getDocWithRetry(
      doc(db, 'staff', user.uid),
      'staff',
      user.uid
    );
    if (staffSnap.exists()) {
      const sd = staffSnap.data() ?? {};
      if (sd.isActive === false) {
        await signOut(auth).catch(() => {});
        throw new Error(
          'تم إيقاف حساب الموظف من قبل الإدارة المركزية. يرجى التواصل مع مدير النظام.'
        );
      }
      const rawStaffRole = String(sd.role ?? '');
      const mappedPortalRole: PortalRole =
        rawStaffRole === 'super_admin'
          ? 'admin'
          : rawStaffRole === 'support_agent'
          ? 'support_agent'
          : 'operations';

      await ensureUserProfileDoc(user.uid, mappedPortalRole, {
        email: normalizedEmail || String(sd.email ?? ''),
        name: String(sd.name ?? user.displayName ?? 'موظف إدكاوي'),
      }).catch(() => {});
      writeCachedUserRole(user.uid, mappedPortalRole);
      return mappedPortalRole;
    }
  } catch (err) {
    if (isArabicBusinessError(err)) {
      throw err;
    }
    if (isTransientFirestoreOfflineError(err)) {
      hadTransientOfflineFailure = true;
    }
  }

  // 2. Authoritative Store Ownership (/stores ownerUid or merchant @adkawy.com createdBy)
  try {
    const ownedStoresSnap = await getDocsWithRetry(
      query(collection(db, 'stores'), where('ownerUid', '==', user.uid)),
      'stores',
      `ownerUid:${user.uid}`
    );
    if (!ownedStoresSnap.empty) {
      const firstStore = ownedStoresSnap.docs[0];
      await ensureUserProfileDoc(user.uid, 'store', {
        email: normalizedEmail,
        name: String(firstStore.data()?.name ?? ''),
        storeId: firstStore.id,
      });
      writeCachedUserRole(user.uid, 'store');
      return 'store';
    }

    if (
      normalizedEmail.endsWith('@adkawy.com') &&
      !isInternalAdminAliasEmail(normalizedEmail)
    ) {
      const createdStoresSnap = await getDocsWithRetry(
        query(collection(db, 'stores'), where('createdBy', '==', user.uid)),
        'stores',
        `createdBy:${user.uid}`
      );
      if (!createdStoresSnap.empty) {
        const firstStore = createdStoresSnap.docs[0];
        await ensureUserProfileDoc(user.uid, 'store', {
          email: normalizedEmail,
          name: String(firstStore.data()?.name ?? ''),
          storeId: firstStore.id,
        });
        writeCachedUserRole(user.uid, 'store');
        return 'store';
      }
    }
  } catch (err) {
    if (isTransientFirestoreOfflineError(err)) {
      hadTransientOfflineFailure = true;
    }
  }

  // 3. Authoritative Courier Fleet Registry (/couriers/{uid})
  if (normalizedEmail !== OFFICIAL_ADMIN_PORTAL_EMAIL) {
    try {
      const courierSnap = await getDocWithRetry(
        doc(db, 'couriers', user.uid),
        'couriers',
        user.uid
      );
      if (courierSnap.exists()) {
        await ensureUserProfileDoc(user.uid, 'courier', {
          email: normalizedEmail,
          name: String(courierSnap.data()?.name ?? ''),
        });
        if (normalizedEmail) {
          void syncRegisteredAccountMarker(normalizedEmail, 'courier');
        }
        writeCachedUserRole(user.uid, 'courier');
        return 'courier';
      }
    } catch (err) {
      if (isTransientFirestoreOfflineError(err)) {
        hadTransientOfflineFailure = true;
      }
    }
  }

  // 3b. Authoritative Sales Agents Registry (/sales_agents/{uid})
  if (normalizedEmail !== OFFICIAL_ADMIN_PORTAL_EMAIL) {
    try {
      const agentSnap = await getDocWithRetry(
        doc(db, 'sales_agents', user.uid),
        'sales_agents',
        user.uid
      );
      if (agentSnap.exists()) {
        const agentData = agentSnap.data() ?? {};
        if (agentData.isActive === false) {
          await signOut(auth).catch(() => {});
          throw new Error(
            'تم إيقاف حساب مسؤول المبيعات مؤقتاً من قبل الإدارة. يرجى التواصل مع مدير النظام.'
          );
        }
        await ensureUserProfileDoc(user.uid, 'sales_agent', {
          email: normalizedEmail || String(agentData.email ?? ''),
          name: String(agentData.name ?? user.displayName ?? 'مسؤول مبيعات'),
          referralCode: String(agentData.referralCode ?? ''),
        }).catch(() => {});
        writeCachedUserRole(user.uid, 'sales_agent');
        return 'sales_agent';
      }
    } catch (err) {
      if (isArabicBusinessError(err)) {
        throw err;
      }
      if (isTransientFirestoreOfflineError(err)) {
        hadTransientOfflineFailure = true;
      }
    }
  }

  // 4. Unified User Profile (/users/{uid})
  try {
    const profileSnap = await getDocWithRetry(
      doc(db, 'users', user.uid),
      'users',
      user.uid
    );
    if (profileSnap.exists()) {
      const roleVal = profileSnap.data()?.role;
      if (
        roleVal === 'store' ||
        roleVal === 'courier' ||
        roleVal === 'sales_agent' ||
        roleVal === 'customer'
      ) {
        if (
          normalizedEmail &&
          (roleVal === 'courier' ||
            roleVal === 'customer' ||
            roleVal === 'store' ||
            roleVal === 'sales_agent')
        ) {
          void syncRegisteredAccountMarker(normalizedEmail, roleVal);
        }
        if (roleVal === 'customer') {
          void syncCustomerDirectoryEntry(user.uid, {
            name: String(profileSnap.data()?.name ?? user.displayName ?? ''),
            neighborhood: String(profileSnap.data()?.defaultNeighborhood ?? ''),
            points: Number(profileSnap.data()?.points ?? 0),
            currentStreak: Number(profileSnap.data()?.currentStreak ?? 0),
          });
        }
        writeCachedUserRole(user.uid, roleVal);
        return roleVal;
      }
    }
  } catch (err) {
    if (isTransientFirestoreOfflineError(err)) {
      hadTransientOfflineFailure = true;
    }
  }

  if (hadTransientOfflineFailure) {
    return readCachedUserRole(user.uid) ?? 'customer';
  }

  await ensureUserProfileDoc(user.uid, 'customer', {
    email: normalizedEmail,
    name: user.displayName ?? undefined,
  });
  writeCachedUserRole(user.uid, 'customer');
  return 'customer';
}

/* ============================================================================
 * ADMIN PORTAL: STORE PROVISIONING, COURIER PROVISIONING & DEMO PURGE
 * ========================================================================== */

export async function createStoreByAdminInFirestore(
  adminUid: string,
  input: AdminCreateStoreInput
): Promise<StoreCredentialRecord> {
  const validation = validateAdminCreateStoreForm(input);
  if (!validation.valid) {
    throw new Error(Object.values(validation.errors)[0]);
  }

  const cleanImageUrl = sanitizeOptionalImage(input.imageUrl);
  if (!cleanImageUrl) {
    throw new Error('يرجى رفع صورة حقيقية للمتجر من جهازك أولاً.');
  }

  const { loginEmail, generatedPassword } = generateStoreCredentials();
  const ownerUid = await createMerchantAuthUser(loginEmail, generatedPassword);

  const storeName = input.name.trim().slice(0, 80);
  const phone = normalizeEgyptPhoneOrEmpty(input.phone);
  const category = input.category;
  const categoryId = (
    input.categoryId?.trim() || resolveCategoryIdForStoreCategory(category)
  ).slice(0, 40);
  const isHomeFood =
    typeof input.isHomeFood === 'boolean'
      ? input.isHomeFood
      : category === 'أكل بيتي';
  const resolvedCoords = isValidEdkuCoordPair(input.lat, input.lng)
    ? { lat: Number(input.lat!.toFixed(6)), lng: Number(input.lng!.toFixed(6)) }
    : resolveEdkuCoordsForNeighborhood(input.neighborhood ?? EDKU_NEIGHBORHOODS[0]);
  const neighborhood = (
    input.neighborhood?.trim() ||
    resolveNearestEdkuNeighborhood(resolvedCoords.lat, resolvedCoords.lng) ||
    EDKU_NEIGHBORHOODS[0]
  ).slice(0, 80);
  const description = (
    input.description?.trim() ||
    `${storeName} في ${neighborhood} — خدمة سريعة ومميزة عبر تطبيق إدكاوي.`
  ).slice(0, 220);
  const deliveryFee = Math.min(
    250,
    Math.max(0, Math.trunc(Number(input.deliveryFee ?? 15)))
  );
  const deliveryTimeMinutes = Math.min(
    120,
    Math.max(10, Math.trunc(Number(input.deliveryTimeMinutes ?? 25)))
  );
  const imageKey = CATEGORY_TO_STORE_IMAGE[category];
  const firstItemName = (
    input.firstItemName?.trim() ||
    (category === 'صيدليات'
      ? `استشارة وصرف أدوية — ${storeName}`
      : `صنف مميز من ${storeName}`)
  ).slice(0, 80);
  const firstItemPrice = Math.min(
    10000,
    Math.max(1, Math.trunc(Number(input.firstItemPrice ?? 50)))
  );

  const menuItems: MenuItem[] = [
    {
      id: 'item_1',
      name: firstItemName,
      price: firstItemPrice,
    },
  ];

  const newStoreRef = doc(collection(db, 'stores'));
  const credRef = doc(db, 'storeCredentials', newStoreRef.id);
  const userProfileRef = doc(db, 'users', ownerUid);
  const firstProdRef = doc(collection(db, 'products'));

  try {
    await waitForFirestoreWarmup();
    await setDoc(newStoreRef, {
      name: storeName,
      category,
      categoryId,
      isHomeFood,
      neighborhood,
      description,
      deliveryFee,
      deliveryTimeMinutes,
      rating: 5,
      lat: resolvedCoords.lat,
      lng: resolvedCoords.lng,
      imageKey,
      imageUrl: cleanImageUrl,
      isActive: true,
      isOpen: true,
      prepTimeMinutes: deliveryTimeMinutes,
      minOrderAmount: 0,
      menuItems,
      ownerUid,
      createdBy: adminUid,
      createdAt: serverTimestamp(),
    });

    await Promise.all([
      setDoc(credRef, {
        storeId: newStoreRef.id,
        storeName,
        phone,
        loginEmail,
        generatedPassword,
        ownerUid,
        createdBy: adminUid,
        createdAt: serverTimestamp(),
      }),
      setDoc(userProfileRef, {
        role: 'store',
        email: loginEmail,
        name: storeName,
        storeId: newStoreRef.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
      setDoc(firstProdRef, {
        storeId: newStoreRef.id,
        storeOwnerId: ownerUid,
        name: firstItemName,
        description: `${firstItemName} من ${storeName}`.slice(0, 220),
        category: category === 'صيدليات' ? 'عناية وصيدلية' : 'الأكثر طلباً',
        price: firstItemPrice,
        imageKey,
        imageUrl: cleanImageUrl,
        isAvailable: true,
        stockQuantity: 50,
        createdBy: adminUid,
        createdAt: serverTimestamp(),
      }),
    ]);

    return {
      storeId: newStoreRef.id,
      storeName,
      phone,
      loginEmail,
      generatedPassword,
      ownerUid,
      createdBy: adminUid,
      createdAtIso: new Date().toISOString(),
    };
  } catch (error) {
    logFirestoreFailure(
      'stores',
      newStoreRef.id,
      'createStoreByAdminInFirestore',
      error
    );
    handleFirestoreError(error, OperationType.CREATE, 'stores');
  }
}

export async function createCourierByAdminInFirestore(
  _adminUid: string,
  input: AdminCreateCourierInput
): Promise<CourierCredentialRecord> {
  const validation = validateCourierRegistrationForm(input);
  if (!validation.valid) {
    throw new Error(Object.values(validation.errors)[0]);
  }

  const normalizedEmail = input.email.trim().toLowerCase();
  if (normalizedEmail === OFFICIAL_ADMIN_PORTAL_EMAIL) {
    throw new Error('لا يمكن استخدام البريد الرسمي للإدارة في حساب مندوب.');
  }

  const courierUid = await createSecondaryAuthUser(
    normalizedEmail,
    input.password
  );
  const cleanName = input.name.trim().slice(0, 80);
  const cleanPhone = normalizeEgyptPhoneOrEmpty(input.phone);
  const coords = isValidEdkuCoordPair(input.lat, input.lng)
    ? { lat: Number(input.lat!.toFixed(6)), lng: Number(input.lng!.toFixed(6)) }
    : resolveEdkuCoordsForNeighborhood(input.neighborhood);
  const cleanNeighborhood = (
    input.neighborhood.trim() ||
    resolveNearestEdkuNeighborhood(coords.lat, coords.lng)
  ).slice(0, 80);
  const courierPath = `couriers/${courierUid}`;

  try {
    await waitForFirestoreWarmup();
    const batch = writeBatch(db);
    batch.set(doc(db, 'couriers', courierUid), {
      name: cleanName,
      phone: cleanPhone,
      email: normalizedEmail.slice(0, 100),
      vehicleType: input.vehicleType,
      neighborhood: cleanNeighborhood,
      lat: coords.lat,
      lng: coords.lng,
      isAvailable: true,
      approvalStatus: 'approved',
      completedDeliveries: 0,
      updatedBy: courierUid,
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'courierDirectory', courierUid), {
      name: cleanName,
      vehicleType: input.vehicleType,
      neighborhood: cleanNeighborhood,
      lat: coords.lat,
      lng: coords.lng,
      isAvailable: true,
      approvalStatus: 'approved',
      completedDeliveries: 0,
      updatedBy: courierUid,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    await setDoc(doc(db, 'users', courierUid), {
      role: 'courier',
      email: normalizedEmail.slice(0, 100),
      name: cleanName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return {
      courierId: courierUid,
      name: cleanName,
      phone: cleanPhone,
      loginEmail: normalizedEmail,
      password: input.password,
    };
  } catch (error) {
    logFirestoreFailure(
      'couriers',
      courierUid,
      'createCourierByAdminInFirestore',
      error
    );
    handleFirestoreError(error, OperationType.CREATE, courierPath);
  }
}

export async function purgeDemoDataByAdminInFirestore(): Promise<number> {
  await waitForFirestoreWarmup();
  let deletedCount = 0;
  let firstFailure: { col: string; id: string; err: unknown } | null = null;

  const targets: Array<{ col: string; id: string }> = [
    ...LEGACY_DEMO_STORE_IDS.map((id) => ({ col: 'stores', id })),
    ...LEGACY_DEMO_PRODUCT_IDS.map((id) => ({ col: 'products', id })),
    ...LEGACY_DEMO_AD_IDS.map((id) => ({ col: 'ads', id })),
    ...LEGACY_DEMO_COUPON_IDS.map((id) => ({ col: 'coupons', id })),
  ];

  for (const t of targets) {
    try {
      const ref = doc(db, t.col, t.id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await deleteDoc(ref);
        deletedCount += 1;
      }
    } catch (err) {
      logFirestoreFailure(t.col, t.id, 'purgeDemoDataByAdmin', err);
      if (!firstFailure) {
        firstFailure = { col: t.col, id: t.id, err };
      }
    }
  }

  if (deletedCount > 0) {
    void recordAuditLogInFirestore({
      actionType: 'purge_test_data',
      details: `تم مسح ${deletedCount} من البيانات التجريبية القديمة.`,
    });
  }

  if (firstFailure) {
    handleFirestoreError(
      firstFailure.err,
      OperationType.DELETE,
      `${firstFailure.col}/${firstFailure.id}`
    );
  }

  return deletedCount;
}

export async function fetchStoreCredentialsMapForAdmin(
  storeIds: string[]
): Promise<Record<string, StoreCredentialRecord>> {
  const map: Record<string, StoreCredentialRecord> = {};
  await Promise.all(
    storeIds.map(async (storeId) => {
      if (!isValidFirestoreId(storeId)) return;
      try {
        const snap = await getDocWithRetry(
          doc(db, 'storeCredentials', storeId),
          'storeCredentials',
          storeId
        );
        if (snap.exists()) {
          const d = snap.data();
          map[storeId] = {
            storeId: String(d.storeId ?? storeId),
            storeName: String(d.storeName ?? ''),
            phone: String(d.phone ?? ''),
            loginEmail: String(d.loginEmail ?? ''),
            generatedPassword: String(d.generatedPassword ?? ''),
            ownerUid: String(d.ownerUid ?? ''),
            createdBy: String(d.createdBy ?? ''),
            createdAtIso: toIsoString(d.createdAt),
          };
        }
      } catch (err) {
        logFirestoreFailure(
          'storeCredentials',
          storeId,
          'fetchStoreCredentialsMapForAdmin',
          err
        );
      }
    })
  );
  return map;
}

export async function approveCourierByAdminInFirestore(
  courierId: string,
  nextStatus: CourierApprovalStatus = 'approved'
): Promise<void> {
  const courierPath = `couriers/${courierId}`;
  const isApproved = nextStatus === 'approved';
  try {
    await waitForFirestoreWarmup();
    const userRef = doc(db, 'users', courierId);
    const courierRef = doc(db, 'couriers', courierId);
    const dirRef = doc(db, 'courierDirectory', courierId);
    const [courierSnap, dirSnap] = await Promise.all([
      getDocWithRetry(courierRef, 'couriers', courierId),
      getDocWithRetry(dirRef, 'courierDirectory', courierId),
    ]);
    const courierData = courierSnap.data();
    const dirData = dirSnap.data();
    const fallbackName = String(
      courierData?.name ?? dirData?.name ?? 'مندوب إدكاوي'
    ).slice(0, 80);
    const fallbackVehicle =
      courierData?.vehicleType ?? dirData?.vehicleType ?? 'دراجة نارية';
    const fallbackArea = String(
      courierData?.neighborhood ?? dirData?.neighborhood ?? 'شارع البحر'
    ).slice(0, 80);
    const fallbackPhone = normalizeEgyptPhoneOrEmpty(
      String(courierData?.phone ?? '01000000000')
    );

    const batch = writeBatch(db);
    if (courierSnap.exists()) {
      batch.update(courierRef, {
        approvalStatus: nextStatus,
        isAvailable: isApproved,
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(courierRef, {
        name: fallbackName,
        phone: EGYPT_PHONE_REGEX.test(fallbackPhone)
          ? fallbackPhone
          : '01000000000',
        vehicleType: fallbackVehicle,
        neighborhood: fallbackArea,
        isAvailable: isApproved,
        approvalStatus: nextStatus,
        completedDeliveries: Math.max(
          0,
          Math.trunc(Number(dirData?.completedDeliveries ?? 0))
        ),
        updatedBy: courierId,
        updatedAt: serverTimestamp(),
      });
    }

    if (dirSnap.exists()) {
      batch.update(dirRef, {
        approvalStatus: nextStatus,
        isAvailable: isApproved,
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(dirRef, {
        name: fallbackName,
        vehicleType: fallbackVehicle,
        neighborhood: fallbackArea,
        isAvailable: isApproved,
        approvalStatus: nextStatus,
        completedDeliveries: Math.max(
          0,
          Math.trunc(Number(courierData?.completedDeliveries ?? 0))
        ),
        updatedBy: courierId,
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();

    // Best-effort role sync on /users/{courierId} when caller is Super Admin
    try {
      const existingUserSnap = await getDoc(userRef);
      if (existingUserSnap.exists()) {
        await updateDoc(userRef, {
          role: 'courier',
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(userRef, {
          role: 'courier',
          ...(typeof courierData?.email === 'string' && courierData.email
            ? { email: courierData.email.slice(0, 100) }
            : {}),
          name: fallbackName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch {
      // Operations staff does not read/write PII /users; courier self-syncs on login
    }

    void createNotificationBestEffort(courierId, {
      title: isApproved
        ? 'تم اعتماد حسابك ككابتن توصيل في إدكاوي!'
        : 'تم تحديث حالة مراجعة حسابك في إدكاوي',
      body: isApproved
        ? 'يمكنك الآن تفعيل حالة الاتصال واستلام الطلبات في مدينة إدكو.'
        : 'يرجى التواصل مع الدعم الفني في إدكاوي لمراجعة بيانات حساب الكابتن.',
      type: 'system',
    });

    void recordAuditLogInFirestore({
      actionType: 'approve_courier',
      targetId: courierId,
      details: `${isApproved ? 'اعتماد' : 'تحديث حالة'} حساب المندوب "${fallbackName}" (${nextStatus}).`,
    });
  } catch (error) {
    logFirestoreFailure(
      'couriers',
      courierId,
      'approveCourierByAdminInFirestore',
      error
    );
    handleFirestoreError(error, OperationType.UPDATE, courierPath);
  }
}

/* ============================================================================
 * STORES, PRODUCTS & INVENTORY LISTENERS + MUTATIONS
 * ========================================================================== */

export function listenToStores(
  onStoresUpdate: (stores: StoreRecord[]) => void,
  onErrorCallback?: (err: Error) => void
): Unsubscribe {
  const storesPath = 'stores';
  const activeStoresQuery = query(
    collection(db, storesPath),
    where('isActive', '==', true)
  );

  let receivedServerSnapshot = false;
  let emptyCacheTimer: ReturnType<typeof setTimeout> | null = null;

  const clearEmptyCacheTimer = () => {
    if (emptyCacheTimer !== null) {
      clearTimeout(emptyCacheTimer);
      emptyCacheTimer = null;
    }
  };

  const unsub = onSnapshot(
    activeStoresQuery,
    { includeMetadataChanges: true },
    (snapshot) => {
      if (!snapshot.metadata.fromCache) {
        receivedServerSnapshot = true;
        clearEmptyCacheTimer();
      }

      if (
        snapshot.empty &&
        snapshot.metadata.fromCache &&
        !receivedServerSnapshot
      ) {
        if (emptyCacheTimer === null) {
          emptyCacheTimer = setTimeout(() => {
            emptyCacheTimer = null;
            if (!receivedServerSnapshot) {
              onStoresUpdate([]);
            }
          }, 3000);
        }
        return;
      }

      const items = snapshot.docs.map(parseStoreSnapshotDoc);
      items.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      onStoresUpdate(items);
    },
    (error) => {
      clearEmptyCacheTimer();
      logFirestoreFailure('stores', '*', 'listenToStores', error);
      onErrorCallback?.(error instanceof Error ? error : new Error(String(error)));
    }
  );

  return () => {
    clearEmptyCacheTimer();
    unsub();
  };
}

export function listenToMerchantStores(
  merchantUid: string,
  onStoresUpdate: (stores: StoreRecord[]) => void,
  onErrorCallback?: (err: Error) => void
): Unsubscribe {
  const storesPath = 'stores';
  let byOwnerMap = new Map<string, StoreRecord>();
  let byCreatorMap = new Map<string, StoreRecord>();

  const emitMerged = () => {
    const combined = new Map<string, StoreRecord>([
      ...byOwnerMap,
      ...byCreatorMap,
    ]);
    const list = Array.from(combined.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'ar')
    );
    onStoresUpdate(list);
  };

  const handleErr = (docScope: string) => (error: unknown) => {
    logFirestoreFailure('stores', docScope, 'listenToMerchantStores', error);
    onErrorCallback?.(error instanceof Error ? error : new Error(String(error)));
  };

  const unsubOwner = onSnapshot(
    query(collection(db, storesPath), where('ownerUid', '==', merchantUid)),
    (snap) => {
      byOwnerMap = new Map(
        snap.docs.map((d) => [d.id, parseStoreSnapshotDoc(d)])
      );
      emitMerged();
    },
    handleErr(`ownerUid:${merchantUid}`)
  );

  const unsubCreator = onSnapshot(
    query(collection(db, storesPath), where('createdBy', '==', merchantUid)),
    (snap) => {
      byCreatorMap = new Map(
        snap.docs.map((d) => [d.id, parseStoreSnapshotDoc(d)])
      );
      emitMerged();
    },
    handleErr(`createdBy:${merchantUid}`)
  );

  return () => {
    unsubOwner();
    unsubCreator();
  };
}

export function listenToAdminStores(
  _adminUid: string,
  onStoresUpdate: (stores: StoreRecord[]) => void,
  onErrorCallback?: (err: Error) => void
): Unsubscribe {
  const storesPath = 'stores';
  const q = query(
    collection(db, storesPath),
    where('isActive', 'in', [true, false])
  );

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map(parseStoreSnapshotDoc)
        .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      onStoresUpdate(list);
    },
    (error) => {
      logFirestoreFailure('stores', 'admin_all', 'listenToAdminStores', error);
      onErrorCallback?.(error instanceof Error ? error : new Error(String(error)));
    }
  );
}

export function listenToStoreProducts(
  storeId: string,
  onProductsUpdate: (products: ProductRecord[]) => void,
  onErrorCallback?: (err: Error) => void
): Unsubscribe {
  const productsPath = 'products';
  const storeProductsQuery = query(
    collection(db, productsPath),
    where('storeId', '==', storeId),
    where('isAvailable', 'in', [true, false])
  );

  return onSnapshot(
    storeProductsQuery,
    (snapshot) => {
      const items = snapshot.docs.map((d) =>
        parseProductSnapshotDoc(d, storeId)
      );
      items.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      onProductsUpdate(items);
    },
    (error) => {
      logFirestoreFailure(
        'products',
        `storeId:${storeId}`,
        'listenToStoreProducts',
        error
      );
      onErrorCallback?.(error instanceof Error ? error : new Error(String(error)));
    }
  );
}

export function listenToMysteryBoxProducts(
  onProductsUpdate: (products: ProductRecord[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'products'),
    where('isMysteryBox', '==', true),
    where('isAvailable', '==', true)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => parseProductSnapshotDoc(d, ''))
        .filter((p) => p.stockQuantity === undefined || p.stockQuantity > 0);
      onProductsUpdate(items);
    },
    () => {
      onProductsUpdate([]);
    }
  );
}

export function listenToMerchantStoreProducts(
  storeId: string,
  _merchantUid: string,
  onProductsUpdate: (products: ProductRecord[]) => void,
  onErrorCallback?: (err: Error) => void
): Unsubscribe {
  return listenToStoreProducts(storeId, onProductsUpdate, onErrorCallback);
}

function sanitizeProductVariantsInput(
  rawVariants: ProductVariant[] | undefined,
  fallbackPrice: number
): ProductVariant[] {
  if (!Array.isArray(rawVariants) || rawVariants.length === 0) {
    return [];
  }
  return rawVariants
    .map((v, idx): ProductVariant | null => {
      const size = v.size?.trim() ? v.size.trim().slice(0, 40) : undefined;
      const color = v.color?.trim() ? v.color.trim().slice(0, 40) : undefined;
      const shade = v.shade?.trim() ? v.shade.trim().slice(0, 40) : undefined;
      const autoLabel = [size, color, shade].filter(Boolean).join(' · ');
      const cleanName = (v.name?.trim() || autoLabel || `خيار ${idx + 1}`).slice(
        0,
        80
      );
      if (!cleanName) return null;
      const cleanPrice = Math.min(
        20000,
        Math.max(
          1,
          Math.trunc(Number(Number.isFinite(Number(v.price)) ? v.price : fallbackPrice))
        )
      );
      const cleanStock = Math.min(
        100000,
        Math.max(0, Math.trunc(Number(v.stock ?? 0)))
      );
      const cleanId = (
        v.variantId?.trim().replace(/[^a-zA-Z0-9_-]/g, '') || `var_${idx + 1}`
      ).slice(0, 64);
      return {
        variantId: cleanId,
        name: cleanName,
        ...(size ? { size } : {}),
        ...(color ? { color } : {}),
        ...(shade ? { shade } : {}),
        price: cleanPrice,
        stock: cleanStock,
      };
    })
    .filter((item): item is ProductVariant => item !== null)
    .slice(0, 25);
}

export async function addProductToFirestore(
  input: NewProductInput,
  currentUserUid: string,
  storeOwnerId?: string
): Promise<string> {
  const validation = validateNewProductForm(input);
  if (!validation.valid) {
    throw new Error(Object.values(validation.errors)[0]);
  }

  const cleanImageUrl = sanitizeOptionalImage(input.imageUrl);
  if (!cleanImageUrl) {
    throw new Error('يرجى رفع صورة حقيقية للمنتج من جهازك أولاً.');
  }

  const productsPath = 'products';
  const effectiveOwnerId = storeOwnerId || currentUserUid;
  const basePrice = Math.min(20000, Math.max(1, Math.trunc(Number(input.price))));
  const cleanVariants = input.hasVariants
    ? sanitizeProductVariantsInput(input.variants, basePrice)
    : [];
  const hasVariants = cleanVariants.length > 0;
  const effectiveBasePrice = hasVariants
    ? Math.min(...cleanVariants.map((v) => v.price))
    : basePrice;

  const stockQuantity = hasVariants
    ? Math.min(
        100000,
        cleanVariants.reduce((sum, v) => sum + v.stock, 0)
      )
    : input.stockQuantity !== undefined && !Number.isNaN(Number(input.stockQuantity))
    ? Math.max(0, Math.min(100000, Math.trunc(Number(input.stockQuantity))))
    : 25;

  try {
    await waitForFirestoreWarmup();
    const docRef = await addDoc(collection(db, productsPath), {
      storeId: input.storeId,
      ...(isValidFirestoreId(effectiveOwnerId)
        ? { storeOwnerId: effectiveOwnerId }
        : {}),
      name: input.name.trim().slice(0, 80),
      description: input.description.trim().slice(0, 220),
      category: input.category.trim().slice(0, 40),
      price: effectiveBasePrice,
      imageKey: input.imageKey ?? 'seafood',
      imageUrl: cleanImageUrl,
      isAvailable: stockQuantity > 0,
      stockQuantity,
      ...(hasVariants
        ? {
            hasVariants: true,
            variants: cleanVariants,
          }
        : {}),
      ...(input.isMysteryBox
        ? {
            isMysteryBox: true,
            originalValueEgp: Math.max(
              effectiveBasePrice,
              Math.trunc(
                Number(input.originalValueEgp ?? effectiveBasePrice * 1.4)
              )
            ),
          }
        : {}),
      ...(input.isFlashSale
        ? {
            isFlashSale: true,
            flashDiscountPercent: Math.min(
              90,
              Math.max(5, Math.trunc(Number(input.flashDiscountPercent ?? 20)))
            ),
            flashSaleEndsAtIso: (
              input.flashSaleEndsAtIso?.trim() ||
              new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
            ).slice(0, 40),
          }
        : {}),
      createdBy: currentUserUid,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    logFirestoreFailure(productsPath, '*', 'addProductToFirestore', error);
    handleFirestoreError(error, OperationType.CREATE, productsPath);
  }
}

export async function updateProductFlashSaleInFirestore(
  productId: string,
  input: {
    isFlashSale: boolean;
    flashDiscountPercent?: number;
    flashSaleEndsAtIso?: string;
  }
): Promise<void> {
  const prodPath = `products/${productId}`;
  try {
    await waitForFirestoreWarmup();
    await updateDoc(doc(db, 'products', productId), {
      isFlashSale: Boolean(input.isFlashSale),
      flashDiscountPercent: input.isFlashSale
        ? Math.min(90, Math.max(5, Math.trunc(Number(input.flashDiscountPercent ?? 20))))
        : 0,
      flashSaleEndsAtIso: input.isFlashSale
        ? (
            input.flashSaleEndsAtIso?.trim() ||
            new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
          ).slice(0, 40)
        : '',
    });
  } catch (error) {
    logFirestoreFailure('products', productId, 'updateProductFlashSaleInFirestore', error);
    handleFirestoreError(error, OperationType.UPDATE, prodPath);
  }
}

export async function toggleProductAvailableInFirestore(
  productId: string,
  nextAvailable: boolean
): Promise<void> {
  const prodPath = `products/${productId}`;
  try {
    await waitForFirestoreWarmup();
    await updateDoc(doc(db, 'products', productId), {
      isAvailable: Boolean(nextAvailable),
    });
  } catch (error) {
    logFirestoreFailure(
      'products',
      productId,
      'toggleProductAvailableInFirestore',
      error
    );
    handleFirestoreError(error, OperationType.UPDATE, prodPath);
  }
}

export async function updateProductStockInFirestore(
  productId: string,
  nextStockQuantity: number
): Promise<void> {
  const clamped = Math.max(0, Math.min(100000, Math.trunc(nextStockQuantity)));
  const prodPath = `products/${productId}`;
  try {
    await waitForFirestoreWarmup();
    await updateDoc(doc(db, 'products', productId), {
      stockQuantity: clamped,
      isAvailable: clamped > 0,
    });
  } catch (error) {
    logFirestoreFailure(
      'products',
      productId,
      'updateProductStockInFirestore',
      error
    );
    handleFirestoreError(error, OperationType.UPDATE, prodPath);
  }
}

export async function updateProductVariantsInFirestore(
  productId: string,
  variants: ProductVariant[]
): Promise<void> {
  const cleanVariants = sanitizeProductVariantsInput(variants, 50);
  if (cleanVariants.length === 0) {
    throw new Error('يرجى إضافة خيار واحد على الأقل مع السعر والكمية.');
  }
  const totalStock = Math.min(
    100000,
    cleanVariants.reduce((sum, v) => sum + v.stock, 0)
  );
  const minPrice = Math.min(...cleanVariants.map((v) => v.price));
  const prodPath = `products/${productId}`;
  try {
    await waitForFirestoreWarmup();
    await updateDoc(doc(db, 'products', productId), {
      hasVariants: true,
      variants: cleanVariants,
      price: minPrice,
      stockQuantity: totalStock,
      isAvailable: totalStock > 0,
    });
  } catch (error) {
    logFirestoreFailure(
      'products',
      productId,
      'updateProductVariantsInFirestore',
      error
    );
    handleFirestoreError(error, OperationType.UPDATE, prodPath);
  }
}

export async function addStoreToFirestore(
  input: NewStoreInput,
  currentUserUid: string
): Promise<string> {
  const validation = validateNewStoreForm(input);
  if (!validation.valid) {
    throw new Error(Object.values(validation.errors)[0]);
  }
  const cleanImageUrl = sanitizeOptionalImage(input.imageUrl);
  if (!cleanImageUrl) {
    throw new Error('يرجى رفع صورة حقيقية للمتجر من جهازك أولاً.');
  }

  const storesPath = 'stores';
  const menuItems: MenuItem[] = [
    {
      id: 'item_1',
      name: input.firstItemName.trim().slice(0, 80),
      price: Math.trunc(Number(input.firstItemPrice)),
    },
  ];

  if (input.secondItemName && input.secondItemName.trim().length >= 2) {
    menuItems.push({
      id: 'item_2',
      name: input.secondItemName.trim().slice(0, 80),
      price: Math.trunc(Number(input.secondItemPrice)),
    });
  }

  const coords = isValidEdkuCoordPair(input.lat, input.lng)
    ? { lat: Number(input.lat!.toFixed(6)), lng: Number(input.lng!.toFixed(6)) }
    : resolveEdkuCoordsForNeighborhood(input.neighborhood);

  const resolvedImageKey: StoreImageKey =
    input.imageKey || resolveStoreImageKeyForCategory(input.category);
  const categoryId = (
    input.categoryId?.trim() || resolveCategoryIdForStoreCategory(input.category)
  ).slice(0, 40);
  const isHomeFood =
    typeof input.isHomeFood === 'boolean'
      ? input.isHomeFood
      : input.category === 'أكل بيتي';

  const newStoreRef = doc(collection(db, storesPath));
  try {
    await waitForFirestoreWarmup();
    const batch = writeBatch(db);
    batch.set(newStoreRef, {
      name: input.name.trim().slice(0, 80),
      category: input.category,
      categoryId,
      isHomeFood,
      neighborhood: input.neighborhood.trim().slice(0, 80),
      description: input.description.trim().slice(0, 220),
      deliveryFee: Math.trunc(Number(input.deliveryFee)),
      deliveryTimeMinutes: Math.trunc(Number(input.deliveryTimeMinutes)),
      rating: 5,
      lat: coords.lat,
      lng: coords.lng,
      imageKey: resolvedImageKey,
      imageUrl: cleanImageUrl,
      isActive: true,
      isOpen: true,
      prepTimeMinutes: Math.trunc(Number(input.deliveryTimeMinutes)),
      minOrderAmount: 0,
      menuItems,
      ownerUid: currentUserUid,
      createdBy: currentUserUid,
      createdAt: serverTimestamp(),
    });

    menuItems.forEach((m, idx) => {
      const prodRef = doc(collection(db, 'products'));
      batch.set(prodRef, {
        storeId: newStoreRef.id,
        storeOwnerId: currentUserUid,
        name: m.name,
        description: `${m.name} من ${input.name.trim()}`.slice(0, 220),
        category: idx === 0 ? 'الأكثر طلباً' : input.category,
        price: m.price,
        imageKey: resolvedImageKey,
        imageUrl: cleanImageUrl,
        isAvailable: true,
        stockQuantity: 30,
        createdBy: currentUserUid,
        createdAt: serverTimestamp(),
      });
    });

    await batch.commit();
    return newStoreRef.id;
  } catch (error) {
    logFirestoreFailure(
      storesPath,
      newStoreRef.id,
      'addStoreToFirestore',
      error
    );
    handleFirestoreError(error, OperationType.CREATE, storesPath);
  }
}

export async function toggleStoreActiveInFirestore(
  storeId: string,
  nextIsActive: boolean,
  storeName?: string
): Promise<void> {
  const storePath = `stores/${storeId}`;
  try {
    await waitForFirestoreWarmup();
    await updateDoc(doc(db, 'stores', storeId), {
      isActive: Boolean(nextIsActive),
    });
    void recordAuditLogInFirestore({
      actionType: nextIsActive ? 'approve_store' : 'toggle_store_active',
      targetId: storeId,
      details: `${nextIsActive ? 'قبول وتفعيل' : 'إيقاف عرض'} المتجر "${storeName || storeId}".`,
    });
  } catch (error) {
    logFirestoreFailure(
      'stores',
      storeId,
      'toggleStoreActiveInFirestore',
      error
    );
    handleFirestoreError(error, OperationType.UPDATE, storePath);
  }
}

export async function toggleStoreOpenInFirestore(
  storeId: string,
  nextIsOpen: boolean
): Promise<void> {
  const storePath = `stores/${storeId}`;
  try {
    await waitForFirestoreWarmup();
    await updateDoc(doc(db, 'stores', storeId), {
      isOpen: Boolean(nextIsOpen),
    });
  } catch (error) {
    logFirestoreFailure('stores', storeId, 'toggleStoreOpenInFirestore', error);
    handleFirestoreError(error, OperationType.UPDATE, storePath);
  }
}

export async function updateStoreSettingsInFirestore(
  storeId: string,
  settings: StoreOperationalSettingsInput & { imageUrl?: string }
): Promise<void> {
  const validation = validateStoreSettingsForm(settings);
  if (!validation.valid) {
    throw new Error(Object.values(validation.errors)[0]);
  }

  const storePath = `stores/${storeId}`;
  const clampedPrep = Math.min(
    180,
    Math.max(5, Math.trunc(Number(settings.prepTimeMinutes)))
  );
  const clampedMinOrder = Math.min(
    5000,
    Math.max(0, Math.trunc(Number(settings.minOrderAmount)))
  );

  const patch: Record<string, unknown> = {
    prepTimeMinutes: clampedPrep,
    minOrderAmount: clampedMinOrder,
    isOpen: Boolean(settings.isOpen),
  };

  if (typeof settings.isManuallyClosed === 'boolean') {
    patch.isManuallyClosed = settings.isManuallyClosed;
  }
  if (typeof settings.openingTime === 'string' && settings.openingTime.trim()) {
    patch.openingTime = settings.openingTime.trim().slice(0, 10);
  }
  if (typeof settings.closingTime === 'string' && settings.closingTime.trim()) {
    patch.closingTime = settings.closingTime.trim().slice(0, 10);
  }
  if (typeof settings.isHomeFood === 'boolean') {
    patch.isHomeFood = settings.isHomeFood;
  }
  if (settings.categoryId?.trim()) {
    patch.categoryId = settings.categoryId.trim().slice(0, 40);
  }
  if (isValidEdkuCoordPair(settings.lat, settings.lng)) {
    patch.lat = Number(settings.lat!.toFixed(6));
    patch.lng = Number(settings.lng!.toFixed(6));
  }
  if (settings.neighborhood?.trim()) {
    patch.neighborhood = settings.neighborhood.trim().slice(0, 80);
  }
  const cleanImg = sanitizeOptionalImage(settings.imageUrl);
  if (cleanImg) {
    patch.imageUrl = cleanImg;
  }

  try {
    await waitForFirestoreWarmup();
    await updateDoc(doc(db, 'stores', storeId), patch);
  } catch (error) {
    logFirestoreFailure(
      'stores',
      storeId,
      'updateStoreSettingsInFirestore',
      error
    );
    handleFirestoreError(error, OperationType.UPDATE, storePath);
  }
}

/* ============================================================================
 * ORDERS, PHARMACY 4-STAGE WORKFLOW & DISPATCH QUEUE
 * ========================================================================== */

export async function placeOrderInFirestore(
  currentUserUid: string,
  cart: CartItem[],
  checkout: CheckoutFormInput,
  storeNeighborhood = 'شارع البحر',
  storeOwnerId?: string,
  storeConstraints?: {
    isOpen?: boolean;
    minOrderAmount?: number;
    lat?: number;
    lng?: number;
  },
  appliedCoupon?: AppliedCoupon | null,
  groupCartId?: string
): Promise<string> {
  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    throw new Error(
      'يجب تسجيل الدخول بحساب Google أو البريد الإلكتروني أولاً قبل إنشاء أي طلب.'
    );
  }

  if (cart.length === 0) {
    throw new Error('سلة المشتريات فارغة. يرجى اختيار منتج واحد على الأقل.');
  }

  if (storeConstraints && storeConstraints.isOpen === false) {
    throw new Error('المتجر مغلق حالياً ولا يستقبل طلبات جديدة.');
  }

  const allowVisa = checkout.paymentMethod === 'visa';
  const validation = validateCheckoutForm(checkout, { allowVisa });
  if (!validation.valid) {
    throw new Error(Object.values(validation.errors)[0]);
  }

  const effectiveCustomerUid = auth.currentUser.uid || currentUserUid;
  const targetStoreId = cart[0].storeId;
  const normalizedCustomerPhone = normalizeEgyptPhoneOrEmpty(
    checkout.customerPhone
  );

  await waitForFirestoreWarmup();
  await assertSystemWritableForUser(effectiveCustomerUid, {
    storeId: targetStoreId,
    checkMaintenance: true,
  });

  // Verify live free-delivery reward balance if requested
  let canRedeemFreeDelivery = false;
  let prevRewardBalance = 0;
  if (checkout.useFreeDeliveryReward) {
    const [uSnap, dSnap] = await Promise.all([
      getDoc(doc(db, 'users', effectiveCustomerUid)).catch(() => null),
      getDoc(doc(db, 'customerDirectory', effectiveCustomerUid)).catch(
        () => null
      ),
    ]);
    prevRewardBalance = Math.max(
      Math.trunc(Number(uSnap?.data()?.freeDeliveryRewards ?? 0)),
      Math.trunc(Number(dSnap?.data()?.freeDeliveryRewards ?? 0))
    );
    if (prevRewardBalance <= 0) {
      throw new Error('لا يوجد رصيد توصيل مجاني متاح في حسابك حالياً.');
    }
    canRedeemFreeDelivery = true;
  }

  const totals = calculateCartTotals(cart, appliedCoupon, {
    zoneDeliveryFee: checkout.zoneDeliveryFee,
    useFreeDeliveryReward: canRedeemFreeDelivery,
  });

  let resolvedStoreOwnerId =
    storeOwnerId && isValidFirestoreId(storeOwnerId) ? storeOwnerId : undefined;
  let resolvedStoreNeighborhood = storeNeighborhood.trim() || 'شارع البحر';
  let resolvedStoreLat = storeConstraints?.lat;
  let resolvedStoreLng = storeConstraints?.lng;
  let liveMinOrder = Math.max(
    0,
    Math.trunc(Number(storeConstraints?.minOrderAmount ?? 0))
  );

  const storeDocRef = doc(db, 'stores', targetStoreId);
  const storeSnap = await getDocWithRetry(
    storeDocRef,
    'stores',
    targetStoreId
  );

  if (!storeSnap.exists()) {
    throw new Error(
      'المتجر المختار غير متوفر حالياً. يرجى العودة لقائمة المتاجر واختيار متجر متاح.'
    );
  }

  const storeData = storeSnap.data() ?? {};
  const isStoreOpenNow = isStoreOpen({
    isActive: storeData.isActive !== false,
    isOpen: typeof storeData.isOpen === 'boolean' ? storeData.isOpen : true,
    isManuallyClosed:
      typeof storeData.isManuallyClosed === 'boolean'
        ? storeData.isManuallyClosed
        : undefined,
    openingTime:
      typeof storeData.openingTime === 'string'
        ? storeData.openingTime
        : undefined,
    closingTime:
      typeof storeData.closingTime === 'string'
        ? storeData.closingTime
        : undefined,
  });
  if (!isStoreOpenNow) {
    throw new Error('المتجر مغلق حالياً ولا يستقبل طلبات جديدة.');
  }
  if (typeof storeData.minOrderAmount === 'number') {
    liveMinOrder = Math.max(0, Math.trunc(storeData.minOrderAmount));
  }
  const candidateOwner = String(
    storeData.ownerUid || storeData.createdBy || resolvedStoreOwnerId || ''
  ).trim();
  if (isValidFirestoreId(candidateOwner)) {
    resolvedStoreOwnerId = candidateOwner;
  }
  if (
    typeof storeData.neighborhood === 'string' &&
    storeData.neighborhood.trim().length > 0
  ) {
    resolvedStoreNeighborhood = storeData.neighborhood.trim();
  }
  if (typeof storeData.lat === 'number') resolvedStoreLat = storeData.lat;
  if (typeof storeData.lng === 'number') resolvedStoreLng = storeData.lng;

  if (liveMinOrder > 0 && totals.subtotal < liveMinOrder) {
    throw new Error(
      `الحد الأدنى للطلب من هذا المتجر هو ${liveMinOrder} ج.م (قيمة السلة الحالية ${totals.subtotal} ج.م).`
    );
  }

  // Re-verify single-use coupon right before order commit
  let singleUseCouponCodeToConsume: string | null = null;
  if (appliedCoupon?.code) {
    const cleanCode = appliedCoupon.code.trim().toUpperCase();
    const cSnap = await getDoc(doc(db, 'coupons', cleanCode)).catch(() => null);
    if (!cSnap || !cSnap.exists()) {
      throw new Error('كود الخصم المستخدم لم يعد صالحاً.');
    }
    const cData = cSnap.data() ?? {};
    if (cData.isUsed === true || cData.isActive === false) {
      throw new Error('تم استخدام كود الخصم هذا مسبقاً ولا يمكن استخدامه مرتين.');
    }
    if (
      typeof cData.ownerUid === 'string' &&
      cData.ownerUid.trim() &&
      cData.ownerUid.trim() !== effectiveCustomerUid
    ) {
      throw new Error('كود الخصم هذا مخصص لحساب عميل آخر.');
    }
    if (
      typeof cData.ownerUid === 'string' &&
      cData.ownerUid.trim() === effectiveCustomerUid &&
      typeof cData.createdBy === 'string' &&
      cData.createdBy.trim().length > 0
    ) {
      singleUseCouponCodeToConsume = cleanCode;
    }
  }

  const customerCoords = isValidEdkuCoordPair(
    checkout.customerLat,
    checkout.customerLng
  )
    ? {
        customerLat: Number(checkout.customerLat!.toFixed(6)),
        customerLng: Number(checkout.customerLng!.toFixed(6)),
      }
    : {};

  const storeCoords = isValidEdkuCoordPair(resolvedStoreLat, resolvedStoreLng)
    ? {
        storeLat: Number(resolvedStoreLat!.toFixed(6)),
        storeLng: Number(resolvedStoreLng!.toFixed(6)),
      }
    : {};

  const scheduleFields =
    checkout.isScheduled && checkout.scheduledForIso?.trim()
      ? {
          isScheduled: true,
          scheduledForIso: checkout.scheduledForIso.trim().slice(0, 40),
        }
      : {};

  const cleanZoneId =
    checkout.zoneId &&
    APPROVED_EDKO_ZONE_IDS.includes(checkout.zoneId as EdkoZoneId)
      ? (checkout.zoneId as EdkoZoneId)
      : undefined;
  const cleanZoneName = checkout.zoneName?.trim()
    ? checkout.zoneName.trim().slice(0, 80)
    : undefined;
  const sharedZoneFields = {
    ...(cleanZoneId ? { zoneId: cleanZoneId } : {}),
    ...(cleanZoneName ? { zoneName: cleanZoneName } : {}),
  };

  const ordersPath = 'orders';
  const newOrderRef = doc(collection(db, ordersPath));
  const dispatchRef = doc(db, 'dispatchQueue', newOrderRef.id);

  const sharedOwnerField =
    resolvedStoreOwnerId && isValidFirestoreId(resolvedStoreOwnerId)
      ? { storeOwnerId: resolvedStoreOwnerId }
      : {};

  const sharedCouponFields =
    totals.couponCode && totals.discountAmount > 0
      ? {
          couponCode: totals.couponCode,
          discountPercent: totals.discountPercent,
          discountAmount: totals.discountAmount,
        }
      : {};

  const cleanDeliveryNeighborhood = (
    checkout.deliveryNeighborhood.trim() || 'شارع البحر'
  ).slice(0, 80);

  const cleanGroupSessionId =
    checkout.groupSessionId && isValidFirestoreId(checkout.groupSessionId)
      ? checkout.groupSessionId
      : undefined;

  const resolvedPaymentMethod: PaymentMethod =
    checkout.paymentMethod === 'visa'
      ? 'visa'
      : checkout.paymentMethod === 'wallet'
      ? 'wallet'
      : 'cash';

  const initialOrderStatus: 'confirmed' | 'pending_payment' =
    resolvedPaymentMethod === 'visa' ? 'pending_payment' : 'confirmed';

  const orderPayload: Record<string, unknown> = {
    orderType: 'standard',
    customerId: effectiveCustomerUid,
    storeId: targetStoreId,
    ...sharedOwnerField,
    storeName: cart[0].storeName.slice(0, 80),
    ...storeCoords,
    customerName: checkout.customerName.trim().slice(0, 80),
    customerPhone: normalizedCustomerPhone,
    deliveryNeighborhood: cleanDeliveryNeighborhood,
    deliveryAddress: checkout.deliveryAddress.trim().slice(0, 200),
    ...sharedZoneFields,
    ...customerCoords,
    ...scheduleFields,
    ...(groupCartId && isValidFirestoreId(groupCartId) ? { groupCartId } : {}),
    ...(cleanGroupSessionId ? { groupSessionId: cleanGroupSessionId } : {}),
    items: totals.items,
    itemsSummary: totals.itemsSummary,
    itemNames: totals.itemNames,
    itemCount: totals.itemCount,
    subtotal: totals.subtotal,
    smallOrderFee: totals.smallOrderFee,
    ...sharedCouponFields,
    deliveryFee: totals.deliveryFee,
    totalAmount: totals.totalAmount,
    paymentMethod: resolvedPaymentMethod,
    status: initialOrderStatus,
    notes: checkout.notes.trim().slice(0, 200),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const dispatchPayload: Record<string, unknown> = {
    orderId: newOrderRef.id,
    orderType: 'standard',
    customerId: effectiveCustomerUid,
    storeId: targetStoreId,
    ...sharedOwnerField,
    storeName: cart[0].storeName.slice(0, 80),
    storeNeighborhood: resolvedStoreNeighborhood.slice(0, 80),
    ...storeCoords,
    deliveryNeighborhood: cleanDeliveryNeighborhood,
    ...sharedZoneFields,
    ...customerCoords,
    ...scheduleFields,
    itemsSummary: totals.itemsSummary,
    subtotal: totals.subtotal,
    smallOrderFee: totals.smallOrderFee,
    ...sharedCouponFields,
    deliveryFee: totals.deliveryFee,
    totalAmount: totals.totalAmount,
    paymentMethod: resolvedPaymentMethod,
    status: initialOrderStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    if (resolvedPaymentMethod === 'wallet') {
      const userRef = doc(db, 'users', effectiveCustomerUid);
      const txRef = doc(collection(db, 'wallet_transactions'));
      await runTransaction(db, async (tx) => {
        const userSnap = await tx.get(userRef);
        const userData = userSnap.exists() ? userSnap.data() ?? {} : {};
        const currentBalance = Math.max(0, Number(userData.walletBalance ?? 0));
        if (currentBalance < totals.totalAmount) {
          throw new Error(
            `رصيد محفظتك الحالي (${currentBalance} ج.م) غير كافٍ لسداد قيمة الطلب (${totals.totalAmount} ج.م).`
          );
        }
        const nextBalance = Number((currentBalance - totals.totalAmount).toFixed(2));
        const prevSpent = Math.max(0, Number(userData.totalSpentEgp ?? 0));
        const nextSpent = Math.trunc(prevSpent + totals.totalAmount);

        tx.set(newOrderRef, orderPayload);
        tx.set(dispatchRef, dispatchPayload);
        tx.update(userRef, {
          walletBalance: nextBalance,
          totalSpentEgp: nextSpent,
          updatedAt: serverTimestamp(),
        });
        tx.set(txRef, {
          id: txRef.id,
          userId: effectiveCustomerUid,
          type: 'order_debit',
          amount: totals.totalAmount,
          balanceAfter: nextBalance,
          description: `دفع طلب من ${cart[0].storeName.slice(0, 40)}`.slice(0, 200),
          orderId: newOrderRef.id,
          createdBy: effectiveCustomerUid,
          createdAt: serverTimestamp(),
        });
        if (singleUseCouponCodeToConsume && totals.discountAmount > 0) {
          tx.update(doc(db, 'coupons', singleUseCouponCodeToConsume), {
            isUsed: true,
            usedBy: effectiveCustomerUid,
            isActive: false,
            updatedAt: serverTimestamp(),
          });
        }
      });
    } else {
      const batch = writeBatch(db);
      batch.set(newOrderRef, orderPayload);
      batch.set(dispatchRef, dispatchPayload);
      if (singleUseCouponCodeToConsume && totals.discountAmount > 0) {
        batch.update(doc(db, 'coupons', singleUseCouponCodeToConsume), {
          isUsed: true,
          usedBy: effectiveCustomerUid,
          isActive: false,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();

      // Best-effort totalSpentEgp increment for Top Rated unlock threshold
      void (async () => {
        try {
          const userRef = doc(db, 'users', effectiveCustomerUid);
          const uSnap = await getDoc(userRef);
          if (uSnap.exists()) {
            const prevSpent = Math.max(0, Number(uSnap.data()?.totalSpentEgp ?? 0));
            const nextSpent = Math.trunc(prevSpent + totals.totalAmount);
            await updateDoc(userRef, {
              totalSpentEgp: nextSpent,
              updatedAt: serverTimestamp(),
            });
            void syncCustomerDirectoryEntry(effectiveCustomerUid, {
              totalSpentEgp: nextSpent,
            });
          }
        } catch {
          // Non-fatal spend increment
        }
      })();
    }

    if (canRedeemFreeDelivery) {
      const nextRewards = Math.max(0, prevRewardBalance - 1);
      await updateDoc(doc(db, 'users', effectiveCustomerUid), {
        freeDeliveryRewards: nextRewards,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
      void syncCustomerDirectoryEntry(effectiveCustomerUid, {
        freeDeliveryRewards: nextRewards,
      });
    }

    if (groupCartId && isValidFirestoreId(groupCartId)) {
      void completeSharedCartCheckoutInFirestore(groupCartId);
    }
    if (cleanGroupSessionId) {
      void closeGroupOrderSessionInFirestore(cleanGroupSessionId, 'checked_out');
    }

    void publishLiveEventInFirestore({
      text: `طلب جديد الآن من «${cart[0].storeName.slice(0, 45)}» • ${cleanDeliveryNeighborhood}`,
      neighborhood: cleanDeliveryNeighborhood,
      storeName: cart[0].storeName.slice(0, 80),
      eventType: 'new_order',
    });

    void createNotificationBestEffort(effectiveCustomerUid, {
      title: `تم إرسال طلبك إلى ${cart[0].storeName.slice(0, 50)}`,
      body: checkout.isScheduled
        ? `تمت جدولة طلبك بنجاح — الإجمالي ${totals.totalAmount} ج.م.`
        : `الإجمالي ${totals.totalAmount} ج.م — سنبلّغك فور قبول المتجر للطلب.`,
      type: 'order_update',
      orderId: newOrderRef.id,
    });

    if (resolvedStoreOwnerId) {
      void createNotificationBestEffort(resolvedStoreOwnerId, {
        title: `طلب جديد وارد لمتجر ${cart[0].storeName.slice(0, 40)}`,
        body: `${totals.itemsSummary.slice(0, 120)} — الإجمالي ${totals.totalAmount} ج.م`,
        type: 'order_update',
        orderId: newOrderRef.id,
      });
    }

    return newOrderRef.id;
  } catch (error) {
    if (isArabicBusinessError(error)) {
      throw error;
    }
    console.error('[Edkawy Order Checkout Diagnostic]', {
      orderId: newOrderRef.id,
      storeId: targetStoreId,
      status: initialOrderStatus,
      paymentMethod: orderPayload.paymentMethod,
      subtotal: orderPayload.subtotal,
      deliveryFee: orderPayload.deliveryFee,
      smallOrderFee: orderPayload.smallOrderFee,
      totalAmount: orderPayload.totalAmount,
      hasCoupon: Boolean(singleUseCouponCodeToConsume),
      orderKeys: Object.keys(orderPayload),
      dispatchKeys: Object.keys(dispatchPayload),
    });
    logFirestoreFailure(
      'orders',
      newOrderRef.id,
      'placeOrderInFirestore',
      error
    );
    handleFirestoreError(error, OperationType.CREATE, ordersPath);
  }
}

export async function confirmCustomerOrderInFirestore(
  orderId: string,
  paymentMethod?: PaymentMethod
): Promise<'confirmed' | 'pending_payment'> {
  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    throw new Error('يجب تسجيل الدخول بحسابك أولاً قبل تأكيد الطلب.');
  }
  if (!isValidFirestoreId(orderId)) {
    throw new Error('معرّف الطلب غير صالح.');
  }

  const currentUid = auth.currentUser.uid;
  const orderPath = `orders/${orderId}`;

  try {
    await waitForFirestoreWarmup();
    const orderRef = doc(db, 'orders', orderId);
    const dispatchRef = doc(db, 'dispatchQueue', orderId);

    const nextStatus = await runWriteWithNetworkRetry(async () =>
      runTransaction(db, async (tx) => {
        const orderSnap = await tx.get(orderRef);

        if (!orderSnap.exists()) {
          throw new Error('لم يتم العثور على هذا الطلب.');
        }

        const orderData = orderSnap.data() ?? {};
        const orderCustomerId = String(orderData.customerId ?? '');
        if (orderCustomerId !== currentUid) {
          throw new Error('عفواً، لا تملك صلاحية تأكيد هذا الطلب.');
        }

        const currentStatus = String(orderData.status ?? '');
        if (currentStatus !== 'pending') {
          throw new Error(
            'عذراً، هذا الطلب تم تعديله من قبل المتجر ولا يمكن تأكيده الآن'
          );
        }

        const effectivePaymentMethod =
          paymentMethod ??
          (orderData.paymentMethod as PaymentMethod | undefined) ??
          'cash';
        const targetStatus: 'confirmed' | 'pending_payment' =
          effectivePaymentMethod === 'visa' ? 'pending_payment' : 'confirmed';

        tx.update(orderRef, {
          status: targetStatus,
          updatedAt: serverTimestamp(),
        });

        return targetStatus;
      })
    );

    // Sync dispatchQueue best-effort so a stale/legacy dispatch ticket never blocks customer confirmation
    void updateDoc(dispatchRef, {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    }).catch(() => {});

    return nextStatus;
  } catch (error) {
    if (isArabicBusinessError(error)) {
      throw error;
    }
    logFirestoreFailure(
      'orders',
      orderId,
      'confirmCustomerOrderInFirestore',
      error
    );
    handleFirestoreError(error, OperationType.UPDATE, orderPath);
  }
}

export const confirmOrderInFirestore = confirmCustomerOrderInFirestore;

/**
 * Stage 1 of Edkawy Pharmacy System:
 * Customer submits prescription photo and/or medicine request + map-pinned address.
 */
export async function placePharmacyPrescriptionOrderInFirestore(
  customerUid: string,
  pharmacyStore: StoreRecord,
  input: PharmacyPrescriptionOrderInput
): Promise<string> {
  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    throw new Error('يرجى تسجيل الدخول بحسابك أولاً لإرسال الروشتة أو طلب الأدوية.');
  }

  const errMsg = validatePharmacyPrescriptionInput(input);
  if (errMsg) {
    throw new Error(errMsg);
  }

  const effectiveCustomerUid = auth.currentUser.uid || customerUid;
  await waitForFirestoreWarmup();
  await assertSystemWritableForUser(effectiveCustomerUid, {
    storeId: pharmacyStore.id,
    checkMaintenance: true,
  });
  const storeSnap = await getDocWithRetry(
    doc(db, 'stores', pharmacyStore.id),
    'stores',
    pharmacyStore.id
  );
  if (!storeSnap.exists()) {
    throw new Error('الصيدلية المختارة غير متاحة حالياً.');
  }
  const sd = storeSnap.data() ?? {};
  const isRxStoreOpenNow = isStoreOpen({
    isActive: sd.isActive !== false,
    isOpen: typeof sd.isOpen === 'boolean' ? sd.isOpen : true,
    isManuallyClosed:
      typeof sd.isManuallyClosed === 'boolean'
        ? sd.isManuallyClosed
        : undefined,
    openingTime: typeof sd.openingTime === 'string' ? sd.openingTime : undefined,
    closingTime: typeof sd.closingTime === 'string' ? sd.closingTime : undefined,
  });
  if (!isRxStoreOpenNow) {
    throw new Error('الصيدلية مغلقة حالياً ولا تستقبل روشتات جديدة.');
  }

  const resolvedOwner = String(
    sd.ownerUid || sd.createdBy || pharmacyStore.ownerUid || ''
  ).trim();
  const rawFee = Number(
    input.zoneDeliveryFee ?? sd.deliveryFee ?? pharmacyStore.deliveryFee ?? 15
  );
  const deliveryFee = Number.isFinite(rawFee)
    ? Math.min(500, Math.max(0, Math.trunc(rawFee)))
    : 15;

  const cleanZoneId =
    input.zoneId && APPROVED_EDKO_ZONE_IDS.includes(input.zoneId)
      ? input.zoneId
      : undefined;
  const cleanZoneName = input.zoneName?.trim()
    ? input.zoneName.trim().slice(0, 80)
    : undefined;
  const rxZoneFields = {
    ...(cleanZoneId ? { zoneId: cleanZoneId } : {}),
    ...(cleanZoneName ? { zoneName: cleanZoneName } : {}),
  };

  const cleanPrescImg = sanitizeOptionalImage(input.prescriptionImageUrl);
  const cleanMedReq = (input.medicineRequest ?? '').trim().slice(0, 600);
  const cleanRxNeighborhood = (
    (input.deliveryNeighborhood ?? '').trim() || 'شارع البحر'
  ).slice(0, 80);
  const summaryLabel = cleanMedReq
    ? `روشتة / أدوية: ${cleanMedReq.slice(0, 120)}`
    : 'روشتة طبية مصوّرة بانتظار تسعير الصيدلية';

  const newOrderRef = doc(collection(db, 'orders'));
  const dispatchRef = doc(db, 'dispatchQueue', newOrderRef.id);

  const storeCoords = isValidEdkuCoordPair(
    typeof sd.lat === 'number' ? sd.lat : pharmacyStore.lat,
    typeof sd.lng === 'number' ? sd.lng : pharmacyStore.lng
  )
    ? {
        storeLat: Number((sd.lat ?? pharmacyStore.lat)!.toFixed(6)),
        storeLng: Number((sd.lng ?? pharmacyStore.lng)!.toFixed(6)),
      }
    : {};

  const orderPayload: Record<string, unknown> = {
    orderType: 'pharmacy_prescription',
    ...(cleanPrescImg ? { prescriptionImageUrl: cleanPrescImg } : {}),
    ...(cleanMedReq ? { prescriptionMedicineRequest: cleanMedReq } : {}),
    customerId: effectiveCustomerUid,
    storeId: pharmacyStore.id,
    ...(isValidFirestoreId(resolvedOwner) ? { storeOwnerId: resolvedOwner } : {}),
    storeName: (pharmacyStore.name.trim() || 'صيدلية إدكاوي').slice(0, 80),
    ...storeCoords,
    customerName: input.customerName.trim().slice(0, 80),
    customerPhone: normalizeEgyptPhoneOrEmpty(input.customerPhone),
    deliveryNeighborhood: cleanRxNeighborhood,
    deliveryAddress: input.deliveryAddress.trim().slice(0, 200),
    ...rxZoneFields,
    customerLat: Number(input.customerLat.toFixed(6)),
    customerLng: Number(input.customerLng.toFixed(6)),
    items: [
      {
        productId: 'rx_quote',
        name: 'روشتة طبية / طلب أدوية (قيد التسعير)',
        price: 0,
        quantity: 1,
      },
    ],
    itemsSummary: summaryLabel,
    itemNames: [summaryLabel.slice(0, 100)],
    itemCount: 1,
    subtotal: 0,
    deliveryFee,
    totalAmount: deliveryFee,
    paymentMethod: 'cash',
    status: 'awaiting_pharmacy_quote',
    notes: (input.notes ?? '').trim().slice(0, 200),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const dispatchPayload: Record<string, unknown> = {
    orderId: newOrderRef.id,
    orderType: 'pharmacy_prescription',
    customerId: effectiveCustomerUid,
    storeId: pharmacyStore.id,
    ...(isValidFirestoreId(resolvedOwner) ? { storeOwnerId: resolvedOwner } : {}),
    storeName: (pharmacyStore.name.trim() || 'صيدلية إدكاوي').slice(0, 80),
    storeNeighborhood: (pharmacyStore.neighborhood || 'شارع البحر').slice(0, 80),
    ...storeCoords,
    deliveryNeighborhood: cleanRxNeighborhood,
    ...rxZoneFields,
    customerLat: Number(input.customerLat.toFixed(6)),
    customerLng: Number(input.customerLng.toFixed(6)),
    itemsSummary: summaryLabel,
    subtotal: 0,
    deliveryFee,
    totalAmount: deliveryFee,
    paymentMethod: 'cash',
    status: 'awaiting_pharmacy_quote',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const batch = writeBatch(db);
    batch.set(newOrderRef, orderPayload);
    batch.set(dispatchRef, dispatchPayload);
    await batch.commit();

    if (isValidFirestoreId(resolvedOwner)) {
      void createNotificationBestEffort(resolvedOwner, {
        title: `روشتة طبية جديدة واردة إلى ${pharmacyStore.name.slice(0, 40)}`,
        body: 'يرجى مراجعة الروشتة وتحديد سعر الأدوية لإرساله للعميل للموافقة.',
        type: 'order_update',
        orderId: newOrderRef.id,
      });
    }

    return newOrderRef.id;
  } catch (error) {
    logFirestoreFailure(
      'orders',
      newOrderRef.id,
      'placePharmacyPrescriptionOrder',
      error
    );
    handleFirestoreError(error, OperationType.CREATE, 'orders');
  }
}

/**
 * Stage 2 of Edkawy Pharmacy System:
 * Pharmacy reviews prescription, sets medicine price + optional note, and sends quote to Customer.
 */
export async function quotePharmacyOrderByStoreInFirestore(
  order: OrderRecord,
  quotedPriceEgp: number,
  pharmacistNote?: string,
  prepTimeMinutes = 15
): Promise<void> {
  const cleanPrice = Math.trunc(Number(quotedPriceEgp));
  if (Number.isNaN(cleanPrice) || cleanPrice <= 0 || cleanPrice > 50000) {
    throw new Error('يرجى إدخال سعر صحيح للأدوية بالجنيه المصري (أكبر من صفر).');
  }

  const clampedPrep = Math.min(180, Math.max(5, Math.trunc(prepTimeMinutes)));
  const cleanNote = (pharmacistNote ?? '').trim().slice(0, 280);
  const updatedSummary = order.prescriptionMedicineRequest
    ? `أدوية مسعّرة (${cleanPrice} ج.م): ${order.prescriptionMedicineRequest.slice(0, 120)}`
    : `روشتة طبية مسعّرة من الصيدلية (${cleanPrice} ج.م)`;

  try {
    await waitForFirestoreWarmup();
    const orderRef = doc(db, 'orders', order.id);
    const dispatchRef = doc(db, 'dispatchQueue', order.id);
    const [orderSnap, dispatchSnap] = await Promise.all([
      getDocWithRetry(orderRef, 'orders', order.id),
      getDocWithRetry(dispatchRef, 'dispatchQueue', order.id),
    ]);

    if (!orderSnap.exists()) {
      throw new Error('لم يتم العثور على هذا الطلب.');
    }
    const liveData = orderSnap.data() ?? {};
    const liveStatus = String(liveData.status ?? '');
    if (liveStatus === 'cancelled') {
      throw new Error('تم إلغاء طلب الروشتة من قبل العميل قبل إرسال التسعيرة.');
    }
    if (
      liveStatus !== 'awaiting_pharmacy_quote' &&
      liveStatus !== 'awaiting_customer_approval'
    ) {
      throw new Error('تم اعتماد تسعيرة هذه الروشتة بالفعل وانتقلت لمرحلة التحضير.');
    }
    const liveDeliveryFee =
      typeof liveData.deliveryFee === 'number'
        ? Math.max(0, Math.trunc(liveData.deliveryFee))
        : Math.max(0, Math.trunc(order.deliveryFee));
    const totalAmount = cleanPrice + liveDeliveryFee;

    await runWriteWithNetworkRetry(async () => {
      const batch = writeBatch(db);
      batch.update(orderRef, {
        status: 'awaiting_customer_approval',
        subtotal: cleanPrice,
        totalAmount,
        ...(cleanNote ? { pharmacistNote: cleanNote } : {}),
        items: [
          {
            productId: 'rx_quoted',
            name: 'إجمالي الأدوية الموصوفة بالروشتة',
            price: cleanPrice,
            quantity: 1,
          },
        ],
        itemsSummary: updatedSummary,
        itemNames: ['إجمالي الأدوية الموصوفة بالروشتة'],
        prepTimeMinutes: clampedPrep,
        updatedAt: serverTimestamp(),
      });

      if (dispatchSnap.exists()) {
        batch.update(dispatchRef, {
          status: 'awaiting_customer_approval',
          subtotal: cleanPrice,
          totalAmount,
          ...(cleanNote ? { pharmacistNote: cleanNote } : {}),
          itemsSummary: updatedSummary,
          prepTimeMinutes: clampedPrep,
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();
    });

    void createNotificationBestEffort(order.customerId, {
      title: `تم تسعير الروشتة من ${order.storeName.slice(0, 40)}`,
      body: `سعر الأدوية ${cleanPrice} ج.م (+ توصيل ${order.deliveryFee} ج.م). اضغط للموافقة وبدء التحضير.`,
      type: 'order_update',
      orderId: order.id,
    });
  } catch (error) {
    if (isArabicBusinessError(error)) {
      throw error;
    }
    logFirestoreFailure(
      'orders',
      order.id,
      'quotePharmacyOrderByStore',
      error
    );
    handleFirestoreError(error, OperationType.UPDATE, `orders/${order.id}`);
  }
}

/**
 * Stage 3 of Edkawy Pharmacy System:
 * Customer approves quoted price -> status moves to 'preparing' so pharmacy prepares the bag.
 */
export async function approvePharmacyQuoteByCustomerInFirestore(
  order: OrderRecord
): Promise<void> {
  try {
    await waitForFirestoreWarmup();
    const orderRef = doc(db, 'orders', order.id);
    const dispatchRef = doc(db, 'dispatchQueue', order.id);
    const [orderSnap, dispatchSnap] = await Promise.all([
      getDocWithRetry(orderRef, 'orders', order.id),
      getDocWithRetry(dispatchRef, 'dispatchQueue', order.id),
    ]);

    if (!orderSnap.exists()) {
      throw new Error('لم يتم العثور على هذا الطلب.');
    }
    const liveStatus = String(orderSnap.data()?.status ?? '');
    if (liveStatus === 'preparing' || liveStatus === 'ready') {
      return;
    }
    if (liveStatus === 'cancelled') {
      throw new Error('هذا الطلب ملغى ولا يمكن الموافقة عليه.');
    }
    if (liveStatus !== 'awaiting_customer_approval') {
      throw new Error('تم تحديث حالة الروشتة بالفعل.');
    }

    await runWriteWithNetworkRetry(async () => {
      const batch = writeBatch(db);
      batch.update(orderRef, {
        status: 'preparing',
        updatedAt: serverTimestamp(),
      });
      if (dispatchSnap.exists()) {
        batch.update(dispatchRef, {
          status: 'preparing',
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    });

    if (order.storeOwnerId && isValidFirestoreId(order.storeOwnerId)) {
      void createNotificationBestEffort(order.storeOwnerId, {
        title: `وافق العميل على تسعيرة الروشتة (${order.subtotal} ج.م)`,
        body: 'يرجى تحضير شنطة الأدوية والضغط على «جاهز للتسليم للمندوب» فور الانتهاء.',
        type: 'order_update',
        orderId: order.id,
      });
    }
  } catch (error) {
    if (isArabicBusinessError(error)) {
      throw error;
    }
    logFirestoreFailure(
      'orders',
      order.id,
      'approvePharmacyQuoteByCustomer',
      error
    );
    handleFirestoreError(error, OperationType.UPDATE, `orders/${order.id}`);
  }
}

export function listenToCustomerOrders(
  customerId: string,
  onOrdersUpdate: (orders: OrderRecord[]) => void,
  onErrorCallback?: (err: Error) => void
): Unsubscribe {
  const ordersPath = 'orders';
  const customerOrdersQuery = query(
    collection(db, ordersPath),
    where('customerId', '==', customerId)
  );

  return onSnapshot(
    customerOrdersQuery,
    (snapshot) => {
      const records = snapshot.docs.map(parseOrderSnapshotDoc);
      records.sort(
        (a, b) =>
          new Date(b.createdAtIso).getTime() -
          new Date(a.createdAtIso).getTime()
      );
      onOrdersUpdate(records);
    },
    (error) => {
      logFirestoreFailure(
        'orders',
        `customerId:${customerId}`,
        'listenToCustomerOrders',
        error
      );
      onErrorCallback?.(error instanceof Error ? error : new Error(String(error)));
    }
  );
}

export function listenToMerchantOrders(
  merchantUid: string,
  onOrdersUpdate: (orders: OrderRecord[]) => void,
  onErrorCallback?: (err: Error) => void
): Unsubscribe {
  const ordersPath = 'orders';
  const merchantOrdersQuery = query(
    collection(db, ordersPath),
    where('storeOwnerId', '==', merchantUid)
  );

  return onSnapshot(
    merchantOrdersQuery,
    (snapshot) => {
      const records = snapshot.docs.map(parseOrderSnapshotDoc);
      records.sort(
        (a, b) =>
          new Date(b.createdAtIso).getTime() -
          new Date(a.createdAtIso).getTime()
      );
      onOrdersUpdate(records);
    },
    (error) => {
      logFirestoreFailure(
        'orders',
        `storeOwnerId:${merchantUid}`,
        'listenToMerchantOrders',
        error
      );
      onErrorCallback?.(error instanceof Error ? error : new Error(String(error)));
    }
  );
}

export function listenToCourierOrdersAndDispatch(
  courierUid: string,
  isApproved: boolean,
  onOrdersUpdate: (orders: OrderRecord[]) => void,
  onErrorCallback?: (err: Error) => void
): Unsubscribe {
  if (!isApproved) {
    onOrdersUpdate([]);
    return () => {};
  }

  let claimedOrdersMap = new Map<string, OrderRecord>();
  let readyDispatchMap = new Map<string, OrderRecord>();

  const statusPriority: Record<string, number> = {
    awaiting_courier_quote: 0,
    ready: 0,
    awaiting_customer_errand_approval: 1,
    preparing: 1,
    pending: 2,
  };

  const emitMerged = () => {
    const merged = new Map<string, OrderRecord>([
      ...readyDispatchMap,
      ...claimedOrdersMap,
    ]);
    const list = Array.from(merged.values()).sort((a, b) => {
      const rankA = statusPriority[a.status] ?? 3;
      const rankB = statusPriority[b.status] ?? 3;
      if (rankA !== rankB) return rankA - rankB;
      return (
        new Date(b.createdAtIso).getTime() -
        new Date(a.createdAtIso).getTime()
      );
    });
    onOrdersUpdate(list);
  };

  const unsubClaimed = onSnapshot(
    query(collection(db, 'orders'), where('courierId', '==', courierUid)),
    (snap) => {
      claimedOrdersMap = new Map(
        snap.docs.map((d) => [d.id, parseOrderSnapshotDoc(d)])
      );
      emitMerged();
    },
    (error) => {
      logFirestoreFailure(
        'orders',
        `courierId:${courierUid}`,
        'listenToCourierClaimedOrders',
        error
      );
      onErrorCallback?.(error instanceof Error ? error : new Error(String(error)));
    }
  );

  // Expose unassigned 'ready' store/pharmacy orders AND 'awaiting_courier_quote' custom errands
  const unsubReadyDispatch = onSnapshot(
    query(
      collection(db, 'dispatchQueue'),
      where('status', 'in', ['ready', 'awaiting_courier_quote'])
    ),
    (snap) => {
      const nextMap = new Map<string, OrderRecord>();
      for (const docSnap of snap.docs) {
        const ticket = parseDispatchTicketDoc(docSnap);
        const isRejectedByMe = (ticket.rejectedBy ?? []).includes(courierUid);
        if (
          !isRejectedByMe &&
          (!ticket.courierId || ticket.courierId === courierUid)
        ) {
          nextMap.set(ticket.orderId, dispatchTicketToPreviewOrder(ticket));
        }
      }
      readyDispatchMap = nextMap;
      emitMerged();
    },
    (error) => {
      logFirestoreFailure(
        'dispatchQueue',
        'active_pool',
        'listenToCourierReadyDispatch',
        error
      );
      onErrorCallback?.(error instanceof Error ? error : new Error(String(error)));
    }
  );

  return () => {
    unsubClaimed();
    unsubReadyDispatch();
  };
}

export function listenToAdminOrders(
  onOrdersUpdate: (orders: OrderRecord[]) => void,
  onErrorCallback?: (err: Error) => void
): Unsubscribe {
  const dispatchPath = 'dispatchQueue';
  // Split across two queries so each 'in' filter stays strictly <= 10 statuses
  const qPrimary = query(
    collection(db, dispatchPath),
    where('status', 'in', [
      'pending',
      'confirmed',
      'pending_payment',
      'preparing',
      'ready',
      'on_the_way',
      'delivering',
      'delivered',
      'cancelled',
    ])
  );
  const qQuotes = query(
    collection(db, dispatchPath),
    where('status', 'in', [
      'awaiting_pharmacy_quote',
      'awaiting_customer_approval',
      'awaiting_courier_quote',
      'awaiting_customer_errand_approval',
    ])
  );

  let primaryTickets: DispatchTicketRecord[] = [];
  let quoteTickets: DispatchTicketRecord[] = [];
  let emitSequence = 0;

  const mergeAndEnrich = () => {
    const seq = ++emitSequence;
    const byId = new Map<string, DispatchTicketRecord>();
    for (const t of quoteTickets) byId.set(t.orderId, t);
    for (const t of primaryTickets) byId.set(t.orderId, t);
    const tickets = Array.from(byId.values());

    void (async () => {
      const enriched = await Promise.all(
        tickets.map(async (ticket) => {
          try {
            const orderSnap = await getDocWithRetry(
              doc(db, 'orders', ticket.orderId),
              'orders',
              ticket.orderId
            );
            if (orderSnap.exists()) {
              return parseOrderSnapshotDoc(orderSnap);
            }
          } catch {
            // Fallback to ticket
          }
          return dispatchTicketToPreviewOrder(ticket);
        })
      );
      if (seq !== emitSequence) return;
      enriched.sort(
        (a, b) =>
          new Date(b.createdAtIso).getTime() -
          new Date(a.createdAtIso).getTime()
      );
      onOrdersUpdate(enriched);
    })();
  };

  const unsubPrimary = onSnapshot(
    qPrimary,
    (snapshot) => {
      primaryTickets = snapshot.docs.map(parseDispatchTicketDoc);
      mergeAndEnrich();
    },
    (error) => {
      logFirestoreFailure(dispatchPath, 'admin_primary', 'listenToAdminOrders', error);
      onErrorCallback?.(error instanceof Error ? error : new Error(String(error)));
    }
  );

  const unsubQuotes = onSnapshot(
    qQuotes,
    (snapshot) => {
      quoteTickets = snapshot.docs.map(parseDispatchTicketDoc);
      mergeAndEnrich();
    },
    (error) => {
      logFirestoreFailure(dispatchPath, 'admin_quotes', 'listenToAdminOrders', error);
      onErrorCallback?.(error instanceof Error ? error : new Error(String(error)));
    }
  );

  return () => {
    unsubPrimary();
    unsubQuotes();
  };
}

export async function acceptOrderByStoreInFirestore(
  orderId: string,
  prepTimeMinutes: number
): Promise<void> {
  const orderPath = `orders/${orderId}`;
  const clampedPrep = Math.min(180, Math.max(5, Math.trunc(prepTimeMinutes)));
  try {
    await waitForFirestoreWarmup();
    const orderRef = doc(db, 'orders', orderId);
    const dispatchRef = doc(db, 'dispatchQueue', orderId);

    const txResult = await runWriteWithNetworkRetry(async () =>
      runTransaction(db, async (tx) => {
        const [orderSnap, dispatchSnap] = await Promise.all([
          tx.get(orderRef),
          tx.get(dispatchRef),
        ]);

        if (!orderSnap.exists()) {
          throw new Error('لم يتم العثور على هذا الطلب.');
        }
        const orderData = orderSnap.data() ?? {};
        const dispatchData = dispatchSnap.exists() ? dispatchSnap.data() ?? {} : {};
        const liveStatus = String(orderData.status ?? '');
        if (liveStatus === 'preparing' || liveStatus === 'ready') {
          return {
            alreadyUpdated: true,
            customerId: String(orderData.customerId ?? dispatchData.customerId ?? ''),
            storeName: String(orderData.storeName ?? dispatchData.storeName ?? 'المتجر'),
          };
        }
        if (liveStatus === 'cancelled') {
          throw new Error('قام العميل بإلغاء هذا الطلب قبل قبوله.');
        }
        if (liveStatus === 'pending_payment') {
          throw new Error('هذا الطلب بانتظار إتمام الدفع الإلكتروني من العميل.');
        }
        if (
          liveStatus === 'on_the_way' ||
          liveStatus === 'delivering' ||
          liveStatus === 'delivered'
        ) {
          throw new Error('هذا الطلب انتقل بالفعل إلى مرحلة التوصيل مع المندوب.');
        }

        tx.update(orderRef, {
          status: 'preparing',
          prepTimeMinutes: clampedPrep,
          updatedAt: serverTimestamp(),
        });
        if (dispatchSnap.exists()) {
          tx.update(dispatchRef, {
            status: 'preparing',
            prepTimeMinutes: clampedPrep,
            updatedAt: serverTimestamp(),
          });
        }

        return {
          alreadyUpdated: false,
          customerId: String(orderData.customerId ?? dispatchData.customerId ?? ''),
          storeName: String(orderData.storeName ?? dispatchData.storeName ?? 'المتجر'),
        };
      })
    );

    if (!txResult.alreadyUpdated && txResult.customerId) {
      void createNotificationBestEffort(txResult.customerId, {
        title: `بدأ تحضير طلبك في ${txResult.storeName.slice(0, 45)}`,
        body: `مدة التحضير المتوقعة حوالي ${clampedPrep} دقيقة.`,
        type: 'order_update',
        orderId,
      });
    }
  } catch (error) {
    if (isArabicBusinessError(error)) {
      throw error;
    }
    logFirestoreFailure(
      'orders',
      orderId,
      'acceptOrderByStoreInFirestore',
      error
    );
    handleFirestoreError(error, OperationType.UPDATE, orderPath);
  }
}

export async function markOrderReadyByStoreInFirestore(
  orderId: string
): Promise<void> {
  const orderPath = `orders/${orderId}`;
  try {
    await waitForFirestoreWarmup();
    const orderRef = doc(db, 'orders', orderId);
    const dispatchRef = doc(db, 'dispatchQueue', orderId);

    const txResult = await runWriteWithNetworkRetry(async () =>
      runTransaction(db, async (tx) => {
        const [orderSnap, dispatchSnap] = await Promise.all([
          tx.get(orderRef),
          tx.get(dispatchRef),
        ]);

        if (!orderSnap.exists()) {
          throw new Error('لم يتم العثور على هذا الطلب.');
        }
        const orderData = orderSnap.data() ?? {};
        const dispatchData = dispatchSnap.exists() ? dispatchSnap.data() ?? {} : {};
        const liveStatus = String(orderData.status ?? '');
        if (
          liveStatus === 'ready' ||
          liveStatus === 'on_the_way' ||
          liveStatus === 'delivering' ||
          liveStatus === 'delivered'
        ) {
          return {
            alreadyUpdated: true,
            customerId: String(orderData.customerId ?? dispatchData.customerId ?? ''),
            storeName: String(orderData.storeName ?? dispatchData.storeName ?? 'المتجر'),
          };
        }
        if (liveStatus === 'cancelled') {
          throw new Error('تم إلغاء هذا الطلب ولا يمكن تجهيزه للتسليم.');
        }

        tx.update(orderRef, {
          status: 'ready',
          updatedAt: serverTimestamp(),
        });
        if (dispatchSnap.exists()) {
          tx.update(dispatchRef, {
            status: 'ready',
            updatedAt: serverTimestamp(),
          });
        }

        return {
          alreadyUpdated: false,
          customerId: String(orderData.customerId ?? dispatchData.customerId ?? ''),
          storeName: String(orderData.storeName ?? dispatchData.storeName ?? 'المتجر'),
        };
      })
    );

    if (!txResult.alreadyUpdated && txResult.customerId) {
      void createNotificationBestEffort(txResult.customerId, {
        title: `طلبك جاهز للاستلام من ${txResult.storeName.slice(0, 45)}`,
        body: 'تم إشعار مندوبي إدكاوي لاستلام طلبك وتوصيله إليك فوراً.',
        type: 'order_update',
        orderId,
      });
    }
  } catch (error) {
    if (isArabicBusinessError(error)) {
      throw error;
    }
    logFirestoreFailure(
      'orders',
      orderId,
      'markOrderReadyByStoreInFirestore',
      error
    );
    handleFirestoreError(error, OperationType.UPDATE, orderPath);
  }
}

function sanitizeEdkuCoords(coords?: { lat?: number; lng?: number }): {
  courierLat?: number;
  courierLng?: number;
} {
  if (isValidEdkuCoordPair(coords?.lat, coords?.lng)) {
    return {
      courierLat: Number(coords!.lat!.toFixed(6)),
      courierLng: Number(coords!.lng!.toFixed(6)),
    };
  }
  return {};
}

async function assertCourierApprovedForWrite(
  courierUid: string
): Promise<void> {
  if (!courierUid || !isValidFirestoreId(courierUid)) {
    throw new Error('بيانات حساب الكابتن غير صالحة.');
  }
  const [dirSnap, privateSnap] = await Promise.all([
    getDoc(doc(db, 'courierDirectory', courierUid)).catch(() => null),
    getDoc(doc(db, 'couriers', courierUid)).catch(() => null),
  ]);

  const dirApproved =
    dirSnap?.exists() && dirSnap.data()?.approvalStatus === 'approved';
  const privateStatus = privateSnap?.exists()
    ? String(privateSnap.data()?.approvalStatus ?? 'approved')
    : null;
  const privateApproved =
    privateStatus !== null &&
    privateStatus !== 'pending' &&
    privateStatus !== 'rejected';

  if (!dirApproved && !privateApproved) {
    if (
      privateStatus === 'rejected' ||
      dirSnap?.data()?.approvalStatus === 'rejected'
    ) {
      throw new Error('تم إيقاف أو رفض حساب المندوب من الإدارة.');
    }
    throw new Error('حساب المندوب قيد المراجعة والاعتماد من الإدارة حالياً.');
  }
}

export async function pickupOrderByCourierInFirestore(
  orderId: string,
  courierUid: string,
  courierName: string,
  courierPhone: string,
  initialLocation: string,
  coords?: { lat?: number; lng?: number }
): Promise<void> {
  if (!isValidFirestoreId(orderId) || !isValidFirestoreId(courierUid)) {
    throw new Error('بيانات الطلب أو الكابتن غير صالحة.');
  }
  const orderPath = `orders/${orderId}`;
  const cleanCourierName = (courierName.trim() || 'كابتن توصيل إدكاوي').slice(
    0,
    80
  );
  const cleanCourierPhone = normalizeEgyptPhoneOrEmpty(courierPhone);
  const cleanLocation = (
    initialLocation.trim() || EDKU_ROUTE_WAYPOINTS[1]
  ).slice(0, 120);

  try {
    await waitForFirestoreWarmup();
    await assertSystemWritableForUser(courierUid);
    await assertCourierApprovedForWrite(courierUid);

    const orderRef = doc(db, 'orders', orderId);
    const dispatchRef = doc(db, 'dispatchQueue', orderId);

    const txResult = await runWriteWithNetworkRetry(async () =>
      runTransaction(db, async (tx) => {
        // Read public dispatch ticket first so already-claimed orders fail cleanly
        // without triggering a permission-denied read on orders/{orderId}.
        const dispatchSnap = await tx.get(dispatchRef);
        const dispatchData = dispatchSnap.exists()
          ? (dispatchSnap.data() ?? {})
          : null;

        if (dispatchData) {
          const ticketStatus = String(dispatchData.status ?? '');
          const ticketCourierId = String(dispatchData.courierId ?? '').trim();

          if (ticketStatus === 'cancelled') {
            throw new Error('تم إلغاء هذا الطلب قبل استلامه.');
          }
          if (ticketStatus === 'delivered') {
            throw new Error('تم توصيل هذا الطلب بالفعل.');
          }
          if (ticketCourierId && ticketCourierId !== courierUid) {
            throw new Error('تم استلام هذا الطلب بالفعل من كابتن توصيل آخر.');
          }
          if (
            (ticketStatus === 'on_the_way' || ticketStatus === 'delivering') &&
            ticketCourierId === courierUid
          ) {
            return {
              alreadyPicked: true,
              customerId: String(dispatchData.customerId ?? ''),
            };
          }
          if (ticketStatus !== 'ready' && ticketCourierId !== courierUid) {
            throw new Error(
              'الطلب لا يزال قيد التحضير لدى المتجر — سيظهر للاستلام فور جاهزيته.'
            );
          }
        }

        const orderSnap = await tx.get(orderRef);
        if (!orderSnap.exists()) {
          throw new Error('لم يتم العثور على هذا الطلب.');
        }

        const orderData = orderSnap.data() ?? {};
        const orderStatus = String(orderData.status ?? '');
        const orderCourierId = String(orderData.courierId ?? '').trim();

        if (orderStatus === 'cancelled') {
          throw new Error('تم إلغاء هذا الطلب قبل استلامه.');
        }
        if (orderStatus === 'delivered') {
          throw new Error('تم توصيل هذا الطلب بالفعل.');
        }
        if (orderCourierId && orderCourierId !== courierUid) {
          throw new Error('تم استلام هذا الطلب بالفعل من كابتن توصيل آخر.');
        }
        if (
          (orderStatus === 'on_the_way' || orderStatus === 'delivering') &&
          orderCourierId === courierUid
        ) {
          return {
            alreadyPicked: true,
            customerId: String(
              orderData.customerId ?? dispatchData?.customerId ?? ''
            ),
          };
        }
        if (orderStatus !== 'ready' && orderCourierId !== courierUid) {
          throw new Error(
            'الطلب لا يزال قيد التحضير لدى المتجر — سيظهر للاستلام فور جاهزيته.'
          );
        }

        const storeFallbackCoords = resolveEdkuCoordsForNeighborhood(
          String(dispatchData?.storeNeighborhood ?? 'شارع البحر')
        );
        const cleanCoords = sanitizeEdkuCoords(
          coords ?? {
            lat: storeFallbackCoords.lat,
            lng: storeFallbackCoords.lng,
          }
        );

        tx.update(orderRef, {
          status: 'on_the_way',
          courierId: courierUid,
          courierName: cleanCourierName,
          courierPhone: cleanCourierPhone,
          courierLocation: cleanLocation,
          ...cleanCoords,
          updatedAt: serverTimestamp(),
        });

        if (dispatchSnap.exists()) {
          tx.update(dispatchRef, {
            status: 'on_the_way',
            courierId: courierUid,
            courierName: cleanCourierName,
            ...cleanCoords,
            updatedAt: serverTimestamp(),
          });
        }

        return {
          alreadyPicked: false,
          customerId: String(
            dispatchData?.customerId ?? orderData.customerId ?? ''
          ),
        };
      })
    );

    if (!txResult.alreadyPicked && txResult.customerId) {
      void createNotificationBestEffort(txResult.customerId, {
        title: `${cleanCourierName.slice(0, 40)} في الطريق إليك الآن!`,
        body: 'يمكنك متابعة موقع الاسكوتر لحظة بلحظة على خريطة إدكو الحية.',
        type: 'order_update',
        orderId,
      });
    }
  } catch (error) {
    if (isArabicBusinessError(error)) {
      throw error;
    }
    logFirestoreFailure(
      'orders',
      orderId,
      'pickupOrderByCourierInFirestore',
      error
    );
    handleFirestoreError(error, OperationType.UPDATE, orderPath);
  }
}

export async function updateOrderCourierLocationInFirestore(
  orderId: string,
  courierUid: string,
  courierName: string,
  courierPhone: string,
  nextLocation: string,
  coords?: { lat?: number; lng?: number }
): Promise<void> {
  const orderPath = `orders/${orderId}`;
  const cleanCourierName = (courierName.trim() || 'كابتن توصيل إدكاوي').slice(
    0,
    80
  );
  const cleanCourierPhone = normalizeEgyptPhoneOrEmpty(courierPhone);
  const cleanLocation = (nextLocation.trim() || EDKU_ROUTE_WAYPOINTS[1]).slice(
    0,
    120
  );
  const cleanCoords = sanitizeEdkuCoords(coords);

  try {
    const dispatchRef = doc(db, 'dispatchQueue', orderId);
    const dispatchSnap = await getDoc(dispatchRef).catch(() => null);
    await runWriteWithNetworkRetry(async () => {
      const batch = writeBatch(db);
      batch.update(doc(db, 'orders', orderId), {
        status: 'on_the_way',
        courierId: courierUid,
        courierName: cleanCourierName,
        courierPhone: cleanCourierPhone,
        courierLocation: cleanLocation,
        ...cleanCoords,
        updatedAt: serverTimestamp(),
      });
      if (!dispatchSnap || dispatchSnap.exists()) {
        batch.update(dispatchRef, {
          status: 'on_the_way',
          courierId: courierUid,
          courierName: cleanCourierName,
          ...cleanCoords,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    });
  } catch (error) {
    logFirestoreFailure(
      'orders',
      orderId,
      'updateOrderCourierLocationInFirestore',
      error
    );
    handleFirestoreError(error, OperationType.UPDATE, orderPath);
  }
}

export async function completeOrderDeliveryInFirestore(
  orderId: string,
  finalLocation: string,
  courierUid?: string,
  courierName?: string,
  coords?: { lat?: number; lng?: number }
): Promise<void> {
  const orderPath = `orders/${orderId}`;
  const cleanFinalLocation = (
    finalLocation.trim() ||
    EDKU_ROUTE_WAYPOINTS[EDKU_ROUTE_WAYPOINTS.length - 1]
  ).slice(0, 120);
  const cleanCoords = sanitizeEdkuCoords(coords);

  try {
    await waitForFirestoreWarmup();
    if (courierUid?.trim()) {
      await assertSystemWritableForUser(courierUid.trim());
    }
    const orderRef = doc(db, 'orders', orderId);
    const dispatchRef = doc(db, 'dispatchQueue', orderId);
    const [orderSnap, dispatchSnap] = await Promise.all([
      getDocWithRetry(orderRef, 'orders', orderId).catch(() => null),
      getDocWithRetry(dispatchRef, 'dispatchQueue', orderId),
    ]);

    const liveStatus = String(
      orderSnap?.data()?.status ?? dispatchSnap.data()?.status ?? ''
    );
    if (liveStatus === 'delivered') {
      return;
    }
    if (liveStatus === 'cancelled') {
      throw new Error('تم إلغاء هذا الطلب ولا يمكن تسجيله كمكتمل.');
    }

    const existingCourierUid = String(
      orderSnap?.data()?.courierId ?? dispatchSnap.data()?.courierId ?? ''
    ).trim();
    const existingCourierName = String(
      orderSnap?.data()?.courierName ?? dispatchSnap.data()?.courierName ?? ''
    ).trim();
    const resolvedCourierUid = (
      courierUid?.trim() ||
      existingCourierUid ||
      ''
    ).trim();
    const cleanCourierName = (
      courierName?.trim() ||
      existingCourierName ||
      'كابتن توصيل إدكاوي'
    ).slice(0, 80);

    const subtotalEgp = Math.max(
      0,
      Math.trunc(
        Number(orderSnap?.data()?.subtotal ?? dispatchSnap.data()?.subtotal ?? 0)
      )
    );
    const basePoints = Math.max(10, Math.floor(subtotalEgp / 10) * 5);

    await runWriteWithNetworkRetry(async () => {
      const batch = writeBatch(db);
      batch.update(orderRef, {
        status: 'delivered',
        ...(resolvedCourierUid
          ? { courierId: resolvedCourierUid, courierName: cleanCourierName }
          : {}),
        courierLocation: cleanFinalLocation,
        ...cleanCoords,
        pointsEarned: basePoints,
        pointsAwarded: true,
        updatedAt: serverTimestamp(),
      });
      if (dispatchSnap.exists()) {
        batch.update(dispatchRef, {
          status: 'delivered',
          ...(resolvedCourierUid
            ? { courierId: resolvedCourierUid, courierName: cleanCourierName }
            : {}),
          ...cleanCoords,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    });

    // Award Sales Agent 24h Escrow Commission if order's Store or Customer was referred
    void awardSalesAgentCommissionForDeliveredOrderBestEffort(
      orderId,
      orderSnap?.data() ?? dispatchSnap.data() ?? {}
    );

    // Decrement product & variant inventory strictly upon delivery completion
    const deliveredItemsRaw = Array.isArray(orderSnap?.data()?.items)
      ? (orderSnap!.data()!.items as Array<Record<string, unknown>>)
      : [];

    if (deliveredItemsRaw.length > 0) {
      const groupedByProduct = new Map<
        string,
        Array<{ variantId?: string; qty: number }>
      >();
      for (const rawItem of deliveredItemsRaw) {
        const pid =
          typeof rawItem.productId === 'string' ? rawItem.productId.trim() : '';
        const qty = Math.max(1, Math.trunc(Number(rawItem.quantity ?? 1)));
        const vid =
          typeof rawItem.variantId === 'string' && rawItem.variantId.trim()
            ? rawItem.variantId.trim()
            : undefined;
        if (isValidFirestoreId(pid)) {
          const prevArr = groupedByProduct.get(pid) ?? [];
          prevArr.push({ variantId: vid, qty });
          groupedByProduct.set(pid, prevArr);
        }
      }

      for (const [pid, deductions] of groupedByProduct.entries()) {
        void (async () => {
          try {
            const pRef = doc(db, 'products', pid);
            const pSnap = await getDoc(pRef);
            if (!pSnap.exists()) return;
            const pData = pSnap.data() ?? {};
            if (typeof pData.stockQuantity !== 'number') return;

            const existingVariants = parseProductVariantsArray(pData.variants);
            if (pData.hasVariants === true && existingVariants && existingVariants.length > 0) {
              const updatedVariants = existingVariants.map((v) => {
                const variantDeduction = deductions
                  .filter((d) => d.variantId === v.variantId)
                  .reduce((sum, d) => sum + d.qty, 0);
                if (variantDeduction <= 0) return v;
                return {
                  ...v,
                  stock: Math.max(0, v.stock - variantDeduction),
                };
              });
              const unmatchedQty = deductions
                .filter(
                  (d) =>
                    !d.variantId ||
                    !existingVariants.some((v) => v.variantId === d.variantId)
                )
                .reduce((sum, d) => sum + d.qty, 0);
              const nextVariantSum = updatedVariants.reduce(
                (sum, v) => sum + v.stock,
                0
              );
              const nextStock = Math.min(
                Math.trunc(Number(pData.stockQuantity)),
                Math.max(0, nextVariantSum - unmatchedQty)
              );
              await updateDoc(pRef, {
                stockQuantity: nextStock,
                variants: updatedVariants,
                isAvailable: nextStock > 0 ? Boolean(pData.isAvailable) : false,
              });
            } else {
              const totalDeducted = deductions.reduce((s, d) => s + d.qty, 0);
              const curStock = Math.max(0, Math.trunc(Number(pData.stockQuantity)));
              const nextStock = Math.max(0, curStock - totalDeducted);
              if (nextStock < curStock) {
                await updateDoc(pRef, {
                  stockQuantity: nextStock,
                  isAvailable: nextStock > 0 ? Boolean(pData.isAvailable) : false,
                });
              }
            }
          } catch {
            // Non-fatal delivery stock sync
          }
        })();
      }
    }

    const customerId = String(
      orderSnap?.data()?.customerId ?? dispatchSnap.data()?.customerId ?? ''
    );
    const customerName = String(
      orderSnap?.data()?.customerName ?? 'عميل إدكاوي'
    );
    const neighborhood = String(
      orderSnap?.data()?.deliveryNeighborhood ??
        dispatchSnap.data()?.deliveryNeighborhood ??
        ''
    );
    const storeName = String(dispatchSnap.data()?.storeName ?? 'المتجر');

    if (customerId && isValidFirestoreId(customerId)) {
      void incrementCustomerLoyaltyInDirectory(
        customerId,
        customerName,
        neighborhood,
        basePoints
      );
      void createNotificationBestEffort(customerId, {
        title: `تم توصيل طلبك من ${storeName.slice(0, 40)} وكسبت +${basePoints} نقطة!`,
        body: 'شكراً لطلبك من إدكاوي — يسعدنا تقييمك للمتجر والمندوب ومكافأة الكابتن إن رغبت.',
        type: 'order_update',
        orderId,
      });
    }
  } catch (error) {
    if (isArabicBusinessError(error)) {
      throw error;
    }
    logFirestoreFailure(
      'orders',
      orderId,
      'completeOrderDeliveryInFirestore',
      error
    );
    handleFirestoreError(error, OperationType.UPDATE, orderPath);
  }
}

export async function assignCourierManuallyInFirestore(
  orderId: string,
  courierId: string,
  courierName: string,
  courierPhone: string,
  courierLocation: string
): Promise<void> {
  const orderPath = `orders/${orderId}`;
  const cleanCourierId = courierId.trim().slice(0, 128);
  const cleanCourierName = (courierName.trim() || 'كابتن توصيل إدكاوي').slice(
    0,
    80
  );
  const cleanCourierPhone = normalizeEgyptPhoneOrEmpty(courierPhone);
  const cleanLocation = (
    courierLocation.trim() || EDKU_ROUTE_WAYPOINTS[0]
  ).slice(0, 120);

  try {
    await waitForFirestoreWarmup();
    const orderRef = doc(db, 'orders', orderId);
    const dispatchRef = doc(db, 'dispatchQueue', orderId);
    const [orderSnap, dispatchSnap] = await Promise.all([
      getDocWithRetry(orderRef, 'orders', orderId),
      getDocWithRetry(dispatchRef, 'dispatchQueue', orderId),
    ]);
    if (!orderSnap.exists()) {
      throw new Error('لم يتم العثور على هذا الطلب.');
    }

    await runWriteWithNetworkRetry(async () => {
      const batch = writeBatch(db);
      batch.update(orderRef, {
        courierId: cleanCourierId,
        courierName: cleanCourierName,
        courierPhone: cleanCourierPhone,
        courierLocation: cleanLocation,
        updatedAt: serverTimestamp(),
      });
      if (dispatchSnap.exists()) {
        batch.update(dispatchRef, {
          courierId: cleanCourierId,
          courierName: cleanCourierName,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    });
  } catch (error) {
    if (isArabicBusinessError(error)) {
      throw error;
    }
    logFirestoreFailure(
      'orders',
      orderId,
      'assignCourierManuallyInFirestore',
      error
    );
    handleFirestoreError(error, OperationType.UPDATE, orderPath);
  }
}

export async function cancelPendingOrderInFirestore(
  orderId: string,
  pharmacistNote?: string
): Promise<void> {
  const orderPath = `orders/${orderId}`;
  try {
    await waitForFirestoreWarmup();
    const orderRef = doc(db, 'orders', orderId);
    const dispatchRef = doc(db, 'dispatchQueue', orderId);
    const callerUid = auth.currentUser?.uid ?? '';
    const cleanNote = pharmacistNote?.trim()
      ? { pharmacistNote: pharmacistNote.trim().slice(0, 280) }
      : {};

    await runWriteWithNetworkRetry(async () =>
      runTransaction(db, async (tx) => {
        const [orderSnap, dispatchSnap] = await Promise.all([
          tx.get(orderRef),
          tx.get(dispatchRef),
        ]);

        if (!orderSnap.exists()) {
          throw new Error('لم يتم العثور على هذا الطلب.');
        }
        const orderData = orderSnap.data() ?? {};
        const liveStatus = String(orderData.status ?? '');
        if (liveStatus === 'cancelled') {
          return;
        }
        if (liveStatus === 'delivered') {
          throw new Error('تم توصيل هذا الطلب بالفعل ولا يمكن إلغاؤه.');
        }
        if (liveStatus === 'on_the_way' || liveStatus === 'delivering') {
          throw new Error(
            'الطلب في الطريق إليك الآن مع المندوب ولا يمكن إلغاؤه تلقائياً.'
          );
        }

        const isCallerCustomer = callerUid && orderData.customerId === callerUid;
        const isCallerMerchant = callerUid && orderData.storeOwnerId === callerUid;
        if (
          isCallerCustomer &&
          !isCallerMerchant &&
          (liveStatus === 'preparing' || liveStatus === 'ready')
        ) {
          throw new Error(
            'بدأ المتجر في تحضير طلبك بالفعل ولا يمكن إلغاؤه تلقائياً الآن.'
          );
        }

        const isWalletPaid =
          String(orderData.paymentMethod ?? '') === 'wallet' &&
          Number(orderData.totalAmount ?? 0) > 0 &&
          typeof orderData.customerId === 'string' &&
          isValidFirestoreId(orderData.customerId);

        let walletUserSnap: DocumentSnapshot<DocumentData> | null = null;
        if (isWalletPaid && isCallerCustomer) {
          walletUserSnap = await tx.get(doc(db, 'users', String(orderData.customerId)));
        }

        tx.update(orderRef, {
          status: 'cancelled',
          ...cleanNote,
          updatedAt: serverTimestamp(),
        });
        if (dispatchSnap.exists()) {
          tx.update(dispatchRef, {
            status: 'cancelled',
            ...cleanNote,
            updatedAt: serverTimestamp(),
          });
        }

        if (isWalletPaid && isCallerCustomer && walletUserSnap?.exists()) {
          const customerId = String(orderData.customerId);
          const refundAmount = Number(orderData.totalAmount ?? 0);
          const prevBalance = Math.max(0, Number(walletUserSnap.data()?.walletBalance ?? 0));
          const nextBalance = Number((prevBalance + refundAmount).toFixed(2));
          const refundTxRef = doc(collection(db, 'wallet_transactions'));

          tx.update(doc(db, 'users', customerId), {
            walletBalance: nextBalance,
            lastRefundOrderId: orderId,
            updatedAt: serverTimestamp(),
          });
          tx.set(refundTxRef, {
            id: refundTxRef.id,
            userId: customerId,
            type: 'order_refund',
            amount: refundAmount,
            balanceAfter: nextBalance,
            description: `استرداد قيمة طلب ملغى #${orderId.slice(-6).toUpperCase()}`.slice(0, 200),
            orderId,
            createdBy: customerId,
            createdAt: serverTimestamp(),
          });
        }
      })
    );
  } catch (error) {
    if (isArabicBusinessError(error)) {
      throw error;
    }
    logFirestoreFailure(
      'orders',
      orderId,
      'cancelPendingOrderInFirestore',
      error
    );
    handleFirestoreError(error, OperationType.UPDATE, orderPath);
  }
}

/* ============================================================================
 * COURIER PORTAL & ADMIN COURIER QUEUE LISTENERS
 * ========================================================================== */

export function listenToSingleCourier(
  courierUid: string,
  onCourierUpdate: (courier: CourierRecord | null) => void,
  onErrorCallback?: (err: Error) => void
): Unsubscribe {
  const courierPath = `couriers/${courierUid}`;
  let privateCourier: CourierRecord | null | undefined = undefined;
  let dirCourier: CourierRecord | null | undefined = undefined;

  const emitMerged = () => {
    if (privateCourier === undefined && dirCourier === undefined) return;
    if (!privateCourier && !dirCourier) {
      if (privateCourier === null && dirCourier === null) {
        onCourierUpdate(null);
      }
      return;
    }
    const base = privateCourier ?? dirCourier!;
    onCourierUpdate({
      ...base,
      rating: dirCourier?.rating ?? base.rating,
      reviewCount: dirCourier?.reviewCount ?? base.reviewCount,
      walletBalance: Math.max(
        base.walletBalance ?? 0,
        dirCourier?.walletBalance ?? 0
      ),
      totalTipsEgp: Math.max(
        base.totalTipsEgp ?? 0,
        dirCourier?.totalTipsEgp ?? 0
      ),
      lat: base.lat ?? dirCourier?.lat,
      lng: base.lng ?? dirCourier?.lng,
    });
  };

  const unsubPrivate = onSnapshot(
    doc(db, 'couriers', courierUid),
    (docSnap) => {
      privateCourier = docSnap.exists() ? parseCourierDoc(docSnap) : null;
      emitMerged();
    },
    (error) => {
      logFirestoreFailure(
        'couriers',
        courierUid,
        'listenToSingleCourier',
        error
      );
      onErrorCallback?.(error instanceof Error ? error : new Error(String(error)));
      void courierPath;
    }
  );

  const unsubDir = onSnapshot(
    doc(db, 'courierDirectory', courierUid),
    (dirSnap) => {
      dirCourier = dirSnap.exists() ? parseCourierDoc(dirSnap) : null;
      emitMerged();
    },
    () => {
      dirCourier = null;
      emitMerged();
    }
  );

  return () => {
    unsubPrivate();
    unsubDir();
  };
}

export function listenToAdminCouriers(
  onCouriersUpdate: (couriers: CourierRecord[]) => void,
  onErrorCallback?: (err: Error) => void
): Unsubscribe {
  const dirPath = 'courierDirectory';
  const q = query(
    collection(db, dirPath),
    where('approvalStatus', 'in', ['pending', 'approved', 'rejected'])
  );

  return onSnapshot(
    q,
    (snapshot) => {
      void (async () => {
        const dirDocs = snapshot.docs;
        const enriched = await Promise.all(
          dirDocs.map(async (dirSnap) => {
            try {
              const privateSnap = await getDocWithRetry(
                doc(db, 'couriers', dirSnap.id),
                'couriers',
                dirSnap.id
              );
              if (privateSnap.exists()) {
                return parseCourierDoc(privateSnap);
              }
            } catch {
              // Fallback to directory entry
            }
            return parseCourierDoc(dirSnap);
          })
        );
        enriched.sort((a, b) => {
          if (a.approvalStatus === 'pending' && b.approvalStatus !== 'pending') {
            return -1;
          }
          if (a.approvalStatus !== 'pending' && b.approvalStatus === 'pending') {
            return 1;
          }
          return a.name.localeCompare(b.name, 'ar');
        });
        onCouriersUpdate(enriched);
      })();
    },
    (error) => {
      logFirestoreFailure(dirPath, 'admin_all', 'listenToAdminCouriers', error);
      onErrorCallback?.(error instanceof Error ? error : new Error(String(error)));
    }
  );
}

export async function upsertCourierAvailabilityInFirestore(
  courierUid: string,
  input: CourierProfileInput,
  completedDeliveries: number
): Promise<void> {
  const normalizedPhone = normalizeEgyptPhoneOrEmpty(input.phone);
  const normalizedInput: CourierProfileInput = {
    ...input,
    phone: EGYPT_PHONE_REGEX.test(normalizedPhone)
      ? normalizedPhone
      : input.phone.trim(),
  };

  const validation = validateCourierProfile(normalizedInput);
  if (!validation.valid) {
    throw new Error(Object.values(validation.errors)[0]);
  }

  const courierPath = `couriers/${courierUid}`;
  const cleanName = normalizedInput.name.trim().slice(0, 80);
  const cleanPhone = normalizedInput.phone.trim().slice(0, 20);
  const coordsPatch = isValidEdkuCoordPair(input.lat, input.lng)
    ? { lat: Number(input.lat!.toFixed(6)), lng: Number(input.lng!.toFixed(6)) }
    : {};
  const cleanArea = (
    normalizedInput.neighborhood.trim() ||
    (coordsPatch.lat && coordsPatch.lng
      ? resolveNearestEdkuNeighborhood(coordsPatch.lat, coordsPatch.lng)
      : 'شارع البحر')
  ).slice(0, 80);
  const cleanDeliveries = Math.max(0, Math.trunc(completedDeliveries));

  try {
    await waitForFirestoreWarmup();
    const courierRef = doc(db, 'couriers', courierUid);
    const dirRef = doc(db, 'courierDirectory', courierUid);
    const [courierSnap, dirSnap] = await Promise.all([
      getDocWithRetry(courierRef, 'couriers', courierUid).catch(() => null),
      getDocWithRetry(dirRef, 'courierDirectory', courierUid),
    ]);
    await runWriteWithNetworkRetry(async () => {
      const batch = writeBatch(db);
      if (courierSnap?.exists()) {
        batch.update(courierRef, {
          name: cleanName,
          phone: cleanPhone,
          vehicleType: normalizedInput.vehicleType,
          neighborhood: cleanArea,
          ...coordsPatch,
          isAvailable: Boolean(normalizedInput.isAvailable),
          completedDeliveries: cleanDeliveries,
          updatedAt: serverTimestamp(),
        });
      }
      if (dirSnap.exists()) {
        batch.update(dirRef, {
          name: cleanName,
          vehicleType: normalizedInput.vehicleType,
          neighborhood: cleanArea,
          ...coordsPatch,
          isAvailable: Boolean(normalizedInput.isAvailable),
          completedDeliveries: cleanDeliveries,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    });
  } catch (error) {
    logFirestoreFailure(
      'couriers',
      courierUid,
      'upsertCourierAvailabilityInFirestore',
      error
    );
    handleFirestoreError(error, OperationType.UPDATE, courierPath);
  }
}

/* ============================================================================
 * CUSTOMER PROFILE, SAVED MAP ADDRESSES & LOYALTY POINTS
 * ========================================================================== */

function parseUserProfileDoc(
  docSnap: DocumentSnapshot<DocumentData>
): UserProfileRecord | null {
  if (!docSnap.exists()) return null;
  const d = docSnap.data() ?? {};
  const rawRole = String(d.role ?? 'customer');
  const role: PortalRole =
    rawRole === 'admin' ||
    rawRole === 'support_agent' ||
    rawRole === 'operations' ||
    rawRole === 'sales_agent' ||
    rawRole === 'store' ||
    rawRole === 'courier' ||
    rawRole === 'customer'
      ? rawRole
      : 'customer';

  const rawFavs = Array.isArray(d.favoriteStoreIds) ? d.favoriteStoreIds : [];
  const favoriteStoreIds = rawFavs
    .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    .slice(0, 50);

  const rawAddrs = Array.isArray(d.savedAddresses) ? d.savedAddresses : [];
  const savedAddresses: SavedAddressItem[] = rawAddrs
    .map((item: Record<string, unknown>, idx: number) => ({
      id: typeof item.id === 'string' ? item.id : `addr_${idx + 1}`,
      label: typeof item.label === 'string' ? item.label : 'عنواني',
      neighborhood:
        typeof item.neighborhood === 'string'
          ? item.neighborhood
          : 'شارع البحر',
      address: typeof item.address === 'string' ? item.address : '',
      ...(typeof item.lat === 'number' ? { lat: item.lat } : {}),
      ...(typeof item.lng === 'number' ? { lng: item.lng } : {}),
      isDefault: Boolean(item.isDefault),
    }))
    .filter((a) => a.address.trim().length >= 4)
    .slice(0, 10);

  return {
    uid: docSnap.id,
    role,
    customerCode: isValidCustomerCodeFormat(d.customerCode)
      ? d.customerCode.trim()
      : undefined,
    referralCode:
      typeof d.referralCode === 'string' && d.referralCode.trim()
        ? d.referralCode.trim()
        : undefined,
    referredByCode:
      typeof d.referredByCode === 'string' && d.referredByCode.trim()
        ? d.referredByCode.trim()
        : undefined,
    referredByAgentId:
      typeof d.referredByAgentId === 'string' && d.referredByAgentId.trim()
        ? d.referredByAgentId.trim()
        : undefined,
    requiresEmailVerification:
      typeof d.requiresEmailVerification === 'boolean'
        ? d.requiresEmailVerification
        : undefined,
    lastReviewPromptAtIso:
      typeof d.lastReviewPromptAtIso === 'string' && d.lastReviewPromptAtIso.trim()
        ? d.lastReviewPromptAtIso.trim()
        : undefined,
    isBanned: typeof d.isBanned === 'boolean' ? d.isBanned : undefined,
    banType:
      d.banType === 'temporary_24h' ||
      d.banType === 'suspended' ||
      d.banType === 'permanent'
        ? d.banType
        : undefined,
    banUntilIso:
      typeof d.banUntilIso === 'string' && d.banUntilIso.trim()
        ? d.banUntilIso.trim()
        : undefined,
    banReason:
      typeof d.banReason === 'string' && d.banReason.trim()
        ? d.banReason.trim()
        : undefined,
    email: typeof d.email === 'string' ? d.email : undefined,
    name: typeof d.name === 'string' ? d.name : undefined,
    phone: typeof d.phone === 'string' ? d.phone : undefined,
    defaultNeighborhood:
      typeof d.defaultNeighborhood === 'string'
        ? d.defaultNeighborhood
        : undefined,
    defaultAddress:
      typeof d.defaultAddress === 'string' ? d.defaultAddress : undefined,
    defaultLat: typeof d.defaultLat === 'number' ? d.defaultLat : undefined,
    defaultLng: typeof d.defaultLng === 'number' ? d.defaultLng : undefined,
    profileCompleted:
      typeof d.profileCompleted === 'boolean' ? d.profileCompleted : undefined,
    favoriteStoreIds,
    savedAddresses,
    darkMode: typeof d.darkMode === 'boolean' ? d.darkMode : undefined,
    storeId: typeof d.storeId === 'string' ? d.storeId : undefined,
    points:
      typeof d.points === 'number'
        ? Math.max(0, Math.trunc(d.points))
        : undefined,
    walletBalance:
      typeof d.walletBalance === 'number'
        ? Math.max(0, Number(d.walletBalance))
        : 0,
    totalSpentEgp:
      typeof d.totalSpentEgp === 'number'
        ? Math.max(0, Math.trunc(d.totalSpentEgp))
        : 0,
    customerReferralCode:
      typeof d.customerReferralCode === 'string' && d.customerReferralCode.trim()
        ? d.customerReferralCode.trim()
        : undefined,
    currentStreak:
      typeof d.currentStreak === 'number'
        ? Math.min(5, Math.max(0, Math.trunc(d.currentStreak)))
        : undefined,
    freeDeliveryRewards:
      typeof d.freeDeliveryRewards === 'number'
        ? Math.max(0, Math.trunc(d.freeDeliveryRewards))
        : undefined,
    lastDeliveredOrderAtIso:
      typeof d.lastDeliveredOrderAtIso === 'string'
        ? d.lastDeliveredOrderAtIso
        : undefined,
    lastSpinDate:
      typeof d.lastSpinDate === 'string' ? d.lastSpinDate : undefined,
    createdAtIso: toIsoString(d.createdAt),
    updatedAtIso: toIsoString(d.updatedAt),
  };
}

export function listenToUserProfile(
  uid: string,
  onData: (profile: UserProfileRecord | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!uid || !isValidFirestoreId(uid)) {
    onData(null);
    return () => {};
  }
  let baseProfile: UserProfileRecord | null | undefined = undefined;
  let dirLoyalty: CustomerDirectoryEntry | null | undefined = undefined;
  let codeBackfillTriggered = false;

  const emitMerged = () => {
    if (baseProfile === undefined) return;
    if (!baseProfile) {
      onData(null);
      return;
    }
    const mergedPoints = Math.max(
      baseProfile.points ?? 0,
      dirLoyalty?.points ?? 0
    );
    const mergedStreak =
      dirLoyalty?.currentStreak ?? baseProfile.currentStreak ?? 0;
    const mergedRewards = Math.max(
      baseProfile.freeDeliveryRewards ?? 0,
      dirLoyalty?.freeDeliveryRewards ?? 0
    );
    const mergedCustomerCode =
      baseProfile.customerCode ?? dirLoyalty?.customerCode;
    const mergedBanType = baseProfile.banType ?? dirLoyalty?.banType;
    const mergedBanUntilIso = baseProfile.banUntilIso ?? dirLoyalty?.banUntilIso;
    const isTempBanExpired =
      mergedBanType === 'temporary_24h' &&
      mergedBanUntilIso &&
      !Number.isNaN(Date.parse(mergedBanUntilIso)) &&
      Date.now() > Date.parse(mergedBanUntilIso);
    const mergedIsBanned = isTempBanExpired
      ? false
      : Boolean(baseProfile.isBanned || dirLoyalty?.isBanned);
    const mergedBanReason =
      baseProfile.banReason || dirLoyalty?.banReason || undefined;
    const mergedCustomerRefCode =
      baseProfile.customerReferralCode || generateCustomerReferralCode(uid);

    if (
      !codeBackfillTriggered &&
      baseProfile.role === 'customer' &&
      (!mergedCustomerCode || !baseProfile.customerReferralCode) &&
      auth.currentUser &&
      auth.currentUser.uid === uid &&
      !auth.currentUser.isAnonymous
    ) {
      codeBackfillTriggered = true;
      void (async () => {
        try {
          const freshCode = mergedCustomerCode || (await allocateFreshCustomerCode());
          await updateDoc(doc(db, 'users', uid), {
            customerCode: freshCode,
            customerReferralCode: mergedCustomerRefCode,
            updatedAt: serverTimestamp(),
          });
          await syncCustomerDirectoryEntry(uid, {
            name: baseProfile?.name,
            customerCode: freshCode,
          });
        } catch {
          // Non-fatal backfill
        }
      })();
    }

    onData({
      ...baseProfile,
      customerCode: mergedCustomerCode,
      customerReferralCode: mergedCustomerRefCode,
      isBanned: mergedIsBanned,
      banType: mergedBanType,
      banUntilIso: mergedBanUntilIso,
      banReason: mergedBanReason,
      points: mergedPoints,
      totalSpentEgp: Math.max(
        baseProfile.totalSpentEgp ?? 0,
        dirLoyalty?.totalSpentEgp ?? 0
      ),
      currentStreak: mergedStreak,
      freeDeliveryRewards: mergedRewards,
    });
  };

  const unsubUser = onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      baseProfile = parseUserProfileDoc(snap);
      emitMerged();
    },
    (err) => {
      logFirestoreFailure('users', uid, 'listenToUserProfile', err);
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  );

  const unsubDir = onSnapshot(
    doc(db, 'customerDirectory', uid),
    (snap) => {
      dirLoyalty = snap.exists() ? parseCustomerDirectoryDoc(snap) : null;
      emitMerged();
    },
    () => {
      dirLoyalty = null;
      emitMerged();
    }
  );

  return () => {
    unsubUser();
    unsubDir();
  };
}

export async function completeCustomerOnboardingInFirestore(
  uid: string,
  input: CompleteProfileInput,
  email?: string | null
): Promise<void> {
  const errMsg = validateCompleteProfileForm(input);
  if (errMsg) {
    throw new Error(errMsg);
  }
  const cleanName = input.name.trim().slice(0, 80);
  const cleanPhone = normalizeEgyptPhoneOrEmpty(input.phone);
  const coords = isValidEdkuCoordPair(input.defaultLat, input.defaultLng)
    ? {
        lat: Number(input.defaultLat!.toFixed(6)),
        lng: Number(input.defaultLng!.toFixed(6)),
      }
    : resolveEdkuCoordsForNeighborhood(input.defaultNeighborhood);
  const cleanNeighborhood = (
    input.defaultNeighborhood.trim() ||
    resolveNearestEdkuNeighborhood(coords.lat, coords.lng)
  ).slice(0, 80);
  const cleanAddress = input.defaultAddress.trim().slice(0, 200);
  const cleanEmail = (email ?? auth.currentUser?.email ?? '')
    .trim()
    .toLowerCase()
    .slice(0, 100);

  const defaultAddrItem: SavedAddressItem = {
    id: 'addr_default',
    label: 'المنزل',
    neighborhood: cleanNeighborhood,
    address: cleanAddress,
    lat: coords.lat,
    lng: coords.lng,
    isDefault: true,
  };

  const userPath = `users/${uid}`;
  try {
    await waitForFirestoreWarmup();
    if (auth.currentUser && cleanName) {
      await updateProfile(auth.currentUser, { displayName: cleanName }).catch(
        () => {}
      );
    }
    const userRef = doc(db, 'users', uid);
    const snap = await getDocWithRetry(userRef, 'users', uid);
    const existingCode = snap.exists() ? snap.data()?.customerCode : undefined;
    const customerCode = isValidCustomerCodeFormat(existingCode)
      ? existingCode.trim()
      : await allocateFreshCustomerCode();

    if (!snap.exists()) {
      await setDoc(userRef, {
        role: 'customer',
        customerCode,
        ...(cleanEmail ? { email: cleanEmail } : {}),
        name: cleanName,
        phone: cleanPhone,
        defaultNeighborhood: cleanNeighborhood,
        defaultAddress: cleanAddress,
        defaultLat: coords.lat,
        defaultLng: coords.lng,
        profileCompleted: true,
        savedAddresses: [defaultAddrItem],
        points: 20, // Welcome bonus points!
        currentStreak: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      void syncCustomerDirectoryEntry(uid, {
        name: cleanName,
        customerCode,
        neighborhood: cleanNeighborhood,
        points: 20,
        currentStreak: 0,
      });
    } else {
      await updateDoc(userRef, {
        ...(!isValidCustomerCodeFormat(existingCode) ? { customerCode } : {}),
        name: cleanName,
        ...(cleanEmail ? { email: cleanEmail } : {}),
        phone: cleanPhone,
        defaultNeighborhood: cleanNeighborhood,
        defaultAddress: cleanAddress,
        defaultLat: coords.lat,
        defaultLng: coords.lng,
        profileCompleted: true,
        savedAddresses: [defaultAddrItem],
        updatedAt: serverTimestamp(),
      });
      void syncCustomerDirectoryEntry(uid, {
        name: cleanName,
        customerCode,
        neighborhood: cleanNeighborhood,
      });
    }
    if (cleanEmail) {
      void syncRegisteredAccountMarker(cleanEmail, 'customer');
    }
  } catch (error) {
    logFirestoreFailure('users', uid, 'completeCustomerOnboarding', error);
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function updateCustomerAccountDetailsInFirestore(
  uid: string,
  patch: {
    name?: string;
    phone?: string;
    defaultNeighborhood?: string;
    defaultAddress?: string;
    defaultLat?: number;
    defaultLng?: number;
    savedAddresses?: SavedAddressItem[];
    darkMode?: boolean;
  }
): Promise<void> {
  if (!uid || !isValidFirestoreId(uid)) return;
  const userPath = `users/${uid}`;
  const updatePayload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (patch.name !== undefined) {
    const cleanName = patch.name.trim().slice(0, 80);
    if (cleanName.length >= 2) {
      updatePayload.name = cleanName;
      if (auth.currentUser) {
        void updateProfile(auth.currentUser, { displayName: cleanName }).catch(
          () => {}
        );
      }
    }
  }
  if (patch.phone !== undefined) {
    const cleanPhone = normalizeEgyptPhoneOrEmpty(patch.phone);
    if (!EGYPT_PHONE_REGEX.test(cleanPhone)) {
      throw new Error(
        'يرجى إدخال رقم موبايل مصري صحيح مكون من ١١ رقماً (مثال: 01012345678).'
      );
    }
    updatePayload.phone = cleanPhone;
  }
  if (patch.defaultNeighborhood !== undefined) {
    updatePayload.defaultNeighborhood = patch.defaultNeighborhood
      .trim()
      .slice(0, 80);
  }
  if (patch.defaultAddress !== undefined) {
    const cleanAddr = patch.defaultAddress.trim().slice(0, 200);
    if (cleanAddr.length < 4) {
      throw new Error('يرجى إدخال عنوان واضح لا يقل عن ٤ أحرف.');
    }
    updatePayload.defaultAddress = cleanAddr;
    updatePayload.profileCompleted = true;
  }
  if (isValidEdkuCoordPair(patch.defaultLat, patch.defaultLng)) {
    updatePayload.defaultLat = Number(patch.defaultLat!.toFixed(6));
    updatePayload.defaultLng = Number(patch.defaultLng!.toFixed(6));
  }
  if (patch.savedAddresses !== undefined) {
    updatePayload.savedAddresses = patch.savedAddresses.slice(0, 10).map((a) => ({
      id: a.id.slice(0, 64),
      label: a.label.trim().slice(0, 40) || 'عنوان',
      neighborhood: a.neighborhood.trim().slice(0, 80) || 'شارع البحر',
      address: a.address.trim().slice(0, 200),
      ...(isValidEdkuCoordPair(a.lat, a.lng)
        ? { lat: Number(a.lat!.toFixed(6)), lng: Number(a.lng!.toFixed(6)) }
        : {}),
      isDefault: Boolean(a.isDefault),
    }));
  }
  if (patch.darkMode !== undefined) {
    updatePayload.darkMode = Boolean(patch.darkMode);
  }

  try {
    await waitForFirestoreWarmup();
    const userRef = doc(db, 'users', uid);
    const snap = await getDocWithRetry(userRef, 'users', uid);
    if (!snap.exists()) {
      await setDoc(userRef, {
        role: 'customer',
        createdAt: serverTimestamp(),
        ...updatePayload,
      });
    } else {
      await updateDoc(userRef, updatePayload);
    }
    if (patch.name || patch.defaultNeighborhood) {
      void syncCustomerDirectoryEntry(uid, {
        name: patch.name,
        neighborhood: patch.defaultNeighborhood,
      });
    }
  } catch (error) {
    logFirestoreFailure('users', uid, 'updateCustomerAccountDetails', error);
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

export async function toggleFavoriteStoreInFirestore(
  uid: string,
  storeId: string,
  currentFavorites: string[]
): Promise<string[]> {
  if (!uid || !auth.currentUser || auth.currentUser.isAnonymous) {
    throw new Error('يرجى تسجيل الدخول بحسابك لحفظ المتاجر في قائمة المفضلة.');
  }
  const cleanStoreId = storeId.trim();
  const existsInFavs = currentFavorites.includes(cleanStoreId);
  const nextFavs = existsInFavs
    ? currentFavorites.filter((id) => id !== cleanStoreId)
    : [cleanStoreId, ...currentFavorites.filter((id) => id !== cleanStoreId)].slice(
        0,
        50
      );

  const userPath = `users/${uid}`;
  try {
    await waitForFirestoreWarmup();
    const userRef = doc(db, 'users', uid);
    const snap = await getDocWithRetry(userRef, 'users', uid);
    if (!snap.exists()) {
      await setDoc(userRef, {
        role: 'customer',
        favoriteStoreIds: nextFavs,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        favoriteStoreIds: nextFavs,
        updatedAt: serverTimestamp(),
      });
    }
    return nextFavs;
  } catch (error) {
    logFirestoreFailure('users', uid, 'toggleFavoriteStore', error);
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

/* ============================================================================
 * PROMOTIONAL AD BANNERS (/ads) — FIXED QUERY & DEVICE IMAGE UPLOAD
 * ========================================================================== */

function parseAdBannerDoc(
  docSnap: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>
): AdBannerRecord {
  const d = docSnap.data() ?? {};
  return {
    id: docSnap.id,
    title: String(d.title ?? ''),
    subtitle: String(d.subtitle ?? ''),
    badgeText: String(d.badgeText ?? 'عرض مميز'),
    imageKey: d.imageKey ?? 'promo_seafood',
    imageUrl: sanitizeOptionalImage(
      typeof d.imageUrl === 'string' ? d.imageUrl : undefined
    ),
    storeId:
      typeof d.storeId === 'string' && d.storeId.trim()
        ? d.storeId.trim()
        : undefined,
    storeName:
      typeof d.storeName === 'string' && d.storeName.trim()
        ? d.storeName.trim()
        : undefined,
    ctaLabel:
      typeof d.ctaLabel === 'string' && d.ctaLabel.trim()
        ? d.ctaLabel.trim()
        : 'اطلب الآن',
    startDateIso:
      typeof d.startDateIso === 'string' ? d.startDateIso : undefined,
    endDateIso: typeof d.endDateIso === 'string' ? d.endDateIso : undefined,
    isActive: Boolean(d.isActive),
    sortOrder: Math.max(0, Math.trunc(Number(d.sortOrder ?? 1))),
    createdBy: String(d.createdBy ?? ''),
    createdAtIso: toIsoString(d.createdAt),
    updatedAtIso: toIsoString(d.updatedAt),
  };
}

function isAdWithinSchedule(ad: AdBannerRecord, nowMs = Date.now()): boolean {
  if (!ad.isActive || !ad.imageUrl) return false;
  if (ad.startDateIso) {
    const startMs = Date.parse(ad.startDateIso);
    if (!Number.isNaN(startMs) && nowMs < startMs - 14 * 60 * 60 * 1000) {
      return false;
    }
  }
  if (ad.endDateIso) {
    const endMs = Date.parse(ad.endDateIso);
    if (!Number.isNaN(endMs) && nowMs > endMs + 36 * 60 * 60 * 1000) {
      return false;
    }
  }
  return true;
}

export function listenToActiveAds(
  onData: (ads: AdBannerRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'ads'), where('isActive', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      const parsed = snap.docs
        .map((d) => parseAdBannerDoc(d))
        .filter((ad) => isAdWithinSchedule(ad))
        .sort((a, b) => a.sortOrder - b.sortOrder);
      onData(parsed);
    },
    (err) => {
      logFirestoreFailure('ads', '*', 'listenToActiveAds', err);
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  );
}

export function listenToAdminAds(
  onData: (ads: AdBannerRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, 'ads'),
    where('isActive', 'in', [true, false])
  );
  return onSnapshot(
    q,
    (snap) => {
      const parsed = snap.docs
        .map((d) => parseAdBannerDoc(d))
        .sort((a, b) => a.sortOrder - b.sortOrder);
      onData(parsed);
    },
    (err) => {
      logFirestoreFailure('ads', '*', 'listenToAdminAds', err);
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  );
}

export async function createAdBannerByAdminInFirestore(
  adminUid: string,
  input: AdBannerInput
): Promise<string> {
  const validationErr = validateAdBannerForm(input);
  if (validationErr) throw new Error(validationErr);

  const cleanImageUrl = sanitizeOptionalImage(input.imageUrl);
  if (!cleanImageUrl) {
    throw new Error('يرجى رفع صورة البانر الإعلاني من جهازك أولاً.');
  }

  const allowedAdImageKeys = new Set<AdImageKey>([
    'promo_seafood',
    'promo_grills',
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
  ]);
  const safeAdImageKey: AdImageKey = allowedAdImageKeys.has(
    (input.imageKey || '') as AdImageKey
  )
    ? (input.imageKey as AdImageKey)
    : 'promo_seafood';

  const adRef = doc(collection(db, 'ads'));
  const payload: Record<string, unknown> = {
    title: input.title.trim().slice(0, 90),
    subtitle: input.subtitle.trim().slice(0, 180),
    badgeText: input.badgeText.trim().slice(0, 40),
    imageKey: safeAdImageKey,
    imageUrl: cleanImageUrl,
    ...(input.storeId?.trim() && isValidFirestoreId(input.storeId.trim())
      ? { storeId: input.storeId.trim().slice(0, 128) }
      : {}),
    ...(input.storeName?.trim() ? { storeName: input.storeName.trim().slice(0, 80) } : {}),
    ...(input.ctaLabel?.trim() ? { ctaLabel: input.ctaLabel.trim().slice(0, 40) } : {}),
    ...(input.startDateIso?.trim() ? { startDateIso: input.startDateIso.trim().slice(0, 40) } : {}),
    ...(input.endDateIso?.trim() ? { endDateIso: input.endDateIso.trim().slice(0, 40) } : {}),
    isActive: Boolean(input.isActive),
    sortOrder: Math.max(0, Math.min(1000, Math.trunc(Number(input.sortOrder ?? 1)))),
    createdBy: adminUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await waitForFirestoreWarmup();
    await setDoc(adRef, payload);
    return adRef.id;
  } catch (error) {
    logFirestoreFailure('ads', adRef.id, 'createAdBannerByAdmin', error);
    handleFirestoreError(error, OperationType.CREATE, 'ads');
  }
}

export async function toggleAdBannerActiveByAdminInFirestore(
  adId: string,
  nextActive: boolean
): Promise<void> {
  try {
    await waitForFirestoreWarmup();
    await updateDoc(doc(db, 'ads', adId), {
      isActive: Boolean(nextActive),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    logFirestoreFailure('ads', adId, 'toggleAdBannerActive', error);
    handleFirestoreError(error, OperationType.UPDATE, `ads/${adId}`);
  }
}

export async function deleteAdBannerByAdminInFirestore(
  adId: string
): Promise<void> {
  try {
    await waitForFirestoreWarmup();
    await deleteDoc(doc(db, 'ads', adId));
    void recordAuditLogInFirestore({
      actionType: 'delete_ad_banner',
      targetId: adId,
      details: `حذف البانر الإعلاني (${adId}).`,
    });
  } catch (error) {
    logFirestoreFailure('ads', adId, 'deleteAdBannerByAdmin', error);
    handleFirestoreError(error, OperationType.DELETE, `ads/${adId}`);
  }
}

/* ============================================================================
 * DISCOUNT COUPONS (/coupons) WITH EXPIRY DATE & SINGLE-USE LOCKING
 * ========================================================================== */

function parseCouponDoc(
  docSnap: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>
): CouponRecord {
  const d = docSnap.data() ?? {};
  return {
    id: docSnap.id,
    code: String(d.code ?? docSnap.id).toUpperCase(),
    discountPercent: Math.min(90, Math.max(1, Math.trunc(Number(d.discountPercent ?? 10)))),
    maxDiscountEgp: Math.max(5, Math.trunc(Number(d.maxDiscountEgp ?? 100))),
    minOrderEgp: Math.max(0, Math.trunc(Number(d.minOrderEgp ?? 0))),
    description: String(d.description ?? ''),
    expiryDateIso:
      typeof d.expiryDateIso === 'string' && d.expiryDateIso.trim()
        ? d.expiryDateIso.trim()
        : undefined,
    pointsCost:
      typeof d.pointsCost === 'number'
        ? Math.max(0, Math.trunc(d.pointsCost))
        : undefined,
    isUsed: typeof d.isUsed === 'boolean' ? d.isUsed : undefined,
    usedBy: typeof d.usedBy === 'string' ? d.usedBy : undefined,
    isActive: Boolean(d.isActive),
    createdBy: String(d.createdBy ?? ''),
    createdAtIso: toIsoString(d.createdAt),
    updatedAtIso: toIsoString(d.updatedAt),
  };
}

export async function validateCouponCodeInFirestore(
  rawCode: string,
  cartSubtotal: number
): Promise<AppliedCoupon> {
  const code = rawCode.trim().toUpperCase();
  if (!code || !/^[A-Z0-9_\-]{2,32}$/.test(code)) {
    throw new Error('يرجى إدخال كود خصم صحيح.');
  }

  await waitForFirestoreWarmup();
  const couponRef = doc(db, 'coupons', code);
  const snap = await getDocWithRetry(couponRef, 'coupons', code);

  if (!snap.exists()) {
    throw new Error('كود الخصم غير موجود في النظام.');
  }

  const rawData = snap.data() ?? {};
  const coupon = parseCouponDoc(snap);
  if (coupon.isUsed === true) {
    throw new Error('تم استخدام كود الخصم هذا مسبقاً وهو صالح لمرة واحدة فقط.');
  }
  if (
    typeof rawData.ownerUid === 'string' &&
    rawData.ownerUid.trim() &&
    rawData.ownerUid.trim() !== auth.currentUser?.uid
  ) {
    throw new Error('هذا الكوبون مخصص لحساب عميل آخر.');
  }
  if (!coupon.isActive) {
    throw new Error('هذا الكوبون متوقف حالياً ولا يمكن استخدامه.');
  }
  if (isCouponExpired(coupon.expiryDateIso)) {
    throw new Error('انتهت صلاحية كود الخصم هذا.');
  }
  if (cartSubtotal < coupon.minOrderEgp) {
    throw new Error(
      `الحد الأدنى لتفعيل كود ${coupon.code} هو ${coupon.minOrderEgp} ج.م.`
    );
  }

  return {
    code: coupon.code,
    discountPercent: coupon.discountPercent,
    maxDiscountEgp: coupon.maxDiscountEgp,
    minOrderEgp: coupon.minOrderEgp,
    description: coupon.description,
    expiryDateIso: coupon.expiryDateIso,
    pointsCost: coupon.pointsCost,
    isUsed: coupon.isUsed,
  };
}

export function listenToAdminCoupons(
  _adminUid: string,
  onData: (coupons: CouponRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, 'coupons'),
    where('isActive', 'in', [true, false])
  );
  return onSnapshot(
    q,
    (snap) => {
      const sorted = snap.docs
        .map(parseCouponDoc)
        .sort((a, b) => a.code.localeCompare(b.code));
      onData(sorted);
    },
    (err) => {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  );
}

export async function upsertCouponByAdminInFirestore(
  adminUid: string,
  input: CouponInput
): Promise<void> {
  const errMsg = validateCouponForm(input);
  if (errMsg) throw new Error(errMsg);

  const cleanCode = input.code.trim().toUpperCase();
  const cleanExpiry = input.expiryDateIso?.trim().slice(0, 40);
  const couponRef = doc(db, 'coupons', cleanCode);
  try {
    await waitForFirestoreWarmup();
    const existing = await getDocWithRetry(couponRef, 'coupons', cleanCode);
    if (!existing.exists()) {
      await setDoc(couponRef, {
        code: cleanCode,
        discountPercent: Math.trunc(input.discountPercent),
        maxDiscountEgp: Math.trunc(input.maxDiscountEgp),
        minOrderEgp: Math.trunc(input.minOrderEgp),
        description: input.description.trim().slice(0, 140),
        ...(cleanExpiry ? { expiryDateIso: cleanExpiry } : {}),
        isActive: Boolean(input.isActive),
        createdBy: adminUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(couponRef, {
        discountPercent: Math.trunc(input.discountPercent),
        maxDiscountEgp: Math.trunc(input.maxDiscountEgp),
        minOrderEgp: Math.trunc(input.minOrderEgp),
        description: input.description.trim().slice(0, 140),
        ...(cleanExpiry ? { expiryDateIso: cleanExpiry } : {}),
        isActive: Boolean(input.isActive),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    logFirestoreFailure('coupons', cleanCode, 'upsertCouponByAdmin', error);
    handleFirestoreError(error, OperationType.WRITE, `coupons/${cleanCode}`);
  }
}

export async function toggleCouponActiveByAdminInFirestore(
  couponId: string,
  nextActive: boolean
): Promise<void> {
  try {
    await waitForFirestoreWarmup();
    await updateDoc(doc(db, 'coupons', couponId), {
      isActive: Boolean(nextActive),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    logFirestoreFailure('coupons', couponId, 'toggleCouponActive', error);
    handleFirestoreError(error, OperationType.UPDATE, `coupons/${couponId}`);
  }
}

export async function deleteCouponByAdminInFirestore(
  couponId: string
): Promise<void> {
  try {
    await waitForFirestoreWarmup();
    await deleteDoc(doc(db, 'coupons', couponId));
    void recordAuditLogInFirestore({
      actionType: 'delete_coupon',
      targetId: couponId,
      details: `حذف كوبون الخصم (${couponId}).`,
    });
  } catch (error) {
    logFirestoreFailure('coupons', couponId, 'deleteCouponByAdmin', error);
    handleFirestoreError(error, OperationType.DELETE, `coupons/${couponId}`);
  }
}

/* ============================================================================
 * POST-DELIVERY REVIEWS (/reviews)
 * ========================================================================== */

function parseReviewDoc(
  docSnap: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>
): ReviewRecord {
  const d = docSnap.data() ?? {};
  return {
    id: docSnap.id,
    orderId: String(d.orderId ?? docSnap.id),
    storeId: String(d.storeId ?? ''),
    courierId: typeof d.courierId === 'string' ? d.courierId : undefined,
    courierName: typeof d.courierName === 'string' ? d.courierName : undefined,
    customerId: String(d.customerId ?? ''),
    customerName: String(d.customerName ?? 'عميل إدكاوي'),
    storeRating: Math.min(5, Math.max(1, Math.trunc(Number(d.storeRating ?? 5)))),
    courierRating:
      typeof d.courierRating === 'number'
        ? Math.min(5, Math.max(1, Math.trunc(d.courierRating)))
        : undefined,
    comment: String(d.comment ?? ''),
    createdAtIso: toIsoString(d.createdAt),
  };
}

export async function submitOrderReviewInFirestore(
  customerUid: string,
  input: ReviewSubmitInput
): Promise<void> {
  const validationErr = validateReviewForm(input);
  if (validationErr) throw new Error(validationErr);

  const reviewPath = `reviews/${input.orderId}`;
  try {
    await waitForFirestoreWarmup();
    const reviewRef = doc(db, 'reviews', input.orderId);
    const existingReview = await getDocWithRetry(
      reviewRef,
      'reviews',
      input.orderId
    );
    if (existingReview.exists()) {
      throw new Error('لقد قمت بتقييم هذا الطلب مسبقاً، شكراً لمشاركتك!');
    }

    const cleanCourierId =
      input.courierId && isValidFirestoreId(input.courierId)
        ? input.courierId
        : undefined;
    const cleanCourierRating =
      cleanCourierId && typeof input.courierRating === 'number'
        ? Math.min(5, Math.max(1, Math.trunc(input.courierRating)))
        : undefined;

    const batch = writeBatch(db);
    batch.set(reviewRef, {
      orderId: input.orderId,
      storeId: input.storeId,
      ...(cleanCourierId ? { courierId: cleanCourierId } : {}),
      ...(input.courierName?.trim()
        ? { courierName: input.courierName.trim().slice(0, 80) }
        : {}),
      customerId: customerUid,
      customerName: (input.customerName.trim() || 'عميل إدكاوي').slice(0, 80),
      storeRating: Math.min(5, Math.max(1, Math.trunc(input.storeRating))),
      ...(cleanCourierRating !== undefined
        ? { courierRating: cleanCourierRating }
        : {}),
      comment: (input.comment ?? '').trim().slice(0, 300),
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, 'orders', input.orderId), {
      isReviewed: true,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    const storeRef = doc(db, 'stores', input.storeId);
    const storeSnap = await getDocWithRetry(storeRef, 'stores', input.storeId);
    if (storeSnap.exists()) {
      const sd = storeSnap.data() ?? {};
      const prevCount =
        typeof sd.reviewCount === 'number' && sd.reviewCount >= 0
          ? Math.trunc(sd.reviewCount)
          : 1;
      const prevSum =
        typeof sd.ratingSum === 'number' && sd.ratingSum > 0
          ? Number(sd.ratingSum)
          : Number(sd.rating ?? 4.8) * prevCount;
      const nextCount = prevCount + 1;
      const nextSum = prevSum + Math.trunc(input.storeRating);
      const nextAvg = Number(
        Math.min(5, Math.max(1, nextSum / nextCount)).toFixed(1)
      );
      await updateDoc(storeRef, {
        rating: nextAvg,
        reviewCount: nextCount,
        ratingSum: nextSum,
      }).catch(() => {});
    }

    if (cleanCourierId && cleanCourierRating !== undefined) {
      const courierDirRef = doc(db, 'courierDirectory', cleanCourierId);
      const dirSnap = await getDocWithRetry(
        courierDirRef,
        'courierDirectory',
        cleanCourierId
      ).catch(() => null);
      if (dirSnap && dirSnap.exists()) {
        const cd = dirSnap.data() ?? {};
        const prevCount =
          typeof cd.reviewCount === 'number' && cd.reviewCount >= 0
            ? Math.trunc(cd.reviewCount)
            : 1;
        const prevSum =
          typeof cd.ratingSum === 'number' && cd.ratingSum > 0
            ? Number(cd.ratingSum)
            : Number(cd.rating ?? 4.8) * prevCount;
        const nextCount = prevCount + 1;
        const nextSum = prevSum + cleanCourierRating;
        const nextAvg = Number(
          Math.min(5, Math.max(1, nextSum / nextCount)).toFixed(1)
        );
        await updateDoc(courierDirRef, {
          rating: nextAvg,
          reviewCount: nextCount,
          ratingSum: nextSum,
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }
    }
  } catch (error) {
    if (error instanceof Error && /[\u0600-\u06FF]/.test(error.message)) {
      throw error;
    }
    logFirestoreFailure('reviews', input.orderId, 'submitOrderReview', error);
    handleFirestoreError(error, OperationType.CREATE, reviewPath);
  }
}

export function listenToStoreReviews(
  storeId: string,
  onData: (reviews: ReviewRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!storeId) {
    onData([]);
    return () => {};
  }
  const q = query(
    collection(db, 'reviews'),
    where('storeId', '==', storeId),
    where('storeRating', 'in', [1, 2, 3, 4, 5])
  );
  return onSnapshot(
    q,
    (snap) => {
      const parsed = snap.docs
        .map((d) => parseReviewDoc(d))
        .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
      onData(parsed);
    },
    (err) => {
      logFirestoreFailure('reviews', storeId, 'listenToStoreReviews', err);
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  );
}

export function listenToCustomerReviews(
  customerUid: string,
  onData: (reviewsByOrderId: Record<string, ReviewRecord>) => void
): Unsubscribe {
  if (!customerUid) {
    onData({});
    return () => {};
  }
  const q = query(
    collection(db, 'reviews'),
    where('customerId', '==', customerUid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const map: Record<string, ReviewRecord> = {};
      for (const d of snap.docs) {
        const rev = parseReviewDoc(d);
        map[rev.orderId] = rev;
      }
      onData(map);
    },
    () => {}
  );
}

/* ============================================================================
 * INTERNAL ADMIN BROADCASTS & REAL-TIME NOTIFICATIONS
 * ========================================================================== */

const BROADCAST_READ_STORAGE_KEY = 'edkawy_read_broadcasts_v1';

function getReadBroadcastIds(uid: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(`${BROADCAST_READ_STORAGE_KEY}_${uid}`);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

function markBroadcastIdReadLocally(uid: string, broadcastId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const set = getReadBroadcastIds(uid);
    set.add(broadcastId);
    window.localStorage.setItem(
      `${BROADCAST_READ_STORAGE_KEY}_${uid}`,
      JSON.stringify(Array.from(set).slice(-200))
    );
  } catch {
    // Ignore storage errors
  }
}

function parseNotificationDoc(
  docSnap: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>
): AppNotificationRecord {
  const d = docSnap.data() ?? {};
  const rawType = String(d.type ?? 'order_update');
  const type: AppNotificationType =
    rawType === 'promo' || rawType === 'system' ? rawType : 'order_update';

  return {
    id: docSnap.id,
    recipientUid: String(d.recipientUid ?? ''),
    audience:
      typeof d.audience === 'string'
        ? (d.audience as BroadcastAudience)
        : undefined,
    title: String(d.title ?? ''),
    body: String(d.body ?? ''),
    type,
    orderId: typeof d.orderId === 'string' ? d.orderId : undefined,
    isRead: Boolean(d.isRead),
    createdBy: String(d.createdBy ?? ''),
    createdAtIso: toIsoString(d.createdAt),
  };
}

function parseBroadcastNotificationDoc(
  docSnap: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>,
  uid: string,
  readBroadcastIds: Set<string>
): AppNotificationRecord {
  const d = docSnap.data() ?? {};
  const rawType = String(d.type ?? 'system');
  const type: AppNotificationType =
    rawType === 'promo' || rawType === 'order_update' ? rawType : 'system';
  const bId = `bcast_${docSnap.id}`;

  return {
    id: bId,
    recipientUid: uid,
    audience: (d.audience as BroadcastAudience) ?? 'all',
    title: String(d.title ?? ''),
    body: String(d.body ?? ''),
    type,
    isRead: readBroadcastIds.has(bId),
    createdBy: String(d.createdBy ?? ''),
    createdAtIso: toIsoString(d.createdAt),
  };
}

async function createNotificationBestEffort(
  recipientUid: string,
  input: {
    title: string;
    body: string;
    type: AppNotificationType;
    orderId?: string;
  }
): Promise<void> {
  const senderUid = auth.currentUser?.uid;
  if (
    !senderUid ||
    auth.currentUser?.isAnonymous ||
    !recipientUid ||
    !isValidFirestoreId(recipientUid)
  ) {
    return;
  }
  try {
    await addDoc(collection(db, 'notifications'), {
      recipientUid,
      title: input.title.trim().slice(0, 100),
      body: input.body.trim().slice(0, 280),
      type: input.type,
      ...(input.orderId && isValidFirestoreId(input.orderId)
        ? { orderId: input.orderId }
        : {}),
      isRead: false,
      createdBy: senderUid,
      createdAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal side-effect notification
  }
}

export async function sendAdminNotificationInFirestore(
  adminUid: string,
  input: AdminNotificationSendInput
): Promise<void> {
  const cleanTitle = input.title.trim().slice(0, 100);
  const cleanBody = input.body.trim().slice(0, 280);
  if (cleanTitle.length < 2) {
    throw new Error('يرجى كتابة عنوان الإشعار (حرفين على الأقل).');
  }
  if (cleanBody.length < 2) {
    throw new Error('يرجى كتابة نص الإشعار بوضوح.');
  }

  await waitForFirestoreWarmup();

  if (input.audience === 'specific_user') {
    const targetUid = (input.recipientUid ?? '').trim();
    if (!isValidFirestoreId(targetUid)) {
      throw new Error('يرجى اختيار المستلم المحدد أولاً.');
    }
    try {
      await addDoc(collection(db, 'notifications'), {
        recipientUid: targetUid,
        audience: 'specific_user',
        title: cleanTitle,
        body: cleanBody,
        type: input.type,
        isRead: false,
        createdBy: adminUid,
        createdAt: serverTimestamp(),
      });
      void recordAuditLogInFirestore({
        adminId: adminUid,
        actionType: 'send_notification',
        targetId: targetUid,
        details: `إرسال إشعار مخصص بعنوان "${cleanTitle}" إلى المستلم (${targetUid}).`,
      });
    } catch (error) {
      logFirestoreFailure('notifications', targetUid, 'sendAdminDirectNotif', error);
      handleFirestoreError(error, OperationType.CREATE, 'notifications');
    }
    return;
  }

  try {
    await addDoc(collection(db, 'broadcastNotifications'), {
      audience: input.audience,
      title: cleanTitle,
      body: cleanBody,
      type: input.type,
      createdBy: adminUid,
      createdAt: serverTimestamp(),
    });
    void recordAuditLogInFirestore({
      adminId: adminUid,
      actionType: 'send_notification',
      details: `إرسال إشعار عام لفئة (${input.audience}) بعنوان "${cleanTitle}".`,
    });
  } catch (error) {
    logFirestoreFailure(
      'broadcastNotifications',
      '*',
      'sendAdminBroadcastNotif',
      error
    );
    handleFirestoreError(error, OperationType.CREATE, 'broadcastNotifications');
  }
}

export function listenToAdminBroadcastHistory(
  onData: (items: AppNotificationRecord[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'broadcastNotifications'),
    where('audience', 'in', ['all', 'customer', 'store', 'courier'])
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) =>
          parseBroadcastNotificationDoc(d, 'admin', new Set<string>())
        )
        .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
      onData(list);
    },
    () => {
      onData([]);
    }
  );
}

export function listenToUserNotifications(
  uid: string,
  onData: (notifications: AppNotificationRecord[]) => void,
  onError?: (err: Error) => void,
  role: PortalRole = 'customer'
): Unsubscribe {
  if (!uid || !isValidFirestoreId(uid)) {
    onData([]);
    return () => {};
  }

  let directList: AppNotificationRecord[] = [];
  let broadcastDocs: QueryDocumentSnapshot<DocumentData>[] = [];

  const emitMerged = () => {
    const readIds = getReadBroadcastIds(uid);
    const bList = broadcastDocs.map((d) =>
      parseBroadcastNotificationDoc(d, uid, readIds)
    );
    const merged = [...directList, ...bList].sort((a, b) =>
      b.createdAtIso.localeCompare(a.createdAtIso)
    );
    onData(merged);
  };

  const unsubDirect = onSnapshot(
    query(collection(db, 'notifications'), where('recipientUid', '==', uid)),
    (snap) => {
      directList = snap.docs.map((d) => parseNotificationDoc(d));
      emitMerged();
    },
    (err) => {
      logFirestoreFailure('notifications', uid, 'listenToUserNotifications', err);
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  );

  const audienceTargets =
    role === 'admin'
      ? ['all', 'customer', 'store', 'courier']
      : role === 'support_agent' ||
        role === 'operations' ||
        role === 'sales_agent'
      ? ['all']
      : ['all', role];

  const unsubBroadcast = onSnapshot(
    query(
      collection(db, 'broadcastNotifications'),
      where('audience', 'in', audienceTargets)
    ),
    (snap) => {
      broadcastDocs = snap.docs;
      emitMerged();
    },
    () => {}
  );

  return () => {
    unsubDirect();
    unsubBroadcast();
  };
}

export async function markNotificationReadInFirestore(
  notificationId: string,
  currentUid?: string
): Promise<void> {
  if (!notificationId) return;
  if (notificationId.startsWith('bcast_')) {
    const uid = currentUid || auth.currentUser?.uid || '';
    if (uid) {
      markBroadcastIdReadLocally(uid, notificationId);
    }
    return;
  }
  if (!isValidFirestoreId(notificationId)) return;
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      isRead: true,
    });
  } catch (error) {
    logFirestoreFailure(
      'notifications',
      notificationId,
      'markNotificationRead',
      error
    );
  }
}

export async function markAllNotificationsReadInFirestore(
  notifications: AppNotificationRecord[],
  currentUid?: string
): Promise<void> {
  const uid = currentUid || auth.currentUser?.uid || '';
  const unread = notifications.filter((n) => !n.isRead);
  const directUnread: AppNotificationRecord[] = [];

  for (const n of unread) {
    if (n.id.startsWith('bcast_')) {
      if (uid) markBroadcastIdReadLocally(uid, n.id);
    } else {
      directUnread.push(n);
    }
  }

  for (let i = 0; i < directUnread.length; i += 4) {
    const slice = directUnread.slice(i, i + 4);
    const batch = writeBatch(db);
    for (const item of slice) {
      batch.update(doc(db, 'notifications', item.id), { isRead: true });
    }
    await batch.commit().catch(() => {});
  }
}

/* ============================================================================
 * ROTATING GAMIFICATION CAMPAIGNS & LOYALTY POINTS
 * ========================================================================== */

function parseCampaignDoc(
  docSnap: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>
): CampaignRecord {
  const d = docSnap.data() ?? {};
  return {
    id: docSnap.id,
    title: String(d.title ?? ''),
    subtitle: String(d.subtitle ?? ''),
    badgeText: String(d.badgeText ?? 'فعالية إدكاوي'),
    campaignType: d.campaignType ?? 'points_multiplier',
    multiplier:
      typeof d.multiplier === 'number'
        ? Math.max(1, Math.trunc(d.multiplier))
        : undefined,
    discountPercent:
      typeof d.discountPercent === 'number'
        ? Math.trunc(d.discountPercent)
        : undefined,
    targetNeighborhood:
      typeof d.targetNeighborhood === 'string'
        ? d.targetNeighborhood
        : undefined,
    startHour:
      typeof d.startHour === 'number' ? Math.trunc(d.startHour) : undefined,
    endHour: typeof d.endHour === 'number' ? Math.trunc(d.endHour) : undefined,
    rewardPoints:
      typeof d.rewardPoints === 'number'
        ? Math.trunc(d.rewardPoints)
        : undefined,
    imageUrl:
      sanitizeOptionalImage(
        typeof d.imageUrl === 'string' ? d.imageUrl : undefined
      ) ?? '',
    isActive: Boolean(d.isActive),
    createdBy: String(d.createdBy ?? ''),
    createdAtIso: toIsoString(d.createdAt),
    updatedAtIso: toIsoString(d.updatedAt),
  };
}

export function listenToActiveCampaigns(
  onData: (campaigns: CampaignRecord[]) => void
): Unsubscribe {
  const q = query(collection(db, 'campaigns'), where('isActive', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map(parseCampaignDoc)
        .filter((c) => Boolean(c.imageUrl))
        .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
      onData(list);
    },
    () => onData([])
  );
}

export function listenToAdminCampaigns(
  onData: (campaigns: CampaignRecord[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'campaigns'),
    where('isActive', 'in', [true, false])
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map(parseCampaignDoc)
        .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
      onData(list);
    },
    () => onData([])
  );
}

export async function createCampaignByAdminInFirestore(
  adminUid: string,
  input: CampaignInput
): Promise<string> {
  const errMsg = validateCampaignForm(input);
  if (errMsg) throw new Error(errMsg);

  const cleanImageUrl = sanitizeOptionalImage(input.imageUrl);
  if (!cleanImageUrl) {
    throw new Error('يرجى رفع صورة الفعالية من جهازك أولاً.');
  }

  const ref = doc(collection(db, 'campaigns'));
  try {
    await waitForFirestoreWarmup();
    await setDoc(ref, {
      title: input.title.trim().slice(0, 90),
      subtitle: input.subtitle.trim().slice(0, 180),
      badgeText: input.badgeText.trim().slice(0, 40),
      campaignType: input.campaignType,
      ...(typeof input.multiplier === 'number'
        ? { multiplier: Math.min(10, Math.max(1, Math.trunc(input.multiplier))) }
        : {}),
      ...(typeof input.discountPercent === 'number'
        ? {
            discountPercent: Math.min(
              90,
              Math.max(0, Math.trunc(input.discountPercent))
            ),
          }
        : {}),
      ...(input.targetNeighborhood?.trim()
        ? { targetNeighborhood: input.targetNeighborhood.trim().slice(0, 80) }
        : {}),
      ...(typeof input.startHour === 'number'
        ? { startHour: Math.min(23, Math.max(0, Math.trunc(input.startHour))) }
        : {}),
      ...(typeof input.endHour === 'number'
        ? { endHour: Math.min(23, Math.max(0, Math.trunc(input.endHour))) }
        : {}),
      ...(typeof input.rewardPoints === 'number'
        ? { rewardPoints: Math.max(0, Math.trunc(input.rewardPoints)) }
        : {}),
      imageUrl: cleanImageUrl,
      isActive: Boolean(input.isActive),
      createdBy: adminUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (error) {
    logFirestoreFailure('campaigns', ref.id, 'createCampaignByAdmin', error);
    handleFirestoreError(error, OperationType.CREATE, 'campaigns');
  }
}

export async function toggleCampaignActiveByAdminInFirestore(
  campaignId: string,
  nextActive: boolean
): Promise<void> {
  try {
    await waitForFirestoreWarmup();
    await updateDoc(doc(db, 'campaigns', campaignId), {
      isActive: Boolean(nextActive),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    logFirestoreFailure('campaigns', campaignId, 'toggleCampaignActive', error);
    handleFirestoreError(error, OperationType.UPDATE, `campaigns/${campaignId}`);
  }
}

export async function deleteCampaignByAdminInFirestore(
  campaignId: string
): Promise<void> {
  try {
    await waitForFirestoreWarmup();
    await deleteDoc(doc(db, 'campaigns', campaignId));
    void recordAuditLogInFirestore({
      actionType: 'delete_campaign',
      targetId: campaignId,
      details: `حذف الحملة الترويجية (${campaignId}).`,
    });
  } catch (error) {
    logFirestoreFailure('campaigns', campaignId, 'deleteCampaign', error);
    handleFirestoreError(error, OperationType.DELETE, `campaigns/${campaignId}`);
  }
}

function parseCustomerDirectoryDoc(
  docSnap: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>
): CustomerDirectoryEntry {
  const d = docSnap.data() ?? {};
  return {
    uid: String(d.uid ?? docSnap.id),
    name: String(d.name ?? 'عميل إدكاوي'),
    customerCode: isValidCustomerCodeFormat(d.customerCode)
      ? d.customerCode.trim()
      : undefined,
    isBanned: typeof d.isBanned === 'boolean' ? d.isBanned : undefined,
    banType:
      d.banType === 'temporary_24h' ||
      d.banType === 'suspended' ||
      d.banType === 'permanent'
        ? d.banType
        : undefined,
    banUntilIso:
      typeof d.banUntilIso === 'string' && d.banUntilIso.trim()
        ? d.banUntilIso.trim()
        : undefined,
    banReason:
      typeof d.banReason === 'string' && d.banReason.trim()
        ? d.banReason.trim()
        : undefined,
    neighborhood:
      typeof d.neighborhood === 'string' ? d.neighborhood : undefined,
    points: Math.max(0, Math.trunc(Number(d.points ?? 0))),
    totalSpentEgp:
      typeof d.totalSpentEgp === 'number'
        ? Math.max(0, Math.trunc(d.totalSpentEgp))
        : 0,
    currentStreak: Math.min(
      5,
      Math.max(0, Math.trunc(Number(d.currentStreak ?? 0)))
    ),
    freeDeliveryRewards: Math.max(
      0,
      Math.trunc(Number(d.freeDeliveryRewards ?? 0))
    ),
    totalDeliveredOrders: Math.max(
      0,
      Math.trunc(Number(d.totalDeliveredOrders ?? 0))
    ),
    lastDeliveredOrderAtIso:
      typeof d.lastDeliveredOrderAtIso === 'string'
        ? d.lastDeliveredOrderAtIso
        : undefined,
    updatedAtIso: toIsoString(d.updatedAt),
  };
}

export function listenToCustomerDirectory(
  onData: (customers: CustomerDirectoryEntry[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'customerDirectory'),
    where('points', '>=', 0)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map(parseCustomerDirectoryDoc)
        .sort((a, b) => b.points - a.points);
      onData(list);
    },
    () => onData([])
  );
}

async function incrementCustomerLoyaltyInDirectory(
  customerUid: string,
  customerName: string,
  neighborhood: string,
  addedPoints: number
): Promise<void> {
  try {
    const dirRef = doc(db, 'customerDirectory', customerUid);
    const snap = await getDoc(dirRef).catch(() => null);
    const prev = snap?.exists() ? snap.data() ?? {} : {};
    const prevPoints = Math.max(0, Math.trunc(Number(prev.points ?? 0)));
    const prevStreak = Math.min(
      5,
      Math.max(0, Math.trunc(Number(prev.currentStreak ?? 0)))
    );
    const prevRewards = Math.max(
      0,
      Math.trunc(Number(prev.freeDeliveryRewards ?? 0))
    );
    const prevDelivered = Math.max(
      0,
      Math.trunc(Number(prev.totalDeliveredOrders ?? 0))
    );

    const rawNextStreak = prevStreak + 1;
    const hitStreakFive = rawNextStreak >= 5;
    const nextStreak = hitStreakFive ? 0 : rawNextStreak;
    const nextRewards = hitStreakFive ? prevRewards + 1 : prevRewards;
    const streakBonusPoints = hitStreakFive ? 50 : 0;
    const nextPoints = prevPoints + Math.max(0, Math.trunc(addedPoints)) + streakBonusPoints;
    const nowIso = new Date().toISOString();

    if (snap?.exists()) {
      await updateDoc(dirRef, {
        points: nextPoints,
        currentStreak: nextStreak,
        freeDeliveryRewards: nextRewards,
        totalDeliveredOrders: prevDelivered + 1,
        lastDeliveredOrderAtIso: nowIso,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(dirRef, {
        uid: customerUid,
        name: (customerName.trim() || 'عميل إدكاوي').slice(0, 80),
        ...(neighborhood.trim()
          ? { neighborhood: neighborhood.trim().slice(0, 80) }
          : {}),
        points: nextPoints,
        currentStreak: nextStreak,
        freeDeliveryRewards: nextRewards,
        totalDeliveredOrders: 1,
        lastDeliveredOrderAtIso: nowIso,
        updatedAt: serverTimestamp(),
      });
    }
  } catch {
    // Non-fatal
  }
}

export async function redeemPointsForCouponInFirestore(
  customerUid: string,
  customerName: string,
  currentPoints: number
): Promise<string> {
  const POINTS_COST = 100;
  if (currentPoints < POINTS_COST) {
    throw new Error(
      `تحتاج إلى ${POINTS_COST} نقطة لاستبدال قسيمة خصم 25% (رصيدك الحالي ${currentPoints} نقطة).`
    );
  }

  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  const couponCode = `EDK25-${suffix}`;
  const nextPoints = Math.max(0, currentPoints - POINTS_COST);

  await waitForFirestoreWarmup();
  try {
    await setDoc(doc(db, 'coupons', couponCode), {
      code: couponCode,
      discountPercent: 25,
      maxDiscountEgp: 100,
      minOrderEgp: 50,
      description: `كوبون ولاء خصم 25% لمرة واحدة للعميل ${customerName.slice(0, 30)}`,
      ownerUid: customerUid,
      pointsCost: POINTS_COST,
      isUsed: false,
      isActive: true,
      createdBy: customerUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await syncCustomerDirectoryEntry(customerUid, {
      name: customerName,
      points: nextPoints,
    });

    await updateDoc(doc(db, 'users', customerUid), {
      points: nextPoints,
      updatedAt: serverTimestamp(),
    }).catch(() => {});

    return couponCode;
  } catch (error) {
    logFirestoreFailure('coupons', couponCode, 'redeemPointsForCoupon', error);
    handleFirestoreError(error, OperationType.CREATE, 'coupons');
  }
}

export async function giftPointsByAdminInFirestore(
  adminUid: string,
  customerUid: string,
  customerName: string,
  currentPoints: number,
  bonusPoints: number,
  reasonNote?: string
): Promise<void> {
  const cleanBonus = Math.trunc(Number(bonusPoints));
  if (Number.isNaN(cleanBonus) || cleanBonus <= 0 || cleanBonus > 50000) {
    throw new Error('يرجى إدخال عدد نقاط صحيح بين 1 و 50,000 نقطة.');
  }
  const nextPoints = Math.max(0, currentPoints + cleanBonus);

  await waitForFirestoreWarmup();
  try {
    await syncCustomerDirectoryEntry(customerUid, {
      name: customerName,
      points: nextPoints,
    });

    const userRef = doc(db, 'users', customerUid);
    const uSnap = await getDoc(userRef).catch(() => null);
    if (uSnap?.exists()) {
      await updateDoc(userRef, {
        points: nextPoints,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }

    await addDoc(collection(db, 'notifications'), {
      recipientUid: customerUid,
      title: `هدية من إدارة إدكاوي: +${cleanBonus} نقطة!`,
      body: (
        reasonNote?.trim() ||
        `تمت إضافة ${cleanBonus} نقطة مكافأة إلى رصيدك في برنامج ولاء إدكاوي.`
      ).slice(0, 280),
      type: 'promo',
      isRead: false,
      createdBy: adminUid,
      createdAt: serverTimestamp(),
    }).catch(() => {});

    void recordAuditLogInFirestore({
      adminId: adminUid,
      actionType: 'gift_points',
      targetId: customerUid,
      details: `إهداء +${cleanBonus} نقطة ولاء للعميل "${customerName}" (${reasonNote?.trim() || 'مكافأة إدارية'}).`,
    });
  } catch (error) {
    logFirestoreFailure(
      'customerDirectory',
      customerUid,
      'giftPointsByAdmin',
      error
    );
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `customerDirectory/${customerUid}`
    );
  }
}

/* ============================================================================
 * COLLABORATIVE GROUP ORDER (/sharedCarts)
 * ========================================================================== */

function generateGroupRoomCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function parseSharedCartDoc(
  docSnap: DocumentSnapshot<DocumentData>
): SharedCartRecord | null {
  if (!docSnap.exists()) return null;
  const d = docSnap.data() ?? {};
  const rawItems = Array.isArray(d.items) ? d.items : [];
  const items: SharedCartItemEntry[] = rawItems.map(
    (entry: Record<string, unknown>, idx: number) => ({
      entryId:
        typeof entry.entryId === 'string' ? entry.entryId : `entry_${idx + 1}`,
      participantUid: String(entry.participantUid ?? ''),
      participantName: String(entry.participantName ?? 'صديق'),
      productId: String(entry.productId ?? ''),
      name: String(entry.name ?? 'صنف'),
      price: Math.max(0, Math.trunc(Number(entry.price ?? 0))),
      quantity: Math.max(1, Math.trunc(Number(entry.quantity ?? 1))),
    })
  );

  const rawChat = Array.isArray(d.chatMessages) ? d.chatMessages : [];
  const chatMessages: SharedCartChatMessage[] = rawChat.map(
    (msg: Record<string, unknown>, idx: number) => ({
      id: typeof msg.id === 'string' ? msg.id : `msg_${idx + 1}`,
      senderUid: String(msg.senderUid ?? ''),
      senderName: String(msg.senderName ?? 'عضو'),
      text: String(msg.text ?? ''),
      timestampIso:
        typeof msg.timestampIso === 'string'
          ? msg.timestampIso
          : new Date().toISOString(),
    })
  );

  return {
    id: docSnap.id,
    roomCode: typeof d.roomCode === 'string' ? d.roomCode : undefined,
    hostUid: String(d.hostUid ?? ''),
    hostName: String(d.hostName ?? 'صاحب الطلب'),
    storeId: String(d.storeId ?? ''),
    storeName: String(d.storeName ?? ''),
    storeDeliveryFee: Math.max(0, Math.trunc(Number(d.storeDeliveryFee ?? 0))),
    status: d.status === 'checked_out' || d.status === 'cancelled' ? d.status : 'open',
    items,
    chatMessages,
    createdAtIso: toIsoString(d.createdAt),
    updatedAtIso: toIsoString(d.updatedAt),
  };
}

export async function createSharedCartInFirestore(
  hostUid: string,
  hostName: string,
  store: StoreRecord
): Promise<string> {
  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    throw new Error('يرجى تسجيل الدخول بحسابك أولاً لبدء طلب جماعي مع أصدقائك.');
  }
  await waitForFirestoreWarmup();
  const ref = doc(collection(db, 'sharedCarts'));
  const roomCode = generateGroupRoomCode();
  try {
    await setDoc(ref, {
      hostUid,
      hostName: (hostName.trim() || 'عميل إدكاوي').slice(0, 80),
      storeId: store.id,
      storeName: store.name.slice(0, 100),
      storeDeliveryFee: Math.max(0, Math.trunc(store.deliveryFee)),
      status: 'open',
      items: [],
      roomCode,
      chatMessages: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (error) {
    logFirestoreFailure('sharedCarts', ref.id, 'createSharedCart', error);
    handleFirestoreError(error, OperationType.CREATE, 'sharedCarts');
  }
}

export async function getSharedCartByRoomCode(
  roomCode: string
): Promise<SharedCartRecord | null> {
  const code = (roomCode || '').trim().toUpperCase();
  if (!code) return null;
  await waitForFirestoreWarmup();
  const q = query(
    collection(db, 'sharedCarts'),
    where('roomCode', '==', code),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return parseSharedCartDoc(snap.docs[0]);
}

export function listenToSharedCartByRoomCode(
  roomCode: string,
  onData: (cart: SharedCartRecord | null) => void
): Unsubscribe {
  const code = (roomCode || '').trim().toUpperCase();
  if (!code) {
    onData(null);
    return () => {};
  }
  const q = query(
    collection(db, 'sharedCarts'),
    where('roomCode', '==', code),
    limit(1)
  );
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        onData(null);
      } else {
        onData(parseSharedCartDoc(snap.docs[0]));
      }
    },
    () => onData(null)
  );
}

export async function sendSharedCartChatMessage(
  cartId: string,
  message: { senderUid: string; senderName: string; text: string }
): Promise<void> {
  if (!cartId || !isValidFirestoreId(cartId)) return;
  await waitForFirestoreWarmup();
  const ref = doc(db, 'sharedCarts', cartId);
  const snap = await getDocWithRetry(ref, 'sharedCarts', cartId);
  const parsed = parseSharedCartDoc(snap);
  if (!parsed || parsed.status !== 'open') {
    throw new Error('لا يمكن إرسال رسالة في طلب جماعي غير نشط.');
  }

  const newMsg: SharedCartChatMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    senderUid: message.senderUid,
    senderName: message.senderName.slice(0, 50),
    text: message.text.slice(0, 300),
    timestampIso: new Date().toISOString(),
  };

  const currentMessages = parsed.chatMessages || [];
  const updatedMessages = [...currentMessages.slice(-49), newMsg];

  await updateDoc(ref, {
    chatMessages: updatedMessages,
    updatedAt: serverTimestamp(),
  });
}

export function listenToSharedCart(
  cartId: string,
  onData: (cart: SharedCartRecord | null) => void
): Unsubscribe {
  if (!cartId || !isValidFirestoreId(cartId)) {
    onData(null);
    return () => {};
  }
  return onSnapshot(
    doc(db, 'sharedCarts', cartId),
    (snap) => {
      onData(parseSharedCartDoc(snap));
    },
    () => onData(null)
  );
}

export async function upsertSharedCartItemInFirestore(
  cartId: string,
  participantUid: string,
  participantName: string,
  product: ProductRecord,
  delta: number
): Promise<void> {
  await waitForFirestoreWarmup();
  const ref = doc(db, 'sharedCarts', cartId);
  const snap = await getDocWithRetry(ref, 'sharedCarts', cartId);
  const parsed = parseSharedCartDoc(snap);
  if (!parsed || parsed.status !== 'open') {
    throw new Error('هذا الطلب الجماعي مغلق أو تم إتمامه بالفعل.');
  }

  const entryId = `${participantUid}_${product.id}`.slice(0, 120);
  const existingIdx = parsed.items.findIndex((i) => i.entryId === entryId);
  const nextItems = [...parsed.items];

  if (existingIdx >= 0) {
    const nextQty = nextItems[existingIdx].quantity + delta;
    if (nextQty <= 0) {
      nextItems.splice(existingIdx, 1);
    } else {
      nextItems[existingIdx] = {
        ...nextItems[existingIdx],
        quantity: Math.min(30, nextQty),
      };
    }
  } else if (delta > 0 && nextItems.length < 40) {
    nextItems.push({
      entryId,
      participantUid,
      participantName: (participantName.trim() || 'مشارك').slice(0, 80),
      productId: product.id,
      name: product.name.slice(0, 100),
      price: Math.trunc(product.price),
      quantity: Math.min(30, delta),
    });
  }

  await updateDoc(ref, {
    items: nextItems,
    updatedAt: serverTimestamp(),
  });
}

export async function completeSharedCartCheckoutInFirestore(
  cartId: string
): Promise<void> {
  if (!cartId || !isValidFirestoreId(cartId)) return;
  try {
    await updateDoc(doc(db, 'sharedCarts', cartId), {
      status: 'checked_out',
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal
  }
}

/* ============================================================================
 * EDKAWY AI ASSISTANT (/api/ai/chat + /chat_logs)
 * ========================================================================== */

export async function askEdkawyAiAssistant(input: {
  userUid?: string;
  message: string;
  customerName?: string;
  points?: number;
  currentStreak?: number;
  history?: Pick<AiChatMessage, 'role' | 'text'>[];
  stores: StoreRecord[];
  activeCampaigns: CampaignRecord[];
}): Promise<AiAssistantApiResponse> {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: input.message.trim(),
      customerName: input.customerName ?? '',
      customerPoints: input.points ?? 0,
      currentStreak: input.currentStreak ?? 0,
      history: (input.history ?? []).slice(-4).map((h) => ({
        role: h.role,
        text: h.text,
      })),
      stores: input.stores.slice(0, 15).map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        neighborhood: s.neighborhood,
        deliveryFee: s.deliveryFee,
        isOpen: s.isActive && s.isOpen !== false,
        menuPreview: s.menuItems
          .slice(0, 5)
          .map((m) => `${m.name} (${m.price} ج.م)`),
      })),
      campaigns: input.activeCampaigns.slice(0, 6).map((c) => ({
        title: c.title,
        description: c.subtitle,
        pointsMultiplier: c.multiplier ?? 1,
      })),
    }),
  });

  const data = (await response.json()) as AiAssistantApiResponse;
  if (!response.ok || !data.ok) {
    throw new Error(
      data.error || 'تعذر الاتصال بمساعد إدكاوي الذكي حالياً، حاول مرة أخرى.'
    );
  }

  const uid = input.userUid || auth.currentUser?.uid;
  if (uid && isValidFirestoreId(uid)) {
    addDoc(collection(db, 'chat_logs'), {
      userId: uid,
      userMessage: input.message.trim().slice(0, 600),
      assistantReply: data.reply.slice(0, 1500),
      ...(data.suggestedStoreId && isValidFirestoreId(data.suggestedStoreId)
        ? { suggestedStoreId: data.suggestedStoreId }
        : {}),
      pointsSnapshot: Math.max(0, Math.trunc(Number(input.points ?? 0))),
      createdAt: serverTimestamp(),
    }).catch(() => {});
  }

  return data;
}

/* ============================================================================
 * LIVE COURIER GPS STREAMING
 * ========================================================================== */

export async function updateCourierLiveGpsInFirestore(
  courierUid: string,
  courierName: string,
  courierPhone: string,
  lat: number,
  lng: number,
  activeOrders: OrderRecord[],
  locationLabel?: string
): Promise<void> {
  if (!courierUid || !isValidFirestoreId(courierUid)) return;
  const cleanCoords = sanitizeEdkuCoords({ lat, lng });
  if (
    cleanCoords.courierLat === undefined ||
    cleanCoords.courierLng === undefined
  ) {
    return;
  }

  try {
    await waitForFirestoreWarmup();
    const batch = writeBatch(db);
    batch.update(doc(db, 'couriers', courierUid), {
      lat: cleanCoords.courierLat,
      lng: cleanCoords.courierLng,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'courierDirectory', courierUid), {
      lat: cleanCoords.courierLat,
      lng: cleanCoords.courierLng,
      updatedAt: serverTimestamp(),
    });
    await batch.commit().catch(() => {});

    const cleanName = (courierName.trim() || 'كابتن توصيل إدكاوي').slice(0, 80);
    const cleanPhone = normalizeEgyptPhoneOrEmpty(courierPhone);
    const cleanLoc = (
      locationLabel?.trim() || 'تتبع حي عبر GPS'
    ).slice(0, 120);

    for (const order of activeOrders) {
      if (order.status === 'on_the_way' || order.status === 'delivering') {
        const orderBatch = writeBatch(db);
        orderBatch.update(doc(db, 'orders', order.id), {
          status: 'on_the_way',
          courierId: courierUid,
          courierName: cleanName,
          courierPhone: cleanPhone,
          courierLocation: cleanLoc,
          courierLat: cleanCoords.courierLat,
          courierLng: cleanCoords.courierLng,
          updatedAt: serverTimestamp(),
        });
        orderBatch.update(doc(db, 'dispatchQueue', order.id), {
          status: 'on_the_way',
          courierId: courierUid,
          courierName: cleanName,
          courierLat: cleanCoords.courierLat,
          courierLng: cleanCoords.courierLng,
          updatedAt: serverTimestamp(),
        });
        await orderBatch.commit().catch(() => {});
      }
    }
  } catch {
    // Non-fatal streaming tick
  }
}

/* ============================================================================
 * REAL REVERSE GEOCODING + MAINTENANCE MODE & ACCOUNT BLOCKING
 * ========================================================================== */

export async function reverseGeocodeCoordinates(
  lat: number,
  lng: number
): Promise<ReverseGeocodeApiResponse> {
  try {
    const res = await fetch(
      `/api/maps/reverse-geocode?lat=${encodeURIComponent(
        String(lat)
      )}&lng=${encodeURIComponent(String(lng))}`
    );
    const data = (await res.json()) as ReverseGeocodeApiResponse & {
      quotaExceeded?: boolean;
    };
    if (res.status === 429 || data.quotaExceeded) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
      return { ok: false, error: data.error };
    }
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        isWaterBody: isEdkuWaterCoordinate(lat, lng),
        error: data.error,
      };
    }
    const matchedNeighborhood = resolveNearestEdkuNeighborhood(lat, lng);
    return {
      ok: true,
      isWaterBody:
        Boolean(data.isWaterBody) || isEdkuWaterCoordinate(lat, lng),
      formattedAddress: data.formattedAddress,
      shortAddress: data.shortAddress,
      matchedNeighborhood,
    };
  } catch {
    return {
      ok: false,
      isWaterBody: isEdkuWaterCoordinate(lat, lng),
    };
  }
}

const DEFAULT_SYSTEM_MAINTENANCE: SystemMaintenanceConfig = {
  maintenanceMode: false,
  maintenanceMessage:
    'نقوم حالياً بإجراء تحديثات سريعة لتحسين خدمة توصيل إدكاوي في مدينة إدكو. سنعود للعمل خلال دقائق بإذن الله.',
  surgeEnabled: false,
  surgeMultiplier: 1.5,
  smtpEnabled: true,
  paymentMethods: { cash: true, wallet: true, visa: false },
  updatedBy: '',
  updatedAtIso: new Date().toISOString(),
};

export function listenToSystemMaintenanceConfig(
  onData: (config: SystemMaintenanceConfig) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'appConfig', 'system'),
    (snap) => {
      if (!snap.exists()) {
        onData(DEFAULT_SYSTEM_MAINTENANCE);
        return;
      }
      const d = snap.data() ?? {};
      const rawPm = (d.paymentMethods ?? {}) as Record<string, unknown>;
      onData({
        maintenanceMode: Boolean(d.maintenanceMode),
        maintenanceMessage:
          typeof d.maintenanceMessage === 'string' && d.maintenanceMessage.trim()
            ? d.maintenanceMessage.trim()
            : DEFAULT_SYSTEM_MAINTENANCE.maintenanceMessage,
        surgeEnabled: Boolean(d.surgeEnabled),
        surgeMultiplier:
          typeof d.surgeMultiplier === 'number' && d.surgeMultiplier >= 1
            ? Math.min(3, d.surgeMultiplier)
            : 1.5,
        smtpEnabled: d.smtpEnabled !== false,
        paymentMethods: {
          cash: rawPm.cash !== false,
          wallet: rawPm.wallet !== false,
          visa: Boolean(rawPm.visa),
        },
        updatedBy: String(d.updatedBy ?? ''),
        updatedAtIso: toIsoString(d.updatedAt),
      });
    },
    () => {
      onData(DEFAULT_SYSTEM_MAINTENANCE);
    }
  );
}

export async function updateSystemMaintenanceByAdminInFirestore(
  adminUid: string,
  maintenanceMode: boolean,
  maintenanceMessage: string,
  extraSettings?: {
    surgeEnabled?: boolean;
    surgeMultiplier?: number;
    smtpEnabled?: boolean;
    paymentMethods?: PaymentMethodsConfig;
  }
): Promise<void> {
  if (!adminUid || !isValidFirestoreId(adminUid)) {
    throw new Error('صلاحية الإدارة مطلوبة لتحديث إعدادات المنصة.');
  }
  const cleanMsg =
    maintenanceMessage.trim().slice(0, 300) ||
    DEFAULT_SYSTEM_MAINTENANCE.maintenanceMessage;

  const ref = doc(db, 'appConfig', 'system');
  try {
    await waitForFirestoreWarmup();
    const existingSnap = await getDoc(ref);
    const prev = existingSnap.exists() ? existingSnap.data() ?? {} : {};
    const prevPm = (prev.paymentMethods ?? {}) as Record<string, unknown>;
    const payload: Record<string, unknown> = {
      maintenanceMode: Boolean(maintenanceMode),
      maintenanceMessage: cleanMsg,
      surgeEnabled:
        extraSettings?.surgeEnabled !== undefined
          ? Boolean(extraSettings.surgeEnabled)
          : Boolean(prev.surgeEnabled),
      surgeMultiplier:
        extraSettings?.surgeMultiplier !== undefined
          ? Math.min(3, Math.max(1, Number(extraSettings.surgeMultiplier)))
          : typeof prev.surgeMultiplier === 'number'
          ? prev.surgeMultiplier
          : 1.5,
      smtpEnabled:
        extraSettings?.smtpEnabled !== undefined
          ? Boolean(extraSettings.smtpEnabled)
          : prev.smtpEnabled !== false,
      paymentMethods: extraSettings?.paymentMethods
        ? {
            cash: Boolean(extraSettings.paymentMethods.cash),
            wallet: Boolean(extraSettings.paymentMethods.wallet),
            visa: Boolean(extraSettings.paymentMethods.visa),
          }
        : {
            cash: prevPm.cash !== false,
            wallet: prevPm.wallet !== false,
            visa: Boolean(prevPm.visa),
          },
      updatedBy: adminUid,
      updatedAt: serverTimestamp(),
    };
    if (existingSnap.exists()) {
      await updateDoc(ref, payload);
    } else {
      await setDoc(ref, payload);
    }
    void recordAuditLogInFirestore({
      adminId: adminUid,
      actionType: extraSettings ? 'update_system_settings' : 'toggle_maintenance',
      targetId: 'system',
      details: `${maintenanceMode ? 'تفعيل' : 'إيقاف'} وضع الصيانة (${cleanMsg.slice(0, 80)})${extraSettings?.surgeEnabled ? ' + تفعيل وقت الذروة 1.5x' : ''}.`,
    });
  } catch (error) {
    logFirestoreFailure(
      'appConfig',
      'system',
      'updateSystemMaintenanceByAdmin',
      error
    );
    handleFirestoreError(error, OperationType.WRITE, 'appConfig/system');
  }
}

function parseBlockedEntityDoc(
  snap: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>
): BlockedEntityRecord {
  const d = snap.data() ?? {};
  return {
    targetId: String(d.targetId ?? snap.id),
    targetType:
      d.targetType === 'courier' || d.targetType === 'store'
        ? d.targetType
        : 'customer',
    targetName: String(d.targetName ?? 'مستخدم'),
    reason: String(d.reason ?? 'مخالفة شروط الاستخدام'),
    isBlocked: Boolean(d.isBlocked),
    blockedBy: String(d.blockedBy ?? ''),
    updatedAtIso: toIsoString(d.updatedAt),
  };
}

export function listenToSingleBlockedStatus(
  targetId: string,
  onData: (record: BlockedEntityRecord | null) => void
): Unsubscribe {
  if (!targetId || !isValidFirestoreId(targetId)) {
    onData(null);
    return () => {};
  }
  return onSnapshot(
    doc(db, 'blockedUsers', targetId),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const parsed = parseBlockedEntityDoc(snap);
      onData(parsed.isBlocked ? parsed : null);
    },
    () => {
      onData(null);
    }
  );
}

export function listenToBlockedEntitiesForAdmin(
  onData: (records: BlockedEntityRecord[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'blockedUsers'),
    where('isBlocked', 'in', [true, false])
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map(parseBlockedEntityDoc)
        .sort((a, b) => b.updatedAtIso.localeCompare(a.updatedAtIso));
      onData(list);
    },
    () => {
      onData([]);
    }
  );
}

export async function setEntityBlockedByAdminInFirestore(
  adminUid: string,
  input: {
    targetId: string;
    targetType: BlockedEntityType;
    targetName: string;
    reason?: string;
    isBlocked: boolean;
    storeOwnerUid?: string;
  }
): Promise<void> {
  const cleanTargetId = input.targetId.trim();
  if (!isValidFirestoreId(cleanTargetId)) {
    throw new Error('معرّف الحساب أو المتجر غير صالح.');
  }
  if (cleanTargetId === adminUid) {
    throw new Error('لا يمكن حظر حساب مدير النظام الحالي.');
  }

  const cleanName = (input.targetName.trim() || 'حساب مستخدم').slice(0, 100);
  const cleanReason = (
    (input.reason ?? '').trim() ||
    (input.isBlocked ? 'إيقاف إداري لمخالفة سياسات منصة إدكاوي' : 'تم رفع الحظر من الإدارة')
  ).slice(0, 240);

  const ref = doc(db, 'blockedUsers', cleanTargetId);
  try {
    await waitForFirestoreWarmup();
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      await updateDoc(ref, {
        targetName: cleanName,
        reason: cleanReason,
        isBlocked: Boolean(input.isBlocked),
        blockedBy: adminUid,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        targetId: cleanTargetId,
        targetType: input.targetType,
        targetName: cleanName,
        reason: cleanReason,
        isBlocked: Boolean(input.isBlocked),
        blockedBy: adminUid,
        updatedAt: serverTimestamp(),
      });
    }

    if (input.targetType === 'store') {
      await updateDoc(doc(db, 'stores', cleanTargetId), {
        isActive: !input.isBlocked,
      }).catch(() => {});

      const ownerUid = (input.storeOwnerUid ?? '').trim();
      if (ownerUid && isValidFirestoreId(ownerUid) && ownerUid !== adminUid) {
        const ownerBlockRef = doc(db, 'blockedUsers', ownerUid);
        const ownerSnap = await getDoc(ownerBlockRef);
        if (ownerSnap.exists()) {
          await updateDoc(ownerBlockRef, {
            targetName: `تاجر: ${cleanName}`.slice(0, 100),
            reason: cleanReason,
            isBlocked: Boolean(input.isBlocked),
            blockedBy: adminUid,
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        } else {
          await setDoc(ownerBlockRef, {
            targetId: ownerUid,
            targetType: 'store',
            targetName: `تاجر: ${cleanName}`.slice(0, 100),
            reason: cleanReason,
            isBlocked: Boolean(input.isBlocked),
            blockedBy: adminUid,
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        }
      }
    } else if (input.targetType === 'courier' && input.isBlocked) {
      await updateDoc(doc(db, 'couriers', cleanTargetId), {
        isAvailable: false,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
      await updateDoc(doc(db, 'courierDirectory', cleanTargetId), {
        isAvailable: false,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }

    void recordAuditLogInFirestore({
      adminId: adminUid,
      actionType: input.isBlocked ? 'block_entity' : 'unblock_entity',
      targetId: cleanTargetId,
      details: `${input.isBlocked ? 'إيقاف' : 'رفع إيقاف'} (${input.targetType}) "${cleanName}" — السبب: ${cleanReason}`,
    });
  } catch (error) {
    logFirestoreFailure(
      'blockedUsers',
      cleanTargetId,
      'setEntityBlockedByAdmin',
      error
    );
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `blockedUsers/${cleanTargetId}`
    );
  }
}

/* ============================================================================
 * REAL GMAIL EMAIL VERIFICATION OTP + FIREBASE LINK FALLBACK
 * ========================================================================== */

export async function requestUserEmailVerificationOtp(
  name: string,
  email: string
): Promise<EmailVerificationRequestResult> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('يرجى إدخال بريد إلكتروني صحيح لإرسال كود التفعيل.');
  }
  const res = await fetch('/api/auth/email-verification/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: name.trim().slice(0, 60) || 'عميل إدكاوي',
      email: cleanEmail,
    }),
  });
  const data = (await res.json()) as EmailVerificationRequestResult;
  if (!res.ok || !data.ok) {
    const err = new Error(
      data.error || 'تعذر إرسال كود التفعيل للبريد الإلكتروني.'
    ) as Error & { retryAfterSeconds?: number };
    if (typeof data.retryAfterSeconds === 'number') {
      err.retryAfterSeconds = data.retryAfterSeconds;
    }
    throw err;
  }
  return data;
}

export async function verifyUserEmailVerificationOtp(
  email: string,
  code: string
): Promise<EmailVerificationVerifyResult> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = code.replace(/\D/g, '').slice(0, 4);
  if (cleanCode.length !== 4) {
    throw new Error('يرجى إدخال كود التفعيل المكون من 4 أرقام.');
  }
  const res = await fetch('/api/auth/email-verification/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: cleanEmail, code: cleanCode }),
  });
  const data = (await res.json()) as EmailVerificationVerifyResult;
  if (!res.ok || !data.ok) {
    const err = new Error(
      data.error || 'كود التفعيل غير صحيح أو منتهي الصلاحية.'
    ) as Error & { retryAfterSeconds?: number; remainingAttempts?: number };
    if (typeof data.retryAfterSeconds === 'number') {
      err.retryAfterSeconds = data.retryAfterSeconds;
    }
    if (typeof data.remainingAttempts === 'number') {
      err.remainingAttempts = data.remainingAttempts;
    }
    throw err;
  }
  return data;
}

export async function sendFirebaseFallbackVerificationLink(): Promise<void> {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) {
    throw new Error('سجل الدخول أولاً لإرسال رابط التفعيل البديل.');
  }
  await sendEmailVerification(user);
}

/* ============================================================================
 * EXCLUSIVE FEATURE 3: CUSTOM ERRAND SERVICE (خدمة المشاوير)
 * ========================================================================== */

export async function placeCustomErrandOrderInFirestore(
  customerUid: string,
  input: CustomErrandOrderInput
): Promise<string> {
  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    throw new Error('يرجى تسجيل الدخول بحسابك أولاً لطلب مشوار مخصص.');
  }
  const validationErr = validateCustomErrandInput(input);
  if (validationErr) {
    throw new Error(validationErr);
  }

  const effectiveCustomerUid = auth.currentUser.uid || customerUid;
  await waitForFirestoreWarmup();
  await assertSystemWritableForUser(effectiveCustomerUid, { checkMaintenance: true });

  const cleanErrandDesc = input.errandDescription.trim().slice(0, 380);
  const cleanPickup = input.errandPickupAddress.trim().slice(0, 160);
  const cleanDropoffAddress = input.deliveryAddress.trim().slice(0, 200);
  const rawNeighborhood = (input.deliveryNeighborhood ?? '').trim();
  const cleanDropoffNeighborhood = (
    rawNeighborhood.length >= 2 ? rawNeighborhood : 'شارع البحر'
  ).slice(0, 80);
  const normalizedPhone = normalizeEgyptPhoneOrEmpty(input.customerPhone);
  const summaryLabel = `مشوار إدكاوي (${cleanPickup.slice(0, 45)}): ${cleanErrandDesc.slice(0, 140)}`;

  const newOrderRef = doc(collection(db, 'orders'));
  const dispatchRef = doc(db, 'dispatchQueue', newOrderRef.id);
  const pickupCoords = resolveEdkuCoordsForNeighborhood(cleanDropoffNeighborhood);

  const orderPayload: Record<string, unknown> = {
    orderType: 'custom_errand',
    errandDescription: cleanErrandDesc,
    errandPickupAddress: cleanPickup,
    customerId: effectiveCustomerUid,
    storeId: 'edkawy_errands',
    storeName: 'خدمة مشاوير إدكاوي',
    storeLat: Number(pickupCoords.lat.toFixed(6)),
    storeLng: Number(pickupCoords.lng.toFixed(6)),
    customerName: input.customerName.trim().slice(0, 80),
    customerPhone: normalizedPhone,
    deliveryNeighborhood: cleanDropoffNeighborhood,
    deliveryAddress: cleanDropoffAddress,
    customerLat: Number(input.customerLat.toFixed(6)),
    customerLng: Number(input.customerLng.toFixed(6)),
    items: [
      {
        productId: 'custom_errand_item',
        name: `مشوار مخصص: ${cleanErrandDesc.slice(0, 70)}`,
        price: 0,
        quantity: 1,
      },
    ],
    itemsSummary: summaryLabel,
    itemNames: [summaryLabel.slice(0, 100)],
    itemCount: 1,
    subtotal: 0,
    deliveryFee: 0,
    totalAmount: 0,
    paymentMethod: 'cash',
    status: 'awaiting_courier_quote',
    notes: (input.notes ?? '').trim().slice(0, 200),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const dispatchPayload: Record<string, unknown> = {
    orderId: newOrderRef.id,
    orderType: 'custom_errand',
    errandDescription: cleanErrandDesc,
    errandPickupAddress: cleanPickup,
    customerId: effectiveCustomerUid,
    storeId: 'edkawy_errands',
    storeName: 'خدمة مشاوير إدكاوي',
    storeNeighborhood: cleanDropoffNeighborhood,
    storeLat: Number(pickupCoords.lat.toFixed(6)),
    storeLng: Number(pickupCoords.lng.toFixed(6)),
    deliveryNeighborhood: cleanDropoffNeighborhood,
    customerLat: Number(input.customerLat.toFixed(6)),
    customerLng: Number(input.customerLng.toFixed(6)),
    itemsSummary: summaryLabel,
    subtotal: 0,
    deliveryFee: 0,
    totalAmount: 0,
    paymentMethod: 'cash',
    status: 'awaiting_courier_quote',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const batch = writeBatch(db);
    batch.set(newOrderRef, orderPayload);
    batch.set(dispatchRef, dispatchPayload);
    await batch.commit();

    void createNotificationBestEffort(effectiveCustomerUid, {
      title: 'تم إرسال مشوارك لكباتن إدكاوي!',
      body: 'سيقوم أقرب كابتن متاح بتحديد تكلفة المشوار وإرسالها لموافقتك فوراً.',
      type: 'order_update',
      orderId: newOrderRef.id,
    });

    return newOrderRef.id;
  } catch (error) {
    logFirestoreFailure(
      'orders',
      newOrderRef.id,
      'placeCustomErrandOrderInFirestore',
      error
    );
    handleFirestoreError(error, OperationType.CREATE, 'orders');
  }
}

export async function quoteCustomErrandByCourierInFirestore(
  orderId: string,
  deliveryFeeEgp: number,
  courierUid: string,
  courierName: string,
  courierPhone: string,
  coords?: { lat?: number; lng?: number }
): Promise<void> {
  const cleanFee = Math.trunc(Number(deliveryFeeEgp));
  if (!Number.isFinite(cleanFee) || cleanFee < 10 || cleanFee > 500) {
    throw new Error('يرجى تحديد تكلفة مشوار عادلة بين 10 و 500 ج.م.');
  }

  const orderPath = `orders/${orderId}`;
  const cleanCourierName = (courierName.trim() || 'كابتن توصيل إدكاوي').slice(0, 80);
  const cleanCourierPhone = normalizeEgyptPhoneOrEmpty(courierPhone);
  const cleanCoords = sanitizeEdkuCoords(coords);

  try {
    await waitForFirestoreWarmup();
    await assertSystemWritableForUser(courierUid);
    const orderRef = doc(db, 'orders', orderId);
    const dispatchRef = doc(db, 'dispatchQueue', orderId);
    const [orderSnap, dispatchSnap] = await Promise.all([
      getDocWithRetry(orderRef, 'orders', orderId).catch(() => null),
      getDocWithRetry(dispatchRef, 'dispatchQueue', orderId),
    ]);

    const liveData = dispatchSnap.data() ?? orderSnap?.data() ?? {};
    const liveStatus = String(liveData.status ?? '');
    const assignedCourier = String(liveData.courierId ?? '').trim();

    if (assignedCourier && assignedCourier !== courierUid) {
      throw new Error('قام كابتن آخر بتقديم عرض سعر لهذا المشوار بالفعل.');
    }
    if (
      liveStatus !== 'awaiting_courier_quote' &&
      liveStatus !== 'awaiting_customer_errand_approval'
    ) {
      throw new Error('تغيرت حالة المشوار ولا يمكن تعديل العرض حالياً.');
    }

    await runWriteWithNetworkRetry(async () => {
      const batch = writeBatch(db);
      batch.update(orderRef, {
        status: 'awaiting_customer_errand_approval',
        deliveryFee: cleanFee,
        totalAmount: cleanFee,
        courierId: courierUid,
        courierName: cleanCourierName,
        courierPhone: cleanCourierPhone,
        courierLocation: 'بانتظار موافقة العميل على تكلفة المشوار',
        ...cleanCoords,
        updatedAt: serverTimestamp(),
      });
      if (dispatchSnap.exists()) {
        batch.update(dispatchRef, {
          status: 'awaiting_customer_errand_approval',
          deliveryFee: cleanFee,
          totalAmount: cleanFee,
          courierId: courierUid,
          courierName: cleanCourierName,
          ...cleanCoords,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    });

    const customerId = String(liveData.customerId ?? '').trim();
    if (customerId) {
      void createNotificationBestEffort(customerId, {
        title: `عرض تكلفة مشوارك من ${cleanCourierName.slice(0, 35)}: ${cleanFee} ج.م`,
        body: 'افتح تفاصيل الطلب واضغط «موافقة وبدء المشوار» ليبدأ الكابتن التنفيذ فوراً.',
        type: 'order_update',
        orderId,
      });
    }
  } catch (error) {
    if (isArabicBusinessError(error)) throw error;
    logFirestoreFailure(
      'orders',
      orderId,
      'quoteCustomErrandByCourierInFirestore',
      error
    );
    handleFirestoreError(error, OperationType.UPDATE, orderPath);
  }
}

export async function approveCustomErrandQuoteByCustomerInFirestore(
  order: OrderRecord
): Promise<void> {
  const orderPath = `orders/${order.id}`;
  try {
    await waitForFirestoreWarmup();
    const orderRef = doc(db, 'orders', order.id);
    const dispatchRef = doc(db, 'dispatchQueue', order.id);
    const dispatchSnap = await getDoc(dispatchRef).catch(() => null);

    await runWriteWithNetworkRetry(async () => {
      const batch = writeBatch(db);
      batch.update(orderRef, {
        status: 'on_the_way',
        updatedAt: serverTimestamp(),
      });
      if (!dispatchSnap || dispatchSnap.exists()) {
        batch.update(dispatchRef, {
          status: 'on_the_way',
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    });

    if (order.courierId) {
      void createNotificationBestEffort(order.courierId, {
        title: `وافق العميل على تكلفة المشوار (${order.totalAmount} ج.م)!`,
        body: 'يمكنك الانطلاق الآن لتنفيذ المشوار وتسليمه للعميل.',
        type: 'order_update',
        orderId: order.id,
      });
    }
  } catch (error) {
    logFirestoreFailure(
      'orders',
      order.id,
      'approveCustomErrandQuoteByCustomerInFirestore',
      error
    );
    handleFirestoreError(error, OperationType.UPDATE, orderPath);
  }
}

/* ============================================================================
 * INTERNAL STAFF / TEAM MANAGEMENT (فريق العمل)
 * ========================================================================== */

function parseStaffDoc(
  snap: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>
): StaffMemberRecord {
  const d = snap.data() ?? {};
  const rawRole = String(d.role ?? 'operations');
  const role: StaffRole =
    rawRole === 'super_admin' || rawRole === 'support_agent'
      ? rawRole
      : 'operations';

  return {
    id: String(d.id ?? snap.id),
    name: String(d.name ?? 'موظف إدكاوي'),
    email: String(d.email ?? ''),
    role,
    isActive: d.isActive !== false,
    openTicketCount: Math.max(0, Math.trunc(Number(d.openTicketCount ?? 0))),
    createdBy: String(d.createdBy ?? ''),
    createdAtIso: toIsoString(d.createdAt),
    updatedAtIso: toIsoString(d.updatedAt),
  };
}

export function listenToStaffMembersForAdmin(
  adminUid: string,
  onData: (members: StaffMemberRecord[]) => void
): Unsubscribe {
  if (!adminUid || !isValidFirestoreId(adminUid)) {
    onData([]);
    return () => {};
  }
  const q = query(collection(db, 'staff'), where('createdBy', '==', adminUid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map(parseStaffDoc)
        .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
      onData(list);
    },
    () => {
      onData([]);
    }
  );
}

export async function createStaffMemberByAdminInFirestore(
  adminUid: string,
  input: CreateStaffMemberInput
): Promise<StaffMemberRecord> {
  const validationErr = validateStaffMemberForm(input);
  if (validationErr) {
    throw new Error(validationErr);
  }

  const cleanName = input.name.trim().slice(0, 80);
  const cleanEmail = input.email.trim().toLowerCase().slice(0, 100);
  const cleanPassword = input.password;
  const role: StaffRole = input.role;

  await waitForFirestoreWarmup();
  const staffUid = await createSecondaryAuthUser(cleanEmail, cleanPassword);

  const staffRef = doc(db, 'staff', staffUid);
  const userRef = doc(db, 'users', staffUid);
  const mappedPortalRole: PortalRole =
    role === 'super_admin'
      ? 'admin'
      : role === 'support_agent'
      ? 'support_agent'
      : 'operations';

  try {
    await setDoc(staffRef, {
      id: staffUid,
      name: cleanName,
      email: cleanEmail,
      role,
      isActive: true,
      openTicketCount: 0,
      createdBy: adminUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await setDoc(userRef, {
      role: mappedPortalRole,
      name: cleanName,
      email: cleanEmail,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    if (role === 'support_agent') {
      await setDoc(doc(db, 'supportAgentsPool', staffUid), {
        staffId: staffUid,
        name: cleanName,
        isActive: true,
        openTicketCount: 0,
        updatedAt: serverTimestamp(),
      });
    }

    return {
      id: staffUid,
      name: cleanName,
      email: cleanEmail,
      role,
      isActive: true,
      openTicketCount: 0,
      createdBy: adminUid,
      createdAtIso: new Date().toISOString(),
      updatedAtIso: new Date().toISOString(),
    };
  } catch (error) {
    logFirestoreFailure(
      'staff',
      staffUid,
      'createStaffMemberByAdminInFirestore',
      error
    );
    handleFirestoreError(error, OperationType.CREATE, `staff/${staffUid}`);
  }
}

export async function toggleStaffMemberActiveByAdminInFirestore(
  staffMember: StaffMemberRecord,
  nextActive: boolean
): Promise<void> {
  const staffPath = `staff/${staffMember.id}`;
  try {
    await waitForFirestoreWarmup();
    const batch = writeBatch(db);
    batch.update(doc(db, 'staff', staffMember.id), {
      isActive: Boolean(nextActive),
      updatedAt: serverTimestamp(),
    });
    if (staffMember.role === 'support_agent') {
      batch.set(
        doc(db, 'supportAgentsPool', staffMember.id),
        {
          staffId: staffMember.id,
          name: staffMember.name.slice(0, 80),
          isActive: Boolean(nextActive),
          openTicketCount: Math.max(0, staffMember.openTicketCount),
          updatedAt: serverTimestamp(),
        },
        { merge: false }
      );
    }
    await batch.commit();
  } catch (error) {
    logFirestoreFailure(
      'staff',
      staffMember.id,
      'toggleStaffMemberActiveByAdminInFirestore',
      error
    );
    handleFirestoreError(error, OperationType.UPDATE, staffPath);
  }
}

/* ============================================================================
 * REAL-TIME TECHNICAL SUPPORT TICKETS & LIVE CHAT (الدعم الفني والشات الفوري)
 * ========================================================================== */

function parseSupportTicketDoc(
  snap: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>
): SupportTicketRecord {
  const d = snap.data() ?? {};
  const rawCategory = String(d.category ?? 'أخرى');
  const category: SupportTicketCategory =
    rawCategory === 'طلب' ||
    rawCategory === 'دفع' ||
    rawCategory === 'مشكلة تقنية' ||
    rawCategory === 'أخرى'
      ? rawCategory
      : 'أخرى';

  const status: SupportTicketStatus =
    d.status === 'closed' ? 'closed' : 'open';

  const rawUserRole = String(d.userRole ?? 'customer');
  const userRole: 'customer' | 'store' | 'courier' =
    rawUserRole === 'store' || rawUserRole === 'courier'
      ? rawUserRole
      : 'customer';

  return {
    id: snap.id,
    userId: String(d.userId ?? ''),
    userName: String(d.userName ?? 'مستخدم إدكاوي'),
    userPhone: String(d.userPhone ?? ''),
    userEmail: typeof d.userEmail === 'string' ? d.userEmail : undefined,
    userRole,
    subject: String(d.subject ?? ''),
    category,
    details: String(d.details ?? ''),
    status,
    assignedTo: String(d.assignedTo ?? ''),
    assignedToName: String(d.assignedToName ?? 'قيد التوزيع'),
    hasAdminReply: Boolean(d.hasAdminReply),
    attachmentImageUrl: sanitizeOptionalImage(
      typeof d.attachmentImageUrl === 'string' ? d.attachmentImageUrl : undefined
    ),
    slaDeadlineIso:
      typeof d.slaDeadlineIso === 'string' && d.slaDeadlineIso.trim()
        ? d.slaDeadlineIso.trim()
        : undefined,
    createdAtIso: toIsoString(d.createdAt),
    lastUpdatedIso: toIsoString(d.lastUpdated),
  };
}

function parseSupportMessageDoc(
  snap: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>
): SupportMessageRecord {
  const d = snap.data() ?? {};
  const rawRole = String(d.senderRole ?? 'user');
  const senderRole: 'user' | 'admin' | 'support_agent' =
    rawRole === 'admin' || rawRole === 'support_agent' ? rawRole : 'user';

  return {
    id: snap.id,
    ticketId: String(d.ticketId ?? ''),
    senderId: String(d.senderId ?? ''),
    senderName: String(d.senderName ?? 'الدعم الفني'),
    senderRole,
    text: String(d.text ?? ''),
    participants: Array.isArray(d.participants)
      ? d.participants.map(String)
      : [],
    timestampIso: toIsoString(d.timestamp),
  };
}

async function resolveBootstrapAdminUidBestEffort(): Promise<string> {
  try {
    const snap = await getDoc(doc(db, 'appConfig', 'bootstrap'));
    if (snap.exists()) {
      const uid = String(snap.data()?.adminUid ?? '').trim();
      if (isValidFirestoreId(uid)) return uid;
    }
  } catch {
    // Best-effort lookup
  }
  return '';
}

function buildSupportMessageParticipants(ids: Array<string | undefined>): string[] {
  const unique: string[] = [];
  for (const raw of ids) {
    const clean = (raw ?? '').trim();
    if (clean && isValidFirestoreId(clean) && !unique.includes(clean)) {
      unique.push(clean);
    }
    if (unique.length >= 5) break;
  }
  return unique;
}

export async function createSupportTicketInFirestore(
  userUid: string,
  userProfile: {
    name: string;
    phone?: string;
    email?: string;
    role: 'customer' | 'store' | 'courier';
  },
  input: CreateSupportTicketInput
): Promise<string> {
  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    throw new Error('يرجى تسجيل الدخول بحسابك أولاً لإرسال تذكرة دعم فني.');
  }
  const errMsg = validateSupportTicketForm(input);
  if (errMsg) {
    throw new Error(errMsg);
  }

  await waitForFirestoreWarmup();

  // Auto-assign to active support agent with lowest openTicketCount (if available)
  let assignedTo = '';
  let assignedToName = 'فريق الدعم المركزي';
  let chosenAgentPoolCount = 0;

  try {
    const poolSnap = await getDocs(
      query(collection(db, 'supportAgentsPool'), where('isActive', '==', true))
    );
    if (!poolSnap.empty) {
      const activeAgents = poolSnap.docs
        .map((d) => ({
          staffId: String(d.data()?.staffId ?? d.id),
          name: String(d.data()?.name ?? 'مسؤول دعم'),
          openTicketCount: Math.max(
            0,
            Math.trunc(Number(d.data()?.openTicketCount ?? 0))
          ),
        }))
        .sort((a, b) => a.openTicketCount - b.openTicketCount);

      if (activeAgents.length > 0) {
        assignedTo = activeAgents[0].staffId;
        assignedToName = activeAgents[0].name.slice(0, 80);
        chosenAgentPoolCount = activeAgents[0].openTicketCount;
      }
    }
  } catch {
    // Fallback to central admin pool
  }

  const bootstrapAdminUid = await resolveBootstrapAdminUidBestEffort();
  const ticketRef = doc(collection(db, 'support_tickets'));
  const indexRef = doc(db, 'supportTicketIndex', ticketRef.id);
  const cleanName = (userProfile.name.trim() || 'عميل إدكاوي').slice(0, 80);
  const cleanPhone = (userProfile.phone ?? '').trim().slice(0, 20);
  const cleanEmail = (userProfile.email ?? '').trim().slice(0, 100);
  const cleanSubject = input.subject.trim().slice(0, 100);
  const cleanDetails = input.details.trim().slice(0, 1000);
  const cleanAttachmentImage = sanitizeOptionalImage(input.attachmentImageUrl);
  const slaDeadlineIso = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  try {
    const batch = writeBatch(db);
    batch.set(ticketRef, {
      userId: userUid,
      userName: cleanName,
      userPhone: cleanPhone,
      ...(cleanEmail ? { userEmail: cleanEmail } : {}),
      userRole: userProfile.role,
      subject: cleanSubject,
      category: input.category,
      details: cleanDetails,
      status: 'open',
      assignedTo,
      assignedToName,
      hasAdminReply: false,
      ...(cleanAttachmentImage ? { attachmentImageUrl: cleanAttachmentImage } : {}),
      slaDeadlineIso,
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp(),
    });
    batch.set(indexRef, {
      ticketId: ticketRef.id,
      userId: userUid,
      subject: cleanSubject,
      category: input.category,
      status: 'open',
      assignedTo,
      assignedToName,
      hasAdminReply: false,
      slaDeadlineIso,
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp(),
    });
    await batch.commit();

    // Increment assigned support agent workload counter best-effort
    if (assignedTo) {
      await updateDoc(doc(db, 'supportAgentsPool', assignedTo), {
        openTicketCount: chosenAgentPoolCount + 1,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }

    // Seed opening chat message in /support_messages
    const participants = buildSupportMessageParticipants([
      userUid,
      assignedTo,
      bootstrapAdminUid,
    ]);
    await addDoc(collection(db, 'support_messages'), {
      ticketId: ticketRef.id,
      senderId: userUid,
      senderName: cleanName,
      senderRole: 'user',
      text: cleanDetails,
      participants,
      timestamp: serverTimestamp(),
    }).catch(() => {});

    return ticketRef.id;
  } catch (error) {
    logFirestoreFailure(
      'support_tickets',
      ticketRef.id,
      'createSupportTicketInFirestore',
      error
    );
    handleFirestoreError(error, OperationType.CREATE, 'support_tickets');
  }
}

export function listenToUserSupportTickets(
  userUid: string,
  onData: (tickets: SupportTicketRecord[]) => void
): Unsubscribe {
  if (!userUid || !isValidFirestoreId(userUid)) {
    onData([]);
    return () => {};
  }
  const q = query(
    collection(db, 'support_tickets'),
    where('userId', '==', userUid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map(parseSupportTicketDoc)
        .sort((a, b) => b.lastUpdatedIso.localeCompare(a.lastUpdatedIso));
      onData(list);
    },
    () => {
      onData([]);
    }
  );
}

export function listenToAssignedSupportTickets(
  agentUid: string,
  onData: (tickets: SupportTicketRecord[]) => void
): Unsubscribe {
  if (!agentUid || !isValidFirestoreId(agentUid)) {
    onData([]);
    return () => {};
  }
  const q = query(
    collection(db, 'support_tickets'),
    where('assignedTo', '==', agentUid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map(parseSupportTicketDoc)
        .sort((a, b) => b.lastUpdatedIso.localeCompare(a.lastUpdatedIso));
      onData(list);
    },
    () => {
      onData([]);
    }
  );
}

export function listenToAllSupportTicketsForAdmin(
  onData: (tickets: SupportTicketRecord[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'supportTicketIndex'),
    where('status', 'in', ['open', 'closed'])
  );
  return onSnapshot(
    q,
    (snap) => {
      void (async () => {
        const enriched = await Promise.all(
          snap.docs.map(async (idxDoc) => {
            const idx = idxDoc.data() ?? {};
            const ticketId = String(idx.ticketId ?? idxDoc.id);
            try {
              const fullSnap = await getDocWithRetry(
                doc(db, 'support_tickets', ticketId),
                'support_tickets',
                ticketId
              );
              if (fullSnap.exists()) {
                return parseSupportTicketDoc(fullSnap);
              }
            } catch {
              // Fallback to index preview
            }
            return {
              id: ticketId,
              userId: String(idx.userId ?? ''),
              userName: 'مستخدم إدكاوي',
              userPhone: '',
              userRole: 'customer' as const,
              subject: String(idx.subject ?? ''),
              category:
                idx.category === 'طلب' ||
                idx.category === 'دفع' ||
                idx.category === 'مشكلة تقنية'
                  ? idx.category
                  : 'أخرى',
              details: '',
              status: idx.status === 'closed' ? 'closed' : 'open',
              assignedTo: String(idx.assignedTo ?? ''),
              assignedToName: String(idx.assignedToName ?? 'فريق الدعم'),
              hasAdminReply: Boolean(idx.hasAdminReply),
              createdAtIso: toIsoString(idx.createdAt),
              lastUpdatedIso: toIsoString(idx.lastUpdated),
            } satisfies SupportTicketRecord;
          })
        );
        enriched.sort((a, b) => b.lastUpdatedIso.localeCompare(a.lastUpdatedIso));
        onData(enriched);
      })();
    },
    () => {
      onData([]);
    }
  );
}

export function listenToSupportMessages(
  ticketId: string,
  currentUid: string,
  onData: (messages: SupportMessageRecord[]) => void
): Unsubscribe {
  if (
    !ticketId ||
    !isValidFirestoreId(ticketId) ||
    !currentUid ||
    !isValidFirestoreId(currentUid)
  ) {
    onData([]);
    return () => {};
  }

  const q = query(
    collection(db, 'support_messages'),
    where('participants', 'array-contains', currentUid)
  );

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map(parseSupportMessageDoc)
        .filter((m) => m.ticketId === ticketId)
        .sort((a, b) => a.timestampIso.localeCompare(b.timestampIso));
      onData(list);
    },
    () => {
      onData([]);
    }
  );
}

export async function sendSupportMessageInFirestore(
  ticket: SupportTicketRecord,
  senderUid: string,
  senderName: string,
  senderRole: 'user' | 'admin' | 'support_agent',
  text: string
): Promise<void> {
  const cleanText = text.trim().slice(0, 1500);
  if (!cleanText) {
    throw new Error('يرجى كتابة نص الرسالة قبل الإرسال.');
  }
  if (ticket.status === 'closed' && senderRole === 'user') {
    throw new Error('تم إغلاق هذه التذكرة. يمكنك فتح تذكرة جديدة في أي وقت.');
  }

  await waitForFirestoreWarmup();
  const bootstrapAdminUid = await resolveBootstrapAdminUidBestEffort();
  const participants = buildSupportMessageParticipants([
    senderUid,
    ticket.userId,
    ticket.assignedTo,
    bootstrapAdminUid,
  ]);

  try {
    await addDoc(collection(db, 'support_messages'), {
      ticketId: ticket.id,
      senderId: senderUid,
      senderName: (senderName.trim() || 'الدعم الفني').slice(0, 80),
      senderRole,
      text: cleanText,
      participants,
      timestamp: serverTimestamp(),
    });

    const batch = writeBatch(db);
    if (senderRole === 'user') {
      batch.update(doc(db, 'support_tickets', ticket.id), {
        lastUpdated: serverTimestamp(),
      });
      batch.update(doc(db, 'supportTicketIndex', ticket.id), {
        lastUpdated: serverTimestamp(),
      });
    } else {
      batch.update(doc(db, 'support_tickets', ticket.id), {
        hasAdminReply: true,
        status: 'open',
        lastUpdated: serverTimestamp(),
      });
      batch.update(doc(db, 'supportTicketIndex', ticket.id), {
        hasAdminReply: true,
        status: 'open',
        lastUpdated: serverTimestamp(),
      });
    }
    await batch.commit();

    if (senderRole !== 'user' && ticket.userId) {
      void createNotificationBestEffort(ticket.userId, {
        title: `رد جديد من الدعم الفني على تذكرتك: ${ticket.subject.slice(0, 40)}`,
        body: cleanText.slice(0, 130),
        type: 'system',
      });
    }
  } catch (error) {
    logFirestoreFailure(
      'support_messages',
      ticket.id,
      'sendSupportMessageInFirestore',
      error
    );
    handleFirestoreError(error, OperationType.CREATE, 'support_messages');
  }
}

export async function closeSupportTicketInFirestore(
  ticket: SupportTicketRecord
): Promise<void> {
  if (ticket.status === 'closed') return;
  try {
    await waitForFirestoreWarmup();
    const isCallerTicketOwner =
      Boolean(auth.currentUser?.uid) && auth.currentUser?.uid === ticket.userId;
    const closePayload: Record<string, unknown> = {
      status: 'closed',
      ...(isCallerTicketOwner ? {} : { hasAdminReply: true }),
      lastUpdated: serverTimestamp(),
    };

    const batch = writeBatch(db);
    batch.update(doc(db, 'support_tickets', ticket.id), closePayload);
    batch.update(doc(db, 'supportTicketIndex', ticket.id), closePayload);
    await batch.commit();

    if (
      !isCallerTicketOwner &&
      ticket.assignedTo &&
      isValidFirestoreId(ticket.assignedTo)
    ) {
      try {
        const poolRef = doc(db, 'supportAgentsPool', ticket.assignedTo);
        const poolSnap = await getDoc(poolRef);
        if (poolSnap.exists()) {
          const cur = Math.max(
            0,
            Math.trunc(Number(poolSnap.data()?.openTicketCount ?? 0))
          );
          await updateDoc(poolRef, {
            openTicketCount: Math.max(0, cur - 1),
            updatedAt: serverTimestamp(),
          });
        }
        const staffRef = doc(db, 'staff', ticket.assignedTo);
        const staffSnap = await getDoc(staffRef);
        if (staffSnap.exists()) {
          const curStaff = Math.max(
            0,
            Math.trunc(Number(staffSnap.data()?.openTicketCount ?? 0))
          );
          await updateDoc(staffRef, {
            openTicketCount: Math.max(0, curStaff - 1),
            updatedAt: serverTimestamp(),
          });
        }
      } catch {
        // Non-fatal counter sync
      }
    }

    if (!isCallerTicketOwner && ticket.userId) {
      void createNotificationBestEffort(ticket.userId, {
        title: `تم حل وإغلاق تذكرة الدعم: ${ticket.subject.slice(0, 40)}`,
        body: 'سعدنا بخدمتك في إدكاوي! إذا احتجت أي مساعدة إضافية يمكنك فتح تذكرة جديدة في أي وقت.',
        type: 'system',
      });
    }
  } catch (error) {
    logFirestoreFailure(
      'support_tickets',
      ticket.id,
      'closeSupportTicketInFirestore',
      error
    );
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `support_tickets/${ticket.id}`
    );
  }
}

export async function assignSupportTicketByAdminInFirestore(
  ticket: SupportTicketRecord,
  targetAgent: { id: string; name: string } | null,
  adminUid: string
): Promise<void> {
  const nextAssignedTo = targetAgent?.id?.trim() ?? '';
  const nextAssignedName = (targetAgent?.name?.trim() || 'فريق الدعم المركزي').slice(
    0,
    80
  );

  try {
    await waitForFirestoreWarmup();
    const batch = writeBatch(db);
    batch.update(doc(db, 'support_tickets', ticket.id), {
      assignedTo: nextAssignedTo,
      assignedToName: nextAssignedName,
      lastUpdated: serverTimestamp(),
    });
    batch.update(doc(db, 'supportTicketIndex', ticket.id), {
      assignedTo: nextAssignedTo,
      assignedToName: nextAssignedName,
      lastUpdated: serverTimestamp(),
    });
    await batch.commit();

    // Grant newly assigned agent read access on existing messages of this ticket
    if (nextAssignedTo && isValidFirestoreId(nextAssignedTo)) {
      try {
        const msgSnap = await getDocs(
          query(
            collection(db, 'support_messages'),
            where('participants', 'array-contains', adminUid)
          )
        );
        for (const mDoc of msgSnap.docs) {
          if (String(mDoc.data()?.ticketId ?? '') === ticket.id) {
            const existingParts = Array.isArray(mDoc.data()?.participants)
              ? mDoc.data().participants.map(String)
              : [];
            if (!existingParts.includes(nextAssignedTo)) {
              const updatedParts = buildSupportMessageParticipants([
                ...existingParts,
                nextAssignedTo,
              ]);
              await updateDoc(doc(db, 'support_messages', mDoc.id), {
                participants: updatedParts,
              }).catch(() => {});
            }
          }
        }
      } catch {
        // Non-fatal message participant backfill
      }
    }
  } catch (error) {
    logFirestoreFailure(
      'support_tickets',
      ticket.id,
      'assignSupportTicketByAdminInFirestore',
      error
    );
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `support_tickets/${ticket.id}`
    );
  }
}

/* ============================================================================
 * EXCLUSIVE FEATURES 2, 4 & 5: ALL PRODUCTS STREAM, WEATHER, VISUAL SEARCH, MEAL PLANNER
 * ========================================================================== */

export function listenToAllAvailableProducts(
  onProductsUpdate: (products: ProductRecord[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'products'),
    where('isAvailable', '==', true)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: ProductRecord[] = snap.docs.map((d) =>
        parseProductSnapshotDoc(d, '')
      );
      onProductsUpdate(list);
    },
    () => {
      onProductsUpdate([]);
    }
  );
}

export async function fetchEdkuWeatherPromo(): Promise<EdkuWeatherPromoResponse | null> {
  try {
    const res = await fetch('/api/weather/edku');
    const data = (await res.json()) as EdkuWeatherPromoResponse;
    if (!res.ok || !data.ok) return null;
    return data;
  } catch {
    return null;
  }
}

export async function searchProductsByImageWithAi(
  imageDataUrl: string,
  products: ProductRecord[],
  stores: StoreRecord[]
): Promise<VisualSearchApiResponse> {
  const activeStoreMap = new Map<string, StoreRecord>();
  for (const s of stores) {
    if (s.isActive !== false) {
      activeStoreMap.set(s.id, s);
    }
  }

  const catalogPayload = products
    .filter((p) => p.isAvailable && activeStoreMap.has(p.storeId))
    .slice(0, 80)
    .map((p) => {
      const st = activeStoreMap.get(p.storeId)!;
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        price: p.price,
        storeId: st.id,
        storeName: st.name,
      };
    });

  // Fallback to embedded menuItems on stores if standalone products collection is sparse
  if (catalogPayload.length < 10) {
    for (const st of activeStoreMap.values()) {
      for (const mi of st.menuItems) {
        if (!catalogPayload.some((c) => c.id === mi.id)) {
          catalogPayload.push({
            id: mi.id,
            name: mi.name,
            category: mi.category || st.category,
            price: mi.price,
            storeId: st.id,
            storeName: st.name,
          });
        }
        if (catalogPayload.length >= 80) break;
      }
      if (catalogPayload.length >= 80) break;
    }
  }

  const res = await fetch('/api/ai/visual-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageDataUrl,
      productsCatalog: catalogPayload,
    }),
  });
  const data = (await res.json()) as VisualSearchApiResponse;
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'تعذر تحليل الصورة حالياً.');
  }
  return data;
}

export async function generateSmartMealPlanWithAi(
  input: MealPlanRequestInput,
  products: ProductRecord[],
  stores: StoreRecord[]
): Promise<MealPlanApiResponse> {
  const activeStoreMap = new Map<string, StoreRecord>();
  for (const s of stores) {
    if (s.isActive !== false && s.category !== 'صيدليات') {
      activeStoreMap.set(s.id, s);
    }
  }

  const catalogPayload = products
    .filter((p) => p.isAvailable && activeStoreMap.has(p.storeId))
    .slice(0, 90)
    .map((p) => {
      const st = activeStoreMap.get(p.storeId)!;
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        price: p.price,
        storeId: st.id,
        storeName: st.name,
      };
    });

  if (catalogPayload.length < 12) {
    for (const st of activeStoreMap.values()) {
      for (const mi of st.menuItems) {
        if (!catalogPayload.some((c) => c.id === mi.id)) {
          catalogPayload.push({
            id: mi.id,
            name: mi.name,
            category: mi.category || st.category,
            price: mi.price,
            storeId: st.id,
            storeName: st.name,
          });
        }
        if (catalogPayload.length >= 90) break;
      }
      if (catalogPayload.length >= 90) break;
    }
  }

  const res = await fetch('/api/ai/meal-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      budgetEgp: input.budgetEgp,
      daysCount: input.daysCount,
      dietaryStyle: input.dietaryStyle,
      productsCatalog: catalogPayload,
    }),
  });
  const data = (await res.json()) as MealPlanApiResponse;
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'تعذر إعداد جدول الوجبات الذكي حالياً.');
  }
  return data;
}

export { EDKU_CITY_CENTER };

/* ============================================================================
 * CYBERSECURITY, AUDIT LOGS, CUSTOMER BAN, FRAUD TRACKING & QA TESTING CENTER
 * ========================================================================== */

export async function recordAuditLogInFirestore(input: {
  adminId?: string;
  adminName?: string;
  actionType: AuditActionType;
  details: string;
  targetId?: string;
}): Promise<void> {
  const actorUid = (input.adminId ?? auth.currentUser?.uid ?? '').trim();
  if (!actorUid || !isValidFirestoreId(actorUid)) {
    return;
  }
  const actorName = (
    input.adminName?.trim() ||
    auth.currentUser?.displayName?.trim() ||
    auth.currentUser?.email?.trim() ||
    'مدير النظام'
  ).slice(0, 80);

  const cleanDetails = (input.details.trim() || 'عملية إدارية').slice(0, 500);
  const actionLabelAr = getAuditActionLabelAr(input.actionType).slice(0, 80);
  const cleanTargetId = input.targetId?.trim();

  try {
    await waitForFirestoreWarmup();
    const logRef = doc(collection(db, 'audit_logs'));
    await setDoc(logRef, {
      adminId: actorUid,
      adminName: actorName,
      actionType: input.actionType,
      actionLabelAr,
      details: cleanDetails,
      ...(cleanTargetId && isValidFirestoreId(cleanTargetId)
        ? { targetId: cleanTargetId }
        : {}),
      createdAt: serverTimestamp(),
    });

    const indexRef = doc(db, 'appConfig', 'auditIndex');
    const indexSnap = await getDoc(indexRef).catch(() => null);
    const prevIds: string[] = Array.isArray(indexSnap?.data()?.recentLogIds)
      ? (indexSnap!.data()!.recentLogIds as unknown[]).filter(
          (x): x is string => typeof x === 'string' && isValidFirestoreId(x)
        )
      : [];
    const nextIds = [
      logRef.id,
      ...prevIds.filter((existingId) => existingId !== logRef.id),
    ].slice(0, 200);

    if (indexSnap?.exists()) {
      await updateDoc(indexRef, {
        recentLogIds: nextIds,
        updatedBy: actorUid,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(indexRef, {
        recentLogIds: nextIds,
        updatedBy: actorUid,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    logFirestoreFailure('audit_logs', '*', 'recordAuditLogInFirestore', err);
  }
}

function parseAuditLogDoc(
  snap: DocumentSnapshot<DocumentData>
): AuditLogRecord | null {
  if (!snap.exists()) return null;
  const d = snap.data() ?? {};
  const actionType = (d.actionType as AuditActionType) ?? 'toggle_store_active';
  return {
    id: snap.id,
    adminId: String(d.adminId ?? ''),
    adminName: String(d.adminName ?? 'مدير النظام'),
    actionType,
    actionLabelAr: String(
      d.actionLabelAr ?? getAuditActionLabelAr(actionType)
    ),
    details: String(d.details ?? ''),
    targetId: typeof d.targetId === 'string' ? d.targetId : undefined,
    createdAtIso: toIsoString(d.createdAt),
  };
}

export function listenToAdminAuditLogs(
  onData: (logs: AuditLogRecord[]) => void
): Unsubscribe {
  const indexRef = doc(db, 'appConfig', 'auditIndex');
  let activeFetchToken = 0;

  return onSnapshot(
    indexRef,
    (snap) => {
      const fetchToken = ++activeFetchToken;
      if (!snap.exists()) {
        onData([]);
        return;
      }
      const rawIds: string[] = Array.isArray(snap.data()?.recentLogIds)
        ? (snap.data()!.recentLogIds as unknown[])
            .filter(
              (x): x is string => typeof x === 'string' && isValidFirestoreId(x)
            )
            .slice(0, 120)
        : [];
      if (rawIds.length === 0) {
        onData([]);
        return;
      }

      void Promise.all(
        rawIds.map((logId) =>
          getDoc(doc(db, 'audit_logs', logId)).catch(() => null)
        )
      ).then((snaps) => {
        if (fetchToken !== activeFetchToken) return;
        const parsed = snaps
          .map((s) => (s ? parseAuditLogDoc(s) : null))
          .filter((item): item is AuditLogRecord => item !== null)
          .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
        onData(parsed);
      });
    },
    () => {
      onData([]);
    }
  );
}

export function listenToAdminCustomersWithPii(
  onData: (customers: AdminCustomerRecord[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'customerDirectory'),
    where('points', '>=', 0)
  );
  let activeToken = 0;

  return onSnapshot(
    q,
    (snap) => {
      const token = ++activeToken;
      const baseList = snap.docs.map(parseCustomerDirectoryDoc);
      if (baseList.length === 0) {
        onData([]);
        return;
      }

      void Promise.all(
        baseList.map(async (entry): Promise<AdminCustomerRecord> => {
          try {
            const userSnap = await getDoc(doc(db, 'users', entry.uid));
            if (userSnap.exists()) {
              const u = userSnap.data() ?? {};
              const userCode = isValidCustomerCodeFormat(u.customerCode)
                ? u.customerCode.trim()
                : entry.customerCode;

              if (userCode && !entry.customerCode) {
                void syncCustomerDirectoryEntry(entry.uid, {
                  name: entry.name,
                  customerCode: userCode,
                });
              }

              return {
                ...entry,
                name:
                  typeof u.name === 'string' && u.name.trim()
                    ? u.name.trim()
                    : entry.name,
                customerCode: userCode,
                isBanned: Boolean(u.isBanned || entry.isBanned),
                banReason:
                  typeof u.banReason === 'string' && u.banReason.trim()
                    ? u.banReason.trim()
                    : entry.banReason,
                phone: typeof u.phone === 'string' ? u.phone : undefined,
                email: typeof u.email === 'string' ? u.email : undefined,
                defaultAddress:
                  typeof u.defaultAddress === 'string'
                    ? u.defaultAddress
                    : undefined,
                createdAtIso: u.createdAt ? toIsoString(u.createdAt) : undefined,
              };
            }
          } catch {
            // Non-admin fallback (e.g. Support/Operations without /users PII read)
          }
          return { ...entry };
        })
      ).then((enriched) => {
        if (token !== activeToken) return;
        enriched.sort((a, b) =>
          (b.updatedAtIso || '').localeCompare(a.updatedAtIso || '')
        );
        onData(enriched);
      });
    },
    () => {
      onData([]);
    }
  );
}

export async function setCustomerBanStatusByAdminInFirestore(
  adminUid: string,
  input: {
    customerUid: string;
    customerName: string;
    customerCode?: string;
    isBanned: boolean;
    banType?: CustomerBanType;
    reason?: string;
  }
): Promise<void> {
  const targetUid = input.customerUid.trim();
  if (!isValidFirestoreId(targetUid)) {
    throw new Error('معرّف العميل غير صالح.');
  }
  if (targetUid === adminUid) {
    throw new Error('لا يمكن حظر حساب مدير النظام الحالي.');
  }

  const cleanName = (input.customerName.trim() || 'عميل إدكاوي').slice(0, 80);
  const resolvedBanType: CustomerBanType | undefined = input.isBanned
    ? input.banType || 'permanent'
    : undefined;
  const resolvedBanUntilIso =
    input.isBanned && resolvedBanType === 'temporary_24h'
      ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      : '';
  const banLabelAr =
    resolvedBanType === 'temporary_24h'
      ? 'تجميد مؤقت ٢٤ ساعة'
      : resolvedBanType === 'suspended'
      ? 'إيقاف مؤقت للحساب'
      : 'حظر نهائي';

  const cleanReason = (
    input.reason?.trim() ||
    (input.isBanned
      ? `${banLabelAr} — تواصل مع الدعم`
      : 'تم إلغاء الحظر عن حسابك من إدارة إدكاوي')
  ).slice(0, 240);

  await waitForFirestoreWarmup();
  try {
    const userRef = doc(db, 'users', targetUid);
    const userSnap = await getDoc(userRef);
    const existingCode = userSnap.exists()
      ? userSnap.data()?.customerCode
      : input.customerCode;
    const resolvedCode = isValidCustomerCodeFormat(existingCode)
      ? existingCode.trim()
      : isValidCustomerCodeFormat(input.customerCode)
      ? input.customerCode!.trim()
      : await allocateFreshCustomerCode();

    if (userSnap.exists()) {
      await updateDoc(userRef, {
        isBanned: Boolean(input.isBanned),
        ...(resolvedBanType ? { banType: resolvedBanType } : {}),
        ...(resolvedBanUntilIso ? { banUntilIso: resolvedBanUntilIso } : { banUntilIso: '' }),
        banReason: input.isBanned ? cleanReason : '',
        ...(!isValidCustomerCodeFormat(userSnap.data()?.customerCode)
          ? { customerCode: resolvedCode }
          : {}),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(userRef, {
        role: 'customer',
        name: cleanName,
        customerCode: resolvedCode,
        isBanned: Boolean(input.isBanned),
        ...(resolvedBanType ? { banType: resolvedBanType } : {}),
        ...(resolvedBanUntilIso ? { banUntilIso: resolvedBanUntilIso } : {}),
        banReason: input.isBanned ? cleanReason : '',
        points: 0,
        currentStreak: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await syncCustomerDirectoryEntry(targetUid, {
      name: cleanName,
      customerCode: resolvedCode,
      isBanned: Boolean(input.isBanned),
      banType: resolvedBanType,
      banUntilIso: resolvedBanUntilIso,
      banReason: input.isBanned ? cleanReason : '',
    });

    const blockRef = doc(db, 'blockedUsers', targetUid);
    const blockSnap = await getDoc(blockRef);
    if (blockSnap.exists()) {
      await updateDoc(blockRef, {
        targetName: cleanName,
        reason: cleanReason,
        isBlocked: Boolean(input.isBanned),
        blockedBy: adminUid,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(blockRef, {
        targetId: targetUid,
        targetType: 'customer',
        targetName: cleanName,
        reason: cleanReason,
        isBlocked: Boolean(input.isBanned),
        blockedBy: adminUid,
        updatedAt: serverTimestamp(),
      });
    }

    await addDoc(collection(db, 'notifications'), {
      recipientUid: targetUid,
      audience: 'specific_user',
      title: input.isBanned
        ? `تنبيه حالة الحساب: ${banLabelAr}`
        : 'تم إلغاء الحظر عن حسابك',
      body: input.isBanned
        ? `${cleanReason} — تواصل مع الدعم الفني عبر المحادثة المباشرة.`
        : 'تمت استعادة صلاحيات حسابك في إدكاوي ويمكنك الآن إتمام الطلبات بشكل طبيعي.',
      type: 'system',
      isRead: false,
      createdBy: adminUid,
      createdAt: serverTimestamp(),
    }).catch(() => {});

    void recordAuditLogInFirestore({
      adminId: adminUid,
      actionType: input.isBanned ? 'ban_customer' : 'unban_customer',
      targetId: targetUid,
      details: `${input.isBanned ? `${banLabelAr} للعميل` : 'إلغاء حظر العميل'} "${cleanName}" (${resolvedCode}) — ${cleanReason}`,
    });
  } catch (error) {
    logFirestoreFailure(
      'users',
      targetUid,
      'setCustomerBanStatusByAdminInFirestore',
      error
    );
    handleFirestoreError(error, OperationType.UPDATE, `users/${targetUid}`);
  }
}

export async function updateStoreDeliveryFeeByAdminInFirestore(
  adminUid: string,
  storeId: string,
  storeName: string,
  neighborhood: string,
  nextDeliveryFeeEgp: number
): Promise<void> {
  const cleanFee = Math.trunc(Number(nextDeliveryFeeEgp));
  if (!Number.isFinite(cleanFee) || cleanFee < 0 || cleanFee > 250) {
    throw new Error('سعر التوصيل يجب أن يكون بين 0 و 250 ج.م.');
  }

  await waitForFirestoreWarmup();
  try {
    await updateDoc(doc(db, 'stores', storeId), {
      deliveryFee: cleanFee,
    });
    void recordAuditLogInFirestore({
      adminId: adminUid,
      actionType: 'update_delivery_fee',
      targetId: storeId,
      details: `تعديل سعر التوصيل لمتجر "${storeName}" (منطقة ${neighborhood}) ليصبح ${cleanFee} ج.م.`,
    });
  } catch (error) {
    logFirestoreFailure(
      'stores',
      storeId,
      'updateStoreDeliveryFeeByAdmin',
      error
    );
    handleFirestoreError(error, OperationType.UPDATE, `stores/${storeId}`);
  }
}

export async function deleteProductByAdminOrStoreInFirestore(
  productId: string,
  productName: string,
  storeName?: string,
  isAdminAction = false
): Promise<void> {
  if (!isValidFirestoreId(productId)) {
    throw new Error('معرّف المنتج غير صالح.');
  }
  await waitForFirestoreWarmup();
  try {
    await deleteDoc(doc(db, 'products', productId));
    if (isAdminAction) {
      void recordAuditLogInFirestore({
        actionType: 'delete_product',
        targetId: productId,
        details: `حذف المنتج "${productName}"${storeName ? ` من متجر "${storeName}"` : ''}.`,
      });
    }
  } catch (error) {
    logFirestoreFailure(
      'products',
      productId,
      'deleteProductByAdminOrStore',
      error
    );
    handleFirestoreError(error, OperationType.DELETE, `products/${productId}`);
  }
}

export async function releaseOrderByCourierInFirestore(
  orderId: string,
  courierUid: string
): Promise<void> {
  if (!isValidFirestoreId(orderId) || !isValidFirestoreId(courierUid)) {
    throw new Error('بيانات الطلب أو المندوب غير صالحة.');
  }
  await waitForFirestoreWarmup();
  try {
    const orderRef = doc(db, 'orders', orderId);
    const ticketRef = doc(db, 'dispatchQueue', orderId);
    const courierRef = doc(db, 'couriers', courierUid);
    const courierDirRef = doc(db, 'courierDirectory', courierUid);

    const [orderSnap, courierSnap, courierDirSnap] = await Promise.all([
      getDocWithRetry(orderRef, 'orders', orderId),
      getDoc(courierRef).catch(() => null),
      getDoc(courierDirRef).catch(() => null),
    ]);

    if (!orderSnap.exists()) {
      throw new Error('الطلب غير موجود.');
    }
    const orderData = orderSnap.data() ?? {};
    const isErrand = orderData.orderType === 'custom_errand';
    const nextStatus = isErrand ? 'awaiting_courier_quote' : 'ready';

    const prevCancelled: string[] = Array.isArray(
      orderData.cancelledByCourierIds
    )
      ? (orderData.cancelledByCourierIds as unknown[]).filter(
          (x): x is string => typeof x === 'string' && isValidFirestoreId(x)
        )
      : [];
    const nextCancelledByCourierIds = [...prevCancelled, courierUid].slice(-20);

    const batch = writeBatch(db);
    batch.update(orderRef, {
      status: nextStatus,
      courierId: '',
      courierName: '',
      courierPhone: '',
      courierLocation: '',
      courierLat: EDKU_CITY_CENTER.lat,
      courierLng: EDKU_CITY_CENTER.lng,
      cancelledByCourierIds: nextCancelledByCourierIds,
      updatedAt: serverTimestamp(),
    });
    batch.update(ticketRef, {
      status: nextStatus,
      courierId: '',
      courierName: '',
      courierLat: EDKU_CITY_CENTER.lat,
      courierLng: EDKU_CITY_CENTER.lng,
      cancelledByCourierIds: nextCancelledByCourierIds,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    const prevCancelCount = Math.max(
      Number(courierSnap?.data()?.cancelledDeliveries ?? 0),
      Number(courierDirSnap?.data()?.cancelledDeliveries ?? 0)
    );
    const nextCancelCount = Math.trunc(prevCancelCount) + 1;

    if (courierSnap?.exists()) {
      await updateDoc(courierRef, {
        cancelledDeliveries: nextCancelCount,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }
    if (courierDirSnap?.exists()) {
      await updateDoc(courierDirRef, {
        cancelledDeliveries: nextCancelCount,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }
  } catch (error) {
    logFirestoreFailure(
      'orders',
      orderId,
      'releaseOrderByCourierInFirestore',
      error
    );
    handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
  }
}

export async function checkFirebaseConnectionHealth(): Promise<FirebaseConnectionHealthResult> {
  const startedAt = performance.now();
  try {
    await enableNetwork(db).catch(() => {});
    await getDocFromServer(doc(db, 'appConfig', 'system'));
    const latencyMs = Math.max(1, Math.round(performance.now() - startedAt));
    const responsivenessPercent =
      latencyMs <= 180
        ? 100
        : latencyMs <= 350
        ? 96
        : latencyMs <= 650
        ? 90
        : latencyMs <= 1200
        ? 80
        : Math.max(45, Math.round(100 - latencyMs / 40));
    const statusLabelAr =
      latencyMs <= 350
        ? 'متصل — استجابة ممتازة'
        : latencyMs <= 800
        ? 'متصل — استجابة جيدة'
        : 'متصل — استجابة بطيئة نسبياً';

    return {
      connected: true,
      latencyMs,
      responsivenessPercent,
      statusLabelAr,
      checkedAtIso: new Date().toISOString(),
    };
  } catch (error) {
    const latencyMs = Math.max(1, Math.round(performance.now() - startedAt));
    const rawMsg = error instanceof Error ? error.message : String(error);
    return {
      connected: false,
      latencyMs,
      responsivenessPercent: 0,
      statusLabelAr: 'غير متصل بقاعدة البيانات',
      checkedAtIso: new Date().toISOString(),
      errorDetail: rawMsg.slice(0, 180),
    };
  }
}

export async function runSimulateOrderCycleTestInFirestore(
  adminUid: string
): Promise<QaSimulationReport> {
  if (!adminUid || !isValidFirestoreId(adminUid)) {
    throw new Error('يلزم تسجيل الدخول بحساب مدير النظام لإجراء الاختبار.');
  }

  const overallStart = performance.now();
  const steps: QaSimulationStep[] = [];
  const simOrderId = `qa_sim_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
  const orderRef = doc(db, 'orders', simOrderId);
  const ticketRef = doc(db, 'dispatchQueue', simOrderId);

  try {
    await waitForFirestoreWarmup();

    // Step 1: Atomic Create of Order + DispatchTicket
    const step1Start = performance.now();
    const batchCreate = writeBatch(db);
    batchCreate.set(orderRef, {
      orderType: 'standard',
      isTestSimulation: true,
      customerId: adminUid,
      storeId: 'qa_test_store_edku',
      storeName: 'متجر اختبار الجودة (QA)',
      storeLat: EDKU_CITY_CENTER.lat,
      storeLng: EDKU_CITY_CENTER.lng,
      customerName: 'اختبار تلقائي — مركز الاختبارات',
      customerPhone: '01000000000',
      deliveryNeighborhood: 'شارع البحر',
      deliveryAddress: 'عنوان اختبار تلقائي — مدينة إدكو',
      customerLat: EDKU_CITY_CENTER.lat,
      customerLng: EDKU_CITY_CENTER.lng,
      items: [
        {
          productId: 'qa_item_1',
          name: 'وجبة اختبار دورة الطلبات',
          price: 100,
          quantity: 1,
        },
      ],
      itemsSummary: '١ × وجبة اختبار دورة الطلبات',
      itemNames: ['وجبة اختبار دورة الطلبات'],
      itemCount: 1,
      subtotal: 100,
      smallOrderFee: 0,
      deliveryFee: 20,
      totalAmount: 120,
      paymentMethod: 'cash',
      status: 'pending',
      notes: 'طلب اختبار آلي مؤقت (يتم حذفه تلقائياً)',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batchCreate.set(ticketRef, {
      orderId: simOrderId,
      orderType: 'standard',
      isTestSimulation: true,
      customerId: adminUid,
      storeId: 'qa_test_store_edku',
      storeName: 'متجر اختبار الجودة (QA)',
      storeNeighborhood: 'شارع البحر',
      storeLat: EDKU_CITY_CENTER.lat,
      storeLng: EDKU_CITY_CENTER.lng,
      deliveryNeighborhood: 'شارع البحر',
      customerLat: EDKU_CITY_CENTER.lat,
      customerLng: EDKU_CITY_CENTER.lng,
      itemsSummary: '١ × وجبة اختبار دورة الطلبات',
      subtotal: 100,
      smallOrderFee: 0,
      deliveryFee: 20,
      totalAmount: 120,
      paymentMethod: 'cash',
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batchCreate.commit();
    steps.push({
      stepNameAr: 'إنشاء الطلب الوهمي وقائمة التوجيه ذرياً',
      passed: true,
      durationMs: Math.max(1, Math.round(performance.now() - step1Start)),
      detailAr: `تمت كتابة الوثيقة (${simOrderId}) في orders و dispatchQueue بنجاح.`,
    });

    // Step 2: Verify Server Readback + Status Transition
    const step2Start = performance.now();
    const [verifyOrderSnap, verifyTicketSnap] = await Promise.all([
      getDocFromServer(orderRef),
      getDocFromServer(ticketRef),
    ]);
    if (!verifyOrderSnap.exists() || !verifyTicketSnap.exists()) {
      throw new Error('لم يتم العثور على الطلب التجريبي على الخادم بعد الإنشاء.');
    }

    const batchUpdate = writeBatch(db);
    batchUpdate.update(orderRef, {
      status: 'preparing',
      prepTimeMinutes: 15,
      updatedAt: serverTimestamp(),
    });
    batchUpdate.update(ticketRef, {
      status: 'preparing',
      prepTimeMinutes: 15,
      updatedAt: serverTimestamp(),
    });
    await batchUpdate.commit();

    steps.push({
      stepNameAr: 'التحقق من القراءة المباشرة وتحديث حالة الطلب',
      passed: true,
      durationMs: Math.max(1, Math.round(performance.now() - step2Start)),
      detailAr: 'تم التحقق من قراءة الخادم وتحديث الحالة إلى (قيد التحضير) بنجاح.',
    });

    // Step 3: Clean Teardown Deletion
    const step3Start = performance.now();
    const batchDelete = writeBatch(db);
    batchDelete.delete(orderRef);
    batchDelete.delete(ticketRef);
    await batchDelete.commit();

    steps.push({
      stepNameAr: 'حذف الطلب الوهمي وتنظيف قاعدة البيانات',
      passed: true,
      durationMs: Math.max(1, Math.round(performance.now() - step3Start)),
      detailAr: 'تم مسح الطلب الوهمي وتذكرة التوجيه بالكامل دون ترك أي أثر.',
    });

    const totalDurationMs = Math.max(
      1,
      Math.round(performance.now() - overallStart)
    );
    return {
      ok: true,
      simulatedOrderId: simOrderId,
      totalDurationMs,
      testedAtIso: new Date().toISOString(),
      summaryAr: `نجحت دورة الاختبار الكاملة (إنشاء ← تحقق وتحديث ← مسح) خلال ${totalDurationMs} مللي ثانية.`,
      steps,
    };
  } catch (error) {
    // Best-effort cleanup if failed mid-flight
    await deleteDoc(orderRef).catch(() => {});
    await deleteDoc(ticketRef).catch(() => {});

    const errMsg = error instanceof Error ? error.message : String(error);
    steps.push({
      stepNameAr: 'توقف أثناء دورة الاختبار',
      passed: false,
      durationMs: Math.max(1, Math.round(performance.now() - overallStart)),
      detailAr: errMsg.slice(0, 220),
    });

    return {
      ok: false,
      simulatedOrderId: simOrderId,
      totalDurationMs: Math.max(1, Math.round(performance.now() - overallStart)),
      testedAtIso: new Date().toISOString(),
      summaryAr: `تعذر إكمال اختبار الطلب الوهمي: ${errMsg.slice(0, 140)}`,
      steps,
    };
  }
}

export async function purgeAllQaAndTestDataInFirestore(
  adminUid: string
): Promise<number> {
  await waitForFirestoreWarmup();
  let deletedCount = await purgeDemoDataByAdminInFirestore();

  try {
    const q = query(
      collection(db, 'dispatchQueue'),
      where('status', 'in', [
        'awaiting_pharmacy_quote',
        'awaiting_customer_approval',
        'awaiting_courier_quote',
        'awaiting_customer_errand_approval',
        'pending',
        'preparing',
        'ready',
        'on_the_way',
        'delivering',
        'delivered',
        'cancelled',
      ])
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      const data = d.data();
      if (
        data?.isTestSimulation === true ||
        d.id.startsWith('qa_sim_') ||
        data?.storeId === 'qa_test_store_edku'
      ) {
        await deleteDoc(doc(db, 'orders', d.id)).catch(() => {});
        await deleteDoc(doc(db, 'dispatchQueue', d.id)).catch(() => {});
        deletedCount += 1;
      }
    }
  } catch (err) {
    logFirestoreFailure(
      'dispatchQueue',
      '*',
      'purgeAllQaAndTestDataInFirestore',
      err
    );
  }

  void recordAuditLogInFirestore({
    adminId: adminUid,
    actionType: 'purge_test_data',
    details: `تم تنفيذ أمر "مسح بيانات الاختبار" وتنظيف ${deletedCount} سجل اختباري.`,
  });

  return deletedCount;
}

/* ============================================================================
 * ZONAL PRICING (/edko_zones) — STRICTLY 5 APPROVED EDKU ZONES
 * ========================================================================== */

function parseEdkoZoneDoc(
  docSnap: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>
): EdkoZoneRecord | null {
  const idRaw = docSnap.id as EdkoZoneId;
  if (!APPROVED_EDKO_ZONE_IDS.includes(idRaw)) {
    return null;
  }
  const baseline =
    APPROVED_EDKO_ZONES.find((z) => z.id === idRaw) ?? APPROVED_EDKO_ZONES[0];
  const d = docSnap.data() ?? {};
  const rawNeighborhoods = Array.isArray(d.neighborhoods)
    ? d.neighborhoods.filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
    : baseline.streetsAndNeighborhoods;

  const cleanFee = Math.max(
    5,
    Math.min(250, Math.trunc(Number(d.price ?? baseline.deliveryFee)))
  );
  const zoneName =
    typeof d.name === 'string' && d.name.trim()
      ? d.name.trim()
      : baseline.name;

  return {
    id: idRaw,
    zoneNumber: Math.max(
      1,
      Math.min(5, Math.trunc(Number(d.sortOrder ?? baseline.zoneNumber)))
    ),
    name: zoneName,
    nameAr: zoneName,
    distanceRangeLabel:
      typeof d.distanceLabel === 'string' && d.distanceLabel.trim()
        ? d.distanceLabel.trim()
        : baseline.distanceRangeLabel,
    areaTitle:
      typeof d.description === 'string' && d.description.trim()
        ? d.description.trim()
        : baseline.areaTitle,
    streetsAndNeighborhoods:
      rawNeighborhoods.length > 0
        ? rawNeighborhoods
        : [...baseline.streetsAndNeighborhoods],
    deliveryFee: cleanFee,
    deliveryFeeEgp: cleanFee,
    isActive: typeof d.isActive === 'boolean' ? d.isActive : true,
    updatedBy: typeof d.updatedBy === 'string' ? d.updatedBy : undefined,
    updatedAtIso: d.updatedAt ? toIsoString(d.updatedAt) : undefined,
  };
}

export function seedAndListenToEdkoZones(
  onZonesUpdate: (zones: EdkoZoneRecord[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'edko_zones'),
    where('isActive', 'in', [true, false])
  );
  let seedAttempted = false;

  return onSnapshot(
    q,
    (snap) => {
      const byId = new Map<EdkoZoneId, EdkoZoneRecord>();
      for (const d of snap.docs) {
        const parsed = parseEdkoZoneDoc(d);
        if (parsed) {
          byId.set(parsed.id, parsed);
        }
      }

      // Auto-bootstrap any missing canonical approved zone when a non-anonymous user is active
      if (
        !seedAttempted &&
        byId.size < APPROVED_EDKO_ZONES.length &&
        auth.currentUser &&
        !auth.currentUser.isAnonymous
      ) {
        seedAttempted = true;
        void (async () => {
          for (const z of APPROVED_EDKO_ZONES) {
            if (!byId.has(z.id)) {
              try {
                const zRef = doc(db, 'edko_zones', z.id);
                const existing = await getDoc(zRef);
                if (!existing.exists()) {
                  await setDoc(zRef, {
                    id: z.id,
                    name: z.name,
                    distanceLabel: z.distanceRangeLabel,
                    price: z.deliveryFee,
                    neighborhoods: [...z.streetsAndNeighborhoods],
                    description: z.areaTitle,
                    sortOrder: z.zoneNumber,
                    isActive: true,
                    updatedBy: auth.currentUser?.uid ?? '',
                    updatedAt: serverTimestamp(),
                  });
                }
              } catch {
                // Non-fatal zone bootstrap
              }
            }
          }
        })();
      }

      const merged = APPROVED_EDKO_ZONES.map((base) => byId.get(base.id) ?? base);
      onZonesUpdate(merged);
    },
    () => {
      onZonesUpdate([...APPROVED_EDKO_ZONES]);
    }
  );
}

export async function updateEdkoZonePriceByAdminInFirestore(
  adminUid: string,
  zone: EdkoZoneRecord,
  nextPriceEgp: number,
  nextIsActive = true
): Promise<void> {
  if (!APPROVED_EDKO_ZONE_IDS.includes(zone.id)) {
    throw new Error('معرّف المنطقة غير معتمد في نظام تسعير إدكو.');
  }
  const cleanPrice = Math.trunc(Number(nextPriceEgp));
  if (!Number.isFinite(cleanPrice) || cleanPrice < 5 || cleanPrice > 250) {
    throw new Error('سعر توصيل المنطقة يجب أن يكون بين 5 و 250 ج.م.');
  }

  await waitForFirestoreWarmup();
  const zRef = doc(db, 'edko_zones', zone.id);
  const payload = {
    id: zone.id,
    name: zone.name.slice(0, 80),
    distanceLabel: zone.distanceRangeLabel.slice(0, 40),
    price: cleanPrice,
    neighborhoods: zone.streetsAndNeighborhoods.slice(0, 25),
    description: zone.areaTitle.slice(0, 220),
    sortOrder: Math.max(1, Math.min(5, Math.trunc(zone.zoneNumber))),
    isActive: Boolean(nextIsActive),
    updatedBy: adminUid,
    updatedAt: serverTimestamp(),
  };

  try {
    const existing = await getDoc(zRef);
    if (existing.exists()) {
      await updateDoc(zRef, payload);
    } else {
      await setDoc(zRef, payload);
    }
    void recordAuditLogInFirestore({
      adminId: adminUid,
      actionType: 'update_zone_price',
      targetId: zone.id,
      details: `تعديل تسعيرة التوصيل لـ "${zone.name}" (${zone.areaTitle}) لتصبح ${cleanPrice} ج.م.`,
    });
  } catch (error) {
    logFirestoreFailure(
      'edko_zones',
      zone.id,
      'updateEdkoZonePriceByAdminInFirestore',
      error
    );
    handleFirestoreError(error, OperationType.WRITE, `edko_zones/${zone.id}`);
  }
}

export { resolveZoneForNeighborhood };

/* ============================================================================
 * SUPER APP DYNAMIC CATEGORIES (/categories)
 * ========================================================================== */

function parseCategoryDoc(
  docSnap: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>
): SuperAppCategoryRecord {
  const d = docSnap.data() ?? {};
  const catName = String(d.name ?? 'قسم');
  return {
    id: String(d.id ?? docSnap.id),
    name: catName,
    titleAr: catName,
    storeCategory: (d.storeCategory as StoreCategory) ?? 'مشويات ومطاعم',
    icon: String(d.icon ?? 'Store'),
    isActive: d.isActive !== false,
    sortOrder: Math.max(0, Math.trunc(Number(d.sortOrder ?? 10))),
    defaultDeliveryFeeEgp: Math.max(0, Math.trunc(Number(d.defaultDeliveryFee ?? 15))),
    updatedAtIso: d.updatedAt ? toIsoString(d.updatedAt) : undefined,
  };
}

export function seedAndListenToSuperAppCategories(
  onCategoriesUpdate: (categories: SuperAppCategoryRecord[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'categories'),
    where('isActive', 'in', [true, false])
  );
  let seedAttempted = false;

  return onSnapshot(
    q,
    (snap) => {
      const byId = new Map<string, SuperAppCategoryRecord>();
      for (const d of snap.docs) {
        const parsed = parseCategoryDoc(d);
        byId.set(parsed.id, parsed);
      }

      if (
        !seedAttempted &&
        byId.size < DEFAULT_SUPER_APP_CATEGORIES.length &&
        auth.currentUser &&
        !auth.currentUser.isAnonymous
      ) {
        seedAttempted = true;
        void (async () => {
          for (const cat of DEFAULT_SUPER_APP_CATEGORIES) {
            if (!byId.has(cat.id)) {
              try {
                const cRef = doc(db, 'categories', cat.id);
                const existing = await getDoc(cRef);
                if (!existing.exists()) {
                  await setDoc(cRef, {
                    id: cat.id,
                    name: cat.name,
                    storeCategory: cat.storeCategory,
                    icon: cat.icon,
                    isActive: true,
                    sortOrder: cat.sortOrder,
                    updatedBy: auth.currentUser?.uid ?? '',
                    updatedAt: serverTimestamp(),
                  });
                }
              } catch {
                // Non-fatal category bootstrap
              }
            }
          }
        })();
      }

      for (const def of DEFAULT_SUPER_APP_CATEGORIES) {
        if (!byId.has(def.id)) {
          byId.set(def.id, def);
        }
      }

      const list = Array.from(byId.values()).sort(
        (a, b) => a.sortOrder - b.sortOrder
      );
      onCategoriesUpdate(list);
    },
    () => {
      onCategoriesUpdate([...DEFAULT_SUPER_APP_CATEGORIES]);
    }
  );
}

export async function upsertCategoryByAdminInFirestore(
  adminUid: string,
  input: {
    id: string;
    name: string;
    storeCategory: StoreCategory;
    icon: string;
    sortOrder: number;
    isActive: boolean;
  }
): Promise<void> {
  const cleanId = input.id
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 40);
  if (cleanId.length < 2) {
    throw new Error('يرجى إدخال معرّف قسم إنجليزي صحيح (حرفين على الأقل).');
  }
  const cleanName = input.name.trim().slice(0, 50);
  if (cleanName.length < 2) {
    throw new Error('يرجى إدخال اسم القسم بالعربية.');
  }

  await waitForFirestoreWarmup();
  const cRef = doc(db, 'categories', cleanId);
  const payload = {
    id: cleanId,
    name: cleanName,
    storeCategory: input.storeCategory,
    icon: (input.icon.trim() || 'Store').slice(0, 32),
    isActive: Boolean(input.isActive),
    sortOrder: Math.max(0, Math.min(500, Math.trunc(Number(input.sortOrder ?? 10)))),
    updatedBy: adminUid,
    updatedAt: serverTimestamp(),
  };

  try {
    const existing = await getDoc(cRef);
    if (existing.exists()) {
      await updateDoc(cRef, payload);
    } else {
      await setDoc(cRef, payload);
    }
    void recordAuditLogInFirestore({
      adminId: adminUid,
      actionType: 'manage_category',
      targetId: cleanId,
      details: `تحديث/إضافة القسم "${cleanName}" (${input.storeCategory}).`,
    });
  } catch (error) {
    logFirestoreFailure(
      'categories',
      cleanId,
      'upsertCategoryByAdminInFirestore',
      error
    );
    handleFirestoreError(error, OperationType.WRITE, `categories/${cleanId}`);
  }
}

export async function toggleCategoryActiveByAdminInFirestore(
  adminUid: string,
  category: SuperAppCategoryRecord,
  nextActive: boolean
): Promise<void> {
  await upsertCategoryByAdminInFirestore(adminUid, {
    id: category.id,
    name: category.name,
    storeCategory: category.storeCategory,
    icon: category.icon,
    sortOrder: category.sortOrder,
    isActive: nextActive,
  });
}

/* ============================================================================
 * MERCHANT AI MENU OCR SCANNER (/api/ocr-menu + Batch Firestore Save)
 * ========================================================================== */

export async function extractMenuItemsFromImageWithAi(
  imageDataUrl: string,
  storeCategory?: StoreCategory
): Promise<OcrExtractedMenuItem[]> {
  const res = await fetch('/api/ocr-menu', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageDataUrl,
      storeCategory: storeCategory ?? 'مشويات ومطاعم',
    }),
  });
  const data = (await res.json()) as MenuOcrApiResponse;
  if (!res.ok || !data.ok) {
    throw new Error(
      data.error || 'تعذر قراءة صورة المنيو بالذكاء الاصطناعي. جرّب صورة أوضح.'
    );
  }
  return (data.items ?? []).map((item, idx) => ({
    tempId: `ocr_${Date.now()}_${idx + 1}`,
    name: item.name.trim().slice(0, 80),
    price: Math.max(1, Math.min(20000, Math.trunc(Number(item.price || 50)))),
    category: (item.category?.trim() || 'أصناف المنيو').slice(0, 40),
    description: (item.description?.trim() || item.name.trim()).slice(0, 220),
    selected: true,
  }));
}

export async function addBatchProductsFromOcrInFirestore(
  store: StoreRecord,
  items: OcrExtractedMenuItem[],
  currentUserUid: string,
  fallbackImageUrl?: string
): Promise<number> {
  const selected = items.filter(
    (i) => i.selected && i.name.trim().length >= 2 && Number(i.price) > 0
  );
  if (selected.length === 0) {
    throw new Error('يرجى تحديد صنف واحد على الأقل لحفظه في منيو المتجر.');
  }

  await waitForFirestoreWarmup();
  const batch = writeBatch(db);
  const imageKey = resolveProductImageKeyForStoreCategory(store.category);
  const cleanImg = sanitizeOptionalImage(fallbackImageUrl || store.imageUrl);
  const effectiveOwnerId = store.ownerUid || store.createdBy || currentUserUid;

  for (const item of selected.slice(0, 50)) {
    const prodRef = doc(collection(db, 'products'));
    batch.set(prodRef, {
      storeId: store.id,
      ...(isValidFirestoreId(effectiveOwnerId)
        ? { storeOwnerId: effectiveOwnerId }
        : {}),
      name: item.name.trim().slice(0, 80),
      description: (
        item.description.trim() || `${item.name.trim()} من ${store.name}`
      ).slice(0, 220),
      category: (item.category.trim() || 'أصناف المنيو').slice(0, 40),
      price: Math.max(1, Math.min(20000, Math.trunc(Number(item.price)))),
      imageKey,
      ...(cleanImg ? { imageUrl: cleanImg } : {}),
      isAvailable: true,
      stockQuantity: 30,
      createdBy: currentUserUid,
      createdAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
    return Math.min(50, selected.length);
  } catch (error) {
    logFirestoreFailure(
      'products',
      store.id,
      'addBatchProductsFromOcrInFirestore',
      error
    );
    handleFirestoreError(error, OperationType.CREATE, 'products');
  }
}

/* ============================================================================
 * DAILY SPIN WHEEL (عجلة الحظ اليومية — مرة كل 24 ساعة في Firestore)
 * ========================================================================== */

export const DAILY_SPIN_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function getNextDailySpinAvailableMs(lastSpinDate?: string): number {
  if (!lastSpinDate) return 0;
  const parsed = Date.parse(lastSpinDate);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, parsed + DAILY_SPIN_COOLDOWN_MS - Date.now());
}

export async function spinDailyWheelInFirestore(
  customerUid: string,
  customerName: string
): Promise<DailySpinResult> {
  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    throw new Error('يرجى تسجيل الدخول بحسابك لتجربة عجلة الحظ اليومية.');
  }

  await waitForFirestoreWarmup();
  await assertSystemWritableForUser(customerUid, { checkMaintenance: true });

  const userRef = doc(db, 'users', customerUid);
  const dirRef = doc(db, 'customerDirectory', customerUid);
  const [userSnap, dirSnap] = await Promise.all([
    getDocWithRetry(userRef, 'users', customerUid),
    getDoc(dirRef).catch(() => null),
  ]);

  if (!userSnap.exists()) {
    throw new Error('يرجى استكمال بيانات حسابك أولاً.');
  }

  const uData = userSnap.data() ?? {};
  const dData = dirSnap?.data() ?? {};
  const existingLastSpin =
    typeof uData.lastSpinDate === 'string' ? uData.lastSpinDate : undefined;
  const remainingMs = getNextDailySpinAvailableMs(existingLastSpin);
  if (remainingMs > 0) {
    const hoursLeft = Math.max(1, Math.ceil(remainingMs / (60 * 60 * 1000)));
    throw new Error(
      `لقد استخدمت لفة الحظ اليومية بالفعل! تتجدد اللفة القادمة بعد حوالي ${hoursLeft} ساعة.`
    );
  }

  const currentPoints = Math.max(
    Math.trunc(Number(uData.points ?? 0)),
    Math.trunc(Number(dData.points ?? 0))
  );
  const currentRewards = Math.max(
    Math.trunc(Number(uData.freeDeliveryRewards ?? 0)),
    Math.trunc(Number(dData.freeDeliveryRewards ?? 0))
  );

  // Weighted real prizes: Loyalty Points, Single-Use Coupon, or Free Delivery
  const roll = Math.random();
  const nowIso = new Date().toISOString();

  if (roll < 0.45) {
    const bonusPts = roll < 0.25 ? 15 : 30;
    const nextPoints = currentPoints + bonusPts;
    await updateDoc(userRef, {
      points: nextPoints,
      lastSpinDate: nowIso,
      updatedAt: serverTimestamp(),
    });
    await syncCustomerDirectoryEntry(customerUid, {
      name: customerName,
      points: nextPoints,
    });
    return {
      rewardType: 'points',
      labelAr: `ربحت +${bonusPts} نقطة ولاء فورية!`,
      pointsAwarded: bonusPts,
      spunAtIso: nowIso,
    };
  }

  if (roll < 0.82) {
    const discountPercent = roll < 0.65 ? 15 : 20;
    const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
    const couponCode = `SPIN${discountPercent}-${suffix}`;
    await setDoc(doc(db, 'coupons', couponCode), {
      code: couponCode,
      discountPercent,
      maxDiscountEgp: 60,
      minOrderEgp: 50,
      description: `هدية عجلة الحظ اليومية (${discountPercent}% لمرة واحدة) للعميل ${customerName.slice(0, 25)}`,
      ownerUid: customerUid,
      pointsCost: 0,
      isUsed: false,
      isActive: true,
      createdBy: customerUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await updateDoc(userRef, {
      lastSpinDate: nowIso,
      updatedAt: serverTimestamp(),
    });
    return {
      rewardType: 'coupon',
      labelAr: `ربحت كوبون خصم ${discountPercent}% لمرة واحدة (${couponCode})!`,
      couponCode,
      discountPercent,
      spunAtIso: nowIso,
    };
  }

  const nextRewards = currentRewards + 1;
  await updateDoc(userRef, {
    freeDeliveryRewards: nextRewards,
    lastSpinDate: nowIso,
    updatedAt: serverTimestamp(),
  });
  await syncCustomerDirectoryEntry(customerUid, {
    name: customerName,
    freeDeliveryRewards: nextRewards,
  });
  return {
    rewardType: 'free_delivery',
    labelAr: 'مبروك! ربحت توصيل مجاني لطلبك القادم!',
    freeDeliveryAwarded: true,
    spunAtIso: nowIso,
  };
}

/* ============================================================================
 * COURIER SMART REJECT & POST-DELIVERY COURIER TIPPING
 * ========================================================================== */

export async function rejectOrderByCourierInFirestore(
  orderId: string,
  courierUid: string
): Promise<void> {
  if (!isValidFirestoreId(orderId) || !isValidFirestoreId(courierUid)) {
    throw new Error('بيانات الطلب أو الكابتن غير صالحة.');
  }

  const orderRef = doc(db, 'orders', orderId);
  const ticketRef = doc(db, 'dispatchQueue', orderId);

  try {
    await waitForFirestoreWarmup();
    await assertSystemWritableForUser(courierUid);
    await assertCourierApprovedForWrite(courierUid);

    const rejectableStatuses = new Set([
      'awaiting_courier_quote',
      'pending',
      'preparing',
      'ready',
    ]);

    await runWriteWithNetworkRetry(async () =>
      runTransaction(db, async (tx) => {
        const ticketSnap = await tx.get(ticketRef);
        if (!ticketSnap.exists()) {
          return;
        }

        const ticketData = ticketSnap.data() ?? {};
        const ticketStatus = String(ticketData.status ?? '');
        const ticketCourierId = String(ticketData.courierId ?? '').trim();

        // If another courier already claimed it or the order progressed/cancelled, skip cleanly.
        if (
          !rejectableStatuses.has(ticketStatus) ||
          (ticketCourierId && ticketCourierId !== courierUid)
        ) {
          return;
        }

        const prevTicketRejected: string[] = Array.isArray(
          ticketData.rejectedBy
        )
          ? (ticketData.rejectedBy as unknown[]).filter(
              (x): x is string => typeof x === 'string' && isValidFirestoreId(x)
            )
          : [];

        const orderSnap = await tx.get(orderRef);
        const orderData = orderSnap.exists() ? (orderSnap.data() ?? {}) : null;
        const orderStatus = String(orderData?.status ?? '');
        const orderCourierId = String(orderData?.courierId ?? '').trim();
        const canUpdateOrder =
          Boolean(orderData) &&
          rejectableStatuses.has(orderStatus) &&
          (!orderCourierId || orderCourierId === courierUid);

        const prevOrderRejected: string[] =
          orderData && Array.isArray(orderData.rejectedBy)
            ? (orderData.rejectedBy as unknown[]).filter(
                (x): x is string =>
                  typeof x === 'string' && isValidFirestoreId(x)
              )
            : [];

        if (!prevTicketRejected.includes(courierUid)) {
          const nextTicketRejected = Array.from(
            new Set([...prevTicketRejected, courierUid])
          ).slice(-30);
          tx.update(ticketRef, {
            rejectedBy: nextTicketRejected,
            updatedAt: serverTimestamp(),
          });
        }

        if (canUpdateOrder && !prevOrderRejected.includes(courierUid)) {
          const nextOrderRejected = Array.from(
            new Set([...prevOrderRejected, courierUid])
          ).slice(-30);
          tx.update(orderRef, {
            rejectedBy: nextOrderRejected,
            updatedAt: serverTimestamp(),
          });
        }
      })
    );
  } catch (error) {
    if (isArabicBusinessError(error)) {
      throw error;
    }
    logFirestoreFailure(
      'dispatchQueue',
      orderId,
      'rejectOrderByCourierInFirestore',
      error
    );
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `dispatchQueue/${orderId}`
    );
  }
}

export async function tipCourierForDeliveredOrderInFirestore(
  order: OrderRecord,
  tipAmountEgp: 5 | 10 | 15
): Promise<void> {
  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    throw new Error('يرجى تسجيل الدخول لإرسال إكرامية للكابتن.');
  }
  if (![5, 10, 15].includes(tipAmountEgp)) {
    throw new Error('قيمة الإكرامية المعتمدة هي 5 أو 10 أو 15 ج.م.');
  }
  if (order.status !== 'delivered') {
    throw new Error('يمكن إرسال إكرامية للكابتن بعد اكتمال توصيل الطلب.');
  }
  if (order.isTipped) {
    throw new Error('تم إرسال إكرامية الكابتن لهذا الطلب بالفعل — شكراً لكرمك!');
  }

  await waitForFirestoreWarmup();
  const orderRef = doc(db, 'orders', order.id);

  try {
    await updateDoc(orderRef, {
      tipAmountEgp,
      isTipped: true,
      updatedAt: serverTimestamp(),
    });

    if (order.courierId && isValidFirestoreId(order.courierId)) {
      const dirRef = doc(db, 'courierDirectory', order.courierId);
      const dirSnap = await getDoc(dirRef).catch(() => null);
      if (dirSnap?.exists()) {
        const prevWallet = Math.max(
          0,
          Math.trunc(Number(dirSnap.data()?.walletBalance ?? 0))
        );
        const prevTips = Math.max(
          0,
          Math.trunc(Number(dirSnap.data()?.totalTipsEgp ?? 0))
        );
        await updateDoc(dirRef, {
          walletBalance: prevWallet + tipAmountEgp,
          totalTipsEgp: prevTips + tipAmountEgp,
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }

      void createNotificationBestEffort(order.courierId, {
        title: `إكرامية جديدة +${tipAmountEgp} ج.م في محفظتك!`,
        body: `أرسل لك العميل ${order.customerName} إكرامية تقديراً لتوصيلك السريع من ${order.storeName}.`,
        type: 'order_update',
        orderId: order.id,
      });
    }
  } catch (error) {
    logFirestoreFailure(
      'orders',
      order.id,
      'tipCourierForDeliveredOrderInFirestore',
      error
    );
    handleFirestoreError(error, OperationType.UPDATE, `orders/${order.id}`);
  }
}

/* ============================================================================
 * LIVE GROUP ORDER ROOMS (/group_sessions/{sessionId} + /cart + /chat)
 * ========================================================================== */

function parseGroupSessionDoc(
  docSnap: DocumentSnapshot<DocumentData>
): GroupSessionRecord | null {
  if (!docSnap.exists()) return null;
  const d = docSnap.data() ?? {};
  const participantUids = Array.isArray(d.participants)
    ? (d.participants as unknown[])
        .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
        .slice(0, 25)
    : [];
  const namesMap =
    typeof d.participantNames === 'object' && d.participantNames !== null
      ? (d.participantNames as Record<string, unknown>)
      : {};
  const createdAtIso = toIsoString(d.createdAt);

  const participants: GroupSessionParticipant[] = participantUids.map((uid) => ({
    uid,
    name:
      typeof namesMap[uid] === 'string' && String(namesMap[uid]).trim()
        ? String(namesMap[uid]).trim()
        : uid === d.hostUid
        ? String(d.hostName ?? 'صاحب الغرفة')
        : 'مشارك',
    joinedAtIso: createdAtIso,
  }));

  return {
    id: docSnap.id,
    hostUid: String(d.hostUid ?? ''),
    hostName: String(d.hostName ?? 'صاحب الغرفة'),
    storeId: String(d.storeId ?? ''),
    storeName: String(d.storeName ?? ''),
    zoneDeliveryFee: Math.max(0, Math.trunc(Number(d.storeDeliveryFee ?? 15))),
    status:
      d.status === 'checked_out' || d.status === 'cancelled' ? d.status : 'open',
    participantUids,
    participants,
    createdAtIso,
    updatedAtIso: toIsoString(d.updatedAt),
  };
}

export async function createGroupOrderSessionInFirestore(
  hostUid: string,
  hostName: string,
  store: StoreRecord
): Promise<string> {
  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    throw new Error('يرجى تسجيل الدخول بحسابك أولاً لفتح غرفة طلب جماعي.');
  }
  await waitForFirestoreWarmup();
  await assertSystemWritableForUser(hostUid, {
    storeId: store.id,
    checkMaintenance: true,
  });

  const cleanHostName = (hostName.trim() || 'عميل إدكاوي').slice(0, 80);
  const sessionRef = doc(collection(db, 'group_sessions'));
  try {
    await setDoc(sessionRef, {
      hostUid,
      hostName: cleanHostName,
      storeId: store.id,
      storeName: store.name.slice(0, 100),
      storeDeliveryFee: Math.max(0, Math.trunc(store.deliveryFee || 15)),
      status: 'open',
      participants: [hostUid],
      participantNames: { [hostUid]: cleanHostName },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return sessionRef.id;
  } catch (error) {
    logFirestoreFailure(
      'group_sessions',
      sessionRef.id,
      'createGroupOrderSessionInFirestore',
      error
    );
    handleFirestoreError(error, OperationType.CREATE, 'group_sessions');
  }
}

export async function joinGroupOrderSessionInFirestore(
  sessionId: string,
  participantUid: string,
  participantName: string
): Promise<void> {
  if (
    !auth.currentUser ||
    auth.currentUser.isAnonymous ||
    !isValidFirestoreId(sessionId)
  ) {
    return;
  }
  await waitForFirestoreWarmup();
  const sessionRef = doc(db, 'group_sessions', sessionId);
  const snap = await getDocWithRetry(sessionRef, 'group_sessions', sessionId);
  if (!snap.exists()) {
    throw new Error('غرفة الطلب الجماعي غير موجودة.');
  }
  const d = snap.data() ?? {};
  if (d.status !== 'open') {
    return;
  }

  const prevUids = Array.isArray(d.participants)
    ? (d.participants as unknown[]).filter(
        (u): u is string => typeof u === 'string' && isValidFirestoreId(u)
      )
    : [];
  const prevNames =
    typeof d.participantNames === 'object' && d.participantNames !== null
      ? { ...(d.participantNames as Record<string, string>) }
      : {};
  const cleanName = (participantName.trim() || 'صديق في الغرفة').slice(0, 80);

  if (prevUids.includes(participantUid) && prevNames[participantUid] === cleanName) {
    return;
  }
  const nextUids = Array.from(new Set([...prevUids, participantUid])).slice(
    0,
    25
  );
  prevNames[participantUid] = cleanName;

  await updateDoc(sessionRef, {
    participants: nextUids,
    participantNames: prevNames,
    updatedAt: serverTimestamp(),
  });
}

export function listenToGroupOrderSession(
  sessionId: string,
  onData: (session: GroupSessionRecord | null) => void
): Unsubscribe {
  if (!sessionId || !isValidFirestoreId(sessionId)) {
    onData(null);
    return () => {};
  }
  return onSnapshot(
    doc(db, 'group_sessions', sessionId),
    (snap) => {
      onData(parseGroupSessionDoc(snap));
    },
    () => onData(null)
  );
}

export function listenToGroupSessionCart(
  sessionId: string,
  onItems: (items: GroupSessionCartItem[]) => void
): Unsubscribe {
  if (!sessionId || !isValidFirestoreId(sessionId)) {
    onItems([]);
    return () => {};
  }
  const q = query(
    collection(db, 'group_sessions', sessionId, 'cart'),
    where('sessionId', '==', sessionId)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: GroupSessionCartItem[] = snap.docs.map((d) => {
        const data = d.data() ?? {};
        const tsIso = toIsoString(data.updatedAt);
        return {
          id: d.id,
          sessionId: String(data.sessionId ?? sessionId),
          participantUid: String(data.participantUid ?? ''),
          participantName: String(data.participantName ?? 'مشارك'),
          productId: String(data.productId ?? ''),
          name: String(data.name ?? 'صنف'),
          ...(typeof data.variantId === 'string' && data.variantId
            ? { variantId: data.variantId }
            : {}),
          ...(typeof data.variantLabel === 'string' && data.variantLabel
            ? { variantLabel: data.variantLabel }
            : {}),
          price: Math.max(1, Math.trunc(Number(data.price ?? 1))),
          quantity: Math.max(1, Math.trunc(Number(data.quantity ?? 1))),
          createdAtIso: tsIso,
          updatedAtIso: tsIso,
        };
      });
      items.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      onItems(items);
    },
    () => onItems([])
  );
}

export async function upsertGroupSessionCartItemInFirestore(
  sessionId: string,
  participantUid: string,
  participantName: string,
  product: {
    id: string;
    name: string;
    price: number;
    selectedVariant?: ProductVariant;
  },
  delta: number
): Promise<void> {
  if (!isValidFirestoreId(sessionId) || !isValidFirestoreId(participantUid)) {
    return;
  }
  await waitForFirestoreWarmup();
  await joinGroupOrderSessionInFirestore(
    sessionId,
    participantUid,
    participantName
  );

  const compositeProdKey = buildCartItemId(
    product.id,
    product.selectedVariant?.variantId
  ).replace(/[^a-zA-Z0-9_-]/g, '_');
  const itemId = `${participantUid}_${compositeProdKey}`.slice(0, 120);
  const itemRef = doc(db, 'group_sessions', sessionId, 'cart', itemId);
  const existing = await getDoc(itemRef).catch(() => null);
  const cleanName = (participantName.trim() || 'مشارك').slice(0, 80);
  const effectivePrice = Math.max(
    1,
    Math.trunc(Number(product.selectedVariant?.price ?? product.price))
  );

  if (existing?.exists()) {
    const prevQty = Math.max(1, Math.trunc(Number(existing.data()?.quantity ?? 1)));
    const nextQty = prevQty + delta;
    if (nextQty <= 0) {
      await deleteDoc(itemRef);
    } else {
      await updateDoc(itemRef, {
        quantity: Math.min(50, nextQty),
        price: effectivePrice,
        participantName: cleanName,
        updatedAt: serverTimestamp(),
      });
    }
  } else if (delta > 0) {
    const variantLabel = product.selectedVariant
      ? [
          product.selectedVariant.name,
          product.selectedVariant.size,
          product.selectedVariant.color,
          product.selectedVariant.shade,
        ]
          .filter(Boolean)
          .filter((v, idx, arr) => arr.indexOf(v) === idx)
          .join(' · ')
          .slice(0, 80)
      : undefined;

    await setDoc(itemRef, {
      entryId: itemId,
      sessionId,
      participantUid,
      participantName: cleanName,
      productId: product.id.slice(0, 128),
      ...(product.selectedVariant?.variantId
        ? { variantId: product.selectedVariant.variantId.slice(0, 64) }
        : {}),
      ...(variantLabel ? { variantLabel } : {}),
      name: product.name.slice(0, 100),
      price: effectivePrice,
      quantity: Math.min(50, delta),
      updatedAt: serverTimestamp(),
    });
  }
}

export async function removeGroupSessionCartItemInFirestore(
  sessionId: string,
  itemId: string
): Promise<void> {
  if (!isValidFirestoreId(sessionId) || !isValidFirestoreId(itemId)) return;
  await deleteDoc(doc(db, 'group_sessions', sessionId, 'cart', itemId));
}

export function listenToGroupSessionChat(
  sessionId: string,
  onMessages: (messages: GroupSessionChatMessage[]) => void
): Unsubscribe {
  if (!sessionId || !isValidFirestoreId(sessionId)) {
    onMessages([]);
    return () => {};
  }
  const q = query(
    collection(db, 'group_sessions', sessionId, 'chat'),
    where('sessionId', '==', sessionId)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: GroupSessionChatMessage[] = snap.docs
        .map((d) => {
          const data = d.data() ?? {};
          return {
            id: d.id,
            sessionId: String(data.sessionId ?? sessionId),
            senderUid: String(data.senderUid ?? ''),
            senderName: String(data.senderName ?? 'مشارك'),
            text: String(data.text ?? ''),
            createdAtIso: toIsoString(data.createdAt),
          };
        })
        .sort((a, b) => a.createdAtIso.localeCompare(b.createdAtIso));
      onMessages(list);
    },
    () => onMessages([])
  );
}

export async function sendGroupSessionChatMessageInFirestore(
  sessionId: string,
  senderUid: string,
  senderName: string,
  text: string
): Promise<void> {
  const cleanText = text.trim().slice(0, 400);
  if (!cleanText || !isValidFirestoreId(sessionId)) return;
  await waitForFirestoreWarmup();
  await joinGroupOrderSessionInFirestore(sessionId, senderUid, senderName);
  await addDoc(collection(db, 'group_sessions', sessionId, 'chat'), {
    sessionId,
    senderUid,
    senderName: (senderName.trim() || 'مشارك').slice(0, 80),
    text: cleanText,
    createdAt: serverTimestamp(),
  });
}

export async function closeGroupOrderSessionInFirestore(
  sessionId: string,
  nextStatus: 'checked_out' | 'cancelled' = 'checked_out'
): Promise<void> {
  if (!sessionId || !isValidFirestoreId(sessionId)) return;
  try {
    await updateDoc(doc(db, 'group_sessions', sessionId), {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal
  }
}

/* ============================================================================
 * INVITATION MANAGEMENT SYSTEM, SALES AGENT CRM, 24H ESCROW & PAYOUT WALLET
 * ========================================================================== */

const PENDING_REF_STORAGE_KEY = 'edkawy_pending_ref_code';
const INVITE_VALIDITY_DURATION_MS = 48 * 60 * 60 * 1000;
const COMMISSION_ESCROW_DURATION_MS = 24 * 60 * 60 * 1000;

export function savePendingSessionReferralCode(code: string): void {
  if (typeof window === 'undefined') return;
  const clean = code.trim().toUpperCase();
  if (!REFERRAL_CODE_REGEX.test(clean)) return;
  try {
    window.sessionStorage.setItem(PENDING_REF_STORAGE_KEY, clean);
  } catch {
    // Ignore storage errors
  }
}

export function readPendingSessionReferralCode(): string {
  if (typeof window === 'undefined') return '';
  try {
    const val = window.sessionStorage.getItem(PENDING_REF_STORAGE_KEY) ?? '';
    return REFERRAL_CODE_REGEX.test(val.trim().toUpperCase())
      ? val.trim().toUpperCase()
      : '';
  } catch {
    return '';
  }
}

export function clearPendingSessionReferralCode(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(PENDING_REF_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

function generateSecureInvitationToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '') + Date.now().toString(36);
  }
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 28; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `${out}_${Date.now().toString(36)}`;
}

function maskEmailForIndex(rawEmail: string): string {
  const clean = rawEmail.trim().toLowerCase();
  const [localPart, domainPart] = clean.split('@');
  if (!localPart || !domainPart) return clean.slice(0, 80) || '***';
  const visiblePrefix = localPart.slice(0, Math.min(2, localPart.length));
  return `${visiblePrefix}***@${domainPart}`.slice(0, 100);
}

const DEFAULT_PUBLIC_APP_ORIGIN =
  'https://ais-pre-eankapwjyahdkgb2dgpirq-768850777108.europe-west2.run.app';

export function resolvePublicAppOrigin(): string {
  const envUrl =
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    typeof import.meta.env.VITE_PUBLIC_APP_URL === 'string'
      ? import.meta.env.VITE_PUBLIC_APP_URL.trim().replace(/\/+$/, '')
      : '';
  if (/^https?:\/\//i.test(envUrl)) {
    try {
      const parsedEnv = new URL(envUrl);
      if (parsedEnv.hostname.startsWith('ais-dev-')) {
        parsedEnv.hostname = parsedEnv.hostname.replace(/^ais-dev-/, 'ais-pre-');
        return parsedEnv.origin.replace(/\/+$/, '');
      }
      if (parsedEnv.hostname !== 'localhost' && parsedEnv.hostname !== '127.0.0.1') {
        return parsedEnv.origin.replace(/\/+$/, '');
      }
    } catch {
      // ignore invalid VITE_PUBLIC_APP_URL
    }
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    try {
      const parsed = new URL(window.location.origin);
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        return DEFAULT_PUBLIC_APP_ORIGIN;
      }
      if (parsed.hostname.startsWith('ais-dev-')) {
        parsed.hostname = parsed.hostname.replace(/^ais-dev-/, 'ais-pre-');
        return parsed.origin.replace(/\/+$/, '');
      }
      return parsed.origin.replace(/\/+$/, '');
    } catch {
      return DEFAULT_PUBLIC_APP_ORIGIN;
    }
  }

  return DEFAULT_PUBLIC_APP_ORIGIN;
}

export function buildInvitationRegistrationUrl(
  token: string,
  userType: InvitationUserType,
  referralCode?: string
): string {
  const origin = resolvePublicAppOrigin();
  const url = new URL('/', origin);
  url.searchParams.set('token', token);
  url.searchParams.set('type', userType);
  if (referralCode && referralCode.trim()) {
    url.searchParams.set('ref', referralCode.trim().toUpperCase());
  }
  return url.toString();
}

export function buildSalesAgentReferralUrl(referralCode: string): string {
  const origin = resolvePublicAppOrigin();
  const clean = referralCode.trim().toUpperCase();
  const url = new URL('/', origin);
  url.searchParams.set('ref', clean);
  return url.toString();
}

function parseInvitationDoc(
  snap: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>,
  fallbackEmail?: string
): InvitationRecord {
  const d = snap.data() ?? {};
  const rawType = String(d.userType ?? 'customer');
  const userType: InvitationUserType =
    rawType === 'store' ||
    rawType === 'courier' ||
    rawType === 'sales_agent' ||
    rawType === 'customer'
      ? rawType
      : 'customer';

  const expiresAtMs = Math.max(0, Math.trunc(Number(d.expiresAtMs ?? 0)));
  const rawStatus = String(d.status ?? 'pending');
  let status: InvitationStatus =
    rawStatus === 'accepted' || rawStatus === 'expired' ? rawStatus : 'pending';
  if (status === 'pending' && expiresAtMs > 0 && Date.now() > expiresAtMs) {
    status = 'expired';
  }

  return {
    id: String(d.id ?? snap.id),
    email: String(d.email ?? fallbackEmail ?? d.maskedEmail ?? ''),
    userType,
    token: String(d.token ?? snap.id),
    status,
    createdAtIso: toIsoString(d.createdAt),
    expiresAtIso:
      typeof d.expiresAtIso === 'string' && d.expiresAtIso.trim()
        ? d.expiresAtIso
        : expiresAtMs > 0
        ? new Date(expiresAtMs).toISOString()
        : new Date().toISOString(),
    expiresAtMs,
    invitedBy: String(d.invitedBy ?? ''),
    invitedByName:
      typeof d.invitedByName === 'string' ? d.invitedByName : undefined,
    invitedByRole:
      d.invitedByRole === 'admin' || d.invitedByRole === 'sales_agent'
        ? d.invitedByRole
        : undefined,
    agentId: typeof d.agentId === 'string' ? d.agentId : undefined,
    referralCode:
      typeof d.referralCode === 'string' ? d.referralCode : undefined,
    acceptedByUid:
      typeof d.acceptedByUid === 'string' ? d.acceptedByUid : undefined,
    acceptedAtIso:
      typeof d.acceptedAtIso === 'string' ? d.acceptedAtIso : undefined,
  };
}

async function sendInvitationEmailViaServer(params: {
  email: string;
  userType: InvitationUserType;
  token: string;
  invitedByName?: string;
  referralCode?: string;
}): Promise<InvitationEmailApiResponse> {
  const publicOrigin = resolvePublicAppOrigin();
  try {
    const res = await fetch('/api/invitations/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        inviterName: params.invitedByName,
        origin: publicOrigin,
      }),
    });
    const data = (await res.json()) as InvitationEmailApiResponse;
    return {
      ok: Boolean(data.ok),
      sentViaSmtp: Boolean(data.sentViaSmtp),
      inviteUrl:
        data.inviteUrl ||
        buildInvitationRegistrationUrl(
          params.token,
          params.userType,
          params.referralCode
        ),
      smtpError: data.smtpError,
      error: data.error,
    };
  } catch {
    return {
      ok: true,
      sentViaSmtp: false,
      inviteUrl: buildInvitationRegistrationUrl(
        params.token,
        params.userType,
        params.referralCode
      ),
    };
  }
}

export async function createInvitationInFirestore(
  input: CreateInvitationInput,
  senderContext: {
    uid: string;
    name: string;
    role: 'admin' | 'sales_agent';
    referralCode?: string;
  }
): Promise<{
  invitation: InvitationRecord;
  emailDelivery: InvitationEmailApiResponse;
}> {
  const cleanEmail = input.email.trim().toLowerCase();
  if (
    cleanEmail.length < 5 ||
    cleanEmail.length > 100 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
  ) {
    throw new Error('يرجى إدخال عنوان بريد إلكتروني صحيح لإرسال الدعوة.');
  }
  if (
    cleanEmail === OFFICIAL_ADMIN_PORTAL_EMAIL ||
    cleanEmail.endsWith('@adkawy.com')
  ) {
    throw new Error('لا يمكن إرسال دعوة خارجية لهذا البريد الإلكتروني.');
  }
  if (
    senderContext.role === 'sales_agent' &&
    input.userType === 'sales_agent'
  ) {
    throw new Error('إرسال دعوات مسؤولي المبيعات متاح للإدارة المركزية فقط.');
  }

  await waitForFirestoreWarmup();
  const emailHash = await computeEmailSha256Hex(cleanEmail);

  // 1. Check if email already has an active registered account
  const existingRegSnap = await getDoc(
    doc(db, 'registeredAccounts', emailHash)
  ).catch(() => null);
  if (existingRegSnap?.exists()) {
    throw new Error(
      'هذا البريد الإلكتروني مسجل بالفعل في منصة إدكاوي ولا يحتاج إلى دعوة جديدة.'
    );
  }

  // 2. Check duplicate active pending invitation lock
  const lockRef = doc(db, 'invitationLocks', emailHash);
  const existingLockSnap = await getDoc(lockRef).catch(() => null);
  if (existingLockSnap?.exists()) {
    const lockData = existingLockSnap.data() ?? {};
    const lockStatus = String(lockData.status ?? '');
    const lockExpiresMs = Number(lockData.expiresAtMs ?? 0);
    if (lockStatus === 'accepted') {
      throw new Error('تم قبول دعوة سابقة لهذا البريد الإلكتروني بالفعل.');
    }
    if (lockStatus === 'pending' && lockExpiresMs > Date.now()) {
      throw new Error(
        'توجد دعوة نشطة بالفعل لهذا البريد الإلكتروني لم تنتهِ صلاحيتها بعد. يمكنك إعادة إرسالها من جدول الدعوات.'
      );
    }
  }

  const token = generateSecureInvitationToken();
  const expiresAtMs = Date.now() + INVITE_VALIDITY_DURATION_MS;
  const expiresAtIso = new Date(expiresAtMs).toISOString();
  const cleanSenderName = (senderContext.name.trim() || 'إدارة إدكاوي').slice(
    0,
    80
  );
  const cleanReferralCode = senderContext.referralCode
    ?.trim()
    .toUpperCase()
    .slice(0, 24);

  const invRef = doc(db, 'invitations', token);
  const invIdxRef = doc(db, 'invitationIndex', token);

  try {
    await runWriteWithNetworkRetry(async () => {
      const batch = writeBatch(db);
      batch.set(invRef, {
        id: token,
        email: cleanEmail,
        userType: input.userType,
        token,
        status: 'pending',
        expiresAtMs,
        expiresAtIso,
        invitedBy: senderContext.uid,
        invitedByName: cleanSenderName,
        invitedByRole: senderContext.role,
        ...(senderContext.role === 'sales_agent'
          ? { agentId: senderContext.uid }
          : {}),
        ...(cleanReferralCode ? { referralCode: cleanReferralCode } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(invIdxRef, {
        token,
        maskedEmail: maskEmailForIndex(cleanEmail),
        userType: input.userType,
        status: 'pending',
        expiresAtMs,
        expiresAtIso,
        invitedBy: senderContext.uid,
        invitedByName: cleanSenderName,
        invitedByRole: senderContext.role,
        ...(cleanReferralCode ? { referralCode: cleanReferralCode } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(lockRef, {
        token,
        status: 'pending',
        expiresAtMs,
        invitedBy: senderContext.uid,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    });

    const emailDelivery = await sendInvitationEmailViaServer({
      email: cleanEmail,
      userType: input.userType,
      token,
      invitedByName: cleanSenderName,
      referralCode: cleanReferralCode,
    });

    if (senderContext.role === 'admin') {
      void recordAuditLogInFirestore({
        actionType: 'send_invitation',
        targetId: token,
        details: `إرسال دعوة (${input.userType}) إلى ${cleanEmail}`,
      });
    }

    const nowIso = new Date().toISOString();
    return {
      invitation: {
        id: token,
        email: cleanEmail,
        userType: input.userType,
        token,
        status: 'pending',
        createdAtIso: nowIso,
        expiresAtIso,
        expiresAtMs,
        invitedBy: senderContext.uid,
        invitedByName: cleanSenderName,
        invitedByRole: senderContext.role,
        agentId:
          senderContext.role === 'sales_agent' ? senderContext.uid : undefined,
        referralCode: cleanReferralCode || undefined,
      },
      emailDelivery,
    };
  } catch (error) {
    if (isArabicBusinessError(error)) throw error;
    logFirestoreFailure('invitations', token, 'createInvitation', error);
    handleFirestoreError(error, OperationType.CREATE, `invitations/${token}`);
  }
}

export async function validateInvitationTokenInFirestore(
  rawToken: string
): Promise<{
  valid: boolean;
  reason?: string;
  invitation?: InvitationRecord;
}> {
  const token = rawToken.trim();
  if (!isValidFirestoreId(token) || token.length < 16) {
    return { valid: false, reason: 'الدعوة غير صالحة أو منتهية.' };
  }
  await waitForFirestoreWarmup();
  try {
    const snap = await getDocWithRetry(
      doc(db, 'invitations', token),
      'invitations',
      token
    );
    if (!snap.exists()) {
      return { valid: false, reason: 'الدعوة غير صالحة أو منتهية.' };
    }
    const invitation = parseInvitationDoc(snap);
    if (invitation.status === 'accepted') {
      return {
        valid: false,
        reason: 'تم استخدام رابط الدعوة مسبقاً. يمكنك تسجيل الدخول بحسابك مباشرة.',
        invitation,
      };
    }
    if (invitation.status === 'expired' || Date.now() > invitation.expiresAtMs) {
      return {
        valid: false,
        reason: 'انتهت صلاحية رابط الدعوة (٤٨ ساعة). يرجى طلب إعادة إرسال الدعوة.',
        invitation,
      };
    }
    return { valid: true, invitation };
  } catch {
    return { valid: false, reason: 'الدعوة غير صالحة أو منتهية.' };
  }
}

export async function resendInvitationEmailInFirestore(
  invitation: InvitationRecord,
  isAdminAction = false
): Promise<InvitationEmailApiResponse> {
  if (invitation.status === 'accepted') {
    throw new Error('تم قبول هذه الدعوة بالفعل ولا يمكن إعادة إرسالها.');
  }
  await waitForFirestoreWarmup();
  const nextExpiresAtMs = Date.now() + INVITE_VALIDITY_DURATION_MS;
  const nextExpiresAtIso = new Date(nextExpiresAtMs).toISOString();
  const emailHash = await computeEmailSha256Hex(invitation.email);

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'invitations', invitation.token), {
      status: 'pending',
      expiresAtMs: nextExpiresAtMs,
      expiresAtIso: nextExpiresAtIso,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'invitationIndex', invitation.token), {
      status: 'pending',
      expiresAtMs: nextExpiresAtMs,
      expiresAtIso: nextExpiresAtIso,
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'invitationLocks', emailHash), {
      token: invitation.token,
      status: 'pending',
      expiresAtMs: nextExpiresAtMs,
      invitedBy: invitation.invitedBy,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    if (isAdminAction) {
      void recordAuditLogInFirestore({
        actionType: 'resend_invitation',
        targetId: invitation.token,
        details: `إعادة إرسال دعوة (${invitation.userType}) إلى ${invitation.email} وتجديد صلاحيتها ٤٨ ساعة.`,
      });
    }

    return await sendInvitationEmailViaServer({
      email: invitation.email,
      userType: invitation.userType,
      token: invitation.token,
      invitedByName: invitation.invitedByName,
      referralCode: invitation.referralCode,
    });
  } catch (error) {
    logFirestoreFailure(
      'invitations',
      invitation.token,
      'resendInvitationEmail',
      error
    );
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `invitations/${invitation.token}`
    );
  }
}

export async function deleteInvitationInFirestore(
  invitation: InvitationRecord,
  isAdminAction = false
): Promise<void> {
  if (!isValidFirestoreId(invitation.token)) return;
  await waitForFirestoreWarmup();
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'invitations', invitation.token));
    batch.delete(doc(db, 'invitationIndex', invitation.token));
    if (invitation.email && invitation.email.includes('@')) {
      const emailHash = await computeEmailSha256Hex(invitation.email);
      batch.delete(doc(db, 'invitationLocks', emailHash));
    }
    await batch.commit();

    if (isAdminAction) {
      void recordAuditLogInFirestore({
        actionType: 'delete_invitation',
        targetId: invitation.token,
        details: `حذف/إلغاء الدعوة المرسلة إلى ${invitation.email}`,
      });
    }
  } catch (error) {
    logFirestoreFailure(
      'invitations',
      invitation.token,
      'deleteInvitation',
      error
    );
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `invitations/${invitation.token}`
    );
  }
}

export function listenToAllInvitationsForAdmin(
  onData: (invitations: InvitationRecord[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'invitationIndex'),
    where('status', 'in', ['pending', 'accepted', 'expired'])
  );
  return onSnapshot(
    q,
    async (snap) => {
      const hydrated = await Promise.all(
        snap.docs.map(async (idxDoc) => {
          const token = idxDoc.id;
          const idxData = idxDoc.data() ?? {};
          try {
            const fullSnap = await getDoc(doc(db, 'invitations', token));
            if (fullSnap.exists()) {
              return parseInvitationDoc(
                fullSnap,
                String(idxData.maskedEmail ?? '')
              );
            }
          } catch {
            // Fallback to index metadata
          }
          return parseInvitationDoc(idxDoc, String(idxData.maskedEmail ?? ''));
        })
      );
      hydrated.sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
      onData(hydrated);
    },
    () => onData([])
  );
}

export function listenToAgentInvitations(
  agentUid: string,
  onData: (invitations: InvitationRecord[]) => void
): Unsubscribe {
  if (!agentUid || !isValidFirestoreId(agentUid)) {
    onData([]);
    return () => {};
  }
  const q = query(
    collection(db, 'invitations'),
    where('invitedBy', '==', agentUid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => parseInvitationDoc(d))
        .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
      onData(list);
    },
    () => onData([])
  );
}

export async function resolveReferralCodeInFirestore(
  rawCode: string
): Promise<{ code: string; agentId: string; agentName: string } | null> {
  const cleanCode = rawCode.trim().toUpperCase();
  if (!cleanCode || !isValidFirestoreId(cleanCode) || cleanCode.length < 6) {
    return null;
  }
  await waitForFirestoreWarmup();
  try {
    const snap = await getDoc(doc(db, 'referralCodes', cleanCode));
    if (!snap.exists()) return null;
    const d = snap.data() ?? {};
    if (d.isActive === false) return null;
    const agentId = String(d.agentId ?? '').trim();
    if (!isValidFirestoreId(agentId)) return null;
    return {
      code: cleanCode,
      agentId,
      agentName: String(d.agentName ?? 'مسؤول مبيعات إدكاوي'),
    };
  } catch {
    return null;
  }
}

export async function recordReferralOnSignupBestEffort(params: {
  agentId: string;
  referralCode: string;
  referredUid: string;
  referredStoreId?: string;
  accountName: string;
  accountType: 'store' | 'customer' | 'courier';
}): Promise<void> {
  if (
    !isValidFirestoreId(params.agentId) ||
    !isValidFirestoreId(params.referredUid)
  ) {
    return;
  }
  try {
    const referralDocId =
      params.accountType === 'store' &&
      params.referredStoreId &&
      isValidFirestoreId(params.referredStoreId)
        ? `ref_store_${params.referredStoreId}`
        : `ref_usr_${params.referredUid}`;

    const refDocRef = doc(db, 'referrals', referralDocId);
    const existingRef = await getDoc(refDocRef).catch(() => null);
    if (existingRef?.exists()) return;

    const agentDirRef = doc(db, 'salesAgentDirectory', params.agentId);
    const agentDirSnap = await getDoc(agentDirRef).catch(() => null);
    if (!agentDirSnap?.exists()) return;
    const dirData = agentDirSnap.data() ?? {};

    const nextStores =
      Math.max(0, Math.trunc(Number(dirData.invitedStoresCount ?? 0))) +
      (params.accountType === 'store' ? 1 : 0);
    const nextCustomers =
      Math.max(0, Math.trunc(Number(dirData.invitedCustomersCount ?? 0))) +
      (params.accountType === 'customer' ? 1 : 0);
    const nextCouriers =
      Math.max(0, Math.trunc(Number(dirData.invitedCouriersCount ?? 0))) +
      (params.accountType === 'courier' ? 1 : 0);

    const batch = writeBatch(db);
    batch.set(refDocRef, {
      id: referralDocId,
      agentId: params.agentId,
      referralCode: params.referralCode.trim().toUpperCase().slice(0, 24),
      referredUid: params.referredUid,
      ...(params.referredStoreId && isValidFirestoreId(params.referredStoreId)
        ? { referredStoreId: params.referredStoreId }
        : {}),
      accountName: (params.accountName.trim() || 'حساب إدكاوي').slice(0, 80),
      accountType: params.accountType,
      status: 'active',
      completedOrdersCount: 0,
      totalSalesVolumeEgp: 0,
      totalCommissionsEgp: 0,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.update(agentDirRef, {
      invitedStoresCount: nextStores,
      invitedCustomersCount: nextCustomers,
      invitedCouriersCount: nextCouriers,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch {
    // Non-fatal CRM link
  }
}

async function allocateUniqueSalesAgentReferralCode(): Promise<string> {
  for (let i = 0; i < 12; i += 1) {
    const candidate = generateSalesAgentReferralCode();
    try {
      const snap = await getDoc(doc(db, 'referralCodes', candidate));
      if (!snap.exists()) return candidate;
    } catch {
      return candidate;
    }
  }
  return generateSalesAgentReferralCode();
}

export async function registerAccountFromInvitationInFirestore(
  payload: InvitationRegisterPayload
): Promise<{ user: User; role: PortalRole }> {
  const tokenCheck = await validateInvitationTokenInFirestore(payload.token);
  if (!tokenCheck.valid || !tokenCheck.invitation) {
    throw new Error(tokenCheck.reason || 'الدعوة غير صالحة أو منتهية.');
  }
  const inv = tokenCheck.invitation;
  const cleanName = payload.name.trim().slice(0, 80);
  const cleanPhone = normalizeEgyptPhoneOrEmpty(payload.phone);
  const cleanPassword = payload.password;
  const cleanEmail = inv.email.trim().toLowerCase();

  if (cleanName.length < 2) {
    throw new Error('يرجى إدخال الاسم بالكامل (حرفين على الأقل).');
  }
  if (!EGYPT_PHONE_REGEX.test(cleanPhone)) {
    throw new Error(
      'يرجى إدخال رقم هاتف مصري صحيح مكون من ١١ رقماً (مثال: 01012345678).'
    );
  }
  if (cleanPassword.length < 6 || cleanPassword.length > 64) {
    throw new Error('كلمة المرور يجب أن تتكون من ٦ أحرف أو أرقام على الأقل.');
  }

  const cleanNeighborhood = (
    payload.neighborhood?.trim() || EDKU_NEIGHBORHOODS[0]
  ).slice(0, 80);
  const coords = isValidEdkuCoordPair(payload.lat, payload.lng)
    ? {
        lat: Number(payload.lat!.toFixed(6)),
        lng: Number(payload.lng!.toFixed(6)),
      }
    : resolveEdkuCoordsForNeighborhood(cleanNeighborhood);

  if (isEdkuWaterCoordinate(coords.lat, coords.lng)) {
    throw new Error(
      'من فضلك اختر موقعاً على الأرض داخل إدكو (لا يمكن تثبيت العنوان في البحر أو بحيرة إدكو).'
    );
  }

  // Resolve Sales Agent attribution if invitation came from a Sales Agent or carried a referral code
  let resolvedAgentId = inv.agentId;
  let resolvedRefCode = inv.referralCode;
  if (!resolvedAgentId && resolvedRefCode) {
    const lookedUp = await resolveReferralCodeInFirestore(resolvedRefCode);
    if (lookedUp) {
      resolvedAgentId = lookedUp.agentId;
      resolvedRefCode = lookedUp.code;
    }
  }

  await waitForFirestoreWarmup();

  // Pre-allocate non-transactional identifiers before creating the Firebase Auth user
  const preGeneratedRefCode =
    inv.userType === 'sales_agent'
      ? await allocateUniqueSalesAgentReferralCode()
      : '';
  const preGeneratedCustomerCode =
    inv.userType !== 'store' &&
    inv.userType !== 'sales_agent' &&
    inv.userType !== 'courier'
      ? await allocateFreshCustomerCode()
      : '';

  auth.languageCode = 'ar';
  const credential = await createUserWithEmailAndPassword(
    auth,
    cleanEmail,
    cleanPassword
  );
  const uid = credential.user.uid;
  await updateProfile(credential.user, { displayName: cleanName }).catch(
    () => {}
  );

  const acceptedAtIso = new Date().toISOString();
  const emailHash = await computeEmailSha256Hex(cleanEmail);
  const invRef = doc(db, 'invitations', inv.token);
  const invIdxRef = doc(db, 'invitationIndex', inv.token);
  const lockRef = doc(db, 'invitationLocks', emailHash);
  const storeId = `store_${uid.slice(0, 16)}_${Date.now().toString(36)}`;

  try {
    await runTransaction(db, async (tx) => {
      const liveInvSnap = await tx.get(invRef);
      if (!liveInvSnap.exists()) {
        throw new Error('الدعوة غير موجودة أو تم إلغاؤها.');
      }
      const liveInv = liveInvSnap.data() ?? {};
      if (String(liveInv.status ?? '') !== 'pending') {
        throw new Error('تم استخدام رابط الدعوة هذا مسبقاً.');
      }
      const expiresAtMs = Number(liveInv.expiresAtMs ?? inv.expiresAtMs);
      if (Number.isFinite(expiresAtMs) && Date.now() > expiresAtMs) {
        throw new Error('انتهت صلاحية رابط الدعوة.');
      }

      tx.update(invRef, {
        status: 'accepted',
        acceptedByUid: uid,
        acceptedAtIso,
        updatedAt: serverTimestamp(),
      });
      tx.update(invIdxRef, {
        status: 'accepted',
        updatedAt: serverTimestamp(),
      });
      tx.set(lockRef, {
        token: inv.token,
        status: 'accepted',
        expiresAtMs: inv.expiresAtMs,
        invitedBy: inv.invitedBy,
        updatedAt: serverTimestamp(),
      });

      if (inv.userType === 'store') {
        const storeCategory: StoreCategory =
          payload.storeCategory &&
          CATEGORY_TO_STORE_IMAGE[payload.storeCategory] !== undefined
            ? payload.storeCategory
            : 'مشويات ومطاعم';
        const isHomeFood =
          typeof payload.isHomeFood === 'boolean'
            ? payload.isHomeFood
            : storeCategory === 'أكل بيتي';
        const categoryId = resolveCategoryIdForStoreCategory(storeCategory);
        const imageKey = resolveStoreImageKeyForCategory(storeCategory);
        const zone = resolveZoneForNeighborhood(cleanNeighborhood);

        tx.set(doc(db, 'stores', storeId), {
          name: cleanName,
          category: storeCategory,
          categoryId,
          isHomeFood,
          neighborhood: cleanNeighborhood,
          description: (
            payload.storeDescription?.trim() ||
            `${cleanName} — متجر معتمد في ${cleanNeighborhood} بمدينة إدكو`
          ).slice(0, 240),
          deliveryFee: zone.deliveryFee,
          deliveryTimeMinutes: 30,
          rating: 4.9,
          lat: coords.lat,
          lng: coords.lng,
          imageKey,
          isActive: true,
          isOpen: true,
          prepTimeMinutes: 25,
          minOrderAmount: 0,
          menuItems: [{ id: 'item_init_1', name: 'صنف رئيسي مميز', price: 65 }],
          ownerUid: uid,
          loginEmail: cleanEmail,
          ...(resolvedAgentId && isValidFirestoreId(resolvedAgentId)
            ? { referredByAgentId: resolvedAgentId }
            : {}),
          ...(resolvedRefCode ? { referredByCode: resolvedRefCode } : {}),
          inviteToken: inv.token,
          createdBy: uid,
          createdAt: serverTimestamp(),
        });
        tx.set(doc(db, 'users', uid), {
          role: 'store',
          storeId,
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          requiresEmailVerification: true,
          ...(resolvedRefCode ? { referredByCode: resolvedRefCode } : {}),
          ...(resolvedAgentId && isValidFirestoreId(resolvedAgentId)
            ? { referredByAgentId: resolvedAgentId }
            : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return;
      }

      if (inv.userType === 'sales_agent') {
        tx.set(doc(db, 'sales_agents', uid), {
          id: uid,
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          referralCode: preGeneratedRefCode,
          isActive: true,
          inviteToken: inv.token,
          createdBy: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        tx.set(doc(db, 'salesAgentDirectory', uid), {
          id: uid,
          name: cleanName,
          referralCode: preGeneratedRefCode,
          commissionRatePercent: 5,
          availableBalance: 0,
          pendingBalance: 0,
          totalEarnings: 0,
          invitedStoresCount: 0,
          invitedCustomersCount: 0,
          invitedCouriersCount: 0,
          isActive: true,
          createdBy: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        tx.set(doc(db, 'referralCodes', preGeneratedRefCode), {
          code: preGeneratedRefCode,
          agentId: uid,
          agentName: cleanName,
          isActive: true,
          createdAt: serverTimestamp(),
        });
        tx.set(doc(db, 'users', uid), {
          role: 'sales_agent',
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          referralCode: preGeneratedRefCode,
          requiresEmailVerification: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return;
      }

      if (inv.userType === 'courier') {
        const vehicleType = payload.vehicleType || 'دراجة نارية';
        tx.set(doc(db, 'couriers', uid), {
          name: cleanName,
          phone: cleanPhone,
          email: cleanEmail,
          vehicleType,
          neighborhood: cleanNeighborhood,
          lat: coords.lat,
          lng: coords.lng,
          isAvailable: false,
          approvalStatus: 'pending',
          completedDeliveries: 0,
          updatedBy: uid,
          updatedAt: serverTimestamp(),
        });
        tx.set(doc(db, 'courierDirectory', uid), {
          name: cleanName,
          vehicleType,
          neighborhood: cleanNeighborhood,
          lat: coords.lat,
          lng: coords.lng,
          isAvailable: false,
          approvalStatus: 'pending',
          completedDeliveries: 0,
          updatedBy: uid,
          updatedAt: serverTimestamp(),
        });
        tx.set(doc(db, 'users', uid), {
          role: 'courier',
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          ...(resolvedRefCode ? { referredByCode: resolvedRefCode } : {}),
          ...(resolvedAgentId && isValidFirestoreId(resolvedAgentId)
            ? { referredByAgentId: resolvedAgentId }
            : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return;
      }

      const cleanAddress = (
        payload.address?.trim() || `${cleanNeighborhood}، مدينة إدكو`
      ).slice(0, 200);
      tx.set(doc(db, 'users', uid), {
        role: 'customer',
        customerCode: preGeneratedCustomerCode,
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        defaultNeighborhood: cleanNeighborhood,
        defaultAddress: cleanAddress,
        defaultLat: coords.lat,
        defaultLng: coords.lng,
        profileCompleted: true,
        points: 0,
        currentStreak: 0,
        ...(resolvedRefCode ? { referredByCode: resolvedRefCode } : {}),
        ...(resolvedAgentId && isValidFirestoreId(resolvedAgentId)
          ? { referredByAgentId: resolvedAgentId }
          : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  } catch (err) {
    // Rollback orphaned Firebase Auth user if atomic Firestore invitation commit failed
    await deleteUser(credential.user).catch(() => {});
    throw err;
  }

  if (inv.userType === 'store') {
    await sendEmailVerification(credential.user).catch(() => {});
    void syncRegisteredAccountMarker(cleanEmail, 'store');
    if (resolvedAgentId && resolvedRefCode) {
      await recordReferralOnSignupBestEffort({
        agentId: resolvedAgentId,
        referralCode: resolvedRefCode,
        referredUid: uid,
        referredStoreId: storeId,
        accountName: cleanName,
        accountType: 'store',
      });
    }
    writeCachedUserRole(uid, 'store');
    return { user: credential.user, role: 'store' };
  }

  if (inv.userType === 'sales_agent') {
    await sendEmailVerification(credential.user).catch(() => {});
    void syncRegisteredAccountMarker(cleanEmail, 'sales_agent');
    writeCachedUserRole(uid, 'sales_agent');
    return { user: credential.user, role: 'sales_agent' };
  }

  if (inv.userType === 'courier') {
    void syncRegisteredAccountMarker(cleanEmail, 'courier');
    if (resolvedAgentId && resolvedRefCode) {
      await recordReferralOnSignupBestEffort({
        agentId: resolvedAgentId,
        referralCode: resolvedRefCode,
        referredUid: uid,
        accountName: cleanName,
        accountType: 'courier',
      });
    }
    writeCachedUserRole(uid, 'courier');
    return { user: credential.user, role: 'courier' };
  }

  void syncCustomerDirectoryEntry(uid, {
    name: cleanName,
    customerCode: preGeneratedCustomerCode,
    neighborhood: cleanNeighborhood,
    points: 0,
    currentStreak: 0,
  });
  void syncRegisteredAccountMarker(cleanEmail, 'customer');
  if (resolvedAgentId && resolvedRefCode) {
    await recordReferralOnSignupBestEffort({
      agentId: resolvedAgentId,
      referralCode: resolvedRefCode,
      referredUid: uid,
      accountName: cleanName,
      accountType: 'customer',
    });
  }
  writeCachedUserRole(uid, 'customer');
  return { user: credential.user, role: 'customer' };
}

/* ============================================================================
 * SALES AGENT ADMIN PROVISIONING, COMMISSION ESCROW & PAYOUT WALLET
 * ========================================================================== */

function parseSalesAgentCombined(
  dirDoc: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>,
  privateData?: DocumentData | null
): SalesAgentRecord {
  const d = dirDoc.data() ?? {};
  const p = privateData ?? {};
  return {
    id: String(d.id ?? dirDoc.id),
    name: String(p.name ?? d.name ?? 'مسؤول مبيعات'),
    email: String(p.email ?? ''),
    phone: String(p.phone ?? ''),
    referralCode: String(d.referralCode ?? p.referralCode ?? ''),
    commissionRatePercent: Math.max(
      0,
      Math.min(50, Number(d.commissionRatePercent ?? 5))
    ),
    availableBalance: Number(
      Math.max(0, Number(d.availableBalance ?? 0)).toFixed(2)
    ),
    pendingBalance: Number(
      Math.max(0, Number(d.pendingBalance ?? 0)).toFixed(2)
    ),
    totalEarnings: Number(Math.max(0, Number(d.totalEarnings ?? 0)).toFixed(2)),
    invitedStoresCount: Math.max(
      0,
      Math.trunc(Number(d.invitedStoresCount ?? 0))
    ),
    invitedCustomersCount: Math.max(
      0,
      Math.trunc(Number(d.invitedCustomersCount ?? 0))
    ),
    invitedCouriersCount: Math.max(
      0,
      Math.trunc(Number(d.invitedCouriersCount ?? 0))
    ),
    isActive: d.isActive !== false && p.isActive !== false,
    createdBy: String(d.createdBy ?? ''),
    createdAtIso: toIsoString(d.createdAt),
    updatedAtIso: toIsoString(d.updatedAt),
  };
}

export async function createSalesAgentByAdminInFirestore(
  adminUid: string,
  input: AdminCreateSalesAgentInput
): Promise<SalesAgentRecord> {
  const cleanName = input.name.trim().slice(0, 80);
  const cleanEmail = input.email.trim().toLowerCase().slice(0, 100);
  const cleanPhone = normalizeEgyptPhoneOrEmpty(input.phone);
  const cleanPassword = input.password;
  const commissionRatePercent = Math.max(
    0,
    Math.min(50, Number(input.commissionRatePercent ?? 5))
  );

  if (cleanName.length < 2) {
    throw new Error('يرجى إدخال اسم مسؤول المبيعات (حرفين على الأقل).');
  }
  if (
    cleanEmail.length < 5 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) ||
    cleanEmail === OFFICIAL_ADMIN_PORTAL_EMAIL
  ) {
    throw new Error('يرجى إدخال بريد إلكتروني صحيح لمسؤول المبيعات.');
  }
  if (!EGYPT_PHONE_REGEX.test(cleanPhone)) {
    throw new Error(
      'يرجى إدخال رقم موبايل مصري مكون من ١١ رقماً (مثال: 01012345678).'
    );
  }
  if (cleanPassword.length < 6 || cleanPassword.length > 64) {
    throw new Error('كلمة المرور يجب أن تتكون من ٦ أحرف أو أرقام على الأقل.');
  }

  await waitForFirestoreWarmup();
  const referralCode = await allocateUniqueSalesAgentReferralCode();
  const agentUid = await createSecondaryAuthUser(cleanEmail, cleanPassword, {
    displayName: cleanName,
    sendVerification: true,
  });

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'sales_agents', agentUid), {
      id: agentUid,
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      referralCode,
      isActive: true,
      createdBy: adminUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'salesAgentDirectory', agentUid), {
      id: agentUid,
      name: cleanName,
      referralCode,
      commissionRatePercent,
      availableBalance: 0,
      pendingBalance: 0,
      totalEarnings: 0,
      invitedStoresCount: 0,
      invitedCustomersCount: 0,
      invitedCouriersCount: 0,
      isActive: true,
      createdBy: adminUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'referralCodes', referralCode), {
      code: referralCode,
      agentId: agentUid,
      agentName: cleanName,
      isActive: true,
      createdAt: serverTimestamp(),
    });
    batch.set(doc(db, 'users', agentUid), {
      role: 'sales_agent',
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      referralCode,
      requiresEmailVerification: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    void syncRegisteredAccountMarker(cleanEmail, 'sales_agent');
    void recordAuditLogInFirestore({
      actionType: 'create_sales_agent',
      targetId: agentUid,
      details: `إضافة مسؤول مبيعات "${cleanName}" بكود إحالة ${referralCode} ونسبة عمولة ${commissionRatePercent}%`,
    });

    const nowIso = new Date().toISOString();
    return {
      id: agentUid,
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      referralCode,
      commissionRatePercent,
      availableBalance: 0,
      pendingBalance: 0,
      totalEarnings: 0,
      invitedStoresCount: 0,
      invitedCustomersCount: 0,
      invitedCouriersCount: 0,
      isActive: true,
      createdBy: adminUid,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    };
  } catch (error) {
    logFirestoreFailure(
      'sales_agents',
      agentUid,
      'createSalesAgentByAdmin',
      error
    );
    handleFirestoreError(
      error,
      OperationType.CREATE,
      `sales_agents/${agentUid}`
    );
  }
}

export function listenToSalesAgentsForAdmin(
  onData: (agents: SalesAgentRecord[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'salesAgentDirectory'),
    where('isActive', 'in', [true, false])
  );
  return onSnapshot(
    q,
    async (snap) => {
      const hydrated = await Promise.all(
        snap.docs.map(async (dirDoc) => {
          try {
            const pSnap = await getDoc(doc(db, 'sales_agents', dirDoc.id));
            return parseSalesAgentCombined(
              dirDoc,
              pSnap.exists() ? pSnap.data() : null
            );
          } catch {
            return parseSalesAgentCombined(dirDoc, null);
          }
        })
      );
      hydrated.sort((a, b) => b.totalEarnings - a.totalEarnings);
      onData(hydrated);
    },
    () => onData([])
  );
}

export function listenToSalesAgentProfile(
  agentUid: string,
  onData: (agent: SalesAgentRecord | null) => void
): Unsubscribe {
  if (!agentUid || !isValidFirestoreId(agentUid)) {
    onData(null);
    return () => {};
  }
  let latestDirSnap: DocumentSnapshot<DocumentData> | null = null;
  let latestPrivData: DocumentData | null = null;

  const emitIfReady = () => {
    if (!latestDirSnap || !latestDirSnap.exists()) {
      onData(null);
      return;
    }
    onData(parseSalesAgentCombined(latestDirSnap, latestPrivData));
  };

  const unsubDir = onSnapshot(
    doc(db, 'salesAgentDirectory', agentUid),
    (snap) => {
      latestDirSnap = snap;
      emitIfReady();
    },
    () => onData(null)
  );

  const unsubPriv = onSnapshot(
    doc(db, 'sales_agents', agentUid),
    (snap) => {
      latestPrivData = snap.exists() ? snap.data() ?? null : null;
      emitIfReady();
    },
    () => {}
  );

  return () => {
    unsubDir();
    unsubPriv();
  };
}

export async function updateSalesAgentCommissionRateInFirestore(
  agentId: string,
  nextRatePercent: number
): Promise<void> {
  if (!isValidFirestoreId(agentId)) return;
  const clamped = Math.max(0, Math.min(50, Number(nextRatePercent)));
  await waitForFirestoreWarmup();
  await updateDoc(doc(db, 'salesAgentDirectory', agentId), {
    commissionRatePercent: Number(clamped.toFixed(2)),
    updatedAt: serverTimestamp(),
  });
}

export async function toggleSalesAgentActiveByAdminInFirestore(
  agent: SalesAgentRecord,
  nextActive: boolean
): Promise<void> {
  if (!isValidFirestoreId(agent.id)) return;
  await waitForFirestoreWarmup();
  const batch = writeBatch(db);
  batch.update(doc(db, 'sales_agents', agent.id), {
    isActive: Boolean(nextActive),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'salesAgentDirectory', agent.id), {
    isActive: Boolean(nextActive),
    updatedAt: serverTimestamp(),
  });
  if (agent.referralCode && isValidFirestoreId(agent.referralCode)) {
    batch.set(doc(db, 'referralCodes', agent.referralCode), {
      code: agent.referralCode,
      agentId: agent.id,
      agentName: agent.name.slice(0, 80),
      isActive: Boolean(nextActive),
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

export function listenToAgentReferrals(
  agentUid: string,
  onData: (referrals: ReferralAccountRecord[]) => void
): Unsubscribe {
  if (!agentUid || !isValidFirestoreId(agentUid)) {
    onData([]);
    return () => {};
  }
  const q = query(
    collection(db, 'referrals'),
    where('agentId', '==', agentUid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: ReferralAccountRecord[] = snap.docs
        .map((d) => {
          const data = d.data() ?? {};
          const rawType = String(data.accountType ?? 'customer');
          const accountType: 'store' | 'customer' | 'courier' =
            rawType === 'store' || rawType === 'courier' ? rawType : 'customer';
          return {
            id: String(data.id ?? d.id),
            agentId: String(data.agentId ?? agentUid),
            referralCode: String(data.referralCode ?? ''),
            referredUid: String(data.referredUid ?? ''),
            referredStoreId:
              typeof data.referredStoreId === 'string'
                ? data.referredStoreId
                : undefined,
            accountName: String(data.accountName ?? 'حساب إدكاوي'),
            accountType,
            status: (data.status === 'inactive' ? 'inactive' : 'active') as
              | 'active'
              | 'inactive',
            completedOrdersCount: Math.max(
              0,
              Math.trunc(Number(data.completedOrdersCount ?? 0))
            ),
            totalSalesVolumeEgp: Number(
              Math.max(0, Number(data.totalSalesVolumeEgp ?? 0)).toFixed(2)
            ),
            totalCommissionsEgp: Number(
              Math.max(0, Number(data.totalCommissionsEgp ?? 0)).toFixed(2)
            ),
            joinedAtIso: toIsoString(data.joinedAt),
            updatedAtIso: toIsoString(data.updatedAt),
          };
        })
        .sort((a, b) => b.joinedAtIso.localeCompare(a.joinedAtIso));
      onData(list);
    },
    () => onData([])
  );
}

export function listenToAgentCommissions(
  agentUid: string,
  onData: (commissions: CommissionRecord[]) => void
): Unsubscribe {
  if (!agentUid || !isValidFirestoreId(agentUid)) {
    onData([]);
    return () => {};
  }
  const q = query(
    collection(db, 'commissions'),
    where('agentId', '==', agentUid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: CommissionRecord[] = snap.docs
        .map((d) => {
          const data = d.data() ?? {};
          return {
            id: String(data.id ?? d.id),
            orderId: String(data.orderId ?? d.id),
            agentId: String(data.agentId ?? agentUid),
            referralCode: String(data.referralCode ?? ''),
            referredEntityId: String(data.referredEntityId ?? ''),
            referredEntityName: String(data.referredEntityName ?? 'حساب مُحال'),
            referredEntityType: (data.referredEntityType === 'store'
              ? 'store'
              : 'customer') as 'store' | 'customer',
            orderTotalEgp: Number(Number(data.orderTotalEgp ?? 0).toFixed(2)),
            commissionRatePercent: Number(
              Number(data.commissionRatePercent ?? 5).toFixed(2)
            ),
            amountEgp: Number(Number(data.amountEgp ?? 0).toFixed(2)),
            status: (data.status === 'settled' ? 'settled' : 'pending') as
              | 'pending'
              | 'settled',
            maturesAtMs: Math.trunc(Number(data.maturesAtMs ?? 0)),
            createdAtIso: toIsoString(data.createdAt),
            settledAtIso:
              typeof data.settledAtIso === 'string'
                ? data.settledAtIso
                : undefined,
          };
        })
        .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
      onData(list);
    },
    () => onData([])
  );
}

async function awardSalesAgentCommissionForDeliveredOrderBestEffort(
  orderId: string,
  orderData: DocumentData
): Promise<void> {
  if (!isValidFirestoreId(orderId) || orderData.isTestSimulation === true) {
    return;
  }
  try {
    const existingCommSnap = await getDoc(doc(db, 'commissions', orderId)).catch(
      () => null
    );
    if (existingCommSnap?.exists()) return;

    const storeId = String(orderData.storeId ?? '').trim();
    const customerId = String(orderData.customerId ?? '').trim();
    const orderTotalEgp = Math.max(
      0,
      Number(orderData.subtotal ?? orderData.totalAmount ?? 0)
    );
    if (orderTotalEgp <= 0) return;

    // Check store referral first (`ref_store_${storeId}`), then customer referral (`ref_usr_${customerId}`)
    let matchedRefSnap: DocumentSnapshot<DocumentData> | null = null;
    let entityType: 'store' | 'customer' = 'store';

    if (storeId && isValidFirestoreId(storeId)) {
      const storeRefDoc = await getDoc(
        doc(db, 'referrals', `ref_store_${storeId}`)
      ).catch(() => null);
      if (storeRefDoc?.exists()) {
        matchedRefSnap = storeRefDoc;
        entityType = 'store';
      }
    }
    if (!matchedRefSnap && customerId && isValidFirestoreId(customerId)) {
      const custRefDoc = await getDoc(
        doc(db, 'referrals', `ref_usr_${customerId}`)
      ).catch(() => null);
      if (custRefDoc?.exists()) {
        matchedRefSnap = custRefDoc;
        entityType = 'customer';
      }
    }

    if (!matchedRefSnap) return;
    const refData = matchedRefSnap.data() ?? {};
    const agentId = String(refData.agentId ?? '').trim();
    const referralCode = String(refData.referralCode ?? '').trim();
    if (!isValidFirestoreId(agentId) || referralCode.length < 6) return;

    const agentDirRef = doc(db, 'salesAgentDirectory', agentId);
    const agentDirSnap = await getDoc(agentDirRef).catch(() => null);
    if (!agentDirSnap?.exists()) return;
    const agentDir = agentDirSnap.data() ?? {};
    if (agentDir.isActive === false) return;

    const ratePercent = Math.max(
      0,
      Math.min(50, Number(agentDir.commissionRatePercent ?? 5))
    );
    if (ratePercent <= 0) return;

    const amountEgp = Number(((orderTotalEgp * ratePercent) / 100).toFixed(2));
    if (amountEgp <= 0) return;

    const maturesAtMs = Date.now() + COMMISSION_ESCROW_DURATION_MS;
    const nextPending = Number(
      (Math.max(0, Number(agentDir.pendingBalance ?? 0)) + amountEgp).toFixed(2)
    );
    const nextTotalEarnings = Number(
      (Math.max(0, Number(agentDir.totalEarnings ?? 0)) + amountEgp).toFixed(2)
    );

    const nextCompletedOrders =
      Math.max(0, Math.trunc(Number(refData.completedOrdersCount ?? 0))) + 1;
    const nextSalesVolume = Number(
      (
        Math.max(0, Number(refData.totalSalesVolumeEgp ?? 0)) + orderTotalEgp
      ).toFixed(2)
    );
    const nextRefCommissions = Number(
      (
        Math.max(0, Number(refData.totalCommissionsEgp ?? 0)) + amountEgp
      ).toFixed(2)
    );

    const batch = writeBatch(db);
    batch.set(doc(db, 'commissions', orderId), {
      id: orderId,
      orderId,
      agentId,
      referralCode,
      referredEntityId: entityType === 'store' ? storeId : customerId,
      referredEntityName: String(
        refData.accountName ??
          (entityType === 'store'
            ? orderData.storeName ?? 'متجر إدكاوي'
            : orderData.customerName ?? 'عميل إدكاوي')
      ).slice(0, 80),
      referredEntityType: entityType,
      orderTotalEgp: Number(orderTotalEgp.toFixed(2)),
      commissionRatePercent: ratePercent,
      amountEgp,
      status: 'pending',
      maturesAtMs,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.update(agentDirRef, {
      pendingBalance: nextPending,
      totalEarnings: nextTotalEarnings,
      updatedAt: serverTimestamp(),
    });
    batch.update(matchedRefSnap.ref, {
      completedOrdersCount: nextCompletedOrders,
      totalSalesVolumeEgp: nextSalesVolume,
      totalCommissionsEgp: nextRefCommissions,
      status: 'active',
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    void createNotificationBestEffort(agentId, {
      title: `عمولة جديدة معلقة: +${amountEgp} ج.م`,
      body: `اكتمل طلب بقيمة ${orderTotalEgp} ج.م لحساب "${String(
        refData.accountName ?? ''
      ).slice(0, 35)}". ستنتقل العمولة للرصيد القابل للسحب بعد ٢٤ ساعة.`,
      type: 'order_update',
      orderId,
    });
  } catch {
    // Non-fatal commission escrow hook
  }
}

export async function settleMaturedAgentCommissionsInFirestore(
  agentUid: string
): Promise<number> {
  if (!agentUid || !isValidFirestoreId(agentUid)) return 0;
  await waitForFirestoreWarmup();

  const q = query(
    collection(db, 'commissions'),
    where('agentId', '==', agentUid)
  );
  const snap = await getDocs(q);
  const nowMs = Date.now();
  const maturedDocs = snap.docs.filter((d) => {
    const data = d.data() ?? {};
    return (
      data.status === 'pending' &&
      Number(data.maturesAtMs ?? Number.MAX_SAFE_INTEGER) <= nowMs
    );
  });

  if (maturedDocs.length === 0) return 0;

  let settledSum = 0;
  await runTransaction(db, async (tx) => {
    const dirRef = doc(db, 'salesAgentDirectory', agentUid);
    const dirSnap = await tx.get(dirRef);
    if (!dirSnap.exists()) return;

    const liveMatured: Array<{
      ref: DocumentReference<DocumentData>;
      amount: number;
    }> = [];

    for (const mDoc of maturedDocs.slice(0, 25)) {
      const freshSnap = await tx.get(mDoc.ref);
      if (
        freshSnap.exists() &&
        freshSnap.data()?.status === 'pending' &&
        Number(freshSnap.data()?.maturesAtMs ?? Number.MAX_SAFE_INTEGER) <= nowMs
      ) {
        const amt = Math.max(0, Number(freshSnap.data()?.amountEgp ?? 0));
        if (amt > 0) {
          liveMatured.push({ ref: mDoc.ref, amount: amt });
        }
      }
    }

    if (liveMatured.length === 0) return;

    const totalRelease = Number(
      liveMatured.reduce((s, item) => s + item.amount, 0).toFixed(2)
    );
    if (totalRelease <= 0) return;

    const dirData = dirSnap.data() ?? {};
    const prevAvailable = Math.max(0, Number(dirData.availableBalance ?? 0));
    const prevPending = Math.max(0, Number(dirData.pendingBalance ?? 0));
    const actualRelease = Number(Math.min(prevPending, totalRelease).toFixed(2));
    if (actualRelease <= 0) return;

    const settledAtIso = new Date().toISOString();
    for (const item of liveMatured) {
      tx.update(item.ref, {
        status: 'settled',
        settledAtIso,
        updatedAt: serverTimestamp(),
      });
    }
    tx.update(dirRef, {
      availableBalance: Number((prevAvailable + actualRelease).toFixed(2)),
      pendingBalance: Number(Math.max(0, prevPending - actualRelease).toFixed(2)),
      updatedAt: serverTimestamp(),
    });
    settledSum = actualRelease;
  });

  return settledSum;
}

function parsePayoutRequestDoc(
  snap: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>,
  fallbackEmail = ''
): PayoutRequestRecord {
  const d = snap.data() ?? {};
  const method: PayoutMethod =
    d.method === 'instapay' ? 'instapay' : 'vodafone_cash';
  const status: PayoutStatus =
    d.status === 'completed' || d.status === 'rejected' ? d.status : 'pending';
  return {
    id: String(d.id ?? snap.id),
    agentId: String(d.agentId ?? ''),
    agentName: String(d.agentName ?? 'مسؤول مبيعات'),
    agentEmail: String(d.agentEmail ?? fallbackEmail),
    amount: Number(Number(d.amount ?? 0).toFixed(2)),
    method,
    accountDetails: String(d.accountDetails ?? ''),
    status,
    rejectionReason:
      typeof d.rejectionReason === 'string' ? d.rejectionReason : undefined,
    processedBy:
      typeof d.processedBy === 'string' ? d.processedBy : undefined,
    createdAtIso: toIsoString(d.createdAt),
    updatedAtIso: toIsoString(d.updatedAt),
  };
}

export async function requestAgentPayoutInFirestore(
  agent: { uid: string; name: string; email: string },
  input: CreatePayoutRequestInput
): Promise<string> {
  const cleanAmount = Number(Number(input.amount).toFixed(2));
  const cleanDetails = input.accountDetails.trim().slice(0, 120);
  const method: PayoutMethod =
    input.method === 'instapay' ? 'instapay' : 'vodafone_cash';

  if (!Number.isFinite(cleanAmount) || cleanAmount < 100) {
    throw new Error('الحد الأدنى لطلب سحب الأرباح هو ١٠٠ ج.م.');
  }
  if (cleanDetails.length < 4) {
    throw new Error(
      method === 'vodafone_cash'
        ? 'يرجى إدخال رقم محفظة فودافون كاش بشكل صحيح.'
        : 'يرجى إدخال عنوان الدفع أو رقم حساب إنستاباي بشكل صحيح.'
    );
  }

  await waitForFirestoreWarmup();
  await settleMaturedAgentCommissionsInFirestore(agent.uid).catch(() => {});

  const requestId = `payout_${agent.uid.slice(0, 10)}_${Date.now().toString(36)}`;
  const reqRef = doc(db, 'payout_requests', requestId);
  const idxRef = doc(db, 'payoutRequestIndex', requestId);
  const dirRef = doc(db, 'salesAgentDirectory', agent.uid);

  try {
    await runTransaction(db, async (tx) => {
      const dirSnap = await tx.get(dirRef);
      if (!dirSnap.exists()) {
        throw new Error('تعذر العثور على محفظة مسؤول المبيعات.');
      }
      const dirData = dirSnap.data() ?? {};
      const currentAvailable = Math.max(
        0,
        Number(dirData.availableBalance ?? 0)
      );
      if (currentAvailable < cleanAmount) {
        throw new Error(
          `رصيدك القابل للسحب (${currentAvailable.toFixed(
            2
          )} ج.م) أقل من المبلغ المطلوب (${cleanAmount} ج.م).`
        );
      }
      const nextAvailable = Number((currentAvailable - cleanAmount).toFixed(2));
      const cleanAgentName = (
        agent.name.trim() ||
        String(dirData.name ?? 'مسؤول مبيعات')
      ).slice(0, 80);
      const cleanAgentEmail = (
        agent.email.trim().toLowerCase() || 'agent@edkawy.app'
      ).slice(0, 100);

      tx.update(dirRef, {
        availableBalance: nextAvailable,
        updatedAt: serverTimestamp(),
      });
      tx.set(reqRef, {
        id: requestId,
        agentId: agent.uid,
        agentName: cleanAgentName,
        agentEmail: cleanAgentEmail,
        amount: cleanAmount,
        method,
        accountDetails: cleanDetails,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      tx.set(idxRef, {
        id: requestId,
        agentId: agent.uid,
        agentName: cleanAgentName,
        amount: cleanAmount,
        method,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    return requestId;
  } catch (error) {
    if (isArabicBusinessError(error)) throw error;
    logFirestoreFailure(
      'payout_requests',
      requestId,
      'requestAgentPayout',
      error
    );
    handleFirestoreError(
      error,
      OperationType.CREATE,
      `payout_requests/${requestId}`
    );
  }
}

export function listenToAgentPayoutRequests(
  agentUid: string,
  onData: (requests: PayoutRequestRecord[]) => void
): Unsubscribe {
  if (!agentUid || !isValidFirestoreId(agentUid)) {
    onData([]);
    return () => {};
  }
  const q = query(
    collection(db, 'payout_requests'),
    where('agentId', '==', agentUid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => parsePayoutRequestDoc(d))
        .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
      onData(list);
    },
    () => onData([])
  );
}

export function listenToAllPayoutRequestsForAdmin(
  onData: (requests: PayoutRequestRecord[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'payoutRequestIndex'),
    where('status', 'in', ['pending', 'completed', 'rejected'])
  );
  return onSnapshot(
    q,
    async (snap) => {
      const hydrated = await Promise.all(
        snap.docs.map(async (idxDoc) => {
          try {
            const fullSnap = await getDoc(doc(db, 'payout_requests', idxDoc.id));
            if (fullSnap.exists()) {
              return parsePayoutRequestDoc(fullSnap);
            }
          } catch {
            // Fallback to non-PII index
          }
          return parsePayoutRequestDoc(idxDoc);
        })
      );
      hydrated.sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
      onData(hydrated);
    },
    () => onData([])
  );
}

export async function resolvePayoutRequestByAdminInFirestore(params: {
  requestId: string;
  adminUid: string;
  decision: 'completed' | 'rejected';
  rejectionReason?: string;
}): Promise<void> {
  if (!isValidFirestoreId(params.requestId)) {
    throw new Error('معرّف طلب السحب غير صالح.');
  }
  const cleanReason = (params.rejectionReason ?? '').trim().slice(0, 240);
  if (params.decision === 'rejected' && cleanReason.length < 2) {
    throw new Error('يرجى كتابة سبب رفض طلب السحب لتوضيحه لمسؤول المبيعات.');
  }

  await waitForFirestoreWarmup();
  const reqRef = doc(db, 'payout_requests', params.requestId);
  const idxRef = doc(db, 'payoutRequestIndex', params.requestId);

  let targetAgentId = '';
  let targetAmount = 0;
  let targetAgentName = '';

  try {
    await runTransaction(db, async (tx) => {
      const reqSnap = await tx.get(reqRef);
      if (!reqSnap.exists()) {
        throw new Error('طلب السحب غير موجود.');
      }
      const reqData = reqSnap.data() ?? {};
      if (reqData.status !== 'pending') {
        throw new Error('تمت مراجعة طلب السحب هذا مسبقاً.');
      }
      targetAgentId = String(reqData.agentId ?? '');
      targetAmount = Math.max(0, Number(reqData.amount ?? 0));
      targetAgentName = String(reqData.agentName ?? 'مسؤول مبيعات');

      const dirRef = doc(db, 'salesAgentDirectory', targetAgentId);
      const dirSnap =
        params.decision === 'rejected' && isValidFirestoreId(targetAgentId)
          ? await tx.get(dirRef)
          : null;

      tx.update(reqRef, {
        status: params.decision,
        processedBy: params.adminUid,
        ...(params.decision === 'rejected'
          ? { rejectionReason: cleanReason }
          : {}),
        updatedAt: serverTimestamp(),
      });
      tx.update(idxRef, {
        status: params.decision,
        updatedAt: serverTimestamp(),
      });

      if (params.decision === 'rejected' && dirSnap?.exists()) {
        const prevAvail = Math.max(
          0,
          Number(dirSnap.data()?.availableBalance ?? 0)
        );
        tx.update(dirRef, {
          availableBalance: Number((prevAvail + targetAmount).toFixed(2)),
          updatedAt: serverTimestamp(),
        });
      }
    });

    if (targetAgentId) {
      void createNotificationBestEffort(targetAgentId, {
        title:
          params.decision === 'completed'
            ? `تم تحويل أرباحك بنجاح (${targetAmount} ج.م)`
            : `تم رفض طلب سحب (${targetAmount} ج.م) وإرجاع المبلغ لمحفظتك`,
        body:
          params.decision === 'completed'
            ? 'تمت مراجعة واعتماد طلب السحب وتحويل المبلغ إلى حسابك.'
            : `السبب: ${cleanReason}`,
        type: 'system',
      });
    }

    void recordAuditLogInFirestore({
      actionType:
        params.decision === 'completed' ? 'approve_payout' : 'reject_payout',
      targetId: params.requestId,
      details:
        params.decision === 'completed'
          ? `اعتماد وتحويل طلب سحب بقيمة ${targetAmount} ج.م لمسؤول المبيعات "${targetAgentName}".`
          : `رفض طلب سحب بقيمة ${targetAmount} ج.م لمسؤول المبيعات "${targetAgentName}" وإرجاع الرصيد (${cleanReason}).`,
    });
  } catch (error) {
    if (isArabicBusinessError(error)) throw error;
    logFirestoreFailure(
      'payout_requests',
      params.requestId,
      'resolvePayoutRequestByAdmin',
      error
    );
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `payout_requests/${params.requestId}`
    );
  }
}

/* ============================================================================
 * ADMIN SECURE PASSWORD RESET & LOGIN EMAIL UPDATE (NO PLAINTEXT PASSWORDS)
 * ========================================================================== */

export async function adminSendPasswordResetLinkInFirestore(
  paramsOrEmail:
    | string
    | {
        email: string;
        targetId?: string;
        targetName?: string;
      }
): Promise<string> {
  const cleanEmail = (
    typeof paramsOrEmail === 'string' ? paramsOrEmail : paramsOrEmail.email
  )
    .trim()
    .toLowerCase();
  const targetId =
    typeof paramsOrEmail === 'object' && paramsOrEmail.targetId
      ? paramsOrEmail.targetId
      : cleanEmail;
  const targetName =
    typeof paramsOrEmail === 'object' && paramsOrEmail.targetName
      ? paramsOrEmail.targetName
      : 'مستخدم إدكاوي';

  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('لا يوجد بريد إلكتروني صالح مسجل لهذا الحساب.');
  }
  if (cleanEmail.endsWith('@adkawy.com')) {
    throw new Error(
      'هذا الحساب لا يزال يستخدم بريداً داخلياً (@adkawy.com). استخدم زر «تحديث البريد الإلكتروني» أولاً لربطه ببريد حقيقي ثم أرسل رابط إعادة التعيين.'
    );
  }

  auth.languageCode = 'ar';
  const actionCodeSettings = {
    url: resolvePublicAppOrigin(),
    handleCodeInApp: false,
  };
  await sendPasswordResetEmail(auth, cleanEmail, actionCodeSettings);

  void recordAuditLogInFirestore({
    actionType: 'admin_password_reset_link',
    targetId,
    details: `إرسال رابط إعادة تعيين كلمة المرور من تطبيق إدكاوي إلى "${targetName}" (${cleanEmail}).`,
  });

  return `تم إرسال رابط إعادة تعيين كلمة المرور باسم تطبيق إدكاوي إلى ${cleanEmail}`;
}

export async function adminUpdateAccountLoginEmailInFirestore(
  paramsOrUid:
    | string
    | {
        adminUid?: string;
        accountType?: 'store' | 'courier' | 'sales_agent' | 'customer';
        targetId: string;
        targetName: string;
        newEmail: string;
      },
  newEmailArg?: string,
  targetNameArg?: string
): Promise<string> {
  const resolvedTargetId =
    typeof paramsOrUid === 'string' ? paramsOrUid : paramsOrUid.targetId;
  const resolvedNewEmail = (
    typeof paramsOrUid === 'string' ? newEmailArg ?? '' : paramsOrUid.newEmail
  )
    .trim()
    .toLowerCase()
    .slice(0, 100);
  const resolvedTargetName = (
    typeof paramsOrUid === 'string'
      ? targetNameArg ?? 'حساب إدكاوي'
      : paramsOrUid.targetName
  ).slice(0, 80);
  const resolvedAdminUid =
    typeof paramsOrUid === 'object' && paramsOrUid.adminUid
      ? paramsOrUid.adminUid
      : auth.currentUser?.uid || 'admin';
  const resolvedAccountType =
    typeof paramsOrUid === 'object' && paramsOrUid.accountType
      ? paramsOrUid.accountType
      : 'store';

  const cleanEmail = resolvedNewEmail;
  if (
    cleanEmail.length < 5 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) ||
    cleanEmail.endsWith('@adkawy.com') ||
    cleanEmail === OFFICIAL_ADMIN_PORTAL_EMAIL
  ) {
    throw new Error('يرجى إدخال بريد إلكتروني حقيقي وصحيح لاستلام رسائل تطبيق إدكاوي.');
  }

  const params = {
    adminUid: resolvedAdminUid,
    accountType: resolvedAccountType,
    targetId: resolvedTargetId,
    targetName: resolvedTargetName,
    newEmail: cleanEmail,
  };

  await waitForFirestoreWarmup();

  // Provision a fresh Firebase Auth identity for the new email via isolated secondary app
  // with a strong random temporary password, then immediately send an official Firebase password reset link
  // so the user sets their own private password without Admin ever seeing it!
  const tempPassword = `Edk#${Math.floor(100000 + Math.random() * 900000)}!Aa`;
  let linkedUid: string | null = null;
  try {
    linkedUid = await createSecondaryAuthUser(cleanEmail, tempPassword, {
      displayName: params.targetName,
      sendVerification:
        params.accountType === 'store' || params.accountType === 'sales_agent',
    });
  } catch (err) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code)
        : '';
    if (code !== 'auth/email-already-in-use') {
      throw err;
    }
  }

  if (params.accountType === 'store') {
    const storeRef = doc(db, 'stores', params.targetId);
    const storeSnap = await getDocWithRetry(storeRef, 'stores', params.targetId);
    if (!storeSnap.exists()) {
      throw new Error('المتجر المطلوب غير موجود.');
    }
    const storeData = storeSnap.data() ?? {};
    const nextOwnerUid = linkedUid || String(storeData.ownerUid ?? params.adminUid);

    const batch = writeBatch(db);
    batch.update(storeRef, {
      loginEmail: cleanEmail,
      ownerUid: nextOwnerUid,
    });
    const credRef = doc(db, 'storeCredentials', params.targetId);
    const credSnap = await getDoc(credRef).catch(() => null);
    if (credSnap?.exists()) {
      const cd = credSnap.data() ?? {};
      batch.set(credRef, {
        storeId: params.targetId,
        storeName: String(cd.storeName ?? params.targetName).slice(0, 80),
        phone: normalizeEgyptPhoneOrEmpty(String(cd.phone ?? '01000000000')) || '01000000000',
        loginEmail: cleanEmail,
        generatedPassword: 'تم الإرسال عبر البريد',
        ownerUid: nextOwnerUid,
        createdBy: String(cd.createdBy ?? params.adminUid),
        createdAt: cd.createdAt ?? serverTimestamp(),
      });
    }
    if (linkedUid) {
      batch.set(doc(db, 'users', linkedUid), {
        role: 'store',
        storeId: params.targetId,
        name: params.targetName.slice(0, 80),
        email: cleanEmail,
        requiresEmailVerification: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } else if (params.accountType === 'courier') {
    const courierRef = doc(db, 'couriers', params.targetId);
    const courierSnap = await getDoc(courierRef);
    if (courierSnap.exists()) {
      await updateDoc(courierRef, {
        email: cleanEmail,
        updatedAt: serverTimestamp(),
      });
    }
    const userRef = doc(db, 'users', params.targetId);
    const userSnap = await getDoc(userRef).catch(() => null);
    if (userSnap?.exists()) {
      await updateDoc(userRef, {
        email: cleanEmail,
        updatedAt: serverTimestamp(),
      });
    }
  } else if (params.accountType === 'sales_agent') {
    const agentRef = doc(db, 'sales_agents', params.targetId);
    const agentSnap = await getDoc(agentRef);
    if (agentSnap.exists()) {
      await updateDoc(agentRef, {
        email: cleanEmail,
        updatedAt: serverTimestamp(),
      });
    }
    const userRef = doc(db, 'users', params.targetId);
    const userSnap = await getDoc(userRef).catch(() => null);
    if (userSnap?.exists()) {
      await updateDoc(userRef, {
        email: cleanEmail,
        updatedAt: serverTimestamp(),
      });
    }
  } else {
    const userRef = doc(db, 'users', params.targetId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      await updateDoc(userRef, {
        email: cleanEmail,
        updatedAt: serverTimestamp(),
      });
    }
  }

  void syncRegisteredAccountMarker(cleanEmail, params.accountType);

  auth.languageCode = 'ar';
  const actionCodeSettings = {
    url: resolvePublicAppOrigin(),
    handleCodeInApp: false,
  };
  await sendPasswordResetEmail(auth, cleanEmail, actionCodeSettings).catch(() => {});

  void recordAuditLogInFirestore({
    actionType: 'admin_update_login_email',
    targetId: params.targetId,
    details: `تحديث البريد الإلكتروني لحساب "${params.targetName}" إلى ${cleanEmail} وإرسال رابط تعيين كلمة المرور من تطبيق إدكاوي.`,
  });

  return `تم تحديث البريد الإلكتروني إلى ${cleanEmail} وإرسال رابط تعيين كلمة المرور باسم تطبيق إدكاوي بنجاح.`;
}

/* ============================================================================
 * EMAIL VERIFICATION, GOOGLE PLAY REVIEW PROMPT & SELF-SERVICE ACCOUNT DELETION
 * ========================================================================== */

export async function resendVerificationEmailForCurrentUser(): Promise<string> {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) {
    throw new Error('يرجى تسجيل الدخول بحسابك أولاً.');
  }
  auth.languageCode = 'ar';
  const actionCodeSettings = {
    url: resolvePublicAppOrigin(),
    handleCodeInApp: false,
  };
  await sendEmailVerification(user, actionCodeSettings);
  return `تم إرسال رابط تأكيد البريد الإلكتروني من تطبيق إدكاوي إلى ${user.email ?? 'بريدك'} بنجاح.`;
}

export async function reloadCurrentUserEmailVerified(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  await reload(user);
  const isVerified = Boolean(auth.currentUser?.emailVerified);
  if (isVerified && isValidFirestoreId(user.uid)) {
    await updateDoc(doc(db, 'users', user.uid), {
      requiresEmailVerification: false,
      updatedAt: serverTimestamp(),
    }).catch(() => {});
  }
  return isVerified;
}

export async function markGooglePlayReviewPromptShownInFirestore(
  uid: string
): Promise<void> {
  if (!uid || !isValidFirestoreId(uid)) return;
  try {
    await updateDoc(doc(db, 'users', uid), {
      lastReviewPromptAtIso: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal
  }
}

export async function deleteCurrentAccountCompletely(): Promise<void> {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) {
    throw new Error('يرجى تسجيل الدخول بحساب مسجل لحذفه نهائياً.');
  }
  const uid = user.uid;
  const normalizedEmail = (user.email ?? '').trim().toLowerCase();

  await waitForFirestoreWarmup();

  // Delete PII & operational documents owned by this user before deleting Auth account
  try {
    if (normalizedEmail && normalizedEmail.includes('@')) {
      const emailHash = await computeEmailSha256Hex(normalizedEmail);
      await deleteDoc(doc(db, 'registeredAccounts', emailHash)).catch(() => {});
    }
    await deleteDoc(doc(db, 'customerDirectory', uid)).catch(() => {});
    await deleteDoc(doc(db, 'couriers', uid)).catch(() => {});
    await deleteDoc(doc(db, 'courierDirectory', uid)).catch(() => {});
    await deleteDoc(doc(db, 'sales_agents', uid)).catch(() => {});
    await deleteDoc(doc(db, 'salesAgentDirectory', uid)).catch(() => {});
    await deleteDoc(doc(db, 'users', uid)).catch(() => {});
  } catch {
    // Proceed to Auth deletion
  }

  try {
    await deleteUser(user);
  } catch (err) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code)
        : '';
    if (code === 'auth/requires-recent-login') {
      await signOut(auth).catch(() => {});
      throw new Error(
        'تم مسح بيانات ملفك الشخصي بنجاح. لإتمام حذف البريد من المصادقة نهائياً، يرجى تسجيل الدخول مرة أخيرة ثم الضغط على حذف الحساب.'
      );
    }
    await signOut(auth).catch(() => {});
  }

  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(ROLE_SESSION_CACHE_KEY);
    } catch {
      // Ignore
    }
  }
}

/* ============================================================================
 * ADMIN PORTAL WRAPPERS & EXPORTS (INVITATIONS, SALES AGENTS, PAYOUTS, ZONES)
 * ========================================================================== */

export async function adminCreateInvitationInFirestore(
  email: string,
  userType: UserRole | InvitationUserType,
  adminUid = ''
): Promise<{ inviteLink: string; token: string }> {
  const invType: InvitationUserType =
    userType === 'store' ||
    userType === 'courier' ||
    userType === 'sales_agent' ||
    userType === 'customer'
      ? userType
      : 'customer';

  const res = await createInvitationInFirestore(
    { email, userType: invType },
    {
      uid: adminUid || auth.currentUser?.uid || 'admin_manual',
      name: 'إدارة إدكاوي',
      role: 'admin',
    }
  );

  return {
    inviteLink:
      res.emailDelivery.inviteUrl ||
      buildInvitationRegistrationUrl(res.invitation.token, invType),
    token: res.invitation.token,
  };
}

export async function adminResendInvitationInFirestore(
  inviteIdOrToken: string
): Promise<void> {
  const token = inviteIdOrToken.trim();
  const snap = await getDoc(doc(db, 'invitations', token));
  if (!snap.exists()) {
    throw new Error('لم يتم العثور على الدعوة المطلوبة.');
  }
  const parsed = parseInvitationDoc(snap);
  await resendInvitationEmailInFirestore(parsed, true);
}

export function listenToAdminInvitations(
  onData: (invitations: InvitationRecord[]) => void
): Unsubscribe {
  return listenToAllInvitationsForAdmin(onData);
}

export function listenToAdminSalesAgents(
  onData: (agents: SalesAgentProfileRecord[]) => void
): Unsubscribe {
  return listenToSalesAgentsForAdmin((agents) => {
    onData(agents as SalesAgentProfileRecord[]);
  });
}

export async function adminUpdateSalesAgentCommissionInFirestore(
  agentId: string,
  commissionRatePercent: number
): Promise<void> {
  await updateSalesAgentCommissionRateInFirestore(
    agentId,
    commissionRatePercent
  );
}

export function listenToAdminPayoutRequests(
  onData: (requests: PayoutRequestRecord[]) => void
): Unsubscribe {
  return listenToAllPayoutRequestsForAdmin(onData);
}

export async function adminProcessPayoutRequestInFirestore(
  requestId: string,
  status: 'paid' | 'rejected' | 'completed',
  rejectionReason?: string
): Promise<void> {
  const decision = status === 'rejected' ? 'rejected' : 'completed';
  await resolvePayoutRequestByAdminInFirestore({
    requestId,
    adminUid: auth.currentUser?.uid || 'admin',
    decision,
    rejectionReason,
  });
}

export async function updateEdkoZoneInFirestore(
  zoneId: string,
  updates: Partial<EdkoZoneRecord>
): Promise<void> {
  if (!isValidFirestoreId(zoneId)) return;
  await waitForFirestoreWarmup();
  const zRef = doc(db, 'edko_zones', zoneId);
  const nextFee = Math.trunc(
    Number(updates.deliveryFeeEgp ?? updates.deliveryFee ?? 15)
  );
  await updateDoc(zRef, {
    ...(Number.isFinite(nextFee) && nextFee >= 5
      ? { price: nextFee, deliveryFee: nextFee }
      : {}),
    ...(updates.name ? { name: updates.name } : {}),
    ...(typeof updates.isActive === 'boolean'
      ? { isActive: updates.isActive }
      : {}),
    updatedAt: serverTimestamp(),
  });
}

export async function updateSuperAppCategoryInFirestore(
  categoryId: string,
  updates: Partial<SuperAppCategoryRecord>
): Promise<void> {
  if (!isValidFirestoreId(categoryId)) return;
  await waitForFirestoreWarmup();
  const cRef = doc(db, 'categories', categoryId);
  const nextFee = updates.defaultDeliveryFeeEgp
    ? Math.trunc(Number(updates.defaultDeliveryFeeEgp))
    : undefined;
  await updateDoc(cRef, {
    ...(typeof nextFee === 'number' ? { defaultDeliveryFee: nextFee } : {}),
    ...(updates.name ? { name: updates.name } : {}),
    ...(typeof updates.isActive === 'boolean'
      ? { isActive: updates.isActive }
      : {}),
    updatedAt: serverTimestamp(),
  });
}

export async function incrementCourierWalletBalance(
  courierId: string,
  amount: number
): Promise<void> {
  if (!courierId || !isValidFirestoreId(courierId)) return;
  const inc = Math.max(0, Math.trunc(amount));
  if (inc <= 0) return;
  await waitForFirestoreWarmup();
  const ref = doc(db, 'couriers', courierId);
  const snap = await getDocWithRetry(ref, 'couriers', courierId);
  if (!snap.exists()) return;
  const current = Math.max(0, Number(snap.data()?.walletBalance ?? 0));
  await updateDoc(ref, {
    walletBalance: current + inc,
    updatedAt: serverTimestamp(),
  });
}

function parseStoreJoinRequestDoc(
  snap: DocumentSnapshot<DocumentData>
): StoreJoinRequestRecord | null {
  if (!snap.exists()) return null;
  const d = snap.data() ?? {};
  return {
    id: snap.id,
    storeName: String(d.storeName ?? ''),
    ownerName: String(d.ownerName ?? ''),
    phone: String(d.phone ?? ''),
    category: String(d.category ?? ''),
    subCategory: typeof d.subCategory === 'string' ? d.subCategory : undefined,
    neighborhood: String(d.neighborhood ?? ''),
    lat: typeof d.lat === 'number' ? d.lat : undefined,
    lng: typeof d.lng === 'number' ? d.lng : undefined,
    commercialRegisterImage:
      typeof d.commercialRegisterImage === 'string'
        ? d.commercialRegisterImage
        : undefined,
    ownerUid: typeof d.ownerUid === 'string' ? d.ownerUid : undefined,
    rejectReason:
      typeof d.rejectReason === 'string' ? d.rejectReason : undefined,
    status:
      d.status === 'approved' || d.status === 'rejected'
        ? d.status
        : 'pending',
    createdAtIso: toIsoString(d.createdAt),
    updatedAtIso: toIsoString(d.updatedAt),
  };
}

export async function submitStoreJoinRequestInFirestore(
  input: StoreJoinRequestInput
): Promise<string> {
  await waitForFirestoreWarmup();
  const ref = doc(collection(db, 'store_join_requests'));
  const currentUid = auth.currentUser?.uid;
  await setDoc(ref, {
    storeName: input.storeName.trim().slice(0, 100),
    ownerName: input.ownerName.trim().slice(0, 100),
    phone: input.phone.trim().slice(0, 20),
    category: input.category.trim().slice(0, 50),
    ...(input.subCategory ? { subCategory: input.subCategory.trim().slice(0, 50) } : {}),
    neighborhood: (input.neighborhood.trim() || 'شارع البحر').slice(0, 80),
    ...(typeof input.lat === 'number' ? { lat: input.lat } : {}),
    ...(typeof input.lng === 'number' ? { lng: input.lng } : {}),
    ...(input.commercialRegisterImage
      ? { commercialRegisterImage: input.commercialRegisterImage.slice(0, 1000000) }
      : {}),
    ...(currentUid && isValidFirestoreId(currentUid) ? { ownerUid: currentUid } : {}),
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export function listenToStoreJoinRequests(
  onData: (requests: StoreJoinRequestRecord[]) => void
): Unsubscribe {
  const q = query(collection(db, 'store_join_requests'));
  return onSnapshot(
    q,
    (snap) => {
      const items: StoreJoinRequestRecord[] = [];
      snap.forEach((d) => {
        const item = parseStoreJoinRequestDoc(d);
        if (item) items.push(item);
      });
      items.sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
      onData(items);
    },
    () => onData([])
  );
}

export async function approveStoreJoinRequestInFirestore(
  requestId: string,
  adminUid: string,
  adminName: string
): Promise<string> {
  if (!isValidFirestoreId(requestId)) throw new Error('معرف الطلب غير صالح');
  await waitForFirestoreWarmup();
  const reqRef = doc(db, 'store_join_requests', requestId);
  const snap = await getDocWithRetry(reqRef, 'store_join_requests', requestId);
  const data = parseStoreJoinRequestDoc(snap);
  if (!data) throw new Error('الطلب غير موجود');

  const storeRef = doc(collection(db, 'stores'));
  const imageKey = resolveStoreImageKeyForCategory(data.category as StoreCategory);
  const categoryId = resolveCategoryIdForStoreCategory(data.category as StoreCategory);
  const coords = data.lat && data.lng ? { lat: data.lat, lng: data.lng } : resolveEdkuCoordsForNeighborhood(data.neighborhood);

  const sanitizedRegImage = sanitizeOptionalImage(data.commercialRegisterImage);
  const batch = writeBatch(db);
  batch.set(storeRef, {
    name: data.storeName,
    category: data.category,
    categoryId,
    neighborhood: data.neighborhood,
    description: `متجر ${data.storeName} المعتمد في إدكو - ${data.category}`,
    deliveryFee: 15,
    deliveryTimeMinutes: 30,
    rating: 5.0,
    imageKey,
    ...(sanitizedRegImage ? { imageUrl: sanitizedRegImage } : {}),
    isActive: true,
    isOpen: true,
    lat: coords.lat,
    lng: coords.lng,
    prepTimeMinutes: 20,
    minOrderAmount: 30,
    menuItems: [
      {
        id: `item_${Date.now()}_1`,
        name: `صنف مميز من ${data.storeName}`,
        price: 50,
        description: 'صنف ترحيبي مميز مع افتتاح المتجر',
        category: data.subCategory || 'عام',
      },
    ],
    ...(data.ownerUid ? { ownerUid: data.ownerUid } : {}),
    createdBy: adminUid,
    createdAt: serverTimestamp(),
  });

  batch.update(reqRef, {
    status: 'approved',
    updatedAt: serverTimestamp(),
  });

  await batch.commit();

  await recordAuditLogInFirestore({
    adminId: adminUid,
    adminName,
    actionType: 'approve_store',
    details: `تمت الموافقة على طلب انضمام متجر "${data.storeName}" وإنشاء المتجر بمعرف ${storeRef.id}`,
    targetId: storeRef.id,
  }).catch(() => {});

  return storeRef.id;
}

export async function rejectStoreJoinRequestInFirestore(
  requestId: string,
  reason: string,
  adminUid: string,
  adminName: string
): Promise<void> {
  if (!isValidFirestoreId(requestId)) throw new Error('معرف الطلب غير صالح');
  await waitForFirestoreWarmup();
  const reqRef = doc(db, 'store_join_requests', requestId);
  await updateDoc(reqRef, {
    status: 'rejected',
    rejectReason: (reason.trim() || 'لم يتم استيفاء شروط الانضمام المطلوبة').slice(0, 300),
    updatedAt: serverTimestamp(),
  });

  await recordAuditLogInFirestore({
    adminId: adminUid,
    adminName,
    actionType: 'manage_category',
    details: `تم رفض طلب الانضمام رقم ${requestId}: ${reason}`,
    targetId: requestId,
  }).catch(() => {});
}

/* ============================================================================
 * CUSTOMER WALLET TOP-UPS, TRANSACTIONS & LIVE EVENTS TICKER
 * ========================================================================== */

function parseWalletTopupDoc(
  snap: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>
): WalletTopupRequestRecord {
  const d = snap.data() ?? {};
  return {
    id: String(d.id ?? snap.id),
    userId: String(d.userId ?? ''),
    userName: String(d.userName ?? 'عميل إدكاوي'),
    userPhone: String(d.userPhone ?? ''),
    amount: Math.max(0, Number(d.amount ?? 0)),
    method: d.method === 'instapay' ? 'instapay' : 'vodafone_cash',
    senderPhone: String(d.senderPhone ?? ''),
    referenceNumber: String(d.referenceNumber ?? ''),
    receiptImageUrl: sanitizeOptionalImage(
      typeof d.receiptImageUrl === 'string' ? d.receiptImageUrl : undefined
    ),
    status:
      d.status === 'approved' || d.status === 'rejected' ? d.status : 'pending',
    adminNote: typeof d.adminNote === 'string' ? d.adminNote : undefined,
    processedBy: typeof d.processedBy === 'string' ? d.processedBy : undefined,
    createdAtIso: toIsoString(d.createdAt),
    updatedAtIso: toIsoString(d.updatedAt),
  };
}

function parseWalletTransactionDoc(
  snap: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>
): WalletTransactionRecord {
  const d = snap.data() ?? {};
  const rawType = String(d.type ?? 'topup_credit');
  const type: WalletTransactionRecord['type'] =
    rawType === 'order_debit' || rawType === 'order_refund'
      ? rawType
      : 'topup_credit';
  return {
    id: String(d.id ?? snap.id),
    userId: String(d.userId ?? ''),
    type,
    amount: Math.max(0, Number(d.amount ?? 0)),
    balanceAfter: Math.max(0, Number(d.balanceAfter ?? 0)),
    description: String(d.description ?? ''),
    orderId: typeof d.orderId === 'string' ? d.orderId : undefined,
    requestId: typeof d.requestId === 'string' ? d.requestId : undefined,
    createdBy: String(d.createdBy ?? ''),
    createdAtIso: toIsoString(d.createdAt),
  };
}

export async function createWalletTopupRequestInFirestore(
  userUid: string,
  userProfile: { name: string; phone?: string },
  input: WalletTopupRequestInput
): Promise<string> {
  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    throw new Error('يرجى تسجيل الدخول أولاً لطلب شحن المحفظة.');
  }
  const amount = Math.trunc(Number(input.amount));
  if (!Number.isFinite(amount) || amount < 10 || amount > 50000) {
    throw new Error('مبلغ الشحن يجب أن يكون بين ١٠ و ٥٠,٠٠٠ ج.م.');
  }
  const senderPhone = input.senderPhone.trim().slice(0, 40);
  const referenceNumber = input.referenceNumber.trim().slice(0, 80);
  if (senderPhone.length < 4) {
    throw new Error('يرجى إدخال رقم المحفظة أو حساب إنستاباي المُحول منه.');
  }
  if (referenceNumber.length < 2) {
    throw new Error('يرجى إدخال رقم العملية المرجعي للتحويل.');
  }
  const cleanReceipt = sanitizeOptionalImage(input.receiptImageUrl);
  if (!cleanReceipt) {
    throw new Error('يرجى رفع صورة إيصال التحويل أولاً — رفع الإيصال إجباري.');
  }
  await waitForFirestoreWarmup();

  const reqRef = doc(collection(db, 'wallet_topup_requests'));
  try {
    await setDoc(reqRef, {
      id: reqRef.id,
      userId: userUid,
      userName: (userProfile.name.trim() || 'عميل إدكاوي').slice(0, 80),
      userPhone: (userProfile.phone ?? '').trim().slice(0, 20),
      amount,
      method: input.method === 'instapay' ? 'instapay' : 'vodafone_cash',
      senderPhone,
      referenceNumber,
      receiptImageUrl: cleanReceipt,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return reqRef.id;
  } catch (error) {
    logFirestoreFailure('wallet_topup_requests', reqRef.id, 'createWalletTopupRequest', error);
    handleFirestoreError(error, OperationType.CREATE, 'wallet_topup_requests');
  }
}

export function listenToCustomerWalletTopups(
  userUid: string,
  onData: (items: WalletTopupRequestRecord[]) => void
): Unsubscribe {
  if (!userUid || !isValidFirestoreId(userUid)) {
    onData([]);
    return () => {};
  }
  const q = query(
    collection(db, 'wallet_topup_requests'),
    where('userId', '==', userUid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map(parseWalletTopupDoc)
        .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
      onData(list);
    },
    (error) => {
      logFirestoreFailure('wallet_topup_requests', userUid, 'listenToCustomerWalletTopups', error);
      onData([]);
    }
  );
}

export function listenToAdminWalletTopups(
  onData: (items: WalletTopupRequestRecord[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'wallet_topup_requests'),
    (snap) => {
      const list = snap.docs
        .map(parseWalletTopupDoc)
        .sort((a, b) => {
          if (a.status === 'pending' && b.status !== 'pending') return -1;
          if (a.status !== 'pending' && b.status === 'pending') return 1;
          return b.createdAtIso.localeCompare(a.createdAtIso);
        });
      onData(list);
    },
    (error) => {
      logFirestoreFailure('wallet_topup_requests', '*', 'listenToAdminWalletTopups', error);
      onData([]);
    }
  );
}

export async function processWalletTopupByAdminInFirestore(params: {
  requestId: string;
  decision: 'approved' | 'rejected';
  adminUid: string;
  adminNote?: string;
}): Promise<void> {
  if (!isValidFirestoreId(params.requestId)) {
    throw new Error('معرف طلب الشحن غير صالح.');
  }
  await waitForFirestoreWarmup();
  const reqRef = doc(db, 'wallet_topup_requests', params.requestId);
  const cleanNote = (params.adminNote ?? '').trim().slice(0, 240);

  try {
    let resolvedUserId = '';
    let resolvedAmount = 0;
    let resolvedName = '';

    await runTransaction(db, async (tx) => {
      const reqSnap = await tx.get(reqRef);
      if (!reqSnap.exists()) {
        throw new Error('لم يتم العثور على طلب شحن المحفظة.');
      }
      const reqData = reqSnap.data() ?? {};
      if (reqData.status !== 'pending') {
        throw new Error('تمت مراجعة هذا الطلب مسبقاً.');
      }

      resolvedUserId = String(reqData.userId ?? '');
      resolvedAmount = Math.max(0, Number(reqData.amount ?? 0));
      resolvedName = String(reqData.userName ?? 'عميل إدكاوي');

      const userRef = doc(db, 'users', resolvedUserId);
      const userSnap =
        params.decision === 'approved' ? await tx.get(userRef) : null;

      tx.update(reqRef, {
        status: params.decision,
        ...(cleanNote ? { adminNote: cleanNote } : {}),
        processedBy: params.adminUid,
        updatedAt: serverTimestamp(),
      });

      if (params.decision === 'approved' && userSnap?.exists()) {
        const prevBalance = Math.max(0, Number(userSnap.data()?.walletBalance ?? 0));
        const nextBalance = Number((prevBalance + resolvedAmount).toFixed(2));
        tx.update(userRef, {
          walletBalance: nextBalance,
          updatedAt: serverTimestamp(),
        });
        const txRef = doc(collection(db, 'wallet_transactions'));
        tx.set(txRef, {
          id: txRef.id,
          userId: resolvedUserId,
          type: 'topup_credit',
          amount: resolvedAmount,
          balanceAfter: nextBalance,
          description: `شحن محفظة (${reqData.method === 'instapay' ? 'إنستاباي' : 'فودافون كاش'})`.slice(0, 200),
          requestId: params.requestId,
          createdBy: params.adminUid,
          createdAt: serverTimestamp(),
        });
      }
    });

    if (resolvedUserId) {
      void createNotificationBestEffort(resolvedUserId, {
        title:
          params.decision === 'approved'
            ? `تم اعتماد شحن محفظتك بمبلغ ${resolvedAmount} ج.م`
            : 'تعذر اعتماد طلب شحن المحفظة',
        body:
          params.decision === 'approved'
            ? 'تمت إضافة المبلغ إلى رصيد محفظتك في إدكاوي ويمكنك الدفع به الآن.'
            : cleanNote || 'يرجى التأكد من رقم العملية المرجعي والمحاولة مرة أخرى.',
        type: 'system',
      });
    }

    void recordAuditLogInFirestore({
      adminId: params.adminUid,
      actionType:
        params.decision === 'approved'
          ? 'approve_wallet_topup'
          : 'reject_wallet_topup',
      targetId: params.requestId,
      details: `${params.decision === 'approved' ? 'اعتماد' : 'رفض'} شحن محفظة للعميل "${resolvedName}" بمبلغ ${resolvedAmount} ج.م${cleanNote ? ` — ${cleanNote}` : ''}`,
    });
  } catch (error) {
    if (isArabicBusinessError(error)) throw error;
    logFirestoreFailure('wallet_topup_requests', params.requestId, 'processWalletTopupByAdmin', error);
    handleFirestoreError(error, OperationType.UPDATE, `wallet_topup_requests/${params.requestId}`);
  }
}

export function listenToCustomerWalletTransactions(
  userUid: string,
  onData: (items: WalletTransactionRecord[]) => void
): Unsubscribe {
  if (!userUid || !isValidFirestoreId(userUid)) {
    onData([]);
    return () => {};
  }
  const q = query(
    collection(db, 'wallet_transactions'),
    where('userId', '==', userUid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map(parseWalletTransactionDoc)
        .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
      onData(list);
    },
    (error) => {
      logFirestoreFailure('wallet_transactions', userUid, 'listenToCustomerWalletTransactions', error);
      onData([]);
    }
  );
}

export async function publishLiveEventInFirestore(input: {
  text: string;
  neighborhood: string;
  storeName: string;
  eventType?: 'new_order' | 'promo' | 'delivery';
}): Promise<void> {
  if (!auth.currentUser || auth.currentUser.isAnonymous) return;
  try {
    const evRef = doc(collection(db, 'live_events'));
    await setDoc(evRef, {
      id: evRef.id,
      text: input.text.trim().slice(0, 160),
      neighborhood: input.neighborhood.trim().slice(0, 60) || 'إدكو',
      storeName: input.storeName.trim().slice(0, 80) || 'إدكاوي',
      eventType: input.eventType ?? 'new_order',
      createdBy: auth.currentUser.uid,
      createdAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal ticker event
  }
}

export function listenToLiveEvents(
  onData: (events: LiveEventRecord[]) => void
): Unsubscribe {
  if (!auth.currentUser) {
    onData([]);
    return () => {};
  }
  const q = query(
    collection(db, 'live_events'),
    where('eventType', 'in', ['new_order', 'promo', 'delivery']),
    limit(15)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: LiveEventRecord[] = snap.docs
        .map((dSnap) => {
          const d = dSnap.data() ?? {};
          const rawType = String(d.eventType ?? 'new_order');
          return {
            id: dSnap.id,
            text: String(d.text ?? ''),
            neighborhood: String(d.neighborhood ?? 'إدكو'),
            storeName: String(d.storeName ?? 'إدكاوي'),
            eventType: (
              rawType === 'promo' || rawType === 'delivery'
                ? rawType
                : 'new_order'
            ) as LiveEventRecord['eventType'],
            createdAtIso: toIsoString(d.createdAt),
          };
        })
        .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
      onData(list);
    },
    () => {
      onData([]);
    }
  );
}

