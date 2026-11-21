import React, { useMemo, useState } from 'react';
import {
  Bike,
  CheckCircle2,
  Headphones,
  Loader2,
  LogOut,
  Package,
  Plus,
  Search,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserX,
  X,
} from 'lucide-react';
import {
  createStaffMemberByAdminInFirestore,
  toggleStaffMemberActiveByAdminInFirestore,
} from '../services/edkawiFirebaseService';
import {
  CourierApprovalStatus,
  CourierRecord,
  OrderRecord,
  StaffMemberRecord,
  StaffRole,
  SupportTicketRecord,
} from '../types/edkawi';
import { getOrderStatusLabel } from '../utils/orderLogic';
import { AdkawyLogo } from './AdkawyLogo';
import { ConfirmActionModal } from './ConfirmActionModal';
import { AdminSupportSplitWorkspace } from './SupportSystemViews';

function getStaffRoleArabicLabel(role: StaffRole): string {
  if (role === 'super_admin') return 'مدير عام (Super Admin)';
  if (role === 'support_agent') return 'مسؤول دعم فني (Support Agent)';
  return 'مسؤول عمليات وتوصيل (Operations)';
}

/* ============================================================================
 * 1. SUPER ADMIN TEAM MANAGEMENT SECTION (فريق العمل)
 * ========================================================================== */

interface AdminStaffManagementSectionProps {
  adminUid: string;
  staffMembers: StaffMemberRecord[];
  onNotify: (msg: string) => void;
}

export const AdminStaffManagementSection: React.FC<
  AdminStaffManagementSectionProps
