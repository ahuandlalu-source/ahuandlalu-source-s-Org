import {getApp, getApps, initializeApp, type FirebaseApp} from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

function getFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp({
    apiKey: firebaseConfig.apiKey,
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    appId: firebaseConfig.appId,
    storageBucket: firebaseConfig.storageBucket,
    messagingSenderId: firebaseConfig.messagingSenderId,
  });
}

export function isFirebaseDriveAuthAvailable(): boolean {
  return Boolean(firebaseConfig?.apiKey && firebaseConfig?.authDomain);
}

/**
 * Triggers Google OAuth sign-in via Firebase Auth popup requesting read-only
 * Google Drive access. The resulting access token is held strictly in memory
 * and immediately passed to the backend for server-side verification & storage.
 */
export async function signInWithGoogleForDrive(): Promise<{
  accessToken: string;
  expiresInSeconds: number;
}> {
  if (!isFirebaseDriveAuthAvailable()) {
    throw new Error('Firebase Google OAuth configuration is missing.');
  }

  const app = getFirebaseApp();
  const auth = getAuth(app);

  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/drive.readonly');
  provider.setCustomParameters({
    prompt: 'consent select_account',
    include_granted_scopes: 'true',
  });

  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error(
        'Google Sign-In completed, but no Google Drive access token was returned. Ensure Drive read permission is granted.'
      );
    }
    return {
      accessToken: credential.accessToken,
      expiresInSeconds: 3500,
    };
  } catch (err: unknown) {
    const code = (err as {code?: string} | null)?.code || '';
    if (code === 'auth/popup-closed-by-user') {
      throw new Error('Google sign-in popup was closed before authorization finished.');
    }
    if (code === 'auth/popup-blocked') {
      throw new Error(
        'Sign-in popup was blocked by your browser. Please allow popups for this site and try again.'
      );
    }
    if (code === 'auth/cancelled-popup-request') {
      throw new Error('Another sign-in window is already open.');
    }
    if (err instanceof Error) {
      throw err;
    }
    throw new Error('Google authorization failed.');
  }
}

export async function signOutFirebaseGoogle(): Promise<void> {
  if (!isFirebaseDriveAuthAvailable()) return;
  try {
    const app = getFirebaseApp();
    const auth = getAuth(app);
    await signOut(auth);
  } catch {
    // Best effort sign-out
  }
}
