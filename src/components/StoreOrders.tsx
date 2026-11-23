import React, { useEffect, useState, useMemo } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  XCircle,
  Loader2,
  Bell,
  ChefHat,
  Phone,
  MapPin,
  Calendar,
  Printer,
  X,
} from 'lucide-react';
import { OrderRecord, OrderStatus } from '../types/edkawi';
import {
  acceptOrderByStoreInFirestore,
  markOrderReadyByStoreInFirestore,
  cancelPendingOrderInFirestore,
} from '../services/edkawiFirebaseService';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot, Unsubscribe } from 'firebase/firestore';
import {
  DEFAULT_EDKAWY_COMMISSION_RATE,
  formatAppErrorMessage,
  getOrderFinancialSnapshot,
  getPaymentMethodLabel,
} from '../utils/orderLogic';
import toast from 'react-hot-toast';

interface StoreOrdersProps {
  storeId: string;
  storeName: string;
  merchantUid?: string;
}

export const StoreOrders: React.FC<StoreOrdersProps> = ({
  storeId,
  storeName,
  merchantUid,
}) => {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'preparing' | 'ready' | 'completed'>('pending');

  // Accept Order modal / state
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null);
  const [prepTimeMinutes, setPrepTimeMinutes] = useState(20);
  const [isSubmittingAccept, setIsSubmittingAccept] = useState(false);

  // Mark ready & cancel/reject states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [printingOrder, setPrintingOrder] = useState<OrderRecord | null>(null);

  useEffect(() => {
    if (!storeId) {
      setOrders([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const effectiveMerchantUid = merchantUid || auth.currentUser?.uid || '';

    // Isolated Firestore Query compliant with isOrderParticipant allow list rule
    const ordersCol = collection(db, 'orders');
    const storeOrdersQuery = effectiveMerchantUid
      ? query(
          ordersCol,
          where('storeId', '==', storeId),
          where('storeOwnerId', '==', effectiveMerchantUid)
        )
      : query(ordersCol, where('storeId', '==', storeId));

    const unsubscribe: Unsubscribe = onSnapshot(
      storeOrdersQuery,
      (snapshot) => {
        const liveOrders: OrderRecord[] = snapshot.docs.map((d) => {
          const data = d.data();
          const createdAtIso =
            typeof data.createdAt?.toDate === 'function'
              ? data.createdAt.toDate().toISOString()
              : typeof data.createdAtIso === 'string' && data.createdAtIso
              ? data.createdAtIso
              : new Date().toISOString();
          return {
            id: d.id,
            storeId: String(data.storeId || storeId),
            storeName: String(data.storeName || storeName),
            storeOwnerId: String(data.storeOwnerId || ''),
            customerId: String(data.customerId || ''),
            customerName: String(data.customerName || ''),
            customerPhone: String(data.customerPhone || ''),
            deliveryAddress: String(data.deliveryAddress || ''),
            deliveryNeighborhood: String(data.deliveryNeighborhood || ''),
            zoneId: data.zoneId,
            items: Array.isArray(data.items) ? data.items : [],
            subtotal: Number(data.subtotal || 0),
            deliveryFee: Number(data.deliveryFee || 0),
            totalAmount: Number(data.totalAmount || 0),
            commissionRate:
              typeof data.commissionRate === 'number'
                ? data.commissionRate
                : undefined,
            commissionAmount:
              typeof data.commissionAmount === 'number'
                ? data.commissionAmount
                : undefined,
            restaurantNet:
              typeof data.restaurantNet === 'number'
                ? data.restaurantNet
                : undefined,
            courierDeliveryCompensation:
              typeof data.courierDeliveryCompensation === 'number'
                ? data.courierDeliveryCompensation
                : undefined,
            isFinancialSettled: Boolean(data.isFinancialSettled),
            settlementId:
              typeof data.settlementId === 'string'
                ? data.settlementId
                : undefined,
            status: (data.status as OrderStatus) || 'pending',
            paymentMethod: data.paymentMethod || 'cash_on_delivery',
            createdAtIso,
            prepTimeMinutes: data.prepTimeMinutes,
            courierId: data.courierId,
            courierName: data.courierName,
            notes: data.notes,
          } as OrderRecord;
        });

        // Sort newest first
        liveOrders.sort(
          (a, b) =>
            new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime()
        );

        setOrders(liveOrders);
        setIsLoading(false);
      },
      (err) => {
        setError(formatAppErrorMessage(err, 'تعذر مزامنة طلبات المتجر مع السحابة.'));
        setIsLoading(false);
      }
    );

    // Guaranteed Cleanup on Unmount
    return () => {
      unsubscribe();
    };
  }, [storeId, storeName, merchantUid]);

  const categorizedOrders = useMemo(() => {
    return {
      pending: orders.filter((o) => o.status === 'pending' || o.status === 'confirmed'),
      preparing: orders.filter((o) => o.status === 'preparing'),
      ready: orders.filter((o) => o.status === 'ready' || o.status === 'on_the_way' || o.status === 'delivering'),
      completed: orders.filter((o) => o.status === 'delivered' || o.status === 'cancelled'),
    };
  }, [orders]);

  const handleAcceptOrder = async () => {
    if (!acceptingOrderId) return;
    setIsSubmittingAccept(true);
    try {
      await acceptOrderByStoreInFirestore(acceptingOrderId, prepTimeMinutes);
      toast.success(`تم قبول الطلب وتحديد وقت التحضير: ${prepTimeMinutes} دقيقة 👨‍🍳`);
      setAcceptingOrderId(null);
    } catch (err) {
      toast.error(
        formatAppErrorMessage(
          err,
          'تعذر قبول الطلب. تحقق مما إذا كان العميل قد ألغى الطلب للتو.'
        )
      );
    } finally {
      setIsSubmittingAccept(false);
    }
  };

  const handleMarkReady = async (orderId: string) => {
    setActionLoadingId(orderId);
    try {
      await markOrderReadyByStoreInFirestore(orderId);
      toast.success('تم تحديد الطلب كجاهز للتسليم، وتم إشعار المناديب 🛵');
    } catch (err) {
      toast.error(formatAppErrorMessage(err, 'تعذر تحديث حالة الطلب.'));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmRejectOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingOrderId) return;
    const orderId = rejectingOrderId;
    const reason = rejectReason.trim();

    setActionLoadingId(orderId);
    try {
      await cancelPendingOrderInFirestore(
        orderId,
        reason || 'اعتذر المتجر عن استقبال الطلب لضغط العمل.'
      );
      toast.success('تم الاعتذار عن الطلب وإشعار العميل');
      setRejectingOrderId(null);
      setRejectReason('');
    } catch (err) {
      toast.error(formatAppErrorMessage(err, 'تعذر الاعتذار عن الطلب.'));
    } finally {
      setActionLoadingId(null);
    }
  };

  const currentTabList = categorizedOrders[activeTab] || [];

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6 edkawi-page-enter" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#F8FAFC] flex items-center gap-2">
            <ChefHat className="w-6 h-6 text-[#FF7100]" />
            <span>طلبات متجر: {storeName}</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#94A3B8] mt-1">
            شاشة المطبخ وإدارة الطلبات الحية مع الحماية من التضارب اللحظي
          </p>
        </div>

        {/* Live Pending Alert */}
        {categorizedOrders.pending.length > 0 && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#FF7100]/15 border border-[#FF7100]/40 text-[#FF7100] text-xs font-bold animate-pulse">
            <Bell className="w-4 h-4" />
            <span>لديك {categorizedOrders.pending.length} طلب جديد بانتظار موافقتك!</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 bg-[#1E293B] border border-[#334155] rounded-2xl text-xs sm:text-sm font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('pending')}
          className={`py-2.5 px-3 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'pending'
              ? 'bg-[#FF7100] text-white shadow-md'
              : 'text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
        >
          <span>طلبات جديدة</span>
          <span className="px-1.5 py-0.5 rounded-full text-[11px] bg-white/20">
            {categorizedOrders.pending.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('preparing')}
          className={`py-2.5 px-3 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'preparing'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
        >
          <span>قيد التحضير</span>
          <span className="px-1.5 py-0.5 rounded-full text-[11px] bg-white/20">
            {categorizedOrders.preparing.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ready')}
          className={`py-2.5 px-3 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'ready'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
        >
          <span>جاهزة / مع المندوب</span>
          <span className="px-1.5 py-0.5 rounded-full text-[11px] bg-white/20">
            {categorizedOrders.ready.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('completed')}
          className={`py-2.5 px-3 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'completed'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
        >
          <span>المكتملة / الأرشيف</span>
          <span className="px-1.5 py-0.5 rounded-full text-[11px] bg-white/20">
            {categorizedOrders.completed.length}
          </span>
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="py-16 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-[#FF7100] animate-spin mx-auto" />
          <p className="text-sm font-semibold text-[#94A3B8]">
            جارٍ الاتصال بنظام المطبخ وإحضار الطلبات...
          </p>
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div className="p-4 rounded-2xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs sm:text-sm font-medium">
          {error}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && currentTabList.length === 0 && (
        <div className="py-16 px-6 text-center rounded-2xl border border-dashed border-[#334155] bg-[#1E293B] space-y-3">
          <ChefHat className="w-12 h-12 text-[#94A3B8] mx-auto" />
          <h3 className="text-base font-bold text-[#F8FAFC]">
            لا توجد طلبات في هذا القسم حالياً
          </h3>
          <p className="text-xs text-[#94A3B8]">
            ستظهر الطلبات الجديدة هنا فور قيام العملاء بالطلب من المتجر
          </p>
        </div>
      )}

      {/* Orders Grid */}
      {!isLoading && !error && currentTabList.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentTabList.map((order) => {
            const formattedTime = new Date(order.createdAtIso).toLocaleTimeString('ar-EG', {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <article
                key={order.id}
                className="rounded-2xl border border-[#334155] bg-[#1E293B] shadow-lg p-6 space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Top Bar */}
                  <div className="flex items-center justify-between gap-2 border-b border-[#334155] pb-3">
                    <div>
                      <span className="font-mono text-xs font-bold text-[#FF7100]">
                        #{order.id.slice(-6).toUpperCase()}
                      </span>
                      <span className="text-xs text-[#94A3B8] mr-2">
                        {formattedTime}
                      </span>
                    </div>

                    <span className="text-xs font-bold px-3 py-1 rounded-2xl bg-[#10192D] border border-[#334155] text-[#F8FAFC]">
                      {order.status === 'confirmed'
                        ? 'طلب مؤكد 🔔'
                        : order.status === 'pending'
                        ? 'طلب جديد 🔔'
                        : order.status === 'preparing'
                        ? `تحضير (${order.prepTimeMinutes || 20} د)`
                        : order.status === 'ready'
                        ? 'جاهز للتوصيل'
                        : order.status === 'delivered'
                        ? 'تم التوصيل'
                        : 'ملغي'}
                    </span>
                  </div>

                  {/* Customer Info */}
                  <div className="space-y-1.5 text-xs text-[#94A3B8]">
                    <div className="font-bold text-sm text-[#F8FAFC]">
                      العميل: {order.customerName}
                    </div>
                    {order.customerPhone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-[#FF7100]" />
                        <span dir="ltr">{order.customerPhone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#FF7100]" />
                      <span>{order.deliveryNeighborhood} · {order.deliveryAddress}</span>
                    </div>
                  </div>

                  {/* Order Items List */}
                  <div className="p-3.5 rounded-2xl bg-[#10192D] border border-[#334155] space-y-2">
                    <div className="text-xs font-bold text-[#F8FAFC]">
                      الأصناف المطلوبة:
                    </div>
                    <ul className="space-y-1.5 text-xs">
                      {order.items.map((it, idx) => (
                        <li key={idx} className="flex items-center justify-between">
                          <span className="text-[#F8FAFC]">
                            <strong className="text-[#FF7100] ml-1">{it.quantity}×</strong> {it.name}
                            {it.variantLabel && (
                              <span className="text-[11px] text-[#94A3B8] mr-1">({it.variantLabel})</span>
                            )}
                          </span>
                          <span className="font-bold tabular-nums text-[#94A3B8]">
                            {it.price * it.quantity} ج.م
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {order.notes && (
                    <p className="text-xs text-amber-200 bg-amber-950/50 border border-amber-500/30 p-3 rounded-2xl">
                      <strong>ملاحظة العميل:</strong> {order.notes}
                    </p>
                  )}
                </div>

                {/* Actions & Price */}
                <div className="pt-3 border-t border-[#334155] flex flex-wrap items-center justify-between gap-3">
                  {(() => {
                    const snap = getOrderFinancialSnapshot(
                      order,
                      DEFAULT_EDKAWY_COMMISSION_RATE
                    );
                    const pct = Math.round(snap.commissionRate * 100);
                    return (
                      <div className="space-y-0.5">
                        <div>
                          <span className="text-xs text-[#94A3B8]">الإجمالي: </span>
                          <span className="text-base font-extrabold text-[#FF7100] tabular-nums">
                            {order.totalAmount} ج.م
                          </span>
                        </div>
                        <p className="text-[11px] font-mono tabular-nums text-[#94A3B8]">
                          صافي المتجر ({100 - pct}%):{' '}
                          <span className="text-emerald-400 font-bold">
                            {snap.restaurantNet} ج.م
                          </span>{' '}
                          · عمولة إدكاوي ({pct}%): {snap.commissionAmount} ج.م
                        </p>
                      </div>
                    );
                  })()}

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPrintingOrder(order)}
                      aria-label="طباعة بون المطبخ"
                      className="min-h-[40px] px-3 py-2 rounded-2xl border border-[#334155] bg-[#10192D] hover:border-[#FF7100] text-[#F8FAFC] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-[#FF7100]" />
                      <span>بون المطبخ</span>
                    </button>

                    {(order.status === 'pending' || order.status === 'confirmed') && (
                      <>
                        <button
                          type="button"
                          onClick={() => setAcceptingOrderId(order.id)}
                          className="min-h-[40px] px-4 py-2 rounded-2xl bg-[#FF7100] hover:bg-[#E66600] text-white text-xs font-bold cursor-pointer shadow-sm"
                        >
                          قبول وتحضير
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectReason('');
                            setRejectingOrderId(order.id);
                          }}
                          disabled={actionLoadingId === order.id}
                          className="min-h-[40px] px-3.5 py-2 rounded-2xl bg-rose-950/50 border border-rose-500/40 hover:bg-rose-900/60 text-rose-200 text-xs font-bold cursor-pointer"
                        >
                          اعتذار
                        </button>
                      </>
                    )}

                    {order.status === 'preparing' && (
                      <button
                        type="button"
                        onClick={() => handleMarkReady(order.id)}
                        disabled={actionLoadingId === order.id}
                        className="min-h-[40px] px-4 py-2 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        {actionLoadingId === order.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        <span>جاهز للتسليم</span>
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Accept Order Modal with Prep Time selection */}
      {acceptingOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-[#1E293B] border border-[#334155] p-6 space-y-5 shadow-2xl">
            <h3 className="text-base font-bold text-[#F8FAFC]">
              تحديد وقت تحضير الطلب
            </h3>
            <p className="text-xs text-[#94A3B8]">
              اختر الوقت المتوقع لانتهاء التجهيز حتى يتم إرسال المندوب في التوقيت المناسب:
            </p>

            <div className="grid grid-cols-4 gap-2">
              {[10, 15, 20, 30].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setPrepTimeMinutes(mins)}
                  className={`py-2.5 rounded-2xl text-xs font-bold border transition-colors cursor-pointer ${
                    prepTimeMinutes === mins
                      ? 'bg-[#FF7100] border-[#FF7100] text-white'
                      : 'bg-[#10192D] border-[#334155] text-[#F8FAFC]'
                  }`}
                >
                  {mins} دقيقة
                </button>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAcceptingOrderId(null)}
                className="px-4 py-2 rounded-2xl border border-[#334155] bg-[#10192D] text-xs font-bold text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isSubmittingAccept}
                onClick={handleAcceptOrder}
                className="min-h-[42px] px-6 py-2 rounded-2xl bg-[#FF7100] hover:bg-[#E66600] text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                {isSubmittingAccept && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>تأكيد وقبول ({prepTimeMinutes} دقيقة)</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Reject Order Modal */}
      {rejectingOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs no-print">
          <form
            onSubmit={handleConfirmRejectOrder}
            className="w-full max-w-md rounded-2xl bg-[#1E293B] border border-[#334155] p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-[#F8FAFC]">
                سبب الاعتذار عن الطلب
              </h3>
              <button
                type="button"
                onClick={() => setRejectingOrderId(null)}
                className="min-h-[36px] min-w-[36px] rounded-2xl border border-[#334155] bg-[#10192D] text-[#94A3B8] hover:text-[#F8FAFC] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#94A3B8]">
              سيصل هذا السبب مباشرة إلى العميل لإعلامه باعتذار المتجر عن تنفيذ الطلب.
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="مثال: الصنف غير متوفر حالياً أو ضغط العمل في المطبخ..."
              className="w-full px-3.5 py-2.5 rounded-2xl border border-[#334155] bg-[#10192D] text-sm text-[#F8FAFC] placeholder:text-[#94A3B8]"
            />
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setRejectingOrderId(null)}
                className="min-h-[42px] px-4 py-2 rounded-2xl border border-[#334155] bg-[#10192D] text-xs font-bold text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="submit"
                disabled={actionLoadingId === rejectingOrderId}
                className="min-h-[42px] px-5 py-2 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {actionLoadingId === rejectingOrderId && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>تأكيد الاعتذار</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Printable Kitchen Receipt Modal */}
      {printingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-[#1E293B] border border-[#334155] p-6 space-y-4 shadow-2xl edkawi-print-area">
            <div className="flex items-center justify-between border-b border-[#334155] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#F8FAFC]">بون مطبخ — {storeName}</h3>
                <p className="text-xs font-mono text-[#FF7100]">
                  #{printingOrder.id.slice(-6).toUpperCase()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPrintingOrder(null)}
                className="no-print min-h-[36px] min-w-[36px] rounded-2xl border border-[#334155] bg-[#10192D] text-[#94A3B8] hover:text-[#F8FAFC] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1 text-xs text-[#94A3B8]">
              <p className="text-[#F8FAFC] font-bold">العميل: {printingOrder.customerName}</p>
              <p>الهاتف: <span dir="ltr">{printingOrder.customerPhone || 'غير مسجل'}</span></p>
              <p>العنوان: {printingOrder.deliveryNeighborhood} · {printingOrder.deliveryAddress}</p>
              <p>الدفع: {getPaymentMethodLabel(printingOrder.paymentMethod)}</p>
            </div>

            <div className="rounded-2xl bg-[#10192D] border border-[#334155] p-3.5 space-y-2">
              {printingOrder.items.map((it, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs text-[#F8FAFC]">
                  <span>
                    <strong className="text-[#FF7100] ml-1">{it.quantity}×</strong>
                    {it.name} {it.variantLabel ? `(${it.variantLabel})` : ''}
                  </span>
                  <span className="tabular-nums font-bold">{it.price * it.quantity} ج.م</span>
                </div>
              ))}
            </div>

            {printingOrder.notes && (
              <p className="text-xs text-amber-200 bg-amber-950/40 border border-amber-500/30 p-3 rounded-2xl">
                ملاحظة: {printingOrder.notes}
              </p>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-[#334155]">
              <span className="text-xs font-bold text-[#94A3B8]">الإجمالي</span>
              <span className="text-lg font-extrabold text-[#FF7100] tabular-nums">
                {printingOrder.totalAmount} ج.م
              </span>
            </div>

            <div className="no-print flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPrintingOrder(null)}
                className="min-h-[42px] px-4 py-2 rounded-2xl border border-[#334155] bg-[#10192D] text-xs font-bold text-[#F8FAFC] cursor-pointer"
              >
                إغلاق
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="min-h-[42px] px-5 py-2 rounded-2xl bg-[#FF7100] hover:bg-[#E66600] text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة البون</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
