import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Bot,
  CheckCheck,
  ClipboardList,
  Coins,
  Loader2,
  MapPin,
  Megaphone,
  Phone,
  Send,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  User as UserIcon,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import {
  EDKU_CITY_CENTER,
  resolveEdkuCoordsForNeighborhood,
} from '../data/edkuSeedStores';
import {
  askEdkawyAiAssistant,
  generateSmartMealPlanWithAi,
} from '../services/edkawiFirebaseService';
import {
  ActiveTab,
  AiChatMessage,
  AppNotificationRecord,
  CampaignRecord,
  CompleteProfileInput,
  MealPlanApiResponse,
  MenuItem,
  OrderRecord,
  ProductRecord,
  ReviewSubmitInput,
  StoreRecord,
} from '../types/edkawi';
import { EDKU_NEIGHBORHOODS, formatAppErrorMessage } from '../utils/orderLogic';
import { EdkuLocationPickerMap } from './EdkuGoogleMaps';
import { EmptyState } from './EmptyState';

/* ============================================================================
 * 1. CUSTOMER MOBILE BOTTOM NAVIGATION BAR (44px Hitboxes, <=15% Sticky Cap)
 * ========================================================================== */

interface CustomerBottomNavProps {
  activeTab: ActiveTab;
  cartCount: number;
  activeOrdersCount: number;
  onSelectTab: (tab: ActiveTab) => void;
}

