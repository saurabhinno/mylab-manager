"use client";

import { useEffect } from "react";

/**
 * Electron's built-in window.alert / window.confirm leave every text input
 * unable to receive keystrokes until the window is blurred/focused again.
 * Replace them with main-process dialogs that restore focus afterwards.
 */
export default function ElectronDialogPatch() {
  useEffect(() => {
    const api = window.mylab;
    if (!api?.confirm || !api?.alert) return;

    const nativeAlert = window.alert.bind(window);
    const nativeConfirm = window.confirm.bind(window);

    window.alert = (message?: any) => {
      try {
        api.alert!(String(message ?? ""));
      } catch {
        nativeAlert(String(message ?? ""));
      }
    };

    window.confirm = (message?: string) => {
      try {
        return !!api.confirm!(String(message ?? ""));
      } catch {
        return nativeConfirm(String(message ?? ""));
      }
    };

    return () => {
      window.alert = nativeAlert;
      window.confirm = nativeConfirm;
    };
  }, []);

  return null;
}
