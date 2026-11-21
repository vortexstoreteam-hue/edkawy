import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Pill,
  RefreshCw,
  ShoppingBag,
  Store,
  User as UserIcon,
} from 'lucide-react';
import { EDKU_CITY_CENTER } from '../data/edkuSeedStores';
import {
  formatFirebaseAuthError,
  loginAnonymously,
  loginUnifiedWithEmailAndPassword,
  loginWithGoogleCustomer,
  OFFICIAL_ADMIN_PORTAL_EMAIL,
  readPendingSessionReferralCode,
  registerAccountFromInvitationInFirestore,
  registerCustomerWithEmailAndPassword,
  reloadCurrentUserEmailVerified,
  requestAdminOtpFromServer,
  requestUserEmailVerificationOtp,
  resendVerificationEmailForCurrentUser,
  savePendingSessionReferralCode,
  sendFirebaseFallbackVerificationLink,
  sendPasswordResetEmailForUser,
  signInAndBootstrapAdmin,
  validateInvitationTokenInFirestore,
  verifyAdminOtpFromServer,
  verifyUserEmailVerificationOtp,
} from '../services/edkawiFirebaseService';
import {
  AdminOtpRequestResult,
  CourierVehicleType,
  EmailVerificationRequestResult,
  InvitationRecord,
  LegalSectionKey,
  PortalRole,
  StoreCategory,
} from '../types/edkawi';
import {
  COURIER_VEHICLE_TYPES,
  EDKU_NEIGHBORHOODS,
  formatAppErrorMessage,
  STORE_CATEGORIES,
} from '../utils/orderLogic';
import { AdkawyLogo } from './AdkawyLogo';
import { EdkuLocationPickerMap } from './EdkuGoogleMaps';

interface AuthScreenProps {
  onAuthTransitionStart: () => void;
  onAuthTransitionEnd: (
    resolvedRole?: PortalRole,
    needsProfileCompletion?: boolean
  ) => void;
  onFallbackGuestPreview?: () => void;
  hasPendingCartForCheckout?: boolean;
  onOpenLegalModal?: (section?: LegalSectionKey) => void;
  inviteToken?: string | null;
  onClearInviteToken?: () => void;
  referralCode?: string | null;
}

function GoogleBrandMark() {
  return (
    <svg
      className="w-4 h-4 shrink-0"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v2.98h3.86c2.26-2.09 3.56-5.17 3.56-8.8z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-2.98c-1.08.72-2.45 1.16-4.07 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.31c-.24-.72-.38-1.49-.38-2.31s.14-1.59.38-2.31V6.6H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.4l3.99-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.6l3.99 3.09c.95-2.85 3.6-4.94 6.72-4.94z"
      />
    </svg>
  );
}

