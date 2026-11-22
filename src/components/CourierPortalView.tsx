import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bike,
  CheckCircle2,
  Clock,
  Headphones,
  LocateFixed,
  LogOut,
  MapPin,
  Navigation,
  PackageCheck,
  Phone,
  Pill,
  Play,
  Power,
  Send,
  ShieldAlert,
  Square,
  Star,
  Truck,
  UserCheck,
  XCircle,
  Trash2,
  Zap,
} from 'lucide-react';
import {
  deleteCurrentAccountCompletely,
  incrementCourierWalletBalance,
  rejectOrderByCourierInFirestore,
  submitCourierKycInFirestore,
} from '../services/edkawiFirebaseService';
import {
  EDKU_CITY_CENTER,
  resolveEdkuCoordsForNeighborhood,
} from '../data/edkuSeedStores';
import {
  CourierKycDocumentsInput,
  CourierProfileInput,
  CourierRecord,
  CourierVehicleType,
  OrderRecord,
  StoreRecord,
} from '../types/edkawi';
import {
  COURIER_VEHICLE_TYPES,
  EDKU_ROUTE_WAYPOINTS,
  estimateEdkuDistanceKm,
  formatAppErrorMessage,
  getPaymentMethodLabel,
  isCourierDrivingLicenseRequired,
  validateCourierKycDocuments,
  validateCourierProfile,
} from '../utils/orderLogic';
import { CourierKycFields } from './CourierKycFields';
import {
  CourierMultiStopAndHeatmapMap,
  EdkuLocationPickerMap,
  LiveOrderScooterMap,
} from './EdkuGoogleMaps';
import { OrdersListSkeleton } from './SkeletonLoaders';
import { PortalSupportModal } from './SupportSystemViews';
import { ConfirmActionModal } from './ConfirmActionModal';

interface CourierPortalViewProps {
  courierUid?: string;
  courierEmail?: string;
  currentCourier: CourierRecord | null;
  isLoadingCourier: boolean;
  orders: OrderRecord[];
  stores: StoreRecord[];
  surgeEnabled?: boolean;
  surgeMultiplier?: number;
  onNotify?: (msg: string) => void;
  onToggleAvailability: (nextAvailable: boolean) => Promise<void>;
  onSaveCourierProfile: (profile: CourierProfileInput) => Promise<void>;
  onQuoteCustomErrand?: (
    order: OrderRecord,
    deliveryFeeEgp: number,
    coords?: { lat?: number; lng?: number }
  ) => Promise<void>;
  onPickupOrder: (
    orderId: string,
    courierName: string,
    courierPhone: string,
    initialLocation: string,
    coords?: { lat?: number; lng?: number }
  ) => Promise<void>;
  onUpdateOrderLocation: (
    orderId: string,
    courierName: string,
    courierPhone: string,
    nextLocation: string,
    coords?: { lat?: number; lng?: number }
  ) => Promise<void>;
  onCompleteDelivery: (
    orderId: string,
    finalLocation: string,
    coords?: { lat?: number; lng?: number }
  ) => Promise<void>;
  onReleaseOrder?: (orderId: string) => Promise<void>;
  onStreamLiveGps?: (
    lat: number,
    lng: number,
    locationLabel?: string
  ) => Promise<void>;
  onLogout?: () => void;
}

