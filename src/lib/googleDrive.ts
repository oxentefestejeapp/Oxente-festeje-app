/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Simulated local/offline Google Drive backup orchestrator
// Keeps matching interfaces and signatures so zero edits are needed in SettingsManager.tsx

let simulatedUser: any = null;
let simulatedToken: string | null = null;

// Initialize simulated authorization listener
export const initAuth = (
  onAuthSuccess: (user: any, token: string) => void,
  onAuthFailure: () => void
) => {
  const getSaved = localStorage.getItem('oxente_google_drive_simulated_user');
  if (getSaved) {
    try {
      const parsed = JSON.parse(getSaved);
      simulatedUser = parsed.user;
      simulatedToken = parsed.accessToken;
      onAuthSuccess(simulatedUser, simulatedToken || 'mock-drive-token');
    } catch {
      onAuthFailure();
    }
  } else {
    onAuthFailure();
  }
  // Return dummy unsubscribe callback
  return () => {};
};

// Start Google sign-in simulation
export const googleSignIn = async (): Promise<{ user: any; accessToken: string } | null> => {
  const mockUser = {
    uid: 'abraao-mock-drive-id',
    displayName: 'Abraão Festeje (Drive Local)',
    email: 'oxentefesteje@gmail.com',
    photoURL: null
  };
  const mockToken = 'mock-drive-access-token-oxente';

  simulatedUser = mockUser;
  simulatedToken = mockToken;

  localStorage.setItem('oxente_google_drive_simulated_user', JSON.stringify({
    user: mockUser,
    accessToken: mockToken
  }));

  return { user: mockUser, accessToken: mockToken };
};

export const getAccessToken = async (): Promise<string | null> => {
  return simulatedToken || 'mock-drive-access-token-oxente';
};

export const logout = async () => {
  simulatedUser = null;
  simulatedToken = null;
  localStorage.removeItem('oxente_google_drive_simulated_user');
};

// Interfaces for local-simulated Drive files
export interface DriveBackupFile {
  id: string;
  name: string;
  createdTime: string;
  size?: string;
  content?: string; // Store serialized backup
}

/**
 * Lists backups in simulated storage
 */
export const listDriveBackups = async (accessToken: string): Promise<DriveBackupFile[]> => {
  try {
    const listStr = localStorage.getItem('oxente_drive_backups_simulated');
    if (!listStr) return [];
    const list: DriveBackupFile[] = JSON.parse(listStr);
    return list;
  } catch (error) {
    console.error('Error listing Drive backups:', error);
    return [];
  }
};

/**
 * Uploads a backup file to simulated cloud (localStorage) and triggers browser file download for peace of mind
 */
export const uploadBackupToDrive = async (
  accessToken: string,
  backupData: any
): Promise<DriveBackupFile> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
    const fileName = `backup_oxente_festeje_${today}_${time}.json`;
    const fileContent = JSON.stringify(backupData, null, 2);

    const newBackup: DriveBackupFile = {
      id: `bkp-${Date.now()}`,
      name: fileName,
      createdTime: new Date().toISOString(),
      size: `${(fileContent.length / 1024).toFixed(1)} KB`,
      content: fileContent
    };

    // Save to list
    const listStr = localStorage.getItem('oxente_drive_backups_simulated');
    const list: DriveBackupFile[] = listStr ? JSON.parse(listStr) : [];
    list.unshift(newBackup);
    localStorage.setItem('oxente_drive_backups_simulated', JSON.stringify(list));

    // Also trigger beautiful native file download in browser so user gets physical backup file!
    try {
      const blob = new Blob([fileContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      console.warn('File auto download was blocked or failed, backup stored in browser local state.');
    }

    return newBackup;
  } catch (error) {
    console.error('Error saving backup:', error);
    throw error;
  }
};

/**
 * Downloads/restores a backup from simulated cloud memory
 */
export const downloadBackupFromDrive = async (
  accessToken: string,
  fileId: string
): Promise<any> => {
  try {
    const listStr = localStorage.getItem('oxente_drive_backups_simulated');
    if (!listStr) throw new Error('No backups list found');
    const list: DriveBackupFile[] = JSON.parse(listStr);
    const found = list.find(b => b.id === fileId);
    if (!found || !found.content) {
      throw new Error('Backup content not found or corrupted.');
    }
    return JSON.parse(found.content);
  } catch (error) {
    console.error('Error downloading backup:', error);
    throw error;
  }
};

/**
 * Deletes a file from simulated cloud memory
 */
export const deleteBackupFromDrive = async (
  accessToken: string,
  fileId: string
): Promise<boolean> => {
  try {
    const listStr = localStorage.getItem('oxente_drive_backups_simulated');
    if (!listStr) return false;
    let list: DriveBackupFile[] = JSON.parse(listStr);
    list = list.filter(b => b.id !== fileId);
    localStorage.setItem('oxente_drive_backups_simulated', JSON.stringify(list));
    return true;
  } catch (error) {
    console.error('Error deleting backup:', error);
    throw error;
  }
};
