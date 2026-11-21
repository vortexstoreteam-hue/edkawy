import {
  EdkoZoneId,
  EdkoZoneRecord,
  ProductImageKey,
  StoreCategory,
  StoreImageKey,
  SuperAppCategoryRecord,
} from '../types/edkawi';

export const EDKU_CITY_CENTER = {
  lat: 31.3069,
  lng: 30.2981,
} as const;

/**
 * Geographic bounding box strictly covering Markaz Edku & its neighboring villages:
 * المناطق الخمس المعتمدة لمدينة إدكو، المعدية، منشية ديبونو، وقرى 6 أكتوبر والعزب.
 */
export const EDKU_SERVICE_BOUNDS = {
  north: 31.365,
  south: 31.21,
  west: 30.175,
  east: 30.395,
} as const;

/**
 * Strictly Approved 5 Edku Delivery Zones (`edko_zones` Firestore collection baseline).
 */
export const APPROVED_EDKO_ZONES: readonly EdkoZoneRecord[] = [
  {
    id: 'zone_1',
    zoneNumber: 1,
    name: 'منطقة 1 (0-2 كم)',
    distanceRangeLabel: '0-2 كم',
    areaTitle: 'القلب التجاري',
    streetsAndNeighborhoods: [
      'شارع المحطة',
      'سعد زغلول',
      'الجمهورية',
      'محمد عبده',
      'شارع البحر',
      'بورسعيد',
      'الجيش',
      'الصنية',
    ],
    deliveryFee: 15,
    isActive: true,
  },
  {
    id: 'zone_2',
    zoneNumber: 2,
    name: 'منطقة 2 (2-4 كم)',
    distanceRangeLabel: '2-4 كم',
    areaTitle: 'الأحياء السكنية القريبة',
    streetsAndNeighborhoods: [
      'الطويبة',
      'سيدي إبراهيم',
      'العراقية',
      'الشلبي',
      'القائد جوهر',
      'أحمد عرابي',
    ],
    deliveryFee: 20,
    isActive: true,
  },
  {
    id: 'zone_3',
    zoneNumber: 3,
    name: 'منطقة 3 (4-6 كم)',
    distanceRangeLabel: '4-6 كم',
    areaTitle: 'الأحياء ذات الطابع الخاص',
    streetsAndNeighborhoods: [
      'كوم الطواحين',
      'الصباغ',
      'طريق الملح',
      'شارع المصيف',
    ],
    deliveryFee: 25,
    isActive: true,
  },
  {
    id: 'zone_4',
    zoneNumber: 4,
    name: 'منطقة 4 (6-8 كم)',
    distanceRangeLabel: '6-8 كم',
    areaTitle: 'الوحدات المحلية والقرى المجاورة',
    streetsAndNeighborhoods: ['المعدية', 'منشية ديبونو'],
    deliveryFee: 30,
    isActive: true,
  },
  {
    id: 'zone_5',
    zoneNumber: 5,
    name: 'منطقة 5 (أكثر من 8 كم)',
    distanceRangeLabel: 'أكثر من 8 كم',
    areaTitle: 'القرى البعيدة',
    streetsAndNeighborhoods: [
      '6 أكتوبر',
      'العزب',
      'المناطق الزراعية البعيدة',
    ],
    deliveryFee: 35,
    isActive: true,
  },
] as const;

export const APPROVED_EDKO_ZONE_IDS: readonly EdkoZoneId[] = [
  'zone_1',
  'zone_2',
  'zone_3',
  'zone_4',
  'zone_5',
] as const;

export const DEFAULT_SUPER_APP_CATEGORIES: readonly SuperAppCategoryRecord[] = [
  {
    id: 'home_food',
    name: 'أكل بيتي',
    storeCategory: 'أكل بيتي',
    icon: 'ChefHat',
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'seafood',
    name: 'أسماك وبحريات',
    storeCategory: 'أسماك وبحريات',
    icon: 'Fish',
    isActive: true,
    sortOrder: 2,
  },
  {
    id: 'grills',
    name: 'مشويات ومطاعم',
    storeCategory: 'مشويات ومطاعم',
    icon: 'UtensilsCrossed',
    isActive: true,
    sortOrder: 3,
  },
  {
    id: 'bakery',
    name: 'مخابز وفطائر',
    storeCategory: 'مخابز وفطائر',
    icon: 'Croissant',
    isActive: true,
    sortOrder: 4,
  },
  {
    id: 'supermarket',
    name: 'سوبر ماركت',
    storeCategory: 'سوبر ماركت',
    icon: 'ShoppingBasket',
    isActive: true,
    sortOrder: 5,
  },
  {
    id: 'pharmacy',
    name: 'صيدليات',
    storeCategory: 'صيدليات',
    icon: 'Pill',
    isActive: true,
    sortOrder: 6,
  },
  {
    id: 'cosmetics',
    name: 'مستحضرات تجميل',
    storeCategory: 'مستحضرات تجميل',
    icon: 'Sparkles',
    isActive: true,
    sortOrder: 7,
  },
  {
    id: 'gifts',
    name: 'هدايا وإكسسوارات',
    storeCategory: 'هدايا وإكسسوارات',
    icon: 'Gift',
    isActive: true,
    sortOrder: 8,
  },
] as const;

