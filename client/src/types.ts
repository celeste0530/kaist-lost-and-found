// Mirrors the SRS (FR-03, 3.3, 3.5.3) and the JSON returned by the server.
// CATEGORIES / ItemStatus / Role must match server/src/constants.ts and db/schema.sql.
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
export const ITEM_STATUSES = ["Available", "Returned", "Removed", "Disposed"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];
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

// Row of GET /api/staff (administrators only): the login fields plus the deactivation time.
export interface StaffAccount extends StaffUser {
  deactivatedAt: string | null; // null = active
}
