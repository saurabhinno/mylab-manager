/** Print current report — desktop spools via Windows; browser uses window.print(). */
export async function printReport() {
  if (typeof window === "undefined") return;

  if (window.mylab?.print) {
    try {
      const res = await window.mylab.print();
      if (res?.ok) return;
      if (res?.error && /cancel/i.test(String(res.error))) return;
      console.warn("Desktop print failed, falling back to window.print()", res?.error);
      if (window.mylab.alert) {
        window.mylab.alert(
          `Print failed${res?.error ? `: ${res.error}` : ""}. Trying browser print…`
        );
      }
    } catch (err) {
      console.warn("Desktop print error, falling back to window.print()", err);
      if (window.mylab.alert) {
        window.mylab.alert(
          `Print failed: ${err instanceof Error ? err.message : String(err)}. Trying browser print…`
        );
      }
    }
  }

  window.print();
}
