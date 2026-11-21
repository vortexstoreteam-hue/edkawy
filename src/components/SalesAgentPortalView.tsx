import React, { useEffect, useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  ArrowUpLeft,
  Check,
  Copy,
  Eye,
  LayoutDashboard,
  Loader2,
  LogOut,
  Mail,
  Plus,
  RefreshCw,
  Scale,
  Search,
  Send,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  buildInvitationRegistrationUrl,
  buildSalesAgentReferralUrl,
  createInvitationInFirestore,
  deleteCurrentAccountCompletely,
  deleteInvitationInFirestore,
  listenToAgentCommissions,
  listenToAgentInvitations,
  listenToAgentPayoutRequests,
  listenToAgentReferrals,
  listenToSalesAgentProfile,
  requestAgentPayoutInFirestore,
  resendInvitationEmailInFirestore,
  settleMaturedAgentCommissionsInFirestore,
} from '../services/edkawiFirebaseService';
import {
  CommissionRecord,
  InvitationRecord,
  InvitationUserType,
  LegalSectionKey,
  PayoutMethod,
  PayoutRequestRecord,
  ReferralAccountRecord,
  SalesAgentRecord,
} from '../types/edkawi';
import { formatAppErrorMessage } from '../utils/orderLogic';
import { AdkawyLogo } from './AdkawyLogo';
import { ConfirmActionModal } from './ConfirmActionModal';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler
);

interface SalesAgentPortalViewProps {
  agentUid: string;
  agentEmail: string;
  agentName?: string;
  agentDisplayName?: string;
  onOpenLegalModal?: (section?: LegalSectionKey) => void;
  onSignOut?: () => void;
  onLogout?: () => Promise<void> | void;
  onNotify?: (message: string) => void;
}

type AgentTab = 'overview' | 'invitations' | 'referrals' | 'wallet';

function getInvitationTypeLabelAr(type: InvitationUserType): string {
  switch (type) {
    case 'store':
      return 'متجر / مطعم / صيدلية';
    case 'customer':
      return 'عميل';
    case 'courier':
      return 'مندوب توصيل';
    case 'sales_agent':
      return 'مسؤول مبيعات';
  }
}

function getEffectiveInvitationStatus(inv: InvitationRecord): {
  key: 'pending' | 'accepted' | 'expired';
  labelAr: string;
  colorClass: string;
} {
  if (inv.status === 'accepted') {
    return {
      key: 'accepted',
      labelAr: 'تم التسجيل',
      colorClass: 'text-emerald-400',
    };
  }
  if (inv.status === 'expired' || Date.now() > inv.expiresAtMs) {
    return {
      key: 'expired',
      labelAr: 'منتهية الصلاحية',
      colorClass: 'text-rose-400',
    };
  }
  return {
    key: 'pending',
    labelAr: 'قيد الانتظار',
    colorClass: 'text-amber-400',
  };
}

