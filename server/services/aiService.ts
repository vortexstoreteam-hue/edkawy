import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

let cachedAiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  if (!cachedAiClient) {
    cachedAiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedAiClient;
}

export interface AiStoreContextItem {
  id?: string;
  name?: string;
  category?: string;
  neighborhood?: string;
  deliveryFee?: number;
  isOpen?: boolean;
  menuPreview?: string[];
  topItems?: string[];
}

export interface AiCampaignContextItem {
  title?: string;
  description?: string;
  subtitle?: string;
  type?: string;
  pointsMultiplier?: number;
}

export interface AiHistoryEntry {
  role?: string;
  text?: string;
}

const aiQuickCache = new Map<
  string,
  { reply: string; suggestedStoreId: string; expiresAt: number }
>();

function buildInstantEdkawyReply(params: {
  message: string;
  customerName: string;
  customerPoints: number;
  currentStreak: number;
  stores: AiStoreContextItem[];
  campaigns: AiCampaignContextItem[];
}): { reply: string; suggestedStoreId: string } | null {
  const normalized = params.message
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[؟?!.,،]/g, '')
    .toLowerCase();

  if (
    normalized === 'رشحلي اكله حلوه من ادكو النهارده' ||
    /^(رشحلي|اقترحلي)\s*(اكله|وجبه|مطعم|عشا|غدا|فطار)/.test(normalized)
  ) {
    const foodStores = params.stores.filter((s) => s.category !== 'صيدليات');
    const openFoodStores = foodStores.filter((s) => s.isOpen !== false);
    const chosen = openFoodStores[0] || foodStores[0];
    if (!chosen) {
      return {
        reply: `أهلاً بيك ${params.customerName}! أول ما المتاجر والمطاعم تفتح وتفعل قوائمها على إدكاوي هتلاقيها قدامك فوراً وتقدر تطلب بضغطة واحدة.`,
        suggestedStoreId: '',
      };
    }
    const items = (chosen.menuPreview || chosen.topItems || []).slice(0, 2);
    const itemsText = items.length > 0 ? ` — جرب عندهم ${items.join(' أو ')}` : '';
    const statusText =
      chosen.isOpen === false ? ' (مغلق حالياً لكن تقدر تتصفح المنيو)' : '';
    return {
      reply: `أرشحلك «${chosen.name || 'مطعم مميز'}» في ${chosen.neighborhood || 'إدكو'}${statusText}${itemsText}، والتوصيل ${Number(chosen.deliveryFee ?? 15)} ج.م بس!`,
      suggestedStoreId: chosen.id || '',
    };
  }

  if (
    normalized.includes('ازاي اطلب روشته') ||
    normalized.includes('طلب روشته') ||
    (normalized.includes('روشته') && normalized.includes('صيدليه'))
  ) {
    const openPharmacy =
      params.stores.find((s) => s.category === 'صيدليات' && s.isOpen !== false) ||
      params.stores.find((s) => s.category === 'صيدليات');
    return {
      reply: `بكل سهولة ${params.customerName}! افتح قسم «الصيدليات»، اختار الصيدلية وارفع صورة الروشتة من جهازك أو اكتب الأدوية وحدد موقعك من خريطة إدكو. الصيدلية هتسعّر الطلب وتبعتلك السعر توافق عليه الأول، وبعد موافقتك يتحضر ومندوب إدكاوي يوصلهولك لحد باب البيت.`,
      suggestedStoreId: openPharmacy?.id || '',
    };
  }

  if (
    normalized.includes('عندي كام نقطه') ||
    normalized.includes('رصيد نقاطي') ||
    (normalized.includes('نقطه') && normalized.includes('استبدل'))
  ) {
    const remainingStreak = Math.max(0, 5 - (params.currentStreak % 5));
    const voucherNote =
      params.customerPoints >= 50
        ? 'تقدر تستبدل نقاطك دلوقتي بقسيمة خصم فورية من تبويب «حسابي»!'
        : `بتكسب نقطة مع كل ١٠ ج.م بعد التسليم، وأول ما توصل ٥٠ نقطة تستبدلها بقسيمة خصم من «حسابي».`;
    return {
      reply: `رصيدك الحالي ${params.customerPoints} نقطة وسلسلة طلباتك ${params.currentStreak}/5 (فاضلك ${remainingStreak} طلب على التوصيل المجاني). ${voucherNote}`,
      suggestedStoreId: '',
    };
  }

  if (
    normalized.includes('ايه العروض والفعاليات') ||
    normalized.includes('العروض المتاحه') ||
    normalized === 'عروض النهارده'
  ) {
    if (params.campaigns.length > 0) {
      const topList = params.campaigns
        .slice(0, 2)
        .map(
          (c) =>
            `«${c.title || 'عرض إدكاوي'}»${
              Number(c.pointsMultiplier ?? 1) > 1
                ? ` (نقاط مضاعفة x${c.pointsMultiplier})`
                : ''
            }`
        )
        .join(' و');
      return {
        reply: `متاح دلوقتي في إدكاوي: ${topList}، وكمان لما تكمل ٥ طلبات بتكسب توصيل مجاني وبتجمع نقاط ولاء مع كل طلب!`,
        suggestedStoreId: '',
      };
    }
    return {
      reply: `مع كل طلب بتكسب نقطة لكل ١٠ ج.م بعد التسليم، ولما تكمل ٥ طلبات بتاخد توصيل مجاني تلقائي، وتقدر تتابع أحدث البنرات وصناديق المفاجآت في الصفحة الرئيسية!`,
      suggestedStoreId: '',
    };
  }

  if (
    normalized.includes('الدفع بالفيزا') ||
    normalized.includes('طرق الدفع') ||
    normalized.includes('ادفع ازاي')
  ) {
    return {
      reply: `الدفع المتاح حالياً في إدكاوي هو نقداً عند الاستلام (كاش للمندوب)، والدفع بالبطاقات البنكية (الفيزا) هيتفعل قريباً بإذن الله.`,
      suggestedStoreId: '',
    };
  }

  return null;
}

