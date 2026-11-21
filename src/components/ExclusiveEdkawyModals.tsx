import React, { useEffect, useState } from 'react';
import {
  Bike,
  Camera,
  Check,
  CloudSun,
  Copy,
  ExternalLink,
  Gift,
  Loader2,
  MapPin,
  Search,
  ShoppingBag,
  Star,
  Store,
  X,
} from 'lucide-react';
import { EDKU_CITY_CENTER } from '../data/edkuSeedStores';
import {
  fetchEdkuWeatherPromo,
  getNextDailySpinAvailableMs,
  markGooglePlayReviewPromptShownInFirestore,
  searchProductsByImageWithAi,
  spinDailyWheelInFirestore,
} from '../services/edkawiFirebaseService';
import {
  CustomErrandOrderInput,
  DailySpinResult,
  EdkuWeatherPromoResponse,
  MenuItem,
  ProductRecord,
  StoreCategory,
  StoreRecord,
} from '../types/edkawi';
import {
  formatAppErrorMessage,
  GOOGLE_PLAY_STORE_URL,
  STORE_CATEGORIES,
} from '../utils/orderLogic';
import { DeviceImageInput } from './DeviceImageInput';
import { EdkuLocationPickerMap } from './EdkuGoogleMaps';

/* ============================================================================
 * 1. EDKU LIVE WEATHER SMART PROMO BANNER (مطابقة الطقس في إدكو)
 * ========================================================================== */

interface EdkuWeatherPromoBannerProps {
  onSelectCategory: (category: StoreCategory) => void;
}

const VALID_WEATHER_CATEGORIES: readonly StoreCategory[] = STORE_CATEGORIES;