export const SalesAgentPortalView: React.FC<SalesAgentPortalViewProps> = ({
  agentUid,
  agentEmail,
  agentName,
  agentDisplayName,
  onOpenLegalModal,
  onSignOut,
  onLogout,
  onNotify,
}) => {
  const effectiveName = agentName || agentDisplayName || 'مسؤول مبيعات إدكاوي';
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [confirmDeleteInvite, setConfirmDeleteInvite] =
    useState<InvitationRecord | null>(null);
  const handleLogout = () => {
    if (onLogout) {
      void onLogout();
    } else if (onSignOut) {
      onSignOut();
    }
  };
  const [activeTab, setActiveTab] = useState<AgentTab>('overview');
  const [agentProfile, setAgentProfile] = useState<SalesAgentRecord | null>(
    null
  );
  const [invitations, setInvitations] = useState<InvitationRecord[]>([]);
  const [referrals, setReferrals] = useState<ReferralAccountRecord[]>([]);
  const [commissions, setCommissions] = useState<CommissionRecord[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequestRecord[]>(
    []
  );
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [bannerMsg, setBannerMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Copy states
  const [copiedRefCode, setCopiedRefCode] = useState(false);
  const [copiedRefLink, setCopiedRefLink] = useState(false);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  // Create Invitation Modal
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteUserType, setInviteUserType] = useState<
    'store' | 'customer' | 'courier'
  >('store');
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);
  const [createdInviteSentSmtp, setCreatedInviteSentSmtp] = useState(false);

  // Invitations filter
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteTypeFilter, setInviteTypeFilter] = useState<
    'all' | 'store' | 'customer' | 'courier'
  >('all');
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);

  // Referrals filter & Details modal
  const [referralSearch, setReferralSearch] = useState('');
  const [referralTypeFilter, setReferralTypeFilter] = useState<
    'all' | 'store' | 'customer' | 'courier'
  >('all');
  const [selectedReferral, setSelectedReferral] =
    useState<ReferralAccountRecord | null>(null);

  // Wallet & Payout Modal
  const [settlingEscrow, setSettlingEscrow] = useState(false);
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('100');
  const [payoutMethod, setPayoutMethod] =
    useState<PayoutMethod>('vodafone_cash');
  const [payoutAccountDetails, setPayoutAccountDetails] = useState('');
  const [submittingPayout, setSubmittingPayout] = useState(false);

  // Delete Account Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    setLoadingProfile(true);
    const unsubProfile = listenToSalesAgentProfile(agentUid, (rec) => {
      setAgentProfile(rec);
      setLoadingProfile(false);
    });
    const unsubInvites = listenToAgentInvitations(agentUid, setInvitations);
    const unsubReferrals = listenToAgentReferrals(agentUid, setReferrals);
    const unsubCommissions = listenToAgentCommissions(agentUid, setCommissions);
    const unsubPayouts = listenToAgentPayoutRequests(
      agentUid,
      setPayoutRequests
    );

    void settleMaturedAgentCommissionsInFirestore(agentUid).catch(() => {});

    return () => {
      unsubProfile();
      unsubInvites();
      unsubReferrals();
      unsubCommissions();
      unsubPayouts();
    };
  }, [agentUid]);

  const resolvedName =
    agentProfile?.name?.trim() || effectiveName;
  const resolvedEmail = agentProfile?.email?.trim() || agentEmail.trim();
  const referralCode = agentProfile?.referralCode || '';
  const referralUrl = referralCode
    ? buildSalesAgentReferralUrl(referralCode)
    : '';

  const totalSalesVolumeEgp = useMemo(() => {
    const fromReferrals = referrals.reduce(
      (sum, r) => sum + (Number(r.totalSalesVolumeEgp) || 0),
      0
    );
    const fromCommissions = commissions.reduce(
      (sum, c) => sum + (Number(c.orderTotalEgp) || 0),
      0
    );
    return Math.max(fromReferrals, fromCommissions);
  }, [referrals, commissions]);

  const totalEarnedCommissionsEgp = useMemo(() => {
    const fromCommissions = commissions.reduce(
      (sum, c) => sum + (Number(c.amountEgp) || 0),
      0
    );
    return Math.max(
      Number(agentProfile?.totalEarnings || 0),
      Math.round(fromCommissions * 100) / 100
    );
  }, [agentProfile?.totalEarnings, commissions]);

  const monthlyChartData = useMemo(() => {
    const bucket = new Map<
      string,
      { label: string; salesEgp: number; commissionsEgp: number }
    >();
    const sorted = [...commissions].sort((a, b) =>
      (a.createdAtIso || '').localeCompare(b.createdAtIso || '')
    );
    for (const item of sorted) {
      const monthKey = (item.createdAtIso || '').slice(0, 7);
      if (!monthKey) continue;
      const existing = bucket.get(monthKey) ?? {
        label: monthKey,
        salesEgp: 0,
        commissionsEgp: 0,
      };
      existing.salesEgp += Number(item.orderTotalEgp) || 0;
      existing.commissionsEgp += Number(item.amountEgp) || 0;
      bucket.set(monthKey, existing);
    }
    const entries = Array.from(bucket.values()).slice(-8);
    return {
      hasData: entries.length > 0,
      data: {
        labels: entries.map((e) => e.label),
        datasets: [
          {
            label: 'إجمالي مبيعات الحسابات (ج.م)',
            data: entries.map((e) => Math.round(e.salesEgp)),
            borderColor: '#38BDF8',
            backgroundColor: 'rgba(56, 189, 248, 0.14)',
            tension: 0.32,
            fill: true,
          },
          {
            label: 'عمولاتك المحققة (ج.م)',
            data: entries.map((e) => Math.round(e.commissionsEgp * 100) / 100),
            borderColor: '#FF6B00',
            backgroundColor: 'rgba(255, 107, 0, 0.16)',
            tension: 0.32,
            fill: true,
          },
        ],
      },
    };
  }, [commissions]);

  const filteredInvitations = useMemo(() => {
    const q = inviteSearch.trim().toLowerCase();
    return invitations.filter((inv) => {
      if (inviteTypeFilter !== 'all' && inv.userType !== inviteTypeFilter) {
        return false;
      }
      if (q && !inv.email.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [invitations, inviteSearch, inviteTypeFilter]);

  const filteredReferrals = useMemo(() => {
    const q = referralSearch.trim().toLowerCase();
    return referrals.filter((ref) => {
      if (
        referralTypeFilter !== 'all' &&
        ref.accountType !== referralTypeFilter
      ) {
        return false;
      }
      if (q && !ref.accountName.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [referrals, referralSearch, referralTypeFilter]);

  const selectedReferralCommissions = useMemo(() => {
    if (!selectedReferral) return [];
    return commissions.filter(
      (c) =>
        c.referredEntityId === selectedReferral.referredStoreId ||
        c.referredEntityId === selectedReferral.referredUid
    );
  }, [commissions, selectedReferral]);

  const handleCopyText = async (
    text: string,
    onDone: () => void
  ): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      onDone();
    } catch {
      onDone();
    }
  };

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setBannerMsg(null);
    setCreatedInviteUrl(null);
    const cleanEmail = inviteEmail.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setBannerMsg({
        type: 'error',
        text: 'يرجى إدخال بريد إلكتروني صحيح لإرسال الدعوة.',
      });
      return;
    }

    setCreatingInvite(true);
    try {
      const { invitation, emailDelivery } = await createInvitationInFirestore(
        {
          email: cleanEmail,
          userType: inviteUserType,
        },
        {
          uid: agentUid,
          name: resolvedName,
          role: 'sales_agent',
          referralCode: referralCode || undefined,
        }
      );
      const link =
        emailDelivery.inviteUrl ||
        buildInvitationRegistrationUrl(
          invitation.token,
          invitation.userType,
          invitation.referralCode
        );
      setCreatedInviteUrl(link);
      setCreatedInviteSentSmtp(Boolean(emailDelivery.sentViaSmtp));
      setInviteEmail('');
      setBannerMsg({
        type: 'success',
        text: emailDelivery.sentViaSmtp
          ? `تم إنشاء الدعوة وإرسالها عبر البريد الإلكتروني إلى ${cleanEmail} بنجاح.`
          : `تم إنشاء الدعوة لـ ${cleanEmail} بنجاح — انسخ الرابط المباشر لمشاركته فوراً.`,
      });
    } catch (err) {
      setBannerMsg({
        type: 'error',
        text: formatAppErrorMessage(err, 'تعذر إنشاء الدعوة حالياً.'),
      });
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleResendInvitation = async (inv: InvitationRecord) => {
    setBannerMsg(null);
    setBusyInviteId(inv.id);
    try {
      const res = await resendInvitationEmailInFirestore(inv, false);
      setBannerMsg({
        type: 'success',
        text: res.sentViaSmtp
          ? `تمت إعادة إرسال بريد الدعوة وتمديد الصلاحية ٤٨ ساعة لـ ${inv.email}.`
          : `تم تجديد صلاحية رابط الدعوة ٤٨ ساعة لـ ${inv.email} — يمكنك نسخ الرابط ومشاركته.`,
      });
    } catch (err) {
      setBannerMsg({
        type: 'error',
        text: formatAppErrorMessage(err, 'تعذر إعادة إرسال الدعوة.'),
      });
    } finally {
      setBusyInviteId(null);
    }
  };

  const handleDeleteInvitation = async (inv: InvitationRecord) => {
    setBannerMsg(null);
    setBusyInviteId(inv.id);
    try {
      await deleteInvitationInFirestore(inv, false);
      setBannerMsg({
        type: 'success',
        text: `تم حذف الدعوة المرسلة إلى ${inv.email}.`,
      });
    } catch (err) {
      setBannerMsg({
        type: 'error',
        text: formatAppErrorMessage(err, 'تعذر حذف الدعوة.'),
      });
    } finally {
      setBusyInviteId(null);
    }
  };

  const handleSettleEscrow = async () => {
    setBannerMsg(null);
    setSettlingEscrow(true);
    try {
      const count = await settleMaturedAgentCommissionsInFirestore(agentUid);
      setBannerMsg({
        type: 'success',
        text:
          count > 0
            ? `تمت تسوية ${count} عمولة مستحقة وتحويلها إلى رصيدك المتاح للسحب.`
            : 'جميع العمولات التي تجاوزت ٢٤ ساعة مسوّاة بالفعل في رصيدك المتاح.',
      });
    } catch (err) {
      setBannerMsg({
        type: 'error',
        text: formatAppErrorMessage(err, 'تعذر تحديث حالة التسوية حالياً.'),
      });
    } finally {
      setSettlingEscrow(false);
    }
  };

  const handleSubmitPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setBannerMsg(null);
    const numericAmount = Number(payoutAmount);
    if (!Number.isFinite(numericAmount) || numericAmount < 100) {
      setBannerMsg({
        type: 'error',
        text: 'الحد الأدنى لطلب سحب الأرباح هو ١٠٠ جنيه مصري.',
      });
      return;
    }
    if (numericAmount > Number(agentProfile?.availableBalance ?? 0)) {
      setBannerMsg({
        type: 'error',
        text: 'المبلغ المطلوب يتجاوز الرصيد المتاح للسحب حالياً.',
      });
      return;
    }
    if (payoutAccountDetails.trim().length < 6) {
      setBannerMsg({
        type: 'error',
        text:
          payoutMethod === 'vodafone_cash'
            ? 'يرجى إدخال رقم محفظة فودافون كاش المكون من ١١ رقماً.'
            : 'يرجى إدخال عنوان الدفع في إنستاباي (IPA) أو رقم الحساب.',
      });
      return;
    }

    setSubmittingPayout(true);
    try {
      await requestAgentPayoutInFirestore(
        {
          uid: agentUid,
          name: resolvedName,
          email: resolvedEmail,
        },
        {
          amount: numericAmount,
          method: payoutMethod,
          accountDetails: payoutAccountDetails.trim(),
        }
      );
      setIsPayoutModalOpen(false);
      setPayoutAccountDetails('');
      setPayoutAmount('100');
      setBannerMsg({
        type: 'success',
        text: 'تم تسجيل طلب سحب الأرباح وخصمه من الرصيد المتاح لحين مراجعة الإدارة والتحويل.',
      });
    } catch (err) {
      setBannerMsg({
        type: 'error',
        text: formatAppErrorMessage(err, 'تعذر إرسال طلب سحب الأرباح.'),
      });
    } finally {
      setSubmittingPayout(false);
    }
  };

  const handleDeleteOwnAccount = async () => {
    setDeletingAccount(true);
    setBannerMsg(null);
    try {
      await deleteCurrentAccountCompletely();
      setIsDeleteModalOpen(false);
      handleLogout();
    } catch (err) {
      setBannerMsg({
        type: 'error',
        text: formatAppErrorMessage(
          err,
          'تعذر حذف الحساب حالياً. يرجى إعادة تسجيل الدخول والمحاولة مرة أخرى.'
        ),
      });
      setDeletingAccount(false);
    }
  };

  const availableBalance =
    Math.round(Number(agentProfile?.availableBalance ?? 0) * 100) / 100;
  const pendingBalance =
    Math.round(Number(agentProfile?.pendingBalance ?? 0) * 100) / 100;
  const commissionRate = Number(agentProfile?.commissionRatePercent ?? 5);

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#0F172A] text-[#F8FAFC] flex flex-col lg:flex-row"
    >
      {/* Right Sidebar Navigation (RTL) */}
      <aside className="w-full lg:w-72 shrink-0 bg-[#1E293B] text-[#F8FAFC] border-b lg:border-b-0 lg:border-l border-[#334155] flex flex-col justify-between p-5 lg:min-h-screen">
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <AdkawyLogo variant="navbar" />
          </div>

          <div className="rounded-2xl bg-[#0F172A]/80 border border-[#334155] p-4 space-y-1.5">
            <p className="text-xs text-[#94A3B8]">بوابة مسؤولي المبيعات</p>
            <p className="text-base font-bold text-[#F8FAFC] truncate">
              {resolvedName}
            </p>
            <p
              dir="ltr"
              className="text-xs font-mono text-[#94A3B8] truncate text-right"
            >
              {resolvedEmail}
            </p>
            {referralCode && (
              <p className="text-xs text-[#FF6B00] font-mono font-bold pt-1 tabular-nums">
                كود الإحالة: {referralCode} · العمولة {commissionRate}%
              </p>
            )}
          </div>

          <nav
            aria-label="أقسام بوابة المبيعات"
            className="flex lg:flex-col gap-1.5 overflow-x-auto pb-1 lg:pb-0"
          >
            {(
              [
                {
                  id: 'overview',
                  label: 'نظرة عامة والنمو',
                  icon: LayoutDashboard,
                },
                {
                  id: 'invitations',
                  label: 'إدارة الدعوات',
                  icon: Send,
                },
                {
                  id: 'referrals',
                  label: 'الحسابات المستقطبة',
                  icon: Users,
                },
                {
                  id: 'wallet',
                  label: 'محفظتي وسحب الأرباح',
                  icon: Wallet,
                },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`min-h-[44px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#FF6B00] text-white'
                      : 'text-[#94A3B8] hover:bg-white/10 hover:text-[#F8FAFC]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="hidden lg:flex flex-col gap-2 pt-6 border-t border-[#334155]">
          {onOpenLegalModal && (
            <button
              type="button"
              onClick={() => onOpenLegalModal('privacy')}
              className="min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-semibold text-[#94A3B8] hover:bg-white/10 hover:text-[#F8FAFC] inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Scale className="w-4 h-4 text-[#FF6B00]" />
              <span>الشروط والخصوصية</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirmLogoutOpen(true)}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 text-xs font-bold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* Top Bar */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#334155]">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#F8FAFC]">
              {activeTab === 'overview'
                ? 'لوحة أداء المبيعات والعمولات'
                : activeTab === 'invitations'
                ? 'إرسال ومتابعة الدعوات'
                : activeTab === 'referrals'
                ? 'الحسابات المسجلة عن طريقك'
                : 'المحفظة المالية وطلبات السحب'}
            </h1>
            <p className="text-xs sm:text-sm text-[#94A3B8] mt-1">
              بيانات حية متصلة مباشرة بقاعدة بيانات إدكاوي في مدينة إدكو
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setCreatedInviteUrl(null);
                setIsInviteModalOpen(true);
              }}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>إنشاء دعوة جديدة</span>
            </button>

            <button
              type="button"
              onClick={() => setConfirmLogoutOpen(true)}
              className="lg:hidden min-h-[44px] px-3.5 py-2 rounded-xl border border-[#334155] bg-[#1E293B] text-[#F8FAFC] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span>خروج</span>
            </button>
          </div>
        </header>

        {agentProfile && agentProfile.isActive === false && (
          <div
            role="alert"
            className="p-4 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-sm font-semibold text-rose-200"
          >
            تم إيقاف حساب مسؤول المبيعات مؤقتاً من قِبل الإدارة. يمكنك مراجعة أرصدتك السابقة أو التواصل مع إدارة إدكاوي.
          </div>
        )}

        {bannerMsg && (
          <div
            role="status"
            className={`p-4 rounded-2xl border text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 ${
              bannerMsg.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-100'
                : 'bg-rose-950/60 border-rose-800/80 text-rose-100'
            }`}
          >
            <span>{bannerMsg.text}</span>
            <button
              type="button"
              onClick={() => setBannerMsg(null)}
              className="p-1 rounded-lg hover:bg-white/10 cursor-pointer shrink-0"
              aria-label="إغلاق الرسالة"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {loadingProfile ? (
          <div className="rounded-2xl bg-[#1E293B] border border-[#334155] p-12 flex items-center justify-center gap-3 text-sm font-semibold text-[#94A3B8]">
            <Loader2 className="w-5 h-5 animate-spin text-[#FF6B00]" />
            <span>جارٍ تحميل بيانات بوابة المبيعات من Firestore...</span>
          </div>
        ) : activeTab === 'overview' ? (
          <div className="space-y-6">
            {/* Referral Link & Code Strip */}
            <section className="rounded-2xl bg-[#1E293B] text-[#F8FAFC] p-6 border border-[#334155] flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-[#FF6B00]">
                  كود ورابط الإحالة الخاص بك لاستقطاب المتاجر والعملاء
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    dir="ltr"
                    className="font-mono text-2xl font-bold tracking-wider tabular-nums text-[#F8FAFC]"
                  >
                    {referralCode || 'AGENT----'}
                  </span>
                  <span className="text-xs text-[#94A3B8]">
                    · عمولة {commissionRate}% على كل طلب مكتمل للحسابات المسجلة عبرك
                  </span>
                </div>
                {referralUrl && (
                  <p
                    dir="ltr"
                    className="text-xs font-mono text-[#94A3B8] truncate max-w-xl text-right"
                  >
                    {referralUrl}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  disabled={!referralCode}
                  onClick={() =>
                    handleCopyText(referralCode, () => {
                      setCopiedRefCode(true);
                      window.setTimeout(() => setCopiedRefCode(false), 2000);
                    })
                  }
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-[#0F172A] border border-[#334155] hover:border-[#FF6B00] text-[#F8FAFC] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {copiedRefCode ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  <span>{copiedRefCode ? 'تم نسخ الكود' : 'نسخ الكود'}</span>
                </button>

                <button
                  type="button"
                  disabled={!referralUrl}
                  onClick={() =>
                    handleCopyText(referralUrl, () => {
                      setCopiedRefLink(true);
                      window.setTimeout(() => setCopiedRefLink(false), 2000);
                    })
                  }
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {copiedRefLink ? (
                    <Check className="w-4 h-4 text-white" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  <span>
                    {copiedRefLink ? 'تم نسخ رابط الإحالة' : 'نسخ رابط الإحالة'}
                  </span>
                </button>
              </div>
            </section>

            {/* 4 KPI Cards */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl bg-[#1E293B] border border-[#334155] p-5 space-y-1.5">
                <p className="text-xs font-semibold text-[#94A3B8]">
                  إجمالي الدعوات المرسلة
                </p>
                <p className="text-3xl font-bold font-mono tabular-nums text-[#F8FAFC]">
                  {invitations.length}
                </p>
                <p className="text-xs text-[#94A3B8]">
                  منها{' '}
                  {invitations.filter((i) => i.status === 'accepted').length}{' '}
                  دعوة مسجلة
                </p>
              </div>

              <div className="rounded-2xl bg-[#1E293B] border border-[#334155] p-5 space-y-1.5">
                <p className="text-xs font-semibold text-[#94A3B8]">
                  الحسابات المسجلة بنجاح
                </p>
                <p className="text-3xl font-bold font-mono tabular-nums text-[#F8FAFC]">
                  {referrals.length}
                </p>
                <p className="text-xs text-[#94A3B8]">
                  {referrals.filter((r) => r.accountType === 'store').length}{' '}
                  متجر ·{' '}
                  {referrals.filter((r) => r.accountType === 'customer').length}{' '}
                  عميل ·{' '}
                  {referrals.filter((r) => r.accountType === 'courier').length}{' '}
                  مندوب
                </p>
              </div>

              <div className="rounded-2xl bg-[#1E293B] border border-[#334155] p-5 space-y-1.5">
                <p className="text-xs font-semibold text-[#94A3B8]">
                  مبيعات الحسابات المستقطبة
                </p>
                <p className="text-3xl font-bold font-mono tabular-nums text-[#F8FAFC]">
                  {Math.round(totalSalesVolumeEgp)}{' '}
                  <span className="text-sm font-semibold">ج.م</span>
                </p>
                <p className="text-xs text-[#94A3B8]">
                  إجمالي الطلبات المسلّمة بنجاح
                </p>
              </div>

              <div className="rounded-2xl bg-[#1E293B] border border-[#334155] p-5 space-y-1.5">
                <p className="text-xs font-semibold text-[#94A3B8]">
                  إجمالي العمولات المحققة
                </p>
                <p className="text-3xl font-bold font-mono tabular-nums text-[#FF6B00]">
                  {totalEarnedCommissionsEgp.toFixed(2)}{' '}
                  <span className="text-sm font-semibold">ج.م</span>
                </p>
                <p className="text-xs text-[#94A3B8] tabular-nums">
                  متاح: {availableBalance.toFixed(2)} ج.م · معلق:{' '}
                  {pendingBalance.toFixed(2)} ج.م
                </p>
              </div>
            </section>

            {/* Monthly Growth Chart */}
            <section className="rounded-2xl bg-[#1E293B] border border-[#334155] p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-[#F8FAFC] flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-[#FF6B00]" />
                    <span>مؤشر نمو المبيعات والعمولات الشهري</span>
                  </h2>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    تطور مبيعات المتاجر والعملاء المسجلين عن طريقك شهراً بشهر
                  </p>
                </div>
              </div>

              {monthlyChartData.hasData ? (
                <div className="h-72 w-full">
                  <Line
                    data={monthlyChartData.data}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'top',
                          labels: {
                            color: '#E2E8F0',
                            font: { family: 'Cairo, sans-serif', size: 12 },
                          },
                        },
                      },
                      scales: {
                        x: {
                          ticks: { color: '#94A3B8' },
                          grid: { display: false },
                        },
                        y: {
                          beginAtZero: true,
                          ticks: { color: '#94A3B8' },
                          grid: {
                            color: 'rgba(148, 163, 184, 0.12)',
                          },
                        },
                      },
                    }}
                  />
                </div>
              ) : (
                <div className="rounded-2xl bg-[#0F172A]/80 border border-[#334155] p-8 text-center space-y-2">
                  <p className="text-sm font-bold text-[#F8FAFC]">
                    لا توجد عمولات مسجلة بعد لعرض المنحنى الشهري
                  </p>
                  <p className="text-xs text-[#94A3B8] max-w-md mx-auto leading-relaxed">
                    أرسل دعوات للمتاجر والعملاء أو شارك رابط الإحالة الخاص بك؛ وبمجرد اكتمال توصيل أول طلب ستظهر إحصائيات النمو الشهري تلقائياً هنا.
                  </p>
                </div>
              )}
            </section>
          </div>
        ) : activeTab === 'invitations' ? (
          <section className="rounded-2xl bg-[#1E293B] border border-[#334155] p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-[#94A3B8] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={inviteSearch}
                  onChange={(e) => setInviteSearch(e.target.value)}
                  placeholder="ابحث بالبريد الإلكتروني المدعو..."
                  className="w-full min-h-[44px] pr-10 pl-3.5 py-2 rounded-xl border border-[#334155] bg-[#0F172A] text-sm text-[#F8FAFC] placeholder:text-[#94A3B8]"
                />
              </div>

              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0F172A] border border-[#334155] overflow-x-auto">
                {(
                  [
                    { id: 'all', label: 'الكل' },
                    { id: 'store', label: 'متاجر' },
                    { id: 'customer', label: 'عملاء' },
                    { id: 'courier', label: 'مندوبين' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setInviteTypeFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                      inviteTypeFilter === tab.id
                        ? 'bg-[#FF6B00] text-white'
                        : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredInvitations.length === 0 ? (
              <div className="rounded-2xl bg-[#0F172A]/80 border border-[#334155] p-10 text-center space-y-2">
                <p className="text-sm font-bold text-[#F8FAFC]">
                  لا توجد دعوات مطابقة حالياً
                </p>
                <p className="text-xs text-[#94A3B8]">
                  اضغط على «إنشاء دعوة جديدة» بالأعلى لإرسال دعوة بريدية مع رابط تسجيل مخصص مربوط بكود إحالتك.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[#334155] text-[#94A3B8]">
                      <th className="py-3 px-3 font-semibold">البريد الإلكتروني</th>
                      <th className="py-3 px-3 font-semibold">نوع الحساب</th>
                      <th className="py-3 px-3 font-semibold">الحالة</th>
                      <th className="py-3 px-3 font-semibold">تاريخ الانتهاء</th>
                      <th className="py-3 px-3 font-semibold">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#334155]/70">
                    {filteredInvitations.map((inv) => {
                      const st = getEffectiveInvitationStatus(inv);
                      const url = buildInvitationRegistrationUrl(
                        inv.token,
                        inv.userType,
                        inv.referralCode
                      );
                      return (
                        <tr key={inv.id}>
                          <td
                            dir="ltr"
                            className="py-3.5 px-3 font-mono text-right font-semibold text-[#F8FAFC]"
                          >
                            {inv.email}
                          </td>
                          <td className="py-3.5 px-3 text-[#94A3B8]">
                            {getInvitationTypeLabelAr(inv.userType)}
                          </td>
                          <td className={`py-3.5 px-3 font-bold ${st.colorClass}`}>
                            {st.labelAr}
                          </td>
                          <td className="py-3.5 px-3 font-mono tabular-nums text-xs text-[#94A3B8]">
                            {new Date(inv.expiresAtIso).toLocaleString('ar-EG', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopyText(url, () => {
                                    setCopiedInviteId(inv.id);
                                    window.setTimeout(
                                      () => setCopiedInviteId(null),
                                      2000
                                    );
                                  })
                                }
                                className="min-h-[36px] px-2.5 py-1 rounded-lg border border-[#334155] bg-[#0F172A] text-[#F8FAFC] text-xs font-bold inline-flex items-center gap-1 hover:border-[#FF6B00] cursor-pointer whitespace-nowrap shrink-0"
                              >
                                {copiedInviteId === inv.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                                <span>
                                  {copiedInviteId === inv.id
                                    ? 'تم النسخ'
                                    : 'نسخ الرابط'}
                                </span>
                              </button>

                              {st.key !== 'accepted' && (
                                <button
                                  type="button"
                                  disabled={busyInviteId === inv.id}
                                  onClick={() => handleResendInvitation(inv)}
                                  className="min-h-[36px] px-2.5 py-1 rounded-lg border border-[#334155] bg-[#0F172A] text-[#F8FAFC] text-xs font-bold inline-flex items-center gap-1 hover:border-[#FF6B00] cursor-pointer whitespace-nowrap shrink-0"
                                >
                                  <RefreshCw className="w-3.5 h-3.5 text-[#FF6B00]" />
                                  <span>إعادة إرسال</span>
                                </button>
                              )}

                              <button
                                type="button"
                                disabled={busyInviteId === inv.id}
                                onClick={() => setConfirmDeleteInvite(inv)}
                                aria-label="حذف الدعوة"
                                className="min-h-[36px] min-w-[36px] rounded-lg border border-rose-800/70 bg-rose-950/40 text-rose-400 hover:bg-rose-950/70 flex items-center justify-center cursor-pointer shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : activeTab === 'referrals' ? (
          <section className="rounded-2xl bg-[#1E293B] border border-[#334155] p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-[#94A3B8] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={referralSearch}
                  onChange={(e) => setReferralSearch(e.target.value)}
                  placeholder="ابحث باسم المتجر أو الحساب..."
                  className="w-full min-h-[44px] pr-10 pl-3.5 py-2 rounded-xl border border-[#334155] bg-[#0F172A] text-sm text-[#F8FAFC] placeholder:text-[#94A3B8]"
                />
              </div>

              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0F172A] border border-[#334155] overflow-x-auto">
                {(
                  [
                    { id: 'all', label: 'الكل' },
                    { id: 'store', label: 'متاجر' },
                    { id: 'customer', label: 'عملاء' },
                    { id: 'courier', label: 'مندوبين' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setReferralTypeFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                      referralTypeFilter === tab.id
                        ? 'bg-[#FF6B00] text-white'
                        : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredReferrals.length === 0 ? (
              <div className="rounded-2xl bg-[#0F172A]/80 border border-[#334155] p-10 text-center space-y-2">
                <p className="text-sm font-bold text-[#F8FAFC]">
                  لم تُسجّل حسابات تحت كود إحالتك بعد
                </p>
                <p className="text-xs text-[#94A3B8]">
                  عندما يُتم متجر أو عميل أو مندوب تسجيله من رابط دعوتك أو كود الإحالة سيظهر أداؤه ومبيعاته هنا فوراً.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[#334155] text-[#94A3B8]">
                      <th className="py-3 px-3 font-semibold">اسم الحساب</th>
                      <th className="py-3 px-3 font-semibold">النوع · الحالة</th>
                      <th className="py-3 px-3 font-semibold">تاريخ الانضمام</th>
                      <th className="py-3 px-3 font-semibold">الطلبات المكتملة</th>
                      <th className="py-3 px-3 font-semibold">حجم المبيعات</th>
                      <th className="py-3 px-3 font-semibold">عمولاتك</th>
                      <th className="py-3 px-3 font-semibold">التفاصيل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#334155]/70">
                    {filteredReferrals.map((ref) => (
                      <tr key={ref.id}>
                        <td className="py-3.5 px-3 font-bold text-[#F8FAFC]">
                          {ref.accountName}
                        </td>
                        <td className="py-3.5 px-3 text-[#94A3B8]">
                          {ref.accountType === 'store'
                            ? 'متجر'
                            : ref.accountType === 'courier'
                            ? 'مندوب'
                            : 'عميل'}{' '}
                          ·{' '}
                          <span
                            className={
                              ref.status === 'active'
                                ? 'text-emerald-400 font-semibold'
                                : 'text-[#94A3B8]'
                            }
                          >
                            {ref.status === 'active' ? 'نشط' : 'غير نشط'}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-mono tabular-nums text-xs text-[#94A3B8]">
                          {new Date(ref.joinedAtIso).toLocaleDateString('ar-EG')}
                        </td>
                        <td className="py-3.5 px-3 font-mono tabular-nums font-bold text-[#F8FAFC]">
                          {ref.completedOrdersCount}
                        </td>
                        <td className="py-3.5 px-3 font-mono tabular-nums text-[#F8FAFC]">
                          {Math.round(ref.totalSalesVolumeEgp)} ج.م
                        </td>
                        <td className="py-3.5 px-3 font-mono tabular-nums font-bold text-[#FF6B00]">
                          {Number(ref.totalCommissionsEgp || 0).toFixed(2)} ج.م
                        </td>
                        <td className="py-3.5 px-3">
                          <button
                            type="button"
                            onClick={() => setSelectedReferral(ref)}
                            className="min-h-[36px] px-3 py-1.5 rounded-lg border border-[#334155] bg-[#0F172A] text-[#F8FAFC] hover:border-[#FF6B00] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#FF6B00]" />
                            <span>عرض التفاصيل</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : (
          <div className="space-y-6">
            {/* Wallet Balances */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="rounded-2xl bg-[#1E293B] text-[#F8FAFC] p-6 space-y-3 border border-[#334155]">
                <p className="text-xs font-semibold text-[#94A3B8]">
                  الرصيد المتاح للسحب الفوري
                </p>
                <p className="text-3xl font-bold font-mono tabular-nums text-[#FF6B00]">
                  {availableBalance.toFixed(2)}{' '}
                  <span className="text-sm text-[#F8FAFC]">ج.م</span>
                </p>
                <p className="text-xs text-[#94A3B8]">
                  الحد الأدنى للسحب ١٠٠ ج.م عبر فودافون كاش أو إنستاباي
                </p>
                <button
                  type="button"
                  onClick={() => setIsPayoutModalOpen(true)}
                  disabled={availableBalance < 100}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-45 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <ArrowUpLeft className="w-4 h-4" />
                  <span>
                    {availableBalance >= 100
                      ? 'طلب سحب الأرباح الآن'
                      : 'الحد الأدنى للسحب ١٠٠ ج.م'}
                  </span>
                </button>
              </div>

              <div className="rounded-2xl bg-[#1E293B] border border-[#334155] p-6 space-y-3">
                <p className="text-xs font-semibold text-[#94A3B8]">
                  الرصيد المعلق (ضمان ٢٤ ساعة)
                </p>
                <p className="text-3xl font-bold font-mono tabular-nums text-[#F8FAFC]">
                  {pendingBalance.toFixed(2)}{' '}
                  <span className="text-sm font-semibold">ج.م</span>
                </p>
                <p className="text-xs text-[#94A3B8]">
                  ينتقل تلقائياً للرصيد المتاح بعد مرور ٢٤ ساعة على تسليم الطلب
                </p>
                <button
                  type="button"
                  disabled={settlingEscrow}
                  onClick={handleSettleEscrow}
                  className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-[#334155] bg-[#0F172A] text-[#F8FAFC] hover:border-[#FF6B00] text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw
                    className={`w-4 h-4 text-[#FF6B00] ${
                      settlingEscrow ? 'animate-spin' : ''
                    }`}
                  />
                  <span>
                    {settlingEscrow
                      ? 'جارٍ فحص وتسوية العمولات...'
                      : 'تحديث وتسوية العمولات المستحقة'}
                  </span>
                </button>
              </div>

              <div className="rounded-2xl bg-[#1E293B] border border-[#334155] p-6 space-y-3">
                <p className="text-xs font-semibold text-[#94A3B8]">
                  نسبة العمولة وإجمالي الأرباح التاريخية
                </p>
                <p className="text-3xl font-bold font-mono tabular-nums text-[#F8FAFC]">
                  {commissionRate}%
                </p>
                <p className="text-xs text-[#94A3B8] tabular-nums">
                  إجمالي العمولات المحققة منذ الانضمام:{' '}
                  <strong className="text-[#F8FAFC]">
                    {totalEarnedCommissionsEgp.toFixed(2)} ج.م
                  </strong>
                </p>
              </div>
            </section>

            {/* Payout Requests History */}
            <section className="rounded-2xl bg-[#1E293B] border border-[#334155] p-6 space-y-4">
              <h2 className="text-lg font-bold text-[#F8FAFC]">
                سجل طلبات سحب الأرباح
              </h2>
              {payoutRequests.length === 0 ? (
                <p className="text-xs sm:text-sm text-[#94A3B8]">
                  لا توجد طلبات سحب سابقة بعد.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs sm:text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-[#334155] text-[#94A3B8]">
                        <th className="py-3 px-3 font-semibold">التاريخ</th>
                        <th className="py-3 px-3 font-semibold">المبلغ</th>
                        <th className="py-3 px-3 font-semibold">وسيلة التحويل</th>
                        <th className="py-3 px-3 font-semibold">بيانات الحساب</th>
                        <th className="py-3 px-3 font-semibold">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#334155]/70">
                      {payoutRequests.map((req) => (
                        <tr key={req.id}>
                          <td className="py-3 px-3 font-mono tabular-nums text-xs text-[#94A3B8]">
                            {new Date(req.createdAtIso).toLocaleString('ar-EG', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </td>
                          <td className="py-3 px-3 font-mono tabular-nums font-bold text-[#F8FAFC]">
                            {req.amount} ج.م
                          </td>
                          <td className="py-3 px-3 text-[#F8FAFC]">
                            {req.method === 'vodafone_cash'
                              ? 'فودافون كاش'
                              : 'إنستاباي (InstaPay)'}
                          </td>
                          <td
                            dir="ltr"
                            className="py-3 px-3 font-mono text-right text-xs text-[#94A3B8]"
                          >
                            {req.accountDetails}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`font-bold ${
                                req.status === 'completed'
                                  ? 'text-emerald-400'
                                  : req.status === 'rejected'
                                  ? 'text-rose-400'
                                  : 'text-amber-400'
                              }`}
                            >
                              {req.status === 'completed'
                                ? 'تم التحويل بنجاح'
                                : req.status === 'rejected'
                                ? `مرفوض وتم رد الرصيد${
                                    req.rejectionReason
                                      ? ` (${req.rejectionReason})`
                                      : ''
                                  }`
                                : 'قيد مراجعة الإدارة'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Commissions Ledger */}
            <section className="rounded-2xl bg-[#1E293B] border border-[#334155] p-6 space-y-4">
              <h2 className="text-lg font-bold text-[#F8FAFC]">
                كشف حساب العمولات التفصيلي
              </h2>
              {commissions.length === 0 ? (
                <p className="text-xs sm:text-sm text-[#94A3B8]">
                  تُسجّل العمولات هنا تلقائياً فور تسليم أي طلب تابع لحساب قمت باستقطابه.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs sm:text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-[#334155] text-[#94A3B8]">
                        <th className="py-3 px-3 font-semibold">التاريخ</th>
                        <th className="py-3 px-3 font-semibold">الحساب المرتبط</th>
                        <th className="py-3 px-3 font-semibold">قيمة الطلب</th>
                        <th className="py-3 px-3 font-semibold">النسبة</th>
                        <th className="py-3 px-3 font-semibold">العمولة</th>
                        <th className="py-3 px-3 font-semibold">حالة التسوية</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#334155]/70">
                      {commissions.slice(0, 50).map((com) => (
                        <tr key={com.id}>
                          <td className="py-3 px-3 font-mono tabular-nums text-xs text-[#94A3B8]">
                            {new Date(com.createdAtIso).toLocaleDateString(
                              'ar-EG'
                            )}
                          </td>
                          <td className="py-3 px-3 font-semibold text-[#F8FAFC]">
                            {com.referredEntityName} ·{' '}
                            <span className="text-xs text-[#94A3B8]">
                              {com.referredEntityType === 'store'
                                ? 'متجر'
                                : 'عميل'}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono tabular-nums text-[#F8FAFC]">
                            {com.orderTotalEgp} ج.م
                          </td>
                          <td className="py-3 px-3 font-mono tabular-nums text-[#94A3B8]">
                            {com.commissionRatePercent}%
                          </td>
                          <td className="py-3 px-3 font-mono tabular-nums font-bold text-[#FF6B00]">
                            +{com.amountEgp.toFixed(2)} ج.م
                          </td>
                          <td className="py-3 px-3 text-xs font-bold">
                            {com.status === 'settled' ? (
                              <span className="text-emerald-400">
                                متاحة بالمحفظة
                              </span>
                            ) : (
                              <span className="text-amber-400">
                                معلقة ٢٤ ساعة
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Self-Service Account Deletion (Egyptian Law 151/2020 Compliance) */}
            <section className="rounded-2xl border border-rose-800/70 bg-rose-950/30 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-rose-200">
                  حذف حسابي نهائياً من منصة إدكاوي
                </h3>
                <p className="text-xs text-rose-300/80">
                  وفقاً لقانون حماية البيانات الشخصية المصري رقم 151 لسنة 2020 ومتطلبات Google Play، يمكنك حذف حسابك وبياناتك الشخصية نهائياً في أي وقت.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(true)}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Trash2 className="w-4 h-4" />
                <span>حذف حسابي</span>
              </button>
            </section>
          </div>
        )}
      </main>

      {/* Modal 1: Create New Invitation */}
      {isInviteModalOpen && (
        <div
          className="edkawi-modal-backdrop flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="إنشاء دعوة جديدة"
        >
          <div className="w-full max-w-lg rounded-2xl bg-[#1E293B] border border-[#334155] shadow-2xl p-6 space-y-5 text-[#F8FAFC]">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#334155]">
              <h2 className="text-lg font-bold text-[#F8FAFC]">
                إنشاء وإرسال دعوة تسجيل (صالحة ٤٨ ساعة)
              </h2>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="p-2 rounded-xl text-[#94A3B8] hover:bg-[#0F172A] hover:text-[#F8FAFC] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createdInviteUrl ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-800/80 text-xs sm:text-sm text-emerald-100 space-y-1.5">
                  <p className="font-bold">
                    {createdInviteSentSmtp
                      ? 'تم إرسال رسالة الدعوة الرسمية عبر البريد الإلكتروني بنجاح!'
                      : 'تم توليد رابط الدعوة المربوط بكود إحالتك بنجاح!'}
                  </p>
                  <p className="text-xs opacity-90">
                    يمكنك أيضاً نسخ الرابط التالي وإرساله مباشرة عبر واتساب لصاحب المتجر أو العميل:
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0F172A] border border-[#334155] space-y-2">
                  <p
                    dir="ltr"
                    className="text-xs font-mono break-all text-left text-[#F8FAFC]"
                  >
                    {createdInviteUrl}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyText(createdInviteUrl, () => {
                        setCopiedInviteId('modal_new');
                        window.setTimeout(() => setCopiedInviteId(null), 2000);
                      })
                    }
                    className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {copiedInviteId === 'modal_new' ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    <span>
                      {copiedInviteId === 'modal_new'
                        ? 'تم نسخ رابط الدعوة!'
                        : 'نسخ رابط الدعوة'}
                    </span>
                  </button>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setCreatedInviteUrl(null);
                      setIsInviteModalOpen(false);
                    }}
                    className="min-h-[42px] px-5 py-2 rounded-xl border border-[#334155] bg-[#0F172A] text-[#F8FAFC] text-xs font-bold cursor-pointer"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateInvitation} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-[#F8FAFC]">
                    البريد الإلكتروني للشخص أو المتجر المدعو
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#94A3B8] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      dir="ltr"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="owner@example.com"
                      className="w-full min-h-[44px] pr-10 pl-3.5 py-2 rounded-xl border border-[#334155] bg-[#0F172A] text-[#F8FAFC] placeholder:text-[#94A3B8] text-sm font-mono text-left"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1.5 text-[#F8FAFC]">
                    نوع الحساب المدعو
                  </label>
                  <select
                    value={inviteUserType}
                    onChange={(e) =>
                      setInviteUserType(
                        e.target.value as 'store' | 'customer' | 'courier'
                      )
                    }
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#334155] bg-[#0F172A] text-[#F8FAFC] text-sm"
                  >
                    <option value="store">متجر / مطعم / صيدلية</option>
                    <option value="customer">عميل</option>
                    <option value="courier">مندوب توصيل</option>
                  </select>
                </div>

                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  سيتم ربط الحساب تلقائياً بكود إحالتك ({referralCode}) فور إتمام التسجيل، وتحتسب لك عمولة {commissionRate}% على كل طلب مكتمل.
                </p>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsInviteModalOpen(false)}
                    className="min-h-[42px] px-4 py-2 rounded-xl border border-[#334155] bg-[#0F172A] text-[#F8FAFC] text-xs font-bold cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={creatingInvite}
                    className="min-h-[44px] px-6 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-60 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    {creatingInvite ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>
                      {creatingInvite
                        ? 'جارٍ إرسال الدعوة...'
                        : 'إرسال الدعوة الآن'}
                    </span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal 2: Referral Account Performance Details (Zero Customer PII) */}
      {selectedReferral && (
        <div
          className="edkawi-modal-backdrop flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="تفاصيل أداء الحساب المستقطب"
        >
          <div className="w-full max-w-xl rounded-2xl bg-[#1E293B] border border-[#334155] shadow-2xl p-6 space-y-5 text-[#F8FAFC]">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#334155]">
              <div>
                <h2 className="text-lg font-bold text-[#F8FAFC]">
                  {selectedReferral.accountName}
                </h2>
                <p className="text-xs text-[#94A3B8]">
                  انضم في{' '}
                  {new Date(selectedReferral.joinedAtIso).toLocaleDateString(
                    'ar-EG'
                  )}{' '}
                  · خصوصية بيانات العملاء محمية بالكامل
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReferral(null)}
                className="p-2 rounded-xl text-[#94A3B8] hover:bg-[#0F172A] hover:text-[#F8FAFC] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-[#0F172A] border border-[#334155] p-3.5">
                <p className="text-[11px] text-[#94A3B8]">الطلبات المكتملة</p>
                <p className="text-xl font-bold font-mono tabular-nums text-[#F8FAFC] mt-0.5">
                  {selectedReferral.completedOrdersCount}
                </p>
              </div>
              <div className="rounded-xl bg-[#0F172A] border border-[#334155] p-3.5">
                <p className="text-[11px] text-[#94A3B8]">حجم المبيعات</p>
                <p className="text-xl font-bold font-mono tabular-nums text-[#F8FAFC] mt-0.5">
                  {Math.round(selectedReferral.totalSalesVolumeEgp)} ج.م
                </p>
              </div>
              <div className="rounded-xl bg-[#0F172A] border border-[#334155] p-3.5">
                <p className="text-[11px] text-[#94A3B8]">إجمالي عمولاتك</p>
                <p className="text-xl font-bold font-mono tabular-nums text-[#FF6B00] mt-0.5">
                  {Number(selectedReferral.totalCommissionsEgp || 0).toFixed(2)}{' '}
                  ج.م
                </p>
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              <p className="text-xs font-bold text-[#94A3B8]">
                آخر العمولات المحتسبة لهذا الحساب
              </p>
              {selectedReferralCommissions.length === 0 ? (
                <p className="text-xs text-[#94A3B8] py-3">
                  لم تكتمل طلبات مدفوعة العمولة لهذا الحساب حتى الآن.
                </p>
              ) : (
                selectedReferralCommissions.map((c) => (
                  <div
                    key={c.id}
                    className="py-2.5 px-3 rounded-xl bg-[#0F172A] border border-[#334155] flex items-center justify-between text-xs"
                  >
                    <span className="font-mono tabular-nums text-[#94A3B8]">
                      {new Date(c.createdAtIso).toLocaleDateString('ar-EG')} ·
                      قيمة الطلب {c.orderTotalEgp} ج.م
                    </span>
                    <span className="font-mono tabular-nums font-bold text-[#FF6B00]">
                      +{c.amountEgp.toFixed(2)} ج.م
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Payout Withdrawal Request */}
      {isPayoutModalOpen && (
        <div
          className="edkawi-modal-backdrop flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="طلب سحب الأرباح"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#1E293B] border border-[#334155] shadow-2xl p-6 space-y-5 text-[#F8FAFC]">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#334155]">
              <h2 className="text-lg font-bold text-[#F8FAFC]">
                سحب الأرباح من المحفظة
              </h2>
              <button
                type="button"
                onClick={() => setIsPayoutModalOpen(false)}
                className="p-2 rounded-xl text-[#94A3B8] hover:bg-[#0F172A] hover:text-[#F8FAFC] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPayout} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#0F172A] border border-[#334155] text-xs flex items-center justify-between">
                <span className="text-[#94A3B8]">الرصيد المتاح حالياً:</span>
                <span className="font-mono font-bold text-base text-[#FF6B00] tabular-nums">
                  {availableBalance.toFixed(2)} ج.م
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-[#F8FAFC]">
                  المبلغ المطلوب سحبه (الحد الأدنى ١٠٠ ج.م)
                </label>
                <input
                  type="number"
                  dir="ltr"
                  min={100}
                  max={availableBalance}
                  step="1"
                  required
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#334155] bg-[#0F172A] text-[#F8FAFC] text-sm font-mono tabular-nums text-left"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-[#F8FAFC]">
                  طريقة الاستلام
                </label>
                <select
                  value={payoutMethod}
                  onChange={(e) =>
                    setPayoutMethod(e.target.value as PayoutMethod)
                  }
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#334155] bg-[#0F172A] text-[#F8FAFC] text-sm"
                >
                  <option value="vodafone_cash">فودافون كاش (Vodafone Cash)</option>
                  <option value="instapay">إنستاباي (InstaPay)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-[#F8FAFC]">
                  {payoutMethod === 'vodafone_cash'
                    ? 'رقم محفظة فودافون كاش (١١ رقماً)'
                    : 'عنوان الدفع في إنستاباي (IPA) أو رقم الموبايل المرتبط'}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  required
                  value={payoutAccountDetails}
                  onChange={(e) => setPayoutAccountDetails(e.target.value)}
                  placeholder={
                    payoutMethod === 'vodafone_cash'
                      ? '01012345678'
                      : 'username@instapay'
                  }
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#334155] bg-[#0F172A] text-[#F8FAFC] placeholder:text-[#94A3B8] text-sm font-mono text-left"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPayoutModalOpen(false)}
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-[#334155] bg-[#0F172A] text-[#F8FAFC] text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submittingPayout}
                  className="min-h-[44px] px-6 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-60 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  {submittingPayout && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  <span>
                    {submittingPayout ? 'جارٍ الإرسال...' : 'تأكيد طلب السحب'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Confirm Permanent Account Deletion */}
      {isDeleteModalOpen && (
        <div
          className="edkawi-modal-backdrop flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="تأكيد حذف الحساب نهائياً"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#1E293B] border border-[#334155] shadow-2xl p-6 space-y-4 text-[#F8FAFC]">
            <h2 className="text-lg font-bold text-rose-400">
              تأكيد حذف الحساب نهائياً
            </h2>
            <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
              سيتم حذف جميع بياناتك الشخصية وحساب الدخول الخاص بك نهائياً من منصة إدكاوي. لا يمكن التراجع عن هذا الإجراء. هل أنت متأكد؟
            </p>
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={deletingAccount}
                onClick={() => setIsDeleteModalOpen(false)}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-[#334155] bg-[#0F172A] text-[#F8FAFC] text-xs font-bold cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                disabled={deletingAccount}
                onClick={handleDeleteOwnAccount}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
              >
                {deletingAccount && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                <span>نعم، احذف حسابي نهائياً</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmActionModal
        isOpen={Boolean(confirmDeleteInvite)}
        title="تأكيد حذف الدعوة"
        description={
          confirmDeleteInvite
            ? `هل تريد حذف دعوة البريد ${confirmDeleteInvite.email} نهائياً؟`
            : ''
        }
        warningNote="لن يتمكن المدعو من التسجيل عبر رابط هذه الدعوة بعد حذفها."
        confirmLabel="حذف الدعوة"
        cancelLabel="إلغاء"
        tone="danger"
        isProcessing={Boolean(
          confirmDeleteInvite && busyInviteId === confirmDeleteInvite.id
        )}
        onConfirm={async () => {
          if (!confirmDeleteInvite) return;
          const target = confirmDeleteInvite;
          setConfirmDeleteInvite(null);
          await handleDeleteInvitation(target);
        }}
        onCancel={() => setConfirmDeleteInvite(null)}
      />

      <ConfirmActionModal
        isOpen={confirmLogoutOpen}
        title="تسجيل الخروج من بوابة المبيعات"
        description="هل تريد إنهاء جلستك الحالية في بوابة مسؤولي المبيعات؟"
        confirmLabel="تسجيل الخروج"
        cancelLabel="البقاء متصلاً"
        tone="warning"
        onConfirm={() => {
          setConfirmLogoutOpen(false);
          handleLogout();
        }}
        onCancel={() => setConfirmLogoutOpen(false)}
      />
    </div>
  );
};
