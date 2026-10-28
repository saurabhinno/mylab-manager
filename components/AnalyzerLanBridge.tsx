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
  const queue = useRef<{ raw: string; machinePath: string }[]>([]);

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

    async function pump() {
      if (saving.current || cancelled) return;
      const next = queue.current.shift();
      if (!next) return;
      saving.current = true;
      try {
        const res = await apiRequest("/api/analyzers/inbox", {
          method: "POST",
          body: JSON.stringify({
            raw: next.raw,
            profile_id: PROFILE_ID,
            machine_path: next.machinePath,
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
        void pump();
      }
    }

    function saveMessage(raw: string, machinePath: string) {
      if (!raw.trim()) return;
      queue.current.push({ raw, machinePath });
      void pump();
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
