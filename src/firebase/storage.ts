import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { initializeFirebase } from '.';

export const uploadFile = async (
  path: string,
  file: File
): Promise<string> => {
  const { app } = initializeFirebase();
  const storage = getStorage(app);
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return url;
};

export const deleteFile = async (path: string): Promise<void> => {
  const { app } = initializeFirebase();
  const storage = getStorage(app);
  const storageRef = ref(storage, path);
  await deleteObject(storageRef);
};
