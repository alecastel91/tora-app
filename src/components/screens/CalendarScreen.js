import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAppContext } from '../../contexts/AppContext';
import { zones, countriesByZone, citiesByCountry } from '../../data/profiles';
import { CloseIcon, CalendarIcon, ListIcon } from '../../utils/icons';
import Modal from '../common/Modal';
import apiService from '../../services/api';

const CalendarScreen = ({ onClose, embedded = false }) => {
  const { t } = useLanguage();
  const { user, updateUser } = useAppContext();
  const [selectedDates, setSelectedDates] = useState(new Set(user?.availableDates || []));
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [schedules, setSchedules] = useState(user?.travelSchedule || []);
  const [editingScheduleId, setEditingScheduleId] = useState(null);

  // Delete confirmation state
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState(null);

  // Upcoming events state for Promoters/Venues
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [expandedDealId, setExpandedDealId] = useState(null);
  const isPromoterOrVenue = user?.role === 'PROMOTER' || user?.role === 'VENUE';

  // Drag selection state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartDate, setDragStartDate] = useState(null);
  const [dragMode, setDragMode] = useState(null); // 'select' or 'deselect'
  const [hasDragged, setHasDragged] = useState(false); // Track if user actually dragged

// Refresh travel schedule and available dates from backend when calendar opens
  React.useEffect(() => {
    const refreshCalendarData = async () => {
      try {
        const profileId = user?.id;
        if (!profileId) return;

        console.log('[CalendarScreen] Refreshing calendar data from backend...');
        const freshProfile = await apiService.getProfile(profileId);

        // Update travel schedule
        setSchedules(freshProfile.travelSchedule || []);

        // Update available dates from backend
        setSelectedDates(new Set(freshProfile.availableDates || []));

        // Also update context to keep it in sync
        updateUser({
          ...user,
          travelSchedule: freshProfile.travelSchedule || [],
          availableDates: freshProfile.availableDates || []
        });

        console.log('[CalendarScreen] Calendar data refreshed successfully');
      } catch (error) {
        console.error('[CalendarScreen] Failed to refresh calendar data:', error);
      }
    };

    refreshCalendarData();
  }, []); // Run once when component mounts

  // Update schedules when user changes (to keep in sync with context)
  React.useEffect(() => {
    if (user?.travelSchedule) {
      setSchedules(user.travelSchedule);
    }
  }, [user?.travelSchedule]);

  // Fetch upcoming events for Promoters/Venues
  useEffect(() => {
    const fetchUpcomingEvents = async () => {
      if (!isPromoterOrVenue || !user?.id) return;

      try {
        console.log('[CalendarScreen] Fetching upcoming events for Promoter/Venue...');
        const response = await apiService.getDeals({ profileId: user.id });

        if (response && response.deals) {
          // Filter for upcoming events (future dates with active statuses)
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const upcoming = response.deals
            .filter(deal => {
              const dealDate = new Date(deal.date);
              const hasUpcomingDate = dealDate >= today;
              const hasActiveStatus = ['PENDING', 'NEGOTIATING', 'ACCEPTED'].includes(deal.status);
              return hasUpcomingDate && hasActiveStatus;
            })
            .sort((a, b) => new Date(a.date) - new Date(b.date)) // Sort by date ascending
            .slice(0, 10); // Limit to 10 events

          setUpcomingEvents(upcoming);
          console.log('[CalendarScreen] Found upcoming events:', upcoming.length);
        }
      } catch (error) {
        console.error('[CalendarScreen] Error fetching upcoming events:', error);
      }
    };

    fetchUpcomingEvents();
  }, [user?.id, isPromoterOrVenue]);

  // NOTE: We refresh both availableDates and travelSchedule from backend on mount
  // This ensures we have the latest data when switching between CalendarScreen and ManageArtistScreen
  
  const [scheduleForm, setScheduleForm] = useState({
    zone: '',
    country: '',
    city: '',
    startDate: '',
    endDate: '',
    lookingFor: {
      promoter: false,
      venue: false,
      artist: false
    }
  });

  // State for calendar navigation
  const todayDate = new Date();
  const [currentMonth, setCurrentMonth] = useState(todayDate.getMonth());
  const [currentYear, setCurrentYear] = useState(todayDate.getFullYear());
  
  const getDaysInMonth = (month, year) => {
    return new Date(year, month + 1, 0).getDate();
  };
  
  const getFirstDayOfMonth = (month, year) => {
    return new Date(year, month, 1).getDay();
  };
  
  const daysInMonth = getDaysInMonth(currentMonth, currentYear);
  const firstDayOfMonth = getFirstDayOfMonth(currentMonth, currentYear);
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Determine what roles current user can look for based on their role
  const getAvailableLookingForOptions = () => {
    const role = user?.role;
    switch(role) {
      case 'ARTIST':
        return ['promoter', 'venue'];
      case 'PROMOTER':
        return ['artist', 'venue'];
      case 'VENUE':
        return ['artist', 'promoter'];
      case 'AGENT':
        return ['promoter', 'venue'];
      default:
        return [];
    }
  };

  const availableOptions = getAvailableLookingForOptions();

  // Navigation functions
  const goToPreviousMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const goToToday = () => {
    setCurrentMonth(todayDate.getMonth());
    setCurrentYear(todayDate.getFullYear());
  };

  const handleClose = () => {
    console.log('[CalendarScreen] Closing with schedules:', schedules);
    console.log('[CalendarScreen] User object:', user);

    // Get profile ID - try multiple possible fields
    const profileId = user?.id;

    if (!profileId) {
      console.error('[CalendarScreen] Cannot save - Profile ID is missing. User object:', user);
      // Still close the screen even if we can't save
      onClose();
      return;
    }

    console.log('[CalendarScreen] Using profileId:', profileId);

    // Update context immediately with current state before closing
    const updatedUserData = {
      ...user,
      availableDates: Array.from(selectedDates),
      travelSchedule: schedules
    };

    console.log('[CalendarScreen] Updating context with:', updatedUserData);
    updateUser(updatedUserData);

    // Close immediately
    onClose();

    // Save to backend in background (don't await)
    const saveData = async () => {
      try {
        console.log('[CalendarScreen] Saving to backend, profileId:', profileId, 'data:', {
          availableDates: Array.from(selectedDates),
          travelSchedule: schedules
        });

        // Save available dates and schedules to backend
        const result = await apiService.updateProfile(profileId, {
          availableDates: Array.from(selectedDates),
          travelSchedule: schedules
        });
        console.log('[CalendarScreen] Backend save successful:', result);
      } catch (error) {
        console.error('[CalendarScreen] Failed to save calendar data:', error);
      }
    };

    saveData();
  };

  // Save dates to backend
  const saveDatesToBackend = async (dates) => {
    try {
      const profileId = user?.id;

      if (!profileId) {
        console.error('[CalendarScreen] Cannot save available dates - Profile ID is missing, user:', user);
        return;
      }

      console.log('[CalendarScreen] Saving available dates to backend, profileId:', profileId, 'dates:', Array.from(dates));

      // Update context immediately
      const updatedUserData = {
        ...user,
        availableDates: Array.from(dates)
      };
      updateUser(updatedUserData);
      console.log('[CalendarScreen] Context updated');

      // Save to backend using apiService (same as handleClose does at line 175)
      console.log('[CalendarScreen] Calling apiService.updateProfile...');

      const result = await apiService.updateProfile(profileId, {
        availableDates: Array.from(dates)
      });

      console.log('[CalendarScreen] API response:', result);
      console.log('[CalendarScreen] Available dates saved successfully to backend');
    } catch (error) {
      console.error('[CalendarScreen] Failed to save available dates:', error);
      console.error('[CalendarScreen] Error details:', error.message, error.stack);
    }
  };

  // Handle mouse/touch down on a date (start potential drag)
  const handleDateMouseDown = (day) => {
    const dateKey = `${currentYear}-${currentMonth + 1}-${day}`;
    setIsDragging(true);
    setHasDragged(false); // Reset drag tracking
    setDragStartDate(dateKey);

    // Determine if we're selecting or deselecting based on current state
    const isCurrentlySelected = selectedDates.has(dateKey);
    setDragMode(isCurrentlySelected ? 'deselect' : 'select');

    // Toggle immediately for instant visual feedback
    const newSelected = new Set(selectedDates);
    if (isCurrentlySelected) {
      newSelected.delete(dateKey);
    } else {
      newSelected.add(dateKey);
    }

    console.log('[CalendarScreen] Mouse down on date:', dateKey, 'New state:', Array.from(newSelected));
    setSelectedDates(newSelected);
  };

  // Handle mouse/touch enter on a date (during drag)
  const handleDateMouseEnter = (day) => {
    if (!isDragging) return;

    const dateKey = `${currentYear}-${currentMonth + 1}-${day}`;

    // If entering a different date, this is a drag not a click
    if (dateKey !== dragStartDate) {
      setHasDragged(true);
      console.log('[CalendarScreen] Dragging detected');
    }

    const newSelected = new Set(selectedDates);

    if (dragMode === 'select') {
      newSelected.add(dateKey);
    } else {
      newSelected.delete(dateKey);
    }

    setSelectedDates(newSelected);
  };

  // Handle mouse/touch up (end drag or click)
  const handleDateMouseUp = async () => {
    if (isDragging) {
      console.log('[CalendarScreen] Mouse up - hasDragged:', hasDragged, 'dragStartDate:', dragStartDate);

      setIsDragging(false);
      setDragStartDate(null);
      setDragMode(null);
      setHasDragged(false);

      // Trigger save
      setShouldSave(true);
    }
  };

  // Save effect - triggered after drag/click completes
  const [shouldSave, setShouldSave] = React.useState(false);

  React.useEffect(() => {
    console.log('[CalendarScreen] Save effect triggered - shouldSave:', shouldSave, 'selectedDates:', Array.from(selectedDates));
    if (shouldSave) {
      console.log('[CalendarScreen] Saving selectedDates:', Array.from(selectedDates));

      // Call the existing saveDatesToBackend function
      saveDatesToBackend(selectedDates);

      setShouldSave(false);
    }
  }, [shouldSave, selectedDates, saveDatesToBackend]);

  // Add effect to handle global mouse up (in case user releases outside calendar)
  React.useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleDateMouseUp();
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('touchend', handleGlobalMouseUp);

    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('touchend', handleGlobalMouseUp);
    };
  }, [isDragging, selectedDates]);

  const handleSaveSchedule = async () => {
    if (scheduleForm.startDate && scheduleForm.endDate) {
      // Validate that end date is not before start date
      const startDate = new Date(scheduleForm.startDate);
      const endDate = new Date(scheduleForm.endDate);

      if (endDate < startDate) {
        alert('End date cannot be before start date. Please adjust your dates.');
        return;
      }

      // Check for overlapping schedules
      const hasOverlap = schedules.some((schedule) => {
        // Skip the schedule being edited
        if (editingScheduleId && schedule.id === editingScheduleId) {
          return false;
        }

        const existingStart = new Date(schedule.startDate);
        const existingEnd = new Date(schedule.endDate);

        // Check if date ranges overlap
        // Two date ranges overlap if: start1 <= end2 AND start2 <= end1
        return startDate <= existingEnd && existingStart <= endDate;
      });

      if (hasOverlap) {
        alert('This travel schedule overlaps with an existing schedule. Please choose different dates.');
        return;
      }

      let updatedSchedules;
      if (editingScheduleId) {
        // Editing existing schedule - preserve all existing fields
        updatedSchedules = schedules.map(s => {
          if (s.id === editingScheduleId) {
            return {
              ...s,              // Preserve all existing fields (including id, createdAt, etc.)
              ...scheduleForm    // Override with new form data
            };
          }
          return s;
        });
        console.log('[CalendarScreen] Editing existing schedule with id:', editingScheduleId);
      } else {
        // Adding new schedule
        const newSchedule = {
          id: `schedule-${Date.now()}`,
          ...scheduleForm,
          createdAt: new Date().toISOString()
        };
        updatedSchedules = [...schedules, newSchedule];
        console.log('[CalendarScreen] Adding new schedule with id:', newSchedule.id);
      }

      // Update local state immediately for instant feedback
      setSchedules(updatedSchedules);

      try {
        const profileId = user.id || user.id;

        if (!profileId) {
          console.error('Profile ID is missing');
          return;
        }

        // Save to backend
        const updatedProfile = await apiService.updateProfile(profileId, {
          ...user,
          travelSchedule: updatedSchedules
        });

        // Update context with backend response
        updateUser(updatedProfile);

        setShowLocationModal(false);
        setEditingScheduleId(null);
        setScheduleForm({
          zone: '',
          country: '',
          city: '',
          startDate: '',
          endDate: '',
          lookingFor: {
            promoter: false,
            venue: false,
            artist: false
          }
        });
      } catch (error) {
        console.error('Failed to save schedule:', error);
        // Revert local state on error
        setSchedules(schedules);
        alert('Failed to save schedule. Please try again.');
      }
    }
  };

  const handleEditSchedule = (schedule) => {
    // Format dates for HTML date input (YYYY-MM-DD)
    const formatDateForInput = (dateString) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Set schedule form with properly formatted data
    setScheduleForm({
      zone: schedule.zone || '',
      country: schedule.country || '',
      city: schedule.city || '',
      startDate: formatDateForInput(schedule.startDate),
      endDate: formatDateForInput(schedule.endDate),
      lookingFor: {
        promoter: schedule.lookingFor?.promoter || false,
        venue: schedule.lookingFor?.venue || false,
        artist: schedule.lookingFor?.artist || false
      }
    });

    const scheduleId = schedule.id;
    console.log('[CalendarScreen] Editing schedule with id:', scheduleId);
    setEditingScheduleId(scheduleId);
    setShowLocationModal(true);
  };

  const handleRemoveSchedule = (scheduleId) => {
    // Show confirmation dialog
    setScheduleToDelete(scheduleId);
    setShowDeleteConfirmation(true);
  };

  const confirmDeleteSchedule = async () => {
    if (!scheduleToDelete) return;

    const updatedSchedules = schedules.filter(s => {
      return s.id !== scheduleToDelete;
    });

    try {
      const profileId = user.id;

      if (!profileId) {
        console.error('Profile ID is missing');
        setShowDeleteConfirmation(false);
        setScheduleToDelete(null);
        return;
      }

      // Save to backend
      const updatedProfile = await apiService.updateProfile(profileId, {
        ...user,
        travelSchedule: updatedSchedules
      });

      // Update local state
      setSchedules(updatedSchedules);
      updateUser(updatedProfile);

      // Close confirmation dialog
      setShowDeleteConfirmation(false);
      setScheduleToDelete(null);
    } catch (error) {
      console.error('Failed to remove schedule:', error);
      alert('Failed to remove schedule. Please try again.');
      setShowDeleteConfirmation(false);
      setScheduleToDelete(null);
    }
  };

  const cancelDeleteSchedule = () => {
    setShowDeleteConfirmation(false);
    setScheduleToDelete(null);
  };

  const openNewScheduleModal = () => {
    const today = new Date();
    const dateFormatted = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    setScheduleForm({
      zone: '',
      country: '',
      city: '',
      startDate: dateFormatted,
      endDate: dateFormatted,
      lookingFor: {
        promoter: false,
        venue: false,
        artist: false
      }
    });
    setEditingScheduleId(null);
    setShowLocationModal(true);
  };

  const getLocationLabel = (schedule) => {
    const parts = [];

    // Add each location part if it exists and is not empty
    if (schedule.city && schedule.city.trim()) {
      parts.push(schedule.city);
    }
    if (schedule.country && schedule.country.trim()) {
      parts.push(schedule.country);
    }
    if (schedule.zone && schedule.zone.trim()) {
      parts.push(schedule.zone);
    }

    // Return all parts joined with commas, or fallback
    return parts.length > 0 ? parts.join(', ') : 'No location';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getLookingForLabel = (schedule) => {
    const looking = [];
    if (schedule.lookingFor?.promoter) looking.push('Promoters');
    if (schedule.lookingFor?.venue) looking.push('Venues');
    if (schedule.lookingFor?.artist) looking.push('Artists');
    return looking.length > 0 ? looking.join(', ') : 'Not specified';
  };

  const isDateInSchedule = (day) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return schedules.some(schedule => {
      const start = new Date(schedule.startDate);
      const end = new Date(schedule.endDate);
      const current = new Date(dateStr);
      return current >= start && current <= end;
    });
  };

  const getSchedulePosition = (day) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const current = new Date(dateStr);

    for (const schedule of schedules) {
      const start = new Date(schedule.startDate);
      const end = new Date(schedule.endDate);

      if (current >= start && current <= end) {
        const isStart = current.getTime() === start.getTime();
        const isEnd = current.getTime() === end.getTime();
        const isSingle = isStart && isEnd;

        return {
          hasSchedule: true,
          isStart: isStart && !isSingle,
          isEnd: isEnd && !isSingle,
          isSingle: isSingle,
          isMiddle: !isStart && !isEnd,
          schedule: schedule  // Include the schedule object
        };
      }
    }

    return { hasSchedule: false };
  };

  const getLocationDisplayText = (schedule) => {
    if (!schedule) return '';
    // Priority: City → Country → Zone
    if (schedule.city) return schedule.city;
    if (schedule.country) return schedule.country;
    if (schedule.zone) return schedule.zone;
    return '';
  };

  // Helper functions for upcoming events
  const toggleDealExpanded = (dealId) => {
    setExpandedDealId(expandedDealId === dealId ? null : dealId);
  };

  const getStatusBadgeClass = (status) => {
    const statusLower = status?.toLowerCase() || '';
    return `status-badge status-${statusLower}`;
  };

  const formatEventDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const renderCalendarDays = () => {
    const days = [];
    const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    // Render weekday headers
    weekDays.forEach((day, index) => {
      days.push(
        <div key={`header-${index}`} className="calendar-weekday">
          {day}
        </div>
      );
    });
    
    // Empty cells for days before month starts
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(
        <div key={`empty-${i}`} className="calendar-day empty"></div>
      );
    }
    
    // Render days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${currentYear}-${currentMonth + 1}-${day}`;
      const isSelected = selectedDates.has(dateKey);
      const schedulePos = getSchedulePosition(day);

      let scheduleClasses = '';
      if (schedulePos.hasSchedule) {
        if (schedulePos.isSingle) {
          scheduleClasses = 'schedule-single';
        } else if (schedulePos.isStart) {
          scheduleClasses = 'schedule-start';
        } else if (schedulePos.isEnd) {
          scheduleClasses = 'schedule-end';
        } else if (schedulePos.isMiddle) {
          scheduleClasses = 'schedule-middle';
        }
      }

      days.push(
        <div
          key={`day-${day}`}
          className={`calendar-day ${isSelected ? 'available' : ''} ${scheduleClasses}`}
          data-weekday={new Date(currentYear, currentMonth, day).getDay()}
          onClick={() => {
            console.log('[CalendarScreen] onClick fired for day:', day);
            handleDateMouseDown(day);
            handleDateMouseUp();
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            handleDateMouseDown(day);
          }}
          onMouseEnter={() => handleDateMouseEnter(day)}
          onMouseUp={() => handleDateMouseUp()}
          onTouchStart={(e) => {
            e.preventDefault();
            handleDateMouseDown(day);
          }}
          onTouchMove={(e) => {
            e.preventDefault();
            // Get the element under the touch point
            const touch = e.touches[0];
            const element = document.elementFromPoint(touch.clientX, touch.clientY);
            if (element && element.classList.contains('calendar-day')) {
              // Extract day number from the element's text content
              const dayNum = parseInt(element.textContent);
              if (!isNaN(dayNum)) {
                handleDateMouseEnter(dayNum);
              }
            }
          }}
          onTouchEnd={() => handleDateMouseUp()}
          style={{ userSelect: 'none', WebkitUserSelect: 'none', cursor: 'pointer' }}
        >
          {day}
          {schedulePos.hasSchedule && (() => {
            // The trip renders as ONE continuous bar: every scheduled day
            // carries a segment; the destination is written once per week
            // row (at the trip start, and again on Sundays for multi-week
            // trips), with a plane marking the departure day.
            const weekday = new Date(currentYear, currentMonth, day).getDay();
            const isTripStart = schedulePos.isSingle || schedulePos.isStart;
            const showLabel = isTripStart || weekday === 0;
            return (
              <div className={`schedule-label ${showLabel ? 'has-city' : ''}`}>
                {showLabel && (
                  <>
                    {isTripStart && (
                      <svg className="schedule-plane" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
                      </svg>
                    )}
                    <span className="schedule-city">{getLocationDisplayText(schedulePos.schedule)}</span>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      );
    }
    
    return days;
  };

  return (
    <div className={`screen active calendar-screen ${embedded ? 'calendar-embedded' : ''}`}>
      {!embedded && (
        <div className="calendar-header">
          <button className="back-btn" onClick={handleClose}>
            <CloseIcon />
          </button>
          <h1>{t('calendar.title') || 'Calendar & Schedule'}</h1>
          <div style={{ width: '40px' }}></div>
        </div>
      )}

      <div className="calendar-content" style={embedded ? { padding: '0' } : {}}>
        {/* Schedules Display - Conditional based on role */}
        {isPromoterOrVenue ? (
          /* Promoter/Venue Layout - matches agent's dashboard */
          <>
            {/* Calendar View Section */}
            <div className="dashboard-section">
              <h3><CalendarIcon /> Calendar View</h3>
              <div className="calendar-inline-wrapper">
                <div className="calendar-header-inline">
                  <button className="calendar-nav-btn" onClick={goToPreviousMonth}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M12 16L6 10L12 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <div className="calendar-month-info">
                    <h4>{monthNames[currentMonth]} {currentYear}</h4>
                    <p className="calendar-instructions">
                      Tap dates to mark availability. Drag to select multiple dates.
                    </p>
                  </div>
                  <button className="calendar-nav-btn" onClick={goToNextMonth}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M4 10L10 16L16 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" transform="rotate(-90 10 10)"/>
                    </svg>
                  </button>
                </div>
                <div className="calendar-grid-inline">
                  {renderCalendarDays()}
                </div>
                <div className="calendar-legend">
                  <div className="legend-item">
                    <span className="legend-dot available"></span>
                    <span>Available</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot has-location"></span>
                    <span>Scheduled</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Upcoming Events Section */}
            <div className="dashboard-section">
              <div className="section-header">
                <h3><ListIcon /> Upcoming Events</h3>
              </div>
              {upcomingEvents.length === 0 ? (
                <div className="no-events-message">
                  <p>No upcoming events</p>
                </div>
              ) : (
                <div className="bookings-list">
                {upcomingEvents.map((event) => {
                  const dealDate = new Date(event.date);
                  const dayNumber = dealDate.getDate();
                  const otherParty = event.artist || {};
                  const isExpanded = expandedDealId === event.id;

                  return (
                    <div key={event.id} className={`booking-card ${isExpanded ? 'expanded' : ''}`}>
                      <div className="booking-date-badge">
                        {dayNumber}
                      </div>
                      <div className="booking-compact-view">
                        <div
                          className="party-avatar"
                          onClick={() => toggleDealExpanded(event.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          {otherParty.avatar ? (
                            <img src={otherParty.avatar} alt={otherParty.name} />
                          ) : (
                            otherParty.name?.charAt(0).toUpperCase() || '?'
                          )}
                        </div>

                        <div
                          className="party-info"
                          onClick={() => toggleDealExpanded(event.id)}
                          style={{ cursor: 'pointer', flex: 1 }}
                        >
                          <div className="party-name-role">
                            <h3>{otherParty.name || 'Unknown'}</h3>
                            {otherParty.role && (
                              <span className={`role-badge ${otherParty.role.toLowerCase()}`}>
                                {otherParty.role}
                              </span>
                            )}
                          </div>
                          <p className="party-location">{otherParty.location || 'Location TBD'}</p>
                          <div className="party-status-row">
                            <span className={getStatusBadgeClass(event.status)}>
                              {event.status}
                            </span>
                          </div>
                        </div>

                        <button
                          className="btn-expand-arrow"
                          onClick={() => toggleDealExpanded(event.id)}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>
                            <path d="M6 9l6 6 6-6"/>
                          </svg>
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="booking-details">
                          {event.eventName && (
                            <div className="booking-detail-row">
                              <span className="detail-label">Event:</span>
                              <span className="detail-value">{event.eventName}</span>
                            </div>
                          )}
                          <div className="booking-detail-row">
                            <span className="detail-label">Artist:</span>
                            <span className="detail-value">
                              <div>{otherParty.name || 'Unknown'}</div>
                              {otherParty.location && (
                                <div className="detail-subtext">({otherParty.location})</div>
                              )}
                            </span>
                          </div>
                          <div className="booking-detail-row">
                            <span className="detail-label">Date:</span>
                            <span className="detail-value">{formatEventDate(event.date)}</span>
                          </div>
                          {event.startTime && event.endTime && (
                            <div className="booking-detail-row">
                              <span className="detail-label">Event Time:</span>
                              <span className="detail-value">
                                {event.startTime} - {event.endTime}
                              </span>
                            </div>
                          )}
                          {event.performanceType && (
                            <div className="booking-detail-row">
                              <span className="detail-label">Type:</span>
                              <span className="detail-value">{event.performanceType}</span>
                            </div>
                          )}
                          {event.currentFee && event.currency && (
                            <div className="booking-detail-row">
                              <span className="detail-label">Fee:</span>
                              <span className="detail-value">
                                {event.currency === 'USD' && '$'}
                                {event.currency === 'EUR' && '€'}
                                {event.currency === 'GBP' && '£'}
                                {event.currency === 'JPY' && '¥'}
                                {event.currentFee}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Artist/Agent Layout - Old calendar structure for non-embedded */
          <>
            {/* Calendar View Section */}
            <div className="dashboard-section">
              <h3><CalendarIcon /> Calendar View</h3>
              <div className="calendar-inline-wrapper">
                <div className="calendar-header-inline">
                  <button className="calendar-nav-btn" onClick={goToPreviousMonth}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M12 16L6 10L12 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <div className="calendar-month-info">
                    <h4>{monthNames[currentMonth]} {currentYear}</h4>
                    <p className="calendar-instructions">
                      Tap dates to mark availability. Drag to select multiple dates.
                    </p>
                  </div>
                  <button className="calendar-nav-btn" onClick={goToNextMonth}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M4 10L10 16L16 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" transform="rotate(-90 10 10)"/>
                    </svg>
                  </button>
                </div>
                <div className="calendar-grid-inline">
                  {renderCalendarDays()}
                </div>
                <div className="calendar-legend">
                  <div className="legend-item">
                    <span className="legend-dot available"></span>
                    <span>Available</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot has-location"></span>
                    <span>Scheduled</span>
                  </div>
                </div>
              </div>

              {/* Travel Schedules inside Calendar View section */}
              <div className="travel-schedules-section">
                <div className="travel-schedules-header">
                  <h3>Travel Schedules</h3>
                  <button className="btn btn-primary btn-sm" onClick={openNewScheduleModal}>
                    Add Schedule
                  </button>
                </div>

                {schedules.length === 0 ? (
              <div className="no-schedules">
                <p>No schedules added yet</p>
                <button
                  className="add-travel-schedule-btn"
                  onClick={openNewScheduleModal}
                >
                  + ADD TRAVEL SCHEDULE
                </button>
              </div>
            ) : (
              <div className="travel-schedules-list">
                {schedules.map((schedule) => (
                  <div key={schedule.id} className="travel-schedule-item">
                    <div className="schedule-location">
                      {getLocationLabel(schedule)}
                    </div>
                    <div className="schedule-bottom-row">
                      {formatDate(schedule.startDate)} - {formatDate(schedule.endDate)}
                      <button className="icon-btn-edit" onClick={() => handleEditSchedule(schedule)} title="Edit schedule">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button className="icon-btn-delete" onClick={() => handleRemoveSchedule(schedule.id)} title="Delete schedule">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18"/>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
                </div>
              )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Schedule Form Modal */}
      <Modal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        title={editingScheduleId ? 'Edit Schedule' : 'Add Schedule'}
      >
        <div className="schedule-form">
          <div className="form-group">
            <label>Zone</label>
            <select
              value={scheduleForm.zone}
              onChange={(e) => {
                setScheduleForm({
                  ...scheduleForm,
                  zone: e.target.value,
                  country: '',
                  city: ''
                });
              }}
            >
              <option value="">Select Zone</option>
              {zones.map(zone => (
                <option key={zone} value={zone}>{zone}</option>
              ))}
            </select>
          </div>

          {scheduleForm.zone && (
            <div className="form-group">
              <label>Country</label>
              <select
                value={scheduleForm.country}
                onChange={(e) => {
                  setScheduleForm({
                    ...scheduleForm,
                    country: e.target.value,
                    city: ''
                  });
                }}
              >
                <option value="">Select Country</option>
                {countriesByZone[scheduleForm.zone]?.map(country => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
            </div>
          )}

          {scheduleForm.country && (
            <div className="form-group">
              <label>City</label>
              <select
                value={scheduleForm.city}
                onChange={(e) => {
                  setScheduleForm({
                    ...scheduleForm,
                    city: e.target.value
                  });
                }}
              >
                <option value="">Select City</option>
                {citiesByCountry[scheduleForm.country]?.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>Start Date</label>
              <input
                type="date"
                value={scheduleForm.startDate}
                onChange={(e) => setScheduleForm({...scheduleForm, startDate: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input
                type="date"
                value={scheduleForm.endDate}
                onChange={(e) => setScheduleForm({...scheduleForm, endDate: e.target.value})}
              />
            </div>
          </div>

          {/* What are you looking for section */}
          {availableOptions.length > 0 && (
            <div className="looking-for-section">
              <h4>What are you looking for?</h4>
              <div className="looking-for-options">
                {availableOptions.includes('promoter') && (
                  <label className="looking-for-option">
                    <input
                      type="checkbox"
                      checked={scheduleForm.lookingFor.promoter}
                      onChange={(e) => setScheduleForm({
                        ...scheduleForm,
                        lookingFor: {
                          ...scheduleForm.lookingFor,
                          promoter: e.target.checked
                        }
                      })}
                    />
                    <span>Promoters</span>
                  </label>
                )}
                {availableOptions.includes('venue') && (
                  <label className="looking-for-option">
                    <input
                      type="checkbox"
                      checked={scheduleForm.lookingFor.venue}
                      onChange={(e) => setScheduleForm({
                        ...scheduleForm,
                        lookingFor: {
                          ...scheduleForm.lookingFor,
                          venue: e.target.checked
                        }
                      })}
                    />
                    <span>Venues</span>
                  </label>
                )}
                {availableOptions.includes('artist') && (
                  <label className="looking-for-option">
                    <input
                      type="checkbox"
                      checked={scheduleForm.lookingFor.artist}
                      onChange={(e) => setScheduleForm({
                        ...scheduleForm,
                        lookingFor: {
                          ...scheduleForm.lookingFor,
                          artist: e.target.checked
                        }
                      })}
                    />
                    <span>Artists</span>
                  </label>
                )}
              </div>
            </div>
          )}

          <div className="form-actions">
            <button 
              className="btn btn-secondary"
              onClick={() => setShowLocationModal(false)}
            >
              Cancel
            </button>
            <button 
              className="btn btn-primary"
              onClick={handleSaveSchedule}
            >
              {editingScheduleId ? 'Update' : 'Save'} Schedule
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirmation}
        onClose={cancelDeleteSchedule}
        title="Delete Travel Schedule"
      >
        <div className="delete-confirmation">
          <p>Are you sure you want to delete this travel schedule?</p>
          <div className="form-actions">
            <button
              className="btn btn-secondary"
              onClick={cancelDeleteSchedule}
            >
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={confirmDeleteSchedule}
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CalendarScreen;