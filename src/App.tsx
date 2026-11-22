/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { onAuthStateChanged, User } from 'firebase/auth';
import { ShieldAlert } from 'lucide-react';
import { auth, validateFirestoreConnection } from './firebase';
import {
  acceptOrderByStoreInFirestore,
  addProductToFirestore,
  approveCourierByAdminInFirestore,
  approveCustomErrandQuoteByCustomerInFirestore,
  approvePharmacyQuoteByCustomerInFirestore,
  assignCourierManuallyInFirestore,
  cancelPendingOrderInFirestore,
  checkFirebaseConnectionHealth,
  completeCustomerOnboardingInFirestore,
  completeOrderDeliveryInFirestore,
  confirmCustomerOrderInFirestore,
  createAdBannerByAdminInFirestore,
  createCampaignByAdminInFirestore,
  createCourierByAdminInFirestore,
  createSharedCartInFirestore,
  createStoreByAdminInFirestore,
  deleteAdBannerByAdminInFirestore,
  deleteCampaignByAdminInFirestore,
  deleteCouponByAdminInFirestore,
  deleteProductByAdminOrStoreInFirestore,
  fetchStoreCredentialsMapForAdmin,
  formatFirebaseAuthError,
  giftPointsByAdminInFirestore,
  listenToActiveAds,
  listenToActiveCampaigns,
  listenToAdminAds,
  listenToAdminAuditLogs,
  listenToAdminBroadcastHistory,
  listenToAdminCampaigns,
  listenToAdminCoupons,
  listenToAdminCouriers,
  listenToAdminCustomersWithPii,
  listenToAdminOrders,
  listenToAdminStores,
  listenToAllAvailableProducts,
  listenToAllSupportTicketsForAdmin,
  listenToAssignedSupportTickets,
  listenToBlockedEntitiesForAdmin,
  listenToCourierOrdersAndDispatch,
  listenToCustomerDirectory,
  listenToCustomerOrders,
  listenToCustomerReviews,
  listenToCustomerWalletTopups,
  listenToCustomerWalletTransactions,
  listenToLiveEvents,
  listenToAdminWalletTopups,
  listenToMerchantOrders,
  listenToMerchantStoreProducts,
  listenToMerchantStores,
  listenToMysteryBoxProducts,
  listenToSharedCart,
  listenToSingleBlockedStatus,
  listenToSingleCourier,
  listenToStaffMembersForAdmin,
  listenToStoreProducts,
  listenToStoreReviews,
  listenToStores,
  listenToSystemMaintenanceConfig,
  listenToUserNotifications,
  listenToUserProfile,
  loginAnonymously,
  loginUnifiedWithEmailAndPassword,
  loginWithGoogleCustomer,
  logoutUser,
  markAllNotificationsReadInFirestore,
  markNotificationReadInFirestore,
  markOrderReadyByStoreInFirestore,
  pickupOrderByCourierInFirestore,
  placeCustomErrandOrderInFirestore,
  placeOrderInFirestore,
  placePharmacyPrescriptionOrderInFirestore,
  purgeAllQaAndTestDataInFirestore,
  purgeDemoDataByAdminInFirestore,
  quoteCustomErrandByCourierInFirestore,
  quotePharmacyOrderByStoreInFirestore,
  redeemPointsForCouponInFirestore,
  registerCustomerWithEmailAndPassword,
  releaseOrderByCourierInFirestore,
  resolveUserPortalRole,
  runSimulateOrderCycleTestInFirestore,
  sendAdminNotificationInFirestore,
  setCustomerBanStatusByAdminInFirestore,
  setEntityBlockedByAdminInFirestore,
  submitOrderReviewInFirestore,
  toggleAdBannerActiveByAdminInFirestore,
  toggleCampaignActiveByAdminInFirestore,
  toggleCouponActiveByAdminInFirestore,
  toggleFavoriteStoreInFirestore,
  toggleProductAvailableInFirestore,
  toggleStoreActiveInFirestore,
  toggleStoreOpenInFirestore,
  updateCourierLiveGpsInFirestore,
  updateCustomerAccountDetailsInFirestore,
  updateOrderCourierLocationInFirestore,
  updateProductStockInFirestore,
  updateSharedCartEntryQuantityInFirestore,
  updateStoreDeliveryFeeByAdminInFirestore,
  updateStoreSettingsInFirestore,
  updateSystemMaintenanceByAdminInFirestore,
  upsertCouponByAdminInFirestore,
  upsertCourierAvailabilityInFirestore,
  upsertSharedCartItemInFirestore,
  validateCouponCodeInFirestore,
  seedAndListenToEdkoZones,
  seedAndListenToSuperAppCategories,
  savePendingSessionReferralCode,
  deleteCurrentAccountCompletely,
} from './services/edkawiFirebaseService';
import {
  EdkoZoneRecord,
  ProductVariant,
  SuperAppCategoryRecord,
  ActiveTab,
  ActiveView,
  AdBannerInput,
  AdBannerRecord,
  AdminCreateCourierInput,
  AdminCreateStoreInput,
  AdminCustomerRecord,
  AdminNotificationSendInput,
  AppliedCoupon,
  AppNotificationRecord,
  AuditLogRecord,
  BlockedEntityRecord,
  BlockedEntityType,
  CampaignInput,
  CampaignRecord,
  CartItem,
  CheckoutFormInput,
  CompleteProfileInput,
  CouponInput,
  CouponRecord,
  CourierApprovalStatus,
  CourierCredentialRecord,
  CourierProfileInput,
  CourierRecord,
  CustomErrandOrderInput,
  CustomerDirectoryEntry,
  FirebaseConnectionHealthResult,
  LegalSectionKey,
  LiveEventRecord,
  MenuItem,
  NewProductInput,
  OrderRecord,
  OrderStatus,
  PaymentMethod,
  PharmacyPrescriptionOrderInput,
  PortalRole,
  ProductRecord,
  QaSimulationReport,
  ReviewRecord,
  ReviewSubmitInput,
  SavedAddressItem,
  SharedCartRecord,
  StaffMemberRecord,
  StoreCredentialRecord,
  StoreOperationalSettingsInput,
  StoreRecord,
  SupportTicketRecord,
  SystemMaintenanceConfig,
  UserProfileRecord,
  WalletTopupRequestRecord,
  WalletTransactionRecord,
} from './types/edkawi';
import {
  addItemToCartState,
  calculateCartTotals,
  EDKU_ROUTE_WAYPOINTS,
  formatAppErrorMessage,
  isStoreCurrentlyOpen,
  normalizeEgyptPhoneOrEmpty,
  removeItemFromCartState,
  updateCartQuantityState,
} from './utils/orderLogic';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Navbar } from './components/Navbar';
import { FloatingCartBar } from './components/FloatingCartBar';
import { AuthScreen } from './components/AuthScreen';
import { StoresView } from './components/StoresView';
import { StoreMenuView } from './components/StoreMenuView';
import { AddStoreModal } from './components/AddStoreModal';
import {
  CartPageView,
  CheckoutPageView,
  OrdersHistoryView,
  OrderTrackingView,
} from './components/CartAndOrdersView';
import { AccountSection, CustomerAccountView } from './components/CustomerAccountView';
import {
  CompleteProfileModal,
  CustomerBottomNav,
  EdkawyAiChatWidget,
  NotificationsDrawer,
  OrderReviewModal,
} from './components/CustomerOverlays';
import {
  BlockedAccountScreen,
  LegalPagesModal,
  MaintenanceModeScreen,
} from './components/LegalPagesModal';
import { StorePortalView } from './components/StorePortalView';
import { CourierPortalView } from './components/CourierPortalView';
import { AdminPortalView } from './components/AdminPortalView';
import { StoresGridSkeleton } from './components/SkeletonLoaders';
import {
  OperationsPortalView,
  SupportAgentPortalView,
} from './components/StaffAndOperationsViews';
import {
  DailySpinWheelModal,
  ErrandServiceModal,
  GooglePlayReviewPromptModal,
  shouldShowGooglePlayReviewPrompt,
  VisualSearchModal,
} from './components/ExclusiveEdkawyModals';
import { SalesAgentPortalView } from './components/SalesAgentPortalView';
import { StoreJoinView } from './components/StoreJoinView';
import { GroupOrderRoomView } from './components/GroupOrderRoomView';
import { Toaster, toast } from 'react-hot-toast';
import { WifiOff } from 'lucide-react';
import { EdkawySplashScreen } from './components/EdkawySplashScreen';
import { CustomerOrders } from './components/CustomerOrders';
import { StoreOrders } from './components/StoreOrders';
import { CourierOrders } from './components/CourierOrders';

const CART_STORAGE_KEY = 'edkawi_customer_cart_v1';
const MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '').trim();

function OptionalMapsProvider({ children }: { children: ReactNode }) {
  if (!MAPS_API_KEY) {
    return <>{children}</>;
  }
  return (
    <APIProvider apiKey={MAPS_API_KEY} language="ar" region="EG">
      {children}
    </APIProvider>
  );
}

