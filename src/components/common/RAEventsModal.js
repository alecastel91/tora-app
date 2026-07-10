import React, { useState, useEffect, useCallback } from 'react';
import Modal from './Modal';
import { useLanguage } from '../../contexts/LanguageContext';
import raService from '../../services/raService';
import LoadingGlobe from './LoadingGlobe';

const RAEventsModal = ({ isOpen, onClose, artistName }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('upcoming');
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [pastEvents, setPastEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch both upcoming and past events
      const [upcoming, past] = await Promise.all([
        raService.getArtistEvents(artistName, 'upcoming'),
        raService.getArtistEvents(artistName, 'past')
      ]);
      
      setUpcomingEvents(upcoming);
      setPastEvents(past);
    } catch (err) {
      console.error('Failed to fetch RA events:', err);
      setError('Failed to load events. Please try again later.');
      setUpcomingEvents([]);
      setPastEvents([]);
    } finally {
      setLoading(false);
    }
  }, [artistName]);

  useEffect(() => {
    if (isOpen && artistName) {
      fetchEvents();
    }
  }, [isOpen, artistName, fetchEvents]);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const day = date.getDate();
    return { month, day };
  };


  const currentEvents = activeTab === 'upcoming' ? upcomingEvents : pastEvents;
  const artistSlug = artistName?.toLowerCase().replace(/\s+/g, '-');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${artistName} - ${t('ra.events')}`}
      className="ra-events-modal"
    >
      <div className="ra-events-container">
        {/* Coming Soon Disclaimer */}
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: '#888'
        }}>
          <h3 style={{
            fontSize: '18px',
            color: '#fff',
            marginBottom: '12px'
          }}>
            {t('ra.comingSoon')}
          </h3>
          <p style={{
            fontSize: '14px',
            lineHeight: '1.6',
            maxWidth: '400px',
            margin: '0 auto'
          }}>
            {t('ra.featureInDevelopment')}
          </p>
        </div>

        {/* Tabs - Hidden for now */}
        <div className="ra-events-tabs" style={{ display: 'none' }}>
          <button
            className={`ra-tab ${activeTab === 'upcoming' ? 'active' : ''}`}
            onClick={() => setActiveTab('upcoming')}
          >
            Upcoming Events ({upcomingEvents.length})
          </button>
          <button
            className={`ra-tab ${activeTab === 'past' ? 'active' : ''}`}
            onClick={() => setActiveTab('past')}
          >
            Past Events ({pastEvents.length})
          </button>
        </div>

        <div className="ra-events-header" style={{ display: 'none' }}>
          <p className="ra-events-subtitle">{t('ra.sourceRA')}</p>
          <a
            href={`https://ra.co/dj/${artistSlug}${activeTab === 'past' ? '/pastevents' : ''}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ra-view-all-link"
          >
            {t('ra.viewOnRA')} →
          </a>
        </div>

        <div className="ra-events-list" style={{ display: 'none' }}>
          {loading ? (
            <LoadingGlobe label={t('common.loading')} className="py-8" />
          ) : error ? (
            <div className="error-state">
              <p>{error}</p>
              <button onClick={fetchEvents} className="retry-btn">
                {t('common.retry')}
              </button>
            </div>
          ) : currentEvents.length > 0 ? (
            currentEvents.map(event => {
              const { month, day } = formatDate(event.date);
              const isPast = activeTab === 'past';
              
              return (
                <div key={event.id} className={`ra-event-card ${isPast ? 'past-event' : ''}`}>
                  <div className="event-date-block">
                    <span className="event-month">{month}</span>
                    <span className="event-day">{day}</span>
                    <span className="event-weekday">{event.dayOfWeek}</span>
                  </div>
                  
                  <div className="event-details">
                    <h3 className="event-name">{event.event.name}</h3>
                    <p className="event-location">{event.venue.city}, {event.venue.country}</p>
                    <p className="event-venue">{event.venue.name}</p>
                    
                    {/* Lineup if available */}
                    {event.event.lineup && event.event.lineup.length > 1 && (
                      <div className="event-lineup">
                        <span className="lineup-artists">{event.event.lineup.slice(0, 3).join(', ')}</span>
                      </div>
                    )}
                    
                    {/* Media badge for past events */}
                    {isPast && event.media && (
                      <div className="event-media-info">
                        <span className="media-badge">
                          📸 {event.media.photos} | 🎥 {event.media.videos}
                        </span>
                        {event.media.url && (
                          <a 
                            href={event.media.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="event-media-link"
                          >
                            View Media →
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="no-events">
              <p>
                {activeTab === 'upcoming' 
                  ? t('ra.noUpcomingEvents') 
                  : t('ra.noPastEvents')}
              </p>
            </div>
          )}
        </div>

        <div className="ra-events-footer" style={{ display: 'none' }}>
          <p className="ra-disclaimer">{t('ra.disclaimer')}</p>
        </div>
      </div>
    </Modal>
  );
};

export default RAEventsModal;