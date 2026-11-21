import { Bell, User as UserIcon } from 'lucide-react';
import { ActiveView, PortalRole } from '../types/edkawi';
import { AdkawyLogo } from './AdkawyLogo';

interface NavbarProps {
  activePortal: PortalRole;
  activeCustomerView: ActiveView;
  onNavigateCustomerView: (view: ActiveView) => void;
  cartItemCount: number;
  customerOrdersCount: number;
  unreadNotificationsCount?: number;
  onOpenNotifications?: () => void;
  isAuthenticated: boolean;
  isGuestCustomer?: boolean;
  userName?: string;
  onPrimaryAction: () => void;
}

export function Navbar({
  activePortal,
  activeCustomerView,
  onNavigateCustomerView,
  cartItemCount,
  customerOrdersCount,
  unreadNotificationsCount = 0,
  onOpenNotifications,
  isAuthenticated,
  isGuestCustomer = false,
  userName,
  onPrimaryAction,
}: NavbarProps) {
  function handleBrandClick() {
    if (isAuthenticated && activePortal === 'customer') {
      onNavigateCustomerView('stores');
    }
  }

  return (
    <header className="sticky top-0 z-40 bg-[#0F172A]/95 backdrop-blur-md border-b border-[#334155] text-[#F8FAFC] w-full shadow-lg shadow-black/20">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 sm:gap-8 px-4 sm:px-6 lg:px-8 h-16 min-w-0">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            handleBrandClick();
          }}
          aria-label="إدكاوي Edkawy - الصفحة الرئيسية"
          className="whitespace-nowrap shrink-0 hover:opacity-90 active:scale-[0.98]"
        >
          <AdkawyLogo variant="navbar" />
        </a>

        {!isAuthenticated ? (
          <nav
            aria-label="التنقل الرئيسي"
            className="hidden sm:flex items-center gap-4 text-sm font-bold text-[#94A3B8] min-w-0"
          >
            <span className="py-2 border-b-2 border-[#FF6B00] text-[#F8FAFC] truncate whitespace-nowrap">
              منصة إدكاوي · مدينة إدكو
            </span>
          </nav>
        ) : activePortal === 'customer' ? (
          <nav
            aria-label="أقسام واجهة العميل"
            className="hidden md:flex items-center gap-6 text-sm font-bold text-[#94A3B8]"
          >
            <button
              type="button"
              onClick={() => onNavigateCustomerView('stores')}
              aria-current={
                activeCustomerView === 'stores' ||
                activeCustomerView === 'store_menu'
                  ? 'page'
                  : undefined
              }
              className={`relative py-2 border-b-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                activeCustomerView === 'stores' ||
                activeCustomerView === 'store_menu'
                  ? 'border-[#FF6B00] text-[#F8FAFC]'
                  : 'border-transparent hover:text-[#F8FAFC]'
              }`}
            >
              الرئيسية
            </button>

            <button
              type="button"
              onClick={() => onNavigateCustomerView('cart')}
              aria-current={
                activeCustomerView === 'cart' ||
                activeCustomerView === 'checkout'
                  ? 'page'
                  : undefined
              }
              className={`relative py-2 border-b-2 whitespace-nowrap shrink-0 cursor-pointer tabular-nums transition-colors ${
                activeCustomerView === 'cart' ||
                activeCustomerView === 'checkout'
                  ? 'border-[#FF6B00] text-[#F8FAFC]'
                  : 'border-transparent hover:text-[#F8FAFC]'
              }`}
            >
              {cartItemCount > 0 ? `السلة (${cartItemCount})` : 'السلة'}
            </button>

            <button
              type="button"
              onClick={() => onNavigateCustomerView('orders')}
              aria-current={
                activeCustomerView === 'orders' ||
                activeCustomerView === 'tracking'
                  ? 'page'
                  : undefined
              }
              className={`relative py-2 border-b-2 whitespace-nowrap shrink-0 cursor-pointer tabular-nums transition-colors ${
                activeCustomerView === 'orders' ||
                activeCustomerView === 'tracking'
                  ? 'border-[#FF6B00] text-[#F8FAFC]'
                  : 'border-transparent hover:text-[#F8FAFC]'
              }`}
            >
              {customerOrdersCount > 0
                ? `طلباتي (${customerOrdersCount})`
                : 'طلباتي'}
            </button>

            <button
              type="button"
              onClick={() => onNavigateCustomerView('account')}
              aria-current={
                activeCustomerView === 'account' ? 'page' : undefined
              }
              className={`relative py-2 border-b-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                activeCustomerView === 'account'
                  ? 'border-[#FF6B00] text-[#F8FAFC]'
                  : 'border-transparent hover:text-[#F8FAFC]'
              }`}
            >
              حسابي
            </button>
          </nav>
        ) : (
          <nav
            aria-label="التنقل داخل البوابة"
            className="hidden sm:flex items-center gap-3 text-sm font-bold text-[#94A3B8] min-w-0"
          >
            <span className="py-2 border-b-2 border-[#FF6B00] text-[#F8FAFC] truncate whitespace-nowrap">
              {activePortal === 'admin'
                ? 'لوحة تحكم الإدارة — إدكاوي'
                : activePortal === 'store'
                ? 'لوحة تحكم المتجر — إدكاوي'
                : 'بوابة كابتن التوصيل — إدكاوي'}
            </span>
          </nav>
        )}

        <div className="flex items-center gap-2 shrink-0">
          {isAuthenticated && activePortal === 'customer' && (
            <button
              type="button"
              onClick={() => onNavigateCustomerView('account')}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-[#1E293B] border border-[#334155] hover:border-[#FF6B00] text-xs font-bold text-[#F8FAFC] cursor-pointer whitespace-nowrap max-w-[170px]"
            >
              <UserIcon className="w-4 h-4 text-[#FF6B00] shrink-0" />
              <span className="truncate">
                {isGuestCustomer ? 'حساب ضيف' : userName?.trim() || 'حسابي'}
              </span>
            </button>
          )}

          {isAuthenticated && onOpenNotifications && (
            <button
              type="button"
              onClick={onOpenNotifications}
              aria-label="الإشعارات"
              className="relative min-h-[42px] min-w-[42px] rounded-2xl border border-[#334155] bg-[#1E293B] flex items-center justify-center text-[#F8FAFC] hover:border-[#FF6B00] hover:text-[#FF6B00] cursor-pointer transition-colors shrink-0"
            >
              <Bell className="w-4 h-4 text-[#FF6B00]" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF6B00] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {unreadNotificationsCount > 99
                    ? '99+'
                    : unreadNotificationsCount}
                </span>
              )}
            </button>
          )}

          {isAuthenticated && (
            <button
              type="button"
              onClick={onPrimaryAction}
              className={`min-h-[42px] px-4 py-2 text-xs sm:text-sm font-bold rounded-2xl whitespace-nowrap shrink-0 cursor-pointer active:scale-[0.97] transition-colors ${
                !isGuestCustomer
                  ? 'bg-[#1E293B] border border-[#334155] text-[#F8FAFC] hover:border-[#FF6B00]'
                  : 'bg-[#FF6B00] text-white hover:bg-[#E55F00]'
              }`}
            >
              {isGuestCustomer ? 'دخول' : 'خروج'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
