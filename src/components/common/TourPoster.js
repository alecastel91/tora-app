import React from 'react';

/* The top of a tour card: the artist's photo, the tour as a big title, then who
   and when. Tapping it opens the artist; the status sits over the photo. */
const TourPoster = ({ photo, title, sub, where, status = null, initial = '', onOpen }) => (
  <div className={`tour-poster poster-role-artist${photo ? '' : ' poster-empty'}`}>
    {photo
      ? <img src={photo} alt="" aria-hidden loading="lazy" decoding="async" />
      : <span aria-hidden className="photo-card-initial">{initial}</span>}
    <button type="button" className="photo-card-open" aria-label={title} onClick={onOpen} />
    {status && <div className="tour-poster-status">{status}</div>}
    <div className="tour-poster-text">
      <h3 className="tour-poster-title">{title}</h3>
      {sub && <span className="tour-poster-sub">{sub}</span>}
      {where && <span className="tour-poster-where">{where}</span>}
    </div>
  </div>
);

export default TourPoster;
