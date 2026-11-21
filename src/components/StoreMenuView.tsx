import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Copy,
  FileText,
  Flame,
  Gift,
  Heart,
  Lock,
  MapPin,
  MessageSquareQuote,
  Minus,
  PackageOpen,
  Phone,
  Pill,
  Plus,
  Search,
  Share2,
  Star,
  Truck,
  Users,
} from 'lucide-react';
import {
  APPROVED_EDKO_ZONES,
  EDKU_CITY_CENTER,
  resolveEdkuCoordsForNeighborhood,
  resolveZoneForNeighborhood,
} from '../data/edkuSeedStores';
import { resolvePublicAppOrigin } from '../services/edkawiFirebaseService';
import {
  CartItem,
  MenuItem,
  PharmacyPrescriptionOrderInput,
  ProductRecord,
  ProductVariant,
  ReviewRecord,
  SharedCartRecord,
  StoreRecord,
  UserProfileRecord,
} from '../types/edkawi';
import {
  buildCartItemId,
  EDKU_NEIGHBORHOODS,
  filterProductsByCategoryAndQuery,
  formatAppErrorMessage,
  getCartEntryKey,
  isStoreCurrentlyOpen,
  normalizeEgyptPhoneOrEmpty,
} from '../utils/orderLogic';
import { DeviceImageInput } from './DeviceImageInput';
import { EdkuLocationPickerMap } from './EdkuGoogleMaps';
import { EmptyState } from './EmptyState';
import { ResilientImage } from './ResilientImage';
import { ProductsGridSkeleton } from './SkeletonLoaders';

interface StoreMenuViewProps {
  store: StoreRecord;
  products: ProductRecord[];
  isLoadingProducts: boolean;
  productsError: string | null;
  cart: CartItem[];
  isGuestCustomer?: boolean;
  userProfile?: UserProfileRecord | null;
  defaultCustomerName?: string;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  reviews?: ReviewRecord[];
  activeSharedCart?: SharedCartRecord | null;
  onStartGroupOrder?: (store: StoreRecord) => Promise<string>;
  onUpsertSharedCartItem?: (
    cartId: string,
    product: ProductRecord,
    delta: number
  ) => Promise<void>;
  onCheckoutSharedCart?: (sharedCart: SharedCartRecord) => void;
  onLeaveSharedCart?: () => void;
  onSubmitPharmacyOrder?: (
    store: StoreRecord,
    input: PharmacyPrescriptionOrderInput
  ) => Promise<string>;
  onOpenAuthModal?: () => void;
  onBackToStores: () => void;
  onAddProductToCart: (
    store: StoreRecord,
    item: MenuItem,
    selectedVariant?: ProductVariant
  ) => void;
  onUpdateCartQuantity: (itemId: string, delta: number) => void;
}

