import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Headphones,
  Loader2,
  MessageSquare,
  Paperclip,
  Phone,
  Plus,
  Search,
  Send,
  UserCheck,
  X,
} from 'lucide-react';
import {
  assignSupportTicketByAdminInFirestore,
  closeSupportTicketInFirestore,
  createSupportTicketInFirestore,
  listenToSupportMessages,
  listenToUserSupportTickets,
  sendSupportMessageInFirestore,
} from '../services/edkawiFirebaseService';
import {
  StaffMemberRecord,
  SupportMessageRecord,
  SupportTicketCategory,
  SupportTicketRecord,
} from '../types/edkawi';
import { DeviceImageInput } from './DeviceImageInput';

const SUPPORT_CATEGORIES: SupportTicketCategory[] = [
  'طلب',
  'دفع',
  'مشكلة تقنية',
  'أخرى',
];

const CANNED_SUPPORT_REPLIES: string[] = [
  'تم استلام شكواك وجارٍ المتابعة مع المتجر والمندوب فوراً.',
  'نعتذر عن التأخير، الكابتن في طريقه إليك الآن.',
  'تم مراجعة تفاصيل الدفع واعتماد التسوية في حسابك.',
  'شكراً لتواصلك مع دعم إدكاوي، يسعدنا خدمتك دائماً.',
];

function formatArabicDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ar-EG', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function getUserRoleLabel(role: 'customer' | 'store' | 'courier'): string {
  if (role === 'store') return 'متجر / صيدلية';
  if (role === 'courier') return 'كابتن توصيل';
  return 'عميل إدكاوي';
}

/* ============================================================================
 * 1. USER SUPPORT SECTION (Customer Account + Store/Courier Modal Content)
 * ========================================================================== */

interface CustomerSupportSectionProps {
  currentUserUid: string;
  isAnonymous: boolean;
  userName: string;
  userPhone?: string;
  userEmail?: string;
  userRole?: 'customer' | 'store' | 'courier';
  onRequireLogin?: () => void;
  onNotify?: (message: string) => void;
}

