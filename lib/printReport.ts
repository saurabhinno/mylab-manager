/** Print current report — desktop opens the system printer dialog; browser uses window.print(). */
export async function printReport() {
  if (typeof window === "undefined") return;

  if (window.mylab?.print) {
    try {
      const res = await window.mylab.print();
      if (res?.ok) return;
      if (res?.error && /cancel/i.test(String(res.error))) return;
      console.warn("Desktop print failed, falling back to window.print()", res?.error);
    } catch (err) {
      console.warn("Desktop print error, falling back to window.print()", err);
    }
  }

  window.print();
}
