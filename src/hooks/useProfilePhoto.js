import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import apiService from '../services/api';
import { downscaleImageToBlob } from '../utils/image';
import AvatarCropModal from '../components/common/AvatarCropModal';
import PhotoFocusModal from '../components/common/PhotoFocusModal';

/* The main profile photo, one flow wherever it is changed (the profile
   header, Edit profile): picking a file opens the adjust step (pan/zoom/round
   mask), the cropped square and a larger uncropped copy upload together, then
   the member chooses what the wider crops (header, banner, cards) keep in
   frame. `modals` are portals — render them anywhere in the caller. */
export default function useProfilePhoto() {
  const { user, updateUser } = useAppContext();
  const [file, setFile] = useState(null);
  const [focusOpen, setFocusOpen] = useState(false);

  const onPick = (event) => {
    const picked = event.target.files[0];
    event.target.value = '';
    if (!picked || !user?.id) return;
    setFile(picked);
  };

  // The crop is already the server's 512px avatar size — upload as-is.
  // Errors propagate to the crop modal's inline error display.
  const onCropped = async (croppedBlob) => {
    const largeBlob = await downscaleImageToBlob(file, { maxDimension: 1600, quality: 0.85 }).catch(() => null);
    const response = await apiService.uploadAvatar(user.id, croppedBlob, largeBlob);
    // The multipart endpoint wraps the row: { profile }.
    updateUser(response.profile || response);
    setFile(null);
    setFocusOpen(true);
  };

  const saveFocus = async (avatarFocus) => {
    const res = await apiService.updateProfile(user.id, { avatarFocus });
    updateUser(res.profile || res);
    setFocusOpen(false);
  };

  const modals = (
    <>
      <AvatarCropModal file={file} onCancel={() => setFile(null)} onApply={onCropped} />
      <PhotoFocusModal
        open={focusOpen}
        src={user?.avatarLarge || user?.avatar}
        focus={user?.avatarFocus}
        onCancel={() => setFocusOpen(false)}
        onSave={saveFocus}
      />
    </>
  );

  return { onPick, setFocusOpen, modals };
}
