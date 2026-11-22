import React, { useEffect, useState } from 'react';
import {
  Ban,
  ExternalLink,
  FileText,
  Lock,
  LogIn,
  LogOut,
  MapPin,
  Pill,
  RefreshCcw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Store,
  Wrench,
  X,
} from 'lucide-react';
import {
  BlockedEntityRecord,
  LegalSectionKey,
  SystemMaintenanceConfig,
} from '../types/edkawi';
import { AdkawyLogo } from './AdkawyLogo';

interface LegalPagesModalProps {
  isOpen: boolean;
  initialSection?: LegalSectionKey;
  onClose: () => void;
}

const LEGAL_TABS: {
  id: LegalSectionKey;
  label: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  { id: 'terms', label: 'الشروط والأحكام', icon: FileText },
  { id: 'privacy', label: 'الخصوصية وموقع GPS', icon: Lock },
  { id: 'refund', label: 'الاسترجاع والدفع', icon: RefreshCcw },
  { id: 'pharmacy', label: 'سياسة الصيدليات', icon: Pill },
  { id: 'partners', label: 'المتاجر والمناديب والحظر', icon: Store },
];

export const LegalPagesModal: React.FC<LegalPagesModalProps> = ({
  isOpen,
  initialSection = 'terms',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<LegalSectionKey>(initialSection);

  useEffect(() => {
    if (isOpen && initialSection) {
      setActiveTab(initialSection);
    }
  }, [isOpen, initialSection]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      dir="rtl"
      className="edkawi-modal-backdrop flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edkawy-legal-center-title"
    >
      <div
        className="w-full max-w-4xl max-h-[90dvh] bg-[#0F172A] rounded-2xl border border-[#334155] shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="px-6 py-4 bg-[#1E293B] border-b border-[#334155] text-[#F8FAFC] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#FF6B00] text-white flex items-center justify-center shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="edkawy-legal-center-title"
                className="text-lg font-bold text-[#F8FAFC] truncate"
              >
                المركز القانوني والسياسات الرسمية — إدكاوي
              </h2>
              <p className="text-xs text-[#94A3B8] truncate">
                الأحكام المنظمة لخدمات التوصيل، الصيدليات، الخصوصية، وتحديد الموقع في مدينة إدكو
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق المركز القانوني"
            className="min-h-[42px] min-w-[42px] rounded-2xl bg-[#0F172A] border border-[#334155] hover:border-[#FF6B00] text-[#F8FAFC] flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Section Tabs */}
        <div
          role="tablist"
          aria-label="أقسام السياسات القانونية"
          className="px-6 py-3 border-b border-[#334155] bg-[#1E293B]/60 flex items-center gap-2 overflow-x-auto shrink-0"
        >
          {LEGAL_TABS.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[40px] px-4 py-2 rounded-2xl text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  selected
                    ? 'bg-[#FF6B00] text-white shadow-sm'
                    : 'bg-[#1E293B] border border-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] hover:border-[#FF6B00]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Legal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm leading-relaxed text-[#F8FAFC]">
          {activeTab === 'terms' && (
            <article className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-[#F8FAFC]">
                  أولاً: الشروط والأحكام العامة لاستخدام منصة إدكاوي
                </h3>
                <p className="text-xs text-[#94A3B8]">
                  سارية وفقاً للقوانين المعمول بها في جمهورية مصر العربية وقانون حماية المستهلك رقم ١٨١ لسنة ٢٠١٨.
                </p>
              </div>

              <div className="space-y-4">
                <section className="p-4 rounded-2xl bg-[#1E293B] border border-[#334155] space-y-1.5">
                  <h4 className="font-bold text-[#F8FAFC]">
                    ١. طبيعة عمل المنصة ونطاق الخدمة
                  </h4>
                  <p className="text-[#94A3B8]">
                    تعمل منصة <strong className="text-[#F8FAFC]">إدكاوي (Edkawy)</strong> كوسيط تقني ولوجستي يربط العملاء في مدينة إدكو (محافظة البحيرة) والمناطق المجاورة بالمتاجر والمطاعم والسوبرماركت والصيدليات المحلية الموثّقة رسمياً بالسجل التجاري والرقم الضريبي، وينسق عمليات الاستلام والتوصيل عبر مناديب موثّقين.
                  </p>
                </section>

                <section className="p-4 rounded-2xl bg-[#1E293B] border border-[#334155] space-y-1.5">
                  <h4 className="font-bold text-[#F8FAFC]">
                    ٢. الأهلية القانونية والحساب الحقيقي
                  </h4>
                  <p className="text-[#94A3B8]">
                    يشترط لإتمام الطلبات أو المشاركة في <strong className="text-[#F8FAFC]">السلة الجماعية (سلة الشلة)</strong> التسجيل بحساب فعلي وموثّق، وتقديم اسم حقيقي ورقم هاتف محمول مصري فعّال وموقع توصيل دقيق ليتمكن المندوب من تسليم الطلب دون تأخير.
                  </p>
                </section>

                <section className="p-4 rounded-2xl bg-[#1E293B] border border-[#334155] space-y-1.5">
                  <h4 className="font-bold text-[#F8FAFC]">
                    ٣. نظام الطلب الجماعي (سلة الشلة) وتقسيم الحساب
                  </h4>
                  <p className="text-[#94A3B8]">
                    تتيح ميزة السلة الجماعية لعدة مستخدمين مسجلين إضافة أصنافهم في سلة واحدة من نفس المتجر ومشاركة رسوم التوصيل. يلتزم منشئ الغرفة (المضيف) بمراجعة الأصناف وإتمام الطلب والدفع، بينما توثّق المنصة تفصيل حصة كل مشارك بشفافية لحظية.
                  </p>
                </section>

                <section className="p-4 rounded-2xl bg-[#1E293B] border border-[#334155] space-y-1.5">
                  <h4 className="font-bold text-[#F8FAFC]">
                    ٤. الأسعار ورسوم التوصيل والضرائب
                  </h4>
                  <p className="text-[#94A3B8]">
                    جميع أسعار الأصناف والمنتجات معروضة بالجنيه المصري (ج.م) ويحددها المتجر أو الصيدلية مباشرة. تُضاف رسوم التوصيل بوضوح تام في ملخص الطلب قبل التأكيد النهائي، وتُعرض أرقام السجل التجاري والشهادة الضريبية لكل متجر في صفحته للتحقق الكامل.
                  </p>
                </section>

                <section className="p-4 rounded-2xl bg-[#1E293B] border border-[#334155] space-y-1.5">
                  <h4 className="font-bold text-[#F8FAFC]">
                    ٥. الاستخدام العادل ومنع الطلبات الوهمية
                  </h4>
                  <p className="text-[#94A3B8]">
                    يلتزم المستخدم بعدم إساءة استخدام التطبيق أو إرسال طلبات وهمية أو رفع إيصالات تحويل غير حقيقية أو الامتناع المتكرر غير المبرر عن استلام الطلبات بعد تحضيرها. تحتفظ إدارة إدكاوي بحق تعليق أو حظر الحساب المخالف فوراً.
                  </p>
                </section>

                <section className="p-4 rounded-2xl bg-[#1E293B] border border-[#334155] space-y-1.5">
                  <h4 className="font-bold text-[#F8FAFC]">
                    ٦. نظام الدعوات الرسمية والملكية الفكرية
                  </h4>
                  <p className="text-[#94A3B8]">
                    تتم دعوة المتاجر والمناديب ومسؤولي المبيعات عبر روابط دعوة رسمية محددة المدة (٤٨ ساعة). جميع حقوق اسم وشعار وبرمجيات «إدكاوي / Adkawy» محفوظة ومحمية قانوناً.
                  </p>
                </section>
              </div>
            </article>
          )}

          {activeTab === 'privacy' && (
            <article className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-[#F8FAFC] flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span>ثانياً: سياسة الخصوصية وحماية البيانات وموقع GPS</span>
                </h3>
                <p className="text-xs text-[#94A3B8]">
                  متوافقة بالكامل مع قانون حماية البيانات الشخصية المصري رقم ١٥١ لسنة ٢٠٢٠.
                </p>
              </div>

              <div className="space-y-4">
                <section className="p-4 rounded-2xl bg-[#1E293B] border border-[#334155] space-y-1.5">
                  <h4 className="font-bold text-[#F8FAFC]">
                    ١. البيانات التي نجمعها والغرض الحصري منها
                  </h4>
                  <p className="text-[#94A3B8]">
                    تقتصر البيانات على ما يلزم لتشغيل الخدمة بأمان: الاسم، البريد الإلكتروني، رقم الهاتف، عناوين التوصيل، سجل الطلبات، صور الروشتات الطبية، وإيصالات شحن المحفظة، بالإضافة إلى مستندات التحقق الرسمية للمناديب والمتاجر.
                  </p>
                </section>

                <section className="p-4 rounded-2xl bg-[#1E293B] border border-emerald-500/40 space-y-2">
                  <h4 className="font-bold text-emerald-300 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    <span>٢. الموافقة الصريحة والقابلة للإلغاء على الموقع (GPS)</span>
                  </h4>
                  <p className="text-[#94A3B8]">
                    لا يتم الوصول إلى موقعك الجغرافي (GPS) إلا بعد إذنك الصريح، ويُستخدم حصراً لتحديد نقطة التوصيل داخل إدكو وبث موقع المندوب أثناء تنفيذ الطلب النشط فقط.
                  </p>
                </section>

                <section className="p-4 rounded-2xl bg-[#1E293B] border border-[#334155] space-y-1.5">
                  <h4 className="font-bold text-[#F8FAFC]">
                    ٣. سرية مستندات التحقق (KYC) والتواصل
                  </h4>
                  <p className="text-[#94A3B8]">
                    تُحفظ صور البطاقة الشخصية ورخصة القيادة وسيلفي التحقق الخاصة بالمناديب في قاعدة بيانات مؤمّنة ولا يطلع عليها سوى إدارة المراجعة المختصة في إدكاوي دون مشاركتها مع أي عميل أو طرف ثالث.
                  </p>
                </section>

                <section className="p-4 rounded-2xl bg-[#1E293B] border border-[#334155] space-y-1.5">
                  <h4 className="font-bold text-[#F8FAFC]">
                    ٤. حقوق المستخدم في الوصول والتعديل والحذف النهائي للحساب
                  </h4>
                  <p className="text-[#94A3B8]">
                    يحق لكل مستخدم الاطلاع على بياناته وتعديلها أو حذف حسابه نهائياً في أي وقت من صفحة «حسابي»، بشرط عدم وجود طلبات أو التزامات مالية نشطة قيد التنفيذ.
                  </p>
                </section>

                <section className="p-4 rounded-2xl bg-[#1E293B] border border-[#334155] space-y-2">
                  <h4 className="font-bold text-[#F8FAFC]">
                    ٥. خدمات خرائط Google
                  </h4>
                  <p className="text-[#94A3B8]">
                    يخضع استخدام ميزات تحديد العناوين والخرائط لشروط وسياسات شركة Google الرسمية:
                  </p>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <a
                      href="https://maps.google.com/help/terms_maps/?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#FF6B00] hover:underline"
                    >
                      <span>شروط خدمة خرائط Google</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <a
                      href="https://policies.google.com/privacy?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#FF6B00] hover:underline"
                    >
                      <span>سياسة خصوصية Google</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </section>
              </div>
            </article>
          )}

          {activeTab === 'refund' && (
            <article className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-[#F8FAFC]">
                  ثالثاً: سياسة الدفع وشحن المحفظة والاسترجاع
                </h3>
                <p className="text-xs text-[#94A3B8]">
                  ضوابط واضحة تحمي حقوق العميل والمتجر والمندوب في كافة المعاملات المالية.
                </p>
              </div>

              <div className="space-y-4">
                <section className="p-4 rounded-2xl bg-[#1E293B] border border-[#FF6B00]/40 space-y-2">
                  <h4 className="font-bold text-[#FF6B00]">
                    ١. قنوات الدفع وشحن محفظة إدكاوي الرسمية
                  </h4>
                  <p className="text-[#94A3B8]">
                    تتيح المنصة الدفع نقداً عند الاستلام (Cash on Delivery) أو عبر رصيد <strong className="text-[#F8FAFC]">محفظة إدكاوي</strong>. لشحن المحفظة، يتم التحويل حصراً على الأرقام الرسمية التالية مع <strong className="text-[#F8FAFC]">إرفاق صورة إيصال التحويل (إجباري)</strong> للمراجعة والاعتماد الفوري من الإدارة:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                    <div className="p-3 rounded-xl bg-[#0F172A] border border-[#334155]">
                      <span className="text-[#94A3B8] block">فودافون كاش (Vodafone Cash):</span>
                      <span dir="ltr" className="font-mono font-bold text-[#F8FAFC] text-sm">
                        01032874716
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#0F172A] border border-[#334155]">
                      <span className="text-[#94A3B8] block">إنستا باي (InstaPay):</span>
                      <span dir="ltr" className="font-mono font-bold text-[#F8FAFC] text-sm">
                        01226522676
                      </span>
                    </div>
                  </div>
                </section>

                <section className="p-4 rounded-2xl bg-[#1E293B] border border-[#334155] space-y-1.5">
                  <h4 className="font-bold text-[#F8FAFC]">
                    ٢. إلغاء الطلب من قِبل العميل
                  </h4>
                  <p className="text-[#94A3B8]">
                    يحق للعميل إلغاء الطلب مجاناً بالكامل من شاشة «طلباتي» طالما كانت حالة الطلب قيد المراجعة أو قبل بدء التجهيز الفعلي في المتجر.
                  </p>
                </section>

                <section className="p-4 rounded-2xl bg-[#1E293B] border border-[#334155] space-y-1.5">
                  <h4 className="font-bold text-[#F8FAFC]">
                    ٣. الاستبدال والاسترجاع واسترداد رصيد المحفظة
                  </h4>
                  <p className="text-[#94A3B8]">
                    يحق للعميل فحص الطلب ظاهرياً لحظة الاستلام وطلب الاستبدال الفوري عند وجود صنف تالف أو غير مطابق للفاتورة المعتمدة. في حال إلغاء طلب مدفوع من المحفظة قبل التحضير، يُرد كامل المبلغ تلقائياً لرصيد محفظة العميل.
                  </p>
                </section>
              </div>
            </article>
          )}

          {activeTab === 'pharmacy' && (
            <article className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-[#F8FAFC] flex items-center gap-2">
                  <Pill className="w-5 h-5 text-teal-400" />
                  <span>رابعاً: سياسة الصيدليات والروشتات الطبية</span>
                </h3>
                <p className="text-xs text-[#94A3B8]">
                  تنظيم استقبال الروشتات الطبية وتسعيرها وتوصيلها بالتعاون مع الصيدليات المرخصة في مدينة إدكو.
                </p>
              </div>

              <div className="space-y-4">
                <section className="p-4 rounded-2xl bg-[#1E293B] border border-teal-500/40 space-y-1.5">
                  <h4 className="font-bold text-teal-300">
                    ١. المسؤولية المهنية للصيدلي المرخص
                  </h4>
                  <p className="text-[#94A3B8]">
                    تقع مسؤولية قراءة الروشتة الطبية والتحقق من الجرعات والبدائل الدوائية والتسعير الرسمي والتغليف المحكم على عاتق الصيدلي المرخص داخل الصيدلية المستقبلة للطلب.
                  </p>
                </section>

                <section className="p-4 rounded-2xl bg-[#1E293B] border border-[#334155] space-y-1.5">
                  <h4 className="font-bold text-[#F8FAFC]">
                    ٢. نظام التسعير والموافقة المسبقة (٤ مراحل)
                  </h4>
                  <p className="text-[#94A3B8]">
                    تبدأ العملية برفع الروشتة أو كتابة الدواء، ثم تراجع الصيدلية وتُرسل التسعيرة الإجمالية، ولا يتم التحضير أو الدفع أو تسليم المندوب إلا بعد موافقة العميل الصريحة على السعر.
                  </p>
                </section>

                <section className="p-4 rounded-2xl bg-[#1E293B] border border-[#334155] space-y-1.5">
                  <h4 className="font-bold text-[#F8FAFC]">
                    ٣. الأدوية المحظور تداولها
                  </h4>
                  <p className="text-[#94A3B8]">
                    يُحظر تماماً طلب أو صرف أو توصيل الأدوية المدرجة بجداول المخدرات أو أي مستحضرات غير مسجلة بوزارة الصحة وهيئة الدواء المصرية.
                  </p>
                </section>
              </div>
            </article>
          )}

          {activeTab === 'partners' && (
            <article className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-[#F8FAFC]">
                  خامساً: ضوابط التوثيق للمتاجر والمناديب وسياسة الحظر
                </h3>
                <p className="text-xs text-[#94A3B8]">
                  معايير الاعتماد القانوني والسلامة المهنية لحماية مجتمع مستخدمي إدكاوي.
                </p>
              </div>

              <div className="space-y-4">
                <section className="p-4 rounded-2xl bg-[#1E293B] border border-[#334155] space-y-1.5">
                  <h4 className="font-bold text-[#F8FAFC]">
                    ١. التوثيق القانوني والضريبي الإجباري للمتاجر والصيدليات
                  </h4>
                  <p className="text-[#94A3B8]">
                    يُشترط لانضمام واعتماد أي متجر أو صيدلية إدخال <strong className="text-[#F8FAFC]">رقم السجل التجاري</strong> و<strong className="text-[#F8FAFC]">رقم الشهادة الضريبية</strong> وإرفاق <strong className="text-[#F8FAFC]">صورة السجل التجاري</strong>. تظهر بيانات السجل والرقم الضريبي للعملاء بصفحة كل متجر، وتلتزم المتاجر بجودة الغذاء وسلامة التغليف والالتزام بالأسعار المعلنة.
                  </p>
                </section>

                <section className="p-4 rounded-2xl bg-[#1E293B] border border-[#334155] space-y-1.5">
                  <h4 className="font-bold text-[#F8FAFC]">
                    ٢. مستندات التحقق الإجبارية لمناديب التوصيل (KYC)
                  </h4>
                  <p className="text-[#94A3B8]">
                    تخضع جميع حسابات المناديب لمراجعة إدارة إدكاوي قبل التفعيل:
                    <br />• <strong className="text-[#F8FAFC]">الموتوسيكل والسكوتر الكهربائي:</strong> صورة البطاقة الشخصية (وش وظهر) + صورة رخصة القيادة (وش وظهر) + صورة سيلفي واضحة بجانب الوجه مع الرخصة والبطاقة + صورة المركبة.
                    <br />• <strong className="text-[#F8FAFC]">الدراجة الهوائية (العجلة):</strong> معفاة من رخصة القيادة — يشترط صورة البطاقة الشخصية (وش وظهر) + سيلفي بالبطاقة بجانب الوجه + صورة الدراجة.
                  </p>
                </section>

                <section className="p-4 rounded-2xl bg-[#1E293B] border border-[#334155] space-y-1.5">
                  <h4 className="font-bold text-[#F8FAFC]">
                    ٣. حالات الحظر والتعليق والتظلم
                  </h4>
                  <p className="text-[#94A3B8]">
                    يحق للإدارة إيقاف أو حظر أي حساب أو متجر أو مندوب يثبت تلاعبه بالطلبات أو الإيصالات أو مخالفته للسلامة العامة، مع توضيح سبب الرفض أو الإيقاف وإتاحة إعادة رفع المستندات أو التواصل مع الدعم الفني للمراجعة.
                  </p>
                </section>
              </div>
            </article>
          )}
        </div>

        {/* Footer */}
        <footer className="px-6 py-4 border-t border-[#334155] bg-[#1E293B] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-[#94A3B8]">
            منصة إدكاوي (Edkawy) · مدينة إدكو
          </span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] px-5 py-2 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-sm font-bold cursor-pointer"
          >
            فهمت وموافق — إغلاق
          </button>
        </footer>
      </div>
    </div>
  );
};

/* ============================================================================
 * SYSTEM MAINTENANCE MODE SCREEN (Shown to non-admins when maintenanceMode=true)
 * ========================================================================== */

interface MaintenanceModeScreenProps {
  config: SystemMaintenanceConfig;
  isSignedIn: boolean;
  isGuestCustomer: boolean;
  onOpenAdminLogin: () => void;
  onOpenLegalModal: (section?: LegalSectionKey) => void;
  onSignOut: () => void;
}

export const MaintenanceModeScreen: React.FC<MaintenanceModeScreenProps> = ({
  config,
  isSignedIn,
  isGuestCustomer,
  onOpenAdminLogin,
  onOpenLegalModal,
  onSignOut,
}) => {
  return (
    <div
      dir="rtl"
      className="min-h-[100dvh] bg-[#0F172A] flex flex-col items-center justify-center p-6"
    >
      <div className="w-full max-w-lg rounded-2xl bg-[#1E293B] border border-[#334155] p-6 sm:p-8 text-center space-y-6 shadow-2xl">
        <div className="flex justify-center">
          <AdkawyLogo variant="navbar" />
        </div>

        <div className="w-16 h-16 rounded-2xl bg-[#FF6B00]/15 text-[#FF6B00] flex items-center justify-center mx-auto">
          <Wrench className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="inline-block text-xs font-bold text-[#FF6B00]">
            وضع الصيانة والتحديث المؤقت
          </span>
          <h1 className="text-2xl font-bold text-[#F8FAFC] headline-balance">
            منصة إدكاوي في وضع الصيانة حالياً
          </h1>
          <p className="text-sm text-[#94A3B8] leading-relaxed">
            {config.maintenanceMessage ||
              'تطبيق إدكاوي في وضع الصيانة والتحديث حالياً لرفع كفاءة الخدمة في مدينة إدكو — سنعود للعمل خلال دقائق.'}
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
          {isSignedIn && !isGuestCustomer ? (
            <button
              type="button"
              onClick={onSignOut}
              className="min-h-[46px] px-5 py-2.5 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAdminLogin}
              className="min-h-[46px] px-5 py-2.5 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>دخول الإدارة</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onOpenLegalModal('terms')}
            className="min-h-[46px] px-4 py-2.5 rounded-2xl border border-[#334155] bg-[#0F172A] text-[#F8FAFC] text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Scale className="w-4 h-4 text-[#FF6B00]" />
            <span>الشروط والسياسات</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * BLOCKED ACCOUNT / STORE SCREEN (Shown immediately when account is blocked)
 * ========================================================================== */

interface BlockedAccountScreenProps {
  blockedRecord: BlockedEntityRecord;
  onOpenLegalModal: (section?: LegalSectionKey) => void;
  onSignOut: () => void;
}

export const BlockedAccountScreen: React.FC<BlockedAccountScreenProps> = ({
  blockedRecord,
  onOpenLegalModal,
  onSignOut,
}) => {
  return (
    <div
      dir="rtl"
      className="min-h-[100dvh] bg-[#0F172A] flex flex-col items-center justify-center p-6"
    >
      <div className="w-full max-w-lg rounded-2xl bg-[#1E293B] border-2 border-red-500/40 p-6 sm:p-8 text-center space-y-6 shadow-2xl">
        <div className="flex justify-center">
          <AdkawyLogo variant="navbar" />
        </div>

        <div className="w-16 h-16 rounded-2xl bg-red-500/15 text-red-400 flex items-center justify-center mx-auto">
          <Ban className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-400">
            <ShieldAlert className="w-4 h-4" />
            <span>تم إيقاف صلاحية الحساب من إدارة إدكاوي</span>
          </span>
          <h1 className="text-2xl font-bold text-[#F8FAFC]">
            عذراً، هذا الحساب موقوف حالياً
          </h1>
          {blockedRecord.targetName && (
            <p className="text-xs font-semibold text-[#94A3B8]">
              الحساب: {blockedRecord.targetName}
            </p>
          )}
        </div>

        <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/30 text-right space-y-1">
          <p className="text-xs font-bold text-red-300">
            سبب الإيقاف المسجل من الإدارة:
          </p>
          <p className="text-sm text-red-100 leading-relaxed">
            {blockedRecord.reason || 'مخالفة شروط الاستخدام وضوابط منصة إدكاوي.'}
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
          <button
            type="button"
            onClick={onSignOut}
            className="min-h-[46px] px-5 py-2.5 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenLegalModal('partners')}
            className="min-h-[46px] px-4 py-2.5 rounded-2xl border border-[#334155] bg-[#0F172A] text-[#F8FAFC] text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Scale className="w-4 h-4 text-[#FF6B00]" />
            <span>سياسة الحسابات والحظر</span>
          </button>
        </div>
      </div>
    </div>
  );
};