export function resolveCategoryIdForStoreCategory(
  category: StoreCategory
): string {
  switch (category) {
    case 'أكل بيتي':
      return 'home_food';
    case 'أسماك وبحريات':
      return 'seafood';
    case 'مشويات ومطاعم':
      return 'grills';
    case 'مخابز وفطائر':
      return 'bakery';
    case 'سوبر ماركت':
      return 'supermarket';
    case 'صيدليات':
      return 'pharmacy';
    case 'مستحضرات تجميل':
      return 'cosmetics';
    case 'أدوات منزلية':
      return 'household';
    case 'ملابس':
      return 'clothing';
    case 'هدايا وإكسسوارات':
      return 'gifts';
  }
}

export function resolveStoreImageKeyForCategory(
  category: StoreCategory
): StoreImageKey {
  switch (category) {
    case 'أسماك وبحريات':
      return 'seafood';
    case 'مشويات ومطاعم':
      return 'grills';
    case 'مخابز وفطائر':
      return 'bakery';
    case 'سوبر ماركت':
      return 'grocery';
    case 'صيدليات':
      return 'pharmacy';
    case 'أكل بيتي':
      return 'home_food';
    case 'مستحضرات تجميل':
      return 'cosmetics';
    case 'أدوات منزلية':
      return 'household';
    case 'ملابس':
      return 'clothing';
    case 'هدايا وإكسسوارات':
      return 'gifts';
  }
}

export function resolveProductImageKeyForStoreCategory(
  category: StoreCategory
): ProductImageKey {
  return resolveStoreImageKeyForCategory(category);
}

export function isWithinEdkuServiceBounds(lat?: number, lng?: number): boolean {
  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return false;
  }
  return (
    lat >= EDKU_SERVICE_BOUNDS.south &&
    lat <= EDKU_SERVICE_BOUNDS.north &&
    lng >= EDKU_SERVICE_BOUNDS.west &&
    lng <= EDKU_SERVICE_BOUNDS.east
  );
}

export function clampToEdkuServiceBounds(
  lat: number,
  lng: number
): { lat: number; lng: number } {
  return {
    lat: Number(
      Math.min(
        EDKU_SERVICE_BOUNDS.north,
        Math.max(EDKU_SERVICE_BOUNDS.south, lat)
      ).toFixed(6)
    ),
    lng: Number(
      Math.min(
        EDKU_SERVICE_BOUNDS.east,
        Math.max(EDKU_SERVICE_BOUNDS.west, lng)
      ).toFixed(6)
    ),
  };
}

export const EDKU_NEIGHBORHOOD_COORDS: Record<
  string,
  { lat: number; lng: number }
> = {
  // Zone 1 (0-2 km — القلب التجاري)
  'شارع المحطة': { lat: 31.3046, lng: 30.3005 },
  'سعد زغلول': { lat: 31.3064, lng: 30.2988 },
  'الجمهورية': { lat: 31.3075, lng: 30.2979 },
  'محمد عبده': { lat: 31.3059, lng: 30.2971 },
  'شارع البحر': { lat: 31.3118, lng: 30.2952 },
  'بورسعيد': { lat: 31.3083, lng: 30.2994 },
  'الجيش': { lat: 31.3069, lng: 30.3012 },
  'الصنية': { lat: 31.3052, lng: 30.2984 },
  'وسط البلد - السوق': { lat: 31.3072, lng: 30.2983 },
  'حي المحطة': { lat: 31.3046, lng: 30.3005 },
  // Zone 2 (2-4 km — الأحياء السكنية القريبة)
  'الطويبة': { lat: 31.3021, lng: 30.2935 },
  'سيدي إبراهيم': { lat: 31.3098, lng: 30.3038 },
  'العراقية': { lat: 31.3032, lng: 30.3058 },
  'الشلبي': { lat: 31.3106, lng: 30.2921 },
  'القائد جوهر': { lat: 31.3089, lng: 30.2941 },
  'أحمد عرابي': { lat: 31.3041, lng: 30.2958 },
  'حي النزهة': { lat: 31.3095, lng: 30.2968 },
  // Zone 3 (4-6 km — الأحياء ذات الطابع الخاص)
  'كوم الطواحين': { lat: 31.2985, lng: 30.2912 },
  'الصباغ': { lat: 31.2996, lng: 30.3072 },
  'طريق الملح': { lat: 31.3162, lng: 30.2895 },
  'شارع المصيف': { lat: 31.3215, lng: 30.2932 },
  'كوم بلاج': { lat: 31.2935, lng: 30.2785 },
  'كوبري شربت': { lat: 31.3024, lng: 30.3042 },
  // Zone 4 (6-8 km — الوحدات المحلية والقرى المجاورة)
  'المعدية': { lat: 31.3254, lng: 30.2145 },
  'منشية ديبونو': { lat: 31.2815, lng: 30.321 },
  'منشية دبونو': { lat: 31.2815, lng: 30.321 },
  'قرية ديبونو': { lat: 31.2865, lng: 30.3125 },
  // Zone 5 (>8 km — القرى البعيدة)
  '6 أكتوبر': { lat: 31.262, lng: 30.335 },
  'العزب': { lat: 31.254, lng: 30.312 },
  'المناطق الزراعية البعيدة': { lat: 31.248, lng: 30.284 },
  'طريق رشيد - إدكو': { lat: 31.3134, lng: 30.3098 },
  'قرى خط رشيد - إدكو': { lat: 31.3185, lng: 30.338 },
  'قرى بحيرة إدكو': { lat: 31.268, lng: 30.289 },
};

