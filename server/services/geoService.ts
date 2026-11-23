interface CachedEdkuWeather {
  tempC: number;
  conditionLabel: string;
  mood: 'cold_rainy' | 'hot_sunny' | 'pleasant_breezy';
  headlineAr: string;
  subtextAr: string;
  recommendedCategory: string;
  source: 'openweather' | 'open_meteo';
  expiresAt: number;
}

interface GoogleGeocodeAddressComponent {
  long_name?: string;
  short_name?: string;
  types?: string[];
}

interface GoogleGeocodeResultItem {
  formatted_address?: string;
  types?: string[];
  address_components?: GoogleGeocodeAddressComponent[];
}

interface GoogleGeocodeApiPayload {
  status?: string;
  error_message?: string;
  results?: GoogleGeocodeResultItem[];
}

let cachedEdkuWeather: CachedEdkuWeather | null = null;
const reverseGeocodeCache = new Map<
  string,
  { formattedAddress: string; shortAddress: string; isWaterBody: boolean; expiresAt: number }
>();

function isLikelyWaterBodyCoordinateInEdku(lat: number, lng: number): boolean {
  if (lat > 31.331) return true;
  if (lat < 31.268 && lng < 30.285 && lat > 31.19 && lng > 30.14) return true;
  return false;
}

function stripPlusCodePrefix(address: string): string {
  return address
    .replace(/^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,4}[،,\s-]*/i, '')
    .trim();
}

