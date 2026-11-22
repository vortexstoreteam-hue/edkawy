import React, { useId, useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { compressDeviceImageToDataUrl } from '../utils/imageUpload';

interface DeviceImageInputProps {
  label: string;
  value: string;
  onChange: (dataUrl: string) => void;
  required?: boolean;
  helperText?: string;
  errorText?: string;
  error?: string;
  aspectClassName?: string;
  maxWidth?: number;
  maxHeight?: number;
  maxChars?: number;
  quality?: number;
  allowCameraCapture?: boolean;
}

export const DeviceImageInput: React.FC<DeviceImageInputProps> = ({
  label,
  value,
  onChange,
  required = true,
  helperText = 'اختر صورة حقيقية واضحة من هاتفك أو جهازك (JPG / PNG / WebP)',
  errorText,
  error,
  aspectClassName = 'h-40',
  maxWidth = 920,
  maxHeight = 920,
  maxChars,
  quality,
  allowCameraCapture = false,
}) => {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLocalError(null);
    setCompressing(true);
    try {
      const compressed = await compressDeviceImageToDataUrl(file, {
        maxWidth,
        maxHeight,
        maxChars,
        quality,
      });
      onChange(compressed);
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'تعذر رفع الصورة من الجهاز.'
      );
    } finally {
      setCompressing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const displayError = errorText || error || localError;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={inputId}
          className="block text-xs font-bold text-[#F8FAFC]"
        >
          {label}
          {required && <span className="text-rose-400 mr-1">*</span>}
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-rose-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>إزالة الصورة</span>
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        accept="image/*"
        {...(allowCameraCapture ? { capture: 'environment' as const } : {})}
        onChange={handleFileChange}
        className="sr-only"
      />

      {value ? (
        <div
          className={`relative w-full ${aspectClassName} rounded-2xl overflow-hidden border border-[#334155] bg-[#0F172A] group`}
        >
          <img
            src={value}
            alt={label}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent flex items-end justify-between p-3">
            <span className="text-xs font-semibold text-[#F8FAFC]">
              تم إرفاق الصورة من جهازك بنجاح
            </span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={compressing}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-[#1E293B] border border-[#334155] text-[#F8FAFC] px-3 py-1.5 text-xs font-bold hover:border-[#FF6B00] whitespace-nowrap shrink-0 cursor-pointer"
            >
              {compressing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#FF6B00]" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 text-[#FF6B00]" />
              )}
              <span>تغيير الصورة</span>
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={compressing}
          className={`w-full ${aspectClassName} rounded-2xl border-2 border-dashed ${
            displayError
              ? 'border-rose-500/70 bg-rose-950/25'
              : 'border-[#334155] bg-[#0F172A] hover:border-[#FF6B00] hover:bg-[#1E293B]'
          } flex flex-col items-center justify-center gap-2 p-4 text-center transition-colors cursor-pointer`}
        >
          {compressing ? (
            <>
              <Loader2 className="h-7 w-7 animate-spin text-[#FF6B00]" />
              <span className="text-xs font-bold text-[#F8FAFC]">
                جارٍ ضغط وتجهيز الصورة بجودة عالية...
              </span>
            </>
          ) : (
            <>
              <div className="h-11 w-11 rounded-2xl bg-[#FF6B00]/15 text-[#FF6B00] flex items-center justify-center">
                {allowCameraCapture ? (
                  <Camera className="h-5 w-5" />
                ) : (
                  <ImagePlus className="h-5 w-5" />
                )}
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-[#F8FAFC]">
                  اضغط لرفع صورة حقيقية من جهازك
                </p>
                <p className="text-[11px] text-[#94A3B8]">
                  {helperText}
                </p>
              </div>
            </>
          )}
        </button>
      )}

      {displayError && (
        <p className="text-xs font-semibold text-rose-400">
          {displayError}
        </p>
      )}
    </div>
  );
};
