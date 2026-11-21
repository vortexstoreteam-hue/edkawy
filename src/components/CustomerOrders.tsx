import React, { useEffect, useState } from 'react';
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  CreditCard,
  XCircle,
  Truck,
  RotateCcw,
  AlertTriangle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { OrderRecord, OrderStatus, PaymentMethod } from '../types/edkawi';
import {
  listenToCustomerOrders,
  cancelPendingOrderInFirestore,
  confirmCustomerOrderInFirestore,
} from '../services/edkawiFirebaseService';
import { auth } from '../firebase';
import {
  formatAppErrorMessage,
  getOrderStatusLabel,
  getPaymentMethodLabel,
  getPendingOrderSurgeDetails,
} from '../utils/orderLogic';
import toast from 'react-hot-toast';
import { ConfirmActionModal } from './ConfirmActionModal';
import { EmptyState } from './EmptyState';

interface CustomerOrdersProps {
  onTrackOrder?: (orderId: string) => void;
  onConfirmPendingOrder?: (
    orderId: string,
    paymentMethod?: PaymentMethod
  ) => Promise<OrderStatus | void>;
  onExploreStores?: () => void;
  onReorder?: (order: OrderRecord) => void;
}

export const CustomerOrders: React.FC<CustomerOrdersProps> = ({
  onTrackOrder,
  onConfirmPendingOrder,
  onExploreStores,
  onReorder,
}) => {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'delivered' | 'cancelled'>('all');
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [confirmCancelOrderId, setConfirmCancelOrderId] = useState<string | null>(null);
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setOrders([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Isolated Firestore Query: where("customerId", "==", auth.currentUser.uid)
    const unsubscribe = listenToCustomerOrders(
      currentUser.uid,
      (liveOrders) => {
        setOrders(liveOrders);
        setIsLoading(false);
      },
      (err) => {
        setError(formatAppErrorMessage(err, 'تعذر تحميل قائمة طلباتك حالياً.'));
        setIsLoading(false);
      }
    );

    // Guaranteed Cleanup on Unmount
    return () => {
      unsubscribe();
    };
  }, []);

  const filteredOrders = orders.filter((o) => {
    if (filter === 'active') {
      return o.status !== 'delivered' && o.status !== 'cancelled';
    }
    if (filter === 'delivered') {
      return o.status === 'delivered';
    }
    if (filter === 'cancelled') {
      return o.status === 'cancelled';
    }
    return true;
  });

  const handleConfirmPendingOrder = async (order: OrderRecord) => {
    if (confirmingOrderId === order.id) return;
    setActionError(null);
    setConfirmingOrderId(order.id);
    try {
      if (onConfirmPendingOrder) {
        await onConfirmPendingOrder(order.id, order.paymentMethod);
      } else {
        const nextStatus = await confirmCustomerOrderInFirestore(
          order.id,
          order.paymentMethod
        );
        toast.success(
          nextStatus === 'pending_payment'
            ? 'تم تحديث حالة الطلب إلى بانتظار إتمام الدفع.'
            : 'تم تأكيد طلبك بنجاح! 🎉'
        );
      }
    } catch (err) {
      const msg = formatAppErrorMessage(
        err,
        'تعذر تأكيد الطلب حالياً. يرجى المحاولة مرة أخرى.'
      );
      setActionError(msg);
      toast.error(msg);
    } finally {
      setConfirmingOrderId(null);
    }
  };

  const executeCancelOrder = async (orderId: string) => {
    setActionError(null);
    setCancellingOrderId(orderId);
    try {
      await cancelPendingOrderInFirestore(orderId);
      setConfirmCancelOrderId(null);
      toast.success('تم إلغاء الطلب بنجاح');
    } catch (err) {
      const msg = formatAppErrorMessage(
        err,
        'تعذر إلغاء الطلب. قد يكون المتجر بدأ في التحضير بالفعل.'
      );
      setActionError(msg);
      toast.error(msg);
    } finally {
      setCancellingOrderId(null);
    }
  };

  const getStatusBadge = (status: OrderStatus, createdAtIso: string) => {
    const surge =
      status === 'pending' || status === 'confirmed'
        ? getPendingOrderSurgeDetails(createdAtIso)
        : null;

    switch (status) {
      case 'pending':
        return (
          <div className="flex flex-col items-end gap-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-2xl text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <Clock className="w-3.5 h-3.5" />
              <span>بانتظار تأكيد الطلب</span>
            </span>
            {surge && surge.isSurgeActive && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-300 bg-rose-950/50 border border-rose-500/30 px-2.5 py-0.5 rounded-xl">
                <AlertTriangle className="w-3 h-3" />
                <span>تأخر استجابة ({surge.elapsedMinutes} دقيقة)</span>
              </span>
            )}
          </div>
        );
      case 'confirmed':
        return (
          <div className="flex flex-col items-end gap-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-2xl text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>تم تأكيد الطلب · بانتظار المتجر</span>
            </span>
            {surge && surge.isSurgeActive && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-300 bg-rose-950/50 border border-rose-500/30 px-2.5 py-0.5 rounded-xl">
                <AlertTriangle className="w-3 h-3" />
                <span>تأخر استجابة ({surge.elapsedMinutes} دقيقة)</span>
              </span>
            )}
          </div>
        );
      case 'pending_payment':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-2xl text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <CreditCard className="w-3.5 h-3.5" />
            <span>بانتظار إتمام الدفع</span>
          </span>
        );
      case 'preparing':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-2xl text-xs font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>جاري التحضير بالمتجر</span>
          </span>
        );
      case 'ready':
      case 'on_the_way':
      case 'delivering':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-2xl text-xs font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <Truck className="w-3.5 h-3.5" />
            <span>في الطريق إليك مع المندوب</span>
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-2xl text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>تم التوصيل بنجاح</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-2xl text-xs font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <XCircle className="w-3.5 h-3.5" />
            <span>تم إلغاء الطلب</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-2xl text-xs font-bold bg-[#0F172A] border border-[#334155] text-[#F8FAFC]">
            {getOrderStatusLabel(status)}
          </span>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6 pb-28 edkawi-page-enter" dir="rtl">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#F8FAFC]">
            طلباتي
          </h1>
          <p className="text-xs sm:text-sm text-[#94A3B8] mt-1">
            متابعة حية وفورية لطلباتك في مدينة إدكو
          </p>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-2 p-1.5 bg-[#1E293B] border border-[#334155] rounded-2xl overflow-x-auto text-xs font-bold">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3.5 py-2 rounded-2xl transition-all cursor-pointer whitespace-nowrap ${
              filter === 'all'
                ? 'bg-[#FF6B00] text-white shadow-sm'
                : 'text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            الكل ({orders.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('active')}
            className={`px-3.5 py-2 rounded-2xl transition-all cursor-pointer whitespace-nowrap ${
              filter === 'active'
                ? 'bg-[#FF6B00] text-white shadow-sm'
                : 'text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            النشطة ({orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled').length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('delivered')}
            className={`px-3.5 py-2 rounded-2xl transition-all cursor-pointer whitespace-nowrap ${
              filter === 'delivered'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            المكتملة ({orders.filter((o) => o.status === 'delivered').length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('cancelled')}
            className={`px-3.5 py-2 rounded-2xl transition-all cursor-pointer whitespace-nowrap ${
              filter === 'cancelled'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            الملغاة ({orders.filter((o) => o.status === 'cancelled').length})
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="py-16 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-[#FF6B00] animate-spin mx-auto" />
          <p className="text-sm font-semibold text-[#94A3B8]">
            جارٍ جلب وتحديث طلباتك من السحابة...
          </p>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="p-4 rounded-2xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs sm:text-sm font-medium">
          {error}
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs sm:text-sm font-medium"
        >
          {actionError}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredOrders.length === 0 && (
        <EmptyState
          icon={ShoppingBag}
          title="لا توجد طلبات في هذا القسم"
          description="استكشف أشهى مطاعم وصيدليات ومتاجر مدينة إدكو واطلب الآن"
          actionLabel={onExploreStores ? 'تصفح المتاجر والمطاعم' : undefined}
          onAction={onExploreStores}
        />
      )}

      {/* Orders List */}
      {!isLoading && !error && filteredOrders.length > 0 && (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const canConfirm = order.status === 'pending';
            const canCancel =
              order.status === 'pending' ||
              order.status === 'confirmed' ||
              order.status === 'pending_payment';
            const isActive = order.status !== 'delivered' && order.status !== 'cancelled';
            const formattedDate = new Date(order.createdAtIso).toLocaleString('ar-EG', {
              dateStyle: 'medium',
              timeStyle: 'short',
            });

            return (
              <article
                key={order.id}
                className="rounded-2xl border border-[#334155] bg-[#1E293B] shadow-lg p-6 space-y-4"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#334155] pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-[#F8FAFC]">
                        {order.storeName}
                      </h3>
                      <span className="font-mono text-xs text-[#94A3B8]">
                        #{order.id.slice(-6).toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-[#94A3B8]">
                      {formattedDate} · الدفع: {getPaymentMethodLabel(order.paymentMethod)}
                    </p>
                  </div>
                  {getStatusBadge(order.status, order.createdAtIso)}
                </div>

                {/* Items Summary */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-[#94A3B8]">
                    الأصناف المطلوبة ({order.items.reduce((s, it) => s + it.quantity, 0)}):
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {order.items.map((it, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-[#0F172A] border border-[#334155] text-xs text-[#F8FAFC]"
                      >
                        <span className="font-bold text-[#FF6B00] tabular-nums">
                          {it.quantity}×
                        </span>
                        <span>{it.name}</span>
                        {it.variantLabel && (
                          <span className="text-[11px] text-[#94A3B8]">
                            ({it.variantLabel})
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Pricing and Action Footer */}
                <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-[#334155]">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-[#94A3B8]">
                      إجمالي الطلب:
                    </span>
                    <span className="text-lg font-extrabold text-[#FF6B00] tabular-nums">
                      {order.totalAmount} ج.م
                    </span>
                    {order.deliveryFee > 0 && (
                      <span className="text-[11px] text-[#94A3B8]">
                        (شامل {order.deliveryFee} ج.م توصيل)
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* Live Tracking */}
                    {isActive && onTrackOrder && (
                      <button
                        type="button"
                        onClick={() => onTrackOrder(order.id)}
                        className="min-h-[42px] px-4 py-2 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <Truck className="w-4 h-4" />
                        <span>تتبع الطلب لحظياً</span>
                      </button>
                    )}

                    {/* Confirm Pending Order */}
                    {canConfirm && (
                      <button
                        type="button"
                        disabled={confirmingOrderId === order.id || cancellingOrderId === order.id}
                        onClick={() => void handleConfirmPendingOrder(order)}
                        className="min-h-[42px] px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                      >
                        {confirmingOrderId === order.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {confirmingOrderId === order.id
                            ? 'جارٍ التأكيد...'
                            : 'تأكيد الطلب الآن'}
                        </span>
                      </button>
                    )}

                    {/* Cancel Pending / Confirmed Order */}
                    {canCancel && (
                      <button
                        type="button"
                        disabled={cancellingOrderId === order.id || confirmingOrderId === order.id}
                        onClick={() => setConfirmCancelOrderId(order.id)}
                        className="min-h-[42px] px-4 py-2 rounded-2xl bg-rose-950/50 border border-rose-500/40 hover:bg-rose-900/60 text-rose-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                      >
                        {cancellingOrderId === order.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                        <span>إلغاء الطلب</span>
                      </button>
                    )}

                    {/* Reorder Button */}
                    {!isActive && onReorder && (
                      <button
                        type="button"
                        onClick={() => onReorder(order)}
                        className="min-h-[42px] px-4 py-2 rounded-2xl border border-[#334155] bg-[#0F172A] hover:border-[#FF6B00] text-[#F8FAFC] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-[#FF6B00]" />
                        <span>إعادة الطلب</span>
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
        isOpen={Boolean(confirmCancelOrderId)}
        title="تأكيد إلغاء الطلب"
        description="هل أنت متأكد من رغبتك في إلغاء هذا الطلب؟ إذا كنت قد دفعت من المحفظة، سيتم استرداد المبلغ تلقائياً."
        confirmLabel="نعم، إلغاء الطلب"
        cancelLabel="تراجع"
        tone="danger"
        isProcessing={Boolean(cancellingOrderId)}
        onCancel={() => setConfirmCancelOrderId(null)}
        onConfirm={() => {
          if (confirmCancelOrderId) {
            void executeCancelOrder(confirmCancelOrderId);
          }
        }}
      />
    </div>
  );
};
