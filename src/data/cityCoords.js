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
  // ---- full signup-picker coverage (every city in profiles.js citiesByCountry) ----
  // Central America / Caribbean
  'belize city': [-88.19, 17.50], 'san pedro': [-87.97, 17.92], 'jaco': [-84.63, 9.61],
  'tamarindo': [-85.84, 10.30], 'santa ana': [-89.56, 13.99], 'antigua': [-90.73, 14.56],
  'san pedro sula': [-88.03, 15.50], 'granada': [-85.96, 11.93], 'leon': [-86.88, 12.43],
  'montego bay': [-77.92, 18.47], 'negril': [-78.35, 18.27], 'ocho rios': [-77.10, 18.41],
  'santiago de cuba': [-75.82, 20.02], 'varadero': [-81.25, 23.15], 'san fernando': [-61.47, 10.28],
  'port-au-prince': [-72.34, 18.54], "st. john's": [-61.85, 17.12], 'roseau': [-61.39, 15.30],
  "st. george's": [-61.75, 12.05], 'castries': [-61.01, 14.01],
  // South America
  'mar del plata': [-57.55, -38.00], 'barranquilla': [-74.80, 10.96], 'concepcion': [-73.05, -36.83],
  'arequipa': [-71.54, -16.41], 'santa cruz': [-63.18, -17.78], 'sucre': [-65.26, -19.03],
  'asuncion': [-57.58, -25.26], 'ciudad del este': [-54.61, -25.51], 'maracaibo': [-71.61, 10.65],
  'georgetown': [-58.16, 6.80], 'paramaribo': [-55.20, 5.85],
  // Europe
  'bruges': [3.22, 51.21], 'novosibirsk': [82.93, 55.03], 'yekaterinburg': [60.60, 56.84],
  'crete': [25.13, 35.34], 'madeira': [-16.92, 32.65], 'ostrava': [18.29, 49.82],
  'debrecen': [21.63, 47.53], 'timisoara': [21.23, 45.76], 'dubrovnik': [18.09, 42.65],
  'galway': [-9.05, 53.27], 'aarhus': [10.20, 56.16], 'odense': [10.40, 55.40],
  'bergen': [5.32, 60.39], 'stavanger': [5.73, 58.97], 'trondheim': [10.39, 63.43],
  'malmo': [13.00, 55.60], 'espoo': [24.66, 60.21], 'tampere': [23.76, 61.50],
  'novi sad': [19.84, 45.25], 'plovdiv': [24.75, 42.14], 'varna': [27.91, 43.21],
  'ljubljana': [14.51, 46.06], 'maribor': [15.65, 46.55], 'bratislava': [17.11, 48.15],
  'kosice': [21.26, 48.72], 'tartu': [26.72, 58.38], 'kaunas': [23.90, 54.90],
  'dnipro': [35.05, 48.46], 'kharkiv': [36.23, 49.99], 'lviv': [24.03, 49.84],
  'odesa': [30.73, 46.48], 'valletta': [14.51, 35.90], 'limassol': [33.04, 34.68],
  'nicosia': [33.38, 35.19], 'tirana': [19.82, 41.33], 'yerevan': [44.51, 40.18],
  'baku': [49.87, 40.41], 'minsk': [27.56, 53.90], 'sarajevo': [18.41, 43.86],
  'batumi': [41.64, 41.64], 'tbilisi': [44.79, 41.72], 'pristina': [21.17, 42.66],
  'luxembourg city': [6.13, 49.61], 'chisinau': [28.86, 47.01], 'podgorica': [19.26, 42.44],
  'skopje': [21.43, 41.99],
  // Middle East
  'haifa': [34.99, 32.79], 'jerusalem': [35.22, 31.77], 'abu dhabi': [54.37, 24.45],
  'sharjah': [55.41, 25.35], 'ankara': [32.85, 39.93], 'antalya': [30.71, 36.90],
  'izmir': [27.14, 38.42], 'bethlehem': [35.20, 31.70], 'gaza': [34.47, 31.50],
  'hebron': [35.10, 31.53], 'nablus': [35.26, 32.22], 'ramallah': [35.21, 31.90],
  'kabul': [69.17, 34.53], 'manama': [50.59, 26.23], 'isfahan': [51.67, 32.65],
  'mashhad': [59.61, 36.30], 'shiraz': [52.53, 29.59], 'tehran': [51.39, 35.69],
  'baghdad': [44.36, 33.31], 'basra': [47.78, 30.51], 'erbil': [44.01, 36.19],
  'amman': [35.93, 31.95], 'aqaba': [35.01, 29.53], 'kuwait city': [47.98, 29.38],
  'muscat': [58.41, 23.59], 'salalah': [54.09, 17.02], 'doha': [51.53, 25.29],
  'jeddah': [39.17, 21.49], 'mecca': [39.83, 21.39], 'medina': [39.61, 24.47],
  'riyadh': [46.68, 24.71], 'aleppo': [37.16, 36.20], 'damascus': [36.29, 33.51],
  'aden': [45.04, 12.79], "sana'a": [44.21, 15.37],
  // Asia
  'fukuoka': [130.40, 33.59], 'hiroshima': [132.46, 34.39], 'kobe': [135.20, 34.69],
  'nagoya': [136.91, 35.18], 'sapporo': [141.35, 43.06], 'yokohama': [139.64, 35.44],
  'chengdu': [104.07, 30.67], 'guangzhou': [113.26, 23.13], 'shenzhen': [114.06, 22.55],
  'busan': [129.08, 35.18], 'daegu': [128.60, 35.87], 'incheon': [126.71, 37.46],
  'chiang mai': [98.99, 18.79], 'koh samui': [100.01, 9.51], 'pattaya': [100.88, 12.93],
  'phuket': [98.39, 7.89], 'bandung': [107.61, -6.92], 'surabaya': [112.75, -7.26],
  'chennai': [80.27, 13.08], 'kolkata': [88.36, 22.57], 'johor bahru': [103.76, 1.49],
  'penang': [100.33, 5.41], 'da nang': [108.22, 16.05], 'hanoi': [105.85, 21.03],
  'ho chi minh city': [106.63, 10.82], 'cebu': [123.89, 10.32], 'davao': [125.61, 7.07],
  'kaohsiung': [120.31, 22.62], 'taichung': [120.68, 24.14], 'chittagong': [91.83, 22.36],
  'dhaka': [90.41, 23.81], 'islamabad': [73.04, 33.68], 'karachi': [67.01, 24.86],
  'lahore': [74.35, 31.55], 'kathmandu': [85.32, 27.72], 'pokhara': [83.97, 28.21],
  'colombo': [79.86, 6.93], 'kandy': [80.63, 7.29], 'mandalay': [96.08, 21.98],
  'yangon': [96.16, 16.87], 'phnom penh': [104.92, 11.56], 'siem reap': [103.86, 13.36],
  'luang prabang': [102.13, 19.89], 'vientiane': [102.63, 17.98], 'ulaanbaatar': [106.91, 47.89],
  'almaty': [76.89, 43.24], 'astana': [71.45, 51.17], 'thimphu': [89.64, 27.47],
  'bandar seri begawan': [114.94, 4.94], 'bishkek': [74.59, 42.87], 'macao': [113.54, 22.19],
  'dushanbe': [68.78, 38.56], 'ashgabat': [58.38, 37.95], 'samarkand': [66.96, 39.65],
  'tashkent': [69.24, 41.30],
  // Africa
  'durban': [31.02, -29.86], 'pretoria': [28.19, -25.75], 'alexandria': [29.92, 31.20],
  'sharm el sheikh': [34.33, 27.91], 'fez': [-5.00, 34.03], 'rabat': [-6.85, 34.02],
  'mombasa': [39.66, -4.04], 'abuja': [7.49, 9.06], 'port harcourt': [7.01, 4.82],
  'sousse': [10.64, 35.83], 'tunis': [10.17, 36.81], 'kumasi': [-1.62, 6.69],
  'dar es salaam': [39.28, -6.79], 'dodoma': [35.74, -6.16], 'kampala': [32.58, 0.35],
  'addis ababa': [38.75, 9.03], 'luanda': [13.24, -8.84], 'maputo': [32.57, -25.97],
  'douala': [9.70, 4.05], 'yaounde': [11.52, 3.87], 'dakar': [-17.44, 14.69],
  'abidjan': [-4.02, 5.34], 'yamoussoukro': [-5.28, 6.82], 'algiers': [3.06, 36.75],
  'oran': [-0.64, 35.70], 'gaborone': [25.92, -24.65], 'ouagadougou': [-1.52, 12.37],
  'bujumbura': [29.36, -3.38], 'brazzaville': [15.27, -4.26], 'kinshasa': [15.31, -4.32],
  'lubumbashi': [27.48, -11.66], 'tripoli': [13.19, 32.89], 'bamako': [-8.00, 12.65],
  'windhoek': [17.08, -22.56], 'niamey': [2.11, 13.51], 'kigali': [30.06, -1.94],
  'khartoum': [32.53, 15.55], 'harare': [31.05, -17.83],
  // Oceania / Pacific
  'adelaide': [138.60, -34.93], 'canberra': [149.13, -35.28], 'gold coast': [153.40, -28.02],
  'christchurch': [172.64, -43.53], 'queenstown': [168.66, -45.03], 'wellington': [174.78, -41.29],
  'nadi': [177.42, -17.80], 'suva': [178.44, -18.14], 'port moresby': [147.18, -9.44],
  'avarua': [-159.78, -21.21], 'papeete': [-149.57, -17.54], 'hagatna': [144.75, 13.48],
  'apia': [-171.76, -13.83], "nuku'alofa": [-175.20, -21.14],
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
    .replace(/ł/g, 'l').replace(/ø/g, 'o').replace(/đ/g, 'd') // letters NFD can't decompose
    .replace(/æ/g, 'ae').replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ');

export const coordsForCity = (city) => CITY_COORDS[normalizeCity(city)] || null;
