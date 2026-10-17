/** Day-wise report number shown to users (resets to 1 each day). */
export function reportDisplayNumber(r: {
  daily_number?: number | null;
  id: number;
}): number {
  return r.daily_number && r.daily_number > 0 ? r.daily_number : r.id;
}
