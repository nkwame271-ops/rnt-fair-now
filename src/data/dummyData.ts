export const regions = [
  "Greater Accra",
  "Ashanti",
  "Western",
  "Eastern",
  "Central",
  "Northern",
  "Volta",
  "Upper East",
  "Upper West",
  "Bono",
  "Bono East",
  "Ahafo",
  "Savannah",
  "North East",
  "Oti",
  "Western North",
];

export const areasByRegion: Record<string, string[]> = {
  "Greater Accra": ["Accra Central", "East Legon", "Tema", "Madina", "Spintex", "Kasoa", "Cantonments", "Osu", "Dansoman", "Teshie"],
  "Ashanti": ["Kumasi Central", "Adum", "Bantama", "Suame", "Oforikrom", "Asokwa"],
  "Western": ["Takoradi", "Sekondi", "Tarkwa", "Prestea"],
  "Eastern": ["Koforidua", "Nkawkaw", "Akim Oda"],
  "Central": ["Cape Coast", "Elmina", "Winneba", "Kasoa"],
  "Northern": ["Tamale", "Yendi", "Damongo"],
  "Volta": ["Ho", "Keta", "Hohoe"],
};

export type PropertyType = "Single Room" | "Chamber & Hall" | "1-Bedroom" | "2-Bedroom" | "3-Bedroom" | "Self-Contained";

export interface RentPrice {
  region: string;
  area: string;
  type: PropertyType;
  min: number;
  avg: number;
  max: number;
}

export const rentPrices: RentPrice[] = [
  { region: "Greater Accra", area: "East Legon", type: "Single Room", min: 250, avg: 400, max: 600 },
  { region: "Greater Accra", area: "East Legon", type: "Chamber & Hall", min: 500, avg: 800, max: 1200 },
  { region: "Greater Accra", area: "East Legon", type: "1-Bedroom", min: 800, avg: 1200, max: 2000 },
  { region: "Greater Accra", area: "East Legon", type: "2-Bedroom", min: 1500, avg: 2500, max: 4000 },
  { region: "Greater Accra", area: "East Legon", type: "3-Bedroom", min: 3000, avg: 4500, max: 7000 },
  { region: "Greater Accra", area: "Tema", type: "Single Room", min: 150, avg: 250, max: 400 },
  { region: "Greater Accra", area: "Tema", type: "Chamber & Hall", min: 300, avg: 500, max: 800 },
  { region: "Greater Accra", area: "Tema", type: "1-Bedroom", min: 500, avg: 800, max: 1200 },
  { region: "Greater Accra", area: "Tema", type: "2-Bedroom", min: 1000, avg: 1500, max: 2500 },
  { region: "Greater Accra", area: "Madina", type: "Single Room", min: 100, avg: 200, max: 350 },
  { region: "Greater Accra", area: "Madina", type: "Chamber & Hall", min: 250, avg: 400, max: 650 },
  { region: "Greater Accra", area: "Madina", type: "1-Bedroom", min: 400, avg: 650, max: 1000 },
  { region: "Greater Accra", area: "Spintex", type: "Single Room", min: 200, avg: 350, max: 500 },
  { region: "Greater Accra", area: "Spintex", type: "Chamber & Hall", min: 400, avg: 650, max: 1000 },
  { region: "Greater Accra", area: "Spintex", type: "1-Bedroom", min: 700, avg: 1000, max: 1600 },
  { region: "Greater Accra", area: "Spintex", type: "2-Bedroom", min: 1200, avg: 2000, max: 3000 },
  { region: "Greater Accra", area: "Accra Central", type: "Single Room", min: 200, avg: 300, max: 500 },
  { region: "Greater Accra", area: "Accra Central", type: "Chamber & Hall", min: 350, avg: 550, max: 900 },
  { region: "Ashanti", area: "Kumasi Central", type: "Single Room", min: 80, avg: 150, max: 250 },
  { region: "Ashanti", area: "Kumasi Central", type: "Chamber & Hall", min: 200, avg: 350, max: 500 },
  { region: "Ashanti", area: "Kumasi Central", type: "1-Bedroom", min: 350, avg: 550, max: 800 },
  { region: "Ashanti", area: "Kumasi Central", type: "2-Bedroom", min: 600, avg: 900, max: 1400 },
  { region: "Western", area: "Takoradi", type: "Single Room", min: 100, avg: 180, max: 300 },
  { region: "Western", area: "Takoradi", type: "Chamber & Hall", min: 250, avg: 400, max: 600 },
  { region: "Western", area: "Takoradi", type: "1-Bedroom", min: 400, avg: 600, max: 900 },
  { region: "Central", area: "Cape Coast", type: "Single Room", min: 80, avg: 150, max: 250 },
  { region: "Central", area: "Cape Coast", type: "Chamber & Hall", min: 200, avg: 300, max: 500 },
  { region: "Northern", area: "Tamale", type: "Single Room", min: 60, avg: 120, max: 200 },
  { region: "Northern", area: "Tamale", type: "Chamber & Hall", min: 150, avg: 250, max: 400 },
];

