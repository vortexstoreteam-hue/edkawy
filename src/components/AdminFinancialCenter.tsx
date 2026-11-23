import { FormEvent, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  Banknote,
  BookOpen,
  CalendarCheck2,
  CheckCircle2,
  Landmark,
  Plus,
  Printer,
  Receipt,
  Scale,
  Search,
  Wallet,
  X,
} from 'lucide-react';
import {
  createFinancialExceptionInFirestore,
  generateDailyRestaurantSettlementsInFirestore,
  markRestaurantSettlementPaidInFirestore,
  payCourierDuesInFirestore,
  recordTreasuryHandoverInFirestore,
  resolveFinancialExceptionByAdminInFirestore,
} from '../services/edkawiFirebaseService';
import {
  CourierRecord,
  DriverWalletRecord,
  ExceptionResponsibleParty,
  FinancialExceptionRecord,
  FinancialExceptionType,
  FinancialTransactionRecord,
  FinancialTransactionType,
  OrderRecord,
  RestaurantSettlementMethod,
  RestaurantSettlementRecord,
  StoreRecord,
  TreasuryReceiptRecord,
} from '../types/edkawi';
import {
  calculateFounderFinancialKpis,
  formatAppErrorMessage,
  getCairoDateKey,
  getFinancialExceptionTypeLabelAr,
  getSettlementStatusLabelAr,
} from '../utils/orderLogic';

type FinanceCenterTab = 'treasury' | 'settlements' | 'exceptions' | 'ledger';

interface AdminFinancialCenterProps {
  orders: OrderRecord[];
  stores: StoreRecord[];
  couriers: CourierRecord[];
  driverWallets: DriverWalletRecord[];
  transactions: FinancialTransactionRecord[];
  treasuryReceipts: TreasuryReceiptRecord[];
  restaurantSettlements: RestaurantSettlementRecord[];
  financialExceptions: FinancialExceptionRecord[];
  adminUid: string;
  adminName?: string;
  onNotify?: (msg: string) => void;
}

const TX_TYPE_LABELS: Record<FinancialTransactionType, string> = {
  order_collection: 'تحصيل نقدي من عميل',
  courier_earning: 'أجر توصيل للمندوب',
  edkawy_commission: 'عمولة إدكاوي',
  restaurant_payable: 'مستحقات مطعم',
  cash_handover: 'توريد نقدية للخزينة',
  courier_payout: 'صرف مستحقات مندوب',
  restaurant_settlement: 'صرف تسوية مطعم',
  exception_adjustment: 'تسوية استثناء مالي',
};

