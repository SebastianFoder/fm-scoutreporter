/**
 * FM view files (.fmf) served from /public, shared by server and client components.
 * Both export the same attributes; the Hidden Attributes view adds Professionalism, CA and PA.
 */
export const VIEW_STANDARD = {
  name: "Standard view",
  href: "/SCOUT%20REPORTER%20Standard.fmf",
  summary: "All visible player attributes.",
} as const;

/** Staff search view: every FM26 staff attribute plus job, club and personality. Used by Staff mode. */
export const VIEW_STAFF = {
  name: "Staff view",
  href: "/SCOUT%20REPORTER%20Staff.fmf",
  summary: "Every staff attribute, preferred job, club and personality. For Staff mode.",
} as const;

export const VIEW_HIDDEN = {
  name: "Hidden Attributes view",
  href: "/SCOUT%20REPORTER%20Hidden%20Attributes.fmf",
  summary: "Standard view plus the hidden Professionalism, CA and PA.",
} as const;
