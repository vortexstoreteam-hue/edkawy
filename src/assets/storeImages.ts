import {
  AdImageKey,
  ProductImageKey,
  StoreCategory,
  StoreImageKey,
} from '../types/edkawi';

export const HERO_EDKU_IMAGE =
  '/src/assets/images/hero_edku_seafood_spread_1793116651259.jpg';

export const STORE_IMAGES: Record<StoreImageKey, string> = {
  seafood: '/src/assets/images/store_edku_fish_market_1793116674849.jpg',
  grills: '/src/assets/images/store_edku_charcoal_grills_1793116653933.jpg',
  bakery: '/src/assets/images/store_edku_bakery_pastry_1793116654893.jpg',
  grocery: '/src/assets/images/store_edku_fresh_grocery_1793116654868.jpg',
  pharmacy: '/src/assets/images/store_edku_fresh_grocery_1793116654868.jpg',
  home_food: '/src/assets/images/store_home_food_egyptian_1793790215287.jpg',
  cosmetics: '/src/assets/images/store_cosmetics_beauty_1793790215277.jpg',
  household: '/src/assets/images/store_household_essentials_1793790216390.jpg',
  clothing: '/src/assets/images/store_clothing_fashion_1793790217225.jpg',
  gifts: '/src/assets/images/store_cosmetics_beauty_1793790215277.jpg',
};

export const AD_IMAGES: Record<AdImageKey, string> = {
  promo_seafood:
    '/src/assets/images/promo_edku_seafood_offer_1793289343882.jpg',
  promo_grills:
    '/src/assets/images/promo_edku_grills_feast_1793289343584.jpg',
  seafood: '/src/assets/images/store_edku_fish_market_1793116674849.jpg',
  grills: '/src/assets/images/store_edku_charcoal_grills_1793116653933.jpg',
  bakery: '/src/assets/images/store_edku_bakery_pastry_1793116654893.jpg',
  grocery: '/src/assets/images/store_edku_fresh_grocery_1793116654868.jpg',
  pharmacy: '/src/assets/images/store_edku_fresh_grocery_1793116654868.jpg',
  home_food: '/src/assets/images/store_home_food_egyptian_1793790215287.jpg',
  cosmetics: '/src/assets/images/store_cosmetics_beauty_1793790215277.jpg',
  household: '/src/assets/images/store_household_essentials_1793790216390.jpg',
  clothing: '/src/assets/images/store_clothing_fashion_1793790217225.jpg',
  gifts: '/src/assets/images/store_cosmetics_beauty_1793790215277.jpg',
};

export const PRODUCT_IMAGES: Record<ProductImageKey, string> = {
  seafood: '/src/assets/images/store_edku_fish_market_1793116674849.jpg',
  grills: '/src/assets/images/store_edku_charcoal_grills_1793116653933.jpg',
  bakery: '/src/assets/images/store_edku_bakery_pastry_1793116654893.jpg',
  grocery: '/src/assets/images/store_edku_fresh_grocery_1793116654868.jpg',
  pharmacy: '/src/assets/images/store_edku_fresh_grocery_1793116654868.jpg',
  home_food: '/src/assets/images/store_home_food_egyptian_1793790215287.jpg',
  cosmetics: '/src/assets/images/store_cosmetics_beauty_1793790215277.jpg',
  household: '/src/assets/images/store_household_essentials_1793790216390.jpg',
  clothing: '/src/assets/images/store_clothing_fashion_1793790217225.jpg',
  gifts: '/src/assets/images/store_cosmetics_beauty_1793790215277.jpg',
  hero_seafood: '/src/assets/images/hero_edku_seafood_spread_1793116651259.jpg',
  shrimp_casserole:
    '/src/assets/images/product_shrimp_casserole_1793118739918.jpg',
  hawawshi_grill:
    '/src/assets/images/product_hawawshi_grill_1793118739778.jpg',
  savory_feteer:
    '/src/assets/images/product_savory_feteer_1793118741441.jpg',
  dairy_cheese:
    '/src/assets/images/product_dairy_cheese_pack_1793118741377.jpg',
};

export interface HeroCarouselSlide {
  id: string;
  kicker: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  targetCategory: StoreCategory | 'الكل';
  imageUrl: string;
}

export const HERO_CAROUSEL_SLIDES: readonly HeroCarouselSlide[] = [
  {
    id: 'slide_superapp_edku',
    kicker: 'توصيل إدكو المعتمد · يبدأ من 15 ج.م',
    title: 'كل احتياجات بيتك في إدكو بتطبيق واحد',
    subtitle:
      'مطاعم وبحريات، أكل بيتي أصيل، سوبر ماركت، صيدليات، ومستحضرات تجميل بتسعير توصيل جغرافي عادل.',
    ctaLabel: 'تصفح المتاجر المفتوحة',
    targetCategory: 'الكل',
    imageUrl: '/src/assets/images/hero_edku_seafood_spread_1793116651259.jpg',
  },
  {
    id: 'slide_home_food',
    kicker: 'قسم جديد · أسر منتجة ومطابخ إدكو',
    title: 'أكل بيتي سخن بطعم ونظافة البيت',
    subtitle:
      'محاشي، طواجن، مكرونة بشاميل وحلويات بيتي تتحضر طازة وتوصلك لحد باب البيت.',
    ctaLabel: 'استكشف الأكل البيتي',
    targetCategory: 'أكل بيتي',
    imageUrl: '/src/assets/images/store_home_food_egyptian_1793790215287.jpg',
  },
] as const;

