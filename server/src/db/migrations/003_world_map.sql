-- Phase 3: the frontend keeps a `map` object on the world (generated/uploaded image as a
-- data URL, plus its name and last mapgen params). Stored as a JSON blob on the world so the
-- bulk load/save round-trips the client DB shape without a separate upload step.
ALTER TABLE worlds ADD COLUMN map_data TEXT NOT NULL DEFAULT '{}';
