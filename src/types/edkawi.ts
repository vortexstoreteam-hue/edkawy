export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export type PortalRole =
  | 'customer'
  | 'store'
  | 'courier'
  | 'sales_agent'
  | 'admin'
  | 'support_agent'
  | 'operations';

export interface SavedAddressItem {
  id: string;
  label: string;
  neighborhood: string;
  address: string;
  lat?: number;
  lng?: number;
  isDefault?: boolean;
}

export type CustomerBanType = 'temporary_24h' | 'suspended' | 'permanent';

export interface UserProfileRecord {
  uid: string;
  role: PortalRole;
  customerCode?: string;
  referralCode?: string;
  referredByCode?: string;
  referredByAgentId?: string;
  requiresEmailVerification?: boolean;
  lastReviewPromptAtIso?: string;
  isBanned?: boolean;
  banReason?: string;
  email?: string;
  name?: string;
  phone?: string;
  defaultNeighborhood?: string;
  defaultAddress?: string;
  defaultLat?: number;
  defaultLng?: number;
  profileCompleted?: boolean;
  favoriteStoreIds?: string[];
  savedAddresses?: SavedAddressItem[];
  darkMode?: boolean;
  storeId?: string;
  points?: number;
  loyaltyPoints?: number;
  currentStreak?: number;
  freeDeliveryRewards?: number;
  lastDeliveredOrderAtIso?: string;
  lastSpinDate?: string;
  walletBalance?: number;
  totalSpentEgp?: number;
  customerReferralCode?: string;
  banType?: CustomerBanType;
  banUntilIso?: string;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface CustomerDirectoryEntry {
  uid: string;
  name: string;
  customerCode?: string;
  isBanned?: boolean;
  banReason?: string;
  neighborhood?: string;
  points: number;
  currentStreak: number;
  freeDeliveryRewards: number;
  totalDeliveredOrders: number;
  totalSpentEgp?: number;
  banType?: CustomerBanType;
  banUntilIso?: string;
  lastDeliveredOrderAtIso?: string;
  updatedAtIso: string;
}

export interface AdminCustomerRecord extends CustomerDirectoryEntry {
  email?: string;
  phone?: string;
  defaultAddress?: string;
  walletBalance?: number;
  createdAtIso?: string;
}

export interface CompleteProfileInput {
  name: string;
  phone: string;
  defaultNeighborhood: string;
  defaultAddress: string;
  defaultLat?: number;
  defaultLng?: number;
}

export type CourierApprovalStatus = 'pending' | 'approved' | 'rejected';

export type StoreCategory =
  | 'أسماك وبحريات'
  | 'مشويات ومطاعم'
  | 'مخابز وفطائر'
  | 'سوبر ماركت'
  | 'صيدليات'
  | 'أكل بيتي'
  | 'مستحضرات تجميل'
  | 'أدوات منزلية'
  | 'ملابس'
  | 'هدايا وإكسسوارات';

export type StoreImageKey =
  | 'seafood'
  | 'grills'
  | 'bakery'
  | 'grocery'
  | 'pharmacy'
  | 'home_food'
  | 'cosmetics'
  | 'household'
  | 'clothing'
  | 'gifts';

export type AdImageKey =
  | 'promo_seafood'
  | 'promo_grills'
  | 'seafood'
  | 'grills'
  | 'bakery'
  | 'grocery'
  | 'pharmacy'
  | 'home_food'
  | 'cosmetics'
  | 'household'
  | 'clothing'
  | 'gifts';

export type ProductImageKey =
  | 'seafood'
  | 'grills'
  | 'bakery'
  | 'grocery'
  | 'pharmacy'
  | 'home_food'
  | 'cosmetics'
  | 'household'
  | 'clothing'
  | 'gifts'
  | 'hero_seafood'
  | 'shrimp_casserole'
  | 'hawawshi_grill'
  | 'savory_feteer'
  | 'dairy_cheese';

export type EdkoZoneId = 'zone_1' | 'zone_2' | 'zone_3' | 'zone_4' | 'zone_5';

export interface EdkoZoneRecord {
  id: EdkoZoneId;
  zoneNumber: number;
  name: string;
  nameAr?: string;
  distanceRangeLabel: string;
  distanceRangeKm?: string;
  kmRange?: string;
  areaTitle: string;
  coverageTextAr?: string;
  streetsAndNeighborhoods: string[];
  neighborhoods?: string[];
  deliveryFee: number;
  deliveryFeeEgp?: number;
  isActive: boolean;
  updatedBy?: string;
  updatedAtIso?: string;
}

export interface SuperAppCategoryRecord {
  id: string;
  name: string;
  titleAr?: string;
  descriptionAr?: string;
  storeCategory: StoreCategory;
  icon: string;
  isActive: boolean;
  sortOrder: number;
  defaultDeliveryFeeEgp?: number;
  updatedAtIso?: string;
}

export interface ProductVariant {
  variantId: string;
  name: string;
  size?: string;
  color?: string;
  shade?: string;
  price: number;
  stock: number;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  imageKey?: ProductImageKey;
  imageUrl?: string;
  category?: string;
  description?: string;
  stockQuantity?: number;
  hasVariants?: boolean;
  variants?: ProductVariant[];
  isMysteryBox?: boolean;
  originalValueEgp?: number;
  isFlashSale?: boolean;
  flashDiscountPercent?: number;
  flashSaleEndsAtIso?: string;
}

export interface StoreRecord {
  id: string;
  name: string;
  category: StoreCategory;
  categoryId?: string;
  isHomeFood?: boolean;
  neighborhood: string;
  description: string;
  deliveryFee: number;
  deliveryTimeMinutes: number;
  rating: number;
  reviewCount?: number;
  ratingSum?: number;
  lat?: number;
  lng?: number;
  imageKey: StoreImageKey;
  imageUrl?: string;
  isActive: boolean;
  isOpen?: boolean;
  isManuallyClosed?: boolean;
  openingTime?: string;
  closingTime?: string;
  prepTimeMinutes?: number;
  minOrderAmount?: number;
  menuItems: MenuItem[];
  ownerUid?: string;
  loginEmail?: string;
  referredByAgentId?: string;
  referredByCode?: string;
  createdBy: string;
  createdAtIso: string;
}

export interface StoreOperationalSettingsInput {
  prepTimeMinutes: number;
  minOrderAmount: number;
  isOpen: boolean;
  isManuallyClosed?: boolean;
  openingTime?: string;
  closingTime?: string;
  isHomeFood?: boolean;
  categoryId?: string;
  neighborhood?: string;
  lat?: number;
  lng?: number;
  imageUrl?: string;
}

export interface StoreCredentialRecord {
  storeId: string;
  storeName: string;
  phone: string;
  loginEmail: string;
  generatedPassword: string;
  ownerUid: string;
  createdBy: string;
  createdAtIso: string;
}

export interface ProductRecord {
  id: string;
  storeId: string;
  storeOwnerId?: string;
  name: string;
  description: string;
  category: string;
  price: number;
  imageKey: ProductImageKey;
  imageUrl?: string;
  stockQuantity?: number;
  hasVariants?: boolean;
  variants?: ProductVariant[];
  isMysteryBox?: boolean;
  originalValueEgp?: number;
  isFlashSale?: boolean;
  flashDiscountPercent?: number;
  flashSaleEndsAtIso?: string;
  isAvailable: boolean;
  createdBy: string;
  createdAtIso: string;
}

export interface NewStoreInput {
  name: string;
  category: StoreCategory;
  categoryId?: string;
  isHomeFood?: boolean;
  neighborhood: string;
  description: string;
  deliveryFee: number;
  deliveryTimeMinutes: number;
  imageKey?: StoreImageKey;
  imageUrl: string;
  lat?: number;
  lng?: number;
  firstItemName: string;
  firstItemPrice: number;
  firstItemImageUrl?: string;
  secondItemName?: string;
  secondItemPrice?: number;
}

export interface AdminCreateStoreInput {
  name: string;
  phone: string;
  category: StoreCategory;
  categoryId?: string;
  isHomeFood?: boolean;
  neighborhood?: string;
  description?: string;
  deliveryFee?: number;
  deliveryTimeMinutes?: number;
  imageUrl: string;
  lat?: number;
  lng?: number;
  firstItemName?: string;
  firstItemPrice?: number;
  firstItemImageUrl?: string;
}

export interface NewProductInput {
  storeId: string;
  name: string;
  description: string;
  category: string;
  price: number;
  imageKey?: ProductImageKey;
  imageUrl: string;
  stockQuantity?: number;
  hasVariants?: boolean;
  variants?: ProductVariant[];
  isMysteryBox?: boolean;
  originalValueEgp?: number;
  isFlashSale?: boolean;
  flashDiscountPercent?: number;
  flashSaleEndsAtIso?: string;
}

export interface CartItem {
  cartItemId?: string;
  storeId: string;
  storeName: string;
  deliveryFee: number;
  item: MenuItem;
  selectedVariant?: ProductVariant;
  quantity: number;
}

export type OrderStatus =
  | 'awaiting_pharmacy_quote'
  | 'awaiting_customer_approval'
  | 'awaiting_courier_quote'
  | 'awaiting_customer_errand_approval'
  | 'pending'
  | 'pending_payment'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'on_the_way'
  | 'delivering'
  | 'delivered'
  | 'cancelled';

export type OrderType = 'standard' | 'pharmacy_prescription' | 'custom_errand';

export type PaymentMethod = 'cash' | 'wallet' | 'visa' | 'cash_on_delivery';

export interface OrderItemPayload {
  productId: string;
  variantId?: string;
  variantLabel?: string;
  participantUid?: string;
  participantName?: string;
  name: string;
  price: number;
  quantity: number;
}

export interface OrderRecord {
  id: string;
  orderType?: OrderType;
  prescriptionImageUrl?: string;
  prescriptionMedicineRequest?: string;
  pharmacistNote?: string;
  errandDescription?: string;
  errandPickupAddress?: string;
  customerId: string;
  storeId: string;
  storeOwnerId?: string;
  storeName: string;
  storeLat?: number;
  storeLng?: number;
  customerName: string;
  customerPhone: string;
  deliveryNeighborhood: string;
  deliveryAddress: string;
  zoneId?: EdkoZoneId;
  zoneName?: string;
  customerLat?: number;
  customerLng?: number;
  isScheduled?: boolean;
  scheduledForIso?: string;
  groupCartId?: string;
  groupSessionId?: string;
  items: OrderItemPayload[];
  itemsSummary: string;
  itemNames: string[];
  itemCount: number;
  subtotal: number;
  couponCode?: string;
  discountPercent?: number;
  discountAmount?: number;
  deliveryFee: number;
  smallOrderFee?: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  prepTimeMinutes?: number;
  courierId?: string;
  courierName?: string;
  courierPhone?: string;
  courierLocation?: string;
  courierLat?: number;
  courierLng?: number;
  cancelledByCourierIds?: string[];
  rejectedBy?: string[];
  tipAmountEgp?: number;
  isTipped?: boolean;
  isTestSimulation?: boolean;
  isReviewed?: boolean;
  pointsEarned?: number;
  pointsAwarded?: boolean;
  notes: string;
  createdAtIso: string;
  updatedAtIso?: string;
  deliveredAtIso?: string;
}

export interface DispatchTicketRecord {
  id: string;
  orderId: string;
  orderType?: OrderType;
  pharmacistNote?: string;
  errandDescription?: string;
  errandPickupAddress?: string;
  customerId: string;
  storeId: string;
  storeOwnerId?: string;
  storeName: string;
  storeNeighborhood: string;
  storeLat?: number;
  storeLng?: number;
  deliveryNeighborhood: string;
  zoneId?: EdkoZoneId;
  zoneName?: string;
  customerLat?: number;
  customerLng?: number;
  isScheduled?: boolean;
  scheduledForIso?: string;
  itemsSummary: string;
  subtotal: number;
  couponCode?: string;
  discountPercent?: number;
  discountAmount?: number;
  deliveryFee: number;
  smallOrderFee?: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  prepTimeMinutes?: number;
  courierId?: string;
  courierName?: string;
  courierLat?: number;
  courierLng?: number;
  cancelledByCourierIds?: string[];
  rejectedBy?: string[];
  isTestSimulation?: boolean;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface PharmacyPrescriptionOrderInput {
  customerName: string;
  customerPhone: string;
  deliveryNeighborhood: string;
  deliveryAddress: string;
  zoneId?: EdkoZoneId;
  zoneName?: string;
  zoneDeliveryFee?: number;
  customerLat: number;
  customerLng: number;
  prescriptionImageUrl?: string;
  medicineRequest?: string;
  notes?: string;
}

export type CourierVehicleType =
  | 'دراجة نارية'
  | 'سكوتر كهربائي'
  | 'دراجة هوائية';

export interface CourierRecord {
  id: string;
  name: string;
  phone: string;
  email?: string;
  vehicleType: CourierVehicleType;
  neighborhood: string;
  lat?: number;
  lng?: number;
  rating?: number;
  reviewCount?: number;
  ratingSum?: number;
  walletBalance?: number;
  totalTipsEgp?: number;
  isAvailable: boolean;
  approvalStatus: CourierApprovalStatus;
  completedDeliveries: number;
  cancelledDeliveries?: number;
  updatedBy: string;
  updatedAtIso: string;
}

export interface CourierProfileInput {
  name: string;
  phone: string;
  vehicleType: CourierVehicleType;
  neighborhood: string;
  lat?: number;
  lng?: number;
  isAvailable: boolean;
}

export interface CourierRegisterInput {
  name: string;
  phone: string;
  email: string;
  password: string;
  vehicleType: CourierVehicleType;
  neighborhood: string;
  lat?: number;
  lng?: number;
}

export type AdminCreateCourierInput = CourierRegisterInput;

export interface CourierCredentialRecord {
  courierId: string;
  name: string;
  phone: string;
  loginEmail: string;
  password: string;
}

export interface AdBannerRecord {
  id: string;
  title: string;
  subtitle: string;
  badgeText: string;
  imageKey: AdImageKey;
  imageUrl?: string;
  storeId?: string;
  storeName?: string;
  ctaLabel?: string;
  startDateIso?: string;
  endDateIso?: string;
  isActive: boolean;
  sortOrder: number;
  createdBy: string;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface AdBannerInput {
  title: string;
  subtitle: string;
  badgeText: string;
  imageKey?: AdImageKey;
  imageUrl: string;
  storeId?: string;
  storeName?: string;
  ctaLabel?: string;
  startDateIso?: string;
  endDateIso?: string;
  isActive: boolean;
  sortOrder?: number;
}

export interface CouponRecord {
  id: string;
  code: string;
  discountPercent: number;
  maxDiscountEgp: number;
  minOrderEgp: number;
  description: string;
  expiryDateIso?: string;
  pointsCost?: number;
  isUsed?: boolean;
  usedBy?: string;
  isActive: boolean;
  createdBy: string;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface CouponInput {
  code: string;
  discountPercent: number;
  maxDiscountEgp: number;
  minOrderEgp: number;
  description: string;
  expiryDateIso?: string;
  pointsCost?: number;
  isActive: boolean;
}

export interface AppliedCoupon {
  code: string;
  discountPercent: number;
  maxDiscountEgp: number;
  minOrderEgp: number;
  description: string;
  expiryDateIso?: string;
  pointsCost?: number;
  isUsed?: boolean;
}

export interface ReviewRecord {
  id: string;
  orderId: string;
  storeId: string;
  courierId?: string;
  courierName?: string;
  customerId: string;
  customerName: string;
  storeRating: number;
  courierRating?: number;
  comment: string;
  createdAtIso: string;
}

export interface ReviewSubmitInput {
  orderId: string;
  storeId: string;
  courierId?: string;
  courierName?: string;
  customerName: string;
  storeRating: number;
  courierRating?: number;
  comment?: string;
}

export type AppNotificationType = 'order_update' | 'promo' | 'system';

export type BroadcastAudience =
  | 'all'
  | 'customer'
  | 'store'
  | 'courier'
  | 'specific_user';

export interface AdminNotificationSendInput {
  audience: BroadcastAudience;
  recipientUid?: string;
  title: string;
  body: string;
  type: AppNotificationType;
}

export interface AppNotificationRecord {
  id: string;
  recipientUid: string;
  audience?: BroadcastAudience;
  title: string;
  body: string;
  type: AppNotificationType;
  orderId?: string;
  isRead: boolean;
  createdBy: string;
  createdAtIso: string;
}

export type CampaignType =
  | 'streak_5'
  | 'happy_hour'
  | 'points_multiplier'
  | 'neighborhood_challenge'
  | 'mystery_box';

export interface CampaignRecord {
  id: string;
  title: string;
  subtitle: string;
  badgeText: string;
  campaignType: CampaignType;
  multiplier?: number;
  discountPercent?: number;
  targetNeighborhood?: string;
  startHour?: number;
  endHour?: number;
  rewardPoints?: number;
  imageUrl: string;
  isActive: boolean;
  createdBy: string;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface CampaignInput {
  title: string;
  subtitle: string;
  badgeText: string;
  campaignType: CampaignType;
  multiplier?: number;
  discountPercent?: number;
  targetNeighborhood?: string;
  startHour?: number;
  endHour?: number;
  rewardPoints?: number;
  imageUrl: string;
  isActive: boolean;
}

export interface SharedCartItemEntry {
  entryId: string;
  participantUid: string;
  participantName: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface SharedCartChatMessage {
  id: string;
  senderUid: string;
  senderName: string;
  text: string;
  timestampIso: string;
}

export interface SharedCartRecord {
  id: string;
  roomCode?: string;
  hostUid: string;
  hostName: string;
  storeId: string;
  storeName: string;
  storeDeliveryFee: number;
  status: 'open' | 'checked_out' | 'cancelled';
  items: SharedCartItemEntry[];
  chatMessages?: SharedCartChatMessage[];
  createdAtIso: string;
  updatedAtIso: string;
}

export interface StoreJoinRequestRecord {
  id: string;
  storeName: string;
  ownerName: string;
  phone: string;
  category: string;
  subCategory?: string;
  neighborhood: string;
  lat?: number;
  lng?: number;
  commercialRegisterImage?: string;
  ownerUid?: string;
  rejectReason?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAtIso: string;
  updatedAtIso: string;
}

export interface StoreJoinRequestInput {
  storeName: string;
  ownerName: string;
  phone: string;
  category: string;
  subCategory?: string;
  neighborhood: string;
  lat?: number;
  lng?: number;
  commercialRegisterImage?: string;
}


export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  suggestedStoreId?: string | null;
  createdAtIso: string;
}

export interface AiAssistantApiResponse {
  ok: boolean;
  reply: string;
  suggestedStoreId?: string | null;
  error?: string;
}

export interface AdminOtpRequestResult {
  ok: boolean;
  delivery?: 'edkawy_mail' | 'gmail' | 'server_otp_fallback';
  recipient?: string;
  expiresInSeconds?: number;
  fallbackOtpCode?: string;
  smtpSetupHint?: string;
  error?: string;
}

export interface AdminOtpVerifyResult {
  ok: boolean;
  adminEmail?: string;
  adminBootstrapGate?: string;
  verifiedAt?: string;
  error?: string;
}

export interface CheckoutFormInput {
  customerName: string;
  customerPhone: string;
  deliveryNeighborhood: string;
  deliveryAddress: string;
  zoneId?: EdkoZoneId;
  zoneName?: string;
  zoneDeliveryFee?: number;
  useFreeDeliveryReward?: boolean;
  groupSessionId?: string;
  customerLat?: number;
  customerLng?: number;
  isScheduled?: boolean;
  scheduledForIso?: string;
  paymentMethod: PaymentMethod;
  notes: string;
}

export type ActiveView =
  | 'stores'
  | 'store_menu'
  | 'cart'
  | 'checkout'
  | 'tracking'
  | 'orders'
  | 'account';

export type ActiveTab = 'stores' | 'cart' | 'orders' | 'account';

export interface PaymentMethodsConfig {
  cash: boolean;
  wallet: boolean;
  visa: boolean;
}

export interface SystemMaintenanceConfig {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  surgeEnabled?: boolean;
  surgeMultiplier?: number;
  paymentMethods?: PaymentMethodsConfig;
  smtpEnabled?: boolean;
  updatedBy: string;
  updatedAtIso: string;
}

export type BlockedEntityType = 'customer' | 'courier' | 'store';

export interface BlockedEntityRecord {
  targetId: string;
  targetType: BlockedEntityType;
  targetName: string;
  reason: string;
  isBlocked: boolean;
  blockedBy: string;
  updatedAtIso: string;
}

export type LegalSectionKey = 'terms' | 'privacy' | 'refund' | 'pharmacy' | 'partners';

export interface ReverseGeocodeApiResponse {
  ok: boolean;
  isWaterBody?: boolean;
  formattedAddress?: string;
  shortAddress?: string;
  matchedNeighborhood?: string;
  error?: string;
}

/* ============================================================================
 * STAFF RBAC, REAL-TIME TECHNICAL SUPPORT, EMAIL OTP & EXCLUSIVE EDKAWY FEATURES
 * ========================================================================== */

export type StaffRole = 'super_admin' | 'support_agent' | 'operations';

export interface StaffMemberRecord {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  isActive: boolean;
  openTicketCount: number;
  createdBy: string;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface CreateStaffMemberInput {
  name: string;
  email: string;
  password: string;
  role: StaffRole;
}

export type SupportTicketCategory = 'طلب' | 'دفع' | 'مشكلة تقنية' | 'أخرى';

export type SupportTicketStatus = 'open' | 'closed';

export interface SupportTicketRecord {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  userEmail?: string;
  userRole: 'customer' | 'store' | 'courier';
  subject: string;
  category: SupportTicketCategory;
  details: string;
  status: SupportTicketStatus;
  assignedTo: string;
  assignedToName: string;
  hasAdminReply: boolean;
  attachmentImageUrl?: string;
  slaDeadlineIso?: string;
  createdAtIso: string;
  lastUpdatedIso: string;
}

export interface CreateSupportTicketInput {
  subject: string;
  category: SupportTicketCategory;
  details: string;
  attachmentImageUrl?: string;
}

export interface SupportMessageRecord {
  id: string;
  ticketId: string;
  senderId: string;
  senderName: string;
  senderRole: 'user' | 'admin' | 'support_agent';
  text: string;
  participants: string[];
  timestampIso: string;
}

export interface EmailVerificationRequestResult {
  ok: boolean;
  delivery?: 'smtp' | 'firebase_link_fallback' | string;
  sentViaSmtp?: boolean;
  maskedEmail?: string;
  fallbackOtpCode?: string;
  digits?: number;
  retryAfterSeconds?: number;
  lockedUntilIso?: string;
  message?: string;
  error?: string;
}

export interface EmailVerificationVerifyResult {
  ok: boolean;
  verifiedEmail?: string;
  retryAfterSeconds?: number;
  lockedUntilIso?: string;
  remainingAttempts?: number;
  error?: string;
}

export interface CustomErrandOrderInput {
  customerName: string;
  customerPhone: string;
  errandDescription: string;
  errandPickupAddress: string;
  deliveryNeighborhood: string;
  deliveryAddress: string;
  customerLat: number;
  customerLng: number;
  notes?: string;
}

export interface EdkuWeatherPromoResponse {
  ok: boolean;
  tempC: number;
  conditionLabel: string;
  mood: 'cold_rainy' | 'hot_sunny' | 'pleasant_breezy';
  headlineAr: string;
  subtextAr: string;
  recommendedCategory: string;
  source?: 'openweather' | 'open_meteo';
  error?: string;
}

export interface VisualSearchApiResponse {
  ok: boolean;
  detectedDishAr: string;
  keywords: string[];
  matchedProductIds: string[];
  summaryAr: string;
  error?: string;
}

export interface MealPlanDayItem {
  dayNumber: number;
  dayLabelAr: string;
  mealDescriptionAr: string;
  productId: string;
  productName: string;
  storeId: string;
  storeName: string;
  priceEgp: number;
}

export interface MealPlanApiResponse {
  ok: boolean;
  planTitleAr: string;
  totalEstimatedEgp: number;
  budgetEgp: number;
  summaryNoteAr: string;
  days: MealPlanDayItem[];
  error?: string;
}

export interface MealPlanRequestInput {
  budgetEgp: number;
  daysCount: number;
  dietaryStyle: 'صحي' | 'دسم' | 'متوازن';
}

export type FraudViolationType =
  | 'excessive_daily_cancellations'
  | 'rapid_consecutive_orders'
  | 'courier_repeated_cancellations';

export interface FraudAlertRecord {
  id: string;
  entityType: 'customer' | 'courier';
  entityId: string;
  personName: string;
  phone: string;
  customerCode: string;
  violationType: FraudViolationType;
  violationLabelAr: string;
  detailsAr: string;
  occurrencesCount: number;
  severity: 'high' | 'medium';
  detectedAtIso: string;
  isBanned: boolean;
}

export type UserRole =
  | 'customer'
  | 'store'
  | 'courier'
  | 'sales_agent'
  | 'admin'
  | 'support_agent'
  | 'operations';

export type AuditActionType =
  | 'ban_customer'
  | 'unban_customer'
  | 'block_entity'
  | 'unblock_entity'
  | 'update_delivery_fee'
  | 'update_zone_price'
  | 'manage_category'
  | 'approve_store'
  | 'toggle_store_active'
  | 'approve_courier'
  | 'delete_product'
  | 'delete_ad_banner'
  | 'delete_coupon'
  | 'delete_campaign'
  | 'send_notification'
  | 'toggle_maintenance'
  | 'gift_points'
  | 'purge_test_data'
  | 'create_invitation'
  | 'send_invitation'
  | 'resend_invitation'
  | 'delete_invitation'
  | 'create_sales_agent'
  | 'manage_sales_agent'
  | 'approve_payout'
  | 'reject_payout'
  | 'handle_payout'
  | 'admin_password_reset_link'
  | 'reset_user_password'
  | 'admin_update_login_email'
  | 'update_user_email'
  | 'approve_wallet_topup'
  | 'reject_wallet_topup'
  | 'update_system_settings';

export interface AuditLogRecord {
  id: string;
  adminId: string;
  adminName: string;
  actionType: AuditActionType;
  actionLabelAr: string;
  details: string;
  targetId?: string;
  createdAtIso: string;
}

export interface QaSimulationStep {
  stepNameAr: string;
  passed: boolean;
  durationMs: number;
  detailAr: string;
}

export interface QaSimulationReport {
  ok: boolean;
  simulatedOrderId: string;
  totalDurationMs: number;
  testedAtIso: string;
  summaryAr: string;
  steps: QaSimulationStep[];
}

export interface FirebaseConnectionHealthResult {
  connected: boolean;
  latencyMs: number;
  responsivenessPercent: number;
  statusLabelAr: string;
  checkedAtIso: string;
  errorDetail?: string;
}

export interface OcrExtractedMenuItem {
  tempId: string;
  name: string;
  price: number;
  category: string;
  description: string;
  selected: boolean;
}

export interface MenuOcrApiResponse {
  ok: boolean;
  items: Array<{
    name: string;
    price: number;
    category: string;
    description: string;
  }>;
  error?: string;
}

export type DailySpinRewardType = 'points' | 'coupon' | 'free_delivery';

export interface DailySpinResult {
  rewardType: DailySpinRewardType;
  labelAr: string;
  pointsAwarded?: number;
  couponCode?: string;
  discountPercent?: number;
  freeDeliveryAwarded?: boolean;
  spunAtIso: string;
}

export interface GroupSessionParticipant {
  uid: string;
  name: string;
  joinedAtIso: string;
}

export interface GroupSessionRecord {
  id: string;
  hostUid: string;
  hostName: string;
  storeId: string;
  storeName: string;
  zoneId?: EdkoZoneId;
  zoneDeliveryFee: number;
  status: 'open' | 'checked_out' | 'cancelled';
  participantUids: string[];
  participants: GroupSessionParticipant[];
  createdAtIso: string;
  updatedAtIso: string;
}

export interface GroupSessionCartItem {
  id: string;
  sessionId: string;
  participantUid: string;
  participantName: string;
  productId: string;
  name: string;
  variantId?: string;
  variantLabel?: string;
  price: number;
  quantity: number;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface GroupSessionChatMessage {
  id: string;
  sessionId: string;
  senderUid: string;
  senderName: string;
  text: string;
  createdAtIso: string;
}

export interface GroupBillParticipantShare {
  participantUid: string;
  participantName: string;
  itemsCount: number;
  itemsSubtotal: number;
  deliveryAndFeesShare: number;
  discountShare: number;
  totalOwed: number;
}

/* ============================================================================
 * INVITATION MANAGEMENT, SALES AGENT CRM, COMMISSIONS & PAYOUT WALLET
 * ========================================================================== */

export type InvitationUserType = 'store' | 'customer' | 'courier' | 'sales_agent';

export type InvitationStatus = 'pending' | 'accepted' | 'expired';

export interface InvitationRecord {
  id: string;
  email: string;
  userType: InvitationUserType;
  token: string;
  status: InvitationStatus;
  createdAtIso: string;
  createdAt?: string;
  expiresAtIso: string;
  expiresAt?: string;
  expiresAtMs: number;
  invitedBy: string;
  invitedByName?: string;
  invitedByRole?: 'admin' | 'sales_agent';
  agentId?: string;
  referralCode?: string;
  acceptedByUid?: string;
  acceptedAtIso?: string;
}

export interface CreateInvitationInput {
  email: string;
  userType: InvitationUserType;
}

export interface InvitationRegisterPayload {
  token: string;
  name: string;
  phone: string;
  password: string;
  neighborhood?: string;
  address?: string;
  lat?: number;
  lng?: number;
  // Store-specific optional registration fields
  storeCategory?: StoreCategory;
  storeDescription?: string;
  isHomeFood?: boolean;
  // Courier-specific optional registration fields
  vehicleType?: CourierVehicleType;
}

export interface InvitationEmailApiResponse {
  ok: boolean;
  sentViaSmtp: boolean;
  inviteUrl: string;
  smtpError?: string;
  error?: string;
}

export interface SalesAgentRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  referralCode: string;
  commissionRatePercent: number;
  availableBalance: number;
  pendingBalance: number;
  totalEarnings: number;
  invitedStoresCount: number;
  recruitedStoresCount?: number;
  invitedCustomersCount: number;
  recruitedCustomersCount?: number;
  invitedCouriersCount: number;
  recruitedCouriersCount?: number;
  isActive: boolean;
  createdBy: string;
  createdAtIso: string;
  updatedAtIso: string;
}

export type SalesAgentProfileRecord = SalesAgentRecord;

export interface AdminCreateSalesAgentInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  commissionRatePercent?: number;
}

export interface ReferralAccountRecord {
  id: string;
  agentId: string;
  referralCode: string;
  referredUid: string;
  referredStoreId?: string;
  accountName: string;
  accountType: 'store' | 'customer' | 'courier';
  status: 'active' | 'inactive';
  completedOrdersCount: number;
  totalSalesVolumeEgp: number;
  totalCommissionsEgp: number;
  joinedAtIso: string;
  updatedAtIso: string;
}

export interface CommissionRecord {
  id: string;
  orderId: string;
  agentId: string;
  referralCode: string;
  referredEntityId: string;
  referredEntityName: string;
  referredEntityType: 'store' | 'customer';
  orderTotalEgp: number;
  commissionRatePercent: number;
  amountEgp: number;
  status: 'pending' | 'settled';
  maturesAtMs: number;
  createdAtIso: string;
  settledAtIso?: string;
}

export type PayoutMethod = 'vodafone_cash' | 'instapay';

export type PayoutStatus = 'pending' | 'completed' | 'rejected' | 'paid';

export interface PayoutRequestRecord {
  id: string;
  agentId: string;
  agentName: string;
  agentEmail: string;
  amount: number;
  method: PayoutMethod;
  accountDetails: string;
  targetAccount?: string;
  status: PayoutStatus;
  rejectionReason?: string;
  processedBy?: string;
  createdAtIso: string;
  createdAt?: string;
  updatedAtIso: string;
}

export interface CreatePayoutRequestInput {
  amount: number;
  method: PayoutMethod;
  accountDetails: string;
}

export type WalletTopupMethod = 'vodafone_cash' | 'instapay';
export type WalletTopupStatus = 'pending' | 'approved' | 'rejected';

export interface WalletTopupRequestRecord {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  customerCode?: string;
  amount: number;
  method: WalletTopupMethod;
  referenceNumber: string;
  senderPhone?: string;
  receiptImageUrl?: string;
  status: WalletTopupStatus;
  adminNote?: string;
  rejectionReason?: string;
  processedBy?: string;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface WalletTopupRequestInput {
  amount: number;
  method: WalletTopupMethod;
  referenceNumber: string;
  senderPhone: string;
  receiptImageUrl: string;
}

export interface WalletTransactionRecord {
  id: string;
  userId: string;
  type: 'topup_credit' | 'order_debit' | 'order_refund' | 'referral_bonus';
  amount: number;
  balanceAfter: number;
  description: string;
  titleAr?: string;
  orderId?: string;
  requestId?: string;
  createdBy?: string;
  createdAtIso: string;
}

export interface LiveEventRecord {
  id: string;
  text?: string;
  textAr?: string;
  storeId?: string;
  storeName?: string;
  neighborhood?: string;
  eventType?: 'new_order' | 'promo' | 'delivery';
  createdAtIso: string;
}


