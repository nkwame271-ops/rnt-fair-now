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
  "Greater Accra": ["Accra Central", "East Legon", "Tema", "Madina", "Spintex", "Kasoa", "Cantonments", "Osu", "Dansoman", "Teshie", "Nungua", "Adenta", "Dome", "Achimota", "Haatso", "Ashaiman", "Kwabenya", "Sakumono", "Lashibi", "Airport Residential", "Dzorwulu", "Labone", "Ridge", "Roman Ridge", "Weija", "Gbawe", "Ablekuma", "Lapaz", "Mallam", "Odorkor", "Abelemkpe"],
  "Ashanti": ["Kumasi Central", "Adum", "Bantama", "Suame", "Oforikrom", "Asokwa", "Nhyiaeso", "Tafo", "Atonsu", "Ahinsan", "Ejisu", "Kwadaso", "Abrepo", "Bomso", "Ayigya", "Kentinkrono", "Asafo", "Kejetia", "Danyame", "Tech Junction", "Buokrom", "Dichemso", "Santasi", "Tanoso", "Abuakwa"],
  "Western": ["Takoradi", "Sekondi", "Tarkwa", "Prestea", "Axim", "Essikado", "Effia", "Kojokrom", "Anaji", "Airport Ridge", "Beach Road", "New Takoradi", "Fijai", "Kwesimintsim", "Shama", "Nkontompo"],
  "Eastern": ["Koforidua", "Nkawkaw", "Akim Oda", "Suhum", "Nsawam", "Akropong", "Aburi", "Mampong", "Somanya", "Kade", "Donkorkrom", "Asamankese", "Kibi", "New Tafo", "Osiem"],
  "Central": ["Cape Coast", "Elmina", "Winneba", "Kasoa", "Mankessim", "Dunkwa-on-Offin", "Saltpond", "Swedru", "Anomabu", "Moree", "Abura", "Pedu", "Efutu", "Assin Fosu", "Twifo Praso"],
  "Northern": ["Tamale", "Yendi", "Damongo", "Savelugu", "Tolon", "Kumbungu", "Sagnarigu", "Nyankpala", "Bimbilla", "Gushegu", "Karaga", "Nanton"],
  "Volta": ["Ho", "Keta", "Hohoe", "Kpando", "Aflao", "Akatsi", "Anloga", "Sogakope", "Adidome", "Denu", "Dzodze", "Abor", "Peki", "Juapong"],
  "Upper East": ["Bolgatanga", "Navrongo", "Bawku", "Paga", "Zuarungu", "Zebilla", "Tongo", "Sumbrungu", "Garu", "Tempane", "Pusiga", "Sandema"],
  "Upper West": ["Wa", "Tumu", "Nandom", "Lawra", "Jirapa", "Hamile", "Nadowli", "Lambussie", "Kaleo", "Funsi", "Gwollu"],
  "Bono": ["Sunyani", "Berekum", "Dormaa Ahenkro", "Wenchi", "Techiman", "Nkoranza", "Sampa", "Drobo", "Japekrom", "Odumase", "Fiapre", "Chiraa"],
  "Bono East": ["Techiman", "Kintampo", "Nkoranza", "Atebubu", "Yeji", "Prang", "Jema", "Kwame Danso", "Tuobodom", "Tanoso"],
  "Ahafo": ["Goaso", "Bechem", "Duayaw Nkwanta", "Kukuom", "Mim", "Kenyasi", "Hwidiem", "Nkaseim", "Acherensua", "Asunafo"],
  "Savannah": ["Damongo", "Bole", "Salaga", "Sawla", "Buipe", "Yapei", "Tolon", "Larabanga", "Daboya", "Fufulso"],
  "North East": ["Nalerigu", "Gambaga", "Walewale", "Bunkpurugu", "Yunyoo", "Chereponi", "Mandari", "Langbinsi", "Gbintiri"],
  "Oti": ["Dambai", "Nkwanta", "Kadjebi", "Jasikan", "Kete Krachi", "Chinderi", "Brewaniase", "Kpassa", "Biakoye"],
  "Western North": ["Sefwi Wiawso", "Bibiani", "Juaboso", "Enchi", "Dadieso", "Akontombra", "Bodi", "Sefwi Bekwai", "Asawinso", "Anhwiaso"],
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

