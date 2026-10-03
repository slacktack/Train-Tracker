/** Minutes since epoch for an IST wall-clock date and time (safe to use on server and client). */
export const toMinutes = (iso: string, hhmm: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  return Date.UTC(y, m - 1, d, h, mi) / 60000;
};
