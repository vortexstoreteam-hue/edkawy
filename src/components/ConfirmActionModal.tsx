import React from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';

interface ConfirmActionModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  warningNote?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'warning' | 'primary';
  isProcessing?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  isOpen,
  title,
  description,
  warningNote,
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  tone = 'danger',
  isProcessing = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const confirmBtnClass =
    tone === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : tone === 'warning'
      ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
      : 'bg-[#FF6B00] hover:bg-[#E55F00] text-white';

  const iconWrapClass =
    tone === 'danger'
      ? 'bg-red-950/60 border-red-500/40 text-red-400'
      : tone === 'warning'
      ? 'bg-amber-950/60 border-amber-500/40 text-amber-400'
      : 'bg-[#FF6B00]/15 border-[#FF6B00]/40 text-[#FF6B00]';

  return (
    <div
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="edkawi-modal-backdrop flex items-center justify-center p-4"
      onClick={() => {
        if (!isProcessing) onCancel();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-[#1E293B] border border-[#334155] shadow-2xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${iconWrapClass}`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-[#F8FAFC] leading-snug">
              {title}
            </h2>
          </div>
          <button
            type="button"
            disabled={isProcessing}
            onClick={onCancel}
            aria-label="إغلاق"
            className="min-h-[38px] min-w-[38px] rounded-2xl border border-[#334155] bg-[#0F172A] text-[#94A3B8] hover:text-[#F8FAFC] flex items-center justify-center cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-[#94A3B8] leading-relaxed">{description}</p>

        {warningNote && (
          <div
            role="alert"
            className="rounded-2xl bg-amber-950/40 border border-amber-500/40 px-4 py-3 text-xs font-semibold text-amber-200 leading-relaxed"
          >
            {warningNote}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            disabled={isProcessing}
            onClick={onCancel}
            className="min-h-[44px] px-4 py-2 rounded-2xl border border-[#334155] bg-[#0F172A] hover:border-[#FF6B00] text-[#F8FAFC] text-sm font-bold cursor-pointer disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => void onConfirm()}
            className={`min-h-[44px] px-5 py-2 rounded-2xl text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 ${confirmBtnClass}`}
          >
            {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