export interface Listing {
  id: string;
  title: string;
  type: PropertyType;
  price: number;
  advance: number;
  region: string;
  area: string;
  address: string;
  bedrooms: number;
  bathrooms: number;
  image: string;
  landlord: string;
  phone: string;
  description: string;
  amenities: string[];
  verified: boolean;
  postedDate: string;
}

export const listings: Listing[] = [
  {
    id: "LST-001",
    title: "Spacious 2-Bedroom Apartment in East Legon",
    type: "2-Bedroom",
    price: 2500,
    advance: 12,
    region: "Greater Accra",
    area: "East Legon",
    address: "14 Palm Street, East Legon",
    bedrooms: 2,
    bathrooms: 2,
    image: "listing-1",
    landlord: "Kwame Asante",
    phone: "024 555 1234",
    description: "Modern 2-bedroom apartment with spacious living area, fitted kitchen, and balcony. Gated community with 24-hour security.",
    amenities: ["Security", "Parking", "Water Tank", "Balcony"],
    verified: true,
    postedDate: "2026-01-15",
  },
  {
    id: "LST-002",
    title: "Affordable Single Room - Madina",
    type: "Single Room",
    price: 200,
    advance: 12,
    region: "Greater Accra",
    area: "Madina",
    address: "Block 7, Madina Zongo",
    bedrooms: 1,
    bathrooms: 1,
    image: "listing-2",
    landlord: "Ama Mensah",
    phone: "020 555 5678",
    description: "Clean single room with shared facilities. Close to market and transport. Ideal for students and young professionals.",
    amenities: ["Shared Bath", "Near Market"],
    verified: true,
    postedDate: "2026-01-20",
  },
  {
    id: "LST-003",
    title: "Modern 1-Bedroom at Spintex",
    type: "1-Bedroom",
    price: 1000,
    advance: 6,
    region: "Greater Accra",
    area: "Spintex",
    address: "Spintex Road, Community 18",
    bedrooms: 1,
    bathrooms: 1,
    image: "listing-3",
    landlord: "Joseph Tetteh",
    phone: "027 555 9012",
    description: "Newly built 1-bedroom self-contained apartment. Tiled floors, modern fixtures, and reliable water supply.",
    amenities: ["Self-Contained", "Tiled", "Water Supply"],
    verified: false,
    postedDate: "2026-02-01",
  },
  {
    id: "LST-004",
    title: "2-Bedroom House in Tema Community 5",
    type: "2-Bedroom",
    price: 1500,
    advance: 12,
    region: "Greater Accra",
    area: "Tema",
    address: "Community 5, Tema",
    bedrooms: 2,
    bathrooms: 1,
    image: "listing-4",
    landlord: "Francis Adjei",
    phone: "024 555 3456",
    description: "Standalone 2-bedroom house with compound. Quiet neighbourhood, close to schools and markets.",
    amenities: ["Compound", "Near Schools", "Quiet Area"],
    verified: true,
    postedDate: "2026-01-28",
  },
  {
    id: "LST-005",
    title: "Chamber & Hall - Dansoman",
    type: "Chamber & Hall",
    price: 450,
    advance: 12,
    region: "Greater Accra",
    area: "Dansoman",
    address: "Dansoman Last Stop",
    bedrooms: 1,
    bathrooms: 1,
    image: "listing-5",
    landlord: "Abena Owusu",
    phone: "055 555 7890",
    description: "Chamber and hall with kitchen space. Self-contained with own bathroom. First floor with good ventilation.",
    amenities: ["Self-Contained", "Kitchen", "Ventilated"],
    verified: true,
    postedDate: "2026-02-03",
  },
  {
    id: "LST-006",
    title: "Luxury 3-Bedroom - Cantonments",
    type: "3-Bedroom",
    price: 5000,
    advance: 6,
    region: "Greater Accra",
    area: "Cantonments",
    address: "7th Avenue, Cantonments",
    bedrooms: 3,
    bathrooms: 3,
    image: "listing-6",
    landlord: "Dr. Nana Agyemang",
    phone: "020 555 2345",
    description: "Executive 3-bedroom apartment with pool, gym, and concierge. Premium finishes throughout. Serviced apartment option available.",
    amenities: ["Pool", "Gym", "Concierge", "AC", "Generator"],
    verified: true,
    postedDate: "2026-01-10",
  },
];

