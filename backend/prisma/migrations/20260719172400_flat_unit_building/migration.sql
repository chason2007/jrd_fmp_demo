-- AlterTable villas: rename property_number to flat_number, add unit_number and building_name
ALTER TABLE "villas" RENAME COLUMN "property_number" TO "flat_number";
ALTER TABLE "villas" ADD COLUMN "unit_number" VARCHAR(100);
ALTER TABLE "villas" ADD COLUMN "building_name" VARCHAR(100);

-- Rename unique index on villas
ALTER INDEX "villas_property_number_key" RENAME TO "villas_flat_number_key";

-- AlterTable inspection_drafts: rename property_number to flat_number, add unit_number and building_name
ALTER TABLE "inspection_drafts" RENAME COLUMN "property_number" TO "flat_number";
ALTER TABLE "inspection_drafts" ADD COLUMN "unit_number" VARCHAR(100);
ALTER TABLE "inspection_drafts" ADD COLUMN "building_name" VARCHAR(100);
