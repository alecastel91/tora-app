import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Cropper from 'react-easy-crop';
import { useLanguage } from '../../contexts/LanguageContext';

// Standard avatar adjust step: drag to recenter, slider/pinch to zoom, round
// mask preview. Crops straight to the server's avatar size (512px) — the
// caller uploads the blob as-is; the backend re-normalizes anyway, so no
// intermediate decode/re-encode pass is needed.
const OUTPUT_SIZE = 512;

function cropToBlob(imageUrl, area) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      canvas.getContext('2d').drawImage(
        img,
        area.x, area.y, area.width, area.height,
        0, 0, OUTPUT_SIZE, OUTPUT_SIZE
      );
      const toBlob = (type) => new Promise((res) => canvas.toBlob(res, type, 0.9));
      toBlob('image/webp').then((blob) => {
        if (blob && blob.type === 'image/webp') return resolve(blob);
        return toBlob('image/jpeg').then((jpeg) => (jpeg ? resolve(jpeg) : reject(new Error('Could not process the image.'))));
      });
    };
    img.onerror = () => reject(new Error('Could not read the image.'));
    img.src = imageUrl;
  });
}

const AvatarCropModal = ({ file, onCancel, onApply }) => {
  const { t } = useLanguage();
  const [imageUrl, setImageUrl] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cropError, setCropError] = useState(null);

  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCropError(null);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onCropComplete = useCallback((_, croppedAreaPixels) => {
    setAreaPixels(croppedAreaPixels);
  }, []);

  const handleApply = async () => {
    if (!imageUrl || !areaPixels || busy) return;
    setBusy(true);
    setCropError(null);
    try {
      const blob = await cropToBlob(imageUrl, areaPixels);
      await onApply(blob);
    } catch (err) {
      // corrupt image / canvas failure — surface it instead of a silent UI
      setCropError(err?.message || t('profile.uploadFailed'));
    } finally {
      setBusy(false);
    }
  };

  if (!file) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/80 p-5" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#131315] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="m-0 mb-4 text-[13px] font-semibold text-white font-space-grotesk uppercase tracking-[0.08em] text-center">
          {t('editProfile.adjustPhoto')}
        </h3>
        <div className="relative h-[320px] rounded-xl overflow-hidden bg-black">
          {imageUrl && (
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              minZoom={1}
              maxZoom={4}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>
        <div className="flex items-center gap-3 mt-4">
          <span className="text-white/40 text-xs">−</span>
          <input
            type="range"
            min={1}
            max={4}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-[#FF3366]"
          />
          <span className="text-white/40 text-base leading-none">+</span>
        </div>
        <p className="m-0 mt-3 text-[12px] leading-snug text-white/70">{t('profile.photoFullNote')}</p>
        {cropError && (
          <p className="m-0 mt-3 text-[12px] text-role-venue/90 text-center">{cropError}</p>
        )}
        <div className="flex gap-2.5 mt-4">
          <button className="btn btn-outline flex-1" onClick={onCancel} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button className="btn btn-primary flex-1" onClick={handleApply} disabled={busy || !areaPixels}>
            {busy ? '...' : t('common.save')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AvatarCropModal;