export interface Complaint {
  id: string;
  type: string;
  status: "Submitted" | "Under Review" | "In Progress" | "Resolved" | "Closed";
  landlordName: string;
  propertyAddress: string;
  region: string;
  description: string;
  dateSubmitted: string;
  lastUpdated: string;
}

export const complaintTypes = [
  "Illegal Rent Increase",
  "Unlawful Eviction",
  "No Receipt Issued",
  "Advance Rent Violation",
  "Landlord Harassment",
  "Unregistered Agreement",
  "Property Maintenance Failure",
  "Utility Disputes",
];

export const sampleComplaints: Complaint[] = [
  {
    id: "RC-2026-00142",
    type: "Illegal Rent Increase",
    status: "Under Review",
    landlordName: "Mr. Kofi Boateng",
    propertyAddress: "12 Ring Road, Osu",
    region: "Greater Accra",
    description: "Landlord increased rent by 80% without proper notice or justification.",
    dateSubmitted: "2026-01-15",
    lastUpdated: "2026-01-22",
  },
  {
    id: "RC-2026-00098",
    type: "Advance Rent Violation",
    status: "Resolved",
    landlordName: "Madam Akua Darko",
    propertyAddress: "5 Nima Highway, Madina",
    region: "Greater Accra",
    description: "Landlord demanded 2 years advance rent for a chamber and hall.",
    dateSubmitted: "2025-12-10",
    lastUpdated: "2026-01-05",
  },
];

export interface LandlordProperty {
  id: string;
  name: string;
  code: string;
  address: string;
  region: string;
  area: string;
  units: {
    id: string;
    name: string;
    type: PropertyType;
    rent: number;
    tenant: string | null;
    status: "Occupied" | "Vacant";
    agreementRegistered: boolean;
  }[];
}

export const sampleProperties: LandlordProperty[] = [
  {
    id: "PROP-001",
    name: "Asante Residences",
    code: "GR-EL-2026-001",
    address: "14 Palm Street, East Legon",
    region: "Greater Accra",
    area: "East Legon",
    units: [
      { id: "U-001", name: "Unit A", type: "2-Bedroom", rent: 2500, tenant: "Yaw Mensah", status: "Occupied", agreementRegistered: true },
      { id: "U-002", name: "Unit B", type: "2-Bedroom", rent: 2500, tenant: "Esi Appiah", status: "Occupied", agreementRegistered: true },
      { id: "U-003", name: "Unit C", type: "1-Bedroom", rent: 1200, tenant: null, status: "Vacant", agreementRegistered: false },
    ],
  },
  {
    id: "PROP-002",
    name: "Spintex Heights",
    code: "GR-SP-2026-002",
    address: "Spintex Road, Community 18",
    region: "Greater Accra",
    area: "Spintex",
    units: [
      { id: "U-004", name: "Flat 1", type: "1-Bedroom", rent: 1000, tenant: "Kweku Amponsah", status: "Occupied", agreementRegistered: true },
      { id: "U-005", name: "Flat 2", type: "1-Bedroom", rent: 1000, tenant: "Adwoa Sarpong", status: "Occupied", agreementRegistered: false },
    ],
  },
];

export const tenantPayments = [
  { id: "PAY-001", date: "2026-02-01", amount: 2500, rent: 2500, tax: 200, total: 2700, status: "Paid", method: "Mobile Money" },
  { id: "PAY-002", date: "2026-01-01", amount: 2500, rent: 2500, tax: 200, total: 2700, status: "Paid", method: "Bank Transfer" },
  { id: "PAY-003", date: "2025-12-01", amount: 2500, rent: 2500, tax: 200, total: 2700, status: "Paid", method: "Mobile Money" },
  { id: "PAY-004", date: "2026-03-01", amount: 2500, rent: 2500, tax: 200, total: 2700, status: "Pending", method: "" },
];