const SETTLEMENT_METHOD_LABELS: Record<RestaurantSettlementMethod, string> = {
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

export function AdminFinancialCenter({
  orders,
  stores,
  couriers,
  driverWallets,
  transactions,
  treasuryReceipts,
  restaurantSettlements,
  financialExceptions,
  adminUid,
  adminName = 'مدير النظام',
  onNotify,
}: AdminFinancialCenterProps) {
  const [activeTab, setActiveTab] = useState<FinanceCenterTab>('treasury');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);

  // Treasury handover modal
  const [handoverTarget, setHandoverTarget] =
    useState<DriverWalletRecord | null>(null);
  const [handoverActualInput, setHandoverActualInput] = useState('');
  const [handoverPayDuesInput, setHandoverPayDuesInput] = useState('0');
  const [handoverNotesInput, setHandoverNotesInput] = useState('');

  // Courier dues payout modal
  const [payoutTarget, setPayoutTarget] =
    useState<DriverWalletRecord | null>(null);
  const [payoutAmountInput, setPayoutAmountInput] = useState('');
  const [payoutNotesInput, setPayoutNotesInput] = useState('');

  // Receipt print preview modal
  const [printingReceipt, setPrintingReceipt] =
    useState<TreasuryReceiptRecord | null>(null);

  // Daily cutoff settlements state
  const [cutoffDateKey, setCutoffDateKey] = useState(getCairoDateKey());
  const [payingSettlement, setPayingSettlement] =
    useState<RestaurantSettlementRecord | null>(null);
  const [settleMethod, setSettleMethod] =
    useState<RestaurantSettlementMethod>('vodafone_cash');
  const [settleRef, setSettleRef] = useState('');
  const [settleNotes, setSettleNotes] = useState('');

  // Exceptions state
  const [isNewExceptionOpen, setIsNewExceptionOpen] = useState(false);
  const [newExcType, setNewExcType] =
    useState<FinancialExceptionType>('customer_refused_door');
  const [newExcAmount, setNewExcAmount] = useState('0');
  const [newExcStoreId, setNewExcStoreId] = useState('');
  const [newExcCourierId, setNewExcCourierId] = useState('');
  const [newExcOrderId, setNewExcOrderId] = useState('');
  const [newExcParty, setNewExcParty] = useState<
    ExceptionResponsibleParty | ''
  >('');
  const [newExcHold, setNewExcHold] = useState(false);
  const [newExcDesc, setNewExcDesc] = useState('');

  // Resolve Exception modal
  const [resolvingException, setResolvingException] =
    useState<FinancialExceptionRecord | null>(null);
  const [resolveDecision, setResolveDecision] = useState<
    'resolved_no_deduction' | 'resolved_with_adjustment'
  >('resolved_no_deduction');
  const [resolveParty, setResolveParty] =
    useState<ExceptionResponsibleParty>('edkawy');
  const [resolveAdjustedAmount, setResolveAdjustedAmount] = useState('0');
  const [resolveNote, setResolveNote] = useState('');

  // Ledger filters
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<
    FinancialTransactionType | 'all'
  >('all');
  const [ledgerSearch, setLedgerSearch] = useState('');

  const kpis = useMemo(
    () =>
      calculateFounderFinancialKpis({
        orders,
        stores,
        wallets: driverWallets,
        transactions,
        receipts: treasuryReceipts,
        settlements: restaurantSettlements,
        exceptions: financialExceptions,
      }),
    [
      orders,
      stores,
      driverWallets,
      transactions,
      treasuryReceipts,
      restaurantSettlements,
      financialExceptions,
    ]
  );

  const totalCouriersPaid = useMemo(
    () =>
      Number(
        driverWallets
          .reduce((sum, w) => sum + Math.max(0, Number(w.totalDuesPaid || 0)), 0)
          .toFixed(2)
      ),
    [driverWallets]
  );

  const totalRestaurantsGrossPayable = useMemo(
    () =>
      Number(
        (kpis.unpaidStorePayables + kpis.paidStoreSettlements).toFixed(2)
      ),
    [kpis.unpaidStorePayables, kpis.paidStoreSettlements]
  );

  const totalCollectedFromCustomers = useMemo(
    () =>
      Number((kpis.totalStoreSales + kpis.totalDeliveryFees).toFixed(2)),
    [kpis.totalStoreSales, kpis.totalDeliveryFees]
  );

  const freeDeliveryFundedEgp = useMemo(
    () =>
      Number(
        orders
          .filter(
            (o) =>
              !o.isTestSimulation &&
              o.status === 'delivered' &&
              o.freeDeliveryFundedByEdkawy
          )
          .reduce(
            (sum, o) => sum + Math.max(15, Number(o.courierDeliveryCompensation ?? 15)),
            0
          )
          .toFixed(2)
      ),
    [orders]
  );

  const filteredLedger = useMemo(() => {
    const q = ledgerSearch.trim().toLowerCase();
    return transactions.filter((t) => {
      if (t.isTestSimulation) return false;
      if (ledgerTypeFilter !== 'all' && t.type !== ledgerTypeFilter) return false;
      if (!q) return true;
      return (
        t.id.toLowerCase().includes(q) ||
        (t.orderId ?? '').toLowerCase().includes(q) ||
        (t.storeName ?? '').toLowerCase().includes(q) ||
        (t.courierName ?? '').toLowerCase().includes(q) ||
        t.notes.toLowerCase().includes(q)
      );
    });
  }, [transactions, ledgerTypeFilter, ledgerSearch]);

  function flashSuccess(msg: string) {
    setBannerError(null);
    setBannerSuccess(msg);
    onNotify?.(msg);
  }

  function openHandoverModal(wallet: DriverWalletRecord) {
    setHandoverTarget(wallet);
    setHandoverActualInput(String(wallet.collectionCustody));
    setHandoverPayDuesInput('0');
    setHandoverNotesInput('');
  }

  async function handleConfirmHandover(e: FormEvent) {
    e.preventDefault();
    if (!handoverTarget) return;
    const expectedAmount = Math.max(0, handoverTarget.collectionCustody);
    const actualAmount = Math.max(0, Number(handoverActualInput));
    const payCourierDuesAmount = Math.max(0, Number(handoverPayDuesInput));
    if (!Number.isFinite(actualAmount) || (actualAmount <= 0 && payCourierDuesAmount <= 0)) {
      setBannerError('يرجى إدخال مبلغ توريد فعلي أو مستحقات منصرفة أكبر من صفر.');
      return;
    }

    const activeOrderIds = orders
      .filter(
        (o) =>
          o.courierId === handoverTarget.courierId &&
          o.status === 'delivered' &&
          !o.treasuryReceiptId &&
          !o.isTestSimulation
      )
      .map((o) => o.id)
      .slice(0, 50);

    setBusyKey('handover');
    try {
      const res = await recordTreasuryHandoverInFirestore({
        courierId: handoverTarget.courierId,
        courierName: handoverTarget.courierName,
        expectedAmount,
        actualAmount,
        payCourierDuesAmount,
        orderIds: activeOrderIds,
        notes: handoverNotesInput.trim() || undefined,
        adminUid,
        adminName,
      });
      setHandoverTarget(null);
      flashSuccess(
        res.varianceAmount < 0
          ? `تم إصدار إيصال ${res.receiptNumber} بتوريد ${actualAmount} ج.م وتسجيل عجز ${Math.abs(res.varianceAmount)} ج.م للمراجعة اليدوية دون خصم تلقائي.`
          : `تم استلام النقدية وإصدار إيصال خزينة ${res.receiptNumber} بنجاح.`
      );
    } catch (err) {
      setBannerError(formatAppErrorMessage(err, 'تعذر تسجيل إيصال الخزينة.'));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleConfirmPayout(e: FormEvent) {
    e.preventDefault();
    if (!payoutTarget) return;
    const amount = Number(payoutAmountInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      setBannerError('يرجى إدخال مبلغ صرف صحيح.');
      return;
    }
    setBusyKey('payout');
    try {
      await payCourierDuesInFirestore({
        courierId: payoutTarget.courierId,
        courierName: payoutTarget.courierName,
        amount,
        notes: payoutNotesInput.trim() || undefined,
        adminUid,
        adminName,
      });
      setPayoutTarget(null);
      flashSuccess(
        `تم صرف ${amount} ج.م من مستحقات التوصيل للكابتن "${payoutTarget.courierName}".`
      );
    } catch (err) {
      setBannerError(formatAppErrorMessage(err, 'تعذر صرف مستحقات المندوب.'));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRunDailyCutoffNow() {
    setBusyKey('cutoff');
    try {
      const batches = await generateDailyRestaurantSettlementsInFirestore({
        targetDateKey: cutoffDateKey,
        adminUid,
        adminName,
      });
      if (batches.length === 0) {
        setBannerError(
          `لا توجد طلبات مكتملة غير مسوّاة بتاريخ ${cutoffDateKey}.`
        );
      } else {
        flashSuccess(
          `تم تشغيل إقفال 12 منتصف الليل وإصدار ${batches.length} دفعة تسوية للمطاعم.`
        );
      }
    } catch (err) {
      setBannerError(
        formatAppErrorMessage(err, 'تعذر تشغيل التسوية اليومية للمطاعم.')
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function handleConfirmMarkSettlementPaid(e: FormEvent) {
    e.preventDefault();
    if (!payingSettlement) return;
    setBusyKey('settle_paid');
    try {
      await markRestaurantSettlementPaidInFirestore({
        settlementId: payingSettlement.id,
        paymentMethod: settleMethod,
        transferReference: settleRef.trim() || undefined,
        notes: settleNotes.trim() || undefined,
        adminUid,
        adminName,
      });
      setPayingSettlement(null);
      setSettleRef('');
      setSettleNotes('');
      flashSuccess(
        `تم سداد تسوية "${payingSettlement.storeName}" بمبلغ ${payingSettlement.restaurantNetPayable} ج.م.`
      );
    } catch (err) {
      setBannerError(formatAppErrorMessage(err, 'تعذر تسجيل السداد.'));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleCreateException(e: FormEvent) {
    e.preventDefault();
    if (newExcDesc.trim().length < 4) {
      setBannerError('يرجى كتابة وصف واضح للحالة الاستثنائية.');
      return;
    }
    const store = stores.find((s) => s.id === newExcStoreId);
    const courier = couriers.find((c) => c.id === newExcCourierId);
    setBusyKey('new_exc');
    try {
      await createFinancialExceptionInFirestore({
        exceptionType: newExcType,
        disputedAmount: Math.max(0, Number(newExcAmount)),
        description: newExcDesc.trim(),
        responsibleParty: newExcParty || undefined,
        holdSettlement: newExcHold,
        orderId: newExcOrderId.trim() || undefined,
        storeId: store?.id,
        storeOwnerId: store?.ownerUid,
        storeName: store?.name,
        courierId: courier?.id,
        courierName: courier?.name,
        actorUid: adminUid,
      });
      setIsNewExceptionOpen(false);
      setNewExcDesc('');
      setNewExcAmount('0');
      setNewExcOrderId('');
      setNewExcHold(false);
      flashSuccess('تم تسجيل الاستثناء المالي في قائمة المراجعة اليدوية.');
    } catch (err) {
      setBannerError(formatAppErrorMessage(err, 'تعذر تسجيل الاستثناء.'));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleConfirmResolveException(e: FormEvent) {
    e.preventDefault();
    if (!resolvingException) return;
    if (resolveNote.trim().length < 3) {
      setBannerError('يرجى كتابة سبب وقرار المراجعة اليدوية.');
      return;
    }
    setBusyKey('resolve_exc');
    try {
      await resolveFinancialExceptionByAdminInFirestore({
        exceptionId: resolvingException.id,
        decision: resolveDecision,
        responsibleParty: resolveParty,
        adjustedAmount:
          resolveDecision === 'resolved_with_adjustment'
            ? Math.max(0, Number(resolveAdjustedAmount))
            : 0,
        resolutionNote: resolveNote.trim(),
        adminUid,
        adminName,
      });
      setResolvingException(null);
      setResolveNote('');
      setResolveAdjustedAmount('0');
      flashSuccess('تم اعتماد قرار المراجعة اليدوية وإغلاق الحالة الاستثنائية.');
    } catch (err) {
      setBannerError(formatAppErrorMessage(err, 'تعذر إغلاق الحالة الاستثنائية.'));
    } finally {
      setBusyKey(null);
    }
  }

  const handoverVariance = handoverTarget
    ? Number((Number(handoverActualInput || 0) - handoverTarget.collectionCustody).toFixed(2))
    : 0;

  return (
    <div className="space-y-6 text-[#F8FAFC]">
      {/* Banners */}
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

      {/* 9 Founder KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-5 space-y-1">
          <p className="text-xs font-bold text-[#94A3B8]">
            1. إجمالي مبيعات المنتجات
          </p>
          <p className="font-mono text-2xl font-bold tabular-nums text-[#F8FAFC]">
            {kpis.totalStoreSales}{' '}
            <span className="text-xs font-sans text-[#94A3B8]">ج.م</span>
          </p>
          <p className="text-[11px] text-[#94A3B8]">
            صافي قيمة السلع بدون رسوم التوصيل
          </p>
        </div>

        <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-5 space-y-1">
          <p className="text-xs font-bold text-[#94A3B8]">
            2. إجمالي رسوم التوصيل (حق المندوب)
          </p>
          <p className="font-mono text-2xl font-bold tabular-nums text-[#F8FAFC]">
            {kpis.totalDeliveryFees}{' '}
            <span className="text-xs font-sans text-[#94A3B8]">ج.م</span>
          </p>
          <p className="text-[11px] text-[#94A3B8]">
            لا تدخل في حساب عمولة إدكاوي · حد أدنى 15 ج.م
          </p>
        </div>

        <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-5 space-y-1">
          <p className="text-xs font-bold text-[#94A3B8]">
            3. إجمالي التحصيل النقدي من العملاء
          </p>
          <p className="font-mono text-2xl font-bold tabular-nums text-[#F8FAFC]">
            {totalCollectedFromCustomers}{' '}
            <span className="text-xs font-sans text-[#94A3B8]">ج.م</span>
          </p>
          <p className="text-[11px] text-[#94A3B8]">
            قيمة المنتجات + رسوم التوصيل المحصلة
          </p>
        </div>

        <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-5 space-y-1">
          <p className="text-xs font-bold text-[#94A3B8]">
            4. عمولة إدكاوي (14% من المنتجات)
          </p>
          <p className="font-mono text-2xl font-bold tabular-nums text-[#FF7100]">
            {kpis.totalEdkawyCommissions}{' '}
            <span className="text-xs font-sans text-[#94A3B8]">ج.م</span>
          </p>
          <p className="text-[11px] text-[#94A3B8]">
            إيراد منصة إدكاوي من الطلبات المكتملة
          </p>
        </div>

        <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-5 space-y-1">
          <p className="text-xs font-bold text-[#94A3B8]">
            5. إجمالي مستحقات المطاعم (86%)
          </p>
          <p className="font-mono text-2xl font-bold tabular-nums text-emerald-400">
            {totalRestaurantsGrossPayable}{' '}
            <span className="text-xs font-sans text-[#94A3B8]">ج.م</span>
          </p>
          <p className="text-[11px] text-[#94A3B8] tabular-nums">
            متبقي غير مسدد: {kpis.unpaidStorePayables} ج.م
          </p>
        </div>

        <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-5 space-y-1">
          <p className="text-xs font-bold text-[#94A3B8]">
            6. تسويات المطاعم المدفوعة فعلياً
          </p>
          <p className="font-mono text-2xl font-bold tabular-nums text-[#F8FAFC]">
            {kpis.paidStoreSettlements}{' '}
            <span className="text-xs font-sans text-[#94A3B8]">ج.م</span>
          </p>
          <p className="text-[11px] text-[#94A3B8]">
            دفعات الإغلاق اليومي المسددة
          </p>
        </div>

        <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-5 space-y-1">
          <p className="text-xs font-bold text-[#94A3B8]">
            7. مستحقات المناديب (أجور التوصيل)
          </p>
          <p className="font-mono text-2xl font-bold tabular-nums text-emerald-400">
            {kpis.totalCourierDues}{' '}
            <span className="text-xs font-sans text-[#94A3B8]">ج.م</span>
          </p>
          <p className="text-[11px] text-[#94A3B8] tabular-nums">
            تم صرفه سابقاً: {totalCouriersPaid} ج.م
          </p>
        </div>

        <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-5 space-y-1">
          <p className="text-xs font-bold text-[#94A3B8]">
            8. عهدة التحصيل لدى المناديب الآن
          </p>
          <p className="font-mono text-2xl font-bold tabular-nums text-amber-300">
            {kpis.cashHeldByCouriers}{' '}
            <span className="text-xs font-sans text-[#94A3B8]">ج.م</span>
          </p>
          <p className="text-[11px] text-[#94A3B8] tabular-nums">
            المُسلّم للخزينة: {kpis.totalHandedOverGross} ج.م
          </p>
        </div>

        <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-5 space-y-1">
          <p className="text-xs font-bold text-[#94A3B8]">
            9. توصيل مجاني ممول من إدكاوي
          </p>
          <p className="font-mono text-2xl font-bold tabular-nums text-[#FF7100]">
            {freeDeliveryFundedEgp}{' '}
            <span className="text-xs font-sans text-[#94A3B8]">ج.م</span>
          </p>
          <p className="text-[11px] text-[#94A3B8] tabular-nums">
            حالات استثنائية معلقة للمراجعة: {kpis.pendingExceptionsCount}
          </p>
        </div>
      </div>

      {/* 4 Sub-tabs */}
      <div
        role="tablist"
        aria-label="أقسام النظام المالي والخزينة"
        className="flex flex-wrap items-center gap-2 bg-[#1E293B] border border-[#334155] rounded-2xl p-2"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'treasury'}
          onClick={() => setActiveTab('treasury')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer ${
            activeTab === 'treasury'
              ? 'bg-[#FF7100] text-white'
              : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#10192D]'
          }`}
        >
          <Landmark className="w-4 h-4" />
          <span>عهدة المناديب وخزينة إدكاوي</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'settlements'}
          onClick={() => setActiveTab('settlements')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer ${
            activeTab === 'settlements'
              ? 'bg-[#FF7100] text-white'
              : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#10192D]'
          }`}
        >
          <CalendarCheck2 className="w-4 h-4" />
          <span>التسويات اليومية (12 منتصف الليل)</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'exceptions'}
          onClick={() => setActiveTab('exceptions')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer ${
            activeTab === 'exceptions'
              ? 'bg-[#FF7100] text-white'
              : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#10192D]'
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>
            الاستثناءات والنزاعات (
            <span className="font-mono tabular-nums">
              {kpis.pendingExceptionsCount}
            </span>
            )
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'ledger'}
          onClick={() => setActiveTab('ledger')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer ${
            activeTab === 'ledger'
              ? 'bg-[#FF7100] text-white'
              : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#10192D]'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>دفتر القيود المحاسبية</span>
        </button>
      </div>

      {/* Sub-tab Body */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.16 }}
        >
          {/* TAB 1: TREASURY & DRIVER WALLETS */}
          {activeTab === 'treasury' && (
            <div className="space-y-6">
              <div className="bg-[#1E293B] border border-[#334155] rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-[#334155] flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-[#F8FAFC]">
                      محافظ المناديب ذات الثلاثة أرصدة منفصلة ({driverWallets.length})
                    </h3>
                    <p className="text-xs text-[#94A3B8] mt-0.5">
                      عهدة التحصيل منفصلة تماماً عن مستحقات أجور التوصيل — ممنوع الخصم التلقائي عند العجز.
                    </p>
                  </div>
                </div>

                {driverWallets.length === 0 ? (
                  <div className="p-10 text-center text-xs sm:text-sm text-[#94A3B8]">
                    لا توجد محافظ نشطة بعد — تُنشأ تلقائياً فور إتمام أول عملية تسليم لكل مندوب.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b border-[#334155] bg-[#10192D] text-xs font-bold text-[#94A3B8]">
                          <th className="py-3 px-4">المندوب</th>
                          <th className="py-3 px-4">عهدة التحصيل</th>
                          <th className="py-3 px-4">مستحقات المندوب</th>
                          <th className="py-3 px-4">المسلّم للخزينة</th>
                          <th className="py-3 px-4">الأجور المصروفة</th>
                          <th className="py-3 px-4">الطلبات</th>
                          <th className="py-3 px-4 text-left">إجراءات الخزينة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#334155]">
                        {driverWallets.map((w) => (
                          <tr key={w.courierId} className="hover:bg-[#10192D]/40">
                            <td className="py-3.5 px-4 font-bold text-[#F8FAFC] whitespace-nowrap">
                              {w.courierName}
                            </td>
                            <td className="py-3.5 px-4 font-mono tabular-nums font-bold text-amber-300">
                              {w.collectionCustody} ج.م
                            </td>
                            <td className="py-3.5 px-4 font-mono tabular-nums font-bold text-emerald-400">
                              {w.courierDues} ج.م
                            </td>
                            <td className="py-3.5 px-4 font-mono tabular-nums text-[#F8FAFC]">
                              {w.handedOverAmount} ج.م
                            </td>
                            <td className="py-3.5 px-4 font-mono tabular-nums text-[#94A3B8]">
                              {w.totalDuesPaid} ج.م
                            </td>
                            <td className="py-3.5 px-4 font-mono tabular-nums">
                              {w.totalOrdersDelivered}
                            </td>
                            <td className="py-3.5 px-4 text-left whitespace-nowrap">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => openHandoverModal(w)}
                                  className="px-3 py-1.5 rounded-lg bg-[#FF7100] hover:bg-[#E66600] text-white text-xs font-bold cursor-pointer"
                                >
                                  استلام نقدية وإيصال
                                </button>
                                <button
                                  type="button"
                                  disabled={w.courierDues <= 0}
                                  onClick={() => {
                                    setPayoutTarget(w);
                                    setPayoutAmountInput(String(w.courierDues));
                                    setPayoutNotesInput('');
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-[#10192D] border border-[#334155] hover:border-emerald-500 disabled:opacity-40 text-emerald-300 text-xs font-bold cursor-pointer"
                                >
                                  صرف مستحقات
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Treasury Receipts Table */}
              <div className="bg-[#1E293B] border border-[#334155] rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-[#334155]">
                  <h3 className="text-base font-bold text-[#F8FAFC] flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-[#FF7100]" />
                    <span>سجل إيصالات استلام النقدية ({treasuryReceipts.length})</span>
                  </h3>
                </div>
                {treasuryReceipts.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#94A3B8]">
                    لم تصدر إيصالات استلام نقدية بعد.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b border-[#334155] bg-[#10192D] text-xs font-bold text-[#94A3B8]">
                          <th className="py-3 px-4">رقم الإيصال</th>
                          <th className="py-3 px-4">المندوب</th>
                          <th className="py-3 px-4">المتوقع</th>
                          <th className="py-3 px-4">الفعلي المستلم</th>
                          <th className="py-3 px-4">الفرق</th>
                          <th className="py-3 px-4">المستلم</th>
                          <th className="py-3 px-4 text-left">طباعة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#334155]">
                        {treasuryReceipts.map((r) => (
                          <tr key={r.id}>
                            <td dir="ltr" className="py-3 px-4 font-mono font-bold text-[#FF7100] text-right">
                              {r.receiptNumber}
                            </td>
                            <td className="py-3 px-4 font-bold">{r.courierName}</td>
                            <td className="py-3 px-4 font-mono tabular-nums">
                              {r.expectedAmount} ج.م
                            </td>
                            <td className="py-3 px-4 font-mono tabular-nums font-bold text-emerald-400">
                              {r.actualAmount} ج.م
                            </td>
                            <td
                              className={`py-3 px-4 font-mono tabular-nums font-bold ${
                                r.varianceAmount < 0
                                  ? 'text-rose-400'
                                  : r.varianceAmount > 0
                                  ? 'text-amber-300'
                                  : 'text-emerald-400'
                              }`}
                            >
                              {r.varianceAmount} ج.م
                            </td>
                            <td className="py-3 px-4 text-xs text-[#94A3B8]">
                              {r.receivedByName}
                            </td>
                            <td className="py-3 px-4 text-left">
                              <button
                                type="button"
                                onClick={() => setPrintingReceipt(r)}
                                className="px-3 py-1.5 rounded-lg bg-[#10192D] border border-[#334155] hover:border-[#FF7100] text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Printer className="w-3.5 h-3.5 text-[#FF7100]" />
                                <span>إيصال</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: DAILY SETTLEMENTS */}
          {activeTab === 'settlements' && (
            <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[#F8FAFC]">
                    التسويات اليومية للمطاعم (إغلاق يومي 12:00 منتصف الليل)
                  </h3>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    يجمع كافة الطلبات المكتملة غير المسوّاة حسب تاريخ القاهرة ويحسب 86% للمطعم و14% لإدكاوي.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    dir="ltr"
                    value={cutoffDateKey}
                    onChange={(e) => setCutoffDateKey(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-[#10192D] border border-[#334155] text-xs font-mono text-[#F8FAFC]"
                  />
                  <button
                    type="button"
                    disabled={busyKey === 'cutoff'}
                    onClick={() => void handleRunDailyCutoffNow()}
                    className="px-4 py-2.5 rounded-xl bg-[#FF7100] hover:bg-[#E66600] text-white text-xs font-bold cursor-pointer"
                  >
                    {busyKey === 'cutoff'
                      ? 'جارٍ الإقفال...'
                      : 'تشغيل إقفال 12 منتصف الليل الآن'}
                  </button>
                </div>
              </div>

              {restaurantSettlements.length === 0 ? (
                <div className="py-10 text-center text-xs text-[#94A3B8]">
                  لا توجد دفعات تسوية مسجلة حتى الآن.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-[#334155] bg-[#10192D] text-xs font-bold text-[#94A3B8]">
                        <th className="py-3 px-4">المتجر</th>
                        <th className="py-3 px-4">التاريخ</th>
                        <th className="py-3 px-4">الطلبات</th>
                        <th className="py-3 px-4">المبيعات</th>
                        <th className="py-3 px-4">عمولة إدكاوي</th>
                        <th className="py-3 px-4">صافي المطعم</th>
                        <th className="py-3 px-4">الحالة</th>
                        <th className="py-3 px-4 text-left">الصرف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#334155]">
                      {restaurantSettlements.map((s) => (
                        <tr key={s.id}>
                          <td className="py-3 px-4 font-bold">{s.storeName}</td>
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
                          </td>
                          <td className="py-3 px-4 text-left">
                            {s.status !== 'paid' ? (
                              <button
                                type="button"
                                onClick={() => setPayingSettlement(s)}
                                className="px-3 py-1.5 rounded-lg bg-[#FF7100] hover:bg-[#E66600] text-white text-xs font-bold cursor-pointer"
                              >
                                تسجيل السداد
                              </button>
                            ) : (
                              <span className="text-xs text-[#94A3B8]">
                                {s.paymentMethod
                                  ? SETTLEMENT_METHOD_LABELS[s.paymentMethod]
                                  : 'مدفوع'}{' '}
                                {s.transferReference ? `(${s.transferReference})` : ''}
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

          {/* TAB 3: FINANCIAL EXCEPTIONS */}
          {activeTab === 'exceptions' && (
            <div className="space-y-4">
              <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[#F8FAFC]">
                    الاستثناءات والنزاعات المالية (تحكيم إداري يدوي — صفر خصم تلقائي)
                  </h3>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    كل حالات الرفض أو العجز أو تلف الطلب تُراجع يدوياً بواسطة الإدارة قبل أي تعديل مالي.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewExceptionOpen((p) => !p)}
                  className="px-4 py-2.5 rounded-xl bg-[#FF7100] hover:bg-[#E66600] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>تسجيل استثناء مالي جديد</span>
                </button>
              </div>

              {isNewExceptionOpen && (
                <form
                  onSubmit={handleCreateException}
                  className="bg-[#1E293B] border border-[#334155] rounded-2xl p-6 space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                        نوع الاستثناء
                      </label>
                      <select
                        value={newExcType}
                        onChange={(e) =>
                          setNewExcType(e.target.value as FinancialExceptionType)
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
                        value={newExcAmount}
                        onChange={(e) => setNewExcAmount(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-[#10192D] border border-[#334155] text-xs font-mono text-[#F8FAFC] text-left"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                        الطرف المتسبب المبدئي
                      </label>
                      <select
                        value={newExcParty}
                        onChange={(e) =>
                          setNewExcParty(
                            e.target.value as ExceptionResponsibleParty | ''
                          )
                        }
                        className="w-full px-3 py-2 rounded-xl bg-[#10192D] border border-[#334155] text-xs text-[#F8FAFC]"
                      >
                        <option value="">لم يحدد بعد</option>
                        <option value="store">المطعم / المتجر</option>
                        <option value="courier">المندوب</option>
                        <option value="customer">العميل</option>
                        <option value="edkawy">إدكاوي</option>
                        <option value="shared">مشترك</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                        المتجر (اختياري)
                      </label>
                      <select
                        value={newExcStoreId}
                        onChange={(e) => setNewExcStoreId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-[#10192D] border border-[#334155] text-xs text-[#F8FAFC]"
                      >
                        <option value="">بدون متجر محدد</option>
                        {stores.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                        المندوب (اختياري)
                      </label>
                      <select
                        value={newExcCourierId}
                        onChange={(e) => setNewExcCourierId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-[#10192D] border border-[#334155] text-xs text-[#F8FAFC]"
                      >
                        <option value="">بدون مندوب محدد</option>
                        {couriers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                        رقم الطلب (اختياري)
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={newExcOrderId}
                        onChange={(e) => setNewExcOrderId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-[#10192D] border border-[#334155] text-xs font-mono text-[#F8FAFC] text-left"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-amber-300 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newExcHold}
                      onChange={(e) => setNewExcHold(e.target.checked)}
                    />
                    <span>تعليق تسوية الطلب لحين المراجعة اليدوية</span>
                  </label>
                  <div>
                    <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                      وصف المشكلة / الحالة *
                    </label>
                    <textarea
                      rows={2}
                      value={newExcDesc}
                      onChange={(e) => setNewExcDesc(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl bg-[#10192D] border border-[#334155] text-xs text-[#F8FAFC]"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsNewExceptionOpen(false)}
                      className="px-4 py-2 rounded-xl border border-[#334155] text-xs font-bold text-[#94A3B8] cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      disabled={busyKey === 'new_exc'}
                      className="px-5 py-2 rounded-xl bg-[#FF7100] text-white text-xs font-bold cursor-pointer"
                    >
                      {busyKey === 'new_exc' ? 'جارٍ التسجيل...' : 'حفظ الاستثناء'}
                    </button>
                  </div>
                </form>
              )}

              <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-6 space-y-3">
                {financialExceptions.length === 0 ? (
                  <p className="text-center text-xs text-[#94A3B8] py-6">
                    لا توجد حالات استثنائية مسجلة حالياً.
                  </p>
                ) : (
                  financialExceptions.map((ex) => (
                    <div
                      key={ex.id}
                      className="p-4 rounded-xl bg-[#10192D] border border-[#334155] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-[#F8FAFC]">
                            {getFinancialExceptionTypeLabelAr(ex.exceptionType)}
                          </span>
                          <span className="font-mono font-bold text-[#FF7100] tabular-nums">
                            {ex.disputedAmount} ج.م
                          </span>
                          {ex.storeName && (
                            <span className="text-[#94A3B8]">
                              · متجر: {ex.storeName}
                            </span>
                          )}
                          {ex.courierName && (
                            <span className="text-[#94A3B8]">
                              · مندوب: {ex.courierName}
                            </span>
                          )}
                        </div>
                        <p className="text-[#94A3B8] leading-relaxed">
                          {ex.description}
                        </p>
                        {ex.adminResolutionNote && (
                          <p className="text-emerald-400 font-semibold">
                            قرار الإدارة ({ex.resolvedByName || 'الإدارة'}):{' '}
                            {ex.adminResolutionNote}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {ex.status === 'pending_review' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setResolvingException(ex);
                              setResolveDecision('resolved_no_deduction');
                              setResolveParty(ex.responsibleParty || 'edkawy');
                              setResolveAdjustedAmount(String(ex.disputedAmount));
                              setResolveNote('');
                            }}
                            className="px-4 py-2 rounded-xl bg-[#FF7100] hover:bg-[#E66600] text-white text-xs font-bold cursor-pointer"
                          >
                            مراجعة وحسم يدوي
                          </button>
                        ) : (
                          <span className="px-3 py-1 rounded-lg bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-xs font-bold">
                            {ex.status === 'resolved_no_deduction'
                              ? 'تم الإغلاق بدون خصم'
                              : 'تمت التسوية بتعديل'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: ACCOUNTING LEDGER */}
          {activeTab === 'ledger' && (
            <div className="bg-[#1E293B] border border-[#334155] rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-[#334155] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-[#94A3B8] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    placeholder="ابحث برقم الطلب أو المتجر أو المندوب أو الملاحظة..."
                    className="w-full pr-9 pl-4 py-2 rounded-xl bg-[#10192D] border border-[#334155] text-xs sm:text-sm text-[#F8FAFC]"
                  />
                </div>
                <select
                  value={ledgerTypeFilter}
                  onChange={(e) =>
                    setLedgerTypeFilter(
                      e.target.value as FinancialTransactionType | 'all'
                    )
                  }
                  className="px-3.5 py-2 rounded-xl bg-[#10192D] border border-[#334155] text-xs text-[#F8FAFC]"
                >
                  <option value="all">كل أنواع القيود المحاسبية</option>
                  {(Object.keys(TX_TYPE_LABELS) as FinancialTransactionType[]).map(
                    (tp) => (
                      <option key={tp} value={tp}>
                        {TX_TYPE_LABELS[tp]}
                      </option>
                    )
                  )}
                </select>
              </div>

              {filteredLedger.length === 0 ? (
                <div className="p-10 text-center text-xs text-[#94A3B8]">
                  لا توجد قيود مطابقة للبحث.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-[#334155] bg-[#10192D] text-xs font-bold text-[#94A3B8]">
                        <th className="py-3 px-4">نوع القيد</th>
                        <th className="py-3 px-4">المبلغ</th>
                        <th className="py-3 px-4">المتجر / المندوب</th>
                        <th className="py-3 px-4">الطلب</th>
                        <th className="py-3 px-4">البيان</th>
                        <th className="py-3 px-4">الوقت</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#334155]">
                      {filteredLedger.map((tx) => (
                        <tr key={tx.id} className="hover:bg-[#10192D]/40">
                          <td className="py-3 px-4 font-bold text-[#FF7100] whitespace-nowrap">
                            {TX_TYPE_LABELS[tx.type] || tx.type}
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums font-bold">
                            {tx.amount} ج.م
                          </td>
                          <td className="py-3 px-4 text-xs text-[#F8FAFC]">
                            {tx.storeName || tx.courierName || '—'}
                          </td>
                          <td
                            dir="ltr"
                            className="py-3 px-4 font-mono text-xs text-[#94A3B8] text-right"
                          >
                            {tx.orderId ? `#${tx.orderId.slice(0, 8)}` : '—'}
                          </td>
                          <td className="py-3 px-4 text-xs text-[#94A3B8]">
                            {tx.notes}
                          </td>
                          <td
                            dir="ltr"
                            className="py-3 px-4 font-mono text-xs text-[#94A3B8] text-right whitespace-nowrap"
                          >
                            {tx.createdAtIso.slice(0, 16).replace('T', ' ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Modal: Record Treasury Handover */}
      {handoverTarget && (
        <div
          className="edkawi-modal-backdrop flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleConfirmHandover}
            className="bg-[#1E293B] border border-[#334155] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#F8FAFC]">
                استلام نقدية وإصدار إيصال خزينة
              </h3>
              <button
                type="button"
                onClick={() => setHandoverTarget(null)}
                className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-[#10192D] border border-[#334155] text-xs space-y-1">
              <p className="font-bold text-[#F8FAFC]">
                المندوب: {handoverTarget.courierName}
              </p>
              <p className="text-[#94A3B8]">
                عهدة التحصيل المتوقعة:{' '}
                <span className="font-mono font-bold text-amber-300 tabular-nums">
                  {handoverTarget.collectionCustody} ج.م
                </span>
              </p>
              <p className="text-[#94A3B8]">
                مستحقات التوصيل للمندوب:{' '}
                <span className="font-mono font-bold text-emerald-400 tabular-nums">
                  {handoverTarget.courierDues} ج.م
                </span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                المبلغ الفعلي المستلم نقداً (ج.م)
              </label>
              <input
                type="number"
                min={0}
                step="0.5"
                dir="ltr"
                value={handoverActualInput}
                onChange={(e) => setHandoverActualInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#10192D] border border-[#334155] text-sm font-mono font-bold text-[#F8FAFC] text-left"
                required
              />
            </div>

            {handoverVariance < 0 && (
              <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-700/70 text-amber-200 text-xs leading-relaxed">
                تنبيه: يوجد عجز بقيمة{' '}
                <span className="font-mono font-bold">
                  {Math.abs(handoverVariance)} ج.م
                </span>
                . لن يتم خصم أي مبلغ تلقائياً من مستحقات المندوب؛ سيتم تسجيل حالة عجز للمراجعة اليدوية فقط.
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                صرف جزء من مستحقات المندوب بنفس الإيصال (اختياري — بحد أقصى{' '}
                {handoverTarget.courierDues} ج.م)
              </label>
              <input
                type="number"
                min={0}
                max={handoverTarget.courierDues}
                step="0.5"
                dir="ltr"
                value={handoverPayDuesInput}
                onChange={(e) => setHandoverPayDuesInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#10192D] border border-[#334155] text-sm font-mono text-[#F8FAFC] text-left"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                ملاحظات موظف الخزينة
              </label>
              <input
                type="text"
                value={handoverNotesInput}
                onChange={(e) => setHandoverNotesInput(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#10192D] border border-[#334155] text-xs text-[#F8FAFC]"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setHandoverTarget(null)}
                className="px-4 py-2 rounded-xl border border-[#334155] text-xs font-bold text-[#94A3B8] cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={busyKey === 'handover'}
                className="px-5 py-2 rounded-xl bg-[#FF7100] text-white text-xs font-bold cursor-pointer"
              >
                {busyKey === 'handover' ? 'جارٍ الإصدار...' : 'تأكيد وإصدار الإيصال'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Pay Courier Dues */}
      {payoutTarget && (
        <div
          className="edkawi-modal-backdrop flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleConfirmPayout}
            className="bg-[#1E293B] border border-[#334155] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#F8FAFC]">
                صرف مستحقات أجور التوصيل للمندوب
              </h3>
              <button
                type="button"
                onClick={() => setPayoutTarget(null)}
                className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#94A3B8]">
              الرصيد المستحق الحالي للكابتن{' '}
              <span className="font-bold text-[#F8FAFC]">
                {payoutTarget.courierName}
              </span>
              :{' '}
              <span className="font-mono font-bold text-emerald-400">
                {payoutTarget.courierDues} ج.م
              </span>
            </p>
            <div>
              <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                المبلغ المراد صرفه (ج.م)
              </label>
              <input
                type="number"
                min={1}
                max={payoutTarget.courierDues}
                step="0.5"
                dir="ltr"
                value={payoutAmountInput}
                onChange={(e) => setPayoutAmountInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#10192D] border border-[#334155] text-sm font-mono font-bold text-emerald-400 text-left"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                ملاحظات الصرف
              </label>
              <input
                type="text"
                value={payoutNotesInput}
                onChange={(e) => setPayoutNotesInput(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#10192D] border border-[#334155] text-xs text-[#F8FAFC]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPayoutTarget(null)}
                className="px-4 py-2 rounded-xl border border-[#334155] text-xs font-bold text-[#94A3B8] cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={busyKey === 'payout'}
                className="px-5 py-2 rounded-xl bg-[#FF7100] text-white text-xs font-bold cursor-pointer"
              >
                {busyKey === 'payout' ? 'جارٍ الصرف...' : 'تأكيد الصرف'}
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
            onSubmit={handleConfirmMarkSettlementPaid}
            className="bg-[#1E293B] border border-[#334155] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#F8FAFC]">
                تسجيل سداد تسوية المطعم
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
                صافي المطعم: {payingSettlement.restaurantNetPayable} ج.م
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                طريقة السداد
              </label>
              <select
                value={settleMethod}
                onChange={(e) =>
                  setSettleMethod(e.target.value as RestaurantSettlementMethod)
                }
                className="w-full px-3 py-2 rounded-xl bg-[#10192D] border border-[#334155] text-xs text-[#F8FAFC]"
              >
                {(
                  Object.keys(
                    SETTLEMENT_METHOD_LABELS
                  ) as RestaurantSettlementMethod[]
                ).map((m) => (
                  <option key={m} value={m}>
                    {SETTLEMENT_METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                مرجع التحويل (اختياري)
              </label>
              <input
                type="text"
                dir="ltr"
                value={settleRef}
                onChange={(e) => setSettleRef(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#10192D] border border-[#334155] text-xs font-mono text-[#F8FAFC] text-left"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                ملاحظات
              </label>
              <input
                type="text"
                value={settleNotes}
                onChange={(e) => setSettleNotes(e.target.value)}
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
                disabled={busyKey === 'settle_paid'}
                className="px-5 py-2 rounded-xl bg-[#FF7100] text-white text-xs font-bold cursor-pointer"
              >
                {busyKey === 'settle_paid' ? 'جارٍ التأكيد...' : 'تأكيد السداد'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Resolve Financial Exception */}
      {resolvingException && (
        <div
          className="edkawi-modal-backdrop flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleConfirmResolveException}
            className="bg-[#1E293B] border border-[#334155] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#F8FAFC]">
                التحكيم الإداري اليدوي للاستثناء المالي
              </h3>
              <button
                type="button"
                onClick={() => setResolvingException(null)}
                className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 rounded-xl bg-[#10192D] border border-[#334155] text-xs space-y-1">
              <p className="font-bold text-[#FF7100]">
                {getFinancialExceptionTypeLabelAr(
                  resolvingException.exceptionType
                )}{' '}
                · {resolvingException.disputedAmount} ج.م
              </p>
              <p className="text-[#94A3B8]">{resolvingException.description}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                  القرار الإداري
                </label>
                <select
                  value={resolveDecision}
                  onChange={(e) =>
                    setResolveDecision(
                      e.target.value as
                        | 'resolved_no_deduction'
                        | 'resolved_with_adjustment'
                    )
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[#10192D] border border-[#334155] text-xs text-[#F8FAFC]"
                >
                  <option value="resolved_no_deduction">
                    إغلاق بدون أي خصم
                  </option>
                  <option value="resolved_with_adjustment">
                    اعتماد تسوية مالية / خصم يدوي
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                  الطرف المسؤول
                </label>
                <select
                  value={resolveParty}
                  onChange={(e) =>
                    setResolveParty(
                      e.target.value as ExceptionResponsibleParty
                    )
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[#10192D] border border-[#334155] text-xs text-[#F8FAFC]"
                >
                  <option value="edkawy">بدون خصم / تتحمله إدكاوي</option>
                  <option value="store">المطعم / المتجر</option>
                  <option value="courier">المندوب</option>
                  <option value="customer">العميل</option>
                  <option value="shared">مشترك</option>
                </select>
              </div>
            </div>

            {resolveDecision === 'resolved_with_adjustment' && (
              <div>
                <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                  قيمة التسوية / التعديل اليدوي (ج.م)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  dir="ltr"
                  value={resolveAdjustedAmount}
                  onChange={(e) => setResolveAdjustedAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#10192D] border border-[#334155] text-xs font-mono text-[#F8FAFC] text-left"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                قرار وحيثيات الإدارة *
              </label>
              <textarea
                rows={3}
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-[#10192D] border border-[#334155] text-xs text-[#F8FAFC]"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResolvingException(null)}
                className="px-4 py-2 rounded-xl border border-[#334155] text-xs font-bold text-[#94A3B8] cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={busyKey === 'resolve_exc'}
                className="px-5 py-2 rounded-xl bg-[#FF7100] text-white text-xs font-bold cursor-pointer"
              >
                {busyKey === 'resolve_exc' ? 'جارٍ الاعتماد...' : 'اعتماد القرار'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Printable Treasury Receipt */}
      {printingReceipt && (
        <div
          className="edkawi-modal-backdrop flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[#1E293B] border border-[#334155] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl edkawi-print-area">
            <div className="flex items-center justify-between border-b border-[#334155] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#F8FAFC]">
                  إيصال استلام نقدية — خزينة إدكاوي
                </h3>
                <p dir="ltr" className="font-mono text-xs text-[#FF7100] font-bold">
                  {printingReceipt.receiptNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPrintingReceipt(null)}
                className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white cursor-pointer print:hidden"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">المندوب:</span>
                <span className="font-bold text-[#F8FAFC]">
                  {printingReceipt.courierName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">العهدة المتوقعة:</span>
                <span className="font-mono tabular-nums font-bold">
                  {printingReceipt.expectedAmount} ج.م
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">المبلغ المستلم فعلياً:</span>
                <span className="font-mono tabular-nums font-bold text-emerald-400">
                  {printingReceipt.actualAmount} ج.م
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">الفرق:</span>
                <span className="font-mono tabular-nums font-bold">
                  {printingReceipt.varianceAmount} ج.م
                </span>
              </div>
              {typeof printingReceipt.duesPaidSeparately === 'number' &&
                printingReceipt.duesPaidSeparately > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#94A3B8]">مستحقات منصرفة للمندوب:</span>
                    <span className="font-mono tabular-nums font-bold text-[#FF7100]">
                      {printingReceipt.duesPaidSeparately} ج.م
                    </span>
                  </div>
                )}
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">استلم بواسطة:</span>
                <span className="font-bold">{printingReceipt.receivedByName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">التاريخ والوقت:</span>
                <span dir="ltr" className="font-mono text-[#F8FAFC]">
                  {printingReceipt.createdAtIso.slice(0, 16).replace('T', ' ')}
                </span>
              </div>
              {printingReceipt.notes && (
                <p className="pt-2 border-t border-[#334155] text-[#94A3B8]">
                  {printingReceipt.notes}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 print:hidden">
              <button
                type="button"
                onClick={() => setPrintingReceipt(null)}
                className="px-4 py-2 rounded-xl border border-[#334155] text-xs font-bold text-[#94A3B8] cursor-pointer"
              >
                إغلاق
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 rounded-xl bg-[#FF7100] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة الإيصال</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
