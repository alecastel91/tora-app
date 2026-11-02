import { useRef, useState } from 'react';

/**
 * The PDF-next-to-the-form state machine shared by the document modals
 * (issue an invoice, draft a contract).
 *
 * - `build(fetcher)` runs `fetcher` (→ `{ url, ...meta }`, `url` a blob URL)
 *   and shows the result. Only the LATEST build counts: an earlier one that
 *   resolves late is revoked and discarded, and `building` is cleared only
 *   by the build that is still current. Resolves `true` when the result is
 *   on screen; errors from the current build propagate to the caller.
 * - `markStale()` after every form edit: a build started before the edit
 *   comes back already stale (old PDF stays dimmed under "Update preview").
 * - `drop()` on close or template switch: revokes the blob and cancels any
 *   build in flight.
 */
export default function usePdfPreview() {
  const [url, setUrl] = useState(null);
  const [meta, setMeta] = useState(null);
  const [stale, setStale] = useState(false);
  const [building, setBuilding] = useState(false);
  const [viewing, setViewing] = useState(false); // full-screen viewer open
  const editSeq = useRef(0);
  const buildSeq = useRef(0);

  const markStale = () => { editSeq.current += 1; setStale(true); };

  const drop = () => {
    buildSeq.current += 1;
    setBuilding(false); setViewing(false); setStale(false); setMeta(null);
    setUrl((u) => { if (u) URL.revokeObjectURL(u); return null; });
  };

  const build = async (fetcher) => {
    const mine = ++buildSeq.current;
    const at = editSeq.current;
    setBuilding(true);
    try {
      const { url: next, ...rest } = await fetcher();
      if (buildSeq.current !== mine) { URL.revokeObjectURL(next); return false; }
      setUrl((u) => { if (u) URL.revokeObjectURL(u); return next; });
      setMeta(rest);
      setStale(editSeq.current !== at);
      return true;
    } catch (e) {
      if (buildSeq.current !== mine) return false; // superseded: its error is nobody's concern
      throw e;
    } finally {
      if (buildSeq.current === mine) setBuilding(false);
    }
  };

  return { url, meta, stale, building, viewing, setViewing, markStale, drop, build };
}