export function CourierPortalView({
  courierUid,
  courierEmail,
  currentCourier,
  isLoadingCourier,
  orders,
  stores,
  surgeEnabled = false,
  surgeMultiplier = 1.5,
  onNotify,
  onToggleAvailability,
  onSaveCourierProfile,
  onQuoteCustomErrand,
  onPickupOrder,
  onUpdateOrderLocation,
  onCompleteDelivery,
  onReleaseOrder,
  onStreamLiveGps,
  onLogout,
}: CourierPortalViewProps) {
  const [editingProfile, setEditingProfile] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [confirmReleaseOrder, setConfirmReleaseOrder] =
    useState<OrderRecord | null>(null);
  const [confirmRejectOrderId, setConfirmRejectOrderId] = useState<
    string | null
  >(null);
  const [errandQuoteByOrder, setErrandQuoteByOrder] = useState<
    Record<string, string>
  >({});
  const [nameInput, setNameInput] = useState(currentCourier?.name ?? '');
  const [phoneInput, setPhoneInput] = useState(currentCourier?.phone ?? '');
  const [vehicleInput, setVehicleInput] = useState<CourierVehicleType>(
    currentCourier?.vehicleType ?? 'دراجة نارية'
  );
  const [neighborhoodInput, setNeighborhoodInput] = useState(
    currentCourier?.neighborhood ?? 'شارع البحر'
  );
  const [latInput, setLatInput] = useState<number | undefined>(
    currentCourier?.lat
  );
  const [lngInput, setLngInput] = useState<number | undefined>(
    currentCourier?.lng
  );
  const [profileError, setProfileError] = useState<string | null>(null);
  const [courierWaterPin, setCourierWaterPin] = useState(false);
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [deleteAccountBusy, setDeleteAccountBusy] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [locallyRejectedOrderIds, setLocallyRejectedOrderIds] = useState<
    string[]
  >([]);
  const lastAlertedOrderIdRef = useRef<string | null>(null);

  // KYC Verification Upload / Resubmission State (Gate 1)
  const [kycVehicleType, setKycVehicleType] = useState<CourierVehicleType>(
    currentCourier?.vehicleType ?? 'دراجة نارية'
  );
  const [kycDocs, setKycDocs] = useState<CourierKycDocumentsInput>({
    nationalIdFrontUrl: currentCourier?.nationalIdFrontUrl ?? '',
    nationalIdBackUrl: currentCourier?.nationalIdBackUrl ?? '',
    drivingLicenseFrontUrl: currentCourier?.drivingLicenseFrontUrl ?? '',
    drivingLicenseBackUrl: currentCourier?.drivingLicenseBackUrl ?? '',
    vehiclePhotoUrl: currentCourier?.vehiclePhotoUrl ?? '',
    selfieWithIdUrl: currentCourier?.selfieWithIdUrl ?? '',
  });
  const [kycErrors, setKycErrors] = useState<Record<string, string>>({});
  const [kycSubmitting, setKycSubmitting] = useState(false);
  const [kycErrorBanner, setKycErrorBanner] = useState<string | null>(null);
  const [kycSuccessBanner, setKycSuccessBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!currentCourier) return;
    setKycVehicleType(currentCourier.vehicleType || 'دراجة نارية');
    setKycDocs({
      nationalIdFrontUrl: currentCourier.nationalIdFrontUrl || '',
      nationalIdBackUrl: currentCourier.nationalIdBackUrl || '',
      drivingLicenseFrontUrl: currentCourier.drivingLicenseFrontUrl || '',
      drivingLicenseBackUrl: currentCourier.drivingLicenseBackUrl || '',
      vehiclePhotoUrl: currentCourier.vehiclePhotoUrl || '',
      selfieWithIdUrl: currentCourier.selfieWithIdUrl || '',
    });
  }, [
    currentCourier?.id,
    currentCourier?.vehicleType,
    currentCourier?.nationalIdFrontUrl,
    currentCourier?.nationalIdBackUrl,
    currentCourier?.drivingLicenseFrontUrl,
    currentCourier?.drivingLicenseBackUrl,
    currentCourier?.vehiclePhotoUrl,
    currentCourier?.selfieWithIdUrl,
  ]);

  async function handleSubmitKycDocuments(e: FormEvent) {
    e.preventDefault();
    if (!currentCourier) return;
    setKycErrorBanner(null);
    setKycSuccessBanner(null);
    const check = validateCourierKycDocuments(kycVehicleType, kycDocs);
    if (!check.valid) {
      setKycErrors(check.errors);
      setKycErrorBanner(Object.values(check.errors)[0]);
      return;
    }
    setKycErrors({});
    setKycSubmitting(true);
    try {
      await submitCourierKycInFirestore(
        courierUid || currentCourier.id,
        kycVehicleType,
        kycDocs
      );
      setKycSuccessBanner(
        'تم إرسال مستندات التوثيق بنجاح! طلبك الآن قيد المراجعة لدى إدارة إدكاوي وسيفتح حسابك فور الاعتماد.'
      );
      onNotify?.('تم إرسال مستندات التحقق إلى قسم المراجعة بنجاح.');
    } catch (err) {
      setKycErrorBanner(
        formatAppErrorMessage(err, 'تعذر حفظ مستندات التوثيق حالياً.')
      );
    } finally {
      setKycSubmitting(false);
    }
  }

  async function handleCourierRejectOrder(orderId: string) {
    if (!currentCourier) return;
    setActionError(null);
    setLocallyRejectedOrderIds((prev) =>
      prev.includes(orderId) ? prev : [...prev, orderId]
    );
    setBusyActionId(`reject_${orderId}`);
    try {
      await rejectOrderByCourierInFirestore(orderId, currentCourier.id);
      onNotify?.('تم رفض الطلب واستبعاده من قائمتك بنجاح.');
    } catch (err) {
      setActionError(formatAppErrorMessage(err, 'تعذر رفض الطلب حالياً.'));
    } finally {
      setBusyActionId(null);
    }
  }

  async function handleConfirmDeleteCourierAccount() {
    setDeleteAccountError(null);
    setDeleteAccountBusy(true);
    try {
      await deleteCurrentAccountCompletely();
      setIsDeleteAccountOpen(false);
      onLogout?.();
    } catch (err) {
      setDeleteAccountError(
        formatAppErrorMessage(err, 'تعذر حذف حساب المندوب. تواصل مع الدعم.')
      );
    } finally {
      setDeleteAccountBusy(false);
    }
  }

  // Real GPS & Edku Street Simulation state
  const [gpsMode, setGpsMode] = useState<'off' | 'real_gps' | 'edku_sim'>(
    'off'
  );
  const [liveCoords, setLiveCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [gpsStatusMsg, setGpsStatusMsg] = useState<string | null>(null);
  const simProgressRef = useRef<number>(0.15);
  const lastGpsPushMsRef = useRef<number>(0);

  const activeDeliveries = orders.filter(
    (o) => o.status === 'on_the_way' || o.status === 'delivering'
  );
  const primaryActiveOrder = activeDeliveries[0] ?? null;

  const effectiveCourierCoords = useMemo(() => {
    if (liveCoords) return liveCoords;
    if (
      typeof currentCourier?.lat === 'number' &&
      typeof currentCourier?.lng === 'number'
    ) {
      return { lat: currentCourier.lat, lng: currentCourier.lng };
    }
    return resolveEdkuCoordsForNeighborhood(
      currentCourier?.neighborhood ?? 'شارع البحر'
    );
  }, [
    liveCoords,
    currentCourier?.lat,
    currentCourier?.lng,
    currentCourier?.neighborhood,
  ]);

  // Real Browser Geolocation Watcher
  useEffect(() => {
    if (gpsMode !== 'real_gps') return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatusMsg(
        'متصفحك الحالي لا يدعم GPS المباشر — يمكنك تفعيل وضع محاكاة التحرك داخل إدكو.'
      );
      setGpsMode('off');
      return;
    }

    setGpsStatusMsg('جارٍ قراءة إحداثيات GPS الحقيقية وبثها للعميل...');
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const nextLat = Number(pos.coords.latitude.toFixed(6));
        const nextLng = Number(pos.coords.longitude.toFixed(6));
        setLiveCoords({ lat: nextLat, lng: nextLng });
        setGpsStatusMsg(
          `بث GPS حي مفعّل (${nextLat.toFixed(4)}, ${nextLng.toFixed(4)})`
        );

        const nowMs = Date.now();
        if (nowMs - lastGpsPushMsRef.current >= 4000) {
          lastGpsPushMsRef.current = nowMs;
          void onStreamLiveGps?.(
            nextLat,
            nextLng,
            'تتبع GPS الحي لكابتن إدكاوي'
          );
        }
      },
      () => {
        setGpsStatusMsg(
          'تعذر الوصول لصلاحية الموقع الجغرافي (GPS) — يمكنك استخدام وضع المحاكاة داخل إدكو.'
        );
        setGpsMode('off');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [gpsMode, onStreamLiveGps]);

  // Edku Street Simulation Streamer
  useEffect(() => {
    if (gpsMode !== 'edku_sim') return;

    const matchedStore = primaryActiveOrder
      ? stores.find((s) => s.id === primaryActiveOrder.storeId)
      : null;

    const startCoords =
      matchedStore?.lat && matchedStore?.lng
        ? { lat: matchedStore.lat, lng: matchedStore.lng }
        : resolveEdkuCoordsForNeighborhood(
            matchedStore?.neighborhood ??
              currentCourier?.neighborhood ??
              'شارع البحر'
          );

    const endCoords = primaryActiveOrder
      ? primaryActiveOrder.customerLat && primaryActiveOrder.customerLng
        ? {
            lat: primaryActiveOrder.customerLat,
            lng: primaryActiveOrder.customerLng,
          }
        : resolveEdkuCoordsForNeighborhood(
            primaryActiveOrder.deliveryNeighborhood
          )
      : EDKU_CITY_CENTER;

    const tickSimulation = () => {
      const nextT =
        simProgressRef.current >= 0.92 ? 0.15 : simProgressRef.current + 0.14;
      simProgressRef.current = nextT;

      const interpLat = Number(
        (startCoords.lat + (endCoords.lat - startCoords.lat) * nextT).toFixed(6)
      );
      const interpLng = Number(
        (startCoords.lng + (endCoords.lng - startCoords.lng) * nextT).toFixed(6)
      );

      const waypointIdx = Math.min(
        EDKU_ROUTE_WAYPOINTS.length - 1,
        Math.max(1, Math.floor(nextT * EDKU_ROUTE_WAYPOINTS.length))
      );
      const label = EDKU_ROUTE_WAYPOINTS[waypointIdx];

      setLiveCoords({ lat: interpLat, lng: interpLng });
      setGpsStatusMsg(
        `وضع المحاكاة نشط في إدكو: ${label} (${Math.round(nextT * 100)}%)`
      );
      void onStreamLiveGps?.(interpLat, interpLng, label);
    };

    tickSimulation();
    const timer = window.setInterval(tickSimulation, 4200);
    return () => window.clearInterval(timer);
  }, [
    gpsMode,
    primaryActiveOrder?.id,
    primaryActiveOrder?.storeId,
    primaryActiveOrder?.deliveryNeighborhood,
    primaryActiveOrder?.customerLat,
    primaryActiveOrder?.customerLng,
    stores,
    currentCourier?.neighborhood,
    onStreamLiveGps,
  ]);

  const [incomingOrder, setIncomingOrder] = useState<OrderRecord | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState(30);

  // Pharmacy orders only dispatch to couriers once status === 'ready' (Stage 4)
  // Custom errands appear when awaiting_courier_quote or when quoted by this courier
  const readyToPickupOrders = useMemo(() => {
    if (!currentCourier || currentCourier.approvalStatus !== 'approved') {
      return [];
    }
    return orders.filter((o) => {
      if (locallyRejectedOrderIds.includes(o.id)) {
        return false;
      }
      if (
        o.rejectedBy &&
        Array.isArray(o.rejectedBy) &&
        o.rejectedBy.includes(currentCourier.id)
      ) {
        return false;
      }
      if (o.orderType === 'custom_errand') {
        return (
          o.status === 'awaiting_courier_quote' ||
          (o.status === 'awaiting_customer_errand_approval' &&
            o.courierId === currentCourier.id)
        );
      }
      if (o.orderType === 'pharmacy_prescription') {
        return o.status === 'ready';
      }
      return (
        o.status === 'ready' ||
        (o.courierId === currentCourier.id &&
          (o.status === 'preparing' ||
            o.status === 'pending' ||
            o.status === 'confirmed'))
      );
    });
  }, [orders, currentCourier, locallyRejectedOrderIds]);

  const topUnassignedOrder = useMemo(() => {
    if (
      !currentCourier ||
      currentCourier.approvalStatus !== 'approved' ||
      !currentCourier.isAvailable
    ) {
      return null;
    }
    return (
      readyToPickupOrders.find(
        (o) =>
          !o.courierId &&
          o.status === 'ready' &&
          !locallyRejectedOrderIds.includes(o.id) &&
          (!o.rejectedBy || !o.rejectedBy.includes(currentCourier.id))
      ) ?? null
    );
  }, [currentCourier, readyToPickupOrders, locallyRejectedOrderIds]);

  useEffect(() => {
    if (
      currentCourier?.approvalStatus === 'approved' &&
      topUnassignedOrder &&
      (!incomingOrder || incomingOrder.id !== topUnassignedOrder.id)
    ) {
      setIncomingOrder(topUnassignedOrder);
      setCountdownSeconds(30);

      if (lastAlertedOrderIdRef.current !== topUnassignedOrder.id) {
        lastAlertedOrderIdRef.current = topUnassignedOrder.id;
        try {
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
          }
          const AudioCtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext;
          if (AudioCtx) {
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(660, ctx.currentTime);
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.14);
            gain.gain.setValueAtTime(0.18, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.46);
            window.setTimeout(() => void ctx.close().catch(() => {}), 600);
          }
        } catch {
          // Ignore browser autoplay restrictions before user interaction
        }
      }
    } else if (
      (!topUnassignedOrder || currentCourier?.approvalStatus !== 'approved') &&
      incomingOrder
    ) {
      setIncomingOrder(null);
    }
  }, [currentCourier?.approvalStatus, topUnassignedOrder, incomingOrder]);

  useEffect(() => {
    if (!incomingOrder || currentCourier?.approvalStatus !== 'approved') return;
    if (countdownSeconds <= 0) {
      const expiredId = incomingOrder.id;
      setLocallyRejectedOrderIds((prev) =>
        prev.includes(expiredId) ? prev : [...prev, expiredId]
      );
      if (currentCourier) {
        void rejectOrderByCourierInFirestore(
          expiredId,
          currentCourier.id
        ).catch(() => {});
      }
      setIncomingOrder(null);
      return;
    }
    const t = setInterval(() => {
      setCountdownSeconds((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(t);
  }, [incomingOrder, countdownSeconds, currentCourier]);

  if (isLoadingCourier) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-10 space-y-5">
        <OrdersListSkeleton count={3} />
      </div>
    );
  }

  if (!currentCourier) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-14 text-center edkawi-page-enter">
        <div className="rounded-2xl bg-[#1E293B] border border-[#334155] p-6 sm:p-10 space-y-4">
          <ShieldAlert
            className="w-10 h-10 text-[#FF6B00] mx-auto"
            aria-hidden="true"
          />
          <h1 className="text-xl sm:text-2xl font-bold text-[#F8FAFC]">
            بيانات كابتن التوصيل غير مكتملة
          </h1>
          <p className="text-sm text-[#94A3B8] leading-relaxed max-w-md mx-auto">
            لم يتم العثور على ملف مندوب نشط مرتبط بهذا الحساب. يرجى التواصل مع إدارة إدكاوي لتفعيل بيانات المندوب.
          </p>
          {onLogout && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setConfirmLogoutOpen(true)}
                className="py-2.5 px-6 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-sm font-bold cursor-pointer"
              >
                تسجيل الخروج
              </button>
            </div>
          )}
        </div>
        <ConfirmActionModal
          isOpen={confirmLogoutOpen}
          title="تسجيل الخروج من بوابة المندوب"
          description="هل تريد إنهاء جلستك الحالية؟"
          confirmLabel="تسجيل الخروج"
          cancelLabel="إلغاء"
          tone="warning"
          onConfirm={() => {
            setConfirmLogoutOpen(false);
            onLogout?.();
          }}
          onCancel={() => setConfirmLogoutOpen(false)}
        />
      </div>
    );
  }

  // Gate 1: Pending or Rejected Courier Account Screen (with KYC Upload & Resubmission)
  if (currentCourier.approvalStatus !== 'approved') {
    const isRejected = currentCourier.approvalStatus === 'rejected';
    const hasCompleteKyc = validateCourierKycDocuments(
      currentCourier.vehicleType,
      currentCourier
    ).valid;
    const requiresLicense = isCourierDrivingLicenseRequired(kycVehicleType);

    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-10 sm:py-14 edkawi-page-enter space-y-6">
        <section className="rounded-2xl bg-[#1E293B] border border-[#334155] p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-4">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto ${
                isRejected
                  ? 'bg-rose-950/60 border border-rose-800/70'
                  : 'bg-[#FF6B00]/15 border border-[#FF6B00]/30'
              }`}
            >
              {isRejected ? (
                <ShieldAlert
                  className="w-8 h-8 text-rose-400"
                  aria-hidden="true"
                />
              ) : (
                <Clock className="w-8 h-8 text-[#FF6B00]" aria-hidden="true" />
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-[#FF6B00]">
                بوابة كابتن التوصيل · مدينة إدكو
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#F8FAFC]">
                {isRejected
                  ? 'تم رفض مستندات التوثيق — يرجى التعديل وإعادة الإرسال'
                  : !hasCompleteKyc
                  ? 'أكمل رفع مستندات التوثيق للمراجعة'
                  : 'حسابك ومستنداتك قيد المراجعة لدى إدارة إدكاوي'}
              </h1>
              <p className="text-sm text-[#94A3B8] leading-relaxed max-w-xl mx-auto">
                {isRejected
                  ? 'راجع سبب الرفض بالأسفل وأعد رفع الصور المطلوبة بوضوح ليتم إرسال طلبك فوراً لقسم المراجعة.'
                  : !hasCompleteKyc
                  ? 'لأمان العملاء وتفعيل حساب الكابتن، يرجى رفع صور الهوية والمركبة المطلوبة أدناه ثم إرسالها للمراجعة.'
                  : 'تم استلام مستندات التوثيق الخاصة بك وحالتك الآن قيد المراجعة. فور موافقة الإدارة، ستفتح شاشة استلام الطلبات هنا تلقائياً.'}
              </p>
            </div>
          </div>

          {isRejected && currentCourier.kycRejectionReason && (
            <div
              role="alert"
              className="p-4 rounded-2xl bg-rose-950/50 border border-rose-500/40 text-right space-y-1"
            >
              <p className="text-xs font-bold text-rose-300">
                سبب الرفض المسجل من قسم المراجعة:
              </p>
              <p className="text-sm text-rose-100 leading-relaxed">
                {currentCourier.kycRejectionReason}
              </p>
            </div>
          )}

          <div className="p-5 rounded-2xl bg-[#0F172A] border border-[#334155] text-right space-y-2 text-xs sm:text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[#94A3B8]">اسم المندوب:</span>
              <span className="font-bold text-[#F8FAFC]">
                {currentCourier.name}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[#94A3B8]">رقم الموبايل:</span>
              <span
                dir="ltr"
                className="font-mono font-bold text-[#F8FAFC] tabular-nums"
              >
                {currentCourier.phone}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[#94A3B8]">وسيلة التوصيل والمنطقة:</span>
              <span className="font-semibold text-[#F8FAFC]">
                {currentCourier.vehicleType} · {currentCourier.neighborhood}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 pt-1 border-t border-[#334155]/60">
              <span className="text-[#94A3B8]">حالة مستندات التحقق (KYC):</span>
              <span
                className={`font-bold ${
                  isRejected
                    ? 'text-rose-400'
                    : hasCompleteKyc
                    ? 'text-emerald-400'
                    : 'text-[#FF6B00]'
                }`}
              >
                {isRejected
                  ? 'بحاجة لإعادة رفع'
                  : hasCompleteKyc
                  ? 'مكتملة وبانتظار اعتماد الإدارة'
                  : 'غير مكتملة — يرجى الرفع الآن'}
              </span>
            </div>
          </div>

          {kycErrorBanner && (
            <div
              role="alert"
              className="p-4 rounded-2xl bg-rose-950/50 border border-rose-500/40 text-xs sm:text-sm font-semibold text-rose-200"
            >
              {kycErrorBanner}
            </div>
          )}

          {kycSuccessBanner && (
            <div
              role="status"
              className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 text-xs sm:text-sm font-semibold text-emerald-200"
            >
              {kycSuccessBanner}
            </div>
          )}

          <form onSubmit={handleSubmitKycDocuments} className="space-y-4 text-right">
            <div>
              <label className="block text-xs font-bold text-[#F8FAFC] mb-1.5">
                نوع وسيلة التوصيل
              </label>
              <select
                value={kycVehicleType}
                onChange={(e) =>
                  setKycVehicleType(e.target.value as CourierVehicleType)
                }
                className="w-full px-3.5 py-3 rounded-2xl border border-[#334155] bg-[#0F172A] text-sm text-[#F8FAFC]"
              >
                {COURIER_VEHICLE_TYPES.map((vt) => (
                  <option key={vt} value={vt}>
                    {vt}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-[#94A3B8] mt-1">
                {requiresLicense
                  ? 'الموتوسيكل والسكوتر يتطلبان: البطاقة (وش وظهر) + رخصة القيادة (وش وظهر) + سيلفي بجانب الوجه + صورة المركبة.'
                  : 'الدراجة الهوائية معفاة من رخصة القيادة — مطلوب البطاقة (وش وظهر) + سيلفي بالبطاقة بجانب الوجه + صورة العجلة.'}
              </p>
            </div>

            <CourierKycFields
              vehicleType={kycVehicleType}
              value={kycDocs}
              onChange={setKycDocs}
              errors={kycErrors}
            />

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
              <button
                type="submit"
                disabled={kycSubmitting}
                className="min-h-[46px] px-6 py-2.5 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-60 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                <span>
                  {kycSubmitting
                    ? 'جارٍ رفع وإرسال المستندات...'
                    : isRejected
                    ? 'إعادة إرسال المستندات للمراجعة'
                    : hasCompleteKyc
                    ? 'تحديث المستندات المرسلة'
                    : 'إرسال مستندات التوثيق للمراجعة'}
                </span>
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSupportModalOpen(true)}
                  className="min-h-[46px] px-4 py-2.5 rounded-2xl bg-[#0F172A] border border-[#334155] hover:border-[#FF6B00] text-[#F8FAFC] text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Headphones className="w-4 h-4 text-[#FF6B00]" />
                  <span>الدعم الفني</span>
                </button>
                {onLogout && (
                  <button
                    type="button"
                    onClick={() => setConfirmLogoutOpen(true)}
                    className="min-h-[46px] px-4 py-2.5 rounded-2xl bg-[#0F172A] border border-[#334155] hover:border-rose-500 text-[#F8FAFC] text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-rose-400" />
                    <span>تسجيل الخروج</span>
                  </button>
                )}
              </div>
            </div>
          </form>
        </section>

        <PortalSupportModal
          isOpen={isSupportModalOpen}
          onClose={() => setIsSupportModalOpen(false)}
          currentUserUid={courierUid || currentCourier.id}
          userName={currentCourier.name}
          userPhone={currentCourier.phone}
          userEmail={courierEmail}
          userRole="courier"
          onNotify={onNotify}
        />

        <ConfirmActionModal
          isOpen={confirmLogoutOpen}
          title="تسجيل الخروج من بوابة المندوب"
          description="هل تريد إنهاء جلستك الحالية؟"
          confirmLabel="تسجيل الخروج"
          cancelLabel="إلغاء"
          tone="warning"
          onConfirm={() => {
            setConfirmLogoutOpen(false);
            onLogout?.();
          }}
          onCancel={() => setConfirmLogoutOpen(false)}
        />
      </div>
    );
  }

  // Gate 2: Approved Courier Workspace
  const completedOrders = orders.filter((o) => o.status === 'delivered');

  function findStoreRecord(storeId: string): StoreRecord | null {
    return stores.find((s) => s.id === storeId) ?? null;
  }

  function findStoreNeighborhood(storeId: string): string {
    return findStoreRecord(storeId)?.neighborhood ?? 'شارع البحر';
  }

  function getNextWaypoint(currentLocation?: string): string {
    if (!currentLocation) return EDKU_ROUTE_WAYPOINTS[1];
    const idx = EDKU_ROUTE_WAYPOINTS.indexOf(currentLocation);
    if (idx < 0 || idx >= EDKU_ROUTE_WAYPOINTS.length - 1) {
      return EDKU_ROUTE_WAYPOINTS[EDKU_ROUTE_WAYPOINTS.length - 1];
    }
    return EDKU_ROUTE_WAYPOINTS[idx + 1];
  }

  function getWaypointProgressIndex(currentLocation?: string): number {
    if (!currentLocation) return 0;
    const idx = EDKU_ROUTE_WAYPOINTS.indexOf(currentLocation);
    return idx >= 0 ? idx : 1;
  }

  function computeInterpolatedWaypointCoords(
    order: OrderRecord,
    nextLocationLabel: string
  ): { lat: number; lng: number } {
    if (liveCoords) return liveCoords;
    const storeRec = findStoreRecord(order.storeId);
    const start =
      storeRec?.lat && storeRec?.lng
        ? { lat: storeRec.lat, lng: storeRec.lng }
        : resolveEdkuCoordsForNeighborhood(
            storeRec?.neighborhood ?? 'شارع البحر'
          );
    const end =
      order.customerLat && order.customerLng
        ? { lat: order.customerLat, lng: order.customerLng }
        : resolveEdkuCoordsForNeighborhood(order.deliveryNeighborhood);
    const stepIdx = getWaypointProgressIndex(nextLocationLabel);
    const ratio = Math.min(
      0.95,
      Math.max(0.15, (stepIdx + 1) / EDKU_ROUTE_WAYPOINTS.length)
    );
    return {
      lat: Number((start.lat + (end.lat - start.lat) * ratio).toFixed(6)),
      lng: Number((start.lng + (end.lng - start.lng) * ratio).toFixed(6)),
    };
  }

  async function handleToggleOnline() {
    if (!currentCourier) return;
    setActionError(null);
    setBusyActionId('toggle_online');
    try {
      await onToggleAvailability(!currentCourier.isAvailable);
    } catch (err) {
      setActionError(
        formatAppErrorMessage(err, 'تعذر تحديث حالة توفر الكابتن.')
      );
    } finally {
      setBusyActionId(null);
    }
  }

  async function handleSaveProfileSubmit(e: FormEvent) {
    e.preventDefault();
    if (!currentCourier) return;
    setProfileError(null);
    setActionError(null);
    const payload: CourierProfileInput = {
      name: nameInput,
      phone: phoneInput,
      vehicleType: vehicleInput,
      neighborhood: neighborhoodInput,
      lat: latInput,
      lng: lngInput,
      isAvailable: currentCourier.isAvailable,
    };
    if (courierWaterPin) {
      setProfileError('لا يمكن تثبيت نقطة تمركز الكابتن فوق مياه البحر المتوسط أو بحيرة إدكو. اختر موقعاً على اليابسة.');
      return;
    }
    const check = validateCourierProfile(payload);
    if (!check.valid) {
      setProfileError(Object.values(check.errors)[0]);
      return;
    }
    setBusyActionId('save_profile');
    try {
      await onSaveCourierProfile(payload);
      setEditingProfile(false);
    } catch (err) {
      setProfileError(
        formatAppErrorMessage(err, 'تعذر حفظ بيانات وموقع الكابتن.')
      );
    } finally {
      setBusyActionId(null);
    }
  }

  async function handlePickup(order: OrderRecord) {
    if (!currentCourier) return;
    setActionError(null);
    const storeRec = findStoreRecord(order.storeId);
    const startLoc =
      EDKU_ROUTE_WAYPOINTS[1] ||
      `استلام من ${order.storeName} (${findStoreNeighborhood(order.storeId)})`;
    const pickupCoords =
      liveCoords ??
      (storeRec?.lat && storeRec?.lng
        ? { lat: storeRec.lat, lng: storeRec.lng }
        : resolveEdkuCoordsForNeighborhood(
            storeRec?.neighborhood ?? 'شارع البحر'
          ));

    setBusyActionId(order.id);
    try {
      await onPickupOrder(
        order.id,
        currentCourier.name,
        currentCourier.phone,
        startLoc,
        pickupCoords
      );
    } catch (err) {
      setActionError(
        formatAppErrorMessage(err, 'تعذر استلام الطلب من المتجر.')
      );
    } finally {
      setBusyActionId(null);
    }
  }

  async function handleAdvanceWaypoint(order: OrderRecord) {
    if (!currentCourier) return;
    setActionError(null);
    const nextLoc = getNextWaypoint(order.courierLocation);
    const nextCoords = computeInterpolatedWaypointCoords(order, nextLoc);
    setLiveCoords(nextCoords);
    setBusyActionId(`loc_${order.id}`);
    try {
      await onUpdateOrderLocation(
        order.id,
        currentCourier.name,
        currentCourier.phone,
        nextLoc,
        nextCoords
      );
    } catch (err) {
      setActionError(
        formatAppErrorMessage(err, 'تعذر تحديث موقع التوصيل المباشر.')
      );
    } finally {
      setBusyActionId(null);
    }
  }

  async function handleReleaseOrderClick(order: OrderRecord) {
    if (!onReleaseOrder) return;
    setActionError(null);
    setBusyActionId(`rel_${order.id}`);
    try {
      await onReleaseOrder(order.id);
    } catch (err) {
      setActionError(
        formatAppErrorMessage(err, 'تعذر إلغاء استلام الطلب وإعادته للقائمة.')
      );
    } finally {
      setBusyActionId(null);
    }
  }

  async function handleFinishDelivery(order: OrderRecord) {
    setActionError(null);
    const destCoords =
      order.customerLat && order.customerLng
        ? { lat: order.customerLat, lng: order.customerLng }
        : resolveEdkuCoordsForNeighborhood(order.deliveryNeighborhood);
    setBusyActionId(`done_${order.id}`);
    try {
      await onCompleteDelivery(
        order.id,
        `تم التسليم في ${order.deliveryNeighborhood}`,
        destCoords
      );
      if (currentCourier?.id && order.deliveryFee > 0) {
        await incrementCourierWalletBalance(currentCourier.id, order.deliveryFee).catch(() => {});
      }
      if (gpsMode === 'edku_sim' && activeDeliveries.length <= 1) {
        setGpsMode('off');
        setGpsStatusMsg(null);
      }
    } catch (err) {
      setActionError(
        formatAppErrorMessage(err, 'تعذر تأكيد إتمام توصيل الطلب.')
      );
    } finally {
      setBusyActionId(null);
    }
  }

  async function handleSubmitErrandQuote(order: OrderRecord) {
    if (!onQuoteCustomErrand) return;
    setActionError(null);
    const rawFee = errandQuoteByOrder[order.id] ?? '25';
    const parsedFee = Math.trunc(Number(rawFee));
    if (!Number.isFinite(parsedFee) || parsedFee < 10 || parsedFee > 500) {
      setActionError('يرجى تحديد تكلفة مشوار صحيحة بين ١٠ و ٥٠٠ ج.م.');
      return;
    }
    setBusyActionId(`quote_${order.id}`);
    try {
      await onQuoteCustomErrand(order, parsedFee, effectiveCourierCoords);
    } catch (err) {
      setActionError(
        formatAppErrorMessage(err, 'تعذر إرسال عرض تكلفة المشوار للعميل.')
      );
    } finally {
      setBusyActionId(null);
    }
  }

  const displayRating = (currentCourier.rating ?? 5.0).toFixed(1);
  const nowEscrowMs = Date.now();
  const escrowWindowMs = 24 * 60 * 60 * 1000;
  const pendingEscrowEgp =
    Math.round(
      completedOrders.reduce((acc, o) => {
        const ts = Date.parse(o.deliveredAtIso || o.createdAtIso || '');
        if (Number.isFinite(ts) && nowEscrowMs - ts < escrowWindowMs) {
          return acc + Number(o.deliveryFee || 0);
        }
        return acc;
      }, 0) * 100
    ) / 100;
  const walletBalanceTotal = Number(currentCourier.walletBalance ?? 0);
  const availableEscrowEgp = Math.max(
    0,
    Math.round((walletBalanceTotal - pendingEscrowEgp) * 100) / 100
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-7 sm:py-10 space-y-6 edkawi-page-enter">
      {actionError && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs sm:text-sm font-bold flex items-center justify-between gap-3"
        >
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="px-3 py-1 rounded-lg bg-[#0F172A] border border-rose-700 text-rose-300 text-xs font-bold cursor-pointer shrink-0"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Top Driver Control Strip */}
      <section
        aria-label="حالة توفر المندوب"
        className="bg-[#1E293B] border border-[#334155] text-[#F8FAFC] rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
      >
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold text-[#FF6B00]">
              كابتن توصيل إدكاوي المعتمد · مدينة إدكو
            </p>
            {surgeEnabled && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#FF6B00]/20 border border-[#FF6B00]/50 text-[#FF6B00] text-xs font-bold font-mono tabular-nums">
                <Zap className="w-3.5 h-3.5" />
                <span>×{surgeMultiplier} ذروة نشطة</span>
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-[#F8FAFC] tracking-wide">
              {currentCourier.name}
            </h1>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-300 tabular-nums">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span>{displayRating}</span>
              {typeof currentCourier.reviewCount === 'number' &&
                currentCourier.reviewCount > 0 && (
                  <span className="text-[#94A3B8] font-normal">
                    ({currentCourier.reviewCount} تقييم)
                  </span>
                )}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#94A3B8]">
            <span dir="ltr" className="font-mono tabular-nums text-[#F8FAFC]">
              {currentCourier.phone}
            </span>{' '}
            · {currentCourier.vehicleType} · تمركز:{' '}
            {currentCourier.neighborhood} · توصيلات مكتملة:{' '}
            <span className="font-mono font-bold text-[#F8FAFC] tabular-nums">
              {Math.max(
                currentCourier.completedDeliveries,
                completedOrders.length
              )}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-950/60 border border-emerald-800/70 text-emerald-300 text-xs font-bold font-mono tabular-nums">
              <span>متاح للسحب: {availableEscrowEgp} ج.م</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-950/60 border border-amber-800/70 text-amber-300 text-xs font-bold font-mono tabular-nums">
              <span>معلق ٢٤ ساعة: {pendingEscrowEgp} ج.م</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#FF6B00]/15 border border-[#FF6B00]/40 text-[#FF6B00] text-xs font-bold font-mono tabular-nums">
              <span>إكراميات العملاء (Tips): {currentCourier.totalTipsEgp ?? 0} ج.م</span>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsSupportModalOpen(true)}
            className="min-h-[48px] px-4 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <Headphones className="w-4 h-4" aria-hidden="true" />
            <span>الدعم الفني</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setNameInput(currentCourier.name);
              setPhoneInput(currentCourier.phone);
              setVehicleInput(currentCourier.vehicleType);
              setNeighborhoodInput(currentCourier.neighborhood);
              const fallback = resolveEdkuCoordsForNeighborhood(
                currentCourier.neighborhood
              );
              setLatInput(currentCourier.lat ?? fallback.lat);
              setLngInput(currentCourier.lng ?? fallback.lng);
              setEditingProfile((prev) => !prev);
            }}
            className="min-h-[48px] px-4 rounded-2xl bg-[#0F172A] border border-[#334155] hover:border-[#FF6B00] text-[#F8FAFC] text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <UserCheck className="w-4 h-4 text-[#FF6B00]" aria-hidden="true" />
            <span>بياناتي وموقعي على الخريطة</span>
          </button>

          <button
            type="button"
            disabled={busyActionId === 'toggle_online'}
            onClick={() => void handleToggleOnline()}
            className={`min-h-[48px] px-5 rounded-2xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] whitespace-nowrap ${
              currentCourier.isAvailable
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-[#0F172A] border border-[#334155] hover:border-[#FF6B00] text-[#94A3B8]'
            }`}
          >
            <Power className="w-4 h-4" aria-hidden="true" />
            <span>
              {currentCourier.isAvailable
                ? 'الحالة: متاح لاستلام الطلبات'
                : 'الحالة: غير متاح حالياً'}
            </span>
          </button>

          {onLogout && (
            <button
              type="button"
              onClick={() => setConfirmLogoutOpen(true)}
              aria-label="تسجيل الخروج"
              className="min-h-[48px] px-3.5 rounded-2xl bg-rose-950/40 border border-rose-800/70 hover:bg-rose-950/70 text-rose-200 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              <span>خروج</span>
            </button>
          )}
        </div>
      </section>

      {/* Live GPS & Edku Simulation Control Bar */}
      <section
        aria-label="بث الموقع الحي على خريطة جوجل"
        className="rounded-2xl bg-[#1E293B] border border-[#334155] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div className="space-y-1">
          <h2 className="text-sm sm:text-base font-bold text-[#F8FAFC] flex items-center gap-2">
            <LocateFixed
              className="w-4 h-4 text-[#FF6B00]"
              aria-hidden="true"
            />
            <span>بث موقع الاسكوتر الحي للعميل على Google Maps</span>
          </h2>
          <p className="text-xs text-[#94A3B8]">
            {gpsStatusMsg ||
              'فعّل GPS الحقيقي أو وضع المحاكاة داخل شوارع إدكو ليتحرك الاسكوتر في الوقت الحقيقي على شاشة تتبع العميل.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() =>
              setGpsMode((prev) => (prev === 'real_gps' ? 'off' : 'real_gps'))
            }
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              gpsMode === 'real_gps'
                ? 'bg-[#FF6B00] text-white'
                : 'border border-[#334155] bg-[#0F172A] text-[#F8FAFC] hover:border-[#FF6B00]'
            }`}
          >
            <LocateFixed className="w-4 h-4" aria-hidden="true" />
            <span>
              {gpsMode === 'real_gps' ? 'إيقاف GPS الحي' : 'موقع GPS الحقيقي'}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setGpsMode((prev) => (prev === 'edku_sim' ? 'off' : 'edku_sim'))
            }
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              gpsMode === 'edku_sim'
                ? 'bg-[#FF6B00] text-white'
                : 'border border-[#334155] bg-[#0F172A] text-[#F8FAFC] hover:border-[#FF6B00]'
            }`}
          >
            {gpsMode === 'edku_sim' ? (
              <>
                <Square
                  className="w-3.5 h-3.5 text-white"
                  aria-hidden="true"
                />
                <span>إيقاف محاكاة إدكو</span>
              </>
            ) : (
              <>
                <Play
                  className="w-3.5 h-3.5 text-[#FF6B00]"
                  aria-hidden="true"
                />
                <span>وضع محاكاة داخل إدكو</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* Edit Courier Profile + Interactive Map Pin */}
      {editingProfile && (
        <form
          onSubmit={handleSaveProfileSubmit}
          className="rounded-2xl bg-[#1E293B] border border-[#334155] p-6 space-y-5"
        >
          <h2 className="text-base font-bold text-[#F8FAFC]">
            تحديث بيانات الكابتن وتحديد موقع التمركز على خريطة إدكو
          </h2>
          {profileError && (
            <p role="alert" className="text-xs font-bold text-rose-400">
              {profileError}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="courier-name-input"
                className="block text-xs font-bold text-[#F8FAFC] mb-1"
              >
                اسم الكابتن
              </label>
              <input
                id="courier-name-input"
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={80}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] bg-[#0F172A] text-[#F8FAFC] text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="courier-phone-input"
                className="block text-xs font-bold text-[#F8FAFC] mb-1"
              >
                رقم الموبايل (١١ رقماً)
              </label>
              <input
                id="courier-phone-input"
                type="tel"
                dir="ltr"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                maxLength={11}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] bg-[#0F172A] text-[#F8FAFC] text-sm font-mono tabular-nums text-left"
              />
            </div>

            <div>
              <label
                htmlFor="courier-vehicle-input"
                className="block text-xs font-bold text-[#F8FAFC] mb-1"
              >
                وسيلة التوصيل
              </label>
              <select
                id="courier-vehicle-input"
                value={vehicleInput}
                onChange={(e) =>
                  setVehicleInput(e.target.value as CourierVehicleType)
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#334155] bg-[#0F172A] text-[#F8FAFC] text-sm"
              >
                {COURIER_VEHICLE_TYPES.map((vt) => (
                  <option key={vt} value={vt}>
                    {vt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <EdkuLocationPickerMap
            label="حدد موقع تمركزك الحالي أو ابحث عنه على الخريطة"
            helperText="ابحث عن معلم قريب منك أو اضغط (تلقائي GPS) لتثبيت نقطة تمركزك الحقيقية بدقة"
            lat={latInput}
            lng={lngInput}
            neighborhood={neighborhoodInput}
            autoLocateOnMount={typeof currentCourier.lat !== 'number'}
            onWaterValidationChange={setCourierWaterPin}
            onChange={(picked) => {
              setLatInput(picked.lat);
              setLngInput(picked.lng);
              setNeighborhoodInput(picked.neighborhood);
            }}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsDeleteAccountOpen(true);
                setDeleteAccountError(null);
              }}
              className="py-2 px-3.5 rounded-xl border border-rose-800/70 bg-rose-950/30 hover:bg-rose-950/60 text-rose-400 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>حذف حساب المندوب نهائياً</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setEditingProfile(false)}
                className="min-h-[44px] px-4 rounded-xl border border-[#334155] bg-[#0F172A] text-xs font-bold text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={busyActionId === 'save_profile'}
                className="min-h-[44px] px-6 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs sm:text-sm font-bold cursor-pointer"
              >
                حفظ البيانات والموقع
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Multi-Stop Route & Edku Thermal Demand Heatmap */}
      <CourierMultiStopAndHeatmapMap
        courierCoords={effectiveCourierCoords}
        courierName={currentCourier.name}
        activeDeliveries={activeDeliveries}
        allPoolOrders={readyToPickupOrders}
      />

      {/* Responsive 2-Column Driver Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        <section
          aria-labelledby="courier-active-heading"
          className="lg:col-span-7 rounded-2xl bg-[#1E293B] border border-[#334155] p-6 sm:p-7 space-y-6"
        >
          <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#334155]">
            <div className="flex items-center gap-2.5">
              <Navigation
                className="w-5 h-5 text-[#FF6B00]"
                aria-hidden="true"
              />
              <h2
                id="courier-active-heading"
                className="text-lg sm:text-xl font-bold text-[#F8FAFC]"
              >
                التوصيلة الجارية الآن (
                <span className="font-mono tabular-nums">
                  {activeDeliveries.length}
                </span>
                )
              </h2>
            </div>
          </div>

          {activeDeliveries.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <Truck
                className="w-10 h-10 text-[#94A3B8]/50 mx-auto"
                aria-hidden="true"
              />
              <h3 className="text-base font-bold text-[#F8FAFC]">
                لا توجد توصيلة جارية في الطريق حالياً
              </h3>
              <p className="text-xs sm:text-sm text-[#94A3B8] max-w-md mx-auto leading-relaxed">
                عند استلام أي طلب جاهز من قائمة &quot;طلبات جاهزة للاستلام&quot;، تفتح هنا خريطة التتبع وأزرار التسليم الكبيرة.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {activeDeliveries.map((order) => {
                const matchedStore = findStoreRecord(order.storeId);
                const storeArea = matchedStore?.neighborhood ?? 'شارع البحر';
                const distanceKm = estimateEdkuDistanceKm(
                  storeArea,
                  order.deliveryNeighborhood
                );
                const stepIdx = getWaypointProgressIndex(order.courierLocation);
                const progressPct = Math.min(
                  100,
                  Math.round(
                    ((stepIdx + 1) / EDKU_ROUTE_WAYPOINTS.length) * 100
                  )
                );
                const isPharmacyBag =
                  order.orderType === 'pharmacy_prescription';

                return (
                  <div key={order.id} className="space-y-5">
                    <LiveOrderScooterMap
                      order={{
                        ...order,
                        courierLat: liveCoords?.lat ?? order.courierLat,
                        courierLng: liveCoords?.lng ?? order.courierLng,
                      }}
                      store={matchedStore}
                    />

                    <div className="px-4 py-3 rounded-2xl bg-[#0F172A] border border-[#334155] flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-[#F8FAFC]">
                        الموقع الحالي المسجل:{' '}
                        <span className="text-[#FF6B00]">
                          {order.courierLocation || EDKU_ROUTE_WAYPOINTS[1]}
                        </span>
                      </span>
                      <span className="font-mono font-bold text-[#94A3B8] tabular-nums">
                        المسافة: {distanceKm} كم · التقدم: {progressPct}%
                      </span>
                    </div>

                    <div className="space-y-2 text-sm">
                      {isPharmacyBag && (
                        <span className="inline-flex items-center gap-1.5 text-teal-300 text-xs font-bold">
                          <Pill className="w-3.5 h-3.5" />
                          <span>شنطة أدوية صيدلية</span>
                        </span>
                      )}
                      {order.orderType === 'custom_errand' && (
                        <div className="p-3 rounded-xl bg-[#0F172A] border border-[#334155] space-y-1 text-xs">
                          <p className="font-bold text-[#FF6B00] flex items-center gap-1.5">
                            <Bike className="w-4 h-4" />
                            <span>مشوار مخصص معتمد من العميل</span>
                          </p>
                          {order.errandPickupAddress && (
                            <p className="font-bold text-[#F8FAFC]">
                              استلام من: {order.errandPickupAddress}
                            </p>
                          )}
                          {order.errandDescription && (
                            <p className="text-[#94A3B8]">
                              تفاصيل المشوار: {order.errandDescription}
                            </p>
                          )}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-lg font-bold text-[#F8FAFC]">
                          المستلم: {order.customerName}
                        </h3>
                        <span className="text-lg font-bold text-[#FF6B00]">
                          المطلوب تحصيله نقداً:{' '}
                          <span className="font-mono tabular-nums">
                            {order.totalAmount}
                          </span>{' '}
                          ج.م
                        </span>
                      </div>
                      <p className="text-[#94A3B8]">
                        العنوان المحدد على الخريطة: {order.deliveryNeighborhood}{' '}
                        — {order.deliveryAddress}
                      </p>
                      <p className="text-xs text-[#94A3B8]">
                        المصدر: {order.storeName} · الأصناف:{' '}
                        {order.itemsSummary} ·{' '}
                        {getPaymentMethodLabel(order.paymentMethod)}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                      <button
                        type="button"
                        disabled={busyActionId === `loc_${order.id}`}
                        onClick={() => void handleAdvanceWaypoint(order)}
                        className="min-h-[58px] px-5 rounded-2xl bg-[#0F172A] hover:border-[#FF6B00] border border-[#334155] active:scale-[0.98] text-[#F8FAFC] text-sm sm:text-base font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <MapPin
                          className="w-5 h-5 text-[#FF6B00]"
                          aria-hidden="true"
                        />
                        <span>تحديث موقعي على الخريطة</span>
                      </button>

                      <a
                        href={`tel:${order.customerPhone}`}
                        className="min-h-[58px] px-5 rounded-2xl bg-[#0F172A] border border-[#334155] hover:border-[#FF6B00] text-[#F8FAFC] text-sm sm:text-base font-bold inline-flex items-center justify-center gap-2"
                      >
                        <Phone
                          className="w-5 h-5 text-[#FF6B00]"
                          aria-hidden="true"
                        />
                        <span>
                          اتصال بالعميل (
                          <span dir="ltr" className="font-mono tabular-nums">
                            {order.customerPhone}
                          </span>
                          )
                        </span>
                      </a>
                    </div>

                    <button
                      type="button"
                      disabled={busyActionId === `done_${order.id}`}
                      onClick={() => void handleFinishDelivery(order)}
                      className="w-full min-h-[64px] px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60 text-white text-base sm:text-lg font-bold inline-flex items-center justify-center gap-2.5 cursor-pointer shadow-md"
                    >
                      <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
                      <span>
                        {busyActionId === `done_${order.id}`
                          ? 'جارٍ تأكيد التسليم...'
                          : 'تم التوصيل بنجاح وتسليم الطلب للعميل'}
                      </span>
                    </button>

                    {onReleaseOrder && (
                      <button
                        type="button"
                        disabled={busyActionId === `rel_${order.id}`}
                        onClick={() => setConfirmReleaseOrder(order)}
                        className="w-full min-h-[46px] px-4 rounded-xl border border-rose-800/70 bg-rose-950/30 hover:bg-rose-950/60 disabled:opacity-60 text-rose-300 text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" aria-hidden="true" />
                        <span>
                          {busyActionId === `rel_${order.id}`
                            ? 'جارٍ إعادة الطلب للقائمة...'
                            : 'إلغاء استلام الطلب وإعادته لقائمة المناديب'}
                        </span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section
          aria-labelledby="courier-ready-heading"
          className="lg:col-span-5 rounded-2xl bg-[#1E293B] border border-[#334155] p-6 sm:p-7 space-y-5"
        >
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-[#334155]">
            <div className="flex items-center gap-2">
              <PackageCheck
                className="w-5 h-5 text-[#FF6B00]"
                aria-hidden="true"
              />
              <h2
                id="courier-ready-heading"
                className="text-lg font-bold text-[#F8FAFC]"
              >
                طلبات جاهزة للاستلام (
                <span className="font-mono tabular-nums">
                  {readyToPickupOrders.length}
                </span>
                )
              </h2>
            </div>
          </div>

          {readyToPickupOrders.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
                لا توجد طلبات أو شنط صيدلية جاهزة للاستلام حالياً. بمجرد تجهيز أي متجر أو صيدلية لطلب جديد سيظهر هنا فوراً لاستلامه.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#334155]">
              {readyToPickupOrders.map((order) => {
                const storeArea = findStoreNeighborhood(order.storeId);
                const distanceKm = estimateEdkuDistanceKm(
                  storeArea,
                  order.deliveryNeighborhood
                );
                const isPicking = busyActionId === order.id;
                const isQuoting = busyActionId === `quote_${order.id}`;
                const isBagReady = order.status === 'ready';
                const isPharmacyBag =
                  order.orderType === 'pharmacy_prescription';
                const isCustomErrand = order.orderType === 'custom_errand';

                return (
                  <article
                    key={order.id}
                    className="py-5 first:pt-1 last:pb-1 space-y-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#94A3B8]">
                        <div className="flex items-center gap-2">
                          <span
                            dir="ltr"
                            className="font-mono font-bold text-[#F8FAFC] tabular-nums"
                          >
                            #{order.id.slice(0, 8)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={`font-bold ${
                              isBagReady
                                ? 'text-emerald-400'
                                : order.status === 'preparing'
                                ? 'text-amber-400'
                                : 'text-[#FF6B00]'
                            }`}
                          >
                            {isCustomErrand
                              ? order.status ===
                                'awaiting_customer_errand_approval'
                                ? 'مشوار بانتظار موافقة العميل'
                                : 'طلب مشوار جديد يحتاج تسعير التوصيل'
                              : isPharmacyBag
                              ? 'شنطة أدوية جاهزة بالصيدلية'
                              : isBagReady
                              ? 'جاهز للاستلام الآن من المتجر'
                              : order.status === 'preparing'
                              ? 'قيد التحضير في المتجر'
                              : 'طلب جديد متاح للاستلام'}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-[#FF6B00] tabular-nums">
                          المسافة: {distanceKm} كم
                        </span>
                      </div>

                      {isPharmacyBag && (
                        <span className="inline-flex items-center gap-1.5 text-teal-300 text-[11px] font-bold">
                          <Pill className="w-3.5 h-3.5" />
                          <span>نظام صيدليات إدكاوي</span>
                        </span>
                      )}

                      {isCustomErrand ? (
                        <div className="space-y-1.5 pt-1">
                          <h3 className="text-base font-bold text-[#F8FAFC] flex items-center gap-1.5">
                            <Bike className="w-4 h-4 text-[#FF6B00]" />
                            <span>
                              استلام من:{' '}
                              {order.errandPickupAddress || 'داخل مدينة إدكو'}
                            </span>
                          </h3>
                          <p className="text-sm text-[#F8FAFC] font-semibold">
                            توصيل إلى منطقة: {order.deliveryNeighborhood}
                          </p>
                          <p className="text-xs text-[#94A3B8] leading-relaxed">
                            تفاصيل المشوار:{' '}
                            {order.errandDescription || order.itemsSummary}
                          </p>
                        </div>
                      ) : (
                        <>
                          <h3 className="text-base font-bold text-[#F8FAFC]">
                            استلام من: {order.storeName} ({storeArea})
                          </h3>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm text-[#94A3B8] font-semibold">
                              توصيل إلى: {order.deliveryNeighborhood}
                            </span>
                            {order.zoneName && (
                              <span className="px-2.5 py-0.5 rounded-lg bg-[#FF6B00]/15 border border-[#FF6B00]/40 text-[#FF6B00] text-xs font-bold">
                                {order.zoneName} · توصيل: {order.deliveryFee} ج.م
                              </span>
                            )}
                          </div>
                          {typeof order.smallOrderFee === 'number' && order.smallOrderFee > 0 && (
                            <p className="text-[11px] text-amber-400 font-bold">
                              يشمل رسم طلب صغير: +{order.smallOrderFee} ج.م
                            </p>
                          )}
                          <p className="text-xs text-[#94A3B8]">
                            الأصناف: {order.itemsSummary} · الإجمالي:{' '}
                            <span className="font-mono font-bold text-[#F8FAFC] tabular-nums">
                              {order.totalAmount}
                            </span>{' '}
                            ج.م ({getPaymentMethodLabel(order.paymentMethod)})
                          </p>
                        </>
                      )}
                    </div>

                    {isCustomErrand ? (
                      order.status === 'awaiting_customer_errand_approval' ? (
                        <div className="p-3.5 rounded-2xl bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-xs sm:text-sm font-bold flex items-center justify-between gap-3">
                          <span>
                            تم إرسال عرضك ({order.totalAmount} ج.م) — بانتظار موافقة العميل للبدء فوراً
                          </span>
                          <Clock className="w-4 h-4 text-[#FF6B00] shrink-0" />
                        </div>
                      ) : (
                        <div className="space-y-2.5 pt-1">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={10}
                              max={500}
                              dir="ltr"
                              value={errandQuoteByOrder[order.id] ?? '25'}
                              onChange={(e) =>
                                setErrandQuoteByOrder((prev) => ({
                                  ...prev,
                                  [order.id]: e.target.value,
                                }))
                              }
                              placeholder="25"
                              aria-label="تكلفة توصيل المشوار بالجنيه"
                              className="w-28 min-h-[48px] px-3 py-2 rounded-xl border border-[#334155] bg-[#0F172A] text-sm font-mono font-bold text-[#F8FAFC] text-center tabular-nums"
                            />
                            <span className="text-xs font-bold text-[#94A3B8]">
                              ج.م تكلفة توصيل المشوار المقترحة
                            </span>
                          </div>
                          <button
                            type="button"
                            disabled={isQuoting}
                            onClick={() => void handleSubmitErrandQuote(order)}
                            className="w-full min-h-[54px] px-5 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] active:scale-[0.98] disabled:opacity-60 text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Send className="w-4 h-4" aria-hidden="true" />
                            <span>
                              {isQuoting
                                ? 'جارٍ إرسال العرض للعميل...'
                                : 'إرسال عرض تكلفة المشوار للعميل'}
                            </span>
                          </button>
                        </div>
                      )
                    ) : (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={isPicking || busyActionId === `reject_${order.id}`}
                          onClick={() => void handlePickup(order)}
                          className="flex-1 min-h-[58px] px-4 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] active:scale-[0.98] disabled:opacity-60 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer shadow-[0_8px_20px_-4px_rgba(255,107,0,0.4)]"
                        >
                          <Truck className="w-4 h-4" aria-hidden="true" />
                          <span>
                            {isPicking
                              ? 'جارٍ تسجيل الاستلام...'
                              : isPharmacyBag
                              ? 'استلام شنطة الأدوية والانطلاق'
                              : 'استلام الطلب والانطلاق'}
                          </span>
                        </button>
                        <button
                          type="button"
                          disabled={isPicking || busyActionId === `reject_${order.id}`}
                          onClick={() => setConfirmRejectOrderId(order.id)}
                          className="min-h-[58px] px-3.5 rounded-2xl border border-rose-800/70 bg-rose-950/30 text-rose-400 hover:bg-rose-950/60 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>{busyActionId === `reject_${order.id}` ? 'جارٍ الرفض...' : 'رفض الطلب'}</span>
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <PortalSupportModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
        currentUserUid={courierUid || currentCourier.id}
        userName={currentCourier.name}
        userPhone={currentCourier.phone}
        userEmail={courierEmail}
        userRole="courier"
        onNotify={onNotify}
      />

      {/* Courier Self-Service Delete Account Modal */}
      {isDeleteAccountOpen && (
        <div
          className="edkawi-modal-backdrop flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="rounded-2xl bg-[#1E293B] max-w-md w-full p-6 shadow-2xl space-y-4 border border-rose-800/70 text-[#F8FAFC]">
            <div className="w-12 h-12 rounded-2xl bg-rose-950/60 border border-rose-800/70 text-rose-400 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#F8FAFC]">
                حذف حساب المندوب نهائياً؟
              </h3>
              <p className="text-xs text-[#94A3B8] mt-1.5 leading-relaxed">
                هل أنت متأكد من رغبتك في حذف حساب المندوب نهائياً؟ سيتم مسح بيانات تسجيل الدخول وملف المندوب بالكامل من المنصة.
              </p>
            </div>

            {deleteAccountError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs font-semibold">
                {deleteAccountError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={deleteAccountBusy}
                onClick={() => setIsDeleteAccountOpen(false)}
                className="min-h-[44px] px-4 rounded-xl border border-[#334155] bg-[#0F172A] text-xs font-bold text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={deleteAccountBusy}
                onClick={() => void handleConfirmDeleteCourierAccount()}
                className="min-h-[44px] px-5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{deleteAccountBusy ? 'جارٍ الحذف...' : 'نعم، احذف حسابي نهائياً'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 30-Second Countdown Bottom Sheet for incoming order */}
      {incomingOrder && currentCourier?.isAvailable && (
        <div className="fixed inset-x-0 bottom-0 z-50 p-4 max-w-lg mx-auto pointer-events-auto">
          <div className="bg-[#1E293B] border-2 border-[#FF6B00] rounded-2xl p-5 shadow-2xl space-y-4 text-right dir-rtl" dir="rtl">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-[#FF6B00]/20 text-[#FF6B00] flex items-center justify-center">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-[#F8FAFC]">طلب توصيل جديد متاح!</h3>
                    {surgeEnabled && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#FF6B00]/20 text-[#FF6B00] text-[11px] font-bold font-mono tabular-nums">
                        <Zap className="w-3 h-3" />
                        <span>×{surgeMultiplier} ذروة</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#94A3B8]">من متجر {incomingOrder.storeName}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-[#FF6B00]/15 text-[#FF6B00] border border-[#FF6B00]/30 px-3 py-1 rounded-xl font-mono text-sm font-bold shrink-0">
                <Clock className="w-4 h-4" />
                <span>{countdownSeconds} ث</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-[#0F172A] rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-[#FF6B00] h-full transition-all duration-1000 ease-linear"
                style={{ width: `${(countdownSeconds / 30) * 100}%` }}
              />
            </div>

            <div className="bg-[#0F172A] border border-[#334155] rounded-xl p-3 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-[#94A3B8]">المتجر والاستلام:</span>
                <span className="font-semibold text-[#F8FAFC]">{findStoreNeighborhood(incomingOrder.storeId)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#94A3B8]">عنوان العميل والتسليم:</span>
                <span className="font-semibold text-[#F8FAFC]">{incomingOrder.deliveryNeighborhood} - {incomingOrder.deliveryAddress}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#94A3B8]">الأصناف:</span>
                <span className="font-semibold text-[#F8FAFC] truncate max-w-[200px]">{incomingOrder.itemsSummary || 'طلب وجبات'}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-[#334155]">
                <span className="text-[#94A3B8]">رسوم التوصيل للكابتن:</span>
                <span className="font-mono font-bold text-base text-[#FF6B00]">+{incomingOrder.deliveryFee} ج.م</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  const ord = incomingOrder;
                  setIncomingOrder(null);
                  void handlePickup(ord);
                }}
                className="py-3 px-4 bg-[#FF6B00] hover:bg-[#FF6B00]/90 text-white font-bold rounded-xl transition duration-200 flex items-center justify-center gap-2 text-sm shadow-lg shadow-[#FF6B00]/25 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>قبول فوراً</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const ordId = incomingOrder.id;
                  setLocallyRejectedOrderIds((prev) =>
                    prev.includes(ordId) ? prev : [...prev, ordId]
                  );
                  setIncomingOrder(null);
                  if (currentCourier) {
                    void rejectOrderByCourierInFirestore(ordId, currentCourier.id).catch(() => {});
                  }
                }}
                className="py-3 px-4 bg-[#0F172A] hover:bg-[#0F172A]/80 border border-[#334155] text-[#94A3B8] hover:text-rose-400 font-bold rounded-xl transition duration-200 flex items-center justify-center gap-1.5 text-sm cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
                <span>رفض الطلب</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmActionModal
        isOpen={Boolean(confirmReleaseOrder)}
        title="إلغاء استلام الطلب"
        description={
          confirmReleaseOrder
            ? `هل تريد إعادة الطلب #${confirmReleaseOrder.id.slice(0, 8)} إلى قائمة الطلبات المتاحة لباقي المناديب؟`
            : ''
        }
        confirmLabel="نعم، إعادة الطلب"
        cancelLabel="تراجع"
        tone="warning"
        isProcessing={Boolean(
          confirmReleaseOrder && busyActionId === `rel_${confirmReleaseOrder.id}`
        )}
        onConfirm={async () => {
          if (!confirmReleaseOrder) return;
          const target = confirmReleaseOrder;
          setConfirmReleaseOrder(null);
          await handleReleaseOrderClick(target);
        }}
        onCancel={() => setConfirmReleaseOrder(null)}
      />

      <ConfirmActionModal
        isOpen={Boolean(confirmRejectOrderId)}
        title="تأكيد رفض الطلب"
        description="هل أنت متأكد من رفض هذا الطلب؟ سيتم استبعاده من قائمتك وإتاحته للمناديب الآخرين."
        confirmLabel="نعم، رفض الطلب"
        cancelLabel="تراجع"
        tone="danger"
        isProcessing={Boolean(
          confirmRejectOrderId && busyActionId === `reject_${confirmRejectOrderId}`
        )}
        onConfirm={async () => {
          if (!confirmRejectOrderId) return;
          const targetId = confirmRejectOrderId;
          setConfirmRejectOrderId(null);
          await handleCourierRejectOrder(targetId);
        }}
        onCancel={() => setConfirmRejectOrderId(null)}
      />

      <ConfirmActionModal
        isOpen={confirmLogoutOpen}
        title="تسجيل الخروج من بوابة المندوب"
        description="هل تريد إنهاء جلستك الحالية وتسجيل الخروج؟"
        confirmLabel="تسجيل الخروج"
        cancelLabel="البقاء متصلاً"
        tone="warning"
        onConfirm={() => {
          setConfirmLogoutOpen(false);
          onLogout?.();
        }}
        onCancel={() => setConfirmLogoutOpen(false)}
      />
    </div>
  );
}
