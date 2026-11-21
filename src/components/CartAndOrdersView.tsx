import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Banknote,
  Bike,
  CalendarClock,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  FileText,
  Gift,
  HeartHandshake,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Minus,
  PackageCheck,
  Phone,
  Pill,
  Plus,
  ShoppingBag,
  Star,
  Tag,
  Trash2,
  Truck,
  User as UserIcon,
  Users,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import {
  APPROVED_EDKO_ZONES,
  EDKU_CITY_CENTER,
  resolveEdkuCoordsForNeighborhood,
  resolveZoneForNeighborhood,
} from '../data/edkuSeedStores';
import { tipCourierForDeliveredOrderInFirestore } from '../services/edkawiFirebaseService';
import {
  AppliedCoupon,
  CartItem,
  CheckoutFormInput,
  EdkoZoneId,
  EdkoZoneRecord,
  OrderRecord,
  OrderStatus,
  PaymentMethod,
  PaymentMethodsConfig,
  ReviewRecord,
  SharedCartRecord,
  StoreRecord,
  UserProfileRecord,
} from '../types/edkawi';
import {
  calculateCartTotals,
  EDKU_NEIGHBORHOODS,
  formatAppErrorMessage,
  formatArabicCartCount,
  getCartEntryKey,
  getOrderStatusLabel,
  getPaymentMethodLabel,
  GOOGLE_PLAY_STORE_URL,
  isStoreCurrentlyOpen,
  normalizeEgyptPhoneOrEmpty,
  SMALL_ORDER_THRESHOLD_EGP,
  validateCheckoutForm,
} from '../utils/orderLogic';
import { ConfirmActionModal } from './ConfirmActionModal';
import {
  EdkuLocationPickerMap,
  LiveOrderScooterMap,
} from './EdkuGoogleMaps';
import { EmptyState } from './EmptyState';
import { ResilientImage } from './ResilientImage';
import { OrdersListSkeleton } from './SkeletonLoaders';

/* ============================================================================
 * 1. DEDICATED CART PAGE (صفحة السلة + زر إتمام الطلب الثابت أسفل الشاشة)
 * ========================================================================== */

function CheckoutGoogleIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v2.98h3.86c2.26-2.09 3.56-5.17 3.56-8.8z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-2.98c-1.08.72-2.45 1.16-4.07 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.31c-.24-.72-.38-1.49-.38-2.31s.14-1.59.38-2.31V6.6H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.4l3.99-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.6l3.99 3.09c.95-2.85 3.6-4.94 6.72-4.94z"
      />
    </svg>
  );
}

interface CartPageViewProps {
  cart: CartItem[];
  cartStore?: StoreRecord | null;
  isGuestCustomer?: boolean;
  appliedCoupon?: AppliedCoupon | null;
  onApplyCoupon?: (rawCode: string, subtotal: number) => Promise<void>;
  onRemoveCoupon?: () => void;
  onUpdateQuantity: (itemId: string, delta: number) => void;
  onRemoveItem: (itemId: string) => void;
  onClearCart: () => void;
  onBackToShopping: () => void;
  onProceedToCheckout: () => void;
  onSignInWithGoogleForCheckout?: () => Promise<void>;
  onOpenLoginScreenForCheckout?: () => void;
}