export const CustomerBottomNav: React.FC<CustomerBottomNavProps> = ({
  activeTab,
  cartCount,
  activeOrdersCount,
  onSelectTab,
}) => {
  const navItems: {
    id: ActiveTab;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: number;
  }[] = [
    { id: 'stores', label: 'المتاجر', icon: Store },
    { id: 'cart', label: 'السلة', icon: ShoppingBag, badge: cartCount },
    {
      id: 'orders',
      label: 'طلباتي',
      icon: ClipboardList,
      badge: activeOrdersCount,
    },
    { id: 'account', label: 'حسابي', icon: UserIcon },
  ];

  return (
    <nav
      dir="rtl"
      aria-label="التنقل السفلي للعميل"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-[#0F172A]/95 backdrop-blur-md border-t border-[#334155] grid grid-cols-4 items-center px-2"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectTab(item.id)}
            className={`min-h-[44px] flex flex-col items-center justify-center relative rounded-2xl transition-colors cursor-pointer ${
              isActive
                ? 'text-[#FF6B00] font-bold'
                : 'text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            <div className="relative">
              <Icon className="w-5 h-5" />
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span className="absolute -top-1.5 -left-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF6B00] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </div>
            <span className="text-[11px] mt-1 tracking-tight whitespace-nowrap">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

/* ============================================================================
 * 2. REAL-TIME NOTIFICATIONS DRAWER (/notifications + /adminBroadcasts)
 * ========================================================================== */

interface NotificationsDrawerProps {
  isOpen: boolean;
  notifications: AppNotificationRecord[];
  onClose: () => void;
  onMarkRead: (notificationId: string) => void;
  onMarkAllRead: () => void;
  onSelectOrderNotification: (orderId: string) => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  isOpen,
  notifications,
  onClose,
  onMarkRead,
  onMarkAllRead,
  onSelectOrderNotification,
}) => {
  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div
      dir="rtl"
      className="edkawi-modal-backdrop flex justify-end"
      onClick={onClose}
    >
      <aside
        aria-label="الإشعارات"
        className="w-full max-w-md h-full bg-[#1E293B] border-r border-[#334155] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[#334155] flex items-center justify-between gap-3 bg-[#0F172A]/60">
          <div className="flex items-center gap-2.5">
            <Bell className="w-5 h-5 text-[#FF6B00]" />
            <h2 className="text-base font-bold text-[#F8FAFC]">
              إشعارات إدكاوي
            </h2>
            {unreadCount > 0 && (
              <span className="text-xs text-[#FF6B00] font-bold tabular-nums">
                ({unreadCount} جديد)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="min-h-[38px] px-3 py-1.5 rounded-2xl text-xs font-semibold text-[#94A3B8] hover:text-[#FF6B00] inline-flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-4 h-4" />
                <span>تحديد الكل كمقروء</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق الإشعارات"
              className="min-h-[40px] min-w-[40px] rounded-2xl border border-[#334155] bg-[#0F172A] flex items-center justify-center text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[#334155]">
          {notifications.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Bell}
                title="لا توجد إشعارات حتى الآن"
                description="ستصلك هنا تحديثات حالة الطلبات وتنبيهات إدارة إدكاوي لحظة بلحظة."
              />
            </div>
          ) : (
            notifications.map((notif) => {
              const formattedTime = (() => {
                const d = new Date(notif.createdAtIso);
                if (Number.isNaN(d.getTime())) return '';
                return d.toLocaleTimeString('ar-EG', {
                  hour: '2-digit',
                  minute: '2-digit',
                });
              })();

              const isAdminBroadcast =
                notif.id.startsWith('bcast_') ||
                Boolean(notif.audience) ||
                notif.type === 'system' ||
                notif.type === 'promo';

              return (
                <button
                  key={notif.id}
                  type="button"
                  onClick={() => {
                    if (!notif.isRead) {
                      onMarkRead(notif.id);
                    }
                    if (notif.orderId) {
                      onSelectOrderNotification(notif.orderId);
                      onClose();
                    }
                  }}
                  className={`w-full text-right px-5 py-4 transition-colors flex flex-col gap-1.5 cursor-pointer ${
                    notif.isRead
                      ? 'bg-[#1E293B] hover:bg-[#0F172A]/70'
                      : 'bg-[#FF6B00]/10 hover:bg-[#FF6B00]/15'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {isAdminBroadcast && (
                        <Megaphone className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
                      )}
                      <span className="text-sm font-bold text-[#F8FAFC] truncate">
                        {notif.title}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#94A3B8] tabular-nums shrink-0">
                      {formattedTime}
                    </span>
                  </div>
                  {isAdminBroadcast && (
                    <span className="text-[11px] font-semibold text-[#FF6B00]">
                      {notif.type === 'promo'
                        ? 'عرض ومكافآت إدكاوي'
                        : 'تنبيه من إدارة إدكاوي'}
                    </span>
                  )}
                  <p className="text-xs text-[#94A3B8] leading-relaxed">
                    {notif.body}
                  </p>
                  {notif.orderId && (
                    <span className="text-[11px] font-semibold text-[#FF6B00] pt-0.5">
                      عرض تفاصيل الطلب ←
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
};

/* ============================================================================
 * 3. GOOGLE USER ONBOARDING MODAL ("إكمال الحساب" + Map Location Picker)
 * ========================================================================== */

interface CompleteProfileModalProps {
  isOpen: boolean;
  initialName: string;
  userEmail: string;
  onSubmit: (input: CompleteProfileInput) => Promise<void>;
  onSkipForNow?: () => void;
}

export const CompleteProfileModal: React.FC<CompleteProfileModalProps> = ({
  isOpen,
  initialName,
  userEmail,
  onSubmit,
  onSkipForNow,
}) => {
  const [name, setName] = useState(initialName || '');
  const [phone, setPhone] = useState('');
  const [neighborhood, setNeighborhood] = useState<string>(
    EDKU_NEIGHBORHOODS[0]
  );
  const [lat, setLat] = useState<number>(EDKU_CITY_CENTER.lat);
  const [lng, setLng] = useState<number>(EDKU_CITY_CENTER.lng);
  const [address, setAddress] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialName && !name) {
      setName(initialName);
    }
  }, [initialName, name]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        phone: phone.trim(),
        defaultNeighborhood: neighborhood,
        defaultAddress:
          address.trim() || `موقع مثبت على الخريطة — ${neighborhood}`,
        defaultLat: lat,
        defaultLng: lng,
      });
    } catch (err) {
      setErrorMsg(formatAppErrorMessage(err, 'يرجى مراجعة البيانات المدخلة.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="edkawi-modal-backdrop flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl bg-[#1E293B] border border-[#334155] shadow-2xl p-6 space-y-5 my-auto">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-[#F8FAFC]">
            إكمال بيانات حسابك في إدكاوي
          </h2>
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            أهلاً بك ({userEmail})! حدد موقعك الافتراضي على خريطة مدينة إدكو وأضف
            رقم الموبايل لتسريع توصيل طلباتك.
          </p>
        </div>

        {errorMsg && (
          <div className="rounded-2xl bg-red-950/60 border border-red-500/40 px-4 py-2.5 text-xs font-medium text-red-200">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                الاسم بالكامل
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="الاسم الثلاثي"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-2xl border border-[#334155] bg-[#0F172A] text-[#F8FAFC] placeholder:text-[#94A3B8] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                رقم الموبايل المصري
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-[#94A3B8] absolute right-3.5 top-3.5" />
                <input
                  type="tel"
                  required
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01012345678"
                  className="w-full min-h-[44px] pr-10 pl-3.5 py-2 rounded-2xl border border-[#334155] bg-[#0F172A] text-[#F8FAFC] placeholder:text-[#94A3B8] text-sm text-right tabular-nums"
                />
              </div>
            </div>
          </div>

          <EdkuLocationPickerMap
            label="حدد موقع التوصيل الافتراضي أو ابحث عنه في الخريطة"
            helperText="ابحث عن اسم الشارع أو اضغط (تلقائي GPS) لتثبيت موقعك الحقيقي تلقائياً"
            lat={lat}
            lng={lng}
            neighborhood={neighborhood}
            heightClassName="h-[220px]"
            autoLocateOnMount={true}
            onAddressResolved={(addr) => {
              if (addr) {
                setAddress(addr);
              }
            }}
            onChange={(picked) => {
              setLat(picked.lat);
              setLng(picked.lng);
              setNeighborhood(picked.neighborhood);
              if (picked.resolvedAddress) {
                setAddress(picked.resolvedAddress);
              }
            }}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                المنطقة المختارة في إدكو
              </label>
              <select
                value={neighborhood}
                onChange={(e) => {
                  const nextArea = e.target.value;
                  setNeighborhood(nextArea);
                  const coords = resolveEdkuCoordsForNeighborhood(nextArea);
                  setLat(coords.lat);
                  setLng(coords.lng);
                }}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-2xl border border-[#334155] bg-[#0F172A] text-[#F8FAFC] text-sm"
              >
                {EDKU_NEIGHBORHOODS.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F8FAFC] mb-1">
                علامة مميزة أو رقم العقار
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-[#94A3B8] absolute right-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="بجوار مسجد... الدور الثاني"
                  className="w-full min-h-[44px] pr-10 pl-3.5 py-2 rounded-2xl border border-[#334155] bg-[#0F172A] text-[#F8FAFC] placeholder:text-[#94A3B8] text-sm"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 min-h-[46px] rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-60 text-white text-sm font-bold cursor-pointer"
            >
              {isSubmitting ? 'جارٍ حفظ الحساب...' : 'حفظ ومتابعة التسوق'}
            </button>
            {onSkipForNow && (
              <button
                type="button"
                onClick={onSkipForNow}
                className="min-h-[46px] px-4 rounded-2xl border border-[#334155] bg-[#0F172A] text-xs font-semibold text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
              >
                لاحقاً
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

/* ============================================================================
 * 4. POST-DELIVERY STORE & COURIER 5-STAR REVIEW MODAL (/reviews)
 * ========================================================================== */

interface OrderReviewModalProps {
  order: OrderRecord | null;
  customerDefaultName: string;
  onClose: () => void;
  onSubmitReview: (input: ReviewSubmitInput) => Promise<void>;
}

const StarRatingSelector: React.FC<{
  label: string;
  sublabel?: string;
  value: number;
  onChange: (rating: number) => void;
}> = ({ label, sublabel, value, onChange }) => {
  return (
    <div className="bg-[#0F172A] rounded-2xl p-4 space-y-2.5 border border-[#334155]">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-[#F8FAFC]">
            {label}
          </p>
          {sublabel && (
            <p className="text-xs text-[#94A3B8]">
              {sublabel}
            </p>
          )}
        </div>
        <span className="text-xs font-bold text-[#FF6B00] tabular-nums">
          {value} من 5
        </span>
      </div>
      <div className="flex items-center justify-center gap-2 pt-1">
        {[1, 2, 3, 4, 5].map((star) => {
          const active = star <= value;
          return (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              aria-label={`${star} نجوم`}
              className="min-h-[44px] min-w-[44px] rounded-2xl flex items-center justify-center hover:scale-110 transition-transform cursor-pointer"
            >
              <Star
                className={`w-7 h-7 ${
                  active
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-slate-600 hover:text-amber-300'
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const OrderReviewModal: React.FC<OrderReviewModalProps> = ({
  order,
  customerDefaultName,
  onClose,
  onSubmitReview,
}) => {
  const [storeRating, setStoreRating] = useState(5);
  const [courierRating, setCourierRating] = useState(5);
  const [comment, setComment] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (order) {
      setStoreRating(5);
      setCourierRating(5);
      setComment('');
      setErrorMsg(null);
    }
  }, [order?.id]);

  if (!order) return null;

  const hasCourier = Boolean(order.courierId || order.courierName);
  const isPharmacy = order.orderType === 'pharmacy_prescription';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await onSubmitReview({
        orderId: order.id,
        storeId: order.storeId,
        courierId: order.courierId,
        courierName: order.courierName,
        customerName:
          order.customerName?.trim() ||
          customerDefaultName.trim() ||
          'عميل إدكاوي',
        storeRating,
        courierRating: hasCourier ? courierRating : undefined,
        comment: comment.trim(),
      });
      onClose();
    } catch (err) {
      setErrorMsg(formatAppErrorMessage(err, 'تعذر إرسال التقييم حالياً.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="edkawi-modal-backdrop flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl bg-[#1E293B] border border-[#334155] shadow-2xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-[#F8FAFC]">
              تقييم تجربة الطلب بعد التوصيل
            </h2>
            <p className="text-xs text-[#94A3B8]">
              طلبك من {order.storeName} وصل بنجاح — شاركنا رأيك بالنجوم
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة التقييم"
            className="min-h-[40px] min-w-[40px] rounded-2xl border border-[#334155] bg-[#0F172A] flex items-center justify-center text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="rounded-2xl bg-red-950/60 border border-red-500/40 px-4 py-2.5 text-xs font-medium text-red-200">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <StarRatingSelector
            label={`تقييم ${isPharmacy ? 'الصيدلية' : 'المتجر'}: ${order.storeName}`}
            sublabel={
              isPharmacy
                ? 'دقة تجهيز الأدوية وسرعة التسعير والتغليف'
                : 'جودة الأصناف والتغليف وسرعة التحضير'
            }
            value={storeRating}
            onChange={setStoreRating}
          />

          {hasCourier && (
            <StarRatingSelector
              label={`تقييم المندوب: ${order.courierName || 'كابتن إدكاوي'}`}
              sublabel="الالتزام بالموعد وأسلوب التعامل"
              value={courierRating}
              onChange={setCourierRating}
            />
          )}

          <div>
            <label className="block text-xs font-semibold text-[#F8FAFC] mb-1.5">
              تعليق إضافي (اختياري)
            </label>
            <textarea
              rows={3}
              maxLength={300}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="اكتب ملاحظتك حول جودة الطلب أو سرعة التوصيل..."
              className="w-full px-3.5 py-2.5 rounded-2xl border border-[#334155] bg-[#0F172A] text-[#F8FAFC] placeholder:text-[#94A3B8] text-sm resize-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 min-h-[46px] rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-60 text-white text-sm font-bold cursor-pointer"
            >
              {isSubmitting ? 'جارٍ إرسال التقييم...' : 'إرسال التقييم الآن'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[46px] px-4 rounded-2xl border border-[#334155] bg-[#0F172A] text-xs font-semibold text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
            >
              لاحقاً
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ============================================================================
 * 5. EDKAWY SMART AI ASSISTANT WIDGET (/api/ai/chat + /chat_logs)
 * ========================================================================== */

interface ChatStreamMessage extends AiChatMessage {
  mealPlan?: MealPlanApiResponse;
}

interface EdkawyAiChatWidgetProps {
  userUid?: string;
  customerName?: string;
  points: number;
  currentStreak?: number;
  hasFloatingCart?: boolean;
  openTrigger?: number;
  stores: StoreRecord[];
  products?: ProductRecord[];
  activeCampaigns: CampaignRecord[];
  onSelectStore: (store: StoreRecord) => void;
  onAddMealItemToCart?: (store: StoreRecord, item: MenuItem) => void;
}

const AI_QUICK_PROMPTS = [
  'رشحلي أكلة حلوة من إدكو النهارده',
  'إزاي أطلب روشتة من صيدلية في إدكاوي؟',
  'عندي كام نقطة وإزاي أستبدلها بقسيمة؟',
  'إيه العروض والفعاليات المتاحة دلوقتي؟',
];

export const EdkawyAiChatWidget: React.FC<EdkawyAiChatWidgetProps> = ({
  userUid,
  customerName,
  points,
  currentStreak = 0,
  hasFloatingCart = false,
  openTrigger = 0,
  stores,
  products = [],
  activeCampaigns,
  onSelectStore,
  onAddMealItemToCart,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (openTrigger > 0) {
      setIsOpen(true);
    }
  }, [openTrigger]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showMealPlanner, setShowMealPlanner] = useState(false);
  const [mealBudgetEgp, setMealBudgetEgp] = useState(300);
  const [mealDaysCount, setMealDaysCount] = useState(3);
  const [mealDietaryStyle, setMealDietaryStyle] = useState<
    'صحي' | 'دسم' | 'متوازن'
  >('متوازن');

  const [messages, setMessages] = useState<ChatStreamMessage[]>([
    {
      id: 'welcome_edkawy_ai',
      role: 'assistant',
      text: 'أهلاً بيك في إدكاوي يا بطل! أنا مساعدك الذكي في مدينة إدكو — اسألني عن أحسن المطاعم والصيدليات، أو اضغط «خطط لوجباتي» لأجهز لك جدول وجبات على قد ميزانيتك.',
      createdAtIso: new Date().toISOString(),
    },
  ]);

  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const clientReplyCacheRef = useRef<
    Map<string, { reply: string; suggestedStoreId?: string | null }>
  >(new Map());

  useEffect(() => {
    if (isOpen) {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleGenerateMealPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSending) return;

    const cleanBudget = Math.max(50, Math.min(10000, Math.trunc(Number(mealBudgetEgp) || 300)));
    const cleanDays = Math.max(1, Math.min(7, Math.trunc(Number(mealDaysCount) || 3)));

    const userMsg: ChatStreamMessage = {
      id: `u_plan_${Date.now()}`,
      role: 'user',
      text: `خطط لوجباتي لمدة ${cleanDays} أيام بميزانية ${cleanBudget} ج.م (نظام ${mealDietaryStyle})`,
      createdAtIso: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setShowMealPlanner(false);
    setIsSending(true);

    try {
      const plan = await generateSmartMealPlanWithAi(
        {
          budgetEgp: cleanBudget,
          daysCount: cleanDays,
          dietaryStyle: mealDietaryStyle,
        },
        products,
        stores
      );

      setMessages((prev) => [
        ...prev,
        {
          id: `a_plan_${Date.now()}`,
          role: 'assistant',
          text: `${plan.planTitleAr} — ${plan.summaryNoteAr}`,
          mealPlan: plan,
          createdAtIso: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_plan_${Date.now()}`,
          role: 'assistant',
          text: formatAppErrorMessage(
            err,
            'تعذر إعداد جدول الوجبات حالياً — تأكد من توفر أصناف في مطاعم إدكو ثم أعد المحاولة.'
          ),
          createdAtIso: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const sendPrompt = async (rawPrompt: string) => {
    const clean = rawPrompt.trim();
    if (!clean || isSending) return;

    const userMsg: ChatStreamMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: clean,
      createdAtIso: new Date().toISOString(),
    };
    const priorRealHistory: AiChatMessage[] = messages
      .filter((m) => m.id !== 'welcome_edkawy_ai')
      .slice(-3)
      .map(({ id, role, text, suggestedStoreId, createdAtIso }) => ({
        id,
        role,
        text,
        suggestedStoreId,
        createdAtIso,
      }));

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');

    const sessionKey = `${clean.toLowerCase()}::${points}::${currentStreak}::${stores.length}`;
    const cachedHit = clientReplyCacheRef.current.get(sessionKey);
    if (cachedHit) {
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: cachedHit.reply,
          suggestedStoreId: cachedHit.suggestedStoreId ?? null,
          createdAtIso: new Date().toISOString(),
        },
      ]);
      return;
    }

    setIsSending(true);

    try {
      const res = await askEdkawyAiAssistant({
        userUid,
        message: clean,
        customerName,
        points,
        currentStreak,
        stores,
        activeCampaigns,
        history: priorRealHistory,
      });

      clientReplyCacheRef.current.set(sessionKey, {
        reply: res.reply,
        suggestedStoreId: res.suggestedStoreId ?? null,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: res.reply,
          suggestedStoreId: res.suggestedStoreId ?? null,
          createdAtIso: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          text: formatAppErrorMessage(
            err,
            'تعذر الوصول لمساعد إدكاوي الذكي حالياً، جرب مرة ثانية بعد لحظات.'
          ),
          createdAtIso: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      {/* Floating Launcher Button — docked cleanly above BottomNav & FloatingCartBar */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="مساعد إدكاوي الذكي"
          className={`fixed ${
            hasFloatingCart
              ? 'bottom-[9.25rem] md:bottom-24'
              : 'bottom-20 md:bottom-6'
          } right-4 sm:right-6 z-40 min-h-[44px] px-4 py-2.5 rounded-full bg-[#FF6B00] hover:bg-[#E55F00] text-white shadow-xl border border-[#334155] inline-flex items-center gap-2 cursor-pointer transition-all hover:scale-[1.02]`}
        >
          <Sparkles className="w-4 h-4 text-white shrink-0" />
          <span className="text-xs sm:text-sm font-bold text-white whitespace-nowrap">
            مساعد إدكاوي
          </span>
        </button>
      )}

      {/* Conversational Drawer — docked at bottom-right in RTL with z-index 1000 */}
      {isOpen && (
        <div
          dir="rtl"
          className="edkawi-modal-backdrop flex items-end justify-center sm:justify-start p-0 sm:p-5"
          onClick={() => setIsOpen(false)}
        >
          <section
            aria-label="مساعد إدكاوي الذكي"
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:w-[410px] h-[82dvh] sm:h-[580px] max-h-[90dvh] bg-[#1E293B] rounded-t-3xl sm:rounded-2xl border border-[#334155] shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <header className="px-4 py-3.5 bg-[#0F172A] border-b border-[#334155] text-[#F8FAFC] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-[#FF6B00] text-white flex items-center justify-center shrink-0">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#F8FAFC]">
                    مساعد إدكاوي الذكي
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-[#94A3B8]">
                    <span>دليل المطاعم والصيدليات في إدكو</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1 text-[#FF6B00] font-semibold tabular-nums">
                      <Coins className="w-3 h-3" />
                      {points} نقطة
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowMealPlanner((prev) => !prev)}
                  className="min-h-[38px] px-3 py-1.5 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <UtensilsCrossed className="w-3.5 h-3.5" />
                  <span>خطط لوجباتي</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="إغلاق المحادثة"
                  className="min-h-[38px] min-w-[38px] rounded-2xl border border-[#334155] bg-[#1E293B] hover:border-[#FF6B00] text-[#F8FAFC] flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* Inline Smart Meal Planner Form */}
            {showMealPlanner && (
              <form
                onSubmit={handleGenerateMealPlan}
                className="p-4 bg-[#0F172A] border-b border-[#334155] space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#F8FAFC]">
                    مخطط الوجبات الذكي حسب ميزانيتك في إدكو
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowMealPlanner(false)}
                    className="text-xs font-bold text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
                  >
                    إخفاء
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-[#94A3B8] mb-1">
                      الميزانية (ج.م)
                    </label>
                    <input
                      type="number"
                      min={50}
                      max={10000}
                      dir="ltr"
                      value={mealBudgetEgp}
                      onChange={(e) => setMealBudgetEgp(Number(e.target.value))}
                      className="w-full min-h-[38px] px-2.5 py-1.5 rounded-2xl border border-[#334155] bg-[#1E293B] text-xs font-mono text-[#F8FAFC] text-left"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#94A3B8] mb-1">
                      عدد الأيام
                    </label>
                    <select
                      value={mealDaysCount}
                      onChange={(e) => setMealDaysCount(Number(e.target.value))}
                      className="w-full min-h-[38px] px-2 py-1.5 rounded-2xl border border-[#334155] bg-[#1E293B] text-xs text-[#F8FAFC]"
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                        <option key={d} value={d}>
                          {d} {d === 1 ? 'يوم' : 'أيام'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#94A3B8] mb-1">
                      النظام
                    </label>
                    <select
                      value={mealDietaryStyle}
                      onChange={(e) =>
                        setMealDietaryStyle(
                          e.target.value as 'صحي' | 'دسم' | 'متوازن'
                        )
                      }
                      className="w-full min-h-[38px] px-2 py-1.5 rounded-2xl border border-[#334155] bg-[#1E293B] text-xs text-[#F8FAFC]"
                    >
                      <option value="متوازن">متوازن</option>
                      <option value="صحي">صحي وخفيف</option>
                      <option value="دسم">مشبع ودسم</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSending}
                  className="w-full min-h-[40px] rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-50 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>توليد جدول الوجبات الآن</span>
                </button>
              </form>
            )}

            {/* Quick Suggestion Chips */}
            <div className="px-3 py-2 border-b border-[#334155] flex items-center gap-1.5 overflow-x-auto bg-[#0F172A]/80">
              <button
                type="button"
                disabled={isSending}
                onClick={() => setShowMealPlanner((prev) => !prev)}
                className="px-2.5 py-1.5 rounded-2xl bg-[#FF6B00] text-white text-[11px] font-bold whitespace-nowrap cursor-pointer shrink-0 inline-flex items-center gap-1"
              >
                <UtensilsCrossed className="w-3 h-3" />
                <span>خطط لوجباتي</span>
              </button>
              {AI_QUICK_PROMPTS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  disabled={isSending}
                  onClick={() => void sendPrompt(chip)}
                  className="px-2.5 py-1.5 rounded-2xl bg-[#1E293B] border border-[#334155] hover:border-[#FF6B00] text-[11px] font-semibold text-[#F8FAFC] whitespace-nowrap cursor-pointer shrink-0"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Messages Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#1E293B]">
              {messages.map((msg) => {
                const suggestedStore = msg.suggestedStoreId
                  ? stores.find((s) => s.id === msg.suggestedStoreId)
                  : undefined;

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.role === 'user' ? 'items-start' : 'items-end'
                    }`}
                  >
                    <div
                      className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-[#FF6B00] text-white font-medium rounded-tr-sm'
                          : 'bg-[#0F172A] border border-[#334155] text-[#F8FAFC] rounded-tl-sm'
                      }`}
                    >
                      {msg.text}
                    </div>

                    {/* Smart Meal Plan Daily Dish Cards with 1-Click Add to Cart */}
                    {msg.mealPlan && msg.mealPlan.days.length > 0 && (
                      <div className="mt-2.5 w-full max-w-[94%] rounded-2xl bg-[#0F172A] border border-[#334155] p-3 space-y-2.5">
                        <div className="flex items-center justify-between gap-2 text-xs font-bold text-[#F8FAFC] pb-1.5 border-b border-[#334155]">
                          <span>إجمالي الخطة المقترحة</span>
                          <span className="text-[#FF6B00] font-mono tabular-nums">
                            {msg.mealPlan.totalEstimatedEgp} / {msg.mealPlan.budgetEgp} ج.م
                          </span>
                        </div>
                        {msg.mealPlan.days.map((day) => {
                          const targetStore = stores.find(
                            (s) => s.id === day.storeId
                          );
                          const matchedProd = products.find(
                            (p) => p.id === day.productId
                          );

                          return (
                            <div
                              key={`${day.dayNumber}_${day.productId}`}
                              className="rounded-2xl bg-[#1E293B] border border-[#334155] p-2.5 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <p className="text-[11px] font-bold text-[#FF6B00]">
                                  {day.dayLabelAr} · {day.storeName}
                                </p>
                                <p className="text-xs font-bold text-[#F8FAFC] truncate">
                                  {day.productName}
                                </p>
                                <p className="text-[11px] text-[#94A3B8] font-mono tabular-nums">
                                  {day.priceEgp} ج.م
                                </p>
                              </div>

                              {targetStore && onAddMealItemToCart && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onAddMealItemToCart(targetStore, {
                                      id: day.productId,
                                      name: day.productName,
                                      price: day.priceEgp,
                                      category: matchedProd?.category,
                                      description:
                                        matchedProd?.description ||
                                        day.mealDescriptionAr,
                                      imageUrl: matchedProd?.imageUrl,
                                    });
                                  }}
                                  className="min-h-[36px] px-3 py-1.5 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-[11px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer whitespace-nowrap"
                                >
                                  <ShoppingBag className="w-3 h-3" />
                                  <span>أضف للسلة</span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {suggestedStore && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectStore(suggestedStore);
                          setIsOpen(false);
                        }}
                        className="mt-2 max-w-[86%] px-3.5 py-2 rounded-2xl bg-[#0F172A] border border-[#334155] hover:border-[#FF6B00] text-[#F8FAFC] text-xs font-bold inline-flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <Store className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
                        <span>فتح {suggestedStore.name} الآن ←</span>
                      </button>
                    )}
                  </div>
                );
              })}

              {isSending && (
                <div className="flex justify-end">
                  <div className="rounded-2xl px-4 py-2.5 bg-[#0F172A] border border-[#334155] text-xs text-[#94A3B8]">
                    جارٍ كتابة الرد من مساعد إدكاوي...
                  </div>
                </div>
              )}

              <div ref={scrollEndRef} />
            </div>

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendPrompt(inputText);
              }}
              className="p-3 border-t border-[#334155] flex items-center gap-2 bg-[#0F172A]"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="اسأل عن وجبة، صيدلية، أو عروض إدكو..."
                maxLength={400}
                className="flex-1 min-h-[44px] px-3.5 py-2 rounded-2xl border border-[#334155] bg-[#1E293B] text-[#F8FAFC] placeholder:text-[#94A3B8] text-sm"
              />
              <button
                type="submit"
                disabled={isSending || !inputText.trim()}
                aria-label="إرسال"
                className="min-h-[44px] min-w-[44px] rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-50 text-white flex items-center justify-center cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
};