export async function reverseGeocodeEdku(
  lat: number,
  lng: number
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (isLikelyWaterBodyCoordinateInEdku(lat, lng)) {
    return {
      status: 200,
      body: {
        ok: true,
        isWaterBody: true,
        formattedAddress: 'مسطح مائي (البحر المتوسط / بحيرة إدكو)',
        shortAddress: 'مسطح مائي غير صالح للتوصيل',
      },
    };
  }

  const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const cached = reverseGeocodeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      status: 200,
      body: {
        ok: true,
        isWaterBody: cached.isWaterBody,
        formattedAddress: cached.formattedAddress,
        shortAddress: cached.shortAddress,
      },
    };
  }

  const mapsKey = (
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    ''
  ).trim();

  if (!mapsKey) {
    return {
      status: 503,
      body: {
        ok: false,
        error: 'خدمة العناوين غير مفعّلة حالياً.',
      },
    };
  }

  const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(
    `${lat},${lng}`
  )}&language=ar&solution_id=gmp_mcp_codeassist_v1_aistudio&key=${encodeURIComponent(
    mapsKey
  )}`;

  const upstreamRes = await fetch(geocodeUrl, {
    signal: AbortSignal.timeout(6500),
  });
  const payload = (await upstreamRes.json()) as GoogleGeocodeApiPayload;

  if (
    upstreamRes.status === 429 ||
    payload.status === 'OVER_QUERY_LIMIT' ||
    payload.status === 'RESOURCE_EXHAUSTED'
  ) {
    return {
      status: 429,
      body: {
        ok: false,
        quotaExceeded: true,
        error: 'تم الوصول للحد اليومي لخدمة الخرائط.',
      },
    };
  }

  if (payload.status === 'ZERO_RESULTS') {
    return {
      status: 200,
      body: {
        ok: true,
        isWaterBody: true,
        formattedAddress: 'منطقة بحرية غير مأهولة',
        shortAddress: 'خارج اليابسة',
      },
    };
  }

  if (
    payload.status !== 'OK' ||
    !Array.isArray(payload.results) ||
    payload.results.length === 0
  ) {
    return {
      status: 404,
      body: {
        ok: false,
        error:
          'تعذر استخراج اسم الشارع تلقائياً لهذا الموقع، يمكنك كتابة أقرب علامة مميزة.',
      },
    };
  }

  const waterTypes = new Set([
    'natural_feature',
    'ocean',
    'sea',
    'body_of_water',
    'bay',
    'lake',
  ]);
  const waterKeywords = [
    'البحر المتوسط',
    'بحيرة إدكو',
    'بحيرة ادكو',
    'mediterranean sea',
    'lake idku',
    'lake edku',
  ];

  const topResult = payload.results[0];
  const hasLandResult = payload.results.some(
    (r) =>
      Array.isArray(r.types) &&
      (r.types.includes('street_address') ||
        r.types.includes('route') ||
        r.types.includes('premise') ||
        r.types.includes('sublocality') ||
        r.types.includes('neighborhood') ||
        r.types.includes('locality'))
  );

  const topIsExplicitWater =
    (Array.isArray(topResult?.types) &&
      topResult.types.some((t) => waterTypes.has(t))) ||
    waterKeywords.some((kw) =>
      (topResult?.formatted_address || '').toLowerCase().includes(kw)
    );

  if (topIsExplicitWater && !hasLandResult) {
    if (reverseGeocodeCache.size > 500) reverseGeocodeCache.clear();
    reverseGeocodeCache.set(cacheKey, {
      formattedAddress: topResult?.formatted_address || 'مسطح مائي',
      shortAddress: 'مسطح مائي',
      isWaterBody: true,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });
    return {
      status: 200,
      body: {
        ok: true,
        isWaterBody: true,
        formattedAddress: topResult?.formatted_address || 'مسطح مائي',
        shortAddress: 'مسطح مائي',
      },
    };
  }

  const preferredResult =
    payload.results.find(
      (r) =>
        Array.isArray(r.types) &&
        !r.types.includes('plus_code') &&
        (r.types.includes('street_address') ||
          r.types.includes('route') ||
          r.types.includes('premise') ||
          r.types.includes('sublocality') ||
          r.types.includes('neighborhood'))
    ) ||
    payload.results.find(
      (r) => Array.isArray(r.types) && !r.types.includes('plus_code')
    ) ||
    payload.results[0];

  const rawFormatted = (preferredResult?.formatted_address || '').trim();
  const cleanedFormatted = stripPlusCodePrefix(rawFormatted) || rawFormatted;

  const comps = preferredResult?.address_components || [];
  const pickComp = (wantedTypes: string[]) =>
    comps.find(
      (c) =>
        Array.isArray(c.types) &&
        wantedTypes.some((wt) => c.types?.includes(wt))
    )?.long_name || '';

  const routeName = pickComp(['route', 'street_address', 'premise', 'point_of_interest']);
  const areaName = pickComp([
    'neighborhood',
    'sublocality_level_1',
    'sublocality',
    'administrative_area_level_3',
    'locality',
  ]);
  const cityName = pickComp(['locality', 'administrative_area_level_2']);

  const shortParts = [routeName, areaName, cityName]
    .map((p) => p.trim())
    .filter((p, idx, arr) => p.length > 0 && arr.indexOf(p) === idx);

  const shortAddress =
    shortParts.length > 0 ? shortParts.join('، ') : cleanedFormatted;

  if (reverseGeocodeCache.size > 500) reverseGeocodeCache.clear();
  reverseGeocodeCache.set(cacheKey, {
    formattedAddress: cleanedFormatted,
    shortAddress,
    isWaterBody: false,
    expiresAt: Date.now() + 60 * 60 * 1000,
  });

  return {
    status: 200,
    body: {
      ok: true,
      isWaterBody: false,
      formattedAddress: cleanedFormatted,
      shortAddress,
    },
  };
}

export async function getEdkuWeatherPromo(): Promise<{
  status: number;
  body: Record<string, unknown>;
}> {
  if (cachedEdkuWeather && cachedEdkuWeather.expiresAt > Date.now()) {
    return {
      status: 200,
      body: {
        ok: true,
        tempC: cachedEdkuWeather.tempC,
        conditionLabel: cachedEdkuWeather.conditionLabel,
        mood: cachedEdkuWeather.mood,
        headlineAr: cachedEdkuWeather.headlineAr,
        subtextAr: cachedEdkuWeather.subtextAr,
        recommendedCategory: cachedEdkuWeather.recommendedCategory,
        source: cachedEdkuWeather.source,
      },
    };
  }

  const EDKU_LAT = 31.3069;
  const EDKU_LON = 30.2981;
  let tempC = 24;
  let isRainy = false;
  let source: 'openweather' | 'open_meteo' = 'open_meteo';

  const openWeatherKey = (process.env.OPENWEATHER_API_KEY || '').trim();
  let fetchedOk = false;

  if (openWeatherKey) {
    try {
      const owRes = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${EDKU_LAT}&lon=${EDKU_LON}&units=metric&lang=ar&appid=${encodeURIComponent(
          openWeatherKey
        )}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (owRes.ok) {
        const owData = (await owRes.json()) as {
          main?: { temp?: number };
          weather?: Array<{ main?: string }>;
        };
        if (typeof owData.main?.temp === 'number') {
          tempC = Math.round(owData.main.temp);
          const weatherMain = String(owData.weather?.[0]?.main || '').toLowerCase();
          isRainy =
            weatherMain.includes('rain') ||
            weatherMain.includes('drizzle') ||
            weatherMain.includes('thunderstorm');
          source = 'openweather';
          fetchedOk = true;
        }
      }
    } catch {
      // Fall through to Open-Meteo
    }
  }

  if (!fetchedOk) {
    const omRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${EDKU_LAT}&longitude=${EDKU_LON}&current=temperature_2m,weather_code,wind_speed_10m`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!omRes.ok) {
      return {
        status: 502,
        body: {
          ok: false,
          error: 'تعذر قراءة حالة الطقس الحية في إدكو حالياً.',
        },
      };
    }
    const omData = (await omRes.json()) as {
      current?: { temperature_2m?: number; weather_code?: number };
    };
    tempC = Math.round(Number(omData.current?.temperature_2m ?? 24));
    const wCode = Number(omData.current?.weather_code ?? 0);
    isRainy = wCode >= 51 && wCode <= 99;
    source = 'open_meteo';
  }

  let mood: 'cold_rainy' | 'hot_sunny' | 'pleasant_breezy' = 'pleasant_breezy';
  let conditionLabel = 'أجواء معتدلة على بحر إدكو';
  let headlineAr = `الطقس الآن في إدكو ${tempC}°م — أجواء مثالية لأكلة بحرية أو مشويات سخنة!`;
  let subtextAr = 'استمتع بأسرع توصيل لحد باب البيت في كل أحياء إدكو والقرى المجاورة.';
  let recommendedCategory = 'مشويات ومطاعم';

  if (isRainy || tempC <= 18) {
    mood = 'cold_rainy';
    conditionLabel = isRainy ? 'أجواء ممطرة وباردة في إدكو' : 'أجواء شتوية باردة في إدكو';
    headlineAr = `الجو في إدكو دلوقتي ${tempC}°م — محتاج مشروب دافي، شوربة سي فود أو مخبوزات وحلويات سخنة تدفيك!`;
    subtextAr = 'اطلبها دلوقتي وكابتن إدكاوي يوصلهالك سخنة لحد باب بيتك.';
    recommendedCategory = 'مخابز وفطائر';
  } else if (tempC >= 29) {
    mood = 'hot_sunny';
    conditionLabel = 'أجواء مشمسة وحارة في إدكو';
    headlineAr = `الحرارة في إدكو ${tempC}°م — روّق على نفسك بمشروبات وحلويات باردة ومنعشة!`;
    subtextAr = 'توصيل سريع يحافظ على انتعاش طلبك في كل شوارع إدكو.';
    recommendedCategory = 'مخابز وفطائر';
  } else {
    mood = 'pleasant_breezy';
    conditionLabel = 'نسيم معتدل في مدينة إدكو';
    headlineAr = `الجو في إدكو رائع (${tempC}°م) — وقت مثالي لوجبة مشويات أو أسماك إدكاوية طازة مع العيلة!`;
    subtextAr = 'تصفح المطاعم المفتوحة الآن واطلب بضغطة واحدة.';
    recommendedCategory = 'أسماك وبحريات';
  }

  cachedEdkuWeather = {
    tempC,
    conditionLabel,
    mood,
    headlineAr,
    subtextAr,
    recommendedCategory,
    source,
    expiresAt: Date.now() + 10 * 60 * 1000,
  };

  return {
    status: 200,
    body: {
      ok: true,
      tempC,
      conditionLabel,
      mood,
      headlineAr,
      subtextAr,
      recommendedCategory,
      source,
    },
  };
}
