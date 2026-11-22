// Values defined by the SRS (FR-03, 3.3, 3.5.3).
export const CATEGORIES = [
  "Electronics",
  "Wallet/Card",
  "Clothing",
  "Bag",
  "Stationery",
  "Umbrella",
  "Other",
] as const;

export const ITEM_STATUSES = ["Available", "Returned", "Removed", "Disposed"] as const;

export const ROLES = ["Staff", "Administrator"] as const;

export type Category = (typeof CATEGORIES)[number];
export type ItemStatus = (typeof ITEM_STATUSES)[number];
export type Role = (typeof ROLES)[number];

// 3.1 / FR-03: one JPG or PNG image, up to 10 MB.
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png"];
