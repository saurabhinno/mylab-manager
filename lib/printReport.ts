/** Print the open report — opens the normal Windows print dialog. */
export async function printReport() {
  if (typeof window === "undefined") return;

  if (window.mylab?.print) {
    try {
      const res = await window.mylab.print();
      if (res?.ok) return;
      if (res?.error && /cancel/i.test(String(res.error))) return;
      console.warn("Desktop print failed", res?.error);
    } catch (err) {
      console.warn("Desktop print error", err);
    }
    return;
  }

  window.print();
}