export async function handleAiChat(params: {
  message: string;
  customerName: string;
  customerPoints: number;
  currentStreak: number;
  stores: AiStoreContextItem[];
  campaigns: AiCampaignContextItem[];
  history: AiHistoryEntry[];
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const instantHit = buildInstantEdkawyReply(params);
  if (instantHit) {
    return { status: 200, body: { ok: true, ...instantHit } };
  }

  const storeSignature = params.stores
    .slice(0, 15)
    .map((s) => `${s.id}:${s.isOpen !== false ? 1 : 0}`)
    .join('|');
  const lastAssistantHint =
    [...params.history]
      .reverse()
      .find((h) => h.role === 'assistant')
      ?.text?.slice(0, 40) ?? '';
  const cacheKey = `${params.message.toLowerCase()}::${params.customerPoints}::${params.currentStreak}::${storeSignature}::${lastAssistantHint}`;

  const hit = aiQuickCache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) {
    return {
      status: 200,
      body: { ok: true, reply: hit.reply, suggestedStoreId: hit.suggestedStoreId },
    };
  }

  const storesCatalogSummary =
    params.stores.length > 0
      ? params.stores
          .slice(0, 15)
          .map((s) => {
            const statusLabel = s.isOpen === false ? 'مغلق' : 'مفتوح';
            const previewItems = Array.isArray(s.menuPreview)
              ? s.menuPreview
              : Array.isArray(s.topItems)
              ? s.topItems
              : [];
            const menuText =
              previewItems.length > 0
                ? ` | أصناف: ${previewItems.slice(0, 4).join('، ')}`
                : '';
            return `- [${s.id || ''}] ${s.name || 'متجر'} (${s.category || 'عام'}، ${s.neighborhood || 'إدكو'}، توصيل ${Number(s.deliveryFee ?? 15)}ج، ${statusLabel})${menuText}`;
          })
          .join('\n')
      : 'لا توجد متاجر مفعّلة حالياً في القائمة.';

  const campaignsSummary =
    params.campaigns.length > 0
      ? params.campaigns
          .slice(0, 6)
          .map(
            (c) =>
              `- ${c.title || 'فعالية'}: ${c.description || c.subtitle || ''} (x${Number(
                c.pointsMultiplier ?? 1
              )})`
          )
          .join('\n')
      : 'نقطة لكل 10 جنيه بعد التسليم، وعند إكمال 5 طلبات تحصل على توصيل مجاني.';

  const conversationHistoryText = params.history
    .slice(-3)
    .map(
      (h) =>
        `${h.role === 'assistant' ? 'المساعد' : 'العميل'}: ${String(
          h.text ?? ''
        ).slice(0, 140)}`
    )
    .join('\n');

  const systemInstruction = `أنت "مساعد إدكاوي الذكي" لتوصيل الطلبات والصيدليات في مدينة إدكو والقرى المجاورة فقط.
رد باللهجة المصرية الودودة باختصار شديد وسرعة (جملتان فقط كحد أقصى بدون مقدمات طويلة).
العميل: ${params.customerName} | نقاطه: ${params.customerPoints} | سلسلة الطلبات: ${params.currentStreak}/5.
المتاجر:
${storesCatalogSummary}
العروض:
${campaignsSummary}
القواعد:
1. رشّح من المتاجر المذكورة فقط ولا تخترع أسماء غير موجودة.
2. التوصيل متاح داخل مدينة إدكو والقرى المجاورة فقط، والدفع نقداً عند الاستلام حالياً (الفيزا قريباً).
3. للصيدليات: العميل يرفع صورة الروشتة من جهازه أو يكتب الدواء، الصيدلية تحدد السعر، والعميل يوافق قبل التحضير والتوصيل.
4. إذا رشحت متجراً محدداً من القائمة، اكتب في نهاية ردك تماماً الرمز [STORE:معرف_المتجر] فقط.`;

  const fullPrompt = conversationHistoryText
    ? `سياق سابق:\n${conversationHistoryText}\nسؤال العميل: ${params.message}`
    : params.message;

  const aiClient = getAiClient();
  let rawText = '';
  if (aiClient) {
    let response;
    try {
      response = await aiClient.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: fullPrompt,
        config: {
          systemInstruction,
          maxOutputTokens: 180,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        },
      });
    } catch {
      response = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: fullPrompt,
        config: {
          systemInstruction,
          maxOutputTokens: 180,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
    }
    rawText = (response.text ?? '').trim();
  }

  let parsedReply =
    'أهلاً بيك في إدكاوي! تقدر تسألني عن أحسن الأكلات في إدكو، الصيدليات والروشتات، أو رصيد نقاطك.';
  let suggestedStoreId = '';

  if (rawText) {
    const tagMatch = rawText.match(/\[STORE:([^\]]+)\]/i);
    if (tagMatch?.[1]) {
      const candidateId = tagMatch[1].trim();
      if (params.stores.some((s) => s.id === candidateId)) {
        suggestedStoreId = candidateId;
      }
    }
    const cleanedReply = rawText.replace(/\[STORE:[^\]]*\]/gi, '').trim();
    if (cleanedReply) parsedReply = cleanedReply;
  }

  if (aiQuickCache.size > 300) aiQuickCache.clear();
  aiQuickCache.set(cacheKey, {
    reply: parsedReply,
    suggestedStoreId,
    expiresAt: Date.now() + 90 * 1000,
  });

  return {
    status: 200,
    body: { ok: true, reply: parsedReply, suggestedStoreId },
  };
}

