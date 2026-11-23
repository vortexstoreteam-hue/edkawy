import { FormEvent, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Building2,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  FileText,
  Landmark,
  Package,
  PauseCircle,
  Percent,
  Phone,
  PlayCircle,
  Printer,
  ShieldAlert,
  ShoppingBag,
  Trash2,
  UserCheck,
  Wallet,
  X,
} from 'lucide-react';
import {
  generateDailyRestaurantSettlementsInFirestore,
  markRestaurantSettlementPaidInFirestore,
  createFinancialExceptionInFirestore,
  updateStoreCommissionRateByAdminInFirestore,
  updateStoreDetailsByAdminInFirestore,
} from '../services/edkawiFirebaseService';
import {
  AuditLogRecord,
  ExceptionResponsibleParty,
  FinancialExceptionRecord,
  FinancialExceptionType,
  FinancialTransactionRecord,
  OrderRecord,
  ProductRecord,
  RestaurantSettlementMethod,
  RestaurantSettlementRecord,
  StoreCategory,
  StoreRecord,
} from '../types/edkawi';
import {
  DEFAULT_EDKAWY_COMMISSION_RATE,
  EDKU_NEIGHBORHOODS,
  MIN_COURIER_DELIVERY_FEE_EGP,
  STORE_CATEGORIES,
  formatAppErrorMessage,
  getAuditActionLabelAr,
  getCairoDateKey,
  getFinancialExceptionTypeLabelAr,
  getOrderFinancialSnapshot,
  getOrderStatusLabel,
  getSettlementStatusLabelAr,
} from '../utils/orderLogic';
import { ResilientImage } from './ResilientImage';

type StoreDetailTab =
  | 'overview'
  | 'info'
  | 'orders'
  | 'finance'
  | 'settlements'
  | 'products'
  | 'activity';

interface AdminStoreDetailViewProps {
  store: StoreRecord;
  orders: OrderRecord[];
  products: ProductRecord[];
  transactions: FinancialTransactionRecord[];
  settlements: RestaurantSettlementRecord[];
  exceptions: FinancialExceptionRecord[];
  auditLogs: AuditLogRecord[];
  adminUid: string;
  adminName?: string;
  onBack: () => void;
  onDeleteProductByAdmin?: (
    product: ProductRecord,
    storeName?: string
  ) => Promise<void>;
  onNotify?: (msg: string) => void;
}

const STORE_CATEGORIES_LIST: readonly StoreCategory[] = STORE_CATEGORIES;

const PAYMENT_METHOD_LABELS: Record<RestaurantSettlementMethod, string> = {
  vodafone_cash: 'فودافون كاش',
  instapay: 'إنستاباي (InstaPay)',
  bank_transfer: 'تحويل بنكي',
  cash_at_hq: 'نقداً بمقر إدكاوي',
};

const EXCEPTION_TYPE_OPTIONS: FinancialExceptionType[] = [
  'cancelled_before_prep',
  'store_rejected',
  'customer_refused_door',
  'courier_failed_delivery',
  'cash_shortage',
  'wrong_order',
];

