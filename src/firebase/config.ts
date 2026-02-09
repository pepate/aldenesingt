import { FirebaseOptions } from 'firebase/app';

const firebaseConfig: FirebaseOptions = JSON.parse(
  process.env.NEXT_PUBLIC_FIREBASE_CONFIG || '{}'
);

export function getFirebaseConfig(): FirebaseOptions {
  if (!firebaseConfig.apiKey) {
    throw new Error(
      'NEXT_PUBLIC_FIREBASE_CONFIG environment variable not set.'
    );
  }
  return firebaseConfig;
}
