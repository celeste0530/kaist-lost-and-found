// Mirrors the SRS (FR-03, 3.3, 3.5.3) and the JSON returned by the server.
export const CATEGORIES = [
  "Electronics",
  "Wallet/Card",
  "Clothing",
  "Bag",
  "Stationery",
  "Umbrella",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];
export type ItemStatus = "Available" | "Returned" | "Removed" | "Disposed";
export type Role = "Staff" | "Administrator";

export interface Item {
  id: number;
  name: string;
  category: Category;
  foundDate: string; // YYYY-MM-DD
  foundLat: number;
  foundLng: number;
  description: string;
  imageUrl: string | null; // file name under /uploads
  status: ItemStatus;
  registrationDate: string;
  centerId: number;
  centerName: string;
}

export interface Center {
  id: number;
  name: string;
  lat: number;
  lng: number;
  phone: string | null;
  email: string | null;
  operatingHours: string;
  closureInformation: string | null;
}

export interface StaffUser {
  id: number;
  email: string;
  displayName: string;
  role: Role;
  centerId: number | null;
}
