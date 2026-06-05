import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Safely probe the JSON configuration using import.meta.glob to avoid build errors if the file is missing outside of the AI Studio environment
const configs = import.meta.glob('../../firebase-applet-config.json', { eager: true });
const fileConfig = (configs['../../firebase-applet-config.json'] as any)?.default || configs['../../firebase-applet-config.json'] || {};

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || fileConfig.apiKey || 'AIzaSyC5Jr4wq2lm_m9XhUIxShpaP1NoP2RgiiE',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || fileConfig.authDomain || 'practical-hue-l8gvj.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || fileConfig.projectId || 'practical-hue-l8gvj',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || fileConfig.storageBucket || 'practical-hue-l8gvj.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || fileConfig.messagingSenderId || '912051653362',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || fileConfig.appId || '1:912051653362:web:cb9cdb2a30c0fc1e659e6b',
};

const isAiStudio = typeof window !== 'undefined' && (
  window.location.hostname.includes('.run.app') || 
  window.location.hostname.includes('localhost') || 
  window.location.hostname.includes('127.0.0.1')
);

const databaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID || 
                   import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || 
                   fileConfig.firestoreDatabaseId || 
                   fileConfig.databaseId || 
                   'ai-studio-d9977160-44d4-41c1-9d78-4c43640d6b79';

// Check if Firebase has enough configuration to be initialized
const hasConfig = !!config.apiKey && !!config.projectId;

let app: any = null;
let db: any = null;
let auth: any = null;
const googleProvider = new GoogleAuthProvider();

if (hasConfig) {
  try {
    app = getApps().length === 0 ? initializeApp(config) : getApp();
    db = databaseId && databaseId !== '(default)' ? getFirestore(app, databaseId) : getFirestore(app);
    auth = getAuth(app);
  } catch (error) {
    console.error('Erro de inicialização do Firebase:', error);
  }
} else {
  console.warn(
    'Firebase não configurado ou credenciais ausentes. Ativando Modo de Execução Local Offline (localStorage) para funcionamento fora do ambiente Google.'
  );
}

export { app, db, auth, googleProvider, hasConfig };

// Standard Firebase collection error logger helper as outlined in guidelines
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
