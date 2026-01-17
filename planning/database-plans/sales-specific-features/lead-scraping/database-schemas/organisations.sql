create table public.organisations (
  id uuid not null default gen_random_uuid (),
  name text not null,
  stripe_customer_id text null,
  stripe_subscription_id text null,
  settings jsonb null default '{}'::jsonb,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  status text null default 'active'::text,
  feature_flags jsonb null default '{"csvDownload": {"enabled": true, "ratePerItem": 0.01}, "socialMedia": {"enabled": true}, "integrations": {"enabled": true, "cloudwaitressIntegration": {"enabled": true, "ratePerItem": 0.00}}, "leadScraping": {"enabled": true, "scrapeJobs": {"enabled": true, "ratePerItem": 1.00}, "leadConversion": {"enabled": true, "ratePerItem": 0.25}, "stepEnrichment": {"enabled": true, "ratePerItem": 0.05}}, "registration": {"enabled": true, "codeInjection": {"enabled": true, "ratePerItem": 0.00}, "menuUploading": {"enabled": true, "ratePerItem": 0.00}, "onboardingSync": {"enabled": false, "ratePerItem": 0.00}, "stripePayments": {"enabled": true, "ratePerItem": 0.00}, "finalisingSetup": {"enabled": true, "ratePerItem": 0.00}, "websiteSettings": {"enabled": true, "ratePerItem": 0.00}, "itemTagUploading": {"enabled": true, "ratePerItem": 0.00}, "optionSetUploading": {"enabled": true, "ratePerItem": 0.00}, "servicesConfiguration": {"enabled": true, "ratePerItem": 0.00}, "restaurantRegistration": {"enabled": true, "ratePerItem": 0.00}, "userAccountRegistration": {"enabled": true, "ratePerItem": 0.00}, "onboardingUserManagement": {"enabled": true, "ratePerItem": 0.00}}, "logoExtraction": {"enabled": true, "ratePerItem": 0.15}, "logoProcessing": {"enabled": true, "ratePerItem": 0.20}, "imageUploadToCDN": {"enabled": true, "ratePerItem": 0.001}, "imageZipDownload": {"enabled": true, "ratePerItem": 0.05}, "premiumExtraction": {"enabled": true, "ratePerItem": 0.25}, "tasksAndSequences": {"enabled": true}, "brandingExtraction": {"enabled": true, "firecrawlBranding": {"enabled": true, "ratePerItem": 0.20}}, "standardExtraction": {"enabled": true, "ratePerItem": 0.10}, "csvWithImagesDownload": {"enabled": true, "ratePerItem": 0.02}, "googleSearchExtraction": {"enabled": true, "ratePerItem": 0.05}, "platformDetailsExtraction": {"enabled": true, "ratePerItem": 0.05}}'::jsonb,
  billing_rates jsonb null default '{}'::jsonb,
  archived_at timestamp with time zone null,
  archived_by uuid null,
  constraint organisations_pkey primary key (id),
  constraint organisations_stripe_customer_id_key unique (stripe_customer_id),
  constraint organisations_archived_by_fkey foreign KEY (archived_by) references auth.users (id),
  constraint organisations_status_check check (
    (
      status = any (array['active'::text, 'archived'::text])
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_organisations_stripe on public.organisations using btree (stripe_customer_id) TABLESPACE pg_default;

create index IF not exists idx_organisations_status on public.organisations using btree (status) TABLESPACE pg_default;

create index IF not exists idx_organisations_archived_at on public.organisations using btree (archived_at) TABLESPACE pg_default;

create trigger update_organisations_updated_at BEFORE
update on organisations for EACH row
execute FUNCTION update_updated_at_column ();

create trigger validate_billing_rates BEFORE INSERT
or
update on organisations for EACH row
execute FUNCTION check_billing_rates_positive ();