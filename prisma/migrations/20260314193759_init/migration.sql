-- CreateEnum
CREATE TYPE "TonePref" AS ENUM ('playful', 'discreet', 'direct');

-- CreateEnum
CREATE TYPE "CoupleStatus" AS ENUM ('pending', 'active', 'dissolved');

-- CreateEnum
CREATE TYPE "CalendarProvider" AS ENUM ('google', 'ics_url');

-- CreateEnum
CREATE TYPE "CalendarConnectionStatus" AS ENUM ('active', 'expired', 'error');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('pending', 'accepted', 'declined', 'expired');

-- CreateEnum
CREATE TYPE "ProposalResponse" AS ENUM ('yes', 'no');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "tone_pref" "TonePref" NOT NULL DEFAULT 'discreet',
    "codename" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Stockholm',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "couples" (
    "id" UUID NOT NULL,
    "user_a_id" UUID NOT NULL,
    "user_b_id" UUID,
    "status" "CoupleStatus" NOT NULL DEFAULT 'pending',
    "invite_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dissolved_at" TIMESTAMP(3),

    CONSTRAINT "couples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "child_bedtime_weekday" TEXT NOT NULL,
    "child_bedtime_weekend" TEXT NOT NULL,
    "evening_end_weekday" TEXT NOT NULL,
    "evening_end_weekend" TEXT NOT NULL,
    "recurring_blocks" JSONB NOT NULL DEFAULT '[]',
    "general_rules" JSONB NOT NULL DEFAULT '[]',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle_data" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "last_period_start" DATE NOT NULL,
    "cycle_length_days" INTEGER NOT NULL DEFAULT 28,
    "period_length_days" INTEGER NOT NULL DEFAULT 5,
    "low_interest_start_day" INTEGER NOT NULL,
    "low_interest_end_day" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycle_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_connections" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "CalendarProvider" NOT NULL,
    "oauth_token" TEXT,
    "refresh_token" TEXT,
    "ics_url" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "status" "CalendarConnectionStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "calendar_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "is_available" BOOLEAN NOT NULL,
    "reason_code" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" UUID NOT NULL,
    "couple_id" UUID NOT NULL,
    "proposed_date" DATE NOT NULL,
    "proposed_time" TEXT NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'pending',
    "user_a_response" "ProposalResponse",
    "user_b_response" "ProposalResponse",
    "user_a_token" TEXT NOT NULL,
    "user_b_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_subscriptions" (
    "id" UUID NOT NULL,
    "couple_id" UUID NOT NULL,
    "webcal_token" TEXT NOT NULL,

    CONSTRAINT "calendar_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "couples_invite_token_key" ON "couples"("invite_token");

-- CreateIndex
CREATE UNIQUE INDEX "preferences_user_id_key" ON "preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "cycle_data_user_id_key" ON "cycle_data"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "availability_user_id_date_key" ON "availability"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_user_a_token_key" ON "proposals"("user_a_token");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_user_b_token_key" ON "proposals"("user_b_token");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_subscriptions_couple_id_key" ON "calendar_subscriptions"("couple_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_subscriptions_webcal_token_key" ON "calendar_subscriptions"("webcal_token");

-- AddForeignKey
ALTER TABLE "couples" ADD CONSTRAINT "couples_user_a_id_fkey" FOREIGN KEY ("user_a_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "couples" ADD CONSTRAINT "couples_user_b_id_fkey" FOREIGN KEY ("user_b_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_data" ADD CONSTRAINT "cycle_data_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability" ADD CONSTRAINT "availability_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "couples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_subscriptions" ADD CONSTRAINT "calendar_subscriptions_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "couples"("id") ON DELETE CASCADE ON UPDATE CASCADE;
