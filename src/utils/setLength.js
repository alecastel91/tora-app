// A set's length in minutes: from its start and end times when both are set
// (a set can cross midnight: 23:00–01:00 is 120), else the stored setDuration,
// else null. The booking page and Chat both read it, so a typed duration that
// disagrees with the times never shows as two different lengths.
export const setLength = (o) => {
  const [sh, sm] = String(o?.setStartTime || '').split(':').map(Number);
  const [eh, em] = String(o?.setEndTime || '').split(':').map(Number);
  if ([sh, sm, eh, em].every(Number.isFinite)) {
    const m = (eh * 60 + em - (sh * 60 + sm) + 1440) % 1440;
    if (m) return m;
  }
  const d = Number(o?.setDuration);
  return d > 0 ? d : null;
};
