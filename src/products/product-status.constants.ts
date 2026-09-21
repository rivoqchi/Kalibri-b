export const PRODUCT_STATUS_TAGS = [
  'new',
  'very_cheap',
  'used',
  'seasonal',
] as const;

export type ProductStatusTag = (typeof PRODUCT_STATUS_TAGS)[number];

export const PRODUCT_STATUS_LABELS: Record<ProductStatusTag, string> = {
  new: 'Yangi',
  very_cheap: 'Juda arzon narxda',
  used: 'Ishlatilgan',
  seasonal: 'Mavsum aksiyasi',
};

/** Yangi status muddati (kun). */
export const PRODUCT_NEW_STATUS_DAYS = 50;