// Helper to generate rent entries for an area
const makeRents = (region: string, area: string, base: number): RentPrice[] => [
  { region, area, type: "Single Room", min: Math.round(base * 0.6), avg: base, max: Math.round(base * 1.5) },
  { region, area, type: "Chamber & Hall", min: Math.round(base * 1.5), avg: Math.round(base * 2.2), max: Math.round(base * 3) },
  { region, area, type: "1-Bedroom", min: Math.round(base * 2.5), avg: Math.round(base * 3.5), max: Math.round(base * 5) },
  { region, area, type: "2-Bedroom", min: Math.round(base * 4), avg: Math.round(base * 6), max: Math.round(base * 9) },
  { region, area, type: "3-Bedroom", min: Math.round(base * 7), avg: Math.round(base * 10), max: Math.round(base * 15) },
  { region, area, type: "Self-Contained", min: Math.round(base * 2), avg: Math.round(base * 3), max: Math.round(base * 4.5) },
];

export const rentPrices: RentPrice[] = [
  // Greater Accra
  ...makeRents("Greater Accra", "East Legon", 400),
  ...makeRents("Greater Accra", "Tema", 250),
  ...makeRents("Greater Accra", "Madina", 200),
  ...makeRents("Greater Accra", "Spintex", 350),
  ...makeRents("Greater Accra", "Accra Central", 300),
  ...makeRents("Greater Accra", "Cantonments", 500),
  ...makeRents("Greater Accra", "Osu", 350),
  ...makeRents("Greater Accra", "Dansoman", 180),
  ...makeRents("Greater Accra", "Kasoa", 120),
  ...makeRents("Greater Accra", "Adenta", 200),
  ...makeRents("Greater Accra", "Dome", 220),
  ...makeRents("Greater Accra", "Ashaiman", 100),

  // Ashanti
  ...makeRents("Ashanti", "Kumasi Central", 150),
  ...makeRents("Ashanti", "Adum", 180),
  ...makeRents("Ashanti", "Bantama", 130),
  ...makeRents("Ashanti", "Oforikrom", 120),
  ...makeRents("Ashanti", "Ejisu", 100),
  ...makeRents("Ashanti", "Nhyiaeso", 160),
  ...makeRents("Ashanti", "Kwadaso", 110),

  // Western
  ...makeRents("Western", "Takoradi", 180),
  ...makeRents("Western", "Sekondi", 140),
  ...makeRents("Western", "Tarkwa", 160),
  ...makeRents("Western", "Anaji", 200),
  ...makeRents("Western", "Effia", 150),

  // Eastern
  ...makeRents("Eastern", "Koforidua", 140),
  ...makeRents("Eastern", "Nkawkaw", 100),
  ...makeRents("Eastern", "Suhum", 90),
  ...makeRents("Eastern", "Nsawam", 100),
  ...makeRents("Eastern", "Akim Oda", 80),

  // Central
  ...makeRents("Central", "Cape Coast", 150),
  ...makeRents("Central", "Elmina", 120),
  ...makeRents("Central", "Winneba", 110),
  ...makeRents("Central", "Kasoa", 120),
  ...makeRents("Central", "Swedru", 90),

  // Northern
  ...makeRents("Northern", "Tamale", 120),
  ...makeRents("Northern", "Yendi", 70),
  ...makeRents("Northern", "Savelugu", 60),
  ...makeRents("Northern", "Sagnarigu", 100),
  ...makeRents("Northern", "Damongo", 80),

  // Volta
  ...makeRents("Volta", "Ho", 130),
  ...makeRents("Volta", "Hohoe", 100),
  ...makeRents("Volta", "Keta", 90),
  ...makeRents("Volta", "Aflao", 80),
  ...makeRents("Volta", "Kpando", 85),

  // Upper East
  ...makeRents("Upper East", "Bolgatanga", 100),
  ...makeRents("Upper East", "Navrongo", 70),
  ...makeRents("Upper East", "Bawku", 60),
  ...makeRents("Upper East", "Zuarungu", 50),

  // Upper West
  ...makeRents("Upper West", "Wa", 90),
  ...makeRents("Upper West", "Tumu", 50),
  ...makeRents("Upper West", "Lawra", 45),
  ...makeRents("Upper West", "Jirapa", 40),

  // Bono
  ...makeRents("Bono", "Sunyani", 140),
  ...makeRents("Bono", "Berekum", 100),
  ...makeRents("Bono", "Dormaa Ahenkro", 90),
  ...makeRents("Bono", "Wenchi", 80),

  // Bono East
  ...makeRents("Bono East", "Techiman", 120),
  ...makeRents("Bono East", "Kintampo", 80),
  ...makeRents("Bono East", "Atebubu", 70),
  ...makeRents("Bono East", "Nkoranza", 75),

  // Ahafo
  ...makeRents("Ahafo", "Goaso", 100),
  ...makeRents("Ahafo", "Bechem", 80),
  ...makeRents("Ahafo", "Duayaw Nkwanta", 70),
  ...makeRents("Ahafo", "Mim", 60),

  // Savannah
  ...makeRents("Savannah", "Damongo", 80),
  ...makeRents("Savannah", "Bole", 50),
  ...makeRents("Savannah", "Salaga", 55),
  ...makeRents("Savannah", "Sawla", 40),

  // North East
  ...makeRents("North East", "Nalerigu", 60),
  ...makeRents("North East", "Gambaga", 50),
  ...makeRents("North East", "Walewale", 55),

  // Oti
  ...makeRents("Oti", "Dambai", 80),
  ...makeRents("Oti", "Nkwanta", 70),
  ...makeRents("Oti", "Kadjebi", 65),
  ...makeRents("Oti", "Jasikan", 60),

  // Western North
  ...makeRents("Western North", "Sefwi Wiawso", 90),
  ...makeRents("Western North", "Bibiani", 100),
  ...makeRents("Western North", "Juaboso", 70),
  ...makeRents("Western North", "Enchi", 65),
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

export interface TenancyAgreement {
  id: string;
  propertyName: string;
  propertyAddress: string;
  unitName: string;
  unitType: PropertyType;
  landlordName: string;
  monthlyRent: number;
  advanceMonths: number;
  startDate: string;
  endDate: string;
  registrationCode: string;
  payments: TenantPayment[];
}

export interface TenantPayment {
  id: string;
  month: string;
  date: string;
  monthlyRent: number;
  taxAmount: number;
  amountToLandlord: number;
  taxPaid: boolean;
  method: string;
}

export const tenantAgreements: TenancyAgreement[] = [
  {
    id: "AGR-001",
    propertyName: "Asante Residences",
    propertyAddress: "14 Palm Street, East Legon",
    unitName: "Unit A",
    unitType: "2-Bedroom",
    landlordName: "Kwame Asante",
    monthlyRent: 2500,
    advanceMonths: 6,
    startDate: "2025-10-01",
    endDate: "2026-09-30",
    registrationCode: "RC-GR-2025-04821",
    payments: [
      { id: "PAY-001", month: "October 2025", date: "2025-10-01", monthlyRent: 2500, taxAmount: 200, amountToLandlord: 2300, taxPaid: true, method: "Mobile Money" },
      { id: "PAY-002", month: "November 2025", date: "2025-11-01", monthlyRent: 2500, taxAmount: 200, amountToLandlord: 2300, taxPaid: true, method: "Mobile Money" },
      { id: "PAY-003", month: "December 2025", date: "2025-12-01", monthlyRent: 2500, taxAmount: 200, amountToLandlord: 2300, taxPaid: true, method: "Bank Transfer" },
      { id: "PAY-004", month: "January 2026", date: "2026-01-01", monthlyRent: 2500, taxAmount: 200, amountToLandlord: 2300, taxPaid: true, method: "Mobile Money" },
      { id: "PAY-005", month: "February 2026", date: "2026-02-01", monthlyRent: 2500, taxAmount: 200, amountToLandlord: 2300, taxPaid: true, method: "Mobile Money" },
      { id: "PAY-006", month: "March 2026", date: "2026-03-01", monthlyRent: 2500, taxAmount: 200, amountToLandlord: 2300, taxPaid: false, method: "" },
      { id: "PAY-007", month: "April 2026", date: "2026-04-01", monthlyRent: 2500, taxAmount: 200, amountToLandlord: 2300, taxPaid: false, method: "" },
      { id: "PAY-008", month: "May 2026", date: "2026-05-01", monthlyRent: 2500, taxAmount: 200, amountToLandlord: 2300, taxPaid: false, method: "" },
      { id: "PAY-009", month: "June 2026", date: "2026-06-01", monthlyRent: 2500, taxAmount: 200, amountToLandlord: 2300, taxPaid: false, method: "" },
      { id: "PAY-010", month: "July 2026", date: "2026-07-01", monthlyRent: 2500, taxAmount: 200, amountToLandlord: 2300, taxPaid: false, method: "" },
      { id: "PAY-011", month: "August 2026", date: "2026-08-01", monthlyRent: 2500, taxAmount: 200, amountToLandlord: 2300, taxPaid: false, method: "" },
      { id: "PAY-012", month: "September 2026", date: "2026-09-01", monthlyRent: 2500, taxAmount: 200, amountToLandlord: 2300, taxPaid: false, method: "" },
    ],
  },
];

// Keep backward compat for dashboard stats
export const tenantPayments = tenantAgreements[0].payments.map((p) => ({
  id: p.id,
  date: p.date,
  amount: p.monthlyRent,
  rent: p.monthlyRent,
  tax: p.taxAmount,
  total: p.monthlyRent,
  status: p.taxPaid ? "Paid" as const : "Pending" as const,
  method: p.method,
}));
