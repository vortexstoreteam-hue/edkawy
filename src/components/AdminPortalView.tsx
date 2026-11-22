import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Ban,
  Beaker,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Database,
  DollarSign,
  Eye,
  FileText,
  Flame,
  Gift,
  Headphones,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Mail,
  Map as MapIcon,
  MapPin,
  Megaphone,
  Menu,
  Phone,
  Pill,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store as StoreIcon,
  Tag,
  Trash2,
  TrendingUp,
  Truck,
  UserCheck,
  Users,
  Wallet,
  Wrench,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  adminCreateInvitationInFirestore,
  adminProcessPayoutRequestInFirestore,
  adminResendInvitationInFirestore,
  adminSendPasswordResetLinkInFirestore,
  adminUpdateAccountLoginEmailInFirestore,
  adminUpdateSalesAgentCommissionInFirestore,
  approveStoreJoinRequestInFirestore,
  buildInvitationRegistrationUrl,
  listenToAdminInvitations,
  listenToAdminPayoutRequests,
  listenToAdminSalesAgents,
  listenToStoreJoinRequests,
  processWalletTopupByAdminInFirestore,
  rejectStoreJoinRequestInFirestore,
  setCustomerBanStatusByAdminInFirestore,
  updateEdkoZoneInFirestore,
  updateSuperAppCategoryInFirestore,
  updateSystemMaintenanceByAdminInFirestore,
} from '../services/edkawiFirebaseService';
import {
  EdkoZoneRecord,
  InvitationRecord,
  PayoutRequestRecord,
  SalesAgentProfileRecord,
  StoreJoinRequestRecord,
  SuperAppCategoryRecord,
  UserRole,
} from '../types/edkawi';
import {
  EDKU_CITY_CENTER,
  resolveEdkuCoordsForNeighborhood,
} from '../data/edkuSeedStores';
import {
  AdBannerInput,
  AdBannerRecord,
  AdminCreateCourierInput,
  AdminCustomerRecord,
  AdminNotificationSendInput,
  AppNotificationRecord,
  AppNotificationType,
  AuditActionType,
  AuditLogRecord,
  BlockedEntityRecord,
  BlockedEntityType,
  BroadcastAudience,
  CampaignInput,
  CampaignRecord,
  CampaignType,
  CouponInput,
  CouponRecord,
  CourierCredentialRecord,
  CourierRecord,
  CourierVehicleType,
  CustomerBanType,
  CustomerDirectoryEntry,
  FirebaseConnectionHealthResult,
  OrderRecord,
  OrderStatus,
  PaymentMethodsConfig,
  ProductRecord,
  QaSimulationReport,
  StaffMemberRecord,
  StoreCredentialRecord,
  StoreRecord,
  SupportTicketRecord,
  SystemMaintenanceConfig,
  WalletTopupRequestRecord,
} from '../types/edkawi';
import {
  calculateAdminDashboardStats,
  computeFraudDetectionAlerts,
  COURIER_VEHICLE_TYPES,
  EDKU_NEIGHBORHOODS,
  filterAdminCustomers,
  formatAppErrorMessage,
  getAuditActionLabelAr,
  getOrderStatusLabel,
  getPaymentMethodLabel,
  isCouponExpired,
  isStoreCurrentlyOpen,
  validateCourierRegistrationForm,
} from '../utils/orderLogic';
import { AdkawyLogo } from './AdkawyLogo';
import { ConfirmActionModal } from './ConfirmActionModal';
import { DeviceImageInput } from './DeviceImageInput';
import {
  AdminLiveCouriersMap,
  EdkuLocationPickerMap,
} from './EdkuGoogleMaps';
import { ResilientImage } from './ResilientImage';
import { AdminStaffManagementSection } from './StaffAndOperationsViews';
import { AdminSupportSplitWorkspace } from './SupportSystemViews';

type AdminSidebarSection =
  | 'overview'
  | 'requests'
  | 'stores'
  | 'couriers'
  | 'orders'
  | 'invitations'
  | 'sales_agents'
  | 'payouts'
  | 'wallet_topups'
  | 'zones_categories'
  | 'customers'
  | 'support'
  | 'staff'
  | 'ads'
  | 'coupons'
  | 'notifications'
  | 'campaigns'
  | 'loyalty'
  | 'security'
  | 'testing'
  | 'audit_logs';

const CAMPAIGN_TYPE_OPTIONS: { value: CampaignType; label: string }[] = [
  { value: 'points_multiplier', label: 'مضاعفة نقاط الولاء (x2 / x3)' },
  { value: 'happy_hour', label: 'ساعة السعادة (خصم وقت محدد)' },
  { value: 'streak_5', label: 'تحدي ٥ طلبات = توصيل مجاني + ٥٠ نقطة' },
  { value: 'neighborhood_challenge', label: 'تحدي أحياء إدكو' },
  { value: 'mystery_box', label: 'بوكس المفاجآت اليومي' },
];

const AUDIENCE_LABELS: Record<BroadcastAudience, string> = {
  all: 'الجميع (عملاء + متاجر + مناديب)',
  customer: 'جميع العملاء فقط',
  store: 'جميع المتاجر والصيدليات فقط',
  courier: 'جميع المناديب فقط',
  specific_user: 'مستخدم محدد بالاسم',
};

interface AdminPortalViewProps {
  adminUid?: string;
  orders: OrderRecord[];
  stores: StoreRecord[];
  storeCredentialsMap: Record<string, StoreCredentialRecord>;
  couriers: CourierRecord[];
  supportTickets?: SupportTicketRecord[];
  staffMembers?: StaffMemberRecord[];
  ads?: AdBannerRecord[];
  coupons?: CouponRecord[];
  campaigns?: CampaignRecord[];
  customersDirectory?: CustomerDirectoryEntry[];
  adminCustomers?: AdminCustomerRecord[];
  adminWalletTopups?: WalletTopupRequestRecord[];
  products?: ProductRecord[];
  auditLogs?: AuditLogRecord[];
  broadcastHistory?: AppNotificationRecord[];
  unreadNotificationsCount?: number;
  onOpenNotifications?: () => void;
  onNotify?: (msg: string) => void;
  onApproveCourier: (
    courierId: string,
    nextStatus?: 'approved' | 'rejected',
    rejectionReason?: string
  ) => Promise<void>;
  onCreateCourierByAdmin: (
    input: AdminCreateCourierInput
  ) => Promise<CourierCredentialRecord>;
  onAssignCourierManually: (
    orderId: string,
    courier: CourierRecord
  ) => Promise<void>;
  onCancelOrder: (orderId: string) => Promise<void>;
  onToggleStoreActive: (storeId: string, nextActive: boolean) => Promise<void>;
  onUpdateStoreDeliveryFee?: (
    store: StoreRecord,
    nextDeliveryFeeEgp: number
  ) => Promise<void>;
  onDeleteProductByAdmin?: (
    product: ProductRecord,
    storeName?: string
  ) => Promise<void>;
  onCreateAdBanner?: (input: AdBannerInput) => Promise<void>;
  onToggleAdBannerActive?: (adId: string, nextActive: boolean) => Promise<void>;
  onDeleteAdBanner?: (adId: string) => Promise<void>;
  onUpsertCoupon?: (input: CouponInput) => Promise<void>;
  onToggleCouponActive?: (
    couponId: string,
    nextActive: boolean
  ) => Promise<void>;
  onDeleteCoupon?: (couponId: string) => Promise<void>;
  onSendAdminNotification?: (
    input: AdminNotificationSendInput
  ) => Promise<void>;
  onCreateCampaign?: (input: CampaignInput) => Promise<void>;
  onToggleCampaignActive?: (
    campaignId: string,
    nextActive: boolean
  ) => Promise<void>;
  onDeleteCampaign?: (campaignId: string) => Promise<void>;
  onGiftCustomerPoints?: (
    customer: CustomerDirectoryEntry,
    bonusPoints: number,
    reasonNote?: string
  ) => Promise<void>;
  onBanCustomer?: (
    customer: { uid: string; name: string; customerCode?: string },
    nextBanned: boolean,
    reason?: string
  ) => Promise<void>;
  onPurgeDemoData?: () => Promise<number>;
  onSimulateOrderTest?: () => Promise<QaSimulationReport>;
  onCheckFirebaseHealth?: () => Promise<FirebaseConnectionHealthResult>;
  onPurgeAllTestData?: () => Promise<number>;
  maintenanceConfig?: SystemMaintenanceConfig;
  blockedEntities?: Record<string, BlockedEntityRecord>;
  onUpdateMaintenance?: (
    maintenanceMode: boolean,
    maintenanceMessage: string
  ) => Promise<void>;
  onSetEntityBlocked?: (input: {
    targetId: string;
    targetType: BlockedEntityType;
    targetName?: string;
    reason?: string;
    isBlocked: boolean;
  }) => Promise<void>;
  onOpenAddStoreModal: () => void;
  edkoZones?: EdkoZoneRecord[];
  superAppCategories?: SuperAppCategoryRecord[];
  initialSection?: AdminSidebarSection;
  onLogout: () => Promise<void>;
}