export function resolveZoneForNeighborhood(
  neighborhood?: string,
  zones: readonly EdkoZoneRecord[] = APPROVED_EDKO_ZONES
): EdkoZoneRecord {
  const activeZones = zones.length > 0 ? zones : APPROVED_EDKO_ZONES;
  const fallbackZone =
    activeZones.find((z) => z.id === 'zone_1') ?? activeZones[0];
  if (!neighborhood) return fallbackZone;
  const clean = neighborhood.trim();

  const exactHit = activeZones.find((z) =>
    z.streetsAndNeighborhoods.some(
      (st) => clean.includes(st) || st.includes(clean)
    )
  );
  if (exactHit) return exactHit;

  if (clean.includes('النزهة')) {
    return activeZones.find((z) => z.id === 'zone_2') ?? fallbackZone;
  }
  if (clean.includes('كوم') || clean.includes('شربت')) {
    return activeZones.find((z) => z.id === 'zone_3') ?? fallbackZone;
  }
  if (clean.includes('المعدية') || clean.includes('ديبونو') || clean.includes('دبونو')) {
    return activeZones.find((z) => z.id === 'zone_4') ?? fallbackZone;
  }
  if (
    clean.includes('أكتوبر') ||
    clean.includes('العزب') ||
    clean.includes('قرى') ||
    clean.includes('رشيد')
  ) {
    return activeZones.find((z) => z.id === 'zone_5') ?? fallbackZone;
  }

  return fallbackZone;
}

export function resolveEdkuCoordsForNeighborhood(neighborhood?: string): {
  lat: number;
  lng: number;
} {
  if (!neighborhood) return EDKU_CITY_CENTER;
  return EDKU_NEIGHBORHOOD_COORDS[neighborhood.trim()] || EDKU_CITY_CENTER;
}

/**
 * Resolves the closest Edku neighborhood or neighboring village name from map pin coordinates (lat/lng).
 */
export function resolveNearestEdkuNeighborhood(
  lat: number,
  lng: number
): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return 'شارع المحطة';
  }
  let closestName = 'شارع المحطة';
  let minDistSq = Number.POSITIVE_INFINITY;

  for (const [name, coords] of Object.entries(EDKU_NEIGHBORHOOD_COORDS)) {
    const dLat = lat - coords.lat;
    const dLng = lng - coords.lng;
    const distSq = dLat * dLat + dLng * dLng;
    if (distSq < minDistSq) {
      minDistSq = distSq;
      closestName = name;
    }
  }
  return closestName;
}

/**
 * Legacy demo document IDs used solely by Admin 1-click purge ("مسح البيانات التجريبية القديمة").
 * Automatic seeding is disabled in production.
 */
export const LEGACY_DEMO_STORE_IDS: readonly string[] = [
  'edku_bahr_seafood',
  'edku_mahatta_grills',
  'edku_aseel_bakery',
  'edku_baraka_market',
] as const;

export const LEGACY_DEMO_PRODUCT_IDS: readonly string[] = [
  'prod_bahr_mullet',
  'prod_bahr_shrimp_tagine',
  'prod_bahr_seabream',
  'prod_bahr_soup',
  'prod_grills_kofta',
  'prod_grills_hawawshi',
  'prod_grills_shish',
  'prod_grills_mixed',
  'prod_bakery_baladi_feteer',
  'prod_bakery_sujuk_feteer',
  'prod_bakery_cheese_feteer',
  'prod_bakery_qoras',
  'prod_market_veg_basket',
  'prod_market_dairy_pack',
  'prod_market_milk',
  'prod_market_honey',
] as const;

export const LEGACY_DEMO_AD_IDS: readonly string[] = [
  'ad_edku_seafood_1',
  'ad_edku_grills_2',
] as const;

export const LEGACY_DEMO_COUPON_IDS: readonly string[] = [
  'ADKO50',
  'ADKAWY20',
] as const;

