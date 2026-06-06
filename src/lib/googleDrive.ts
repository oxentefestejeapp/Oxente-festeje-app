/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, Auth } from 'firebase/auth';
import { auth } from './firebase';

const provider = new GoogleAuthProvider();
// Request Google Drive access
provider.addScope('https://www.googleapis.com/auth/drive');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess: (user: User, token: string) => void,
  onAuthFailure: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure();
    }
  });
};

// Start Google sign-in popup
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

// Interfaces for Google Drive files
export interface DriveBackupFile {
  id: string;
  name: string;
  createdTime: string;
  size?: string;
}

/**
 * Lists backups in Google Drive
 */
export const listDriveBackups = async (accessToken: string): Promise<DriveBackupFile[]> => {
  try {
    // q: search for name starting with backup_oxente_festeje
    const q = "name contains 'backup_oxente_festeje_' and mimeType = 'application/json' and trashed = false";
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,createdTime,size)&orderBy=createdTime desc`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to list backups: ${res.statusText}`);
    }

    const data = await res.json();
    return data.files || [];
  } catch (error) {
    console.error('Error listing Drive backups:', error);
    throw error;
  }
};

/**
 * Uploads a backup file to Google Drive using a multipart body
 */
export const uploadBackupToDrive = async (
  accessToken: string,
  backupData: any
): Promise<DriveBackupFile> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const fileName = `backup_oxente_festeje_${today}.json`;

    const metadata = {
      name: fileName,
      mimeType: 'application/json',
      description: 'Oxente Festeje App Backup',
    };

    const fileContent = JSON.stringify(backupData, null, 2);
    const boundary = 'oxente_backup_boundary';
    const delimiter = `\r\n--${boundary}\r\n`;
    const close_delim = `\r\n--${boundary}--`;

    const body =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      fileContent +
      close_delim;

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    });

    if (!res.ok) {
      throw new Error(`Failed to upload backup: ${res.statusText}`);
    }

    const data = await res.json();
    return {
      id: data.id,
      name: data.name || fileName,
      createdTime: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error uploading backup to Drive:', error);
    throw error;
  }
};

/**
 * Downloads a backup from Google Drive and parses its JSON content
 */
export const downloadBackupFromDrive = async (
  accessToken: string,
  fileId: string
): Promise<any> => {
  try {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to download backup: ${res.statusText}`);
    }

    return await res.json();
  } catch (error) {
    console.error('Error downloading backup from Drive:', error);
    throw error;
  }
};

/**
 * Deletes a file from Google Drive (Requires explicit confirmation from user before calling)
 */
export const deleteBackupFromDrive = async (
  accessToken: string,
  fileId: string
): Promise<boolean> => {
  try {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to delete backup: ${res.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('Error deleting backup from Drive:', error);
    throw error;
  }
};
