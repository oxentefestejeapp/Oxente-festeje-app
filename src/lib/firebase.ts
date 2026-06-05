import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Safely probe the JSON configuration using import.meta.glob to avoid build errors if the file is missing outside of the AI Studio environment
const configs = import.meta.glob('../../firebase-applet-config.json', { eager: true });
const fileConfig = (configs['../../firebase-applet-config.json'] as any)?.default || configs['../../firebase-applet-config.json'] || {};

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || fileConfig.apiKey || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || fileConfig.authDomain || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || fileConfig.projectId || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || fileConfig.storageBucket || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || fileConfig.messagingSenderId || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || fileConfig.appId || '',
};

const databaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID || 
                   import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || 
                   fileConfig.firestoreDatabaseId || 
                   fileConfig.databaseId || 
                   '(default)'; // Fallback to classic default database ID for standard Firebase deployments

// Check if Firebase has enough configuration to be initialized
const hasConfig = !!config.apiKey && !!config.projectId;

let app: any = null;
let db: any = null;
let auth: any = null;
const googleProvider = new GoogleAuthProvider();

if (hasConfig) {
  try {
    app = getApps().length === 0 ? initializeApp(config) : getApp();
    db = getFirestore(app, databaseId);
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
