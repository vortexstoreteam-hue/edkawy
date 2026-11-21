import React, { useEffect, useState, useMemo } from 'react';
import {
  Bike,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  Package,
  Navigation,
  Loader2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { OrderRecord } from '../types/edkawi';
import {
  listenToCourierOrdersAndDispatch,
  pickupOrderByCourierInFirestore,
  completeOrderDeliveryInFirestore,
} from '../services/edkawiFirebaseService';
import { formatAppErrorMessage, getPaymentMethodLabel } from '../utils/orderLogic';
import { ConfirmActionModal } from './ConfirmActionModal';
import toast from 'react-hot-toast';

interface CourierOrdersProps {
  courierUid: string;
  courierName?: string;
  isApproved?: boolean;
}

export const CourierOrders: React.FC<CourierOrdersProps> = ({
  courierUid,
  courierName = 'كابتن إدكاوي',
  isApproved = true,
}) => {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'my_tasks' | 'available' | 'delivered'>('my_tasks');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [confirmDeliveryOrder, setConfirmDeliveryOrder] = useState<OrderRecord | null>(null);

  useEffect(() => {
    if (!courierUid) {
      setOrders([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Isolated Firestore Query through robust courier dispatch listener
    const unsubscribe = listenToCourierOrdersAndDispatch(
      courierUid,
      isApproved,
      (liveOrders) => {
        setOrders(liveOrders);
        setIsLoading(false);
      },
      (err) => {
        setError(formatAppErrorMessage(err, 'تعذر مزامنة مهام التوصيل مع السحابة.'));
        setIsLoading(false);
      }
    );

    // Guaranteed Cleanup on Unmount
    return () => {
      unsubscribe();
    };
  }, [courierUid, isApproved]);

  const { myTasks, availableOrders, deliveredOrders } = useMemo(() => {
    const myTasksList: OrderRecord[] = [];
    const availableList: OrderRecord[] = [];
    const deliveredList: OrderRecord[] = [];

    orders.forEach((o) => {
      if (o.status === 'delivered') {
        if (o.courierId === courierUid) {
          deliveredList.push(o);
        }
      } else if (o.courierId === courierUid) {
        myTasksList.push(o);
      } else if (!o.courierId && o.status === 'ready') {
        availableList.push(o);
      }
    });

    return {
      myTasks: myTasksList,
      availableOrders: availableList,
      deliveredOrders: deliveredList,
    };
  }, [orders, courierUid]);

  const handleClaimOrder = async (order: OrderRecord) => {
    setActionLoadingId(order.id);
    try {
      await pickupOrderByCourierInFirestore(
        order.id,
        courierUid,
        courierName,
        '01000000000',
        order.deliveryNeighborhood || 'مدينة إدكو'
      );
      toast.success('تم استلام المهمة والبدء في التوصيل بنجاح 🛵');
    } catch (err) {
      toast.error(formatAppErrorMessage(err, 'تعذر استلام المهمة. قد يكون كابتن آخر استلمها.'));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmCompleteDelivery = async () => {
    const order = confirmDeliveryOrder;
    if (!order) return;

    setActionLoadingId(order.id);
    try {
      await completeOrderDeliveryInFirestore(
        order.id,
        order.deliveryAddress || order.deliveryNeighborhood || 'مدينة إدكو',
        courierUid,
        courierName
      );
      toast.success('تم إتمام التوصيل بنجاح! شكراً لجهودك يا كابتن 🌟');
      setConfirmDeliveryOrder(null);
    } catch (err) {
      toast.error(formatAppErrorMessage(err, 'تعذر تحديث إتمام الطلب.'));
    } finally {
      setActionLoadingId(null);
    }
  };

  const activeList =
    activeTab === 'my_tasks'
      ? myTasks
      : activeTab === 'available'
      ? availableOrders
      : deliveredOrders;

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6 edkawi-page-enter" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#F8FAFC] flex items-center gap-2">
            <Bike className="w-6 h-6 text-[#FF6B00]" />
            <span>لوحة الكابتن: {courierName}</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#94A3B8] mt-1">
            توصيل الطلبات الفوري لجميع مناطق وأحياء مدينة إدكو
          </p>
        </div>

        {myTasks.length > 0 && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#FF6B00]/15 border border-[#FF6B00]/40 text-[#FF6B00] text-xs font-bold">
            <Navigation className="w-4 h-4" />
            <span>لديك {myTasks.length} طلب قيد التوصيل الآن</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-2 p-1.5 bg-[#1E293B] border border-[#334155] rounded-2xl text-xs sm:text-sm font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('my_tasks')}
          className={`py-2.5 px-3 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'my_tasks'
              ? 'bg-[#FF6B00] text-white shadow-md'
              : 'text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
        >
          <span>مهامي الحالية</span>
          <span className="px-1.5 py-0.5 rounded-full text-[11px] bg-white/20">
            {myTasks.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('available')}
          className={`py-2.5 px-3 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'available'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
        >
          <span>طلبات متاحة للاستلام</span>
          <span className="px-1.5 py-0.5 rounded-full text-[11px] bg-white/20">
            {availableOrders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('delivered')}
          className={`py-2.5 px-3 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'delivered'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
        >
          <span>تم تسليمها</span>
          <span className="px-1.5 py-0.5 rounded-full text-[11px] bg-white/20">
            {deliveredOrders.length}
          </span>
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="py-16 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-[#FF6B00] animate-spin mx-auto" />
          <p className="text-sm font-semibold text-[#94A3B8]">
            جارٍ تحديث خريطة ومهام التوصيل...
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
      {!isLoading && !error && activeList.length === 0 && (
        <div className="py-16 px-6 text-center rounded-2xl border border-dashed border-[#334155] bg-[#1E293B] space-y-3">
          <Package className="w-12 h-12 text-[#94A3B8] mx-auto" />
          <h3 className="text-base font-bold text-[#F8FAFC]">
            لا توجد طلبات في هذا القسم حالياً
          </h3>
          <p className="text-xs text-[#94A3B8]">
            تابع هذه الشاشة لاستلام أي طلب جديد يجهزه المتجر في إدكو فوراً
          </p>
        </div>
      )}

      {/* Orders List */}
      {!isLoading && !error && activeList.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeList.map((order) => {
            return (
              <article
                key={order.id}
                className="rounded-2xl border border-[#334155] bg-[#1E293B] shadow-lg p-6 space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-[#334155] pb-3">
                    <span className="font-mono text-xs font-bold text-[#FF6B00]">
                      #{order.id.slice(-6).toUpperCase()}
                    </span>
                    <span className="text-xs font-bold px-3 py-1 rounded-2xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC]">
                      {order.storeName}
                    </span>
                  </div>

                  {/* Delivery Route Details */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-start gap-2 text-[#F8FAFC]">
                      <MapPin className="w-4 h-4 text-[#FF6B00] shrink-0 mt-0.5" />
                      <div>
                        <strong>عنوان التوصيل: </strong>
                        <span className="text-[#94A3B8]">{order.deliveryNeighborhood} · {order.deliveryAddress}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[#94A3B8]">
                      <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>هاتف العميل: </span>
                      <a
                        href={`tel:${order.customerPhone}`}
                        dir="ltr"
                        className="font-bold text-[#FF6B00] hover:underline"
                      >
                        {order.customerPhone}
                      </a>
                    </div>
                  </div>

                  {/* Items Count & Fee */}
                  <div className="p-3.5 rounded-2xl bg-[#0F172A] border border-[#334155] flex items-center justify-between text-xs">
                    <span className="text-[#94A3B8]">
                      عدد الأصناف: {order.items.reduce((s, it) => s + it.quantity, 0)} صنف
                    </span>
                    <span className="font-bold text-emerald-400">
                      أجرة التوصيل: {order.deliveryFee} ج.م
                    </span>
                  </div>
                </div>

                {/* Footer and Actions */}
                <div className="pt-3 border-t border-[#334155] flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs text-[#94A3B8]">تحصيل كاش: </span>
                    <span className="text-base font-extrabold text-[#FF6B00] tabular-nums">
                      {order.totalAmount} ج.م
                    </span>
                  </div>

                  <div>
                    {activeTab === 'available' && (
                      <button
                        type="button"
                        onClick={() => handleClaimOrder(order)}
                        disabled={actionLoadingId === order.id}
                        className="min-h-[40px] px-5 py-2 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                      >
                        {actionLoadingId === order.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Bike className="w-3.5 h-3.5" />
                        )}
                        <span>استلام وتوصيل الطلب</span>
                      </button>
                    )}

                    {activeTab === 'my_tasks' && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeliveryOrder(order)}
                        disabled={actionLoadingId === order.id}
                        className="min-h-[40px] px-5 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                      >
                        {actionLoadingId === order.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        <span>تم تسليم الطلب وتحصيل الكاش</span>
                      </button>
                    )}

                    {activeTab === 'delivered' && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>تم التسليم بنجاح</span>
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <ConfirmActionModal
        isOpen={Boolean(confirmDeliveryOrder)}
        title="تأكيد إتمام التوصيل"
        description={
          confirmDeliveryOrder
            ? `هل تم تسليم الطلب #${confirmDeliveryOrder.id.slice(-6).toUpperCase()} للعميل (${confirmDeliveryOrder.customerName}) وتحصيل المبلغ (${confirmDeliveryOrder.totalAmount} ج.م) بنجاح؟`
            : ''
        }
        confirmLabel="نعم، تم التسليم بنجاح"
        cancelLabel="تراجع"
        tone="primary"
        isProcessing={Boolean(confirmDeliveryOrder && actionLoadingId === confirmDeliveryOrder.id)}
        onConfirm={handleConfirmCompleteDelivery}
        onCancel={() => setConfirmDeliveryOrder(null)}
      />
    </div>
  );
};
