import React, { useState } from 'react';
import { Download, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'card';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'compact',
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (!isInstallable && !isIOS) {
    return null;
  }

  const handleAction = () => {
    if (isInstallable) {
      void install();
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  return (
    <>
      {variant === 'card' ? (
        <div
          dir="rtl"
          className={`rounded-2xl bg-[#1E293B] border border-[#334155] p-4 flex flex-wrap items-center justify-between gap-3 ${className}`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-[#0F172A] border border-[#334155] flex items-center justify-center shrink-0">
              <img
                src="/pwa-192x192.png"
                alt="شعار إدكاوي"
                className="w-8 h-8 rounded-xl object-contain"
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#F8FAFC] truncate">
                تثبيت تطبيق إدكاوي على جهازك
              </p>
              <p className="text-xs text-[#94A3B8]">
                افتح إدكاوي مباشرة من الشاشة الرئيسية كأي تطبيق أصلي وبأسرع أداء
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAction}
            className="min-h-[42px] px-4 py-2 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>{isIOS ? 'طريقة التثبيت على iOS' : 'تثبيت التطبيق'}</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleAction}
          title={isIOS ? 'تثبيت على آيفون / آيباد' : 'تثبيت تطبيق إدكاوي'}
          className={`min-h-[40px] px-3 py-2 rounded-2xl bg-[#FF6B00]/15 hover:bg-[#FF6B00] border border-[#FF6B00]/50 text-[#FF6B00] hover:text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors ${className}`}
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">تثبيت التطبيق</span>
          <span className="sm:hidden">تثبيت</span>
        </button>
      )}

      {showIOSGuide && (
        <div
          role="dialog"
          aria-modal="true"
          dir="rtl"
          className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-sm rounded-2xl bg-[#1E293B] border border-[#334155] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <img
                  src="/pwa-192x192.png"
                  alt="شعار إدكاوي"
                  className="w-9 h-9 rounded-xl border border-[#334155]"
                />
                <h3 className="text-base font-bold text-[#F8FAFC]">
                  تثبيت إدكاوي على الآيفون / الآيباد
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                aria-label="إغلاق"
                className="min-h-[36px] min-w-[36px] rounded-2xl bg-[#0F172A] border border-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ol className="space-y-2.5 text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-[#FF6B00] text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  ١
                </span>
                <span>
                  اضغط على زر{' '}
                  <strong className="text-[#F8FAFC] inline-flex items-center gap-1">
                    المشاركة <Share className="w-3.5 h-3.5 text-[#FF6B00]" />
                  </strong>{' '}
                  في شريط متصفح Safari.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-[#FF6B00] text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  ٢
                </span>
                <span>
                  مرّر للأسفل واختر{' '}
                  <strong className="text-[#F8FAFC]">
                    إضافة إلى الشاشة الرئيسية (Add to Home Screen)
                  </strong>
                  .
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-[#FF6B00] text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  ٣
                </span>
                <span>
                  اضغط <strong className="text-[#F8FAFC]">إضافة (Add)</strong>{' '}
                  ليظهر تطبيق إدكاوي على شاشتك.
                </span>
              </li>
            </ol>

            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full min-h-[44px] py-2.5 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-sm font-bold cursor-pointer"
            >
              فهمت
            </button>
          </div>
        </div>
      )}
    </>
  );
};
