import React, { useEffect, useState } from 'react';
import apiService from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { appAlert, appConfirm } from '../../utils/dialogs';
import { getAvatarClass, roleLabel } from '../../utils/roles';

/**
 * Settings → Blocked members. Required by App Review guideline 1.2: a member
 * who blocked someone must be able to see and undo it. Loads on mount of the
 * Settings screen, which is the only place it is rendered.
 */
const BlockedMembers = () => {
  const { t } = useLanguage();
  const [blocks, setBlocks] = useState(null); // null = loading
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    apiService.getBlocks()
      .then((d) => { if (!cancelled) setBlocks(d.blocks || []); })
      .catch(() => { if (!cancelled) setBlocks([]); });
    return () => { cancelled = true; };
  }, []);

  const unblock = async (entry) => {
    const name = entry.profiles?.[0]?.name || t('safety.thisMember');
    const ok = await appConfirm(t('safety.unblockConfirm', { name }), { confirmLabel: t('safety.unblock') });
    if (!ok) return;
    setBusyId(entry.userId);
    try {
      await apiService.unblockMember(entry.userId);
      setBlocks((cur) => (cur || []).filter((b) => b.userId !== entry.userId));
    } catch (err) {
      appAlert(err.message || t('safety.unblockFailed'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="settings-section">
      <h3>{t('safety.blockedTitle')}</h3>
      {blocks === null ? (
        <p className="form-hint">{t('common.loading')}</p>
      ) : blocks.length === 0 ? (
        <p className="form-hint">{t('safety.blockedEmpty')}</p>
      ) : (
        <ul className="blocked-list">
          {blocks.map((b) => {
            const main = b.profiles?.[0];
            const others = (b.profiles || []).slice(1);
            return (
              <li key={b.userId} className="blocked-row">
                <span className={`blocked-avatar ${getAvatarClass(main?.role)}`}>
                  {main?.avatar ? <img src={main.avatar} alt={main.name} /> : (main?.name || '?').charAt(0).toUpperCase()}
                </span>
                <span className="blocked-who">
                  <strong>{main?.name || t('safety.thisMember')}</strong>
                  <small>
                    {main?.role ? roleLabel(main.role, t) : ''}
                    {others.length > 0 ? ` · ${t('safety.alsoProfiles', { n: others.length })}` : ''}
                  </small>
                </span>
                <button type="button" className="btn btn-outline btn-sm" disabled={busyId === b.userId} onClick={() => unblock(b)}>
                  {t('safety.unblock')}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default BlockedMembers;
