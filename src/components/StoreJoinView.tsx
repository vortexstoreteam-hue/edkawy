import React, { useState } from 'react';
import {
  Store,
  CheckCircle2,
  MapPin,
  Phone,
  User,
  Upload,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Clock,
  Check,
} from 'lucide-react';
import { StoreJoinRequestInput } from '../types/edkawi';
import { submitStoreJoinRequestInFirestore } from '../services/edkawiFirebaseService';

interface StoreJoinViewProps {
  onBackToHome: () => void;
}

const EDKU_NEIGHBORHOODS = [
  'شارع البحر',
  'الموقف الجديد',
  'الوسطانية',
  'حي الزهور',
  'شارع الجمهورية',
  'منطقة المعهد الديني',
  'حي السلام',
  'المعدية والساحل',
  'المركز الطبي',
  'طريق البوصيلي',
];

const CATEGORY_OPTIONS: { category: string; subCategories: string[] }[] = [
  {
    category: 'مشويات ومطاعم',
    subCategories: ['مشويات', 'مخبوزات', 'أسماك', 'كشري', 'بروست', 'مشروبات', 'حلويات'],
  },
  {
    category: 'أسماك وبحريات',
    subCategories: ['أسماك طازجة', 'مشويات بحرية', 'طواجن وسيفود'],
  },
  {
    category: 'سوبر ماركت',
    subCategories: ['بقالة عامة', 'ألبان وأجبان', 'منظفات منزلية', 'خضروات وفواكه'],
  },
  {
    category: 'صيدليات',
    subCategories: ['أدوية ومستلزمات', 'عناية بالبشرة', 'مستلزمات أطفال'],
  },
  {
    category: 'أكل بيتي',
    subCategories: ['وجبات يومية', 'فطير مشلتت', 'محاشي وطواجن', 'حلويات شرقية'],
  },
  {
    category: 'مستحضرات تجميل',
    subCategories: ['مكياج', 'عناية بالبشرة', 'عطور'],
  },
];

