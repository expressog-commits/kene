export type StockLevel = "available" | "low" | "out";

export type VerificationStatus = "pending" | "verified" | "suspended";

export type ProfessionalType = "pharmacy" | "hospital" | "admin";

export interface UserLocation {
  lat: number;
  lng: number;
}

export interface BulkImportSummary {
  imported: number;
  createdMedicines: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface Pharmacy {
  id: string;
  name: string;
  quartier: string;
  address: string;
  phone: string;
  whatsapp: string;
  distanceKm: number;
  latitude: number;
  longitude: number;
  openFrom: number;
  openTo: number;
  onDuty: boolean;
  dutyNote: string;
  verificationStatus: VerificationStatus;
  licenseNumber: string;
  verifiedAt?: string;
  updatedAt?: string;
}

export interface Medicine {
  id: string;
  name: string;
  dci: string;
  form: string;
  category: string;
  basePrice: number;
}

export interface StockItem {
  pharmacyId: string;
  medicineId: string;
  price: number;
  quantity: number;
  updatedAt: string;
}

export interface Settings {
  activePharmacyId: string;
  activeHospitalId: string;
  plan: string;
}

export interface ActivityItem {
  id: string;
  at: string;
  kind: "stock" | "pharmacy" | "admin" | "beds" | "system";
  label: string;
}

export interface EmergencyUnit {
  id: string;
  label: string;
  totalBeds: number;
  occupiedBeds: number;
  waitingMinutes: number;
}

export interface Hospital {
  id: string;
  name: string;
  quartier: string;
  address: string;
  phone: string;
  whatsapp: string;
  distanceKm: number;
  latitude: number;
  longitude: number;
  units: EmergencyUnit[];
  updatedAt: string;
}

export interface ProfessionalAccount {
  id: string;
  type: ProfessionalType;
  establishmentId: string;
  email: string;
  managerName: string;
  role: string;
  createdAt: string;
  lastLoginAt?: string;
}

/** Compte de démonstration avec son code en clair, uniquement pour le seed serveur et l'aide à la connexion. */
export interface DemoAccount extends ProfessionalAccount {
  accessCode: string;
  recoveryCode: string;
}

/** Session exposée au navigateur : jamais de code, jamais de hash. */
export interface SessionInfo {
  accountId: string;
  type: ProfessionalType;
  establishmentId: string;
  managerName: string;
  email: string;
  role: string;
  establishmentName: string;
  signedInAt: string;
}

export interface AppState {
  pharmacies: Pharmacy[];
  medicines: Medicine[];
  hospitals: Hospital[];
  stock: StockItem[];
  settings: Settings;
  activity: ActivityItem[];
}