export function CartPageView({
  cart,
  cartStore,
  isGuestCustomer = false,
  appliedCoupon = null,
  onApplyCoupon,
  onRemoveCoupon,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onBackToShopping,
  onProceedToCheckout,
  onSignInWithGoogleForCheckout,
  onOpenLoginScreenForCheckout,
}: CartPageViewProps) {
  const [authBusy, setAuthBusy] = useState(false);
  const [authErr, setAuthErr] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState(appliedCoupon?.code ?? '');
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponFeedback, setCouponFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [confirmCartAction, setConfirmCartAction] = useState<
    | { type: 'clear' }
    | { type: 'remove'; entryKey: string; itemName: string }
    | null
  >(null);

  const totals = calculateCartTotals(cart, appliedCoupon);
  const storeIsClosed = cartStore ? !isStoreCurrentlyOpen(cartStore) : false;
  const minOrderAmount =
    cartStore?.minOrderAmount && cartStore.minOrderAmount > 0
      ? cartStore.minOrderAmount
      : 0;
  const belowMinOrder = minOrderAmount > 0 && totals.subtotal < minOrderAmount;
  const canCheckout = !storeIsClosed && !belowMinOrder;

  async function handleApplyCouponSubmit(e: FormEvent) {
    e.preventDefault();
    if (!onApplyCoupon) return;
    setCouponFeedback(null);
    setCouponBusy(true);
    try {
      await onApplyCoupon(couponInput, totals.subtotal);
      setCouponFeedback({
        type: 'success',
        text: 'تم تفعيل كود الخصم واحتساب قيمة التوفير بنجاح!',
      });
    } catch (err) {
      setCouponFeedback({
        type: 'error',
        text: formatAppErrorMessage(err, 'تعذر تفعيل كود الخصم.'),
      });
    } finally {
      setCouponBusy(false);
    }
  }

  if (cart.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-14 edkawi-page-enter">
        <EmptyState
          icon={ShoppingBag}
          title="سلة المشتريات فارغة حالياً"
          description="تصفح متاجر ومطاعم وصيدليات مدينة إدكو وأضف أصنافك المفضلة لتظهر هنا."
          actionLabel="تصفح متاجر إدكاوي"
          onAction={onBackToShopping}
        />
      </div>
    );
  }

  return (
    <>
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-12 pb-32 space-y-8 edkawi-page-enter">
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBackToShopping}
            className="inline-flex items-center gap-2 py-2.5 px-4 rounded-2xl bg-[#1E293B] border border-[#334155] hover:border-[#FF6B00] active:scale-[0.97] text-xs sm:text-sm font-bold text-[#F8FAFC] cursor-pointer whitespace-nowrap"
          >
            <ArrowRight
              className="w-4 h-4 text-[#FF6B00]"
              aria-hidden="true"
            />
            <span>إضافة أصناف أخرى</span>
          </button>

          <button
            type="button"
            onClick={() => setConfirmCartAction({ type: 'clear' })}
            className="inline-flex items-center gap-1.5 py-2.5 px-4 rounded-2xl bg-[#1E293B] border border-red-500/40 text-xs sm:text-sm font-bold text-red-400 hover:bg-red-950/40 active:scale-[0.97] cursor-pointer whitespace-nowrap"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            <span>إفراغ السلة بالكامل</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Right Column: Editable Cart Items */}
          <section
            aria-labelledby="cart-page-heading"
            className="lg:col-span-8 rounded-2xl bg-[#1E293B] border border-[#334155] p-6"
          >
            <div className="pb-5 border-b border-[#334155] flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-[#FF6B00]">
                  سلة المشتريات من متجر
                </p>
                <h1
                  id="cart-page-heading"
                  className="text-xl sm:text-2xl font-bold text-[#F8FAFC] mt-0.5"
                >
                  {cart[0].storeName}
                </h1>
              </div>
              <span className="text-xs font-bold text-[#94A3B8]">
                {formatArabicCartCount(totals.itemCount)}
              </span>
            </div>

            <div className="divide-y divide-[#334155]">
              {cart.map((entry) => {
                const entryKey = getCartEntryKey(entry);
                const unitPrice =
                  entry.selectedVariant?.price ?? entry.item.price;
                const maxStock =
                  entry.selectedVariant?.stock ?? entry.item.stockQuantity;
                const reachedMax =
                  typeof maxStock === 'number' && entry.quantity >= maxStock;

                return (
                  <div
                    key={entryKey}
                    className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-20 h-20 rounded-2xl overflow-hidden bg-[#0F172A] border border-[#334155] shrink-0">
                        <ResilientImage
                          src={entry.item.imageUrl || ''}
                          alt={entry.item.name}
                          fallbackLabel={entry.item.name}
                          compact
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <h2 className="text-base sm:text-lg font-bold text-[#F8FAFC] leading-snug">
                          {entry.item.name}
                        </h2>
                        {entry.selectedVariant && (
                          <p className="text-xs font-semibold text-[#FF6B00]">
                            الخيار المحدد: {entry.selectedVariant.name}
                          </p>
                        )}
                        <p className="text-xs sm:text-sm text-[#94A3B8]">
                          سعر الوحدة:{' '}
                          <span className="font-mono font-semibold text-[#F8FAFC] tabular-nums">
                            {unitPrice}
                          </span>{' '}
                          ج.م · الإجمالي:{' '}
                          <span className="font-mono font-bold text-[#FF6B00] tabular-nums">
                            {unitPrice * entry.quantity}
                          </span>{' '}
                          ج.م
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <div className="inline-flex items-center gap-1.5 bg-[#0F172A] border border-[#334155] p-1 rounded-2xl">
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(entryKey, -1)}
                          aria-label={`تقليل كمية ${entry.item.name}`}
                          className="w-9 h-9 rounded-xl bg-[#1E293B] border border-[#334155] flex items-center justify-center text-[#F8FAFC] cursor-pointer"
                        >
                          <Minus className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <span className="w-7 text-center font-mono font-bold text-sm text-[#F8FAFC] tabular-nums">
                          {entry.quantity}
                        </span>
                        <button
                          type="button"
                          disabled={reachedMax}
                          onClick={() => onUpdateQuantity(entryKey, 1)}
                          aria-label={`زيادة كمية ${entry.item.name}`}
                          className="w-9 h-9 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-45 text-white flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setConfirmCartAction({
                            type: 'remove',
                            entryKey,
                            itemName: entry.item.name,
                          })
                        }
                        aria-label={`حذف ${entry.item.name} من السلة`}
                        className="p-2.5 rounded-2xl border border-[#334155] bg-[#0F172A] text-red-400 hover:bg-red-950/40 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Left Column: Accurate Bill Summary */}
          <aside
            aria-labelledby="cart-summary-heading"
            className="lg:col-span-4 rounded-2xl bg-[#1E293B] border border-[#334155] p-6 space-y-5"
          >
            <h2
              id="cart-summary-heading"
              className="text-lg sm:text-xl font-bold text-[#F8FAFC]"
            >
              ملخص الفاتورة
            </h2>

            <div className="space-y-3.5 text-sm">
              <div className="flex items-center justify-between text-[#94A3B8]">
                <span>
                  قيمة المنتجات (
                  <span className="font-mono tabular-nums">
                    {totals.itemCount}
                  </span>
                  )
                </span>
                <span className="font-semibold text-[#F8FAFC]">
                  <span className="font-mono tabular-nums">
                    {totals.subtotal}
                  </span>{' '}
                  ج.م
                </span>
              </div>

              <div className="flex items-center justify-between text-[#94A3B8]">
                <span>رسوم التوصيل المبدئية</span>
                <span className="font-semibold text-[#F8FAFC]">
                  <span className="font-mono tabular-nums">
                    {totals.deliveryFee}
                  </span>{' '}
                  ج.م
                </span>
              </div>

              {totals.smallOrderFee > 0 && (
                <div className="flex items-center justify-between text-amber-400 text-xs font-semibold">
                  <span>
                    رسوم الطلبات الصغيرة (أقل من {SMALL_ORDER_THRESHOLD_EGP} ج.م)
                  </span>
                  <span className="font-mono tabular-nums">
                    + {totals.smallOrderFee} ج.م
                  </span>
                </div>
              )}

              {totals.discountAmount > 0 && (
                <div className="flex items-center justify-between text-emerald-400 font-semibold">
                  <span>
                    خصم الكوبون ({totals.couponCode} · {totals.discountPercent}%)
                  </span>
                  <span className="font-mono tabular-nums">
                    - {totals.discountAmount} ج.م
                  </span>
                </div>
              )}

              {/* Coupon Code Input Box (/coupons) */}
              {onApplyCoupon && (
                <div className="pt-3 border-t border-[#334155] space-y-2.5">
                  <label
                    htmlFor="cart-coupon-input"
                    className="block text-xs font-bold text-[#F8FAFC] flex items-center gap-1.5"
                  >
                    <Tag className="w-3.5 h-3.5 text-[#FF6B00]" />
                    <span>كود الخصم أو قسيمة نقاط الولاء</span>
                  </label>

                  {appliedCoupon ? (
                    <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 text-xs">
                      <div>
                        <span className="font-mono font-bold text-emerald-200">
                          {appliedCoupon.code}
                        </span>
                        <span className="text-emerald-300 mr-1.5">
                          (خصم {appliedCoupon.discountPercent}%)
                        </span>
                      </div>
                      {onRemoveCoupon && (
                        <button
                          type="button"
                          onClick={() => {
                            onRemoveCoupon();
                            setCouponFeedback(null);
                          }}
                          aria-label="إزالة كود الخصم"
                          className="p-1 rounded-lg text-emerald-200 hover:bg-emerald-900 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <form
                      onSubmit={handleApplyCouponSubmit}
                      className="flex items-center gap-2"
                    >
                      <input
                        id="cart-coupon-input"
                        type="text"
                        dir="ltr"
                        value={couponInput}
                        onChange={(e) =>
                          setCouponInput(e.target.value.toUpperCase())
                        }
                        placeholder="EDK25"
                        maxLength={32}
                        className="flex-1 min-h-[42px] px-3 py-2 rounded-2xl border border-[#334155] bg-[#0F172A] text-[#F8FAFC] text-xs font-mono uppercase text-left"
                      />
                      <button
                        type="submit"
                        disabled={couponBusy || !couponInput.trim()}
                        className="min-h-[42px] px-4 py-2 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-50 text-white text-xs font-bold cursor-pointer shrink-0"
                      >
                        {couponBusy ? '...' : 'تطبيق'}
                      </button>
                    </form>
                  )}

                  {couponFeedback && (
                    <p
                      className={`text-xs font-semibold ${
                        couponFeedback.type === 'success'
                          ? 'text-emerald-400'
                          : 'text-red-400'
                      }`}
                    >
                      {couponFeedback.text}
                    </p>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-[#334155] flex items-center justify-between text-base font-bold text-[#F8FAFC]">
                <span>الإجمالي الكلي</span>
                <span className="text-xl text-[#FF6B00]">
                  <span className="font-mono tabular-nums">
                    {totals.totalAmount}
                  </span>{' '}
                  ج.م
                </span>
              </div>
            </div>

            {storeIsClosed && (
              <div
                role="alert"
                className="p-4 rounded-2xl bg-red-950/50 border border-red-500/40 text-xs sm:text-sm font-semibold text-red-200 flex items-start gap-2.5"
              >
                <Lock
                  className="w-4 h-4 text-red-400 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <span>
                  هذا المتجر مغلق حالياً ولا يستقبل طلبات جديدة في الوقت الحالي.
                </span>
              </div>
            )}

            {!storeIsClosed && belowMinOrder && (
              <div
                role="status"
                className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-xs sm:text-sm font-semibold text-amber-200"
              >
                الحد الأدنى للطلب من هذا المتجر هو{' '}
                <span className="font-mono font-bold tabular-nums">
                  {minOrderAmount}
                </span>{' '}
                ج.م — أضف أصنافاً بقيمة{' '}
                <span className="font-mono font-bold tabular-nums">
                  {minOrderAmount - totals.subtotal}
                </span>{' '}
                ج.م إضافية للمتابعة.
              </div>
            )}

            {isGuestCustomer && !storeIsClosed && (
              <div className="p-4 rounded-2xl bg-[#0F172A] border border-[#334155] space-y-3">
                <p className="text-xs sm:text-sm font-bold text-[#F8FAFC]">
                  يلزم تسجيل الدخول قبل إنشاء الطلب
                </p>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  أنت تتصفح حالياً كضيف. سجّل دخولك الآن بحساب Google أو البريد
                  الإلكتروني للمتابعة للدفع مع الاحتفاظ بجميع أصناف السلة.
                </p>
                {authErr && (
                  <p role="alert" className="text-xs font-semibold text-red-400">
                    {authErr}
                  </p>
                )}
                {onSignInWithGoogleForCheckout && (
                  <button
                    type="button"
                    disabled={authBusy}
                    onClick={async () => {
                      setAuthErr(null);
                      setAuthBusy(true);
                      try {
                        await onSignInWithGoogleForCheckout();
                      } catch (err) {
                        setAuthErr(
                          err instanceof Error
                            ? err.message
                            : 'تعذر إتمام تسجيل الدخول بحساب Google.'
                        );
                      } finally {
                        setAuthBusy(false);
                      }
                    }}
                    className="w-full min-h-[44px] py-2.5 px-4 rounded-2xl bg-[#1E293B] hover:border-[#FF6B00] border border-[#334155] text-xs sm:text-sm font-bold text-[#F8FAFC] inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <CheckoutGoogleIcon />
                    <span>
                      {authBusy
                        ? 'جارٍ تسجيل الدخول...'
                        : 'المتابعة بحساب Google'}
                    </span>
                  </button>
                )}
                {onOpenLoginScreenForCheckout && (
                  <button
                    type="button"
                    disabled={authBusy}
                    onClick={onOpenLoginScreenForCheckout}
                    className="w-full py-2 px-3 rounded-2xl text-xs font-bold text-[#FF6B00] hover:underline cursor-pointer whitespace-nowrap"
                  >
                    أو تسجيل الدخول بالبريد الإلكتروني
                  </button>
                )}
              </div>
            )}

            <p className="text-xs text-[#94A3B8] leading-relaxed">
              اضغط على زر إتمام الطلب الثابت بالأسفل لتثبيت موقعك على خريطة إدكو
              وتأكيد الطلب.
            </p>
          </aside>
        </div>
      </div>

      {/* Sticky Bottom Checkout CTA Bar */}
      <div
        role="region"
        aria-label="شريط إتمام الطلب الثابت"
        className="fixed bottom-0 inset-x-0 z-30 bg-[#0F172A]/95 backdrop-blur-md border-t border-[#334155]"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-8 h-16 sm:h-[72px] flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs text-[#94A3B8] font-semibold">
              الإجمالي شامل التوصيل ({formatArabicCartCount(totals.itemCount)})
            </p>
            <p className="text-lg sm:text-xl font-bold text-[#F8FAFC]">
              <span className="font-mono tabular-nums">
                {totals.totalAmount}
              </span>{' '}
              <span className="text-xs sm:text-sm font-semibold text-[#94A3B8]">
                ج.م
              </span>
            </p>
          </div>

          <button
            type="button"
            disabled={!canCheckout}
            onClick={() => {
              if (canCheckout) {
                onProceedToCheckout();
              }
            }}
            aria-label="المتابعة لإتمام الطلب"
            className="py-3 px-7 sm:px-10 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] active:scale-[0.97] disabled:opacity-55 disabled:cursor-not-allowed text-white font-bold text-sm sm:text-base inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shadow-lg"
          >
            {storeIsClosed ? (
              <>
                <Lock className="w-4 h-4" aria-hidden="true" />
                <span>المتجر مغلق حالياً</span>
              </>
            ) : belowMinOrder ? (
              <span>
                الحد الأدنى{' '}
                <span className="font-mono tabular-nums">{minOrderAmount}</span>{' '}
                ج.م
              </span>
            ) : (
              <>
                <span>إتمام الطلب</span>
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </div>

      <ConfirmActionModal
        isOpen={confirmCartAction !== null}
        title={
          confirmCartAction?.type === 'clear'
            ? 'إفراغ سلة المشتريات'
            : 'حذف صنف من السلة'
        }
        description={
          confirmCartAction?.type === 'clear'
            ? 'هل أنت متأكد من إفراغ جميع الأصناف من سلة المشتريات؟'
            : `هل تريد حذف «${confirmCartAction?.itemName ?? ''}» من السلة؟`
        }
        confirmLabel={
          confirmCartAction?.type === 'clear' ? 'إفراغ السلة' : 'حذف الصنف'
        }
        cancelLabel="تراجع"
        tone="danger"
        onConfirm={() => {
          if (confirmCartAction?.type === 'clear') {
            onClearCart();
          } else if (confirmCartAction?.type === 'remove') {
            onRemoveItem(confirmCartAction.entryKey);
          }
          setConfirmCartAction(null);
        }}
        onCancel={() => setConfirmCartAction(null)}
      />
    </>
  );
}

/* ============================================================================
 * 2. DEDICATED CHECKOUT PAGE (Map Pin + Cash Active + Visa Disabled "قريباً" + Scheduling)
 * ========================================================================== */

interface CheckoutPageViewProps {
  cart: CartItem[];
  cartStore?: StoreRecord | null;
  edkoZones?: EdkoZoneRecord[];
  isGuestCustomer?: boolean;
  defaultCustomerName?: string;
  userProfile?: UserProfileRecord | null;
  appliedCoupon?: AppliedCoupon | null;
  activeSharedCart?: SharedCartRecord | null;
  paymentMethodsConfig?: PaymentMethodsConfig;
  onBackToCart: () => void;
  onConfirmOrder: (checkout: CheckoutFormInput) => Promise<string>;
  onOpenWalletTopup?: () => void;
  onSignInWithGoogleForCheckout?: () => Promise<void>;
  onEmailAuthForCheckout?: (
    mode: 'login' | 'register',
    payload: { name?: string; email: string; password: string }
  ) => Promise<void>;
  onOpenLoginScreenForCheckout?: () => void;
}

export function CheckoutPageView({
  cart,
  cartStore,
  edkoZones,
  isGuestCustomer = false,
  defaultCustomerName = '',
  userProfile = null,
  appliedCoupon = null,
  activeSharedCart = null,
  paymentMethodsConfig,
  onBackToCart,
  onConfirmOrder,
  onOpenWalletTopup,
  onSignInWithGoogleForCheckout,
  onEmailAuthForCheckout,
  onOpenLoginScreenForCheckout,
}: CheckoutPageViewProps) {
  const activeZones = useMemo(() => {
    const filtered =
      edkoZones && edkoZones.length > 0
        ? [...edkoZones]
            .filter((z) => z.isActive !== false)
            .sort((a, b) => a.zoneNumber - b.zoneNumber)
        : [...APPROVED_EDKO_ZONES];
    return filtered.length > 0 ? filtered : [...APPROVED_EDKO_ZONES];
  }, [edkoZones]);

  const [customerName, setCustomerName] = useState(
    userProfile?.name || defaultCustomerName
  );
  const [customerPhone, setCustomerPhone] = useState(userProfile?.phone || '');
  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState<string>(
    userProfile?.defaultNeighborhood || EDKU_NEIGHBORHOODS[0]
  );
  const [selectedZoneId, setSelectedZoneId] = useState<EdkoZoneId>(() => {
    const initialArea =
      userProfile?.defaultNeighborhood || EDKU_NEIGHBORHOODS[0];
    return resolveZoneForNeighborhood(initialArea, activeZones).id;
  });
  const [useFreeDeliveryReward, setUseFreeDeliveryReward] = useState(false);
  const [isCheckoutWaterPin, setIsCheckoutWaterPin] = useState(false);

  const [customerLat, setCustomerLat] = useState<number>(
    userProfile?.defaultLat ?? EDKU_CITY_CENTER.lat
  );
  const [customerLng, setCustomerLng] = useState<number>(
    userProfile?.defaultLng ?? EDKU_CITY_CENTER.lng
  );
  const [deliveryAddress, setDeliveryAddress] = useState(
    userProfile?.defaultAddress || ''
  );

  const cashEnabled = paymentMethodsConfig?.cash !== false;
  const walletEnabled = paymentMethodsConfig?.wallet !== false;
  const visaEnabled = Boolean(paymentMethodsConfig?.visa);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    cashEnabled ? 'cash' : walletEnabled ? 'wallet' : 'cash'
  );

  // Order Scheduling State
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDateTimeLocal, setScheduledDateTimeLocal] = useState('');

  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [guestAuthBusy, setGuestAuthBusy] = useState(false);
  const [guestAuthError, setGuestAuthError] = useState<string | null>(null);
  const [showInlineEmailAuth, setShowInlineEmailAuth] = useState(false);
  const [inlineAuthMode, setInlineAuthMode] = useState<'login' | 'register'>(
    'register'
  );
  const [inlineAuthName, setInlineAuthName] = useState('');
  const [inlineAuthEmail, setInlineAuthEmail] = useState('');
  const [inlineAuthPassword, setInlineAuthPassword] = useState('');

  useEffect(() => {
    const fallbackName = userProfile?.name || defaultCustomerName;
    if (fallbackName && !customerName.trim()) {
      setCustomerName(fallbackName);
    }
    if (userProfile?.phone && !customerPhone.trim()) {
      setCustomerPhone(userProfile.phone);
    }
    if (userProfile?.defaultNeighborhood) {
      setDeliveryNeighborhood(userProfile.defaultNeighborhood);
      setSelectedZoneId(
        resolveZoneForNeighborhood(userProfile.defaultNeighborhood, activeZones)
          .id
      );
    }
    if (typeof userProfile?.defaultLat === 'number') {
      setCustomerLat(userProfile.defaultLat);
    }
    if (typeof userProfile?.defaultLng === 'number') {
      setCustomerLng(userProfile.defaultLng);
    }
    if (userProfile?.defaultAddress && !deliveryAddress.trim()) {
      setDeliveryAddress(userProfile.defaultAddress);
    }
  }, [
    defaultCustomerName,
    userProfile?.name,
    userProfile?.phone,
    userProfile?.defaultNeighborhood,
    userProfile?.defaultLat,
    userProfile?.defaultLng,
    userProfile?.defaultAddress,
    activeZones,
  ]);

  useEffect(() => {
    setSubmitError(null);
  }, [cart.length, cartStore?.id, isGuestCustomer, userProfile?.uid]);

  const selectedZone = useMemo(
    () =>
      activeZones.find((z) => z.id === selectedZoneId) ??
      resolveZoneForNeighborhood(deliveryNeighborhood, activeZones),
    [activeZones, selectedZoneId, deliveryNeighborhood]
  );

  const availableFreeRewards = Math.max(
    0,
    Math.trunc(userProfile?.freeDeliveryRewards ?? 0)
  );
  const freeRewardApplied =
    useFreeDeliveryReward && availableFreeRewards > 0;

  const totals = calculateCartTotals(cart, appliedCoupon, {
    zoneDeliveryFee: selectedZone.deliveryFee,
    useFreeDeliveryReward: freeRewardApplied,
  });
  const storeIsClosed = cartStore ? !isStoreCurrentlyOpen(cartStore) : false;
  const minOrderAmount =
    cartStore?.minOrderAmount && cartStore.minOrderAmount > 0
      ? cartStore.minOrderAmount
      : 0;
  const belowMinOrder = minOrderAmount > 0 && totals.subtotal < minOrderAmount;

  const walletBalance = Math.max(0, Number(userProfile?.walletBalance ?? 0));
  const hasEnoughWalletBalance = walletBalance >= totals.totalAmount;

  async function handleInlineGoogleSignIn() {
    if (!onSignInWithGoogleForCheckout) return;
    setGuestAuthError(null);
    setGuestAuthBusy(true);
    try {
      await onSignInWithGoogleForCheckout();
    } catch (err) {
      setGuestAuthError(
        err instanceof Error
          ? err.message
          : 'تعذر تسجيل الدخول بحساب Google. حاول مرة أخرى.'
      );
    } finally {
      setGuestAuthBusy(false);
    }
  }

  async function handleInlineEmailAuthSubmit(e: FormEvent) {
    e.preventDefault();
    if (!onEmailAuthForCheckout) return;
    setGuestAuthError(null);
    setGuestAuthBusy(true);
    try {
      await onEmailAuthForCheckout(inlineAuthMode, {
        name: inlineAuthName,
        email: inlineAuthEmail,
        password: inlineAuthPassword,
      });
      if (
        inlineAuthMode === 'register' &&
        inlineAuthName.trim() &&
        !customerName.trim()
      ) {
        setCustomerName(inlineAuthName.trim());
      }
    } catch (err) {
      setGuestAuthError(
        err instanceof Error
          ? err.message
          : 'تعذر إتمام تسجيل الدخول بالبريد الإلكتروني.'
      );
    } finally {
      setGuestAuthBusy(false);
    }
  }

  if (cart.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-14 edkawi-page-enter">
        <EmptyState
          icon={ShoppingBag}
          title="لا توجد أصناف لإتمام الطلب"
          description="أضف أصنافاً من أي متجر إلى السلة ثم انتقل لإتمام الطلب."
          actionLabel="العودة للسلة"
          onAction={onBackToCart}
        />
      </div>
    );
  }

  async function handleCheckoutSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitError(null);

    if (isGuestCustomer) {
      setSubmitError(
        'يجب تسجيل الدخول بحساب Google أو البريد الإلكتروني أولاً قبل إنشاء أي طلب.'
      );
      return;
    }

    if (isCheckoutWaterPin) {
      setSubmitError(
        'لا يمكن تثبيت موقع الاستلام فوق مياه البحر المتوسط أو بحيرة إدكو. يرجى تحريك الدبوس لليابسة.'
      );
      return;
    }

    if (paymentMethod === 'wallet' && !hasEnoughWalletBalance) {
      setSubmitError(
        `رصيد محفظتك (${walletBalance} ج.م) غير كافٍ لإتمام الطلب (${totals.totalAmount} ج.م). يمكنك شحن المحفظة أو الدفع كاش.`
      );
      return;
    }

    let resolvedScheduledIso: string | undefined;
    if (isScheduled) {
      if (!scheduledDateTimeLocal) {
        setErrors({
          scheduledForIso: 'يرجى تحديد موعد التوصيل المجدول.',
        });
        return;
      }
      const parsedDate = new Date(scheduledDateTimeLocal);
      if (
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.getTime() < Date.now() + 10 * 60 * 1000
      ) {
        setErrors({
          scheduledForIso:
            'يجب أن يكون موعد الجدولة بعد ١٥ دقيقة على الأقل من الوقت الحالي.',
        });
        return;
      }
      resolvedScheduledIso = parsedDate.toISOString();
    }

    const normalizedPhone = normalizeEgyptPhoneOrEmpty(customerPhone);
    const resolvedAddress =
      deliveryAddress.trim() ||
      `موقع محدد على الخريطة — ${deliveryNeighborhood}`;

    const payload: CheckoutFormInput = {
      customerName,
      customerPhone: normalizedPhone,
      deliveryNeighborhood,
      deliveryAddress: resolvedAddress,
      zoneId: selectedZone.id,
      zoneName: selectedZone.name,
      zoneDeliveryFee: selectedZone.deliveryFee,
      useFreeDeliveryReward: freeRewardApplied,
      customerLat,
      customerLng,
      isScheduled,
      scheduledForIso: resolvedScheduledIso,
      paymentMethod,
      notes,
    };

    const validation = validateCheckoutForm(payload, { allowVisa: visaEnabled });
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      await onConfirmOrder(payload);
    } catch (err) {
      setSubmitError(
        formatAppErrorMessage(err, 'تعذر حفظ الطلب في قاعدة البيانات.')
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-12 pb-32 space-y-8 edkawi-page-enter">
        <div>
          <button
            type="button"
            onClick={onBackToCart}
            className="inline-flex items-center gap-2 py-2.5 px-4 rounded-2xl bg-[#1E293B] border border-[#334155] hover:border-[#FF6B00] active:scale-[0.97] text-xs sm:text-sm font-bold text-[#F8FAFC] cursor-pointer whitespace-nowrap"
          >
            <ArrowRight
              className="w-4 h-4 text-[#FF6B00]"
              aria-hidden="true"
            />
            <span>العودة إلى السلة</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Right Column: Map Location Picker, Scheduling & Payment Form */}
          <section
            aria-labelledby="checkout-heading"
            className="lg:col-span-7 rounded-2xl bg-[#1E293B] border border-[#334155] p-6 space-y-6"
          >
            <div>
              <h1
                id="checkout-heading"
                className="text-xl sm:text-2xl font-bold text-[#F8FAFC] mb-1.5"
              >
                تحديد الموقع على الخريطة وطريقة الدفع
              </h1>
              <p className="text-xs sm:text-sm text-[#94A3B8]">
                ثبّت موقع استلام طلبك فوق خريطة إدكو ثم اضغط على زر &quot;تأكيد الطلب&quot; الثابت بالأسفل.
              </p>
            </div>

            {storeIsClosed && (
              <div
                role="alert"
                className="p-4 rounded-2xl bg-red-950/50 border border-red-500/40 text-red-200 text-sm font-semibold flex items-center gap-2.5"
              >
                <Lock className="w-4 h-4 text-red-400 shrink-0" aria-hidden="true" />
                <span>المتجر مغلق حالياً ولا يستقبل طلبات جديدة.</span>
              </div>
            )}

            {!storeIsClosed && belowMinOrder && (
              <div
                role="alert"
                className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-sm font-semibold"
              >
                الحد الأدنى للطلب من هذا المتجر هو{' '}
                <span className="font-mono font-bold tabular-nums">
                  {minOrderAmount}
                </span>{' '}
                ج.م.
              </div>
            )}

            {submitError && (
              <div
                role="alert"
                className="p-4 rounded-2xl bg-red-950/50 border border-red-500/40 text-red-200 text-sm"
              >
                {submitError}
              </div>
            )}

            {isGuestCustomer ? (
              <div className="p-6 rounded-2xl bg-[#0F172A] border border-[#334155] space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-base font-bold text-[#F8FAFC]">
                    <Lock
                      className="w-4 h-4 text-[#FF6B00] shrink-0"
                      aria-hidden="true"
                    />
                    <h2>يلزم تسجيل الدخول الفعلي قبل إنشاء الطلب</h2>
                  </div>
                  <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
                    سجّل دخولك الآن بحساب Google بضغطة واحدة أو بالبريد الإلكتروني
                    لتأكيد طلبك وتتبع المندوب مباشرة على خريطة إدكو.
                  </p>
                </div>

                {guestAuthError && (
                  <div
                    role="alert"
                    className="p-3.5 rounded-2xl bg-red-950/50 border border-red-500/40 text-xs sm:text-sm font-semibold text-red-200"
                  >
                    {guestAuthError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={guestAuthBusy}
                    onClick={handleInlineGoogleSignIn}
                    className="min-h-[48px] py-3 px-5 rounded-2xl bg-[#1E293B] hover:border-[#FF6B00] disabled:opacity-60 border border-[#334155] text-sm font-bold text-[#F8FAFC] inline-flex items-center justify-center gap-2.5 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <CheckoutGoogleIcon />
                    <span>
                      {guestAuthBusy
                        ? 'جارٍ الاتصال بحساب Google...'
                        : 'تسجيل الدخول بحساب Google'}
                    </span>
                  </button>

                  {onEmailAuthForCheckout ? (
                    <button
                      type="button"
                      disabled={guestAuthBusy}
                      onClick={() => {
                        setShowInlineEmailAuth((prev) => !prev);
                        setGuestAuthError(null);
                      }}
                      className="min-h-[48px] py-3 px-5 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] disabled:opacity-60 text-sm font-bold text-white inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Mail
                        className="w-4 h-4 text-[#FF6B00] shrink-0"
                        aria-hidden="true"
                      />
                      <span>الدخول أو التسجيل بالبريد</span>
                    </button>
                  ) : (
                    onOpenLoginScreenForCheckout && (
                      <button
                        type="button"
                        disabled={guestAuthBusy}
                        onClick={onOpenLoginScreenForCheckout}
                        className="min-h-[48px] py-3 px-5 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] disabled:opacity-60 text-sm font-bold text-white inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Mail
                          className="w-4 h-4 text-[#FF6B00] shrink-0"
                          aria-hidden="true"
                        />
                        <span>الدخول بالبريد الإلكتروني</span>
                      </button>
                    )
                  )}
                </div>

                {showInlineEmailAuth && onEmailAuthForCheckout && (
                  <form
                    onSubmit={handleInlineEmailAuthSubmit}
                    noValidate
                    className="pt-4 border-t border-[#334155] space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-200/70 bg-[#0F172A]">
                      <button
                        type="button"
                        onClick={() => {
                          setInlineAuthMode('register');
                          setGuestAuthError(null);
                        }}
                        className={`py-2 px-3 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap shrink-0 ${
                          inlineAuthMode === 'register'
                            ? 'bg-[#1E293B] text-[#F8FAFC] shadow-2xs'
                            : 'text-slate-600 text-[#94A3B8]'
                        }`}
                      >
                        إنشاء حساب عميل جديد
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setInlineAuthMode('login');
                          setGuestAuthError(null);
                        }}
                        className={`py-2 px-3 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap shrink-0 ${
                          inlineAuthMode === 'login'
                            ? 'bg-[#1E293B] text-[#F8FAFC] shadow-2xs'
                            : 'text-slate-600 text-[#94A3B8]'
                        }`}
                      >
                        لدي حساب بالفعل
                      </button>
                    </div>

                    {inlineAuthMode === 'register' && (
                      <div>
                        <label
                          htmlFor="checkout-inline-name"
                          className="block text-xs font-bold text-[#F8FAFC] mb-1"
                        >
                          الاسم بالكامل
                        </label>
                        <div className="relative">
                          <UserIcon
                            className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                            aria-hidden="true"
                          />
                          <input
                            id="checkout-inline-name"
                            type="text"
                            value={inlineAuthName}
                            onChange={(e) => setInlineAuthName(e.target.value)}
                            placeholder="أحمد محمد الإدكاوي"
                            maxLength={80}
                            className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-[#334155] text-sm"
                            required
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="checkout-inline-email"
                          className="block text-xs font-bold text-[#F8FAFC] mb-1"
                        >
                          البريد الإلكتروني
                        </label>
                        <input
                          id="checkout-inline-email"
                          type="email"
                          dir="ltr"
                          value={inlineAuthEmail}
                          onChange={(e) => setInlineAuthEmail(e.target.value)}
                          placeholder="name@example.com"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm font-mono text-left"
                          required
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="checkout-inline-password"
                          className="block text-xs font-bold text-[#F8FAFC] mb-1"
                        >
                          كلمة المرور
                        </label>
                        <input
                          id="checkout-inline-password"
                          type="password"
                          dir="ltr"
                          value={inlineAuthPassword}
                          onChange={(e) => setInlineAuthPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm font-mono text-left"
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={guestAuthBusy}
                      className="w-full min-h-[46px] py-2.5 px-5 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-60 text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                      <span>
                        {guestAuthBusy
                          ? 'جارٍ التحقق والمتابعة...'
                          : inlineAuthMode === 'register'
                            ? 'إنشاء الحساب والمتابعة للدفع'
                            : 'تسجيل الدخول والمتابعة للدفع'}
                      </span>
                      <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <form
                id="edkawi-checkout-form"
                onSubmit={handleCheckoutSubmit}
                noValidate
                className="space-y-7"
              >
                {/* Step 1: Map Location & Recipient */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-[#F8FAFC]">
                    <MapPin
                      className="w-4 h-4 text-[#FF6B00]"
                      aria-hidden="true"
                    />
                    <h2>١. موقع التوصيل على خريطة مدينة إدكو</h2>
                  </div>

                  {userProfile?.savedAddresses &&
                    userProfile.savedAddresses.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-[#94A3B8]">
                          اختر من مواقعك المحفوظة:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {userProfile.savedAddresses.map((saved) => {
                            const selected =
                              deliveryAddress === saved.address &&
                              deliveryNeighborhood === saved.neighborhood;
                            return (
                              <button
                                key={saved.id}
                                type="button"
                                onClick={() => {
                                  setDeliveryNeighborhood(saved.neighborhood);
                                  setDeliveryAddress(saved.address);
                                  const matchedSavedZone =
                                    resolveZoneForNeighborhood(
                                      saved.neighborhood,
                                      activeZones
                                    );
                                  setSelectedZoneId(matchedSavedZone.id);
                                  if (
                                    typeof saved.lat === 'number' &&
                                    typeof saved.lng === 'number'
                                  ) {
                                    setCustomerLat(saved.lat);
                                    setCustomerLng(saved.lng);
                                  } else {
                                    const coords =
                                      resolveEdkuCoordsForNeighborhood(
                                        saved.neighborhood
                                      );
                                    setCustomerLat(coords.lat);
                                    setCustomerLng(coords.lng);
                                  }
                                }}
                                className={`px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer ${
                                  selected
                                    ? 'bg-[#FF6B00] text-white border-[#FF6B00]'
                                    : 'edkawi-surface border-[#334155] hover:border-[#FF6B00]'
                                }`}
                              >
                                {saved.label} · {saved.neighborhood}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                  <EdkuLocationPickerMap
                    label="ثبّت دبوس الاستلام أو ابحث عن مكانك على الخريطة"
                    helperText="ابحث عن أي مكان أو شارع في شريط البحث أعلى الخريطة، أو اضغط (تلقائي GPS) لتحديد موقعك الحقيقي فوراً"
                    lat={customerLat}
                    lng={customerLng}
                    neighborhood={deliveryNeighborhood}
                    heightClassName="h-[245px]"
                    autoLocateOnMount={
                      typeof userProfile?.defaultLat !== 'number'
                    }
                    onWaterValidationChange={setIsCheckoutWaterPin}
                    onAddressResolved={(addr) => {
                      if (addr) {
                        setDeliveryAddress(addr);
                      }
                    }}
                    onChange={(picked) => {
                      setCustomerLat(picked.lat);
                      setCustomerLng(picked.lng);
                      setDeliveryNeighborhood(picked.neighborhood);
                      const matchedZ = resolveZoneForNeighborhood(
                        picked.neighborhood,
                        activeZones
                      );
                      setSelectedZoneId(matchedZ.id);
                      if (picked.resolvedAddress) {
                        setDeliveryAddress(picked.resolvedAddress);
                      }
                    }}
                  />

                  {/* Zonal Pricing Approved Edko Zones Selector */}
                  <div className="p-4 rounded-2xl edkawi-surface-muted border border-[#334155] space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="checkout-zone-select"
                        className="block text-xs font-bold text-[#F8FAFC]"
                      >
                        اختر منطقتك (التسعير الجغرافي المعتمد في إدكو) *
                      </label>
                      <span className="font-mono text-xs font-bold text-[#FF6B00] tabular-nums">
                        رسوم التوصيل: {selectedZone.deliveryFee} ج.م
                      </span>
                    </div>
                    <select
                      id="checkout-zone-select"
                      value={selectedZone.id}
                      onChange={(e) => {
                        const targetId = e.target.value as EdkoZoneId;
                        setSelectedZoneId(targetId);
                        const matched = activeZones.find((z) => z.id === targetId);
                        const nList = matched
                          ? matched.streetsAndNeighborhoods || matched.neighborhoods || []
                          : [];
                        if (nList.length > 0) {
                          setDeliveryNeighborhood(nList[0]);
                          const coords = resolveEdkuCoordsForNeighborhood(
                            nList[0]
                          );
                          setCustomerLat(coords.lat);
                          setCustomerLng(coords.lng);
                        }
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] bg-[#1E293B] text-sm font-semibold"
                    >
                      {activeZones.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.name} ({z.distanceRangeLabel || z.distanceRangeKm || ''}) — {z.deliveryFee} ج.م
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                      الأحياء والشوارع المشمولة في هذه المنطقة: {(selectedZone.streetsAndNeighborhoods || selectedZone.neighborhoods || []).join('، ')}
                    </p>

                    {availableFreeRewards > 0 && (
                      <label className="flex items-center gap-2.5 pt-2 border-t border-slate-200/70 border-[#334155] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useFreeDeliveryReward}
                          onChange={(e) => setUseFreeDeliveryReward(e.target.checked)}
                          className="w-4 h-4 accent-emerald-600 rounded"
                        />
                        <span className="text-xs font-bold text-emerald-700 text-emerald-400">
                          استخدام مكافأة التوصيل المجاني المتاحة في حسابك (رصيدك: {availableFreeRewards} مكافأة)
                        </span>
                      </label>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="checkout-name"
                        className="block text-xs font-bold text-[#F8FAFC] mb-1.5"
                      >
                        اسم العميل بالكامل
                      </label>
                      <input
                        id="checkout-name"
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="مثال: أحمد محمد الإدكاوي"
                        maxLength={80}
                        className="w-full px-4 py-3 rounded-2xl border border-[#334155] text-sm"
                      />
                      {errors.customerName && (
                        <p className="text-xs text-red-600 mt-1">
                          {errors.customerName}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="checkout-phone"
                        className="block text-xs font-bold text-[#F8FAFC] mb-1.5"
                      >
                        رقم الهاتف المحمول
                      </label>
                      <input
                        id="checkout-phone"
                        type="tel"
                        dir="ltr"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="01012345678"
                        maxLength={15}
                        className="w-full px-4 py-3 rounded-2xl border border-[#334155] text-sm font-mono tabular-nums text-left"
                      />
                      {errors.customerPhone && (
                        <p className="text-xs text-red-600 mt-1">
                          {errors.customerPhone}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="checkout-neighborhood"
                        className="block text-xs font-bold text-[#F8FAFC] mb-1.5"
                      >
                        الحي / المنطقة في إدكو
                      </label>
                      <select
                        id="checkout-neighborhood"
                        value={deliveryNeighborhood}
                        onChange={(e) => {
                          const nextArea = e.target.value;
                          setDeliveryNeighborhood(nextArea);
                          const matchedZ = resolveZoneForNeighborhood(
                            nextArea,
                            activeZones
                          );
                          setSelectedZoneId(matchedZ.id);
                          const coords =
                            resolveEdkuCoordsForNeighborhood(nextArea);
                          setCustomerLat(coords.lat);
                          setCustomerLng(coords.lng);
                        }}
                        className="w-full px-4 py-3 rounded-2xl border border-[#334155] text-sm"
                      >
                        {EDKU_NEIGHBORHOODS.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="checkout-address"
                        className="block text-xs font-bold text-[#F8FAFC] mb-1.5"
                      >
                        علامة مميزة أو رقم العقار والدور
                      </label>
                      <input
                        id="checkout-address"
                        type="text"
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder="مثال: بجوار مسجد... الدور الثاني"
                        maxLength={200}
                        className="w-full px-4 py-3 rounded-2xl border border-[#334155] text-sm"
                      />
                      {errors.deliveryAddress && (
                        <p className="text-xs text-red-600 mt-1">
                          {errors.deliveryAddress}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="checkout-notes"
                      className="block text-xs font-bold text-[#F8FAFC] mb-1.5"
                    >
                      ملاحظات إضافية للمتجر أو المندوب (اختياري)
                    </label>
                    <textarea
                      id="checkout-notes"
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="مثال: بدون شطة، يرجى الاتصال عند الوصول"
                      maxLength={200}
                      className="w-full px-4 py-3 rounded-2xl border border-[#334155] text-sm"
                    />
                  </div>
                </div>

                {/* Step 2: Delivery Time / Order Scheduling */}
                <div className="pt-5 border-t border-slate-100 border-[#334155] space-y-4">
                  <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-[#F8FAFC]">
                    <CalendarClock
                      className="w-4 h-4 text-[#FF6B00]"
                      aria-hidden="true"
                    />
                    <h2>٢. موعد التوصيل</h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setIsScheduled(false)}
                      className={`p-4 rounded-2xl border text-right cursor-pointer ${
                        !isScheduled
                          ? 'border-[#FF6B00] bg-[#FF6B00]/8'
                          : 'border-[#334155] edkawi-surface'
                      }`}
                    >
                      <p className="text-sm font-bold text-[#F8FAFC]">
                        توصيل فوري الآن
                      </p>
                      <p className="text-xs text-[#94A3B8] mt-0.5">
                        يبدأ المتجر بالتحضير فور إرسال الطلب
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsScheduled(true)}
                      className={`p-4 rounded-2xl border text-right cursor-pointer ${
                        isScheduled
                          ? 'border-[#FF6B00] bg-[#FF6B00]/8'
                          : 'border-[#334155] edkawi-surface'
                      }`}
                    >
                      <p className="text-sm font-bold text-[#F8FAFC]">
                        جدولة الطلب لوقت لاحق
                      </p>
                      <p className="text-xs text-[#94A3B8] mt-0.5">
                        اختر الساعة والتاريخ المناسب لاستلام طلبك
                      </p>
                    </button>
                  </div>

                  {isScheduled && (
                    <div>
                      <label className="block text-xs font-bold text-[#F8FAFC] mb-1.5">
                        حدد تاريخ وساعة التوصيل المطلوبة
                      </label>
                      <input
                        type="datetime-local"
                        dir="ltr"
                        value={scheduledDateTimeLocal}
                        onChange={(e) =>
                          setScheduledDateTimeLocal(e.target.value)
                        }
                        className="w-full px-4 py-3 rounded-2xl border border-[#334155] text-sm font-mono"
                      />
                      {errors.scheduledForIso && (
                        <p className="text-xs text-red-600 mt-1">
                          {errors.scheduledForIso}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Step 3: Payment Methods (Cash, Edkawy Wallet, Visa governed by Admin config) */}
                <div className="pt-5 border-t border-[#334155] space-y-4">
                  <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-[#F8FAFC]">
                    <CreditCard
                      className="w-4 h-4 text-[#FF6B00]"
                      aria-hidden="true"
                    />
                    <h2>٣. طريقة الدفع</h2>
                  </div>

                  <div
                    role="radiogroup"
                    aria-label="اختيار طريقة الدفع"
                    className="grid grid-cols-1 gap-3"
                  >
                    {/* Cash on Delivery */}
                    <button
                      type="button"
                      role="radio"
                      aria-checked={paymentMethod === 'cash'}
                      disabled={!cashEnabled}
                      onClick={() => setPaymentMethod('cash')}
                      className={`p-4 rounded-2xl border-2 text-right flex items-start gap-3.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        paymentMethod === 'cash'
                          ? 'border-[#FF6B00] bg-[#FF6B00]/10'
                          : 'border-[#334155] bg-[#0F172A] hover:border-[#FF6B00]/60'
                      }`}
                    >
                      <Banknote
                        className="w-5 h-5 shrink-0 mt-0.5 text-[#FF6B00]"
                        aria-hidden="true"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold text-[#F8FAFC]">
                            كاش عند الاستلام
                          </p>
                          {!cashEnabled && (
                            <span className="text-[11px] font-bold text-[#94A3B8]">
                              غير متاح حالياً
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
                          ادفع نقداً لمندوب إدكاوي فور استلام طلبك لباب البيت
                        </p>
                      </div>
                    </button>

                    {/* Edkawy Wallet */}
                    <div
                      className={`p-4 rounded-2xl border-2 text-right transition-colors ${
                        paymentMethod === 'wallet'
                          ? 'border-[#FF6B00] bg-[#FF6B00]/10'
                          : 'border-[#334155] bg-[#0F172A] hover:border-[#FF6B00]/60'
                      }`}
                    >
                      <button
                        type="button"
                        role="radio"
                        aria-checked={paymentMethod === 'wallet'}
                        disabled={!walletEnabled}
                        onClick={() => setPaymentMethod('wallet')}
                        className="w-full text-right flex items-start gap-3.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Wallet
                          className="w-5 h-5 shrink-0 mt-0.5 text-[#FF6B00]"
                          aria-hidden="true"
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-bold text-[#F8FAFC]">
                              محفظة إدكاوي
                            </p>
                            <span className="text-xs font-mono font-bold text-[#FF6B00] tabular-nums">
                              الرصيد: {walletBalance} ج.م
                            </span>
                          </div>
                          <p className="text-xs text-[#94A3B8] leading-relaxed">
                            خصم فوري من رصيد محفظتك مع استرداد تلقائي إذا تم إلغاء الطلب.
                          </p>
                        </div>
                      </button>

                      {paymentMethod === 'wallet' && !hasEnoughWalletBalance && (
                        <div className="mt-3 pt-3 border-t border-[#334155] flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-amber-300">
                            الرصيد الحالي لا يكفي ({totals.totalAmount} ج.م مطلوب).
                          </p>
                          {onOpenWalletTopup && (
                            <button
                              type="button"
                              onClick={onOpenWalletTopup}
                              className="min-h-[36px] px-3 py-1.5 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs font-bold cursor-pointer"
                            >
                              شحن المحفظة الآن
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Visa Option */}
                    <button
                      type="button"
                      role="radio"
                      aria-checked={paymentMethod === 'visa'}
                      disabled={!visaEnabled}
                      aria-disabled={!visaEnabled}
                      onClick={() => {
                        if (visaEnabled) setPaymentMethod('visa');
                      }}
                      className={`p-4 rounded-2xl border-2 text-right flex items-start justify-between gap-3 transition-colors ${
                        !visaEnabled
                          ? 'border-[#334155] bg-[#0F172A]/60 opacity-60 cursor-not-allowed select-none'
                          : paymentMethod === 'visa'
                          ? 'border-[#FF6B00] bg-[#FF6B00]/10 cursor-pointer'
                          : 'border-[#334155] bg-[#0F172A] hover:border-[#FF6B00]/60 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <CreditCard
                          className={`w-5 h-5 shrink-0 mt-0.5 ${
                            visaEnabled ? 'text-[#FF6B00]' : 'text-[#94A3B8]'
                          }`}
                          aria-hidden="true"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-[#F8FAFC]">
                              بطاقة بنكية (فيزا / ميزة)
                            </p>
                            {!visaEnabled && (
                              <span className="px-2 py-0.5 rounded-md bg-[#334155] text-[#F8FAFC] text-[11px] font-extrabold">
                                قريباً
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
                            {visaEnabled
                              ? 'الدفع بالبطاقة البنكية متاح لتأكيد الطلب.'
                              : 'الدفع الإلكتروني بالبطاقات متوقف مؤقتاً وسيتوفر قريباً'}
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </section>

          {/* Left Column: Order Review Summary */}
          <aside
            aria-labelledby="checkout-summary-heading"
            className="lg:col-span-5 rounded-2xl bg-[#1E293B] border border-[#334155] p-6 space-y-5"
          >
            <div className="pb-4 border-b border-slate-100 border-[#334155]">
              <p className="text-xs font-bold text-[#FF6B00]">
                مراجعة الأصناف من
              </p>
              <h2
                id="checkout-summary-heading"
                className="text-lg sm:text-xl font-bold text-[#F8FAFC] mt-0.5"
              >
                {cart[0].storeName}
              </h2>
            </div>

            {activeSharedCart && activeSharedCart.items.length > 0 && (
              <div className="rounded-2xl bg-[#0F172A] bg-[#1E293B] border border-[#334155] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#FF6B00]" />
                    <span className="text-xs sm:text-sm font-bold text-[#F8FAFC]">
                      تفصيل الطلب الجماعي — مين ضاف إيه؟
                    </span>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {Array.from(
                    activeSharedCart.items.reduce(
                      (acc, entry) => {
                        const existing = acc.get(entry.participantUid);
                        if (existing) {
                          existing.items.push(entry);
                          existing.subtotal += entry.price * entry.quantity;
                        } else {
                          acc.set(entry.participantUid, {
                            participantName: entry.participantName,
                            items: [entry],
                            subtotal: entry.price * entry.quantity,
                          });
                        }
                        return acc;
                      },
                      new Map<
                        string,
                        {
                          participantName: string;
                          items: typeof activeSharedCart.items;
                          subtotal: number;
                        }
                      >()
                    )
                  ).map(([pUid, group]) => (
                    <div
                      key={pUid}
                      className="rounded-xl bg-[#1E293B] border border-[#334155] p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs font-bold">
                        <span className="text-[#F8FAFC]">
                          {group.participantName}
                        </span>
                        <span className="text-[#FF6B00] font-mono tabular-nums">
                          {group.subtotal} ج.م
                        </span>
                      </div>
                      <ul className="space-y-0.5 text-[11px] text-[#94A3B8]">
                        {group.items.map((it) => (
                          <li
                            key={it.entryId}
                            className="flex items-center justify-between gap-2"
                          >
                            <span>
                              {it.name} × {it.quantity}
                            </span>
                            <span className="font-mono tabular-nums">
                              {it.price * it.quantity} ج.م
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="divide-y divide-[#334155]">
              {totals.items.map((item, idx) => (
                <div
                  key={`${item.productId}_${item.variantId || idx}`}
                  className="py-3 flex items-center justify-between gap-3 text-sm"
                >
                  <span className="text-[#F8FAFC] font-medium">
                    {item.name}
                    {item.variantLabel ? (
                      <span className="text-[#FF6B00] text-xs font-semibold mr-1">
                        ({item.variantLabel})
                      </span>
                    ) : null}{' '}
                    <span className="text-slate-500 font-mono text-xs tabular-nums">
                      × {item.quantity}
                    </span>
                  </span>
                  <span className="font-semibold text-[#F8FAFC] shrink-0">
                    <span className="font-mono tabular-nums">
                      {item.price * item.quantity}
                    </span>{' '}
                    ج.م
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-100 border-[#334155] space-y-2.5 text-sm">
              <div className="flex items-center justify-between text-[#94A3B8]">
                <span>المجموع الفرعي</span>
                <span>
                  <span className="font-mono tabular-nums">
                    {totals.subtotal}
                  </span>{' '}
                  ج.م
                </span>
              </div>
              <div className="flex items-center justify-between text-[#94A3B8]">
                <span>رسوم توصيل ({selectedZone.name})</span>
                {totals.freeDeliveryApplied ? (
                  <span className="font-bold text-emerald-700 text-emerald-400">
                    مجاني (مكافأة)
                  </span>
                ) : (
                  <span>
                    <span className="font-mono tabular-nums">
                      {totals.deliveryFee}
                    </span>{' '}
                    ج.م
                  </span>
                )}
              </div>
              {totals.smallOrderFee > 0 && (
                <div className="flex items-center justify-between text-amber-400 text-xs font-semibold">
                  <span>
                    رسوم الطلبات الصغيرة (أقل من {SMALL_ORDER_THRESHOLD_EGP} ج.م)
                  </span>
                  <span className="font-mono tabular-nums">
                    + {totals.smallOrderFee} ج.م
                  </span>
                </div>
              )}
              {totals.discountAmount > 0 && (
                <div className="flex items-center justify-between text-emerald-700 text-emerald-400 font-semibold">
                  <span>خصم الكوبون ({totals.couponCode})</span>
                  <span className="font-mono tabular-nums">
                    - {totals.discountAmount} ج.م
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-[#94A3B8]">
                <span>طريقة الدفع المعتمدة</span>
                <span className="font-semibold text-[#F8FAFC]">
                  {getPaymentMethodLabel(paymentMethod)}
                </span>
              </div>
              <div className="pt-3 border-t border-slate-100 border-[#334155] flex items-center justify-between text-base font-bold text-[#F8FAFC]">
                <span>الإجمالي النهائي</span>
                <span className="text-xl text-[#FF6B00]">
                  <span className="font-mono tabular-nums">
                    {totals.totalAmount}
                  </span>{' '}
                  ج.م
                </span>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Sticky Bottom Confirm Order CTA Bar */}
      <div
        role="region"
        aria-label="شريط تأكيد الطلب الثابت"
        className="fixed bottom-0 inset-x-0 z-30 bg-[#0F172A]/95 backdrop-blur-md border-t border-[#334155]"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-8 h-16 sm:h-[72px] flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs text-[#94A3B8] font-semibold truncate">
              {getPaymentMethodLabel(paymentMethod)} · {selectedZone.name}
            </p>
            <p className="text-lg sm:text-xl font-bold text-[#F8FAFC]">
              <span className="font-mono tabular-nums">
                {totals.totalAmount}
              </span>{' '}
              <span className="text-xs sm:text-sm font-semibold text-[#94A3B8]">
                ج.م
              </span>
            </p>
          </div>

          {isGuestCustomer ? (
            <button
              type="button"
              disabled={guestAuthBusy || storeIsClosed || belowMinOrder}
              onClick={handleInlineGoogleSignIn}
              className="py-3 px-6 sm:px-8 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm sm:text-base inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0 shadow-lg"
            >
              {storeIsClosed ? (
                <span>المتجر مغلق حالياً</span>
              ) : guestAuthBusy ? (
                <span>جارٍ تسجيل الدخول...</span>
              ) : (
                <>
                  <span>سجّل الدخول لإتمام الطلب</span>
                  <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                </>
              )}
            </button>
          ) : (
            <button
              type="submit"
              form="edkawi-checkout-form"
              disabled={
                submitting ||
                storeIsClosed ||
                belowMinOrder ||
                isCheckoutWaterPin ||
                (paymentMethod === 'wallet' && !hasEnoughWalletBalance)
              }
              className="py-3 px-7 sm:px-10 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm sm:text-base inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shadow-lg"
            >
              {storeIsClosed ? (
                <span>المتجر مغلق حالياً</span>
              ) : submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>جارٍ تأكيد الطلب...</span>
                </>
              ) : (
                <>
                  <span>تأكيد الطلب</span>
                  <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/* ============================================================================
 * 3. LIVE ORDER TRACKING SCREEN (Supports Standard + 4-Stage Pharmacy Workflow)
 * ========================================================================== */

interface OrderTrackingViewProps {
  order: OrderRecord | null;
  store?: StoreRecord | null;
  justPlacedSuccess: boolean;
  existingReview?: ReviewRecord | null;
  onOpenReviewModal?: (order: OrderRecord) => void;
  onApprovePharmacyQuote?: (order: OrderRecord) => Promise<void>;
  onApproveErrandQuote?: (order: OrderRecord) => Promise<void>;
  onConfirmPendingOrder?: (
    orderId: string,
    paymentMethod?: PaymentMethod
  ) => Promise<OrderStatus | void>;
  onCancelOrder: (orderId: string) => Promise<void>;
  onNavigateToOrders: () => void;
  onNavigateToStores: () => void;
}

const STANDARD_TRACKING_STEPS: {
  key: OrderStatus;
  title: string;
  subtitle: string;
}[] = [
  {
    key: 'pending',
    title: 'قيد المراجعة',
    subtitle: 'تم تسجيل الطلب في إدكاوي وبانتظار قبول المتجر',
  },
  {
    key: 'preparing',
    title: 'جارٍ التجهيز في المتجر',
    subtitle: 'يقوم المتجر حالياً بتحضير وتغليف أصناف طلبك بعناية',
  },
  {
    key: 'on_the_way',
    title: 'في الطريق إليك',
    subtitle: 'استلم مندوب توصيل إدكاوي الطلب ويتجه لموقعك في إدكو',
  },
  {
    key: 'delivered',
    title: 'تم التوصيل بنجاح',
    subtitle: 'وصل الطلب إلى موقعك المحدد — بالهناء والشفاء',
  },
];

const PHARMACY_TRACKING_STEPS: {
  key: OrderStatus;
  title: string;
  subtitle: string;
}[] = [
  {
    key: 'awaiting_pharmacy_quote',
    title: 'تسعير الروشتة بالصيدلية',
    subtitle: 'تراجع الصيدلية صورة الروشتة والأدوية لتحديد السعر',
  },
  {
    key: 'awaiting_customer_approval',
    title: 'موافقتك على السعر',
    subtitle: 'تظهر لك التكلفة هنا للموافقة عليها قبل بدء التحضير',
  },
  {
    key: 'preparing',
    title: 'تحضير شنطة الدواء',
    subtitle: 'تجهز الصيدلية الأدوية وتسلمها لمندوب إدكاوي',
  },
  {
    key: 'delivered',
    title: 'التوصيل لباب البيت',
    subtitle: 'يوصل مندوب إدكاوي شنطة الدواء لموقعك ويدفع كاش',
  },
];

const CUSTOM_ERRAND_TRACKING_STEPS: {
  key: OrderStatus;
  title: string;
  subtitle: string;
}[] = [
  {
    key: 'awaiting_courier_quote',
    title: 'بانتظار عرض كابتن التوصيل',
    subtitle: 'يراجع أقرب كابتن تفاصيل المشوار ونقطة الاستلام لتحديد التكلفة',
  },
  {
    key: 'awaiting_customer_errand_approval',
    title: 'موافقتك على تكلفة المشوار',
    subtitle: 'راجع تكلفة المشوار المقترحة واضغط موافقة ليبدأ الكابتن فوراً',
  },
  {
    key: 'on_the_way',
    title: 'جاري تنفيذ المشوار في إدكو',
    subtitle: 'ينفذ كابتن إدكاوي مشوارك الآن ويتجه إلى موقعك على الخريطة',
  },
  {
    key: 'delivered',
    title: 'تم تسليم المشوار بنجاح',
    subtitle: 'وصل الكابتن لموقعك واكتمل المشوار بنجاح',
  },
];

function getStandardStepIndex(status: OrderStatus): number {
  switch (status) {
    case 'awaiting_pharmacy_quote':
    case 'awaiting_customer_approval':
    case 'awaiting_courier_quote':
    case 'awaiting_customer_errand_approval':
    case 'pending':
    case 'pending_payment':
    case 'confirmed':
      return 0;
    case 'preparing':
    case 'ready':
      return 1;
    case 'on_the_way':
    case 'delivering':
      return 2;
    case 'delivered':
      return 3;
    case 'cancelled':
      return -1;
  }
}

function getPharmacyStepIndex(status: OrderStatus): number {
  switch (status) {
    case 'awaiting_pharmacy_quote':
    case 'awaiting_courier_quote':
    case 'pending':
    case 'pending_payment':
    case 'confirmed':
      return 0;
    case 'awaiting_customer_approval':
    case 'awaiting_customer_errand_approval':
      return 1;
    case 'preparing':
    case 'ready':
      return 2;
    case 'on_the_way':
    case 'delivering':
    case 'delivered':
      return 3;
    case 'cancelled':
      return -1;
  }
}

function getCustomErrandStepIndex(status: OrderStatus): number {
  switch (status) {
    case 'awaiting_courier_quote':
    case 'pending':
    case 'pending_payment':
    case 'confirmed':
    case 'awaiting_pharmacy_quote':
      return 0;
    case 'awaiting_customer_errand_approval':
    case 'awaiting_customer_approval':
      return 1;
    case 'preparing':
    case 'ready':
    case 'on_the_way':
    case 'delivering':
      return 2;
    case 'delivered':
      return 3;
    case 'cancelled':
      return -1;
  }
}

export function OrderTrackingView({
  order,
  store = null,
  justPlacedSuccess,
  existingReview = null,
  onOpenReviewModal,
  onApprovePharmacyQuote,
  onApproveErrandQuote,
  onConfirmPendingOrder,
  onCancelOrder,
  onNavigateToOrders,
  onNavigateToStores,
}: OrderTrackingViewProps) {
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [approvingQuote, setApprovingQuote] = useState(false);
  const [tippingAmount, setTippingAmount] = useState<5 | 10 | 15 | null>(null);
  const [tipSuccessMsg, setTipSuccessMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setActionError(null);
  }, [order?.id, order?.status]);

  if (!order) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-14 edkawi-page-enter">
        <div className="edkawi-soft-card p-10 sm:p-14 text-center space-y-5">
          <PackageCheck
            className="w-10 h-10 text-[#FF6B00] mx-auto"
            aria-hidden="true"
          />
          <h1 className="text-xl font-bold text-[#F8FAFC]">
            جارٍ تحميل تفاصيل الطلب...
          </h1>
          <div className="flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onNavigateToOrders}
              className="py-2.5 px-5 rounded-xl bg-[#1E293B] text-white text-sm font-bold cursor-pointer"
            >
              عرض سجل الطلبات
            </button>
            <button
              type="button"
              onClick={onNavigateToStores}
              className="py-2.5 px-5 rounded-xl border border-[#334155] text-sm font-bold text-[#F8FAFC] cursor-pointer"
            >
              العودة للمتاجر
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isPharmacyOrder = order.orderType === 'pharmacy_prescription';
  const isCustomErrand = order.orderType === 'custom_errand';
  const steps = isCustomErrand
    ? CUSTOM_ERRAND_TRACKING_STEPS
    : isPharmacyOrder
    ? PHARMACY_TRACKING_STEPS
    : STANDARD_TRACKING_STEPS;
  const currentStep = isCustomErrand
    ? getCustomErrandStepIndex(order.status)
    : isPharmacyOrder
    ? getPharmacyStepIndex(order.status)
    : getStandardStepIndex(order.status);

  const canCustomerCancel =
    order.status === 'pending' ||
    order.status === 'confirmed' ||
    order.status === 'pending_payment' ||
    order.status === 'awaiting_pharmacy_quote' ||
    order.status === 'awaiting_customer_approval' ||
    order.status === 'awaiting_courier_quote' ||
    order.status === 'awaiting_customer_errand_approval';

  async function handleConfirmPendingClick() {
    if (!order || !onConfirmPendingOrder || confirming) return;
    setActionError(null);
    setConfirming(true);
    try {
      await onConfirmPendingOrder(order.id, order.paymentMethod);
    } catch (err) {
      setActionError(
        formatAppErrorMessage(err, 'تعذر تأكيد الطلب حالياً. يرجى المحاولة مرة أخرى.')
      );
    } finally {
      setConfirming(false);
    }
  }

  async function handleCancelClick() {
    if (!order || cancelling) return;
    setActionError(null);
    setCancelling(true);
    try {
      await onCancelOrder(order.id);
    } catch (err) {
      setActionError(formatAppErrorMessage(err, 'تعذر إلغاء الطلب حالياً.'));
    } finally {
      setCancelling(false);
    }
  }

  async function handleApproveQuoteClick() {
    if (!order || !onApprovePharmacyQuote) return;
    setActionError(null);
    setApprovingQuote(true);
    try {
      await onApprovePharmacyQuote(order);
    } catch (err) {
      setActionError(
        formatAppErrorMessage(err, 'تعذر تأكيد الموافقة على السعر حالياً.')
      );
    } finally {
      setApprovingQuote(false);
    }
  }

  async function handleApproveErrandClick() {
    if (!order || !onApproveErrandQuote) return;
    setActionError(null);
    setApprovingQuote(true);
    try {
      await onApproveErrandQuote(order);
    } catch (err) {
      setActionError(
        formatAppErrorMessage(err, 'تعذر تأكيد الموافقة على تكلفة المشوار حالياً.')
      );
    } finally {
      setApprovingQuote(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-7 edkawi-page-enter">
      {justPlacedSuccess && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-[20px] bg-emerald-950/40 border border-emerald-800 p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
        >
          <div className="flex items-start gap-3.5">
            <CheckCircle2
              className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-emerald-100">
                {isPharmacyOrder
                  ? 'تم إرسال الروشتة / الطلب للصيدلية بنجاح'
                  : 'تم تأكيد الطلب بنجاح'}
              </h1>
              <p className="text-xs sm:text-sm text-emerald-200 mt-1 leading-relaxed">
                {isPharmacyOrder
                  ? 'تراجع الصيدلية طلبك الآن لتحديد سعر الأدوية، وسيظهر لك السعر هنا للموافقة عليه أولاً قبل التحضير.'
                  : 'تم إرسال طلبك للمتجر بنجاح. يمكنك متابعة حالته وموقع المندوب مباشرة من هذه الشاشة.'}
              </p>
            </div>
          </div>

          <span
            dir="ltr"
            className="font-mono text-xs font-bold text-emerald-200 tabular-nums shrink-0"
          >
            #{order.id.slice(0, 8)}
          </span>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-red-950/40 border border-red-800 text-xs sm:text-sm font-semibold text-red-200"
        >
          {actionError}
        </div>
      )}

      {/* =====================================================================
       * PHARMACY STAGE 3: CUSTOMER QUOTE APPROVAL CARD
       * =================================================================== */}
      {order.status === 'awaiting_customer_approval' && (
        <section className="rounded-3xl bg-gradient-to-l from-emerald-900 to-[#1E293B] text-white p-6 sm:p-8 space-y-5 shadow-xl border border-emerald-500/40">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-300">
              <Pill className="w-4 h-4" />
              <span>تسعير الروشتة جاهز من {order.storeName}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white">
              راجعت الصيدلية طلبك وحددت سعر الأدوية — هل توافق على البدء بتحضير الروشتة؟
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white/10 rounded-2xl p-4 border border-white/15">
            <div>
              <p className="text-xs text-slate-300">سعر الأدوية بالروشتة</p>
              <p className="text-xl font-extrabold text-white font-mono tabular-nums mt-0.5">
                {order.subtotal} ج.م
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-300">رسوم توصيل إدكاوي</p>
              <p className="text-xl font-extrabold text-white font-mono tabular-nums mt-0.5">
                {order.deliveryFee} ج.م
              </p>
            </div>
            <div>
              <p className="text-xs text-emerald-300 font-bold">
                الإجمالي كاش عند الاستلام
              </p>
              <p className="text-2xl font-extrabold text-amber-300 font-mono tabular-nums mt-0.5">
                {order.totalAmount} ج.م
              </p>
            </div>
          </div>

          {order.pharmacistNote && (
            <div className="rounded-2xl bg-white/10 px-4 py-3 text-xs sm:text-sm text-emerald-100">
              <strong className="text-white">ملاحظة الصيدلي:</strong>{' '}
              {order.pharmacistNote}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {onApprovePharmacyQuote && (
              <button
                type="button"
                disabled={approvingQuote || cancelling}
                onClick={handleApproveQuoteClick}
                className="flex-1 min-w-[220px] min-h-[48px] px-6 py-3 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-60 text-white text-sm sm:text-base font-bold inline-flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>
                  {approvingQuote
                    ? 'جارٍ إرسال الموافقة للصيدلية...'
                    : 'أوافق على السعر — ابدأ تحضير الروشتة الآن'}
                </span>
              </button>
            )}

            <button
              type="button"
              disabled={cancelling || approvingQuote}
              onClick={() => setConfirmCancelOpen(true)}
              className="min-h-[48px] px-5 py-3 rounded-2xl bg-white/10 hover:bg-red-600/80 text-white text-xs sm:text-sm font-bold cursor-pointer transition-colors"
            >
              {cancelling ? 'جارٍ الإلغاء...' : 'رفض السعر وإلغاء الطلب'}
            </button>
          </div>
        </section>
      )}

      {/* =====================================================================
       * CUSTOM ERRAND QUOTE APPROVAL CARD
       * =================================================================== */}
      {order.status === 'awaiting_customer_errand_approval' && (
        <section className="rounded-2xl bg-[#1E293B] text-white p-6 space-y-5 shadow-xl border border-[#FF6B00]/40">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-[#FF6B00]">
              <Bike className="w-4 h-4" />
              <span>
                عرض تكلفة المشوار جاهز من {order.courierName || 'كابتن إدكاوي'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#F8FAFC]">
              حدد الكابتن تكلفة تنفيذ المشوار — هل توافق ليبدأ التنفيذ الآن؟
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#0F172A] rounded-2xl p-4 border border-[#334155]">
            <div>
              <p className="text-xs text-[#94A3B8]">الكابتن المكلّف</p>
              <p className="text-lg font-extrabold text-[#F8FAFC] mt-0.5">
                {order.courierName || 'كابتن توصيل إدكاوي'}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#FF6B00] font-bold">
                تكلفة توصيل وتنفيذ المشوار
              </p>
              <p className="text-2xl font-extrabold text-[#F8FAFC] font-mono tabular-nums mt-0.5">
                {order.totalAmount} ج.م
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {onApproveErrandQuote && (
              <button
                type="button"
                disabled={approvingQuote || cancelling}
                onClick={handleApproveErrandClick}
                className="flex-1 min-w-[220px] min-h-[48px] px-6 py-3 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-60 text-white text-sm sm:text-base font-bold inline-flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>
                  {approvingQuote
                    ? 'جارٍ تأكيد موافقتك...'
                    : `أوافق على التكلفة (${order.totalAmount} ج.م) — ابدأ المشوار الآن`}
                </span>
              </button>
            )}

            <button
              type="button"
              disabled={cancelling || approvingQuote}
              onClick={() => setConfirmCancelOpen(true)}
              className="min-h-[48px] px-5 py-3 rounded-2xl bg-[#0F172A] border border-[#334155] hover:bg-red-950/60 hover:border-red-500/40 text-red-300 text-xs sm:text-sm font-bold cursor-pointer transition-colors"
            >
              {cancelling ? 'جارٍ الإلغاء...' : 'رفض العرض وإلغاء المشوار'}
            </button>
          </div>
        </section>
      )}

      {/* Main Live Tracking Card */}
      <section className="edkawi-soft-card p-6 sm:p-9 space-y-7">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-slate-100 border-[#334155]">
          <div>
            <p className="text-xs font-bold text-[#FF6B00] mb-1">
              {isCustomErrand
                ? 'متابعة مشوارك الخاص المباشر · إدكاوي'
                : isPharmacyOrder
                ? 'متابعة طلب الصيدلية المباشر · إدكاوي'
                : 'شاشة تتبع الطلب المباشر · إدكاوي'}
            </p>
            <h2 className="text-xl sm:text-2xl font-bold text-[#F8FAFC]">
              {order.storeName}
            </h2>
            <p className="text-xs sm:text-sm text-[#94A3B8] mt-1">
              رقم الطلب:{' '}
              <span
                dir="ltr"
                className="inline-block font-mono font-semibold text-[#F8FAFC] tabular-nums"
              >
                #{order.id.slice(0, 8)}
              </span>{' '}
              · المستلم: {order.customerName}
              {order.isScheduled && order.scheduledForIso
                ? ` · مجدول: ${new Date(order.scheduledForIso).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}`
                : ''}
            </p>
          </div>

          <StatusIndicator status={order.status} />
        </div>

        {/* 4-Stage Progress Stepper */}
        {order.status === 'cancelled' ? (
          <div className="p-5 rounded-2xl bg-[#0F172A] border border-[#334155] text-sm font-semibold text-[#F8FAFC] flex items-center gap-2.5">
            <XCircle
              className="w-5 h-5 text-slate-500 shrink-0"
              aria-hidden="true"
            />
            <span>تم إلغاء هذا الطلب.</span>
          </div>
        ) : (
          <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {steps.map((step, index) => {
              const isCompleted =
                order.status === 'delivered' ? true : index < currentStep;
              const isActive =
                order.status !== 'delivered' && index === currentStep;
              return (
                <li
                  key={step.key}
                  className={`p-5 rounded-[18px] border ${
                    isActive
                      ? 'border-[#FF6B00] bg-[#FF6B00]/8 shadow-2xs'
                      : isCompleted
                        ? 'border-emerald-800 bg-emerald-950/30'
                        : 'border-slate-200/80 border-[#334155] edkawi-surface-muted'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-bold text-slate-500 tabular-nums">
                      0{index + 1}
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        isActive
                          ? 'text-[#FF6B00]'
                          : isCompleted
                            ? 'text-emerald-700 text-emerald-400'
                            : 'text-slate-400'
                      }`}
                    >
                      {isActive
                        ? 'الحالة الحالية'
                        : isCompleted
                          ? 'مكتمل'
                          : 'قادم'}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-[#F8FAFC]">
                    {step.key === 'preparing' && order.status === 'ready'
                      ? 'جاهز لتسليم المندوب'
                      : step.title}
                  </h3>
                  <p className="text-xs text-[#94A3B8] mt-1.5 leading-relaxed">
                    {step.key === 'preparing' && order.status === 'ready'
                      ? 'تم التجهيز والتغليف وبانتظار استلام أقرب مندوب من إدكاوي'
                      : step.subtitle}
                  </p>
                </li>
              );
            })}
          </ol>
        )}

        {/* Loyalty Points Earned Badge on Delivered Orders */}
        {order.status === 'delivered' &&
          typeof order.pointsEarned === 'number' &&
          order.pointsEarned > 0 && (
            <div className="rounded-2xl bg-amber-950/30 border border-amber-800 px-5 py-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold text-amber-200">
                <Award className="w-5 h-5 text-[#FF6B00] shrink-0" />
                <span>
                  أضيفت +{order.pointsEarned} نقطة ولاء إلى حسابك في إدكاوي من هذا الطلب!
                </span>
              </div>
            </div>
          )}

        {/* Live Store Prep Time & Assigned Courier Info Card */}
        {(order.prepTimeMinutes || order.courierName || order.status === 'ready') && (
          <div className="p-5 sm:p-6 rounded-[18px] edkawi-surface-muted border border-slate-200/80 border-[#334155] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-[#FF6B00]">
                متابعة التجهيز ومندوب التوصيل المباشر
              </p>
              {order.courierName ? (
                <>
                  <h3 className="text-base sm:text-lg font-bold text-[#F8FAFC]">
                    كابتن التوصيل المكلّف: {order.courierName}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#94A3B8]">
                    رقم هاتف المندوب:{' '}
                    <span
                      dir="ltr"
                      className="font-mono font-bold text-[#F8FAFC] tabular-nums"
                    >
                      {order.courierPhone || '—'}
                    </span>
                    {order.courierLocation
                      ? ` · الموقع الحالي: ${order.courierLocation}`
                      : ''}
                  </p>
                </>
              ) : order.status === 'ready' ? (
                <h3 className="text-sm sm:text-base font-bold text-emerald-700 text-emerald-400">
                  الطلب جاهز الآن — تم إشعار مناديب إدكاوي لاستلام الشنطة وتوصيلها إليك
                </h3>
              ) : (
                <h3 className="text-sm sm:text-base font-bold text-[#F8FAFC]">
                  وقت التحضير المقدر:{' '}
                  <span className="font-mono text-[#FF6B00] tabular-nums">
                    {order.prepTimeMinutes}
                  </span>{' '}
                  دقيقة
                </h3>
              )}
            </div>

            {order.courierPhone && (
              <a
                href={`tel:${order.courierPhone}`}
                className="py-2.5 px-5 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
              >
                <Phone className="w-4 h-4 text-[#FF6B00]" aria-hidden="true" />
                <span>اتصال بالمندوب</span>
              </a>
            )}
          </div>
        )}

        {/* Real Google Map Live Scooter Tracking when on_the_way / delivering */}
        {(order.status === 'on_the_way' || order.status === 'delivering') && (
          <LiveOrderScooterMap order={order} store={store} />
        )}

        {/* Post-Delivery 5-Star Store & Courier Review Card */}
        {order.status === 'delivered' && (
          <div className="p-5 sm:p-6 rounded-[18px] edkawi-surface-muted border border-slate-200/80 border-[#334155] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {existingReview ? (
              <div className="space-y-1">
                <p className="text-sm font-bold text-[#F8FAFC] flex items-center gap-2">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                  <span>
                    تقييمك: {existingReview.storeRating} / 5 نجوم
                    {existingReview.courierRating
                      ? ` · المندوب: ${existingReview.courierRating} / 5`
                      : ''}
                  </span>
                </p>
                {existingReview.comment && (
                  <p className="text-xs text-[#94A3B8]">
                    &quot;{existingReview.comment}&quot;
                  </p>
                )}
              </div>
            ) : order.isReviewed ? (
              <p className="text-sm font-bold text-emerald-700 text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>تم إرسال تقييمك لهذا الطلب بنجاح — شكراً لك!</span>
              </p>
            ) : (
              <>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-[#F8FAFC]">
                    كيف كانت تجربتك مع {order.storeName}؟
                  </p>
                  <p className="text-xs text-[#94A3B8]">
                    قيّم المتجر والمندوب بـ 5 نجوم بعد إتمام التوصيل.
                  </p>
                </div>
                {onOpenReviewModal && (
                  <button
                    type="button"
                    onClick={() => onOpenReviewModal(order)}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer shrink-0"
                  >
                    <Star className="w-4 h-4 fill-white" />
                    <span>تقييم المتجر والمندوب</span>
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Post-Delivery Courier Tipping Card (5 / 10 / 15 EGP) */}
        {order.status === 'delivered' && order.courierId && (
          <div className="p-5 sm:p-6 rounded-[18px] edkawi-surface-muted border border-slate-200/80 border-[#334155] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {order.isTipped || tipSuccessMsg ? (
              <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold text-emerald-700 text-emerald-400">
                <HeartHandshake className="w-5 h-5 text-[#FF6B00] shrink-0" />
                <span>
                  {tipSuccessMsg ||
                    `تمت إضافة إكرامية ${order.tipAmountEgp ?? 10} ج.م لمحفظة كابتن التوصيل ${order.courierName || ''} — شكراً لتقديرك!`}
                </span>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-[#F8FAFC] flex items-center gap-2">
                    <HeartHandshake className="w-4 h-4 text-[#FF6B00]" />
                    <span>
                      إكرامية للكابتن {order.courierName || 'مندوب إدكاوي'} تقديراً لسرعته
                    </span>
                  </p>
                  <p className="text-xs text-[#94A3B8]">
                    تذهب الإكرامية بنسبة ١٠٠٪ مباشرة إلى محفظة الكابتن في إدكاوي.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {([5, 10, 15] as const).map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      disabled={tippingAmount !== null}
                      onClick={async () => {
                        setActionError(null);
                        setTippingAmount(amt);
                        try {
                          await tipCourierForDeliveredOrderInFirestore(
                            order,
                            amt
                          );
                          setTipSuccessMsg(
                            `تم إرسال إكرامية ${amt} ج.م للكابتن ${order.courierName || ''} بنجاح!`
                          );
                        } catch (err) {
                          setActionError(
                            formatAppErrorMessage(
                              err,
                              'تعذر تسجيل إكرامية الكابتن حالياً.'
                            )
                          );
                        } finally {
                          setTippingAmount(null);
                        }
                      }}
                      className="min-h-[42px] px-4 py-2 rounded-xl border border-[#334155] bg-[#1E293B] hover:border-[#FF6B00] hover:bg-[#FF6B00] hover:text-white text-xs sm:text-sm font-bold font-mono tabular-nums text-[#F8FAFC] cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                    >
                      {tippingAmount === amt ? '...' : `${amt} ج.م`}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Itemized Products / Prescription Details & Delivery Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-5 border-t border-slate-100 border-[#334155]">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-[#F8FAFC]">
              {isCustomErrand
                ? 'تفاصيل المشوار ونقطة الاستلام'
                : isPharmacyOrder
                ? 'تفاصيل الروشتة والأدوية المطلوبة'
                : 'الأصناف المطلوبة'}
            </h3>

            {isCustomErrand && (
              <div className="space-y-2.5">
                {order.errandPickupAddress && (
                  <div className="p-3.5 rounded-xl edkawi-surface-muted border border-[#334155] text-xs sm:text-sm text-[#F8FAFC]">
                    <span className="font-bold text-[#FF6B00]">
                      مكان الاستلام / البداية:{' '}
                    </span>
                    {order.errandPickupAddress}
                  </div>
                )}
                {order.errandDescription && (
                  <div className="p-3.5 rounded-xl edkawi-surface-muted border border-[#334155] text-xs sm:text-sm text-[#F8FAFC]">
                    <span className="font-bold text-[#FF6B00]">
                      المطلوب في المشوار:{' '}
                    </span>
                    {order.errandDescription}
                  </div>
                )}
              </div>
            )}

            {isPharmacyOrder && (
              <div className="space-y-3">
                {order.prescriptionImageUrl && (
                  <div className="rounded-2xl overflow-hidden border border-[#334155] max-h-56 bg-[#0F172A]">
                    <img
                      src={order.prescriptionImageUrl}
                      alt="صورة الروشتة المرفقة"
                      className="w-full h-48 object-contain"
                    />
                  </div>
                )}
                {order.prescriptionMedicineRequest && (
                  <div className="p-3.5 rounded-xl edkawi-surface-muted border border-[#334155] text-xs sm:text-sm text-[#F8FAFC] flex items-start gap-2">
                    <FileText className="w-4 h-4 text-[#FF6B00] shrink-0 mt-0.5" />
                    <span>{order.prescriptionMedicineRequest}</span>
                  </div>
                )}
                {order.pharmacistNote && (
                  <p className="text-xs font-semibold text-emerald-700 text-emerald-400">
                    رد الصيدلية: {order.pharmacistNote}
                  </p>
                )}
              </div>
            )}

            {!isPharmacyOrder && !isCustomErrand && order.items && order.items.length > 0 ? (
              <ul className="divide-y divide-[#334155] text-sm">
                {order.items.map((item, idx) => (
                  <li
                    key={`${item.productId}_${item.variantId || idx}`}
                    className="py-2.5 flex items-center justify-between gap-2"
                  >
                    <span className="text-[#F8FAFC]">
                      {item.name}
                      {item.variantLabel ? (
                        <span className="text-[#FF6B00] text-xs font-semibold mr-1">
                          ({item.variantLabel})
                        </span>
                      ) : null}{' '}
                      <span className="font-mono text-xs text-slate-500 tabular-nums">
                        × {item.quantity}
                      </span>
                    </span>
                    <span className="font-semibold text-[#F8FAFC]">
                      <span className="font-mono tabular-nums">
                        {item.price * item.quantity}
                      </span>{' '}
                      ج.م
                    </span>
                  </li>
                ))}
              </ul>
            ) : !isPharmacyOrder && !isCustomErrand ? (
              <p className="text-sm text-[#94A3B8]">
                {order.itemsSummary}
              </p>
            ) : null}

            {typeof order.smallOrderFee === 'number' &&
              order.smallOrderFee > 0 && (
                <div className="pt-2 flex items-center justify-between text-xs font-semibold text-amber-400">
                  <span>رسوم الطلبات الصغيرة (أقل من ٥٠ ج.م)</span>
                  <span className="font-mono tabular-nums">
                    + {order.smallOrderFee} ج.م
                  </span>
                </div>
              )}

            {typeof order.discountAmount === 'number' &&
              order.discountAmount > 0 && (
                <div className="pt-2 flex items-center justify-between text-xs font-semibold text-emerald-700 text-emerald-400">
                  <span>خصم الكوبون ({order.couponCode || 'خصم'})</span>
                  <span className="font-mono tabular-nums">
                    - {order.discountAmount} ج.م
                  </span>
                </div>
              )}

            <div className="pt-3 border-t border-slate-100 border-[#334155] flex items-center justify-between text-base font-bold text-[#F8FAFC]">
              <span>
                {order.status === 'awaiting_pharmacy_quote'
                  ? 'رسوم التوصيل (بانتظار تسعير الدواء)'
                  : order.status === 'awaiting_courier_quote'
                  ? 'بانتظار عرض تكلفة المشوار من الكابتن'
                  : 'الإجمالي شامل التوصيل'}
              </span>
              <span className="text-[#FF6B00]">
                <span className="font-mono tabular-nums">
                  {order.totalAmount}
                </span>{' '}
                ج.م
              </span>
            </div>
          </div>

          <div className="space-y-2.5 text-sm text-[#94A3B8]">
            <h3 className="text-sm font-bold text-[#F8FAFC]">
              تفاصيل الموقع والدفع
            </h3>
            <p>
              <strong className="text-[#F8FAFC]">
                اسم العميل:
              </strong>{' '}
              {order.customerName}
            </p>
            <p>
              <strong className="text-[#F8FAFC]">
                رقم الهاتف:
              </strong>{' '}
              <span dir="ltr" className="font-mono tabular-nums">
                {order.customerPhone}
              </span>
            </p>
            {order.zoneName && (
              <p>
                <strong className="text-[#F8FAFC]">
                  المنطقة الجغرافية:
                </strong>{' '}
                {order.zoneName} ({order.deliveryFee} ج.م)
              </p>
            )}
            <p>
              <strong className="text-[#F8FAFC]">
                موقع التوصيل:
              </strong>{' '}
              {order.deliveryNeighborhood} — {order.deliveryAddress}
            </p>
            <p>
              <strong className="text-[#F8FAFC]">
                طريقة الدفع:
              </strong>{' '}
              {getPaymentMethodLabel(order.paymentMethod)}
            </p>
            {order.notes && (
              <p>
                <strong className="text-[#F8FAFC]">
                  ملاحظات:
                </strong>{' '}
                {order.notes}
              </p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-5 border-t border-slate-100 border-[#334155] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {order.status === 'pending' && onConfirmPendingOrder && (
              <button
                type="button"
                disabled={confirming || cancelling}
                onClick={handleConfirmPendingClick}
                className="min-h-[44px] py-2.5 px-5 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap shadow-sm"
              >
                {confirming ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                )}
                <span>{confirming ? 'جارٍ تأكيد الطلب...' : 'تأكيد الطلب الآن'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onNavigateToOrders}
              className="py-2.5 px-5 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white text-xs sm:text-sm font-bold cursor-pointer whitespace-nowrap"
            >
              عرض كل طلباتي
            </button>
            <button
              type="button"
              onClick={onNavigateToStores}
              className="py-2.5 px-5 rounded-xl border border-[#334155] edkawi-surface text-[#F8FAFC] text-xs sm:text-sm font-bold cursor-pointer whitespace-nowrap"
            >
              طلب جديد من المتاجر
            </button>
          </div>

          {canCustomerCancel && (
            <button
              type="button"
              disabled={cancelling || confirming}
              onClick={() => setConfirmCancelOpen(true)}
              className="py-2.5 px-4 rounded-2xl border border-red-500/40 bg-red-950/30 text-red-300 hover:bg-red-950/60 text-xs font-bold disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              {cancelling ? 'جارٍ إلغاء الطلب...' : 'إلغاء الطلب'}
            </button>
          )}
        </div>
      </section>

      <ConfirmActionModal
        isOpen={confirmCancelOpen}
        title="تأكيد إلغاء الطلب"
        description={
          order.paymentMethod === 'wallet'
            ? `سيتم إلغاء الطلب رقم #${order.id.slice(0, 8)} وإرجاع مبلغ ${order.totalAmount} ج.م تلقائياً إلى محفظتك في إدكاوي.`
            : `هل أنت متأكد من إلغاء الطلب رقم #${order.id.slice(0, 8)}؟`
        }
        confirmLabel="نعم، إلغاء الطلب"
        cancelLabel="تراجع"
        tone="danger"
        isProcessing={cancelling}
        onConfirm={async () => {
          await handleCancelClick();
          setConfirmCancelOpen(false);
        }}
        onCancel={() => setConfirmCancelOpen(false)}
      />
    </div>
  );
}

/* ============================================================================
 * 4. ORDERS HISTORY VIEW (سجل الطلبات + زر موافقة سريع لروشتة الصيدلية)
 * ========================================================================== */

interface OrdersHistoryViewProps {
  orders: OrderRecord[];
  isLoadingOrders: boolean;
  ordersError: string | null;
  reviewsByOrderId?: Record<string, ReviewRecord>;
  onOpenReviewModal?: (order: OrderRecord) => void;
  onApprovePharmacyQuote?: (order: OrderRecord) => Promise<void>;
  onApproveErrandQuote?: (order: OrderRecord) => Promise<void>;
  onConfirmPendingOrder?: (
    orderId: string,
    paymentMethod?: PaymentMethod
  ) => Promise<OrderStatus | void>;
  onCancelOrder: (orderId: string) => Promise<void>;
  onTrackOrder: (orderId: string) => void;
  onNavigateToStores: () => void;
}

function StatusIndicator({ status }: { status: OrderStatus }) {
  const label = getOrderStatusLabel(status);
  switch (status) {
    case 'awaiting_pharmacy_quote':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 text-emerald-400">
          <Pill className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{label}</span>
        </span>
      );
    case 'awaiting_customer_approval':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#FF6B00]">
          <Pill className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{label}</span>
        </span>
      );
    case 'awaiting_courier_quote':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400">
          <Bike className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{label}</span>
        </span>
      );
    case 'awaiting_customer_errand_approval':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#FF6B00]">
          <Bike className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{label}</span>
        </span>
      );
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400">
          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{label}</span>
        </span>
      );
    case 'pending_payment':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400">
          <CreditCard className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{label}</span>
        </span>
      );
    case 'confirmed':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{label}</span>
        </span>
      );
    case 'ready':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 text-emerald-400">
          <PackageCheck className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{label}</span>
        </span>
      );
    case 'preparing':
    case 'on_the_way':
    case 'delivering':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FF6B00]">
          <Truck className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{label}</span>
        </span>
      );
    case 'delivered':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{label}</span>
        </span>
      );
    case 'cancelled':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500">
          <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{label}</span>
        </span>
      );
  }
}

export function OrdersHistoryView({
  orders,
  isLoadingOrders,
  ordersError,
  reviewsByOrderId = {},
  onOpenReviewModal,
  onApprovePharmacyQuote,
  onApproveErrandQuote,
  onConfirmPendingOrder,
  onCancelOrder,
  onTrackOrder,
  onNavigateToStores,
}: OrdersHistoryViewProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmCancelOrder, setConfirmCancelOrder] =
    useState<OrderRecord | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [historyActionError, setHistoryActionError] = useState<string | null>(null);

  async function handleConfirmOrderClick(order: OrderRecord) {
    if (!onConfirmPendingOrder || confirmingId === order.id) return;
    setHistoryActionError(null);
    setConfirmingId(order.id);
    try {
      await onConfirmPendingOrder(order.id, order.paymentMethod);
    } catch (err) {
      setHistoryActionError(
        formatAppErrorMessage(err, 'تعذر تأكيد الطلب حالياً. يرجى المحاولة مرة أخرى.')
      );
    } finally {
      setConfirmingId(null);
    }
  }

  async function handleCancel(id: string) {
    setHistoryActionError(null);
    setCancellingId(id);
    try {
      await onCancelOrder(id);
    } finally {
      setCancellingId(null);
    }
  }

  async function handleQuickApprove(order: OrderRecord) {
    if (!onApprovePharmacyQuote) return;
    setApprovingId(order.id);
    try {
      await onApprovePharmacyQuote(order);
    } finally {
      setApprovingId(null);
    }
  }

  async function handleQuickApproveErrand(order: OrderRecord) {
    if (!onApproveErrandQuote) return;
    setApprovingId(order.id);
    try {
      await onApproveErrandQuote(order);
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 sm:py-12 pb-28 space-y-7 edkawi-page-enter">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#F8FAFC]">
            سجل طلباتي في إدكاوي
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1">
            متابعة حية لجميع طلبات المطاعم والمتاجر وروشتات الصيدليات في إدكو
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {orders.some((o) => o.status === 'delivered') && (
            <a
              href={GOOGLE_PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-4 rounded-2xl bg-[#1E293B] border border-[#334155] hover:border-[#FF6B00] text-xs sm:text-sm font-bold text-[#F8FAFC] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>قيّمنا على Google Play</span>
              <ExternalLink className="w-3.5 h-3.5 text-[#FF6B00]" />
            </a>
          )}
          <button
            type="button"
            onClick={onNavigateToStores}
            className="py-2.5 px-5 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] text-xs sm:text-sm font-bold text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            + طلب جديد من المتاجر
          </button>
        </div>
      </div>

      {ordersError && (
        <div
          role="alert"
          className="p-5 rounded-2xl bg-red-950/50 border border-red-500/40 text-red-200 text-sm"
        >
          تعذر تحميل سجل الطلبات: {ordersError}
        </div>
      )}

      {historyActionError && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-red-950/50 border border-red-500/40 text-red-200 text-sm"
        >
          {historyActionError}
        </div>
      )}

      {isLoadingOrders ? (
        <OrdersListSkeleton count={3} />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={PackageCheck}
          title="لا توجد طلبات مسجلة بعد"
          description="اختر أصنافك من أي متجر أو أرسل روشتة صيدلية ليظهر طلبك هنا فوراً."
          actionLabel="تصفح متاجر إدكاوي"
          onAction={onNavigateToStores}
        />
      ) : (
        <div className="space-y-5">
          {orders.map((order) => {
            const formattedDate = new Date(order.createdAtIso).toLocaleString(
              'ar-EG',
              {
                dateStyle: 'medium',
                timeStyle: 'short',
              }
            );
            const canCancel =
              order.status === 'pending' ||
              order.status === 'confirmed' ||
              order.status === 'pending_payment' ||
              order.status === 'awaiting_pharmacy_quote' ||
              order.status === 'awaiting_customer_approval' ||
              order.status === 'awaiting_courier_quote' ||
              order.status === 'awaiting_customer_errand_approval';

            return (
              <article
                key={order.id}
                className="edkawi-soft-card-interactive p-6 sm:p-7 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#94A3B8]">
                    <span
                      dir="ltr"
                      className="inline-block font-mono font-semibold text-[#F8FAFC] tabular-nums"
                    >
                      #{order.id.slice(0, 8)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{formattedDate}</span>
                    <span aria-hidden="true">·</span>
                    <span>{order.deliveryNeighborhood}</span>
                    {order.zoneName && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{order.zoneName}</span>
                      </>
                    )}
                  </div>

                  <StatusIndicator status={order.status} />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-[#F8FAFC]">
                      {order.storeName}
                    </h2>
                    <p className="text-sm text-[#94A3B8] mt-1">
                      {order.itemsSummary}
                    </p>
                  </div>

                  <p className="text-lg font-bold text-[#FF6B00] shrink-0">
                    <span className="font-mono tabular-nums">
                      {order.totalAmount}
                    </span>{' '}
                    ج.م
                  </p>
                </div>

                {/* Inline Pharmacy Quote Approval Banner inside Orders History */}
                {order.status === 'awaiting_customer_approval' && (
                  <div className="rounded-2xl bg-emerald-950/40 border border-emerald-800 p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="text-xs sm:text-sm font-bold text-emerald-100">
                        سعر الأدوية: {order.subtotal} ج.م + توصيل {order.deliveryFee} ج.م ={' '}
                        <span className="text-[#FF6B00]">
                          {order.totalAmount} ج.م
                        </span>
                      </p>
                      {order.pharmacistNote && (
                        <p className="text-xs text-emerald-300">
                          ملاحظة الصيدلية: {order.pharmacistNote}
                        </p>
                      )}
                    </div>

                    {onApprovePharmacyQuote && (
                      <button
                        type="button"
                        disabled={approvingId === order.id}
                        onClick={() => void handleQuickApprove(order)}
                        className="min-h-[40px] px-4 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-60 text-white text-xs font-bold cursor-pointer"
                      >
                        {approvingId === order.id
                          ? 'جارٍ التأكيد...'
                          : 'موافقة على السعر وبدء التحضير'}
                      </button>
                    )}
                  </div>
                )}

                {/* Inline Custom Errand Quote Approval Banner inside Orders History */}
                {order.status === 'awaiting_customer_errand_approval' && (
                  <div className="rounded-2xl bg-[#1E293B] text-white p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="text-xs sm:text-sm font-bold text-white">
                        عرض تكلفة المشوار من {order.courierName || 'كابتن إدكاوي'}:{' '}
                        <span className="text-[#FF6B00] font-mono tabular-nums">
                          {order.totalAmount} ج.م
                        </span>
                      </p>
                      <p className="text-xs text-slate-300">
                        بمجرد موافقتك ينطلق الكابتن لتنفيذ المشوار فوراً
                      </p>
                    </div>

                    {onApproveErrandQuote && (
                      <button
                        type="button"
                        disabled={approvingId === order.id}
                        onClick={() => void handleQuickApproveErrand(order)}
                        className="min-h-[40px] px-4 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-60 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                      >
                        {approvingId === order.id
                          ? 'جارٍ التأكيد...'
                          : 'موافقة وبدء المشوار'}
                      </button>
                    )}
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100 border-[#334155] flex flex-wrap items-center justify-between gap-3 text-xs text-[#94A3B8]">
                  <span>
                    المستلم: {order.customerName} · {order.deliveryAddress} ·{' '}
                    {getPaymentMethodLabel(order.paymentMethod)}
                    {order.courierName ? ` · المندوب: ${order.courierName}` : ''}
                  </span>

                  <div className="flex flex-wrap items-center gap-3">
                    {order.status === 'delivered' &&
                      (reviewsByOrderId[order.id] ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 tabular-nums">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                          {reviewsByOrderId[order.id].storeRating}/5
                        </span>
                      ) : !order.isReviewed && onOpenReviewModal ? (
                        <button
                          type="button"
                          onClick={() => onOpenReviewModal(order)}
                          className="py-1.5 px-3.5 rounded-xl bg-[#FF6B00] text-white text-xs font-bold hover:bg-[#E55F00] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                        >
                          <Star className="w-3.5 h-3.5 fill-white" />
                          <span>تقييم الطلب</span>
                        </button>
                      ) : null)}

                    {order.status === 'pending' && onConfirmPendingOrder && (
                      <button
                        type="button"
                        disabled={confirmingId === order.id}
                        onClick={() => void handleConfirmOrderClick(order)}
                        className="py-1.5 px-3.5 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                      >
                        {confirmingId === order.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                        <span>
                          {confirmingId === order.id
                            ? 'جارٍ التأكيد...'
                            : 'تأكيد الطلب الآن'}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onTrackOrder(order.id)}
                      className="py-1.5 px-3.5 rounded-xl bg-[#FF6B00]/10 text-xs font-bold text-[#FF6B00] hover:bg-[#FF6B00]/20 cursor-pointer whitespace-nowrap"
                    >
                      تفاصيل وتتبع الطلب
                    </button>

                    {canCancel && (
                      <button
                        type="button"
                        disabled={cancellingId === order.id}
                        onClick={() => setConfirmCancelOrder(order)}
                        className="text-xs font-bold text-red-400 hover:underline disabled:opacity-50 cursor-pointer whitespace-nowrap"
                      >
                        {cancellingId === order.id
                          ? 'جارٍ الإلغاء...'
                          : 'إلغاء الطلب'}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ConfirmActionModal
        isOpen={confirmCancelOrder !== null}
        title="تأكيد إلغاء الطلب"
        description={
          confirmCancelOrder?.paymentMethod === 'wallet'
            ? `سيتم إلغاء الطلب رقم #${confirmCancelOrder.id.slice(0, 8)} وإرجاع مبلغ ${confirmCancelOrder.totalAmount} ج.م إلى محفظتك تلقائياً.`
            : `هل أنت متأكد من إلغاء الطلب رقم #${confirmCancelOrder?.id.slice(0, 8) ?? ''}؟`
        }
        confirmLabel="نعم، إلغاء الطلب"
        cancelLabel="تراجع"
        tone="danger"
        isProcessing={
          confirmCancelOrder !== null && cancellingId === confirmCancelOrder.id
        }
        onConfirm={async () => {
          if (!confirmCancelOrder) return;
          const targetId = confirmCancelOrder.id;
          await handleCancel(targetId);
          setConfirmCancelOrder(null);
        }}
        onCancel={() => setConfirmCancelOrder(null)}
      />
    </div>
  );
}