export const StoreJoinView: React.FC<StoreJoinViewProps> = ({ onBackToHome }) => {
  const [storeName, setStoreName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0].category);
  const [subCategory, setSubCategory] = useState(CATEGORY_OPTIONS[0].subCategories[0]);
  const [neighborhood, setNeighborhood] = useState(EDKU_NEIGHBORHOODS[0]);
  const [commercialImageBase64, setCommercialImageBase64] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedRequestId, setSubmittedRequestId] = useState<string | null>(null);

  const currentSubCategories =
    CATEGORY_OPTIONS.find((c) => c.category === category)?.subCategories || [];

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextCat = e.target.value;
    setCategory(nextCat);
    const subs = CATEGORY_OPTIONS.find((c) => c.category === nextCat)?.subCategories || [];
    setSubCategory(subs[0] || '');
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 2 ميجابايت.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCommercialImageBase64(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (storeName.trim().length < 2) {
      setErrorMsg('يرجى إدخال اسم المتجر بشكل صحيح.');
      return;
    }
    if (ownerName.trim().length < 2) {
      setErrorMsg('يرجى إدخال اسم المالك أو المسؤول.');
      return;
    }
    const cleanPhone = phone.trim().replace(/\s+/g, '');
    if (!/^01[0125][0-9]{8}$/.test(cleanPhone)) {
      setErrorMsg('يرجى إدخال رقم هاتف محمول مصري صحيح (11 رقم يبدأ بـ 01).');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: StoreJoinRequestInput = {
        storeName: storeName.trim(),
        ownerName: ownerName.trim(),
        phone: cleanPhone,
        category,
        subCategory,
        neighborhood,
        commercialRegisterImage: commercialImageBase64 || undefined,
      };

      const reqId = await submitStoreJoinRequestInFirestore(payload);
      setSubmittedRequestId(reqId);
    } catch (err: any) {
      setErrorMsg(err?.message || 'حدث خطأ أثناء إرسال الطلب، يرجى المحاولة لاحقاً.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submittedRequestId) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-[#F8FAFC] p-4 flex flex-col justify-center items-center font-['Cairo',sans-serif] dir-rtl" dir="rtl">
        <div className="w-full max-w-lg bg-[#1E293B] border border-[#334155] rounded-2xl p-6 text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-[#F8FAFC]">تم استلام طلب انضمامك بنجاح!</h2>
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              أهلاً بك في عائلة شركاء إدكاوي. رقم طلبك المرجعي هو:
            </p>
            <div className="inline-block bg-[#0F172A] border border-[#FF6B00]/40 rounded-xl px-4 py-2 font-mono text-[#FF6B00] font-bold text-lg select-all">
              {submittedRequestId}
            </div>
          </div>

          <div className="bg-[#0F172A]/70 border border-[#334155] rounded-xl p-4 text-right space-y-2 text-sm text-[#94A3B8]">
            <div className="flex items-center gap-2 text-[#F8FAFC] font-semibold">
              <Clock className="w-4 h-4 text-[#FF6B00]" />
              <span>الخطوات القادمة:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-xs text-[#94A3B8] pr-1">
              <li>يقوم فريق إدارة إدكاوي بمراجعة السجل التجاري وبيانات المتجر خلال 24 ساعة.</li>
              <li>سيتم التواصل معك عبر الهاتف: <span className="text-[#F8FAFC] font-mono">{phone}</span> لتأكيد تفعيل الحساب وقائمة المنتجات.</li>
              <li>فور الاعتماد، سيظهر متجرك لآلاف العملاء في مدينة إدكو!</li>
            </ul>
          </div>

          <button
            onClick={onBackToHome}
            className="w-full py-3.5 px-4 bg-[#FF6B00] hover:bg-[#FF6B00]/90 text-white font-bold rounded-xl transition duration-200 flex items-center justify-center gap-2 shadow-lg shadow-[#FF6B00]/20"
          >
            <span>العودة للرئيسية</span>
            <ArrowRight className="w-5 h-5 transform rotate-180" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-[#F8FAFC] p-4 font-['Cairo',sans-serif] dir-rtl" dir="rtl">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between bg-[#1E293B] border border-[#334155] rounded-2xl p-4 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#FF6B00]/15 border border-[#FF6B00]/30 flex items-center justify-center text-[#FF6B00]">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#F8FAFC]">انضم كشريك تجاري في إدكاوي</h1>
              <p className="text-xs text-[#94A3B8]">ابدأ بيع منتجاتك لآلاف العملاء في إدكو وضواحيها</p>
            </div>
          </div>
          <button
            onClick={onBackToHome}
            className="text-xs text-[#94A3B8] hover:text-[#F8FAFC] bg-[#0F172A] border border-[#334155] px-3 py-2 rounded-xl flex items-center gap-1.5 transition"
          >
            <span>الرئيسية</span>
            <ArrowRight className="w-4 h-4 transform rotate-180" />
          </button>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#F8FAFC]">وصول فوري للزبائن</h4>
              <p className="text-[11px] text-[#94A3B8]">أكبر تجمع للمتسوقين بإدكو</p>
            </div>
          </div>
          <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#F8FAFC]">توصيل سريع مضمون</h4>
              <p className="text-[11px] text-[#94A3B8]">أسطول مناديب مدرب وموثق</p>
            </div>
          </div>
          <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#F8FAFC]">لوحة تحكم فورية</h4>
              <p className="text-[11px] text-[#94A3B8]">استقبال الطلبات بضغطة زر</p>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl p-3.5 flex items-center gap-3 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-[#1E293B] border border-[#334155] rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Store Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#94A3B8] flex items-center gap-1.5">
                <Store className="w-4 h-4 text-[#FF6B00]" />
                <span>اسم المحل / النشاط التجاري *</span>
              </label>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="مثال: أسماك بحري أو بروست البرنس"
                className="w-full bg-[#0F172A] border border-[#334155] focus:border-[#FF6B00] rounded-xl px-3.5 py-2.5 text-sm text-[#F8FAFC] outline-none transition"
              />
            </div>

            {/* Owner Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#94A3B8] flex items-center gap-1.5">
                <User className="w-4 h-4 text-[#FF6B00]" />
                <span>اسم المسؤول / المالك *</span>
              </label>
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="الاسم ثلاثي"
                className="w-full bg-[#0F172A] border border-[#334155] focus:border-[#FF6B00] rounded-xl px-3.5 py-2.5 text-sm text-[#F8FAFC] outline-none transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Phone */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#94A3B8] flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-[#FF6B00]" />
                <span>رقم الهاتف المحمول (واتساب وتواصل) *</span>
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01012345678"
                className="w-full bg-[#0F172A] border border-[#334155] focus:border-[#FF6B00] rounded-xl px-3.5 py-2.5 text-sm text-[#F8FAFC] outline-none transition text-left font-mono"
                dir="ltr"
              />
            </div>

            {/* Neighborhood */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#94A3B8] flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#FF6B00]" />
                <span>المنطقة / الحي في إدكو *</span>
              </label>
              <select
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="w-full bg-[#0F172A] border border-[#334155] focus:border-[#FF6B00] rounded-xl px-3.5 py-2.5 text-sm text-[#F8FAFC] outline-none transition cursor-pointer"
              >
                {EDKU_NEIGHBORHOODS.map((nh) => (
                  <option key={nh} value={nh}>
                    {nh}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Main Category */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#94A3B8]">النشاط الرئيسي *</label>
              <select
                value={category}
                onChange={handleCategoryChange}
                className="w-full bg-[#0F172A] border border-[#334155] focus:border-[#FF6B00] rounded-xl px-3.5 py-2.5 text-sm text-[#F8FAFC] outline-none transition cursor-pointer"
              >
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat.category} value={cat.category}>
                    {cat.category}
                  </option>
                ))}
              </select>
            </div>

            {/* Sub Category */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#94A3B8]">التصنيف الفرعي *</label>
              <select
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
                className="w-full bg-[#0F172A] border border-[#334155] focus:border-[#FF6B00] rounded-xl px-3.5 py-2.5 text-sm text-[#F8FAFC] outline-none transition cursor-pointer"
              >
                {currentSubCategories.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Commercial Register / Store Photo */}
          <div className="space-y-2 pt-2 border-t border-[#334155]">
            <label className="text-xs font-semibold text-[#94A3B8] flex items-center gap-1.5">
              <Upload className="w-4 h-4 text-[#FF6B00]" />
              <span>صورة السجل التجاري أو واجهة المحل (اختياري لسرعة الاعتماد)</span>
            </label>
            <div className="flex items-center gap-4">
              <label className="cursor-pointer bg-[#0F172A] hover:bg-[#0F172A]/80 border border-dashed border-[#334155] hover:border-[#FF6B00] rounded-xl px-4 py-3 text-xs text-[#94A3B8] flex items-center gap-2 transition">
                <Upload className="w-4 h-4 text-[#FF6B00]" />
                <span>اختر صورة من جهازك</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />
              </label>
              {commercialImageBase64 && (
                <div className="flex items-center gap-2 bg-[#0F172A] border border-emerald-500/40 rounded-xl px-3 py-1.5 text-xs text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>تم إرفاق الصورة</span>
                  <button
                    type="button"
                    onClick={() => setCommercialImageBase64('')}
                    className="text-red-400 hover:text-red-300 mr-2 text-[11px]"
                  >
                    حذف
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-4 py-3.5 px-4 bg-[#FF6B00] hover:bg-[#FF6B00]/90 disabled:opacity-50 text-white font-bold rounded-xl transition duration-200 flex items-center justify-center gap-2 shadow-lg shadow-[#FF6B00]/20 text-sm"
          >
            {isSubmitting ? (
              <span>جاري إرسال الطلب...</span>
            ) : (
              <>
                <Store className="w-5 h-5" />
                <span>إرسال طلب الانضمام الآن</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
