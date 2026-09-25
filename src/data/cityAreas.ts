export interface CityConfig {
  id: string;
  name: string;
  slug: string;
  state: string;
  stateCode: string;
  district: string;
  defaultLat: number;
  defaultLon: number;
  areas: string[];
}

export const CITY_CONFIGS: Record<string, CityConfig> = {
  prayagraj: {
    id: 'city-prayagraj',
    name: 'Prayagraj',
    slug: 'prayagraj',
    state: 'Uttar Pradesh',
    stateCode: 'UP',
    district: 'Prayagraj',
    defaultLat: 25.4358,
    defaultLon: 81.8463,
    areas: [
      'Civil Lines',
      'George Town',
      'Allahpur',
      'Katra',
      'Old Katra',
      'Tagore Town',
      'Mumfordganj',
      'Colonelganj',
      'Daraganj',
      'Salori',
      'Chhota Baghada',
      'Bada Baghada',
      'Teliarganj',
      'Govindpur',
      'Allahabad University area',
      'High Court area',
      'Prayagraj Junction area',
      'Ashok Nagar',
      'Lukerganj',
      'Rajapur',
      'Kareli',
      'Dhoomanganj',
      'Sulem Sarai',
      'Kalindipuram',
      'Preetam Nagar',
      'Jhalwa',
      'Devghat',
      'Bamrauli',
      'Subedarganj',
      'Rajrooppur',
      'Naini',
      'Chaka',
      'Jhunsi',
      'Phaphamau',
      'Shantipuram',
      'Beli',
      'Stanley Road area',
      'Leader Road area',
      'Chowk',
      'Mutthi Ganj',
      'Kydganj',
      'Zero Road',
      'Rambagh',
      'Alopibagh',
      'Sohbatiabagh',
      'Meerapur',
      'Gaughat',
      'Baihrana',
      'Transport Nagar',
      'ADA Colony',
    ],
  },

  raebareli: {
    id: 'city-raebareli',
    name: 'Raebareli',
    slug: 'raebareli',
    state: 'Uttar Pradesh',
    stateCode: 'UP',
    district: 'Raebareli',
    defaultLat: 26.2294,
    defaultLon: 81.2408,
    areas: [
      'Civil Lines',
      'Indira Nagar',
      'Malik Mau',
      'ITI Colony',
      'Prabhu Town',
      'Kachehri',
      'Degree College Chauraha',
      'Super Market',
      'Ghantaghar',
      'Ratapur',
      'Peda Mandi',
      'Tripula',
      'Munshiganj',
      'Rail Coach Factory (Lalganj road)',
      'Baiswara',
      'Jail Road',
      'Hospital Road',
      'Gora Bazar',
      'Mill Area',
      'Dariyapur',
      'Amawan Road',
      'Sultanpur Road',
      'Lucknow Road',
      'Lalganj',
      'Maharajganj Road',
      'Bachhrawan',
      'Salon',
      'Unchahar',
    ],
  },

  lucknow: {
    id: 'city-lucknow',
    name: 'Lucknow',
    slug: 'lucknow',
    state: 'Uttar Pradesh',
    stateCode: 'UP',
    district: 'Lucknow',
    defaultLat: 26.8467,
    defaultLon: 80.9462,
    areas: [
      'Gomti Nagar',
      'Gomti Nagar Extension',
      'Hazratganj',
      'Aliganj',
      'Indira Nagar',
      'Mahanagar',
      'Alambagh',
      'Jankipuram',
      'Vikas Nagar',
      'Aashiana',
      'Charbagh',
      'Aminabad',
      'Chowk',
      'Rajajipuram',
      'Faizabad Road',
      'Vrindavan Colony',
      'Telibagh',
      'Sushant Golf City',
    ],
  },

  varanasi: {
    id: 'city-varanasi',
    name: 'Varanasi',
    slug: 'varanasi',
    state: 'Uttar Pradesh',
    stateCode: 'UP',
    district: 'Varanasi',
    defaultLat: 25.3176,
    defaultLon: 82.9739,
    areas: [
      'Lanka / BHU area',
      'Assi Ghat',
      'Sigra',
      'Cantonment (Cantt)',
      'Godowlia',
      'Durgakund',
      'Bhelupur',
      'Mahmoorganj',
      'Pandeypur',
      'Shivpur',
      'Sarnath',
      'Kashi Vishwanath area',
      'Rathyatra',
      'Orderly Bazar',
    ],
  },

  delhi: {
    id: 'city-delhi',
    name: 'Delhi',
    slug: 'delhi',
    state: 'Delhi',
    stateCode: 'DL',
    district: 'New Delhi',
    defaultLat: 28.6139,
    defaultLon: 77.2090,
    areas: [
      'Laxmi Nagar',
      'Mukherjee Nagar',
      'North Campus (DU)',
      'South Campus (Satya Niketan)',
      'Kamla Nagar',
      'Hauz Khas',
      'Saket',
      'Karol Bagh',
      'Rajendra Nagar (Old & New)',
      'Munirka',
      'Kalu Sarai',
      'Dwarka',
      'Rohini',
      'Mayur Vihar',
      'Janakpuri',
      'Noida Sector 62',
      'Noida Sector 15',
    ],
  },
};

export function getSupportedCities(): CityConfig[] {
  return Object.values(CITY_CONFIGS);
}

export function getCityConfig(citySlugOrName?: string): CityConfig | undefined {
  if (!citySlugOrName) return CITY_CONFIGS.prayagraj;
  const clean = citySlugOrName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    CITY_CONFIGS[clean] ||
    Object.values(CITY_CONFIGS).find(
      (c) =>
        c.name.toLowerCase() === citySlugOrName.trim().toLowerCase() ||
        c.slug === clean
    )
  );
}

export function getCityAreas(citySlugOrName?: string): string[] {
  const cfg = getCityConfig(citySlugOrName);
  return cfg ? cfg.areas : CITY_CONFIGS.prayagraj.areas;
}
