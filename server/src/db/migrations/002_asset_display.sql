-- Phase 2: image pipeline produces three tiers per upload so clients (especially
-- mobile/cellular) can fetch a small thumbnail or a bounded display image instead of
-- the full-resolution original.
--   file_path    -> original bytes, stored as uploaded (export fidelity)
--   display_path -> re-encoded webp bounded to CODEX_IMAGE_MAX_DIM (detail views)
--   thumb_path   -> re-encoded webp bounded to CODEX_THUMB_DIM (card grids, lists)
ALTER TABLE assets ADD COLUMN display_path TEXT;

-- Original upload metadata, kept alongside the derived webp dims already in width/height.
ALTER TABLE assets ADD COLUMN orig_mime TEXT NOT NULL DEFAULT 'image/webp';
