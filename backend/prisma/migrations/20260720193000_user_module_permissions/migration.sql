-- AlterTable
ALTER TABLE "users" ADD COLUMN     "enabled_modules" TEXT[] DEFAULT ARRAY['villa', 'apartment']::TEXT[];

