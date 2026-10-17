"use client";

import { useEffect, useRef } from "react";
import { apiRequest } from "@/lib/api";

const DEFAULT_LAN_PORT = 5100;
const PROFILE_ID = "cellenium-21";

/**
 * Desktop: keep LAN HL7 listen up after login.
 * Incoming machine messages are saved to inbox and auto-create a CBC report
 * (patient name + prefilled results) so they appear on the reports list.
 */
export default function AnalyzerLanBridge() {
  const saving = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.mylab?.analyzers) return;
    const api = window.mylab.analyzers;
    let cancelled = false;

    async function ensureListen() {
      try {
        const st = await api.getStatus();
        if (st?.lan?.listening) return;
        await api.startLan(st?.lan?.defaultPort || DEFAULT_LAN_PORT);
      } catch {
        /* ignore */
      }
    }

    async function saveMessage(raw: string, machinePath: string) {
      if (!raw.trim() || saving.current) return;
      saving.current = true;
      try {
        const res = await apiRequest("/api/analyzers/inbox", {
          method: "POST",
          body: JSON.stringify({
            raw,
            profile_id: PROFILE_ID,
            machine_path: machinePath,
            auto_create_report: true,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.report_id) {
            window.dispatchEvent(
              new CustomEvent("mylab:report-created", {
                detail: {
                  reportId: data.report_id,
                  patientName: data.patient_name,
                },
              })
            );
          }
        }
      } catch {
        /* ignore */
      } finally {
        saving.current = false;
      }
    }

    void ensureListen();

    const offMessage = api.onMessage?.((payload) => {
      if (cancelled) return;
      void saveMessage(payload.raw, payload.path);
    });

    const offError = api.onError?.((p) => {
      console.warn("[analyzer-lan]", p.path, p.error);
    });

    return () => {
      cancelled = true;
      offMessage?.();
      offError?.();
    };
  }, []);

  return null;
}
