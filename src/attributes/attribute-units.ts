export const ATTRIBUTE_UNITS = [
  '',
  'mm',
  'cm',
  'm',
  'kg',
  'g',
  'W',
  'kW',
  'V',
  'A',
  'Hz',
  'MHz',
  'GHz',
  'GB',
  'TB',
  'L',
  'ml',
  '°C',
  '%',
  'dona',
] as const;

export type AttributeUnit = (typeof ATTRIBUTE_UNITS)[number];
