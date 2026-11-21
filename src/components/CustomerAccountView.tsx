import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Award,
  Check,
  ChevronLeft,
  Coins,
  Copy,
  ExternalLink,
  Flame,
  Gift,
  Headphones,
  Heart,
  Loader2,
  LocateFixed,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Receipt,
  Scale,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Star,
  Store,
  Trash2,
  User as UserIcon,
  Wallet,
} from 'lucide-react';
import {
  EDKU_CITY_CENTER,
  isWithinEdkuServiceBounds,
  resolveEdkuCoordsForNeighborhood,
  resolveNearestEdkuNeighborhood,
} from '../data/edkuSeedStores';
import {
  LegalSectionKey,
  SavedAddressItem,
  StoreRecord,
  UserProfileRecord,
  WalletTopupMethod,
  WalletTopupRequestRecord,
  WalletTransactionRecord,
} from '../types/edkawi';
import {
  EDKU_NEIGHBORHOODS,
  formatAppErrorMessage,
  GOOGLE_PLAY_STORE_URL,
  isEdkuWaterCoordinate,
  isStoreCurrentlyOpen,
} from '../utils/orderLogic';
import { APP_VERSION, VERSION_INFO } from '../utils/version';
import { ConfirmActionModal } from './ConfirmActionModal';
import { DeviceImageInput } from './DeviceImageInput';
import { EdkuLocationPickerMap } from './EdkuGoogleMaps';
import { EmptyState } from './EmptyState';
import { ResilientImage } from './ResilientImage';
import { CustomerSupportSection } from './SupportSystemViews';
import {
  buildSalesAgentReferralUrl,
  createWalletTopupRequestInFirestore,
  deleteCurrentAccountCompletely,
  requestUserEmailVerificationOtp,
  reverseGeocodeCoordinates,
  sendFirebaseFallbackVerificationLink,
  verifyUserEmailVerificationOtp,
} from '../services/edkawiFirebaseService';

interface CustomerAccountViewProps {
  userUid: string;
  userEmail: string;
  userDisplayName: string;
  emailVerified?: boolean;
  isAnonymous: boolean;
  userProfile: UserProfileRecord | null;
  stores: StoreRecord[];
  walletTopups?: WalletTopupRequestRecord[];
  walletTransactions?: WalletTransactionRecord[];
  onUpdateProfileDetails: (patch: {
    name?: string;
    phone?: string;
    defaultNeighborhood?: string;
    defaultAddress?: string;
    defaultLat?: number;
    defaultLng?: number;
    savedAddresses?: SavedAddressItem[];
  }) => Promise<void>;
  onRedeemPoints: () => Promise<string>;
  onToggleFavoriteStore: (storeId: string) => Promise<void>;
  onSelectStore: (store: StoreRecord) => void;
  onOpenAuthModal: () => void;
  onOpenLegalModal?: (section?: LegalSectionKey) => void;
  onOpenDailySpin?: () => void;
  initialSection?: AccountSection;
  onNavigateToJoin?: () => void;
  onNavigateToAds?: () => void;
  activeOrdersCount?: number;
  onSignOut: () => void;
}

export type AccountSection =
  | 'wallet'
  | 'addresses'
  | 'favorites'
  | 'support'
  | 'profile'
  | 'ads'
  | 'privacy';

