import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarClock,
  Check,
  ChefHat,
  Clock,
  Eye,
  Gift,
  Headphones,
  Layers,
  LogOut,
  MapPin,
  Menu,
  PackageCheck,
  Phone,
  Pill,
  Plus,
  Printer,
  ScanLine,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Star,
  Store as StoreIcon,
  Trash2,
  UtensilsCrossed,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { resolveEdkuCoordsForNeighborhood } from '../data/edkuSeedStores';
import {
  addBatchProductsFromOcrInFirestore,
  deleteCurrentAccountCompletely,
  extractMenuItemsFromImageWithAi,
  updateProductFlashSaleInFirestore,
} from '../services/edkawiFirebaseService';
import {
  NewProductInput,
  OcrExtractedMenuItem,
  OrderRecord,
  ProductRecord,
  ProductVariant,
  ReviewRecord,
  StoreOperationalSettingsInput,
  StoreRecord,
} from '../types/edkawi';
import {
  calculateStoreDashboardStats,
  filterProductsByCategoryAndQuery,
  formatAppErrorMessage,
  getOrderStatusLabel,
  getPaymentMethodLabel,
  isStoreCurrentlyOpen,
  validateNewProductForm,
  validateStoreSettingsForm,
} from '../utils/orderLogic';
import { AdkawyLogo } from './AdkawyLogo';
import { DeviceImageInput } from './DeviceImageInput';
import { EdkuLocationPickerMap } from './EdkuGoogleMaps';
import { ResilientImage } from './ResilientImage';
import { OrdersListSkeleton, ProductsGridSkeleton } from './SkeletonLoaders';
import { PortalSupportModal } from './SupportSystemViews';
import { ConfirmActionModal } from './ConfirmActionModal';

type StoreSidebarPage =
  | 'orders_new'
  | 'orders_preparing'
  | 'orders_ready'
  | 'menu'
  | 'reports'
  | 'settings';

const PREP_TIME_OPTIONS = [10, 15, 20, 25, 30, 40, 45, 60] as const;

interface StorePortalViewProps {
  stores: StoreRecord[];
  selectedStoreId: string | null;
  onSelectStoreId: (storeId: string) => void;
  products: ProductRecord[];
  isLoadingProducts: boolean;
  orders: OrderRecord[];
  isLoadingOrders: boolean;
  storeReviews?: ReviewRecord[];
  unreadNotificationsCount?: number;
  onOpenNotifications?: () => void;
  onAcceptOrder: (orderId: string, prepTimeMinutes: number) => Promise<void>;
  onQuotePharmacyOrder?: (
    order: OrderRecord,
    quotedPriceEgp: number,
    pharmacistNote?: string,
    prepTimeMinutes?: number
  ) => Promise<void>;
  onMarkOrderReady: (orderId: string) => Promise<void>;
  onCancelOrder: (orderId: string) => Promise<void>;
  onAddProduct: (
    input: NewProductInput,
    storeOwnerId?: string
  ) => Promise<void>;
  onToggleProductAvailable: (
    productId: string,
    nextAvailable: boolean
  ) => Promise<void>;
  onUpdateProductStock?: (
    productId: string,
    nextStockQuantity: number
  ) => Promise<void>;
  onDeleteProduct?: (product: ProductRecord) => Promise<void>;
  onToggleStoreOpen: (storeId: string, nextIsOpen: boolean) => Promise<void>;
  onSaveStoreSettings: (
    storeId: string,
    settings: StoreOperationalSettingsInput
  ) => Promise<void>;
  merchantUid?: string;
  merchantEmail?: string;
  onNotify?: (msg: string) => void;
  onLogout: () => Promise<void>;
}

