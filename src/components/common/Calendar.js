import React, { useState } from 'react';
import Modal from './Modal';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAppContext } from '../../contexts/AppContext';
import { zones, countriesByZone, citiesByCountry } from '../../data/profiles';

const Calendar = ({ onClose }) => {
  const { t } = useLanguage();
  const { user } = useAppContext();
  const [selectedDates, setSelectedDates] = useState(new Set());
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartDate, setDragStartDate] = useState(null);
  const [locationFilters, setLocationFilters] = useState([]);
  const [lookingFor, setLookingFor] = useState({
    promoter: false,
    venue: false,
    artist: false
  });
  
  const [locationFilter, setLocationFilter] = useState({
    zone: '',
    country: '',
    city: '',
    startDate: '',
    endDate: ''
  });
  const [editingFilterId, setEditingFilterId] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  
  const getDaysInMonth = (month, year) => {
    return new Date(year, month + 1, 0).getDate();
  };
  
  const getFirstDayOfMonth = (month, year) => {
    return new Date(year, month, 1).getDay();
  };
  
  const daysInMonth = getDaysInMonth(currentMonth, currentYear);
  const firstDayOfMonth = getFirstDayOfMonth(currentMonth, currentYear);
  
  const monthNames = [
    t('dateFormat.january'), t('dateFormat.february'), t('dateFormat.march'),
    t('dateFormat.april'), t('dateFormat.may'), t('dateFormat.june'),
    t('dateFormat.july'), t('dateFormat.august'), t('dateFormat.september'),
    t('dateFormat.october'), t('dateFormat.november'), t('dateFormat.december')
  ];

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

  const handleDateClick = (day) => {
    const dateKey = `${currentYear}-${currentMonth + 1}-${day}`;
    const newSelected = new Set(selectedDates);
    
    if (newSelected.has(dateKey)) {
      newSelected.delete(dateKey);
    } else {
      newSelected.add(dateKey);
    }
    
    setSelectedDates(newSelected);
  };

  const handleDateLongPress = (day) => {
    const dateKey = `${currentYear}-${currentMonth + 1}-${day}`;
    const dateFormatted = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(dateKey);
    setLocationFilter({
      zone: '',
      country: '',
      city: '',
      startDate: dateFormatted,
      endDate: dateFormatted
    });
    setShowLocationModal(true);
  };

  const handleDragStart = (day) => {
    setIsDragging(true);
    setDragStartDate(day);
    const dateKey = `${currentYear}-${currentMonth + 1}-${day}`;
    const newSelected = new Set(selectedDates);
    
    // Toggle the starting date
    if (newSelected.has(dateKey)) {
      newSelected.delete(dateKey);
    } else {
      newSelected.add(dateKey);
    }
    
    setSelectedDates(newSelected);
  };

  const handleDragEnter = (day) => {
    if (isDragging && dragStartDate) {
      const start = Math.min(dragStartDate, day);
      const end = Math.max(dragStartDate, day);
      const startDateKey = `${currentYear}-${currentMonth + 1}-${dragStartDate}`;
      const newSelected = new Set();
      
      // Check if we're selecting or deselecting based on the start date
      const isSelecting = !selectedDates.has(startDateKey);
      
      // Copy all existing selected dates
      selectedDates.forEach(date => newSelected.add(date));
      
      for (let i = start; i <= end; i++) {
        const dateKey = `${currentYear}-${currentMonth + 1}-${i}`;
        if (isSelecting) {
          newSelected.add(dateKey);
        } else {
          newSelected.delete(dateKey);
        }
      }
      
      setSelectedDates(newSelected);
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDragStartDate(null);
  };

  // Touch handlers for mobile
  const handleTouchStart = (day) => {
    handleDragStart(day);
  };

  const handleTouchMove = (e) => {
    if (isDragging) {
      e.preventDefault();
      const touch = e.touches[0];
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      if (element && element.classList.contains('calendar-day') && !element.classList.contains('empty')) {
        const day = parseInt(element.textContent);
        if (!isNaN(day)) {
          handleDragEnter(day);
        }
      }
    }
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

  const handleZoneChange = (zone) => {
    setLocationFilter({
      ...locationFilter,
      zone,
      country: '',
      city: ''
    });
  };

  const handleCountryChange = (country) => {
    const zone = Object.entries(countriesByZone).find(([_, countries]) => 
      countries.includes(country)
    )?.[0] || '';
    
    setLocationFilter({
      ...locationFilter,
      zone,
      country,
      city: ''
    });
  };

  const handleCityChange = (city) => {
    if (!city) {
      setLocationFilter({
        ...locationFilter,
        city: ''
      });
      return;
    }
    
    const country = Object.entries(citiesByCountry).find(([_, cities]) => 
      cities.includes(city)
    )?.[0] || '';
    
    const zone = Object.entries(countriesByZone).find(([_, countries]) => 
      countries.includes(country)
    )?.[0] || '';
    
    setLocationFilter({
      ...locationFilter,
      zone,
      country,
      city
    });
  };

  const saveLocationFilter = () => {
    if (locationFilter.zone || locationFilter.country || locationFilter.city) {
      if (editingFilterId) {
        // Update existing filter
        setLocationFilters(locationFilters.map(f => 
          f.id === editingFilterId ? { ...locationFilter, id: editingFilterId } : f
        ));
      } else {
        // Add new filter
        const newFilter = {
          ...locationFilter,
          id: Date.now(),
          dateAdded: selectedDate
        };
        setLocationFilters([...locationFilters, newFilter]);
      }
    }
    setShowLocationModal(false);
    setEditingFilterId(null);
    setLocationFilter({
      zone: '',
      country: '',
      city: '',
      startDate: '',
      endDate: ''
    });
  };

  const editLocationFilter = (filter) => {
    setLocationFilter({
      zone: filter.zone || '',
      country: filter.country || '',
      city: filter.city || '',
      startDate: filter.startDate || '',
      endDate: filter.endDate || ''
    });
    setEditingFilterId(filter.id);
    setShowLocationModal(true);
  };

  const openNewLocationModal = () => {
    const today = new Date();
    const dateFormatted = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    setLocationFilter({
      zone: '',
      country: '',
      city: '',
      startDate: dateFormatted,
      endDate: dateFormatted
    });
    setEditingFilterId(null);
    setShowLocationModal(true);
  };

  const removeLocationFilter = (filterId) => {
    setLocationFilters(locationFilters.filter(f => f.id !== filterId));
  };

  const getLocationLabel = (filter) => {
    if (filter.city) return filter.city;
    if (filter.country) return filter.country;
    if (filter.zone) return filter.zone;
    return 'Location';
  };

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
        return ['promoter', 'venue']; // Agents look for opportunities for their artists
      default:
        return [];
    }
  };

  const availableOptions = getAvailableLookingForOptions();

  const isDateInLocationFilter = (day) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return locationFilters.some(filter => {
      const start = new Date(filter.startDate);
      const end = new Date(filter.endDate);
      const current = new Date(dateStr);
      return current >= start && current <= end;
    });
  };

  const renderCalendarDays = () => {
    const days = [];
    const weekDays = t('dateFormat.weekLetters').split(',');
    
    // Render weekday headers
    weekDays.forEach(day => {
      days.push(
        <div key={`header-${day}`} className="calendar-weekday">
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
      
      const hasLocation = isDateInLocationFilter(day);
      
      days.push(
        <div
          key={`day-${day}`}
          className={`calendar-day ${isSelected ? 'available' : ''} ${hasLocation ? 'has-location' : ''}`}
          onClick={() => handleDateClick(day)}
          onMouseDown={(e) => {
            if (e.button === 2) return; // Ignore right-click
            const timer = setTimeout(() => handleDateLongPress(day), 500);
            e.currentTarget.longPressTimer = timer;
            handleDragStart(day);
          }}
          onMouseUp={(e) => {
            if (e.currentTarget.longPressTimer) {
              clearTimeout(e.currentTarget.longPressTimer);
            }
            handleDragEnd();
          }}
          onMouseLeave={(e) => {
            if (e.currentTarget.longPressTimer) {
              clearTimeout(e.currentTarget.longPressTimer);
            }
          }}
          onMouseEnter={() => handleDragEnter(day)}
          onTouchStart={(e) => {
            const timer = setTimeout(() => handleDateLongPress(day), 500);
            e.currentTarget.longPressTimer = timer;
            handleTouchStart(day);
          }}
          onTouchMove={handleTouchMove}
          onTouchEnd={(e) => {
            if (e.currentTarget.longPressTimer) {
              clearTimeout(e.currentTarget.longPressTimer);
            }
            handleTouchEnd();
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            handleDateLongPress(day);
          }}
        >
          {day}
          {hasLocation && <span className="location-dot"></span>}
        </div>
      );
    }
    
    return days;
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={t('calendar.title')}
      className="calendar-modal"
    >
      <div className="calendar-container">
        <div className="calendar-header">
          <button className="calendar-nav-btn" onClick={goToPreviousMonth}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 16L6 10L12 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className="calendar-month-title">
            <h3>{monthNames[currentMonth]} {currentYear}</h3>
            <p className="calendar-instructions">
              {t('calendar.instructions')}
            </p>
          </div>
          <button className="calendar-nav-btn" onClick={goToNextMonth}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M8 16L14 10L8 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        
        <div className="calendar-grid">
          {renderCalendarDays()}
        </div>
        
        <div className="calendar-legend">
          <div className="legend-item">
            <span className="legend-dot available"></span>
            <span>{t('calendar.available')}</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot unavailable"></span>
            <span>{t('calendar.unavailable')}</span>
          </div>
        </div>

        {/* What are you looking for section */}
        {selectedDates.size > 0 && availableOptions.length > 0 && (
          <div className="looking-for-section">
            <h4>What are you looking for?</h4>
            <div className="looking-for-options">
              {availableOptions.includes('promoter') && (
                <label className="looking-for-option">
                  <input
                    type="checkbox"
                    checked={lookingFor.promoter}
                    onChange={(e) => setLookingFor({...lookingFor, promoter: e.target.checked})}
                  />
                  <span>Promoters</span>
                </label>
              )}
              {availableOptions.includes('venue') && (
                <label className="looking-for-option">
                  <input
                    type="checkbox"
                    checked={lookingFor.venue}
                    onChange={(e) => setLookingFor({...lookingFor, venue: e.target.checked})}
                  />
                  <span>Venues</span>
                </label>
              )}
              {availableOptions.includes('artist') && (
                <label className="looking-for-option">
                  <input
                    type="checkbox"
                    checked={lookingFor.artist}
                    onChange={(e) => setLookingFor({...lookingFor, artist: e.target.checked})}
                  />
                  <span>Artists</span>
                </label>
              )}
            </div>
          </div>
        )}
        
        {/* Location Filters Display */}
        <div className="calendar-filters">
          {locationFilters.length === 0 ? (
            <button 
              className="add-travel-schedule-btn"
              onClick={openNewLocationModal}
            >
              <span className="plus-icon">+</span> {t('calendar.addTravel')}
            </button>
          ) : (
            <>
              <div 
                className="calendar-filters-header"
                onClick={openNewLocationModal}
              >
                <h4>{t('calendar.travelSchedule')}</h4>
                <span className="add-icon">+</span>
              </div>
              <div className="filters-list">
                {locationFilters.map(filter => (
                  <div key={filter.id} className="filter-item">
                    <div 
                      className="filter-info"
                      onClick={() => editLocationFilter(filter)}
                    >
                      <span className="filter-location">{getLocationLabel(filter)}</span>
                      <span className="filter-dates">
                        {filter.startDate === filter.endDate 
                          ? filter.startDate 
                          : `${filter.startDate} – ${filter.endDate}`}
                      </span>
                    </div>
                    <button 
                      className="filter-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeLocationFilter(filter.id);
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Location Filter Modal */}
      <Modal
        isOpen={showLocationModal}
        onClose={() => {
          setShowLocationModal(false);
          setEditingFilterId(null);
          setLocationFilter({
            zone: '',
            country: '',
            city: '',
            startDate: '',
            endDate: ''
          });
        }}
        title={editingFilterId ? t('calendar.editLocationFilter') : t('calendar.addLocationFilter')}
        className="location-filter-modal"
      >
        <div className="location-filter-form">
          <div className="form-group">
            <label>{t('calendar.zone')}</label>
            <select
              value={locationFilter.zone}
              onChange={(e) => handleZoneChange(e.target.value)}
            >
              <option value="">{t('calendar.allZones')}</option>
              {zones.map(zone => (
                <option key={zone} value={zone}>{zone}</option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label>{t('calendar.country')}</label>
            <select
              value={locationFilter.country}
              onChange={(e) => handleCountryChange(e.target.value)}
            >
              <option value="">{t('calendar.allCountries')}</option>
              {locationFilter.zone 
                ? countriesByZone[locationFilter.zone]?.map(country => (
                    <option key={country} value={country}>{country}</option>
                  ))
                : Object.values(countriesByZone).flat().sort().map(country => (
                    <option key={country} value={country}>{country}</option>
                  ))
              }
            </select>
          </div>
          
          <div className="form-group">
            <label>{t('calendar.city')}</label>
            <select
              value={locationFilter.city}
              onChange={(e) => handleCityChange(e.target.value)}
            >
              <option value="">{t('calendar.allCities')}</option>
              {locationFilter.country 
                ? citiesByCountry[locationFilter.country]?.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))
                : Object.values(citiesByCountry).flat().sort().map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))
              }
            </select>
          </div>
          
          <div className="form-group">
            <label>{t('calendar.startDate')}</label>
            <input
              type="date"
              value={locationFilter.startDate}
              onChange={(e) => setLocationFilter({...locationFilter, startDate: e.target.value})}
            />
          </div>
          
          <div className="form-group">
            <label>{t('calendar.endDate')}</label>
            <input
              type="date"
              value={locationFilter.endDate}
              onChange={(e) => setLocationFilter({...locationFilter, endDate: e.target.value})}
            />
          </div>
          
          <div className="form-actions">
            <button 
              className="btn btn-outline"
              onClick={() => {
                setShowLocationModal(false);
                setEditingFilterId(null);
                setLocationFilter({
                  zone: '',
                  country: '',
                  city: '',
                  startDate: '',
                  endDate: ''
                });
              }}
            >
              {t('calendar.cancel')}
            </button>
            <button 
              className="btn btn-primary"
              onClick={saveLocationFilter}
            >
              {editingFilterId ? t('calendar.update') : t('calendar.confirm')}
            </button>
          </div>
        </div>
      </Modal>
    </Modal>
  );
};

export default Calendar;