"use client";

import { useCallback, useRef } from "react";
import { apiRequest } from "@/lib/api";

type ReportWithItems<Item extends { id: number }> = {
  id: number;
  reportItems: Item[];
};

/** Persist a report's parameter order and roll the list back if the save fails. */
export function useReportItemOrder<
  Item extends { id: number },
  Report extends ReportWithItems<Item>,
>(
  report: Report | null,
  setReport: (next: Report) => void,
  onError: (message: string) => void
) {
  const latest = useRef("");

  return useCallback(
    async (nextItems: Item[]) => {
      if (!report) return;
      const key = nextItems.map((item) => item.id).join(",");
      latest.current = key;
      const previous = report.reportItems;
      setReport({ ...report, reportItems: nextItems });
      try {
        const res = await apiRequest(`/api/reports/${report.id}/item-order`, {
          method: "PUT",
          body: JSON.stringify({ orderedIds: nextItems.map((item) => item.id) }),
        });
        if (latest.current !== key) return;
        if (!res.ok) {
          setReport({ ...report, reportItems: previous });
          const data = await res.json().catch(() => ({}));
          onError(data.error || "Could not save parameter order");
        }
      } catch {
        if (latest.current !== key) return;
        setReport({ ...report, reportItems: previous });
        onError("Could not save parameter order");
      }
    },
    [onError, report, setReport]
  );
}
