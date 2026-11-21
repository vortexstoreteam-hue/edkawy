import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { CartItem } from '../types/edkawi';
import {
  calculateCartTotals,
  formatArabicCartCount,
} from '../utils/orderLogic';

interface FloatingCartBarProps {
  cart: CartItem[];
  onOpenCart: () => void;
}

export function FloatingCartBar({ cart, onOpenCart }: FloatingCartBarProps) {
  if (cart.length === 0) return null;

  const totals = calculateCartTotals(cart);

  return (
    <div
      role="region"
      aria-label="ملخص السلة العائم"
      className="fixed bottom-[4.5rem] md:bottom-5 inset-x-3 sm:inset-x-6 z-40 pointer-events-none edkawi-page-enter"
    >
      <div className="max-w-3xl mx-auto pointer-events-auto rounded-2xl bg-[#1E293B] text-[#F8FAFC] border border-[#334155] shadow-[0_18px_42px_-10px_rgba(15,23,42,0.55)] px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-2xl bg-[#FF6B00] text-white flex items-center justify-center font-mono font-bold text-xs sm:text-sm tabular-nums shrink-0">
            {totals.itemCount}
          </span>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-bold text-[#F8FAFC] truncate">
              <span>{formatArabicCartCount(totals.itemCount)}</span>{' '}
              <span className="hidden sm:inline text-[#94A3B8] font-normal">
                · {cart[0].storeName}
              </span>
            </p>
            <p className="text-[11px] sm:text-xs text-[#94A3B8] truncate">
              الإجمالي شامل التوصيل:{' '}
              <span className="font-mono font-bold text-[#F8FAFC] tabular-nums">
                {totals.totalAmount}
              </span>{' '}
              ج.م
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenCart}
          className="min-h-[40px] py-2 sm:py-2.5 px-4 sm:px-5 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] active:scale-[0.97] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <ShoppingBag className="w-4 h-4 text-white" aria-hidden="true" />
          <span>عرض السلة</span>
          <ArrowLeft className="w-3.5 h-3.5 text-white" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
