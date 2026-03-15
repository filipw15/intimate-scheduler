-- AlterTable: add user_id column (nullable first so existing rows don't break)
ALTER TABLE "calendar_subscriptions" ADD COLUMN "user_id" UUID;

-- Drop the unique constraint on couple_id (now multiple rows per couple are allowed)
DROP INDEX "calendar_subscriptions_couple_id_key";

-- Populate user_id from couple's user_a for any existing rows
UPDATE "calendar_subscriptions" cs
SET "user_id" = c."user_a_id"
FROM "couples" c
WHERE cs."couple_id" = c."id";

-- Make user_id NOT NULL
ALTER TABLE "calendar_subscriptions" ALTER COLUMN "user_id" SET NOT NULL;

-- Add unique index on user_id (one subscription per user)
CREATE UNIQUE INDEX "calendar_subscriptions_user_id_key" ON "calendar_subscriptions"("user_id");

-- Add FK constraint
ALTER TABLE "calendar_subscriptions" ADD CONSTRAINT "calendar_subscriptions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
