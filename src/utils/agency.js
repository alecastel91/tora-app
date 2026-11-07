/** The agency's hero photo everywhere it is shown: its own photo, else the
 *  admin's portrait, else any member's, else `fallback`. */
export const agencyHeroPhoto = (org, fallback = null) =>
  org?.imageUrl
  || org?.members?.find((m) => m.role === 'ADMIN' && m.avatar)?.avatar
  || org?.members?.find((m) => m.avatar)?.avatar
  || fallback;

/** Pending entries of one status, visible to admins only (the API sends none otherwise). */
export const pendingOf = (org, status) => (org?.pending || []).filter((p) => p.status === status);
