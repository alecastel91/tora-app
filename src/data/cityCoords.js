// City -> [lon, lat] lookup for the Search globe. d3-geo projections take
// [lon, lat] pairs, so coordinates are stored in that order.
//
// Profiles carry a free-text `city`; we normalize (lowercase, strip accents and
// punctuation) and look the coordinate up here. Cities not in the table have no
// pin — the globe surfaces the un-mapped count instead of dropping them silently.
// This is a curated set of the club/electronic-music hubs plus every city that
// currently appears in src/data/profiles.js citiesByCountry; extend as needed.

export const CITY_COORDS = {
  // North America
  'atlanta': [-84.39, 33.75], 'austin': [-97.74, 30.27], 'boston': [-71.06, 42.36],
  'chicago': [-87.63, 41.88], 'dallas': [-96.80, 32.78], 'denver': [-104.99, 39.74],
  'detroit': [-83.05, 42.33], 'houston': [-95.37, 29.76], 'las vegas': [-115.14, 36.17],
  'los angeles': [-118.24, 34.05], 'miami': [-80.19, 25.76], 'nashville': [-86.78, 36.16],
  'new orleans': [-90.07, 29.95], 'new york': [-74.01, 40.71], 'philadelphia': [-75.17, 39.95],
  'phoenix': [-112.07, 33.45], 'portland': [-122.68, 45.52], 'san francisco': [-122.42, 37.77],
  'seattle': [-122.33, 47.61], 'washington dc': [-77.04, 38.91],
  'calgary': [-114.07, 51.05], 'edmonton': [-113.49, 53.55], 'montreal': [-73.57, 45.50],
  'ottawa': [-75.70, 45.42], 'quebec city': [-71.21, 46.81], 'toronto': [-79.38, 43.65],
  'vancouver': [-123.12, 49.28],

  // Central America / Caribbean
  'guatemala city': [-90.51, 14.63], 'san jose': [-84.09, 9.93], 'panama city': [-79.52, 8.98],
  'san salvador': [-89.19, 13.69], 'managua': [-86.25, 12.11], 'tegucigalpa': [-87.19, 14.07],
  'havana': [-82.38, 23.11], 'santo domingo': [-69.93, 18.49], 'punta cana': [-68.40, 18.58],
  'kingston': [-76.79, 17.97], 'nassau': [-77.35, 25.06], 'san juan': [-66.11, 18.47],
  'port of spain': [-61.52, 10.66], 'bridgetown': [-59.62, 13.11],

  // South America
  'belo horizonte': [-43.94, -19.92], 'brasilia': [-47.93, -15.78], 'curitiba': [-49.27, -25.43],
  'florianopolis': [-48.55, -27.60], 'rio de janeiro': [-43.20, -22.91], 'salvador': [-38.51, -12.97],
  'sao paulo': [-46.63, -23.55], 'buenos aires': [-58.38, -34.60], 'cordoba': [-64.18, -31.42],
  'mendoza': [-68.84, -32.89], 'rosario': [-60.64, -32.95], 'bogota': [-74.07, 4.71],
  'medellin': [-75.56, 6.24], 'cali': [-76.53, 3.45], 'cartagena': [-75.51, 10.39],
  'santiago': [-70.65, -33.45], 'valparaiso': [-71.62, -33.05], 'lima': [-77.04, -12.05],
  'cusco': [-71.97, -13.53], 'quito': [-78.47, -0.18], 'guayaquil': [-79.89, -2.19],
  'la paz': [-68.15, -16.50], 'montevideo': [-56.16, -34.90], 'punta del este': [-54.95, -34.96],
  'caracas': [-66.90, 10.49], 'mexico city': [-99.13, 19.43], 'guadalajara': [-103.35, 20.66],
  'tulum': [-87.47, 20.21], 'cancun': [-86.85, 21.16],

  // Europe
  'belfast': [-5.93, 54.60], 'birmingham': [-1.90, 52.48], 'brighton': [-0.14, 50.82],
  'bristol': [-2.59, 51.45], 'cardiff': [-3.18, 51.48], 'edinburgh': [-3.19, 55.95],
  'glasgow': [-4.25, 55.86], 'leeds': [-1.55, 53.80], 'liverpool': [-2.98, 53.41],
  'london': [-0.13, 51.51], 'manchester': [-2.24, 53.48], 'newcastle': [-1.61, 54.98],
  'sheffield': [-1.47, 53.38], 'berlin': [13.40, 52.52], 'cologne': [6.96, 50.94],
  'dresden': [13.74, 51.05], 'dusseldorf': [6.78, 51.23], 'frankfurt': [8.68, 50.11],
  'hamburg': [9.99, 53.55], 'hannover': [9.73, 52.38], 'leipzig': [12.37, 51.34],
  'munich': [11.58, 48.14], 'stuttgart': [9.18, 48.78], 'bordeaux': [-0.58, 44.84],
  'lille': [3.06, 50.63], 'lyon': [4.83, 45.76], 'marseille': [5.37, 43.30],
  'nantes': [-1.55, 47.22], 'nice': [7.27, 43.70], 'paris': [2.35, 48.86],
  'strasbourg': [7.75, 48.58], 'toulouse': [1.44, 43.60], 'barcelona': [2.17, 41.39],
  'bilbao': [-2.93, 43.26], 'ibiza': [1.43, 38.91], 'madrid': [-3.70, 40.42],
  'malaga': [-4.42, 36.72], 'seville': [-5.98, 37.39], 'valencia': [-0.38, 39.47],
  'zaragoza': [-0.89, 41.65], 'bologna': [11.34, 44.49], 'florence': [11.26, 43.77],
  'genoa': [8.93, 44.41], 'milan': [9.19, 45.46], 'naples': [14.27, 40.85],
  'rome': [12.50, 41.90], 'turin': [7.69, 45.07], 'venice': [12.32, 45.44],
  'amsterdam': [4.90, 52.37], 'eindhoven': [5.47, 51.44], 'groningen': [6.57, 53.22],
  'rotterdam': [4.48, 51.92], 'the hague': [4.30, 52.07], 'utrecht': [5.12, 52.09],
  'antwerp': [4.40, 51.22], 'brussels': [4.35, 50.85], 'ghent': [3.72, 51.05],
  'liege': [5.57, 50.63], 'basel': [7.59, 47.56], 'bern': [7.45, 46.95],
  'geneva': [6.14, 46.20], 'lausanne': [6.63, 46.52], 'zurich': [8.54, 47.37],
  'graz': [15.44, 47.07], 'innsbruck': [11.40, 47.27], 'salzburg': [13.05, 47.81],
  'vienna': [16.37, 48.21], 'gdansk': [18.65, 54.35], 'krakow': [19.94, 50.06],
  'poznan': [16.93, 52.41], 'warsaw': [21.01, 52.23], 'wroclaw': [17.04, 51.11],
  'moscow': [37.62, 55.76], 'st. petersburg': [30.34, 59.93], 'athens': [23.73, 37.98],
  'mykonos': [25.33, 37.45], 'thessaloniki': [22.94, 40.64], 'faro': [-7.93, 37.02],
  'lisbon': [-9.14, 38.72], 'porto': [-8.61, 41.15], 'prague': [14.44, 50.08],
  'brno': [16.61, 49.20], 'budapest': [19.04, 47.50], 'bucharest': [26.10, 44.43],
  'cluj-napoca': [23.60, 46.77], 'split': [16.44, 43.51], 'zagreb': [15.98, 45.81],
  'dublin': [-6.26, 53.35], 'cork': [-8.47, 51.90], 'stockholm': [18.07, 59.33],
  'gothenburg': [11.97, 57.71], 'oslo': [10.75, 59.91], 'copenhagen': [12.57, 55.68],
  'helsinki': [24.94, 60.17], 'reykjavik': [-21.83, 64.13], 'sofia': [23.32, 42.70],
  'belgrade': [20.46, 44.79], 'kyiv': [30.52, 50.45], 'istanbul': [28.98, 41.01],
  'tallinn': [24.75, 59.44], 'vilnius': [25.28, 54.69], 'riga': [24.11, 56.95],

  // Middle East / Africa
  'tel aviv': [34.78, 32.08], 'dubai': [55.27, 25.20], 'beirut': [35.50, 33.89],
  'cairo': [31.24, 30.04], 'marrakech': [-7.98, 31.63], 'casablanca': [-7.59, 33.57],
  'cape town': [18.42, -33.92], 'johannesburg': [28.05, -26.20], 'lagos': [3.38, 6.52],
  'nairobi': [36.82, -1.29], 'accra': [-0.19, 5.60],

  // Asia / Pacific
  'tokyo': [139.65, 35.68], 'osaka': [135.50, 34.69], 'kyoto': [135.77, 35.01],
  'seoul': [126.98, 37.57], 'shanghai': [121.47, 31.23], 'beijing': [116.41, 39.90],
  'hong kong': [114.17, 22.32], 'taipei': [121.56, 25.03], 'bangkok': [100.50, 13.76],
  'singapore': [103.82, 1.35], 'kuala lumpur': [101.69, 3.14], 'jakarta': [106.85, -6.21],
  'manila': [120.98, 14.60], 'bali': [115.19, -8.41], 'mumbai': [72.88, 19.08],
  'delhi': [77.10, 28.70], 'bangalore': [77.59, 12.97], 'goa': [73.83, 15.30],
  'sydney': [151.21, -33.87], 'melbourne': [144.96, -37.81], 'brisbane': [153.03, -27.47],
  'perth': [115.86, -31.95], 'auckland': [174.76, -36.85],
};

// The marquee club-music hubs shown as locked "Premium" pins to FREE members
// (they can see the network's reach, but only open their own city).
export const FEATURED_HUBS = [
  'Berlin', 'London', 'Paris', 'Amsterdam', 'Barcelona', 'Ibiza', 'Lisbon',
  'Milan', 'Rome', 'Prague', 'Vienna', 'Copenhagen', 'Stockholm', 'Istanbul',
  'Zurich', 'New York', 'Los Angeles', 'Miami', 'Chicago',
  'Detroit', 'Toronto', 'Mexico City', 'Tulum', 'São Paulo', 'Buenos Aires',
  'Tokyo', 'Seoul', 'Bangkok', 'Bali', 'Dubai', 'Tel Aviv', 'Cape Town',
  'Sydney', 'Melbourne',
];

// Normalize a free-text city name to a CITY_COORDS key.
export const normalizeCity = (city) =>
  (city || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/\s+/g, ' ');

export const coordsForCity = (city) => CITY_COORDS[normalizeCity(city)] || null;
