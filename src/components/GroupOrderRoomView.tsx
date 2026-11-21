import React, { useEffect, useState, useMemo } from 'react';
import {
  Users,
  Send,
  MessageSquare,
  ShoppingBag,
  Calculator,
  Copy,
  Check,
  ArrowRight,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import {
  SharedCartItemEntry,
  SharedCartRecord,
  UserProfileRecord,
} from '../types/edkawi';
import {
  listenToSharedCartByRoomCode,
  sendSharedCartChatMessage,
} from '../services/edkawiFirebaseService';

interface GroupOrderRoomViewProps {
  roomCode: string;
  currentUser: UserProfileRecord | null;
  onBackToHome: () => void;
  onProceedToCheckout?: (cart: SharedCartRecord) => void;
}

export const GroupOrderRoomView: React.FC<GroupOrderRoomViewProps> = ({
  roomCode,
  currentUser,
  onBackToHome,
  onProceedToCheckout,
}) => {
  const [cart, setCart] = useState<SharedCartRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [showSplitBill, setShowSplitBill] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const myUid = currentUser?.uid || 'guest';
  const myName = currentUser?.name || 'أنا';

  useEffect(() => {
    if (!roomCode) return;
    setLoading(true);
    const unsubscribe = listenToSharedCartByRoomCode(roomCode, (updatedCart) => {
      setCart(updatedCart);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [roomCode]);

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart || !chatInput.trim()) return;
    try {
      await sendSharedCartChatMessage(cart.id, {
        senderUid: myUid,
        senderName: myName,
        text: chatInput.trim(),
      });
      setChatInput('');
    } catch (err: any) {
      setErrorMsg(err?.message || 'تعذر إرسال الرسالة');
    }
  };

  // Group items by participant
  const itemsByParticipant = useMemo(() => {
    const map = new Map<string, SharedCartItemEntry[]>();
    if (!cart) return map;
    for (const item of cart.items) {
      const list = map.get(item.participantUid) || [];
      list.push(item);
      map.set(item.participantUid, list);
    }
    return map;
  }, [cart]);

  // Split bill breakdown
  const splitBreakdown = useMemo(() => {
    if (!cart || cart.items.length === 0) return [];
    const participants = Array.from(itemsByParticipant.entries());
    const sharedFees = cart.storeDeliveryFee;
    const perPersonFee =
      participants.length > 0 ? Math.round(sharedFees / participants.length) : 0;

    return participants.map(([uid, items]) => {
      const pName = items[0]?.participantName || 'مشارك';
      const myItemsCost = items.reduce(
        (acc: number, i: SharedCartItemEntry) => acc + i.price * i.quantity,
        0
      );
      const totalOwed = myItemsCost + perPersonFee;
      return {
        uid,
        name: pName,
        itemsCount: items.reduce(
          (acc: number, i: SharedCartItemEntry) => acc + i.quantity,
          0
        ),
        itemsCost: myItemsCost,
        feeShare: perPersonFee,
        totalOwed,
      };
    });
  }, [cart, itemsByParticipant]);

  const totalAmount = useMemo(() => {
    if (!cart) return 0;
    const sub = cart.items.reduce((acc, i) => acc + i.price * i.quantity, 0);
    return sub + cart.storeDeliveryFee;
  }, [cart]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-[#F8FAFC] flex items-center justify-center font-['Cairo',sans-serif] dir-rtl" dir="rtl">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-[#FF6B00] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-[#94A3B8]">جاري تحميل غرفة سلة الشلة ({roomCode})...</p>
        </div>
      </div>
    );
  }

  if (!cart) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-[#F8FAFC] flex flex-col items-center justify-center p-4 font-['Cairo',sans-serif] dir-rtl" dir="rtl">
        <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-6 text-center max-w-md space-y-4">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-xl font-bold">لم يتم العثور على الغرفة!</h2>
          <p className="text-sm text-[#94A3B8]">
            رمز الغرفة <span className="font-mono text-[#FF6B00] font-bold">{roomCode}</span> غير صحيح أو انتهت صلاحيته.
          </p>
          <button
            onClick={onBackToHome}
            className="w-full py-3 bg-[#FF6B00] text-white font-bold rounded-xl shadow-lg shadow-[#FF6B00]/20 text-sm"
          >
            العودة للرئيسية
          </button>
        </div>
      </div>
    );
  }

  const isHost = cart.hostUid === myUid;

  return (
    <div className="min-h-screen bg-[#0F172A] text-[#F8FAFC] p-4 flex flex-col font-['Cairo',sans-serif] dir-rtl" dir="rtl">
      {/* Top Header */}
      <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-4 mb-4 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FF6B00]/20 text-[#FF6B00] flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-[#F8FAFC]">سلة الشلة - {cart.storeName}</h1>
              <span className="bg-[#FF6B00]/20 text-[#FF6B00] text-xs font-mono font-bold px-2 py-0.5 rounded-lg border border-[#FF6B00]/30">
                {cart.roomCode}
              </span>
            </div>
            <p className="text-xs text-[#94A3B8]">مؤسس الغرفة: {cart.hostName} {isHost && ' (أنت)'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 text-xs bg-[#0F172A] hover:bg-[#0F172A]/80 border border-[#334155] text-[#94A3B8] px-3 py-2 rounded-xl transition"
            title="نسخ الرابط"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span className="hidden sm:inline">{copied ? 'تم النسخ!' : 'مشاركة'}</span>
          </button>
          <button
            onClick={onBackToHome}
            className="text-xs text-[#94A3B8] hover:text-[#F8FAFC] bg-[#0F172A] border border-[#334155] px-3 py-2 rounded-xl transition"
          >
            خروج
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl p-3 mb-4 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Split View Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
        {/* Top / Left Section: Shared Cart Items (7 cols) */}
        <div className="lg:col-span-7 flex flex-col bg-[#1E293B] border border-[#334155] rounded-2xl p-4 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#334155]">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-[#FF6B00]" />
              <h2 className="text-sm font-bold text-[#F8FAFC]">محتويات السلة الجماعية ({cart.items.length})</h2>
            </div>
            <button
              onClick={() => setShowSplitBill(!showSplitBill)}
              className="flex items-center gap-1.5 text-xs bg-[#FF6B00]/10 hover:bg-[#FF6B00]/20 text-[#FF6B00] border border-[#FF6B00]/30 px-3 py-1.5 rounded-xl transition font-medium"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>تقسيم الحساب</span>
            </button>
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto space-y-3 max-h-[380px] pr-1">
            {cart.items.length === 0 ? (
              <div className="text-center py-12 text-[#94A3B8] space-y-2">
                <ShoppingBag className="w-10 h-10 mx-auto opacity-40 text-[#94A3B8]" />
                <p className="text-sm">السلة فارغة حالياً</p>
                <p className="text-xs">شارك رمز الغرفة مع أصدقائك ليبدأ الجميع بإضافة طلباتهم!</p>
              </div>
            ) : (
              cart.items.map((item) => (
                <div
                  key={item.entryId}
                  className="bg-[#0F172A] border border-[#334155] rounded-xl p-3 flex items-center justify-between gap-3 shadow-sm"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#F8FAFC]">{item.name}</span>
                      <span className="text-[10px] bg-[#334155] text-[#94A3B8] px-2 py-0.5 rounded-md font-normal">
                        طلب {item.participantName}
                      </span>
                    </div>
                    <div className="text-xs text-[#FF6B00] font-mono font-bold">
                      {item.price} ج.م × {item.quantity} = {item.price * item.quantity} ج.م
                    </div>
                  </div>

                  {cart.status === 'open' && (
                    <div className="flex items-center gap-2 bg-[#1E293B] border border-[#334155] rounded-lg px-2 py-1">
                      <span className="text-xs font-mono font-bold text-[#F8FAFC] px-1">{item.quantity}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Cart Summary & Checkout */}
          <div className="pt-3 border-t border-[#334155] space-y-2">
            <div className="flex justify-between text-xs text-[#94A3B8]">
              <span>قيمة الأصناف:</span>
              <span className="font-mono text-[#F8FAFC]">
                {cart.items.reduce((acc, i) => acc + i.price * i.quantity, 0)} ج.م
              </span>
            </div>
            <div className="flex justify-between text-xs text-[#94A3B8]">
              <span>رسوم التوصيل الموحدة:</span>
              <span className="font-mono text-[#F8FAFC]">{cart.storeDeliveryFee} ج.م</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-[#F8FAFC] pt-1 border-t border-[#334155]/60">
              <span>الإجمالي الكلي:</span>
              <span className="font-mono text-[#FF6B00] text-base">{totalAmount} ج.م</span>
            </div>

            {isHost && cart.status === 'open' && (
              <button
                onClick={() => onProceedToCheckout && onProceedToCheckout(cart)}
                disabled={cart.items.length === 0}
                className="w-full mt-2 py-3 bg-[#FF6B00] hover:bg-[#FF6B00]/90 disabled:opacity-40 text-white font-bold rounded-xl transition duration-200 flex items-center justify-center gap-2 text-sm shadow-lg shadow-[#FF6B00]/20"
              >
                <span>متابعة إتمام الطلب كمسؤول الغرفة</span>
                <ArrowRight className="w-4 h-4 transform rotate-180" />
              </button>
            )}
          </div>
        </div>

        {/* Bottom / Right Section: Live Chat & Split Bill (5 cols) */}
        <div className="lg:col-span-5 flex flex-col bg-[#1E293B] border border-[#334155] rounded-2xl p-4 shadow-xl space-y-4">
          {showSplitBill ? (
            /* Split Bill Calculator View */
            <div className="flex flex-col h-full space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-[#334155]">
                <div className="flex items-center gap-2 text-sm font-bold text-[#F8FAFC]">
                  <Calculator className="w-4 h-4 text-[#FF6B00]" />
                  <span>حساب كل فرد (Split Bill)</span>
                </div>
                <button
                  onClick={() => setShowSplitBill(false)}
                  className="text-xs text-[#94A3B8] hover:text-[#F8FAFC]"
                >
                  العودة للدردشة
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[380px] pr-1">
                {splitBreakdown.length === 0 ? (
                  <p className="text-center text-xs text-[#94A3B8] py-8">لا توجد طلبات لحسابها بعد</p>
                ) : (
                  splitBreakdown.map((member) => (
                    <div
                      key={member.uid}
                      className="bg-[#0F172A] border border-[#334155] rounded-xl p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#F8FAFC]">{member.name}</span>
                        <span className="text-xs font-mono font-bold text-[#FF6B00]">
                          {member.totalOwed} ج.م
                        </span>
                      </div>
                      <div className="text-[11px] text-[#94A3B8] flex justify-between">
                        <span>أصنافه: {member.itemsCost} ج.م ({member.itemsCount} صنف)</span>
                        <span>نصيبه من التوصيل: {member.feeShare} ج.م</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* Live Chat View */
            <div className="flex flex-col h-full space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#334155]">
                <div className="flex items-center gap-2 text-sm font-bold text-[#F8FAFC]">
                  <MessageSquare className="w-4 h-4 text-[#FF6B00]" />
                  <span>شات الغرفة اللحظي</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[#94A3B8]">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>مباشر</span>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[340px] pr-1 text-xs">
                {(!cart.chatMessages || cart.chatMessages.length === 0) ? (
                  <div className="text-center py-10 text-[#94A3B8] space-y-1">
                    <Sparkles className="w-6 h-6 mx-auto text-[#FF6B00]/40" />
                    <p>دردش مع أصحابك ونسقوا الطلب مع بعض!</p>
                  </div>
                ) : (
                  cart.chatMessages.map((msg) => {
                    const isMe = msg.senderUid === myUid;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div className="text-[10px] text-[#94A3B8] mb-0.5 px-1">{msg.senderName}</div>
                        <div
                          className={`rounded-2xl px-3 py-2 max-w-[85%] break-words ${
                            isMe
                              ? 'bg-[#FF6B00] text-white rounded-bl-sm'
                              : 'bg-[#0F172A] border border-[#334155] text-[#F8FAFC] rounded-br-sm'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendMessage} className="flex gap-2 pt-2 border-t border-[#334155]">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="اكتب رسالة لأصحابك..."
                  className="flex-1 bg-[#0F172A] border border-[#334155] focus:border-[#FF6B00] rounded-xl px-3 py-2 text-xs text-[#F8FAFC] outline-none transition"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="bg-[#FF6B00] hover:bg-[#FF6B00]/90 disabled:opacity-40 text-white p-2.5 rounded-xl transition"
                >
                  <Send className="w-4 h-4 transform rotate-180" />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
