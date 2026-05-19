CREATE TABLE "ai_tools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"vendor" text,
	"url" text,
	"description" text,
	"capabilities" text[] NOT NULL,
	"source_trust" text DEFAULT 'seed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alchemy_scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_ids" uuid[] NOT NULL,
	"matched_pattern_ids" uuid[] NOT NULL,
	"narrative" text NOT NULL,
	"emergent_capabilities" text[] NOT NULL,
	"mitigations" jsonb NOT NULL,
	"saif_controls" text[] NOT NULL,
	"confidence" numeric(3, 2) NOT NULL,
	"decision_record_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "capability_synergies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"required_capabilities" text[] NOT NULL,
	"emergent_threat" text NOT NULL,
	"risk_multiplier" numeric(3, 2) NOT NULL,
	"saif_controls" text[] NOT NULL,
	"rationale" text NOT NULL,
	"source" text DEFAULT 'curated' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decision_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_name" text NOT NULL,
	"prompt_version" text NOT NULL,
	"model_id" text NOT NULL,
	"model_params" jsonb NOT NULL,
	"input_hash" text NOT NULL,
	"output_hash" text NOT NULL,
	"retrieval_sources" jsonb,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"cost_usd" numeric(10, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_synergy_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposed_synergy" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewer_notes" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alchemy_scenarios" ADD CONSTRAINT "alchemy_scenarios_decision_record_id_decision_records_id_fk" FOREIGN KEY ("decision_record_id") REFERENCES "public"."decision_records"("id") ON DELETE no action ON UPDATE no action;