export const CustomerAccountView: React.FC<CustomerAccountViewProps> = ({
  userUid,
  userEmail,
  userDisplayName,
  emailVerified = false,
  isAnonymous,
  userProfile,
  stores,
  walletTopups = [],
  walletTransactions = [],
  onUpdateProfileDetails,
  onRedeemPoints,
  onToggleFavoriteStore,
  onSelectStore,
  onOpenAuthModal,
  onOpenLegalModal,
  onOpenDailySpin,
  initialSection,
  onNavigateToJoin,
  onNavigateToAds,
  activeOrdersCount = 0,
  onSignOut,
}) => {
  const [activeSection, setActiveSection] = useState<AccountSection>(
    initialSection ?? 'addresses'
  );
  const sectionContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection]);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [newAddrLabel, setNewAddrLabel] = useState('المنزل');
  const [newAddrNeighborhood, setNewAddrNeighborhood] = useState<string>(
    EDKU_NEIGHBORHOODS[0]
  );
  const [newAddrLat, setNewAddrLat] = useState<number>(EDKU_CITY_CENTER.lat);
  const [newAddrLng, setNewAddrLng] = useState<number>(EDKU_CITY_CENTER.lng);
  const [newAddrWaterPin, setNewAddrWaterPin] = useState(false);
  const [newAddrText, setNewAddrText] = useState('');
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [locatingGps, setLocatingGps] = useState(false);
  const [gpsStatusMsg, setGpsStatusMsg] = useState<{
    type: 'ok' | 'warn';
    text: string;
  } | null>(null);

  const [isSignOutConfirmOpen, setIsSignOutConfirmOpen] = useState(false);
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] =
    useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const [topupMethod, setTopupMethod] = useState<WalletTopupMethod>('vodafone_cash');
  const [topupAmount, setTopupAmount] = useState('100');
  const [topupSenderPhone, setTopupSenderPhone] = useState('');
  const [topupReference, setTopupReference] = useState('');
  const [topupReceiptImage, setTopupReceiptImage] = useState('');
  const [isSubmittingTopup, setIsSubmittingTopup] = useState(false);
  const [copiedReferralLink, setCopiedReferralLink] = useState(false);

  const [isRedeemingPoints, setIsRedeemingPoints] = useState(false);
  const [redeemedCouponCode, setRedeemedCouponCode] = useState<string | null>(
    null
  );
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedCustomerCode, setCopiedCustomerCode] = useState(false);

  const [feedbackMsg, setFeedbackMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [showEmailOtpPanel, setShowEmailOtpPanel] = useState(false);
  const [emailOtpCode, setEmailOtpCode] = useState('');
  const [emailOtpBusy, setEmailOtpBusy] = useState<
    'request' | 'verify' | 'link' | null
  >(null);
  const [localOtpVerified, setLocalOtpVerified] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !userEmail.trim()) return false;
    try {
      return (
        window.localStorage.getItem(
          `edkawy_email_verified_${userEmail.trim().toLowerCase()}`
        ) === '1'
      );
    } catch {
      return false;
    }
  });

  const resolvedName =
    userProfile?.name?.trim() || userDisplayName.trim() || 'عميل إدكاوي';
  const resolvedEmail =
    userProfile?.email?.trim() || userEmail.trim() || 'غير مسجل ببريد إلكتروني';
  const resolvedPhone =
    userProfile?.phone?.trim() || 'لم يتم إضافة رقم الموبايل بعد';
  const resolvedCustomerCode = userProfile?.customerCode?.trim() || '';
  const isCustomerBanned = Boolean(userProfile?.isBanned);
  const isEmailConfirmed = emailVerified || localOtpVerified;

  const currentPoints = Math.max(0, Math.trunc(userProfile?.points ?? 0));
  const currentStreak = Math.min(
    5,
    Math.max(0, Math.trunc(userProfile?.currentStreak ?? 0))
  );
  const freeDeliveryRewards = Math.max(
    0,
    Math.trunc(userProfile?.freeDeliveryRewards ?? 0)
  );

  useEffect(() => {
    setEditName(userProfile?.name || userDisplayName || '');
    setEditPhone(userProfile?.phone || '');
  }, [userProfile?.name, userProfile?.phone, userDisplayName]);

  const savedAddresses: SavedAddressItem[] = userProfile?.savedAddresses?.length
    ? userProfile.savedAddresses
    : userProfile?.defaultAddress
      ? [
          {
            id: 'addr_default',
            label: 'العنوان الافتراضي',
            neighborhood:
              userProfile.defaultNeighborhood || EDKU_NEIGHBORHOODS[0],
            address: userProfile.defaultAddress,
            lat: userProfile.defaultLat,
            lng: userProfile.defaultLng,
            isDefault: true,
          },
        ]
      : [];

  const favoriteIds = userProfile?.favoriteStoreIds ?? [];
  const favoriteStores = stores.filter((s) => favoriteIds.includes(s.id));

  const switchSectionAndScroll = (section: AccountSection) => {
    setActiveSection(section);
    window.setTimeout(() => {
      sectionContainerRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 60);
  };

  const handleSaveBasicInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMsg(null);
    setIsSavingProfile(true);
    try {
      await onUpdateProfileDetails({
        name: editName.trim(),
        phone: editPhone.trim(),
      });
      setIsEditingProfile(false);
      setFeedbackMsg({
        type: 'success',
        text: 'تم تحديث بيانات حسابك بنجاح.',
      });
    } catch (err) {
      setFeedbackMsg({
        type: 'error',
        text: formatAppErrorMessage(err, 'تعذر حفظ بيانات الحساب.'),
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleRedeemPointsClick = async () => {
    setFeedbackMsg(null);
    setIsRedeemingPoints(true);
    try {
      const code = await onRedeemPoints();
      setRedeemedCouponCode(code);
      setFeedbackMsg({
        type: 'success',
        text: `مبروك! تم استبدال ١٠٠ نقطة بقسيمة خصم ٢٥٪ كود: ${code}`,
      });
    } catch (err) {
      setFeedbackMsg({
        type: 'error',
        text: formatAppErrorMessage(err, 'تعذر استبدال النقاط حالياً.'),
      });
    } finally {
      setIsRedeemingPoints(false);
    }
  };

  const handleUseCurrentGps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatusMsg({
        type: 'warn',
        text: 'متصفحك لا يدعم تحديد الموقع التلقائي، اكتب عنوانك واختر الحي يدوياً.',
      });
      return;
    }

    setLocatingGps(true);
    setGpsStatusMsg(null);

    const onSuccess = async (pos: GeolocationPosition) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      if (!isWithinEdkuServiceBounds(lat, lng)) {
        setLocatingGps(false);
        setGpsStatusMsg({
          type: 'warn',
          text: 'موقعك الحالي خارج نطاق مدينة إدكو — اختر الحي واكتب عنوان التوصيل داخل إدكو.',
        });
        return;
      }
      if (isEdkuWaterCoordinate(lat, lng)) {
        setLocatingGps(false);
        setNewAddrWaterPin(true);
        setGpsStatusMsg({
          type: 'warn',
          text: 'الإحداثيات تشير لمسطح مائي — يرجى التحقق من العنوان يدوياً.',
        });
        return;
      }

      setNewAddrWaterPin(false);
      setNewAddrLat(lat);
      setNewAddrLng(lng);
      const nearestArea = resolveNearestEdkuNeighborhood(lat, lng);
      setNewAddrNeighborhood(nearestArea);

      let finalArea = nearestArea;
      try {
        const resolved = await reverseGeocodeCoordinates(lat, lng);
        if (resolved.isWaterBody) {
          setNewAddrWaterPin(true);
          setLocatingGps(false);
          setGpsStatusMsg({
            type: 'warn',
            text: 'الإحداثيات تشير لمسطح مائي — يرجى التحقق من العنوان يدوياً.',
          });
          return;
        }
        if (resolved.matchedNeighborhood) {
          finalArea = resolved.matchedNeighborhood;
          setNewAddrNeighborhood(resolved.matchedNeighborhood);
        }
        const bestText = (resolved.shortAddress || resolved.formattedAddress || '').trim();
        if (resolved.ok && bestText && !newAddrText.trim()) {
          setNewAddrText(bestText);
        }
      } catch {
        // Ignore reverse geocode failure cleanly
      } finally {
        setLocatingGps(false);
        setGpsStatusMsg({
          type: 'ok',
          text: `تم التقاط موقعك بنجاح في نطاق «${finalArea}».`,
        });
      }
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void onSuccess(pos);
      },
      (err) => {
        if (err.code === 1) {
          setLocatingGps(false);
          setGpsStatusMsg({
            type: 'warn',
            text: 'تم رفض إذن الموقع من المتصفح — اسمح بالوصول للموقع أو اكتب العنوان يدوياً.',
          });
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (fallbackPos) => {
            void onSuccess(fallbackPos);
          },
          () => {
            setLocatingGps(false);
            setGpsStatusMsg({
              type: 'warn',
              text: 'تعذر التقاط إشارة GPS حالياً — اكتب العنوان واختر الحي يدوياً.',
            });
          },
          { enableHighAccuracy: false, timeout: 9000, maximumAge: 30000 }
        );
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 }
    );
  };

  const handleStartEditAddress = (addr: SavedAddressItem) => {
    setEditingAddressId(addr.id);
    setNewAddrLabel(addr.label || 'المنزل');
    setNewAddrNeighborhood(addr.neighborhood || EDKU_NEIGHBORHOODS[0]);
    const fallbackCoords = resolveEdkuCoordsForNeighborhood(
      addr.neighborhood || EDKU_NEIGHBORHOODS[0]
    );
    setNewAddrLat(typeof addr.lat === 'number' ? addr.lat : fallbackCoords.lat);
    setNewAddrLng(typeof addr.lng === 'number' ? addr.lng : fallbackCoords.lng);
    setNewAddrText(addr.address || '');
    setNewAddrWaterPin(false);
    setGpsStatusMsg(null);
  };

  const handleCancelEditAddress = () => {
    setEditingAddressId(null);
    setNewAddrLabel('المنزل');
    setNewAddrNeighborhood(EDKU_NEIGHBORHOODS[0]);
    setNewAddrLat(EDKU_CITY_CENTER.lat);
    setNewAddrLng(EDKU_CITY_CENTER.lng);
    setNewAddrText('');
    setNewAddrWaterPin(false);
    setGpsStatusMsg(null);
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMsg(null);
    if (newAddrWaterPin) {
      setFeedbackMsg({
        type: 'error',
        text: 'من فضلك اختر موقعاً على اليابسة داخل إدكو لحساب التوصيل بشكل صحيح.',
      });
      return;
    }
    const landmark = newAddrText.trim();
    if (landmark.length < 5) {
      setFeedbackMsg({
        type: 'error',
        text: 'يرجى كتابة العنوان أو علامة مميزة (٥ أحرف على الأقل).',
      });
      return;
    }
    setIsAddingAddress(true);
    try {
      if (editingAddressId) {
        const nextList = savedAddresses.map((item) =>
          item.id === editingAddressId
            ? {
                ...item,
                label: newAddrLabel.trim() || item.label || 'عنواني',
                neighborhood: newAddrNeighborhood,
                address: landmark,
                lat: newAddrLat,
                lng: newAddrLng,
              }
            : item
        );
        const editedDefault = nextList.find(
          (item) => item.id === editingAddressId && item.isDefault
        );
        await onUpdateProfileDetails({
          savedAddresses: nextList,
          ...(editedDefault
            ? {
                defaultNeighborhood: editedDefault.neighborhood,
                defaultAddress: editedDefault.address,
                defaultLat: editedDefault.lat,
                defaultLng: editedDefault.lng,
              }
            : {}),
        });
        handleCancelEditAddress();
        setFeedbackMsg({
          type: 'success',
          text: 'تم تحديث بيانات العنوان بنجاح.',
        });
      } else {
        const isFirst = savedAddresses.length === 0;
        const newItem: SavedAddressItem = {
          id: `addr_${Date.now()}`,
          label: newAddrLabel.trim() || 'عنواني',
          neighborhood: newAddrNeighborhood,
          address: landmark,
          lat: newAddrLat,
          lng: newAddrLng,
          isDefault: isFirst,
        };
        const nextList = [...savedAddresses, newItem];
        await onUpdateProfileDetails({
          savedAddresses: nextList,
          ...(isFirst
            ? {
                defaultNeighborhood: newItem.neighborhood,
                defaultAddress: newItem.address,
                defaultLat: newItem.lat,
                defaultLng: newItem.lng,
              }
            : {}),
        });
        setNewAddrText('');
        setGpsStatusMsg(null);
        setFeedbackMsg({
          type: 'success',
          text: 'تم حفظ العنوان الجديد في حسابك بنجاح.',
        });
      }
    } catch (err) {
      setFeedbackMsg({
        type: 'error',
        text: formatAppErrorMessage(err, 'تعذر حفظ العنوان الجديد.'),
      });
    } finally {
      setIsAddingAddress(false);
    }
  };

  const handleSubmitWalletTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMsg(null);
    setIsSubmittingTopup(true);
    try {
      await createWalletTopupRequestInFirestore(
        userUid,
        {
          name: resolvedName,
          phone: userProfile?.phone || '',
        },
        {
          amount: Number(topupAmount),
          method: topupMethod,
          senderPhone: topupSenderPhone,
          referenceNumber: topupReference,
          receiptImageUrl: topupReceiptImage || undefined,
        }
      );
      setTopupSenderPhone('');
      setTopupReference('');
      setTopupReceiptImage('');
      setFeedbackMsg({
        type: 'success',
        text: 'تم إرسال طلب شحن المحفظة بنجاح، وسيتم اعتماد الرصيد فور مراجعة الإدارة.',
      });
    } catch (err) {
      setFeedbackMsg({
        type: 'error',
        text: formatAppErrorMessage(err, 'تعذر إرسال طلب شحن المحفظة حالياً.'),
      });
    } finally {
      setIsSubmittingTopup(false);
    }
  };

  const handleSetDefaultAddress = async (addr: SavedAddressItem) => {
    setFeedbackMsg(null);
    try {
      const nextList = savedAddresses.map((item) => ({
        ...item,
        isDefault: item.id === addr.id,
      }));
      await onUpdateProfileDetails({
        defaultNeighborhood: addr.neighborhood,
        defaultAddress: addr.address,
        defaultLat: addr.lat,
        defaultLng: addr.lng,
        savedAddresses: nextList,
      });
      setFeedbackMsg({
        type: 'success',
        text: `تم تعيين "${addr.label}" كعنوان افتراضي للتوصيل.`,
      });
    } catch (err) {
      setFeedbackMsg({
        type: 'error',
        text: formatAppErrorMessage(err, 'تعذر تحديث العنوان الافتراضي.'),
      });
    }
  };

  const handleDeleteAddress = async (addrId: string) => {
    setFeedbackMsg(null);
    try {
      const filtered = savedAddresses.filter((item) => item.id !== addrId);
      if (filtered.length > 0 && !filtered.some((a) => a.isDefault)) {
        filtered[0] = { ...filtered[0], isDefault: true };
      }
      const nextDefault = filtered.find((a) => a.isDefault);
      await onUpdateProfileDetails({
        savedAddresses: filtered,
        ...(nextDefault
          ? {
              defaultNeighborhood: nextDefault.neighborhood,
              defaultAddress: nextDefault.address,
              defaultLat: nextDefault.lat,
              defaultLng: nextDefault.lng,
            }
          : {}),
      });
    } catch (err) {
      setFeedbackMsg({
        type: 'error',
        text: formatAppErrorMessage(err, 'تعذر حذف العنوان.'),
      });
    }
  };

  const handleTriggerDeleteModal = () => {
    if (activeOrdersCount > 0) {
      setFeedbackMsg({
        type: 'error',
        text: `لا يمكن حذف الحساب لوجود ${activeOrdersCount} طلب قيد التنفيذ والتوصيل حالياً. يرجى انتظار استلام جميع طلباتك أولاً.`,
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setIsDeleteAccountModalOpen(true);
  };

  if (isAnonymous) {
    return (
      <div
        dir="rtl"
        className="max-w-3xl mx-auto p-6 pb-28 edkawi-page-enter space-y-6"
      >
        <div className="rounded-2xl bg-[#1E293B] border border-[#334155] p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#FF6B00]/15 text-[#FF6B00] flex items-center justify-center mx-auto">
            <UserIcon className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-[#F8FAFC]">حسابي في إدكاوي</h1>
          <p className="text-base text-[#94A3B8] max-w-md mx-auto leading-relaxed">
            سجّل الدخول بحسابك أو عبر Google لحفظ عناوين التوصيل، تجميع نقاط المكافآت، ومتابعة طلباتك لحظة بلحظة.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="min-h-[48px] px-6 py-2.5 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-base font-bold cursor-pointer"
            >
              تسجيل الدخول أو إنشاء حساب
            </button>
            {onOpenLegalModal && (
              <button
                type="button"
                onClick={() => onOpenLegalModal('privacy')}
                className="min-h-[48px] px-5 py-2.5 rounded-2xl border border-[#334155] bg-[#0F172A] text-[#F8FAFC] text-sm font-bold flex items-center gap-2 cursor-pointer"
              >
                <Scale className="w-4 h-4 text-[#FF6B00]" />
                <span>الخصوصية والشروط</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className="max-w-3xl mx-auto p-6 pb-28 space-y-6 edkawi-page-enter"
    >
      {/* Feedback Banner */}
      {feedbackMsg && (
        <div
          role="status"
          className={`rounded-2xl px-4 py-3.5 text-sm font-semibold border ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
              : 'bg-red-950/50 border-red-500/40 text-red-200'
          }`}
        >
          {feedbackMsg.text}
        </div>
      )}

      {/* Banned Account Banner */}
      {isCustomerBanned && (
        <div
          role="alert"
          className="rounded-2xl border border-red-500/40 bg-red-950/50 p-5 flex flex-wrap items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-600/20 text-red-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-bold text-red-100">
                حسابك محظور، تواصل مع الدعم
              </p>
              <p className="text-xs sm:text-sm text-red-200/90">
                تم إيقاف إمكانية إرسال طلبات جديدة على هذا الحساب مؤقتاً. يرجى التواصل مع فريق دعم إدكاوي.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => switchSectionAndScroll('support')}
            className="min-h-[44px] px-4 py-2 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold inline-flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Headphones className="w-4 h-4" />
            <span>التواصل مع الدعم</span>
          </button>
        </div>
      )}

      {/* 1. Sleek Top Card: Avatar + Name + Phone + Customer Code */}
      <section className="rounded-2xl bg-[#1E293B] border border-[#334155] p-6 space-y-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-16 h-16 rounded-2xl bg-[#FF6B00] text-white flex items-center justify-center text-2xl font-bold shrink-0 shadow-md">
              {resolvedName.slice(0, 1)}
            </div>
            <div className="min-w-0 space-y-1">
              <h1 className="text-2xl font-bold text-[#F8FAFC] truncate">
                {resolvedName}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#94A3B8]">
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  <Phone className="w-4 h-4 text-[#FF6B00]" />
                  {resolvedPhone}
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5 truncate">
                  <Mail className="w-4 h-4 text-[#FF6B00]" />
                  {resolvedEmail}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsEditingProfile((prev) => !prev)}
            className="min-h-[44px] px-4 py-2 rounded-2xl border border-[#334155] bg-[#0F172A] hover:border-[#FF6B00] text-sm font-bold text-[#F8FAFC] inline-flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Pencil className="w-4 h-4 text-[#FF6B00]" />
            <span>{isEditingProfile ? 'إلغاء' : 'تعديل'}</span>
          </button>
        </div>

        {/* Customer Code Bar */}
        <div className="pt-4 border-t border-[#334155] flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-[#94A3B8]">كود العميل</p>
            <span
              dir="ltr"
              className="font-mono text-xl font-bold tracking-wider tabular-nums text-[#FF6B00]"
            >
              {resolvedCustomerCode || 'جارٍ التوليد...'}
            </span>
          </div>

          <button
            type="button"
            disabled={!resolvedCustomerCode}
            onClick={() => {
              if (!resolvedCustomerCode) return;
              void navigator.clipboard?.writeText(resolvedCustomerCode);
              setCopiedCustomerCode(true);
              window.setTimeout(() => setCopiedCustomerCode(false), 2200);
            }}
            className="min-h-[42px] px-4 py-2 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-50 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer shrink-0"
          >
            {copiedCustomerCode ? (
              <>
                <Check className="w-4 h-4" />
                <span>تم النسخ</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>نسخ الكود</span>
              </>
            )}
          </button>
        </div>

        {isEditingProfile && (
          <form
            onSubmit={handleSaveBasicInfo}
            className="pt-4 border-t border-[#334155] grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            <div>
              <label className="block text-xs font-bold text-[#F8FAFC] mb-1.5">
                الاسم بالكامل
              </label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="مثال: أحمد محمد"
                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-2xl border border-[#334155] bg-[#0F172A] text-sm text-[#F8FAFC]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#F8FAFC] mb-1.5">
                رقم الموبايل (١١ رقماً)
              </label>
              <input
                type="tel"
                required
                dir="ltr"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="01012345678"
                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-2xl border border-[#334155] bg-[#0F172A] text-sm text-right tabular-nums text-[#F8FAFC]"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={isSavingProfile}
                className="min-h-[46px] px-6 py-2.5 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-60 text-white text-base font-bold inline-flex items-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{isSavingProfile ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Optional Non-Blocking Email Verification Strip */}
        {userEmail.includes('@') && !isEmailConfirmed && (
          <div className="pt-4 border-t border-[#334155] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[#94A3B8]">
                يمكنك توثيق بريدك الإلكتروني اختيارياً بكود فوري أو رابط بديل.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={emailOtpBusy !== null}
                  onClick={async () => {
                    setFeedbackMsg(null);
                    setEmailOtpBusy('request');
                    try {
                      await requestUserEmailVerificationOtp(
                        resolvedName,
                        userEmail.trim().toLowerCase()
                      );
                      setShowEmailOtpPanel(true);
                      setFeedbackMsg({
                        type: 'success',
                        text: 'تم إرسال كود التفعيل المكون من ٤ أرقام إلى بريدك الإلكتروني.',
                      });
                    } catch (err) {
                      setFeedbackMsg({
                        type: 'error',
                        text: formatAppErrorMessage(
                          err,
                          'تعذر إرسال كود التفعيل حالياً.'
                        ),
                      });
                    } finally {
                      setEmailOtpBusy(null);
                    }
                  }}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-60 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                >
                  {emailOtpBusy === 'request'
                    ? 'جارٍ الإرسال...'
                    : 'إرسال كود التفعيل'}
                </button>
                <button
                  type="button"
                  disabled={emailOtpBusy !== null}
                  onClick={async () => {
                    setFeedbackMsg(null);
                    setEmailOtpBusy('link');
                    try {
                      await sendFirebaseFallbackVerificationLink();
                      setFeedbackMsg({
                        type: 'success',
                        text: 'تم إرسال رابط التفعيل البديل إلى بريدك الإلكتروني.',
                      });
                    } catch (err) {
                      setFeedbackMsg({
                        type: 'error',
                        text: formatAppErrorMessage(
                          err,
                          'تعذر إرسال رابط التفعيل البديل حالياً.'
                        ),
                      });
                    } finally {
                      setEmailOtpBusy(null);
                    }
                  }}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-2xl border border-[#334155] bg-[#0F172A] text-[#F8FAFC] text-xs font-bold cursor-pointer whitespace-nowrap"
                >
                  {emailOtpBusy === 'link'
                    ? 'جارٍ الإرسال...'
                    : 'إرسال رابط بديل'}
                </button>
              </div>
            </div>

            {showEmailOtpPanel && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setFeedbackMsg(null);
                  setEmailOtpBusy('verify');
                  try {
                    const cleanEmail = userEmail.trim().toLowerCase();
                    await verifyUserEmailVerificationOtp(
                      cleanEmail,
                      emailOtpCode
                    );
                    try {
                      window.localStorage.setItem(
                        `edkawy_email_verified_${cleanEmail}`,
                        '1'
                      );
                    } catch {
                      // Non-fatal
                    }
                    setLocalOtpVerified(true);
                    setShowEmailOtpPanel(false);
                    setFeedbackMsg({
                      type: 'success',
                      text: 'تم توثيق بريدك الإلكتروني بنجاح!',
                    });
                  } catch (err) {
                    setFeedbackMsg({
                      type: 'error',
                      text: formatAppErrorMessage(
                        err,
                        'كود التفعيل غير صحيح أو منتهي الصلاحية.'
                      ),
                    });
                  } finally {
                    setEmailOtpBusy(null);
                  }
                }}
                className="flex flex-wrap items-center gap-2"
              >
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  dir="ltr"
                  value={emailOtpCode}
                  onChange={(e) =>
                    setEmailOtpCode(e.target.value.replace(/\D/g, '').slice(0, 4))
                  }
                  placeholder="أدخل كود ٤ أرقام"
                  className="min-h-[42px] w-44 px-3.5 py-2 rounded-2xl border border-[#334155] bg-[#0F172A] text-sm font-mono text-center tabular-nums text-[#F8FAFC]"
                  required
                />
                <button
                  type="submit"
                  disabled={emailOtpBusy !== null || emailOtpCode.length !== 4}
                  className="min-h-[42px] px-4 py-2 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-60 text-white text-xs font-bold cursor-pointer"
                >
                  {emailOtpBusy === 'verify' ? 'جارٍ التحقق...' : 'تأكيد الكود'}
                </button>
              </form>
            )}
          </div>
        )}
      </section>

      {/* 2. Loyalty Points & Streak 5 Card */}
      <section className="rounded-2xl bg-[#1E293B] border border-[#334155] text-[#F8FAFC] p-6 space-y-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-[#FF6B00]">
              <Award className="w-4 h-4" />
              <span>نقاط ومكافآت إدكاوي</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tabular-nums text-[#F8FAFC]">
                {currentPoints}
              </span>
              <span className="text-sm text-[#94A3B8] font-semibold">
                نقطة متاحة
              </span>
            </div>
            <p className="text-xs text-[#94A3B8]">
              اكسب نقطة مقابل كل ١٠ ج.م في طلباتك، واستبدل ١٠٠ نقطة بقسيمة خصم ٢٥٪.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {onOpenDailySpin && (
              <button
                type="button"
                onClick={onOpenDailySpin}
                className="min-h-[44px] px-4 py-2 rounded-2xl bg-[#0F172A] hover:border-[#FF6B00] border border-[#334155] text-[#F8FAFC] text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <Coins className="w-4 h-4 text-[#FF6B00]" />
                <span>عجلة الحظ</span>
              </button>
            )}

            <button
              type="button"
              disabled={isRedeemingPoints || currentPoints < 100}
              onClick={handleRedeemPointsClick}
              className="min-h-[44px] px-5 py-2 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-45 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Gift className="w-4 h-4" />
              <span>
                {isRedeemingPoints
                  ? 'جارٍ الإصدار...'
                  : currentPoints >= 100
                  ? 'استبدال ١٠٠ نقطة (٢٥٪)'
                  : `متبقي ${100 - currentPoints} نقطة`}
              </span>
            </button>
          </div>
        </div>

        {redeemedCouponCode && (
          <div className="rounded-2xl bg-[#0F172A] border border-[#334155] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-xs text-[#94A3B8]">
                قسيمة الخصم جاهزة للاستخدام عند الطلب:
              </p>
              <p className="text-base font-extrabold tracking-wider text-[#FF6B00] font-mono">
                {redeemedCouponCode}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(redeemedCouponCode).catch(() => {});
                setCopiedCode(true);
                setTimeout(() => setCopiedCode(false), 2000);
              }}
              className="min-h-[38px] px-3.5 py-1.5 rounded-2xl bg-[#FF6B00] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copiedCode ? 'تم النسخ!' : 'نسخ الكود'}</span>
            </button>
          </div>
        )}

        <div className="pt-4 border-t border-[#334155] flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#FF6B00]">
              <Flame className="w-4 h-4" />
              <span>تحدي ٥ طلبات متتالية: {currentStreak} / 5</span>
            </div>
            <p className="text-xs text-[#94A3B8]">
              أكمل ٥ طلبات للحصول على +٥٠ نقطة ومكافأة توصيل.
              {freeDeliveryRewards > 0 && ` (لديك ${freeDeliveryRewards} مكافأة)`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((step) => {
              const completed = step <= currentStreak;
              return (
                <div
                  key={step}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-extrabold tabular-nums border ${
                    completed
                      ? 'bg-[#FF6B00] border-[#FF6B00] text-white'
                      : 'bg-[#0F172A] border-[#334155] text-[#94A3B8]'
                  }`}
                >
                  {completed ? <Check className="w-4 h-4" /> : step}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. Clean Ordered Vertical List (Orange Icon + White Text + ChevronLeft) */}
      <nav aria-label="قائمة خيارات الحساب" className="space-y-4">
        <div className="rounded-2xl bg-[#1E293B] border border-[#334155] divide-y divide-[#334155] overflow-hidden shadow-lg">
          {/* 1. محفظتي والشحن */}
          <button
            type="button"
            onClick={() => switchSectionAndScroll('wallet')}
            className={`w-full min-h-[56px] px-5 py-4 flex items-center justify-between gap-4 transition-colors cursor-pointer ${
              activeSection === 'wallet'
                ? 'bg-[#0F172A]/80'
                : 'hover:bg-[#0F172A]/60'
            }`}
          >
            <span className="inline-flex items-center gap-3 text-base font-bold text-[#F8FAFC]">
              <Wallet className="w-5 h-5 text-[#FF6B00] shrink-0" />
              <span>محفظتي والشحن</span>
            </span>
            <span className="inline-flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-[#FF6B00] tabular-nums">
                {(userProfile?.walletBalance ?? 0).toFixed(0)} ج.م
              </span>
              <ChevronLeft className="w-5 h-5 text-[#94A3B8]" />
            </span>
          </button>

          {/* 2. تعديل البيانات */}
          <button
            type="button"
            onClick={() => {
              setIsEditingProfile(true);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="w-full min-h-[56px] px-5 py-4 flex items-center justify-between gap-4 hover:bg-[#0F172A]/60 transition-colors cursor-pointer"
          >
            <span className="inline-flex items-center gap-3 text-base font-bold text-[#F8FAFC]">
              <Pencil className="w-5 h-5 text-[#FF6B00] shrink-0" />
              <span>تعديل البيانات</span>
            </span>
            <ChevronLeft className="w-5 h-5 text-[#94A3B8] shrink-0" />
          </button>

          {/* 2. عناويني */}
          <button
            type="button"
            onClick={() => switchSectionAndScroll('addresses')}
            className={`w-full min-h-[56px] px-5 py-4 flex items-center justify-between gap-4 transition-colors cursor-pointer ${
              activeSection === 'addresses'
                ? 'bg-[#0F172A]/80'
                : 'hover:bg-[#0F172A]/60'
            }`}
          >
            <span className="inline-flex items-center gap-3 text-base font-bold text-[#F8FAFC]">
              <MapPin className="w-5 h-5 text-[#FF6B00] shrink-0" />
              <span>عناويني</span>
            </span>
            <span className="inline-flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-[#94A3B8] tabular-nums">
                {savedAddresses.length}
              </span>
              <ChevronLeft className="w-5 h-5 text-[#94A3B8]" />
            </span>
          </button>

          {/* 3. المفضلة */}
          <button
            type="button"
            onClick={() => switchSectionAndScroll('favorites')}
            className={`w-full min-h-[56px] px-5 py-4 flex items-center justify-between gap-4 transition-colors cursor-pointer ${
              activeSection === 'favorites'
                ? 'bg-[#0F172A]/80'
                : 'hover:bg-[#0F172A]/60'
            }`}
          >
            <span className="inline-flex items-center gap-3 text-base font-bold text-[#F8FAFC]">
              <Heart className="w-5 h-5 text-[#FF6B00] shrink-0" />
              <span>المفضلة</span>
            </span>
            <span className="inline-flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-[#94A3B8] tabular-nums">
                {favoriteStores.length}
              </span>
              <ChevronLeft className="w-5 h-5 text-[#94A3B8]" />
            </span>
          </button>

          {/* 4. الإعلانات */}
          <button
            type="button"
            onClick={() => {
              if (onNavigateToAds) {
                onNavigateToAds();
              } else {
                window.scrollTo({ top: 300, behavior: 'smooth' });
              }
            }}
            className="w-full min-h-[56px] px-5 py-4 flex items-center justify-between gap-4 hover:bg-[#0F172A]/60 transition-colors cursor-pointer"
          >
            <span className="inline-flex items-center gap-3 text-base font-bold text-[#F8FAFC]">
              <Flame className="w-5 h-5 text-[#FF6B00] shrink-0" />
              <span>الإعلانات</span>
            </span>
            <ChevronLeft className="w-5 h-5 text-[#94A3B8] shrink-0" />
          </button>

          {/* 5. الدعم */}
          <button
            type="button"
            onClick={() => switchSectionAndScroll('support')}
            className={`w-full min-h-[56px] px-5 py-4 flex items-center justify-between gap-4 transition-colors cursor-pointer ${
              activeSection === 'support'
                ? 'bg-[#0F172A]/80'
                : 'hover:bg-[#0F172A]/60'
            }`}
          >
            <span className="inline-flex items-center gap-3 text-base font-bold text-[#F8FAFC]">
              <Headphones className="w-5 h-5 text-[#FF6B00] shrink-0" />
              <span>الدعم</span>
            </span>
            <ChevronLeft className="w-5 h-5 text-[#94A3B8] shrink-0" />
          </button>

          {/* 6. انضمام المتاجر */}
          <button
            type="button"
            onClick={() => {
              if (onNavigateToJoin) {
                onNavigateToJoin();
              } else {
                window.history.pushState({}, '', '/join');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }
            }}
            className="w-full min-h-[56px] px-5 py-4 flex items-center justify-between gap-4 hover:bg-[#0F172A]/60 transition-colors cursor-pointer"
          >
            <span className="inline-flex items-center gap-3 text-base font-bold text-[#F8FAFC]">
              <Store className="w-5 h-5 text-[#FF6B00] shrink-0" />
              <span>انضمام المتاجر</span>
            </span>
            <ChevronLeft className="w-5 h-5 text-[#94A3B8] shrink-0" />
          </button>

          {/* 7. الخصوصية وحذف الحساب */}
          <button
            type="button"
            onClick={() => switchSectionAndScroll('privacy')}
            className={`w-full min-h-[56px] px-5 py-4 flex items-center justify-between gap-4 transition-colors cursor-pointer ${
              activeSection === 'privacy'
                ? 'bg-[#0F172A]/80'
                : 'hover:bg-[#0F172A]/60'
            }`}
          >
            <span className="inline-flex items-center gap-3 text-base font-bold text-[#F8FAFC]">
              <Lock className="w-5 h-5 text-[#FF6B00] shrink-0" />
              <span>الخصوصية وحذف الحساب</span>
            </span>
            <ChevronLeft className="w-5 h-5 text-[#94A3B8] shrink-0" />
          </button>

          {/* 8. تسجيل خروج */}
          <button
            type="button"
            onClick={() => setIsSignOutConfirmOpen(true)}
            className="w-full min-h-[56px] px-5 py-4 flex items-center justify-between gap-4 hover:bg-[#0F172A]/60 transition-colors cursor-pointer"
          >
            <span className="inline-flex items-center gap-3 text-base font-bold text-[#F8FAFC]">
              <LogOut className="w-5 h-5 text-[#FF6B00] shrink-0" />
              <span>تسجيل خروج</span>
            </span>
            <ChevronLeft className="w-5 h-5 text-[#94A3B8] shrink-0" />
          </button>
        </div>

        {/* Separate Muted-Red Delete Account Row */}
        <button
          type="button"
          onClick={handleTriggerDeleteModal}
          className="w-full min-h-[54px] px-5 py-4 rounded-2xl border border-rose-500/35 bg-rose-950/35 hover:bg-rose-950/55 text-rose-300 font-bold flex items-center justify-between gap-4 cursor-pointer transition-colors"
        >
          <span className="inline-flex items-center gap-3 text-base font-bold">
            <Trash2 className="w-5 h-5 text-rose-400 shrink-0" />
            <span>حذف حسابي</span>
          </span>
          <span className="text-xs font-semibold text-rose-400">نهائي</span>
        </button>
      </nav>

      {/* Active Section Content */}
      <div ref={sectionContainerRef}>
        {activeSection === 'wallet' ? (
          <section className="space-y-6">
            {/* Wallet Balance Card */}
            <div className="rounded-2xl bg-[#1E293B] border border-[#334155] p-6 space-y-5 shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-2 text-xs font-bold text-[#FF6B00]">
                    <Wallet className="w-4 h-4" />
                    <span>رصيد محفظة إدكاوي</span>
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-[#F8FAFC] tabular-nums">
                      {(userProfile?.walletBalance ?? 0).toFixed(2)}
                    </span>
                    <span className="text-sm font-bold text-[#94A3B8]">ج.م</span>
                  </div>
                  <p className="text-xs text-[#94A3B8]">
                    استخدم رصيد المحفظة للدفع الفوري عند إتمام الطلبات بدون الحاجة لكاش.
                  </p>
                </div>

                {resolvedCustomerCode && (
                  <div className="rounded-2xl bg-[#0F172A] border border-[#334155] p-4 space-y-2 min-w-[240px]">
                    <p className="text-xs font-bold text-[#F8FAFC] flex items-center gap-1.5">
                      <Share2 className="w-4 h-4 text-[#FF6B00]" />
                      <span>شارك كود الدعوة الخاص بك</span>
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <span dir="ltr" className="font-mono text-sm font-bold text-[#FF6B00]">
                        {resolvedCustomerCode}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const shareUrl = buildSalesAgentReferralUrl(resolvedCustomerCode);
                          const shareText = `اطلب من إدكاوي في مدينة إدكو واستخدم كودي (${resolvedCustomerCode}): ${shareUrl}`;
                          if (navigator.share) {
                            void navigator.share({ title: 'إدكاوي', text: shareText, url: shareUrl }).catch(() => {
                              void navigator.clipboard?.writeText(shareUrl);
                            });
                          } else {
                            void navigator.clipboard?.writeText(shareUrl);
                          }
                          setCopiedReferralLink(true);
                          window.setTimeout(() => setCopiedReferralLink(false), 2200);
                        }}
                        className="min-h-[36px] px-3 py-1.5 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        {copiedReferralLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedReferralLink ? 'تم النسخ' : 'نسخ ومشاركة'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Manual Top-Up Form (Vodafone Cash / InstaPay) */}
            <form
              onSubmit={handleSubmitWalletTopup}
              className="rounded-2xl bg-[#1E293B] border border-[#334155] p-6 space-y-4 shadow-lg"
            >
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-[#F8FAFC] flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-[#FF6B00]" />
                  <span>طلب شحن المحفظة (فودافون كاش / إنستاباي)</span>
                </h2>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  حوّل المبلغ المطلوب عبر فودافون كاش أو إنستاباي ثم سجّل بيانات العملية هنا لاعتماد الرصيد من الإدارة.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    { id: 'vodafone_cash', label: 'فودافون كاش' },
                    { id: 'instapay', label: 'إنستاباي (InstaPay)' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTopupMethod(opt.id)}
                    className={`min-h-[46px] px-4 py-2.5 rounded-2xl border text-xs sm:text-sm font-bold cursor-pointer transition-colors ${
                      topupMethod === opt.id
                        ? 'bg-[#FF6B00] border-[#FF6B00] text-white'
                        : 'bg-[#0F172A] border-[#334155] text-[#F8FAFC] hover:border-[#FF6B00]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#F8FAFC] mb-1.5">
                    مبلغ الشحن (ج.م)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={50000}
                    required
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(e.target.value)}
                    placeholder="100"
                    className="w-full min-h-[46px] px-3.5 py-2.5 rounded-2xl border border-[#334155] bg-[#0F172A] text-sm text-[#F8FAFC] tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#F8FAFC] mb-1.5">
                    {topupMethod === 'instapay'
                      ? 'حساب إنستاباي / الهاتف المُحول منه'
                      : 'رقم المحفظة المُحول منه'}
                  </label>
                  <input
                    type="text"
                    required
                    dir="ltr"
                    value={topupSenderPhone}
                    onChange={(e) => setTopupSenderPhone(e.target.value)}
                    placeholder={topupMethod === 'instapay' ? 'name@instapay' : '01012345678'}
                    className="w-full min-h-[46px] px-3.5 py-2.5 rounded-2xl border border-[#334155] bg-[#0F172A] text-sm text-[#F8FAFC] text-right placeholder:text-[#94A3B8]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#F8FAFC] mb-1.5">
                    رقم العملية المرجعي
                  </label>
                  <input
                    type="text"
                    required
                    dir="ltr"
                    value={topupReference}
                    onChange={(e) => setTopupReference(e.target.value)}
                    placeholder="TXN-984512"
                    className="w-full min-h-[46px] px-3.5 py-2.5 rounded-2xl border border-[#334155] bg-[#0F172A] text-sm text-[#F8FAFC] text-right placeholder:text-[#94A3B8]"
                  />
                </div>
              </div>

              <DeviceImageInput
                label="صورة إيصال التحويل (اختياري)"
                value={topupReceiptImage}
                onChange={setTopupReceiptImage}
                required={false}
                aspectClassName="h-32"
                helperText="أرفق لقطة شاشة لإيصال التحويل لتسريع المراجعة"
              />

              <button
                type="submit"
                disabled={isSubmittingTopup}
                className="w-full min-h-[48px] px-6 py-3 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-60 text-white text-base font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmittingTopup && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{isSubmittingTopup ? 'جارٍ إرسال الطلب...' : 'إرسال طلب الشحن للمراجعة'}</span>
              </button>
            </form>

            {/* Top-Up Requests Status */}
            <div className="rounded-2xl bg-[#1E293B] border border-[#334155] p-6 space-y-4">
              <h3 className="text-lg font-bold text-[#F8FAFC]">طلبات شحن المحفظة</h3>
              {walletTopups.length === 0 ? (
                <EmptyState
                  icon={Receipt}
                  title="لا توجد طلبات شحن سابقة"
                  description="عند إرسال طلب شحن عبر فودافون كاش أو إنستاباي سيظهر هنا مع حالته المباشرة."
                />
              ) : (
                <div className="space-y-3">
                  {walletTopups.map((req) => (
                    <div
                      key={req.id}
                      className="rounded-2xl bg-[#0F172A] border border-[#334155] p-4 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#F8FAFC]">
                          <span className="tabular-nums text-[#FF6B00]">{req.amount} ج.م</span>
                          <span className="text-[#94A3B8]">·</span>
                          <span>{req.method === 'instapay' ? 'إنستاباي' : 'فودافون كاش'}</span>
                        </div>
                        <p className="text-xs text-[#94A3B8] tabular-nums">
                          مرجع: {req.referenceNumber} · {new Date(req.createdAtIso).toLocaleString('ar-EG')}
                        </p>
                        {req.adminNote && (
                          <p className="text-xs text-amber-300">ملاحظة الإدارة: {req.adminNote}</p>
                        )}
                      </div>
                      <span
                        className={`px-3 py-1 rounded-2xl text-xs font-bold border ${
                          req.status === 'approved'
                            ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                            : req.status === 'rejected'
                            ? 'bg-rose-950/50 border-rose-500/40 text-rose-300'
                            : 'bg-amber-950/50 border-amber-500/40 text-amber-300'
                        }`}
                      >
                        {req.status === 'approved'
                          ? 'تم الاعتماد'
                          : req.status === 'rejected'
                          ? 'مرفوض'
                          : 'قيد المراجعة'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Wallet Ledger */}
            <div className="rounded-2xl bg-[#1E293B] border border-[#334155] p-6 space-y-4">
              <h3 className="text-lg font-bold text-[#F8FAFC]">سجل حركات المحفظة</h3>
              {walletTransactions.length === 0 ? (
                <EmptyState
                  icon={Wallet}
                  title="سجل الحركات فارغ حالياً"
                  description="تظهر هنا جميع عمليات الشحن والدفع واسترداد المبالغ تلقائياً."
                />
              ) : (
                <div className="space-y-3">
                  {walletTransactions.map((tx) => {
                    const isCredit =
                      tx.type === 'topup_credit' ||
                      tx.type === 'order_refund' ||
                      tx.type === 'referral_bonus';
                    return (
                      <div
                        key={tx.id}
                        className="rounded-2xl bg-[#0F172A] border border-[#334155] p-4 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                              isCredit
                                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-950/60 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {isCredit ? (
                              <ArrowDownLeft className="w-5 h-5" />
                            ) : (
                              <ArrowUpRight className="w-5 h-5" />
                            )}
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <p className="text-sm font-bold text-[#F8FAFC] truncate">
                              {tx.titleAr || tx.description}
                            </p>
                            <p className="text-xs text-[#94A3B8] tabular-nums">
                              {new Date(tx.createdAtIso).toLocaleString('ar-EG')} · الرصيد بعد العملية: {tx.balanceAfter} ج.م
                            </p>
                          </div>
                        </div>
                        <span
                          className={`text-sm font-extrabold tabular-nums shrink-0 ${
                            isCredit ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isCredit ? '+' : '-'}{Math.abs(tx.amount)} ج.م
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        ) : activeSection === 'addresses' ? (
          <section className="space-y-6">
            {/* Saved Addresses Card */}
            <div className="rounded-2xl bg-[#1E293B] border border-[#334155] p-6 space-y-4">
              <h2 className="text-2xl font-bold text-[#F8FAFC]">
                عناوين التوصيل المحفوظة
              </h2>

              {savedAddresses.length === 0 ? (
                <EmptyState
                  icon={MapPin}
                  title="لا توجد عناوين محفوظة بعد"
                  description="أضف عنوانك الأول في إدكو بالأسفل وحدده على الخريطة لسرعة التوصيل."
                />
              ) : (
                <div className="space-y-3">
                  {savedAddresses.map((addr) => (
                    <div
                      key={addr.id}
                      className="rounded-2xl bg-[#0F172A] border border-[#334155] p-4 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#F8FAFC]">
                          <span>{addr.label}</span>
                          <span className="text-[#94A3B8]">·</span>
                          <span className="text-xs font-bold text-[#FF6B00]">
                            {addr.neighborhood}
                          </span>
                          {addr.isDefault && (
                            <>
                              <span className="text-[#94A3B8]">·</span>
                              <span className="text-xs font-bold text-emerald-400">
                                العنوان الافتراضي
                              </span>
                            </>
                          )}
                        </div>
                        <p className="text-sm text-[#94A3B8]">{addr.address}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!addr.isDefault && (
                          <button
                            type="button"
                            onClick={() => handleSetDefaultAddress(addr)}
                            className="min-h-[40px] px-3.5 py-1.5 rounded-2xl border border-[#334155] bg-[#1E293B] hover:border-[#FF6B00] text-xs font-bold text-[#F8FAFC] cursor-pointer"
                          >
                            تعيين كافتراضي
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleStartEditAddress(addr)}
                          aria-label={`تعديل ${addr.label}`}
                          className="min-h-[40px] min-w-[40px] rounded-2xl border border-[#334155] bg-[#1E293B] hover:border-[#FF6B00] text-[#FF6B00] flex items-center justify-center cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAddress(addr.id)}
                          aria-label={`حذف ${addr.label}`}
                          className="min-h-[40px] min-w-[40px] rounded-2xl border border-[#334155] bg-[#1E293B] hover:border-rose-500/60 text-rose-400 flex items-center justify-center cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sleek Add / Edit Address Card with Interactive Edku Map Picker */}
            <form
              onSubmit={handleAddAddress}
              className="rounded-2xl bg-[#1E293B] border border-[#334155] p-6 space-y-4 shadow-lg"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-xl font-bold text-[#F8FAFC] flex items-center gap-2">
                  {editingAddressId ? (
                    <Pencil className="w-5 h-5 text-[#FF6B00]" />
                  ) : (
                    <Plus className="w-5 h-5 text-[#FF6B00]" />
                  )}
                  <span>{editingAddressId ? 'تعديل العنوان المحفوظ' : 'إضافة عنوان جديد'}</span>
                </h3>

                <div className="flex flex-wrap items-center gap-2">
                  {editingAddressId && (
                    <button
                      type="button"
                      onClick={handleCancelEditAddress}
                      className="min-h-[42px] px-4 py-2 rounded-2xl border border-[#334155] bg-[#0F172A] text-[#94A3B8] hover:text-[#F8FAFC] text-xs font-bold cursor-pointer"
                    >
                      إلغاء التعديل
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleUseCurrentGps}
                    disabled={locatingGps}
                    className="min-h-[42px] px-4 py-2 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-60 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    {locatingGps ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <LocateFixed className="w-4 h-4" />
                    )}
                    <span>
                      {locatingGps
                        ? 'جارٍ تحديد الموقع...'
                        : 'استخدم موقعي الحالي GPS'}
                    </span>
                  </button>
                </div>
              </div>

              {gpsStatusMsg && (
                <div
                  className={`rounded-2xl px-4 py-2.5 text-xs font-semibold border ${
                    gpsStatusMsg.type === 'ok'
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                      : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                  }`}
                >
                  {gpsStatusMsg.text}
                </div>
              )}

              <EdkuLocationPickerMap
                label="تحديد نقطة التوصيل على خريطة إدكو"
                helperText="حرّك الدبوس أو ابحث عن شارعك داخل مدينة إدكو لضبط الإحداثيات بدقة"
                lat={newAddrLat}
                lng={newAddrLng}
                neighborhood={newAddrNeighborhood}
                heightClassName="h-[220px]"
                onChange={(picked) => {
                  setNewAddrLat(picked.lat);
                  setNewAddrLng(picked.lng);
                  if (picked.neighborhood) {
                    setNewAddrNeighborhood(picked.neighborhood);
                  }
                  if (picked.resolvedAddress && !newAddrText.trim()) {
                    setNewAddrText(picked.resolvedAddress);
                  }
                }}
                onWaterValidationChange={setNewAddrWaterPin}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#F8FAFC] mb-1.5">
                    الحي / المنطقة في إدكو
                  </label>
                  <select
                    value={newAddrNeighborhood}
                    onChange={(e) => {
                      const nextArea = e.target.value;
                      setNewAddrNeighborhood(nextArea);
                      const coords = resolveEdkuCoordsForNeighborhood(nextArea);
                      setNewAddrLat(coords.lat);
                      setNewAddrLng(coords.lng);
                      setNewAddrWaterPin(false);
                    }}
                    className="w-full min-h-[46px] px-3.5 py-2.5 rounded-2xl border border-[#334155] bg-[#0F172A] text-sm font-semibold text-[#F8FAFC]"
                  >
                    {EDKU_NEIGHBORHOODS.map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#F8FAFC] mb-1.5">
                    تسمية العنوان
                  </label>
                  <input
                    type="text"
                    value={newAddrLabel}
                    onChange={(e) => setNewAddrLabel(e.target.value)}
                    placeholder="المنزل / العمل"
                    className="w-full min-h-[46px] px-3.5 py-2.5 rounded-2xl border border-[#334155] bg-[#0F172A] text-sm text-[#F8FAFC] placeholder:text-[#94A3B8]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#F8FAFC] mb-1.5">
                  العنوان التفصيلي
                </label>
                <input
                  type="text"
                  required
                  value={newAddrText}
                  onChange={(e) => setNewAddrText(e.target.value)}
                  placeholder="مثال: شارع الجيش، أمام مسجد إدكو، الدور الثالث"
                  className="w-full min-h-[46px] px-3.5 py-2.5 rounded-2xl border border-[#334155] bg-[#0F172A] text-sm text-[#F8FAFC] placeholder:text-[#94A3B8]"
                />
              </div>

              <button
                type="submit"
                disabled={isAddingAddress || newAddrWaterPin}
                className="w-full min-h-[50px] px-6 py-3 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-60 text-white text-lg font-bold cursor-pointer"
              >
                {isAddingAddress
                  ? 'جارٍ الحفظ...'
                  : editingAddressId
                  ? 'حفظ التعديلات على العنوان'
                  : 'حفظ العنوان'}
              </button>
            </form>
          </section>
        ) : activeSection === 'support' ? (
          <CustomerSupportSection
            currentUserUid={userUid}
            isAnonymous={isAnonymous}
            userName={resolvedName}
            userPhone={userProfile?.phone ?? ''}
            userEmail={userProfile?.email || userEmail}
            userRole="customer"
            onRequireLogin={onOpenAuthModal}
            onNotify={(msg) => setFeedbackMsg({ type: 'success', text: msg })}
          />
        ) : activeSection === 'privacy' ? (
          <section className="space-y-4">
            {/* Privacy Card */}
            <div className="rounded-2xl bg-[#1E293B] border border-[#334155] p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FF6B00]/15 text-[#FF6B00] flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold text-[#F8FAFC]">
                  الخصوصية وحماية البيانات
                </h2>
              </div>

              <p className="text-base text-[#94A3B8] leading-relaxed">
                يلتزم تطبيق إدكاوي بحماية بياناتك الشخصية وموقعك الجغرافي وفق قانون حماية البيانات الشخصية المصري رقم ١٥١ لسنة ٢٠٢٠، وتُستخدم بياناتك حصراً لتنفيذ الطلبات والتوصيل داخل مدينة إدكو.
              </p>

              {onOpenLegalModal && (
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => onOpenLegalModal('privacy')}
                    className="min-h-[42px] px-4 py-2 rounded-2xl border border-[#334155] bg-[#0F172A] hover:border-[#FF6B00] text-xs font-bold text-[#F8FAFC] cursor-pointer"
                  >
                    سياسة الخصوصية و GPS
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenLegalModal('terms')}
                    className="min-h-[42px] px-4 py-2 rounded-2xl border border-[#334155] bg-[#0F172A] hover:border-[#FF6B00] text-xs font-bold text-[#F8FAFC] cursor-pointer"
                  >
                    الشروط والأحكام
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenLegalModal('pharmacy')}
                    className="min-h-[42px] px-4 py-2 rounded-2xl border border-[#334155] bg-[#0F172A] hover:border-[#FF6B00] text-xs font-bold text-[#F8FAFC] cursor-pointer"
                  >
                    سياسة الصيدليات
                  </button>
                </div>
              )}
            </div>

            {/* Permanent Account Deletion Card */}
            <div className="rounded-2xl bg-[#1E293B] border border-rose-500/40 p-6 space-y-4">
              <h3 className="text-xl font-bold text-[#F8FAFC]">
                حذف الحساب نهائياً
              </h3>
              <p className="text-sm text-[#94A3B8] leading-relaxed">
                سيتم مسح حسابك وعناوينك المحفوظة نهائياً من خوادم إدكاوي ولا يمكن التراجع عن هذه الخطوة بعد تأكيدها.
              </p>

              {activeOrdersCount > 0 && (
                <div
                  role="alert"
                  className="rounded-2xl bg-amber-950/50 border border-amber-500/40 px-4 py-3 text-sm font-semibold text-amber-200"
                >
                  تنبيه: لديك {activeOrdersCount} طلب نشط حالياً — لا يمكن حذف الحساب إذا كان لديك طلبات قيد التنفيذ والتوصيل.
                </div>
              )}

              <button
                type="button"
                onClick={handleTriggerDeleteModal}
                className="w-full min-h-[50px] px-6 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-lg font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-5 h-5" />
                <span>حذف الحساب نهائياً</span>
              </button>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl bg-[#1E293B] border border-[#334155] p-6 space-y-5">
            <div>
              <h2 className="text-2xl font-bold text-[#F8FAFC]">
                متاجري وصيدلياتي المفضلة
              </h2>
              <p className="text-sm text-[#94A3B8] mt-1">
                المتاجر والمطاعم والصيدليات التي حفظتها للوصول السريع إليها.
              </p>
            </div>

            {favoriteStores.length === 0 ? (
              <EmptyState
                icon={Store}
                title="قائمة المفضلة فارغة حالياً"
                description="اضغط على أيقونة القلب أعلى أي متجر أو صيدلية لحفظه هنا والوصول السريع إليه."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {favoriteStores.map((store) => {
                  const open = isStoreCurrentlyOpen(store);
                  return (
                    <div
                      key={store.id}
                      className="rounded-2xl border border-[#334155] bg-[#0F172A] overflow-hidden flex items-center gap-4 p-4"
                    >
                      <ResilientImage
                        src={store.imageUrl || ''}
                        alt={store.name}
                        fallbackTitle={store.name}
                        className="w-20 h-20 rounded-2xl object-cover shrink-0"
                      />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="text-xs text-[#94A3B8] truncate">
                          {store.category} · {store.neighborhood}
                        </div>
                        <h3 className="text-base font-bold text-[#F8FAFC] truncate">
                          {store.name}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-[#94A3B8] tabular-nums">
                          <span className="inline-flex items-center gap-1 font-bold text-[#FF6B00]">
                            <Star className="w-3.5 h-3.5 fill-[#FF6B00] text-[#FF6B00]" />
                            {store.rating.toFixed(1)}
                          </span>
                          <span>·</span>
                          <span>{open ? 'مفتوح الآن' : 'مغلق حالياً'}</span>
                        </div>
                        <div className="pt-1 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectStore(store)}
                            className="px-3.5 py-2 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs font-bold cursor-pointer"
                          >
                            {store.category === 'صيدليات'
                              ? 'طلب روشتة'
                              : 'تصفح المنيو'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleFavoriteStore(store.id)}
                            aria-label="إزالة من المفضلة"
                            className="p-2 rounded-2xl border border-[#334155] text-rose-500 hover:bg-rose-950/40 cursor-pointer"
                          >
                            <Heart className="w-4 h-4 fill-rose-500" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Google Play Store Rating Card */}
      <section className="rounded-2xl bg-[#1E293B] border border-[#334155] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-[#F8FAFC] flex items-center gap-2">
            <Star className="w-4 h-4 fill-[#FF6B00] text-[#FF6B00]" />
            <span>قيّم تجربتك مع إدكاوي على Google Play</span>
          </h3>
          <p className="text-xs text-[#94A3B8]">
            تقييمك يدعم متاجر وكباتن مدينة إدكو في تطوير الخدمة باستمرار.
          </p>
        </div>
        <a
          href={GOOGLE_PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-sm font-bold inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
        >
          <span>قيّم التطبيق</span>
          <ExternalLink className="w-4 h-4" />
        </a>
      </section>

      {/* App Version & Build Information */}
      <section className="rounded-2xl border border-[#334155] bg-[#1E293B] p-4 text-center space-y-1.5">
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-[#94A3B8]">
          <span className="font-bold text-[#F8FAFC]">إدكاوي - منصة مدينة إدكو</span>
          <span>·</span>
          <span className="font-mono font-bold text-[#FF6B00]">
            الإصدار {APP_VERSION}
          </span>
          <span>·</span>
          <span>{VERSION_INFO.buildDate}</span>
        </div>
      </section>

      {isDeleteAccountModalOpen && (
        <div
          className="edkawi-modal-backdrop flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="تأكيد حذف الحساب نهائياً"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#1E293B] border border-[#334155] shadow-2xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-rose-400">
              تأكيد حذف الحساب نهائياً
            </h2>
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              سيتم مسح ملفك الشخصي وعناوينك المحفوظة نهائياً من حسابك، مع الاحتفاظ بسجلات الطلبات القانونية لمدة ١٥ يوماً قبل الحذف النهائي وفق سياسة الخصوصية. هل أنت متأكد؟
            </p>
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isDeletingAccount}
                onClick={() => setIsDeleteAccountModalOpen(false)}
                className="min-h-[44px] px-4 py-2 rounded-2xl border border-[#334155] bg-[#0F172A] text-[#F8FAFC] text-sm font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isDeletingAccount}
                onClick={async () => {
                  setIsDeletingAccount(true);
                  setFeedbackMsg(null);
                  try {
                    await deleteCurrentAccountCompletely();
                    setIsDeleteAccountModalOpen(false);
                    onSignOut();
                  } catch (err) {
                    setFeedbackMsg({
                      type: 'error',
                      text: formatAppErrorMessage(
                        err,
                        'تعذر حذف الحساب حالياً. يرجى إعادة تسجيل الدخول ثم المحاولة.'
                      ),
                    });
                    setIsDeletingAccount(false);
                  }
                }}
                className="min-h-[44px] px-5 py-2 rounded-2xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
              >
                {isDeletingAccount && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                <span>حذف الحساب نهائياً</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmActionModal
        isOpen={isSignOutConfirmOpen}
        title="تأكيد تسجيل الخروج"
        description="هل تريد تسجيل الخروج من حسابك الحالي في إدكاوي؟ يمكنك العودة في أي وقت بنفس الرقم أو البريد الإلكتروني."
        confirmLabel="تسجيل الخروج"
        cancelLabel="البقاء متصلاً"
        tone="warning"
        onConfirm={() => {
          setIsSignOutConfirmOpen(false);
          onSignOut();
        }}
        onCancel={() => setIsSignOutConfirmOpen(false)}
      />
    </div>
  );
};
