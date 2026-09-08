import type { CourseCatalogItem } from "./course-types"

/** Special / partner programmes grouped under the Global AHEP diploma shell. */
export const specialCourseIds = [
  "ahep-plastic-pollution",
  "ahep-pollution-plastique",
  "waste-chemicals-wealth",
  "entrepreneuriat-dechets-produits-chimiques",
] as const

/** The unique diploma shell that hosts the AHEP programmes. */
export const WASTE_CHEMICALS_WEALTH = {
  slug: "waste-chemicals-wealth",
  name: "Certified Waste & Chemicals-to-Wealth Entrepreneurship Program",
  tagline: "English & Français, certificate",
  description:
    "A practical certificate program for turning waste and chemical-resource challenges into safer, sustainable, and income-generating opportunities.",
} as const

export const GLOBAL_AHEP = {
  slug: "global-ahep",
  name: "Global AHEP",
  tagline: "Certified Plastic Pollution Leadership Program",
  description:
    "Global AHEP is Edusanna's flagship international diploma shell, delivered with the African Health & Environment Programme. It is offered in English and French, is diploma-only, and carries its own credential fee of $30 USD.",
} as const

export const specialCourseCatalog: CourseCatalogItem[] = [
  {
    id: "ahep-plastic-pollution",
    letter: "A",
    certificateTitle: "AHEP Plastic Pollution Leadership (English)",
    diplomaTitle: "AHEP Certified Plastic Pollution Leadership Program",
    category: "agriculture",
    icon: "Leaf",
    color: "from-teal-500 to-green-500",
  },
  {
    id: "ahep-pollution-plastique",
    letter: "A",
    certificateTitle: "AHEP Pollution Plastique, Leadership (Français)",
    diplomaTitle: "Programme de Leadership Certifié AHEP sur la Pollution Plastique",
    category: "agriculture",
    icon: "Leaf",
    color: "from-teal-500 to-green-500",
  },
  {
    id: "waste-chemicals-wealth",
    letter: "W",
    certificateTitle: "Waste & Chemicals-to-Wealth Entrepreneurship (English)",
    diplomaTitle: "Waste & Chemicals-to-Wealth Entrepreneurship",
    category: "agriculture",
    icon: "Recycle",
    color: "from-emerald-500 to-teal-500",
  },
  {
    id: "entrepreneuriat-dechets-produits-chimiques",
    letter: "E",
    certificateTitle: "Entrepreneuriat Déchets & Produits Chimiques vers la Richesse (Français)",
    diplomaTitle: "Entrepreneuriat Déchets & Produits Chimiques vers la Richesse",
    category: "agriculture",
    icon: "Recycle",
    color: "from-emerald-500 to-teal-500",
  },
]

/** Language label for each Global AHEP programme. */
export const specialCourseLanguage: Record<string, string> = {
  "ahep-plastic-pollution": "English",
  "ahep-pollution-plastique": "Francais",
  "waste-chemicals-wealth": "English",
  "entrepreneuriat-dechets-produits-chimiques": "Français",
}

export function isWasteChemicalsWealthCourse(id: string): boolean {
  return id === "waste-chemicals-wealth" || id === "entrepreneuriat-dechets-produits-chimiques"
}

export function isSpecialCourse(id: string): boolean {
  return (specialCourseIds as readonly string[]).includes(id)
}
