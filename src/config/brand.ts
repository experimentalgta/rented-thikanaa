export const BRAND = {
  name: 'Rented Thikan',
  tagline: 'Find a Room. Find a Roommate. Stay Safe.',
  subheading: 'Discover verified rooms, PGs, hostels, flats, and compatible roommates across India with privacy-first contact.',
  city: 'All India',
  state: 'India',
  country: 'India',
  contactEmail: 'support@rentedthikan.in',
  supportHours: '9:00 AM – 8:00 PM IST',
};

export const PROPERTY_TYPES = [
  { id: 'room', label: 'Student Room', icon: 'Home', description: 'Single or independent student room in a quiet house' },
  { id: 'pg', label: 'PG (Paying Guest)', icon: 'Building2', description: 'Managed PG with meals, cleaning, and facilities' },
  { id: 'hostel', label: 'Student Hostel', icon: 'BedDouble', description: 'Traditional student hostel with common mess & warden' },
  { id: 'flat', label: 'Flat / Apartment', icon: 'Building', description: '1BHK/2BHK flats for group sharing' },
  { id: 'shared_room', label: 'Shared Room', icon: 'Users', description: 'Share a room with an existing student' },
  { id: 'homestay', label: 'Homestay', icon: 'HeartHandshake', description: 'Stay with a local family in a secure home' },
] as const;

export const AMENITIES_CATALOG = [
  { id: 'wifi', name: 'High-Speed Wi-Fi', icon: 'Wifi' },
  { id: 'ro_water', name: 'RO Drinking Water', icon: 'Droplets' },
  { id: 'power_backup', name: 'Inverter / Power Backup', icon: 'Zap' },
  { id: 'food_available', name: 'Tiffin / Mess Food', icon: 'Utensils' },
  { id: 'geyser', name: 'Geyser (Hot Water)', icon: 'Flame' },
  { id: 'cooler', name: 'Desert Cooler', icon: 'Wind' },
  { id: 'ac', name: 'Air Conditioner', icon: 'Snowflake' },
  { id: 'attached_bath', name: 'Attached Bathroom', icon: 'Bath' },
  { id: 'cctv', name: 'CCTV Security', icon: 'ShieldCheck' },
  { id: 'warden', name: 'Warden / Caretaker', icon: 'UserCheck' },
  { id: 'two_wheeler_parking', name: 'Bike/Scooty Parking', icon: 'Bike' },
  { id: 'study_table', name: 'Study Table & Chair', icon: 'BookOpen' },
  { id: 'washing_machine', name: 'Washing Machine', icon: 'Shirt' },
  { id: 'kitchen_access', name: 'Self Cooking Allowed', icon: 'Soup' },
];

export const RULES_CATALOG = [
  { id: 'gate_timings', name: 'Gate Timings (e.g. 10:00 PM)' },
  { id: 'no_smoking', name: 'No Smoking / Alcohol Allowed' },
  { id: 'quiet_hours', name: 'Quiet Hours (11 PM - 6 AM)' },
  { id: 'visitors_allowed_day', name: 'Daytime Visitors Allowed' },
  { id: 'no_overnight_guests', name: 'No Overnight External Guests' },
  { id: 'parents_allowed', name: 'Visiting Parents Allowed to Stay' },
];
