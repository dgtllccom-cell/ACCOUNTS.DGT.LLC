ALTER TYPE "public"."account_status" ADD VALUE 'pending_approval';--> statement-breakpoint
CREATE TABLE "daily_usd_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_id" uuid,
	"country_branch_id" uuid,
	"rate_date" date NOT NULL,
	"buying_rate" numeric(18, 8) NOT NULL,
	"selling_rate" numeric(18, 8) NOT NULL,
	"credit_rate" numeric(18, 8) NOT NULL,
	"debit_rate" numeric(18, 8) NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "erp_document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"bucket" text NOT NULL,
	"path" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erp_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"country_id" uuid,
	"city_branch_id" uuid,
	"name" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "goods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chs_code" text NOT NULL,
	"goods_name" text NOT NULL,
	"original_language_code" text DEFAULT 'en' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "goods_variations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goods_id" uuid NOT NULL,
	"origin_country_id" uuid,
	"size" text NOT NULL,
	"brand" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
DROP TABLE "chs_products" CASCADE;--> statement-breakpoint
ALTER TABLE "countries" ADD COLUMN "phone_code" text;--> statement-breakpoint
ALTER TABLE "daily_usd_rates" ADD CONSTRAINT "daily_usd_rates_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_usd_rates" ADD CONSTRAINT "daily_usd_rates_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_document_versions" ADD CONSTRAINT "erp_document_versions_document_id_erp_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."erp_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_document_versions" ADD CONSTRAINT "erp_document_versions_uploaded_by_profiles_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_documents" ADD CONSTRAINT "erp_documents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_documents" ADD CONSTRAINT "erp_documents_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_documents" ADD CONSTRAINT "erp_documents_city_branch_id_city_branches_id_fk" FOREIGN KEY ("city_branch_id") REFERENCES "public"."city_branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_documents" ADD CONSTRAINT "erp_documents_uploaded_by_profiles_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods" ADD CONSTRAINT "goods_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_variations" ADD CONSTRAINT "goods_variations_goods_id_goods_id_fk" FOREIGN KEY ("goods_id") REFERENCES "public"."goods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_variations" ADD CONSTRAINT "goods_variations_origin_country_id_countries_id_fk" FOREIGN KEY ("origin_country_id") REFERENCES "public"."countries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_variations" ADD CONSTRAINT "goods_variations_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "erp_document_versions_idx" ON "erp_document_versions" USING btree ("document_id","version_number");--> statement-breakpoint
CREATE INDEX "erp_documents_entity_idx" ON "erp_documents" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "goods_chs_code_idx" ON "goods" USING btree ("chs_code") WHERE "goods"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "goods_variations_unique_idx" ON "goods_variations" USING btree ("goods_id","origin_country_id","size","brand") WHERE "goods_variations"."deleted_at" is null;