> = ({ adminUid, staffMembers, onNotify }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<StaffRole>('support_agent');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmToggleMember, setConfirmToggleMember] =
    useState<StaffMemberRecord | null>(null);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setCreating(true);
    try {
      const created = await createStaffMemberByAdminInFirestore(adminUid, {
        name,
        email,
        password,
        role,
      });
      setName('');
      setEmail('');
      setPassword('');
      setRole('support_agent');
      setShowAddModal(false);
      onNotify(
        `تم إنشاء حساب الموظف «${created.name}» بنجاح (${getStaffRoleArabicLabel(
          created.role
        )}).`
      );
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'تعذر إضافة عضو الفريق حالياً.'
      );
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (member: StaffMemberRecord) => {
    setTogglingId(member.id);
    try {
      const nextState = !member.isActive;
      await toggleStaffMemberActiveByAdminInFirestore(member, nextState);
      onNotify(
        nextState
          ? `تم إعادة تفعيل حساب الموظف «${member.name}».`
          : `تم إيقاف حساب الموظف «${member.name}» فوراً.`
      );
      setConfirmToggleMember(null);
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'تعذر تحديث حالة الموظف حالياً.'
      );
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#F8FAFC]">
            إدارة فريق العمل والصلاحيات
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-[#94A3B8]">
            أنشئ حسابات لمسؤولي الدعم الفني ومسؤولي العمليات وحدد صلاحية كل موظف بدقة.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setShowAddModal(true);
          }}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-sm font-bold whitespace-nowrap shrink-0 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>إضافة عضو جديد</span>
        </button>
      </div>

      {/* Staff Table */}
      <div className="rounded-2xl border border-[#334155] bg-[#1E293B] overflow-hidden">
        {staffMembers.length === 0 ? (
          <div className="p-10 text-center">
            <ShieldCheck className="w-10 h-10 text-[#94A3B8] mx-auto mb-3" />
            <p className="text-base font-bold text-[#F8FAFC]">
              لا يوجد موظفون مضافون في فريق العمل بعد
            </p>
            <p className="mt-1 text-xs text-[#94A3B8]">
              اضغط على «إضافة عضو جديد» لإضافة مسؤول دعم فني أو مسؤول عمليات وتوصيل.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-[#334155] bg-[#0F172A] text-xs font-bold text-[#94A3B8]">
                  <th className="py-3.5 px-4">الاسم</th>
                  <th className="py-3.5 px-4">البريد الإلكتروني</th>
                  <th className="py-3.5 px-4">الدور الوظيفي</th>
                  <th className="py-3.5 px-4">التذاكر المفتوحة</th>
                  <th className="py-3.5 px-4">الحالة</th>
                  <th className="py-3.5 px-4">إجراء سريع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155] text-sm">
                {staffMembers.map((member) => (
                  <tr
                    key={member.id}
                    className="hover:bg-[#0F172A]/50 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-bold text-[#F8FAFC]">
                      {member.name}
                    </td>
                    <td
                      dir="ltr"
                      className="py-3.5 px-4 text-right font-mono text-xs text-[#94A3B8]"
                    >
                      {member.email}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-bold text-[#F8FAFC]">
                      {getStaffRoleArabicLabel(member.role)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs tabular-nums text-[#F8FAFC]">
                      {member.role === 'support_agent'
                        ? member.openTicketCount
                        : '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-xs font-bold ${
                          member.isActive ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {member.isActive ? 'نشط' : 'موقوف'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        disabled={togglingId === member.id}
                        onClick={() => {
                          if (member.isActive) {
                            setConfirmToggleMember(member);
                          } else {
                            void handleToggleActive(member);
                          }
                        }}
                        className={`min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                          member.isActive
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        {togglingId === member.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : member.isActive ? (
                          <UserX className="w-3.5 h-3.5" />
                        ) : (
                          <UserCheck className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {member.isActive ? 'إيقاف الحساب' : 'تفعيل الحساب'}
                        </span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Staff Member Modal */}
      {showAddModal && (
        <div
          className="edkawi-modal-backdrop flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="إضافة عضو جديد لفريق العمل"
        >
          <div className="w-full max-w-lg rounded-2xl bg-[#1E293B] border border-[#334155] shadow-2xl overflow-hidden">
            <div className="px-5 py-4 bg-[#0F172A] border-b border-[#334155] text-[#F8FAFC] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#FF6B00]" />
                <h3 className="text-base font-bold text-[#F8FAFC]">
                  إضافة عضو جديد لفريق إدكاوي
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="min-h-[40px] min-w-[40px] rounded-2xl text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B] flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#F8FAFC] mb-1.5">
                  اسم الموظف بالكامل
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: أحمد محمود"
                  maxLength={80}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border border-[#334155] bg-[#0F172A] text-sm text-[#F8FAFC] placeholder:text-[#94A3B8]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#F8FAFC] mb-1.5">
                  البريد الإلكتروني للدخول
                </label>
                <input
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="agent@edkawy.com"
                  maxLength={100}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border border-[#334155] bg-[#0F172A] text-sm text-[#F8FAFC] placeholder:text-[#94A3B8] text-left"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#F8FAFC] mb-1.5">
                  كلمة المرور (6 أحرف على الأقل)
                </label>
                <input
                  type="password"
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  maxLength={64}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border border-[#334155] bg-[#0F172A] text-sm text-[#F8FAFC] placeholder:text-[#94A3B8] text-left"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#F8FAFC] mb-1.5">
                  الصلاحية الوظيفية (Role)
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as StaffRole)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border border-[#334155] bg-[#0F172A] text-sm text-[#F8FAFC]"
                >
                  <option value="support_agent">
                    مسؤول دعم فني (يرى تذاكر الدعم المحولة إليه فقط)
                  </option>
                  <option value="operations">
                    مسؤول عمليات وتوصيل (يدير الطلبات والمشاوير والمندوبين فقط)
                  </option>
                  <option value="super_admin">
                    مدير عام (صلاحية كاملة للوحة التحكم)
                  </option>
                </select>
              </div>

              {formError && (
                <p className="text-xs font-bold text-red-400">{formError}</p>
              )}

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="min-h-[44px] px-4 py-2 rounded-2xl border border-[#334155] bg-[#0F172A] text-xs font-bold text-[#F8FAFC] cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-50 text-white text-sm font-bold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {creating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  <span>إنشاء الحساب الآن</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmActionModal
        isOpen={Boolean(confirmToggleMember)}
        title="تأكيد إيقاف حساب الموظف"
        description={
          confirmToggleMember
            ? `هل تريد إيقاف وصول الموظف «${confirmToggleMember.name}» إلى بوابة فريق العمل فوراً؟`
            : ''
        }
        confirmLabel="نعم، إيقاف الحساب"
        tone="danger"
        isProcessing={Boolean(
          confirmToggleMember && togglingId === confirmToggleMember.id
        )}
        onCancel={() => setConfirmToggleMember(null)}
        onConfirm={() => {
          if (confirmToggleMember) {
            return handleToggleActive(confirmToggleMember);
          }
        }}
      />
    </div>
  );
};

/* ============================================================================
 * 2. DEDICATED SUPPORT AGENT PORTAL VIEW (بوابة مسؤول الدعم الفني)
 * ========================================================================== */

interface SupportAgentPortalViewProps {
  agentUid: string;
  agentName: string;
  assignedTickets: SupportTicketRecord[];
  onLogout: () => void;
  onNotify: (msg: string) => void;
}

export const SupportAgentPortalView: React.FC<SupportAgentPortalViewProps> = ({
  agentUid,
  agentName,
  assignedTickets,
  onLogout,
  onNotify,
}) => {
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0F172A] text-[#F8FAFC] pb-16">
      <header className="sticky top-0 z-40 bg-[#1E293B]/95 backdrop-blur-md border-b border-[#334155] px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AdkawyLogo variant="navbar" />
            <span className="hidden sm:inline text-xs font-bold text-[#94A3B8]">
              · بوابة الدعم الفني المخصصة ({agentName})
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setConfirmLogoutOpen(true)}
              className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#0F172A] border border-[#334155] hover:border-[#FF6B00] text-[#F8FAFC] text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-[#FF6B00]" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 space-y-5">
        <div className="rounded-2xl bg-[#1E293B] border border-[#334155] text-[#F8FAFC] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#FF6B00] text-white flex items-center justify-center shrink-0">
              <Headphones className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-[#F8FAFC]">
                مرحباً {agentName} — مساحة تذاكر الدعم المسندة إليك
              </h1>
              <p className="text-xs sm:text-sm text-[#94A3B8]">
                تظهر هنا فقط التذاكر المحولة لحسابك للرد الفوري على العملاء والمتاجر والكباتن.
              </p>
            </div>
          </div>
          <div className="text-sm font-bold text-[#FF6B00] tabular-nums whitespace-nowrap shrink-0">
            إجمالي التذاكر المسندة: {assignedTickets.length}
          </div>
        </div>

        <AdminSupportSplitWorkspace
          tickets={assignedTickets}
          currentActorUid={agentUid}
          currentActorName={agentName}
          actorRole="support_agent"
          onNotify={onNotify}
        />
      </main>

      <ConfirmActionModal
        isOpen={confirmLogoutOpen}
        title="تأكيد تسجيل الخروج"
        description="هل تريد تسجيل الخروج من بوابة الدعم الفني الآن؟"
        confirmLabel="تسجيل الخروج"
        tone="warning"
        onCancel={() => setConfirmLogoutOpen(false)}
        onConfirm={() => {
          setConfirmLogoutOpen(false);
          onLogout();
        }}
      />
    </div>
  );
};

/* ============================================================================
 * 3. DEDICATED OPERATIONS PORTAL VIEW (بوابة مسؤول العمليات والتوصيل)
 * ========================================================================== */

interface OperationsPortalViewProps {
  officerName: string;
  orders: OrderRecord[];
  couriers: CourierRecord[];
  onLogout: () => void;
  onAssignOrderCourier: (order: OrderRecord, courier: CourierRecord) => Promise<void>;
  onMarkOrderDelivered: (order: OrderRecord) => Promise<void>;
  onCancelOrder: (order: OrderRecord) => Promise<void>;
  onUpdateCourierApproval: (
    courierId: string,
    nextStatus: CourierApprovalStatus
  ) => Promise<void>;
}

export const OperationsPortalView: React.FC<OperationsPortalViewProps> = ({
  officerName,
  orders,
  couriers,
  onLogout,
  onAssignOrderCourier,
  onMarkOrderDelivered,
  onCancelOrder,
  onUpdateCourierApproval,
}) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'couriers'>('orders');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [confirmCancelOrder, setConfirmCancelOrder] =
    useState<OrderRecord | null>(null);

  const approvedCouriers = useMemo(
    () => couriers.filter((c) => c.approvalStatus === 'approved'),
    [couriers]
  );

  const activeOrders = useMemo(
    () =>
      orders.filter(
        (o) => o.status !== 'delivered' && o.status !== 'cancelled'
      ),
    [orders]
  );

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.storeName.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.deliveryNeighborhood.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q)
    );
  }, [orders, searchQuery]);

  return (
    <div className="min-h-screen bg-[#0F172A] text-[#F8FAFC] pb-16">
      <header className="sticky top-0 z-40 bg-[#1E293B]/95 backdrop-blur-md border-b border-[#334155] px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AdkawyLogo variant="navbar" />
            <span className="hidden sm:inline text-xs font-bold text-[#94A3B8]">
              · غرفة العمليات والتوصيل ({officerName})
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setConfirmLogoutOpen(true)}
              className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#0F172A] border border-[#334155] hover:border-[#FF6B00] text-[#F8FAFC] text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-[#FF6B00]" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-4">
            <p className="text-xs text-[#94A3B8]">الطلبات والمشاوير النشطة</p>
            <p className="mt-1 text-2xl font-bold text-[#F8FAFC] tabular-nums">
              {activeOrders.length}
            </p>
          </div>
          <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-4">
            <p className="text-xs text-[#94A3B8]">جاهزة للاستلام أو تسعير مشوار</p>
            <p className="mt-1 text-2xl font-bold text-[#FF6B00] tabular-nums">
              {
                orders.filter(
                  (o) =>
                    o.status === 'ready' || o.status === 'awaiting_courier_quote'
                ).length
              }
            </p>
          </div>
          <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-4">
            <p className="text-xs text-[#94A3B8]">في الطريق الآن</p>
            <p className="mt-1 text-2xl font-bold text-[#F8FAFC] tabular-nums">
              {orders.filter((o) => o.status === 'on_the_way').length}
            </p>
          </div>
          <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-4">
            <p className="text-xs text-[#94A3B8]">كباتن متاحون في إدكو</p>
            <p className="mt-1 text-2xl font-bold text-emerald-400 tabular-nums">
              {approvedCouriers.filter((c) => c.isAvailable).length} /{' '}
              {approvedCouriers.length}
            </p>
          </div>
        </div>

        {/* Workspace Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-[#1E293B] border border-[#334155]">
            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`min-h-[42px] inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'orders'
                  ? 'bg-[#FF6B00] text-white'
                  : 'text-[#F8FAFC]'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>إدارة الطلبات والمشاوير ({orders.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('couriers')}
              className={`min-h-[42px] inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'couriers'
                  ? 'bg-[#FF6B00] text-white'
                  : 'text-[#F8FAFC]'
              }`}
            >
              <Bike className="w-4 h-4" />
              <span>إدارة الكباتن ({couriers.length})</span>
            </button>
          </div>

          {activeTab === 'orders' && (
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-[#94A3B8] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث بالمتجر أو العميل أو الحي..."
                className="w-full min-h-[42px] pr-10 pl-3.5 py-2 rounded-2xl border border-[#334155] bg-[#1E293B] text-sm text-[#F8FAFC] placeholder:text-[#94A3B8]"
              />
            </div>
          )}
        </div>

        {activeTab === 'orders' ? (
          <div className="rounded-2xl border border-[#334155] bg-[#1E293B] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-[#334155] bg-[#0F172A] text-xs font-bold text-[#94A3B8]">
                    <th className="py-3.5 px-4">الطلب / المتجر</th>
                    <th className="py-3.5 px-4">العميل والمنطقة</th>
                    <th className="py-3.5 px-4">الإجمالي</th>
                    <th className="py-3.5 px-4">الحالة</th>
                    <th className="py-3.5 px-4">توجيه لكابتن</th>
                    <th className="py-3.5 px-4">إجراءات العمليات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#334155] text-sm">
                  {filteredOrders.map((order) => {
                    const isTerminal =
                      order.status === 'delivered' ||
                      order.status === 'cancelled';
                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-[#0F172A]/50 transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-[#F8FAFC]">
                            {order.storeName}
                          </p>
                          <p className="text-xs text-[#94A3B8] line-clamp-1">
                            {order.itemsSummary}
                          </p>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-[#F8FAFC]">
                            {order.customerName}
                          </p>
                          <p className="text-xs text-[#94A3B8]">
                            {order.deliveryNeighborhood}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold tabular-nums text-[#F8FAFC]">
                          {order.totalAmount > 0
                            ? `${order.totalAmount} ج.م`
                            : 'بانتظار التسعير'}
                        </td>
                        <td className="py-3.5 px-4 text-xs font-bold text-[#FF6B00]">
                          {getOrderStatusLabel(order.status)}
                        </td>
                        <td className="py-3.5 px-4">
                          {isTerminal ? (
                            <span className="text-xs text-[#94A3B8]">
                              {order.courierName || '—'}
                            </span>
                          ) : (
                            <select
                              value={order.courierId || ''}
                              disabled={busyId === order.id}
                              onChange={async (e) => {
                                const target = approvedCouriers.find(
                                  (c) => c.id === e.target.value
                                );
                                if (!target) return;
                                setBusyId(order.id);
                                try {
                                  await onAssignOrderCourier(order, target);
                                } finally {
                                  setBusyId(null);
                                }
                              }}
                              className="min-h-[38px] px-2.5 py-1.5 rounded-2xl border border-[#334155] bg-[#0F172A] text-xs text-[#F8FAFC]"
                            >
                              <option value="">
                                {order.courierName
                                  ? `الكابتن: ${order.courierName}`
                                  : 'تعيين كابتن...'}
                              </option>
                              {approvedCouriers.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name} ({c.neighborhood})
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {!isTerminal && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={busyId === order.id}
                                onClick={async () => {
                                  setBusyId(order.id);
                                  try {
                                    await onMarkOrderDelivered(order);
                                  } finally {
                                    setBusyId(null);
                                  }
                                }}
                                className="min-h-[36px] px-3 py-1.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                تم التوصيل
                              </button>
                              <button
                                type="button"
                                disabled={busyId === order.id}
                                onClick={() => setConfirmCancelOrder(order)}
                                className="min-h-[36px] px-3 py-1.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                إلغاء
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-[#334155] bg-[#1E293B] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-[#334155] bg-[#0F172A] text-xs font-bold text-[#94A3B8]">
                    <th className="py-3.5 px-4">الكابتن</th>
                    <th className="py-3.5 px-4">المركبة والمنطقة</th>
                    <th className="py-3.5 px-4">التوصيلات المكتملة</th>
                    <th className="py-3.5 px-4">التوفر</th>
                    <th className="py-3.5 px-4">اعتماد الحساب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#334155] text-sm">
                  {couriers.map((courier) => (
                    <tr key={courier.id} className="hover:bg-[#0F172A]/50">
                      <td className="py-3.5 px-4 font-bold text-[#F8FAFC]">
                        {courier.name}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#94A3B8]">
                        {courier.vehicleType} · {courier.neighborhood}
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-[#F8FAFC]">
                        {courier.completedDeliveries}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-bold">
                        <span
                          className={
                            courier.isAvailable
                              ? 'text-emerald-400'
                              : 'text-[#94A3B8]'
                          }
                        >
                          {courier.isAvailable ? 'متاح الآن' : 'غير متصل'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {courier.approvalStatus !== 'approved' ? (
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateCourierApproval(courier.id, 'approved')
                            }
                            className="min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>اعتماد الكابتن</span>
                          </button>
                        ) : (
                          <span className="text-xs font-bold text-emerald-400">
                            معتمد
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <ConfirmActionModal
        isOpen={Boolean(confirmCancelOrder)}
        title="تأكيد إلغاء الطلب من العمليات"
        description={
          confirmCancelOrder
            ? `هل أنت متأكد من إلغاء الطلب رقم #${confirmCancelOrder.id.slice(
                0,
                8
              )} الخاص بالعميل «${confirmCancelOrder.customerName}»؟`
            : ''
        }
        confirmLabel="نعم، إلغاء الطلب"
        tone="danger"
        isProcessing={Boolean(
          confirmCancelOrder && busyId === confirmCancelOrder.id
        )}
        onCancel={() => setConfirmCancelOrder(null)}
        onConfirm={async () => {
          if (!confirmCancelOrder) return;
          const target = confirmCancelOrder;
          setBusyId(target.id);
          try {
            await onCancelOrder(target);
            setConfirmCancelOrder(null);
          } finally {
            setBusyId(null);
          }
        }}
      />

      <ConfirmActionModal
        isOpen={confirmLogoutOpen}
        title="تأكيد تسجيل الخروج"
        description="هل تريد تسجيل الخروج من غرفة العمليات والتوصيل الآن؟"
        confirmLabel="تسجيل الخروج"
        tone="warning"
        onCancel={() => setConfirmLogoutOpen(false)}
        onConfirm={() => {
          setConfirmLogoutOpen(false);
          onLogout();
        }}
      />
    </div>
  );
};