export async function handleVisualSearch(params: {
  imageDataUrl: string;
  productsCatalog: Array<Record<string, unknown>>;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const match = params.imageDataUrl.match(
    /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/
  );
  if (!match) {
    return {
      status: 400,
      body: {
        ok: false,
        error: 'يرجى اختيار أو التقاط صورة واضحة للأكلة من جهازك أولاً.',
      },
    };
  }

  const aiClient = getAiClient();
  if (!aiClient) {
    return {
      status: 503,
      body: {
        ok: false,
        error: 'خدمة البحث الذكي بالصور غير مفعلة حالياً على الخادم.',
      },
    };
  }

  const sanitizedCatalog = params.productsCatalog.slice(0, 120).map((item) => ({
    id: String(item.id ?? '').slice(0, 80),
    name: String(item.name ?? '').slice(0, 80),
    category: String(item.category ?? '').slice(0, 50),
    description: String(item.description ?? '').slice(0, 100),
    storeName: String(item.storeName ?? '').slice(0, 60),
    price: Number(item.price ?? 0),
  }));

  const catalogText =
    sanitizedCatalog.length > 0
      ? sanitizedCatalog
          .map(
            (p) =>
              `ID:${p.id} | ${p.name} (${p.category}) لدى ${p.storeName} - ${p.price} ج.م`
          )
          .join('\n')
      : 'لا توجد أصناف مسجلة حالياً.';

  const response = await aiClient.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: {
      parts: [
        { inlineData: { mimeType: match[1], data: match[2].replace(/\s+/g, '') } },
        {
          text: `حلل صورة الطعام أو المشروب أو المنتج المرفقة، وحدد اسم الصنف باللهجة المصرية، ثم اختر أفضل الأصناف المطابقة أو القريبة له من قائمة أصناف متاجر مدينة إدكو الحقيقية التالية فقط (لا تخترع معرّفات غير موجودة في القائمة):\n\n${catalogText}`,
        },
      ],
    },
    config: {
      systemInstruction:
        'أنت خبير طعام وتوصيل في تطبيق إدكاوي بمدينة إدكو. أرجع JSON دقيق يحتوي على اسم الأكلة المكتشفة بالعربية، كلمات مفتاحية للبحث، ومعرّفات الأصناف المطابقة من القائمة المرسلة فقط بحد أقصى 6 أصناف، مع جملة ترحيبية قصيرة.',
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          detectedDishAr: { type: Type.STRING },
          keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          matchedProductIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          summaryAr: { type: Type.STRING },
        },
        required: ['detectedDishAr', 'keywords', 'matchedProductIds', 'summaryAr'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    detectedDishAr?: string;
    keywords?: string[];
    matchedProductIds?: string[];
    summaryAr?: string;
  };

  const validIdSet = new Set(sanitizedCatalog.map((c) => c.id));
  let matchedIds = (parsed.matchedProductIds ?? []).filter((id) =>
    validIdSet.has(id)
  );

  if (matchedIds.length === 0 && Array.isArray(parsed.keywords)) {
    const kwList = parsed.keywords
      .map((k) => String(k).trim().toLowerCase())
      .filter((k) => k.length >= 2);
    matchedIds = sanitizedCatalog
      .filter((p) => {
        const hay = `${p.name} ${p.category} ${p.description}`.toLowerCase();
        return kwList.some((kw) => hay.includes(kw));
      })
      .slice(0, 6)
      .map((p) => p.id);
  }

  return {
    status: 200,
    body: {
      ok: true,
      detectedDishAr: parsed.detectedDishAr || 'وجبة شهية',
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 6) : [],
      matchedProductIds: matchedIds.slice(0, 6),
      summaryAr:
        parsed.summaryAr ||
        (matchedIds.length > 0
          ? 'لقينا لك أقرب الأصناف المتاحة حالياً في مطاعم ومتاجر إدكو!'
          : 'تعرفنا على الصورة، ولكن لا يوجد صنف مطابق تماماً متاح حالياً في المتاجر المفتوحة.'),
    },
  };
}

