/**
 * Shared types for the project_media subsystem.
 *
 * The "raw" row matches the project_media table 1:1. The "marketing"
 * row matches the marketing_project_media view, which adds project +
 * client context for the read path.
 */

export const MEDIA_PHASES = [
  "before",
  "during",
  "after",
  "detail",
  "reference",
] as const;
export type MediaPhase = (typeof MEDIA_PHASES)[number];

export const MEDIA_PHASE_LABEL: Record<MediaPhase, string> = {
  before: "Before",
  during: "During",
  after: "After",
  detail: "Detail / closeup",
  reference: "Reference / inspiration",
};

export type ProjectMedia = {
  id: string;
  project_id: string;
  storage_path: string;
  public_url: string;
  original_filename: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  phase: MediaPhase;
  is_marketing_eligible: boolean;
  is_hero: boolean;
  sort_order: number;
  caption: string | null;
  uploaded_by: string | null;
  created_at: string;
};

export type MarketingProjectMedia = ProjectMedia & {
  service_type: string | null;
  project_status: string | null;
  project_name: string | null;
  client_id: string | null;
  client_city: string | null;
  client_postal_code: string | null;
};
