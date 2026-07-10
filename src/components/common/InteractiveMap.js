import React, { useState } from 'react';
import { dummyProfiles } from '../../data/profiles';
import { useLanguage } from '../../contexts/LanguageContext';

const InteractiveMap = ({ onCountryClick, selectedCountries = [], searchResults = [] }) => {
  const { t } = useLanguage();
  const [hoveredCountry, setHoveredCountry] = useState(null);
  const [mapView, setMapView] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Major countries with their corrected positions on a world map (percentage-based)
  const countryMarkers = [
    // North America
    { name: 'United States', x: 25, y: 40, zone: 'North America' },
    { name: 'Canada', x: 25, y: 30, zone: 'North America' },
    { name: 'Mexico', x: 22, y: 48, zone: 'North America' },
    
    // South America
    { name: 'Brazil', x: 35, y: 68, zone: 'South America' },
    { name: 'Argentina', x: 32, y: 78, zone: 'South America' },
    { name: 'Colombia', x: 28, y: 58, zone: 'South America' },
    { name: 'Chile', x: 29, y: 75, zone: 'South America' },
    { name: 'Peru', x: 27, y: 65, zone: 'South America' },
    
    // Europe
    { name: 'United Kingdom', x: 48, y: 32, zone: 'Europe' },
    { name: 'Germany', x: 52, y: 32, zone: 'Europe' },
    { name: 'France', x: 49, y: 34, zone: 'Europe' },
    { name: 'Spain', x: 46, y: 38, zone: 'Europe' },
    { name: 'Italy', x: 53, y: 38, zone: 'Europe' },
    { name: 'Netherlands', x: 51, y: 31, zone: 'Europe' },
    { name: 'Belgium', x: 50.5, y: 32, zone: 'Europe' },
    { name: 'Poland', x: 55, y: 32, zone: 'Europe' },
    { name: 'Russia', x: 68, y: 28, zone: 'Europe' },
    { name: 'Greece', x: 56, y: 40, zone: 'Europe' },
    
    // Middle East
    { name: 'Turkey', x: 58, y: 38, zone: 'Middle East' },
    { name: 'Israel', x: 58, y: 42, zone: 'Middle East' },
    { name: 'UAE', x: 63, y: 45, zone: 'Middle East' },
    { name: 'Saudi Arabia', x: 60, y: 45, zone: 'Middle East' },
    
    // Africa
    { name: 'South Africa', x: 55, y: 75, zone: 'Africa' },
    { name: 'Egypt', x: 57, y: 42, zone: 'Africa' },
    { name: 'Morocco', x: 46, y: 40, zone: 'Africa' },
    { name: 'Nigeria', x: 50, y: 52, zone: 'Africa' },
    { name: 'Kenya', x: 59, y: 56, zone: 'Africa' },
    
    // Asia
    { name: 'Japan', x: 88, y: 38, zone: 'Asia' },
    { name: 'China', x: 78, y: 38, zone: 'Asia' },
    { name: 'South Korea', x: 85, y: 38, zone: 'Asia' },
    { name: 'Thailand', x: 76, y: 50, zone: 'Asia' },
    { name: 'Indonesia', x: 78, y: 60, zone: 'Asia' },
    { name: 'Singapore', x: 77, y: 56, zone: 'Asia' },
    { name: 'India', x: 70, y: 47, zone: 'Asia' },
    { name: 'Vietnam', x: 78, y: 50, zone: 'Asia' },
    { name: 'Philippines', x: 83, y: 52, zone: 'Asia' },
    
    // Oceania
    { name: 'Australia', x: 82, y: 70, zone: 'Oceania' },
    { name: 'New Zealand', x: 88, y: 78, zone: 'Oceania' }
  ];

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - mapView.x,
      y: e.clientY - mapView.y
    });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setMapView({
        ...mapView,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    const newScale = Math.max(0.5, Math.min(3, mapView.scale + delta));
    setMapView({ ...mapView, scale: newScale });
  };

  const handleCountryClick = (country) => {
    if (onCountryClick) {
      onCountryClick(country.name);
    }
  };

  // Get profile count for a specific country
  const getCountryProfileCount = (countryName) => {
    const profilesToCheck = searchResults.length > 0 ? searchResults : dummyProfiles;
    return profilesToCheck.filter(profile => profile.country === countryName).length;
  };

  const resetView = () => {
    setMapView({ x: 0, y: 0, scale: 1 });
  };

  const zoomIn = () => {
    const newScale = Math.min(3, mapView.scale + 0.3);
    setMapView({ ...mapView, scale: newScale });
  };

  const zoomOut = () => {
    const newScale = Math.max(0.3, mapView.scale - 0.3);
    setMapView({ ...mapView, scale: newScale });
  };

  const getZoneColor = (zone) => {
    const colors = {
      'North America': '#FF6B6B',
      'South America': '#4ECDC4',
      'Europe': '#45B7D1',
      'Middle East': '#FFA07A',
      'Africa': '#98D8C8',
      'Asia': '#FFB6C1',
      'Oceania': '#DDA0DD'
    };
    return colors[zone] || '#888';
  };

  return (
    <div className="interactive-map-container">
      <div className="map-controls">
        <button onClick={zoomIn} className="map-control-btn" title={t('common.zoomIn')}>
          +
        </button>
        <button onClick={zoomOut} className="map-control-btn" title={t('common.zoomOut')}>
          -
        </button>
        <button onClick={resetView} className="map-control-btn" title={t('common.resetView')}>
          ⟲
        </button>
      </div>
      
      <div 
        className="interactive-map"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <div 
          className="map-content"
          style={{
            transform: `translate(${mapView.x}px, ${mapView.y}px) scale(${mapView.scale})`,
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
        >
          {/* World map background */}
          <div className="world-map-bg">
            <img src="/world-map.svg" alt="World Map" className="map-image" />
          </div>
          
          {/* Country markers with profile counts */}
          {countryMarkers.map((country) => {
            const isSelected = selectedCountries.includes(country.name);
            const isHovered = hoveredCountry === country.name;
            const profileCount = getCountryProfileCount(country.name);

            return (
              <div
                key={country.name}
                className={`country-marker ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''} ${profileCount === 0 ? 'empty' : ''}`}
                style={{
                  left: `${country.x}%`,
                  top: `${country.y}%`,
                  backgroundColor: isSelected ? '#FF3366' : getZoneColor(country.zone)
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleCountryClick(country);
                }}
                onMouseEnter={() => setHoveredCountry(country.name)}
                onMouseLeave={() => setHoveredCountry(null)}
              >
                {profileCount > 0 && (
                  <div className="profile-count">{profileCount}</div>
                )}
                <div className="country-tooltip">
                  <strong>{country.name}</strong>
                  <span>{country.zone}</span>
                  {profileCount > 0 && (
                    <span className="profile-count-text">{profileCount} profile{profileCount > 1 ? 's' : ''}</span>
                  )}
                </div>
              </div>
            );
          })}

        </div>
      </div>
      
      {hoveredCountry && (
        <div className="map-info">
          <span>Click to filter: {hoveredCountry}</span>
        </div>
      )}

      <div className="map-legend">
        <div className="legend-item">
          <div className="legend-zone" style={{ background: '#FF6B6B' }}></div>
          <span>North America</span>
        </div>
        <div className="legend-item">
          <div className="legend-zone" style={{ background: '#4ECDC4' }}></div>
          <span>South America</span>
        </div>
        <div className="legend-item">
          <div className="legend-zone" style={{ background: '#45B7D1' }}></div>
          <span>Europe</span>
        </div>
        <div className="legend-item">
          <div className="legend-zone" style={{ background: '#FFB6C1' }}></div>
          <span>Asia</span>
        </div>
        <div className="legend-item">
          <div className="legend-zone" style={{ background: '#98D8C8' }}></div>
          <span>Africa</span>
        </div>
        <div className="legend-item">
          <div className="legend-zone" style={{ background: '#FFA07A' }}></div>
          <span>Middle East</span>
        </div>
        <div className="legend-item">
          <div className="legend-zone" style={{ background: '#DDA0DD' }}></div>
          <span>Oceania</span>
        </div>
      </div>
    </div>
  );
};

export default InteractiveMap;