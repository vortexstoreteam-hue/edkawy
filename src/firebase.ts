import { getApps, initializeApp, onLog } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  sendEmailVerification,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  enableNetwork,
  Firestore,
  getDocFromServer,
  getFirestore,
  initializeFirestore,
  setLogLevel as setFirestoreLogLevel,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { FirestoreErrorInfo, OperationType } from './types/edkawi';

export const firebaseClientConfig = firebaseConfig;

export const app =
  getApps().find((existing) => existing.name === '[DEFAULT]') ??
  initializeApp(firebaseConfig);

if (typeof window !== 'undefined') {
  const recaptchaSiteKey = (
    (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ?.VITE_RECAPTCHA_V3_SITE_KEY ?? ''
  ).trim();
  if (recaptchaSiteKey && !recaptchaSiteKey.includes('YOUR_')) {
    try {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } catch {
      // App Check already initialized on this app instance
    }
  }
}

// Route transient 10s offline-mode fallback notices to console.warn while keeping
// all genuine Firestore errors on console.error.
if (typeof window !== 'undefined') {
  setFirestoreLogLevel('silent');
  onLog(
    ({ level, message, type, args }) => {
      if (type !== '@firebase/firestore') return;
      if (message.includes('Could not reach Cloud Firestore backend')) {
        console.warn(`[${new Date().toISOString()}]  ${type}:`, ...args);
        return;
      }
      if (level === 'error') {
        console.error(`[${new Date().toISOString()}]  ${type}:`, ...args);
      } else if (level === 'warn') {
        console.warn(`[${new Date().toISOString()}]  ${type}:`, ...args);
      }
    },
    { level: 'warn' }
  );
}

function createFirestoreInstance(): Firestore {
  if (typeof window === 'undefined') {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
  try {
    // Auto-detect optimal WebChannel / long-polling transport without forced 15s stream resets
    return initializeFirestore(
      app,
      {
        ignoreUndefinedProperties: true,
        experimentalAutoDetectLongPolling: true,
      },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
}

export const db = createFirestoreInstance();

export async function ensureFirestoreOnline(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  await enableNetwork(db).catch(() => {});
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void ensureFirestoreOnline();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void ensureFirestoreOnline();
    }
  });
}

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const SECONDARY_APP_NAME = 'EdkawyAccountProvisioner';

/**
 * Provisions a real Firebase Auth Email/Password user for a newly added store
 * using an isolated secondary FirebaseApp instance so the Admin remains signed in.
 */
export async function createSecondaryAuthUser(
  email: string,
  password: string,
  options?: {
    displayName?: string;
    sendVerification?: boolean;
  }
): Promise<string> {
  const secondaryApp =
    getApps().find((existing) => existing.name === SECONDARY_APP_NAME) ??
    initializeApp(firebaseConfig, SECONDARY_APP_NAME);
  const secondaryAuth = getAuth(secondaryApp);
  secondaryAuth.languageCode = 'ar';
  const credential = await createUserWithEmailAndPassword(
    secondaryAuth,
    email.trim(),
    password
  );
  if (options?.displayName?.trim()) {
    await updateProfile(credential.user, {
      displayName: options.displayName.trim().slice(0, 80),
    }).catch(() => {});
  }
  if (options?.sendVerification) {
    await sendEmailVerification(credential.user).catch(() => {});
  }
  const createdUid = credential.user.uid;
  await signOut(secondaryAuth).catch(() => {});
  return createdUid;
}

export const createMerchantAuthUser = createSecondaryAuthUser;

interface WarmupProbeResult {
  reachable: boolean;
  invalidConfig: boolean;
}

function isStaticConfigValid(): boolean {
  const projectId = (firebaseConfig.projectId ?? '').trim();
  const apiKey = (firebaseConfig.apiKey ?? '').trim();
  const databaseId = (firebaseConfig.firestoreDatabaseId ?? '').trim();
  if (!projectId || !apiKey || !databaseId) return false;
  if (
    projectId === 'remixed-project-id' ||
    projectId.includes('YOUR_') ||
    apiKey.includes('YOUR_')
  ) {
    return false;
  }
  return true;
}

let warmupPromise: Promise<WarmupProbeResult> | null = null;

/**
 * Sends a lightweight stateless HTTP probe to the Firestore REST endpoint so any
 * scale-to-zero database cold start (~8-12s) completes BEFORE opening a stateful
 * Watch stream (which otherwise triggers Firestore's 10s OnlineStateTracker timeout).
 */
export function waitForFirestoreWarmup(): Promise<WarmupProbeResult> {
  if (warmupPromise) return warmupPromise;

  if (!isStaticConfigValid()) {
    warmupPromise = Promise.resolve({ reachable: false, invalidConfig: true });
    return warmupPromise;
  }

  if (typeof window === 'undefined' || typeof fetch !== 'function') {
    warmupPromise = Promise.resolve({ reachable: true, invalidConfig: false });
    return warmupPromise;
  }

  const projectId = encodeURIComponent(firebaseConfig.projectId);
  const databaseId = encodeURIComponent(
    firebaseConfig.firestoreDatabaseId || '(default)'
  );
  const apiKey = encodeURIComponent(firebaseConfig.apiKey);
  const probeUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/test/connection?key=${apiKey}`;

  warmupPromise = (async (): Promise<WarmupProbeResult> => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 14000);
    try {
      const response = await fetch(probeUrl, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
        signal: controller.signal,
      });
      // 200 (open) or 401/403 (secured by firestore.rules) confirms the database is live and warm.
      // 400 or 404 on the database root path indicates invalid API key / project / database ID.
      if (response.status === 400 || response.status === 404) {
        const bodyText = await response.text().catch(() => '');
        const isMissingDbOrKey =
          bodyText.includes('API key not valid') ||
          bodyText.includes('Database') ||
          bodyText.includes('Project') ||
          bodyText.includes('does not exist');
        if (isMissingDbOrKey) {
          return { reachable: false, invalidConfig: true };
        }
      }
      return { reachable: true, invalidConfig: false };
    } catch {
      return { reachable: false, invalidConfig: false };
    } finally {
      window.clearTimeout(timer);
    }
  })();

  return warmupPromise;
}

let connectionValidated = false;

export async function validateFirestoreConnection(): Promise<void> {
  if (connectionValidated) return;
  connectionValidated = true;

  const probe = await waitForFirestoreWarmup();
  if (probe.invalidConfig) {
    console.error('Please check your Firebase configuration.');
    return;
  }

  const testDocRef = doc(db, 'test', 'connection');
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await getDocFromServer(testDocRef);
      return;
    } catch (error) {
      const isOfflineErr =
        error instanceof Error &&
        error.message.includes('the client is offline');
      if (!isOfflineErr) {
        // e.g. permission-denied confirms live server communication
        return;
      }

      await enableNetwork(db).catch(() => {});
      if (attempt < 2) {
        await new Promise((resolve) =>
          setTimeout(resolve, 1500 * (attempt + 1))
        );
      }
    }
  }

  const browserOnline =
    typeof navigator === 'undefined' ? true : navigator.onLine !== false;
  if (!probe.reachable && browserOnline) {
    console.warn(
      '[Firestore] Backend temporarily unreachable; operating in offline mode until connectivity is restored.'
    );
  }
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
