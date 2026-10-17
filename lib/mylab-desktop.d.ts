export {};

declare global {
  interface Window {
    mylab?: {
      isDesktop?: boolean;
      /** Electron-safe replacements for window.alert / confirm */
      alert?: (message: string) => void;
      confirm?: (message: string) => boolean;
      restoreInputFocus?: () => void;
      /** Open report PDF in the system viewer (Edge/Adobe); prefer over window.print() */
      print?: () => Promise<{ ok?: boolean; error?: string | null; mode?: string; path?: string }>;
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
      analyzers?: {
        listPorts: () => Promise<MylabSerialPort[]>;
        getStatus: () => Promise<{
          openPath: string | null;
          listening: boolean;
          defaultBaud: number;
          rawPreview: string;
          available?: boolean;
          error?: string | null;
          lan?: {
            listening: boolean;
            port: number;
            defaultPort: number;
            clients: number;
            addresses: { name: string; address: string }[];
          };
        }>;
        getRaw: () => Promise<{ raw: string }>;
        clearRaw: () => Promise<{ ok: boolean }>;
        open: (
          path: string,
          options?: {
            baudRate?: number;
            dataBits?: number;
            stopBits?: number;
            parity?: string;
          }
        ) => Promise<{
          ok?: boolean;
          path?: string;
          baudRate?: number;
          error?: string;
        }>;
        close: () => Promise<{ ok: boolean }>;
        startLan: (
          port?: number
        ) => Promise<{
          ok?: boolean;
          already?: boolean;
          port?: number;
          addresses?: { name: string; address: string }[];
          error?: string;
        }>;
        stopLan: () => Promise<{ ok?: boolean; listening?: boolean; error?: string }>;
        probeHost: (
          host: string,
          ports?: number[]
        ) => Promise<{
          ok?: boolean;
          host?: string;
          openPorts?: number[];
          hint?: string;
          ourListen?: { port: number; listening: boolean; selfConnectOk: boolean };
          addresses?: { name: string; address: string }[];
          error?: string;
        }>;
        connectLan: (
          host: string,
          port?: number
        ) => Promise<{ ok?: boolean; host?: string; port?: number; error?: string }>;
        disconnectLanClient: () => Promise<{ ok?: boolean; error?: string }>;
        onPorts: (cb: (ports: MylabSerialPort[]) => void) => () => void;
        onData: (
          cb: (p: { path: string; chunk: string; at: string }) => void
        ) => () => void;
        onRaw: (
          cb: (p: { path: string; chunk: string; at: string }) => void
        ) => () => void;
        onMessage: (
          cb: (p: { path: string; raw: string; at: string }) => void
        ) => () => void;
        onLan: (
          cb: (p: {
            listening: boolean;
            port: number;
            addresses: { name: string; address: string }[];
          }) => void
        ) => () => void;
        onLanClient: (
          cb: (p: {
            event: string;
            remote: string;
            clients: number;
          }) => void
        ) => () => void;
        onOpened: (
          cb: (p: { path: string; baudRate: number }) => void
        ) => () => void;
        onClosed: (cb: (p: { path: string }) => void) => () => void;
        onError: (
          cb: (p: { path: string; error: string }) => void
        ) => () => void;
      };
    };
  }

  type MylabSerialPort = {
    path: string;
    manufacturer: string | null;
    vendorId: string | null;
    productId: string | null;
    serialNumber: string | null;
    pnpId: string | null;
    friendlyName: string;
    likelyAnalyzer: boolean;
  };

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
