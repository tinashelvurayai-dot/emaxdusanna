/**
 * Some catalogue entries are shorter-named variants of an imported course that
 * carries the full learning content (module bodies + quizzes). Mapping them
 * here lets those courses serve the real content instead of the generic
 * fallback outline.
 */
export const courseContentAliases: Record<string, string> = {
  anthropology: "cultural-anthropology",
  aquaculture: "aquaculture-management",
  "aviation-safety": "aviation-management",
  "brand-management": "strategic-branding",
  "building-construction": "construction-management",
  "business-management": "business-administration",
  "child-development": "early-childhood-education",
  "computer-networking": "network-engineering",
  counseling: "professional-counseling",
  "culinary-arts": "culinary-management",
  "data-analysis": "data-analytics",
  "event-planning": "event-management",
  "financial-planning": "financial-management",
  hospitality: "hospitality-management",
  "human-resources": "hr-management",
  journalism: "broadcast-journalism",
  leadership: "executive-leadership",
  logistics: "logistics-management",
  nursing: "registered-nursing",
  nutrition: "clinical-nutrition",
  "quality-assurance": "quality-management",
  "renewable-energy": "renewable-energy-management",
  teaching: "montessori-teaching",
  tourism: "travel-tourism-management",
};

export function resolveContentId(id: string): string {
  return courseContentAliases[id] ?? id;
}