export function AdminPortalView({
  adminUid = '',
  orders,
  stores,
  storeCredentialsMap,
  couriers,
  edkoZones = [],
  superAppCategories = [],
  initialSection,
  supportTickets = [],
  staffMembers = [],
  ads = [],
  coupons = [],
  campaigns = [],
  customersDirectory = [],
  adminCustomers = [],
  adminWalletTopups = [],
  products = [],
  auditLogs = [],
  broadcastHistory = [],
  unreadNotificationsCount = 0,
  onOpenNotifications,
  onNotify,
  onApproveCourier,
  onCreateCourierByAdmin,
  onAssignCourierManually,
  onCancelOrder,
  onToggleStoreActive,
  onUpdateStoreDeliveryFee,
  onDeleteProductByAdmin,
  onCreateAdBanner,
  onToggleAdBannerActive,
  onDeleteAdBanner,
  onUpsertCoupon,
  onToggleCouponActive,
  onDeleteCoupon,
  onSendAdminNotification,
  onCreateCampaign,
  onToggleCampaignActive,
  onDeleteCampaign,
  onGiftCustomerPoints,
  onBanCustomer,
  onPurgeDemoData,
  onSimulateOrderTest,
  onCheckFirebaseHealth,
  onPurgeAllTestData,
  maintenanceConfig,
  blockedEntities = {},
  onUpdateMaintenance,
  onSetEntityBlocked,
  onOpenAddStoreModal,
  onLogout,
}: AdminPortalViewProps) {
  const [activeSection, setActiveSection] =
    useState<AdminSidebarSection>(initialSection || 'overview');
  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [storeSearch, setStoreSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<
    OrderStatus | 'all'
  >('all');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Store Join Requests state
  const [storeJoinRequests, setStoreJoinRequests] = useState<StoreJoinRequestRecord[]>([]);
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
  const [rejectReasonText, setRejectReasonText] = useState('');

  useEffect(() => {
    const unsub = listenToStoreJoinRequests((list) => {
      setStoreJoinRequests(list);
    });
    return () => unsub();
  }, []);

  // 7-Day Order Count and Revenue Trend Chart Data (Recharts)
  const last7DaysChartData = useMemo(() => {
    const days: { dateLabel: string; ordersCount: number; revenueEgp: number; completedCount: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric' });
      
      const dayOrders = orders.filter((o) => (o.createdAtIso || '').startsWith(dateStr));
      const completedOrders = dayOrders.filter((o) => o.status === 'delivered');
      const revenue = completedOrders.reduce((acc, o) => acc + (o.totalAmount || 0), 0);

      days.push({
        dateLabel: dayLabel,
        ordersCount: dayOrders.length,
        completedCount: completedOrders.length,
        revenueEgp: revenue,
      });
    }
    return days;
  }, [orders]);

  // Add Courier Modal state (with interactive Edku map coordinates)
  const [isAddCourierOpen, setIsAddCourierOpen] = useState(false);
  const [courierName, setCourierName] = useState('');
  const [courierPhone, setCourierPhone] = useState('');
  const [courierEmail, setCourierEmail] = useState('');
  const [courierPassword, setCourierPassword] = useState('');
  const [courierVehicle, setCourierVehicle] =
    useState<CourierVehicleType>('دراجة نارية');
  const [courierArea, setCourierArea] = useState<string>(EDKU_NEIGHBORHOODS[0]);
  const [courierLat, setCourierLat] = useState<number>(EDKU_CITY_CENTER.lat);
  const [courierLng, setCourierLng] = useState<number>(EDKU_CITY_CENTER.lng);
  const [courierWaterPin, setCourierWaterPin] = useState(false);
  const [courierFormErrors, setCourierFormErrors] = useState<
    Record<string, string>
  >({});
  const [submittingCourier, setSubmittingCourier] = useState(false);
  const [createdCourierCred, setCreatedCourierCred] =
    useState<CourierCredentialRecord | null>(null);

  // Invitations, Sales Agents, Payouts, Zones
  const [invitations, setInvitations] = useState<InvitationRecord[]>([]);
  const [isCreateInviteModalOpen, setIsCreateInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('store');
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteRoleFilter, setInviteRoleFilter] = useState<string>('all');
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);

  const [salesAgents, setSalesAgents] = useState<SalesAgentProfileRecord[]>([]);
  const [agentCommissionInput, setAgentCommissionInput] = useState<Record<string, number>>({});
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequestRecord[]>([]);
  const [payoutRejectionReason, setPayoutRejectionReason] = useState<Record<string, string>>({});

  // Wallet Top-Up Requests & 3-Tier Ban states
  const [topupNoteById, setTopupNoteById] = useState<Record<string, string>>({});
  const [zoomedTopupReceiptUrl, setZoomedTopupReceiptUrl] = useState<string | null>(null);
  const [zoomedKycDoc, setZoomedKycDoc] = useState<{ title: string; url: string } | null>(null);
  const [courierRejectOpenId, setCourierRejectOpenId] = useState<string | null>(null);
  const [courierRejectReasonById, setCourierRejectReasonById] = useState<Record<string, string>>({});
  const [banTypeByCustomerUid, setBanTypeByCustomerUid] = useState<Record<string, CustomerBanType>>({});
  const [banReasonByCustomerUid, setBanReasonByCustomerUid] = useState<Record<string, string>>({});

  // Change email modal in Admin
  const [adminChangeEmailTarget, setAdminChangeEmailTarget] = useState<{ uid: string; currentEmail: string; name: string } | null>(null);
  const [adminNewEmailInput, setAdminNewEmailInput] = useState('');

  // Zone and Category editing
  const [editingZonePrices, setEditingZonePrices] = useState<Record<string, number>>({});
  const [editingCategoryFee, setEditingCategoryFee] = useState<Record<string, number>>({});

  useEffect(() => {
    const unsubInv = listenToAdminInvitations(setInvitations);
    const unsubAgents = listenToAdminSalesAgents(setSalesAgents);
    const unsubPayouts = listenToAdminPayoutRequests(setPayoutRequests);
    return () => {
      unsubInv();
      unsubAgents();
      unsubPayouts();
    };
  }, []);

  // Promotional Ad Banner form state
  const [adTitle, setAdTitle] = useState('');
  const [adSubtitle, setAdSubtitle] = useState('');
  const [adBadge, setAdBadge] = useState('عرض حصري في إدكو');
  const [adImageUrl, setAdImageUrl] = useState('');
  const [adStoreId, setAdStoreId] = useState('');
  const [adStartDate, setAdStartDate] = useState('');
  const [adEndDate, setAdEndDate] = useState('');
  const [adSortOrder, setAdSortOrder] = useState('1');
  const [submittingAd, setSubmittingAd] = useState(false);

  // Discount Coupon form state
  const [couponCode, setCouponCode] = useState('');
  const [couponPercent, setCouponPercent] = useState('25');
  const [couponMaxEgp, setCouponMaxEgp] = useState('100');
  const [couponMinOrder, setCouponMinOrder] = useState('60');
  const [couponExpiryDate, setCouponExpiryDate] = useState('');
  const [couponDesc, setCouponDesc] = useState('');
  const [submittingCoupon, setSubmittingCoupon] = useState(false);

  // Internal Admin Notifications state
  const [notifAudience, setNotifAudience] =
    useState<BroadcastAudience>('all');
  const [notifRecipientUid, setNotifRecipientUid] = useState('');
  const [notifType, setNotifType] = useState<AppNotificationType>('system');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [sendingNotif, setSendingNotif] = useState(false);

  // Rotating Campaigns state
  const [campTitle, setCampTitle] = useState('');
  const [campSubtitle, setCampSubtitle] = useState('');
  const [campBadge, setCampBadge] = useState('فعالية إدكاوي');
  const [campType, setCampType] =
    useState<CampaignType>('points_multiplier');
  const [campMultiplier, setCampMultiplier] = useState('2');
  const [campDiscountPct, setCampDiscountPct] = useState('20');
  const [campRewardPoints, setCampRewardPoints] = useState('50');
  const [campNeighborhood, setCampNeighborhood] = useState('');
  const [campImageUrl, setCampImageUrl] = useState('');
  const [submittingCampaign, setSubmittingCampaign] = useState(false);

  // Customer Directory, Search, Loyalty Points state
  const [customerSearch, setCustomerSearch] = useState('');
  const [giftPointsByUid, setGiftPointsByUid] = useState<
    Record<string, string>
  >({});
  const [giftNoteByUid, setGiftNoteByUid] = useState<Record<string, string>>(
    {}
  );

  // Store Fee Editing & Store Products Expansion state
  const [storeFeeInputById, setStoreFeeInputById] = useState<
    Record<string, string>
  >({});
  const [expandedStoreProductsId, setExpandedStoreProductsId] = useState<
    string | null
  >(null);

  // QA & Testing Center state
  const [qaRunningAction, setQaRunningAction] = useState<
    'simulate' | 'health' | 'purge' | null
  >(null);
  const [qaSimulationReport, setQaSimulationReport] =
    useState<QaSimulationReport | null>(null);
  const [qaHealthResult, setQaHealthResult] =
    useState<FirebaseConnectionHealthResult | null>(null);

  // Audit Logs state
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState<
    AuditActionType | 'all'
  >('all');

  // Maintenance Mode, Surge Pricing, Payment Methods & SMTP Status state
  const [maintMessageInput, setMaintMessageInput] = useState(
    maintenanceConfig?.maintenanceMessage ||
      'تطبيق إدكاوي في وضع الصيانة والتحديث حالياً لرفع كفاءة الخدمة في مدينة إدكو — سنعود للعمل خلال دقائق.'
  );
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [surgeEnabledInput, setSurgeEnabledInput] = useState<boolean>(
    Boolean(maintenanceConfig?.surgeEnabled)
  );
  const [surgeMultiplierInput, setSurgeMultiplierInput] = useState<string>(
    String(maintenanceConfig?.surgeMultiplier ?? 1.2)
  );
  const [paymentMethodsInput, setPaymentMethodsInput] =
    useState<PaymentMethodsConfig>(
      maintenanceConfig?.paymentMethods ?? {
        cash: true,
        wallet: true,
        visa: false,
      }
    );
  const [smtpEnabledInput, setSmtpEnabledInput] = useState<boolean>(
    Boolean(maintenanceConfig?.smtpEnabled)
  );
  const [smtpStatus, setSmtpStatus] = useState<{
    configured: boolean;
    host?: string;
    port?: number;
    fromMasked?: string;
  } | null>(null);
  const [savingOperationsSettings, setSavingOperationsSettings] = useState(false);

  const [blockTargetType, setBlockTargetType] =
    useState<BlockedEntityType>('customer');
  const [blockTargetId, setBlockTargetId] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [submittingBlock, setSubmittingBlock] = useState(false);

  // ConfirmActionModal states
  const [confirmCancelOrderId, setConfirmCancelOrderId] = useState<string | null>(null);
  const [confirmDeleteProductTarget, setConfirmDeleteProductTarget] = useState<{
    product: ProductRecord;
    storeName?: string;
  } | null>(null);
  const [confirmDeleteAdId, setConfirmDeleteAdId] = useState<string | null>(null);
  const [confirmDeleteCampaignId, setConfirmDeleteCampaignId] = useState<string | null>(null);
  const [confirmDeleteCouponId, setConfirmDeleteCouponId] = useState<string | null>(null);
  const [confirmPurgeType, setConfirmPurgeType] = useState<'demo' | 'qa' | null>(null);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [confirmBanTarget, setConfirmBanTarget] = useState<{
    customer: { uid: string; name: string; customerCode?: string };
    currentlyBanned: boolean;
    banType: CustomerBanType;
    reason: string;
  } | null>(null);

  useEffect(() => {
    if (maintenanceConfig?.maintenanceMessage) {
      setMaintMessageInput(maintenanceConfig.maintenanceMessage);
    }
    if (maintenanceConfig) {
      setSurgeEnabledInput(Boolean(maintenanceConfig.surgeEnabled));
      setSurgeMultiplierInput(String(maintenanceConfig.surgeMultiplier ?? 1.2));
      setSmtpEnabledInput(Boolean(maintenanceConfig.smtpEnabled));
      if (maintenanceConfig.paymentMethods) {
        setPaymentMethodsInput(maintenanceConfig.paymentMethods);
      }
    }
  }, [maintenanceConfig]);

  useEffect(() => {
    if (activeSection !== 'security') return;
    let cancelled = false;
    fetch('/api/admin/smtp-status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setSmtpStatus(data);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeSection]);

  const activeBlockedList = useMemo(
    () =>
      Object.values(blockedEntities)
        .filter((item) => item.isBlocked)
        .sort((a, b) => (b.updatedAtIso || '').localeCompare(a.updatedAtIso || '')),
    [blockedEntities]
  );

  const openSupportCount = useMemo(
    () => supportTickets.filter((t) => t.status === 'open').length,
    [supportTickets]
  );

  const unansweredSupportCount = useMemo(
    () =>
      supportTickets.filter((t) => t.status === 'open' && !t.hasAdminReply)
        .length,
    [supportTickets]
  );

  // Merge rich PII adminCustomers with fallback customersDirectory
  const effectiveCustomers = useMemo<AdminCustomerRecord[]>(() => {
    const byUid = new Map<string, AdminCustomerRecord>();

    for (const dirItem of customersDirectory) {
      if (!dirItem.uid) continue;
      byUid.set(dirItem.uid, {
        uid: dirItem.uid,
        name: dirItem.name || 'عميل إدكاوي',
        phone: '',
        email: '',
        customerCode: dirItem.customerCode || '',
        neighborhood: dirItem.neighborhood || '',
        points: dirItem.points ?? 0,
        currentStreak: dirItem.currentStreak ?? 0,
        freeDeliveryRewards: dirItem.freeDeliveryRewards ?? 0,
        totalDeliveredOrders: dirItem.totalDeliveredOrders ?? 0,
        isBanned: Boolean(
          dirItem.isBanned || blockedEntities[dirItem.uid]?.isBlocked
        ),
        banType: dirItem.banType,
        banReason: dirItem.banReason,
        updatedAtIso: dirItem.updatedAtIso || '',
      });
    }

    for (const fullCust of adminCustomers) {
      if (!fullCust.uid) continue;
      const existing = byUid.get(fullCust.uid);
      byUid.set(fullCust.uid, {
        uid: fullCust.uid,
        name: fullCust.name || existing?.name || 'عميل إدكاوي',
        phone: fullCust.phone || existing?.phone || '',
        email: fullCust.email || existing?.email || '',
        customerCode: fullCust.customerCode || existing?.customerCode || '',
        neighborhood: fullCust.neighborhood || existing?.neighborhood || '',
        points: fullCust.points ?? existing?.points ?? 0,
        currentStreak: fullCust.currentStreak ?? existing?.currentStreak ?? 0,
        freeDeliveryRewards:
          fullCust.freeDeliveryRewards ?? existing?.freeDeliveryRewards ?? 0,
        totalDeliveredOrders:
          fullCust.totalDeliveredOrders ?? existing?.totalDeliveredOrders ?? 0,
        isBanned: Boolean(
          fullCust.isBanned ||
            existing?.isBanned ||
            blockedEntities[fullCust.uid]?.isBlocked
        ),
        banType: fullCust.banType || existing?.banType,
        banReason: fullCust.banReason || existing?.banReason,
        updatedAtIso: fullCust.updatedAtIso || existing?.updatedAtIso || '',
      });
    }

    return Array.from(byUid.values()).sort(
      (a, b) =>
        Number(b.isBanned) - Number(a.isBanned) ||
        b.points - a.points ||
        a.name.localeCompare(b.name, 'ar')
    );
  }, [adminCustomers, customersDirectory, blockedEntities]);

  const blockCandidateOptions = useMemo(() => {
    if (blockTargetType === 'store') {
      return stores.map((s) => ({
        id: s.id,
        name: s.name,
        label: `${s.category === 'صيدليات' ? 'صيدلية' : 'متجر'}: ${s.name} (${s.neighborhood})`,
      }));
    }
    if (blockTargetType === 'courier') {
      return couriers.map((c) => ({
        id: c.id,
        name: c.name,
        label: `مندوب: ${c.name} — ${c.phone} (${c.neighborhood})`,
      }));
    }
    return effectiveCustomers.map((cust) => ({
      id: cust.uid,
      name: cust.name,
      label: `عميل: ${cust.name}${cust.customerCode ? ` [${cust.customerCode}]` : ''}${cust.phone ? ` — ${cust.phone}` : ''}`,
    }));
  }, [blockTargetType, stores, couriers, effectiveCustomers]);

  const stats = useMemo(
    () => calculateAdminDashboardStats(orders, stores, couriers),
    [orders, stores, couriers]
  );

  const approvedCouriers = useMemo(
    () => couriers.filter((c) => c.approvalStatus === 'approved'),
    [couriers]
  );

  const pendingCouriers = useMemo(
    () => couriers.filter((c) => c.approvalStatus === 'pending'),
    [couriers]
  );

  const rejectedCouriers = useMemo(
    () => couriers.filter((c) => c.approvalStatus === 'rejected'),
    [couriers]
  );

  const filteredStores = useMemo(() => {
    const q = storeSearch.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.neighborhood.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
    );
  }, [stores, storeSearch]);

  const filteredOrders = useMemo(() => {
    if (orderStatusFilter === 'all') return orders;
    return orders.filter((o) => o.status === orderStatusFilter);
  }, [orders, orderStatusFilter]);

  const filteredCustomers = useMemo(
    () => filterAdminCustomers(effectiveCustomers, customerSearch),
    [effectiveCustomers, customerSearch]
  );

  const fraudAlerts = useMemo(
    () =>
      computeFraudDetectionAlerts({
        orders,
        customers: effectiveCustomers,
        couriers,
        blockedEntityIds: new Set(
          Object.keys(blockedEntities).filter(
            (id) => blockedEntities[id]?.isBlocked
          )
        ),
      }),
    [orders, effectiveCustomers, couriers, blockedEntities]
  );

  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return [...auditLogs]
      .sort((a, b) => (b.createdAtIso || '').localeCompare(a.createdAtIso || ''))
      .filter((log) => {
        if (auditActionFilter !== 'all' && log.actionType !== auditActionFilter) {
          return false;
        }
        if (!q) return true;
        return (
          log.details.toLowerCase().includes(q) ||
          log.adminId.toLowerCase().includes(q) ||
          (log.adminName ?? '').toLowerCase().includes(q) ||
          getAuditActionLabelAr(log.actionType).toLowerCase().includes(q)
        );
      });
  }, [auditLogs, auditSearch, auditActionFilter]);

  const activeStoresCount = useMemo(
    () => stores.filter((s) => s.isActive).length,
    [stores]
  );

  const totalUniqueUsersCount = useMemo(() => {
    const uids = new Set<string>();
    for (const c of effectiveCustomers) if (c.uid) uids.add(c.uid);
    for (const cr of couriers) if (cr.id) uids.add(cr.id);
    for (const st of stores) {
      const owner = st.ownerUid || storeCredentialsMap[st.id]?.ownerUid;
      if (owner) uids.add(owner);
    }
    for (const sm of staffMembers) if (sm.id) uids.add(sm.id);
    if (adminUid) uids.add(adminUid);
    return uids.size;
  }, [effectiveCustomers, couriers, stores, storeCredentialsMap, staffMembers, adminUid]);

  // Unified specific user recipients for direct notification targeting
  const specificRecipientOptions = useMemo(() => {
    const options: Array<{ uid: string; label: string }> = [];
    const seen = new Set<string>();

    for (const cust of customersDirectory) {
      if (cust.uid && !seen.has(cust.uid)) {
        seen.add(cust.uid);
        options.push({
          uid: cust.uid,
          label: `عميل: ${cust.name}${cust.neighborhood ? ` (${cust.neighborhood})` : ''}`,
        });
      }
    }

    for (const st of stores) {
      const uid = st.ownerUid || storeCredentialsMap[st.id]?.ownerUid;
      if (uid && !seen.has(uid)) {
        seen.add(uid);
        options.push({
          uid,
          label: `${st.category === 'صيدليات' ? 'صيدلية' : 'متجر'}: ${st.name} (${st.neighborhood})`,
        });
      }
    }

    for (const cr of couriers) {
      if (cr.id && !seen.has(cr.id)) {
        seen.add(cr.id);
        options.push({
          uid: cr.id,
          label: `مندوب: ${cr.name} (${cr.neighborhood})`,
        });
      }
    }

    return options;
  }, [customersDirectory, stores, storeCredentialsMap, couriers]);

  function flashSuccess(msg: string) {
    setSuccessBanner(msg);
    setTimeout(() => {
      setSuccessBanner((prev) => (prev === msg ? null : prev));
    }, 4000);
  }

  async function handleCopyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 2000);
    } catch {
      // Clipboard blocked in restricted iframe
    }
  }

  async function handleApproveClick(courierId: string) {
    setErrorBanner(null);
    setBusyKey(`approve_${courierId}`);
    try {
      await onApproveCourier(courierId, 'approved');
      flashSuccess('تم اعتماد حساب الكابتن بنجاح وإشعاره فوراً.');
    } catch (err) {
      setErrorBanner(formatAppErrorMessage(err, 'تعذر ترقية حساب المندوب.'));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRejectCourierClick(courierId: string) {
    const reason = (courierRejectReasonById[courierId] || '').trim();
    if (reason.length < 4) {
      setErrorBanner('يرجى كتابة سبب واضح لرفض مستندات المندوب (٤ أحرف على الأقل).');
      return;
    }
    setErrorBanner(null);
    setBusyKey(`reject_${courierId}`);
    try {
      await onApproveCourier(courierId, 'rejected', reason);
      setCourierRejectOpenId(null);
      flashSuccess('تم رفض مستندات المندوب وتسجيل السبب ليتمكن من التعديل وإعادة الرفع.');
    } catch (err) {
      setErrorBanner(formatAppErrorMessage(err, 'تعذر تسجيل رفض مستندات المندوب.'));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleStoreActiveToggle(store: StoreRecord) {
    setErrorBanner(null);
    setBusyKey(`store_${store.id}`);
    try {
      await onToggleStoreActive(store.id, !store.isActive);
    } catch (err) {
      setErrorBanner(formatAppErrorMessage(err, 'تعذر تحديث حالة المتجر.'));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleAssignCourierSelect(orderId: string, courierId: string) {
    const chosen = approvedCouriers.find((c) => c.id === courierId);
    if (!chosen) return;
    setErrorBanner(null);
    setBusyKey(`assign_${orderId}`);
    try {
      await onAssignCourierManually(orderId, chosen);
    } catch (err) {
      setErrorBanner(
        formatAppErrorMessage(err, 'تعذر تعيين المندوب على الطلب.')
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function handleCancelOrderClick(orderId: string) {
    setErrorBanner(null);
    setBusyKey(`cancel_${orderId}`);
    try {
      await onCancelOrder(orderId);
    } catch (err) {
      setErrorBanner(formatAppErrorMessage(err, 'تعذر إلغاء الطلب.'));
    } finally {
      setBusyKey(null);
    }
  }

  async function handlePurgeDemoClick() {
    if (!onPurgeDemoData) return;
    setErrorBanner(null);
    setBusyKey('purge_demo');
    try {
      const deleted = await onPurgeDemoData();
      flashSuccess(
        deleted > 0
          ? `تم حذف ${deleted} عنصر تجريبي قديم من قاعدة البيانات بنجاح.`
          : 'قاعدة البيانات نظيفة بالفعل من أي بيانات تجريبية.'
      );
    } catch (err) {
      setErrorBanner(
        formatAppErrorMessage(err, 'تعذر تنظيف البيانات التجريبية القديمة.')
      );
    } finally {
      setBusyKey(null);
    }
  }

  function closeAddCourierModal() {
    setCourierName('');
    setCourierPhone('');
    setCourierEmail('');
    setCourierPassword('');
    setCourierVehicle('دراجة نارية');
    setCourierArea(EDKU_NEIGHBORHOODS[0]);
    setCourierLat(EDKU_CITY_CENTER.lat);
    setCourierLng(EDKU_CITY_CENTER.lng);
    setCourierFormErrors({});
    setCreatedCourierCred(null);
    setIsAddCourierOpen(false);
  }

  async function handleCreateCourierSubmit(e: FormEvent) {
    e.preventDefault();
    const payload: AdminCreateCourierInput = {
      name: courierName,
      phone: courierPhone,
      email: courierEmail,
      password: courierPassword,
      vehicleType: courierVehicle,
      neighborhood: courierArea,
      lat: courierLat,
      lng: courierLng,
    };

    if (courierWaterPin) {
      setCourierFormErrors({
        submit: 'لا يمكن تثبيت تمركز الكابتن فوق مياه البحر المتوسط أو بحيرة إدكو. يرجى اختيار نقطة على اليابسة.',
      });
      return;
    }

    const check = validateCourierRegistrationForm(payload);
    if (!check.valid) {
      setCourierFormErrors(check.errors);
      return;
    }

    setCourierFormErrors({});
    setSubmittingCourier(true);
    try {
      const cred = await onCreateCourierByAdmin(payload);
      setCreatedCourierCred(cred);
    } catch (err) {
      setCourierFormErrors({
        submit: formatAppErrorMessage(
          err,
          'تعذر إنشاء حساب المندوب في قاعدة البيانات.'
        ),
      });
    } finally {
      setSubmittingCourier(false);
    }
  }

  // Invitations Handlers
  async function handleSendInvitationSubmit(e: FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setErrorBanner(null);
    setIsCreatingInvite(true);
    try {
      const result = await adminCreateInvitationInFirestore(
        inviteEmail.trim(),
        inviteRole,
        adminUid
      );
      flashSuccess(`تم إنشاء الدعوة بنجاح! الرابط: ${result.inviteLink}`);
      setIsCreateInviteModalOpen(false);
      setInviteEmail('');
    } catch (err) {
      setErrorBanner(formatAppErrorMessage(err, 'تعذر إنشاء الدعوة.'));
    } finally {
      setIsCreatingInvite(false);
    }
  }

  async function handleResendInvitation(invite: InvitationRecord) {
    setErrorBanner(null);
    setBusyKey(`resend_${invite.id}`);
    try {
      await adminResendInvitationInFirestore(invite.id);
      flashSuccess(`تم تمديد صلاحية الدعوة 48 ساعة وإعادة تجهيزها.`);
    } catch (err) {
      setErrorBanner(formatAppErrorMessage(err, 'تعذر إعادة إرسال الدعوة.'));
    } finally {
      setBusyKey(null);
    }
  }

  // Sales Agent Handlers
  async function handleSaveAgentCommission(agent: SalesAgentProfileRecord) {
    const rate = agentCommissionInput[agent.id] ?? agent.commissionRatePercent;
    setErrorBanner(null);
    setBusyKey(`comm_${agent.id}`);
    try {
      await adminUpdateSalesAgentCommissionInFirestore(agent.id, rate);
      flashSuccess(`تم تحديث عمولة الوكيل «${agent.name}» إلى ${rate}%.`);
    } catch (err) {
      setErrorBanner(formatAppErrorMessage(err, 'تعذر تعديل نسبة العمولة.'));
    } finally {
      setBusyKey(null);
    }
  }

  // Payout Handlers
  async function handleProcessPayout(reqId: string, approve: boolean) {
    const reason = payoutRejectionReason[reqId];
    setErrorBanner(null);
    setBusyKey(`payout_${reqId}`);
    try {
      await adminProcessPayoutRequestInFirestore(reqId, approve ? 'paid' : 'rejected', reason);
      flashSuccess(approve ? 'تم اعتماد التحويل وتأكيد الدفع للوكيل.' : 'تم رفض الطلب واسترداد الرصيد لمحفظة الوكيل.');
    } catch (err) {
      setErrorBanner(formatAppErrorMessage(err, 'تعذر معالجة طلب السحب.'));
    } finally {
      setBusyKey(null);
    }
  }

  // Password reset & update email handlers
  async function handleAdminSendPasswordReset(email: string) {
    setErrorBanner(null);
    setBusyKey(`reset_${email}`);
    try {
      await adminSendPasswordResetLinkInFirestore(email);
      flashSuccess(`تم إرسال رابط تعيين كلمة المرور رسمياً إلى بريد «${email}».`);
    } catch (err) {
      setErrorBanner(formatAppErrorMessage(err, 'تعذر إرسال رابط تعيين كلمة المرور.'));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleAdminUpdateEmailSubmit(e: FormEvent) {
    e.preventDefault();
    if (!adminChangeEmailTarget || !adminNewEmailInput.trim()) return;
    setErrorBanner(null);
    setBusyKey('update_email_btn');
    try {
      await adminUpdateAccountLoginEmailInFirestore(
        adminChangeEmailTarget.uid,
        adminNewEmailInput.trim(),
        adminChangeEmailTarget.name
      );
      flashSuccess(`تم تحديث البريد الإلكتروني للحساب إلى «${adminNewEmailInput.trim()}» بنجاح.`);
      setAdminChangeEmailTarget(null);
      setAdminNewEmailInput('');
    } catch (err) {
      setErrorBanner(formatAppErrorMessage(err, 'تعذر تحديث البريد الإلكتروني.'));
    } finally {
      setBusyKey(null);
    }
  }

  // Zone & Category Handlers
  async function handleSaveZonePrice(zone: EdkoZoneRecord) {
    const price = editingZonePrices[zone.id] ?? zone.deliveryFeeEgp;
    setErrorBanner(null);
    setBusyKey(`zone_${zone.id}`);
    try {
      await updateEdkoZoneInFirestore(zone.id, { deliveryFeeEgp: price });
      flashSuccess(`تم تحديث سعر ${zone.nameAr} إلى ${price} ج.م في قاعدة البيانات.`);
    } catch (err) {
      setErrorBanner(formatAppErrorMessage(err, 'تعذر تحديث سعر المنطقة.'));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSaveCategoryFee(cat: SuperAppCategoryRecord) {
    const fee = editingCategoryFee[cat.id] ?? cat.defaultDeliveryFeeEgp;
    setErrorBanner(null);
    setBusyKey(`cat_${cat.id}`);
    try {
      await updateSuperAppCategoryInFirestore(cat.id, { defaultDeliveryFeeEgp: fee });
      flashSuccess(`تم تحديث رسوم قسم «${cat.titleAr}» إلى ${fee} ج.م.`);
    } catch (err) {
      setErrorBanner(formatAppErrorMessage(err, 'تعذر تحديث رسوم القسم.'));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleCreateAdSubmit(e: FormEvent) {
    e.preventDefault();
    if (!onCreateAdBanner) return;
    setErrorBanner(null);

    if (!adImageUrl.trim()) {
      setErrorBanner('يرجى رفع صورة البنر الإعلاني من جهازك أولاً (إجباري).');
      return;
    }

    setSubmittingAd(true);
    try {
      const linkedStore = stores.find((s) => s.id === adStoreId);
      await onCreateAdBanner({
        title: adTitle.trim() || 'عرض مميز على إدكاوي',
        subtitle:
          adSubtitle.trim() || 'اطلب الآن مع توصيل سريع داخل مدينة إدكو',
        badgeText: adBadge.trim() || 'عرض حصري في إدكو',
        imageUrl: adImageUrl,
        storeId: linkedStore?.id || undefined,
        storeName: linkedStore?.name || undefined,
        ctaLabel:
          linkedStore?.category === 'صيدليات'
            ? 'أرسل روشتتك الآن'
            : 'اطلب الآن',
        startDateIso: adStartDate || undefined,
        endDateIso: adEndDate || undefined,
        isActive: true,
        sortOrder: Math.max(1, Math.trunc(Number(adSortOrder) || 1)),
      });
      setAdTitle('');
      setAdSubtitle('');
      setAdImageUrl('');
      setAdStoreId('');
      setAdStartDate('');
      setAdEndDate('');
      flashSuccess('تم رفع ونشر البنر الإعلاني فوراً في الصفحة الرئيسية للعملاء.');
    } catch (err) {
      setErrorBanner(
        formatAppErrorMessage(err, 'تعذر حفظ البنر الإعلاني في قاعدة البيانات.')
      );
    } finally {
      setSubmittingAd(false);
    }
  }

  async function handleSaveMaintenanceMode(nextMode: boolean) {
    setErrorBanner(null);
    setSavingMaintenance(true);
    try {
      if (onUpdateMaintenance) {
        await onUpdateMaintenance(nextMode, maintMessageInput);
      } else if (adminUid) {
        await updateSystemMaintenanceByAdminInFirestore(
          adminUid,
          nextMode,
          maintMessageInput
        );
      }
      flashSuccess(
        nextMode
          ? 'تم تفعيل وضع الصيانة بنجاح — يظهر إشعار الصيانة لغير المشرفين الآن.'
          : 'تم إيقاف وضع الصيانة وإعادة فتح المنصة لجميع المستخدمين.'
      );
    } catch (err) {
      setErrorBanner(
        formatAppErrorMessage(err, 'تعذر تحديث إعدادات وضع الصيانة.')
      );
    } finally {
      setSavingMaintenance(false);
    }
  }

  async function handleSaveSystemOperationsSettings() {
    if (!adminUid) return;
    setErrorBanner(null);
    setSavingOperationsSettings(true);
    try {
      const parsedMultiplier = Math.max(
        1,
        Math.min(3, Number(surgeMultiplierInput) || 1.2)
      );
      await updateSystemMaintenanceByAdminInFirestore(
        adminUid,
        Boolean(maintenanceConfig?.maintenanceMode),
        maintMessageInput,
        {
          surgeEnabled: surgeEnabledInput,
          surgeMultiplier: parsedMultiplier,
          smtpEnabled: smtpEnabledInput,
          paymentMethods: paymentMethodsInput,
        }
      );
      flashSuccess(
        'تم حفظ إعدادات تسعير الذروة ووسائل الدفع وحالة البريد بنجاح.'
      );
    } catch (err) {
      setErrorBanner(
        formatAppErrorMessage(err, 'تعذر حفظ إعدادات التشغيل في قاعدة البيانات.')
      );
    } finally {
      setSavingOperationsSettings(false);
    }
  }

  async function handleProcessWalletTopup(
    req: WalletTopupRequestRecord,
    decision: 'approved' | 'rejected'
  ) {
    if (!adminUid) return;
    setErrorBanner(null);
    setBusyKey(`topup_${req.id}`);
    try {
      await processWalletTopupByAdminInFirestore({
        requestId: req.id,
        decision,
        adminUid,
        adminNote: topupNoteById[req.id]?.trim() || undefined,
      });
      setTopupNoteById((prev) => ({ ...prev, [req.id]: '' }));
      flashSuccess(
        decision === 'approved'
          ? `تم اعتماد شحن ${req.amount} ج.م لمحفظة «${req.userName}» وإشعاره فوراً.`
          : `تم رفض طلب شحن «${req.userName}» وإشعاره بالسبب.`
      );
    } catch (err) {
      setErrorBanner(
        formatAppErrorMessage(err, 'تعذر معالجة طلب شحن المحفظة.')
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function handleCustomerBanExecute(input: {
    customer: { uid: string; name: string; customerCode?: string };
    currentlyBanned: boolean;
    banType: CustomerBanType;
    reason: string;
  }) {
    setErrorBanner(null);
    setBusyKey(`ban_cust_${input.customer.uid}`);
    const nextBanned = !input.currentlyBanned;
    try {
      if (adminUid) {
        await setCustomerBanStatusByAdminInFirestore(adminUid, {
          customerUid: input.customer.uid,
          customerName: input.customer.name,
          customerCode: input.customer.customerCode,
          isBanned: nextBanned,
          banType: nextBanned ? input.banType : undefined,
          reason: input.reason,
        });
      } else if (onBanCustomer) {
        await onBanCustomer(input.customer, nextBanned, input.reason);
      } else if (onSetEntityBlocked) {
        await onSetEntityBlocked({
          targetId: input.customer.uid,
          targetType: 'customer',
          targetName: input.customer.name,
          reason: input.reason,
          isBlocked: nextBanned,
        });
      }
      flashSuccess(
        nextBanned
          ? `تم حظر العميل «${input.customer.name}» بنجاح وإرسال إشعار له.`
          : `تم إلغاء حظر العميل «${input.customer.name}» وإعادة تفعيل حسابه.`
      );
    } catch (err) {
      setErrorBanner(
        formatAppErrorMessage(err, 'تعذر تحديث حالة حظر حساب العميل.')
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function handleBlockFormSubmit(e: FormEvent) {
    e.preventDefault();
    if (!onSetEntityBlocked) return;
    const cleanId = blockTargetId.trim();
    if (!cleanId) {
      setErrorBanner('يرجى اختيار الحساب أو المتجر المراد حظره أولاً.');
      return;
    }
    setErrorBanner(null);
    setSubmittingBlock(true);
    try {
      const matchedOpt = blockCandidateOptions.find((o) => o.id === cleanId);
      await onSetEntityBlocked({
        targetId: cleanId,
        targetType: blockTargetType,
        targetName: matchedOpt?.name || cleanId,
        reason:
          blockReason.trim() ||
          'تم إيقاف الحساب بقرار من إدارة منصة إدكاوي لمخالفة ضوابط الاستخدام.',
        isBlocked: true,
      });
      setBlockTargetId('');
      setBlockReason('');
      flashSuccess('تم حظر الحساب وتقييد صلاحياته في قاعدة البيانات فوراً.');
    } catch (err) {
      setErrorBanner(formatAppErrorMessage(err, 'تعذر تنفيذ عملية الحظر.'));
    } finally {
      setSubmittingBlock(false);
    }
  }

  async function handleQuickBlockToggle(input: {
    targetId: string;
    targetType: BlockedEntityType;
    targetName: string;
    currentlyBlocked: boolean;
  }) {
    if (!onSetEntityBlocked) return;
    setErrorBanner(null);
    setBusyKey(`block_${input.targetId}`);
    try {
      await onSetEntityBlocked({
        targetId: input.targetId,
        targetType: input.targetType,
        targetName: input.targetName,
        reason: input.currentlyBlocked
          ? 'تم رفع الحظر وإعادة تفعيل الحساب من إدارة إدكاوي.'
          : 'تم إيقاف الحساب مؤقتاً من لوحة إدارة إدكاوي.',
        isBlocked: !input.currentlyBlocked,
      });
      flashSuccess(
        input.currentlyBlocked
          ? `تم فك الحظر عن «${input.targetName}» بنجاح.`
          : `تم حظر «${input.targetName}» فوراً.`
      );
    } catch (err) {
      setErrorBanner(
        formatAppErrorMessage(err, 'تعذر تحديث حالة حظر الحساب.')
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function handleUpsertCouponSubmit(e: FormEvent) {
    e.preventDefault();
    if (!onUpsertCoupon) return;
    setErrorBanner(null);
    setSubmittingCoupon(true);
    try {
      await onUpsertCoupon({
        code: couponCode.trim().toUpperCase(),
        discountPercent: Math.trunc(Number(couponPercent) || 10),
        maxDiscountEgp: Math.trunc(Number(couponMaxEgp) || 100),
        minOrderEgp: Math.trunc(Number(couponMinOrder) || 0),
        description: couponDesc.trim(),
        expiryDateIso: couponExpiryDate || undefined,
        isActive: true,
      });
      setCouponCode('');
      setCouponDesc('');
      setCouponExpiryDate('');
      flashSuccess('تم حفظ وتفعيل كود الخصم بنجاح.');
    } catch (err) {
      setErrorBanner(
        formatAppErrorMessage(err, 'تعذر حفظ كود الخصم في قاعدة البيانات.')
      );
    } finally {
      setSubmittingCoupon(false);
    }
  }

  async function handleSendNotificationSubmit(e: FormEvent) {
    e.preventDefault();
    if (!onSendAdminNotification) return;
    setErrorBanner(null);
    setSendingNotif(true);
    try {
      await onSendAdminNotification({
        audience: notifAudience,
        recipientUid:
          notifAudience === 'specific_user' ? notifRecipientUid : undefined,
        title: notifTitle,
        body: notifBody,
        type: notifType,
      });
      setNotifTitle('');
      setNotifBody('');
      flashSuccess('تم إرسال الإشعار الداخلي بنجاح وظهوره لدى الفئة المستهدفة فوراً!');
    } catch (err) {
      setErrorBanner(
        formatAppErrorMessage(err, 'تعذر إرسال الإشعار الداخلي.')
      );
    } finally {
      setSendingNotif(false);
    }
  }

  async function handleCreateCampaignSubmit(e: FormEvent) {
    e.preventDefault();
    if (!onCreateCampaign) return;
    setErrorBanner(null);

    if (!campImageUrl.trim()) {
      setErrorBanner('يرجى رفع صورة الفعالية من جهازك أولاً (إجباري).');
      return;
    }

    setSubmittingCampaign(true);
    try {
      await onCreateCampaign({
        title: campTitle,
        subtitle: campSubtitle,
        badgeText: campBadge,
        campaignType: campType,
        multiplier:
          campType === 'points_multiplier'
            ? Math.max(2, Math.trunc(Number(campMultiplier) || 2))
            : undefined,
        discountPercent:
          campType === 'happy_hour' || campType === 'mystery_box'
            ? Math.max(5, Math.trunc(Number(campDiscountPct) || 20))
            : undefined,
        rewardPoints: Math.max(0, Math.trunc(Number(campRewardPoints) || 50)),
        targetNeighborhood: campNeighborhood || undefined,
        imageUrl: campImageUrl,
        isActive: true,
      });
      setCampTitle('');
      setCampSubtitle('');
      setCampImageUrl('');
      flashSuccess('تم إطلاق الفعالية الدورية وظهورها للعملاء بنجاح!');
    } catch (err) {
      setErrorBanner(
        formatAppErrorMessage(err, 'تعذر حفظ الفعالية في قاعدة البيانات.')
      );
    } finally {
      setSubmittingCampaign(false);
    }
  }

  async function handleGiftPointsClick(customer: CustomerDirectoryEntry) {
    if (!onGiftCustomerPoints) return;
    const rawBonus = giftPointsByUid[customer.uid] ?? '50';
    const bonus = Math.trunc(Number(rawBonus));
    if (Number.isNaN(bonus) || bonus <= 0) {
      setErrorBanner('يرجى إدخال عدد نقاط صحيح أكبر من صفر.');
      return;
    }
    setErrorBanner(null);
    setBusyKey(`gift_${customer.uid}`);
    try {
      await onGiftCustomerPoints(
        customer,
        bonus,
        giftNoteByUid[customer.uid]?.trim() || undefined
      );
      setGiftPointsByUid((prev) => ({ ...prev, [customer.uid]: '' }));
      setGiftNoteByUid((prev) => ({ ...prev, [customer.uid]: '' }));
      flashSuccess(
        `تم إهداء +${bonus} نقطة للعميل "${customer.name}" وإرسال إشعار فوري له!`
      );
    } catch (err) {
      setErrorBanner(formatAppErrorMessage(err, 'تعذر إهداء النقاط للعميل.'));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleCustomerBanToggle(
    customer: { uid: string; name: string; customerCode?: string },
    currentlyBanned: boolean,
    customReason?: string
  ) {
    setErrorBanner(null);
    setBusyKey(`ban_cust_${customer.uid}`);
    const nextBanned = !currentlyBanned;
    const reason =
      customReason ||
      (nextBanned
        ? 'تم حظر الحساب لمخالفة سياسة الاستخدام — يرجى التواصل مع الدعم'
        : 'تم إلغاء الحظر وإعادة تفعيل حساب العميل');
    try {
      if (onBanCustomer) {
        await onBanCustomer(customer, nextBanned, reason);
      } else if (onSetEntityBlocked) {
        await onSetEntityBlocked({
          targetId: customer.uid,
          targetType: 'customer',
          targetName: customer.name,
          reason,
          isBlocked: nextBanned,
        });
      }
      flashSuccess(
        nextBanned
          ? `تم حظر العميل «${customer.name}» وتحديث حقل (isBanned: true) وإرسال إشعار فوري له.`
          : `تم إلغاء حظر العميل «${customer.name}» وإعادة تفعيل الطلبات له.`
      );
    } catch (err) {
      setErrorBanner(
        formatAppErrorMessage(err, 'تعذر تحديث حالة حظر حساب العميل.')
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSaveStoreDeliveryFee(store: StoreRecord) {
    if (!onUpdateStoreDeliveryFee) return;
    const rawVal = storeFeeInputById[store.id] ?? String(store.deliveryFee);
    const parsed = Math.trunc(Number(rawVal));
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 300) {
      setErrorBanner('يرجى إدخال سعر توصيل صحيح بين 0 و 300 ج.م.');
      return;
    }
    setErrorBanner(null);
    setBusyKey(`fee_${store.id}`);
    try {
      await onUpdateStoreDeliveryFee(store, parsed);
      flashSuccess(
        `تم تحديث سعر التوصيل لمتجر «${store.name}» إلى ${parsed} ج.م وتسجيل العملية.`
      );
    } catch (err) {
      setErrorBanner(
        formatAppErrorMessage(err, 'تعذر تعديل سعر توصيل المتجر.')
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDeleteProductByAdminClick(
    product: ProductRecord,
    storeName?: string
  ) {
    if (!onDeleteProductByAdmin) return;
    setErrorBanner(null);
    setBusyKey(`del_prod_${product.id}`);
    try {
      await onDeleteProductByAdmin(product, storeName);
      flashSuccess(`تم حذف المنتج «${product.name}» وتسجيل العملية في السجل.`);
    } catch (err) {
      setErrorBanner(formatAppErrorMessage(err, 'تعذر حذف المنتج.'));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRunSimulateOrderTest() {
    if (!onSimulateOrderTest) return;
    setErrorBanner(null);
    setQaRunningAction('simulate');
    try {
      const report = await onSimulateOrderTest();
      setQaSimulationReport(report);
      if (report.ok) {
        flashSuccess(
          `نجح اختبار دورة الطلب الوهمي بالكامل (${report.totalDurationMs} مللي ثانية) وتم مسحه تلقائياً.`
        );
      } else {
        setErrorBanner(report.summaryAr);
      }
    } catch (err) {
      setErrorBanner(
        formatAppErrorMessage(err, 'تعذر تنفيذ اختبار الطلب الوهمي.')
      );
    } finally {
      setQaRunningAction(null);
    }
  }

  async function handleRunFirebaseHealthCheck() {
    if (!onCheckFirebaseHealth) return;
    setErrorBanner(null);
    setQaRunningAction('health');
    try {
      const result = await onCheckFirebaseHealth();
      setQaHealthResult(result);
      if (result.connected) {
        flashSuccess(
          `قاعدة بيانات Firebase متصلة بنجاح — سرعة الاستجابة ${result.latencyMs}ms (${result.responsivenessPercent}%).`
        );
      } else {
        setErrorBanner(result.errorDetail || 'تعذر الاتصال بقاعدة البيانات.');
      }
    } catch (err) {
      setErrorBanner(
        formatAppErrorMessage(err, 'تعذر فحص الاتصال بقاعدة البيانات.')
      );
    } finally {
      setQaRunningAction(null);
    }
  }

  async function handleRunPurgeTestData() {
    const fn = onPurgeAllTestData ?? onPurgeDemoData;
    if (!fn) return;
    setErrorBanner(null);
    setQaRunningAction('purge');
    try {
      const deletedCount = await fn();
      flashSuccess(
        deletedCount > 0
          ? `تم مسح ${deletedCount} سجل اختبار / بيانات وهمية بنجاح.`
          : 'قاعدة البيانات نظيفة تماماً ولا توجد أي بيانات اختبار متبقية.'
      );
    } catch (err) {
      setErrorBanner(formatAppErrorMessage(err, 'تعذر مسح بيانات الاختبار.'));
    } finally {
      setQaRunningAction(null);
    }
  }

  const sectionMeta: Record<
    AdminSidebarSection,
    { title: string; subtitle: string }
  > = {
    overview: {
      title: 'نظرة عامة على منظومة إدكاوي',
      subtitle:
        'متابعة المبيعات والطلبات النشطة وخريطة المناديب والمتاجر الحية في مدينة إدكو',
    },
    stores: {
      title: 'إدارة المتاجر والصيدليات',
      subtitle:
        'إضافة المتاجر والصيدليات وتعديل رسوم التوصيل ومراجعة المنتجات وتوليد بيانات الدخول',
    },
    requests: {
      title: 'طلبات انضمام المتاجر والمطاعم الجديدة',
      subtitle:
        'مراجعة طلبات الشراكة الواردة من صفحة /join والموافقة على فتح المتجر أو رفضه مع ذكر السبب',
    },
    couriers: {
      title: 'إدارة المندوبين وطلبات الانضمام',
      subtitle:
        'متابعة مواقع المناديب على خريطة إدكو وإضافة واعتماد الكباتن',
    },
    orders: {
      title: 'غرفة متابعة الطلبات والروشتات',
      subtitle:
        'متابعة طلبات المطاعم ونظام الصيدليات وتعيين المناديب يدوياً عند الحاجة',
    },
    invitations: {
      title: 'إدارة الدعوات المعتمدة',
      subtitle:
        'إرسال روابط دعوة آمنة للمتاجر ومسؤولي المبيعات والمناديب وتتبع حالة كل دعوة فورياً',
    },
    sales_agents: {
      title: 'إدارة مسؤولي المبيعات (Sales Agents CRM)',
      subtitle:
        'متابعة الحسابات المُجلبة بواسطة كل وكيل، رصيد المحفظة، ونسب العمولات القابلة للتعديل',
    },
    payouts: {
      title: 'طلبات سحب الأرباح والعمولات',
      subtitle:
        'مراجعة طلبات سحب الأرباح لمسؤولي المبيعات عبر فودافون كاش وإنستاباي واعتمادها أو رفضها مع السبب',
    },
    wallet_topups: {
      title: 'مراجعة طلبات شحن محافظ العملاء',
      subtitle:
        'اعتماد تحويلات فودافون كاش وإنستاباي وإضافة الرصيد لمحفظة العميل في Firestore أو رفض الطلب مع ذكر السبب',
    },
    zones_categories: {
      title: 'إدارة مناطق التوصيل والتسعير الجغرافي والأقسام',
      subtitle:
        'التحكم في تسعيرة مناطق إدكو الخمس المعتمدة (edko_zones) وأقسام تطبيق السوبر آب الرئيسية',
    },
    customers: {
      title: 'صفحة العملاء وكود العميل الفريد',
      subtitle:
        'البحث بالاسم أو رقم الموبايل أو كود العميل (EDK-USR-XXXX)، الحظر الفوري، وإهداء نقاط الولاء',
    },
    ads: {
      title: 'إدارة البنرات الإعلانية',
      subtitle:
        'رفع البنرات الترويجية بصور حقيقية من جهازك وعرضها فوراً في واجهة العميل',
    },
    coupons: {
      title: 'إدارة كوبونات الخصم',
      subtitle:
        'إنشاء وتفعيل أكواد الخصم الترويجية مع تحديد الحد الأدنى وتاريخ الانتهاء',
    },
    notifications: {
      title: 'مركز الإشعارات الداخلية',
      subtitle:
        'إرسال إشعارات فورية من الإدارة إلى العملاء أو المتاجر والصيدليات أو المناديب',
    },
    campaigns: {
      title: 'الفعاليات الدورية وتحديات إدكو',
      subtitle:
        'إطلاق فعاليات مضاعفة النقاط وساعة السعادة وتحديات الأحياء بصور حقيقية',
    },
    loyalty: {
      title: 'صفحة العملاء وكود العميل الفريد',
      subtitle:
        'البحث بالاسم أو رقم الموبايل أو كود العميل (EDK-USR-XXXX)، الحظر الفوري، وإهداء نقاط الولاء',
    },
    security: {
      title: 'مركز الأمان ومكافحة التلاعب والاحتيال',
      subtitle:
        'رصد السلوك المشبوه تلقائياً، التحكم في وضع الصيانة، وحظر الحسابات المخالفة فوراً',
    },
    testing: {
      title: 'مركز الاختبارات وفحص الجاهزية (QA Center)',
      subtitle:
        'اختبار دورة الطلبات الكاملة في Firestore، قياس سرعة الاستجابة، والتحقق من عدادات المنصة الحية',
    },
    audit_logs: {
      title: 'سجل العمليات الإدارية (Audit Logs)',
      subtitle:
        'سجل أمني غير قابل للتلاعب يوثق جميع الإجراءات الحساسة للأدمن مرتبة من الأحدث للأقدم',
    },
    support: {
      title: 'الدعم الفني والشات المباشر',
      subtitle:
        'استقبال تذاكر الدعم من العملاء والمتاجر والكباتن والرد الفوري وتعيين مسؤولي الدعم',
    },
    staff: {
      title: 'إدارة فريق العمل والصلاحيات',
      subtitle:
        'إضافة مسؤولي الدعم الفني ومسؤولي العمليات والتحكم في صلاحية وحالة كل موظف',
    },
  };

  function selectSection(sec: AdminSidebarSection) {
    setActiveSection(sec);
    setMobileSidebarOpen(false);
    setErrorBanner(null);
    setSuccessBanner(null);
  }

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#1E293B] text-white select-none">
      <div className="h-16 px-5 border-b border-slate-700/80 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <AdkawyLogo variant="navbar" />
          <span className="text-xs font-semibold text-slate-300 truncate">
            لوحة الإدارة
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(false)}
          aria-label="إغلاق القائمة الجانبية"
          className="lg:hidden p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      <nav
        aria-label="أقسام لوحة الإدارة"
        className="flex-1 overflow-y-auto px-3.5 py-4 space-y-1"
      >
        <button
          type="button"
          onClick={() => selectSection('overview')}
          className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap ${
            activeSection === 'overview'
              ? 'bg-[#FF6B00] text-white'
              : 'text-slate-200 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <LayoutDashboard className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>نظرة عامة</span>
        </button>

        <button
          type="button"
          onClick={() => selectSection('requests')}
          className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
            activeSection === 'requests'
              ? 'bg-[#FF6B00] text-white'
              : 'text-slate-200 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
            <StoreIcon className="w-4 h-4 shrink-0 text-amber-400" aria-hidden="true" />
            <span>طلبات الانضمام</span>
          </span>
          {storeJoinRequests.filter((r) => r.status === 'pending').length > 0 ? (
            <span className="font-mono text-xs font-bold tabular-nums px-2 py-0.5 rounded-md bg-amber-950/250 text-white animate-pulse">
              {storeJoinRequests.filter((r) => r.status === 'pending').length}
            </span>
          ) : (
            <span className="font-mono text-xs font-bold tabular-nums px-2 py-0.5 rounded-md bg-slate-800 text-slate-400">
              {storeJoinRequests.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => selectSection('stores')}
          className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
            activeSection === 'stores'
              ? 'bg-[#FF6B00] text-white'
              : 'text-slate-200 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
            <StoreIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>المتاجر والصيدليات</span>
          </span>
          <span
            className={`font-mono text-xs font-bold tabular-nums px-2 py-0.5 rounded-md ${
              activeSection === 'stores'
                ? 'bg-black/25 text-[#F8FAFC]'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            {stores.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => selectSection('couriers')}
          className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
            activeSection === 'couriers'
              ? 'bg-[#FF6B00] text-white'
              : 'text-slate-200 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
            <Truck className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>إدارة المندوبين</span>
          </span>
          <span
            className={`font-mono text-xs font-bold tabular-nums px-2 py-0.5 rounded-md ${
              activeSection === 'couriers'
                ? 'bg-black/25 text-[#F8FAFC]'
                : stats.pendingCouriersCount > 0
                ? 'bg-[#FF6B00] text-white'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            {stats.pendingCouriersCount > 0
              ? stats.pendingCouriersCount
              : couriers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => selectSection('orders')}
          className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
            activeSection === 'orders'
              ? 'bg-[#FF6B00] text-white'
              : 'text-slate-200 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
            <ShoppingBag className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>الطلبات والروشتات</span>
          </span>
          <span
            className={`font-mono text-xs font-bold tabular-nums px-2 py-0.5 rounded-md ${
              activeSection === 'orders'
                ? 'bg-black/25 text-[#F8FAFC]'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            {orders.length}
          </span>
        </button>

        {/* 1. Invitations Management */}
        <button
          type="button"
          onClick={() => selectSection('invitations')}
          className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
            activeSection === 'invitations'
              ? 'bg-[#FF6B00] text-white'
              : 'text-slate-200 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
            <Mail className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>إدارة الدعوات</span>
          </span>
          <span
            className={`font-mono text-xs font-bold tabular-nums px-2 py-0.5 rounded-md ${
              activeSection === 'invitations'
                ? 'bg-black/25 text-[#F8FAFC]'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            {invitations.length}
          </span>
        </button>

        {/* 2. Sales Agents */}
        <button
          type="button"
          onClick={() => selectSection('sales_agents')}
          className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
            activeSection === 'sales_agents'
              ? 'bg-[#FF6B00] text-white'
              : 'text-slate-200 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
            <TrendingUp className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>مسؤولو المبيعات</span>
          </span>
          <span
            className={`font-mono text-xs font-bold tabular-nums px-2 py-0.5 rounded-md ${
              activeSection === 'sales_agents'
                ? 'bg-black/25 text-[#F8FAFC]'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            {salesAgents.length}
          </span>
        </button>

        {/* 3. Payout Requests */}
        <button
          type="button"
          onClick={() => selectSection('payouts')}
          className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
            activeSection === 'payouts'
              ? 'bg-[#FF6B00] text-white'
              : 'text-[#F8FAFC] hover:bg-[#0F172A]'
          }`}
        >
          <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
            <DollarSign className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>طلبات السحب (Payouts)</span>
          </span>
          <span
            className={`font-mono text-xs font-bold tabular-nums px-2 py-0.5 rounded-md ${
              activeSection === 'payouts'
                ? 'bg-black/25 text-[#F8FAFC]'
                : payoutRequests.filter(p => p.status === 'pending').length > 0
                ? 'bg-amber-950/250 text-slate-950'
                : 'bg-[#0F172A] text-[#94A3B8]'
            }`}
          >
            {payoutRequests.filter(p => p.status === 'pending').length}
          </span>
        </button>

        {/* 3.5. Customer Wallet Top-Ups */}
        <button
          type="button"
          onClick={() => selectSection('wallet_topups')}
          className={`w-full px-3.5 py-2.5 rounded-2xl text-sm font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
            activeSection === 'wallet_topups'
              ? 'bg-[#FF6B00] text-[#F8FAFC]'
              : 'text-[#F8FAFC] hover:bg-[#0F172A]'
          }`}
        >
          <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
            <Wallet className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>شحن محافظ العملاء</span>
          </span>
          <span
            className={`font-mono text-xs font-bold tabular-nums px-2 py-0.5 rounded-md ${
              activeSection === 'wallet_topups'
                ? 'bg-black/25 text-[#F8FAFC]'
                : adminWalletTopups.filter((t) => t.status === 'pending').length > 0
                ? 'bg-amber-950/250 text-slate-950'
                : 'bg-[#0F172A] text-[#94A3B8]'
            }`}
          >
            {adminWalletTopups.filter((t) => t.status === 'pending').length}
          </span>
        </button>

        {/* 4. Zones & Categories */}
        <button
          type="button"
          onClick={() => selectSection('zones_categories')}
          className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
            activeSection === 'zones_categories'
              ? 'bg-[#FF6B00] text-[#F8FAFC]'
              : 'text-[#F8FAFC] hover:bg-[#0F172A]'
          }`}
        >
          <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
            <MapIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>مناطق وتصنيفات إدكو</span>
          </span>
          <span
            className={`font-mono text-xs font-bold tabular-nums px-2 py-0.5 rounded-md ${
              activeSection === 'zones_categories'
                ? 'bg-black/25 text-[#F8FAFC]'
                : 'bg-[#0F172A] text-[#94A3B8]'
            }`}
          >
            {edkoZones.length || 5}
          </span>
        </button>

        <button
          type="button"
          onClick={() => selectSection('support')}
          className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
            activeSection === 'support'
              ? 'bg-[#FF6B00] text-[#F8FAFC]'
              : 'text-[#F8FAFC] hover:bg-[#0F172A]'
          }`}
        >
          <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
            <Headphones className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>الدعم الفني</span>
          </span>
          <span
            className={`font-mono text-xs font-bold tabular-nums px-2 py-0.5 rounded-md ${
              activeSection === 'support'
                ? 'bg-black/25 text-[#F8FAFC]'
                : unansweredSupportCount > 0
                ? 'bg-[#FF6B00] text-[#F8FAFC]'
                : openSupportCount > 0
                ? 'bg-amber-950/250 text-slate-950'
                : 'bg-[#0F172A] text-[#94A3B8]'
            }`}
          >
            {unansweredSupportCount > 0
              ? unansweredSupportCount
              : openSupportCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => selectSection('staff')}
          className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
            activeSection === 'staff'
              ? 'bg-[#FF6B00] text-[#F8FAFC]'
              : 'text-[#F8FAFC] hover:bg-[#0F172A]'
          }`}
        >
          <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
            <Users className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>فريق العمل</span>
          </span>
          <span
            className={`font-mono text-xs font-bold tabular-nums px-2 py-0.5 rounded-md ${
              activeSection === 'staff'
                ? 'bg-black/25 text-[#F8FAFC]'
                : 'bg-[#0F172A] text-[#94A3B8]'
            }`}
          >
            {staffMembers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => selectSection('notifications')}
          className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
            activeSection === 'notifications'
              ? 'bg-[#FF6B00] text-[#F8FAFC]'
              : 'text-[#F8FAFC] hover:bg-[#0F172A]'
          }`}
        >
          <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
            <Bell className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>الإشعارات الداخلية</span>
          </span>
          <span
            className={`font-mono text-xs font-bold tabular-nums px-2 py-0.5 rounded-md ${
              activeSection === 'notifications'
                ? 'bg-black/25 text-[#F8FAFC]'
                : 'bg-[#0F172A] text-[#94A3B8]'
            }`}
          >
            {broadcastHistory.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => selectSection('ads')}
          className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
            activeSection === 'ads'
              ? 'bg-[#FF6B00] text-[#F8FAFC]'
              : 'text-[#F8FAFC] hover:bg-[#0F172A]'
          }`}
        >
          <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
            <Megaphone className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>البنرات الإعلانية</span>
          </span>
          <span
            className={`font-mono text-xs font-bold tabular-nums px-2 py-0.5 rounded-md ${
              activeSection === 'ads'
                ? 'bg-black/25 text-[#F8FAFC]'
                : 'bg-[#0F172A] text-[#94A3B8]'
            }`}
          >
            {ads.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => selectSection('campaigns')}
          className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
            activeSection === 'campaigns'
              ? 'bg-[#FF6B00] text-[#F8FAFC]'
              : 'text-[#F8FAFC] hover:bg-[#0F172A]'
          }`}
        >
          <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
            <Flame className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>الفعاليات الدورية</span>
          </span>
          <span
            className={`font-mono text-xs font-bold tabular-nums px-2 py-0.5 rounded-md ${
              activeSection === 'campaigns'
                ? 'bg-black/25 text-[#F8FAFC]'
                : 'bg-[#0F172A] text-[#94A3B8]'
            }`}
          >
            {campaigns.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => selectSection('coupons')}
          className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
            activeSection === 'coupons'
              ? 'bg-[#FF6B00] text-[#F8FAFC]'
              : 'text-[#F8FAFC] hover:bg-[#0F172A]'
          }`}
        >
          <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
            <Tag className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>إدارة الكوبونات</span>
          </span>
          <span
            className={`font-mono text-xs font-bold tabular-nums px-2 py-0.5 rounded-md ${
              activeSection === 'coupons'
                ? 'bg-black/25 text-[#F8FAFC]'
                : 'bg-[#0F172A] text-[#94A3B8]'
            }`}
          >
            {coupons.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => selectSection('customers')}
          className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
            activeSection === 'customers' || activeSection === 'loyalty'
              ? 'bg-[#FF6B00] text-[#F8FAFC]'
              : 'text-[#F8FAFC] hover:bg-[#0F172A]'
          }`}
        >
          <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
            <Users className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>العملاء</span>
          </span>
          <span
            className={`font-mono text-xs font-bold tabular-nums px-2 py-0.5 rounded-md ${
              activeSection === 'customers' || activeSection === 'loyalty'
                ? 'bg-black/25 text-[#F8FAFC]'
                : 'bg-[#0F172A] text-[#94A3B8]'
            }`}
          >
            {effectiveCustomers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => selectSection('security')}
          className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
            activeSection === 'security'
              ? 'bg-[#FF6B00] text-[#F8FAFC]'
              : 'text-[#F8FAFC] hover:bg-[#0F172A]'
          }`}
        >
          <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
            <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>مركز الأمان</span>
          </span>
          <span
            className={`font-mono text-xs font-bold tabular-nums px-2 py-0.5 rounded-md ${
              activeSection === 'security'
                ? 'bg-black/25 text-[#F8FAFC]'
                : maintenanceConfig?.maintenanceMode
                ? 'bg-amber-950/250 text-slate-950'
                : fraudAlerts.length > 0 || activeBlockedList.length > 0
                ? 'bg-red-950/300 text-[#F8FAFC]'
                : 'bg-[#0F172A] text-[#94A3B8]'
            }`}
          >
            {maintenanceConfig?.maintenanceMode
              ? 'صيانة'
              : fraudAlerts.length > 0
              ? fraudAlerts.length
              : activeBlockedList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => selectSection('testing')}
          className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
            activeSection === 'testing'
              ? 'bg-[#FF6B00] text-[#F8FAFC]'
              : 'text-[#F8FAFC] hover:bg-[#0F172A]'
          }`}
        >
          <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
            <Beaker className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>مركز الاختبارات</span>
          </span>
          <span
            className={`font-mono text-xs font-bold tabular-nums px-2 py-0.5 rounded-md ${
              activeSection === 'testing'
                ? 'bg-black/25 text-[#F8FAFC]'
                : 'bg-[#0F172A] text-[#94A3B8]'
            }`}
          >
            QA
          </span>
        </button>

        <button
          type="button"
          onClick={() => selectSection('audit_logs')}
          className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
            activeSection === 'audit_logs'
              ? 'bg-[#FF6B00] text-[#F8FAFC]'
              : 'text-[#F8FAFC] hover:bg-[#0F172A]'
          }`}
        >
          <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
            <FileText className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>سجل العمليات</span>
          </span>
          <span
            className={`font-mono text-xs font-bold tabular-nums px-2 py-0.5 rounded-md ${
              activeSection === 'audit_logs'
                ? 'bg-black/25 text-[#F8FAFC]'
                : 'bg-[#0F172A] text-[#94A3B8]'
            }`}
          >
            {auditLogs.length}
          </span>
        </button>
      </nav>

      <div className="p-4 border-t border-[#334155] space-y-2.5 shrink-0">
        <div className="px-2 py-1 text-xs">
          <p className="font-bold text-[#F8FAFC]">إدارة تطبيق إدكاوي المركزية</p>
          <p
            dir="ltr"
            className="text-[#94A3B8] font-mono text-[11px] truncate text-right mt-0.5"
          >
            edkawy.app
          </p>
        </div>

        <button
          type="button"
          onClick={() => setConfirmLogoutOpen(true)}
          className="w-full py-2.5 px-3 rounded-xl bg-[#0F172A] hover:bg-[#334155] border border-[#334155] text-xs font-bold text-[#F8FAFC] inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          <LogOut className="w-3.5 h-3.5 text-[#FF6B00]" aria-hidden="true" />
          <span>تسجيل الخروج من الإدارة</span>
        </button>
      </div>
    </div>
  );

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#0F172A] text-[#F8FAFC] flex flex-col lg:flex-row"
    >
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden lg:block w-[268px] shrink-0 sticky top-0 h-screen border-l border-[#334155]">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileSidebarOpen && (
        <div
          className="edkawi-modal-backdrop lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="قائمة لوحة الإدارة"
        >
          <div className="w-[274px] max-w-[84vw] h-full shadow-xl">
            {sidebarContent}
          </div>
          <div
            className="flex-1"
            onClick={() => setMobileSidebarOpen(false)}
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-[#1E293B] border-b border-[#334155] px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="فتح القائمة الجانبية"
              className="lg:hidden p-2 rounded-xl border border-[#334155] text-[#F8FAFC] hover:bg-[#0F172A] cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>

            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-[#F8FAFC] truncate">
                {sectionMeta[activeSection].title}
              </h1>
              <p className="text-xs text-[#94A3B8] truncate hidden sm:block">
                {sectionMeta[activeSection].subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => selectSection('support')}
              aria-label="فتح تذاكر الدعم الفني"
              title="تذاكر الدعم الفني المفتوحة"
              className={`relative min-h-[40px] px-3 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer whitespace-nowrap ${
                unansweredSupportCount > 0
                  ? 'bg-[#FF6B00] border-[#FF6B00] text-[#F8FAFC]'
                  : 'border-[#334155] bg-[#0F172A] text-[#F8FAFC] hover:border-[#FF6B00]'
              }`}
            >
              <Headphones className="w-4 h-4" />
              <span className="hidden md:inline">الدعم الفني</span>
              {(unansweredSupportCount > 0 || openSupportCount > 0) && (
                <span
                  className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center tabular-nums ${
                    unansweredSupportCount > 0
                      ? 'bg-[#0F172A] text-[#FF6B00]'
                      : 'bg-[#FF6B00] text-[#F8FAFC]'
                  }`}
                >
                  {unansweredSupportCount > 0
                    ? unansweredSupportCount
                    : openSupportCount}
                </span>
              )}
            </button>

            {onOpenNotifications && (
              <button
                type="button"
                onClick={onOpenNotifications}
                aria-label="فتح الإشعارات"
                className="relative min-h-[40px] min-w-[40px] rounded-xl border border-[#334155] bg-[#0F172A] flex items-center justify-center text-[#F8FAFC] hover:border-[#FF6B00] cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF6B00] text-[#F8FAFC] text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {unreadNotificationsCount > 99
                      ? '99+'
                      : unreadNotificationsCount}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onOpenAddStoreModal}
              className="py-2 px-3.5 sm:px-4 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] text-[#F8FAFC] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>إضافة متجر / صيدلية</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-6xl w-full mx-auto space-y-6">
          {errorBanner && (
            <div
              role="alert"
              className="p-4 rounded-2xl bg-red-950/60 border border-red-700/60 text-red-200 text-xs sm:text-sm font-semibold"
            >
              {errorBanner}
            </div>
          )}

          {successBanner && (
            <div
              role="status"
              className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-700/60 text-emerald-200 text-xs sm:text-sm font-semibold flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successBanner}</span>
            </div>
          )}

          {/* ================================================================
           * 1. OVERVIEW SECTION (نظرة عامة + خريطة الأسطول الحية)
           * ============================================================== */}
          {activeSection === 'overview' && (
            <section className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="edkawi-soft-card p-5 space-y-1.5">
                  <p className="text-xs font-bold text-[#94A3B8]">
                    إجمالي المبيعات المسجلة
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-[#FF6B00] font-mono tabular-nums">
                    {stats.totalSalesEgp}{' '}
                    <span className="text-xs font-sans font-semibold text-[#94A3B8]">
                      ج.م
                    </span>
                  </p>
                  <p className="text-xs text-slate-400">
                    منها {stats.deliveredRevenueEgp} ج.م طلبات مكتملة
                  </p>
                </div>

                <div className="edkawi-soft-card p-5 space-y-1.5">
                  <p className="text-xs font-bold text-[#94A3B8]">
                    الطلبات والروشتات النشطة
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-[#F8FAFC] font-mono tabular-nums">
                    {stats.activeOrdersCount}
                  </p>
                  <p className="text-xs text-slate-400">
                    من إجمالي {stats.totalOrdersCount} طلب في النظام
                  </p>
                </div>

                <div className="edkawi-soft-card p-5 space-y-1.5">
                  <p className="text-xs font-bold text-[#94A3B8]">
                    المتاجر والصيدليات المسجلة
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-[#F8FAFC] font-mono tabular-nums">
                    {stores.length}
                  </p>
                  <p className="text-xs text-slate-400">
                    نشط: {stats.activeStoresCount} · موقوف:{' '}
                    {stats.pausedStoresCount}
                  </p>
                </div>

                <div className="edkawi-soft-card p-5 space-y-1.5">
                  <p className="text-xs font-bold text-[#94A3B8]">
                    المناديب المعتمدون
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-[#F8FAFC] font-mono tabular-nums">
                    {stats.approvedCouriersCount}
                  </p>
                  <p className="text-xs text-slate-400">
                    متاح الآن: {stats.availableCouriersCount} · قيد المراجعة:{' '}
                    {stats.pendingCouriersCount}
                  </p>
                </div>
              </div>

              {/* Quick Actions Bar */}
              <div className="edkawi-soft-card p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => selectSection('notifications')}
                    className="py-2 px-3.5 rounded-xl bg-[#1E293B] hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Bell className="w-3.5 h-3.5 text-[#FF6B00]" />
                    <span>إرسال إشعار داخلي</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => selectSection('ads')}
                    className="py-2 px-3.5 rounded-xl border border-[#334155] hover:border-[#FF6B00] text-xs font-bold text-[#F8FAFC] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Megaphone className="w-3.5 h-3.5 text-[#FF6B00]" />
                    <span>رفع بنر إعلاني</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => selectSection('campaigns')}
                    className="py-2 px-3.5 rounded-xl border border-[#334155] hover:border-[#FF6B00] text-xs font-bold text-[#F8FAFC] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Flame className="w-3.5 h-3.5 text-[#FF6B00]" />
                    <span>إطلاق فعالية دورية</span>
                  </button>
                </div>

                {onPurgeDemoData && (
                  <button
                    type="button"
                    disabled={busyKey === 'purge_demo'}
                    onClick={() => setConfirmPurgeType('demo')}
                    className="py-2 px-3.5 rounded-xl border border-red-800 hover:bg-red-950/40 text-red-300 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>
                      {busyKey === 'purge_demo'
                        ? 'جارٍ التنظيف...'
                        : 'تنظيف أي بيانات تجريبية قديمة'}
                    </span>
                  </button>
                )}
              </div>

              {/* 7-Day Orders & Revenue Recharts Dashboard Widget */}
              <div className="edkawi-soft-card p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-[#F8FAFC] flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-[#FF6B00]" />
                      <span>مؤشر الطلبات والإيرادات خلال آخر 7 أيام</span>
                    </h2>
                    <p className="text-xs text-[#94A3B8]">
                      مقارنة فورية لعدد الطلبات اليومية، الطلبات المكتملة، وإجمالي الإيرادات في إدكو
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold">
                    <span className="inline-flex items-center gap-1 text-[#FF6B00]">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#FF6B00]" />
                      <span>الإيرادات (ج.م)</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[#3B82F6]">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]" />
                      <span>إجمالي الطلبات</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[#10B981]">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
                      <span>المكتملة</span>
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="h-64 w-full bg-[#0F172A] rounded-2xl p-3 border border-[#334155]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={last7DaysChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#FF6B00" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#FF6B00" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} />
                        <XAxis dataKey="dateLabel" stroke="#94A3B8" fontSize={11} />
                        <YAxis stroke="#94A3B8" fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1E293B',
                            borderColor: '#334155',
                            borderRadius: '12px',
                            color: '#F8FAFC',
                            fontSize: '12px',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="revenueEgp"
                          name="الإيرادات (ج.م)"
                          stroke="#FF6B00"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#colorRevenue)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="h-64 w-full bg-[#0F172A] rounded-2xl p-3 border border-[#334155]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={last7DaysChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} />
                        <XAxis dataKey="dateLabel" stroke="#94A3B8" fontSize={11} />
                        <YAxis stroke="#94A3B8" fontSize={11} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1E293B',
                            borderColor: '#334155',
                            borderRadius: '12px',
                            color: '#F8FAFC',
                            fontSize: '12px',
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Bar dataKey="ordersCount" name="إجمالي الطلبات" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="completedCount" name="المكتملة" fill="#10B981" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Live Fleet & Stores Map */}
              <AdminLiveCouriersMap couriers={couriers} stores={stores} />

              {stores.length === 0 && (
                <div className="edkawi-soft-card p-8 text-center space-y-4">
                  <StoreIcon className="w-10 h-10 text-[#FF6B00] mx-auto" />
                  <h2 className="text-base sm:text-lg font-bold text-[#F8FAFC]">
                    ابدأ بإضافة المتاجر والصيدليات الحقيقية في مدينة إدكو
                  </h2>
                  <p className="text-xs sm:text-sm text-[#94A3B8] max-w-lg mx-auto">
                    تم إيقاف كافة البيانات والصور الافتراضية لتجهيز تطبيق إدكاوي للنشر الرسمي. أضف أول متجر أو صيدلية بصورته الحقيقية وموقعه على خريطة إدكو.
                  </p>
                  <button
                    type="button"
                    onClick={onOpenAddStoreModal}
                    className="py-2.5 px-6 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs sm:text-sm font-bold cursor-pointer"
                  >
                    + إضافة متجر أو صيدلية الآن
                  </button>
                </div>
              )}

              {pendingCouriers.length > 0 && (
                <div className="edkawi-soft-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#334155] flex items-center justify-between gap-3">
                    <h2 className="text-sm sm:text-base font-bold text-[#F8FAFC]">
                      طلبات انضمام مناديب تنتظر المراجعة والاعتماد (
                      <span className="font-mono tabular-nums">
                        {pendingCouriers.length}
                      </span>
                      )
                    </h2>
                    <button
                      type="button"
                      onClick={() => selectSection('couriers')}
                      className="text-xs font-bold text-[#FF6B00] hover:underline cursor-pointer"
                    >
                      مراجعة مستندات المناديب بالتفصيل
                    </button>
                  </div>
                  <div className="divide-y divide-[#334155]">
                    {pendingCouriers.map((c) => {
                      const requiresLicense = c.vehicleType !== 'دراجة هوائية';
                      const docCount = [
                        c.nationalIdFrontUrl,
                        c.nationalIdBackUrl,
                        c.selfieWithIdUrl,
                        c.vehiclePhotoUrl,
                        ...(requiresLicense
                          ? [c.drivingLicenseFrontUrl, c.drivingLicenseBackUrl]
                          : []),
                      ].filter(Boolean).length;
                      const expectedDocs = requiresLicense ? 6 : 4;
                      return (
                        <div
                          key={c.id}
                          className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-sm"
                        >
                          <div className="space-y-0.5">
                            <p className="font-bold text-[#F8FAFC] flex items-center gap-2">
                              <span>{c.name}</span>
                              <span
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                                  docCount === expectedDocs
                                    ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
                                    : 'bg-amber-950/60 text-amber-300 border border-amber-500/40'
                                }`}
                              >
                                مستندات: {docCount}/{expectedDocs}
                              </span>
                            </p>
                            <p className="text-xs text-[#94A3B8]">
                              <span dir="ltr" className="font-mono tabular-nums">
                                {c.phone}
                              </span>{' '}
                              · {c.vehicleType} · {c.neighborhood}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => selectSection('couriers')}
                              className="py-2 px-3.5 rounded-xl bg-[#0F172A] border border-[#334155] hover:border-[#FF6B00] text-[#F8FAFC] text-xs font-bold cursor-pointer whitespace-nowrap"
                            >
                              معاينة المستندات
                            </button>
                            <button
                              type="button"
                              disabled={busyKey === `approve_${c.id}`}
                              onClick={() => void handleApproveClick(c.id)}
                              className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                            >
                              {busyKey === `approve_${c.id}`
                                ? 'جارٍ الاعتماد...'
                                : 'اعتماد الكابتن'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recent Orders Preview */}
              <div className="edkawi-soft-card overflow-hidden">
                <div className="px-5 py-4 border-b border-[#334155] flex items-center justify-between gap-3">
                  <h2 className="text-sm sm:text-base font-bold text-[#F8FAFC]">
                    أحدث الطلبات والروشتات في مدينة إدكو
                  </h2>
                  <button
                    type="button"
                    onClick={() => selectSection('orders')}
                    className="text-xs font-bold text-[#FF6B00] hover:underline cursor-pointer"
                  >
                    عرض كل الطلبات
                  </button>
                </div>

                {orders.length === 0 ? (
                  <div className="p-8 text-center text-xs sm:text-sm text-[#94A3B8]">
                    لا توجد طلبات مسجلة حتى الآن.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="border-b border-[#334155] edkawi-surface-muted text-xs font-bold text-[#94A3B8]">
                          <th className="py-3 px-5">رقم الطلب</th>
                          <th className="py-3 px-4">المتجر / الصيدلية</th>
                          <th className="py-3 px-4">العميل</th>
                          <th className="py-3 px-4">الحالة</th>
                          <th className="py-3 px-5 text-left">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#334155] text-xs sm:text-sm">
                        {orders.slice(0, 6).map((o) => (
                          <tr
                            key={o.id}
                            className="hover:bg-[#0F172A]/60"
                          >
                            <td
                              dir="ltr"
                              className="py-3 px-5 font-mono font-bold text-[#F8FAFC] tabular-nums text-right"
                            >
                              #{o.id.slice(0, 8)}
                            </td>
                            <td className="py-3 px-4 font-semibold text-[#F8FAFC]">
                              <span className="inline-flex items-center gap-1.5">
                                {o.orderType === 'pharmacy_prescription' && (
                                  <Pill className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                )}
                                <span>{o.storeName}</span>
                              </span>
                            </td>
                            <td className="py-3 px-4 text-[#94A3B8]">
                              {o.customerName} ({o.deliveryNeighborhood})
                            </td>
                            <td className="py-3 px-4 font-semibold text-[#FF6B00]">
                              {getOrderStatusLabel(o.status)}
                            </td>
                            <td className="py-3 px-5 text-left font-mono font-bold text-[#F8FAFC] tabular-nums">
                              {o.status === 'awaiting_pharmacy_quote'
                                ? 'قيد التسعير'
                                : `${o.totalAmount} ج.م`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ================================================================
           * 1.5. STORE JOIN REQUESTS (/admin/requests)
           * ============================================================== */}
          {activeSection === 'requests' && (
            <section className="space-y-5">
              <div className="edkawi-soft-card p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-950/250/15 text-amber-500 flex items-center justify-center shrink-0">
                    <StoreIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#F8FAFC]">
                      طلبات انضمام المتاجر والصيدليات الجديدة
                    </h2>
                    <p className="text-xs text-[#94A3B8] mt-0.5">
                      مراجعة واعتماد طلبات الشركاء المسجلين عبر صفحة /join لحظياً
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-950/250/15 text-amber-500">
                  قيد الانتظار: {storeJoinRequests.filter((r) => r.status === 'pending').length}
                </span>
              </div>

              {storeJoinRequests.length === 0 ? (
                <div className="edkawi-soft-card p-10 text-center text-sm text-[#94A3B8]">
                  لا توجد طلبات انضمام متاجر مسجلة حتى الآن.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {storeJoinRequests.map((req) => (
                    <div
                      key={req.id}
                      className="edkawi-soft-card p-5 space-y-4 border border-[#334155]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-[#F8FAFC]">
                              {req.storeName}
                            </h3>
                            <span
                              className={`text-xs font-bold px-2.5 py-0.5 rounded-lg ${
                                req.status === 'approved'
                                  ? 'bg-emerald-500/15 text-emerald-500'
                                  : req.status === 'rejected'
                                  ? 'bg-rose-500/15 text-rose-500'
                                  : 'bg-amber-950/250/15 text-amber-500'
                              }`}
                            >
                              {req.status === 'approved'
                                ? 'مقبول ومفعل'
                                : req.status === 'rejected'
                                ? 'مرفوض'
                                : 'قيد المراجعة'}
                            </span>
                          </div>
                          <p className="text-xs text-[#94A3B8]">
                            المالك: <span className="font-semibold text-[#F8FAFC]">{req.ownerName}</span> · الهاتف:{' '}
                            <span dir="ltr" className="font-mono font-semibold text-[#FF6B00]">{req.phone}</span>
                          </p>
                          <p className="text-xs text-[#94A3B8]">
                            التصنيف: {req.category} {req.subCategory ? `(${req.subCategory})` : ''} · الحي: {req.neighborhood}
                          </p>
                          {(req.commercialRegisterNumber || req.taxCertificateNumber) && (
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              {req.commercialRegisterNumber && (
                                <span className="text-[11px] font-mono bg-[#0F172A] border border-[#334155] text-[#F8FAFC] px-2.5 py-1 rounded-xl">
                                  السجل التجاري: {req.commercialRegisterNumber}
                                </span>
                              )}
                              {req.taxCertificateNumber && (
                                <span className="text-[11px] font-mono bg-[#0F172A] border border-[#334155] text-[#FF6B00] px-2.5 py-1 rounded-xl">
                                  الرقم الضريبي: {req.taxCertificateNumber}
                                </span>
                              )}
                            </div>
                          )}
                          {req.rejectReason && (
                            <p className="text-xs text-rose-500 font-semibold">
                              سبب الرفض: {req.rejectReason}
                            </p>
                          )}
                        </div>

                        {req.commercialRegisterImage && (
                          <button
                            type="button"
                            onClick={() =>
                              setZoomedKycDoc({
                                title: `صورة السجل التجاري — ${req.storeName}`,
                                url: req.commercialRegisterImage!,
                              })
                            }
                            className="shrink-0 block w-24 h-20 rounded-xl overflow-hidden border border-[#334155] hover:border-[#FF6B00] cursor-pointer"
                            title="تكبير صورة السجل التجاري"
                          >
                            <img
                              src={req.commercialRegisterImage}
                              alt={`صورة ${req.storeName}`}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        )}
                      </div>

                      {req.status === 'pending' && (
                        <div className="pt-3 border-t border-[#334155] flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            disabled={busyKey === `req_app_${req.id}`}
                            onClick={async () => {
                              setBusyKey(`req_app_${req.id}`);
                              setErrorBanner(null);
                              try {
                                await approveStoreJoinRequestInFirestore(req.id, adminUid || 'admin', 'الإدارة');
                                onNotify?.(`تم اعتماد وإنشاء متجر "${req.storeName}" بنجاح!`);
                              } catch (err) {
                                setErrorBanner(formatAppErrorMessage(err, 'تعذر اعتماد طلب المتجر.'));
                              } finally {
                                setBusyKey(null);
                              }
                            }}
                            className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{busyKey === `req_app_${req.id}` ? 'جارٍ الاعتماد...' : 'اعتماد وإنشاء المتجر'}</span>
                          </button>

                          {rejectingRequestId === req.id ? (
                            <div className="flex flex-wrap items-center gap-2 flex-1">
                              <input
                                type="text"
                                value={rejectReasonText}
                                onChange={(e) => setRejectReasonText(e.target.value)}
                                placeholder="اكتب سبب الرفض..."
                                className="flex-1 min-w-[180px] px-3 py-2 rounded-xl border border-[#334155] text-xs"
                              />
                              <button
                                type="button"
                                disabled={busyKey === `req_rej_${req.id}`}
                                onClick={async () => {
                                  setBusyKey(`req_rej_${req.id}`);
                                  setErrorBanner(null);
                                  try {
                                    await rejectStoreJoinRequestInFirestore(
                                      req.id,
                                      rejectReasonText || 'بيانات غير مكتملة',
                                      adminUid || 'admin',
                                      'الإدارة'
                                    );
                                    setRejectingRequestId(null);
                                    setRejectReasonText('');
                                    onNotify?.(`تم رفض طلب "${req.storeName}".`);
                                  } catch (err) {
                                    setErrorBanner(formatAppErrorMessage(err, 'تعذر رفض الطلب.'));
                                  } finally {
                                    setBusyKey(null);
                                  }
                                }}
                                className="min-h-[38px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                              >
                                تأكيد الرفض
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectingRequestId(null);
                                  setRejectReasonText('');
                                }}
                                className="min-h-[38px] px-3 py-2 rounded-xl border border-[#334155] text-xs font-bold cursor-pointer"
                              >
                                إلغاء
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingRequestId(req.id);
                                setRejectReasonText('');
                              }}
                              className="min-h-[40px] px-4 py-2 rounded-xl bg-rose-600/10 hover:bg-rose-600/20 text-rose-500 border border-rose-500/30 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>رفض الطلب</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ================================================================
           * 2. STORES & PHARMACIES MANAGEMENT (إدارة المتاجر والصيدليات)
           * ============================================================== */}
          {activeSection === 'stores' && (
            <section className="space-y-5">
              <div className="edkawi-soft-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search
                    className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={storeSearch}
                    onChange={(e) => setStoreSearch(e.target.value)}
                    placeholder="ابحث باسم المتجر أو الصيدلية أو المنطقة..."
                    className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-[#334155] text-sm"
                  />
                </div>

                <button
                  type="button"
                  onClick={onOpenAddStoreModal}
                  className="py-2.5 px-5 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  <span>إضافة متجر / صيدلية وتوليد حساب</span>
                </button>
              </div>

              {filteredStores.length === 0 ? (
                <div className="edkawi-soft-card p-12 text-center space-y-3">
                  <StoreIcon
                    className="w-10 h-10 text-[#94A3B8] mx-auto"
                    aria-hidden="true"
                  />
                  <h3 className="text-base font-bold text-[#F8FAFC]">
                    لا توجد متاجر أو صيدليات مسجلة حالياً
                  </h3>
                  <p className="text-xs text-[#94A3B8]">
                    اضغط على «إضافة متجر / صيدلية وتوليد حساب» لإضافة أول شريك بصورته الحقيقية وموقعه على خريطة إدكو.
                  </p>
                </div>
              ) : (
                <div className="edkawi-soft-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="border-b border-[#334155] edkawi-surface-muted text-xs font-bold text-[#94A3B8]">
                          <th className="py-3.5 px-5">المتجر / الصيدلية</th>
                          <th className="py-3.5 px-4">التصنيف والموقع</th>
                          <th className="py-3.5 px-4">
                            بيانات دخول صاحب المتجر
                          </th>
                          <th className="py-3.5 px-4">الحالة</th>
                          <th className="py-3.5 px-5 text-left">التفعيل</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#334155] text-sm">
                        {filteredStores.map((store) => {
                          const cred = storeCredentialsMap[store.id];
                          const openNow = isStoreCurrentlyOpen(store);

                          return (
                            <tr
                              key={store.id}
                              className="hover:bg-[#0F172A]/60 transition-colors"
                            >
                              <td className="py-3.5 px-5 whitespace-nowrap">
                                <div className="flex items-center gap-3">
                                  <div className="w-11 h-11 rounded-xl overflow-hidden border border-[#334155] shrink-0">
                                    <ResilientImage
                                      src={store.imageUrl || ''}
                                      alt={store.name}
                                      fallbackTitle={store.name}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                  <div>
                                    <p className="font-bold text-[#F8FAFC]">
                                      {store.name}
                                    </p>
                                    <p className="text-[11px] text-slate-400 tabular-nums">
                                      توصيل {store.deliveryFee} ج.م · ★{' '}
                                      {store.rating.toFixed(1)}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3.5 px-4 text-xs text-[#94A3B8] whitespace-nowrap">
                                <div className="font-semibold">
                                  {store.category} · {store.neighborhood}
                                </div>
                                {typeof store.lat === 'number' &&
                                  typeof store.lng === 'number' && (
                                    <div
                                      dir="ltr"
                                      className="text-[11px] text-slate-400 font-mono tabular-nums text-right mt-0.5"
                                    >
                                      {store.lat.toFixed(4)}, {store.lng.toFixed(4)}
                                    </div>
                                  )}
                              </td>

                                <td className="py-3.5 px-4">
                                  <div className="space-y-1.5">
                                    <div dir="ltr" className="font-mono text-xs text-left">
                                      <p className="font-bold text-[#F8FAFC]">
                                        {cred?.loginEmail || `${store.id.slice(0, 8)}@adkawy.com`}
                                      </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      {cred?.loginEmail && (
                                        <button
                                          type="button"
                                          disabled={busyKey === `reset_${cred.loginEmail}`}
                                          onClick={() => void handleAdminSendPasswordReset(cred.loginEmail)}
                                          className="py-1 px-2 rounded-md bg-orange-950/40 border border-orange-800 text-[#FF6B00] text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                          title="إرسال رابط تعيين كلمة المرور للبريد"
                                        >
                                          <KeyRound className="w-3 h-3" />
                                          <span>{busyKey === `reset_${cred.loginEmail}` ? 'جارٍ الإرسال...' : 'إعادة تعيين كلمة المرور'}</span>
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setAdminChangeEmailTarget({
                                            uid: cred?.ownerUid || store.id,
                                            currentEmail: cred?.loginEmail || '',
                                            name: store.name,
                                          });
                                          setAdminNewEmailInput(cred?.loginEmail || '');
                                        }}
                                        className="py-1 px-2 rounded-md border border-[#334155] text-[#94A3B8] hover:bg-[#0F172A] text-[11px] font-bold cursor-pointer"
                                      >
                                        تحديث البريد
                                      </button>
                                    </div>
                                  </div>
                                </td>

                              <td className="py-3.5 px-4 text-xs font-bold whitespace-nowrap">
                                <span
                                  className={
                                    openNow
                                      ? 'text-emerald-400'
                                      : 'text-slate-500'
                                  }
                                >
                                  {openNow ? 'مفتوح الآن' : 'مغلق حالياً'}
                                </span>
                              </td>

                              <td className="py-3.5 px-5 text-left whitespace-nowrap">
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={busyKey === `store_${store.id}`}
                                    onClick={() =>
                                      void handleStoreActiveToggle(store)
                                    }
                                    className={`py-1.5 px-3 rounded-lg text-xs font-bold cursor-pointer ${
                                      store.isActive
                                        ? 'border border-[#334155] text-[#F8FAFC] hover:bg-[#0F172A]'
                                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                    }`}
                                  >
                                    {store.isActive
                                      ? 'إيقاف مؤقت'
                                      : 'إعادة التفعيل'}
                                  </button>

                                  {onUpdateStoreDeliveryFee && (
                                    <div className="inline-flex items-center gap-1">
                                      <input
                                        type="number"
                                        min={0}
                                        max={300}
                                        aria-label={`سعر توصيل ${store.name}`}
                                        value={
                                          storeFeeInputById[store.id] ??
                                          String(store.deliveryFee)
                                        }
                                        onChange={(e) =>
                                          setStoreFeeInputById((prev) => ({
                                            ...prev,
                                            [store.id]: e.target.value,
                                          }))
                                        }
                                        className="w-16 px-2 py-1 rounded-lg border border-[#334155] text-xs font-mono tabular-nums text-center"
                                      />
                                      <button
                                        type="button"
                                        disabled={busyKey === `fee_${store.id}`}
                                        onClick={() =>
                                          void handleSaveStoreDeliveryFee(store)
                                        }
                                        className="py-1.5 px-2.5 rounded-lg bg-[#1E293B] hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                                      >
                                        {busyKey === `fee_${store.id}`
                                          ? '...'
                                          : 'حفظ السعر'}
                                      </button>
                                    </div>
                                  )}

                                  {onDeleteProductByAdmin && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedStoreProductsId((prev) =>
                                          prev === store.id ? null : store.id
                                        )
                                      }
                                      className="py-1.5 px-2.5 rounded-lg border border-[#334155] hover:border-[#FF6B00] text-xs font-bold text-[#F8FAFC] cursor-pointer"
                                    >
                                      الأصناف (
                                      <span className="font-mono tabular-nums">
                                        {
                                          products.filter(
                                            (p) => p.storeId === store.id
                                          ).length
                                        }
                                      </span>
                                      )
                                    </button>
                                  )}

                                  {onSetEntityBlocked && (
                                    <button
                                      type="button"
                                      disabled={busyKey === `block_${store.id}`}
                                      onClick={() =>
                                        void handleQuickBlockToggle({
                                          targetId: store.id,
                                          targetType: 'store',
                                          targetName: store.name,
                                          currentlyBlocked: Boolean(
                                            blockedEntities[store.id]?.isBlocked
                                          ),
                                        })
                                      }
                                      className={`py-1.5 px-3 rounded-lg text-xs font-bold cursor-pointer ${
                                        blockedEntities[store.id]?.isBlocked
                                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                          : 'border border-red-800 text-red-400 hover:bg-red-950/40'
                                      }`}
                                    >
                                      {blockedEntities[store.id]?.isBlocked
                                        ? 'فك الحظر'
                                        : 'حظر'}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Expandable Store Products Management Panel for Admin */}
                  {expandedStoreProductsId && onDeleteProductByAdmin && (
                    <div className="border-t border-[#334155] p-5 edkawi-surface-muted space-y-3">
                      {(() => {
                        const targetStore = stores.find(
                          (s) => s.id === expandedStoreProductsId
                        );
                        const storeItems = products.filter(
                          (p) => p.storeId === expandedStoreProductsId
                        );
                        return (
                          <>
                            <div className="flex items-center justify-between gap-3">
                              <h3 className="text-sm font-bold text-[#F8FAFC]">
                                قائمة أصناف «{targetStore?.name || ''}» (
                                <span className="font-mono tabular-nums">
                                  {storeItems.length}
                                </span>
                                )
                              </h3>
                              <button
                                type="button"
                                onClick={() => setExpandedStoreProductsId(null)}
                                className="text-xs font-bold text-slate-500 hover:text-[#F8FAFC] hover:text-[#F8FAFC] cursor-pointer"
                              >
                                إغلاق القائمة
                              </button>
                            </div>
                            {storeItems.length === 0 ? (
                              <p className="text-xs text-[#94A3B8]">
                                لا توجد أصناف معروضة حالياً لهذا المتجر.
                              </p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {storeItems.map((prod) => (
                                  <div
                                    key={prod.id}
                                    className="p-3 rounded-xl edkawi-surface border border-[#334155] flex items-center justify-between gap-3"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-[#F8FAFC] truncate">
                                        {prod.name}
                                      </p>
                                      <p className="text-[11px] text-[#94A3B8] tabular-nums">
                                        {prod.price} ج.م · {prod.category}
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      disabled={
                                        busyKey === `del_prod_${prod.id}`
                                      }
                                      onClick={() =>
                                        setConfirmDeleteProductTarget({
                                          product: prod,
                                          storeName: targetStore?.name,
                                        })
                                      }
                                      className="px-2.5 py-1.5 rounded-xl border border-red-800 text-red-400 hover:bg-red-950/40 text-xs font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>حذف</span>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* ================================================================
           * 3. COURIERS MANAGEMENT (إدارة المندوبين + خريطة الأسطول)
           * ============================================================== */}
          {activeSection === 'couriers' && (
            <section className="space-y-6">
              <div className="edkawi-soft-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-[#F8FAFC]">
                    سجل مناديب التوصيل في مدينة إدكو
                  </h2>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    معتمدون: {approvedCouriers.length} · بانتظار المراجعة:{' '}
                    {pendingCouriers.length}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddCourierOpen(true)}
                  className="py-2.5 px-5 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  <span>إضافة مندوب معتمد وتحديد موقعه</span>
                </button>
              </div>

              <AdminLiveCouriersMap couriers={couriers} stores={stores} />

              {pendingCouriers.length > 0 && (
                <div className="edkawi-soft-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#334155] bg-amber-950/25">
                    <h3 className="text-sm font-bold text-amber-300">
                      مراجعة مستندات المناديب وطلبات الانضمام ({pendingCouriers.length})
                    </h3>
                  </div>

                  <div className="divide-y divide-[#334155]">
                    {pendingCouriers.map((courier) => {
                      const requiresLicense =
                        courier.vehicleType !== 'دراجة هوائية';
                      const kycItems: Array<{ label: string; url?: string }> = [
                        { label: 'وجه البطاقة', url: courier.nationalIdFrontUrl },
                        { label: 'ظهر البطاقة', url: courier.nationalIdBackUrl },
                        ...(requiresLicense
                          ? [
                              {
                                label: 'وجه الرخصة',
                                url: courier.drivingLicenseFrontUrl,
                              },
                              {
                                label: 'ظهر الرخصة',
                                url: courier.drivingLicenseBackUrl,
                              },
                            ]
                          : []),
                        {
                          label: requiresLicense
                            ? 'سيلفي بالرخصة/البطاقة'
                            : 'سيلفي بالبطاقة',
                          url: courier.selfieWithIdUrl,
                        },
                        {
                          label: `صورة ${courier.vehicleType}`,
                          url: courier.vehiclePhotoUrl,
                        },
                      ];
                      const uploadedCount = kycItems.filter((i) => i.url).length;
                      const isRejectOpen = courierRejectOpenId === courier.id;

                      return (
                        <div key={courier.id} className="p-5 space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-bold text-[#F8FAFC]">
                                  {courier.name}
                                </p>
                                <span
                                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg ${
                                    uploadedCount === kycItems.length
                                      ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
                                      : 'bg-amber-950/60 text-amber-300 border border-amber-500/40'
                                  }`}
                                >
                                  المستندات: {uploadedCount} / {kycItems.length}
                                </span>
                                {!requiresLicense && (
                                  <span className="text-[11px] bg-blue-950/50 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-lg">
                                    معفي من الرخصة (عجلة)
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[#94A3B8]">
                                الهاتف:{' '}
                                <span
                                  dir="ltr"
                                  className="font-mono font-bold tabular-nums"
                                >
                                  {courier.phone}
                                </span>{' '}
                                {courier.email ? `· ${courier.email}` : ''}
                              </p>
                              <p className="text-xs text-[#94A3B8]">
                                {courier.vehicleType} · نطاق التمركز:{' '}
                                {courier.neighborhood}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                disabled={busyKey === `approve_${courier.id}`}
                                onClick={() => void handleApproveClick(courier.id)}
                                className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                              >
                                <UserCheck className="w-4 h-4" aria-hidden="true" />
                                <span>
                                  {busyKey === `approve_${courier.id}`
                                    ? 'جارٍ الاعتماد...'
                                    : 'موافقة واعتماد الكابتن'}
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setCourierRejectOpenId((prev) =>
                                    prev === courier.id ? null : courier.id
                                  )
                                }
                                className="py-2.5 px-4 rounded-xl bg-rose-950/50 border border-rose-500/40 hover:bg-rose-900/50 text-rose-200 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                              >
                                <XCircle className="w-4 h-4" aria-hidden="true" />
                                <span>رفض مع سبب</span>
                              </button>
                            </div>
                          </div>

                          {/* KYC Document Thumbnails Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                            {kycItems.map((docItem) => (
                              <div
                                key={docItem.label}
                                className="rounded-xl bg-[#0F172A] border border-[#334155] p-2 space-y-1.5"
                              >
                                <p className="text-[11px] font-bold text-[#94A3B8] truncate">
                                  {docItem.label}
                                </p>
                                {docItem.url ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setZoomedKycDoc({
                                        title: `${courier.name} — ${docItem.label}`,
                                        url: docItem.url!,
                                      })
                                    }
                                    className="w-full h-24 rounded-lg overflow-hidden border border-[#334155] hover:border-[#FF6B00] cursor-pointer block"
                                    title="اضغط للتكبير"
                                  >
                                    <img
                                      src={docItem.url}
                                      alt={docItem.label}
                                      className="w-full h-full object-cover"
                                    />
                                  </button>
                                ) : (
                                  <div className="w-full h-24 rounded-lg bg-[#1E293B] border border-dashed border-[#334155] flex items-center justify-center text-[10px] text-amber-400 text-center px-1">
                                    غير مرفوعة
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          {isRejectOpen && (
                            <div className="p-4 rounded-2xl bg-[#0F172A] border border-rose-500/40 space-y-3">
                              <label className="block text-xs font-bold text-rose-300">
                                سبب رفض المستندات (سيظهر للمندوب لإعادة الرفع):
                              </label>
                              <div className="flex flex-col sm:flex-row gap-2.5">
                                <input
                                  type="text"
                                  maxLength={220}
                                  value={courierRejectReasonById[courier.id] || ''}
                                  onChange={(e) =>
                                    setCourierRejectReasonById((prev) => ({
                                      ...prev,
                                      [courier.id]: e.target.value,
                                    }))
                                  }
                                  placeholder="مثال: صورة السيلفي مع الرخصة غير واضحة أو منتهية الصلاحية"
                                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#1E293B] border border-[#334155] text-xs text-[#F8FAFC]"
                                />
                                <button
                                  type="button"
                                  disabled={busyKey === `reject_${courier.id}`}
                                  onClick={() =>
                                    void handleRejectCourierClick(courier.id)
                                  }
                                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                                >
                                  {busyKey === `reject_${courier.id}`
                                    ? 'جارٍ الإرسال...'
                                    : 'تأكيد الرفض وإخطار المندوب'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {rejectedCouriers.length > 0 && (
                <div className="edkawi-soft-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#334155] bg-rose-950/20">
                    <h3 className="text-sm font-bold text-rose-300">
                      مناديب مرفوضون / بانتظار إعادة رفع المستندات ({rejectedCouriers.length})
                    </h3>
                  </div>
                  <div className="divide-y divide-[#334155]">
                    {rejectedCouriers.map((rc) => (
                      <div
                        key={rc.id}
                        className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <p className="font-bold text-[#F8FAFC] text-sm">
                            {rc.name} · <span dir="ltr" className="font-mono">{rc.phone}</span>
                          </p>
                          <p className="text-rose-300">
                            سبب الرفض: {rc.kycRejectionReason || 'مستندات غير مكتملة'}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={busyKey === `approve_${rc.id}`}
                          onClick={() => void handleApproveClick(rc.id)}
                          className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                        >
                          اعتماد الآن
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="edkawi-soft-card overflow-hidden">
                <div className="px-5 py-4 border-b border-[#334155]">
                  <h3 className="text-sm font-bold text-[#F8FAFC]">
                    المناديب المعتمدون ({approvedCouriers.length})
                  </h3>
                </div>

                {approvedCouriers.length === 0 ? (
                  <div className="p-10 text-center text-xs sm:text-sm text-[#94A3B8]">
                    لا يوجد مناديب معتمدون حالياً. اضغط «إضافة مندوب معتمد» لإضافة أول كابتن توصيل.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="border-b border-[#334155] edkawi-surface-muted text-xs font-bold text-[#94A3B8]">
                          <th className="py-3 px-5">اسم الكابتن</th>
                          <th className="py-3 px-4">رقم الهاتف</th>
                          <th className="py-3 px-4">المركبة ونقطة التمركز</th>
                          <th className="py-3 px-4">التوصيلات المكتملة</th>
                          <th className="py-3 px-5 text-left">حالة الاتصال</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#334155] text-sm">
                        {approvedCouriers.map((c) => (
                          <tr
                            key={c.id}
                            className="hover:bg-[#0F172A]/60"
                          >
                            <td className="py-3.5 px-5 font-bold text-[#F8FAFC]">
                              {c.name}
                            </td>
                            <td
                              dir="ltr"
                              className="py-3.5 px-4 font-mono text-xs font-semibold text-[#F8FAFC] tabular-nums text-right"
                            >
                              {c.phone}
                            </td>
                            <td className="py-3.5 px-4 text-xs text-[#94A3B8]">
                              <div>
                                {c.vehicleType} · {c.neighborhood}
                              </div>
                              {typeof c.lat === 'number' &&
                                typeof c.lng === 'number' && (
                                  <div
                                    dir="ltr"
                                    className="text-[11px] text-slate-400 font-mono tabular-nums text-right"
                                  >
                                    {c.lat.toFixed(4)}, {c.lng.toFixed(4)}
                                  </div>
                                )}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-xs font-bold text-[#F8FAFC] tabular-nums">
                              {c.completedDeliveries} توصيلة
                            </td>
                            <td className="py-3.5 px-5 text-left text-xs font-bold whitespace-nowrap">
                              <div className="inline-flex items-center gap-2.5">
                                <span
                                  className={
                                    blockedEntities[c.id]?.isBlocked
                                      ? 'text-red-400'
                                      : c.isAvailable
                                      ? 'text-emerald-400'
                                      : 'text-slate-400'
                                  }
                                >
                                  {blockedEntities[c.id]?.isBlocked
                                    ? 'محظور'
                                    : c.isAvailable
                                    ? 'متاح الآن'
                                    : 'غير متصل'}
                                </span>
                                <div className="inline-flex items-center gap-2">
                                  {c.email && (
                                    <button
                                      type="button"
                                      disabled={busyKey === `reset_${c.email}`}
                                      onClick={() => void handleAdminSendPasswordReset(c.email!)}
                                      className="py-1 px-2 rounded-md bg-orange-950/40 border border-orange-800 text-[#FF6B00] text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                      title="إرسال رابط تعيين كلمة المرور"
                                    >
                                      <KeyRound className="w-3 h-3" />
                                      <span>{busyKey === `reset_${c.email}` ? '...' : 'إعادة تعيين'}</span>
                                    </button>
                                  )}
                                  {onSetEntityBlocked && (
                                    <button
                                      type="button"
                                      disabled={busyKey === `block_${c.id}`}
                                      onClick={() =>
                                        void handleQuickBlockToggle({
                                          targetId: c.id,
                                          targetType: 'courier',
                                          targetName: c.name,
                                          currentlyBlocked: Boolean(
                                            blockedEntities[c.id]?.isBlocked
                                          ),
                                        })
                                      }
                                      className={`py-1 px-2.5 rounded-lg text-xs font-bold cursor-pointer ${
                                        blockedEntities[c.id]?.isBlocked
                                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                          : 'border border-red-800 text-red-400 hover:bg-red-950/40'
                                      }`}
                                    >
                                      {blockedEntities[c.id]?.isBlocked
                                        ? 'فك الحظر'
                                        : 'حظر'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ================================================================
           * 4. ORDERS & PHARMACY PRESCRIPTIONS ROOM (الطلبات والروشتات)
           * ============================================================== */}
          {activeSection === 'orders' && (
            <section className="space-y-5">
              <div className="edkawi-soft-card p-3 flex flex-wrap items-center gap-2">
                {(
                  [
                    { key: 'all', label: 'الكل' },
                    {
                      key: 'awaiting_pharmacy_quote',
                      label: 'روشتة بانتظار التسعير',
                    },
                    {
                      key: 'awaiting_customer_approval',
                      label: 'بانتظار موافقة العميل',
                    },
                    { key: 'pending', label: 'بانتظار المتجر' },
                    { key: 'confirmed', label: 'مؤكد' },
                    { key: 'pending_payment', label: 'بانتظار الدفع' },
                    { key: 'preparing', label: 'جاري التحضير' },
                    { key: 'ready', label: 'جاهز للاستلام' },
                    { key: 'on_the_way', label: 'في الطريق' },
                    { key: 'delivered', label: 'تم التوصيل' },
                    { key: 'cancelled', label: 'ملغي' },
                  ] as const
                ).map((item) => {
                  const active = orderStatusFilter === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setOrderStatusFilter(item.key)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#1E293B] text-white bg-[#FF6B00]'
                          : 'text-[#94A3B8] hover:bg-[#0F172A]'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {filteredOrders.length === 0 ? (
                <div className="edkawi-soft-card p-12 text-center text-xs sm:text-sm text-[#94A3B8]">
                  لا توجد طلبات ضمن هذا الفلتر حالياً.
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredOrders.map((order) => {
                    const isPharmacy =
                      order.orderType === 'pharmacy_prescription';
                    const canAssign =
                      order.status !== 'delivered' &&
                      order.status !== 'cancelled' &&
                      order.status !== 'pending_payment' &&
                      order.status !== 'awaiting_pharmacy_quote' &&
                      order.status !== 'awaiting_customer_approval' &&
                      approvedCouriers.length > 0;
                    const canCancel =
                      order.status === 'pending' ||
                      order.status === 'confirmed' ||
                      order.status === 'pending_payment' ||
                      order.status === 'preparing' ||
                      order.status === 'ready' ||
                      order.status === 'awaiting_pharmacy_quote' ||
                      order.status === 'awaiting_customer_approval';

                    return (
                      <article
                        key={order.id}
                        className="edkawi-soft-card p-5 space-y-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-[#94A3B8]">
                              <span
                                dir="ltr"
                                className="font-mono font-bold text-[#F8FAFC] tabular-nums"
                              >
                                #{order.id.slice(0, 8)}
                              </span>
                              <span>·</span>
                              <span className="font-bold text-[#FF6B00]">
                                {getOrderStatusLabel(order.status)}
                              </span>
                              {isPharmacy && (
                                <>
                                  <span>·</span>
                                  <span className="text-teal-400 font-bold inline-flex items-center gap-1">
                                    <Pill className="w-3.5 h-3.5" />
                                    طلب صيدلية / روشتة
                                  </span>
                                </>
                              )}
                              <span>·</span>
                              <span>
                                {getPaymentMethodLabel(order.paymentMethod)}
                              </span>
                            </div>

                            <h3 className="text-base font-bold text-[#F8FAFC]">
                              {order.storeName} ← {order.customerName}
                            </h3>

                            <p className="text-xs text-[#94A3B8] flex items-center gap-1.5 flex-wrap">
                              <MapPin className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
                              <span>
                                {order.deliveryNeighborhood} —{' '}
                                {order.deliveryAddress}
                              </span>
                              {order.customerPhone && (
                                <span
                                  dir="ltr"
                                  className="font-mono font-semibold text-[#F8FAFC] tabular-nums"
                                >
                                  ({order.customerPhone})
                                </span>
                              )}
                            </p>
                          </div>

                          <div className="text-left">
                            <p className="text-lg font-bold text-[#F8FAFC] font-mono tabular-nums">
                              {order.status === 'awaiting_pharmacy_quote'
                                ? 'قيد التسعير'
                                : `${order.totalAmount} ج.م`}
                            </p>
                            <p className="text-[11px] text-slate-400 tabular-nums">
                              شامل التوصيل {order.deliveryFee} ج.م
                            </p>
                          </div>
                        </div>

                        <p className="text-xs text-[#F8FAFC] edkawi-surface-muted rounded-xl p-3 border border-[#334155]/70 border-[#334155]">
                          {order.itemsSummary}
                        </p>

                        <div className="pt-2 border-t border-slate-100 border-[#334155] flex flex-wrap items-center justify-between gap-3">
                          <div className="text-xs text-[#94A3B8]">
                            المندوب المعيّن:{' '}
                            <span className="font-bold text-[#F8FAFC]">
                              {order.courierName
                                ? order.courierName
                                : 'لم يُعيّن بعد'}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2.5">
                            {canAssign && (
                              <select
                                aria-label="تعيين مندوب يدوياً"
                                value={order.courierId ?? ''}
                                disabled={busyKey === `assign_${order.id}`}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    void handleAssignCourierSelect(
                                      order.id,
                                      e.target.value
                                    );
                                  }
                                }}
                                className="py-2 px-3 rounded-xl border border-[#334155] text-xs font-semibold text-[#F8FAFC] cursor-pointer"
                              >
                                <option value="">تعيين مندوب يدوياً...</option>
                                {approvedCouriers.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name} ({c.neighborhood})
                                  </option>
                                ))}
                              </select>
                            )}

                            {canCancel && (
                              <button
                                type="button"
                                disabled={busyKey === `cancel_${order.id}`}
                                onClick={() => setConfirmCancelOrderId(order.id)}
                                className="py-2 px-3.5 rounded-xl border border-red-800 text-red-300 hover:bg-red-950/40 text-xs font-bold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                              >
                                <XCircle
                                  className="w-3.5 h-3.5"
                                  aria-hidden="true"
                                />
                                <span>إلغاء الطلب</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* ================================================================
           * 5. INVITATIONS MANAGEMENT (نظام إدارة الدعوات)
           * ============================================================== */}
          {activeSection === 'invitations' && (
            <section className="space-y-5">
              <div className="edkawi-soft-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-[#F8FAFC] flex items-center gap-2">
                    <Mail className="w-5 h-5 text-[#FF6B00]" />
                    <span>نظام إدارة الدعوات (Invitations Management)</span>
                  </h2>
                  <p className="text-xs text-[#94A3B8] mt-1">
                    إرسال دعوات مشفرة ومؤمنة للمتاجر، العملاء، المناديب، ومسؤولي المبيعات مع تتبع مدة الصلاحية (48 ساعة).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateInviteModalOpen(true)}
                  className="py-2.5 px-5 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>إنشاء دعوة جديدة</span>
                </button>
              </div>

              {/* Filter & Search Bar */}
              <div className="edkawi-soft-card p-3 flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={inviteSearch}
                    onChange={(e) => setInviteSearch(e.target.value)}
                    placeholder="ابحث بالبريد الإلكتروني المدعو..."
                    className="w-full pr-10 pl-4 py-2 rounded-xl border border-[#334155] text-xs sm:text-sm"
                  />
                </div>
                <select
                  value={inviteRoleFilter}
                  onChange={(e) => setInviteRoleFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-[#334155] text-xs sm:text-sm font-semibold cursor-pointer w-full sm:w-auto"
                >
                  <option value="all">جميع أنواع الحسابات</option>
                  <option value="store">المتاجر والصيدليات</option>
                  <option value="customer">العملاء</option>
                  <option value="courier">المناديب</option>
                  <option value="sales_agent">مسؤولو المبيعات</option>
                </select>
              </div>

              {/* Invitations Table */}
              <div className="edkawi-soft-card overflow-hidden">
                {(() => {
                  const filtered = invitations.filter((inv) => {
                    if (inviteRoleFilter !== 'all' && inv.userType !== inviteRoleFilter) return false;
                    if (inviteSearch.trim() && !inv.email.toLowerCase().includes(inviteSearch.trim().toLowerCase())) return false;
                    return true;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="p-10 text-center text-xs sm:text-sm text-[#94A3B8]">
                        لا توجد دعوات مطابقة في السجل حتى الآن.
                      </div>
                    );
                  }

                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse text-xs sm:text-sm">
                        <thead>
                          <tr className="border-b border-[#334155] edkawi-surface-muted text-xs font-bold text-[#94A3B8]">
                            <th className="py-3 px-4">البريد الإلكتروني</th>
                            <th className="py-3 px-3">نوع الحساب</th>
                            <th className="py-3 px-3">الحالة</th>
                            <th className="py-3 px-4">تاريخ الإرسال والانتهاء</th>
                            <th className="py-3 px-4 text-left">إجراءات الدعوة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#334155]">
                          {filtered.map((inv) => {
                            const isExpired =
                              inv.status === 'expired' ||
                              (inv.expiresAtMs ? inv.expiresAtMs < Date.now() : false);
                            const currentStatus =
                              inv.status === 'accepted'
                                ? 'accepted'
                                : isExpired
                                ? 'expired'
                                : 'pending';
                            const shareUrl = buildInvitationRegistrationUrl(
                              inv.token,
                              inv.userType,
                              inv.referralCode
                            );

                            return (
                              <tr key={inv.id} className="hover:bg-[#0F172A]/60">
                                <td dir="ltr" className="py-3.5 px-4 font-mono font-bold text-right text-[#F8FAFC]">
                                  {inv.email}
                                </td>
                                <td className="py-3.5 px-3 font-semibold text-[#94A3B8]">
                                  {inv.userType === 'store'
                                    ? 'متجر / صيدلية'
                                    : inv.userType === 'courier'
                                    ? 'مندوب'
                                    : inv.userType === 'sales_agent'
                                    ? 'مسؤول مبيعات'
                                    : 'عميل'}
                                </td>
                                <td className="py-3.5 px-3">
                                  <span
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                                      currentStatus === 'accepted'
                                        ? 'bg-emerald-950/60 text-emerald-300'
                                        : currentStatus === 'expired'
                                        ? 'bg-red-950/60 text-red-300'
                                        : 'bg-orange-950/60 text-[#FF6B00]'
                                    }`}
                                  >
                                    {currentStatus === 'accepted'
                                      ? 'مقبولة'
                                      : currentStatus === 'expired'
                                      ? 'منتهية الصلاحية'
                                      : 'معلقة (Pending)'}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-xs text-slate-500 tabular-nums">
                                  <div>أُرسلت: {new Date(inv.createdAtIso || inv.createdAt || Date.now()).toLocaleDateString('ar-EG')}</div>
                                  <div className="text-[11px] text-slate-400">تنتهي: {new Date(inv.expiresAtIso || inv.expiresAt || (inv.expiresAtMs ? new Date(inv.expiresAtMs).toISOString() : '')).toLocaleDateString('ar-EG')}</div>
                                </td>
                                <td className="py-3.5 px-4 text-left whitespace-nowrap">
                                  <div className="inline-flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void handleCopyText(shareUrl, `inv_${inv.id}`)}
                                      className="py-1 px-2.5 rounded-lg border border-[#334155] text-xs font-bold hover:border-[#FF6B00] cursor-pointer inline-flex items-center gap-1"
                                    >
                                      {copiedKey === `inv_${inv.id}` ? (
                                        <>
                                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                                          <span>تم النسخ</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3.5 h-3.5" />
                                          <span>نسخ الرابط</span>
                                        </>
                                      )}
                                    </button>
                                    {currentStatus !== 'accepted' && (
                                      <button
                                        type="button"
                                        disabled={busyKey === `resend_${inv.id}`}
                                        onClick={() => void handleResendInvitation(inv)}
                                        className="py-1 px-2.5 rounded-lg bg-orange-950/40 border border-orange-800 text-[#FF6B00] text-xs font-bold hover:bg-orange-100 cursor-pointer inline-flex items-center gap-1"
                                      >
                                        <RefreshCw className="w-3 h-3" />
                                        <span>{busyKey === `resend_${inv.id}` ? '...' : 'إعادة إرسال'}</span>
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </section>
          )}

          {/* ================================================================
           * 6. SALES AGENTS PORTAL (إدارة مسؤولي المبيعات والعمولات)
           * ============================================================== */}
          {activeSection === 'sales_agents' && (
            <section className="space-y-5">
              <div className="edkawi-soft-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-[#F8FAFC] flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-[#FF6B00]" />
                    <span>إدارة مسؤولي المبيعات والعمولات (Sales Agents)</span>
                  </h2>
                  <p className="text-xs text-[#94A3B8] mt-1">
                    تتبع أداء وكلاء المبيعات في مدينة إدكو، تعديل نسب العمولات، ومراقبة أرباحهم المعلقة والمتاحة.
                  </p>
                </div>
              </div>

              {salesAgents.length === 0 ? (
                <div className="edkawi-soft-card p-12 text-center text-xs sm:text-sm text-[#94A3B8]">
                  لا يوجد مسؤولو مبيعات مسجلون حتى الآن. أرسل دعوة بحساب «مسؤول مبيعات» من تبويب الدعوات.
                </div>
              ) : (
                <div className="edkawi-soft-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b border-[#334155] edkawi-surface-muted text-xs font-bold text-[#94A3B8]">
                          <th className="py-3 px-4">اسم الوكيل</th>
                          <th className="py-3 px-3">كود الإحالة</th>
                          <th className="py-3 px-3">الحسابات المجلوبة</th>
                          <th className="py-3 px-3">نسبة العمولة</th>
                          <th className="py-3 px-4">الأرباح (متاحة / معلقة)</th>
                          <th className="py-3 px-4 text-left">تحديث النسبة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#334155]">
                        {salesAgents.map((agent) => (
                          <tr key={agent.id} className="hover:bg-[#0F172A]/60">
                            <td className="py-3.5 px-4 font-bold text-[#F8FAFC]">
                              <div>{agent.name}</div>
                              <div dir="ltr" className="text-[11px] font-mono text-slate-400 font-normal">{agent.phone || agent.email}</div>
                            </td>
                            <td className="py-3.5 px-3">
                              <span className="px-2 py-0.5 rounded-md bg-orange-950/60 text-[#FF6B00] font-mono font-bold text-xs">
                                {agent.referralCode}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 font-mono font-bold text-[#F8FAFC] tabular-nums">
                              {agent.invitedStoresCount + agent.invitedCustomersCount + agent.invitedCouriersCount} حساب
                              <div className="text-[10px] text-slate-400 font-normal">
                                {agent.invitedStoresCount} متجر · {agent.invitedCustomersCount} عميل · {agent.invitedCouriersCount} كابتن
                              </div>
                            </td>
                            <td className="py-3.5 px-3">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  max={50}
                                  dir="ltr"
                                  value={agentCommissionInput[agent.id] ?? agent.commissionRatePercent}
                                  onChange={(e) => {
                                    const val = Math.max(0, Math.min(50, Number(e.target.value)));
                                    setAgentCommissionInput((prev) => ({ ...prev, [agent.id]: val }));
                                  }}
                                  className="w-14 px-2 py-1 rounded border border-[#334155] text-xs font-mono text-center"
                                />
                                <span className="font-bold text-xs">%</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-mono tabular-nums">
                              <div className="font-bold text-emerald-400">{agent.availableBalance} ج.م (متاح)</div>
                              <div className="text-[11px] text-slate-400">{agent.pendingBalance} ج.م (معلق Escrow)</div>
                            </td>
                            <td className="py-3.5 px-4 text-left whitespace-nowrap">
                              <button
                                type="button"
                                disabled={busyKey === `comm_${agent.id}`}
                                onClick={() => void handleSaveAgentCommission(agent)}
                                className="py-1 px-3 rounded-lg bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs font-bold cursor-pointer"
                              >
                                {busyKey === `comm_${agent.id}` ? 'جارٍ الحفظ...' : 'حفظ النسبة'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ================================================================
           * 7. PAYOUT REQUESTS MANAGEMENT (طلبات سحب أرباح الوكلاء)
           * ============================================================== */}
          {activeSection === 'payouts' && (
            <section className="space-y-5">
              <div className="edkawi-soft-card p-5">
                <h2 className="text-base font-bold text-[#F8FAFC] flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-[#FF6B00]" />
                  <span>طلبات سحب الأرباح (Payout Requests)</span>
                </h2>
                <p className="text-xs text-[#94A3B8] mt-1">
                  مراجعة طلبات السحب عبر فودافون كاش وإنستاباي (الحد الأدنى 100 ج.م)، مع استرداد المبلغ تلقائياً للمحفظة في حال الرفض.
                </p>
              </div>

              {payoutRequests.length === 0 ? (
                <div className="edkawi-soft-card p-12 text-center text-xs sm:text-sm text-[#94A3B8]">
                  لا توجد طلبات سحب مسجلة حتى الآن.
                </div>
              ) : (
                <div className="edkawi-soft-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b border-[#334155] edkawi-surface-muted text-xs font-bold text-[#94A3B8]">
                          <th className="py-3 px-4">الوكيل</th>
                          <th className="py-3 px-3">المبلغ</th>
                          <th className="py-3 px-4">طريقة الاستلام وبيانات المحفظة</th>
                          <th className="py-3 px-3">الحالة</th>
                          <th className="py-3 px-4 text-left">القرار والإجراء</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#334155]">
                        {payoutRequests.map((req) => (
                          <tr key={req.id} className="hover:bg-[#0F172A]/60">
                            <td className="py-3.5 px-4 font-bold text-[#F8FAFC]">
                              <div>{req.agentName}</div>
                              <div className="text-[11px] text-slate-400 font-normal tabular-nums">{new Date(req.createdAtIso || req.createdAt || Date.now()).toLocaleDateString('ar-EG')}</div>
                            </td>
                            <td className="py-3.5 px-3 font-mono font-bold text-[#FF6B00] text-base tabular-nums">
                              {req.amount} ج.م
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-[#F8FAFC]">
                                {req.method === 'vodafone_cash' ? 'فودافون كاش' : 'إنستاباي (InstaPay)'}
                              </div>
                              <div dir="ltr" className="font-mono text-xs text-left text-slate-500 font-bold">
                                {req.accountDetails || req.targetAccount}
                              </div>
                            </td>
                            <td className="py-3.5 px-3">
                              <span
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                                  req.status === 'completed' || req.status === 'paid'
                                    ? 'bg-emerald-950/60 text-emerald-300'
                                    : req.status === 'rejected'
                                    ? 'bg-red-950/60 text-red-300'
                                    : 'bg-amber-950/60 text-amber-300'
                                }`}
                              >
                                {req.status === 'completed' || req.status === 'paid' ? 'تم الدفع بنجاح' : req.status === 'rejected' ? 'مرفوض ومسترد' : 'بانتظار التحويل'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-left whitespace-nowrap">
                              {req.status === 'pending' ? (
                                <div className="space-y-1.5 inline-block text-right">
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      disabled={busyKey === `payout_${req.id}`}
                                      onClick={() => void handleProcessPayout(req.id, true)}
                                      className="py-1 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                                    >
                                      اعتماد التحويل
                                    </button>
                                    <button
                                      type="button"
                                      disabled={busyKey === `payout_${req.id}`}
                                      onClick={() => void handleProcessPayout(req.id, false)}
                                      className="py-1 px-3 rounded-lg border border-red-800 text-red-400 hover:bg-red-950/30 text-xs font-bold cursor-pointer"
                                    >
                                      رفض واسترداد
                                    </button>
                                  </div>
                                  <input
                                    type="text"
                                    placeholder="سبب الرفض إن وُجد..."
                                    value={payoutRejectionReason[req.id] ?? ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setPayoutRejectionReason((prev) => ({ ...prev, [req.id]: val }));
                                    }}
                                    className="w-full px-2 py-0.5 rounded border border-[#334155] text-[11px]"
                                  />
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">تم حسم الطلب</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ================================================================
           * 7.5. CUSTOMER WALLET TOP-UPS (مراجعة طلبات شحن محافظ العملاء)
           * ============================================================== */}
          {activeSection === 'wallet_topups' && (
            <section className="space-y-5">
              <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-[#F8FAFC] flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-[#FF6B00]" />
                    <span>طلبات شحن محافظ العملاء (فودافون كاش / إنستاباي)</span>
                  </h2>
                  <p className="text-xs text-[#94A3B8] mt-1">
                    افحص إيصال التحويل والرقم المرجعي ثم اعتمد الشحن لإضافة الرصيد لمحفظة العميل تلقائياً في Firestore.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold tabular-nums">
                  <span className="px-3 py-1.5 rounded-2xl bg-amber-950/250/15 border border-amber-500/40 text-amber-300">
                    معلق: {adminWalletTopups.filter((t) => t.status === 'pending').length}
                  </span>
                  <span className="px-3 py-1.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300">
                    معتمد: {adminWalletTopups.filter((t) => t.status === 'approved').length}
                  </span>
                </div>
              </div>

              {adminWalletTopups.length === 0 ? (
                <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-12 text-center text-sm text-[#94A3B8]">
                  لا توجد طلبات شحن محفظة مسجلة حالياً.
                </div>
              ) : (
                <div className="space-y-4">
                  {[...adminWalletTopups]
                    .sort((a, b) => {
                      if (a.status === 'pending' && b.status !== 'pending') return -1;
                      if (a.status !== 'pending' && b.status === 'pending') return 1;
                      return (b.createdAtIso || '').localeCompare(a.createdAtIso || '');
                    })
                    .map((req) => {
                      const isPending = req.status === 'pending';
                      const isProcessing = busyKey === `topup_${req.id}`;
                      return (
                        <article
                          key={req.id}
                          className="bg-[#1E293B] border border-[#334155] rounded-2xl p-5 space-y-4"
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div className="space-y-1.5 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-base font-bold text-[#F8FAFC]">
                                  {req.userName || 'عميل إدكاوي'}
                                </span>
                                {req.customerCode && (
                                  <span
                                    dir="ltr"
                                    className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-[#0F172A] border border-[#334155] text-[#FF6B00]"
                                  >
                                    {req.customerCode}
                                  </span>
                                )}
                                <span
                                  className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${
                                    req.method === 'vodafone_cash'
                                      ? 'bg-red-950/300/15 border border-red-500/30 text-red-300'
                                      : 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-300'
                                  }`}
                                >
                                  {req.method === 'vodafone_cash'
                                    ? 'فودافون كاش'
                                    : 'إنستاباي (InstaPay)'}
                                </span>
                                <span
                                  className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${
                                    req.status === 'approved'
                                      ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                                      : req.status === 'rejected'
                                      ? 'bg-red-950/300/15 border border-red-500/30 text-red-300'
                                      : 'bg-amber-950/250/15 border border-amber-500/30 text-amber-300'
                                  }`}
                                >
                                  {req.status === 'approved'
                                    ? 'معتمد ومضاف'
                                    : req.status === 'rejected'
                                    ? 'مرفوض'
                                    : 'بانتظار المراجعة'}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#94A3B8] tabular-nums">
                                <span className="inline-flex items-center gap-1">
                                  <Phone className="w-3.5 h-3.5" />
                                  <span dir="ltr" className="font-mono">
                                    {req.userPhone || req.senderPhone || '—'}
                                  </span>
                                </span>
                                {req.senderPhone && (
                                  <span>
                                    محوّل من:{' '}
                                    <span dir="ltr" className="font-mono text-[#F8FAFC]">
                                      {req.senderPhone}
                                    </span>
                                  </span>
                                )}
                                <span>
                                  المرجع:{' '}
                                  <span dir="ltr" className="font-mono font-bold text-[#F8FAFC]">
                                    {req.referenceNumber}
                                  </span>
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>
                                    {new Date(req.createdAtIso || Date.now()).toLocaleString('ar-EG')}
                                  </span>
                                </span>
                              </div>

                              {(req.adminNote || req.rejectionReason) && (
                                <p className="text-xs text-[#94A3B8]">
                                  ملاحظة الإدارة: <span className="text-[#F8FAFC]">{req.adminNote || req.rejectionReason}</span>
                                </p>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-3 shrink-0">
                              <div className="px-4 py-2 rounded-2xl bg-[#0F172A] border border-[#334155] font-mono font-bold text-lg text-[#FF6B00] tabular-nums">
                                +{req.amount} ج.م
                              </div>

                              {req.receiptImageUrl && (
                                <button
                                  type="button"
                                  onClick={() => setZoomedTopupReceiptUrl(req.receiptImageUrl || null)}
                                  className="px-3 py-2 rounded-2xl bg-[#0F172A] border border-[#334155] hover:border-[#FF6B00] text-xs font-bold text-[#F8FAFC] inline-flex items-center gap-2 cursor-pointer"
                                >
                                  <Eye className="w-4 h-4 text-[#FF6B00]" />
                                  <span>عرض الإيصال</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {isPending && (
                            <div className="pt-3 border-t border-[#334155] flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                              <input
                                type="text"
                                maxLength={160}
                                value={topupNoteById[req.id] ?? ''}
                                onChange={(e) =>
                                  setTopupNoteById((prev) => ({
                                    ...prev,
                                    [req.id]: e.target.value,
                                  }))
                                }
                                placeholder="ملاحظة للعميل (إجباري توضيح السبب عند الرفض)..."
                                className="flex-1 px-3.5 py-2.5 rounded-2xl bg-[#0F172A] border border-[#334155] text-sm text-[#F8FAFC] placeholder:text-[#94A3B8]"
                              />
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  disabled={isProcessing}
                                  onClick={() => void handleProcessWalletTopup(req, 'approved')}
                                  className="min-h-[42px] px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-[#F8FAFC] text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span>{isProcessing ? 'جارٍ التنفيذ...' : 'اعتماد وشحن المحفظة'}</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={isProcessing}
                                  onClick={() => void handleProcessWalletTopup(req, 'rejected')}
                                  className="min-h-[42px] px-4 py-2 rounded-2xl bg-red-600/20 border border-red-500/40 hover:bg-red-600/30 disabled:opacity-60 text-red-300 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
                                >
                                  <XCircle className="w-4 h-4" />
                                  <span>رفض الطلب</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </article>
                      );
                    })}
                </div>
              )}
            </section>
          )}

          {/* ================================================================
           * 8. ZONES & SUPER APP CATEGORIES (إدارة مناطق وتصنيفات إدكو)
           * ============================================================== */}
          {activeSection === 'zones_categories' && (
            <section className="space-y-6">
              {/* Zones Section */}
              <div className="edkawi-soft-card p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-[#F8FAFC] flex items-center gap-2">
                      <MapIcon className="w-5 h-5 text-[#FF6B00]" />
                      <span>إدارة مناطق التوصيل المعتمدة (edko_zones)</span>
                    </h2>
                    <p className="text-xs text-[#94A3B8] mt-1">
                      الأسعار المعتمدة لمناطق مدينة إدكو الخمس؛ أي تعديل هنا يظهر فوراً لكافة العملاء والمناديب عبر onSnapshot.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-[#334155] edkawi-surface-muted text-xs font-bold text-[#94A3B8]">
                        <th className="py-3 px-4">المنطقة والنطاق</th>
                        <th className="py-3 px-4">الأحياء والشوارع التابعة</th>
                        <th className="py-3 px-3">سعر التوصيل (ج.م)</th>
                        <th className="py-3 px-4 text-left">حفظ السعر</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#334155]">
                      {edkoZones.map((zone) => (
                        <tr key={zone.id} className="hover:bg-[#0F172A]/60">
                          <td className="py-3.5 px-4 font-bold text-[#F8FAFC]">
                            <div>{zone.nameAr || zone.name}</div>
                            <div className="text-[11px] text-[#FF6B00] font-normal">{zone.distanceRangeLabel || zone.distanceRangeKm || zone.kmRange || ''}</div>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-[#94A3B8] max-w-md">
                            {zone.streetsAndNeighborhoods.join('، ') || zone.coverageTextAr || zone.areaTitle}
                          </td>
                          <td className="py-3.5 px-3">
                            <input
                              type="number"
                              min={10}
                              max={150}
                              dir="ltr"
                              value={editingZonePrices[zone.id] ?? zone.deliveryFeeEgp ?? zone.deliveryFee}
                              onChange={(e) => {
                                const val = Math.max(5, Number(e.target.value));
                                setEditingZonePrices((prev) => ({ ...prev, [zone.id]: val }));
                              }}
                              className="w-20 px-3 py-1.5 rounded-lg border border-[#334155] text-sm font-mono font-bold text-center"
                            />
                          </td>
                          <td className="py-3.5 px-4 text-left whitespace-nowrap">
                            <button
                              type="button"
                              disabled={busyKey === `zone_${zone.id}`}
                              onClick={() => void handleSaveZonePrice(zone)}
                              className="py-1.5 px-4 rounded-lg bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs font-bold cursor-pointer"
                            >
                              {busyKey === `zone_${zone.id}` ? 'جارٍ الحفظ...' : 'حفظ السعر'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Super App Categories Section */}
              <div className="edkawi-soft-card p-5 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-[#F8FAFC]">
                    أقسام السوبر آب الرئيسية (Super App Categories)
                  </h3>
                  <p className="text-xs text-[#94A3B8] mt-1">
                    إدارة الأقسام الستة (طعام، صيدليات، بقالة، لحوم وأسماك، مستلزمات، ومندوب المشاوير) وتعديل رسومها الافتراضية.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {superAppCategories.map((cat) => (
                    <div key={cat.id} className="p-4 rounded-xl border border-[#334155] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-[#F8FAFC]">{cat.titleAr || cat.name}</span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#0F172A] text-[#94A3B8]">
                          {cat.isActive ? 'مفعل' : 'معطل'}
                        </span>
                      </div>
                      <p className="text-xs text-[#94A3B8] line-clamp-2">{cat.descriptionAr || cat.storeCategory || ''}</p>
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 border-[#334155]">
                        <span className="text-xs font-semibold text-[#94A3B8]">رسم التوصيل:</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            dir="ltr"
                            value={editingCategoryFee[cat.id] ?? cat.defaultDeliveryFeeEgp ?? 15}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value));
                              setEditingCategoryFee((prev) => ({ ...prev, [cat.id]: val }));
                            }}
                            className="w-16 px-2 py-1 rounded border border-[#334155] text-xs font-mono text-center"
                          />
                          <button
                            type="button"
                            disabled={busyKey === `cat_${cat.id}`}
                            onClick={() => void handleSaveCategoryFee(cat)}
                            className="py-1 px-2.5 rounded bg-[#1E293B] hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                          >
                            {busyKey === `cat_${cat.id}` ? '...' : 'حفظ'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ================================================================
           * 5. INTERNAL NOTIFICATIONS CENTER (مركز الإشعارات الداخلية)
           * ============================================================== */}
          {activeSection === 'notifications' && (
            <section className="space-y-6">
              <div className="edkawi-soft-card p-6 space-y-4">
                <div className="flex items-center gap-2.5">
                  <Bell className="w-5 h-5 text-[#FF6B00]" />
                  <div>
                    <h2 className="text-base font-bold text-[#F8FAFC]">
                      إرسال إشعار داخلي مباشر من الإدارة
                    </h2>
                    <p className="text-xs text-[#94A3B8]">
                      يصل الإشعار في نفس اللحظة داخل جرس الإشعارات لدى الفئة التي تحددها (العملاء، المتاجر والصيدليات، المناديب، أو مستخدم بعينه).
                    </p>
                  </div>
                </div>

                <form
                  onSubmit={handleSendNotificationSubmit}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2"
                >
                  <div>
                    <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                      الفئة المستهدفة بالإشعار
                    </label>
                    <select
                      value={notifAudience}
                      onChange={(e) =>
                        setNotifAudience(e.target.value as BroadcastAudience)
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm cursor-pointer"
                    >
                      <option value="all">{AUDIENCE_LABELS.all}</option>
                      <option value="customer">
                        {AUDIENCE_LABELS.customer}
                      </option>
                      <option value="store">{AUDIENCE_LABELS.store}</option>
                      <option value="courier">{AUDIENCE_LABELS.courier}</option>
                      <option value="specific_user">
                        {AUDIENCE_LABELS.specific_user}
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                      تصنيف الإشعار
                    </label>
                    <select
                      value={notifType}
                      onChange={(e) =>
                        setNotifType(e.target.value as AppNotificationType)
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm cursor-pointer"
                    >
                      <option value="system">تنبيه إداري من إدكاوي</option>
                      <option value="promo">عرض ترويجي ومكافآت</option>
                    </select>
                  </div>

                  {notifAudience === 'specific_user' && (
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                        اختر المستلم المحدد (عميل / متجر / صيدلية / مندوب)
                      </label>
                      <select
                        required
                        value={notifRecipientUid}
                        onChange={(e) => setNotifRecipientUid(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm cursor-pointer"
                      >
                        <option value="">-- اختر المستلم من القائمة --</option>
                        {specificRecipientOptions.map((opt) => (
                          <option key={opt.uid} value={opt.uid}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                      عنوان الإشعار
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={100}
                      value={notifTitle}
                      onChange={(e) => setNotifTitle(e.target.value)}
                      placeholder="مثال: توصيل مجاني الليلة على جميع مطاعم وصيدليات إدكو!"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                      نص الرسالة التفصيلي
                    </label>
                    <textarea
                      required
                      rows={3}
                      maxLength={280}
                      value={notifBody}
                      onChange={(e) => setNotifBody(e.target.value)}
                      placeholder="اكتب تفاصيل الرسالة أو التعليمات الموجهة للعملاء أو المتاجر أو المناديب..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm resize-none"
                    />
                  </div>

                  <div className="sm:col-span-2 flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={sendingNotif}
                      className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-60 text-white text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>
                        {sendingNotif
                          ? 'جارٍ إرسال الإشعار...'
                          : 'إرسال الإشعار الآن'}
                      </span>
                    </button>
                  </div>
                </form>
              </div>

              <div className="edkawi-soft-card overflow-hidden">
                <div className="px-5 py-4 border-b border-[#334155]">
                  <h3 className="text-sm font-bold text-[#F8FAFC]">
                    سجل الإشعارات العامة المرسلة ({broadcastHistory.length})
                  </h3>
                </div>

                {broadcastHistory.length === 0 ? (
                  <div className="p-8 text-center text-xs sm:text-sm text-[#94A3B8]">
                    لم يتم إرسال إشعارات جماعية بعد. استخدم النموذج بالأعلى لإرسال أول إشعار.
                  </div>
                ) : (
                  <div className="divide-y divide-[#334155]">
                    {broadcastHistory.map((item) => (
                      <div key={item.id} className="p-5 space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-[#FF6B00]">
                            الفئة: {AUDIENCE_LABELS[item.audience ?? 'all']}
                          </span>
                          <span className="text-slate-400 tabular-nums">
                            {new Date(item.createdAtIso).toLocaleString(
                              'ar-EG',
                              {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              }
                            )}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-[#F8FAFC]">
                          {item.title}
                        </h4>
                        <p className="text-xs text-[#94A3B8] leading-relaxed">
                          {item.body}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ================================================================
           * 6. PROMOTIONAL AD BANNERS (إدارة البنرات بصور حقيقية من الجهاز)
           * ============================================================== */}
          {activeSection === 'ads' && (
            <section className="space-y-6">
              <div className="edkawi-soft-card p-6 space-y-4">
                <div>
                  <h2 className="text-base font-bold text-[#F8FAFC]">
                    إضافة بنر إعلاني جديد بصورة حقيقية من جهازك
                  </h2>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    يتم ضغط الصورة تلقائياً وحفظها في قاعدة البيانات لتظهر فوراً لجميع عملاء إدكاوي في الصفحة الرئيسية بدون أي صور افتراضية.
                  </p>
                </div>

                <form
                  onSubmit={handleCreateAdSubmit}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                >
                  <div className="sm:col-span-2">
                    <DeviceImageInput
                      label="صورة البنر الإعلاني من جهازك (إجباري)"
                      helperText="اختر صورة عرضية واضحة للعرض أو المتجر (يتم ضغطها تلقائياً بجودة عالية)"
                      required
                      value={adImageUrl}
                      onChange={setAdImageUrl}
                      aspectClassName="aspect-[21/9]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                      عنوان العرض الرئيسي
                    </label>
                    <input
                      type="text"
                      required
                      value={adTitle}
                      onChange={(e) => setAdTitle(e.target.value)}
                      placeholder="مثال: خصم ٢٠٪ على مشويات وبحريات إدكو"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                      نص الشارة العلوية
                    </label>
                    <input
                      type="text"
                      required
                      value={adBadge}
                      onChange={(e) => setAdBadge(e.target.value)}
                      placeholder="مثال: عرض حصري اليوم"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                      الوصف التوضيحي للبنر
                    </label>
                    <input
                      type="text"
                      required
                      value={adSubtitle}
                      onChange={(e) => setAdSubtitle(e.target.value)}
                      placeholder="تفاصيل العرض ومميزات التوصيل السريع داخل إدكو"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                      ربط البنر بمتجر أو صيدلية (اختياري)
                    </label>
                    <select
                      value={adStoreId}
                      onChange={(e) => setAdStoreId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm cursor-pointer"
                    >
                      <option value="">بدون ربط بمتجر محدد</option>
                      {stores.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name} ({st.neighborhood})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                      ترتيب الظهور (١ = الأول)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={adSortOrder}
                      onChange={(e) => setAdSortOrder(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                      تاريخ بداية العرض (اختياري)
                    </label>
                    <input
                      type="date"
                      value={adStartDate}
                      onChange={(e) => setAdStartDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                      تاريخ نهاية العرض (اختياري)
                    </label>
                    <input
                      type="date"
                      value={adEndDate}
                      onChange={(e) => setAdEndDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm"
                    />
                  </div>

                  <div className="sm:col-span-2 flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={submittingAd}
                      className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-60 text-white text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>
                        {submittingAd
                          ? 'جارٍ رفع ونشر البنر...'
                          : 'نشر البنر الإعلاني الآن'}
                      </span>
                    </button>
                  </div>
                </form>
              </div>

              <div className="edkawi-soft-card overflow-hidden">
                <div className="px-5 py-4 border-b border-[#334155]">
                  <h3 className="text-sm font-bold text-[#F8FAFC]">
                    البنرات الإعلانية المسجلة ({ads.length})
                  </h3>
                </div>

                {ads.length === 0 ? (
                  <div className="p-10 text-center text-xs sm:text-sm text-[#94A3B8]">
                    لا توجد بنرات إعلانية مضافة حالياً. ارفع صورة بنر من جهازك بالأعلى لتظهر في واجهة العملاء.
                  </div>
                ) : (
                  <div className="divide-y divide-[#334155]">
                    {ads.map((ad) => (
                      <div
                        key={ad.id}
                        className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-28 h-16 rounded-xl overflow-hidden border border-[#334155] shrink-0">
                            <ResilientImage
                              src={ad.imageUrl || ''}
                              alt={ad.title}
                              fallbackTitle={ad.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 space-y-1">
                            <div className="text-xs font-bold text-[#FF6B00]">
                              {ad.badgeText} · ترتيب #{ad.sortOrder}
                            </div>
                            <h4 className="text-sm font-bold text-[#F8FAFC] truncate">
                              {ad.title}
                            </h4>
                            <p className="text-xs text-[#94A3B8] truncate">
                              {ad.subtitle}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                              ad.isActive
                                ? 'bg-emerald-500/15 text-emerald-700 text-emerald-300'
                                : 'bg-slate-200 bg-[#0F172A] text-slate-600 text-[#94A3B8]'
                            }`}
                          >
                            {ad.isActive ? 'معروض الآن' : 'متوقف'}
                          </span>
                          {onToggleAdBannerActive && (
                            <button
                              type="button"
                              disabled={busyKey === `ad_toggle_${ad.id}`}
                              onClick={async () => {
                                setErrorBanner(null);
                                setBusyKey(`ad_toggle_${ad.id}`);
                                try {
                                  await onToggleAdBannerActive(
                                    ad.id,
                                    !ad.isActive
                                  );
                                } catch (err) {
                                  setErrorBanner(
                                    formatAppErrorMessage(
                                      err,
                                      'تعذر تحديث حالة البنر الإعلاني.'
                                    )
                                  );
                                } finally {
                                  setBusyKey(null);
                                }
                              }}
                              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                                ad.isActive
                                  ? 'border border-[#334155] text-[#F8FAFC] hover:bg-[#0F172A]'
                                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
                              }`}
                            >
                              {ad.isActive ? 'إيقاف مؤقت' : 'تفعيل العرض'}
                            </button>
                          )}
                          {onDeleteAdBanner && (
                            <button
                              type="button"
                              disabled={busyKey === `ad_del_${ad.id}`}
                              onClick={() => setConfirmDeleteAdId(ad.id)}
                              aria-label="حذف البنر"
                              className="min-h-[38px] min-w-[38px] rounded-xl border border-red-800 text-red-400 hover:bg-red-950/40 flex items-center justify-center cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ================================================================
           * 7. ROTATING CAMPAIGNS (الفعاليات الدورية وتحديات إدكو)
           * ============================================================== */}
          {activeSection === 'campaigns' && (
            <section className="space-y-6">
              <div className="edkawi-soft-card p-6 space-y-4">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-[#FF6B00]" />
                  <div>
                    <h2 className="text-base font-bold text-[#F8FAFC]">
                      إطلاق فعالية دورية جديدة في مدينة إدكو
                    </h2>
                    <p className="text-xs text-[#94A3B8]">
                      أنشئ فعاليات حقيقية (مضاعفة النقاط، ساعة السعادة، تحدي الأحياء، أو تحدي ٥ طلبات) بصورة من جهازك لتظهر في الصفحة الرئيسية ومساعد إدكاوي الذكي.
                    </p>
                  </div>
                </div>

                <form
                  onSubmit={handleCreateCampaignSubmit}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                >
                  <div className="sm:col-span-2">
                    <DeviceImageInput
                      label="صورة الفعالية من جهازك (إجباري)"
                      required
                      value={campImageUrl}
                      onChange={setCampImageUrl}
                      aspectClassName="aspect-[21/9]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                      عنوان الفعالية
                    </label>
                    <input
                      type="text"
                      required
                      value={campTitle}
                      onChange={(e) => setCampTitle(e.target.value)}
                      placeholder="مثال: ضعف نقاط الولاء على طلبات العشاء!"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                      نوع الفعالية
                    </label>
                    <select
                      value={campType}
                      onChange={(e) =>
                        setCampType(e.target.value as CampaignType)
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm cursor-pointer"
                    >
                      {CAMPAIGN_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                      شرح الفعالية للعميل
                    </label>
                    <input
                      type="text"
                      required
                      value={campSubtitle}
                      onChange={(e) => setCampSubtitle(e.target.value)}
                      placeholder="اشرح كيف يستفيد العميل من الفعالية ويكسب النقاط أو الخصم"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                      نص الشارة المختصر
                    </label>
                    <input
                      type="text"
                      required
                      value={campBadge}
                      onChange={(e) => setCampBadge(e.target.value)}
                      placeholder="مثال: نقاط x2 الليلة"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                      نقاط المكافأة الإضافية
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={5000}
                      value={campRewardPoints}
                      onChange={(e) => setCampRewardPoints(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm tabular-nums"
                    />
                  </div>

                  {campType === 'points_multiplier' && (
                    <div>
                      <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                        معامل مضاعفة النقاط (x2 - x5)
                      </label>
                      <input
                        type="number"
                        min={2}
                        max={5}
                        value={campMultiplier}
                        onChange={(e) => setCampMultiplier(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm tabular-nums"
                      />
                    </div>
                  )}

                  {(campType === 'happy_hour' ||
                    campType === 'mystery_box') && (
                    <div>
                      <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                        نسبة الخصم الإرشادية (%)
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={80}
                        value={campDiscountPct}
                        onChange={(e) => setCampDiscountPct(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm tabular-nums"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                      حي مستهدف في إدكو (اختياري)
                    </label>
                    <select
                      value={campNeighborhood}
                      onChange={(e) => setCampNeighborhood(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm cursor-pointer"
                    >
                      <option value="">جميع أحياء مدينة إدكو</option>
                      {EDKU_NEIGHBORHOODS.map((area) => (
                        <option key={area} value={area}>
                          {area}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2 flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={submittingCampaign}
                      className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-60 text-white text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Flame className="w-4 h-4" />
                      <span>
                        {submittingCampaign
                          ? 'جارٍ إطلاق الفعالية...'
                          : 'إطلاق الفعالية الآن'}
                      </span>
                    </button>
                  </div>
                </form>
              </div>

              <div className="edkawi-soft-card overflow-hidden">
                <div className="px-5 py-4 border-b border-[#334155]">
                  <h3 className="text-sm font-bold text-[#F8FAFC]">
                    الفعاليات المسجلة ({campaigns.length})
                  </h3>
                </div>

                {campaigns.length === 0 ? (
                  <div className="p-10 text-center text-xs sm:text-sm text-[#94A3B8]">
                    لا توجد فعاليات دورية مسجلة حالياً.
                  </div>
                ) : (
                  <div className="divide-y divide-[#334155]">
                    {campaigns.map((camp) => (
                      <div
                        key={camp.id}
                        className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-24 h-16 rounded-xl overflow-hidden border border-[#334155] shrink-0">
                            <ResilientImage
                              src={camp.imageUrl || ''}
                              alt={camp.title}
                              fallbackTitle={camp.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 space-y-1">
                            <div className="text-xs font-bold text-[#FF6B00]">
                              {camp.badgeText}
                            </div>
                            <h4 className="text-sm font-bold text-[#F8FAFC] truncate">
                              {camp.title}
                            </h4>
                            <p className="text-xs text-[#94A3B8] truncate">
                              {camp.subtitle}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {onToggleCampaignActive && (
                            <button
                              type="button"
                              onClick={() =>
                                void onToggleCampaignActive(
                                  camp.id,
                                  !camp.isActive
                                )
                              }
                              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                                camp.isActive
                                  ? 'border border-[#334155] text-[#F8FAFC]'
                                  : 'bg-emerald-600 text-white'
                              }`}
                            >
                              {camp.isActive ? 'إيقاف مؤقت' : 'تفعيل الفعالية'}
                            </button>
                          )}
                          {onDeleteCampaign && (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteCampaignId(camp.id)}
                              aria-label="حذف الفعالية"
                              className="min-h-[38px] min-w-[38px] rounded-xl border border-red-800 text-red-400 hover:bg-red-950/40 flex items-center justify-center cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ================================================================
           * 8. DISCOUNT COUPONS MANAGEMENT (إدارة الكوبونات مع تاريخ الانتهاء)
           * ============================================================== */}
          {activeSection === 'coupons' && (
            <section className="space-y-6">
              <div className="edkawi-soft-card p-6 space-y-4">
                <div>
                  <h2 className="text-base font-bold text-[#F8FAFC]">
                    إنشاء أو تحديث كود خصم ترويجي
                  </h2>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    يتم التحقق من الكود والحد الأدنى وتاريخ الانتهاء تلقائياً في سلة العميل.
                  </p>
                </div>

                <form
                  onSubmit={handleUpsertCouponSubmit}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
                >
                  <div>
                    <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                      كود الكوبون (إنجليزي)
                    </label>
                    <input
                      type="text"
                      required
                      dir="ltr"
                      value={couponCode}
                      onChange={(e) =>
                        setCouponCode(e.target.value.toUpperCase())
                      }
                      placeholder="EDKAWY25"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm font-mono font-bold uppercase text-left"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                      نسبة الخصم (%)
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={90}
                      value={couponPercent}
                      onChange={(e) => setCouponPercent(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                      الحد الأقصى للخصم (ج.م)
                    </label>
                    <input
                      type="number"
                      required
                      min={5}
                      max={2000}
                      value={couponMaxEgp}
                      onChange={(e) => setCouponMaxEgp(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                      الحد الأدنى للسلة (ج.م)
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      max={5000}
                      value={couponMinOrder}
                      onChange={(e) => setCouponMinOrder(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                      تاريخ الانتهاء (اختياري)
                    </label>
                    <input
                      type="date"
                      value={couponExpiryDate}
                      onChange={(e) => setCouponExpiryDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm"
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-4">
                    <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                      وصف الكوبون للعميل
                    </label>
                    <input
                      type="text"
                      required
                      value={couponDesc}
                      onChange={(e) => setCouponDesc(e.target.value)}
                      placeholder="مثال: خصم ترحيبي ٢٥٪ لعملاء تطبيق إدكاوي"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={submittingCoupon}
                      className="w-full min-h-[42px] px-4 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-60 text-white text-sm font-bold cursor-pointer"
                    >
                      {submittingCoupon ? 'جارٍ الحفظ...' : 'حفظ الكوبون'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="edkawi-soft-card overflow-hidden">
                <div className="px-5 py-4 border-b border-[#334155]">
                  <h3 className="text-sm font-bold text-[#F8FAFC]">
                    الكوبونات المسجلة في النظام ({coupons.length})
                  </h3>
                </div>

                {coupons.length === 0 ? (
                  <div className="p-8 text-center text-xs sm:text-sm text-[#94A3B8]">
                    لا توجد كوبونات مسجلة حالياً. أنشئ أول كوبون من النموذج بالأعلى.
                  </div>
                ) : (
                  <div className="divide-y divide-[#334155]">
                    {coupons.map((c) => {
                      const expired = isCouponExpired(c.expiryDateIso);
                      return (
                        <div
                          key={c.id}
                          className="p-5 flex flex-wrap items-center justify-between gap-4"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span
                                dir="ltr"
                                className="font-mono text-base font-bold text-[#FF6B00]"
                              >
                                {c.code}
                              </span>
                              <span className="text-xs font-bold text-[#F8FAFC] tabular-nums">
                                خصم {c.discountPercent}% (حتى {c.maxDiscountEgp}{' '}
                                ج.م)
                              </span>
                              <span className="text-xs text-slate-400 tabular-nums">
                                · حد أدنى {c.minOrderEgp} ج.م
                              </span>
                              {c.expiryDateIso && (
                                <span
                                  className={`text-xs font-semibold tabular-nums ${
                                    expired
                                      ? 'text-red-400'
                                      : 'text-[#94A3B8]'
                                  }`}
                                >
                                  ·{' '}
                                  {expired
                                    ? `منتهي (${c.expiryDateIso})`
                                    : `ينتهي ${c.expiryDateIso}`}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[#94A3B8]">
                              {c.description}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {onToggleCouponActive && (
                              <button
                                type="button"
                                onClick={() =>
                                  void onToggleCouponActive(c.id, !c.isActive)
                                }
                                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                                  c.isActive
                                    ? 'border border-[#334155] text-[#F8FAFC]'
                                    : 'bg-emerald-600 text-white'
                                }`}
                              >
                                {c.isActive ? 'إيقاف الكود' : 'تفعيل الكود'}
                              </button>
                            )}
                            {onDeleteCoupon && (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteCouponId(c.id)}
                                aria-label="حذف الكوبون"
                                className="min-h-[38px] min-w-[38px] rounded-xl border border-red-800 text-red-400 hover:bg-red-950/40 flex items-center justify-center cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ================================================================
           * 9. CUSTOMERS DIRECTORY, UNIQUE CODE SEARCH & BAN SYSTEM (صفحة العملاء)
           * ============================================================== */}
          {(activeSection === 'customers' || activeSection === 'loyalty') && (
            <section className="space-y-5">
              <div className="edkawi-soft-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#FF6B00]/10 text-[#FF6B00] flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#F8FAFC]">
                      سجل عملاء إدكاوي وكود العميل الفريد (Customer Code)
                    </h2>
                    <p className="text-xs text-[#94A3B8] mt-0.5">
                      ابحث بالاسم، رقم الموبايل، أو كود العميل (EDK-USR-XXXX)، مع التحكم الفوري في الحظر وإهداء نقاط الولاء.
                    </p>
                  </div>
                </div>

                <div className="relative w-full md:w-96">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="ابحث بالاسم، رقم الموبايل، أو EDK-USR-XXXX..."
                    className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-[#334155] text-sm"
                  />
                </div>
              </div>

              {filteredCustomers.length === 0 ? (
                <div className="edkawi-soft-card p-10 text-center text-xs sm:text-sm text-[#94A3B8]">
                  {customerSearch.trim()
                    ? 'لا توجد نتائج مطابقة لبحثك بالاسم أو رقم الموبايل أو كود العميل.'
                    : 'لا يوجد عملاء مسجلون حتى الآن. سيظهر العملاء هنا تلقائياً فور تسجيل دخولهم مع كود العميل الفريد.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredCustomers.map((cust) => {
                    const isCustBanned = Boolean(
                      cust.isBanned || blockedEntities[cust.uid]?.isBlocked
                    );
                    const selectedBanType =
                      banTypeByCustomerUid[cust.uid] ?? 'permanent';
                    const banReasonDraft =
                      banReasonByCustomerUid[cust.uid] ?? '';
                    const activeBanReason =
                      cust.banReason ||
                      blockedEntities[cust.uid]?.reason ||
                      'مخالفة سياسة الاستخدام';
                    const activeBanTypeLabel =
                      cust.banType === 'temporary_24h'
                        ? 'حظر مؤقت 24 ساعة'
                        : cust.banType === 'suspended'
                        ? 'إيقاف مؤقت للمراجعة'
                        : 'حظر دائم';
                    return (
                      <div
                        key={cust.uid}
                        className={`bg-[#1E293B] border rounded-2xl p-5 flex flex-col gap-4 ${
                          isCustBanned
                            ? 'border-red-500/60'
                            : 'border-[#334155]'
                        }`}
                      >
                        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <h3 className="text-sm sm:text-base font-bold text-[#F8FAFC]">
                                {cust.name}
                              </h3>
                              {cust.customerCode && (
                                <span className="inline-flex items-center gap-1.5">
                                  <span
                                    dir="ltr"
                                    className="font-mono text-xs sm:text-sm font-bold text-[#FF6B00] tabular-nums"
                                  >
                                    {cust.customerCode}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleCopyText(
                                        cust.customerCode || '',
                                        `cc_${cust.uid}`
                                      )
                                    }
                                    title="نسخ كود العميل"
                                    className="p-1 rounded-lg border border-[#334155] bg-[#0F172A] hover:border-[#FF6B00] text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
                                  >
                                    {copiedKey === `cc_${cust.uid}` ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </span>
                              )}
                              {isCustBanned && (
                                <span className="px-2.5 py-0.5 rounded-lg bg-red-950/300/15 border border-red-500/40 text-xs font-bold text-red-300">
                                  {activeBanTypeLabel}
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#94A3B8] tabular-nums">
                              <span className="inline-flex items-center gap-1">
                                <Phone className="w-3.5 h-3.5" />
                                <span dir="ltr" className="font-mono text-[#F8FAFC]">
                                  {cust.phone || 'بدون رقم موبايل'}
                                </span>
                              </span>
                              {cust.neighborhood && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>{cust.neighborhood}</span>
                                </>
                              )}
                              <span aria-hidden="true">·</span>
                              <span className="font-bold text-[#FF6B00]">
                                الرصيد: {cust.points} نقطة
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>طلبات مكتملة: {cust.totalDeliveredOrders}</span>
                            </div>

                            {isCustBanned && (
                              <p className="text-xs text-red-300">
                                سبب الحظر: {activeBanReason}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="number"
                              min={5}
                              max={10000}
                              value={giftPointsByUid[cust.uid] ?? ''}
                              onChange={(e) =>
                                setGiftPointsByUid((prev) => ({
                                  ...prev,
                                  [cust.uid]: e.target.value,
                                }))
                              }
                              placeholder="نقاط (50)"
                              className="w-28 px-3 py-2 rounded-2xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-xs tabular-nums"
                            />
                            <input
                              type="text"
                              maxLength={120}
                              value={giftNoteByUid[cust.uid] ?? ''}
                              onChange={(e) =>
                                setGiftNoteByUid((prev) => ({
                                  ...prev,
                                  [cust.uid]: e.target.value,
                                }))
                              }
                              placeholder="رسالة الإهداء (اختياري)"
                              className="w-40 px-3 py-2 rounded-2xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-xs"
                            />
                            <button
                              type="button"
                              disabled={busyKey === `gift_${cust.uid}`}
                              onClick={() => void handleGiftPointsClick(cust)}
                              className="min-h-[38px] px-3.5 py-2 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-60 text-[#F8FAFC] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                            >
                              <Gift className="w-3.5 h-3.5" />
                              <span>
                                {busyKey === `gift_${cust.uid}`
                                  ? 'جارٍ الإهداء...'
                                  : 'إهداء نقاط'}
                              </span>
                            </button>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-[#334155] flex flex-wrap items-center gap-2.5 justify-between">
                          {!isCustBanned ? (
                            <div className="flex flex-wrap items-center gap-2 flex-1">
                              <select
                                value={selectedBanType}
                                onChange={(e) =>
                                  setBanTypeByCustomerUid((prev) => ({
                                    ...prev,
                                    [cust.uid]: e.target.value as CustomerBanType,
                                  }))
                                }
                                className="px-3 py-2 rounded-2xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-xs font-semibold cursor-pointer"
                              >
                                <option value="temporary_24h">حظر مؤقت ٢٤ ساعة</option>
                                <option value="suspended">إيقاف مؤقت للمراجعة</option>
                                <option value="permanent">حظر دائم نهائي</option>
                              </select>
                              <input
                                type="text"
                                maxLength={200}
                                value={banReasonDraft}
                                onChange={(e) =>
                                  setBanReasonByCustomerUid((prev) => ({
                                    ...prev,
                                    [cust.uid]: e.target.value,
                                  }))
                                }
                                placeholder="سبب الحظر (يصل للعميل بإشعار فوري)..."
                                className="flex-1 min-w-[200px] px-3 py-2 rounded-2xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-xs placeholder:text-[#94A3B8]"
                              />
                            </div>
                          ) : (
                            <span className="text-xs text-[#94A3B8]">
                              يمكنك فك الحظر وإعادة تفعيل استقبال الطلبات لهذا العميل فوراً.
                            </span>
                          )}

                          <button
                            type="button"
                            disabled={busyKey === `ban_cust_${cust.uid}`}
                            onClick={() =>
                              setConfirmBanTarget({
                                customer: cust,
                                currentlyBanned: isCustBanned,
                                banType: selectedBanType,
                                reason:
                                  banReasonDraft.trim() ||
                                  (isCustBanned
                                    ? 'تم إلغاء الحظر وإعادة تفعيل حساب العميل'
                                    : 'تم حظر الحساب لمخالفة سياسة الاستخدام — يرجى التواصل مع الدعم'),
                              })
                            }
                            className={`min-h-[38px] px-4 py-2 rounded-2xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                              isCustBanned
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-[#F8FAFC]'
                                : 'bg-red-600 hover:bg-red-700 text-[#F8FAFC]'
                            }`}
                          >
                            {isCustBanned ? (
                              <>
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>
                                  {busyKey === `ban_cust_${cust.uid}`
                                    ? 'جارٍ التحديث...'
                                    : 'إلغاء الحظر'}
                                </span>
                              </>
                            ) : (
                              <>
                                <Ban className="w-3.5 h-3.5" />
                                <span>
                                  {busyKey === `ban_cust_${cust.uid}`
                                    ? 'جارٍ الحظر...'
                                    : 'تنفيذ الحظر'}
                                </span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* ================================================================
           * 10. FRAUD & SECURITY CENTER (مركز الأمان ومكافحة التلاعب)
           * ============================================================== */}
          {activeSection === 'security' && (
            <section className="space-y-6">
              {/* Real-Time Fraud & Suspicious Behavior Detection Table */}
              <div className="edkawi-soft-card overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-[#334155] flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 text-xs font-bold text-[#FF6B00]">
                      <ShieldAlert className="w-4 h-4" />
                      <span>نظام رصد السلوك المشبوه الآلي (Fraud Detection)</span>
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-[#F8FAFC]">
                      تنبيهات مكافحة التلاعب والاحتيال الحية (
                      <span className="font-mono tabular-nums">
                        {fraudAlerts.length}
                      </span>
                      )
                    </h2>
                    <p className="text-xs text-[#94A3B8]">
                      يرصد تلقائياً: إلغاء أكثر من ٣ طلبات في يوم واحد · طلبات متتالية في أقل من دقيقة · مناديب يقبلون الطلبات ثم يلغونها بشكل متكرر.
                    </p>
                  </div>
                </div>

                {fraudAlerts.length === 0 ? (
                  <div className="p-8 text-center space-y-2">
                    <ShieldCheck className="w-9 h-9 text-emerald-400 mx-auto" />
                    <p className="text-sm font-bold text-[#F8FAFC]">
                      لا توجد تنبيهات تلاعب أو سلوك مشبوه حالياً
                    </p>
                    <p className="text-xs text-[#94A3B8]">
                      جميع عمليات الطلبات والتوصيل في مدينة إدكو تسير بمعدلات طبيعية وآمنة.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="border-b border-[#334155] edkawi-surface-muted text-xs font-bold text-[#94A3B8]">
                          <th className="py-3.5 px-5">الاسم ونوع الحساب</th>
                          <th className="py-3.5 px-4">رقم الموبايل</th>
                          <th className="py-3.5 px-4">كود العميل</th>
                          <th className="py-3.5 px-4">نوع المخالفة المرصودة</th>
                          <th className="py-3.5 px-4">التكرار</th>
                          <th className="py-3.5 px-5 text-left">الإجراء الأمني</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#334155] text-xs sm:text-sm">
                        {fraudAlerts.map((alertItem) => (
                          <tr
                            key={alertItem.id}
                            className="hover:bg-[#0F172A]/60"
                          >
                            <td className="py-3.5 px-5">
                              <p className="font-bold text-[#F8FAFC]">
                                {alertItem.personName}
                              </p>
                              <p className="text-[11px] text-[#94A3B8]">
                                {alertItem.entityType === 'courier'
                                  ? 'مندوب توصيل'
                                  : 'حساب عميل'}
                              </p>
                            </td>
                            <td
                              dir="ltr"
                              className="py-3.5 px-4 font-mono tabular-nums text-right text-[#F8FAFC]"
                            >
                              {alertItem.phone || '—'}
                            </td>
                            <td
                              dir="ltr"
                              className="py-3.5 px-4 font-mono font-bold tabular-nums text-right text-[#FF6B00]"
                            >
                              {alertItem.customerCode || '—'}
                            </td>
                            <td className="py-3.5 px-4">
                              <p
                                className={`font-bold ${
                                  alertItem.severity === 'high'
                                    ? 'text-red-400'
                                    : 'text-amber-400'
                                }`}
                              >
                                {alertItem.violationLabelAr}
                              </p>
                              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                                {alertItem.detailsAr}
                              </p>
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold tabular-nums text-[#F8FAFC]">
                              {alertItem.occurrencesCount}
                            </td>
                            <td className="py-3.5 px-5 text-left whitespace-nowrap">
                              {alertItem.entityType === 'customer' ? (
                                <button
                                  type="button"
                                  disabled={
                                    busyKey === `ban_cust_${alertItem.entityId}`
                                  }
                                  onClick={() =>
                                    setConfirmBanTarget({
                                      customer: {
                                        uid: alertItem.entityId,
                                        name: alertItem.personName,
                                        customerCode: alertItem.customerCode,
                                      },
                                      currentlyBanned: Boolean(alertItem.isBanned),
                                      banType: 'permanent',
                                      reason: alertItem.violationLabelAr,
                                    })
                                  }
                                  className={`px-3.5 py-2 rounded-2xl text-xs font-bold cursor-pointer ${
                                    alertItem.isBanned
                                      ? 'bg-emerald-600 hover:bg-emerald-700 text-[#F8FAFC]'
                                      : 'bg-red-600 hover:bg-red-700 text-[#F8FAFC]'
                                  }`}
                                >
                                  {alertItem.isBanned
                                    ? 'إلغاء الحظر'
                                    : 'حظر العميل'}
                                </button>
                              ) : (
                                onSetEntityBlocked && (
                                  <button
                                    type="button"
                                    disabled={
                                      busyKey === `block_${alertItem.entityId}`
                                    }
                                    onClick={() =>
                                      void handleQuickBlockToggle({
                                        targetId: alertItem.entityId,
                                        targetType: 'courier',
                                        targetName: alertItem.personName,
                                        currentlyBlocked: Boolean(
                                          alertItem.isBanned
                                        ),
                                      })
                                    }
                                    className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                                      alertItem.isBanned
                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                        : 'bg-red-600 hover:bg-red-700 text-white'
                                    }`}
                                  >
                                    {alertItem.isBanned
                                      ? 'إلغاء الحظر'
                                      : 'حظر المندوب'}
                                  </button>
                                )
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              {/* Maintenance Mode Control Card */}
              <div className="edkawi-soft-card p-6 space-y-5 border-2 border-amber-500/25">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1 max-w-2xl">
                    <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-400">
                      <Wrench className="w-4 h-4" />
                      <span>التحكم المركزي في وضع الصيانة</span>
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-[#F8FAFC]">
                      وضع الصيانة المؤقت لمنصة إدكاوي (Maintenance Mode)
                    </h2>
                    <p className="text-xs text-[#94A3B8] leading-relaxed">
                      عند تفعيل وضع الصيانة، تظهر شاشة الصيانة تلقائياً للعملاء والمتاجر والمناديب مع إيقاف استقبال الطلبات الجديدة مؤقتاً، بينما تبقى لوحة الإدارة مفتوحة بالكامل لك.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={savingMaintenance}
                    onClick={() =>
                      void handleSaveMaintenanceMode(
                        !maintenanceConfig?.maintenanceMode
                      )
                    }
                    className={`min-h-[44px] px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                      maintenanceConfig?.maintenanceMode
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-amber-950/250 hover:bg-amber-600 text-slate-950'
                    }`}
                  >
                    <Wrench className="w-4 h-4" />
                    <span>
                      {savingMaintenance
                        ? 'جارٍ التحديث...'
                        : maintenanceConfig?.maintenanceMode
                        ? 'إيقاف الصيانة وتشغيل التطبيق الآن'
                        : 'تفعيل وضع الصيانة الآن'}
                    </span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end pt-2 border-t border-[#334155]">
                  <div className="sm:col-span-9">
                    <label className="block text-xs font-bold text-[#94A3B8] mb-1.5">
                      رسالة الصيانة التي تظهر للمستخدمين
                    </label>
                    <textarea
                      rows={2}
                      maxLength={320}
                      value={maintMessageInput}
                      onChange={(e) => setMaintMessageInput(e.target.value)}
                      placeholder="اكتب رسالة التوضيح للعملاء والمتاجر أثناء فترة الصيانة..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm resize-none"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <button
                      type="button"
                      disabled={savingMaintenance}
                      onClick={() =>
                        void handleSaveMaintenanceMode(
                          Boolean(maintenanceConfig?.maintenanceMode)
                        )
                      }
                      className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#1E293B] hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                    >
                      حفظ نص الرسالة
                    </button>
                  </div>
                </div>
              </div>

              {/* Surge Pricing, Payment Methods & SMTP Live Operations Card */}
              <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-6 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 text-xs font-bold text-[#FF6B00]">
                      <Zap className="w-4 h-4" />
                      <span>إعدادات التشغيل والذروة ووسائل الدفع</span>
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-[#F8FAFC]">
                      تسعير الذروة ووسائل الدفع المعتمدة وحالة البريد (SMTP)
                    </h2>
                  </div>

                  <button
                    type="button"
                    disabled={savingOperationsSettings}
                    onClick={() => void handleSaveSystemOperationsSettings()}
                    className="min-h-[42px] px-5 py-2 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-60 text-[#F8FAFC] text-xs sm:text-sm font-bold cursor-pointer"
                  >
                    {savingOperationsSettings ? 'جارٍ الحفظ...' : 'حفظ إعدادات التشغيل'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Surge Pricing */}
                  <div className="p-4 rounded-2xl bg-[#0F172A] border border-[#334155] space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#F8FAFC] inline-flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-[#FF6B00]" />
                        تسعير وقت الذروة
                      </span>
                      <input
                        type="checkbox"
                        checked={surgeEnabledInput}
                        onChange={(e) => setSurgeEnabledInput(e.target.checked)}
                        className="w-4 h-4 accent-[#FF6B00] cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#94A3B8] mb-1">
                        معامل المضاعفة (1.0 - 3.0)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={3}
                        step={0.1}
                        dir="ltr"
                        value={surgeMultiplierInput}
                        onChange={(e) => setSurgeMultiplierInput(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-[#1E293B] border border-[#334155] text-sm font-mono text-[#F8FAFC]"
                      />
                    </div>
                  </div>

                  {/* Payment Methods */}
                  <div className="p-4 rounded-2xl bg-[#0F172A] border border-[#334155] space-y-2.5">
                    <span className="text-xs font-bold text-[#F8FAFC] inline-flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-[#FF6B00]" />
                      وسائل الدفع المتاحة للعملاء
                    </span>
                    <label className="flex items-center justify-between text-xs text-[#F8FAFC] cursor-pointer">
                      <span>الدفع عند الاستلام (كاش)</span>
                      <input
                        type="checkbox"
                        checked={paymentMethodsInput.cash}
                        onChange={(e) =>
                          setPaymentMethodsInput((prev) => ({ ...prev, cash: e.target.checked }))
                        }
                        className="w-4 h-4 accent-[#FF6B00] cursor-pointer"
                      />
                    </label>
                    <label className="flex items-center justify-between text-xs text-[#F8FAFC] cursor-pointer">
                      <span>محفظة إدكاوي الإلكترونية</span>
                      <input
                        type="checkbox"
                        checked={paymentMethodsInput.wallet}
                        onChange={(e) =>
                          setPaymentMethodsInput((prev) => ({ ...prev, wallet: e.target.checked }))
                        }
                        className="w-4 h-4 accent-[#FF6B00] cursor-pointer"
                      />
                    </label>
                    <label className="flex items-center justify-between text-xs text-[#F8FAFC] cursor-pointer">
                      <span>بطاقة بنكية / فيزا</span>
                      <input
                        type="checkbox"
                        checked={paymentMethodsInput.visa}
                        onChange={(e) =>
                          setPaymentMethodsInput((prev) => ({ ...prev, visa: e.target.checked }))
                        }
                        className="w-4 h-4 accent-[#FF6B00] cursor-pointer"
                      />
                    </label>
                  </div>

                  {/* SMTP Status */}
                  <div className="p-4 rounded-2xl bg-[#0F172A] border border-[#334155] space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#F8FAFC] inline-flex items-center gap-1.5">
                        <Mail className="w-4 h-4 text-[#FF6B00]" />
                        حالة خادم البريد (SMTP)
                      </span>
                      <input
                        type="checkbox"
                        checked={smtpEnabledInput}
                        onChange={(e) => setSmtpEnabledInput(e.target.checked)}
                        className="w-4 h-4 accent-[#FF6B00] cursor-pointer"
                      />
                    </div>
                    <div className="text-xs space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-lg font-bold ${
                            smtpStatus?.configured
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-950/250/15 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {smtpStatus?.configured ? 'SMTP متصل وجاهز' : 'غير مُهيأ بعد'}
                        </span>
                      </div>
                      {smtpStatus?.host && (
                        <p dir="ltr" className="font-mono text-[11px] text-[#94A3B8]">
                          {smtpStatus.host}:{smtpStatus.port} ({smtpStatus.fromMasked})
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Account & Store Blocking Form */}
              <div className="edkawi-soft-card p-6 space-y-4">
                <div className="flex items-center gap-2.5">
                  <Ban className="w-5 h-5 text-red-600" />
                  <div>
                    <h2 className="text-base font-bold text-[#F8FAFC]">
                      حظر حساب عميل أو مندوب أو متجر مخالف
                    </h2>
                    <p className="text-xs text-[#94A3B8]">
                      يتم تطبيق الحظر فوراً على مستوى قواعد بيانات Firestore وواجهة التطبيق في نفس اللحظة.
                    </p>
                  </div>
                </div>

                <form
                  onSubmit={handleBlockFormSubmit}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-4 pt-2"
                >
                  <div className="sm:col-span-4">
                    <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                      نوع الحساب المراد حظره
                    </label>
                    <select
                      value={blockTargetType}
                      onChange={(e) => {
                        setBlockTargetType(e.target.value as BlockedEntityType);
                        setBlockTargetId('');
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm cursor-pointer"
                    >
                      <option value="customer">حساب عميل</option>
                      <option value="courier">حساب مندوب توصيل</option>
                      <option value="store">متجر أو صيدلية</option>
                    </select>
                  </div>

                  <div className="sm:col-span-8">
                    <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                      اختر الحساب من القائمة المسجلة
                    </label>
                    <select
                      required
                      value={blockTargetId}
                      onChange={(e) => setBlockTargetId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm cursor-pointer"
                    >
                      <option value="">-- اختر الحساب أو المتجر --</option>
                      {blockCandidateOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-9">
                    <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                      سبب الحظر (يظهر لصاحب الحساب الموقوف)
                    </label>
                    <input
                      type="text"
                      maxLength={240}
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      placeholder="مثال: تكرار الطلبات الوهمية أو مخالفة ضوابط الجودة في إدكاوي"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm"
                    />
                  </div>

                  <div className="sm:col-span-3 flex items-end">
                    <button
                      type="submit"
                      disabled={submittingBlock}
                      className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Ban className="w-4 h-4" />
                      <span>
                        {submittingBlock ? 'جارٍ الحظر...' : 'تنفيذ الحظر فوراً'}
                      </span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Active Blocked Accounts Table */}
              <div className="edkawi-soft-card overflow-hidden">
                <div className="px-5 py-4 border-b border-[#334155] flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-[#F8FAFC]">
                    قائمة الحسابات والمتاجر المحظورة حالياً ({activeBlockedList.length})
                  </h3>
                </div>

                {activeBlockedList.length === 0 ? (
                  <div className="p-8 text-center text-xs sm:text-sm text-[#94A3B8]">
                    لا توجد أي حسابات أو متاجر محظورة حالياً.
                  </div>
                ) : (
                  <div className="divide-y divide-[#334155]">
                    {activeBlockedList.map((item) => (
                      <div
                        key={item.targetId}
                        className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                            <span className="text-red-400">
                              {item.targetType === 'store'
                                ? 'متجر / صيدلية'
                                : item.targetType === 'courier'
                                ? 'مندوب توصيل'
                                : 'عميل'}
                            </span>
                            <span className="text-slate-400">·</span>
                            <span className="text-sm text-[#F8FAFC]">
                              {item.targetName || item.targetId}
                            </span>
                          </div>
                          <p className="text-xs text-[#94A3B8]">
                            السبب: {item.reason}
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={busyKey === `block_${item.targetId}`}
                          onClick={() =>
                            void handleQuickBlockToggle({
                              targetId: item.targetId,
                              targetType: item.targetType,
                              targetName: item.targetName || item.targetId,
                              currentlyBlocked: true,
                            })
                          }
                          className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
                        >
                          {busyKey === `block_${item.targetId}`
                            ? 'جارٍ فك الحظر...'
                            : 'فك الحظر وإعادة التفعيل'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ================================================================
           * 10-B. QA & TESTING CENTER (مركز الاختبارات وفحص الجاهزية)
           * ============================================================== */}
          {activeSection === 'testing' && (
            <section className="space-y-6">
              {/* Live Verification Counters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="edkawi-soft-card p-5 space-y-1.5">
                  <p className="text-xs font-semibold text-[#94A3B8]">
                    إجمالي المستخدمين المسجلين
                  </p>
                  <p className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-[#F8FAFC]">
                    {totalUniqueUsersCount}
                  </p>
                  <p className="text-[11px] text-[#94A3B8] tabular-nums">
                    عملاء: {effectiveCustomers.length} · مناديب: {couriers.length}{' '}
                    · فريق العمل: {staffMembers.length}
                  </p>
                </div>

                <div className="edkawi-soft-card p-5 space-y-1.5">
                  <p className="text-xs font-semibold text-[#94A3B8]">
                    إجمالي الطلبات في قاعدة البيانات
                  </p>
                  <p className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-[#FF6B00]">
                    {orders.length}
                  </p>
                  <p className="text-[11px] text-[#94A3B8] tabular-nums">
                    مكتملة:{' '}
                    {orders.filter((o) => o.status === 'delivered').length} · قيد
                    التنفيذ: {stats.activeOrdersCount}
                  </p>
                </div>

                <div className="edkawi-soft-card p-5 space-y-1.5">
                  <p className="text-xs font-semibold text-[#94A3B8]">
                    عدد المتاجر والصيدليات النشطة
                  </p>
                  <p className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-emerald-400">
                    {activeStoresCount}
                  </p>
                  <p className="text-[11px] text-[#94A3B8] tabular-nums">
                    من إجمالي {stores.length} متجر وصيدلية مسجلة
                  </p>
                </div>
              </div>

              {/* Interactive QA Diagnostic Actions */}
              <div className="edkawi-soft-card p-6 space-y-5">
                <div className="space-y-1">
                  <h2 className="text-base sm:text-lg font-bold text-[#F8FAFC]">
                    أدوات الاختبار والفحص الحي لقاعدة بيانات Firestore
                  </h2>
                  <p className="text-xs text-[#94A3B8]">
                    اختبر صلاحيات الإنشاء والتحديث والقراءة والحذف الذري في الوقت الفعلي دون ترك أي بيانات وهمية في المنصة.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    type="button"
                    disabled={qaRunningAction !== null}
                    onClick={() => void handleRunSimulateOrderTest()}
                    className="min-h-[56px] px-5 py-3.5 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-60 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2.5 cursor-pointer"
                  >
                    <Beaker className="w-5 h-5 shrink-0" />
                    <span>
                      {qaRunningAction === 'simulate'
                        ? 'جارٍ محاكاة الطلب ومسحه...'
                        : 'اختبار إنشاء طلب وهمي'}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={qaRunningAction !== null}
                    onClick={() => void handleRunFirebaseHealthCheck()}
                    className="min-h-[56px] px-5 py-3.5 rounded-2xl bg-[#1E293B] hover:bg-slate-800 disabled:opacity-60 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2.5 cursor-pointer"
                  >
                    <Database className="w-5 h-5 text-[#FF6B00] shrink-0" />
                    <span>
                      {qaRunningAction === 'health'
                        ? 'جارٍ قياس الاستجابة...'
                        : 'فحص الاتصال بقاعدة البيانات'}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={qaRunningAction !== null}
                    onClick={() => setConfirmPurgeType('qa')}
                    className="min-h-[56px] px-5 py-3.5 rounded-2xl border border-red-800/80 hover:bg-red-950/40 disabled:opacity-60 text-red-300 text-xs sm:text-sm font-bold flex items-center justify-center gap-2.5 cursor-pointer"
                  >
                    <Trash2 className="w-5 h-5 shrink-0" />
                    <span>
                      {qaRunningAction === 'purge'
                        ? 'جارٍ مسح بيانات الاختبار...'
                        : 'مسح بيانات الاختبار'}
                    </span>
                  </button>
                </div>

                {/* Firebase Connection Result Panel */}
                {qaHealthResult && (
                  <div className="p-4 rounded-xl edkawi-surface-muted border border-[#334155] flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Activity
                        className={`w-5 h-5 ${
                          qaHealthResult.connected
                            ? 'text-emerald-400'
                            : 'text-red-400'
                        }`}
                      />
                      <div>
                        <p className="text-sm font-bold text-[#F8FAFC]">
                          {qaHealthResult.statusLabelAr}
                        </p>
                        {qaHealthResult.errorDetail && (
                          <p className="text-xs text-red-400">
                            {qaHealthResult.errorDetail}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-xs sm:text-sm font-mono tabular-nums">
                      <div>
                        <span className="text-[#94A3B8] font-sans ml-1.5">
                          زمن الاستجابة:
                        </span>
                        <span className="font-bold text-[#F8FAFC]">
                          {qaHealthResult.latencyMs} ms
                        </span>
                      </div>
                      <div>
                        <span className="text-[#94A3B8] font-sans ml-1.5">
                          كفاءة وسرعة الاتصال:
                        </span>
                        <span className="font-bold text-emerald-400">
                          {qaHealthResult.responsivenessPercent}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Order Simulation Report Panel */}
                {qaSimulationReport && (
                  <div className="p-5 rounded-xl edkawi-surface-muted border border-[#334155] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p
                        className={`text-sm font-bold ${
                          qaSimulationReport.ok
                            ? 'text-emerald-700 text-emerald-400'
                            : 'text-red-400'
                        }`}
                      >
                        {qaSimulationReport.summaryAr}
                      </p>
                      <span className="font-mono text-xs font-bold tabular-nums text-[#94A3B8]">
                        إجمالي الزمن: {qaSimulationReport.totalDurationMs} ms
                      </span>
                    </div>

                    <div className="divide-y divide-slate-200/70 divide-[#334155]">
                      {qaSimulationReport.steps.map((st, idx) => (
                        <div
                          key={`${st.stepNameAr}_${idx}`}
                          className="py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            {st.passed ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                            )}
                            <div>
                              <span className="font-bold text-[#F8FAFC]">
                                {st.stepNameAr}
                              </span>
                              <span className="text-[#94A3B8] mr-2">
                                — {st.detailAr}
                              </span>
                            </div>
                          </div>
                          <span className="font-mono tabular-nums text-[#94A3B8]">
                            {st.durationMs} ms
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ================================================================
           * 10-C. IMMUTABLE AUDIT LOGS (سجل العمليات الإدارية)
           * ============================================================== */}
          {activeSection === 'audit_logs' && (
            <section className="space-y-5">
              <div className="edkawi-soft-card p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#1E293B] text-white flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-[#FF6B00]" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#F8FAFC]">
                      سجل العمليات الحساسة (Audit Logs — الأحدث أولاً)
                    </h2>
                    <p className="text-xs text-[#94A3B8] mt-0.5">
                      توثيق فوري غير قابل للحذف أو التعديل في مجموعة (audit_logs) لكل إجراء إداري حساس.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <select
                    value={auditActionFilter}
                    onChange={(e) =>
                      setAuditActionFilter(
                        e.target.value as AuditActionType | 'all'
                      )
                    }
                    className="px-3.5 py-2 rounded-xl border border-[#334155] text-xs sm:text-sm cursor-pointer"
                  >
                    <option value="all">كل أنواع العمليات</option>
                    <option value="ban_customer">حظر عميل</option>
                    <option value="unban_customer">إلغاء حظر عميل</option>
                    <option value="block_entity">حظر حساب / متجر</option>
                    <option value="update_delivery_fee">
                      تعديل سعر توصيل / منطقة
                    </option>
                    <option value="approve_store">قبول / إضافة متجر</option>
                    <option value="toggle_store_active">تغيير حالة متجر</option>
                    <option value="delete_product">حذف منتج</option>
                    <option value="send_notification">إرسال إشعار</option>
                    <option value="approve_courier">اعتماد مندوب</option>
                    <option value="toggle_maintenance">تحديث وضع الصيانة</option>
                    <option value="purge_test_data">مسح بيانات الاختبار</option>
                  </select>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="search"
                      value={auditSearch}
                      onChange={(e) => setAuditSearch(e.target.value)}
                      placeholder="ابحث في تفاصيل العملية أو المعرف..."
                      className="w-full pr-10 pl-4 py-2 rounded-xl border border-[#334155] text-xs sm:text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="edkawi-soft-card overflow-hidden">
                {filteredAuditLogs.length === 0 ? (
                  <div className="p-10 text-center space-y-2">
                    <RefreshCw className="w-8 h-8 text-[#94A3B8] mx-auto" />
                    <p className="text-sm font-bold text-[#F8FAFC]">
                      لا توجد عمليات مسجلة مطابقة حالياً
                    </p>
                    <p className="text-xs text-[#94A3B8]">
                      بمجرد تنفيذ أي إجراء إداري حساس (مثل حظر عميل، تعديل سعر توصيل، إضافة متجر، حذف منتج، أو إرسال إشعار) سيظهر هنا تلقائياً بالأحدث أولاً.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="border-b border-[#334155] edkawi-surface-muted text-xs font-bold text-[#94A3B8]">
                          <th className="py-3.5 px-5">التوقيت (الأحدث أولاً)</th>
                          <th className="py-3.5 px-4">نوع العملية</th>
                          <th className="py-3.5 px-4">التفاصيل</th>
                          <th className="py-3.5 px-5">معرف الأدمن</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#334155] text-xs sm:text-sm">
                        {filteredAuditLogs.map((logItem) => {
                          const formattedTime = logItem.createdAtIso
                            ? new Date(logItem.createdAtIso).toLocaleString(
                                'ar-EG',
                                {
                                  dateStyle: 'short',
                                  timeStyle: 'medium',
                                }
                              )
                            : 'الآن';
                          return (
                            <tr
                              key={logItem.id}
                              className="hover:bg-[#0F172A]/60"
                            >
                              <td className="py-3.5 px-5 whitespace-nowrap font-mono text-xs tabular-nums text-[#94A3B8]">
                                {formattedTime}
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap font-bold text-[#FF6B00]">
                                {getAuditActionLabelAr(logItem.actionType)}
                              </td>
                              <td className="py-3.5 px-4 text-[#F8FAFC] max-w-xl">
                                {logItem.details}
                              </td>
                              <td className="py-3.5 px-5 whitespace-nowrap">
                                <p className="text-xs font-semibold text-[#F8FAFC]">
                                  {logItem.adminName || 'مدير النظام'}
                                </p>
                                <p
                                  dir="ltr"
                                  className="font-mono text-[11px] text-slate-400 tabular-nums text-right"
                                >
                                  {logItem.adminId.slice(0, 12)}...
                                </p>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ================================================================
           * 11. REAL-TIME SUPPORT & SPLIT-VIEW LIVE CHAT (الدعم الفني)
           * ============================================================== */}
          {activeSection === 'support' && (
            <AdminSupportSplitWorkspace
              tickets={supportTickets}
              currentActorUid={adminUid}
              currentActorName="إدارة إدكاوي"
              actorRole="admin"
              staffMembers={staffMembers}
              onNotify={(msg) => {
                setSuccessBanner(msg);
                onNotify?.(msg);
              }}
            />
          )}

          {/* ================================================================
           * 12. STAFF / TEAM MANAGEMENT (فريق العمل)
           * ============================================================== */}
          {activeSection === 'staff' && (
            <AdminStaffManagementSection
              adminUid={adminUid}
              staffMembers={staffMembers}
              onNotify={(msg) => {
                setSuccessBanner(msg);
                onNotify?.(msg);
              }}
            />
          )}
        </main>
      </div>

      {/* ====================================================================
       * ADD NEW COURIER MODAL (With Interactive Edku Map Location Picker)
       * ================================================================== */}
      {isAddCourierOpen && (
        <div
          className="edkawi-modal-backdrop flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-courier-modal-title"
        >
          <div className="edkawi-surface w-full max-w-lg rounded-2xl border border-[#334155] shadow-2xl overflow-hidden my-8">
            <div className="px-6 py-4 bg-[#1E293B] text-white flex items-center justify-between gap-3">
              <h2 id="add-courier-modal-title" className="text-base font-bold">
                إضافة مندوب توصيل معتمد في إدكو
              </h2>
              <button
                type="button"
                onClick={closeAddCourierModal}
                aria-label="إغلاق"
                className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {createdCourierCred ? (
              <div className="p-6 space-y-5">
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800 flex items-start gap-3">
                  <CheckCircle2
                    className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div className="text-xs space-y-1 text-emerald-200">
                    <p className="font-bold text-sm">
                      تم تفعيل حساب الكابتن «{createdCourierCred.name}» بنجاح!
                    </p>
                    <p>
                      شارك بيانات الدخول التالية مع المندوب ليبدأ استقبال الطلبات مباشرة.
                    </p>
                  </div>
                </div>

                <div
                  dir="ltr"
                  className="p-4 rounded-xl edkawi-surface-muted border border-[#334155] font-mono text-xs space-y-2 text-left"
                >
                  <div>
                    <span className="text-slate-400 block text-[11px]">
                      Email
                    </span>
                    <span className="font-bold text-[#F8FAFC]">
                      {createdCourierCred.loginEmail}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">
                      Password
                    </span>
                    <span className="font-bold text-[#FF6B00]">
                      {createdCourierCred.password}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      void handleCopyText(
                        `بيانات دخول كابتن إدكاوي:\nالبريد: ${createdCourierCred.loginEmail}\nكلمة المرور: ${createdCourierCred.password}`,
                        'modal_courier_cred'
                      )
                    }
                    className="flex-1 py-3 px-4 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-4 h-4" aria-hidden="true" />
                    <span>
                      {copiedKey === 'modal_courier_cred'
                        ? 'تم نسخ البيانات!'
                        : 'نسخ بيانات الدخول'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={closeAddCourierModal}
                    className="py-3 px-5 rounded-xl border border-[#334155] text-xs font-bold text-[#F8FAFC] cursor-pointer"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleCreateCourierSubmit}
                className="p-6 space-y-4 max-h-[82vh] overflow-y-auto"
              >
                {courierFormErrors.submit && (
                  <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800 text-xs font-semibold text-red-200">
                    {courierFormErrors.submit}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold mb-1.5">
                    الاسم الكامل للكابتن
                  </label>
                  <input
                    type="text"
                    required
                    value={courierName}
                    onChange={(e) => setCourierName(e.target.value)}
                    placeholder="مثال: كابتن محمود السيد"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm"
                  />
                  {courierFormErrors.name && (
                    <p className="text-xs text-red-600 mt-1">
                      {courierFormErrors.name}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold mb-1.5">
                      رقم الموبايل المصري
                    </label>
                    <input
                      type="tel"
                      required
                      dir="ltr"
                      value={courierPhone}
                      onChange={(e) => setCourierPhone(e.target.value)}
                      placeholder="01012345678"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm font-mono text-right tabular-nums"
                    />
                    {courierFormErrors.phone && (
                      <p className="text-xs text-red-600 mt-1">
                        {courierFormErrors.phone}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1.5">
                      نوع المركبة
                    </label>
                    <select
                      value={courierVehicle}
                      onChange={(e) =>
                        setCourierVehicle(e.target.value as CourierVehicleType)
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-[#334155] text-sm cursor-pointer"
                    >
                      {COURIER_VEHICLE_TYPES.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <EdkuLocationPickerMap
                    label="نقطة تمركز المندوب على خريطة إدكو"
                    helperText="اضغط على الخريطة أو استخدم GPS لتحديد تمركز المندوب في إدكو"
                    lat={courierLat}
                    lng={courierLng}
                    neighborhood={courierArea}
                    heightClassName="h-[200px]"
                    onWaterValidationChange={setCourierWaterPin}
                    onChange={(picked) => {
                      setCourierLat(picked.lat);
                      setCourierLng(picked.lng);
                      setCourierArea(picked.neighborhood);
                    }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1.5">
                    حي التمركز الرئيسي في إدكو
                  </label>
                  <select
                    value={courierArea}
                    onChange={(e) => {
                      const nextArea = e.target.value;
                      setCourierArea(nextArea);
                      const fallback = resolveEdkuCoordsForNeighborhood(nextArea);
                      setCourierLat(fallback.lat);
                      setCourierLng(fallback.lng);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#334155] text-sm cursor-pointer"
                  >
                    {EDKU_NEIGHBORHOODS.map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold mb-1.5">
                      البريد الإلكتروني للدخول
                    </label>
                    <input
                      type="email"
                      required
                      dir="ltr"
                      value={courierEmail}
                      onChange={(e) => setCourierEmail(e.target.value)}
                      placeholder="captain@example.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm font-mono text-left"
                    />
                    {courierFormErrors.email && (
                      <p className="text-xs text-red-600 mt-1">
                        {courierFormErrors.email}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1.5">
                      كلمة المرور
                    </label>
                    <input
                      type="password"
                      required
                      dir="ltr"
                      value={courierPassword}
                      onChange={(e) => setCourierPassword(e.target.value)}
                      placeholder="٦ أحرف أو أرقام على الأقل"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm text-left"
                    />
                    {courierFormErrors.password && (
                      <p className="text-xs text-red-600 mt-1">
                        {courierFormErrors.password}
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={submittingCourier}
                    className="flex-1 py-3 px-5 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-60 text-white font-bold text-sm cursor-pointer"
                  >
                    {submittingCourier
                      ? 'جارٍ إنشاء الحساب...'
                      : 'إنشاء وتفعيل حساب المندوب'}
                  </button>
                  <button
                    type="button"
                    onClick={closeAddCourierModal}
                    className="py-3 px-4 rounded-xl border border-[#334155] text-xs font-bold text-[#94A3B8] cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* CREATE INVITATION MODAL */}
      {isCreateInviteModalOpen && (
        <div className="edkawi-modal-backdrop flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="edkawi-soft-card max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#334155]">
              <h3 className="text-base font-bold text-[#F8FAFC] flex items-center gap-2">
                <Mail className="w-5 h-5 text-[#FF6B00]" />
                <span>إنشاء دعوة جديدة للمنصة</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateInviteModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-[#F8FAFC] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendInvitationSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1.5 text-[#F8FAFC]">
                  البريد الإلكتروني للشخص المدعو *
                </label>
                <input
                  type="email"
                  required
                  dir="ltr"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm font-mono text-left"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-[#F8FAFC]">
                  نوع الحساب والصلاحية *
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm font-semibold cursor-pointer"
                >
                  <option value="store">متجر / صيدلية (Store Owner)</option>
                  <option value="customer">عميل (Customer)</option>
                  <option value="courier">كابتن توصيل (Courier)</option>
                  <option value="sales_agent">مسؤول مبيعات (Sales Agent)</option>
                </select>
              </div>

              <div className="p-3 rounded-xl bg-orange-950/40 border border-orange-800 text-xs text-[#94A3B8]">
                صلاحية رابط الدعوة: <strong>48 ساعة</strong>. يتم التحقق من عدم تسجيل البريد مسبقاً وتوليد كود UUID مشفر تلقائياً.
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateInviteModalOpen(false)}
                  className="min-h-[44px] px-4 rounded-xl border border-[#334155] text-xs font-bold text-[#94A3B8] cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isCreatingInvite || !inviteEmail.trim()}
                  className="min-h-[44px] px-6 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-50 text-white text-xs sm:text-sm font-bold cursor-pointer"
                >
                  {isCreatingInvite ? 'جارٍ الإنشاء...' : 'إرسال وتوليد الدعوة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADMIN CHANGE LOGIN EMAIL MODAL */}
      {adminChangeEmailTarget && (
        <div className="edkawi-modal-backdrop flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="edkawi-soft-card max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#334155]">
              <h3 className="text-base font-bold text-[#F8FAFC]">
                تحديث البريد الإلكتروني لحساب: {adminChangeEmailTarget.name}
              </h3>
              <button
                type="button"
                onClick={() => setAdminChangeEmailTarget(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-[#F8FAFC] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdminUpdateEmailSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1.5 text-[#F8FAFC]">
                  البريد الإلكتروني الجديد *
                </label>
                <input
                  type="email"
                  required
                  dir="ltr"
                  value={adminNewEmailInput}
                  onChange={(e) => setAdminNewEmailInput(e.target.value)}
                  placeholder="new-email@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] text-sm font-mono text-left"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAdminChangeEmailTarget(null)}
                  className="min-h-[44px] px-4 rounded-xl border border-[#334155] text-xs font-bold text-[#94A3B8] cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={busyKey === 'update_email_btn' || !adminNewEmailInput.trim()}
                  className="min-h-[44px] px-6 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-50 text-white text-xs sm:text-sm font-bold cursor-pointer"
                >
                  {busyKey === 'update_email_btn' ? 'جارٍ التحديث...' : 'تحديث البريد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* WALLET TOPUP RECEIPT LIGHTBOX */}
      {zoomedTopupReceiptUrl && (
        <div
          className="edkawi-modal-backdrop flex items-center justify-center p-4 z-50"
          role="dialog"
          aria-modal="true"
          onClick={() => setZoomedTopupReceiptUrl(null)}
        >
          <div
            className="bg-[#1E293B] border border-[#334155] rounded-2xl p-4 max-w-2xl w-full space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#F8FAFC]">معاينة إيصال التحويل البنكي / فودافون كاش</h3>
              <button
                type="button"
                onClick={() => setZoomedTopupReceiptUrl(null)}
                className="p-1.5 rounded-xl bg-[#0F172A] border border-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={zoomedTopupReceiptUrl}
              alt="إيصال التحويل"
              className="w-full max-h-[75vh] object-contain rounded-xl bg-[#0F172A]"
            />
          </div>
        </div>
      )}

      {/* COURIER KYC / STORE LEGAL DOC LIGHTBOX */}
      {zoomedKycDoc && (
        <div
          className="edkawi-modal-backdrop flex items-center justify-center p-4 z-50"
          role="dialog"
          aria-modal="true"
          onClick={() => setZoomedKycDoc(null)}
        >
          <div
            className="bg-[#1E293B] border border-[#334155] rounded-2xl p-4 max-w-2xl w-full space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-[#F8FAFC] truncate">
                {zoomedKycDoc.title}
              </h3>
              <button
                type="button"
                onClick={() => setZoomedKycDoc(null)}
                aria-label="إغلاق المعاينة"
                className="p-1.5 rounded-xl bg-[#0F172A] border border-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={zoomedKycDoc.url}
              alt={zoomedKycDoc.title}
              className="w-full max-h-[75vh] object-contain rounded-xl bg-[#0F172A]"
            />
          </div>
        </div>
      )}

      {/* ADMIN CONFIRMATION MODALS */}
      <ConfirmActionModal
        isOpen={confirmLogoutOpen}
        title="تسجيل الخروج من لوحة الإدارة"
        description="هل أنت متأكد من رغبتك في تسجيل الخروج من بوابة الإدارة المركزية؟"
        confirmLabel="تسجيل الخروج"
        tone="warning"
        onCancel={() => setConfirmLogoutOpen(false)}
        onConfirm={() => {
          setConfirmLogoutOpen(false);
          onLogout();
        }}
      />

      <ConfirmActionModal
        isOpen={Boolean(confirmCancelOrderId)}
        title="إلغاء الطلب إدارياً"
        description={`سيتم إلغاء الطلب رقم #${confirmCancelOrderId ?? ''} وإشعار العميل والمتجر فوراً.`}
        confirmLabel="تأكيد إلغاء الطلب"
        tone="danger"
        isProcessing={busyKey === `cancel_${confirmCancelOrderId ?? ''}`}
        onCancel={() => setConfirmCancelOrderId(null)}
        onConfirm={async () => {
          const targetId = confirmCancelOrderId;
          setConfirmCancelOrderId(null);
          if (targetId) await handleCancelOrderClick(targetId);
        }}
      />

      <ConfirmActionModal
        isOpen={Boolean(confirmDeleteProductTarget)}
        title="حذف المنتج نهائياً"
        description={`هل تريد حذف المنتج «${confirmDeleteProductTarget?.product.name ?? ''}» من قائمة المتجر وتسجيل العملية في سجل الأمان؟`}
        confirmLabel="حذف المنتج"
        tone="danger"
        isProcessing={busyKey === `del_prod_${confirmDeleteProductTarget?.product.id ?? ''}`}
        onCancel={() => setConfirmDeleteProductTarget(null)}
        onConfirm={async () => {
          const target = confirmDeleteProductTarget;
          setConfirmDeleteProductTarget(null);
          if (target) await handleDeleteProductByAdminClick(target.product, target.storeName);
        }}
      />

      <ConfirmActionModal
        isOpen={Boolean(confirmDeleteAdId)}
        title="حذف البنر الإعلاني"
        description="هل أنت متأكد من حذف هذا البنر الإعلاني من واجهة العملاء؟"
        confirmLabel="حذف البنر"
        tone="danger"
        isProcessing={busyKey === `ad_del_${confirmDeleteAdId ?? ''}`}
        onCancel={() => setConfirmDeleteAdId(null)}
        onConfirm={async () => {
          const adId = confirmDeleteAdId;
          setConfirmDeleteAdId(null);
          if (!adId || !onDeleteAdBanner) return;
          setErrorBanner(null);
          setBusyKey(`ad_del_${adId}`);
          try {
            await onDeleteAdBanner(adId);
          } catch (err) {
            setErrorBanner(formatAppErrorMessage(err, 'تعذر حذف البنر الإعلاني.'));
          } finally {
            setBusyKey(null);
          }
        }}
      />

      <ConfirmActionModal
        isOpen={Boolean(confirmDeleteCampaignId)}
        title="حذف الفعالية الدورية"
        description="هل أنت متأكد من حذف هذه الفعالية من قاعدة البيانات؟"
        confirmLabel="حذف الفعالية"
        tone="danger"
        onCancel={() => setConfirmDeleteCampaignId(null)}
        onConfirm={async () => {
          const campId = confirmDeleteCampaignId;
          setConfirmDeleteCampaignId(null);
          if (campId && onDeleteCampaign) await onDeleteCampaign(campId);
        }}
      />

      <ConfirmActionModal
        isOpen={Boolean(confirmDeleteCouponId)}
        title="حذف كوبون الخصم"
        description="هل أنت متأكد من حذف كوبون الخصم نهائياً من النظام؟"
        confirmLabel="حذف الكوبون"
        tone="danger"
        onCancel={() => setConfirmDeleteCouponId(null)}
        onConfirm={async () => {
          const couponId = confirmDeleteCouponId;
          setConfirmDeleteCouponId(null);
          if (couponId && onDeleteCoupon) await onDeleteCoupon(couponId);
        }}
      />

      <ConfirmActionModal
        isOpen={Boolean(confirmPurgeType)}
        title="تنظيف البيانات التجريبية"
        description="سيتم فحص قاعدة البيانات وحذف أي سجلات اختبار أو بيانات تجريبية قديمة فقط."
        confirmLabel="تأكيد التنظيف"
        tone="warning"
        isProcessing={busyKey === 'purge_demo' || qaRunningAction === 'purge'}
        onCancel={() => setConfirmPurgeType(null)}
        onConfirm={async () => {
          const mode = confirmPurgeType;
          setConfirmPurgeType(null);
          if (mode === 'demo') await handlePurgeDemoClick();
          else if (mode === 'qa') await handleRunPurgeTestData();
        }}
      />

      <ConfirmActionModal
        isOpen={Boolean(confirmBanTarget)}
        title={confirmBanTarget?.currentlyBanned ? 'إلغاء حظر حساب العميل' : 'تأكيد حظر حساب العميل'}
        description={
          confirmBanTarget?.currentlyBanned
            ? `سيتم رفع الحظر عن حساب العميل «${confirmBanTarget.customer.name}» وإعادة تفعيل استقبال الطلبات.`
            : `سيتم تطبيق الحظر على العميل «${confirmBanTarget?.customer.name ?? ''}» بالسبب: ${confirmBanTarget?.reason ?? ''}`
        }
        confirmLabel={confirmBanTarget?.currentlyBanned ? 'تأكيد فك الحظر' : 'تنفيذ الحظر الآن'}
        tone={confirmBanTarget?.currentlyBanned ? 'primary' : 'danger'}
        isProcessing={busyKey === `ban_cust_${confirmBanTarget?.customer.uid ?? ''}`}
        onCancel={() => setConfirmBanTarget(null)}
        onConfirm={async () => {
          const target = confirmBanTarget;
          setConfirmBanTarget(null);
          if (target) await handleCustomerBanExecute(target);
        }}
      />
    </div>
  );
}
