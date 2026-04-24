CREATE TABLE "agent_behaviors" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"coach_key" text NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"directive" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"source" text DEFAULT 'manual',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agent_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text NOT NULL,
	"conversation_id" text,
	"task_type" text NOT NULL,
	"coach_key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"trigger_at" timestamp NOT NULL,
	"repeat_interval" text,
	"context" jsonb,
	"last_triggered_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "behavior_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"coach_key" text NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'proposed',
	"analysis" text NOT NULL,
	"proposed_directive" text NOT NULL,
	"source_feedback_ids" text,
	"created_at" timestamp DEFAULT now(),
	"reviewed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "coach_sessions" (
	"conversation_id" text NOT NULL,
	"coach_key" text NOT NULL,
	"session_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "coach_sessions_conversation_id_coach_key_unique" UNIQUE("conversation_id","coach_key")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text DEFAULT '' NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ea_memory" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text NOT NULL,
	"memory_type" text NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "ea_memory_user_id_project_id_key_unique" UNIQUE("user_id","project_id","key")
);
--> statement-breakpoint
CREATE TABLE "expert_bids" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"expert_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"bid_cents" integer NOT NULL,
	"estimated_hours" real,
	"note" text,
	"notified_at" timestamp,
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "expert_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"review_request_id" text NOT NULL,
	"conversation_id" text NOT NULL,
	"author_email" text NOT NULL,
	"author_name" text,
	"author_user_id" text,
	"content" text NOT NULL,
	"parent_message_id" integer,
	"created_at" timestamp DEFAULT now(),
	"delivery_status" text DEFAULT 'pending',
	"expert_rating" integer,
	"payout_status" text DEFAULT 'pending',
	"stripe_transfer_id" text
);
--> statement-breakpoint
CREATE TABLE "expert_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"bio" text,
	"domains" text NOT NULL,
	"rate_min_cents" integer DEFAULT 2500 NOT NULL,
	"rate_max_cents" integer DEFAULT 50000 NOT NULL,
	"stripe_connect_account_id" text,
	"stripe_connect_onboarded" boolean DEFAULT false,
	"is_active" boolean DEFAULT false,
	"is_founding_expert" boolean DEFAULT false,
	"platform_fee_rate" real DEFAULT 0.2,
	"average_rating" real,
	"total_reviews" integer DEFAULT 0,
	"acceptance_rate" real,
	"avg_delivery_hours" real,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "expert_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "expert_profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "knowledge_shares" (
	"id" text PRIMARY KEY NOT NULL,
	"source_project_id" text NOT NULL,
	"target_project_id" text NOT NULL,
	"collection_id" text,
	"shared_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "marketplace_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"conversation_id" text NOT NULL,
	"message_id" integer,
	"requester_user_id" text NOT NULL,
	"title" text NOT NULL,
	"question" text NOT NULL,
	"context_summary" text NOT NULL,
	"domain" text NOT NULL,
	"budget_cents" integer NOT NULL,
	"platform_fee_cents" integer,
	"expert_payout_cents" integer,
	"status" text DEFAULT 'open' NOT NULL,
	"award_window_hours" integer DEFAULT 4 NOT NULL,
	"awarded_at" timestamp,
	"awarded_expert_id" text,
	"delivery_deadline" timestamp,
	"stripe_payment_intent_id" text,
	"stripe_transfer_id" text,
	"expert_rating" integer,
	"expert_rating_note" text,
	"access_token" text,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	CONSTRAINT "marketplace_requests_access_token_unique" UNIQUE("access_token")
);
--> statement-breakpoint
CREATE TABLE "message_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" integer,
	"conversation_id" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"blob_url" text NOT NULL,
	"extracted_text" text,
	"file_size" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "message_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"conversation_id" text NOT NULL,
	"user_id" text NOT NULL,
	"coach_key" text,
	"mode" text,
	"rating" text NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"coach_key" text,
	"mode" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"conversation_id" text,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org_memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "org_memberships_org_id_user_id_unique" UNIQUE("org_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"company_name" text,
	"slug" text NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_price_id" text,
	"subscription_status" text DEFAULT 'inactive',
	"monthly_message_count" integer DEFAULT 0 NOT NULL,
	"monthly_message_reset_at" timestamp,
	"expert_review_credits" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "review_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"message_id" integer,
	"requester_user_id" text NOT NULL,
	"expert_email" text NOT NULL,
	"expert_user_id" text,
	"status" text DEFAULT 'pending',
	"context_summary" text,
	"question" text,
	"access_token" text,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"budget_cents" integer,
	"domain" text,
	"award_window_hours" integer DEFAULT 4,
	"awarded_expert_id" text,
	"platform_fee_cents" integer,
	"stripe_payment_intent_id" text,
	CONSTRAINT "review_requests_access_token_unique" UNIQUE("access_token")
);
--> statement-breakpoint
CREATE TABLE "tool_trust" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text NOT NULL,
	"tool_pattern" text NOT NULL,
	"trust_level" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "tool_trust_user_id_project_id_tool_pattern_unique" UNIQUE("user_id","project_id","tool_pattern")
);
--> statement-breakpoint
CREATE TABLE "usage_events" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text NOT NULL,
	"event_type" text NOT NULL,
	"metadata" jsonb,
	"billing_period" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text NOT NULL,
	"provider" text DEFAULT 'anthropic' NOT NULL,
	"encrypted_key" text NOT NULL,
	"key_hint" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "coach_sessions" ADD CONSTRAINT "coach_sessions_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expert_bids" ADD CONSTRAINT "expert_bids_request_id_marketplace_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."marketplace_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expert_bids" ADD CONSTRAINT "expert_bids_expert_id_expert_profiles_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."expert_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expert_comments" ADD CONSTRAINT "expert_comments_review_request_id_review_requests_id_fk" FOREIGN KEY ("review_request_id") REFERENCES "public"."review_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expert_comments" ADD CONSTRAINT "expert_comments_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_requests" ADD CONSTRAINT "marketplace_requests_awarded_expert_id_expert_profiles_id_fk" FOREIGN KEY ("awarded_expert_id") REFERENCES "public"."expert_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_feedback" ADD CONSTRAINT "message_feedback_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_memberships" ADD CONSTRAINT "org_memberships_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_api_keys" ADD CONSTRAINT "user_api_keys_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;