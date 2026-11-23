import React from 'react';
import { Camera, CheckCircle2, FileCheck2, ShieldCheck } from 'lucide-react';
import {
  CourierKycDocumentsInput,
  CourierVehicleType,
} from '../types/edkawi';
import { isCourierDrivingLicenseRequired } from '../utils/orderLogic';
import { DeviceImageInput } from './DeviceImageInput';

interface CourierKycFieldsProps {
  vehicleType: CourierVehicleType;
  value: CourierKycDocumentsInput;
  onChange: (next: CourierKycDocumentsInput) => void;
  errors?: Record<string, string>;
}

export const CourierKycFields: React.FC<CourierKycFieldsProps> = ({
  vehicleType,
  value,
  onChange,
  errors = {},
}) => {
  const requiresLicense = isCourierDrivingLicenseRequired(vehicleType);

  const requiredDocsCount = requiresLicense ? 6 : 4;
  const uploadedCount = [
    value.nationalIdFrontUrl,
    value.nationalIdBackUrl,
    ...(requiresLicense
      ? [value.drivingLicenseFrontUrl, value.drivingLicenseBackUrl]
      : []),
    value.selfieWithIdUrl,
    value.vehiclePhotoUrl,
  ].filter((url) => Boolean(url && url.trim().length > 16)).length;

  const updateField = (
    field: keyof CourierKycDocumentsInput,
    nextUrl: string
  ) => {
    onChange({
      ...value,
      [field]: nextUrl,
    });
  };

  return (
    <div
      dir="rtl"
      className="rounded-2xl bg-[#10192D] border border-[#334155] p-4 sm:p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#334155]">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-[#FF7100]/15 border border-[#FF7100]/30 text-[#FF7100] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-[#F8FAFC]">
              مستندات التوثيق الإجبارية لمراجعة الإدارة
            </h4>
            <p className="text-xs text-[#94A3B8]">
              {requiresLicense
                ? 'مطلوب البطاقة وش وظهر + رخصة القيادة وش وظهر + سيلفي بالبطاقة والرخصة بجانب الوجه + صورة الموتوسيكل/السكوتر.'
                : 'الدراجة الهوائية معفاة من رخصة القيادة — مطلوب البطاقة وش وظهر + سيلفي بالبطاقة بجانب الوجه + صورة الدراجة.'}
            </p>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-extrabold border ${
            uploadedCount === requiredDocsCount
              ? 'bg-emerald-950/50 border-emerald-700 text-emerald-300'
              : 'bg-[#1E293B] border-[#334155] text-[#FF7100]'
          }`}
        >
          {uploadedCount === requiredDocsCount ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <FileCheck2 className="w-4 h-4" />
          )}
          <span>
            {uploadedCount} / {requiredDocsCount} مستندات مرفوعة
          </span>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DeviceImageInput
          label="صورة البطاقة الشخصية (الوجه الأمامي)"
          helperText="صورة واضحة لوجه البطاقة بالكامل"
          value={value.nationalIdFrontUrl}
          onChange={(url) => updateField('nationalIdFrontUrl', url)}
          errorText={errors.nationalIdFrontUrl}
          maxWidth={720}
          maxHeight={720}
          maxChars={115_000}
          quality={0.72}
          aspectClassName="h-36"
          allowCameraCapture
          required
        />

        <DeviceImageInput
          label="صورة البطاقة الشخصية (الظهر الخلفي)"
          helperText="صورة واضحة لظهر البطاقة بالكامل"
          value={value.nationalIdBackUrl}
          onChange={(url) => updateField('nationalIdBackUrl', url)}
          errorText={errors.nationalIdBackUrl}
          maxWidth={720}
          maxHeight={720}
          maxChars={115_000}
          quality={0.72}
          aspectClassName="h-36"
          allowCameraCapture
          required
        />

        {requiresLicense && (
          <>
            <DeviceImageInput
              label="صورة رخصة القيادة (الوجه الأمامي)"
              helperText="رخصة قيادة سارية للموتوسيكل / السكوتر"
              value={value.drivingLicenseFrontUrl || ''}
              onChange={(url) => updateField('drivingLicenseFrontUrl', url)}
              errorText={errors.drivingLicenseFrontUrl}
              maxWidth={720}
              maxHeight={720}
              maxChars={115_000}
              quality={0.72}
              aspectClassName="h-36"
              allowCameraCapture
              required
            />

            <DeviceImageInput
              label="صورة رخصة القيادة (الظهر الخلفي)"
              helperText="الوجه الخلفي لرخصة القيادة سارية المفعول"
              value={value.drivingLicenseBackUrl || ''}
              onChange={(url) => updateField('drivingLicenseBackUrl', url)}
              errorText={errors.drivingLicenseBackUrl}
              maxWidth={720}
              maxHeight={720}
              maxChars={115_000}
              quality={0.72}
              aspectClassName="h-36"
              allowCameraCapture
              required
            />
          </>
        )}

        <DeviceImageInput
          label={
            requiresLicense
              ? 'صورة سيلفي مع الرخصة والبطاقة بجانب الوجه'
              : 'صورة سيلفي مع البطاقة بجانب الوجه'
          }
          helperText={
            requiresLicense
              ? 'امسك الرخصة والبطاقة بوضوح بجانب وجهك للتحقق'
              : 'امسك البطاقة الشخصية بوضوح بجانب وجهك للتحقق'
          }
          value={value.selfieWithIdUrl}
          onChange={(url) => updateField('selfieWithIdUrl', url)}
          errorText={errors.selfieWithIdUrl}
          maxWidth={720}
          maxHeight={720}
          maxChars={115_000}
          quality={0.72}
          aspectClassName="h-36"
          allowCameraCapture
          required
        />

        <DeviceImageInput
          label={
            requiresLicense
              ? `صورة واضحة للـ${vehicleType}`
              : 'صورة واضحة للدراجة الهوائية'
          }
          helperText={
            requiresLicense
              ? 'صورة كاملة للمركبة توضح اللوحة والحالة'
              : 'صورة كاملة للدراجة الهوائية المستخدمة في التوصيل'
          }
          value={value.vehiclePhotoUrl}
          onChange={(url) => updateField('vehiclePhotoUrl', url)}
          errorText={errors.vehiclePhotoUrl}
          maxWidth={720}
          maxHeight={720}
          maxChars={115_000}
          quality={0.72}
          aspectClassName="h-36"
          allowCameraCapture
          required
        />
      </div>

      <div className="flex items-start gap-2 rounded-2xl bg-[#1E293B] border border-[#334155] p-3 text-[11px] text-[#94A3B8]">
        <Camera className="w-4 h-4 text-[#FF7100] shrink-0 mt-0.5" />
        <span>
          تُحفظ جميع صور المستندات بشكل مشفر ولا يطلع عليها سوى إدارة المنصة لاعتماد حسابك وتشغيل استلام الطلبات.
        </span>
      </div>
    </div>
  );
};
