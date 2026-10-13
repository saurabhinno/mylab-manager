export {};

declare global {
  interface Window {
    mylab?: {
      isDesktop?: boolean;
      drive?: {
        getStatus: () => Promise<{
          mode?: string;
          configured: boolean;
          connected: boolean;
          email?: string | null;
          error?: string | null;
          schedule?: string;
          localIsEmpty?: boolean;
          folderUrl?: string | null;
          folderName?: string | null;
          remote?: { modifiedTime?: string; size?: string } | null;
          meta?: {
            lastBackupAt?: string;
            lastRestoreAt?: string;
            lastBackupError?: string | null;
            folderUrl?: string | null;
          };
        }>;
        backupNow: () => Promise<{ ok?: boolean; error?: string }>;
        restore: () => Promise<{ ok?: boolean; cancelled?: boolean; error?: string }>;
      };
      updates?: {
        getStatus: () => Promise<MylabUpdateStatus>;
        check: () => Promise<MylabUpdateStatus>;
        download: () => Promise<MylabUpdateStatus>;
        install: () => Promise<{ ok: boolean; error?: string }>;
        getVersion: () => Promise<string>;
        onStatus: (cb: (s: MylabUpdateStatus) => void) => () => void;
      };
    };
  }

  type MylabUpdateStatus = {
    status:
      | "idle"
      | "checking"
      | "available"
      | "downloading"
      | "ready"
      | "latest"
      | "error"
      | "dev";
    currentVersion: string;
    latestVersion: string | null;
    percent: number;
    transferred: number;
    total: number;
    error: string | null;
    message: string | null;
    packaged?: boolean;
  };
}