export function AuthScreen({
  onAuthTransitionStart,
  onAuthTransitionEnd,
  onFallbackGuestPreview,
  hasPendingCartForCheckout = false,
  onOpenLegalModal,
  inviteToken = null,
  onClearInviteToken,
  referralCode = null,
}: AuthScreenProps) {
  const [authMode, setAuthMode] = useState<'login' | 'register_customer'>(
    referralCode ? 'register_customer' : 'login'
  );
  const [customerFullName, setCustomerFullName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>(
    {}
  );

  // Invitation Registration State (/register?token=...)
  const [inviteChecking, setInviteChecking] = useState<boolean>(
    Boolean(inviteToken)
  );
  const [inviteRecord, setInviteRecord] = useState<InvitationRecord | null>(
    null
  );
  const [inviteInvalidReason, setInviteInvalidReason] = useState<string | null>(
    null
  );
  const [inviteName, setInviteName] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteNeighborhood, setInviteNeighborhood] = useState<string>(
    EDKU_NEIGHBORHOODS[0]
  );
  const [inviteAddress, setInviteAddress] = useState('');
  const [inviteLat, setInviteLat] = useState<number>(EDKU_CITY_CENTER.lat);
  const [inviteLng, setInviteLng] = useState<number>(EDKU_CITY_CENTER.lng);
  const [inviteWaterPin, setInviteWaterPin] = useState(false);
  const [inviteStoreCategory, setInviteStoreCategory] =
    useState<StoreCategory>('أكل بيتي');
  const [inviteIsHomeFood, setInviteIsHomeFood] = useState(true);
  const [inviteStoreDesc, setInviteStoreDesc] = useState('');
  const [inviteVehicleType, setInviteVehicleType] =
    useState<CourierVehicleType>('دراجة نارية');

  const activeRefCode =
    (referralCode || readPendingSessionReferralCode() || '').trim();

  useEffect(() => {
    if (referralCode && referralCode.trim()) {
      savePendingSessionReferralCode(referralCode.trim());
    }
  }, [referralCode]);

  useEffect(() => {
    if (!inviteToken || !inviteToken.trim()) {
      setInviteChecking(false);
      setInviteRecord(null);
      setInviteInvalidReason(null);
      return;
    }
    let cancelled = false;
    setInviteChecking(true);
    setInviteInvalidReason(null);
    void validateInvitationTokenInFirestore(inviteToken.trim())
      .then((res) => {
        if (cancelled) return;
        if (res.valid && res.invitation) {
          setInviteRecord(res.invitation);
          setInviteInvalidReason(null);
        } else {
          setInviteRecord(null);
          setInviteInvalidReason(
            res.reason || 'الدعوة غير صالحة أو منتهية الصلاحية.'
          );
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setInviteRecord(null);
        setInviteInvalidReason(
          formatAppErrorMessage(err, 'تعذر التحقق من رابط الدعوة حالياً.')
        );
      })
      .finally(() => {
        if (!cancelled) setInviteChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  const [step, setStep] = useState<
    'credentials' | 'admin_otp' | 'customer_email_otp' | 'reset_password'
  >('credentials');
  const [otpCode, setOtpCode] = useState('');
  const [customerOtpDigits, setCustomerOtpDigits] = useState<string[]>([
    '',
    '',
    '',
    '',
  ]);
  const customerOtpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [otpLockoutSeconds, setOtpLockoutSeconds] = useState(0);
  const [otpRequestMeta, setOtpRequestMeta] =
    useState<AdminOtpRequestResult | null>(null);
  const [emailVerifyMeta, setEmailVerifyMeta] =
    useState<EmailVerificationRequestResult | null>(null);
  const [copiedOtp, setCopiedOtp] = useState(false);

  const [busyMode, setBusyMode] = useState<
    | 'login'
    | 'register_customer'
    | 'register_invite'
    | 'verify_customer_email'
    | 'fallback_email_link'
    | 'google'
    | 'customer'
    | 'verify_otp'
    | 'resend_otp'
    | 'reset_password'
    | null
  >(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (otpLockoutSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setOtpLockoutSeconds((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [otpLockoutSeconds]);

  const inlineNameError =
    authMode === 'register_customer' &&
    touchedFields.name &&
    customerFullName.trim().length > 0 &&
    customerFullName.trim().length < 3
      ? 'الاسم يجب أن يكون ٣ أحرف على الأقل'
      : authMode === 'register_customer' &&
        touchedFields.name &&
        !customerFullName.trim()
      ? 'يرجى إدخال الاسم بالكامل'
      : null;

  const cleanPhoneInput = customerPhone.trim();
  const inlinePhoneError =
    authMode === 'register_customer' &&
    touchedFields.phone &&
    cleanPhoneInput.length > 0 &&
    !/^01[0125][0-9]{8}$/.test(cleanPhoneInput)
      ? 'رقم الموبايل يجب أن يبدأ بـ 010 أو 011 أو 012 أو 015 ومكون من ١١ رقم'
      : null;

  const inlineEmailError =
    touchedFields.email &&
    (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      ? 'يرجى إدخال بريد إلكتروني صحيح'
      : null;

  const inlinePasswordError =
    touchedFields.password && password.length < 6
      ? 'كلمة المرور يجب أن تكون ٦ أحرف أو أرقام على الأقل'
      : null;

  async function handleInvitationRegisterSubmit(e: FormEvent) {
    e.preventDefault();
    if (!inviteRecord || !inviteToken) return;
    setErrorMsg(null);

    if (
      (inviteRecord.userType === 'store' ||
        inviteRecord.userType === 'courier' ||
        inviteRecord.userType === 'customer') &&
      inviteWaterPin
    ) {
      setErrorMsg(
        'من فضلك اختر موقعاً على اليابسة داخل مدينة إدكو بعيداً عن المسطحات المائية.'
      );
      return;
    }

    setBusyMode('register_invite');
    onAuthTransitionStart();
    try {
      const { role } = await registerAccountFromInvitationInFirestore({
        token: inviteToken.trim(),
        name: inviteName.trim(),
        phone: invitePhone.trim(),
        password: invitePassword,
        neighborhood: inviteNeighborhood,
        address:
          inviteAddress.trim() ||
          `موقع محدد على الخريطة — ${inviteNeighborhood}`,
        lat: inviteLat,
        lng: inviteLng,
        storeCategory:
          inviteRecord.userType === 'store' ? inviteStoreCategory : undefined,
        storeDescription:
          inviteRecord.userType === 'store'
            ? inviteStoreDesc.trim() ||
              `${inviteStoreCategory} في ${inviteNeighborhood} — مدينة إدكو`
            : undefined,
        isHomeFood:
          inviteRecord.userType === 'store'
            ? inviteStoreCategory === 'أكل بيتي' || inviteIsHomeFood
            : undefined,
        vehicleType:
          inviteRecord.userType === 'courier' ? inviteVehicleType : undefined,
      });
      onClearInviteToken?.();
      onAuthTransitionEnd(role, false);
    } catch (err) {
      onAuthTransitionEnd();
      setErrorMsg(formatAppErrorMessage(err, 'تعذر إتمام التسجيل عبر الدعوة.'));
    } finally {
      setBusyMode(null);
    }
  }

  async function handleResetPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setResetSuccessMsg(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setErrorMsg('يرجى إدخال البريد الإلكتروني المسجل لإرسال رابط الاستعادة.');
      return;
    }

    setBusyMode('reset_password');
    try {
      const confirmationText =
        await sendPasswordResetEmailForUser(normalizedEmail);
      setResetSuccessMsg(confirmationText);
    } catch (err) {
      if (err instanceof Error && /[\u0600-\u06FF]/.test(err.message)) {
        setErrorMsg(err.message);
      } else {
        const formatted = formatFirebaseAuthError(err);
        setErrorMsg(formatted.message);
      }
    } finally {
      setBusyMode(null);
    }
  }

  async function handleRegisterCustomerSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setResetSuccessMsg(null);
    setTouchedFields({ name: true, phone: true, email: true, password: true });

    const cleanName = customerFullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = customerPhone.trim();
    if (cleanName.length < 3) {
      setErrorMsg('يرجى إدخال الاسم الثلاثي بالكامل (٣ أحرف على الأقل).');
      return;
    }
    if (cleanPhone.length > 0 && !/^01[0125][0-9]{8}$/.test(cleanPhone)) {
      setErrorMsg(
        'رقم الموبايل المصري غير صحيح — يجب أن يبدأ بـ 010 أو 011 أو 012 أو 015 ومكون من ١١ رقماً.'
      );
      return;
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('يرجى إدخال بريد إلكتروني صحيح لإنشاء الحساب.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMsg('يرجى اختيار كلمة مرور مكونة من ٦ أحرف أو أرقام على الأقل.');
      return;
    }

    setBusyMode('register_customer');
    try {
      const otpRes = await requestUserEmailVerificationOtp(cleanName, cleanEmail);
      setEmailVerifyMeta(otpRes);
      setOtpCode('');
      setCustomerOtpDigits(['', '', '', '']);
      setStep('customer_email_otp');
    } catch (err) {
      const retrySec = (err as { retryAfterSeconds?: number })?.retryAfterSeconds;
      if (typeof retrySec === 'number' && retrySec > 0) {
        setOtpLockoutSeconds(retrySec);
        setStep('customer_email_otp');
      }
      if (err instanceof Error && /[\u0600-\u06FF]/.test(err.message)) {
        setErrorMsg(err.message);
      } else {
        const formatted = formatFirebaseAuthError(err);
        setErrorMsg(formatted.message);
      }
    } finally {
      setBusyMode(null);
    }
  }

  async function handleVerifyCustomerEmailOtpSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (otpLockoutSeconds > 0) {
      setErrorMsg(
        `التحقق مقفل مؤقتاً بعد ٥ محاولات خاطئة. حاول بعد ${otpLockoutSeconds} ثانية.`
      );
      return;
    }
    const joinedCode = customerOtpDigits.join('').trim() || otpCode.trim();
    if (!/^[0-9]{4}$/.test(joinedCode)) {
      setErrorMsg('يرجى إدخال كود تفعيل البريد المكون من ٤ أرقام.');
      return;
    }

    setBusyMode('verify_customer_email');
    onAuthTransitionStart();
    try {
      await verifyUserEmailVerificationOtp(email.trim().toLowerCase(), joinedCode);
      const { role } = await registerCustomerWithEmailAndPassword(
        customerFullName.trim(),
        email.trim().toLowerCase(),
        password
      );
      onAuthTransitionEnd(role, true);
    } catch (err) {
      onAuthTransitionEnd();
      const retrySec = (err as { retryAfterSeconds?: number })?.retryAfterSeconds;
      if (typeof retrySec === 'number' && retrySec > 0) {
        setOtpLockoutSeconds(retrySec);
      }
      if (err instanceof Error && /[\u0600-\u06FF]/.test(err.message)) {
        setErrorMsg(err.message);
      } else {
        const formatted = formatFirebaseAuthError(err);
        setErrorMsg(formatted.message);
      }
    } finally {
      setBusyMode(null);
    }
  }

  async function handleRegisterWithFallbackLink() {
    setErrorMsg(null);
    setBusyMode('fallback_email_link');
    onAuthTransitionStart();
    try {
      const { role } = await registerCustomerWithEmailAndPassword(
        customerFullName.trim(),
        email.trim().toLowerCase(),
        password
      );
      await sendFirebaseFallbackVerificationLink().catch(() => {});
      onAuthTransitionEnd(role, true);
    } catch (err) {
      onAuthTransitionEnd();
      if (err instanceof Error && /[\u0600-\u06FF]/.test(err.message)) {
        setErrorMsg(err.message);
      } else {
        const formatted = formatFirebaseAuthError(err);
        setErrorMsg(formatted.message);
      }
    } finally {
      setBusyMode(null);
    }
  }

  async function handleResendCustomerEmailOtp() {
    setErrorMsg(null);
    if (otpLockoutSeconds > 0) {
      setErrorMsg(`يرجى الانتظار ${otpLockoutSeconds} ثانية قبل إعادة الطلب.`);
      return;
    }
    setBusyMode('resend_otp');
    try {
      const otpRes = await requestUserEmailVerificationOtp(
        customerFullName.trim(),
        email.trim().toLowerCase()
      );
      setEmailVerifyMeta(otpRes);
      setOtpCode('');
      setCustomerOtpDigits(['', '', '', '']);
      customerOtpRefs.current[0]?.focus();
    } catch (err) {
      const retrySec = (err as { retryAfterSeconds?: number })?.retryAfterSeconds;
      if (typeof retrySec === 'number' && retrySec > 0) {
        setOtpLockoutSeconds(retrySec);
      }
      setErrorMsg(
        err instanceof Error ? err.message : 'تعذر إعادة إرسال كود التفعيل.'
      );
    } finally {
      setBusyMode(null);
    }
  }

  async function handleUnifiedLoginSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setErrorMsg('يرجى إدخال البريد الإلكتروني بشكل صحيح.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMsg('يرجى إدخال كلمة المرور (٦ أحرف أو أرقام على الأقل).');
      return;
    }

    if (normalizedEmail === OFFICIAL_ADMIN_PORTAL_EMAIL) {
      setBusyMode('login');
      try {
        const otpRes = await requestAdminOtpFromServer(
          normalizedEmail,
          password
        );
        setOtpRequestMeta(otpRes);
        setOtpCode('');
        setStep('admin_otp');
      } catch (err) {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'بيانات الدخول الخاصة بالإدارة غير صحيحة.'
        );
      } finally {
        setBusyMode(null);
      }
      return;
    }

    setBusyMode('login');
    onAuthTransitionStart();
    try {
      const { role } = await loginUnifiedWithEmailAndPassword(
        normalizedEmail,
        password
      );
      onAuthTransitionEnd(role);
    } catch (err) {
      onAuthTransitionEnd();
      if (err instanceof Error && /[\u0600-\u06FF]/.test(err.message)) {
        setErrorMsg(err.message);
      } else {
        const formatted = formatFirebaseAuthError(err);
        setErrorMsg(formatted.message);
      }
    } finally {
      setBusyMode(null);
    }
  }

  async function handleVerifyAdminOtpSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedCode = otpCode.trim();
    if (!/^[0-9]{6}$/.test(trimmedCode)) {
      setErrorMsg('يرجى إدخال كود التحقق المكون من ٦ أرقام.');
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    setBusyMode('verify_otp');
    onAuthTransitionStart();
    try {
      const verifyRes = await verifyAdminOtpFromServer(
        normalizedEmail,
        trimmedCode
      );
      await signInAndBootstrapAdmin(
        normalizedEmail,
        password,
        verifyRes.adminBootstrapGate!
      );
      onAuthTransitionEnd('admin');
    } catch (err) {
      onAuthTransitionEnd();
      const formatted = formatFirebaseAuthError(err);
      setErrorMsg(formatted.message);
    } finally {
      setBusyMode(null);
    }
  }

  async function handleResendAdminOtp() {
    setErrorMsg(null);
    setBusyMode('resend_otp');
    try {
      const otpRes = await requestAdminOtpFromServer(
        email.trim().toLowerCase(),
        password
      );
      setOtpRequestMeta(otpRes);
      setOtpCode('');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'تعذر إعادة إرسال كود التحقق.'
      );
    } finally {
      setBusyMode(null);
    }
  }

  async function handleGoogleCustomerLogin() {
    setErrorMsg(null);
    setBusyMode('google');
    onAuthTransitionStart();
    try {
      const { role, needsProfileCompletion } = await loginWithGoogleCustomer();
      onAuthTransitionEnd(role, needsProfileCompletion);
    } catch (err) {
      onAuthTransitionEnd();
      const formatted = formatFirebaseAuthError(err);
      setErrorMsg(formatted.message);
    } finally {
      setBusyMode(null);
    }
  }

  async function handleAnonymousCustomerEntry() {
    setErrorMsg(null);
    setBusyMode('customer');
    onAuthTransitionStart();
    try {
      await loginAnonymously();
      onAuthTransitionEnd('customer');
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      if (
        (code === 'auth/operation-not-allowed' ||
          code === 'auth/admin-restricted-operation') &&
        onFallbackGuestPreview
      ) {
        onFallbackGuestPreview();
        onAuthTransitionEnd('customer');
        return;
      }
      onAuthTransitionEnd();
      const formatted = formatFirebaseAuthError(err);
      setErrorMsg(formatted.message);
    } finally {
      setBusyMode(null);
    }
  }

  async function handleCopyFallbackOtp(code: string) {
    setOtpCode(code);
    const digits = code.replace(/\D/g, '').slice(0, 4).split('');
    if (digits.length === 4) {
      setCustomerOtpDigits(digits);
    }
    try {
      await navigator.clipboard.writeText(code);
      setCopiedOtp(true);
      setTimeout(() => setCopiedOtp(false), 2000);
    } catch {
      // Code is already filled into input
    }
  }

  return (
    <div
      dir="rtl"
      className="min-h-[calc(100dvh-4rem)] bg-gradient-to-b from-[#0F172A] via-[#162033] to-[#0F172A] p-6 flex flex-col items-center justify-center edkawi-page-enter"
    >
      <div className="w-full max-w-md space-y-6">
        {/* Centered Brand Logo */}
        <div className="flex flex-col items-center text-center">
          <AdkawyLogo variant="stacked" />
        </div>

        {/* Sleek Single Dark Card */}
        <section
          aria-labelledby="unified-login-heading"
          className="rounded-2xl bg-[#1E293B] border border-[#334155] p-6 space-y-5 shadow-2xl"
        >
          <div className="text-center space-y-1.5">
            <h1
              id="unified-login-heading"
              className="text-2xl font-bold text-[#F8FAFC]"
            >
              {inviteToken
                ? 'إتمام التسجيل عبر الدعوة'
                : step === 'admin_otp'
                ? 'التحقق الأمني للإدارة'
                : step === 'customer_email_otp'
                ? 'تفعيل البريد الإلكتروني'
                : step === 'reset_password'
                ? 'استعادة كلمة المرور'
                : authMode === 'register_customer'
                ? 'إنشاء حساب جديد'
                : 'تسجيل الدخول'}
            </h1>
            <p className="text-sm text-[#94A3B8]">
              {inviteToken
                ? 'أكمل بياناتك لتفعيل حسابك على إدكاوي'
                : step === 'admin_otp'
                ? 'أدخل كود التحقق المكون من ٦ أرقام'
                : step === 'customer_email_otp'
                ? 'أدخل كود التفعيل المرسل لبريدك'
                : step === 'reset_password'
                ? 'أدخل بريدك لإرسال رابط الاستعادة'
                : 'منصة إدكو السريعة للمطاعم والصيدليات'}
            </p>
          </div>

          {activeRefCode && !inviteToken && authMode === 'register_customer' && (
            <div
              role="status"
              className="p-3.5 rounded-2xl bg-[#0F172A] border border-[#334155] text-xs font-semibold text-[#F8FAFC] text-center"
            >
              كود الإحالة:{' '}
              <span className="font-mono font-bold text-[#FF6B00]">
                {activeRefCode}
              </span>
            </div>
          )}

          {hasPendingCartForCheckout && !inviteToken && step === 'credentials' && (
            <div
              role="status"
              className="p-3.5 rounded-2xl bg-[#FF6B00]/15 border border-[#FF6B00]/40 text-[#F8FAFC] text-xs sm:text-sm font-semibold text-center"
            >
              لديك منتجات في السلة — سجّل دخولك لإتمام الطلب الآن.
            </div>
          )}

          {resetSuccessMsg && step === 'reset_password' && (
            <div
              role="status"
              className="p-3.5 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 text-xs sm:text-sm font-semibold"
            >
              {resetSuccessMsg}
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-2xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs sm:text-sm font-semibold"
            >
              {errorMsg}
            </div>
          )}

          {inviteToken ? (
            inviteChecking ? (
              <div className="py-10 flex flex-col items-center justify-center gap-3 text-sm font-semibold text-[#94A3B8]">
                <Loader2 className="w-6 h-6 animate-spin text-[#FF6B00]" />
                <span>جارٍ التحقق من رابط الدعوة...</span>
              </div>
            ) : !inviteRecord || inviteInvalidReason ? (
              <div className="p-5 rounded-2xl bg-red-950/40 border border-red-500/40 space-y-4 text-center">
                <h2 className="text-lg font-bold text-red-200">
                  الدعوة غير صالحة أو منتهية
                </h2>
                <p className="text-xs sm:text-sm text-red-300 leading-relaxed">
                  {inviteInvalidReason ||
                    'انتهت صلاحية رابط الدعوة أو تم استخدامه مسبقاً.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    onClearInviteToken?.();
                  }}
                  className="w-full min-h-[46px] px-5 py-2.5 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-sm font-bold cursor-pointer"
                >
                  الانتقال لتسجيل الدخول
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleInvitationRegisterSubmit}
                className="space-y-4"
              >
                <div className="p-3.5 rounded-2xl bg-[#0F172A] border border-[#334155] text-xs text-[#94A3B8]">
                  نوع الحساب:{' '}
                  <strong className="text-[#FF6B00]">
                    {inviteRecord.userType === 'store'
                      ? 'متجر / مطعم / صيدلية'
                      : inviteRecord.userType === 'courier'
                      ? 'مندوب توصيل'
                      : inviteRecord.userType === 'sales_agent'
                      ? 'مسؤول مبيعات'
                      : 'عميل'}
                  </strong>
                  {inviteRecord.invitedByName
                    ? ` · بدعوة من ${inviteRecord.invitedByName}`
                    : ''}
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#F8FAFC] mb-1.5">
                    البريد الإلكتروني المعتمد
                  </label>
                  <input
                    type="email"
                    dir="ltr"
                    readOnly
                    value={inviteRecord.email}
                    className="w-full px-3.5 py-3 rounded-2xl border border-[#334155] bg-[#0F172A] text-sm font-mono text-left text-[#94A3B8] cursor-not-allowed"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#F8FAFC] mb-1.5">
                      {inviteRecord.userType === 'store'
                        ? 'اسم المتجر أو النشاط'
                        : 'الاسم الثلاثي'}
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={80}
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder={
                        inviteRecord.userType === 'store'
                          ? 'مثال: مطبخ إدكو'
                          : 'الاسم بالكامل'
                      }
                      className="w-full px-3.5 py-3 rounded-2xl border border-[#334155] bg-[#0F172A] text-sm text-[#F8FAFC] placeholder:text-[#94A3B8]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#F8FAFC] mb-1.5">
                      رقم الموبايل (١١ رقماً)
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-[#94A3B8] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="tel"
                        required
                        dir="ltr"
                        maxLength={11}
                        value={invitePhone}
                        onChange={(e) => setInvitePhone(e.target.value)}
                        placeholder="01012345678"
                        className="w-full pr-10 pl-3.5 py-3 rounded-2xl border border-[#334155] bg-[#0F172A] text-sm font-mono tabular-nums text-left text-[#F8FAFC]"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#F8FAFC] mb-1.5">
                    كلمة المرور (٦ أحرف على الأقل)
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      dir="ltr"
                      minLength={6}
                      value={invitePassword}
                      onChange={(e) => setInvitePassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 pl-10 py-3 rounded-2xl border border-[#334155] bg-[#0F172A] text-sm font-mono text-left text-[#F8FAFC]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {inviteRecord.userType === 'store' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-[#F8FAFC] mb-1.5">
                          قسم المتجر
                        </label>
                        <select
                          value={inviteStoreCategory}
                          onChange={(e) => {
                            const nextCat = e.target.value as StoreCategory;
                            setInviteStoreCategory(nextCat);
                            setInviteIsHomeFood(nextCat === 'أكل بيتي');
                          }}
                          className="w-full px-3 py-3 rounded-2xl border border-[#334155] bg-[#0F172A] text-sm text-[#F8FAFC]"
                        >
                          {STORE_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-end pb-2">
                        <label className="inline-flex items-center gap-2 text-xs font-bold text-[#F8FAFC] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={inviteIsHomeFood}
                            onChange={(e) =>
                              setInviteIsHomeFood(e.target.checked)
                            }
                            className="w-4 h-4 accent-[#FF6B00] rounded"
                          />
                          <span>أكل بيتي طازج</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#F8FAFC] mb-1.5">
                        وصف مختصر للمتجر
                      </label>
                      <input
                        type="text"
                        maxLength={200}
                        value={inviteStoreDesc}
                        onChange={(e) => setInviteStoreDesc(e.target.value)}
                        placeholder="مثال: أشهى الطواجن والمحاشي في إدكو"
                        className="w-full px-3.5 py-3 rounded-2xl border border-[#334155] bg-[#0F172A] text-sm text-[#F8FAFC]"
                      />
                    </div>
                  </div>
                )}

                {inviteRecord.userType === 'courier' && (
                  <div>
                    <label className="block text-xs font-bold text-[#F8FAFC] mb-1.5">
                      وسيلة التوصيل
                    </label>
                    <select
                      value={inviteVehicleType}
                      onChange={(e) =>
                        setInviteVehicleType(
                          e.target.value as CourierVehicleType
                        )
                      }
                      className="w-full px-3 py-3 rounded-2xl border border-[#334155] bg-[#0F172A] text-sm text-[#F8FAFC]"
                    >
                      {COURIER_VEHICLE_TYPES.map((vt) => (
                        <option key={vt} value={vt}>
                          {vt}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {inviteRecord.userType !== 'sales_agent' && (
                  <div className="space-y-3">
                    <EdkuLocationPickerMap
                      label="الموقع داخل مدينة إدكو"
                      lat={inviteLat}
                      lng={inviteLng}
                      neighborhood={inviteNeighborhood}
                      heightClassName="h-[190px]"
                      onWaterValidationChange={setInviteWaterPin}
                      onChange={(picked) => {
                        setInviteLat(picked.lat);
                        setInviteLng(picked.lng);
                        setInviteNeighborhood(picked.neighborhood);
                        if (picked.resolvedAddress) {
                          setInviteAddress(picked.resolvedAddress);
                        }
                      }}
                    />

                    {inviteRecord.userType === 'customer' && (
                      <input
                        type="text"
                        value={inviteAddress}
                        onChange={(e) => setInviteAddress(e.target.value)}
                        placeholder="العنوان التفصيلي أو أقرب علامة مميزة"
                        className="w-full px-3.5 py-3 rounded-2xl border border-[#334155] bg-[#0F172A] text-sm text-[#F8FAFC]"
                      />
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busyMode !== null || inviteWaterPin}
                  className="w-full min-h-[50px] py-3 px-6 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-55 text-white font-bold text-lg inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shadow-lg shadow-[#FF6B00]/25"
                >
                  <span>
                    {busyMode === 'register_invite'
                      ? 'جارٍ التفعيل...'
                      : 'تفعيل الحساب والدخول'}
                  </span>
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </form>
            )
          ) : step === 'reset_password' ? (
            <form
              onSubmit={handleResetPasswordSubmit}
              noValidate
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="reset-password-email"
                  className="block text-xs font-bold text-[#F8FAFC] mb-1.5"
                >
                  البريد الإلكتروني المسجل
                </label>
                <div className="relative">
                  <Mail
                    className="w-4 h-4 text-[#94A3B8] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="reset-password-email"
                    type="email"
                    dir="ltr"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pr-11 pl-4 py-3.5 rounded-2xl border border-[#334155] focus:border-[#FF6B00] bg-[#0F172A] text-sm font-mono text-left text-[#F8FAFC]"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busyMode !== null}
                className="w-full min-h-[50px] py-3 px-6 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] active:scale-[0.98] disabled:opacity-60 text-white font-bold text-lg inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shadow-lg shadow-[#FF6B00]/25"
              >
                <span>
                  {busyMode === 'reset_password'
                    ? 'جارٍ الإرسال...'
                    : 'إرسال رابط الاستعادة'}
                </span>
                <ArrowLeft className="w-5 h-5" aria-hidden="true" />
              </button>

              <div className="pt-1 flex justify-center">
                <button
                  type="button"
                  disabled={busyMode !== null}
                  onClick={() => {
                    setStep('credentials');
                    setErrorMsg(null);
                    setResetSuccessMsg(null);
                  }}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-[#94A3B8] hover:text-[#FF6B00] transition-colors cursor-pointer whitespace-nowrap"
                >
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  <span>العودة لتسجيل الدخول</span>
                </button>
              </div>
            </form>
          ) : step === 'customer_email_otp' ? (
            <form
              onSubmit={handleVerifyCustomerEmailOtpSubmit}
              noValidate
              className="space-y-4"
            >
              <div className="p-4 rounded-2xl bg-[#0F172A] border border-[#334155] space-y-2 text-xs sm:text-sm">
                <p className="font-bold text-[#F8FAFC]">
                  {emailVerifyMeta?.sentViaSmtp
                    ? `تم إرسال رسالة التفعيل من تطبيق إدكاوي إلى ${
                        emailVerifyMeta.maskedEmail || email.trim()
                      }`
                    : 'كود التفعيل الفوري من تطبيق إدكاوي'}
                </p>

                {emailVerifyMeta?.fallbackOtpCode && (
                  <div className="pt-2 flex items-center justify-between gap-3 border-t border-[#334155]">
                    <span
                      dir="ltr"
                      className="font-mono text-lg font-bold tracking-[0.25em] text-[#FF6B00] tabular-nums"
                    >
                      {emailVerifyMeta.fallbackOtpCode}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyFallbackOtp(emailVerifyMeta.fallbackOtpCode!)
                      }
                      className="py-1.5 px-3 rounded-xl bg-[#1E293B] border border-[#334155] text-xs font-bold text-[#F8FAFC] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      {copiedOtp ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>تم التعبئة</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>تعبئة الكود</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {otpLockoutSeconds > 0 && (
                <div
                  role="status"
                  className="p-3.5 rounded-2xl bg-amber-950/50 border border-amber-500/40 text-amber-200 text-xs font-bold flex items-center justify-between gap-2"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>تم القفل المؤقت بعد ٥ محاولات خاطئة</span>
                  </span>
                  <span className="font-mono tabular-nums text-[#FF6B00]">
                    {Math.floor(otpLockoutSeconds / 60)}:
                    {String(otpLockoutSeconds % 60).padStart(2, '0')}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#F8FAFC] mb-2">
                  أدخل كود التفعيل المكون من ٤ أرقام
                </label>
                <div
                  dir="ltr"
                  className="grid grid-cols-4 gap-3"
                  onPaste={(e) => {
                    const pasted = e.clipboardData
                      .getData('text')
                      .replace(/\D/g, '')
                      .slice(0, 4);
                    if (!pasted) return;
                    e.preventDefault();
                    const next = ['', '', '', ''];
                    pasted.split('').forEach((ch, idx) => {
                      next[idx] = ch;
                    });
                    setCustomerOtpDigits(next);
                    setOtpCode(next.join(''));
                    const focusIdx = Math.min(3, pasted.length);
                    customerOtpRefs.current[focusIdx]?.focus();
                  }}
                >
                  {[0, 1, 2, 3].map((idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        customerOtpRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      aria-label={`الخانة ${idx + 1} من كود التفعيل`}
                      disabled={otpLockoutSeconds > 0}
                      value={customerOtpDigits[idx]}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(-1);
                        const next = [...customerOtpDigits];
                        next[idx] = val;
                        setCustomerOtpDigits(next);
                        setOtpCode(next.join(''));
                        if (val && idx < 3) {
                          customerOtpRefs.current[idx + 1]?.focus();
                        }
                      }}
                      onKeyDown={(e) => {
                        if (
                          e.key === 'Backspace' &&
                          !customerOtpDigits[idx] &&
                          idx > 0
                        ) {
                          customerOtpRefs.current[idx - 1]?.focus();
                        }
                      }}
                      placeholder="•"
                      autoFocus={idx === 0}
                      className="h-14 w-full rounded-2xl border border-[#334155] focus:border-[#FF6B00] bg-[#0F172A] text-center text-2xl font-mono font-bold text-[#F8FAFC] tabular-nums disabled:opacity-50"
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={busyMode !== null || otpLockoutSeconds > 0}
                className="w-full min-h-[50px] py-3 px-6 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-60 text-white font-bold text-lg inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              >
                {busyMode === 'verify_customer_email' ? (
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                ) : null}
                <span>
                  {busyMode === 'verify_customer_email'
                    ? 'جارٍ التفعيل...'
                    : otpLockoutSeconds > 0
                    ? `انتظر (${otpLockoutSeconds}ث)`
                    : 'تأكيد الكود والدخول'}
                </span>
                {busyMode !== 'verify_customer_email' && (
                  <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                )}
              </button>

              <button
                type="button"
                disabled={busyMode !== null}
                onClick={handleRegisterWithFallbackLink}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-2xl border border-[#334155] bg-[#0F172A] text-xs font-bold text-[#F8FAFC] hover:border-[#FF6B00] cursor-pointer whitespace-nowrap inline-flex items-center justify-center gap-2"
              >
                {busyMode === 'fallback_email_link' && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                <span>
                  {busyMode === 'fallback_email_link'
                    ? 'جارٍ الإرسال...'
                    : 'إرسال رابط تفعيل بديل والمتابعة'}
                </span>
              </button>

              <div className="pt-1 flex items-center justify-between gap-3 text-xs font-bold">
                <button
                  type="button"
                  disabled={busyMode !== null}
                  onClick={() => {
                    setStep('credentials');
                    setErrorMsg(null);
                    setOtpCode('');
                    setCustomerOtpDigits(['', '', '', '']);
                  }}
                  className="inline-flex items-center gap-1.5 text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer whitespace-nowrap"
                >
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>رجوع</span>
                </button>

                <button
                  type="button"
                  disabled={busyMode !== null || otpLockoutSeconds > 0}
                  onClick={handleResendCustomerEmailOtp}
                  className="inline-flex items-center gap-1.5 text-[#FF6B00] hover:underline disabled:opacity-50 cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>
                    {busyMode === 'resend_otp'
                      ? 'جارٍ الإرسال...'
                      : 'إعادة إرسال الكود'}
                  </span>
                </button>
              </div>
            </form>
          ) : step === 'admin_otp' ? (
            <form
              onSubmit={handleVerifyAdminOtpSubmit}
              noValidate
              className="space-y-4"
            >
              <div className="p-4 rounded-2xl bg-[#0F172A] border border-[#334155] space-y-2 text-xs sm:text-sm">
                <p className="font-bold text-[#F8FAFC]">
                  {otpRequestMeta?.delivery === 'edkawy_mail' ||
                  otpRequestMeta?.delivery === 'gmail'
                    ? `تم إرسال كود التحقق من تطبيق إدكاوي إلى بريد الإدارة`
                    : 'كود التحقق الأمني — تطبيق إدكاوي'}
                </p>

                {otpRequestMeta?.fallbackOtpCode && (
                  <div className="pt-2 flex items-center justify-between gap-3 border-t border-[#334155]">
                    <span
                      dir="ltr"
                      className="font-mono text-lg font-bold tracking-[0.25em] text-[#FF6B00] tabular-nums"
                    >
                      {otpRequestMeta.fallbackOtpCode}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyFallbackOtp(otpRequestMeta.fallbackOtpCode!)
                      }
                      className="py-1.5 px-3 rounded-xl bg-[#1E293B] border border-[#334155] text-xs font-bold text-[#F8FAFC] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      {copiedOtp ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                          <span>تم التعبئة</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>تعبئة الكود</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="admin-otp-input"
                  className="block text-xs font-bold text-[#F8FAFC] mb-1.5"
                >
                  كود التحقق (٦ أرقام)
                </label>
                <div className="relative">
                  <KeyRound
                    className="w-4 h-4 text-[#94A3B8] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="admin-otp-input"
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) =>
                      setOtpCode(e.target.value.replace(/[^0-9]/g, ''))
                    }
                    placeholder="000000"
                    className="w-full pr-11 pl-4 py-3.5 rounded-2xl border border-[#334155] focus:border-[#FF6B00] bg-[#0F172A] text-center text-lg font-mono font-bold tracking-[0.35em] text-[#F8FAFC] tabular-nums"
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busyMode !== null}
                className="w-full min-h-[50px] py-3 px-6 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] active:scale-[0.98] disabled:opacity-60 text-white font-bold text-lg inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <span>
                  {busyMode === 'verify_otp'
                    ? 'جارٍ التحقق...'
                    : 'تأكيد الكود والدخول'}
                </span>
                <ArrowLeft className="w-5 h-5" aria-hidden="true" />
              </button>

              <div className="pt-1 flex items-center justify-between gap-3 text-xs font-bold">
                <button
                  type="button"
                  disabled={busyMode !== null}
                  onClick={() => {
                    setStep('credentials');
                    setErrorMsg(null);
                    setOtpCode('');
                  }}
                  className="inline-flex items-center gap-1.5 text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer whitespace-nowrap"
                >
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>رجوع</span>
                </button>

                <button
                  type="button"
                  disabled={busyMode !== null}
                  onClick={handleResendAdminOtp}
                  className="inline-flex items-center gap-1.5 text-[#FF6B00] hover:underline cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>
                    {busyMode === 'resend_otp'
                      ? 'جارٍ الإرسال...'
                      : 'إعادة إرسال الكود'}
                  </span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-5">
              <div
                role="tablist"
                aria-label="خيارات الدخول أو إنشاء حساب"
                className="grid grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-[#0F172A] border border-[#334155]"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === 'login'}
                  onClick={() => {
                    setAuthMode('login');
                    setErrorMsg(null);
                  }}
                  className={`py-2.5 px-3 rounded-xl text-sm font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    authMode === 'login'
                      ? 'bg-[#FF6B00] text-white shadow-sm'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  تسجيل الدخول
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === 'register_customer'}
                  onClick={() => {
                    setAuthMode('register_customer');
                    setErrorMsg(null);
                  }}
                  className={`py-2.5 px-3 rounded-xl text-sm font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    authMode === 'register_customer'
                      ? 'bg-[#FF6B00] text-white shadow-sm'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  حساب جديد
                </button>
              </div>

              <form
                onSubmit={
                  authMode === 'register_customer'
                    ? handleRegisterCustomerSubmit
                    : handleUnifiedLoginSubmit
                }
                noValidate
                className="space-y-4"
              >
                {authMode === 'register_customer' && (
                  <>
                    <div>
                      <label
                        htmlFor="register-customer-name"
                        className="block text-xs font-bold text-[#F8FAFC] mb-1.5"
                      >
                        الاسم بالكامل
                      </label>
                      <div className="relative">
                        <UserIcon
                          className="w-4 h-4 text-[#94A3B8] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"
                          aria-hidden="true"
                        />
                        <input
                          id="register-customer-name"
                          type="text"
                          autoComplete="name"
                          value={customerFullName}
                          onChange={(e) => {
                            setCustomerFullName(e.target.value);
                            setTouchedFields((p) => ({ ...p, name: true }));
                          }}
                          placeholder="مثال: أحمد محمد"
                          maxLength={80}
                          className={`w-full pr-11 pl-4 py-3.5 rounded-2xl border bg-[#0F172A] text-base text-[#F8FAFC] placeholder:text-[#94A3B8] ${
                            inlineNameError
                              ? 'border-red-500'
                              : 'border-[#334155] focus:border-[#FF6B00]'
                          }`}
                          required
                        />
                      </div>
                      {inlineNameError && (
                        <p className="mt-1 text-xs font-semibold text-red-400">
                          {inlineNameError}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="register-customer-phone"
                        className="block text-xs font-bold text-[#F8FAFC] mb-1.5"
                      >
                        رقم الموبايل المصري (اختياري الآن)
                      </label>
                      <div className="relative">
                        <Phone
                          className="w-4 h-4 text-[#94A3B8] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"
                          aria-hidden="true"
                        />
                        <input
                          id="register-customer-phone"
                          type="tel"
                          dir="ltr"
                          maxLength={11}
                          value={customerPhone}
                          onChange={(e) => {
                            setCustomerPhone(e.target.value.replace(/\D/g, ''));
                            setTouchedFields((p) => ({ ...p, phone: true }));
                          }}
                          placeholder="01012345678"
                          className={`w-full pr-11 pl-4 py-3.5 rounded-2xl border bg-[#0F172A] text-base font-mono text-left text-[#F8FAFC] placeholder:text-[#94A3B8] tabular-nums ${
                            inlinePhoneError
                              ? 'border-red-500'
                              : 'border-[#334155] focus:border-[#FF6B00]'
                          }`}
                        />
                      </div>
                      {inlinePhoneError && (
                        <p className="mt-1 text-xs font-semibold text-red-400">
                          {inlinePhoneError}
                        </p>
                      )}
                    </div>
                  </>
                )}

                <div>
                  <label
                    htmlFor="unified-email"
                    className="block text-xs font-bold text-[#F8FAFC] mb-1.5"
                  >
                    البريد الإلكتروني
                  </label>
                  <div className="relative">
                    <Mail
                      className="w-4 h-4 text-[#94A3B8] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="unified-email"
                      type="email"
                      dir="ltr"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setTouchedFields((p) => ({ ...p, email: true }));
                      }}
                      placeholder="name@example.com"
                      className={`w-full pr-11 pl-4 py-3.5 rounded-2xl border bg-[#0F172A] text-base font-mono text-left text-[#F8FAFC] placeholder:text-[#94A3B8] ${
                        inlineEmailError
                          ? 'border-red-500'
                          : 'border-[#334155] focus:border-[#FF6B00]'
                      }`}
                      required
                    />
                  </div>
                  {inlineEmailError && (
                    <p className="mt-1 text-xs font-semibold text-red-400">
                      {inlineEmailError}
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label
                      htmlFor="unified-password"
                      className="block text-xs font-bold text-[#F8FAFC]"
                    >
                      كلمة المرور
                    </label>
                    {authMode === 'login' && (
                      <button
                        type="button"
                        onClick={() => {
                          setErrorMsg(null);
                          setResetSuccessMsg(null);
                          setStep('reset_password');
                        }}
                        className="text-xs font-bold text-[#FF6B00] hover:underline cursor-pointer whitespace-nowrap shrink-0"
                      >
                        نسيت كلمة المرور؟
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock
                      className="w-4 h-4 text-[#94A3B8] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="unified-password"
                      type={showPassword ? 'text' : 'password'}
                      dir="ltr"
                      autoComplete={
                        authMode === 'register_customer'
                          ? 'new-password'
                          : 'current-password'
                      }
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setTouchedFields((p) => ({ ...p, password: true }));
                      }}
                      placeholder="••••••••"
                      className={`w-full pr-11 pl-11 py-3.5 rounded-2xl border bg-[#0F172A] text-base font-mono text-left text-[#F8FAFC] placeholder:text-[#94A3B8] ${
                        inlinePasswordError
                          ? 'border-red-500'
                          : 'border-[#334155] focus:border-[#FF6B00]'
                      }`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={
                        showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'
                      }
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <Eye className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  {inlinePasswordError && (
                    <p className="mt-1 text-xs font-semibold text-red-400">
                      {inlinePasswordError}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={busyMode !== null}
                  className="w-full min-h-[52px] py-3.5 px-6 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] active:scale-[0.98] disabled:opacity-60 text-white font-bold text-lg inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shadow-lg shadow-[#FF6B00]/30"
                >
                  {busyMode === 'register_customer' || busyMode === 'login' ? (
                    <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                  ) : null}
                  <span>
                    {authMode === 'register_customer'
                      ? busyMode === 'register_customer'
                        ? 'جارٍ إرسال كود التفعيل...'
                        : 'إنشاء حساب'
                      : busyMode === 'login'
                      ? 'جارٍ الدخول...'
                      : 'تسجيل الدخول'}
                  </span>
                  {busyMode !== 'register_customer' && busyMode !== 'login' && (
                    <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                  )}
                </button>
              </form>

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-[#334155]" />
                <span className="shrink-0 mx-3 text-xs font-semibold text-[#94A3B8]">
                  أو
                </span>
                <div className="flex-grow border-t border-[#334155]" />
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  disabled={busyMode !== null}
                  onClick={handleGoogleCustomerLogin}
                  className="w-full min-h-[48px] py-3 px-6 rounded-2xl bg-[#0F172A] hover:bg-[#0F172A]/80 active:scale-[0.98] disabled:opacity-60 border border-[#334155] hover:border-[#FF6B00] text-[#F8FAFC] font-bold text-sm sm:text-base inline-flex items-center justify-center gap-2.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <GoogleBrandMark />
                  <span>
                    {busyMode === 'google'
                      ? 'جارٍ الاتصال...'
                      : 'الدخول باستخدام Google'}
                  </span>
                </button>

                {!hasPendingCartForCheckout && (
                  <button
                    type="button"
                    disabled={busyMode !== null}
                    onClick={handleAnonymousCustomerEntry}
                    className="w-full min-h-[48px] py-3 px-6 rounded-2xl bg-[#0F172A] hover:border-[#FF6B00] border border-[#334155] active:scale-[0.98] disabled:opacity-60 text-[#F8FAFC] font-bold text-sm sm:text-base inline-flex items-center justify-center gap-2.5 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <ShoppingBag
                      className="w-4 h-4 text-[#FF6B00] shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      {busyMode === 'customer'
                        ? 'جارٍ الفتح...'
                        : 'تصفح المتاجر كضيف'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

          {onOpenLegalModal && (
            <div className="pt-4 border-t border-[#334155] flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-xs font-semibold text-[#94A3B8]">
              <button
                type="button"
                onClick={() => onOpenLegalModal('terms')}
                className="text-[#FF6B00] hover:underline cursor-pointer"
              >
                الشروط والأحكام
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => onOpenLegalModal('privacy')}
                className="text-[#FF6B00] hover:underline cursor-pointer"
              >
                سياسة الخصوصية
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => onOpenLegalModal('pharmacy')}
                className="text-[#FF6B00] hover:underline cursor-pointer"
              >
                الصيدليات
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

interface EmailVerificationGateViewProps {
  userEmail: string;
  roleLabelAr: string;
  onVerified: () => void;
  onSignOut: () => void;
}

export function EmailVerificationGateView({
  userEmail,
  roleLabelAr,
  onVerified,
  onSignOut,
}: EmailVerificationGateViewProps) {
  const [busy, setBusy] = useState<'resend' | 'check' | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleResend = async () => {
    setFeedback(null);
    setBusy('resend');
    try {
      const msg = await resendVerificationEmailForCurrentUser();
      setFeedback({ type: 'success', text: msg });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: formatAppErrorMessage(
          err,
          'تعذر إعادة إرسال رابط تأكيد البريد الإلكتروني حالياً.'
        ),
      });
    } finally {
      setBusy(null);
    }
  };

  const handleCheckVerified = async () => {
    setFeedback(null);
    setBusy('check');
    try {
      const verified = await reloadCurrentUserEmailVerified();
      if (verified) {
        onVerified();
      } else {
        setFeedback({
          type: 'error',
          text: 'لم يتم تأكيد البريد بعد — افتح الرسالة المرسلة إلى بريدك واضغط على رابط التفعيل ثم أعد المحاولة.',
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: formatAppErrorMessage(err, 'تعذر التحقق من حالة البريد حالياً.'),
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-[calc(100dvh-4rem)] bg-gradient-to-b from-[#0F172A] via-[#162033] to-[#0F172A] p-6 flex items-center justify-center edkawi-page-enter"
    >
      <div className="w-full max-w-md rounded-2xl bg-[#1E293B] border border-[#334155] p-6 space-y-5 text-center shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-[#FF6B00]/15 text-[#FF6B00] flex items-center justify-center mx-auto">
          <Mail className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[#F8FAFC]">
            تأكيد البريد الإلكتروني لحساب {roleLabelAr}
          </h1>
          <p className="text-sm text-[#94A3B8] leading-relaxed">
            لحماية المعاملات المالية والطلبات على منصة إدكاوي، يرجى فتح رابط التفعيل المرسل إلى بريدك الإلكتروني:
          </p>
          <p
            dir="ltr"
            className="font-mono text-sm font-bold text-[#FF6B00]"
          >
            {userEmail}
          </p>
        </div>

        {feedback && (
          <div
            role="status"
            className={`p-3.5 rounded-2xl border text-xs font-semibold ${
              feedback.type === 'success'
                ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                : 'bg-red-950/50 border-red-500/40 text-red-200'
            }`}
          >
            {feedback.text}
          </div>
        )}

        <div className="space-y-3 pt-1">
          <button
            type="button"
            disabled={busy !== null}
            onClick={handleCheckVerified}
            className="w-full min-h-[48px] px-5 py-3 rounded-2xl bg-[#FF6B00] hover:bg-[#E55F00] disabled:opacity-60 text-white text-base font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw
              className={`w-4 h-4 ${busy === 'check' ? 'animate-spin' : ''}`}
            />
            <span>
              {busy === 'check'
                ? 'جارٍ التحقق...'
                : 'تحققت من بريدي — فتح لوحة التحكم'}
            </span>
          </button>

          <button
            type="button"
            disabled={busy !== null}
            onClick={handleResend}
            className="w-full min-h-[46px] px-5 py-2.5 rounded-2xl border border-[#334155] bg-[#0F172A] text-sm font-bold text-[#F8FAFC] hover:border-[#FF6B00] cursor-pointer"
          >
            {busy === 'resend'
              ? 'جارٍ إعادة الإرسال...'
              : 'إعادة إرسال رابط التفعيل للبريد'}
          </button>

          <button
            type="button"
            onClick={onSignOut}
            className="w-full min-h-[44px] px-4 py-2 rounded-2xl text-xs font-bold text-rose-400 hover:bg-rose-950/30 inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </div>
    </div>
  );
}