export async function handleMealPlan(params: {
  budgetEgp: number;
  daysCount: number;
  dietaryStyle: string;
  productsCatalog: Array<Record<string, unknown>>;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const sanitizedCatalog = params.productsCatalog
    .slice(0, 120)
    .map((item) => ({
      id: String(item.id ?? '').slice(0, 80),
      name: String(item.name ?? '').slice(0, 80),
      category: String(item.category ?? '').slice(0, 50),
      storeId: String(item.storeId ?? '').slice(0, 80),
      storeName: String(item.storeName ?? '').slice(0, 60),
      price: Math.max(1, Math.trunc(Number(item.price ?? 0))),
    }))
    .filter((item) => item.id && item.storeId && item.price > 0);

  if (sanitizedCatalog.length === 0) {
    return {
      status: 400,
      body: {
        ok: false,
        error: 'لا توجد أصناف متاحة حالياً في المتاجر المفتوحة لبناء خطة وجبات حقيقية.',
      },
    };
  }

  const aiClient = getAiClient();
  if (!aiClient) {
    return {
      status: 503,
      body: {
        ok: false,
        error: 'خدمة مخطط الوجبات الذكي غير مفعلة حالياً على الخادم.',
      },
    };
  }

  const catalogLines = sanitizedCatalog
    .map(
      (p) =>
        `PRODUCT_ID:${p.id} | STORE_ID:${p.storeId} | ${p.name} لدى ${p.storeName} (${p.category}) = ${p.price} ج.م`
    )
    .join('\n');

  const response = await aiClient.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: `صمّم جدول وجبات عملي لمدة ${params.daysCount} أيام بميزانية إجمالية تقريبية ${params.budgetEgp} ج.م وأسلوب غذائي "${params.dietaryStyle}" للعميل في مدينة إدكو، باستخدام الأصناف الحقيقية التالية فقط (التزم تماماً بـ PRODUCT_ID و STORE_ID والأسعار الفعلية):\n\n${catalogLines}`,
    config: {
      systemInstruction:
        'أنت خبير تغذية وتوفير ذكي في تطبيق إدكاوي بمدينة إدكو. اختَر وجبة حقيقية لكل يوم من القائمة المرسلة بحيث يناسب مجموع الأسعار الميزانية المطلوبة قدر الإمكان دون اختراع أي صنف خارج القائمة.',
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          planTitleAr: { type: Type.STRING },
          summaryNoteAr: { type: Type.STRING },
          days: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                dayNumber: { type: Type.INTEGER },
                dayLabelAr: { type: Type.STRING },
                mealDescriptionAr: { type: Type.STRING },
                productId: { type: Type.STRING },
              },
              required: ['dayNumber', 'dayLabelAr', 'mealDescriptionAr', 'productId'],
            },
          },
        },
        required: ['planTitleAr', 'summaryNoteAr', 'days'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    planTitleAr?: string;
    summaryNoteAr?: string;
    days?: Array<{
      dayNumber?: number;
      dayLabelAr?: string;
      mealDescriptionAr?: string;
      productId?: string;
    }>;
  };

  const catalogById = new Map(sanitizedCatalog.map((p) => [p.id, p]));
  const fallbackSorted = [...sanitizedCatalog].sort((a, b) => a.price - b.price);

  const resolvedDays = Array.from({ length: params.daysCount }, (_, idx) => {
    const aiDay = parsed.days?.[idx];
    const matchedProd =
      (aiDay?.productId ? catalogById.get(aiDay.productId) : undefined) ??
      fallbackSorted[idx % fallbackSorted.length];
    return {
      dayNumber: idx + 1,
      dayLabelAr: aiDay?.dayLabelAr || `اليوم ${idx + 1}`,
      mealDescriptionAr:
        aiDay?.mealDescriptionAr ||
        `وجبة مختارة من ${matchedProd.storeName} تناسب نظام (${params.dietaryStyle})`,
      productId: matchedProd.id,
      productName: matchedProd.name,
      storeId: matchedProd.storeId,
      storeName: matchedProd.storeName,
      priceEgp: matchedProd.price,
    };
  });

  const totalEstimatedEgp = resolvedDays.reduce((sum, d) => sum + d.priceEgp, 0);

  return {
    status: 200,
    body: {
      ok: true,
      planTitleAr:
        parsed.planTitleAr || `خطة وجبات ${params.dietaryStyle} لمدة ${params.daysCount} أيام`,
      totalEstimatedEgp,
      budgetEgp: params.budgetEgp,
      summaryNoteAr:
        parsed.summaryNoteAr ||
        `إجمالي تكلفة الوجبات المقترحة ${totalEstimatedEgp} ج.م من متاجر إدكو المتاحة الآن.`,
      days: resolvedDays,
    },
  };
}

