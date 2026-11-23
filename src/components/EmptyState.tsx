import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      dir="rtl"
      className={`rounded-2xl bg-[#1E293B] border border-[#334155] p-6 sm:p-10 text-center space-y-4 ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-[#10192D] border border-[#334155] text-[#FF7100] flex items-center justify-center mx-auto">
        <Icon className="w-7 h-7" />
      </div>
      <div className="space-y-1.5 max-w-md mx-auto">
        <h3 className="text-base sm:text-lg font-bold text-[#F8FAFC]">{title}</h3>
        {description && (
          <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="min-h-[44px] px-6 py-2.5 rounded-2xl bg-[#FF7100] hover:bg-[#E66600] text-white text-sm font-bold inline-flex items-center justify-center cursor-pointer active:scale-[0.98]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