export function AdminStoreDetailView({
  store,
  orders,
  products,
  transactions,
  settlements,
  exceptions,
  auditLogs,
  adminUid,
  adminName = 'مدير النظام',
  onBack,
  onDeleteProductByAdmin,
  onNotify,
}: AdminStoreDetailViewProps) {
  const [activeTab, setActiveTab] = useState<StoreDetailTab>('overview');
  const [orderFilter, setOrderFilter] = useState<
    'all' | 'delivered' | 'active' | 'cancelled'
  >('all');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);

  // Commission Modal
  const [isCommissionModalOpen, setIsCommissionModalOpen] = useState(false);
  const [commissionInputPct, setCommissionInputPct] = useState(
    String(
      Math.round(
        (store.commissionRate ?? DEFAULT_EDKAWY_COMMISSION_RATE) * 100
      )
    )
  );

  // Exception Modal
  const [isExceptionModalOpen, setIsExceptionModalOpen] = useState(false);
  const [excType, setExcType] =
    useState<FinancialExceptionType>('wrong_order');
  const [excAmount, setExcAmount] = useState('0');
  const [excOrderId, setExcOrderId] = useState('');
  const [excParty, setExcParty] =
    useState<ExceptionResponsibleParty>('store');
  const [excHold, setExcHold] = useState(false);
  const [excDesc, setExcDesc] = useState('');

  // Settlement Pay Modal
  const [payingSettlement, setPayingSettlement] =
    useState<RestaurantSettlementRecord | null>(null);
  const [payMethod, setPayMethod] =
    useState<RestaurantSettlementMethod>('vodafone_cash');
  const [payReference, setPayReference] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [settlementTargetDate, setSettlementTargetDate] = useState(
    getCairoDateKey()
  );

  // Info Tab Form
  const [infoName, setInfoName] = useState(store.name);
  const [infoCategory, setInfoCategory] = useState<StoreCategory>(
    store.category
  );
  const [infoNeighborhood, setInfoNeighborhood] = useState(
    store.neighborhood
  );
  const [infoOwnerName, setInfoOwnerName] = useState(store.ownerName ?? '');
  const [infoPhone, setInfoPhone] = useState(store.phone ?? '');
  const [infoDeliveryFee, setInfoDeliveryFee] = useState(
    String(Math.max(MIN_COURIER_DELIVERY_FEE_EGP, store.deliveryFee || 15))
  );
  const [infoDeliveryTime, setInfoDeliveryTime] = useState(
    String(store.deliveryTimeMinutes || 30)
  );
  const [infoPrepTime, setInfoPrepTime] = useState(
    String(store.prepTimeMinutes || 20)
  );
  const [infoMinOrder, setInfoMinOrder] = useState(
    String(store.minOrderAmount || 0)
  );
  const [infoCrNumber, setInfoCrNumber] = useState(
    store.commercialRegisterNumber ?? ''
  );
  const [infoTaxNumber, setInfoTaxNumber] = useState(
    store.taxCertificateNumber ?? ''
  );
  const [infoPausedReason, setInfoPausedReason] = useState(
    store.pausedReason ?? ''
  );
  const [infoDescription, setInfoDescription] = useState(
    store.description ?? ''
  );

  const commissionRate = store.commissionRate ?? DEFAULT_EDKAWY_COMMISSION_RATE;
  const commissionPct = Math.round(commissionRate * 100);
  const storeSharePct = 100 - commissionPct;

  const storeOrders = useMemo(
    () =>
      orders
        .filter((o) => o.storeId === store.id && !o.isTestSimulation)
        .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso)),
    [orders, store.id]
  );

  const deliveredOrders = useMemo(
    () => storeOrders.filter((o) => o.status === 'delivered'),
    [storeOrders]
  );

  const storeProducts = useMemo(
    () => products.filter((p) => p.storeId === store.id),
    [products, store.id]
  );

  const storeTransactions = useMemo(
    () =>
      transactions
        .filter((t) => t.storeId === store.id && !t.isTestSimulation)
        .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso)),
    [transactions, store.id]
  );

  const storeSettlements = useMemo(
    () =>
      settlements
        .filter((s) => s.storeId === store.id)
        .sort((a, b) => b.updatedAtIso.localeCompare(a.updatedAtIso)),
    [settlements, store.id]
  );

  const storeExceptions = useMemo(
    () =>
      exceptions
        .filter((e) => e.storeId === store.id)
        .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso)),
    [exceptions, store.id]
  );

  const storeActivityLogs = useMemo(
    () =>
      auditLogs
        .filter(
          (l) =>
            l.targetId === store.id ||
            l.details.includes(store.name) ||
            storeSettlements.some((s) => s.id === l.targetId)
        )
        .slice(0, 60),
    [auditLogs, store.id, store.name, storeSettlements]
  );

  const storeStats = useMemo(() => {
    let grossProductsSales = 0;
    let totalCommission = 0;
    let totalStoreNet = 0;
    let unsettledStoreNet = 0;

    for (const o of deliveredOrders) {
      const snap = getOrderFinancialSnapshot(o, commissionRate);
      grossProductsSales += o.subtotal;
      totalCommission += snap.commissionAmount;
      totalStoreNet += snap.restaurantNet;
      if (!o.isFinancialSettled) {
        unsettledStoreNet += snap.restaurantNet;
      }
    }

    const paidSettlementsTotal = storeSettlements
      .filter((s) => s.status === 'paid')
      .reduce((acc, s) => acc + s.restaurantNetPayable, 0);

    const pendingSettlementsTotal = storeSettlements
      .filter((s) => s.status === 'pending_review')
      .reduce((acc, s) => acc + s.restaurantNetPayable, 0);

    const heldExceptionsTotal = storeExceptions
      .filter((e) => e.status === 'pending_review' && e.holdSettlement)
      .reduce((acc, e) => acc + e.disputedAmount, 0);

    return {
      grossProductsSales: Number(grossProductsSales.toFixed(2)),
      totalCommission: Number(totalCommission.toFixed(2)),
      totalStoreNet: Number(totalStoreNet.toFixed(2)),
      unsettledStoreNet: Number(unsettledStoreNet.toFixed(2)),
      paidSettlementsTotal: Number(paidSettlementsTotal.toFixed(2)),
      pendingSettlementsTotal: Number(pendingSettlementsTotal.toFixed(2)),
      heldExceptionsTotal: Number(heldExceptionsTotal.toFixed(2)),
    };
  }, [
    deliveredOrders,
    commissionRate,
    storeSettlements,
    storeExceptions,
  ]);

  const filteredOrders = useMemo(() => {
    if (orderFilter === 'all') return storeOrders;
    if (orderFilter === 'delivered') {
      return storeOrders.filter((o) => o.status === 'delivered');
    }
    if (orderFilter === 'cancelled') {
      return storeOrders.filter((o) => o.status === 'cancelled');
    }
    return storeOrders.filter(
      (o) => o.status !== 'delivered' && o.status !== 'cancelled'
    );
  }, [storeOrders, orderFilter]);

  function flashOk(msg: string) {
    setBannerError(null);
    setBannerSuccess(msg);
    onNotify?.(msg);
  }

  async function handleSaveCommission(e: FormEvent) {
    e.preventDefault();
    const pct = Number(commissionInputPct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 50) {
      setBannerError('نسبة عمولة إدكاوي يجب أن تكون بين 0% و 50%.');
      return;
    }
    setBusyKey('commission');
    try {
      await updateStoreCommissionRateByAdminInFirestore({
        adminUid,
        adminName,
        storeId: store.id,
        storeName: store.name,
        commissionRatePercent: pct,
      });
      setIsCommissionModalOpen(false);
      flashOk(
        `تم تحديث عمولة إدكاوي لمتجر "${store.name}" إلى ${pct}% (صافي المتجر ${100 - pct}%).`
      );
    } catch (err) {
      setBannerError(formatAppErrorMessage(err, 'تعذر تعديل نسبة العمولة.'));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleTogglePauseStore() {
    setBusyKey('pause');
    try {
      const nextActive = !store.isActive;
      await updateStoreDetailsByAdminInFirestore({
        adminUid,
        adminName,
        storeId: store.id,
        updates: {
          isActive: nextActive,
          isOpen: nextActive,
        },
      });
      flashOk(
        nextActive
          ? `تم إعادة تفعيل متجر "${store.name}" بنجاح.`
          : `تم إيقاف متجر "${store.name}" مؤقتاً.`
      );
    } catch (err) {
      setBannerError(formatAppErrorMessage(err, 'تعذر تحديث حالة المتجر.'));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleToggleSuspendPartnership() {
    setBusyKey('suspend');
    try {
      const nextSuspended = !Boolean(store.suspended);
      await updateStoreDetailsByAdminInFirestore({
        adminUid,
        adminName,
        storeId: store.id,
        updates: {
          suspended: nextSuspended,
          ...(nextSuspended ? { isActive: false, isOpen: false } : { isActive: true }),
        },
      });
      flashOk(
        nextSuspended
          ? `تم إيقاف شراكة متجر "${store.name}" إدارياً.`
          : `تم رفع الإيقاف الإداري عن متجر "${store.name}".`
      );
    } catch (err) {
      setBannerError(formatAppErrorMessage(err, 'تعذر تحديث حالة الشراكة.'));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleCreateStoreException(e: FormEvent) {
    e.preventDefault();
    const amt = Math.max(0, Number(excAmount));
    if (excDesc.trim().length < 4) {
      setBannerError('يرجى كتابة وصف واضح للحالة الاستثنائية.');
      return;
    }
    setBusyKey('exception');
    try {
      await createFinancialExceptionInFirestore({
        exceptionType: excType,
        disputedAmount: amt,
        description: excDesc.trim(),
        responsibleParty: excParty,
        holdSettlement: excHold,
        orderId: excOrderId.trim() || undefined,
        storeId: store.id,
        storeOwnerId: store.ownerUid,
        storeName: store.name,
        actorUid: adminUid,
      });
      setIsExceptionModalOpen(false);
      setExcDesc('');
      setExcAmount('0');
      setExcOrderId('');
      setExcHold(false);
      flashOk('تم تسجيل الحالة الاستثنائية وإدراجها في المراجعة اليدوية.');
    } catch (err) {
      setBannerError(
        formatAppErrorMessage(err, 'تعذر تسجيل الحالة الاستثنائية.')
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSaveInfoSubmit(e: FormEvent) {
    e.preventDefault();
    const cleanFee = Math.trunc(Number(infoDeliveryFee));
    if (
      !Number.isFinite(cleanFee) ||
      cleanFee < MIN_COURIER_DELIVERY_FEE_EGP ||
      cleanFee > 250
    ) {
      setBannerError(
        `الحد الأدنى لرسوم التوصيل هو ${MIN_COURIER_DELIVERY_FEE_EGP} ج.م ولا يتجاوز 250 ج.م.`
      );
      return;
    }
    setBusyKey('save_info');
    try {
      await updateStoreDetailsByAdminInFirestore({
        adminUid,
        adminName,
        storeId: store.id,
        updates: {
          name: infoName,
          category: infoCategory,
          neighborhood: infoNeighborhood,
          ownerName: infoOwnerName,
          phone: infoPhone,
          deliveryFee: cleanFee,
          deliveryTimeMinutes: Number(infoDeliveryTime),
          prepTimeMinutes: Number(infoPrepTime),
          minOrderAmount: Number(infoMinOrder),
          commercialRegisterNumber: infoCrNumber,
          taxCertificateNumber: infoTaxNumber,
          pausedReason: infoPausedReason,
          description: infoDescription,
        },
      });
      flashOk(`تم تحديث البيانات الكاملة لمتجر "${infoName}" في Firestore.`);
    } catch (err) {
      setBannerError(formatAppErrorMessage(err, 'تعذر حفظ بيانات المتجر.'));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleGenerateStoreSettlementNow() {
    setBusyKey('gen_settlement');
    try {
      const batches = await generateDailyRestaurantSettlementsInFirestore({
        targetDateKey: settlementTargetDate,
        storeIdFilter: store.id,
        adminUid,
        adminName,
      });
      if (batches.length === 0) {
        setBannerError(
          `لا توجد طلبات مكتملة غير مسوّاة بتاريخ ${settlementTargetDate} لهذا المتجر.`
        );
      } else {
        flashOk(
          `تم إصدار كشف التسوية اليومي (${batches[0].ordersCount} طلبات — صافي المتجر ${batches[0].restaurantNetPayable} ج.م).`
        );
      }
    } catch (err) {
      setBannerError(formatAppErrorMessage(err, 'تعذر إنشاء كشف التسوية.'));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleConfirmPaySettlement(e: FormEvent) {
    e.preventDefault();
    if (!payingSettlement) return;
    setBusyKey('pay_settlement');
    try {
      await markRestaurantSettlementPaidInFirestore({
        settlementId: payingSettlement.id,
        paymentMethod: payMethod,
        transferReference: payReference.trim() || undefined,
        notes: payNotes.trim() || undefined,
        adminUid,
        adminName,
      });
      flashOk(
        `تم سداد تسوية "${payingSettlement.storeName}" بمبلغ ${payingSettlement.restaurantNetPayable} ج.م وإغلاقها.`
      );
      setPayingSettlement(null);
      setPayReference('');
      setPayNotes('');
    } catch (err) {
      setBannerError(formatAppErrorMessage(err, 'تعذر تأكيد سداد التسوية.'));
    } finally {
      setBusyKey(null);
    }
  }

  const tabs: { id: StoreDetailTab; label: string }[] = [
    { id: 'overview', label: 'نظرة عامة' },
    { id: 'info', label: 'بيانات المطعم' },
    { id: 'orders', label: 'الطلبات' },
    { id: 'finance', label: 'الحسابات المالية' },
    { id: 'settlements', label: 'التسويات' },
    { id: 'products', label: 'المنتجات' },
    { id: 'activity', label: 'سجل النشاط' },
  ];

  const statusText = store.suspended
    ? 'موقوف الشراكة'
    : store.isActive
    ? 'نشط ومعتمد'
    : 'متوقف مؤقتاً';

  return (
    <div className="space-y-6 text-[#F8FAFC] edkawi-print-area">
      {/* Top Bar */}
      <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-4 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-xl bg-[#10192D] border border-[#334155] hover:border-[#FF7100] text-xs sm:text-sm font-bold text-[#F8FAFC] inline-flex items-center gap-2 cursor-pointer print:hidden"
          >
            <ArrowRight className="w-4 h-4 text-[#FF7100]" />
            <span>العودة لقائمة المتاجر</span>
          </button>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={() => setIsCommissionModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-[#10192D] border border-[#334155] hover:border-[#FF7100] text-xs font-bold text-[#F8FAFC] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Percent className="w-3.5 h-3.5 text-[#FF7100]" />
              <span>تعديل العمولة ({commissionPct}%)</span>
            </button>

            <button
              type="button"
              disabled={busyKey === 'pause'}
              onClick={() => void handleTogglePauseStore()}
              className="px-3.5 py-2 rounded-xl bg-[#10192D] border border-[#334155] hover:border-[#FF7100] text-xs font-bold text-[#F8FAFC] inline-flex items-center gap-1.5 cursor-pointer"
            >
              {store.isActive ? (
                <PauseCircle className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <PlayCircle className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>
                {store.isActive ? 'إيقاف مؤقت' : 'إعادة تفعيل المتجر'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsExceptionModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-[#10192D] border border-amber-700/60 hover:border-[#FF7100] text-xs font-bold text-amber-300 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>تسجيل استثناء مالي</span>
            </button>

            <button
              type="button"
              disabled={busyKey === 'suspend'}
              onClick={() => void handleToggleSuspendPartnership()}
              className={`px-3.5 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                store.suspended
                  ? 'bg-emerald-950/50 border-emerald-700 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-800/70 text-rose-300'
              }`}
            >
              <Ban className="w-3.5 h-3.5" />
              <span>
                {store.suspended ? 'رفع إيقاف الشراكة' : 'إيقاف الشراكة'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 rounded-xl bg-[#FF7100] hover:bg-[#E66600] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة كشف الحساب</span>
            </button>
          </div>
        </div>

        {/* Store Header Identity */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-[#334155]">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-16 h-16 rounded-2xl overflow-hidden border border-[#334155] bg-[#10192D] shrink-0">
              <ResilientImage
                src={store.imageUrl || ''}
                alt={store.name}
                fallbackTitle={store.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold text-[#F8FAFC] truncate">
                  {store.name}
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${
                    store.suspended
                      ? 'bg-rose-950/60 border-rose-800 text-rose-300'
                      : store.isActive
                      ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                      : 'bg-amber-950/60 border-amber-800 text-amber-300'
                  }`}
                >
                  {statusText}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#94A3B8]">
                <span dir="ltr" className="font-mono text-[#F8FAFC]">
                  #{store.id.slice(0, 10)}
                </span>{' '}
                · {store.category} · {store.neighborhood} · التوصيل:{' '}
                <span className="font-mono font-bold text-[#FF7100] tabular-nums">
                  {Math.max(MIN_COURIER_DELIVERY_FEE_EGP, store.deliveryFee)} ج.م
                </span>
              </p>
              <p className="text-xs text-[#94A3B8]">
                المالك: <span className="text-[#F8FAFC] font-semibold">{store.ownerName || 'غير مسجل'}</span>
                {store.phone ? (
                  <>
                    {' '}
                    · هاتف:{' '}
                    <span dir="ltr" className="font-mono text-[#F8FAFC]">
                      {store.phone}
                    </span>
                  </>
                ) : null}
                {store.commercialRegisterNumber ? (
                  <>
                    {' '}
                    · سجل تجاري:{' '}
                    <span dir="ltr" className="font-mono text-[#F8FAFC]">
                      {store.commercialRegisterNumber}
                    </span>
                  </>
                ) : null}
                {store.taxCertificateNumber ? (
                  <>
                    {' '}
                    · رقم ضريبي:{' '}
                    <span dir="ltr" className="font-mono text-[#F8FAFC]">
                      {store.taxCertificateNumber}
                    </span>
                  </>
                ) : null}
              </p>
            </div>
          </div>

          <div className="px-4 py-3 rounded-2xl bg-[#10192D] border border-[#334155] text-xs space-y-1 shrink-0">
            <p className="text-[#94A3B8] font-semibold">نظام توزيع المنتجات المعتمد</p>
            <p className="font-mono font-bold text-sm tabular-nums text-[#F8FAFC]">
              صافي المطعم <span className="text-emerald-400">{storeSharePct}%</span> · إدكاوي{' '}
              <span className="text-[#FF7100]">{commissionPct}%</span>
            </p>
            <p className="text-[11px] text-[#94A3B8]">
              رسوم التوصيل 100% للمندوب (لا تُحسب في العمولة)
            </p>
          </div>
        </div>
      </div>

      {/* Status Banners */}
      {bannerError && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs sm:text-sm font-bold flex items-center justify-between gap-2"
        >
          <span>{bannerError}</span>
          <button
            type="button"
            onClick={() => setBannerError(null)}
            className="text-xs underline cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      )}
      {bannerSuccess && (
        <div
          role="status"
          className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-800 text-emerald-200 text-xs sm:text-sm font-bold flex items-center justify-between gap-2"
        >
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{bannerSuccess}</span>
          </span>
          <button
            type="button"
            onClick={() => setBannerSuccess(null)}
            className="text-xs underline cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* 4 Store KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-5 space-y-1.5">
          <p className="text-xs font-bold text-[#94A3B8]">
            إجمالي مبيعات المنتجات
          </p>
          <p className="font-mono text-2xl font-bold tabular-nums text-[#F8FAFC]">
            {storeStats.grossProductsSales}{' '}
            <span className="text-xs font-sans text-[#94A3B8]">ج.م</span>
          </p>
          <p className="text-[11px] text-[#94A3B8] tabular-nums">
            من {deliveredOrders.length} طلب مكتمل (بدون رسوم التوصيل)
          </p>
        </div>

        <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-5 space-y-1.5">
          <p className="text-xs font-bold text-[#94A3B8]">
            عمولة إدكاوي ({commissionPct}%)
          </p>
          <p className="font-mono text-2xl font-bold tabular-nums text-[#FF7100]">
            {storeStats.totalCommission}{' '}
            <span className="text-xs font-sans text-[#94A3B8]">ج.م</span>
          </p>
          <p className="text-[11px] text-[#94A3B8]">
            إيراد إدكاوي من منتجات المتجر
          </p>
        </div>

        <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-5 space-y-1.5">
          <p className="text-xs font-bold text-[#94A3B8]">
            صافي مستحقات المطعم ({storeSharePct}%)
          </p>
          <p className="font-mono text-2xl font-bold tabular-nums text-emerald-400">
            {storeStats.totalStoreNet}{' '}
            <span className="text-xs font-sans text-[#94A3B8]">ج.م</span>
          </p>
          <p className="text-[11px] text-[#94A3B8] tabular-nums">
            مدفوع: {storeStats.paidSettlementsTotal} ج.م · غير مسوّى:{' '}
            {storeStats.unsettledStoreNet} ج.م
          </p>
        </div>

        <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-5 space-y-1.5">
          <p className="text-xs font-bold text-[#94A3B8]">
            الطلبات والأصناف والشكاوى
          </p>
          <p className="font-mono text-2xl font-bold tabular-nums text-[#F8FAFC]">
            {storeOrders.length}{' '}
            <span className="text-xs font-sans text-[#94A3B8]">طلب</span>
          </p>
          <p className="text-[11px] text-[#94A3B8] tabular-nums">
            أصناف: {storeProducts.length} · نزاعات معلقة:{' '}
            {
              storeExceptions.filter((e) => e.status === 'pending_review')
                .length
            }
          </p>
        </div>
      </div>

      {/* 7 Separate Navigation Tabs */}
      <div
        role="tablist"
        aria-label="أقسام ملف المطعم"
        className="flex flex-wrap items-center gap-2 bg-[#1E293B] border border-[#334155] rounded-2xl p-2 print:hidden"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
              activeTab === t.id
                ? 'bg-[#FF7100] text-white'
                : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#10192D]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.16 }}
        >
          {/* 1. OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-6 space-y-4">
                  <h3 className="text-base font-bold text-[#F8FAFC] flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-[#FF7100]" />
                    <span>الملخص المالي للمطعم وتوزيع الأرباح</span>
                  </h3>

                  <div className="space-y-3 text-xs sm:text-sm">
                    <div className="flex items-center justify-between py-2 border-b border-[#334155]">
                      <span className="text-[#94A3B8]">
                        إجمالي قيمة المنتجات المكتملة
                      </span>
                      <span className="font-mono font-bold tabular-nums">
                        {storeStats.grossProductsSales} ج.م
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-[#334155]">
                      <span className="text-[#94A3B8]">
                        عمولة إدكاوي ({commissionPct}%)
                      </span>
                      <span className="font-mono font-bold tabular-nums text-[#FF7100]">
                        {storeStats.totalCommission} ج.م
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-[#334155]">
                      <span className="text-[#94A3B8]">
                        صافي حصة المطعم ({storeSharePct}%)
                      </span>
                      <span className="font-mono font-bold tabular-nums text-emerald-400">
                        {storeStats.totalStoreNet} ج.م
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-[#334155]">
                      <span className="text-[#94A3B8]">
                        إجمالي التسويات المصروفة للمطعم
                      </span>
                      <span className="font-mono font-bold tabular-nums text-[#F8FAFC]">
                        {storeStats.paidSettlementsTotal} ج.م
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-[#94A3B8]">
                        رصيد طلبات غير مسوّى (بانتظار إقفال 12 منتصف الليل)
                      </span>
                      <span className="font-mono font-bold tabular-nums text-amber-300">
                        {storeStats.unsettledStoreNet} ج.م
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="button"
                      disabled={busyKey === 'gen_settlement'}
                      onClick={() => void handleGenerateStoreSettlementNow()}
                      className="px-4 py-2.5 rounded-xl bg-[#FF7100] hover:bg-[#E66600] text-white text-xs font-bold cursor-pointer"
                    >
                      {busyKey === 'gen_settlement'
                        ? 'جارٍ الإصدار...'
                        : 'إنشاء تسوية اليوم الآن'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('settlements')}
                      className="px-4 py-2.5 rounded-xl bg-[#10192D] border border-[#334155] hover:border-[#FF7100] text-[#F8FAFC] text-xs font-bold cursor-pointer"
                    >
                      عرض كل التسويات
                    </button>
                  </div>
                </div>

                <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-6 space-y-4">
                  <h3 className="text-base font-bold text-[#F8FAFC] flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-[#FF7100]" />
                    <span>أحدث طلبات المتجر</span>
                  </h3>
                  {storeOrders.length === 0 ? (
                    <p className="text-xs text-[#94A3B8]">
                      لا توجد طلبات مسجلة لهذا المتجر حتى الآن.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#334155]">
                      {storeOrders.slice(0, 5).map((o) => {
                        const snap = getOrderFinancialSnapshot(o, commissionRate);
                        return (
                          <div
                            key={o.id}
                            className="py-3 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-[#F8FAFC] truncate">
                                <span dir="ltr" className="font-mono">
                                  #{o.id.slice(0, 8)}
                                </span>{' '}
                                · {o.customerName}
                              </p>
                              <p className="text-[#94A3B8] truncate">
                                {getOrderStatusLabel(o.status)} · منتجات:{' '}
                                {o.subtotal} ج.م
                              </p>
                            </div>
                            <div className="text-left shrink-0 font-mono tabular-nums">
                              <p className="font-bold text-emerald-400">
                                {snap.restaurantNet} ج.م صافي
                              </p>
                              <p className="text-[11px] text-[#94A3B8]">
                                عمولة: {snap.commissionAmount} ج.م
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 2. STORE INFO */}
          {activeTab === 'info' && (
            <form
              onSubmit={handleSaveInfoSubmit}
              className="bg-[#1E293B] border border-[#334155] rounded-2xl p-6 space-y-5"
            >
              <h3 className="text-base font-bold text-[#F8FAFC]">
                تعديل بيانات المتجر والتشغيل والضرائب
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1.5">
                    اسم المتجر / المطعم
                  </label>
                  <input
                    type="text"
                    value={infoName}
                    onChange={(e) => setInfoName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#10192D] border border-[#334155] text-sm text-[#F8FAFC]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1.5">
                    التصنيف
                  </label>
                  <select
                    value={infoCategory}
                    onChange={(e) =>
                      setInfoCategory(e.target.value as StoreCategory)
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#10192D] border border-[#334155] text-sm text-[#F8FAFC]"
                  >
                    {STORE_CATEGORIES_LIST.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1.5">
                    المنطقة في إدكو
                  </label>
                  <select
                    value={infoNeighborhood}
                    onChange={(e) => setInfoNeighborhood(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#10192D] border border-[#334155] text-sm text-[#F8FAFC]"
                  >
                    {EDKU_NEIGHBORHOODS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1.5">
                    اسم المالك / المدير المسؤول
                  </label>
                  <input
                    type="text"
                    value={infoOwnerName}
                    onChange={(e) => setInfoOwnerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#10192D] border border-[#334155] text-sm text-[#F8FAFC]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1.5">
                    رقم الهاتف للتواصل
                  </label>
                  <input
                    type="tel"
                    dir="ltr"
                    value={infoPhone}
                    onChange={(e) => setInfoPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#10192D] border border-[#334155] text-sm font-mono text-[#F8FAFC] text-left"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1.5">
                    رسوم التوصيل (الحد الأدنى {MIN_COURIER_DELIVERY_FEE_EGP} ج.م)
                  </label>
                  <input
                    type="number"
                    min={MIN_COURIER_DELIVERY_FEE_EGP}
                    max={250}
                    dir="ltr"
                    value={infoDeliveryFee}
                    onChange={(e) => setInfoDeliveryFee(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#10192D] border border-[#334155] text-sm font-mono tabular-nums text-[#F8FAFC] text-left"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1.5">
                    مدة التوصيل المتوقعة (دقيقة)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={120}
                    dir="ltr"
                    value={infoDeliveryTime}
                    onChange={(e) => setInfoDeliveryTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#10192D] border border-[#334155] text-sm font-mono tabular-nums text-[#F8FAFC] text-left"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1.5">
                    مدة التحضير بالمطعم (دقيقة)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    dir="ltr"
                    value={infoPrepTime}
                    onChange={(e) => setInfoPrepTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#10192D] border border-[#334155] text-sm font-mono tabular-nums text-[#F8FAFC] text-left"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1.5">
                    الحد الأدنى للطلب (ج.م)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={5000}
                    dir="ltr"
                    value={infoMinOrder}
                    onChange={(e) => setInfoMinOrder(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#10192D] border border-[#334155] text-sm font-mono tabular-nums text-[#F8FAFC] text-left"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1.5">
                    رقم السجل التجاري
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={infoCrNumber}
                    onChange={(e) => setInfoCrNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#10192D] border border-[#334155] text-sm font-mono text-[#F8FAFC] text-left"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1.5">
                    الرقم الضريبي / البطاقة الضريبية
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={infoTaxNumber}
                    onChange={(e) => setInfoTaxNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#10192D] border border-[#334155] text-sm font-mono text-[#F8FAFC] text-left"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1.5">
                    سبب الإيقاف (إن وجد)
                  </label>
                  <input
                    type="text"
                    value={infoPausedReason}
                    onChange={(e) => setInfoPausedReason(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#10192D] border border-[#334155] text-sm text-[#F8FAFC]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#94A3B8] mb-1.5">
                  وصف المتجر للعملاء
                </label>
                <textarea
                  rows={2}
                  value={infoDescription}
                  onChange={(e) => setInfoDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#10192D] border border-[#334155] text-sm text-[#F8FAFC]"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={busyKey === 'save_info'}
                  className="px-6 py-2.5 rounded-xl bg-[#FF7100] hover:bg-[#E66600] text-white text-sm font-bold cursor-pointer"
                >
                  {busyKey === 'save_info'
                    ? 'جارٍ الحفظ...'
                    : 'حفظ كافة التعديلات'}
                </button>
              </div>
            </form>
          )}

          {/* 3. ORDERS */}
          {activeTab === 'orders' && (
            <div className="bg-[#1E293B] border border-[#334155] rounded-2xl overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-[#334155] flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-base font-bold text-[#F8FAFC]">
                  طلبات المتجر وتوزيع القيم المالية ({filteredOrders.length})
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      ['all', 'الكل'],
                      ['delivered', 'المكتملة'],
                      ['active', 'الجارية'],
                      ['cancelled', 'الملغاة'],
                    ] as const
                  ).map(([val, lbl]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setOrderFilter(val)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                        orderFilter === val
                          ? 'bg-[#FF7100] text-white'
                          : 'bg-[#10192D] border border-[#334155] text-[#94A3B8]'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {filteredOrders.length === 0 ? (
                <div className="p-10 text-center text-sm text-[#94A3B8]">
                  لا توجد طلبات مطابقة لهذا الفلتر.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-[#334155] bg-[#10192D] text-xs font-bold text-[#94A3B8]">
                        <th className="py-3 px-4">الطلب</th>
                        <th className="py-3 px-4">العميل</th>
                        <th className="py-3 px-4">المنتجات</th>
                        <th className="py-3 px-4">عمولة إدكاوي</th>
                        <th className="py-3 px-4">صافي المطعم</th>
                        <th className="py-3 px-4">التوصيل للمندوب</th>
                        <th className="py-3 px-4">الحالة والتسوية</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#334155]">
                      {filteredOrders.map((o) => {
                        const snap = getOrderFinancialSnapshot(o, commissionRate);
                        return (
                          <tr key={o.id} className="hover:bg-[#10192D]/50">
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span dir="ltr" className="font-mono font-bold">
                                #{o.id.slice(0, 8)}
                              </span>
                              <div className="text-[11px] text-[#94A3B8] font-mono tabular-nums">
                                {getCairoDateKey(o.createdAtIso)}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-bold text-[#F8FAFC]">
                                {o.customerName}
                              </p>
                              <p className="text-[11px] text-[#94A3B8]">
                                {o.deliveryNeighborhood}
                              </p>
                            </td>
                            <td className="py-3 px-4 font-mono tabular-nums font-bold">
                              {o.subtotal} ج.م
                            </td>
                            <td className="py-3 px-4 font-mono tabular-nums font-bold text-[#FF7100]">
                              {snap.commissionAmount} ج.م
                            </td>
                            <td className="py-3 px-4 font-mono tabular-nums font-bold text-emerald-400">
                              {snap.restaurantNet} ج.م
                            </td>
                            <td className="py-3 px-4 font-mono tabular-nums text-[#94A3B8]">
                              {snap.courierDeliveryCompensation} ج.م
                            </td>
                            <td className="py-3 px-4 text-xs">
                              <span className="font-bold text-[#F8FAFC]">
                                {getOrderStatusLabel(o.status)}
                              </span>
                              <div className="text-[11px] text-[#94A3B8]">
                                {o.isFinancialSettled
                                  ? 'مسوّى ومدفوع'
                                  : o.settlementId
                                  ? 'ضمن دفعة قيد السداد'
                                  : 'لم يُسوَّ بعد'}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 4. FINANCE LEDGER & EXCEPTIONS */}
          {activeTab === 'finance' && (
            <div className="space-y-6">
              <div className="bg-[#1E293B] border border-[#334155] rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-[#334155]">
                  <h3 className="text-base font-bold text-[#F8FAFC]">
                    دفتر القيود المالية للمتجر ({storeTransactions.length})
                  </h3>
                </div>
                {storeTransactions.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#94A3B8]">
                    لا توجد قيود محاسبية مسجلة لهذا المتجر حتى الآن.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b border-[#334155] bg-[#10192D] text-xs font-bold text-[#94A3B8]">
                          <th className="py-3 px-4">النوع</th>
                          <th className="py-3 px-4">المبلغ</th>
                          <th className="py-3 px-4">الطلب / المرجع</th>
                          <th className="py-3 px-4">البيان</th>
                          <th className="py-3 px-4">التاريخ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#334155]">
                        {storeTransactions.map((tx) => (
                          <tr key={tx.id}>
                            <td className="py-3 px-4 font-bold text-[#FF7100] whitespace-nowrap">
                              {tx.type}
                            </td>
                            <td className="py-3 px-4 font-mono tabular-nums font-bold">
                              {tx.amount} ج.م
                            </td>
                            <td dir="ltr" className="py-3 px-4 font-mono text-xs text-[#94A3B8] text-right">
                              {tx.orderId ? `#${tx.orderId.slice(0, 8)}` : tx.settlementId || '—'}
                            </td>
                            <td className="py-3 px-4 text-[#F8FAFC]">
                              {tx.notes}
                            </td>
                            <td dir="ltr" className="py-3 px-4 font-mono text-xs text-[#94A3B8] text-right whitespace-nowrap">
                              {tx.createdAtIso.slice(0, 16).replace('T', ' ')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-[#F8FAFC]">
                    الاستثناءات والنزاعات المرتبطة بالمتجر ({storeExceptions.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsExceptionModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-[#FF7100] text-white text-xs font-bold cursor-pointer"
                  >
                    + تسجيل استثناء جديد
                  </button>
                </div>

                {storeExceptions.length === 0 ? (
                  <p className="text-xs text-[#94A3B8]">
                    لا توجد أي نزاعات أو استثناءات مالية على هذا المتجر.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {storeExceptions.map((ex) => (
                      <div
                        key={ex.id}
                        className="p-4 rounded-xl bg-[#10192D] border border-[#334155] flex flex-wrap items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <p className="font-bold text-[#F8FAFC]">
                            {getFinancialExceptionTypeLabelAr(ex.exceptionType)} ·{' '}
                            <span className="font-mono text-[#FF7100] tabular-nums">
                              {ex.disputedAmount} ج.م
                            </span>
                          </p>
                          <p className="text-[#94A3B8]">{ex.description}</p>
                          {ex.adminResolutionNote && (
                            <p className="text-emerald-400">
                              قرار الإدارة: {ex.adminResolutionNote}
                            </p>
                          )}
                        </div>
                        <span className="px-2.5 py-1 rounded-lg bg-[#1E293B] border border-[#334155] font-bold">
                          {ex.status === 'pending_review'
                            ? 'قيد المراجعة اليدوية'
                            : ex.status === 'resolved_no_deduction'
                            ? 'مغلق بدون خصم'
                            : 'تمت التسوية بتعديل'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 5. SETTLEMENTS */}
          {activeTab === 'settlements' && (
            <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[#F8FAFC]">
                    التسويات اليومية للمتجر (إغلاق 12 منتصف الليل بتوقيت القاهرة)
                  </h3>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    تُحتسب تلقائياً بصافي {storeSharePct}% للمتجر و{commissionPct}% عمولة إدكاوي من قيمة المنتجات فقط.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    dir="ltr"
                    value={settlementTargetDate}
                    onChange={(e) => setSettlementTargetDate(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-[#10192D] border border-[#334155] text-xs font-mono text-[#F8FAFC]"
                  />
                  <button
                    type="button"
                    disabled={busyKey === 'gen_settlement'}
                    onClick={() => void handleGenerateStoreSettlementNow()}
                    className="px-4 py-2 rounded-xl bg-[#FF7100] hover:bg-[#E66600] text-white text-xs font-bold cursor-pointer"
                  >
                    {busyKey === 'gen_settlement'
                      ? 'جارٍ الإنشاء...'
                      : 'إنشاء تسوية يومية الآن'}
                  </button>
                </div>
              </div>

              {storeSettlements.length === 0 ? (
                <div className="py-10 text-center text-xs text-[#94A3B8]">
                  لم يتم إصدار دفعات تسوية يومية لهذا المتجر بعد.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-[#334155] bg-[#10192D] text-xs font-bold text-[#94A3B8]">
                        <th className="py-3 px-4">التاريخ</th>
                        <th className="py-3 px-4">الطلبات</th>
                        <th className="py-3 px-4">إجمالي المنتجات</th>
                        <th className="py-3 px-4">عمولة إدكاوي</th>
                        <th className="py-3 px-4">صافي المطعم</th>
                        <th className="py-3 px-4">الحالة</th>
                        <th className="py-3 px-4 text-left">الإجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#334155]">
                      {storeSettlements.map((s) => (
                        <tr key={s.id}>
                          <td dir="ltr" className="py-3 px-4 font-mono text-right">
                            {s.settlementDateKey}
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums">
                            {s.ordersCount}
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums">
                            {s.grossProductsSales} ج.م
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums text-[#FF7100]">
                            {s.edkawyCommission} ج.م
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums font-bold text-emerald-400">
                            {s.restaurantNetPayable} ج.م
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-bold ${
                                s.status === 'paid'
                                  ? 'bg-emerald-950/60 text-emerald-300'
                                  : 'bg-amber-950/60 text-amber-300'
                              }`}
                            >
                              {getSettlementStatusLabelAr(s.status)}
                            </span>
                            {s.transferReference && (
                              <p className="text-[11px] font-mono text-[#94A3B8] mt-0.5">
                                {s.transferReference}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-4 text-left">
                            {s.status !== 'paid' ? (
                              <button
                                type="button"
                                onClick={() => setPayingSettlement(s)}
                                className="px-3 py-1.5 rounded-lg bg-[#FF7100] hover:bg-[#E66600] text-white text-xs font-bold cursor-pointer"
                              >
                                تأكيد السداد
                              </button>
                            ) : (
                              <span className="text-xs text-[#94A3B8]">
                                {s.paymentMethod
                                  ? PAYMENT_METHOD_LABELS[s.paymentMethod]
                                  : 'تم الدفع'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 6. PRODUCTS */}
          {activeTab === 'products' && (
            <div className="bg-[#1E293B] border border-[#334155] rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-[#334155]">
                <h3 className="text-base font-bold text-[#F8FAFC]">
                  قائمة منتجات وأصناف المتجر ({storeProducts.length})
                </h3>
              </div>
              {storeProducts.length === 0 ? (
                <div className="p-10 text-center text-xs text-[#94A3B8]">
                  لا توجد أصناف مضافة في هذا المتجر حالياً.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-[#334155] bg-[#10192D] text-xs font-bold text-[#94A3B8]">
                        <th className="py-3 px-4">المنتج</th>
                        <th className="py-3 px-4">التصنيف</th>
                        <th className="py-3 px-4">السعر</th>
                        <th className="py-3 px-4">المخزون</th>
                        <th className="py-3 px-4">التوفر</th>
                        {onDeleteProductByAdmin && (
                          <th className="py-3 px-4 text-left">إجراء</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#334155]">
                      {storeProducts.map((p) => (
                        <tr key={p.id}>
                          <td className="py-3 px-4 font-bold text-[#F8FAFC]">
                            {p.name}
                          </td>
                          <td className="py-3 px-4 text-[#94A3B8]">
                            {p.category}
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums font-bold">
                            {p.price} ج.م
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums">
                            {p.stockQuantity ?? 'غير محدد'}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={
                                p.isAvailable
                                  ? 'text-emerald-400 font-bold'
                                  : 'text-rose-400 font-bold'
                              }
                            >
                              {p.isAvailable ? 'متاح' : 'غير متاح'}
                            </span>
                          </td>
                          {onDeleteProductByAdmin && (
                            <td className="py-3 px-4 text-left">
                              <button
                                type="button"
                                onClick={() =>
                                  void onDeleteProductByAdmin(p, store.name)
                                }
                                className="p-2 rounded-lg bg-[#10192D] border border-rose-800/60 text-rose-400 hover:bg-rose-950/50 cursor-pointer"
                                title="حذف الصنف"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 7. ACTIVITY LOGS */}
          {activeTab === 'activity' && (
            <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-bold text-[#F8FAFC]">
                سجل العمليات والنشاط الإداري للمتجر ({storeActivityLogs.length})
              </h3>
              {storeActivityLogs.length === 0 ? (
                <p className="text-xs text-[#94A3B8]">
                  لا توجد عمليات إدارية مسجلة لهذا المتجر حتى الآن.
                </p>
              ) : (
                <div className="divide-y divide-[#334155]">
                  {storeActivityLogs.map((log) => (
                    <div
                      key={log.id}
                      className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <p className="font-bold text-[#F8FAFC]">
                          {getAuditActionLabelAr(log.actionType)}
                        </p>
                        <p className="text-[#94A3B8]">{log.details}</p>
                      </div>
                      <div className="text-left text-[#94A3B8] font-mono tabular-nums">
                        <p>{log.adminName}</p>
                        <p>{log.createdAtIso.slice(0, 16).replace('T', ' ')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Modal: Edit Commission Rate */}
      {isCommissionModalOpen && (
        <div
          className="edkawi-modal-backdrop flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveCommission}
            className="bg-[#1E293B] border border-[#334155] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#F8FAFC]">
                تعديل نسبة عمولة إدكاوي
              </h3>
              <button
                type="button"
                onClick={() => setIsCommissionModalOpen(false)}
                className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#94A3B8]">
              تُطبق العمولة على قيمة المنتجات فقط (رسوم التوصيل لا تدخل في العمولة). الافتراضي في سياسة إدكاوي هو 14%.
            </p>
            <div>
              <label className="block text-xs font-bold text-[#F8FAFC] mb-1.5">
                نسبة عمولة إدكاوي (%)
              </label>
              <input
                type="number"
                min={0}
                max={50}
                step={0.5}
                dir="ltr"
                value={commissionInputPct}
                onChange={(e) => setCommissionInputPct(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#10192D] border border-[#334155] text-base font-mono font-bold text-[#FF7100] text-center"
                required
              />
              <p className="text-xs text-emerald-400 mt-2 font-bold text-center">
                نسبة صافي المتجر تلقائياً:{' '}
                {Math.max(0, 100 - Number(commissionInputPct || 0))}%
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCommissionModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#334155] text-xs font-bold text-[#94A3B8] cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={busyKey === 'commission'}
                className="px-5 py-2 rounded-xl bg-[#FF7100] hover:bg-[#E66600] text-white text-xs font-bold cursor-pointer"
              >
                {busyKey === 'commission' ? 'جارٍ الحفظ...' : 'حفظ النسبة'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Log Financial Exception */}
      {isExceptionModalOpen && (
        <div
          className="edkawi-modal-backdrop flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleCreateStoreException}
            className="bg-[#1E293B] border border-[#334155] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#F8FAFC]">
                تسجيل استثناء أو نزاع مالي للمتجر
              </h3>
              <button
                type="button"
                onClick={() => setIsExceptionModalOpen(false)}
                className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                  نوع الاستثناء
                </label>
                <select
                  value={excType}
                  onChange={(e) =>
                    setExcType(e.target.value as FinancialExceptionType)
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[#10192D] border border-[#334155] text-xs text-[#F8FAFC]"
                >
                  {EXCEPTION_TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {getFinancialExceptionTypeLabelAr(t)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                  المبلغ المتنازع عليه (ج.م)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  dir="ltr"
                  value={excAmount}
                  onChange={(e) => setExcAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#10192D] border border-[#334155] text-xs font-mono text-[#F8FAFC] text-left"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                  الطرف المعني
                </label>
                <select
                  value={excParty}
                  onChange={(e) =>
                    setExcParty(e.target.value as ExceptionResponsibleParty)
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[#10192D] border border-[#334155] text-xs text-[#F8FAFC]"
                >
                  <option value="store">المطعم / المتجر</option>
                  <option value="courier">المندوب</option>
                  <option value="customer">العميل</option>
                  <option value="edkawy">إدكاوي</option>
                  <option value="shared">مشترك</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                  رقم الطلب (اختياري)
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={excOrderId}
                  onChange={(e) => setExcOrderId(e.target.value)}
                  placeholder="Order ID"
                  className="w-full px-3 py-2 rounded-xl bg-[#10192D] border border-[#334155] text-xs font-mono text-[#F8FAFC] text-left"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-amber-300 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={excHold}
                onChange={(e) => setExcHold(e.target.checked)}
              />
              <span>تعليق تسوية هذا الطلب مؤقتاً لحين مراجعة الإدارة</span>
            </label>
            <div>
              <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                وصف التفاصيل *
              </label>
              <textarea
                rows={3}
                value={excDesc}
                onChange={(e) => setExcDesc(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-[#10192D] border border-[#334155] text-xs text-[#F8FAFC]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsExceptionModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#334155] text-xs font-bold text-[#94A3B8] cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={busyKey === 'exception'}
                className="px-5 py-2 rounded-xl bg-[#FF7100] text-white text-xs font-bold cursor-pointer"
              >
                {busyKey === 'exception' ? 'جارٍ التسجيل...' : 'تسجيل الاستثناء'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Mark Settlement Paid */}
      {payingSettlement && (
        <div
          className="edkawi-modal-backdrop flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleConfirmPaySettlement}
            className="bg-[#1E293B] border border-[#334155] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#F8FAFC]">
                تأكيد صرف تسوية المتجر
              </h3>
              <button
                type="button"
                onClick={() => setPayingSettlement(null)}
                className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[#10192D] border border-[#334155] text-xs space-y-1">
              <p className="font-bold text-[#F8FAFC]">
                {payingSettlement.storeName} · {payingSettlement.settlementDateKey}
              </p>
              <p className="font-mono font-bold text-lg text-emerald-400 tabular-nums">
                صافي المستحق للصرف: {payingSettlement.restaurantNetPayable} ج.م
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                طريقة التحويل / الصرف
              </label>
              <select
                value={payMethod}
                onChange={(e) =>
                  setPayMethod(e.target.value as RestaurantSettlementMethod)
                }
                className="w-full px-3 py-2 rounded-xl bg-[#10192D] border border-[#334155] text-xs text-[#F8FAFC]"
              >
                {(Object.keys(PAYMENT_METHOD_LABELS) as RestaurantSettlementMethod[]).map(
                  (m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHOD_LABELS[m]}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                رقم المرجع / العملية (اختياري)
              </label>
              <input
                type="text"
                dir="ltr"
                value={payReference}
                onChange={(e) => setPayReference(e.target.value)}
                placeholder="TXN-..."
                className="w-full px-3 py-2 rounded-xl bg-[#10192D] border border-[#334155] text-xs font-mono text-[#F8FAFC] text-left"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                ملاحظات الصرف
              </label>
              <input
                type="text"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#10192D] border border-[#334155] text-xs text-[#F8FAFC]"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPayingSettlement(null)}
                className="px-4 py-2 rounded-xl border border-[#334155] text-xs font-bold text-[#94A3B8] cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={busyKey === 'pay_settlement'}
                className="px-5 py-2 rounded-xl bg-[#FF7100] text-white text-xs font-bold cursor-pointer"
              >
                {busyKey === 'pay_settlement'
                  ? 'جارٍ التأكيد...'
                  : 'تأكيد السداد وإغلاق الدفعة'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
