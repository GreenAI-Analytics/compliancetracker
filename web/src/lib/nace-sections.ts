export type NaceSection = {
  code: string;
  name: string;
  min: number;
  max: number;
};

export const NACE_SECTIONS: NaceSection[] = [
  { code: "A", name: "Agriculture, forestry and fishing", min: 1, max: 3 },
  { code: "B", name: "Mining and quarrying", min: 5, max: 9 },
  { code: "C", name: "Manufacturing", min: 10, max: 33 },
  { code: "D", name: "Electricity, gas, steam and air conditioning supply", min: 35, max: 35 },
  { code: "E", name: "Water supply; sewerage; waste management", min: 36, max: 39 },
  { code: "F", name: "Construction", min: 41, max: 43 },
  { code: "G", name: "Wholesale and retail trade; repair of motor vehicles", min: 45, max: 47 },
  { code: "H", name: "Transportation and storage", min: 49, max: 53 },
  { code: "I", name: "Accommodation and food service activities", min: 55, max: 56 },
  { code: "J", name: "Information and communication", min: 58, max: 63 },
  { code: "K", name: "Financial and insurance activities", min: 64, max: 66 },
  { code: "L", name: "Real estate activities", min: 68, max: 68 },
  { code: "M", name: "Professional, scientific and technical activities", min: 69, max: 75 },
  { code: "N", name: "Administrative and support service activities", min: 77, max: 82 },
  { code: "O", name: "Public administration and defence", min: 84, max: 84 },
  { code: "P", name: "Education", min: 85, max: 85 },
  { code: "Q", name: "Human health and social work activities", min: 86, max: 88 },
  { code: "R", name: "Arts, entertainment and recreation", min: 90, max: 93 },
  { code: "S", name: "Other service activities", min: 94, max: 96 },
  { code: "T", name: "Activities of households as employers", min: 97, max: 98 },
  { code: "U", name: "Activities of extraterritorial organisations", min: 99, max: 99 },
];

export function getNaceSectionCode(naceCode: string): string | null {
  const twoDigits = naceCode.slice(0, 2);
  const value = Number.parseInt(twoDigits, 10);

  if (Number.isNaN(value)) {
    return null;
  }

  const section = NACE_SECTIONS.find((item) => value >= item.min && value <= item.max);
  return section?.code ?? null;
}