export function StorePortalView({
  stores,
  selectedStoreId,
  onSelectStoreId,
  products,
  isLoadingProducts,
  orders,
  isLoadingOrders,
  storeReviews = [],
  unreadNotificationsCount = 0,
  onOpenNotifications,
  onAcceptOrder,
  onQuotePharmacyOrder,
  onMarkOrderReady,
  onCancelOrder,
  onAddProduct,
  onToggleProductAvailable,
  onUpdateProductStock,
  onDeleteProduct,
  onToggleStoreOpen,
  onSaveStoreSettings,
  merchantUid = '',
  merchantEmail = '',
  onNotify,
  onLogout,
}: StorePortalViewProps) {
  const [activePage, setActivePage] = useState<StoreSidebarPage>('orders_new');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [printingOrder, setPrintingOrder] = useState<OrderRecord | null>(null);
  const [confirmCancelOrderId, setConfirmCancelOrderId] = useState<
    string | null
  >(null);
  const [confirmDeleteProduct, setConfirmDeleteProduct] =
    useState<ProductRecord | null>(null);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [flashSaleModalProduct, setFlashSaleModalProduct] =
    useState<ProductRecord | null>(null);
  const [flashDiscountInput, setFlashDiscountInput] = useState('20');
  const [flashDurationHoursInput, setFlashDurationHoursInput] = useState('6');
  const [savingFlashSale, setSavingFlashSale] = useState(false);

  const currentStore = useMemo(() => {
    if (stores.length === 0) return null;
    if (selectedStoreId) {
      const matched = stores.find((s) => s.id === selectedStoreId);
      if (matched) return matched;
    }
    return stores[0];
  }, [stores, selectedStoreId]);

  const stats = useMemo(
    () => calculateStoreDashboardStats(orders, currentStore?.id ?? 'all'),
    [orders, currentStore?.id]
  );

  const newIncomingCount =
    stats.pharmacyQuoteOrders.length +
    stats.awaitingCustomerOrders.length +
    stats.pendingOrders.length;

  // Per-order custom prep time + pharmacy quote inputs
  const [prepByOrder, setPrepByOrder] = useState<Record<string, number>>({});
  const [quotePriceByOrder, setQuotePriceByOrder] = useState<
    Record<string, string>
  >({});
  const [quoteNoteByOrder, setQuoteNoteByOrder] = useState<
    Record<string, string>
  >({});
  const [zoomedPrescriptionUrl, setZoomedPrescriptionUrl] = useState<
    string | null
  >(null);

  const [busyActionKey, setBusyActionKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Menu search & category filter + Add Product Modal state
  const [menuSearch, setMenuSearch] = useState('');
  const [menuCategoryFilter, setMenuCategoryFilter] = useState('الكل');
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);

  const [prodName, setProdName] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodCategory, setProdCategory] = useState('الأكثر طلباً');
  const [prodDescription, setProdDescription] = useState('');
  const [prodImageUrl, setProdImageUrl] = useState('');
  const [prodStockQuantity, setProdStockQuantity] = useState('25');
  const [prodIsMysteryBox, setProdIsMysteryBox] = useState(false);
  const [prodOriginalValue, setProdOriginalValue] = useState('');
  const [prodHasVariants, setProdHasVariants] = useState(false);
  const [prodVariants, setProdVariants] = useState<
    Array<{
      id: string;
      name: string;
      size?: string;
      color?: string;
      shade?: string;
      price: number;
      stockQuantity: number;
    }>
  >([]);
  const [prodFormErrors, setProdFormErrors] = useState<Record<string, string>>(
    {}
  );
  const [submittingProduct, setSubmittingProduct] = useState(false);

  // AI Menu OCR Modal State
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [ocrImageDataUrl, setOcrImageDataUrl] = useState('');
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrExtractedItems, setOcrExtractedItems] = useState<
    OcrExtractedMenuItem[]
  >([]);
  const [ocrSelectedMap, setOcrSelectedMap] = useState<Record<number, boolean>>(
    {}
  );
  const [ocrBatchSaving, setOcrBatchSaving] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);

  // Settings form state synced with currentStore
  const [settingsPrepMinutes, setSettingsPrepMinutes] = useState('25');
  const [settingsMinOrder, setSettingsMinOrder] = useState('0');
  const [settingsIsOpen, setSettingsIsOpen] = useState(true);
  const [settingsIsManuallyClosed, setSettingsIsManuallyClosed] = useState(false);
  const [settingsOpeningTime, setSettingsOpeningTime] = useState('09:00');
  const [settingsClosingTime, setSettingsClosingTime] = useState('23:00');
  const [settingsIsHomeFood, setSettingsIsHomeFood] = useState(false);
  const [settingsNeighborhood, setSettingsNeighborhood] =
    useState('شارع البحر');
  const [settingsLat, setSettingsLat] = useState<number | undefined>(undefined);
  const [settingsLng, setSettingsLng] = useState<number | undefined>(undefined);
  const [settingsWaterPin, setSettingsWaterPin] = useState(false);
  const [settingsImageUrl, setSettingsImageUrl] = useState('');
  const [settingsErrors, setSettingsErrors] = useState<Record<string, string>>(
    {}
  );
  const [settingsSavedMsg, setSettingsSavedMsg] = useState<string | null>(null);

  // Self-Service Delete Account Modal State
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [deleteAccountBusy, setDeleteAccountBusy] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!currentStore) return;
    setSettingsPrepMinutes(
      String(currentStore.prepTimeMinutes ?? currentStore.deliveryTimeMinutes)
    );
    setSettingsMinOrder(String(currentStore.minOrderAmount ?? 0));
    setSettingsIsOpen(isStoreCurrentlyOpen(currentStore));
    setSettingsIsManuallyClosed(Boolean(currentStore.isManuallyClosed));
    setSettingsOpeningTime(currentStore.openingTime || '09:00');
    setSettingsClosingTime(currentStore.closingTime || '23:00');
    setSettingsIsHomeFood(Boolean(currentStore.isHomeFood || currentStore.category === 'أكل بيتي'));
    setSettingsNeighborhood(currentStore.neighborhood || 'شارع البحر');
    const fallbackCoords = resolveEdkuCoordsForNeighborhood(
      currentStore.neighborhood || 'شارع البحر'
    );
    setSettingsLat(currentStore.lat ?? fallbackCoords.lat);
    setSettingsLng(currentStore.lng ?? fallbackCoords.lng);
    setSettingsImageUrl(currentStore.imageUrl || '');
  }, [
    currentStore?.id,
    currentStore?.prepTimeMinutes,
    currentStore?.deliveryTimeMinutes,
    currentStore?.minOrderAmount,
    currentStore?.isOpen,
    currentStore?.isManuallyClosed,
    currentStore?.isActive,
    currentStore?.openingTime,
    currentStore?.closingTime,
    currentStore?.neighborhood,
    currentStore?.lat,
    currentStore?.lng,
    currentStore?.imageUrl,
  ]);

  const menuCategories = useMemo(() => {
    const unique = Array.from(
      new Set(products.map((p) => p.category.trim()).filter(Boolean))
    );
    return ['الكل', ...unique];
  }, [products]);

  const filteredProducts = useMemo(
    () =>
      filterProductsByCategoryAndQuery(
        products,
        menuCategoryFilter,
        menuSearch
      ),
    [products, menuCategoryFilter, menuSearch]
  );

  function selectSidebarPage(page: StoreSidebarPage) {
    setActivePage(page);
    setMobileSidebarOpen(false);
    setActionError(null);
    setSettingsSavedMsg(null);
  }

  function getOrderPrepMinutes(orderId: string): number {
    return (
      prepByOrder[orderId] ??
      currentStore?.prepTimeMinutes ??
      currentStore?.deliveryTimeMinutes ??
      20
    );
  }

  async function handleTopbarOpenToggle() {
    if (!currentStore) return;
    const currentOpen = isStoreCurrentlyOpen(currentStore);
    setActionError(null);
    setBusyActionKey('toggle_store_open');
    try {
      await onToggleStoreOpen(currentStore.id, !currentOpen);
    } catch (err) {
      setActionError(formatAppErrorMessage(err, 'تعذر تحديث حالة المتجر.'));
    } finally {
      setBusyActionKey(null);
    }
  }

  async function handleAcceptOrderClick(orderId: string) {
    setActionError(null);
    setBusyActionKey(`accept_${orderId}`);
    try {
      await onAcceptOrder(orderId, getOrderPrepMinutes(orderId));
    } catch (err) {
      setActionError(formatAppErrorMessage(err, 'تعذر قبول الطلب حالياً.'));
    } finally {
      setBusyActionKey(null);
    }
  }

  async function handleQuotePharmacyClick(order: OrderRecord) {
    if (!onQuotePharmacyOrder) return;
    setActionError(null);
    const rawPrice = Number(quotePriceByOrder[order.id] ?? '');
    if (!Number.isFinite(rawPrice) || rawPrice <= 0) {
      setActionError(
        'يرجى إدخال إجمالي سعر الأدوية بالجنيه المصري أولاً قبل إرسال العرض للعميل.'
      );
      return;
    }

    setBusyActionKey(`quote_${order.id}`);
    try {
      await onQuotePharmacyOrder(
        order,
        Math.trunc(rawPrice),
        quoteNoteByOrder[order.id] ?? '',
        getOrderPrepMinutes(order.id)
      );
    } catch (err) {
      setActionError(
        formatAppErrorMessage(err, 'تعذر إرسال تسعيرة الروشتة للعميل.')
      );
    } finally {
      setBusyActionKey(null);
    }
  }

  async function handleMarkReadyClick(orderId: string) {
    setActionError(null);
    setBusyActionKey(`ready_${orderId}`);
    try {
      await onMarkOrderReady(orderId);
    } catch (err) {
      setActionError(
        formatAppErrorMessage(err, 'تعذر تحديث حالة تجهيز الطلب.')
      );
    } finally {
      setBusyActionKey(null);
    }
  }

  async function handleRejectOrderClick(orderId: string) {
    setActionError(null);
    setBusyActionKey(`reject_${orderId}`);
    try {
      await onCancelOrder(orderId);
    } catch (err) {
      setActionError(formatAppErrorMessage(err, 'تعذر رفض أو إلغاء الطلب.'));
    } finally {
      setBusyActionKey(null);
    }
  }

  async function handleProductSwitchToggle(product: ProductRecord) {
    setActionError(null);
    setBusyActionKey(`prod_${product.id}`);
    try {
      await onToggleProductAvailable(product.id, !product.isAvailable);
    } catch (err) {
      setActionError(
        formatAppErrorMessage(err, 'تعذر تحديث حالة توفر المنتج.')
      );
    } finally {
      setBusyActionKey(null);
    }
  }

  async function handleQuickStockAdjust(
    product: ProductRecord,
    nextStock: number
  ) {
    if (!onUpdateProductStock) return;
    setActionError(null);
    setBusyActionKey(`stock_${product.id}`);
    try {
      await onUpdateProductStock(product.id, Math.max(0, nextStock));
    } catch (err) {
      setActionError(
        formatAppErrorMessage(err, 'تعذر تحديث كمية المخزون للمنتج.')
      );
    } finally {
      setBusyActionKey(null);
    }
  }

  async function handleDeleteProductClick(product: ProductRecord) {
    if (!onDeleteProduct) return;
    setActionError(null);
    setBusyActionKey(`del_prod_${product.id}`);
    try {
      await onDeleteProduct(product);
    } catch (err) {
      setActionError(
        formatAppErrorMessage(err, 'تعذر حذف المنتج من قاعدة البيانات.')
      );
    } finally {
      setBusyActionKey(null);
    }
  }

  function openFlashSaleEditor(product: ProductRecord) {
    setFlashSaleModalProduct(product);
    setFlashDiscountInput(
      String(
        product.flashDiscountPercent && product.flashDiscountPercent >= 5
          ? product.flashDiscountPercent
          : 20
      )
    );
    setFlashDurationHoursInput('6');
  }

  async function handleSaveFlashSaleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!flashSaleModalProduct) return;
    setActionError(null);
    const discountPct = Math.min(
      90,
      Math.max(5, Math.trunc(Number(flashDiscountInput) || 20))
    );
    const hours = Math.min(
      72,
      Math.max(1, Math.trunc(Number(flashDurationHoursInput) || 6))
    );
    const endsAtIso = new Date(
      Date.now() + hours * 60 * 60 * 1000
    ).toISOString();

    setSavingFlashSale(true);
    try {
      await updateProductFlashSaleInFirestore(flashSaleModalProduct.id, {
        isFlashSale: true,
        flashDiscountPercent: discountPct,
        flashSaleEndsAtIso: endsAtIso,
      });
      onNotify?.(
        `تم تفعيل عرض الفلاش (${discountPct}%) على ${flashSaleModalProduct.name}`
      );
      setFlashSaleModalProduct(null);
    } catch (err) {
      setActionError(
        formatAppErrorMessage(err, 'تعذر حفظ عرض الفلاش للمنتج.')
      );
    } finally {
      setSavingFlashSale(false);
    }
  }

  async function handleDisableFlashSale(product: ProductRecord) {
    setActionError(null);
    setBusyActionKey(`flash_${product.id}`);
    try {
      await updateProductFlashSaleInFirestore(product.id, {
        isFlashSale: false,
        flashDiscountPercent: 0,
        flashSaleEndsAtIso: '',
      });
      onNotify?.(`تم إيقاف عرض الفلاش عن ${product.name}`);
    } catch (err) {
      setActionError(formatAppErrorMessage(err, 'تعذر إيقاف عرض الفلاش.'));
    } finally {
      setBusyActionKey(null);
    }
  }

  function resetAddProductModal() {
    setProdName('');
    setProdPrice('');
    setProdCategory(
      currentStore?.category === 'صيدليات' ? 'عناية وأدوية' : 'الأكثر طلباً'
    );
    setProdDescription('');
    setProdImageUrl('');
    setProdStockQuantity('25');
    setProdIsMysteryBox(false);
    setProdOriginalValue('');
    setProdHasVariants(false);
    setProdVariants([]);
    setProdFormErrors({});
    setIsAddProductModalOpen(false);
  }

  async function handleAddProductSubmit(e: FormEvent) {
    e.preventDefault();
    if (!currentStore) return;

    const parsedStock =
      prodStockQuantity.trim() === ''
        ? 25
        : Math.max(0, Math.trunc(Number(prodStockQuantity)));

    const builtVariants: ProductVariant[] = prodHasVariants
      ? prodVariants
          .filter((v) => v.name.trim())
          .map((v, i) => ({
            variantId: v.id || `var_${Date.now()}_${i}`,
            name: v.name.trim(),
            size: v.size?.trim() || undefined,
            color: v.color?.trim() || undefined,
            shade: v.shade?.trim() || undefined,
            price: Math.max(1, Math.trunc(Number(v.price) || Number(prodPrice) || 1)),
            stock: Math.max(0, Math.trunc(Number(v.stockQuantity) || parsedStock)),
          }))
      : [];

    const payload: NewProductInput = {
      storeId: currentStore.id,
      name: prodName,
      price: Math.trunc(Number(prodPrice)),
      category: prodCategory,
      description: prodDescription,
      imageKey: currentStore.imageKey,
      imageUrl: prodImageUrl.trim(),
      stockQuantity: parsedStock,
      hasVariants: prodHasVariants && builtVariants.length > 0,
      variants: builtVariants.length > 0 ? builtVariants : undefined,
      isMysteryBox: prodIsMysteryBox,
      originalValueEgp: prodIsMysteryBox
        ? Math.max(
            Math.trunc(Number(prodPrice)),
            Math.trunc(
              Number(prodOriginalValue || Number(prodPrice) * 1.5)
            )
          )
        : undefined,
    };

    const check = validateNewProductForm(payload);
    if (!check.valid) {
      setProdFormErrors(check.errors);
      return;
    }

    setProdFormErrors({});
    setSubmittingProduct(true);
    try {
      const resolvedOwner = currentStore.ownerUid || currentStore.createdBy;
      await onAddProduct(payload, resolvedOwner);
      resetAddProductModal();
    } catch (err) {
      setProdFormErrors({
        submit: formatAppErrorMessage(
          err,
          'تعذر حفظ المنتج الجديد في قاعدة البيانات.'
        ),
      });
    } finally {
      setSubmittingProduct(false);
    }
  }

  // AI Menu OCR Scanner Handlers
  async function handleRunOcrScan() {
    if (!ocrImageDataUrl.trim()) {
      setOcrError('يرجى اختيار صورة للمنيو الورقي أولاً.');
      return;
    }
    setOcrError(null);
    setOcrScanning(true);
    try {
      const items = await extractMenuItemsFromImageWithAi(
        ocrImageDataUrl,
        currentStore?.category
      );
      if (items.length === 0) {
        setOcrError('لم يتم العثور على أصناف واضحة في الصورة. جرب التقاط صورة أقرب وأكثر وضوحاً.');
      } else {
        setOcrExtractedItems(items);
        const initialSelected: Record<number, boolean> = {};
        items.forEach((_, idx) => {
          initialSelected[idx] = true;
        });
        setOcrSelectedMap(initialSelected);
      }
    } catch (err) {
      setOcrError(formatAppErrorMessage(err, 'تعذر مسح المنيو بالذكاء الاصطناعي.'));
    } finally {
      setOcrScanning(false);
    }
  }

  async function handleSaveOcrBatch() {
    if (!currentStore) return;
    const selected = ocrExtractedItems.filter((_, idx) => ocrSelectedMap[idx]);
    if (selected.length === 0) {
      setOcrError('يرجى اختيار صنف واحد على الأقل لحفظه في المنيو.');
      return;
    }
    setOcrError(null);
    setOcrBatchSaving(true);
    try {
      const savedCount = await addBatchProductsFromOcrInFirestore(
        currentStore,
        selected,
        merchantUid || currentStore.ownerUid || currentStore.createdBy,
        currentStore.imageUrl
      );
      onNotify?.(`تمت إضافة ${savedCount} صنف بنجاح إلى منيو المتجر!`);
      setIsOcrModalOpen(false);
      setOcrImageDataUrl('');
      setOcrExtractedItems([]);
      setOcrSelectedMap({});
    } catch (err) {
      setOcrError(formatAppErrorMessage(err, 'تعذر حفظ الأصناف في المنيو.'));
    } finally {
      setOcrBatchSaving(false);
    }
  }

  // Self-Service Complete Account Deletion
  async function handleConfirmDeleteAccount() {
    setDeleteAccountError(null);
    setDeleteAccountBusy(true);
    try {
      await deleteCurrentAccountCompletely();
      setIsDeleteAccountOpen(false);
      await onLogout();
    } catch (err) {
      setDeleteAccountError(
        formatAppErrorMessage(err, 'تعذر حذف الحساب حالياً. يرجى مراجعة الدعم الفني.')
      );
    } finally {
      setDeleteAccountBusy(false);
    }
  }

  async function handleSettingsSubmit(e: FormEvent) {
    e.preventDefault();
    if (!currentStore) return;
    setSettingsSavedMsg(null);
    setActionError(null);

    if (settingsWaterPin) {
      setActionError(
        'لا يمكن تثبيت موقع المتجر فوق مياه البحر المتوسط أو بحيرة إدكو. يرجى تحريك الدبوس لليابسة.'
      );
      return;
    }

    const payload: StoreOperationalSettingsInput = {
      prepTimeMinutes: Math.trunc(Number(settingsPrepMinutes)),
      minOrderAmount: Math.trunc(Number(settingsMinOrder)),
      isOpen: settingsIsManuallyClosed ? false : settingsIsOpen,
      isManuallyClosed: settingsIsManuallyClosed,
      openingTime: settingsOpeningTime.trim() || undefined,
      closingTime: settingsClosingTime.trim() || undefined,
      isHomeFood: settingsIsHomeFood,
      neighborhood: settingsNeighborhood,
      lat: settingsLat,
      lng: settingsLng,
      imageUrl: settingsImageUrl.trim() || undefined,
    };

    const check = validateStoreSettingsForm(payload);
    if (!check.valid) {
      setSettingsErrors(check.errors);
      return;
    }

    setSettingsErrors({});
    setBusyActionKey('save_settings');
    try {
      await onSaveStoreSettings(currentStore.id, payload);
      setSettingsSavedMsg(
        'تم حفظ إعدادات وموقع وصورة المتجر ومزامنتها فوراً مع واجهة العملاء.'
      );
    } catch (err) {
      setActionError(formatAppErrorMessage(err, 'تعذر حفظ إعدادات المتجر.'));
    } finally {
      setBusyActionKey(null);
    }
  }

  const isPharmacyStore = currentStore?.category === 'صيدليات';

  const pageMeta: Record<
    StoreSidebarPage,
    { title: string; subtitle: string }
  > = {
    orders_new: {
      title: isPharmacyStore
        ? 'الروشتات والطلبات الجديدة'
        : 'الطلبات الجديدة',
      subtitle: isPharmacyStore
        ? 'روشتات وطلبات أدوية بانتظار تسعيرك أو موافقة العميل'
        : 'طلبات وصلت للتو وتنتظر مراجعة وقبول المتجر',
    },
    orders_preparing: {
      title: 'جاري التحضير',
      subtitle: isPharmacyStore
        ? 'روشتات وافق العميل على سعرها وجارٍ تحضير شنطة الأدوية'
        : 'الطلبات قيد التجهيز داخل المتجر حالياً',
    },
    orders_ready: {
      title: 'جاهز لتسليم المندوب',
      subtitle: 'طلبات تم تجهيزها بالكامل وتنتظر استلام مندوب إدكاوي',
    },
    menu: {
      title: isPharmacyStore ? 'إدارة الأصناف والعروض' : 'إدارة المنيو والمخزون',
      subtitle: 'إضافة المنتجات بصور حقيقية من جهازك وتحديث المخزون لحظياً',
    },
    reports: {
      title: 'التقارير والمبيعات',
      subtitle: 'ملخص الأداء والمبيعات والتقييمات الحية في إدكاوي',
    },
    settings: {
      title: 'إعدادات وموقع المتجر',
      subtitle: 'تثبيت موقع المتجر على خريطة إدكو وضبط وقت التحضير والصورة',
    },
  };

  if (stores.length === 0 || !currentStore) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-[#F8FAFC] flex items-center justify-center p-6">
        <div className="rounded-2xl bg-[#1E293B] border border-[#334155] max-w-lg w-full p-8 text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-[#FF6B00]/15 border border-[#FF6B00]/30 flex items-center justify-center mx-auto">
            <StoreIcon className="w-7 h-7 text-[#FF6B00]" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-[#F8FAFC]">
            لا يوجد متجر مرتبط بهذا الحساب حالياً
          </h1>
          <p className="text-sm text-[#94A3B8] leading-relaxed">
            يرجى التأكد من تسجيل الدخول بالبريد الإلكتروني المولّد للمتجر من قِبل الإدارة، أو التواصل مع إدارة إدكاوي لتفعيل بيانات متجرك أو صيدليتك.
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setConfirmLogoutOpen(true)}
              className="py-2.5 px-5 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-sm font-bold cursor-pointer"
            >
              تسجيل الخروج
            </button>
          </div>
        </div>
        <ConfirmActionModal
          isOpen={confirmLogoutOpen}
          title="تسجيل الخروج من بوابة المتجر"
          description="هل تريد إنهاء جلستك الحالية؟"
          confirmLabel="تسجيل الخروج"
          cancelLabel="إلغاء"
          tone="warning"
          onConfirm={() => {
            setConfirmLogoutOpen(false);
            void onLogout();
          }}
          onCancel={() => setConfirmLogoutOpen(false)}
        />
      </div>
    );
  }

  const isStoreOpen = isStoreCurrentlyOpen(currentStore);

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#1E293B] text-[#F8FAFC] select-none">
      {/* Sidebar Brand Header */}
      <div className="h-16 px-5 border-b border-[#334155] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <AdkawyLogo variant="navbar" />
          <span className="text-xs font-semibold text-[#94A3B8] truncate">
            {isPharmacyStore ? 'بوابة الصيدلية' : 'بوابة التاجر'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(false)}
          aria-label="إغلاق القائمة الجانبية"
          className="lg:hidden p-1.5 rounded-lg text-[#94A3B8] hover:bg-[#0F172A] hover:text-[#F8FAFC] cursor-pointer"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav
        aria-label="أقسام لوحة تحكم المتجر"
        className="flex-1 overflow-y-auto px-3.5 py-5 space-y-6"
      >
        <div className="space-y-1">
          <p className="px-3 pb-1.5 text-[11px] font-bold text-[#94A3B8]">
            الطلبات المباشرة
          </p>

          <button
            type="button"
            onClick={() => selectSidebarPage('orders_new')}
            className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
              activePage === 'orders_new'
                ? 'bg-[#FF6B00] text-white'
                : 'text-[#94A3B8] hover:bg-[#0F172A] hover:text-[#F8FAFC]'
            }`}
          >
            <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
              {isPharmacyStore ? (
                <Pill className="w-4 h-4 shrink-0" aria-hidden="true" />
              ) : (
                <ShoppingBag className="w-4 h-4 shrink-0" aria-hidden="true" />
              )}
              <span>
                {isPharmacyStore ? 'الروشتات والطلبات' : 'الطلبات الجديدة'}
              </span>
            </span>
            <span
              className={`font-mono text-xs font-bold tabular-nums px-2 py-0.5 rounded-md ${
                activePage === 'orders_new'
                  ? 'bg-white/20 text-white'
                  : newIncomingCount > 0
                  ? 'bg-[#FF6B00] text-white'
                  : 'bg-[#0F172A] text-[#94A3B8]'
              }`}
            >
              {newIncomingCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => selectSidebarPage('orders_preparing')}
            className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
              activePage === 'orders_preparing'
                ? 'bg-[#FF6B00] text-white'
                : 'text-[#94A3B8] hover:bg-[#0F172A] hover:text-[#F8FAFC]'
            }`}
          >
            <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
              <ChefHat className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>جاري التحضير</span>
            </span>
            <span
              className={`font-mono text-xs font-bold tabular-nums px-2 py-0.5 rounded-md ${
                activePage === 'orders_preparing'
                  ? 'bg-white/20 text-white'
                  : stats.preparingOrders.length > 0
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-[#0F172A] text-[#94A3B8]'
              }`}
            >
              {stats.preparingOrders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => selectSidebarPage('orders_ready')}
            className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
              activePage === 'orders_ready'
                ? 'bg-[#FF6B00] text-white'
                : 'text-[#94A3B8] hover:bg-[#0F172A] hover:text-[#F8FAFC]'
            }`}
          >
            <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
              <PackageCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>جاهز للاستلام</span>
            </span>
            <span
              className={`font-mono text-xs font-bold tabular-nums px-2 py-0.5 rounded-md ${
                activePage === 'orders_ready'
                  ? 'bg-white/20 text-white'
                  : 'bg-[#0F172A] text-[#94A3B8]'
              }`}
            >
              {stats.readyOrders.length}
            </span>
          </button>
        </div>

        <div className="space-y-1 pt-3 border-t border-[#334155]">
          <p className="px-3 pb-1.5 text-[11px] font-bold text-[#94A3B8]">
            إدارة المتجر
          </p>

          <button
            type="button"
            onClick={() => selectSidebarPage('menu')}
            className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
              activePage === 'menu'
                ? 'bg-[#FF6B00] text-white'
                : 'text-[#94A3B8] hover:bg-[#0F172A] hover:text-[#F8FAFC]'
            }`}
          >
            <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
              <UtensilsCrossed
                className="w-4 h-4 shrink-0"
                aria-hidden="true"
              />
              <span>{isPharmacyStore ? 'الأصناف والعروض' : 'إدارة المنيو'}</span>
            </span>
            <span
              className={`font-mono text-xs font-bold tabular-nums px-2 py-0.5 rounded-md ${
                activePage === 'menu'
                  ? 'bg-white/20 text-white'
                  : 'bg-[#0F172A] text-[#94A3B8]'
              }`}
            >
              {products.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => selectSidebarPage('reports')}
            className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap ${
              activePage === 'reports'
                ? 'bg-[#FF6B00] text-white'
                : 'text-[#94A3B8] hover:bg-[#0F172A] hover:text-[#F8FAFC]'
            }`}
          >
            <BarChart3 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>التقارير</span>
          </button>

          <button
            type="button"
            onClick={() => selectSidebarPage('settings')}
            className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap ${
              activePage === 'settings'
                ? 'bg-[#FF6B00] text-white'
                : 'text-[#94A3B8] hover:bg-[#0F172A] hover:text-[#F8FAFC]'
            }`}
          >
            <Settings className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>الإعدادات والموقع</span>
          </button>
        </div>
      </nav>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-[#334155] space-y-2.5 shrink-0">
        <div className="px-2 py-1 text-xs text-[#94A3B8]">
          <p className="font-bold text-[#F8FAFC] truncate">{currentStore.name}</p>
          <p className="text-[#94A3B8] truncate mt-0.5">
            {currentStore.category} · {currentStore.neighborhood}
          </p>
        </div>

        <div className="flex items-center justify-end pt-1">
          <button
            type="button"
            onClick={() => setConfirmLogoutOpen(true)}
            className="w-full py-2.5 px-3 rounded-xl bg-[#0F172A] border border-[#334155] hover:border-[#FF6B00] text-xs font-bold text-[#F8FAFC] inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5 text-[#FF6B00]" aria-hidden="true" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0F172A] text-[#F8FAFC] flex flex-col lg:flex-row">
      {/* Desktop Sticky RTL Sidebar */}
      <aside className="hidden lg:block w-[264px] shrink-0 sticky top-0 h-screen border-l border-[#334155]">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="قائمة لوحة تحكم المتجر"
        >
          <div className="w-[272px] max-w-[82vw] h-full shadow-xl">
            {sidebarContent}
          </div>
          <div
            className="flex-1 bg-black/60"
            onClick={() => setMobileSidebarOpen(false)}
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-[#1E293B] border-b border-[#334155] px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="فتح القائمة الجانبية"
              className="lg:hidden p-2 rounded-lg border border-[#334155] bg-[#0F172A] text-[#F8FAFC] hover:border-[#FF6B00] cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>

            <div className="min-w-0">
              {stores.length > 1 ? (
                <select
                  aria-label="اختيار المتجر"
                  value={currentStore.id}
                  onChange={(e) => onSelectStoreId(e.target.value)}
                  className="text-sm sm:text-base font-bold text-[#F8FAFC] bg-[#0F172A] border border-[#334155] rounded-lg px-2.5 py-1"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              ) : (
                <h1 className="text-base sm:text-lg font-bold text-[#F8FAFC] truncate">
                  {currentStore.name}
                </h1>
              )}
              <p className="text-xs text-[#94A3B8] truncate hidden sm:block">
                {pageMeta[activePage].title} · {currentStore.neighborhood}
              </p>
            </div>
          </div>

          {/* Right/End Zone: Support + Notifications Bell + Open/Closed Switch + Logout */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {merchantUid && (
              <button
                type="button"
                onClick={() => setIsSupportModalOpen(true)}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Headphones className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">الدعم الفني</span>
              </button>
            )}

            {onOpenNotifications && (
              <button
                type="button"
                onClick={onOpenNotifications}
                aria-label="الإشعارات الداخلية وتنبيهات الطلبات"
                className="relative min-h-[40px] min-w-[40px] rounded-xl border border-[#334155] bg-[#0F172A] flex items-center justify-center text-[#F8FAFC] hover:border-[#FF6B00] cursor-pointer"
              >
                <Bell className="w-4 h-4" aria-hidden="true" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1.5 -left-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF6B00] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {unreadNotificationsCount > 99
                      ? '99+'
                      : unreadNotificationsCount}
                  </span>
                )}
              </button>
            )}

            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-[#334155] bg-[#0F172A]">
              <span
                className={`text-xs font-bold whitespace-nowrap ${
                  isStoreOpen
                    ? 'text-emerald-400'
                    : 'text-[#94A3B8]'
                }`}
              >
                {isStoreOpen ? 'مفتوح' : 'مغلق'}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={isStoreOpen}
                aria-label="تبديل حالة المتجر بين مفتوح ومغلق"
                disabled={busyActionKey === 'toggle_store_open'}
                onClick={handleTopbarOpenToggle}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
                  isStoreOpen ? 'bg-emerald-600' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                    isStoreOpen ? '-translate-x-6' : '-translate-x-1'
                  }`}
                />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setConfirmLogoutOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-[#0F172A] border border-[#334155] hover:border-[#FF6B00] text-[#F8FAFC] text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5 text-[#FF6B00]" aria-hidden="true" />
              <span>خروج</span>
            </button>
          </div>
        </header>

        {/* Workspace Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto space-y-6">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#F8FAFC]">
                {pageMeta[activePage].title}
              </h2>
              <p className="text-xs sm:text-sm text-[#94A3B8] mt-1">
                {pageMeta[activePage].subtitle}
              </p>
            </div>

            {activePage === 'menu' && (
              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    setIsOcrModalOpen(true);
                    setOcrError(null);
                  }}
                  className="py-2.5 px-4 rounded-xl bg-[#1E293B] border border-[#334155] hover:border-[#FF6B00] text-[#F8FAFC] text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <ScanLine className="w-4 h-4 text-[#FF6B00]" aria-hidden="true" />
                  <span>مسح المنيو الورقي بالذكاء الاصطناعي</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddProductModalOpen(true)}
                  className="py-2.5 px-5 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] active:scale-[0.98] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  <span>إضافة منتج بصورة من جهازك</span>
                </button>
              </div>
            )}
          </div>

          {!isStoreOpen && (
            <div
              role="status"
              className="p-4 rounded-2xl bg-amber-950/60 border border-amber-800/80 text-amber-200 text-xs sm:text-sm flex flex-wrap items-center justify-between gap-3"
            >
              <p className="font-semibold">
                المتجر مضبوط حالياً على وضع &quot;مغلق&quot; — يظهر للعملاء بعلامة مغلق حالياً مع إيقاف استقبال طلبات جديدة مؤقتاً.
              </p>
              <button
                type="button"
                onClick={handleTopbarOpenToggle}
                className="py-1.5 px-3.5 rounded-lg bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs font-bold cursor-pointer whitespace-nowrap"
              >
                تحويل إلى مفتوح الآن
              </button>
            </div>
          )}

          {actionError && (
            <div
              role="alert"
              className="p-4 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3"
            >
              <span>{actionError}</span>
              <button
                type="button"
                onClick={() => setActionError(null)}
                className="px-2.5 py-1 rounded-lg bg-[#0F172A] border border-rose-700 text-rose-200 text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          )}

          {/* ================================================================
           * 1A. NEW ORDERS & PHARMACY QUOTES PAGE
           * ============================================================== */}
          {activePage === 'orders_new' && (
            <section className="space-y-6">
              {isLoadingOrders ? (
                <OrdersListSkeleton count={2} />
              ) : newIncomingCount === 0 ? (
                <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-12 text-center space-y-2.5">
                  {isPharmacyStore ? (
                    <Pill
                      className="w-10 h-10 text-teal-400 mx-auto"
                      aria-hidden="true"
                    />
                  ) : (
                    <ShoppingBag
                      className="w-10 h-10 text-[#94A3B8] mx-auto"
                      aria-hidden="true"
                    />
                  )}
                  <h3 className="text-base sm:text-lg font-bold text-[#F8FAFC]">
                    {isPharmacyStore
                      ? 'لا توجد روشتات أو طلبات أدوية جديدة حالياً'
                      : 'لا توجد طلبات جديدة بانتظار القبول'}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#94A3B8] max-w-md mx-auto">
                    {isPharmacyStore
                      ? 'بمجرد إرسال أي عميل لصورة روشتة أو طلب أدوية في إدكاوي، سيظهر هنا فوراً لتسعيره وإرساله للعميل.'
                      : 'بمجرد إرسال أي عميل لطلب جديد، سيظهر هنا تلقائياً في نفس اللحظة بدون الحاجة لتحديث الصفحة.'}
                  </p>
                </div>
              ) : (
                <>
                  {/* STAGE 2: Pharmacy Prescription Orders Awaiting Quote */}
                  {stats.pharmacyQuoteOrders.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Pill className="w-5 h-5 text-teal-400" />
                        <h3 className="text-base font-bold text-[#F8FAFC]">
                          روشتات وطلبات أدوية بانتظار التسعير (
                          {stats.pharmacyQuoteOrders.length})
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                        {stats.pharmacyQuoteOrders.map((order) => {
                          const prepMinutes = getOrderPrepMinutes(order.id);
                          const isQuoting = busyActionKey === `quote_${order.id}`;
                          const isRejecting =
                            busyActionKey === `reject_${order.id}`;

                          return (
                            <article
                              key={order.id}
                              className="bg-[#1E293B] border-2 border-teal-500/40 rounded-2xl p-5 sm:p-6 flex flex-col justify-between gap-5"
                            >
                              <div className="space-y-4">
                                <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-[#334155]">
                                  <div>
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-950/60 border border-teal-700/50 text-teal-300 text-xs font-bold mb-1.5">
                                      <Pill className="w-3.5 h-3.5" />
                                      <span>روشتة طبية / طلب أدوية</span>
                                    </span>
                                    <h4 className="text-base sm:text-lg font-bold text-[#F8FAFC]">
                                      {order.customerName}
                                    </h4>
                                    <p className="text-xs text-[#94A3B8] mt-0.5">
                                      <span dir="ltr" className="font-mono">
                                        #{order.id.slice(0, 8)}
                                      </span>{' '}
                                      · رسوم توصيل إدكاوي:{' '}
                                      <strong className="text-[#FF6B00]">
                                        {order.deliveryFee} ج.م
                                      </strong>
                                    </p>
                                  </div>
                                  <span className="text-xs font-mono text-[#94A3B8]">
                                    {new Date(
                                      order.createdAtIso
                                    ).toLocaleTimeString('ar-EG', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </div>

                                {order.prescriptionImageUrl && (
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <p className="text-xs font-bold text-[#94A3B8]">
                                        صورة الروشتة المرفوعة من جهاز العميل:
                                      </p>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setZoomedPrescriptionUrl(
                                            order.prescriptionImageUrl!
                                          )
                                        }
                                        className="inline-flex items-center gap-1 text-xs font-bold text-[#FF6B00] hover:underline cursor-pointer"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                        <span>تكبير الروشتة بملء الشاشة</span>
                                      </button>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setZoomedPrescriptionUrl(
                                          order.prescriptionImageUrl!
                                        )
                                      }
                                      className="block w-full h-48 rounded-xl overflow-hidden border border-[#334155] bg-[#0F172A] cursor-pointer"
                                    >
                                      <img
                                        src={order.prescriptionImageUrl}
                                        alt="صورة الروشتة"
                                        className="w-full h-full object-contain"
                                      />
                                    </button>
                                  </div>
                                )}

                                {order.prescriptionMedicineRequest && (
                                  <div className="p-3.5 rounded-xl bg-teal-950/30 border border-teal-800 space-y-1">
                                    <p className="text-xs font-bold text-teal-200">
                                      الأدوية المكتوبة من العميل:
                                    </p>
                                    <p className="text-sm font-semibold text-[#F8FAFC] whitespace-pre-line">
                                      {order.prescriptionMedicineRequest}
                                    </p>
                                  </div>
                                )}

                                {order.notes && (
                                  <p className="text-xs text-amber-200 bg-amber-950/40 border border-amber-800 rounded-lg px-3 py-2">
                                    <strong>ملاحظة العميل:</strong> {order.notes}
                                  </p>
                                )}

                                <div className="text-xs sm:text-sm text-[#94A3B8] space-y-1">
                                  <p className="flex items-start gap-2">
                                    <MapPin className="w-4 h-4 text-[#FF6B00] shrink-0 mt-0.5" />
                                    <span>
                                      <strong className="text-[#F8FAFC]">
                                        موقع العميل على الخريطة:
                                      </strong>{' '}
                                      {order.deliveryNeighborhood} —{' '}
                                      {order.deliveryAddress}
                                    </span>
                                  </p>
                                  <p className="flex items-center gap-2">
                                    <Phone className="w-4 h-4 text-[#94A3B8] shrink-0" />
                                    <span
                                      dir="ltr"
                                      className="font-mono font-semibold text-[#F8FAFC] tabular-nums"
                                    >
                                      {order.customerPhone}
                                    </span>
                                  </p>
                                </div>
                              </div>

                              <div className="pt-4 border-t border-[#334155] space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs font-bold text-[#F8FAFC] mb-1">
                                      سعر الأدوية فقط (ج.م) *
                                    </label>
                                    <input
                                      type="number"
                                      dir="ltr"
                                      min={1}
                                      max={50000}
                                      value={quotePriceByOrder[order.id] ?? ''}
                                      onChange={(e) =>
                                        setQuotePriceByOrder((prev) => ({
                                          ...prev,
                                          [order.id]: e.target.value,
                                        }))
                                      }
                                      placeholder="مثال: 145"
                                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-sm font-mono font-bold text-left"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-xs font-bold text-[#F8FAFC] mb-1">
                                      وقت تجهيز الشنطة
                                    </label>
                                    <select
                                      value={prepMinutes}
                                      onChange={(e) =>
                                        setPrepByOrder((prev) => ({
                                          ...prev,
                                          [order.id]: Number(e.target.value),
                                        }))
                                      }
                                      className="w-full px-3 py-2.5 rounded-xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-xs font-bold"
                                    >
                                      {PREP_TIME_OPTIONS.map((m) => (
                                        <option key={m} value={m}>
                                          {m} دقيقة
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                                    ملاحظة الصيدلي للعميل (اختياري — بدائل أو نواقص)
                                  </label>
                                  <input
                                    type="text"
                                    maxLength={240}
                                    value={quoteNoteByOrder[order.id] ?? ''}
                                    onChange={(e) =>
                                      setQuoteNoteByOrder((prev) => ({
                                        ...prev,
                                        [order.id]: e.target.value,
                                      }))
                                    }
                                    placeholder="مثال: جميع الأصناف متوفرة، وتم توفير البديل بنفس المادة الفعالة..."
                                    className="w-full px-3.5 py-2 rounded-xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-xs"
                                  />
                                </div>

                                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                                  <button
                                    type="button"
                                    disabled={isQuoting || isRejecting}
                                    onClick={() =>
                                      void handleQuotePharmacyClick(order)
                                    }
                                    className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-60 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                                  >
                                    <Check className="w-4 h-4" />
                                    <span>
                                      {isQuoting
                                        ? 'جارٍ الإرسال للعميل...'
                                        : 'قبول وإرسال السعر للعميل'}
                                    </span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setPrintingOrder(order)}
                                    title="طباعة فاتورة"
                                    className="min-h-[44px] py-2.5 px-3.5 rounded-xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] hover:border-[#FF6B00] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <Printer className="w-4 h-4 text-[#FF6B00]" />
                                    <span>طباعة فاتورة</span>
                                  </button>

                                  <button
                                    type="button"
                                    disabled={isQuoting || isRejecting}
                                    onClick={() => setConfirmCancelOrderId(order.id)}
                                    className="min-h-[44px] py-2.5 px-3.5 rounded-xl bg-[#0F172A] border border-red-800 text-red-400 hover:bg-red-950/40 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <XCircle className="w-4 h-4" />
                                    <span>اعتذار</span>
                                  </button>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* STAGE 2B: Quoted Prescriptions Waiting for Customer Approval */}
                  {stats.awaitingCustomerOrders.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm sm:text-base font-bold text-[#F8FAFC]">
                        روشتات مسعّرة بانتظار موافقة العميل لبدء التحضير (
                        {stats.awaitingCustomerOrders.length})
                      </h3>
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        {stats.awaitingCustomerOrders.map((order) => (
                          <article
                            key={order.id}
                            className="bg-[#1E293B] border border-amber-700/60 rounded-2xl p-5 space-y-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/50 border border-amber-800/60 text-amber-300 text-xs font-bold">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>بانتظار موافقة العميل على السعر</span>
                                </span>
                                <h4 className="text-base font-bold text-[#F8FAFC] mt-1.5">
                                  {order.customerName}
                                </h4>
                              </div>
                              <div className="text-left">
                                <p className="text-lg font-bold text-[#FF6B00] font-mono tabular-nums">
                                  {order.subtotal} ج.م
                                </p>
                                <p className="text-[11px] text-[#94A3B8]">
                                  + توصيل {order.deliveryFee} ج.م
                                </p>
                              </div>
                            </div>

                            {order.pharmacistNote && (
                              <p className="text-xs text-[#94A3B8]">
                                <strong className="text-[#F8FAFC]">ملاحظتك المرسلة:</strong>{' '}
                                {order.pharmacistNote}
                              </p>
                            )}

                            <p className="text-xs text-[#94A3B8]">
                              فور ضغط العميل على &quot;أوافق على السعر&quot;، سينتقل الطلب تلقائياً إلى قسم &quot;جاري التحضير&quot; لتجهيز الشنطة للمندوب.
                            </p>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Regular Pending Store Orders */}
                  {stats.pendingOrders.length > 0 && (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                      {stats.pendingOrders.map((order) => {
                        const prepMinutes = getOrderPrepMinutes(order.id);
                        const isAccepting =
                          busyActionKey === `accept_${order.id}`;
                        const isRejecting =
                          busyActionKey === `reject_${order.id}`;

                        return (
                          <article
                            key={order.id}
                            className="bg-[#1E293B] border border-[#334155] rounded-2xl p-5 sm:p-6 flex flex-col justify-between gap-5"
                          >
                            <div className="space-y-4">
                              <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-[#334155]">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#94A3B8]">
                                    <span
                                      dir="ltr"
                                      className="font-mono font-bold text-[#F8FAFC] tabular-nums"
                                    >
                                      #{order.id.slice(0, 8)}
                                    </span>
                                    <span aria-hidden="true">·</span>
                                    <span>
                                      {new Date(
                                        order.createdAtIso
                                      ).toLocaleTimeString('ar-EG', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                    <span aria-hidden="true">·</span>
                                    <span>
                                      {getPaymentMethodLabel(
                                        order.paymentMethod
                                      )}
                                    </span>
                                  </div>
                                  <h3 className="text-base sm:text-lg font-bold text-[#F8FAFC] mt-1">
                                    {order.customerName}
                                  </h3>

                                  {order.isScheduled && order.scheduledForIso && (
                                    <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-950/60 border border-indigo-800/60 text-indigo-200 text-xs font-bold">
                                      <CalendarClock className="w-3.5 h-3.5" />
                                      <span>
                                        طلب مجدول:{' '}
                                        {new Date(
                                          order.scheduledForIso
                                        ).toLocaleString('ar-EG', {
                                          dateStyle: 'short',
                                          timeStyle: 'short',
                                        })}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                <div className="text-left shrink-0">
                                  <p className="text-lg sm:text-xl font-bold text-[#FF6B00] font-mono tabular-nums">
                                    {order.totalAmount}{' '}
                                    <span className="text-xs font-sans font-semibold text-[#94A3B8]">
                                      ج.م
                                    </span>
                                  </p>
                                  <p className="text-[11px] text-[#94A3B8]">
                                    شاملة التوصيل ({order.deliveryFee} ج.م)
                                  </p>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <p className="text-xs font-bold text-[#94A3B8]">
                                  الأصناف المطلوبة
                                </p>
                                {order.items && order.items.length > 0 ? (
                                  <ul className="divide-y divide-[#334155] text-sm border border-[#334155] rounded-xl px-3.5 py-1 bg-[#0F172A]">
                                    {order.items.map((item) => (
                                      <li
                                        key={item.productId}
                                        className="py-2 flex items-center justify-between gap-3"
                                      >
                                        <span className="font-semibold text-[#F8FAFC]">
                                          {item.name}{' '}
                                          <span className="font-mono text-xs text-[#FF6B00] font-bold tabular-nums">
                                            × {item.quantity}
                                          </span>
                                        </span>
                                        <span className="font-mono text-xs font-bold text-[#94A3B8] tabular-nums shrink-0">
                                          {item.price * item.quantity} ج.م
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-sm font-semibold text-[#F8FAFC]">
                                    {order.itemsSummary}
                                  </p>
                                )}

                                {order.notes && (
                                  <p className="text-xs text-amber-200 bg-amber-950/40 border border-amber-800 rounded-lg px-3 py-2">
                                    <strong>ملاحظة العميل:</strong>{' '}
                                    {order.notes}
                                  </p>
                                )}
                              </div>

                              <div className="text-xs sm:text-sm text-[#94A3B8] space-y-1.5 pt-1">
                                <p className="flex items-start gap-2">
                                  <MapPin
                                    className="w-4 h-4 text-[#FF6B00] shrink-0 mt-0.5"
                                    aria-hidden="true"
                                  />
                                  <span>
                                    <strong className="text-[#F8FAFC]">
                                      موقع التوصيل:
                                    </strong>{' '}
                                    {order.deliveryNeighborhood} —{' '}
                                    {order.deliveryAddress}
                                  </span>
                                </p>
                                <p className="flex items-center gap-2">
                                  <Phone
                                    className="w-4 h-4 text-[#94A3B8] shrink-0"
                                    aria-hidden="true"
                                  />
                                  <span
                                    dir="ltr"
                                    className="font-mono font-semibold text-[#F8FAFC] tabular-nums"
                                  >
                                    {order.customerPhone}
                                  </span>
                                </p>
                              </div>
                            </div>

                            <div className="pt-4 border-t border-[#334155] space-y-3">
                              <div className="flex items-center justify-between gap-3">
                                <label
                                  htmlFor={`prep-${order.id}`}
                                  className="text-xs font-bold text-[#94A3B8]"
                                >
                                  وقت التحضير المتوقع:
                                </label>
                                <select
                                  id={`prep-${order.id}`}
                                  value={prepMinutes}
                                  onChange={(e) =>
                                    setPrepByOrder((prev) => ({
                                      ...prev,
                                      [order.id]: Number(e.target.value),
                                    }))
                                  }
                                  className="px-3 py-1.5 rounded-lg bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-xs font-bold font-mono tabular-nums"
                                >
                                  {PREP_TIME_OPTIONS.map((m) => (
                                    <option key={m} value={m}>
                                      {m} دقيقة
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="flex flex-wrap items-center gap-2.5">
                                <button
                                  type="button"
                                  disabled={isAccepting || isRejecting}
                                  onClick={() =>
                                    void handleAcceptOrderClick(order.id)
                                  }
                                  className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] active:scale-[0.98] disabled:opacity-60 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                                >
                                  <Check className="w-4 h-4" aria-hidden="true" />
                                  <span>
                                    {isAccepting
                                      ? 'جارٍ القبول...'
                                      : 'قبول الطلب'}
                                  </span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setPrintingOrder(order)}
                                  title="طباعة فاتورة"
                                  className="min-h-[44px] py-2.5 px-3.5 rounded-xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] hover:border-[#FF6B00] text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                                >
                                  <Printer className="w-4 h-4 text-[#FF6B00]" aria-hidden="true" />
                                  <span>طباعة فاتورة</span>
                                </button>

                                <button
                                  type="button"
                                  disabled={isAccepting || isRejecting}
                                  onClick={() => setConfirmCancelOrderId(order.id)}
                                  className="min-h-[44px] py-2.5 px-4 rounded-xl bg-[#0F172A] border border-red-800 hover:bg-red-950/40 active:scale-[0.98] disabled:opacity-60 text-red-400 text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                                >
                                  <XCircle
                                    className="w-4 h-4"
                                    aria-hidden="true"
                                  />
                                  <span>
                                    {isRejecting ? 'جارٍ الرفض...' : 'رفض'}
                                  </span>
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {/* ================================================================
           * 1B. PREPARING ORDERS PAGE (جاري التحضير + روشتات وافق عليها العميل)
           * ============================================================== */}
          {activePage === 'orders_preparing' && (
            <section className="space-y-4">
              {stats.preparingOrders.length === 0 ? (
                <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-12 text-center space-y-2.5">
                  <ChefHat
                    className="w-10 h-10 text-[#94A3B8] mx-auto"
                    aria-hidden="true"
                  />
                  <h3 className="text-base sm:text-lg font-bold text-[#F8FAFC]">
                    لا توجد طلبات قيد التحضير حالياً
                  </h3>
                  <p className="text-xs sm:text-sm text-[#94A3B8] max-w-md mx-auto">
                    {isPharmacyStore
                      ? 'بمجرد موافقة العميل على سعر الروشتة، ستظهر هنا لتجهيز شنطة الأدوية والضغط على «جاهز لتسليم المندوب».'
                      : 'عند قبول أي طلب جديد، ينتقل إلى هنا حتى تضغط على «تم التجهيز».'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  {stats.preparingOrders.map((order) => {
                    const isMarkingReady = busyActionKey === `ready_${order.id}`;
                    const isCancelling = busyActionKey === `reject_${order.id}`;
                    const isPharmacyRx =
                      order.orderType === 'pharmacy_prescription';

                    return (
                      <article
                        key={order.id}
                        className="bg-[#1E293B] border border-[#334155] rounded-2xl p-5 sm:p-6 flex flex-col justify-between gap-5"
                      >
                        <div className="space-y-4">
                          <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-[#334155]">
                            <div>
                              {isPharmacyRx && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 text-xs font-bold mb-1.5">
                                  <Pill className="w-3.5 h-3.5" />
                                  <span>
                                    وافق العميل على السعر — حضّر شنطة الأدوية
                                  </span>
                                </span>
                              )}
                              <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
                                <span
                                  dir="ltr"
                                  className="font-mono font-bold text-[#F8FAFC] tabular-nums"
                                >
                                  #{order.id.slice(0, 8)}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="inline-flex items-center gap-1 font-semibold text-[#FF6B00]">
                                  <Clock
                                    className="w-3.5 h-3.5"
                                    aria-hidden="true"
                                  />
                                  <span className="font-mono tabular-nums">
                                    {order.prepTimeMinutes ?? 20}
                                  </span>{' '}
                                  دقيقة
                                </span>
                              </div>
                              <h3 className="text-base sm:text-lg font-bold text-[#F8FAFC] mt-1">
                                {order.customerName}
                              </h3>
                            </div>

                            <p className="text-lg font-bold text-[#F8FAFC] font-mono tabular-nums shrink-0">
                              {order.totalAmount}{' '}
                              <span className="text-xs font-sans font-semibold text-[#94A3B8]">
                                ج.م
                              </span>
                            </p>
                          </div>

                          {isPharmacyRx && order.prescriptionImageUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                setZoomedPrescriptionUrl(
                                  order.prescriptionImageUrl!
                                )
                              }
                              className="w-full py-2 px-3 rounded-xl border border-teal-700 bg-teal-950/40 text-teal-200 text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                              <span>عرض صورة الروشتة أثناء التحضير</span>
                            </button>
                          )}

                          {isPharmacyRx &&
                            order.prescriptionMedicineRequest && (
                              <div className="p-3 rounded-xl bg-[#0F172A] border border-[#334155] text-xs space-y-1">
                                <p className="font-bold text-[#94A3B8]">
                                  الأدوية المطلوبة:
                                </p>
                                <p className="font-semibold text-[#F8FAFC] whitespace-pre-line">
                                  {order.prescriptionMedicineRequest}
                                </p>
                              </div>
                            )}

                          <div className="space-y-2">
                            {order.items && order.items.length > 0 ? (
                              <ul className="divide-y divide-[#334155] text-sm border border-[#334155] rounded-xl px-3.5 py-1 bg-[#0F172A]">
                                {order.items.map((item) => (
                                  <li
                                    key={item.productId}
                                    className="py-2 flex items-center justify-between gap-3"
                                  >
                                    <span className="font-semibold text-[#F8FAFC]">
                                      {item.name}{' '}
                                      <span className="font-mono text-xs text-[#FF6B00] font-bold tabular-nums">
                                        × {item.quantity}
                                      </span>
                                    </span>
                                    <span className="font-mono text-xs font-bold text-[#94A3B8] tabular-nums">
                                      {item.price * item.quantity} ج.م
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm font-semibold text-[#F8FAFC]">
                                {order.itemsSummary}
                              </p>
                            )}
                          </div>

                          <p className="text-xs sm:text-sm text-[#94A3B8]">
                            <strong className="text-[#F8FAFC]">
                              العنوان:
                            </strong>{' '}
                            {order.deliveryNeighborhood} —{' '}
                            {order.deliveryAddress}
                          </p>
                        </div>

                        <div className="pt-4 border-t border-[#334155] flex flex-wrap items-center gap-2.5">
                          <button
                            type="button"
                            disabled={isMarkingReady || isCancelling}
                            onClick={() => void handleMarkReadyClick(order.id)}
                            className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] active:scale-[0.98] disabled:opacity-60 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                          >
                            <PackageCheck
                              className="w-4 h-4"
                              aria-hidden="true"
                            />
                            <span>
                              {isMarkingReady
                                ? 'جارٍ إشعار المندوب...'
                                : isPharmacyRx
                                ? 'جاهز للتسليم — إرسال لمندوب إدكاوي'
                                : 'تم التجهيز — جاهز للمندوب'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPrintingOrder(order)}
                            title="طباعة فاتورة"
                            className="min-h-[44px] py-2.5 px-3.5 rounded-xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] hover:border-[#FF6B00] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                          >
                            <Printer className="w-4 h-4 text-[#FF6B00]" aria-hidden="true" />
                            <span>طباعة فاتورة</span>
                          </button>

                          <button
                            type="button"
                            disabled={isMarkingReady || isCancelling}
                            onClick={() => setConfirmCancelOrderId(order.id)}
                            className="min-h-[44px] py-2.5 px-3.5 rounded-xl bg-[#0F172A] border border-[#334155] hover:bg-red-950/40 hover:border-red-800 hover:text-red-400 text-[#94A3B8] text-xs font-bold cursor-pointer whitespace-nowrap"
                          >
                            إلغاء
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* ================================================================
           * 1C. READY FOR PICKUP PAGE (جاهز للاستلام - ready)
           * ============================================================== */}
          {activePage === 'orders_ready' && (
            <section className="space-y-6">
              {stats.readyOrders.length === 0 ? (
                <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-12 text-center space-y-2.5">
                  <PackageCheck
                    className="w-10 h-10 text-[#94A3B8] mx-auto"
                    aria-hidden="true"
                  />
                  <h3 className="text-base sm:text-lg font-bold text-[#F8FAFC]">
                    لا توجد طلبات جاهزة تنتظر استلام المندوب حالياً
                  </h3>
                  <p className="text-xs sm:text-sm text-[#94A3B8] max-w-md mx-auto">
                    عند الضغط على &quot;جاهز للتسليم&quot; لأي طلب قيد التحضير، يظهر هنا فوراً ويُبلَّغ مندوب إدكاوي لاستلام الشنطة وتوصيلها للعميل.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  {stats.readyOrders.map((order) => (
                    <article
                      key={order.id}
                      className="bg-[#1E293B] border border-[#334155] rounded-2xl p-5 sm:p-6 space-y-4"
                    >
                      <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-[#334155]">
                        <div>
                          <div className="flex items-center gap-2 text-xs">
                            <span
                              dir="ltr"
                              className="font-mono font-bold text-[#F8FAFC] tabular-nums"
                            >
                              #{order.id.slice(0, 8)}
                            </span>
                            <span aria-hidden="true" className="text-[#94A3B8]">
                              ·
                            </span>
                            <span className="font-bold text-emerald-400">
                              جاهز لاستلام مندوب إدكاوي
                            </span>
                          </div>
                          <h3 className="text-base sm:text-lg font-bold text-[#F8FAFC] mt-1">
                            {order.customerName}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setPrintingOrder(order)}
                            title="طباعة فاتورة"
                            className="p-2 rounded-xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] hover:border-[#FF6B00] cursor-pointer"
                          >
                            <Printer className="w-4 h-4 text-[#FF6B00]" aria-hidden="true" />
                          </button>
                          <p className="text-lg font-bold text-[#FF6B00] font-mono tabular-nums">
                            {order.totalAmount}{' '}
                            <span className="text-xs font-sans font-semibold text-[#94A3B8]">
                              ج.م
                            </span>
                          </p>
                        </div>
                      </div>

                      <p className="text-sm text-[#F8FAFC] font-semibold">
                        {order.itemsSummary}
                      </p>

                      <div className="text-xs text-[#94A3B8] space-y-1 pt-2 border-t border-[#334155]">
                        <p>
                          <strong className="text-[#F8FAFC]">
                            الوجهة:
                          </strong>{' '}
                          {order.deliveryNeighborhood} — {order.deliveryAddress}
                        </p>
                        <p>
                          <strong className="text-[#F8FAFC]">
                            الدفع:
                          </strong>{' '}
                          {getPaymentMethodLabel(order.paymentMethod)}
                          {order.courierName
                            ? ` · المندوب المعيّن: ${order.courierName}`
                            : ' · بانتظار وصول مندوب إدكاوي للاستلام'}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {stats.outForDeliveryOrders.length > 0 && (
                <div className="bg-[#1E293B] border border-[#334155] rounded-2xl overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[#334155] flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[#F8FAFC]">
                      طلبات تم استلامها وفي الطريق للعملاء الآن
                    </h3>
                    <span className="font-mono text-xs font-bold text-[#FF6B00] tabular-nums">
                      {stats.outForDeliveryOrders.length}
                    </span>
                  </div>
                  <div className="divide-y divide-[#334155] text-xs sm:text-sm">
                    {stats.outForDeliveryOrders.map((order) => (
                      <div
                        key={order.id}
                        className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div>
                          <span
                            dir="ltr"
                            className="font-mono font-bold text-[#F8FAFC] tabular-nums"
                          >
                            #{order.id.slice(0, 8)}
                          </span>{' '}
                          <span className="font-semibold text-[#F8FAFC]">
                            · {order.customerName}
                          </span>
                          <span className="text-[#94A3B8]">
                            {' '}
                            ({order.deliveryNeighborhood})
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-[#94A3B8]">
                            المندوب: {order.courierName || 'مندوب إدكاوي'}
                          </span>
                          <span className="font-mono font-bold text-[#F8FAFC] tabular-nums">
                            {order.totalAmount} ج.م
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ================================================================
           * 2. MENU & INVENTORY MANAGEMENT PAGE
           * ============================================================== */}
          {activePage === 'menu' && (
            <section className="space-y-5">
              <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <label htmlFor="merchant-menu-search" className="sr-only">
                    البحث في منيو المتجر
                  </label>
                  <Search
                    className="w-4 h-4 text-[#94A3B8] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="merchant-menu-search"
                    type="search"
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    placeholder="ابحث باسم المنتج أو الوصف أو القسم..."
                    className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-sm"
                  />
                </div>

                {menuCategories.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    {menuCategories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setMenuCategoryFilter(cat)}
                        className={`px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                          menuCategoryFilter === cat
                            ? 'bg-[#FF6B00] text-white'
                            : 'bg-[#0F172A] border border-[#334155] text-[#94A3B8] hover:text-[#F8FAFC]'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {isLoadingProducts ? (
                <ProductsGridSkeleton count={4} />
              ) : filteredProducts.length === 0 ? (
                <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-12 text-center space-y-4">
                  <UtensilsCrossed
                    className="w-10 h-10 text-[#94A3B8] mx-auto"
                    aria-hidden="true"
                  />
                  <div className="space-y-1">
                    <h3 className="text-base sm:text-lg font-bold text-[#F8FAFC]">
                      {products.length === 0
                        ? 'لم تضف منتجات حقيقية إلى المتجر بعد'
                        : 'لا توجد منتجات مطابقة للبحث'}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#94A3B8]">
                      ارفع صور منتجاتك الحقيقية من جهازك مع الأسعار والكمية المتاحة لتظهر فوراً لعملاء مدينة إدكو.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddProductModalOpen(true)}
                    className="py-2.5 px-5 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    <span>إضافة أول منتج بصورة من جهازك</span>
                  </button>
                </div>
              ) : (
                <div className="bg-[#1E293B] border border-[#334155] rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="border-b border-[#334155] bg-[#0F172A] text-xs font-bold text-[#94A3B8]">
                          <th className="py-3.5 px-5">المنتج</th>
                          <th className="py-3.5 px-4">القسم</th>
                          <th className="py-3.5 px-4">السعر</th>
                          <th className="py-3.5 px-4">المخزون</th>
                          <th className="py-3.5 px-5 text-left">العروض والتوفر</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#334155] text-sm">
                        {filteredProducts.map((product) => {
                          const isToggling =
                            busyActionKey === `prod_${product.id}`;
                          const isStockUpdating =
                            busyActionKey === `stock_${product.id}`;
                          const isFlashBusy =
                            busyActionKey === `flash_${product.id}`;
                          const currentStock =
                            product.stockQuantity ?? (product.isAvailable ? 20 : 0);

                          return (
                            <tr
                              key={product.id}
                              className="hover:bg-[#0F172A]/60 transition-colors"
                            >
                              <td className="py-3.5 px-5">
                                <div className="flex items-center gap-3.5 min-w-[220px]">
                                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#0F172A] shrink-0 border border-[#334155]">
                                    <ResilientImage
                                      src={product.imageUrl || ''}
                                      alt={product.name}
                                      fallbackTitle={product.name}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <p className="font-bold text-[#F8FAFC] truncate">
                                        {product.name}
                                      </p>
                                      {product.isMysteryBox && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-950/60 border border-orange-800/60 text-[#FF6B00] text-[10px] font-bold shrink-0">
                                          <Gift className="w-3 h-3" />
                                          بوكس مفاجآت
                                        </span>
                                      )}
                                      {product.isFlashSale && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-950/70 border border-amber-700/60 text-amber-300 text-[10px] font-bold shrink-0">
                                          <Zap className="w-3 h-3" />
                                          -{product.flashDiscountPercent ?? 20}%
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-[#94A3B8] line-clamp-1 mt-0.5">
                                      {product.description}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3.5 px-4 text-xs sm:text-sm font-semibold text-[#94A3B8] whitespace-nowrap">
                                {product.category}
                              </td>

                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span className="font-mono font-bold text-[#F8FAFC] tabular-nums">
                                  {product.price}
                                </span>{' '}
                                <span className="text-xs text-[#94A3B8]">
                                  ج.م
                                </span>
                              </td>

                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md tabular-nums ${
                                      currentStock <= 0
                                        ? 'bg-red-950/60 border border-red-800/60 text-red-300'
                                        : 'bg-[#0F172A] border border-[#334155] text-[#F8FAFC]'
                                    }`}
                                  >
                                    {currentStock <= 0
                                      ? 'نفدت الكمية'
                                      : `${currentStock} قطعة`}
                                  </span>
                                  {onUpdateProductStock && (
                                    <>
                                      <button
                                        type="button"
                                        disabled={isStockUpdating}
                                        onClick={() =>
                                          void handleQuickStockAdjust(
                                            product,
                                            currentStock + 5
                                          )
                                        }
                                        className="px-2 py-1 rounded-md bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-[11px] font-bold hover:border-[#FF6B00] cursor-pointer"
                                      >
                                        +5
                                      </button>
                                      {currentStock > 0 && (
                                        <button
                                          type="button"
                                          disabled={isStockUpdating}
                                          onClick={() =>
                                            void handleQuickStockAdjust(
                                              product,
                                              0
                                            )
                                          }
                                          className="px-2 py-1 rounded-md bg-[#0F172A] border border-red-900/70 text-[11px] text-red-400 font-bold cursor-pointer"
                                        >
                                          نفدت
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>

                              <td className="py-3.5 px-5">
                                <div className="flex items-center justify-end gap-2">
                                  {product.isFlashSale ? (
                                    <button
                                      type="button"
                                      disabled={isFlashBusy}
                                      onClick={() =>
                                        void handleDisableFlashSale(product)
                                      }
                                      className="px-2.5 py-1 rounded-lg bg-amber-950/60 border border-amber-700/60 text-amber-300 text-[11px] font-bold inline-flex items-center gap-1 hover:bg-amber-900/60 cursor-pointer whitespace-nowrap"
                                    >
                                      <Zap className="w-3.5 h-3.5" />
                                      <span>إيقاف الفلاش</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={isFlashBusy}
                                      onClick={() => openFlashSaleEditor(product)}
                                      className="px-2.5 py-1 rounded-lg bg-[#0F172A] border border-[#334155] text-[#F8FAFC] hover:border-[#FF6B00] text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                                    >
                                      <Zap className="w-3.5 h-3.5 text-[#FF6B00]" />
                                      <span>عرض فلاش</span>
                                    </button>
                                  )}

                                  <span
                                    className={`text-xs font-bold whitespace-nowrap ${
                                      product.isAvailable
                                        ? 'text-emerald-400'
                                        : 'text-[#94A3B8]'
                                    }`}
                                  >
                                    {product.isAvailable ? 'متاح' : 'متوقف'}
                                  </span>
                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked={product.isAvailable}
                                    aria-label={`تبديل توفر ${product.name}`}
                                    disabled={isToggling}
                                    onClick={() =>
                                      void handleProductSwitchToggle(product)
                                    }
                                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
                                      product.isAvailable
                                        ? 'bg-[#FF6B00]'
                                        : 'bg-[#334155]'
                                    }`}
                                  >
                                    <span
                                      className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                                        product.isAvailable
                                          ? '-translate-x-6'
                                          : '-translate-x-1'
                                      }`}
                                    />
                                  </button>
                                  {onDeleteProduct && (
                                    <button
                                      type="button"
                                      aria-label={`حذف ${product.name}`}
                                      title="حذف المنتج"
                                      disabled={
                                        busyActionKey ===
                                        `del_prod_${product.id}`
                                      }
                                      onClick={() =>
                                        setConfirmDeleteProduct(product)
                                      }
                                      className="p-2 rounded-lg bg-[#0F172A] border border-[#334155] text-red-400 hover:bg-red-950/40 hover:border-red-800 disabled:opacity-50 cursor-pointer"
                                    >
                                      <Trash2
                                        className="w-4 h-4"
                                        aria-hidden="true"
                                      />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ================================================================
           * 3. REPORTS PAGE
           * ============================================================== */}
          {activePage === 'reports' && (
            <section className="space-y-6">
              {(() => {
                const escrowCutoffMs = Date.now() - 24 * 60 * 60 * 1000;
                let availableStoreSales = 0;
                let pendingEscrowSales = 0;
                stats.deliveredOrders.forEach((o) => {
                  const amt = Number(o.subtotal ?? o.totalAmount ?? 0);
                  const ts = new Date(o.updatedAtIso || o.createdAtIso).getTime();
                  if (!Number.isNaN(ts) && ts > escrowCutoffMs) {
                    pendingEscrowSales += amt;
                  } else {
                    availableStoreSales += amt;
                  }
                });
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                    <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-6 space-y-2">
                      <p className="text-xs font-bold text-[#94A3B8]">
                        إجمالي مبيعات اليوم
                      </p>
                      <p className="text-3xl font-bold text-[#FF6B00] font-mono tabular-nums">
                        {stats.todaySalesTotal}{' '}
                        <span className="text-sm font-sans font-semibold text-[#94A3B8]">
                          ج.م
                        </span>
                      </p>
                      <p className="text-xs text-[#94A3B8]">
                        محسوب لحظياً من طلبات اليوم غير الملغاة
                      </p>
                    </div>

                    <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-6 space-y-2">
                      <p className="text-xs font-bold text-[#94A3B8]">
                        عدد طلبات اليوم
                      </p>
                      <p className="text-3xl font-bold text-[#F8FAFC] font-mono tabular-nums">
                        {stats.todayOrdersCount}
                      </p>
                      <p className="text-xs text-[#94A3B8]">
                        متوسط قيمة الطلب:{' '}
                        <span className="font-mono font-bold text-[#F8FAFC]">
                          {stats.todayAverageOrderValue} ج.م
                        </span>
                      </p>
                    </div>

                    <div className="bg-[#1E293B] border border-emerald-700/50 rounded-2xl p-6 space-y-2">
                      <p className="text-xs font-bold text-emerald-400">
                        الرصيد المتاح للتاجر
                      </p>
                      <p className="text-3xl font-bold text-emerald-300 font-mono tabular-nums">
                        {availableStoreSales.toFixed(0)}{' '}
                        <span className="text-sm font-sans font-semibold text-[#94A3B8]">
                          ج.م
                        </span>
                      </p>
                      <p className="text-xs text-[#94A3B8]">
                        مبيعات طلبات مكتملة أتمت ٢٤ ساعة
                      </p>
                    </div>

                    <div className="bg-[#1E293B] border border-amber-700/50 rounded-2xl p-6 space-y-2">
                      <p className="text-xs font-bold text-amber-400">
                        معلق ٢٤ ساعة (ضمان التسليم)
                      </p>
                      <p className="text-3xl font-bold text-amber-300 font-mono tabular-nums">
                        {pendingEscrowSales.toFixed(0)}{' '}
                        <span className="text-sm font-sans font-semibold text-[#94A3B8]">
                          ج.م
                        </span>
                      </p>
                      <p className="text-xs text-[#94A3B8]">
                        يُفرج عنه تلقائياً فور مرور ٢٤ ساعة من التوصيل
                      </p>
                    </div>
                  </div>
                );
              })()}

              <div className="bg-[#1E293B] border border-[#334155] rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[#334155] flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-[#F8FAFC]">
                      سجل طلبات المتجر
                    </h3>
                    <p className="text-xs text-[#94A3B8] mt-0.5">
                      الطلبات المكتملة الكلية:{' '}
                      <span className="font-mono font-bold text-[#F8FAFC] tabular-nums">
                        {stats.deliveredOrders.length}
                      </span>{' '}
                      · صافي مبيعات المنتجات الكلي:{' '}
                      <span className="font-mono font-bold text-[#FF6B00] tabular-nums">
                        {stats.storeSalesTotal}
                      </span>{' '}
                      ج.م
                    </p>
                  </div>
                </div>

                {stats.scopedOrders.length === 0 ? (
                  <div className="p-10 text-center text-sm text-[#94A3B8]">
                    لا توجد طلبات مسجلة لهذا المتجر حتى الآن.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="border-b border-[#334155] bg-[#0F172A] text-xs font-bold text-[#94A3B8]">
                          <th className="py-3 px-5">رقم الطلب</th>
                          <th className="py-3 px-4">العميل</th>
                          <th className="py-3 px-4">الأصناف</th>
                          <th className="py-3 px-4">الحالة</th>
                          <th className="py-3 px-5 text-left">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#334155] text-xs sm:text-sm">
                        {stats.scopedOrders.slice(0, 20).map((order) => (
                          <tr
                            key={order.id}
                            className="hover:bg-[#0F172A]/60"
                          >
                            <td
                              dir="ltr"
                              className="py-3.5 px-5 font-mono font-bold text-[#F8FAFC] tabular-nums text-right whitespace-nowrap"
                            >
                              #{order.id.slice(0, 8)}
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-[#F8FAFC] whitespace-nowrap">
                              {order.customerName}
                            </td>
                            <td className="py-3.5 px-4 text-[#94A3B8] max-w-xs truncate">
                              {order.itemsSummary}
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-[#F8FAFC] whitespace-nowrap">
                              {getOrderStatusLabel(order.status)}
                            </td>
                            <td className="py-3.5 px-5 text-left font-mono font-bold text-[#F8FAFC] tabular-nums whitespace-nowrap">
                              {order.totalAmount} ج.م
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-[#F8FAFC]">
                      تقييمات وآراء عملاء المتجر
                    </h3>
                    <p className="text-xs text-[#94A3B8] mt-0.5">
                      التقييمات الموثقة من العملاء بعد إتمام توصيل الطلبات
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 text-sm font-bold text-[#F8FAFC] tabular-nums">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span>{currentStore.rating.toFixed(1)} من 5</span>
                    <span className="text-xs text-[#94A3B8] font-normal">
                      ({currentStore.reviewCount ?? storeReviews.length} تقييم)
                    </span>
                  </div>
                </div>

                {storeReviews.length === 0 ? (
                  <p className="text-xs sm:text-sm text-[#94A3B8]">
                    لا توجد تعليقات مسجلة بعد — ستظهر هنا تقييمات العملاء فور استلامهم للطلبات.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {storeReviews.slice(0, 6).map((rev) => (
                      <div
                        key={rev.id}
                        className="p-4 rounded-xl bg-[#0F172A] border border-[#334155] space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-[#F8FAFC]">
                            {rev.customerName}
                          </span>
                          <span className="inline-flex items-center gap-1 font-bold text-amber-400 tabular-nums">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            <span>{rev.storeRating}/5</span>
                          </span>
                        </div>
                        {rev.comment && (
                          <p className="text-xs text-[#94A3B8] leading-relaxed">
                            &quot;{rev.comment}&quot;
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ================================================================
           * 4. SETTINGS & INTERACTIVE MAP LOCATION PAGE
           * ============================================================== */}
          {activePage === 'settings' && (
            <section className="max-w-3xl">
              <form
                onSubmit={handleSettingsSubmit}
                noValidate
                className="bg-[#1E293B] border border-[#334155] rounded-2xl p-6 sm:p-8 space-y-6"
              >
                {settingsSavedMsg && (
                  <div
                    role="status"
                    className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-800 text-emerald-200 text-xs sm:text-sm font-bold"
                  >
                    {settingsSavedMsg}
                  </div>
                )}

                {/* Store Interactive Map Location Picker */}
                <div className="space-y-2 pb-5 border-b border-[#334155]">
                  <EdkuLocationPickerMap
                    label="موقع المتجر / الصيدلية على خريطة Google"
                    helperText="ابحث عن موقع المتجر في الخريطة أو اضغط (تلقائي GPS) لتثبيت الإحداثيات الحقيقية للعملاء والمناديب"
                    lat={settingsLat}
                    lng={settingsLng}
                    neighborhood={settingsNeighborhood}
                    autoLocateOnMount={typeof currentStore.lat !== 'number'}
                    onWaterValidationChange={setSettingsWaterPin}
                    onChange={(picked) => {
                      setSettingsLat(picked.lat);
                      setSettingsLng(picked.lng);
                      setSettingsNeighborhood(picked.neighborhood);
                    }}
                  />
                </div>

                {/* Store Cover Photo from Device */}
                <div className="pb-5 border-b border-[#334155]">
                  <DeviceImageInput
                    label="صورة واجهة أو شعار المتجر من جهازك"
                    helperText="ارفع صورة حقيقية عالية الوضوح لمتجرك أو صيدليتك من الموبايل أو الكمبيوتر"
                    value={settingsImageUrl}
                    onChange={setSettingsImageUrl}
                    error={settingsErrors.imageUrl}
                  />
                </div>

                {/* Home Food Badge Toggle */}
                <div className="flex items-center justify-between gap-4 pb-5 border-b border-[#334155]">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-[#F8FAFC] flex items-center gap-1.5">
                      <ChefHat className="w-4 h-4 text-[#FF6B00]" aria-hidden="true" />
                      <span>تصنيف أكل بيتي (تحضير منزلي طازج)</span>
                    </h3>
                    <p className="text-xs text-[#94A3B8] mt-1">
                      تمييز المتجر ضمن قسم أكل بيتي وإظهار إشارة التحضير المنزلي لعملاء إدكو.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settingsIsHomeFood}
                    onClick={() => setSettingsIsHomeFood((prev) => !prev)}
                    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                      settingsIsHomeFood ? 'bg-[#FF6B00]' : 'bg-[#334155]'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${
                        settingsIsHomeFood ? '-translate-x-6' : '-translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-4 pb-5 border-b border-[#334155]">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-[#F8FAFC]">
                      حالة استقبال الطلبات (مفتوح / مغلق)
                    </h3>
                    <p className="text-xs text-[#94A3B8] mt-1">
                      عند الإغلاق، يظل المتجر ظاهراً للعملاء بعلامة &quot;مغلق حالياً&quot; مع إيقاف الطلب منه.
                    </p>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={settingsIsOpen}
                    onClick={() => setSettingsIsOpen((prev) => !prev)}
                    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                      settingsIsOpen ? 'bg-emerald-600' : 'bg-[#334155]'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${
                        settingsIsOpen ? '-translate-x-6' : '-translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label
                      htmlFor="settings-prep-time"
                      className="block text-xs font-bold text-[#F8FAFC] mb-1.5"
                    >
                      وقت التحضير المتوقع (بالدقائق)
                    </label>
                    <input
                      id="settings-prep-time"
                      type="number"
                      dir="ltr"
                      min={5}
                      max={180}
                      value={settingsPrepMinutes}
                      onChange={(e) => setSettingsPrepMinutes(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-sm font-mono tabular-nums text-left"
                    />
                    {settingsErrors.prepTimeMinutes && (
                      <p className="text-xs text-red-400 mt-1">
                        {settingsErrors.prepTimeMinutes}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="settings-min-order"
                      className="block text-xs font-bold text-[#F8FAFC] mb-1.5"
                    >
                      الحد الأدنى للطلب (ج.م)
                    </label>
                    <input
                      id="settings-min-order"
                      type="number"
                      dir="ltr"
                      min={0}
                      max={5000}
                      value={settingsMinOrder}
                      onChange={(e) => setSettingsMinOrder(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-sm font-mono tabular-nums text-left"
                    />
                    <p className="text-[11px] text-[#94A3B8] mt-1">
                      اكتب 0 لعدم اشتراط حد أدنى لقيمة السلة.
                    </p>
                    {settingsErrors.minOrderAmount && (
                      <p className="text-xs text-red-400 mt-1">
                        {settingsErrors.minOrderAmount}
                      </p>
                    )}
                  </div>
                </div>

                {/* Operating Hours (ساعات العمل بتوقيت مصر Africa/Cairo) */}
                <div className="space-y-4 pb-5 border-b border-[#334155]">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-[#F8FAFC] flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-[#FF6B00]" />
                        <span>ساعات العمل اليومية (توقيت مصر)</span>
                      </h3>
                      <p className="text-xs text-[#94A3B8] mt-0.5">
                        يتم حساب فتح وإغلاق المتجر تلقائياً وفقاً لتوقيت مدينة إدكو (Africa/Cairo)
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setSettingsIsManuallyClosed((prev) => !prev)
                      }
                      className={`min-h-[40px] px-4 py-2 rounded-2xl border text-xs font-bold inline-flex items-center gap-2 cursor-pointer transition-colors ${
                        settingsIsManuallyClosed
                          ? 'bg-rose-950/60 border-rose-500/50 text-rose-200'
                          : 'bg-[#0F172A] border-[#334155] text-[#F8FAFC] hover:border-[#FF6B00]'
                      }`}
                    >
                      <span>
                        {settingsIsManuallyClosed
                          ? 'مغلق يدوياً الآن (تجاوز المواعيد)'
                          : 'إغلاق المتجر مؤقتاً يدوياً'}
                      </span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div>
                      <label
                        htmlFor="settings-opening-time"
                        className="block text-xs font-bold text-[#F8FAFC] mb-1.5"
                      >
                        وقت فتح المتجر (مثال: 09:00)
                      </label>
                      <input
                        id="settings-opening-time"
                        type="time"
                        value={settingsOpeningTime}
                        onChange={(e) => setSettingsOpeningTime(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-2xl border border-[#334155] bg-[#0F172A] text-[#F8FAFC] text-sm font-mono text-center"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="settings-closing-time"
                        className="block text-xs font-bold text-[#F8FAFC] mb-1.5"
                      >
                        وقت إغلاق المتجر (مثال: 23:30)
                      </label>
                      <input
                        id="settings-closing-time"
                        type="time"
                        value={settingsClosingTime}
                        onChange={(e) => setSettingsClosingTime(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-2xl border border-[#334155] bg-[#0F172A] text-[#F8FAFC] text-sm font-mono text-center"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDeleteAccountOpen(true);
                      setDeleteAccountError(null);
                    }}
                    className="py-2 px-3.5 rounded-xl bg-[#0F172A] border border-red-900/60 hover:bg-red-950/40 text-red-400 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>حذف حساب المتجر نهائياً</span>
                  </button>

                  <button
                    type="submit"
                    disabled={busyActionKey === 'save_settings'}
                    className="min-h-[44px] py-2.5 px-6 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] active:scale-[0.98] disabled:opacity-60 text-white text-sm font-bold cursor-pointer whitespace-nowrap"
                  >
                    {busyActionKey === 'save_settings'
                      ? 'جارٍ الحفظ...'
                      : 'حفظ إعدادات وموقع المتجر'}
                  </button>
                </div>
              </form>
            </section>
          )}
        </main>
      </div>

      {/* ====================================================================
       * ADD NEW PRODUCT MODAL (MANDATORY DEVICE IMAGE UPLOAD + STOCK + MYSTERY BOX)
       * ================================================================== */}
      {isAddProductModalOpen && (
        <div
          className="edkawi-modal-backdrop flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-product-modal-title"
        >
          <div className="bg-[#1E293B] border border-[#334155] rounded-2xl max-w-lg w-full p-6 sm:p-7 my-8 shadow-xl space-y-5">
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#334155]">
              <h3
                id="add-product-modal-title"
                className="text-lg font-bold text-[#F8FAFC]"
              >
                إضافة منتج جديد للمنيو
              </h3>
              <button
                type="button"
                onClick={resetAddProductModal}
                aria-label="إغلاق النافذة"
                className="p-1.5 rounded-lg text-[#94A3B8] hover:bg-[#0F172A] hover:text-[#F8FAFC] cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {prodFormErrors.submit && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-red-950/50 border border-red-800 text-red-200 text-xs font-semibold"
              >
                {prodFormErrors.submit}
              </div>
            )}

            <form
              onSubmit={handleAddProductSubmit}
              noValidate
              className="space-y-4"
            >
              <DeviceImageInput
                label="صورة المنتج الحقيقية من جهازك (إجباري)"
                helperText="اختر صورة واضحة للمنتج من الموبايل أو الكمبيوتر — لا تُستخدم صور افتراضية"
                value={prodImageUrl}
                onChange={setProdImageUrl}
                required
                error={prodFormErrors.imageUrl}
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="prod-name"
                    className="block text-xs font-bold text-[#F8FAFC] mb-1"
                  >
                    اسم المنتج *
                  </label>
                  <input
                    id="prod-name"
                    type="text"
                    maxLength={80}
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
                    placeholder="مثال: وجبة جمبري مشوي جامبو"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-sm"
                    required
                  />
                  {prodFormErrors.name && (
                    <p className="text-xs text-red-400 mt-1">
                      {prodFormErrors.name}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="prod-price"
                    className="block text-xs font-bold text-[#F8FAFC] mb-1"
                  >
                    السعر (ج.م) *
                  </label>
                  <input
                    id="prod-price"
                    type="number"
                    dir="ltr"
                    min={1}
                    max={5000}
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    placeholder="185"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-sm font-mono tabular-nums text-left"
                    required
                  />
                  {prodFormErrors.price && (
                    <p className="text-xs text-red-400 mt-1">
                      {prodFormErrors.price}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="prod-category"
                    className="block text-xs font-bold text-[#F8FAFC] mb-1"
                  >
                    القسم داخل المنيو *
                  </label>
                  <input
                    id="prod-category"
                    type="text"
                    maxLength={40}
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value)}
                    placeholder="مثال: الوجبات الرئيسية"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-sm"
                    required
                  />
                  {prodFormErrors.category && (
                    <p className="text-xs text-red-400 mt-1">
                      {prodFormErrors.category}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="prod-stock"
                    className="block text-xs font-bold text-[#F8FAFC] mb-1"
                  >
                    الكمية المتاحة بالمخزون
                  </label>
                  <input
                    id="prod-stock"
                    type="number"
                    dir="ltr"
                    min={0}
                    max={10000}
                    value={prodStockQuantity}
                    onChange={(e) => setProdStockQuantity(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-sm font-mono tabular-nums text-left"
                  />
                  {prodFormErrors.stockQuantity && (
                    <p className="text-xs text-red-400 mt-1">
                      {prodFormErrors.stockQuantity}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor="prod-desc"
                  className="block text-xs font-bold text-[#F8FAFC] mb-1"
                >
                  الوصف *
                </label>
                <textarea
                  id="prod-desc"
                  rows={2}
                  maxLength={220}
                  value={prodDescription}
                  onChange={(e) => setProdDescription(e.target.value)}
                  placeholder="وصف مختصر لمكونات الوجبة أو حجمها..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-sm"
                  required
                />
                {prodFormErrors.description && (
                  <p className="text-xs text-red-400 mt-1">
                    {prodFormErrors.description}
                  </p>
                )}
              </div>

              {/* Smart Variants Builder */}
              <div className="p-3.5 rounded-xl bg-[#0F172A] border border-[#334155] space-y-3">
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <span className="block text-xs font-bold text-[#F8FAFC]">
                      تفعيل الأحجام أو المقاسات أو الألوان (Smart Variants)
                    </span>
                    <span className="block text-[11px] text-[#94A3B8]">
                      مثل: صغير / وسط / كبير، أو أحجام البيتزا، أو ألوان ومقاسات الملابس
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={prodHasVariants}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      setProdHasVariants(enabled);
                      if (enabled && prodVariants.length === 0) {
                        setProdVariants([
                          { id: 'v-1', name: 'وسط', price: Math.trunc(Number(prodPrice)) || 25, stockQuantity: 20 },
                          { id: 'v-2', name: 'كبير', price: (Math.trunc(Number(prodPrice)) || 25) + 15, stockQuantity: 20 },
                        ]);
                      }
                    }}
                    className="w-4 h-4 accent-[#FF6B00]"
                  />
                </label>

                {prodHasVariants && (
                  <div className="space-y-2 pt-2 border-t border-[#334155]">
                    <p className="text-[11px] font-bold text-[#94A3B8]">
                      قائمة المقاسات والخيارات:
                    </p>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {prodVariants.map((v, idx) => (
                        <div
                          key={v.id || idx}
                          className="p-2.5 rounded-lg bg-[#1E293B] border border-[#334155] space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-[#FF6B00]">
                              خيار #{idx + 1}
                            </span>
                            {prodVariants.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setProdVariants((prev) =>
                                    prev.filter((_, i) => i !== idx)
                                  )
                                }
                                className="text-[10px] text-red-400 font-bold hover:underline"
                              >
                                حذف
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[10px] text-[#94A3B8]">
                                الاسم/الحجم *
                              </label>
                              <input
                                type="text"
                                value={v.name}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setProdVariants((prev) =>
                                    prev.map((item, i) =>
                                      i === idx ? { ...item, name: val } : item
                                    )
                                  );
                                }}
                                placeholder="مثلاً: لارج"
                                className="w-full px-2 py-1 rounded bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-[#94A3B8]">
                                السعر (ج.م) *
                              </label>
                              <input
                                type="number"
                                dir="ltr"
                                min={1}
                                value={v.price}
                                onChange={(e) => {
                                  const val = Math.max(1, Number(e.target.value));
                                  setProdVariants((prev) =>
                                    prev.map((item, i) =>
                                      i === idx ? { ...item, price: val } : item
                                    )
                                  );
                                }}
                                className="w-full px-2 py-1 rounded bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-xs font-mono text-left"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-[#94A3B8]">
                                المخزون
                              </label>
                              <input
                                type="number"
                                dir="ltr"
                                min={0}
                                value={v.stockQuantity ?? 10}
                                onChange={(e) => {
                                  const val = Math.max(0, Number(e.target.value));
                                  setProdVariants((prev) =>
                                    prev.map((item, i) =>
                                      i === idx
                                        ? { ...item, stockQuantity: val }
                                        : item
                                    )
                                  );
                                }}
                                className="w-full px-2 py-1 rounded bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-xs font-mono text-left"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setProdVariants((prev) => [
                          ...prev,
                          {
                            id: `v-${Date.now()}`,
                            name: `حجم ${prev.length + 1}`,
                            price: Math.trunc(Number(prodPrice)) || 30,
                            stockQuantity: 15,
                          },
                        ])
                      }
                      className="w-full py-1.5 px-3 rounded-lg border border-dashed border-[#FF6B00] text-[#FF6B00] hover:bg-orange-950/40 text-xs font-bold inline-flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة خيار أو مقاس إضافي</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Mystery Box Option */}
              <div className="p-3.5 rounded-xl bg-[#0F172A] border border-[#334155] space-y-3">
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <span className="flex items-center gap-2 text-xs font-bold text-[#F8FAFC]">
                    <Gift className="w-4 h-4 text-[#FF6B00]" />
                    <span>طرح هذا الصنف كبوكس مفاجآت مخفض (Mystery Box)</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={prodIsMysteryBox}
                    onChange={(e) => setProdIsMysteryBox(e.target.checked)}
                    className="w-4 h-4 accent-[#FF6B00]"
                  />
                </label>

                {prodIsMysteryBox && (
                  <div>
                    <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                      القيمة الأصلية للبوكس قبل الخصم (ج.م)
                    </label>
                    <input
                      type="number"
                      dir="ltr"
                      min={1}
                      max={5000}
                      value={prodOriginalValue}
                      onChange={(e) => setProdOriginalValue(e.target.value)}
                      placeholder="مثال: 150"
                      className="w-full px-3 py-2 rounded-xl bg-[#1E293B] border border-[#334155] text-[#F8FAFC] text-xs font-mono text-left"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetAddProductModal}
                  className="min-h-[44px] px-4 rounded-xl bg-[#0F172A] border border-[#334155] text-xs font-bold text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submittingProduct}
                  className="min-h-[44px] px-6 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-60 text-white text-xs sm:text-sm font-bold cursor-pointer"
                >
                  {submittingProduct ? 'جارٍ الحفظ...' : 'حفظ المنتج في المنيو'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
       * FULL-SCREEN PRESCRIPTION PHOTO ZOOM MODAL
       * ================================================================== */}
      {zoomedPrescriptionUrl && (
        <div
          className="edkawi-modal-backdrop flex items-center justify-center p-4"
          onClick={() => setZoomedPrescriptionUrl(null)}
        >
          <div
            className="max-w-3xl w-full max-h-[90vh] flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between text-[#F8FAFC]">
              <span className="text-sm font-bold">
                معاينة صورة الروشتة الطبية بوضوح كامل
              </span>
              <button
                type="button"
                onClick={() => setZoomedPrescriptionUrl(null)}
                className="px-3.5 py-1.5 rounded-xl bg-[#1E293B] border border-[#334155] hover:border-[#FF6B00] text-xs font-bold cursor-pointer"
              >
                إغلاق المعاينة
              </button>
            </div>
            <div className="bg-[#0F172A] rounded-2xl border border-[#334155] p-2 overflow-auto max-h-[82vh] flex items-center justify-center">
              <img
                src={zoomedPrescriptionUrl}
                alt="معاينة الروشتة الطبية"
                className="max-w-full max-h-[78vh] object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
       * AI MENU OCR SCAN & BATCH IMPORT MODAL
       * ================================================================== */}
      {isOcrModalOpen && (
        <div
          className="edkawi-modal-backdrop flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ocr-modal-title"
        >
          <div className="bg-[#1E293B] border border-[#334155] rounded-2xl max-w-2xl w-full p-6 sm:p-7 my-8 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#334155]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-orange-950/60 border border-orange-800/50 text-[#FF6B00] flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="ocr-modal-title" className="text-base sm:text-lg font-bold text-[#F8FAFC]">
                    استخراج المنيو الذكي بالكاميرا (AI OCR)
                  </h3>
                  <p className="text-xs text-[#94A3B8]">
                    ارفع صورة قائمة الطعام أو المنيو الورقي وسيقوم الذكاء الاصطناعي باستخراج الأصناف والأسعار فوراً
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOcrModalOpen(false);
                  setOcrImageDataUrl('');
                  setOcrExtractedItems([]);
                }}
                className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {ocrError && (
              <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-800 text-red-200 text-xs font-semibold">
                {ocrError}
              </div>
            )}

            {ocrExtractedItems.length === 0 ? (
              <div className="space-y-4">
                <DeviceImageInput
                  label="اختر أو التقط صورة المنيو الورقي من جهازك"
                  required
                  value={ocrImageDataUrl}
                  onChange={(val) => setOcrImageDataUrl(val)}
                  helperText="التقط صورة واضحة بإضاءة جيدة تظهر أسماء الأصناف وأسعارها"
                />

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsOcrModalOpen(false)}
                    className="min-h-[44px] px-4 rounded-xl bg-[#0F172A] border border-[#334155] text-xs font-bold text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    disabled={!ocrImageDataUrl || ocrScanning}
                    onClick={() => void handleRunOcrScan()}
                    className="min-h-[44px] px-6 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-50 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{ocrScanning ? 'جارٍ تحليل المنيو بالذكاء الاصطناعي...' : 'بدء المسح واستخراج الأصناف'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-semibold text-[#94A3B8]">
                  <span>تم العثور على {ocrExtractedItems.length} صنف. اختر الأصناف التي ترغب في حفظها بالمنيو:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const allSelected = ocrExtractedItems.every((_, i) => ocrSelectedMap[i]);
                      const next: Record<number, boolean> = {};
                      ocrExtractedItems.forEach((_, i) => {
                        next[i] = !allSelected;
                      });
                      setOcrSelectedMap(next);
                    }}
                    className="text-[#FF6B00] hover:underline cursor-pointer"
                  >
                    تحديد / إلغاء تحديد الكل
                  </button>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2 border border-[#334155] bg-[#0F172A] rounded-xl p-2">
                  {ocrExtractedItems.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border transition-colors flex items-start gap-3 ${
                        ocrSelectedMap[idx]
                          ? 'bg-orange-950/20 border-orange-800/60'
                          : 'bg-[#1E293B] border-[#334155] opacity-60'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={!!ocrSelectedMap[idx]}
                        onChange={(e) =>
                          setOcrSelectedMap((prev) => ({
                            ...prev,
                            [idx]: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 mt-1 accent-[#FF6B00] cursor-pointer"
                      />
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] text-[#94A3B8]">اسم الصنف</label>
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => {
                              const v = e.target.value;
                              setOcrExtractedItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, name: v } : it))
                              );
                            }}
                            className="w-full px-2 py-1 rounded bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-xs font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#94A3B8]">السعر (ج.م)</label>
                          <input
                            type="number"
                            dir="ltr"
                            value={item.price}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              setOcrExtractedItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, price: v } : it))
                              );
                            }}
                            className="w-full px-2 py-1 rounded bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#94A3B8]">التصنيف</label>
                          <input
                            type="text"
                            value={item.category}
                            onChange={(e) => {
                              const v = e.target.value;
                              setOcrExtractedItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, category: v } : it))
                              );
                            }}
                            className="w-full px-2 py-1 rounded bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOcrExtractedItems([]);
                      setOcrSelectedMap({});
                    }}
                    className="min-h-[44px] px-4 rounded-xl bg-[#0F172A] border border-[#334155] text-xs font-bold text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
                  >
                    مسح صورة أخرى
                  </button>
                  <button
                    type="button"
                    disabled={ocrBatchSaving}
                    onClick={() => void handleSaveOcrBatch()}
                    className="min-h-[44px] px-6 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-50 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>{ocrBatchSaving ? 'جارٍ الحفظ في المنيو...' : 'حفظ الأصناف المحددة في المنيو'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====================================================================
       * KITCHEN RECEIPT PRINT MODAL
       * ================================================================== */}
      {printingOrder && (
        <div
          className="edkawi-modal-backdrop flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[#1E293B] border border-[#334155] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="no-print flex items-center justify-between border-b border-[#334155] pb-3">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-[#FF6B00]" />
                <h3 className="text-base font-bold text-[#F8FAFC]">
                  معاينة وطباعة فاتورة المطبخ
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPrintingOrder(null)}
                className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="edkawi-print-area bg-[#0F172A] border border-[#334155] rounded-2xl p-5 space-y-4 text-[#F8FAFC]">
              <div className="text-center border-b border-dashed border-[#334155] pb-3 space-y-1">
                <p className="text-lg font-extrabold text-[#FF6B00]">إدكاوي — فاتورة تحضير</p>
                <p className="text-sm font-bold">{currentStore.name}</p>
                <p className="text-xs font-mono text-[#94A3B8]">
                  #{printingOrder.id.slice(0, 8)} ·{' '}
                  {new Date(printingOrder.createdAtIso).toLocaleString('ar-EG', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </p>
              </div>

              <div className="text-xs space-y-1 border-b border-dashed border-[#334155] pb-3">
                <p>
                  <strong className="text-[#94A3B8]">العميل:</strong> {printingOrder.customerName}
                </p>
                <p>
                  <strong className="text-[#94A3B8]">الهاتف:</strong>{' '}
                  <span dir="ltr" className="font-mono">{printingOrder.customerPhone}</span>
                </p>
                <p>
                  <strong className="text-[#94A3B8]">العنوان:</strong>{' '}
                  {printingOrder.deliveryNeighborhood} — {printingOrder.deliveryAddress}
                </p>
              </div>

              <div className="space-y-2 border-b border-dashed border-[#334155] pb-3 text-xs">
                {printingOrder.items && printingOrder.items.length > 0 ? (
                  printingOrder.items.map((item) => (
                    <div key={item.productId} className="flex items-center justify-between gap-2">
                      <span>
                        {item.name} × {item.quantity}
                      </span>
                      <span className="font-mono font-bold">
                        {item.price * item.quantity} ج.م
                      </span>
                    </div>
                  ))
                ) : (
                  <p>{printingOrder.itemsSummary}</p>
                )}
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between text-[#94A3B8]">
                  <span>المجموع الفرعي</span>
                  <span className="font-mono">{printingOrder.subtotal} ج.م</span>
                </div>
                <div className="flex items-center justify-between text-[#94A3B8]">
                  <span>رسوم التوصيل</span>
                  <span className="font-mono">{printingOrder.deliveryFee} ج.م</span>
                </div>
                <div className="flex items-center justify-between text-sm font-extrabold text-[#FF6B00] pt-1 border-t border-[#334155]">
                  <span>الإجمالي</span>
                  <span className="font-mono">{printingOrder.totalAmount} ج.م</span>
                </div>
              </div>
            </div>

            <div className="no-print flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPrintingOrder(null)}
                className="min-h-[44px] px-4 rounded-xl bg-[#0F172A] border border-[#334155] text-xs font-bold text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
              >
                إغلاق
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="min-h-[44px] px-5 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة الفاتورة الآن</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
       * FLASH SALE EDITOR MODAL
       * ================================================================== */}
      {flashSaleModalProduct && (
        <div
          className="edkawi-modal-backdrop flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveFlashSaleSubmit}
            className="bg-[#1E293B] border border-[#334155] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#334155]">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#FF6B00]" />
                <h3 className="text-base font-bold text-[#F8FAFC]">
                  تفعيل عرض فلاش سريع
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setFlashSaleModalProduct(null)}
                className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#94A3B8]">
              المنتج: <strong className="text-[#F8FAFC]">{flashSaleModalProduct.name}</strong>
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#F8FAFC] mb-1">
                  نسبة الخصم (5% - 90%)
                </label>
                <input
                  type="number"
                  dir="ltr"
                  min={5}
                  max={90}
                  value={flashDiscountInput}
                  onChange={(e) => setFlashDiscountInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-sm font-mono text-left"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#F8FAFC] mb-1">
                  المدة (1 - 72 ساعة)
                </label>
                <input
                  type="number"
                  dir="ltr"
                  min={1}
                  max={72}
                  value={flashDurationHoursInput}
                  onChange={(e) => setFlashDurationHoursInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-sm font-mono text-left"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={savingFlashSale}
                onClick={() => setFlashSaleModalProduct(null)}
                className="min-h-[44px] px-4 rounded-xl bg-[#0F172A] border border-[#334155] text-xs font-bold text-[#94A3B8] cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={savingFlashSale}
                className="min-h-[44px] px-5 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-60 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-4 h-4" />
                <span>{savingFlashSale ? 'جارٍ التفعيل...' : 'تفعيل العرض الآن'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ====================================================================
       * SELF-SERVICE DELETE ACCOUNT CONFIRMATION MODAL
       * ================================================================== */}
      {isDeleteAccountOpen && (
        <div
          className="edkawi-modal-backdrop flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[#1E293B] border border-red-900 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-950/60 border border-red-800/60 text-red-400 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#F8FAFC]">
                حذف حساب المتجر نهائياً؟
              </h3>
              <p className="text-xs text-[#94A3B8] mt-1.5 leading-relaxed">
                هل أنت متأكد من رغبتك في حذف هذا الحساب نهائياً؟ سيتم مسح بيانات تسجيل الدخول بالكامل وحذف وثيقة المتجر من قاعدة البيانات، ولن تتمكن من استرجاعها مجدداً.
              </p>
            </div>

            {deleteAccountError && (
              <div className="p-3 rounded-xl bg-red-950/50 border border-red-800 text-red-200 text-xs font-semibold">
                {deleteAccountError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={deleteAccountBusy}
                onClick={() => setIsDeleteAccountOpen(false)}
                className="min-h-[44px] px-4 rounded-xl bg-[#0F172A] border border-[#334155] text-xs font-bold text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={deleteAccountBusy}
                onClick={() => void handleConfirmDeleteAccount()}
                className="min-h-[44px] px-5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{deleteAccountBusy ? 'جارٍ الحذف...' : 'نعم، احذف حسابي نهائياً'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {merchantUid && (
        <PortalSupportModal
          isOpen={isSupportModalOpen}
          onClose={() => setIsSupportModalOpen(false)}
          currentUserUid={merchantUid}
          userName={currentStore.name}
          userEmail={merchantEmail}
          userRole="store"
          onNotify={onNotify}
        />
      )}

      <ConfirmActionModal
        isOpen={Boolean(confirmCancelOrderId)}
        title="تأكيد رفض / إلغاء الطلب"
        description="هل أنت متأكد من رفض أو إلغاء هذا الطلب؟ سيتم إشعار العميل وإرجاع المبلغ لمحفظته تلقائياً إن كان مدفوعاً بالمحفظة."
        confirmLabel="نعم، رفض الطلب"
        tone="danger"
        isProcessing={Boolean(confirmCancelOrderId && busyActionKey === `reject_${confirmCancelOrderId}`)}
        onCancel={() => setConfirmCancelOrderId(null)}
        onConfirm={() => {
          if (!confirmCancelOrderId) return;
          const id = confirmCancelOrderId;
          setConfirmCancelOrderId(null);
          void handleRejectOrderClick(id);
        }}
      />

      <ConfirmActionModal
        isOpen={Boolean(confirmDeleteProduct)}
        title="حذف المنتج من المنيو"
        description={`هل أنت متأكد من حذف "${confirmDeleteProduct?.name ?? ''}" نهائياً من منيو المتجر؟`}
        confirmLabel="حذف المنتج"
        tone="danger"
        isProcessing={Boolean(confirmDeleteProduct && busyActionKey === `del_prod_${confirmDeleteProduct.id}`)}
        onCancel={() => setConfirmDeleteProduct(null)}
        onConfirm={() => {
          if (!confirmDeleteProduct) return;
          const prod = confirmDeleteProduct;
          setConfirmDeleteProduct(null);
          void handleDeleteProductClick(prod);
        }}
      />

      <ConfirmActionModal
        isOpen={confirmLogoutOpen}
        title="تسجيل الخروج من بوابة المتجر"
        description="هل تريد تسجيل الخروج من لوحة التاجر؟ ستتوقف تنبيهات الطلبات الجديدة حتى تعود للدخول."
        confirmLabel="تسجيل الخروج"
        tone="warning"
        onCancel={() => setConfirmLogoutOpen(false)}
        onConfirm={() => {
          setConfirmLogoutOpen(false);
          onLogout?.();
        }}
      />
    </div>
  );
}
