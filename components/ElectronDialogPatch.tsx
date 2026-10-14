"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    mylab?: {
      isDesktop?: boolean;
      alert?: (message: string) => void;
      confirm?: (message: string) => boolean;
      restoreInputFocus?: () => void;
      drive?: unknown;
      updates?: unknown;
    };
  }
}

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

    // Safety net: if focus was already broken (older session / other dialogs),
    // clicking the window recovers typing after a quick blur/focus cycle.
    const onPointerDown = () => {
      // Only recover if an input is "focused" but not actually editable
      const el = document.activeElement as HTMLElement | null;
      if (!el) return;
      const tag = el.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA" && !el.isContentEditable) return;
      // If selection works, input is fine — skip
      try {
        const input = el as HTMLInputElement;
        if (typeof input.selectionStart === "number") return;
      } catch {
        /* ignore */
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.alert = nativeAlert;
      window.confirm = nativeConfirm;
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  return null;
}