export function StoreMenuView({
  store,
  products,
  isLoadingProducts,
  productsError,
  cart,
  isGuestCustomer = false,
  userProfile = null,
  defaultCustomerName = '',
  isFavorite = false,
  onToggleFavorite,
  reviews = [],
  activeSharedCart = null,
  onStartGroupOrder,
  onUpsertSharedCartItem,
  onCheckoutSharedCart,
  onLeaveSharedCart,
  onSubmitPharmacyOrder,
  onOpenAuthModal,
  onBackToStores,
  onAddProductToCart,
  onUpdateCartQuantity,
}: StoreMenuViewProps) {
  const [selectedSubCategory, setSelectedSubCategory] =
    useState<string>('الكل');
  const [searchQuery, setSearchQuery] = useState('');

  // Pharmacy Prescription Form State (Stage 1)
  const [rxImageUrl, setRxImageUrl] = useState('');
  const [rxMedicineText, setRxMedicineText] = useState('');
  const [rxCustomerName, setRxCustomerName] = useState(
    userProfile?.name || defaultCustomerName || ''
  );
  const [rxCustomerPhone, setRxCustomerPhone] = useState(
    userProfile?.phone || ''
  );
  const [rxNeighborhood, setRxNeighborhood] = useState<string>(
    userProfile?.defaultNeighborhood || EDKU_NEIGHBORHOODS[0]
  );
  const [rxLat, setRxLat] = useState<number>(
    userProfile?.defaultLat ?? EDKU_CITY_CENTER.lat
  );
  const [rxLng, setRxLng] = useState<number>(
    userProfile?.defaultLng ?? EDKU_CITY_CENTER.lng
  );
  const [rxAddress, setRxAddress] = useState(userProfile?.defaultAddress || '');
  const [rxNotes, setRxNotes] = useState('');
  const [rxWaterPin, setRxWaterPin] = useState(false);
  const [rxSubmitting, setRxSubmitting] = useState(false);
  const [rxError, setRxError] = useState<string | null>(null);

  // Smart Variants Selection State (productId -> variantId)
  const [selectedVariantByProduct, setSelectedVariantByProduct] = useState<
    Record<string, string>
  >({});

  // Group Order State
  const [startingGroupOrder, setStartingGroupOrder] = useState(false);
  const [groupOrderFeedback, setGroupOrderFeedback] = useState<string | null>(
    null
  );
  const [copiedGroupLink, setCopiedGroupLink] = useState(false);

  const hasAnyFlashSale = useMemo(
    () =>
      products.some(
        (p) =>
          p.isFlashSale &&
          (p.flashDiscountPercent ?? 0) > 0 &&
          p.flashSaleEndsAtIso
      ),
    [products]
  );
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!hasAnyFlashSale) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasAnyFlashSale]);

  useEffect(() => {
    if (userProfile?.name && !rxCustomerName.trim()) {
      setRxCustomerName(userProfile.name);
    } else if (defaultCustomerName && !rxCustomerName.trim()) {
      setRxCustomerName(defaultCustomerName);
    }
    if (userProfile?.phone && !rxCustomerPhone.trim()) {
      setRxCustomerPhone(userProfile.phone);
    }
    if (userProfile?.defaultNeighborhood) {
      setRxNeighborhood(userProfile.defaultNeighborhood);
    }
    if (typeof userProfile?.defaultLat === 'number') {
      setRxLat(userProfile.defaultLat);
    }
    if (typeof userProfile?.defaultLng === 'number') {
      setRxLng(userProfile.defaultLng);
    }
    if (userProfile?.defaultAddress && !rxAddress.trim()) {
      setRxAddress(userProfile.defaultAddress);
    }
  }, [
    userProfile?.name,
    userProfile?.phone,
    userProfile?.defaultNeighborhood,
    userProfile?.defaultLat,
    userProfile?.defaultLng,
    userProfile?.defaultAddress,
    defaultCustomerName,
  ]);

  const isOpen = isStoreCurrentlyOpen(store);
  const isPharmacyStore = store.category === 'صيدليات';
  const hasMinOrder =
    !isPharmacyStore &&
    Boolean(store.minOrderAmount) &&
    (store.minOrderAmount ?? 0) > 0;

  const isGroupCartForThisStore =
    activeSharedCart &&
    activeSharedCart.storeId === store.id &&
    activeSharedCart.status === 'open';

  const subCategories = useMemo(() => {
    const unique = Array.from(
      new Set(products.map((p) => p.category.trim()).filter(Boolean))
    );
    return ['الكل', ...unique];
  }, [products]);

  const filteredProducts = filterProductsByCategoryAndQuery(
    products,
    selectedSubCategory,
    searchQuery
  );

  function getQuantityInCart(cartEntryKey: string): number {
    const found = cart.find(
      (entry) =>
        entry.storeId === store.id && getCartEntryKey(entry) === cartEntryKey
    );
    return found ? found.quantity : 0;
  }

  const handlePharmacySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSubmitPharmacyOrder) return;
    setRxError(null);

    if (isGuestCustomer) {
      setRxError('يرجى تسجيل الدخول بحسابك أولاً لإرسال الروشتة ومتابعة تسعيرها.');
      return;
    }

    if (rxWaterPin) {
      setRxError(
        'لا يمكن تثبيت موقع استلام الدواء فوق مياه البحر المتوسط أو بحيرة إدكو. يرجى تحريك الدبوس لليابسة.'
      );
      return;
    }

    if (!rxImageUrl && !rxMedicineText.trim()) {
      setRxError(
        'يرجى رفع صورة الروشتة الطبية من جهازك أو كتابة أسماء الأدوية المطلوبة.'
      );
      return;
    }

    const matchedZone = resolveZoneForNeighborhood(
      rxNeighborhood,
      APPROVED_EDKO_ZONES
    );

    setRxSubmitting(true);
    try {
      await onSubmitPharmacyOrder(store, {
        customerName: rxCustomerName.trim(),
        customerPhone: normalizeEgyptPhoneOrEmpty(rxCustomerPhone),
        deliveryNeighborhood: rxNeighborhood,
        deliveryAddress:
          rxAddress.trim() || `موقع محدد على الخريطة — ${rxNeighborhood}`,
        zoneId: matchedZone.id,
        zoneName: matchedZone.name,
        zoneDeliveryFee: matchedZone.deliveryFee,
        customerLat: rxLat,
        customerLng: rxLng,
        prescriptionImageUrl: rxImageUrl || undefined,
        medicineRequest: rxMedicineText.trim() || undefined,
        notes: rxNotes.trim() || undefined,
      });
    } catch (err) {
      setRxError(
        formatAppErrorMessage(err, 'تعذر إرسال طلب الصيدلية حالياً.')
      );
    } finally {
      setRxSubmitting(false);
    }
  };

  const handleStartGroupOrderClick = async () => {
    if (!onStartGroupOrder) return;
    setGroupOrderFeedback(null);
    setStartingGroupOrder(true);
    try {
      await onStartGroupOrder(store);
    } catch (err) {
      setGroupOrderFeedback(
        formatAppErrorMessage(err, 'تعذر بدء الطلب الجماعي حالياً.')
      );
    } finally {
      setStartingGroupOrder(false);
    }
  };

  const groupShareUrl = isGroupCartForThisStore
    ? `${resolvePublicAppOrigin()}/?groupCart=${encodeURIComponent(activeSharedCart.id)}`
    : '';

  return (
    <div className="pb-28 edkawi-page-enter">
      {/* Large Top Cover Banner (Real Device Image Only) */}
      <div className="relative w-full h-64 sm:h-80 lg:h-[340px] bg-[#1E293B] overflow-hidden">
        <ResilientImage
          src={store.imageUrl || ''}
          alt={store.name}
          fallbackLabel={store.name}
          className="w-full h-full object-cover"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0F172A]/85 via-[#0F172A]/30 to-black/35"
        />

        {/* Floating Glass Back & Favorite Buttons */}
        <div className="absolute top-0 inset-x-0 z-10">
          <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-5 sm:pt-7 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onBackToStores}
              className="inline-flex items-center gap-2 py-2.5 px-4 rounded-2xl bg-[#1E293B]/95 hover:bg-[#1E293B] border border-[#334155] backdrop-blur-md text-xs sm:text-sm font-bold text-[#F8FAFC] shadow-md cursor-pointer whitespace-nowrap active:scale-[0.97]"
            >
              <ArrowRight
                className="w-4 h-4 text-[#FF6B00]"
                aria-hidden="true"
              />
              <span>العودة إلى المتاجر</span>
            </button>

            <div className="flex items-center gap-2">
              {onStartGroupOrder && !isPharmacyStore && isOpen && !isGroupCartForThisStore && (
                <button
                  type="button"
                  disabled={startingGroupOrder}
                  onClick={handleStartGroupOrderClick}
                  className="min-h-[42px] px-4 py-2 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] text-xs sm:text-sm font-bold text-white shadow-md inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Users className="w-4 h-4 text-white" />
                  <span>
                    {startingGroupOrder ? 'جارٍ الإنشاء...' : 'اطلب مع أصحابك'}
                  </span>
                </button>
              )}

              {onToggleFavorite && (
                <button
                  type="button"
                  onClick={onToggleFavorite}
                  aria-label={
                    isFavorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'
                  }
                  className="min-h-[42px] px-4 py-2 rounded-2xl bg-[#1E293B]/95 hover:bg-[#1E293B] border border-[#334155] backdrop-blur-md text-xs sm:text-sm font-bold text-[#F8FAFC] shadow-md inline-flex items-center gap-2 cursor-pointer"
                >
                  <Heart
                    className={`w-4 h-4 ${
                      isFavorite
                        ? 'fill-rose-500 text-rose-500'
                        : 'text-[#94A3B8]'
                    }`}
                  />
                  <span>{isFavorite ? 'في المفضلة' : 'حفظ بالمفضلة'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Overlapping Store Info Card */}
      <div className="max-w-5xl mx-auto px-4 sm:px-8 -mt-20 sm:-mt-24 relative z-20">
        <section className="rounded-2xl bg-[#1E293B] border border-[#334155] p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
            <div className="space-y-2.5 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#FF6B00]">
                {isPharmacyStore ? (
                  <Pill className="w-4 h-4 shrink-0" aria-hidden="true" />
                ) : (
                  <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" />
                )}
                <span>
                  {store.category} · {store.neighborhood}، مدينة إدكو
                  {(store.isHomeFood || store.category === 'أكل بيتي')
                    ? ' · أكل بيتي طازج'
                    : ''}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#F8FAFC] leading-tight">
                {store.name}
              </h1>

              <p className="text-sm sm:text-base text-[#94A3B8] leading-relaxed">
                {store.description}
              </p>
            </div>

            {/* Store Metrics */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-xs sm:text-sm font-bold">
                <Star
                  className="w-4 h-4 fill-[#FF6B00] text-[#FF6B00]"
                  aria-hidden="true"
                />
                <span className="font-mono tabular-nums">
                  {store.rating.toFixed(1)}
                </span>
                {(store.reviewCount || reviews.length > 0) && (
                  <span className="text-xs text-[#94A3B8] tabular-nums">
                    ({store.reviewCount ?? reviews.length} تقييم)
                  </span>
                )}
              </div>

              <div className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-xs sm:text-sm font-bold">
                <Clock
                  className="w-4 h-4 text-[#FF6B00]"
                  aria-hidden="true"
                />
                <span>
                  <span className="font-mono tabular-nums">
                    {store.prepTimeMinutes ?? store.deliveryTimeMinutes}
                  </span>{' '}
                  دقيقة
                </span>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-xs sm:text-sm font-bold">
                <Truck
                  className="w-4 h-4 text-[#FF6B00]"
                  aria-hidden="true"
                />
                <span>
                  توصيل{' '}
                  <span className="font-mono tabular-nums">
                    {store.deliveryFee}
                  </span>{' '}
                  ج.م
                </span>
              </div>

              {hasMinOrder && (
                <div className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-xs sm:text-sm font-bold">
                  <span>
                    الحد الأدنى{' '}
                    <span className="font-mono tabular-nums">
                      {store.minOrderAmount}
                    </span>{' '}
                    ج.م
                  </span>
                </div>
              )}
            </div>
          </div>

          {groupOrderFeedback && (
            <div className="mt-4 p-3.5 rounded-2xl bg-amber-950/50 border border-amber-500/40 text-xs font-semibold text-amber-200">
              {groupOrderFeedback}
            </div>
          )}

          {!isOpen && (
            <div
              role="status"
              className="mt-6 p-4 rounded-2xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs sm:text-sm font-bold flex items-center gap-2.5"
            >
              <Lock className="w-4 h-4 text-red-400 shrink-0" aria-hidden="true" />
              <span>
                {isPharmacyStore
                  ? 'هذه الصيدلية مغلقة حالياً ولا تستقبل روشتات في الوقت الحالي.'
                  : 'هذا المتجر مغلق حالياً ولا يستقبل طلبات جديدة في الوقت الحالي.'}
              </span>
            </div>
          )}
        </section>
      </div>

      {/* Main Content Container */}
      <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-8 sm:pt-10 space-y-10">
        {/* LIVE COLLABORATIVE GROUP ORDER BANNER (/sharedCarts) */}
        {isGroupCartForThisStore && activeSharedCart && (
          <section className="rounded-3xl bg-[#1E293B] text-white p-6 space-y-4 shadow-xl border border-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-[#FF6B00]">
                  <Share2 className="w-4 h-4" />
                  <span>طلب جماعي مشترك مباشر · المضيف: {activeSharedCart.hostName}</span>
                  {activeSharedCart.roomCode && (
                    <span className="bg-[#FF6B00]/20 border border-[#FF6B00]/40 text-[#FF6B00] px-2 py-0.5 rounded-lg font-mono">
                      كود الغرفة: {activeSharedCart.roomCode}
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-white">
                  شارك الرابط أو كود الغرفة مع أصدقائك ليضيفوا أصنافهم معك في فاتورة واحدة!
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {activeSharedCart.roomCode && (
                  <button
                    type="button"
                    onClick={() => {
                      window.history.pushState({}, '', `/group/${activeSharedCart.roomCode}`);
                      window.dispatchEvent(new PopStateEvent('popstate'));
                    }}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap border border-white/15"
                  >
                    <span>فتح غرفة الشلة والشات</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(groupShareUrl).catch(() => {});
                    setCopiedGroupLink(true);
                    setTimeout(() => setCopiedGroupLink(false), 2000);
                  }}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  {copiedGroupLink ? (
                    <Check className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-white" />
                  )}
                  <span>{copiedGroupLink ? 'تم نسخ اللينك!' : 'انسخ اللينك لأصحابك'}</span>
                </button>

                {onLeaveSharedCart && (
                  <button
                    type="button"
                    onClick={onLeaveSharedCart}
                    className="min-h-[40px] px-3 py-2 rounded-xl border border-white/20 text-xs text-white hover:bg-white/10 cursor-pointer whitespace-nowrap"
                  >
                    إغلاق الطلب الجماعي
                  </button>
                )}
              </div>
            </div>

            {activeSharedCart.items.length === 0 ? (
              <p className="text-xs text-slate-300">
                لم يضف المشاركون أصنافاً بعد — اضغط على زر &quot;+ للسلة الجماعية&quot; أمام أي صنف بالأسفل أو شارك اللينك مع أصدقائك.
              </p>
            ) : (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-4">
                {/* Per-participant breakdown ("مين ضاف إيه") */}
                <div className="space-y-2.5">
                  <p className="text-xs font-bold text-[#FF6B00]">
                    تفصيل الطلب الجماعي — مين ضاف إيه؟
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Array.from(
                      activeSharedCart.items.reduce((acc, item) => {
                        const key = item.participantUid || item.participantName;
                        const existing = acc.get(key) ?? {
                          name: item.participantName || 'مشارك',
                          subtotal: 0,
                          entries: [] as typeof activeSharedCart.items,
                        };
                        existing.subtotal += item.price * item.quantity;
                        existing.entries.push(item);
                        acc.set(key, existing);
                        return acc;
                      }, new Map<string, { name: string; subtotal: number; entries: typeof activeSharedCart.items }>())
                    ).map(([partKey, group]) => (
                      <div
                        key={partKey}
                        className="rounded-xl bg-white/10 border border-white/10 p-3 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-white">
                            {group.name}
                          </span>
                          <span className="text-xs font-mono font-bold text-[#FF6B00] tabular-nums">
                            {group.subtotal} ج.م
                          </span>
                        </div>
                        <div className="space-y-1 text-xs text-slate-200">
                          {group.entries.map((entry) => (
                            <div
                              key={entry.entryId}
                              className="flex items-center justify-between gap-2"
                            >
                              <span>
                                {entry.name} × {entry.quantity}
                              </span>
                              <span className="font-mono tabular-nums text-slate-300">
                                {entry.price * entry.quantity} ج.م
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {onCheckoutSharedCart && (
                  <div className="pt-3 border-t border-white/10 flex justify-end">
                    <button
                      type="button"
                      onClick={() => onCheckoutSharedCart(activeSharedCart)}
                      className="min-h-[42px] px-5 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
                    >
                      <span>اعتماد السلة الجماعية والانتقال للدفع</span>
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ===================================================================
         * EDKAWY 4-STAGE PHARMACY PRESCRIPTION ORDER FORM (Stage 1)
         * ================================================================= */}
        {isPharmacyStore && onSubmitPharmacyOrder && (
          <section
            aria-labelledby="pharmacy-order-heading"
            className="rounded-2xl bg-[#1E293B] p-6 sm:p-8 border border-emerald-500/40 space-y-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-[#334155]">
              <div className="space-y-1.5 max-w-2xl">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-400">
                  <Pill className="w-4 h-4" />
                  <span>نظام صيدليات إدكاوي الذكي — بدون مكالمات أو انتظار</span>
                </div>
                <h2
                  id="pharmacy-order-heading"
                  className="text-xl sm:text-2xl font-bold text-[#F8FAFC]"
                >
                  إرسال روشتة طبية أو طلب أدوية من {store.name}
                </h2>
                <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
                  ارفع صورة الروشتة من جهازك أو اكتب الأدوية المطلوبة. ستقوم
                  الصيدلية بتسعير الطلب وإرساله لك للموافقة على السعر أولاً قبل
                  التحضير والتوصيل!
                </p>
              </div>

              <div className="rounded-2xl bg-emerald-950/50 border border-emerald-500/40 px-4 py-2.5 text-xs font-bold text-emerald-200">
                رسوم توصيل الصيدلية: {store.deliveryFee} ج.م · الدفع كاش عند الاستلام
              </div>
            </div>

            {isGuestCustomer ? (
              <div className="rounded-2xl bg-[#0F172A] border border-[#334155] p-6 text-center space-y-3">
                <p className="text-sm font-bold text-[#F8FAFC]">
                  يرجى تسجيل الدخول لإرسال الروشتة واستلام إشعار السعر من الصيدلية
                </p>
                {onOpenAuthModal && (
                  <button
                    type="button"
                    onClick={onOpenAuthModal}
                    className="min-h-[44px] px-6 py-2.5 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-sm font-bold cursor-pointer"
                  >
                    تسجيل الدخول أو إنشاء حساب الآن
                  </button>
                )}
              </div>
            ) : (
              <form onSubmit={handlePharmacySubmit} className="space-y-6">
                {rxError && (
                  <div
                    role="alert"
                    className="p-4 rounded-2xl bg-red-950/50 border border-red-500/40 text-xs sm:text-sm font-semibold text-red-200"
                  >
                    {rxError}
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Prescription Photo from Device + Medicine Text */}
                  <div className="space-y-4">
                    <DeviceImageInput
                      label="١. صورة الروشتة الطبية أو علبة الدواء (من جهازك)"
                      required={false}
                      allowCameraCapture={true}
                      value={rxImageUrl}
                      onChange={setRxImageUrl}
                      helperText="صوّر الروشتة بوضوح من هاتفك أو اختر صورتها من معرض الجهاز"
                      aspectClassName="h-48"
                    />

                    <div>
                      <label className="block text-xs font-bold text-[#F8FAFC] mb-1.5 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-[#FF6B00]" />
                        <span>أو اكتب أسماء الأدوية المطلوبة والتركيز</span>
                      </label>
                      <textarea
                        rows={4}
                        maxLength={600}
                        value={rxMedicineText}
                        onChange={(e) => setRxMedicineText(e.target.value)}
                        placeholder="مثال: بانادول إكسترا شريطين + فيتامين سي ١٠٠٠ فوار علبة واحدة (أو البديل المتاح)..."
                        className="w-full px-4 py-3 rounded-2xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] placeholder:text-[#94A3B8] text-sm resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#F8FAFC] mb-1.5">
                        ملاحظات إضافية للصيدلي (اختياري)
                      </label>
                      <input
                        type="text"
                        maxLength={200}
                        value={rxNotes}
                        onChange={(e) => setRxNotes(e.target.value)}
                        placeholder="مثال: أفضّل الدواء الأصلي أو توضيح الجرعة"
                        className="w-full min-h-[44px] px-4 py-2.5 rounded-2xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] placeholder:text-[#94A3B8] text-sm"
                      />
                    </div>
                  </div>

                  {/* Customer Contact & Edku Google Map Delivery Pin */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-[#F8FAFC] mb-1">
                          اسم المستلم
                        </label>
                        <input
                          type="text"
                          required
                          value={rxCustomerName}
                          onChange={(e) => setRxCustomerName(e.target.value)}
                          placeholder="الاسم بالكامل"
                          className="w-full min-h-[44px] px-3.5 py-2 rounded-2xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#F8FAFC] mb-1">
                          رقم الموبايل المصري
                        </label>
                        <div className="relative">
                          <Phone className="w-4 h-4 text-[#94A3B8] absolute right-3.5 top-3.5" />
                          <input
                            type="tel"
                            required
                            dir="ltr"
                            value={rxCustomerPhone}
                            onChange={(e) => setRxCustomerPhone(e.target.value)}
                            placeholder="01012345678"
                            className="w-full min-h-[44px] pr-10 pl-3.5 py-2 rounded-2xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-sm text-right tabular-nums"
                          />
                        </div>
                      </div>
                    </div>

                    <EdkuLocationPickerMap
                      label="٢. حدد موقع استلام الدواء أو ابحث عن عنوانك"
                      helperText="ابحث عن مكانك أعلى الخريطة أو اضغط (تلقائي GPS) ليصل إليك مندوب إدكاوي بدقة"
                      lat={rxLat}
                      lng={rxLng}
                      neighborhood={rxNeighborhood}
                      heightClassName="h-[225px]"
                      autoLocateOnMount={
                        typeof userProfile?.defaultLat !== 'number'
                      }
                      onWaterValidationChange={setRxWaterPin}
                      onAddressResolved={(addr) => {
                        if (addr) {
                          setRxAddress(addr);
                        }
                      }}
                      onChange={(picked) => {
                        setRxLat(picked.lat);
                        setRxLng(picked.lng);
                        setRxNeighborhood(picked.neighborhood);
                        if (picked.resolvedAddress) {
                          setRxAddress(picked.resolvedAddress);
                        }
                      }}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-[#F8FAFC] mb-1">
                          الحي في إدكو
                        </label>
                        <select
                          value={rxNeighborhood}
                          onChange={(e) => {
                            const nextArea = e.target.value;
                            setRxNeighborhood(nextArea);
                            setRxWaterPin(false);
                            const coords =
                              resolveEdkuCoordsForNeighborhood(nextArea);
                            setRxLat(coords.lat);
                            setRxLng(coords.lng);
                          }}
                          className="w-full min-h-[44px] px-3 py-2 rounded-2xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-sm"
                        >
                          {EDKU_NEIGHBORHOODS.map((area) => (
                            <option key={area} value={area}>
                              {area}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#F8FAFC] mb-1">
                          علامة مميزة أو رقم العقار
                        </label>
                        <input
                          type="text"
                          required
                          value={rxAddress}
                          onChange={(e) => setRxAddress(e.target.value)}
                          placeholder="بجوار مسجد... الدور الثاني"
                          className="w-full min-h-[44px] px-3.5 py-2 rounded-2xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={rxSubmitting || !isOpen || rxWaterPin}
                    className="w-full sm:w-auto min-h-[48px] px-8 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-55 text-white text-sm sm:text-base font-bold inline-flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                  >
                    <Pill className="w-4 h-4" />
                    <span>
                      {rxSubmitting
                        ? 'جارٍ إرسال الروشتة للصيدلية...'
                        : 'إرسال الطلب للصيدلية لتحديد السعر'}
                    </span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}
          </section>
        )}

        {/* Store Menu Products Section */}
        {(!isPharmacyStore || products.length > 0) && (
          <section aria-labelledby="store-products-heading" className="space-y-7">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div>
                <h2
                  id="store-products-heading"
                  className="text-xl sm:text-2xl font-bold text-[#F8FAFC]"
                >
                  {isPharmacyStore
                    ? 'مستلزمات ومنتجات متوفرة بالصيدلية'
                    : 'قائمة الأصناف المتاحة'}
                </h2>
                <p className="text-xs sm:text-sm text-[#94A3B8] mt-1">
                  اختر أصنافك المفضلة واضغط على &quot;إضافة +&quot; لإضافتها فوراً إلى السلة
                </p>
              </div>

              <div className="relative w-full md:w-80">
                <label htmlFor="product-search" className="sr-only">
                  ابحث داخل قائمة المتجر
                </label>
                <Search
                  className="w-4 h-4 text-[#94A3B8] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="product-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث داخل القائمة..."
                  className="w-full pr-11 pl-4 py-3 rounded-2xl border border-[#334155] bg-[#1E293B] text-[#F8FAFC] placeholder:text-[#94A3B8] text-sm"
                />
              </div>
            </div>

            {subCategories.length > 2 && (
              <div
                role="group"
                aria-label="تصفية منتجات المتجر حسب القسم"
                className="flex items-center gap-1.5 p-1.5 bg-[#1E293B] rounded-2xl border border-[#334155] overflow-x-auto w-fit max-w-full"
              >
                {subCategories.map((sub) => {
                  const active = selectedSubCategory === sub;
                  return (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setSelectedSubCategory(sub)}
                      className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl whitespace-nowrap shrink-0 cursor-pointer active:scale-[0.96] ${
                        active
                          ? 'bg-[#FF6B00] text-white'
                          : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#0F172A]'
                      }`}
                    >
                      {sub}
                    </button>
                  );
                })}
              </div>
            )}

            {productsError && (
              <div
                role="alert"
                className="p-5 rounded-2xl bg-red-950/50 border border-red-500/40 text-red-200 text-sm"
              >
                تعذر جلب منتجات المتجر: {productsError}
              </div>
            )}

            {isLoadingProducts ? (
              <ProductsGridSkeleton count={4} />
            ) : products.length === 0 ? (
              <EmptyState
                icon={PackageOpen}
                title="لا توجد أصناف معروضة حالياً"
                description="يضيف صاحب المتجر أصنافه الحقيقية وصورها الأصلية من بوابة المتجر، وستظهر هنا فور إضافتها."
              />
            ) : filteredProducts.length === 0 ? (
              <EmptyState
                icon={Search}
                title="لا توجد أصناف مطابقة للبحث"
                description="جرّب اختيار قسم آخر أو مسح كلمة البحث."
                actionLabel="عرض كل أصناف المتجر"
                onAction={() => {
                  setSelectedSubCategory('الكل');
                  setSearchQuery('');
                }}
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredProducts.map((product) => {
                  const hasVariants = Boolean(
                    product.hasVariants &&
                      Array.isArray(product.variants) &&
                      product.variants.length > 0
                  );
                  const selectedVariant: ProductVariant | undefined = hasVariants
                    ? product.variants!.find(
                        (v) =>
                          v.variantId === selectedVariantByProduct[product.id]
                      ) ??
                      product.variants!.find((v) => v.stock > 0) ??
                      product.variants![0]
                    : undefined;

                  const basePrice = selectedVariant
                    ? selectedVariant.price
                    : product.price;
                  const flashEndsMs = product.flashSaleEndsAtIso
                    ? Date.parse(product.flashSaleEndsAtIso)
                    : 0;
                  const flashRemainingSec =
                    product.isFlashSale &&
                    (product.flashDiscountPercent ?? 0) > 0 &&
                    flashEndsMs > nowMs
                      ? Math.max(0, Math.floor((flashEndsMs - nowMs) / 1000))
                      : 0;
                  const isFlashActive = flashRemainingSec > 0;
                  const effectivePrice = isFlashActive
                    ? Math.max(
                        1,
                        Math.round(
                          basePrice *
                            (1 - (product.flashDiscountPercent ?? 0) / 100)
                        )
                      )
                    : basePrice;
                  const flashCountdownText = isFlashActive
                    ? `${String(Math.floor(flashRemainingSec / 3600)).padStart(
                        2,
                        '0'
                      )}:${String(
                        Math.floor((flashRemainingSec % 3600) / 60)
                      ).padStart(2, '0')}:${String(
                        flashRemainingSec % 60
                      ).padStart(2, '0')}`
                    : '';

                  const effectiveStock = selectedVariant
                    ? selectedVariant.stock
                    : product.stockQuantity;

                  const cartEntryKey = buildCartItemId(
                    product.id,
                    selectedVariant?.variantId
                  );
                  const qty = getQuantityInCart(cartEntryKey);

                  const outOfStock =
                    !product.isAvailable ||
                    (typeof effectiveStock === 'number' && effectiveStock <= 0);
                  const lowStock =
                    !outOfStock &&
                    typeof effectiveStock === 'number' &&
                    effectiveStock <= 5;
                  const reachedMaxStock =
                    typeof effectiveStock === 'number' && qty >= effectiveStock;

                  const menuPayload: MenuItem = {
                    id: product.id,
                    name: product.name,
                    price: effectivePrice,
                    description: product.description,
                    category: product.category,
                    imageUrl: product.imageUrl,
                    stockQuantity: effectiveStock,
                    hasVariants: product.hasVariants,
                    variants: product.variants,
                    isMysteryBox: product.isMysteryBox,
                    originalValueEgp: isFlashActive
                      ? basePrice
                      : product.originalValueEgp,
                  };

                  return (
                    <article
                      key={product.id}
                      className="rounded-2xl bg-[#1E293B] border border-[#334155] hover:border-[#FF6B00]/60 transition-colors p-4 sm:p-5 flex flex-row items-stretch gap-4 sm:gap-5 group"
                    >
                      <div className="w-28 sm:w-36 min-h-[118px] sm:min-h-[136px] rounded-2xl overflow-hidden bg-[#0F172A] shrink-0 relative">
                        <ResilientImage
                          src={product.imageUrl || ''}
                          alt={product.name}
                          fallbackLabel={product.name}
                          className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out ${
                            !isOpen || outOfStock
                              ? 'grayscale-[35%] opacity-85'
                              : ''
                          }`}
                        />

                        {isFlashActive ? (
                          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-[#FF6B00] text-white text-[10px] font-bold inline-flex items-center gap-1 shadow-sm">
                            <Flame className="w-3 h-3" />
                            <span>خصم فلاش {product.flashDiscountPercent}%</span>
                          </span>
                        ) : product.isMysteryBox ? (
                          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-[#FF6B00] text-white text-[10px] font-bold inline-flex items-center gap-1 shadow-sm">
                            <Gift className="w-3 h-3" />
                            <span>صندوق مفاجآت</span>
                          </span>
                        ) : null}
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 text-right">
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-[11px] sm:text-xs font-bold text-[#FF6B00] truncate">
                              {product.category}
                            </p>
                            {isFlashActive ? (
                              <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-950/60 border border-amber-500/40 px-2 py-0.5 rounded-lg tabular-nums shrink-0">
                                ينتهي خلال {flashCountdownText}
                              </span>
                            ) : outOfStock ? (
                              <span className="text-[11px] font-bold text-rose-400 shrink-0">
                                نفدت الكمية
                              </span>
                            ) : lowStock ? (
                              <span className="text-[11px] font-bold text-amber-400 shrink-0 tabular-nums">
                                متبقي {effectiveStock} فقط
                              </span>
                            ) : null}
                          </div>

                          <h3 className="text-base sm:text-lg font-bold text-[#F8FAFC] leading-snug">
                            {product.name}
                          </h3>
                          <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed line-clamp-2 mt-1">
                            {product.description}
                          </p>

                          {/* Smart Variants Selector (Sizes / Colors / Cosmetic Shades) */}
                          {hasVariants && product.variants && (
                            <div className="mt-2.5 space-y-1.5">
                              <p className="text-[11px] font-bold text-[#F8FAFC]">
                                اختر المقاس / اللون / الدرجة:
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {product.variants.map((variant) => {
                                  const isSelected =
                                    selectedVariant?.variantId ===
                                    variant.variantId;
                                  const variantSoldOut = variant.stock <= 0;
                                  const extraMeta = [
                                    variant.size,
                                    variant.color,
                                    variant.shade,
                                  ]
                                    .filter(
                                      (part) =>
                                        part &&
                                        part.trim() &&
                                        !variant.name.includes(part.trim())
                                    )
                                    .join(' · ');

                                  return (
                                    <button
                                      key={variant.variantId}
                                      type="button"
                                      onClick={() =>
                                        setSelectedVariantByProduct((prev) => ({
                                          ...prev,
                                          [product.id]: variant.variantId,
                                        }))
                                      }
                                      className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                                        isSelected
                                          ? 'bg-[#FF6B00] text-white border-[#FF6B00]'
                                          : variantSoldOut
                                          ? 'bg-[#0F172A] text-[#94A3B8] border-[#334155] line-through opacity-60'
                                          : 'bg-[#0F172A] text-[#F8FAFC] border-[#334155] hover:border-[#FF6B00]'
                                      }`}
                                    >
                                      <span>
                                        {variant.name}
                                        {extraMeta ? ` (${extraMeta})` : ''}
                                      </span>
                                      <span className="font-mono tabular-nums mr-1 opacity-90">
                                        · {variant.price} ج.م
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="pt-3 mt-3 border-t border-[#334155] flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-baseline gap-2">
                            <p className="text-base sm:text-lg font-bold text-[#F8FAFC] whitespace-nowrap">
                              <span className="font-mono tabular-nums text-[#FF6B00]">
                                {effectivePrice}
                              </span>{' '}
                              <span className="text-xs sm:text-sm font-semibold text-[#94A3B8]">
                                ج.م
                              </span>
                            </p>
                            {isFlashActive ? (
                              <span className="text-xs text-[#94A3B8] line-through font-mono tabular-nums">
                                {basePrice} ج.م
                              </span>
                            ) : (
                              product.originalValueEgp &&
                              product.originalValueEgp > effectivePrice && (
                                <span className="text-xs text-[#94A3B8] line-through font-mono tabular-nums">
                                  {product.originalValueEgp} ج.م
                                </span>
                              )
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {isGroupCartForThisStore &&
                              activeSharedCart &&
                              onUpsertSharedCartItem &&
                              isOpen &&
                              !outOfStock && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void onUpsertSharedCartItem(
                                      activeSharedCart.id,
                                      {
                                        ...product,
                                        name: selectedVariant
                                          ? `${product.name} (${selectedVariant.name})`
                                          : product.name,
                                        price: effectivePrice,
                                      },
                                      1
                                    )
                                  }
                                  className="py-2 px-2.5 rounded-xl bg-[#0F172A] border border-[#334155] hover:border-[#FF6B00] text-[#F8FAFC] text-[11px] font-bold cursor-pointer whitespace-nowrap"
                                >
                                  + للسلة الجماعية
                                </button>
                              )}

                            {!isOpen ? (
                              <button
                                type="button"
                                disabled
                                className="py-2 px-3.5 rounded-xl bg-[#0F172A] border border-[#334155] text-[#94A3B8] text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-not-allowed"
                              >
                                <Lock
                                  className="w-3.5 h-3.5"
                                  aria-hidden="true"
                                />
                                <span>مغلق حالياً</span>
                              </button>
                            ) : outOfStock ? (
                              <button
                                type="button"
                                disabled
                                className="py-2 px-3.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs font-bold whitespace-nowrap shrink-0 cursor-not-allowed"
                              >
                                نفدت الكمية
                              </button>
                            ) : qty > 0 ? (
                              <div className="inline-flex items-center gap-1.5 bg-[#0F172A] border border-[#334155] rounded-2xl p-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateCartQuantity(cartEntryKey, -1)
                                  }
                                  aria-label={`تقليل كمية ${product.name}`}
                                  className="w-8 h-8 rounded-xl bg-[#1E293B] border border-[#334155] flex items-center justify-center text-[#F8FAFC] cursor-pointer"
                                >
                                  <Minus
                                    className="w-3.5 h-3.5"
                                    aria-hidden="true"
                                  />
                                </button>
                                <span className="w-6 text-center font-mono font-bold text-xs sm:text-sm text-[#F8FAFC] tabular-nums">
                                  {qty}
                                </span>
                                <button
                                  type="button"
                                  disabled={reachedMaxStock}
                                  onClick={() =>
                                    onAddProductToCart(
                                      store,
                                      menuPayload,
                                      selectedVariant
                                    )
                                  }
                                  aria-label={`زيادة كمية ${product.name}`}
                                  className="w-8 h-8 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-45 text-white flex items-center justify-center cursor-pointer"
                                >
                                  <Plus
                                    className="w-3.5 h-3.5"
                                    aria-hidden="true"
                                  />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  onAddProductToCart(
                                    store,
                                    menuPayload,
                                    selectedVariant
                                  )
                                }
                                aria-label={`إضافة ${product.name} إلى السلة`}
                                className="py-2 px-4 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] active:scale-[0.96] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                <span>إضافة</span>
                                <Plus
                                  className="w-3.5 h-3.5"
                                  aria-hidden="true"
                                />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Customer Reviews Section (/reviews) */}
        {reviews.length > 0 && (
          <section className="rounded-2xl bg-[#1E293B] border border-[#334155] p-6 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <MessageSquareQuote className="w-5 h-5 text-[#FF6B00]" />
                <h2 className="text-lg sm:text-xl font-bold text-[#F8FAFC]">
                  آراء وتقييمات عملاء إدكاوي
                </h2>
              </div>
              <span className="text-xs font-semibold text-[#94A3B8] tabular-nums">
                {reviews.length} تقييم موثق
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reviews.slice(0, 6).map((rev) => (
                <div
                  key={rev.id}
                  className="rounded-2xl bg-[#0F172A] p-4 border border-[#334155] space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-[#F8FAFC]">
                      {rev.customerName}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 tabular-nums">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      {rev.storeRating} / 5
                    </span>
                  </div>
                  {rev.comment ? (
                    <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
                      {rev.comment}
                    </p>
                  ) : (
                    <p className="text-xs text-[#94A3B8]">
                      تقييم بالنجوم بعد إتمام التوصيل
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
