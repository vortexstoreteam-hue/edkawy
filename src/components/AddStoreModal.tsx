import { FormEvent, useState } from 'react';
import { Check, CheckCircle2, Copy, KeyRound, Pill, Store, X } from 'lucide-react';
import { EDKU_CITY_CENTER } from '../data/edkuSeedStores';
import { adminSendPasswordResetLinkInFirestore } from '../services/edkawiFirebaseService';
import {
  AdminCreateStoreInput,
  StoreCategory,
  StoreCredentialRecord,
} from '../types/edkawi';
import {
  EDKU_NEIGHBORHOODS,
  formatAppErrorMessage,
  STORE_CATEGORIES,
  validateAdminCreateStoreForm,
} from '../utils/orderLogic';
import { DeviceImageInput } from './DeviceImageInput';
import { EdkuLocationPickerMap } from './EdkuGoogleMaps';

interface AddStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateStoreByAdmin: (
    input: AdminCreateStoreInput
  ) => Promise<StoreCredentialRecord>;
}

export function AddStoreModal({
  isOpen,
  onClose,
  onCreateStoreByAdmin,
}: AddStoreModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState<StoreCategory>('أسماك وبحريات');
  const [isHomeFood, setIsHomeFood] = useState(false);
  const [neighborhood, setNeighborhood] = useState<string>(
    EDKU_NEIGHBORHOODS[0]
  );
  const [lat, setLat] = useState<number>(EDKU_CITY_CENTER.lat);
  const [lng, setLng] = useState<number>(EDKU_CITY_CENTER.lng);
  const [isWaterPin, setIsWaterPin] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('15');
  const [deliveryTimeMinutes, setDeliveryTimeMinutes] = useState('25');
  const [firstItemName, setFirstItemName] = useState('');
  const [firstItemPrice, setFirstItemPrice] = useState('120');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] =
    useState<StoreCredentialRecord | null>(null);
  const [copiedField, setCopiedField] = useState<'email' | null>(null);
  const [sendingReset, setSendingReset] = useState(false);
  const [resetSentMsg, setResetSentMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  function resetAndClose() {
    setName('');
    setPhone('');
    setCategory('أسماك وبحريات');
    setIsHomeFood(false);
    setNeighborhood(EDKU_NEIGHBORHOODS[0]);
    setLat(EDKU_CITY_CENTER.lat);
    setLng(EDKU_CITY_CENTER.lng);
    setIsWaterPin(false);
    setImageUrl('');
    setDeliveryFee('15');
    setDeliveryTimeMinutes('25');
    setFirstItemName('');
    setFirstItemPrice('120');
    setErrors({});
    setSubmitError(null);
    setCreatedCredentials(null);
    setCopiedField(null);
    setResetSentMsg(null);
    onClose();
  }

  async function copyText(value: string, field: 'email'): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => {
        setCopiedField((prev) => (prev === field ? null : prev));
      }, 2200);
    } catch {
      // Clipboard unavailable in restricted context
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (isWaterPin) {
      setSubmitError(
        'لا يمكن تثبيت موقع المتجر فوق مياه البحر المتوسط أو بحيرة إدكو. يرجى تحريك الدبوس لليابسة.'
      );
      return;
    }

    const payload: AdminCreateStoreInput = {
      name,
      phone,
      category,
      isHomeFood: isHomeFood || category === 'أكل بيتي',
      neighborhood,
      lat,
      lng,
      imageUrl,
      deliveryFee: Math.trunc(Number(deliveryFee)),
      deliveryTimeMinutes: Math.trunc(Number(deliveryTimeMinutes)),
      firstItemName: firstItemName.trim() || undefined,
      firstItemPrice: firstItemName.trim()
        ? Math.trunc(Number(firstItemPrice))
        : undefined,
    };

    const validation = validateAdminCreateStoreForm(payload);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const credentials = await onCreateStoreByAdmin(payload);
      setCreatedCredentials(credentials);
    } catch (err) {
      setSubmitError(
        formatAppErrorMessage(
          err,
          'تعذر إنشاء المتجر وتوليد حساب الدخول في Firebase.'
        )
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="edkawi-modal-backdrop flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-store-title"
    >
      <div className="bg-[#1E293B] border border-[#334155] rounded-2xl max-w-2xl w-full p-6 shadow-2xl my-8 edkawi-page-enter max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#334155]">
          <div className="flex items-center gap-2.5">
            {category === 'صيدليات' ? (
              <Pill className="w-5 h-5 text-teal-400" aria-hidden="true" />
            ) : (
              <Store className="w-5 h-5 text-[#FF6B00]" aria-hidden="true" />
            )}
            <h2
              id="add-store-title"
              className="text-lg font-bold text-[#F8FAFC]"
            >
              {createdCredentials
                ? 'تم إنشاء المتجر وتوليد بيانات الدخول'
                : 'إضافة متجر أو صيدلية جديدة في إدكاوي'}
            </h2>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            aria-label="إغلاق النافذة"
            className="p-2 rounded-2xl text-[#94A3B8] hover:bg-[#0F172A] hover:text-[#F8FAFC] cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {createdCredentials ? (
          <div className="mt-5 space-y-5">
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800 text-emerald-100 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-100">
                <CheckCircle2
                  className="w-5 h-5 text-emerald-400 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  تم حفظ «{createdCredentials.storeName}» وتفعيله على خريطة إدكو بنجاح!
                </span>
              </div>
              <p className="text-xs text-emerald-200 leading-relaxed">
                تم إنشاء حساب المتجر بأمان تام بدون كشف كلمات المرور. يمكن لصاحب المتجر ({createdCredentials.phone}) تسجيل الدخول عبر بريده الرسمي أو تعيين كلمة مرور جديدة عبر الرابط الآمن.
              </p>
            </div>

            {resetSentMsg && (
              <div
                role="status"
                className="p-4 rounded-2xl bg-blue-950/40 border border-blue-800 text-blue-100 text-xs font-bold flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" aria-hidden="true" />
                <span>{resetSentMsg}</span>
              </div>
            )}

            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-[#0F172A] border border-[#334155] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#94A3B8] mb-0.5">
                    البريد الإلكتروني المولّد للمتجر
                  </p>
                  <p
                    dir="ltr"
                    className="font-mono text-sm font-bold text-[#F8FAFC] truncate text-left"
                  >
                    {createdCredentials.loginEmail}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    copyText(createdCredentials.loginEmail, 'email')
                  }
                  className="py-1.5 px-3 rounded-2xl bg-[#1E293B] border border-[#334155] hover:border-[#FF6B00] text-xs font-bold text-[#F8FAFC] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {copiedField === 'email' ? (
                    <>
                      <Check
                        className="w-3.5 h-3.5 text-emerald-400"
                        aria-hidden="true"
                      />
                      <span>تم النسخ</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>نسخ البريد</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-[#0F172A] border border-[#334155] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#F8FAFC] mb-0.5">
                    رابط تعيين كلمة المرور
                  </p>
                  <p className="text-[11px] text-[#94A3B8]">
                    أرسل رابط تعيين كلمة المرور الآمن للتاجر فوراً ليحدد كلمته السرية بنفسه.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={sendingReset}
                  onClick={async () => {
                    setSendingReset(true);
                    setResetSentMsg(null);
                    try {
                      const msg = await adminSendPasswordResetLinkInFirestore({
                        email: createdCredentials.loginEmail,
                        targetId: createdCredentials.storeId,
                        targetName: createdCredentials.storeName,
                      });
                      setResetSentMsg(msg);
                    } catch (err) {
                      setResetSentMsg(
                        formatAppErrorMessage(err, 'تعذر إرسال رابط تعيين كلمة المرور.')
                      );
                    } finally {
                      setSendingReset(false);
                    }
                  }}
                  className="py-2 px-3.5 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-60 text-xs font-bold text-[#F8FAFC] inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{sendingReset ? 'جارٍ الإرسال...' : 'إرسال رابط تعيين كلمة المرور'}</span>
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={resetAndClose}
                className="py-2.5 px-6 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] text-[#F8FAFC] text-xs sm:text-sm font-bold cursor-pointer whitespace-nowrap"
              >
                تم — العودة للوحة الإدارة
              </button>
            </div>
          </div>
        ) : (
          <>
            {submitError && (
              <div
                role="alert"
                className="mt-4 p-4 rounded-2xl bg-red-950/40 border border-red-800 text-red-200 text-sm"
              >
                {submitError}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="store-name"
                    className="block text-xs font-bold text-[#F8FAFC] mb-1"
                  >
                    اسم المتجر أو الصيدلية
                  </label>
                  <input
                    id="store-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={
                      category === 'صيدليات'
                        ? 'مثال: صيدلية الشفاء إدكو'
                        : 'مثال: أسماك النورس إدكو'
                    }
                    maxLength={80}
                    className="w-full px-3 py-2.5 rounded-2xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-sm"
                    required
                  />
                  {errors.name && (
                    <p className="text-xs text-red-400 mt-1">{errors.name}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="store-owner-phone"
                    className="block text-xs font-bold text-[#F8FAFC] mb-1"
                  >
                    رقم موبايل المالك / المسؤول
                  </label>
                  <input
                    id="store-owner-phone"
                    type="tel"
                    dir="ltr"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01012345678"
                    maxLength={11}
                    className="w-full px-3 py-2.5 rounded-2xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-sm font-mono tabular-nums text-left"
                    required
                  />
                  {errors.phone && (
                    <p className="text-xs text-red-400 mt-1">{errors.phone}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="store-category"
                    className="block text-xs font-bold text-[#F8FAFC] mb-1"
                  >
                    التصنيف
                  </label>
                  <select
                    id="store-category"
                    value={category}
                    onChange={(e) => {
                      const nextCat = e.target.value as StoreCategory;
                      setCategory(nextCat);
                      if (nextCat === 'أكل بيتي') {
                        setIsHomeFood(true);
                      }
                    }}
                    className="w-full px-3 py-2.5 rounded-2xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-sm"
                  >
                    {STORE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="store-fee"
                    className="block text-xs font-bold text-[#F8FAFC] mb-1"
                  >
                    رسوم التوصيل (ج.م)
                  </label>
                  <input
                    id="store-fee"
                    type="number"
                    dir="ltr"
                    min={0}
                    max={150}
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-2xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-sm font-mono tabular-nums text-left"
                  />
                  {errors.deliveryFee && (
                    <p className="text-xs text-red-400 mt-1">
                      {errors.deliveryFee}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="store-time"
                    className="block text-xs font-bold text-[#F8FAFC] mb-1"
                  >
                    وقت التوصيل (دقيقة)
                  </label>
                  <input
                    id="store-time"
                    type="number"
                    dir="ltr"
                    min={10}
                    max={120}
                    value={deliveryTimeMinutes}
                    onChange={(e) => setDeliveryTimeMinutes(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-2xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-sm font-mono tabular-nums text-left"
                  />
                  {errors.deliveryTimeMinutes && (
                    <p className="text-xs text-red-400 mt-1">
                      {errors.deliveryTimeMinutes}
                    </p>
                  )}
                </div>
              </div>

              <label className="flex items-center gap-2.5 p-4 rounded-2xl bg-[#0F172A] border border-[#334155] text-xs font-bold text-[#F8FAFC] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isHomeFood || category === 'أكل بيتي'}
                  onChange={(e) => setIsHomeFood(e.target.checked)}
                  className="w-4 h-4 accent-[#FF6B00] rounded"
                />
                <span>تمييز المتجر بعلامة «أكل بيتي — تحضير منزلي طازج»</span>
              </label>

              {category === 'صيدليات' && (
                <div className="p-4 rounded-2xl bg-teal-950/40 border border-teal-800 text-xs text-teal-100 leading-relaxed">
                  <strong>نظام صيدليات إدكاوي مفعّل تلقائياً:</strong> سيتمكن العملاء من إرسال صورة الروشتة أو أسماء الأدوية، وتقوم الصيدلية بتحديد السعر والقبول، وبعد موافقة العميل وتحضير الشنطة يستلمها مندوب إدكاوي للتوصيل.
                </div>
              )}

              {/* Mandatory Device Image Upload */}
              <div>
                <DeviceImageInput
                  label="صورة واجهة المتجر / الشعار من جهازك (إجباري)"
                  helperText="اختر صورة حقيقية من جهازك — لا تُستخدم أي صور افتراضية"
                  value={imageUrl}
                  onChange={setImageUrl}
                  required
                />
                {errors.imageUrl && (
                  <p className="text-xs text-red-400 mt-1">{errors.imageUrl}</p>
                )}
              </div>

              {/* Interactive Map Location Picker */}
              <EdkuLocationPickerMap
                label="موقع المتجر أو الصيدلية على خريطة Google"
                helperText="ابحث عن اسم المتجر أو الشارع في الخريطة أو استخدم GPS لتثبيت الموقع الحقيقي بدقة"
                lat={lat}
                lng={lng}
                neighborhood={neighborhood}
                pinColor={category === 'صيدليات' ? '#0D9488' : '#FF6B00'}
                heightClassName="h-[235px]"
                onWaterValidationChange={setIsWaterPin}
                onChange={(picked) => {
                  setLat(picked.lat);
                  setLng(picked.lng);
                  setNeighborhood(picked.neighborhood);
                }}
              />

              <div className="pt-2 border-t border-[#334155]">
                <p className="text-xs font-semibold text-[#94A3B8] mb-2">
                  صنف افتتاحي مبدئي (اختياري — يمكن للمتجر إضافة المنيو كاملاً من لوحته)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <input
                      id="item1-name"
                      type="text"
                      value={firstItemName}
                      onChange={(e) => setFirstItemName(e.target.value)}
                      placeholder={
                        category === 'صيدليات'
                          ? 'مثال: عناية يومية ومستلزمات طبية'
                          : 'مثال: وجبة بوري مشوي بالردة'
                      }
                      maxLength={80}
                      className="w-full px-3 py-2 rounded-2xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-sm"
                    />
                  </div>
                  <div>
                    <input
                      id="item1-price"
                      type="number"
                      dir="ltr"
                      min={1}
                      max={5000}
                      value={firstItemPrice}
                      onChange={(e) => setFirstItemPrice(e.target.value)}
                      placeholder="120"
                      className="w-full px-3 py-2 rounded-2xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-sm font-mono tabular-nums text-left"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={resetAndClose}
                  className="py-2.5 px-4 rounded-2xl border border-[#334155] bg-[#0F172A] text-sm font-bold text-[#F8FAFC] hover:border-[#FF6B00] cursor-pointer whitespace-nowrap"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting || isWaterPin}
                  className="py-2.5 px-5 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-60 text-[#F8FAFC] text-sm font-bold cursor-pointer whitespace-nowrap"
                >
                  {submitting
                    ? 'جارٍ الحفظ والتفعيل...'
                    : 'حفظ وتفعيل المتجر على الخريطة'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