export async function handleMenuOcr(params: {
  rawImageDataUrl: string;
  storeCategoryHint: string;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const match = params.rawImageDataUrl.match(
    /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/
  );
  if (!match) {
    return {
      status: 400,
      body: {
        ok: false,
        items: [],
        error: 'يرجى رفع صورة واضحة لقائمة الطعام أو كتالوج المنتجات من جهازك أولاً.',
      },
    };
  }

  const aiClient = getAiClient();
  if (!aiClient) {
    return {
      status: 503,
      body: {
        ok: false,
        items: [],
        error: 'خدمة مسح المنيو بالذكاء الاصطناعي غير مفعلة حالياً على الخادم.',
      },
    };
  }

  const response = await aiClient.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: {
      parts: [
        { inlineData: { mimeType: match[1], data: match[2].replace(/\s+/g, '') } },
        {
          text: `استخرج جميع الأصناف والمنتجات الواضحة مع أسعارها بالجنيه المصري من صورة المنيو أو الكتالوج المرفقة لمتجر بتصنيف "${params.storeCategoryHint}". إذا كان للصنف أكثر من حجم، اكتب الحجم الأساسي وسعره بوضوح، وضع وصفاً مختصراً وتصنيفاً فرعياً مناسباً بالعربية.`,
        },
      ],
    },
    config: {
      systemInstruction:
        'أنت محلل قوائم طعام ومنتجات دقيق لمنصة إدكاوي في مدينة إدكو. استخرج الأصناف الموجودة فعلياً في الصورة فقط بدون اختراع أي بيانات وهمية، وأرجع الأسعار كأرقام صحيحة بالجنيه المصري.',
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                price: { type: Type.INTEGER },
                category: { type: Type.STRING },
                description: { type: Type.STRING },
              },
              required: ['name', 'price', 'category', 'description'],
            },
          },
        },
        required: ['items'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{"items":[]}').trim()) as {
    items?: Array<{
      name?: string;
      price?: number;
      category?: string;
      description?: string;
    }>;
  };

  const sanitizedItems = (Array.isArray(parsed.items) ? parsed.items : [])
    .slice(0, 35)
    .map((raw) => {
      const name = String(raw.name ?? '').trim().slice(0, 80);
      const rawPrice = Math.round(Number(raw.price ?? 0));
      const price =
        Number.isFinite(rawPrice) && rawPrice >= 1
          ? Math.min(5000, rawPrice)
          : 0;
      const category =
        String(raw.category ?? '').trim().slice(0, 40) ||
        params.storeCategoryHint ||
        'أصناف متنوعة';
      const rawDesc = String(raw.description ?? '').trim();
      const description =
        rawDesc.length >= 4
          ? rawDesc.slice(0, 200)
          : `${name} — متاح طازجاً عبر منصة إدكاوي`.slice(0, 200);
      return { name, price, category, description };
    })
    .filter((item) => item.name.length >= 2 && item.price >= 1);

  if (sanitizedItems.length === 0) {
    return {
      status: 422,
      body: {
        ok: false,
        items: [],
        error: 'لم نتمكن من قراءة أصناف وأسعار واضحة من هذه الصورة. يرجى تجربة صورة أوضح للقائمة.',
      },
    };
  }

  return {
    status: 200,
    body: { ok: true, items: sanitizedItems },
  };
}
