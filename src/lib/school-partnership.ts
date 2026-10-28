export const PARTNERSHIP_VISIT = { representatives: 2, discussionMinutes: 10 } as const;
export const PARTNERSHIP_STEPS = [
  { key: "outreach_sent", label: "Initial email sent" },
  { key: "favorable_feedback", label: "School expressed interest" },
  { key: "credentials_handed_over", label: "Credentials handed to School Head" },
  { key: "meeting_completed", label: "Two-representative visit, 10-minute discussion and demonstrations completed" },
  { key: "terms_accepted", label: "Terms accepted and agreement signed by School Head" },
  { key: "certificate_handed_over", label: "Partnership certificate handed over" },
  { key: "manual_handed_over", label: "School-admin manual handed over" },
] as const;
export type PartnershipStep = (typeof PARTNERSHIP_STEPS)[number]["key"];
export type PartnershipInput = { schoolId: string; field: PartnershipStep; checked: boolean };
export function validatePartnershipInput(input: PartnershipInput): PartnershipInput {
  if (!input || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.schoolId)) throw new Error("Select a valid school.");
  if (!PARTNERSHIP_STEPS.some((step) => step.key === input.field) || typeof input.checked !== "boolean") throw new Error("Invalid partnership update.");
  return { schoolId: input.schoolId, field: input.field, checked: input.checked };
}