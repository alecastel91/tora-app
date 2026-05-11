/**
 * Resident Advisor API Service
 * This service handles all RA-related API calls
 * Currently uses mock data but structured to easily switch to real API
 */

// Configuration - will be moved to environment variables
const RA_API_CONFIG = {
  BASE_URL: import.meta.env.VITE_RA_API_URL || 'https://api.ra.co/v1', // Example URL
  API_KEY: import.meta.env.VITE_RA_API_KEY || '',
  USE_MOCK_DATA: import.meta.env.VITE_USE_MOCK_DATA !== 'false' // Default to true
};

// Mock data for development - now empty, will come from real RA API or backend
const MOCK_EVENTS_DATA = {};

class RAService {
  constructor() {
    this.baseUrl = RA_API_CONFIG.BASE_URL;
    this.apiKey = RA_API_CONFIG.API_KEY;
    this.useMockData = RA_API_CONFIG.USE_MOCK_DATA;
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
  }

  /**
   * Get headers for API requests
   */
  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'X-RA-API-Version': '1.0'
    };
  }

  /**
   * Format artist name to RA slug format
   */
  formatArtistSlug(artistName) {
    return artistName.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  /**
   * Check if cached data is still valid
   */
  isCacheValid(key) {
    const cached = this.cache.get(key);
    if (!cached) return false;
    return Date.now() - cached.timestamp < this.cacheTimeout;
  }

  /**
   * Get upcoming and past events for an artist
   */
  async getArtistEvents(artistName, type = 'upcoming') {
    const slug = this.formatArtistSlug(artistName);
    const cacheKey = `events_${slug}_${type}`;

    // Check cache first
    if (this.isCacheValid(cacheKey)) {
      console.log(`Returning cached ${type} events for:`, artistName);
      return this.cache.get(cacheKey).data;
    }

    // If using mock data (development mode)
    if (this.useMockData) {
      console.log(`Using mock ${type} data for:`, artistName);
      const mockData = MOCK_EVENTS_DATA[slug]?.[type] || [];
      this.cache.set(cacheKey, {
        data: mockData,
        timestamp: Date.now()
      });
      return mockData;
    }

    // Real API call
    try {
      const endpoint = type === 'past' 
        ? `${this.baseUrl}/artists/${slug}/events/past`
        : `${this.baseUrl}/artists/${slug}/events`;
        
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`RA API Error: ${response.status}`);
      }

      const data = await response.json();
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: data.events || [],
        timestamp: Date.now()
      });

      return data.events || [];
    } catch (error) {
      console.error(`Error fetching RA ${type} events:`, error);
      
      // Fallback to mock data if API fails
      if (MOCK_EVENTS_DATA[slug]?.[type]) {
        console.log(`Falling back to mock ${type} data due to API error`);
        return MOCK_EVENTS_DATA[slug][type];
      }
      
      throw error;
    }
  }

  /**
   * Get artist profile information
   */
  async getArtistProfile(artistName) {
    const slug = this.formatArtistSlug(artistName);
    const cacheKey = `profile_${slug}`;

    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    if (this.useMockData) {
      const mockProfile = {
        name: artistName,
        slug: slug,
        bio: 'Club music artist',
        location: 'Tokyo, Japan',
        raUrl: `https://ra.co/dj/${slug}`,
        followersCount: 12500,
        upcomingEvents: 5
      };
      
      this.cache.set(cacheKey, {
        data: mockProfile,
        timestamp: Date.now()
      });
      
      return mockProfile;
    }

    // Real API implementation would go here
    try {
      const response = await fetch(`${this.baseUrl}/artists/${slug}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`RA API Error: ${response.status}`);
      }

      const data = await response.json();
      
      this.cache.set(cacheKey, {
        data: data,
        timestamp: Date.now()
      });

      return data;
    } catch (error) {
      console.error('Error fetching RA profile:', error);
      throw error;
    }
  }

  /**
   * Search for events by location and date
   */
  async searchEvents(params = {}) {
    const { city, country, dateFrom, dateTo, genre } = params;
    const cacheKey = `search_${JSON.stringify(params)}`;

    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    if (this.useMockData) {
      // Return mock search results
      return [];
    }

    // Real API implementation
    try {
      const queryParams = new URLSearchParams();
      if (city) queryParams.append('city', city);
      if (country) queryParams.append('country', country);
      if (dateFrom) queryParams.append('date_from', dateFrom);
      if (dateTo) queryParams.append('date_to', dateTo);
      if (genre) queryParams.append('genre', genre);

      const response = await fetch(`${this.baseUrl}/events?${queryParams}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`RA API Error: ${response.status}`);
      }

      const data = await response.json();
      
      this.cache.set(cacheKey, {
        data: data.events || [],
        timestamp: Date.now()
      });

      return data.events || [];
    } catch (error) {
      console.error('Error searching RA events:', error);
      throw error;
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

// Export singleton instance
const raService = new RAService();
export default raService;