export const CustomerSupportSection: React.FC<CustomerSupportSectionProps> = ({
  currentUserUid,
  isAnonymous,
  userName,
  userPhone = '',
  userEmail = '',
  userRole = 'customer',
  onRequireLogin,
  onNotify,
}) => {
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessageRecord[]>([]);
  const [showNewForm, setShowNewForm] = useState(false);

  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<SupportTicketCategory>('طلب');
  const [details, setDetails] = useState('');
  const [attachmentImageUrl, setAttachmentImageUrl] = useState('');
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [closingCustomerTicket, setClosingCustomerTicket] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!currentUserUid || isAnonymous) {
      setTickets([]);
      return;
    }
    const unsub = listenToUserSupportTickets(currentUserUid, (list) => {
      setTickets(list);
      setSelectedTicketId((prev) => {
        if (prev && list.some((t) => t.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    });
    return () => unsub();
  }, [currentUserUid, isAnonymous]);

  const selectedTicket = useMemo(
    () => tickets.find((t) => t.id === selectedTicketId) ?? null,
    [tickets, selectedTicketId]
  );

  useEffect(() => {
    if (!selectedTicket || !currentUserUid || isAnonymous) {
      setMessages([]);
      return;
    }
    const unsub = listenToSupportMessages(
      selectedTicket.id,
      currentUserUid,
      setMessages
    );
    return () => unsub();
  }, [selectedTicket?.id, currentUserUid, isAnonymous]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, selectedTicket?.id]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAnonymous) {
      onRequireLogin?.();
      return;
    }
    setFormError(null);
    setSubmittingTicket(true);
    try {
      const createdId = await createSupportTicketInFirestore(
        currentUserUid,
        {
          name: userName || 'عميل إدكاوي',
          phone: userPhone,
          email: userEmail,
          role: userRole,
        },
        {
          subject,
          category,
          details,
          ...(attachmentImageUrl ? { attachmentImageUrl } : {}),
        }
      );
      setSubject('');
      setCategory('طلب');
      setDetails('');
      setAttachmentImageUrl('');
      setShowNewForm(false);
      setSelectedTicketId(createdId);
      onNotify?.('تم فتح تذكرة الدعم بنجاح وسيتم الرد عليك فوراً.');
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'تعذر إرسال التذكرة حالياً.'
      );
    } finally {
      setSubmittingTicket(false);
    }
  };

  const handleSendUserMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim() || sendingReply) return;
    setSendingReply(true);
    try {
      await sendSupportMessageInFirestore(
        selectedTicket,
        currentUserUid,
        userName || 'عميل إدكاوي',
        'user',
        replyText
      );
      setReplyText('');
    } catch (err) {
      onNotify?.(
        err instanceof Error ? err.message : 'تعذر إرسال الرسالة حالياً.'
      );
    } finally {
      setSendingReply(false);
    }
  };

  const handleCustomerCloseTicket = async () => {
    if (!selectedTicket || closingCustomerTicket) return;
    setClosingCustomerTicket(true);
    try {
      await closeSupportTicketInFirestore(selectedTicket);
      onNotify?.(`تم إغلاق التذكرة «${selectedTicket.subject}» بنجاح.`);
    } catch (err) {
      onNotify?.(
        err instanceof Error ? err.message : 'تعذر إغلاق التذكرة حالياً.'
      );
    } finally {
      setClosingCustomerTicket(false);
    }
  };

  if (isAnonymous) {
    return (
      <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-6 text-right">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-[#F8FAFC]">
              المساعدة والدعم المباشر
            </h3>
            <p className="mt-1 text-sm text-[#94A3B8]">
              سجل الدخول بحسابك لفتح تذكرة دعم فني والتحدث مباشرة مع فريق دعم إدكاوي.
            </p>
          </div>
          {onRequireLogin && (
            <button
              type="button"
              onClick={onRequireLogin}
              className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-sm font-bold whitespace-nowrap shrink-0 cursor-pointer"
            >
              تسجيل الدخول للمحادثة
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-[#334155] bg-[#1E293B] p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#334155] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#FF6B00]/15 text-[#FF6B00] flex items-center justify-center shrink-0">
            <Headphones className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[#F8FAFC]">
              المساعدة والدعم المباشر
            </h3>
            <p className="text-xs text-[#94A3B8]">
              تواصل فوري بالوقت الفعلي مع مسؤولي دعم إدكاوي
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setShowNewForm((prev) => !prev);
          }}
          className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{showNewForm ? 'إخفاء النموذج' : 'تذكرة جديدة'}</span>
        </button>
      </div>

      {showNewForm && (
        <form
          onSubmit={handleCreateTicket}
          className="rounded-2xl border border-[#334155] bg-[#0F172A] p-4 sm:p-5 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#F8FAFC] mb-1.5">
                عنوان المشكلة
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="مثال: استفسار عن تأخر الطلب"
                maxLength={100}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border border-[#334155] bg-[#1E293B] text-sm text-[#F8FAFC] placeholder:text-[#94A3B8]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#F8FAFC] mb-1.5">
                نوع المشكلة
              </label>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as SupportTicketCategory)
                }
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border border-[#334155] bg-[#1E293B] text-sm text-[#F8FAFC]"
              >
                {SUPPORT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#F8FAFC] mb-1.5">
              تفاصيل المشكلة
            </label>
            <textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="اشرح مشكلتك بوضوح ليقوم مسؤول الدعم بحلها فوراً..."
              maxLength={1000}
              className="w-full px-3.5 py-2.5 rounded-2xl border border-[#334155] bg-[#1E293B] text-sm text-[#F8FAFC] placeholder:text-[#94A3B8]"
            />
          </div>

          <DeviceImageInput
            label="إرفاق لقطة شاشة أو صورة توضيحية (اختياري)"
            value={attachmentImageUrl}
            onChange={setAttachmentImageUrl}
            required={false}
            aspectClassName="h-32"
            helperText="يساعد إرفاق صورة على حل مشكلتك بسرعة أكبر"
          />

          {formError && (
            <p className="text-xs font-semibold text-rose-400">
              {formError}
            </p>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowNewForm(false)}
              className="min-h-[44px] px-4 py-2 rounded-2xl border border-[#334155] bg-[#1E293B] text-xs font-bold text-[#F8FAFC] hover:border-[#FF6B00] whitespace-nowrap shrink-0 cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submittingTicket}
              className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-60 text-white text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 cursor-pointer"
            >
              {submittingTicket ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>إرسال التذكرة وبدء المحادثة</span>
            </button>
          </div>
        </form>
      )}

      {tickets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#334155] bg-[#0F172A] p-8 text-center">
          <MessageSquare className="w-8 h-8 text-[#94A3B8] mx-auto mb-2" />
          <p className="text-sm font-bold text-[#F8FAFC]">
            لا توجد تذاكر دعم سابقة حتى الآن
          </p>
          <p className="mt-1 text-xs text-[#94A3B8]">
            اضغط على «تذكرة جديدة» أعلاه إذا واجهت أي مشكلة في الطلب أو الدفع أو التطبيق.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Previous Tickets List */}
          <div className="lg:col-span-5 space-y-2.5">
            <h4 className="text-xs font-bold text-[#94A3B8]">
              تذاكرك السابقة ({tickets.length})
            </h4>
            <div className="space-y-2 max-h-[380px] overflow-y-auto pl-1">
              {tickets.map((t) => {
                const isSelected = t.id === selectedTicket?.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTicketId(t.id)}
                    className={`w-full text-right p-3.5 rounded-2xl border transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-[#FF6B00] bg-[#FF6B00]/10'
                        : 'border-[#334155] bg-[#0F172A] hover:border-[#FF6B00]/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-bold text-[#F8FAFC] line-clamp-1">
                        {t.subject}
                      </span>
                      <span
                        className={`text-xs font-bold whitespace-nowrap shrink-0 ${
                          t.status === 'open'
                            ? 'text-[#FF6B00]'
                            : 'text-emerald-400'
                        }`}
                      >
                        {t.status === 'open' ? 'مفتوحة' : 'مغلقة'}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-[#94A3B8] tabular-nums">
                      <span>{t.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{t.assignedToName || 'الدعم الفني'}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatArabicDateTime(t.lastUpdatedIso)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Chat Bubble Stream */}
          <div className="lg:col-span-7 flex flex-col rounded-2xl border border-[#334155] bg-[#0F172A] overflow-hidden min-h-[380px]">
            {selectedTicket ? (
              <>
                <div className="px-4 py-3 bg-[#1E293B] border-b border-[#334155] flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#F8FAFC] truncate">
                      {selectedTicket.subject}
                    </p>
                    <p className="text-xs text-[#94A3B8]">
                      {selectedTicket.category} · المسؤول:{' '}
                      {selectedTicket.assignedToName || 'فريق الدعم المركزي'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-xs font-bold whitespace-nowrap ${
                        selectedTicket.status === 'open'
                          ? 'text-[#FF6B00]'
                          : 'text-emerald-400'
                      }`}
                    >
                      {selectedTicket.status === 'open' ? 'محادثة نشطة' : 'تم الحل'}
                    </span>
                    {selectedTicket.status === 'open' && (
                      <button
                        type="button"
                        disabled={closingCustomerTicket}
                        onClick={handleCustomerCloseTicket}
                        className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold whitespace-nowrap cursor-pointer"
                      >
                        {closingCustomerTicket ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        <span>إغلاق التذكرة</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Automatic Waiting Banner until Admin / Agent replies */}
                {selectedTicket.status === 'open' &&
                  !selectedTicket.hasAdminReply && (
                    <div className="px-4 py-2.5 bg-amber-950/40 border-b border-amber-500/30 flex items-center gap-2 text-xs font-bold text-amber-200">
                      <Clock className="w-4 h-4 text-[#FF6B00] shrink-0" />
                      <span>جاري مراجعة مشكلتك، سيتم الرد قريباً</span>
                    </div>
                  )}

                <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[290px]">
                  {selectedTicket.attachmentImageUrl && (
                    <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-2.5 space-y-1.5">
                      <p className="text-[11px] font-bold text-[#94A3B8] flex items-center gap-1">
                        <Paperclip className="w-3 h-3 text-[#FF6B00]" />
                        <span>مرفق التذكرة</span>
                      </p>
                      <img
                        src={selectedTicket.attachmentImageUrl}
                        alt="مرفق التذكرة"
                        className="max-h-40 rounded-2xl object-contain border border-[#334155]"
                      />
                    </div>
                  )}

                  {selectedTicket.details &&
                    !messages.some(
                      (m) =>
                        m.senderRole === 'user' &&
                        m.text.trim() === selectedTicket.details.trim()
                    ) && (
                      <div className="flex justify-start">
                        <div className="max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-2.5 bg-[#FF6B00] text-white shadow-sm">
                          <p className="text-xs font-bold opacity-95 mb-0.5">
                            {selectedTicket.userName}
                          </p>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {selectedTicket.details}
                          </p>
                          <p className="mt-1 text-[11px] text-white/85 tabular-nums">
                            {formatArabicDateTime(selectedTicket.createdAtIso)}
                          </p>
                        </div>
                      </div>
                    )}

                  {messages.map((msg) => {
                    const isMine = msg.senderRole === 'user';
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${
                          isMine ? 'justify-start' : 'justify-end'
                        }`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm ${
                            isMine
                              ? 'rounded-tr-sm bg-[#FF6B00] text-white'
                              : 'rounded-tl-sm bg-[#1E293B] text-[#F8FAFC] border border-[#334155]'
                          }`}
                        >
                          <p
                            className={`text-[11px] font-bold mb-0.5 ${
                              isMine
                                ? 'text-white/90'
                                : 'text-[#FF6B00]'
                            }`}
                          >
                            {isMine ? 'أنت' : msg.senderName || 'الدعم الفني'}
                          </p>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {msg.text}
                          </p>
                          <p
                            className={`mt-1 text-[11px] tabular-nums ${
                              isMine
                                ? 'text-white/85'
                                : 'text-[#94A3B8]'
                            }`}
                          >
                            {formatArabicDateTime(msg.timestampIso)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>

                {selectedTicket.status === 'open' ? (
                  <form
                    onSubmit={handleSendUserMessage}
                    className="p-3 bg-[#1E293B] border-t border-[#334155] flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="اكتب رسالتك لفريق الدعم..."
                      maxLength={1500}
                      className="flex-1 min-h-[44px] px-3.5 py-2 rounded-2xl border border-[#334155] bg-[#0F172A] text-sm text-[#F8FAFC] placeholder:text-[#94A3B8]"
                    />
                    <button
                      type="submit"
                      disabled={sendingReply || !replyText.trim()}
                      className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-50 text-white text-sm font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {sendingReply ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      <span>إرسال</span>
                    </button>
                  </form>
                ) : (
                  <div className="px-4 py-3 bg-emerald-950/40 border-t border-emerald-500/30 text-center text-xs font-bold text-emerald-300">
                    تم إغلاق هذه التذكرة بنجاح — يمكنك فتح تذكرة جديدة إذا احتجت أي مساعدة أخرى.
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
};

/* ============================================================================
 * 2. PORTAL SUPPORT MODAL (For Store & Courier Portals)
 * ========================================================================== */

interface PortalSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserUid: string;
  userName: string;
  userPhone?: string;
  userEmail?: string;
  userRole: 'store' | 'courier';
  onNotify?: (msg: string) => void;
}

export const PortalSupportModal: React.FC<PortalSupportModalProps> = ({
  isOpen,
  onClose,
  currentUserUid,
  userName,
  userPhone,
  userEmail,
  userRole,
  onNotify,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="edkawi-modal-backdrop flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="الدعم الفني المباشر"
    >
      <div className="w-full max-w-4xl rounded-2xl bg-[#1E293B] border border-[#334155] shadow-2xl overflow-hidden my-auto max-h-[90dvh] flex flex-col">
        <div className="px-5 py-4 bg-[#1E293B] border-b border-[#334155] text-[#F8FAFC] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Headphones className="w-5 h-5 text-[#FF6B00]" />
            <h2 className="text-base sm:text-lg font-bold text-[#F8FAFC]">
              الدعم الفني المباشر — {userRole === 'store' ? 'بوابة التاجر' : 'بوابة الكابتن'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة الدعم"
            className="min-h-[44px] min-w-[44px] rounded-2xl text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#0F172A] flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto">
          <CustomerSupportSection
            currentUserUid={currentUserUid}
            isAnonymous={false}
            userName={userName}
            userPhone={userPhone}
            userEmail={userEmail}
            userRole={userRole}
            onNotify={onNotify}
          />
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 3. ADMIN & SUPPORT AGENT SPLIT-VIEW WORKSPACE (الدعم الفني)
 * ========================================================================== */

interface AdminSupportSplitWorkspaceProps {
  tickets: SupportTicketRecord[];
  currentActorUid: string;
  currentActorName: string;
  actorRole: 'admin' | 'support_agent';
  staffMembers?: StaffMemberRecord[];
  onNotify?: (msg: string) => void;
}

export const AdminSupportSplitWorkspace: React.FC<
  AdminSupportSplitWorkspaceProps
> = ({
  tickets,
  currentActorUid,
  currentActorName,
  actorRole,
  staffMembers = [],
  onNotify,
}) => {
  const [statusFilter, setStatusFilter] = useState<'open' | 'closed' | 'all'>(
    'open'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessageRecord[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [closingTicket, setClosingTicket] = useState(false);
  const [assigningAgent, setAssigningAgent] = useState(false);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const activeSupportAgents = useMemo(
    () =>
      staffMembers.filter(
        (m) => m.role === 'support_agent' && m.isActive !== false
      ),
    [staffMembers]
  );

  const filteredTickets = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        t.subject.toLowerCase().includes(q) ||
        t.userName.toLowerCase().includes(q) ||
        t.userPhone.includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    });
  }, [tickets, statusFilter, searchTerm]);

  useEffect(() => {
    setSelectedTicketId((prev) => {
      if (prev && filteredTickets.some((t) => t.id === prev)) return prev;
      return filteredTickets[0]?.id ?? null;
    });
  }, [filteredTickets]);

  const selectedTicket = useMemo(
    () =>
      tickets.find((t) => t.id === selectedTicketId) ??
      filteredTickets[0] ??
      null,
    [tickets, filteredTickets, selectedTicketId]
  );

  useEffect(() => {
    if (!selectedTicket || !currentActorUid) {
      setMessages([]);
      return;
    }
    const unsub = listenToSupportMessages(
      selectedTicket.id,
      currentActorUid,
      setMessages
    );
    return () => unsub();
  }, [selectedTicket?.id, currentActorUid]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, selectedTicket?.id]);

  const openCount = useMemo(
    () => tickets.filter((t) => t.status === 'open').length,
    [tickets]
  );
  const unansweredCount = useMemo(
    () =>
      tickets.filter((t) => t.status === 'open' && !t.hasAdminReply).length,
    [tickets]
  );

  const handleSendAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim() || sendingReply) return;
    setSendingReply(true);
    try {
      await sendSupportMessageInFirestore(
        selectedTicket,
        currentActorUid,
        currentActorName || 'الدعم الفني لإدكاوي',
        actorRole,
        replyText
      );
      setReplyText('');
    } catch (err) {
      onNotify?.(
        err instanceof Error ? err.message : 'تعذر إرسال الرد حالياً.'
      );
    } finally {
      setSendingReply(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!selectedTicket || closingTicket) return;
    setClosingTicket(true);
    try {
      await closeSupportTicketInFirestore(selectedTicket);
      onNotify?.(`تم إغلاق التذكرة «${selectedTicket.subject}» بنجاح.`);
    } catch (err) {
      onNotify?.(
        err instanceof Error ? err.message : 'تعذر إغلاق التذكرة حالياً.'
      );
    } finally {
      setClosingTicket(false);
    }
  };

  const handleAssignAgent = async (agentId: string) => {
    if (!selectedTicket || actorRole !== 'admin') return;
    setAssigningAgent(true);
    try {
      const chosen =
        activeSupportAgents.find((a) => a.id === agentId) ?? null;
      await assignSupportTicketByAdminInFirestore(
        selectedTicket,
        chosen ? { id: chosen.id, name: chosen.name } : null,
        currentActorUid
      );
      onNotify?.(
        chosen
          ? `تم تحويل التذكرة إلى مسؤول الدعم: ${chosen.name}`
          : 'تم تحويل التذكرة إلى فريق الدعم المركزي'
      );
    } catch (err) {
      onNotify?.(
        err instanceof Error ? err.message : 'تعذر تعديل مسؤول الدعم حالياً.'
      );
    } finally {
      setAssigningAgent(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Filter & Summary Toolbar */}
      <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-[#0F172A] border border-[#334155]">
            {(
              [
                { id: 'open', label: `مفتوحة (${openCount})` },
                {
                  id: 'closed',
                  label: `مغلقة (${tickets.length - openCount})`,
                },
                { id: 'all', label: `الكل (${tickets.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-2xl text-xs font-bold whitespace-nowrap shrink-0 transition-colors tabular-nums cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-[#FF6B00] text-white shadow-sm'
                    : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {unansweredCount > 0 && (
            <span className="text-xs font-bold text-[#FF6B00] tabular-nums">
              {unansweredCount} بانتظار أول رد فوري
            </span>
          )}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-[#94A3B8] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث باسم المستخدم أو الهاتف أو الموضوع..."
            className="w-full min-h-[42px] pr-10 pl-3.5 py-2 rounded-2xl border border-[#334155] bg-[#0F172A] text-xs sm:text-sm text-[#F8FAFC] placeholder:text-[#94A3B8]"
          />
        </div>
      </div>

      {/* Split-View Workspace: Right (Queue + User Details) | Left (Live Chat) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Right Column (RTL First): Ticket Queue + User & Problem Details */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-4 space-y-2.5 max-h-[340px] overflow-y-auto">
            <h3 className="text-xs font-bold text-[#94A3B8]">
              قائمة التذاكر ({filteredTickets.length})
            </h3>
            {filteredTickets.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#94A3B8]">
                لا توجد تذاكر مطابقة للفلتر الحالي.
              </p>
            ) : (
              filteredTickets.map((ticket) => {
                const isSelected = ticket.id === selectedTicket?.id;
                const isUrgentOpen =
                  ticket.status === 'open' && !ticket.hasAdminReply;
                const isSlaOverdue =
                  ticket.status === 'open' &&
                  Boolean(ticket.slaDeadlineIso) &&
                  Date.now() > Date.parse(ticket.slaDeadlineIso || '');
                return (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => setSelectedTicketId(ticket.id)}
                    className={`w-full text-right p-3.5 rounded-2xl border transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-[#FF6B00] bg-[#FF6B00]/10'
                        : isSlaOverdue
                        ? 'border-rose-500/50 bg-rose-950/30'
                        : isUrgentOpen
                        ? 'border-amber-500/40 bg-amber-950/25'
                        : 'border-[#334155] bg-[#0F172A] hover:border-[#FF6B00]/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-bold text-[#F8FAFC] line-clamp-1">
                        {ticket.subject}
                      </span>
                      <span
                        className={`text-xs font-bold whitespace-nowrap shrink-0 ${
                          isSlaOverdue
                            ? 'text-rose-400'
                            : isUrgentOpen
                            ? 'text-[#FF6B00]'
                            : ticket.status === 'open'
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {isSlaOverdue
                          ? 'تجاوز SLA'
                          : isUrgentOpen
                          ? 'جديدة · بدون رد'
                          : ticket.status === 'open'
                          ? 'مفتوحة'
                          : 'مغلقة'}
                      </span>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-[#94A3B8] tabular-nums">
                      <span>{ticket.userName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{getUserRoleLabel(ticket.userRole)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{ticket.category}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Selected Ticket User & Problem Details Card */}
          {selectedTicket && (
            <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-base font-bold text-[#F8FAFC]">
                    {selectedTicket.userName}
                  </h4>
                  <p className="mt-0.5 text-xs text-[#94A3B8]">
                    {getUserRoleLabel(selectedTicket.userRole)} · نوع المشكلة:{' '}
                    {selectedTicket.category}
                  </p>
                </div>

                {selectedTicket.status === 'open' ? (
                  <button
                    type="button"
                    disabled={closingTicket}
                    onClick={handleCloseTicket}
                    className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {closingTicket ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>إغلاق التذكرة</span>
                  </button>
                ) : (
                  <span className="text-xs font-bold text-emerald-400">
                    تم إغلاق التذكرة
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-[#F8FAFC] tabular-nums">
                {selectedTicket.userPhone ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[#FF6B00]" />
                    <span dir="ltr">{selectedTicket.userPhone}</span>
                  </span>
                ) : (
                  <span className="text-[#94A3B8]">
                    بدون رقم هاتف مسجل
                  </span>
                )}
                <span aria-hidden="true">·</span>
                <span className="text-[#94A3B8]">
                  فتحت: {formatArabicDateTime(selectedTicket.createdAtIso)}
                </span>
              </div>

              {selectedTicket.slaDeadlineIso && selectedTicket.status === 'open' && (
                <div
                  className={`rounded-2xl px-3.5 py-2 text-xs font-bold border flex items-center gap-2 ${
                    Date.now() > Date.parse(selectedTicket.slaDeadlineIso)
                      ? 'bg-rose-950/50 border-rose-500/40 text-rose-200'
                      : 'bg-amber-950/40 border-amber-500/30 text-amber-200'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    {Date.now() > Date.parse(selectedTicket.slaDeadlineIso)
                      ? `متأخرة عن مهلة الاستجابة (SLA): ${formatArabicDateTime(selectedTicket.slaDeadlineIso)}`
                      : `الموعد المستهدف للاستجابة (SLA): ${formatArabicDateTime(selectedTicket.slaDeadlineIso)}`}
                  </span>
                </div>
              )}

              <div className="rounded-2xl bg-[#0F172A] p-3.5 border border-[#334155]">
                <p className="text-xs font-bold text-[#94A3B8] mb-1">
                  تفاصيل الشكوى الأساسية:
                </p>
                <p className="text-sm text-[#F8FAFC] leading-relaxed whitespace-pre-wrap">
                  {selectedTicket.details || selectedTicket.subject}
                </p>
              </div>

              {selectedTicket.attachmentImageUrl && (
                <div className="rounded-2xl bg-[#0F172A] p-3 border border-[#334155] space-y-2">
                  <p className="text-xs font-bold text-[#94A3B8] flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-[#FF6B00]" />
                    <span>مرفق العميل (اضغط للتكبير)</span>
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxImageUrl(selectedTicket.attachmentImageUrl || null)
                    }
                    className="block w-full overflow-hidden rounded-2xl border border-[#334155] cursor-pointer"
                  >
                    <img
                      src={selectedTicket.attachmentImageUrl}
                      alt="مرفق الشكوى"
                      className="w-full max-h-40 object-cover"
                    />
                  </button>
                </div>
              )}

              {actorRole === 'admin' && (
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-[#F8FAFC] mb-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-[#FF6B00]" />
                    <span>مسؤول الدعم المعين (توزيع تلقائي مع تعديل يدوي)</span>
                  </label>
                  <select
                    disabled={assigningAgent}
                    value={selectedTicket.assignedTo || ''}
                    onChange={(e) => handleAssignAgent(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-2xl border border-[#334155] bg-[#0F172A] text-xs sm:text-sm text-[#F8FAFC]"
                  >
                    <option value="">فريق الدعم المركزي (الإدارة العامة)</option>
                    {activeSupportAgents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name} ({agent.openTicketCount} تذكرة مفتوحة)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Left Column (RTL Second): Live Real-Time Chat Stream */}
        <div className="lg:col-span-7 rounded-2xl border border-[#334155] bg-[#1E293B] flex flex-col overflow-hidden min-h-[480px]">
          {selectedTicket ? (
            <>
              <div className="px-5 py-3.5 bg-[#1E293B] border-b border-[#334155] text-[#F8FAFC] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-[#F8FAFC] truncate">
                    محادثة فورية: {selectedTicket.subject}
                  </h3>
                  <p className="text-xs text-[#94A3B8]">
                    مع {selectedTicket.userName} ({getUserRoleLabel(selectedTicket.userRole)})
                  </p>
                </div>
                <span className="text-xs font-bold text-[#FF6B00] whitespace-nowrap shrink-0">
                  مباشر الآن
                </span>
              </div>

              <div className="flex-1 p-4 sm:p-5 space-y-3 overflow-y-auto bg-[#0F172A] max-h-[420px]">
                {selectedTicket.details &&
                  !messages.some(
                    (m) =>
                      m.senderRole === 'user' &&
                      m.text.trim() === selectedTicket.details.trim()
                  ) && (
                    <div className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3 bg-[#1E293B] text-[#F8FAFC] border border-[#334155] shadow-sm">
                        <p className="text-xs font-bold text-[#FF6B00] mb-1">
                          {selectedTicket.userName}
                        </p>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {selectedTicket.details}
                        </p>
                        <p className="mt-1 text-[11px] text-[#94A3B8] tabular-nums">
                          {formatArabicDateTime(selectedTicket.createdAtIso)}
                        </p>
                      </div>
                    </div>
                  )}

                {messages.map((msg) => {
                  const isStaffMsg = msg.senderRole !== 'user';
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${
                        isStaffMsg ? 'justify-start' : 'justify-end'
                      }`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm ${
                          isStaffMsg
                            ? 'rounded-tr-sm bg-[#FF6B00] text-white'
                            : 'rounded-tl-sm bg-[#1E293B] text-[#F8FAFC] border border-[#334155]'
                        }`}
                      >
                        <p
                          className={`text-[11px] font-bold mb-0.5 ${
                            isStaffMsg ? 'text-white/90' : 'text-[#FF6B00]'
                          }`}
                        >
                          {msg.senderName}
                        </p>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {msg.text}
                        </p>
                        <p
                          className={`mt-1 text-[11px] tabular-nums ${
                            isStaffMsg
                              ? 'text-white/85'
                              : 'text-[#94A3B8]'
                          }`}
                        >
                          {formatArabicDateTime(msg.timestampIso)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              {/* Canned Responses Quick-Fill Chips */}
              <div className="px-3.5 pt-2.5 pb-1 bg-[#1E293B] border-t border-[#334155] flex flex-wrap items-center gap-1.5">
                {CANNED_SUPPORT_REPLIES.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setReplyText(preset)}
                    className="px-2.5 py-1 rounded-2xl border border-[#334155] bg-[#0F172A] hover:border-[#FF6B00] text-[11px] font-semibold text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <form
                onSubmit={handleSendAdminReply}
                className="p-3.5 bg-[#1E293B] flex items-center gap-2.5"
              >
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="اكتب رد الدعم الفني ليظهر للمستخدم في نفس اللحظة..."
                  maxLength={1500}
                  className="flex-1 min-h-[44px] px-4 py-2.5 rounded-2xl border border-[#334155] bg-[#0F172A] text-sm text-[#F8FAFC] placeholder:text-[#94A3B8]"
                />
                <button
                  type="submit"
                  disabled={sendingReply || !replyText.trim()}
                  className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-50 text-white text-sm font-bold inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {sendingReply ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>إرسال الرد</span>
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <Headphones className="w-10 h-10 text-[#94A3B8] mb-3" />
              <p className="text-base font-bold text-[#F8FAFC]">
                اختر تذكرة دعم من القائمة اليمنى لبدء المحادثة الفورية
              </p>
              <p className="mt-1 text-xs text-[#94A3B8]">
                جميع الرسائل تتحدث لحظياً بدون الحاجة لإعادة تحميل الصفحة.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Attachment Lightbox */}
      {lightboxImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
          onClick={() => setLightboxImageUrl(null)}
        >
          <div
            className="max-w-2xl w-full rounded-2xl bg-[#1E293B] border border-[#334155] p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[#F8FAFC]">معاينة مرفق التذكرة</span>
              <button
                type="button"
                onClick={() => setLightboxImageUrl(null)}
                className="min-h-[36px] min-w-[36px] rounded-2xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={lightboxImageUrl}
              alt="مرفق التذكرة"
              className="w-full max-h-[75vh] object-contain rounded-2xl bg-[#0F172A]"
            />
          </div>
        </div>
      )}
    </div>
  );
};