function EdkawiWorkspace() {
  const isAutostartUrl = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('autostart') === '1';
  }, []);

  // Google Maps Demo Key Quota Exceeded Top-Level State
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  const [accountInitialSection, setAccountInitialSection] =
    useState<AccountSection>('addresses');

  const [authReady, setAuthReady] = useState(false);
  const [roleReady, setRoleReady] = useState(false);
  const [pendingAuthTransition, setPendingAuthTransition] = useState(false);
  const pendingAuthTransitionRef = useRef(false);
  const pendingReturnToCheckoutRef = useRef(false);
  const autoPromptedReviewOrdersRef = useRef<Set<string>>(new Set());
  const autoOpenedSharedStoreRef = useRef<string | null>(null);
  const [hasPendingCartForCheckout, setHasPendingCartForCheckout] =
    useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [autostartPreviewSession, setAutostartPreviewSession] = useState(false);

  const [activePortal, setActivePortal] = useState<PortalRole>('customer');
  const [activeView, setActiveView] = useState<ActiveView>('stores');
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [aiChatOpenTrigger, setAiChatOpenTrigger] = useState(0);

  // Client Pathname Routing (/admin, /admin/requests, /store, /courier, /join, /group/:roomCode, /)
  const [currentPath, setCurrentPath] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );

  function navigateToPath(nextPath: string) {
    if (typeof window === 'undefined') return;
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setCurrentPath(nextPath);
    window.scrollTo(0, 0);
  }

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Role-based URL synchronization when authenticated
  useEffect(() => {
    if (!authReady || !roleReady || pendingAuthTransition || !user || user.isAnonymous) {
      return;
    }
    if (currentPath === '/join' || currentPath.startsWith('/group/')) {
      return;
    }
    if (activePortal === 'admin') {
      if (currentPath !== '/admin' && currentPath !== '/admin/requests') {
        navigateToPath('/admin');
      }
    } else if (activePortal === 'store') {
      if (currentPath !== '/store') {
        navigateToPath('/store');
      }
    } else if (activePortal === 'courier') {
      if (currentPath !== '/courier') {
        navigateToPath('/courier');
      }
    } else if (activePortal === 'customer') {
      if (
        currentPath === '/admin' ||
        currentPath === '/admin/requests' ||
        currentPath === '/store' ||
        currentPath === '/courier'
      ) {
        navigateToPath('/');
      }
    }
  }, [authReady, roleReady, pendingAuthTransition, user, activePortal, currentPath]);

  // User Profile, Onboarding, Notifications & Reviews State
  const [userProfile, setUserProfile] = useState<UserProfileRecord | null>(
    null
  );
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [onboardingSkippedSession, setOnboardingSkippedSession] =
    useState(false);

  const [notifications, setNotifications] = useState<AppNotificationRecord[]>(
    []
  );
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Ads, Campaigns, Coupons, Mystery Box & Customer Directory
  const [activeAds, setActiveAds] = useState<AdBannerRecord[]>([]);
  const [isLoadingAds, setIsLoadingAds] = useState(true);
  const [activeCampaigns, setActiveCampaigns] = useState<CampaignRecord[]>([]);
  const [mysteryBoxProducts, setMysteryBoxProducts] = useState<ProductRecord[]>(
    []
  );
  const [allAvailableProducts, setAllAvailableProducts] = useState<
    ProductRecord[]
  >([]);

  const [adminAds, setAdminAds] = useState<AdBannerRecord[]>([]);
  const [adminCoupons, setAdminCoupons] = useState<CouponRecord[]>([]);
  const [adminCampaigns, setAdminCampaigns] = useState<CampaignRecord[]>([]);
  const [customersDirectory, setCustomersDirectory] = useState<
    CustomerDirectoryEntry[]
  >([]);
  const [adminCustomersWithPii, setAdminCustomersWithPii] = useState<
    AdminCustomerRecord[]
  >([]);
  const [adminAuditLogs, setAdminAuditLogs] = useState<AuditLogRecord[]>([]);
  const [adminBroadcastHistory, setAdminBroadcastHistory] = useState<
    AppNotificationRecord[]
  >([]);
  const [adminSupportTickets, setAdminSupportTickets] = useState<
    SupportTicketRecord[]
  >([]);
  const [assignedSupportTickets, setAssignedSupportTickets] = useState<
    SupportTicketRecord[]
  >([]);
  const [staffMembers, setStaffMembers] = useState<StaffMemberRecord[]>([]);
  const [liveEvents, setLiveEvents] = useState<LiveEventRecord[]>([]);
  const [customerWalletTopups, setCustomerWalletTopups] = useState<
    WalletTopupRequestRecord[]
  >([]);
  const [customerWalletTransactions, setCustomerWalletTransactions] = useState<
    WalletTransactionRecord[]
  >([]);
  const [adminWalletTopups, setAdminWalletTopups] = useState<
    WalletTopupRequestRecord[]
  >([]);

  const [isVisualSearchOpen, setIsVisualSearchOpen] = useState(false);
  const [isErrandModalOpen, setIsErrandModalOpen] = useState(false);

  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(
    null
  );

  // Zonal Pricing, Super App Categories, Daily Spin & Review Prompt States
  const [edkoZones, setEdkoZones] = useState<EdkoZoneRecord[]>([]);
  const [superAppCategories, setSuperAppCategories] = useState<SuperAppCategoryRecord[]>([]);
  const [isDailySpinOpen, setIsDailySpinOpen] = useState(false);
  const [isPlayReviewOpen, setIsPlayReviewOpen] = useState(false);

  // Collaborative Group Order (?groupCart=<id>)
  const [activeGroupCartId, setActiveGroupCartId] = useState<string | null>(
    () => {
      if (typeof window === 'undefined') return null;
      const param = new URLSearchParams(window.location.search).get('groupCart');
      return param && param.trim() ? param.trim() : null;
    }
  );
  const [activeSharedCart, setActiveSharedCart] =
    useState<SharedCartRecord | null>(null);

  const [storeReviews, setStoreReviews] = useState<ReviewRecord[]>([]);
  const [customerReviewsByOrderId, setCustomerReviewsByOrderId] = useState<
    Record<string, ReviewRecord>
  >({});
  const [reviewModalOrder, setReviewModalOrder] = useState<OrderRecord | null>(
    null
  );

  const [allStores, setAllStores] = useState<StoreRecord[]>([]);
  const [storeCredentialsMap, setStoreCredentialsMap] = useState<
    Record<string, StoreCredentialRecord>
  >({});
  const [isLoadingStores, setIsLoadingStores] = useState(true);
  const [storesError, setStoresError] = useState<string | null>(null);

  const [storeProducts, setStoreProducts] = useState<ProductRecord[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);

  const [portalOrders, setPortalOrders] = useState<OrderRecord[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const [currentCourierRecord, setCurrentCourierRecord] =
    useState<CourierRecord | null>(null);
  const [isLoadingCourier, setIsLoadingCourier] = useState(false);
  const [liveCouriers, setLiveCouriers] = useState<CourierRecord[]>([]);

  // Cart State with offline localStorage restoration
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = window.localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Storage quota or parsing error
    }
    return [];
  });

  // Offline / Online Network State
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('تمت استعادة الاتصال بالإنترنت بنجاح 🌐');
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.error('أنت غير متصل بالإنترنت حالياً. بياناتك وسلتك محفوظة محلياً ⚠️');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Save Cart to localStorage whenever modified
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (cart.length > 0) {
        window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
      } else {
        window.localStorage.removeItem(CART_STORAGE_KEY);
      }
    } catch {
      // Storage quota or private mode
    }
  }, [cart]);

  const [trackedOrderId, setTrackedOrderId] = useState<string | null>(null);
  const [justPlacedOrderId, setJustPlacedOrderId] = useState<string | null>(
    null
  );
  const [optimisticPlacedOrder, setOptimisticPlacedOrder] =
    useState<OrderRecord | null>(null);

  const [isAddStoreOpen, setIsAddStoreOpen] = useState(false);
  const [noticeBanner, setNoticeBanner] = useState<string | null>(null);

  // Invitation Token State (?token=UUID or ?inviteToken=UUID)
  const [pendingInviteToken, setPendingInviteToken] = useState<string | null>(null);

  // Maintenance Mode, Account Blocking & Legal Center Modal State
  const [maintenanceConfig, setMaintenanceConfig] =
    useState<SystemMaintenanceConfig>({
      maintenanceMode: false,
      maintenanceMessage:
        'تطبيق إدكاوي في وضع الصيانة والتحديث حالياً لرفع كفاءة الخدمة في مدينة إدكو — سنعود للعمل خلال دقائق.',
      updatedBy: '',
      updatedAtIso: '',
    });
  const [forceAdminLoginInMaintenance, setForceAdminLoginInMaintenance] =
    useState(false);
  const [currentUserBlockRecord, setCurrentUserBlockRecord] =
    useState<BlockedEntityRecord | null>(null);
  const [currentStoreBlockRecord, setCurrentStoreBlockRecord] =
    useState<BlockedEntityRecord | null>(null);
  const [adminBlockedEntities, setAdminBlockedEntities] = useState<
    Record<string, BlockedEntityRecord>
  >({});
  const [legalModalState, setLegalModalState] = useState<{
    isOpen: boolean;
    section: LegalSectionKey;
  }>({ isOpen: false, section: 'terms' });

  // URL Parameters Parsing on Mount (?ref=AGENT-XXXX, ?inviteToken=UUID, ?token=UUID)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref');
      if (ref && ref.trim()) {
        savePendingSessionReferralCode(ref.trim());
      }
      const token = params.get('token') || params.get('inviteToken');
      if (token && token.trim()) {
        setPendingInviteToken(token.trim());
      }
    } catch {
      // Ignore in restricted environment
    }
  }, []);

  // Subscribe to live Edko Zones & Super App Categories
  useEffect(() => {
    const unsubZones = seedAndListenToEdkoZones((zones) => {
      setEdkoZones(zones);
    });
    const unsubCats = seedAndListenToSuperAppCategories((cats) => {
      setSuperAppCategories(cats);
    });
    return () => {
      unsubZones();
      unsubCats();
    };
  }, []);

  // Google Play Review Prompt with >= 14 seconds dwell time only after customer signs in and places/receives an order
  useEffect(() => {
    if (!user || user.isAnonymous || !userProfile || userProfile.role !== 'customer') {
      return;
    }
    if (portalOrders.filter((o) => o.status === 'delivered').length === 0) {
      return;
    }
    const timer = setTimeout(() => {
      if (shouldShowGooglePlayReviewPrompt()) {
        setIsPlayReviewOpen(true);
      }
    }, 14000);
    return () => clearTimeout(timer);
  }, [user, userProfile, portalOrders]);

  // Tier 2 Top-Level Listener for Google Maps Demo Key Quota Exceeded
  useEffect(() => {
    const handleQuotaEvent = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaEvent);
    return () =>
      window.removeEventListener('gmp-quota-exceeded', handleQuotaEvent);
  }, []);

  // Enforce exclusive Dark Mode (#0F172A) on <html>
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = 'dark';
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Boot Firestore connection check & Auth state listener
  useEffect(() => {
    validateFirestoreConnection();

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);

      if (!firebaseUser) {
        setActivePortal('customer');
        setUserProfile(null);
        setNotifications([]);
        setCustomerReviewsByOrderId({});
        setShowOnboardingModal(false);
        setRoleReady(true);
        return;
      }

      if (pendingAuthTransitionRef.current) {
        return;
      }

      setRoleReady(false);
      resolveUserPortalRole(firebaseUser)
        .then((resolvedRole) => {
          setActivePortal(resolvedRole);
          setRoleReady(true);
        })
        .catch(() => {
          setActivePortal('customer');
          setRoleReady(true);
        });
    });

    return () => unsubscribeAuth();
  }, []);

  // Support ?autostart=1 skip-intro customer journey
  useEffect(() => {
    if (!isAutostartUrl || !authReady || user || autostartPreviewSession) {
      return;
    }

    let cancelled = false;
    loginAnonymously().catch(() => {
      if (!cancelled) {
        setAutostartPreviewSession(true);
        setActivePortal('customer');
        setRoleReady(true);
        setIsLoadingStores(false);
        setIsLoadingOrders(false);
        setIsLoadingAds(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isAutostartUrl, authReady, user, autostartPreviewSession]);

  // Listen to authenticated UserProfileRecord, Role-Targeted Notifications, and Customer Reviews
  useEffect(() => {
    if (!authReady || !roleReady || pendingAuthTransition || !user) {
      setUserProfile(null);
      setNotifications([]);
      setCustomerReviewsByOrderId({});
      return;
    }

    if (user.isAnonymous) {
      setUserProfile(null);
      setNotifications([]);
      setCustomerReviewsByOrderId({});
      return;
    }

    const unsubProfile = listenToUserProfile(user.uid, (profile) => {
      setUserProfile(profile);
      if (
        activePortal === 'customer' &&
        profile &&
        profile.profileCompleted === false &&
        !profile.phone &&
        !onboardingSkippedSession
      ) {
        const isGoogleProvider = user.providerData.some(
          (p) => p.providerId === 'google.com'
        );
        if (isGoogleProvider) {
          setShowOnboardingModal(true);
        }
      }
    });

    const unsubNotifs = listenToUserNotifications(
      user.uid,
      (items) => {
        setNotifications(items);
      },
      undefined,
      activePortal
    );

    const unsubCustReviews =
      activePortal === 'customer'
        ? listenToCustomerReviews(user.uid, (map) => {
            setCustomerReviewsByOrderId(map);
          })
        : () => {};

    const unsubWalletTopups =
      activePortal === 'customer'
        ? listenToCustomerWalletTopups(user.uid, (items) => {
            setCustomerWalletTopups(items);
          })
        : () => {};

    const unsubWalletTransactions =
      activePortal === 'customer'
        ? listenToCustomerWalletTransactions(user.uid, (items) => {
            setCustomerWalletTransactions(items);
          })
        : () => {};

    const unsubBlockedSelf = listenToSingleBlockedStatus(user.uid, (rec) => {
      setCurrentUserBlockRecord(rec);
    });

    // Periodic Firebase Auth token & custom claims refresh every 5 minutes
    const refreshInterval = window.setInterval(() => {
      void auth.currentUser?.getIdTokenResult(true).catch(() => {});
    }, 5 * 60 * 1000);

    return () => {
      unsubProfile();
      unsubNotifs();
      unsubCustReviews();
      unsubWalletTopups();
      unsubWalletTransactions();
      unsubBlockedSelf();
      window.clearInterval(refreshInterval);
    };
  }, [
    authReady,
    roleReady,
    pendingAuthTransition,
    user,
    activePortal,
    onboardingSkippedSession,
  ]);

  // Listen to System Maintenance Mode (/appConfig/system) once signed in
  useEffect(() => {
    if (!authReady || !user) {
      return;
    }
    const unsubMaint = listenToSystemMaintenanceConfig((cfg) => {
      setMaintenanceConfig(cfg);
      if (!cfg.maintenanceMode) {
        setForceAdminLoginInMaintenance(false);
      }
    });
    return () => unsubMaint();
  }, [authReady, user]);

  // Attach strict role-scoped Firestore listeners once authenticated & role resolved (Zero demo seeding)
  useEffect(() => {
    if (!authReady || !roleReady || pendingAuthTransition || !user) {
      if (!autostartPreviewSession) {
        setAllStores([]);
        setPortalOrders([]);
        setLiveCouriers([]);
        setCurrentCourierRecord(null);
        setActiveAds([]);
        setActiveCampaigns([]);
        setMysteryBoxProducts([]);
        setAllAvailableProducts([]);
        setAdminAds([]);
        setAdminCoupons([]);
        setAdminCampaigns([]);
        setCustomersDirectory([]);
        setAdminCustomersWithPii([]);
        setAdminAuditLogs([]);
        setAdminBroadcastHistory([]);
        setAdminSupportTickets([]);
        setAssignedSupportTickets([]);
        setStaffMembers([]);
        setLiveEvents([]);
        setCustomerWalletTopups([]);
        setCustomerWalletTransactions([]);
        setAdminWalletTopups([]);
      }
      return;
    }

    setIsLoadingStores(true);
    setStoresError(null);
    setIsLoadingOrders(true);
    setOrdersError(null);

    if (activePortal === 'customer') {
      setIsLoadingAds(true);
      const unsubStores = listenToStores(
        (stores) => {
          setAllStores(stores);
          setStoresError(null);
          setIsLoadingStores(false);
        },
        (err) => {
          setStoresError(formatAppErrorMessage(err));
          setIsLoadingStores(false);
        }
      );

      const unsubAds = listenToActiveAds(
        (ads) => {
          setActiveAds(ads);
          setIsLoadingAds(false);
        },
        () => {
          setIsLoadingAds(false);
        }
      );

      const unsubCampaigns = listenToActiveCampaigns((campaigns) => {
        setActiveCampaigns(campaigns);
      });

      const unsubMystery = listenToMysteryBoxProducts((items) => {
        setMysteryBoxProducts(items);
      });

      const unsubAllProducts = listenToAllAvailableProducts((items) => {
        setAllAvailableProducts(items);
      });

      const unsubLiveEvents = listenToLiveEvents((events) => {
        setLiveEvents(events);
      });

      if (user.isAnonymous) {
        setPortalOrders([]);
        setIsLoadingOrders(false);
        return () => {
          unsubStores();
          unsubAds();
          unsubCampaigns();
          unsubMystery();
          unsubAllProducts();
          unsubLiveEvents();
        };
      }

      const unsubOrders = listenToCustomerOrders(
        user.uid,
        (orders) => {
          setPortalOrders(orders);
          setOrdersError(null);
          setIsLoadingOrders(false);
        },
        (err) => {
          setOrdersError(formatAppErrorMessage(err));
          setIsLoadingOrders(false);
        }
      );

      return () => {
        unsubStores();
        unsubAds();
        unsubCampaigns();
        unsubMystery();
        unsubAllProducts();
        unsubLiveEvents();
        unsubOrders();
      };
    }

    if (activePortal === 'store') {
      const unsubStores = listenToMerchantStores(
        user.uid,
        (stores) => {
          setAllStores(stores);
          setStoresError(null);
          setIsLoadingStores(false);
        },
        (err) => {
          setStoresError(formatAppErrorMessage(err));
          setIsLoadingStores(false);
        }
      );

      const unsubOrders = listenToMerchantOrders(
        user.uid,
        (orders) => {
          setPortalOrders(orders);
          setOrdersError(null);
          setIsLoadingOrders(false);
        },
        (err) => {
          setOrdersError(formatAppErrorMessage(err));
          setIsLoadingOrders(false);
        }
      );

      return () => {
        unsubStores();
        unsubOrders();
      };
    }

    if (activePortal === 'courier') {
      setIsLoadingCourier(true);
      const unsubCourier = listenToSingleCourier(
        user.uid,
        (courierDoc) => {
          setCurrentCourierRecord(courierDoc);
          setIsLoadingCourier(false);
        },
        () => {
          setIsLoadingCourier(false);
        }
      );

      const unsubStores = listenToStores(
        (stores) => {
          setAllStores(stores);
          setStoresError(null);
          setIsLoadingStores(false);
        },
        (err) => {
          setStoresError(formatAppErrorMessage(err));
          setIsLoadingStores(false);
        }
      );

      setIsLoadingOrders(false);
      return () => {
        unsubCourier();
        unsubStores();
      };
    }

    if (activePortal === 'support_agent') {
      setIsLoadingStores(false);
      setIsLoadingOrders(false);
      const unsubAssigned = listenToAssignedSupportTickets(
        user.uid,
        (tickets) => {
          setAssignedSupportTickets(tickets);
        }
      );
      return () => {
        unsubAssigned();
      };
    }

    if (activePortal === 'operations') {
      setIsLoadingStores(false);
      const unsubOpsOrders = listenToAdminOrders(
        (orders) => {
          setPortalOrders(orders);
          setOrdersError(null);
          setIsLoadingOrders(false);
        },
        (err) => {
          setOrdersError(formatAppErrorMessage(err));
          setIsLoadingOrders(false);
        }
      );
      const unsubOpsCouriers = listenToAdminCouriers((couriers) => {
        setLiveCouriers(couriers);
      });
      return () => {
        unsubOpsOrders();
        unsubOpsCouriers();
      };
    }

    // activePortal === 'admin'
    const unsubAdminStores = listenToAdminStores(
      user.uid,
      (stores) => {
        setAllStores(stores);
        setStoresError(null);
        setIsLoadingStores(false);
      },
      (err) => {
        setStoresError(formatAppErrorMessage(err));
        setIsLoadingStores(false);
      }
    );

    const unsubAdminOrders = listenToAdminOrders(
      (orders) => {
        setPortalOrders(orders);
        setOrdersError(null);
        setIsLoadingOrders(false);
      },
      (err) => {
        setOrdersError(formatAppErrorMessage(err));
        setIsLoadingOrders(false);
      }
    );

    const unsubAdminCouriers = listenToAdminCouriers((couriers) => {
      setLiveCouriers(couriers);
    });

    const unsubAdminAds = listenToAdminAds((ads) => {
      setAdminAds(ads);
    });

    const unsubAdminCoupons = listenToAdminCoupons(user.uid, (coupons) => {
      setAdminCoupons(coupons);
    });

    const unsubAdminCampaigns = listenToAdminCampaigns((campaigns) => {
      setAdminCampaigns(campaigns);
    });

    const unsubCustomerDir = listenToCustomerDirectory((customers) => {
      setCustomersDirectory(customers);
    });

    const unsubBroadcastHist = listenToAdminBroadcastHistory((items) => {
      setAdminBroadcastHistory(items);
    });

    const unsubAdminBlocked = listenToBlockedEntitiesForAdmin((records) => {
      const map: Record<string, BlockedEntityRecord> = {};
      for (const rec of records) {
        map[rec.targetId] = rec;
      }
      setAdminBlockedEntities(map);
    });

    const unsubSupportTickets = listenToAllSupportTicketsForAdmin((tickets) => {
      setAdminSupportTickets(tickets);
    });

    const unsubStaff = listenToStaffMembersForAdmin(user.uid, (members) => {
      setStaffMembers(members);
    });

    const unsubAdminCustomers = listenToAdminCustomersWithPii((customers) => {
      setAdminCustomersWithPii(customers);
    });

    const unsubAdminAuditLogs = listenToAdminAuditLogs((logs) => {
      setAdminAuditLogs(logs);
    });

    const unsubAdminAllProducts = listenToAllAvailableProducts((items) => {
      setAllAvailableProducts(items);
    });

    const unsubAdminWalletTopups = listenToAdminWalletTopups((items) => {
      setAdminWalletTopups(items);
    });

    return () => {
      unsubAdminStores();
      unsubAdminOrders();
      unsubAdminCouriers();
      unsubAdminAds();
      unsubAdminCoupons();
      unsubAdminCampaigns();
      unsubCustomerDir();
      unsubBroadcastHist();
      unsubAdminBlocked();
      unsubSupportTickets();
      unsubStaff();
      unsubAdminCustomers();
      unsubAdminAuditLogs();
      unsubAdminAllProducts();
      unsubAdminWalletTopups();
    };
  }, [
    authReady,
    roleReady,
    pendingAuthTransition,
    user,
    activePortal,
    autostartPreviewSession,
  ]);

  // Listen to Collaborative Shared Cart when activeGroupCartId is present (non-anonymous users only)
  useEffect(() => {
    if (
      !activeGroupCartId ||
      !authReady ||
      !user ||
      user.isAnonymous ||
      autostartPreviewSession ||
      activePortal !== 'customer'
    ) {
      setActiveSharedCart(null);
      return;
    }

    const unsubShared = listenToSharedCart(
      activeGroupCartId,
      (shared) => {
        setActiveSharedCart(shared);
        if (
          shared &&
          shared.status === 'open' &&
          autoOpenedSharedStoreRef.current !== shared.id &&
          !currentPath.startsWith('/group/')
        ) {
          autoOpenedSharedStoreRef.current = shared.id;
          setSelectedStoreId(shared.storeId);
          setActiveView('store_menu');
        }
      },
      (err) => {
        showNotice(formatAppErrorMessage(err, 'تعذر مزامنة السلة الجماعية.'));
      }
    );

    return () => unsubShared();
  }, [
    activeGroupCartId,
    authReady,
    user,
    autostartPreviewSession,
    activePortal,
    currentPath,
  ]);

  // Attach courier dispatch listener dynamically when courier's approvalStatus === 'approved'
  useEffect(() => {
    if (
      !authReady ||
      !roleReady ||
      pendingAuthTransition ||
      !user ||
      activePortal !== 'courier'
    ) {
      return;
    }

    const isApproved = currentCourierRecord?.approvalStatus === 'approved';
    const unsubDispatch = listenToCourierOrdersAndDispatch(
      user.uid,
      isApproved,
      (orders) => {
        setPortalOrders(orders);
        setOrdersError(null);
      },
      (err) => {
        setOrdersError(formatAppErrorMessage(err));
      }
    );

    return () => unsubDispatch();
  }, [
    authReady,
    roleReady,
    pendingAuthTransition,
    user,
    activePortal,
    currentCourierRecord?.approvalStatus,
  ]);

  // Fetch store credentials map for Admin whenever allStores changes
  useEffect(() => {
    if (
      !user ||
      activePortal !== 'admin' ||
      pendingAuthTransition ||
      allStores.length === 0
    ) {
      return;
    }

    let cancelled = false;
    fetchStoreCredentialsMapForAdmin(allStores.map((s) => s.id))
      .then((creds) => {
        if (!cancelled) {
          setStoreCredentialsMap((prev) => ({ ...prev, ...creds }));
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [user, activePortal, pendingAuthTransition, allStores]);

  // Effective store ID for Customer menu view or Store Merchant portal
  const effectiveMerchantStoreId = useMemo(() => {
    if (activePortal !== 'store') return null;
    if (selectedStoreId && allStores.some((s) => s.id === selectedStoreId)) {
      return selectedStoreId;
    }
    return allStores[0]?.id ?? null;
  }, [activePortal, selectedStoreId, allStores]);

  // Check if merchant's owned store is blocked by Admin
  useEffect(() => {
    if (
      !user ||
      activePortal !== 'store' ||
      !effectiveMerchantStoreId
    ) {
      setCurrentStoreBlockRecord(null);
      return;
    }
    const unsubStoreBlock = listenToSingleBlockedStatus(
      effectiveMerchantStoreId,
      (rec) => {
        setCurrentStoreBlockRecord(rec);
      }
    );
    return () => unsubStoreBlock();
  }, [user, activePortal, effectiveMerchantStoreId]);

  const targetProductsStoreId =
    activePortal === 'store' ? effectiveMerchantStoreId : selectedStoreId;

  // Attach real-time Firestore listener for "products" and "reviews" of active store
  useEffect(() => {
    if (!targetProductsStoreId || pendingAuthTransition) {
      setStoreProducts([]);
      setStoreReviews([]);
      setProductsError(null);
      return;
    }

    if (user) {
      setIsLoadingProducts(true);
      setProductsError(null);

      const unsubReviews = listenToStoreReviews(
        targetProductsStoreId,
        (revs) => {
          setStoreReviews(revs);
        }
      );

      if (activePortal === 'store') {
        const unsubMerchantProds = listenToMerchantStoreProducts(
          targetProductsStoreId,
          user.uid,
          (liveProducts) => {
            setStoreProducts(liveProducts);
            setProductsError(null);
            setIsLoadingProducts(false);
          },
          (err) => {
            setProductsError(formatAppErrorMessage(err));
            setIsLoadingProducts(false);
          }
        );
        return () => {
          unsubMerchantProds();
          unsubReviews();
        };
      }

      const unsubProducts = listenToStoreProducts(
        targetProductsStoreId,
        (liveProducts) => {
          setStoreProducts(liveProducts);
          setProductsError(null);
          setIsLoadingProducts(false);
        },
        (err) => {
          setProductsError(formatAppErrorMessage(err));
          setIsLoadingProducts(false);
        }
      );

      return () => {
        unsubProducts();
        unsubReviews();
      };
    }

    if (autostartPreviewSession) {
      setStoreProducts([]);
      setIsLoadingProducts(false);
    }
  }, [
    targetProductsStoreId,
    activePortal,
    user,
    pendingAuthTransition,
    autostartPreviewSession,
  ]);

  // Clear applied coupon if cart becomes empty
  useEffect(() => {
    if (cart.length === 0 && appliedCoupon) {
      setAppliedCoupon(null);
    }
  }, [cart.length, appliedCoupon]);

  const isAuthenticated =
    (Boolean(user) || autostartPreviewSession) && !pendingAuthTransition;
  const isGuestCustomer =
    !user || Boolean(user.isAnonymous) || autostartPreviewSession;
  const cartItemCount = cart.reduce((sum, entry) => sum + entry.quantity, 0);

  const pendingGroupRoomCode = useMemo(() => {
    const m = currentPath.match(/^\/group\/([A-Za-z0-9_-]+)/);
    return m && m[1] ? m[1].toUpperCase() : null;
  }, [currentPath]);

  const [savedPendingGroupJoin, setSavedPendingGroupJoin] = useState<boolean>(
    () => {
      if (typeof window === 'undefined') return false;
      try {
        return Boolean(
          window.sessionStorage.getItem('edkawy_pending_group_target')
        );
      } catch {
        return false;
      }
    }
  );

  // Persist pending group link (?groupCart=... or /group/:roomCode) before auth so friend returns right inside it
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (pendingGroupRoomCode) {
      if (isGuestCustomer) {
        try {
          window.sessionStorage.setItem(
            'edkawy_pending_group_target',
            JSON.stringify({ type: 'room', value: pendingGroupRoomCode })
          );
          setSavedPendingGroupJoin(true);
        } catch {
          // Ignore storage error
        }
      }
    } else if (activeGroupCartId && isGuestCustomer) {
      try {
        window.sessionStorage.setItem(
          'edkawy_pending_group_target',
          JSON.stringify({ type: 'cart', value: activeGroupCartId })
        );
        setSavedPendingGroupJoin(true);
      } catch {
        // Ignore storage error
      }
    }
  }, [pendingGroupRoomCode, activeGroupCartId, isGuestCustomer]);

  function consumePendingGroupTargetIfCustomer(role?: PortalRole): boolean {
    if (role && role !== 'customer') return false;
    if (typeof window === 'undefined') return false;
    try {
      const raw = window.sessionStorage.getItem('edkawy_pending_group_target');
      if (!raw) return false;
      window.sessionStorage.removeItem('edkawy_pending_group_target');
      setSavedPendingGroupJoin(false);
      const parsed = JSON.parse(raw) as { type?: string; value?: string };
      if (parsed?.type === 'room' && parsed.value) {
        navigateToPath(`/group/${parsed.value}`);
        return true;
      }
      if (parsed?.type === 'cart' && parsed.value) {
        autoOpenedSharedStoreRef.current = null;
        setActiveGroupCartId(parsed.value);
        syncGroupCartUrlParam(parsed.value);
        return true;
      }
    } catch {
      // Ignore storage error
    }
    return false;
  }

  // Auto-restore pending Group Cart / Room after reload / OAuth once authenticated
  useEffect(() => {
    if (
      !authReady ||
      !roleReady ||
      pendingAuthTransition ||
      isGuestCustomer ||
      activePortal !== 'customer'
    ) {
      return;
    }
    consumePendingGroupTargetIfCustomer('customer');
  }, [authReady, roleReady, pendingAuthTransition, isGuestCustomer, activePortal]);

  const hasPendingGroupJoin =
    Boolean(pendingGroupRoomCode) ||
    Boolean(activeGroupCartId) ||
    savedPendingGroupJoin;

  const activeCustomerStores = useMemo(
    () => allStores.filter((s) => s.isActive),
    [allStores]
  );

  const customerOrders = useMemo(() => {
    if (!user) return portalOrders;
    return portalOrders.filter((o) => o.customerId === user.uid);
  }, [portalOrders, user]);

  const activeCustomerOrdersCount = useMemo(
    () =>
      customerOrders.filter(
        (o) => o.status !== 'delivered' && o.status !== 'cancelled'
      ).length,
    [customerOrders]
  );

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const selectedStore = useMemo(
    () => activeCustomerStores.find((s) => s.id === selectedStoreId) ?? null,
    [activeCustomerStores, selectedStoreId]
  );

  const cartStore = useMemo(
    () =>
      cart[0]
        ? allStores.find((s) => s.id === cart[0].storeId) ?? null
        : null,
    [allStores, cart]
  );

  const trackedOrder = useMemo(() => {
    if (!trackedOrderId) return null;
    const fromLive = portalOrders.find((o) => o.id === trackedOrderId);
    if (fromLive) return fromLive;
    if (optimisticPlacedOrder && optimisticPlacedOrder.id === trackedOrderId) {
      return optimisticPlacedOrder;
    }
    return null;
  }, [portalOrders, trackedOrderId, optimisticPlacedOrder]);

  const trackedOrderStore = useMemo(
    () =>
      trackedOrder
        ? allStores.find((s) => s.id === trackedOrder.storeId) ?? null
        : null,
    [allStores, trackedOrder]
  );

  // Auto-open post-delivery 5-star review modal once when tracked order transitions to 'delivered'
  useEffect(() => {
    if (
      activePortal !== 'customer' ||
      isGuestCustomer ||
      !trackedOrder ||
      trackedOrder.status !== 'delivered' ||
      trackedOrder.isReviewed ||
      Boolean(customerReviewsByOrderId[trackedOrder.id])
    ) {
      return;
    }
    if (!autoPromptedReviewOrdersRef.current.has(trackedOrder.id)) {
      autoPromptedReviewOrdersRef.current.add(trackedOrder.id);
      setReviewModalOrder(trackedOrder);
    }
  }, [
    activePortal,
    isGuestCustomer,
    trackedOrder,
    customerReviewsByOrderId,
  ]);

  const customerTotalSpent = useMemo(() => {
    const deliveredSum = customerOrders
      .filter((o) => o.status === 'delivered')
      .reduce((sum, o) => sum + Number(o.totalAmount ?? 0), 0);
    return Math.max(Number(userProfile?.totalSpentEgp ?? 0), deliveredSum);
  }, [customerOrders, userProfile?.totalSpentEgp]);

  function showNotice(message: string) {
    setNoticeBanner(message);
    setTimeout(() => {
      setNoticeBanner((prev) => (prev === message ? null : prev));
    }, 3800);
  }

  function handleClearInviteTokenAndUrl() {
    setPendingInviteToken(null);
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('token');
        url.searchParams.delete('inviteToken');
        url.searchParams.delete('type');
        if (url.pathname === '/register') {
          url.pathname = '/';
        }
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
        if (currentPath === '/register') {
          setCurrentPath('/');
        }
      } catch {
        // Ignore URL cleanup errors
      }
    }
  }

  function handleAuthTransitionStart() {
    pendingAuthTransitionRef.current = true;
    setPendingAuthTransition(true);
  }

  function handleAuthTransitionEnd(
    resolvedRole?: PortalRole,
    needsProfileCompletion?: boolean
  ) {
    pendingAuthTransitionRef.current = false;
    if (resolvedRole) {
      setAutostartPreviewSession(false);
      setActivePortal(resolvedRole);
      if (resolvedRole === 'customer' && needsProfileCompletion) {
        setOnboardingSkippedSession(false);
        setShowOnboardingModal(true);
      }
      if (
        resolvedRole === 'customer' &&
        consumePendingGroupTargetIfCustomer('customer')
      ) {
        pendingReturnToCheckoutRef.current = false;
        setHasPendingCartForCheckout(false);
        showNotice('تم تسجيل الدخول وفتح السلة الجماعية بنجاح!');
      } else if (
        resolvedRole === 'customer' &&
        pendingReturnToCheckoutRef.current &&
        cart.length > 0
      ) {
        pendingReturnToCheckoutRef.current = false;
        setHasPendingCartForCheckout(false);
        setActiveView('checkout');
      } else {
        pendingReturnToCheckoutRef.current = false;
        setHasPendingCartForCheckout(false);
        if (resolvedRole !== 'customer') {
          setCart([]);
        }
        setActiveView('stores');
      }
      window.scrollTo(0, 0);
    }
    setPendingAuthTransition(false);
    setRoleReady(true);
  }

  function handleEnterGuestPreviewFallback() {
    setAutostartPreviewSession(true);
    setIsLoadingStores(false);
    setIsLoadingOrders(false);
    setIsLoadingAds(false);
  }

  async function handleSignInWithGoogleForCheckout() {
    handleAuthTransitionStart();
    try {
      const { role, needsProfileCompletion } = await loginWithGoogleCustomer();
      setAutostartPreviewSession(false);
      pendingReturnToCheckoutRef.current = false;
      setHasPendingCartForCheckout(false);
      setActivePortal(role);
      if (role === 'customer') {
        if (needsProfileCompletion) {
          setOnboardingSkippedSession(false);
          setShowOnboardingModal(true);
        }
        if (consumePendingGroupTargetIfCustomer('customer')) {
          showNotice('تم تسجيل الدخول بحساب Google وفتح السلة الجماعية بنجاح!');
        } else {
          setActiveView('checkout');
          showNotice(
            'تم تسجيل الدخول بحساب Google بنجاح — يمكنك تأكيد طلبك الآن.'
          );
        }
      } else {
        setCart([]);
        setActiveView('stores');
      }
      window.scrollTo(0, 0);
    } catch (err) {
      const formatted = formatFirebaseAuthError(err);
      throw new Error(formatted.message);
    } finally {
      pendingAuthTransitionRef.current = false;
      setPendingAuthTransition(false);
      setRoleReady(true);
    }
  }

  async function handleInlineEmailAuthForCheckout(
    mode: 'login' | 'register',
    payload: { name?: string; email: string; password: string }
  ) {
    handleAuthTransitionStart();
    try {
      const result =
        mode === 'register'
          ? await registerCustomerWithEmailAndPassword(
              payload.name ?? '',
              payload.email,
              payload.password
            )
          : await loginUnifiedWithEmailAndPassword(
              payload.email,
              payload.password
            );
      setAutostartPreviewSession(false);
      pendingReturnToCheckoutRef.current = false;
      setHasPendingCartForCheckout(false);
      setActivePortal(result.role);
      if (result.role === 'customer') {
        if (consumePendingGroupTargetIfCustomer('customer')) {
          showNotice('تم تسجيل الدخول وفتح السلة الجماعية بنجاح!');
        } else {
          setActiveView('checkout');
          showNotice(
            mode === 'register'
              ? 'تم إنشاء حسابك بنجاح — يمكنك تأكيد طلبك الآن.'
              : 'تم تسجيل الدخول بنجاح — يمكنك تأكيد طلبك الآن.'
          );
        }
      } else {
        setCart([]);
        setActiveView('stores');
      }
      window.scrollTo(0, 0);
    } catch (err) {
      const formatted = formatFirebaseAuthError(err);
      throw new Error(formatted.message);
    } finally {
      pendingAuthTransitionRef.current = false;
      setPendingAuthTransition(false);
      setRoleReady(true);
    }
  }

  async function handleOpenLoginScreenForCheckout() {
    const shouldReturnToCheckout = cart.length > 0;
    pendingReturnToCheckoutRef.current = shouldReturnToCheckout;
    setHasPendingCartForCheckout(shouldReturnToCheckout);
    if (user && user.isAnonymous) {
      await logoutUser().catch(() => {});
    }
    setAutostartPreviewSession(false);
    setActivePortal('customer');
    setActiveView('stores');
    window.scrollTo(0, 0);
  }

  // Customer Onboarding, Profile, Loyalty Points, Favorites, Coupons & Reviews Handlers
  async function handleCompleteOnboardingSubmit(input: CompleteProfileInput) {
    if (!user) return;
    await completeCustomerOnboardingInFirestore(user.uid, input, user.email);
    setShowOnboardingModal(false);
    showNotice('تم حفظ بيانات حسابك وموقعك الافتراضي على خريطة إدكو بنجاح!');
  }

  async function handleUpdateCustomerProfileDetails(patch: {
    name?: string;
    phone?: string;
    defaultNeighborhood?: string;
    defaultAddress?: string;
    defaultLat?: number;
    defaultLng?: number;
    savedAddresses?: SavedAddressItem[];
  }) {
    if (!user || user.isAnonymous) {
      throw new Error('يرجى تسجيل الدخول بحسابك أولاً لحفظ التعديلات.');
    }
    await updateCustomerAccountDetailsInFirestore(user.uid, patch);
  }

  async function handleRedeemCustomerPoints(): Promise<string> {
    if (!user || user.isAnonymous) {
      throw new Error('يرجى تسجيل الدخول بحسابك لاستبدال النقاط.');
    }
    const customerName =
      userProfile?.name || user.displayName || 'عميل إدكاوي';
    const currentPoints = userProfile?.points ?? 0;
    const code = await redeemPointsForCouponInFirestore(
      user.uid,
      customerName,
      currentPoints
    );
    showNotice(`مبروك! تم إصدار قسيمة مكافأتك (${code}) وخصم ١٠٠ نقطة.`);
    return code;
  }

  async function handleToggleFavoriteStore(storeId: string) {
    if (!user || user.isAnonymous || autostartPreviewSession) {
      showNotice('سجّل الدخول بحسابك لحفظ المتاجر المفضلة في صفحة حسابي.');
      return;
    }
    try {
      const currentFavs = userProfile?.favoriteStoreIds ?? [];
      const nextFavs = await toggleFavoriteStoreInFirestore(
        user.uid,
        storeId,
        currentFavs
      );
      const added = nextFavs.includes(storeId);
      showNotice(
        added
          ? 'تمت إضافة المتجر إلى قائمة المفضلة في حسابك.'
          : 'تمت إزالة المتجر من قائمة المفضلة.'
      );
    } catch (err) {
      showNotice(formatAppErrorMessage(err, 'تعذر تحديث قائمة المفضلة.'));
    }
  }

  async function handleApplyCouponCode(rawCode: string, subtotal: number) {
    const coupon = await validateCouponCodeInFirestore(rawCode, subtotal);
    setAppliedCoupon(coupon);
  }

  async function handleSubmitOrderReview(input: ReviewSubmitInput) {
    if (!user || user.isAnonymous) {
      throw new Error('يرجى تسجيل الدخول لإرسال تقييمك.');
    }
    await submitOrderReviewInFirestore(user.uid, input);
    showNotice('شكراً لتقييمك! تم تحديث متوسط تقييم المتجر والمندوب بنجاح.');
  }

  function handleOpenStoreMenu(store: StoreRecord) {
    setSelectedStoreId(store.id);
    setJustPlacedOrderId(null);
    setActiveView('store_menu');
    window.scrollTo(0, 0);
  }

  function handleAddToCart(store: StoreRecord, item: MenuItem, selectedVariant?: ProductVariant) {
    if (!isStoreCurrentlyOpen(store)) {
      showNotice(`متجر "${store.name}" مغلق حالياً ولا يستقبل طلبات جديدة.`);
      return;
    }
    const outcome = addItemToCartState(cart, store, item, selectedVariant);
    setCart(outcome.cart);
    if (outcome.cappedAtLimit) {
      showNotice('تم الوصول للحد الأقصى المسموح به في الطلب الواحد.');
    } else if (outcome.replacedOtherStore) {
      setAppliedCoupon(null);
      showNotice(`تم بدء سلة جديدة من "${store.name}".`);
    }
  }

  function handleAddMysteryBoxToCart(
    product: ProductRecord,
    store: StoreRecord
  ) {
    const menuItem: MenuItem = {
      id: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      category: product.category,
      description: product.description,
      stockQuantity: product.stockQuantity,
      isMysteryBox: true,
      originalValueEgp: product.originalValueEgp,
    };
    handleAddToCart(store, menuItem);
    showNotice(`تمت إضافة "${product.name}" إلى سلتك!`);
  }

  function handleUpdateQuantity(itemId: string, delta: number) {
    setCart((prev) => updateCartQuantityState(prev, itemId, delta));
  }

  function handleRemoveItem(itemId: string) {
    setCart((prev) => removeItemFromCartState(prev, itemId));
  }

  // Collaborative Group Order Handlers
  function syncGroupCartUrlParam(cartId: string | null) {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      if (cartId) {
        url.searchParams.set('groupCart', cartId);
      } else {
        url.searchParams.delete('groupCart');
      }
      window.history.replaceState({}, '', url.toString());
    } catch {
      // Non-fatal in iframe
    }
  }

  async function handleStartGroupOrder(store: StoreRecord): Promise<string> {
    if (!user || user.isAnonymous) {
      throw new Error('يرجى تسجيل الدخول بحسابك أولاً لبدء طلب جماعي.');
    }
    if (userProfile?.isBanned || currentUserBlockRecord?.isBlocked) {
      showNotice('حسابك محظور، تواصل مع الدعم');
      throw new Error('حسابك محظور، تواصل مع الدعم');
    }
    const hostName =
      userProfile?.name || user.displayName || 'عميل إدكاوي';
    const cartId = await createSharedCartInFirestore(
      user.uid,
      hostName,
      store
    );
    setActiveGroupCartId(cartId);
    syncGroupCartUrlParam(cartId);
    showNotice('تم إنشاء السلة الجماعية! انسخ الرابط وشاركه مع أصدقائك.');
    return cartId;
  }

  async function handleUpsertSharedCartItem(
    cartId: string,
    product: ProductRecord,
    delta: number
  ) {
    if (!user || user.isAnonymous) {
      showNotice('سجّل الدخول بحسابك أولاً للإضافة إلى السلة الجماعية.');
      throw new Error('سجّل الدخول بحسابك أولاً للإضافة إلى السلة الجماعية.');
    }
    const participantName =
      userProfile?.name || user.displayName || 'مشارك في الطلب';
    await upsertSharedCartItemInFirestore(
      cartId,
      user.uid,
      participantName,
      product,
      delta
    );
  }

  async function handleUpdateSharedCartEntryQuantity(
    cartId: string,
    entryId: string,
    delta: number
  ) {
    if (!user || user.isAnonymous) {
      showNotice('سجّل الدخول بحسابك أولاً لتعديل السلة الجماعية.');
      return;
    }
    try {
      await updateSharedCartEntryQuantityInFirestore(cartId, entryId, delta);
    } catch (err) {
      showNotice(formatAppErrorMessage(err, 'تعذر تحديث كمية الصنف في السلة الجماعية.'));
    }
  }

  function handleCheckoutSharedCart(sharedCart: SharedCartRecord) {
    if (sharedCart.items.length === 0) {
      showNotice('السلة الجماعية فارغة حالياً — أضف صنفاً واحداً على الأقل.');
      return;
    }

    const aggregatedMap = new Map<string, CartItem>();
    for (const entry of sharedCart.items) {
      const existing = aggregatedMap.get(entry.productId);
      if (existing) {
        existing.quantity += entry.quantity;
      } else {
        aggregatedMap.set(entry.productId, {
          storeId: sharedCart.storeId,
          storeName: sharedCart.storeName,
          deliveryFee: sharedCart.storeDeliveryFee,
          item: {
            id: entry.productId,
            name: entry.name,
            price: entry.price,
          },
          quantity: entry.quantity,
        });
      }
    }

    setCart(Array.from(aggregatedMap.values()));
    setActiveGroupCartId(sharedCart.id);
    setActiveView('checkout');
    window.scrollTo(0, 0);
  }

  function handleLeaveSharedCart() {
    setActiveGroupCartId(null);
    setActiveSharedCart(null);
    syncGroupCartUrlParam(null);
  }

  // Pharmacy 4-Stage Workflow Handlers
  async function handleSubmitPharmacyOrder(
    pharmacyStore: StoreRecord,
    input: PharmacyPrescriptionOrderInput
  ): Promise<string> {
    if (!user || user.isAnonymous || autostartPreviewSession) {
      throw new Error(
        'يرجى تسجيل الدخول بحسابك أولاً لإرسال الروشتة أو طلب الأدوية.'
      );
    }
    if (userProfile?.isBanned || currentUserBlockRecord?.isBlocked) {
      showNotice('حسابك محظور، تواصل مع الدعم');
      throw new Error('حسابك محظور، تواصل مع الدعم');
    }

    const orderId = await placePharmacyPrescriptionOrderInFirestore(
      user.uid,
      pharmacyStore,
      input
    );

    const nowIso = new Date().toISOString();
    const summaryLabel = input.medicineRequest?.trim()
      ? `روشتة / أدوية: ${input.medicineRequest.trim().slice(0, 120)}`
      : 'روشتة طبية مصوّرة بانتظار تسعير الصيدلية';

    const optimisticRx: OrderRecord = {
      id: orderId,
      orderType: 'pharmacy_prescription',
      prescriptionImageUrl: input.prescriptionImageUrl,
      prescriptionMedicineRequest: input.medicineRequest?.trim() || undefined,
      customerId: user.uid,
      storeId: pharmacyStore.id,
      storeOwnerId: pharmacyStore.ownerUid || pharmacyStore.createdBy,
      storeName: pharmacyStore.name,
      storeLat: pharmacyStore.lat,
      storeLng: pharmacyStore.lng,
      customerName: input.customerName.trim(),
      customerPhone: normalizeEgyptPhoneOrEmpty(input.customerPhone),
      deliveryNeighborhood: input.deliveryNeighborhood.trim(),
      deliveryAddress: input.deliveryAddress.trim(),
      customerLat: input.customerLat,
      customerLng: input.customerLng,
      items: [
        {
          productId: 'rx_quote',
          name: 'روشتة طبية / طلب أدوية (قيد التسعير)',
          price: 0,
          quantity: 1,
        },
      ],
      itemsSummary: summaryLabel,
      itemNames: [summaryLabel],
      itemCount: 1,
      subtotal: 0,
      deliveryFee: pharmacyStore.deliveryFee,
      totalAmount: pharmacyStore.deliveryFee,
      paymentMethod: 'cash',
      status: 'awaiting_pharmacy_quote',
      notes: (input.notes ?? '').trim(),
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    };

    setOptimisticPlacedOrder(optimisticRx);
    setTrackedOrderId(orderId);
    setJustPlacedOrderId(orderId);
    setActiveView('tracking');
    window.scrollTo(0, 0);
    showNotice(
      `تم إرسال طلبك إلى "${pharmacyStore.name}" — سنبلغك فور تحديد الصيدلية للسعر للموافقة!`
    );
    return orderId;
  }

  async function handleQuotePharmacyOrderByStore(
    order: OrderRecord,
    quotedPriceEgp: number,
    pharmacistNote?: string,
    prepTimeMinutes?: number
  ) {
    if (!user) return;
    await quotePharmacyOrderByStoreInFirestore(
      order,
      quotedPriceEgp,
      pharmacistNote,
      prepTimeMinutes ?? 15
    );
    showNotice(
      `تم إرسال تسعيرة الروشتة (${quotedPriceEgp} ج.م) للعميل للموافقة عليها فوراً.`
    );
  }

  async function handleApprovePharmacyQuoteByCustomer(order: OrderRecord) {
    if (!user || user.isAnonymous) return;
    await approvePharmacyQuoteByCustomerInFirestore(order);
    if (optimisticPlacedOrder && optimisticPlacedOrder.id === order.id) {
      setOptimisticPlacedOrder({
        ...optimisticPlacedOrder,
        status: 'preparing',
      });
    }
    showNotice(
      'تم تأكيد موافقتك على السعر! بدأت الصيدلية في تحضير الأدوية لتسليمها لمندوب إدكاوي.'
    );
  }

  // Custom Errand Service Workflow Handlers (خدمة مشاوير إدكاوي)
  async function handlePlaceCustomErrand(
    input: CustomErrandOrderInput
  ): Promise<void> {
    if (!user || user.isAnonymous || autostartPreviewSession) {
      throw new Error(
        'يرجى تسجيل الدخول بحسابك أولاً لإرسال مشوار مخصص في إدكو.'
      );
    }
    if (userProfile?.isBanned || currentUserBlockRecord?.isBlocked) {
      showNotice('حسابك محظور، تواصل مع الدعم');
      throw new Error('حسابك محظور، تواصل مع الدعم');
    }

    const orderId = await placeCustomErrandOrderInFirestore(user.uid, input);
    const nowIso = new Date().toISOString();
    const summaryLabel = `مشوار إدكاوي (${input.errandPickupAddress
      .trim()
      .slice(0, 45)}): ${input.errandDescription.trim().slice(0, 140)}`;

    const optimisticErrand: OrderRecord = {
      id: orderId,
      orderType: 'custom_errand',
      errandDescription: input.errandDescription.trim(),
      errandPickupAddress: input.errandPickupAddress.trim(),
      customerId: user.uid,
      storeId: 'edkawy_errands',
      storeName: 'خدمة مشاوير إدكاوي',
      customerName: input.customerName.trim(),
      customerPhone: normalizeEgyptPhoneOrEmpty(input.customerPhone),
      deliveryNeighborhood: input.deliveryNeighborhood.trim(),
      deliveryAddress: input.deliveryAddress.trim(),
      customerLat: input.customerLat,
      customerLng: input.customerLng,
      items: [
        {
          productId: 'custom_errand_item',
          name: `مشوار مخصص: ${input.errandDescription.trim().slice(0, 70)}`,
          price: 0,
          quantity: 1,
        },
      ],
      itemsSummary: summaryLabel,
      itemNames: [summaryLabel],
      itemCount: 1,
      subtotal: 0,
      deliveryFee: 0,
      totalAmount: 0,
      paymentMethod: 'cash',
      status: 'awaiting_courier_quote',
      notes: (input.notes ?? '').trim(),
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    };

    setOptimisticPlacedOrder(optimisticErrand);
    setTrackedOrderId(orderId);
    setJustPlacedOrderId(orderId);
    setActiveView('tracking');
    window.scrollTo(0, 0);
    showNotice(
      'تم إرسال مشوارك لكباتن إدكاوي! سيصلك عرض تكلفة المشوار للموافقة خلال لحظات.'
    );
  }

  async function handleQuoteCustomErrandByCourier(
    order: OrderRecord,
    deliveryFeeEgp: number,
    coords?: { lat?: number; lng?: number }
  ) {
    if (!user || !currentCourierRecord) return;
    await quoteCustomErrandByCourierInFirestore(
      order.id,
      deliveryFeeEgp,
      user.uid,
      currentCourierRecord.name,
      currentCourierRecord.phone,
      coords
    );
    showNotice(
      `تم إرسال عرض تكلفة المشوار (${deliveryFeeEgp} ج.م) للعميل للموافقة عليه.`
    );
  }

  async function handleApproveErrandQuoteByCustomer(order: OrderRecord) {
    if (!user || user.isAnonymous) return;
    await approveCustomErrandQuoteByCustomerInFirestore(order);
    if (optimisticPlacedOrder && optimisticPlacedOrder.id === order.id) {
      setOptimisticPlacedOrder({
        ...optimisticPlacedOrder,
        status: 'on_the_way',
      });
    }
    showNotice(
      'تمت موافقتك على تكلفة المشوار! انطلق الكابتن الآن لتنفيذ مشوارك.'
    );
  }

  async function handleUpdateCourierApprovalByOperations(
    courierId: string,
    nextStatus: CourierApprovalStatus
  ) {
    if (!user) return;
    await approveCourierByAdminInFirestore(courierId, nextStatus);
    showNotice(
      nextStatus === 'approved'
        ? 'تم اعتماد وتفعيل حساب الكابتن بنجاح.'
        : 'تم رفض طلب الكابتن وتحديث حالته.'
    );
  }

  async function handleMarkOrderDeliveredByOperations(order: OrderRecord) {
    if (!user) return;
    await completeOrderDeliveryInFirestore(
      order.id,
      `تم تأكيد التسليم عبر غرفة العمليات (${order.deliveryNeighborhood})`,
      order.courierId || user.uid,
      order.courierName || 'غرفة العمليات'
    );
    showNotice('تم تأكيد إتمام توصيل الطلب وإضافة نقاط العميل بنجاح.');
  }

  // Store Merchant Actions
  async function handleAddMerchantProduct(
    input: NewProductInput,
    storeOwnerId?: string
  ) {
    if (!user) return;
    await addProductToFirestore(input, user.uid, storeOwnerId);
    showNotice(`تمت إضافة صنف "${input.name.trim()}" إلى المنيو بنجاح.`);
  }

  async function handleToggleProductAvailable(
    productId: string,
    nextAvailable: boolean
  ) {
    if (!user) return;
    await toggleProductAvailableInFirestore(productId, nextAvailable);
    showNotice(
      nextAvailable
        ? 'تم تفعيل الصنف في المنيو للعملاء.'
        : 'تم إيقاف الصنف مؤقتاً من المنيو.'
    );
  }

  async function handleUpdateProductStock(
    productId: string,
    nextStockQuantity: number
  ) {
    if (!user) return;
    await updateProductStockInFirestore(productId, nextStockQuantity);
    showNotice('تم تحديث كمية المخزون للصنف بنجاح.');
  }

  async function handleDeleteProductByMerchant(product: ProductRecord) {
    if (!user) return;
    await deleteProductByAdminOrStoreInFirestore(
      product.id,
      product.name,
      undefined,
      false
    );
    showNotice(`تم حذف الصنف "${product.name}" من المنيو بنجاح.`);
  }

  async function handleAcceptOrderByStore(
    orderId: string,
    prepTimeMinutes: number
  ) {
    try {
      if (user) {
        await acceptOrderByStoreInFirestore(orderId, prepTimeMinutes);
      }
      const msg = `تم قبول الطلب وبدء التحضير (${prepTimeMinutes} دقيقة) — ظاهر الآن للمندوب والعميل!`;
      toast.success(msg);
      showNotice(msg);
    } catch (err) {
      const errMsg = formatAppErrorMessage(err, 'تعذر قبول الطلب حالياً.');
      toast.error(errMsg);
      throw err;
    }
  }

  async function handleMarkOrderReadyByStore(orderId: string) {
    try {
      if (user) {
        await markOrderReadyByStoreInFirestore(orderId);
      }
      const msg =
        'تم تحويل الطلب إلى "جاهز للاستلام" وإشعار مندوبي إدكاوي المتاحين فوراً.';
      toast.success(msg);
      showNotice(msg);
    } catch (err) {
      const errMsg = formatAppErrorMessage(err, 'تعذر تحديث حالة الطلب حالياً.');
      toast.error(errMsg);
      throw err;
    }
  }

  async function handleToggleStoreOpen(storeId: string, nextIsOpen: boolean) {
    if (!user) return;
    await toggleStoreOpenInFirestore(storeId, nextIsOpen);
    showNotice(
      nextIsOpen
        ? 'حالة المتجر الآن: مفتوح ويستقبل الطلبات فوراً.'
        : 'حالة المتجر الآن: مغلق حالياً أمام الطلبات الجديدة.'
    );
  }

  async function handleSaveStoreSettings(
    storeId: string,
    settings: StoreOperationalSettingsInput
  ) {
    if (!user) return;
    await updateStoreSettingsInFirestore(storeId, settings);
    showNotice('تم حفظ إعدادات وموقع المتجر ومزامنتها في قاعدة البيانات بنجاح.');
  }

  // Customer Standard Checkout Action
  async function handleConfirmOrder(
    checkout: CheckoutFormInput
  ): Promise<string> {
    const totals = calculateCartTotals(cart, appliedCoupon, {
      zoneDeliveryFee: checkout.zoneDeliveryFee,
      useFreeDeliveryReward: checkout.useFreeDeliveryReward,
    });
    const nowIso = new Date().toISOString();
    const matchedStore = allStores.find((s) => s.id === cart[0]?.storeId);
    const storeNeighborhood = matchedStore?.neighborhood ?? 'شارع البحر';
    const storeOwnerId = matchedStore?.ownerUid || matchedStore?.createdBy;
    const storeConstraints = matchedStore
      ? {
          isOpen: isStoreCurrentlyOpen(matchedStore),
          minOrderAmount: matchedStore.minOrderAmount,
          lat: matchedStore.lat,
          lng: matchedStore.lng,
        }
      : undefined;

    if (!user || user.isAnonymous || autostartPreviewSession) {
      throw new Error(
        'يجب تسجيل الدخول بحساب Google أو البريد الإلكتروني أولاً قبل إنشاء أي طلب.'
      );
    }
    if (userProfile?.isBanned || currentUserBlockRecord?.isBlocked) {
      showNotice('حسابك محظور، تواصل مع الدعم');
      throw new Error('حسابك محظور، تواصل مع الدعم');
    }

    let orderId = '';
    const confirmedStatus: OrderStatus =
      checkout.paymentMethod === 'visa' ? 'pending_payment' : 'confirmed';
    try {
      orderId = await placeOrderInFirestore(
        user.uid,
        cart,
        checkout,
        storeNeighborhood,
        storeOwnerId,
        storeConstraints,
        appliedCoupon,
        activeGroupCartId ?? undefined
      );
      toast.success(
        confirmedStatus === 'pending_payment'
          ? 'تم تسجيل الطلب وهو بانتظار إتمام الدفع الإلكتروني'
          : 'تم تأكيد طلبك وإرساله للمتجر بنجاح 🎉'
      );
    } catch (err) {
      toast.error(formatAppErrorMessage(err, 'تعذر إنشاء الطلب حالياً.'));
      throw err;
    }

    const optimistic: OrderRecord = {
      id: orderId,
      orderType: 'standard',
      customerId: user.uid,
      storeId: cart[0].storeId,
      storeOwnerId,
      storeName: cart[0].storeName,
      storeLat: matchedStore?.lat,
      storeLng: matchedStore?.lng,
      customerName: checkout.customerName.trim(),
      customerPhone: normalizeEgyptPhoneOrEmpty(checkout.customerPhone),
      deliveryNeighborhood: checkout.deliveryNeighborhood.trim(),
      deliveryAddress: checkout.deliveryAddress.trim(),
      zoneId: checkout.zoneId,
      zoneName: checkout.zoneName,
      customerLat: checkout.customerLat,
      customerLng: checkout.customerLng,
      isScheduled: checkout.isScheduled,
      scheduledForIso: checkout.scheduledForIso,
      groupCartId: activeGroupCartId ?? undefined,
      items: totals.items,
      itemsSummary: totals.itemsSummary,
      itemNames: totals.itemNames,
      itemCount: totals.itemCount,
      subtotal: totals.subtotal,
      smallOrderFee: totals.smallOrderFee,
      couponCode: totals.couponCode,
      discountPercent: totals.discountPercent,
      discountAmount: totals.discountAmount,
      deliveryFee: totals.deliveryFee,
      totalAmount: totals.totalAmount,
      paymentMethod: checkout.paymentMethod,
      status: confirmedStatus,
      notes: checkout.notes.trim(),
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    };

    setOptimisticPlacedOrder(optimistic);
    setCart([]);
    setAppliedCoupon(null);
    if (activeGroupCartId) {
      handleLeaveSharedCart();
    }
    setTrackedOrderId(orderId);
    setJustPlacedOrderId(orderId);
    setActiveView('tracking');
    window.scrollTo(0, 0);
    return orderId;
  }

  async function handleConfirmPendingOrder(
    orderId: string,
    paymentMethod?: PaymentMethod
  ): Promise<OrderStatus> {
    if (!user || user.isAnonymous || autostartPreviewSession) {
      throw new Error('يجب تسجيل الدخول بحسابك أولاً قبل تأكيد الطلب.');
    }
    const nextStatus = await confirmCustomerOrderInFirestore(
      orderId,
      paymentMethod
    );
    if (optimisticPlacedOrder && optimisticPlacedOrder.id === orderId) {
      setOptimisticPlacedOrder({
        ...optimisticPlacedOrder,
        status: nextStatus,
        updatedAtIso: new Date().toISOString(),
      });
    }
    toast.success(
      nextStatus === 'pending_payment'
        ? 'تم تحديث حالة الطلب إلى بانتظار إتمام الدفع.'
        : 'تم تأكيد طلبك بنجاح! 🎉'
    );
    return nextStatus;
  }

  // Courier Portal Actions
  async function handleToggleCourierAvailability(nextAvailable: boolean) {
    if (!user || !currentCourierRecord) return;
    const nextProfile: CourierProfileInput = {
      name: currentCourierRecord.name,
      phone: currentCourierRecord.phone,
      vehicleType: currentCourierRecord.vehicleType,
      neighborhood: currentCourierRecord.neighborhood,
      lat: currentCourierRecord.lat,
      lng: currentCourierRecord.lng,
      isAvailable: nextAvailable,
    };

    await upsertCourierAvailabilityInFirestore(
      user.uid,
      nextProfile,
      currentCourierRecord.completedDeliveries
    );
    showNotice(
      nextAvailable
        ? 'تم تفعيل حالة المندوب: متاح لاستلام طلبات مدينة إدكو.'
        : 'تم تحويل حالة المندوب إلى: غير متاح حالياً.'
    );
  }

  async function handleSaveCourierProfile(profile: CourierProfileInput) {
    if (!user || !currentCourierRecord) return;
    await upsertCourierAvailabilityInFirestore(
      user.uid,
      profile,
      currentCourierRecord.completedDeliveries
    );
    showNotice('تم حفظ وتحديث بيانات وموقع الكابتن على الخريطة بنجاح.');
  }

  async function handlePickupOrderByCourier(
    orderId: string,
    courierName: string,
    courierPhone: string,
    initialLocation: string,
    coords?: { lat?: number; lng?: number }
  ) {
    if (!user) return;
    const loc = initialLocation || EDKU_ROUTE_WAYPOINTS[1];
    await pickupOrderByCourierInFirestore(
      orderId,
      user.uid,
      courierName,
      courierPhone,
      loc,
      coords
    );
    showNotice(
      'تم استلام الطلب من المتجر — الحالة الآن "في الطريق إليك" مع الخريطة الحية لدى العميل!'
    );
  }

  async function handleUpdateCourierLocation(
    orderId: string,
    courierName: string,
    courierPhone: string,
    nextLocation: string,
    coords?: { lat?: number; lng?: number }
  ) {
    if (!user) return;
    await updateOrderCourierLocationInFirestore(
      orderId,
      user.uid,
      courierName,
      courierPhone,
      nextLocation,
      coords
    );
    showNotice(`تم تحديث موقع المندوب المباشر: ${nextLocation}`);
  }

  async function handleStreamCourierLiveGps(
    lat: number,
    lng: number,
    locationLabel?: string
  ) {
    if (!user || !currentCourierRecord) return;
    await updateCourierLiveGpsInFirestore(
      user.uid,
      currentCourierRecord.name,
      currentCourierRecord.phone,
      lat,
      lng,
      portalOrders,
      locationLabel
    );
  }

  async function handleCompleteDeliveryByCourier(
    orderId: string,
    finalLocation: string,
    coords?: { lat?: number; lng?: number }
  ) {
    if (!user || !currentCourierRecord) return;
    await completeOrderDeliveryInFirestore(
      orderId,
      finalLocation,
      user.uid,
      currentCourierRecord.name,
      coords
    );
    await upsertCourierAvailabilityInFirestore(
      user.uid,
      {
        name: currentCourierRecord.name,
        phone: currentCourierRecord.phone,
        vehicleType: currentCourierRecord.vehicleType,
        neighborhood: currentCourierRecord.neighborhood,
        lat: coords?.lat ?? currentCourierRecord.lat,
        lng: coords?.lng ?? currentCourierRecord.lng,
        isAvailable: currentCourierRecord.isAvailable,
      },
      currentCourierRecord.completedDeliveries + 1
    ).catch(() => {});
    showNotice(
      'تم التوصيل بنجاح وإضافة نقاط الولاء للعميل وإشعاره لتقييم التجربة!'
    );
  }

  async function handleReleaseOrderByCourier(orderId: string) {
    if (!user) return;
    await releaseOrderByCourierInFirestore(orderId, user.uid);
    showNotice('تم إلغاء استلام الطلب وإعادته لقائمة المناديب المتاحين.');
  }

  // Admin Portal Actions
  async function handleCreateStoreByAdmin(
    input: AdminCreateStoreInput
  ): Promise<StoreCredentialRecord> {
    if (!user) {
      throw new Error('يرجى تسجيل الدخول لبوابة الإدارة أولاً.');
    }
    const createdCred = await createStoreByAdminInFirestore(user.uid, input);
    setStoreCredentialsMap((prev) => ({
      ...prev,
      [createdCred.storeId]: createdCred,
    }));
    showNotice(
      `تم إنشاء "${createdCred.storeName}" وتوليد بريد الدخول ${createdCred.loginEmail}.`
    );
    return createdCred;
  }

  async function handleApproveCourierByAdmin(
    courierId: string,
    nextStatus: CourierApprovalStatus = 'approved',
    rejectionReason?: string
  ) {
    if (!user) return;
    await approveCourierByAdminInFirestore(
      courierId,
      nextStatus,
      rejectionReason
    );
    showNotice(
      nextStatus === 'rejected'
        ? 'تم رفض مستندات الكابتن وإخطاره بالسبب للتعديل.'
        : 'تمت الموافقة على الكابتن واعتماد حسابه بنجاح!'
    );
  }

  async function handleCreateCourierByAdmin(
    input: AdminCreateCourierInput
  ): Promise<CourierCredentialRecord> {
    if (!user) {
      throw new Error('يرجى تسجيل الدخول لبوابة الإدارة أولاً.');
    }
    const created = await createCourierByAdminInFirestore(user.uid, input);
    showNotice(`تم إنشاء وتفعيل حساب المندوب "${created.name}" بنجاح.`);
    return created;
  }

  async function handleAssignCourierManually(
    orderId: string,
    courier: CourierRecord
  ) {
    if (!user) return;
    const loc = `تم التعيين من الإدارة (${courier.neighborhood})`;
    await assignCourierManuallyInFirestore(
      orderId,
      courier.id,
      courier.name,
      courier.phone,
      loc
    );
    showNotice(`تم تعيين "${courier.name}" يدوياً على الطلب بنجاح.`);
  }

  async function handleToggleStoreActive(storeId: string, nextActive: boolean) {
    if (!user) return;
    await toggleStoreActiveInFirestore(storeId, nextActive);
    showNotice(
      nextActive
        ? 'تم تفعيل المتجر وعاد للظهور فوراً في واجهة العميل.'
        : 'تم إيقاف المتجر مؤقتاً وإخفاؤه من واجهة العميل.'
    );
  }

  async function handleCreateAdByAdmin(input: AdBannerInput) {
    if (!user) return;
    await createAdBannerByAdminInFirestore(user.uid, input);
    showNotice('تم نشر البنر الإعلاني فوراً في الصفحة الرئيسية للعملاء.');
  }

  async function handleToggleAdActiveByAdmin(
    adId: string,
    nextActive: boolean
  ) {
    if (!user) return;
    await toggleAdBannerActiveByAdminInFirestore(adId, nextActive);
    showNotice(
      nextActive
        ? 'تم تفعيل البنر الإعلاني للعملاء.'
        : 'تم إيقاف عرض البنر الإعلاني مؤقتاً.'
    );
  }

  async function handleDeleteAdByAdmin(adId: string) {
    if (!user) return;
    await deleteAdBannerByAdminInFirestore(adId);
    showNotice('تم حذف البنر الإعلاني من قاعدة البيانات.');
  }

  async function handleUpsertCouponByAdmin(input: CouponInput) {
    if (!user) return;
    await upsertCouponByAdminInFirestore(user.uid, input);
    showNotice(`تم حفظ وتفعيل كود الخصم ${input.code.toUpperCase()} بنجاح.`);
  }

  async function handleToggleCouponActiveByAdmin(
    couponId: string,
    nextActive: boolean
  ) {
    if (!user) return;
    await toggleCouponActiveByAdminInFirestore(couponId, nextActive);
    showNotice(
      nextActive ? 'تم تفعيل الكوبون.' : 'تم إيقاف الكوبون مؤقتاً.'
    );
  }

  async function handleDeleteCouponByAdmin(couponId: string) {
    if (!user) return;
    await deleteCouponByAdminInFirestore(couponId);
    showNotice('تم حذف كود الخصم.');
  }

  async function handleSendAdminNotification(
    input: AdminNotificationSendInput
  ) {
    if (!user) return;
    await sendAdminNotificationInFirestore(user.uid, input);
    showNotice('تم إرسال الإشعار الداخلي للفئة المستهدفة بنجاح!');
  }

  async function handleCreateCampaignByAdmin(input: CampaignInput) {
    if (!user) return;
    await createCampaignByAdminInFirestore(user.uid, input);
    showNotice('تم إطلاق الفعالية الدورية بنجاح!');
  }

  async function handleToggleCampaignByAdmin(
    campaignId: string,
    nextActive: boolean
  ) {
    if (!user) return;
    await toggleCampaignActiveByAdminInFirestore(campaignId, nextActive);
    showNotice(
      nextActive ? 'تم تفعيل الفعالية للعملاء.' : 'تم إيقاف الفعالية مؤقتاً.'
    );
  }

  async function handleDeleteCampaignByAdmin(campaignId: string) {
    if (!user) return;
    await deleteCampaignByAdminInFirestore(campaignId);
    showNotice('تم حذف الفعالية من قاعدة البيانات.');
  }

  async function handleGiftPointsByAdmin(
    customer: CustomerDirectoryEntry,
    bonusPoints: number,
    reasonNote?: string
  ) {
    if (!user) return;
    await giftPointsByAdminInFirestore(
      user.uid,
      customer.uid,
      customer.name,
      customer.points,
      bonusPoints,
      reasonNote
    );
    showNotice(`تم إهداء +${bonusPoints} نقطة للعميل "${customer.name}".`);
  }

  async function handlePurgeDemoDataByAdmin(): Promise<number> {
    if (!user) return 0;
    return purgeDemoDataByAdminInFirestore();
  }

  async function handleBanCustomerByAdmin(
    customer: { uid: string; name: string; customerCode?: string },
    nextBanned: boolean,
    reason?: string
  ) {
    if (!user) return;
    await setCustomerBanStatusByAdminInFirestore(user.uid, {
      customerUid: customer.uid,
      customerName: customer.name,
      customerCode: customer.customerCode,
      isBanned: nextBanned,
      reason,
    });
    showNotice(
      nextBanned
        ? `تم حظر حساب العميل "${customer.name}" وإرسال إشعار فوري له.`
        : `تم إلغاء الحظر عن حساب العميل "${customer.name}".`
    );
  }

  async function handleUpdateStoreDeliveryFeeByAdmin(
    store: StoreRecord,
    nextDeliveryFeeEgp: number
  ) {
    if (!user) return;
    await updateStoreDeliveryFeeByAdminInFirestore(
      user.uid,
      store.id,
      store.name,
      store.neighborhood,
      nextDeliveryFeeEgp
    );
    showNotice(
      `تم تعديل سعر التوصيل لمتجر "${store.name}" إلى ${nextDeliveryFeeEgp} ج.م.`
    );
  }

  async function handleDeleteProductByAdmin(
    product: ProductRecord,
    storeName?: string
  ) {
    if (!user) return;
    await deleteProductByAdminOrStoreInFirestore(
      product.id,
      product.name,
      storeName,
      true
    );
    showNotice(`تم حذف المنتج "${product.name}" وتسجيل العملية.`);
  }

  async function handleSimulateOrderTestByAdmin(): Promise<QaSimulationReport> {
    if (!user) {
      throw new Error('يلزم تسجيل الدخول لبوابة الإدارة لإجراء الاختبار.');
    }
    return runSimulateOrderCycleTestInFirestore(user.uid);
  }

  async function handleCheckFirebaseHealthByAdmin(): Promise<FirebaseConnectionHealthResult> {
    return checkFirebaseConnectionHealth();
  }

  async function handlePurgeAllTestDataByAdmin(): Promise<number> {
    if (!user) return 0;
    return purgeAllQaAndTestDataInFirestore(user.uid);
  }

  function handleOpenLegalModal(section: LegalSectionKey = 'terms') {
    setLegalModalState({ isOpen: true, section });
  }

  async function handleUpdateMaintenanceByAdmin(
    nextMode: boolean,
    message: string
  ) {
    if (!user) return;
    await updateSystemMaintenanceByAdminInFirestore(
      user.uid,
      nextMode,
      message
    );
    showNotice(
      nextMode
        ? 'تم تفعيل وضع الصيانة في منصة إدكاوي.'
        : 'تم إيقاف وضع الصيانة وإعادة تشغيل المنصة.'
    );
  }

  async function handleSetEntityBlockedByAdmin(input: {
    targetId: string;
    targetType: BlockedEntityType;
    targetName?: string;
    reason?: string;
    isBlocked: boolean;
  }) {
    if (!user) return;
    const matchedStore =
      input.targetType === 'store'
        ? allStores.find((s) => s.id === input.targetId)
        : undefined;
    await setEntityBlockedByAdminInFirestore(user.uid, {
      targetId: input.targetId,
      targetType: input.targetType,
      targetName:
        input.targetName?.trim() ||
        matchedStore?.name ||
        input.targetId,
      reason: input.reason,
      isBlocked: input.isBlocked,
      storeOwnerUid: matchedStore?.ownerUid || matchedStore?.createdBy,
    });
    showNotice(
      input.isBlocked
        ? `تم حظر «${input.targetName || matchedStore?.name || input.targetId}» بنجاح.`
        : `تم فك الحظر عن «${input.targetName || matchedStore?.name || input.targetId}» بنجاح.`
    );
  }

  async function handleCancelOrder(orderId: string) {
    try {
      if (user) {
        await cancelPendingOrderInFirestore(orderId);
      } else if (autostartPreviewSession) {
        setPortalOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: 'cancelled' } : o))
        );
      }

      if (optimisticPlacedOrder && optimisticPlacedOrder.id === orderId) {
        setOptimisticPlacedOrder({
          ...optimisticPlacedOrder,
          status: 'cancelled',
        });
      }
      toast.success('تم إلغاء الطلب وتحديث حالته في جميع الواجهات.');
      showNotice('تم إلغاء الطلب وتحديث حالته في جميع الواجهات.');
    } catch (err) {
      toast.error(formatAppErrorMessage(err, 'تعذر إلغاء الطلب حالياً.'));
      throw err;
    }
  }

  async function handleLogout() {
    if (user) {
      await logoutUser();
    }
    pendingReturnToCheckoutRef.current = false;
    setHasPendingCartForCheckout(false);
    setAutostartPreviewSession(false);
    setCart([]);
    setAppliedCoupon(null);
    setSelectedStoreId(null);
    setTrackedOrderId(null);
    setJustPlacedOrderId(null);
    setStoreCredentialsMap({});
    setIsNotificationsOpen(false);
    setIsVisualSearchOpen(false);
    setIsErrandModalOpen(false);
    setReviewModalOrder(null);
    setShowOnboardingModal(false);
    setCurrentUserBlockRecord(null);
    setCurrentStoreBlockRecord(null);
    setCustomerWalletTopups([]);
    setCustomerWalletTransactions([]);
    setAdminWalletTopups([]);
    setAccountInitialSection('addresses');
    setActivePortal('customer');
    setActiveView('stores');
  }

  async function handleNavbarPrimaryAction() {
    if (!isAuthenticated || isGuestCustomer) {
      await handleOpenLoginScreenForCheckout();
      return;
    }
    await handleLogout();
  }

  if (!authReady || (Boolean(user) && !roleReady && !pendingAuthTransition)) {
    return (
      <EdkawySplashScreen
        isLoading={true}
        statusText="جارٍ التحقق من الجلسة ومزامنة بيانات إدكو الحية..."
      />
    );
  }

  const isStaffOrAdminPortal =
    activePortal === 'admin' ||
    activePortal === 'support_agent' ||
    activePortal === 'operations';

  const isCurrentCustomerBanned =
    isAuthenticated &&
    activePortal === 'customer' &&
    !isGuestCustomer &&
    Boolean(userProfile?.isBanned || currentUserBlockRecord?.isBlocked);

  const effectiveBlockedRecord: BlockedEntityRecord | null =
    isAuthenticated && !isStaffOrAdminPortal
      ? currentUserBlockRecord?.isBlocked
        ? currentUserBlockRecord
        : currentStoreBlockRecord?.isBlocked
        ? currentStoreBlockRecord
        : userProfile?.isBanned
        ? {
            targetId: user?.uid || 'user',
            targetType: activePortal === 'courier' ? 'courier' : activePortal === 'store' ? 'store' : 'customer',
            targetName: userProfile?.name || user?.displayName || 'مستخدم إدكاوي',
            reason: userProfile?.banReason || 'تم حظر الحساب لمخالفة سياسات وشروط استخدام إدكاوي.',
            isBlocked: true,
            blockedBy: 'admin',
            updatedAtIso: userProfile.updatedAtIso || new Date().toISOString(),
          }
        : null
      : null;

  if (effectiveBlockedRecord) {
    return (
      <>
        <BlockedAccountScreen
          blockedRecord={effectiveBlockedRecord}
          onOpenLegalModal={handleOpenLegalModal}
          onSignOut={() => {
            void handleLogout();
          }}
        />
        <LegalPagesModal
          isOpen={legalModalState.isOpen}
          initialSection={legalModalState.section}
          onClose={() =>
            setLegalModalState((prev) => ({ ...prev, isOpen: false }))
          }
        />
      </>
    );
  }

  // Standalone Public Route: /join (Store Partner Registration)
  if (currentPath === '/join') {
    return (
      <StoreJoinView
        onBackToHome={() => {
          navigateToPath('/');
        }}
      />
    );
  }

  // Collaborative Group Order Split-View Room: /group/:roomCode (Requires non-anonymous account!)
  const groupRoomMatch = currentPath.match(/^\/group\/([A-Za-z0-9_-]+)/);
  if (
    groupRoomMatch &&
    groupRoomMatch[1] &&
    isAuthenticated &&
    !isGuestCustomer &&
    activePortal === 'customer'
  ) {
    return (
      <GroupOrderRoomView
        roomCode={groupRoomMatch[1].toUpperCase()}
        currentUser={userProfile}
        onBackToHome={() => {
          navigateToPath('/');
        }}
        onOpenStoreMenu={(storeId, cartId) => {
          autoOpenedSharedStoreRef.current = cartId;
          setActiveGroupCartId(cartId);
          setSelectedStoreId(storeId);
          setActiveView('store_menu');
          navigateToPath(`/?groupCart=${cartId}`);
        }}
        onProceedToCheckout={(sharedCart) => {
          handleCheckoutSharedCart(sharedCart);
          navigateToPath('/');
        }}
      />
    );
  }

  if (
    isAuthenticated &&
    !isStaffOrAdminPortal &&
    maintenanceConfig.maintenanceMode &&
    !forceAdminLoginInMaintenance
  ) {
    return (
      <>
        <MaintenanceModeScreen
          config={maintenanceConfig}
          isSignedIn={Boolean(user)}
          isGuestCustomer={isGuestCustomer}
          onOpenAdminLogin={() => {
            setForceAdminLoginInMaintenance(true);
            void handleLogout();
          }}
          onOpenLegalModal={handleOpenLegalModal}
          onSignOut={() => {
            setForceAdminLoginInMaintenance(true);
            void handleLogout();
          }}
        />
        <LegalPagesModal
          isOpen={legalModalState.isOpen}
          initialSection={legalModalState.section}
          onClose={() =>
            setLegalModalState((prev) => ({ ...prev, isOpen: false }))
          }
        />
      </>
    );
  }

  const isCustomerPortal = isAuthenticated && activePortal === 'customer';

  const hasDedicatedStickyCheckoutBar =
    isCustomerPortal &&
    cart.length > 0 &&
    (activeView === 'cart' || activeView === 'checkout');

  const showMobileBottomNav = isCustomerPortal && !hasDedicatedStickyCheckoutBar;

  const showFloatingCart =
    isCustomerPortal &&
    cart.length > 0 &&
    (activeView === 'stores' || activeView === 'store_menu');

  const hasBottomBar =
    showFloatingCart || hasDedicatedStickyCheckoutBar || showMobileBottomNav;

  const isFullBleedDashboard =
    isAuthenticated &&
    (activePortal === 'admin' ||
      activePortal === 'store' ||
      activePortal === 'support_agent' ||
      activePortal === 'operations' ||
      activePortal === 'sales_agent');

  const activeBottomTab: ActiveTab =
    activeView === 'cart' || activeView === 'checkout'
      ? 'cart'
      : activeView === 'orders' || activeView === 'tracking'
      ? 'orders'
      : activeView === 'account'
      ? 'account'
      : 'stores';

  return (
    <div
      id="top"
      className="min-h-screen flex flex-col bg-[#0F172A] text-[#F8FAFC]"
    >
      {/* Toast Notifications System (react-hot-toast with Arabic RTL theme) */}
      <Toaster
        position="top-center"
        reverseOrder={false}
        toastOptions={{
          duration: 3500,
          style: {
            background: '#1E293B',
            color: '#FFFFFF',
            borderRadius: '16px',
            fontFamily: 'Cairo, sans-serif',
            fontSize: '13px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
          },
        }}
      />

      {/* Network Offline Status Banner */}
      {!isOnline && (
        <div
          role="alert"
          dir="rtl"
          className="bg-rose-600 text-white text-xs sm:text-sm font-bold py-2.5 px-4 text-center sticky top-0 z-[100] shadow-md flex items-center justify-center gap-2"
        >
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>أنت غير متصل بالإنترنت حالياً. بياناتك وسلة مشترياتك محفوظة محلياً وسيتم المزامنة تلقائياً فور عودة الشبكة.</span>
        </div>
      )}

      {/* Google Maps Demo Key Quota Exceeded Top Sticky Banner */}
      {mapsQuotaExceeded && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-200 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-300 hover:text-amber-100"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {!isFullBleedDashboard && (
        <Navbar
          activePortal={activePortal}
          activeCustomerView={activeView}
          onNavigateCustomerView={(nextView) => {
            setJustPlacedOrderId(null);
            if (nextView === 'account') {
              setAccountInitialSection('addresses');
            }
            setActiveView(nextView);
            window.scrollTo(0, 0);
          }}
          cartItemCount={cartItemCount}
          customerOrdersCount={customerOrders.length}
          unreadNotificationsCount={unreadNotificationsCount}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          isAuthenticated={isAuthenticated}
          isGuestCustomer={isGuestCustomer}
          userName={userProfile?.name || user?.displayName || undefined}
          onPrimaryAction={handleNavbarPrimaryAction}
        />
      )}

      {isCurrentCustomerBanned && (
        <div
          role="alert"
          dir="rtl"
          className="bg-red-600 text-white px-4 py-3 border-b border-red-700"
        >
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>حسابك محظور، تواصل مع الدعم</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setAccountInitialSection('support');
                setActiveView('account');
                window.scrollTo(0, 0);
              }}
              className="px-3.5 py-1.5 rounded-2xl bg-[#0F172A] text-[#F8FAFC] border border-[#334155] hover:bg-[#1E293B] text-xs font-bold cursor-pointer shrink-0"
            >
              فتح حسابي والتواصل مع الدعم
            </button>
          </div>
        </div>
      )}

      {isAuthenticated && !isGuestCustomer && Boolean(pendingInviteToken) && (
        <div
          role="dialog"
          aria-modal="true"
          dir="rtl"
          className="fixed inset-0 z-[110] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#1E293B] border border-[#334155] p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-extrabold text-[#F8FAFC]">
              تم رصد رابط دعوة تسجيل في إدكاوي
            </h3>
            <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
              أنت مسجل الدخول حالياً بحساب ({userProfile?.name || user?.email || 'حساب حالي'}). لاستكمال تسجيل الحساب الجديد عبر رابط الدعوة، يرجى تسجيل الخروج أولاً من الجلسة الحالية.
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  void handleLogout();
                }}
                className="flex-1 min-h-[44px] px-4 py-2.5 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs sm:text-sm font-bold cursor-pointer"
              >
                تسجيل الخروج وفتح الدعوة
              </button>
              <button
                type="button"
                onClick={handleClearInviteTokenAndUrl}
                className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-[#0F172A] hover:bg-[#334155] border border-[#334155] text-[#F8FAFC] text-xs sm:text-sm font-bold cursor-pointer"
              >
                تجاهل وإغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {noticeBanner && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-4 inset-x-0 flex justify-center px-4 pointer-events-none edkawi-toast-layer"
        >
          <div className="pointer-events-auto max-w-xl rounded-2xl bg-[#1E293B] text-white border border-white/15 shadow-2xl px-5 py-3 text-xs sm:text-sm font-bold text-center">
            {noticeBanner}
          </div>
        </div>
      )}

      <main className="flex-1 w-full min-w-0">
        {!isAuthenticated || ((Boolean(pendingInviteToken) || hasPendingGroupJoin) && isGuestCustomer) ? (
          <AuthScreen
            onAuthTransitionStart={handleAuthTransitionStart}
            onAuthTransitionEnd={(resolvedRole, needsProfileCompletion) => {
              if (
                resolvedRole === 'admin' ||
                resolvedRole === 'support_agent' ||
                resolvedRole === 'operations'
              ) {
                setForceAdminLoginInMaintenance(false);
              }
              handleAuthTransitionEnd(resolvedRole, needsProfileCompletion);
            }}
            onFallbackGuestPreview={handleEnterGuestPreviewFallback}
            hasPendingCartForCheckout={hasPendingCartForCheckout}
            hasPendingGroupJoin={hasPendingGroupJoin}
            onOpenLegalModal={handleOpenLegalModal}
            inviteToken={pendingInviteToken}
            onClearInviteToken={handleClearInviteTokenAndUrl}
          />
        ) : activePortal === 'support_agent' ? (
          <SupportAgentPortalView
            agentUid={user?.uid ?? ''}
            agentName={
              userProfile?.name || user?.displayName || 'مسؤول الدعم الفني'
            }
            assignedTickets={assignedSupportTickets}
            onLogout={() => {
              void handleLogout();
            }}
            onNotify={showNotice}
          />
        ) : activePortal === 'operations' ? (
          <OperationsPortalView
            officerName={
              userProfile?.name || user?.displayName || 'مسؤول العمليات'
            }
            orders={portalOrders}
            couriers={liveCouriers}
            onLogout={() => {
              void handleLogout();
            }}
            onAssignOrderCourier={(ord, courier) =>
              handleAssignCourierManually(ord.id, courier)
            }
            onMarkOrderDelivered={handleMarkOrderDeliveredByOperations}
            onCancelOrder={(ord) => handleCancelOrder(ord.id)}
            onUpdateCourierApproval={handleUpdateCourierApprovalByOperations}
          />
        ) : activePortal === 'store' ? (
          <StorePortalView
            stores={allStores}
            selectedStoreId={effectiveMerchantStoreId}
            onSelectStoreId={setSelectedStoreId}
            products={storeProducts}
            isLoadingProducts={isLoadingProducts}
            orders={portalOrders}
            isLoadingOrders={isLoadingOrders}
            storeReviews={storeReviews}
            unreadNotificationsCount={unreadNotificationsCount}
            onOpenNotifications={() => setIsNotificationsOpen(true)}
            onAcceptOrder={handleAcceptOrderByStore}
            onQuotePharmacyOrder={handleQuotePharmacyOrderByStore}
            onMarkOrderReady={handleMarkOrderReadyByStore}
            onCancelOrder={handleCancelOrder}
            onAddProduct={handleAddMerchantProduct}
            onToggleProductAvailable={handleToggleProductAvailable}
            onUpdateProductStock={handleUpdateProductStock}
            onDeleteProduct={handleDeleteProductByMerchant}
            onToggleStoreOpen={handleToggleStoreOpen}
            onSaveStoreSettings={handleSaveStoreSettings}
            merchantUid={user?.uid}
            merchantEmail={user?.email ?? ''}
            onNotify={showNotice}
            onLogout={handleLogout}
          />
        ) : activePortal === 'courier' ? (
          <CourierPortalView
            courierUid={user?.uid}
            courierEmail={user?.email ?? ''}
            currentCourier={currentCourierRecord}
            isLoadingCourier={isLoadingCourier}
            orders={portalOrders}
            stores={allStores}
            surgeEnabled={Boolean(maintenanceConfig.surgeEnabled)}
            surgeMultiplier={maintenanceConfig.surgeMultiplier ?? 1.5}
            onNotify={showNotice}
            onToggleAvailability={handleToggleCourierAvailability}
            onSaveCourierProfile={handleSaveCourierProfile}
            onQuoteCustomErrand={handleQuoteCustomErrandByCourier}
            onPickupOrder={handlePickupOrderByCourier}
            onUpdateOrderLocation={handleUpdateCourierLocation}
            onCompleteDelivery={handleCompleteDeliveryByCourier}
            onReleaseOrder={handleReleaseOrderByCourier}
            onStreamLiveGps={handleStreamCourierLiveGps}
            onLogout={handleLogout}
          />
        ) : activePortal === 'admin' ? (
          <AdminPortalView
            adminUid={user?.uid}
            orders={portalOrders}
            stores={allStores}
            storeCredentialsMap={storeCredentialsMap}
            couriers={liveCouriers}
            supportTickets={adminSupportTickets}
            staffMembers={staffMembers}
            ads={adminAds}
            coupons={adminCoupons}
            campaigns={adminCampaigns}
            customersDirectory={customersDirectory}
            adminCustomers={adminCustomersWithPii}
            adminWalletTopups={adminWalletTopups}
            products={allAvailableProducts}
            auditLogs={adminAuditLogs}
            broadcastHistory={adminBroadcastHistory}
            unreadNotificationsCount={unreadNotificationsCount}
            onOpenNotifications={() => setIsNotificationsOpen(true)}
            onNotify={showNotice}
            onApproveCourier={handleApproveCourierByAdmin}
            onCreateCourierByAdmin={handleCreateCourierByAdmin}
            onAssignCourierManually={handleAssignCourierManually}
            onCancelOrder={handleCancelOrder}
            onToggleStoreActive={handleToggleStoreActive}
            onUpdateStoreDeliveryFee={handleUpdateStoreDeliveryFeeByAdmin}
            onDeleteProductByAdmin={handleDeleteProductByAdmin}
            onCreateAdBanner={handleCreateAdByAdmin}
            onToggleAdBannerActive={handleToggleAdActiveByAdmin}
            onDeleteAdBanner={handleDeleteAdByAdmin}
            onUpsertCoupon={handleUpsertCouponByAdmin}
            onToggleCouponActive={handleToggleCouponActiveByAdmin}
            onDeleteCoupon={handleDeleteCouponByAdmin}
            onSendAdminNotification={handleSendAdminNotification}
            onCreateCampaign={handleCreateCampaignByAdmin}
            onToggleCampaignActive={handleToggleCampaignByAdmin}
            onDeleteCampaign={handleDeleteCampaignByAdmin}
            onGiftCustomerPoints={handleGiftPointsByAdmin}
            onBanCustomer={handleBanCustomerByAdmin}
            onPurgeDemoData={handlePurgeDemoDataByAdmin}
            onSimulateOrderTest={handleSimulateOrderTestByAdmin}
            onCheckFirebaseHealth={handleCheckFirebaseHealthByAdmin}
            onPurgeAllTestData={handlePurgeAllTestDataByAdmin}
            maintenanceConfig={maintenanceConfig}
            blockedEntities={adminBlockedEntities}
            edkoZones={edkoZones}
            superAppCategories={superAppCategories}
            initialSection={currentPath === '/admin/requests' ? 'requests' : undefined}
            onUpdateMaintenance={handleUpdateMaintenanceByAdmin}
            onSetEntityBlocked={handleSetEntityBlockedByAdmin}
            onOpenAddStoreModal={() => setIsAddStoreOpen(true)}
            onLogout={handleLogout}
          />
        ) : activePortal === 'sales_agent' ? (
          <SalesAgentPortalView
            agentUid={user?.uid ?? ''}
            agentEmail={user?.email ?? ''}
            agentName={userProfile?.name || user?.displayName || 'مسؤول مبيعات إدكاوي'}
            onLogout={handleLogout}
            onNotify={showNotice}
          />
        ) : activeView === 'account' ? (
          <CustomerAccountView
            userUid={user?.uid ?? ''}
            userEmail={user?.email ?? ''}
            userDisplayName={user?.displayName ?? ''}
            emailVerified={Boolean(user?.emailVerified)}
            isAnonymous={isGuestCustomer}
            userProfile={userProfile}
            stores={activeCustomerStores}
            walletTopups={customerWalletTopups}
            walletTransactions={customerWalletTransactions}
            initialSection={accountInitialSection}
            onUpdateProfileDetails={handleUpdateCustomerProfileDetails}
            onRedeemPoints={handleRedeemCustomerPoints}
            onToggleFavoriteStore={handleToggleFavoriteStore}
            onSelectStore={handleOpenStoreMenu}
            onOpenDailySpin={() => setIsDailySpinOpen(true)}
            onOpenAuthModal={() => {
              void handleOpenLoginScreenForCheckout();
            }}
            onOpenLegalModal={handleOpenLegalModal}
            onNavigateToJoin={() => navigateToPath('/join')}
            onNavigateToAds={() => {
              setActiveView('stores');
              window.setTimeout(() => {
                const adsBanner = document.getElementById('home-ads-banner');
                if (adsBanner) {
                  adsBanner.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                  });
                } else {
                  window.scrollTo({ top: 320, behavior: 'smooth' });
                }
              }, 120);
            }}
            activeOrdersCount={activeCustomerOrdersCount}
            onSignOut={() => {
              void handleLogout();
            }}
          />
        ) : activeView === 'store_menu' && selectedStore ? (
          <StoreMenuView
            store={selectedStore}
            products={storeProducts}
            isLoadingProducts={isLoadingProducts}
            productsError={productsError}
            cart={cart}
            currentUserUid={user?.uid || ''}
            isGuestCustomer={isGuestCustomer}
            userProfile={userProfile}
            defaultCustomerName={userProfile?.name || user?.displayName || ''}
            isFavorite={Boolean(
              userProfile?.favoriteStoreIds?.includes(selectedStore.id)
            )}
            onToggleFavorite={() => {
              void handleToggleFavoriteStore(selectedStore.id);
            }}
            reviews={storeReviews}
            activeSharedCart={
              activeSharedCart && activeSharedCart.storeId === selectedStore.id
                ? activeSharedCart
                : null
            }
            onStartGroupOrder={handleStartGroupOrder}
            onUpsertSharedCartItem={handleUpsertSharedCartItem}
            onUpdateSharedCartEntryQuantity={handleUpdateSharedCartEntryQuantity}
            onCheckoutSharedCart={handleCheckoutSharedCart}
            onLeaveSharedCart={handleLeaveSharedCart}
            onSubmitPharmacyOrder={handleSubmitPharmacyOrder}
            onOpenAuthModal={() => {
              void handleOpenLoginScreenForCheckout();
            }}
            onBackToStores={() => setActiveView('stores')}
            onAddProductToCart={handleAddToCart}
            onUpdateCartQuantity={handleUpdateQuantity}
          />
        ) : activeView === 'cart' ? (
          <CartPageView
            cart={cart}
            cartStore={cartStore}
            isGuestCustomer={isGuestCustomer}
            appliedCoupon={appliedCoupon}
            onApplyCoupon={handleApplyCouponCode}
            onRemoveCoupon={() => setAppliedCoupon(null)}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onClearCart={() => {
              setCart([]);
              setAppliedCoupon(null);
            }}
            onBackToShopping={() => {
              if (cart.length > 0 && selectedStoreId === cart[0].storeId) {
                setActiveView('store_menu');
              } else {
                setActiveView('stores');
              }
            }}
            onProceedToCheckout={() => {
              setActiveView('checkout');
              window.scrollTo(0, 0);
            }}
            onSignInWithGoogleForCheckout={handleSignInWithGoogleForCheckout}
            onOpenLoginScreenForCheckout={handleOpenLoginScreenForCheckout}
          />
        ) : activeView === 'checkout' ? (
          <CheckoutPageView
            cart={cart}
            cartStore={cartStore}
            isGuestCustomer={isGuestCustomer}
            defaultCustomerName={userProfile?.name || user?.displayName || ''}
            userProfile={userProfile}
            appliedCoupon={appliedCoupon}
            edkoZones={edkoZones}
            paymentMethodsConfig={maintenanceConfig.paymentMethods}
            activeSharedCart={
              activeSharedCart &&
              cart[0] &&
              activeSharedCart.storeId === cart[0].storeId
                ? activeSharedCart
                : null
            }
            onBackToCart={() => setActiveView('cart')}
            onOpenWalletTopup={() => {
              setAccountInitialSection('wallet');
              setActiveView('account');
              window.scrollTo(0, 0);
            }}
            onConfirmOrder={handleConfirmOrder}
            onSignInWithGoogleForCheckout={handleSignInWithGoogleForCheckout}
            onEmailAuthForCheckout={handleInlineEmailAuthForCheckout}
            onOpenLoginScreenForCheckout={handleOpenLoginScreenForCheckout}
          />
        ) : activeView === 'tracking' ? (
          <OrderTrackingView
            order={trackedOrder}
            store={trackedOrderStore}
            justPlacedSuccess={
              Boolean(justPlacedOrderId) &&
              justPlacedOrderId === trackedOrder?.id
            }
            existingReview={
              trackedOrder
                ? customerReviewsByOrderId[trackedOrder.id] ?? null
                : null
            }
            onOpenReviewModal={(ord) => setReviewModalOrder(ord)}
            onApprovePharmacyQuote={handleApprovePharmacyQuoteByCustomer}
            onApproveErrandQuote={handleApproveErrandQuoteByCustomer}
            onConfirmPendingOrder={handleConfirmPendingOrder}
            onCancelOrder={handleCancelOrder}
            onNavigateToOrders={() => {
              setJustPlacedOrderId(null);
              setActiveView('orders');
            }}
            onNavigateToStores={() => {
              setJustPlacedOrderId(null);
              setActiveView('stores');
            }}
          />
        ) : activeView === 'orders' ? (
          <CustomerOrders
            onTrackOrder={(orderId) => {
              setTrackedOrderId(orderId);
              setJustPlacedOrderId(null);
              setActiveView('tracking');
              window.scrollTo(0, 0);
            }}
            onConfirmPendingOrder={handleConfirmPendingOrder}
            onExploreStores={() => setActiveView('stores')}
            onReorder={(order) => {
              if (order.items && order.items.length > 0) {
                const reorderItems: CartItem[] = order.items.map((it) => ({
                  storeId: order.storeId,
                  storeName: order.storeName,
                  deliveryFee: order.deliveryFee,
                  item: {
                    id: it.productId || 'item_' + Math.random().toString(36).slice(2, 7),
                    name: it.name,
                    description: '',
                    price: it.price,
                    category: 'مشويات ومطاعم',
                    isAvailable: true,
                  },
                  quantity: it.quantity,
                }));
                setCart(reorderItems);
                setActiveView('cart');
                toast.success('تمت إضافة أصناف الطلب إلى سلتك 🛒');
              }
            }}
          />
        ) : (
          <StoresView
            stores={activeCustomerStores}
            dynamicCategories={superAppCategories}
            isLoadingStores={isLoadingStores}
            storesError={storesError}
            cart={cart}
            userName={userProfile?.name || user?.displayName || undefined}
            ads={activeAds}
            isLoadingAds={isLoadingAds}
            activeCampaigns={activeCampaigns}
            mysteryBoxProducts={mysteryBoxProducts}
            trendingProducts={allAvailableProducts}
            liveEvents={liveEvents}
            customerTotalSpent={customerTotalSpent}
            favoriteStoreIds={userProfile?.favoriteStoreIds ?? []}
            onToggleFavoriteStore={(sid) => {
              void handleToggleFavoriteStore(sid);
            }}
            onOpenStoreMenu={handleOpenStoreMenu}
            onAddMysteryBoxToCart={handleAddMysteryBoxToCart}
            onOpenVisualSearch={() => setIsVisualSearchOpen(true)}
            onOpenErrandService={() => setIsErrandModalOpen(true)}
            onOpenAiChat={() => setAiChatOpenTrigger((n) => n + 1)}
          />
        )}
      </main>

      {showFloatingCart && (
        <FloatingCartBar
          cart={cart}
          onOpenCart={() => {
            setActiveView('cart');
            window.scrollTo(0, 0);
          }}
        />
      )}

      {showMobileBottomNav && (
        <CustomerBottomNav
          activeTab={activeBottomTab}
          cartCount={cartItemCount}
          activeOrdersCount={activeCustomerOrdersCount}
          onSelectTab={(tab) => {
            setJustPlacedOrderId(null);
            if (tab === 'stores') setActiveView('stores');
            else if (tab === 'cart') setActiveView('cart');
            else if (tab === 'orders') setActiveView('orders');
            else if (tab === 'account') {
              setAccountInitialSection('addresses');
              setActiveView('account');
            }
            window.scrollTo(0, 0);
          }}
        />
      )}

      {/* Smart Edkawy AI Assistant Widget for Customers (Includes AI Meal Planner) */}
      {isCustomerPortal &&
        activeView !== 'cart' &&
        activeView !== 'checkout' && (
          <EdkawyAiChatWidget
            userUid={user?.uid}
            customerName={userProfile?.name || user?.displayName || undefined}
            points={userProfile?.points ?? 0}
            currentStreak={userProfile?.currentStreak ?? 0}
            hasFloatingCart={showFloatingCart}
            openTrigger={aiChatOpenTrigger}
            stores={activeCustomerStores}
            products={allAvailableProducts}
            activeCampaigns={activeCampaigns}
            onSelectStore={handleOpenStoreMenu}
            onAddMealItemToCart={(st, item) => {
              handleAddToCart(st, item);
              showNotice(`تمت إضافة "${item.name}" من "${st.name}" إلى السلة!`);
            }}
          />
        )}

      {/* Exclusive Feature 2: Visual Dish Search Modal (البحث بالصور 📷) */}
      {isCustomerPortal && (
        <VisualSearchModal
          isOpen={isVisualSearchOpen}
          onClose={() => setIsVisualSearchOpen(false)}
          products={allAvailableProducts}
          stores={activeCustomerStores}
          onAddMatchedProductToCart={(st, item) => {
            handleAddToCart(st, item);
            showNotice(`تمت إضافة "${item.name}" من "${st.name}" إلى السلة!`);
          }}
          onOpenStore={handleOpenStoreMenu}
        />
      )}

      {/* Exclusive Feature 3: Custom Errand Service Modal (خدمة المشاوير) */}
      {isCustomerPortal && (
        <ErrandServiceModal
          isOpen={isErrandModalOpen}
          onClose={() => setIsErrandModalOpen(false)}
          defaultCustomerName={userProfile?.name || user?.displayName || ''}
          defaultCustomerPhone={userProfile?.phone || ''}
          defaultNeighborhood={userProfile?.defaultNeighborhood || 'شارع البحر'}
          defaultAddress={userProfile?.defaultAddress || ''}
          defaultLat={userProfile?.defaultLat}
          defaultLng={userProfile?.defaultLng}
          isAnonymous={isGuestCustomer}
          onRequireLogin={() => {
            void handleOpenLoginScreenForCheckout();
          }}
          onSubmitErrand={handlePlaceCustomErrand}
        />
      )}

      {/* Official Edkawy Legal Center Modal */}
      <LegalPagesModal
        isOpen={legalModalState.isOpen}
        initialSection={legalModalState.section}
        onClose={() =>
          setLegalModalState((prev) => ({ ...prev, isOpen: false }))
        }
      />

      {/* Real-Time Notifications Drawer (Orders + Internal Admin Broadcasts) */}
      <NotificationsDrawer
        isOpen={isNotificationsOpen}
        notifications={notifications}
        onClose={() => setIsNotificationsOpen(false)}
        onMarkRead={(notifId) => {
          setNotifications((prev) =>
            prev.map((n) => (n.id === notifId ? { ...n, isRead: true } : n))
          );
          void markNotificationReadInFirestore(notifId, user?.uid);
        }}
        onMarkAllRead={() => {
          setNotifications((prev) =>
            prev.map((n) => ({ ...n, isRead: true }))
          );
          void markAllNotificationsReadInFirestore(notifications, user?.uid);
        }}
        onSelectOrderNotification={(orderId) => {
          setIsNotificationsOpen(false);
          if (activePortal === 'customer') {
            setTrackedOrderId(orderId);
            setJustPlacedOrderId(null);
            setActiveView('tracking');
            window.scrollTo(0, 0);
          }
        }}
      />

      {/* Google Customer Onboarding Modal ("إكمال الحساب") */}
      <CompleteProfileModal
        isOpen={
          isAuthenticated &&
          activePortal === 'customer' &&
          !isGuestCustomer &&
          showOnboardingModal
        }
        initialName={userProfile?.name || user?.displayName || ''}
        userEmail={user?.email || ''}
        onSubmit={handleCompleteOnboardingSubmit}
        onSkipForNow={() => {
          setOnboardingSkippedSession(true);
          setShowOnboardingModal(false);
        }}
      />

      {/* Post-Delivery 5-Star Store & Courier Review Modal */}
      <OrderReviewModal
        order={reviewModalOrder}
        customerDefaultName={
          userProfile?.name || user?.displayName || 'عميل إدكاوي'
        }
        onClose={() => setReviewModalOrder(null)}
        onSubmitReview={handleSubmitOrderReview}
      />

      {/* Daily Fortune Spin Wheel Modal (عجلة الحظ اليومية) */}
      {user && !isGuestCustomer && (
        <DailySpinWheelModal
          isOpen={isDailySpinOpen}
          onClose={() => setIsDailySpinOpen(false)}
          currentUserUid={user.uid}
          userPoints={userProfile?.loyaltyPoints ?? 0}
          onNotify={showNotice}
        />
      )}

      {/* Google Play Store In-App Review Prompt Modal */}
      <GooglePlayReviewPromptModal
        isOpen={isPlayReviewOpen}
        onClose={() => setIsPlayReviewOpen(false)}
        customerName={userProfile?.name || user?.displayName || 'عميل إدكاوي'}
      />

      {activePortal === 'admin' && (
        <AddStoreModal
          isOpen={isAddStoreOpen}
          onClose={() => setIsAddStoreOpen(false)}
          onCreateStoreByAdmin={handleCreateStoreByAdmin}
        />
      )}

      {!isFullBleedDashboard && (
        <footer
          className={`bg-[#1E293B] border-t border-[#334155] mt-12 ${
            hasBottomBar ? 'pb-24' : ''
          }`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-4 text-xs text-[#94A3B8]">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="font-semibold text-[#F8FAFC] text-center sm:text-right">
                إدكاوي (EDKAWY) — منظومة التوصيل الذكية للمطاعم والمتاجر والصيدليات في مدينة إدكو.
              </p>
              <p className="text-[#94A3B8]">
                مدينة إدكو · محافظة البحيرة
              </p>
            </div>

            <div className="pt-3 border-t border-[#334155] flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-2 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => handleOpenLegalModal('terms')}
                className="hover:text-[#FF6B00] cursor-pointer"
              >
                الشروط والأحكام
              </button>
              <button
                type="button"
                onClick={() => handleOpenLegalModal('privacy')}
                className="hover:text-[#FF6B00] cursor-pointer"
              >
                سياسة الخصوصية وموقع GPS
              </button>
              <button
                type="button"
                onClick={() => handleOpenLegalModal('refund')}
                className="hover:text-[#FF6B00] cursor-pointer"
              >
                سياسة الاسترجاع والدفع
              </button>
              <button
                type="button"
                onClick={() => handleOpenLegalModal('pharmacy')}
                className="hover:text-[#FF6B00] cursor-pointer"
              >
                إخلاء مسؤولية الصيدليات
              </button>
              <button
                type="button"
                onClick={() => handleOpenLegalModal('partners')}
                className="hover:text-[#FF6B00] cursor-pointer"
              >
                اتفاقية المتاجر والمناديب والحظر
              </button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <OptionalMapsProvider>
        <EdkawiWorkspace />
      </OptionalMapsProvider>
    </ErrorBoundary>
  );
}