export const EdkuWeatherPromoBanner: React.FC<EdkuWeatherPromoBannerProps> = ({
  onSelectCategory,
}) => {
  const [weather, setWeather] = useState<EdkuWeatherPromoResponse | null>(null);

  useEffect(() => {
    let active = true;
    void fetchEdkuWeatherPromo().then((res) => {
      if (active && res && res.ok) {
        setWeather(res);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  if (!weather) return null;

  const targetCategory: StoreCategory = VALID_WEATHER_CATEGORIES.includes(
    weather.recommendedCategory as StoreCategory
  )
    ? (weather.recommendedCategory as StoreCategory)
    : 'مشويات ومطاعم';

  return (
    <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
      <div className="flex items-start sm:items-center gap-3.5">
        <div className="w-11 h-11 rounded-2xl bg-[#FF6B00]/10 text-[#FF6B00] flex items-center justify-center shrink-0">
          <CloudSun className="w-6 h-6" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#94A3B8] tabular-nums">
            <span>طقس مدينة إدكو الآن: {weather.tempC}°C</span>
            <span aria-hidden="true">·</span>
            <span>{weather.conditionLabel}</span>
          </div>
          <h3 className="mt-0.5 text-sm sm:text-base font-bold text-[#F8FAFC]">
            {weather.headlineAr}
          </h3>
          <p className="mt-0.5 text-xs sm:text-sm text-[#94A3B8]">
            {weather.subtextAr}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onSelectCategory(targetCategory)}
        className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 cursor-pointer"
      >
        تصفح {targetCategory}
      </button>
    </div>
  );
};

/* ============================================================================
 * 2. VISUAL SEARCH MODAL (البحث بالصور 📷)
 * ========================================================================== */

interface ResolvedVisualMatch {
  productId: string;
  productName: string;
  price: number;
  category?: string;
  description?: string;
  imageUrl?: string;
  store: StoreRecord;
}

interface VisualSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductRecord[];
  stores: StoreRecord[];
  onAddMatchedProductToCart: (store: StoreRecord, item: MenuItem) => void;
  onOpenStore: (store: StoreRecord) => void;
}

export const VisualSearchModal: React.FC<VisualSearchModalProps> = ({
  isOpen,
  onClose,
  products,
  stores,
  onAddMatchedProductToCart,
  onOpenStore,
}) => {
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [detectedDish, setDetectedDish] = useState<string | null>(null);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [matches, setMatches] = useState<ResolvedVisualMatch[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const resolveMatchedItems = (matchedIds: string[]): ResolvedVisualMatch[] => {
    const activeStoresById = new Map<string, StoreRecord>();
    for (const st of stores) {
      if (st.isActive !== false) {
        activeStoresById.set(st.id, st);
      }
    }

    const resolved: ResolvedVisualMatch[] = [];
    for (const id of matchedIds) {
      const prod = products.find((p) => p.id === id);
      if (prod && activeStoresById.has(prod.storeId)) {
        resolved.push({
          productId: prod.id,
          productName: prod.name,
          price: prod.price,
          category: prod.category,
          description: prod.description,
          imageUrl: prod.imageUrl,
          store: activeStoresById.get(prod.storeId)!,
        });
        continue;
      }
      for (const st of activeStoresById.values()) {
        const embedded = st.menuItems.find((mi) => mi.id === id);
        if (embedded) {
          resolved.push({
            productId: embedded.id,
            productName: embedded.name,
            price: embedded.price,
            category: embedded.category || st.category,
            description: embedded.description,
            imageUrl: embedded.imageUrl,
            store: st,
          });
          break;
        }
      }
    }
    return resolved;
  };

  const handleAnalyzePhoto = async () => {
    if (!imageDataUrl) {
      setErrorMsg('يرجى التقاط أو اختيار صورة الطبق من جهازك أولاً.');
      return;
    }
    setErrorMsg(null);
    setAnalyzing(true);
    try {
      const res = await searchProductsByImageWithAi(
        imageDataUrl,
        products,
        stores
      );
      setDetectedDish(res.detectedDishAr || null);
      setSummaryText(res.summaryAr || null);
      setMatches(resolveMatchedItems(res.matchedProductIds || []));
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'تعذر تحليل الصورة حالياً.'
      );
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div
      className="edkawi-modal-backdrop flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="البحث بالصور في مطاعم إدكو"
    >
      <div className="w-full max-w-2xl rounded-3xl bg-[#1E293B] border border-[#334155] shadow-2xl overflow-hidden my-auto max-h-[90dvh] flex flex-col">
        <div className="px-5 py-4 bg-[#1E293B] text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Camera className="w-5 h-5 text-[#FF6B00]" />
            <h2 className="text-base sm:text-lg font-bold text-white">
              البحث الذكي بالصور في مطاعم ومتاجر إدكو
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق البحث بالصور"
            className="min-h-[44px] min-w-[44px] rounded-xl text-white/80 hover:text-white hover:bg-white/10 flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          <DeviceImageInput
            label="ارفع أو صوّر أكلة أو منتجاً تبحث عنه"
            value={imageDataUrl}
            onChange={(url) => {
              setImageDataUrl(url);
              setErrorMsg(null);
            }}
            allowCameraCapture={true}
            helperText="ارفع صورة أي طبق (مشويات، أسماك، بيتزا، حلويات...) وسنعرض لك أقرب الأصناف المتوفرة في مطاعم إدكو فوراً"
          />

          <button
            type="button"
            disabled={!imageDataUrl || analyzing}
            onClick={handleAnalyzePhoto}
            className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-50 text-white text-sm font-bold cursor-pointer"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري مطابقة الصورة مع منيو مطاعم إدكو...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>ابحث عن الطبق في مطاعم إدكو</span>
              </>
            )}
          </button>

          {errorMsg && (
            <p className="text-xs font-bold text-red-400">
              {errorMsg}
            </p>
          )}

          {(detectedDish || summaryText) && (
            <div className="rounded-2xl bg-[#0F172A] border border-[#334155] p-4 space-y-3">
              {detectedDish && (
                <p className="text-sm font-bold text-[#F8FAFC]">
                  الصنف المكتشف:{' '}
                  <span className="text-[#FF6B00]">{detectedDish}</span>
                </p>
              )}
              {summaryText && (
                <p className="text-xs sm:text-sm text-[#94A3B8]">
                  {summaryText}
                </p>
              )}

              {matches.length > 0 ? (
                <div className="space-y-2.5 pt-2">
                  {matches.map((m) => (
                    <div
                      key={`${m.store.id}_${m.productId}`}
                      className="rounded-xl bg-[#1E293B] border border-[#334155] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-sm font-bold text-[#F8FAFC]">
                          {m.productName}
                        </p>
                        <p className="text-xs text-[#94A3B8] tabular-nums">
                          {m.store.name} · {m.price} ج.م
                          {m.category ? ` · ${m.category}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            onOpenStore(m.store);
                            onClose();
                          }}
                          className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#334155] text-xs font-bold text-[#F8FAFC] whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Store className="w-3.5 h-3.5" />
                          <span>المتجر</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onAddMatchedProductToCart(m.store, {
                              id: m.productId,
                              name: m.productName,
                              price: m.price,
                              description: m.description,
                              category: m.category,
                              imageUrl: m.imageUrl,
                            });
                            onClose();
                          }}
                          className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>أضف للسلة</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs font-semibold text-[#94A3B8]">
                  لا توجد أصناف مطابقة حالياً في المنيو المتاح — جرب صورة أخرى أو تصفح أقسام المطاعم.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 3. CUSTOM ERRAND SERVICE MODAL (خدمة المشاوير — توصيل أي طلب خاص في إدكو)
 * ========================================================================== */

interface ErrandServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCustomerName: string;
  defaultCustomerPhone: string;
  defaultNeighborhood: string;
  defaultAddress: string;
  defaultLat?: number;
  defaultLng?: number;
  isAnonymous: boolean;
  onRequireLogin: () => void;
  onSubmitErrand: (input: CustomErrandOrderInput) => Promise<void>;
}

export const ErrandServiceModal: React.FC<ErrandServiceModalProps> = ({
  isOpen,
  onClose,
  defaultCustomerName,
  defaultCustomerPhone,
  defaultNeighborhood,
  defaultAddress,
  defaultLat,
  defaultLng,
  isAnonymous,
  onRequireLogin,
  onSubmitErrand,
}) => {
  const [errandDescription, setErrandDescription] = useState('');
  const [errandPickupAddress, setErrandPickupAddress] = useState('');
  const [customerName, setCustomerName] = useState(defaultCustomerName);
  const [customerPhone, setCustomerPhone] = useState(defaultCustomerPhone);
  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState(
    defaultNeighborhood || 'شارع البحر'
  );
  const [deliveryAddress, setDeliveryAddress] = useState(defaultAddress);
  const [customerLat, setCustomerLat] = useState<number>(
    defaultLat ?? EDKU_CITY_CENTER.lat
  );
  const [customerLng, setCustomerLng] = useState<number>(
    defaultLng ?? EDKU_CITY_CENTER.lng
  );
  const [isWaterPin, setIsWaterPin] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (defaultCustomerName && !customerName)
        setCustomerName(defaultCustomerName);
      if (defaultCustomerPhone && !customerPhone)
        setCustomerPhone(defaultCustomerPhone);
      if (defaultAddress && !deliveryAddress) setDeliveryAddress(defaultAddress);
    }
  }, [
    isOpen,
    defaultCustomerName,
    defaultCustomerPhone,
    defaultAddress,
    customerName,
    customerPhone,
    deliveryAddress,
  ]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAnonymous) {
      onClose();
      onRequireLogin();
      return;
    }
    if (isWaterPin) {
      setErrorMsg(
        'من فضلك اختر موقع تسليم على الأرض داخل إدكو بعيداً عن المسطحات المائية.'
      );
      return;
    }
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await onSubmitErrand({
        customerName,
        customerPhone,
        errandPickupAddress,
        errandDescription,
        deliveryNeighborhood,
        deliveryAddress,
        customerLat,
        customerLng,
        notes,
      });
      setErrandDescription('');
      setErrandPickupAddress('');
      setNotes('');
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'تعذر إرسال طلب المشوار حالياً.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="edkawi-modal-backdrop flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="خدمة مشاوير إدكاوي"
    >
      <div className="w-full max-w-2xl rounded-3xl bg-[#1E293B] border border-[#334155] shadow-2xl overflow-hidden my-auto max-h-[92dvh] flex flex-col">
        <div className="px-5 py-4 bg-[#1E293B] text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Bike className="w-5 h-5 text-[#FF6B00]" />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                خدمة مشاوير إدكاوي السريعة
              </h2>
              <p className="text-xs text-slate-300">
                اكتب مشوارك وسيعرض عليك الكابتن التكلفة لتوافق عليها قبل التنفيذ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة المشاوير"
            className="min-h-[44px] min-w-[44px] rounded-xl text-white/80 hover:text-white hover:bg-white/10 flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-5 sm:p-6 overflow-y-auto space-y-4"
        >
          <div>
            <label className="block text-xs font-bold text-[#F8FAFC] mb-1.5">
              تفاصيل المشوار أو الطلب المطلوب توصيله
            </label>
            <textarea
              rows={3}
              value={errandDescription}
              onChange={(e) => setErrandDescription(e.target.value)}
              placeholder="مثال: استلام شنطة أوراق من مكتب البريد أو شراء طلب خاص وتوصيله للمنزل..."
              maxLength={380}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] bg-[#0F172A] text-sm text-[#F8FAFC] placeholder:text-[#64748B]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#F8FAFC] mb-1.5">
              مكان الاستلام (من أين يبدأ الكابتن المشوار؟)
            </label>
            <input
              type="text"
              value={errandPickupAddress}
              onChange={(e) => setErrandPickupAddress(e.target.value)}
              placeholder="مثال: موقف إدكو العمومي / شارع جمال عبد الناصر"
              maxLength={160}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#334155] bg-[#0F172A] text-sm text-[#F8FAFC] placeholder:text-[#64748B]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#F8FAFC] mb-1.5">
                اسم المستلم
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="الاسم الثلاثي"
                maxLength={80}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#334155] bg-[#0F172A] text-sm text-[#F8FAFC]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#F8FAFC] mb-1.5">
                رقم الموبايل (11 رقم مصري)
              </label>
              <input
                type="tel"
                dir="ltr"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="01012345678"
                maxLength={14}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#334155] bg-[#0F172A] text-sm text-[#F8FAFC] text-left tabular-nums"
              />
            </div>
          </div>

          <EdkuLocationPickerMap
            label="حدد نقطة التسليم على خريطة إدكو"
            lat={customerLat}
            lng={customerLng}
            neighborhood={deliveryNeighborhood}
            heightClassName="h-[230px]"
            onWaterValidationChange={setIsWaterPin}
            onChange={(loc) => {
              setCustomerLat(loc.lat);
              setCustomerLng(loc.lng);
              setDeliveryNeighborhood(loc.neighborhood);
              if (loc.resolvedAddress) {
                setDeliveryAddress(loc.resolvedAddress);
              }
            }}
          />

          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-[#F8FAFC] mb-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span>عنوان التسليم التفصيلي (الدور / العلامة المميزة)</span>
            </label>
            <input
              type="text"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder="مثال: بجوار مسجد المحطة — عمارة 4 — الدور الثاني"
              maxLength={200}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#334155] bg-[#0F172A] text-sm text-[#F8FAFC]"
            />
          </div>

          {errorMsg && (
            <p className="text-xs font-bold text-red-400">
              {errorMsg}
            </p>
          )}

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-[#334155] text-xs font-bold text-[#F8FAFC] cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting || isWaterPin}
              className="min-h-[46px] inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-50 text-white text-sm font-bold whitespace-nowrap shrink-0 cursor-pointer"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Bike className="w-4 h-4" />
              )}
              <span>إرسال المشوار للكباتن لعرض التكلفة</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ============================================================================
 * 4. DAILY SPIN WHEEL MODAL (عجلة الحظ اليومية كل ٢٤ ساعة)
 * ========================================================================== */

interface DailySpinWheelModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerUid?: string;
  currentUserUid?: string;
  customerName?: string;
  userPoints?: number;
  lastSpinDate?: string;
  onNotify?: (message: string) => void;
}

export const DailySpinWheelModal: React.FC<DailySpinWheelModalProps> = ({
  isOpen,
  onClose,
  customerUid,
  currentUserUid,
  customerName,
  userPoints,
  lastSpinDate,
  onNotify,
}) => {
  const effectiveUid = customerUid || currentUserUid || '';
  const effectiveName = customerName || 'عميل إدكاوي';
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<DailySpinResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedCoupon, setCopiedCoupon] = useState(false);
  const [remainingMs, setRemainingMs] = useState<number>(() =>
    getNextDailySpinAvailableMs(lastSpinDate)
  );

  useEffect(() => {
    if (!isOpen) return;
    setRemainingMs(getNextDailySpinAvailableMs(lastSpinDate));
    const timer = window.setInterval(() => {
      setRemainingMs(getNextDailySpinAvailableMs(lastSpinDate));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isOpen, lastSpinDate]);

  if (!isOpen) return null;

  const formatCountdown = (ms: number): string => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(
      2,
      '0'
    )}:${String(secs).padStart(2, '0')}`;
  };

  const handleSpin = async () => {
    setErrorMsg(null);
    setSpinning(true);
    try {
      const outcome = await spinDailyWheelInFirestore(
        effectiveUid,
        effectiveName
      );
      setResult(outcome);
      if (onNotify) {
        onNotify(outcome.labelAr);
      }
    } catch (err) {
      setErrorMsg(
        formatAppErrorMessage(err, 'تعذر تشغيل عجلة الحظ اليومية حالياً.')
      );
    } finally {
      setSpinning(false);
    }
  };

  return (
    <div
      className="edkawi-modal-backdrop flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="عجلة الحظ اليومية في إدكاوي"
    >
      <div className="w-full max-w-md rounded-3xl bg-[#1E293B] border border-[#334155] shadow-2xl overflow-hidden">
        <div className="px-5 py-4 bg-[#1E293B] text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Gift className="w-5 h-5 text-[#FF6B00]" />
            <h2 className="text-base sm:text-lg font-bold text-white">
              عجلة الحظ اليومية من إدكاوي
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق عجلة الحظ"
            className="min-h-[40px] min-w-[40px] rounded-xl text-white/80 hover:text-white hover:bg-white/10 flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-center">
          <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
            لفّة مجانية واحدة كل ٢٤ ساعة للفوز بنقاط ولاء فورية، كوبون خصم لمرة واحدة، أو توصيل مجاني لطلبك القادم في إدكو!
          </p>

          <div className="grid grid-cols-3 gap-2.5 text-xs font-bold">
            <div className="rounded-2xl bg-[#0F172A] border border-[#334155] p-3 space-y-1">
              <p className="text-[#FF6B00] font-mono tabular-nums">+15 / +30</p>
              <p className="text-[#F8FAFC]">نقطة ولاء</p>
            </div>
            <div className="rounded-2xl bg-[#0F172A] border border-[#334155] p-3 space-y-1">
              <p className="text-[#FF6B00] font-mono tabular-nums">15% خصم</p>
              <p className="text-[#F8FAFC]">كوبون فوري</p>
            </div>
            <div className="rounded-2xl bg-[#0F172A] border border-[#334155] p-3 space-y-1">
              <p className="text-emerald-400">مجاني</p>
              <p className="text-[#F8FAFC]">توصيل طلبك</p>
            </div>
          </div>

          {result && (
            <div className="rounded-2xl bg-emerald-950/40 border border-emerald-800 p-4 space-y-2.5">
              <p className="text-sm font-bold text-emerald-100">
                مبروك! جائزتك اليوم: {result.labelAr}
              </p>
              {result.couponCode && (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-[#1E293B] px-3 py-2 border border-emerald-800">
                  <span
                    dir="ltr"
                    className="font-mono font-bold text-sm text-[#FF6B00]"
                  >
                    {result.couponCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(result.couponCode!);
                      setCopiedCoupon(true);
                      window.setTimeout(() => setCopiedCoupon(false), 2000);
                    }}
                    className="px-3 py-1 rounded-lg bg-[#1E293B] text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedCoupon ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedCoupon ? 'تم النسخ' : 'نسخ الكود'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {errorMsg && (
            <p className="text-xs font-bold text-rose-400">
              {errorMsg}
            </p>
          )}

          {remainingMs > 0 && !result ? (
            <div className="rounded-2xl bg-[#0F172A] p-4 space-y-1">
              <p className="text-xs text-[#94A3B8]">
                لقد استخدمت لفّتك اليومية — تتجدد اللفّة القادمة خلال:
              </p>
              <p
                dir="ltr"
                className="font-mono text-xl font-bold text-[#F8FAFC] tabular-nums"
              >
                {formatCountdown(remainingMs)}
              </p>
            </div>
          ) : !result ? (
            <button
              type="button"
              disabled={spinning}
              onClick={handleSpin}
              className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-60 text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              {spinning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جارٍ تدوير العجلة وتسجيل الجائزة...</span>
                </>
              ) : (
                <>
                  <Gift className="w-4 h-4" />
                  <span>لفّ العجلة الآن واكسب مكافأتك</span>
                </>
              )}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export function shouldShowGooglePlayReviewPrompt(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const shown = localStorage.getItem('edkawi_play_review_dismissed_v1');
    return shown !== 'true';
  } catch {
    return false;
  }
}

interface GooglePlayReviewPromptModalProps {
  isOpen: boolean;
  customerUid?: string;
  customerName?: string;
  onClose: () => void;
}

export const GooglePlayReviewPromptModal: React.FC<
  GooglePlayReviewPromptModalProps
> = ({ isOpen, customerUid, customerName, onClose }) => {
  useEffect(() => {
    if (isOpen) {
      try {
        localStorage.setItem('edkawi_play_review_dismissed_v1', 'true');
      } catch {}
      if (customerUid) {
        void markGooglePlayReviewPromptShownInFirestore(customerUid).catch(
          () => {}
        );
      }
    }
  }, [isOpen, customerUid]);

  if (!isOpen) return null;

  return (
    <div
      className="edkawi-modal-backdrop flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="تقييم تطبيق إدكاوي على Google Play"
    >
      <div className="w-full max-w-md rounded-3xl bg-[#1E293B] border border-[#334155] shadow-2xl p-6 space-y-5 text-center">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center mx-auto">
          <Star className="w-6 h-6 fill-amber-400 text-amber-500" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-[#F8FAFC]">
            سعداء بخدمتك في مدينة إدكو!
          </h2>
          <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
            رأيك الصادق على متجر Google Play يساعد متاجر وكباتن إدكاوي على تقديم خدمة أفضل لأهل إدكو يومياً.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5">
          <a
            href={GOOGLE_PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <span>تقييم إدكاوي على Google Play</span>
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2.5 rounded-xl border border-[#334155] text-xs font-bold text-[#94A3B8] cursor-pointer"
          >
            ليس الآن
          </button>
        </div>
      </div>
    </div>
  );
};
