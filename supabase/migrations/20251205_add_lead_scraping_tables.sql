-- Migration: Add Lead Scraping Tables
-- Description: Creates tables for lead scraping feature
-- Date: 2025-12-05

-- ============================================================================
-- 1. CREATE LEAD_SCRAPE_JOBS TABLE
-- ============================================================================
create table if not exists public.lead_scrape_jobs (
  id uuid not null default extensions.uuid_generate_v4(),
  name text not null,
  platform text not null,
  country text not null default 'nz',
  city text null,
  city_code text null,
  region_code text null,
  cuisine text null,
  leads_limit integer not null default 21,
  page_offset integer null default 1,
  initial_url text null,
  status text not null default 'draft',
  current_step integer null default 0,
  total_steps integer null,
  leads_extracted integer null default 0,
  leads_passed integer null default 0,
  leads_failed integer null default 0,
  organisation_id uuid null,
  created_by uuid null,
  started_at timestamp with time zone null,
  completed_at timestamp with time zone null,
  cancelled_at timestamp with time zone null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  metadata jsonb null default '{}'::jsonb,

  constraint lead_scrape_jobs_pkey primary key (id),
  constraint lead_scrape_jobs_created_by_fkey foreign key (created_by) references auth.users (id),
  constraint lead_scrape_jobs_organisation_id_fkey foreign key (organisation_id) references organisations (id),
  constraint lead_scrape_jobs_status_check check (
    status = any (array[
      'draft'::text,
      'pending'::text,
      'in_progress'::text,
      'completed'::text,
      'cancelled'::text,
      'failed'::text
    ])
  ),
  constraint lead_scrape_jobs_leads_limit_check check (leads_limit > 0 and leads_limit <= 999),
  constraint lead_scrape_jobs_page_offset_check check (page_offset >= 1 and page_offset <= 999)
);

-- Indexes for lead_scrape_jobs
create index if not exists idx_lead_scrape_jobs_status on public.lead_scrape_jobs using btree (status);
create index if not exists idx_lead_scrape_jobs_platform on public.lead_scrape_jobs using btree (platform);
create index if not exists idx_lead_scrape_jobs_city on public.lead_scrape_jobs using btree (city);
create index if not exists idx_lead_scrape_jobs_cuisine on public.lead_scrape_jobs using btree (cuisine);
create index if not exists idx_lead_scrape_jobs_org on public.lead_scrape_jobs using btree (organisation_id);
create index if not exists idx_lead_scrape_jobs_created_at on public.lead_scrape_jobs using btree (created_at desc);

-- Trigger for updated_at
drop trigger if exists update_lead_scrape_jobs_updated_at on lead_scrape_jobs;
create trigger update_lead_scrape_jobs_updated_at
  before update on lead_scrape_jobs
  for each row execute function update_updated_at_column();


-- ============================================================================
-- 2. CREATE LEAD_SCRAPE_JOB_STEPS TABLE
-- ============================================================================
create table if not exists public.lead_scrape_job_steps (
  id uuid not null default extensions.uuid_generate_v4(),
  job_id uuid not null,
  step_number integer not null,
  step_name text not null,
  step_description text null,
  step_type text not null default 'automatic',
  status text not null default 'pending',
  target_url_template text null,
  leads_received integer null default 0,
  leads_processed integer null default 0,
  leads_passed integer null default 0,
  leads_failed integer null default 0,
  started_at timestamp with time zone null,
  completed_at timestamp with time zone null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  metadata jsonb null default '{}'::jsonb,
  error_message text null,

  constraint lead_scrape_job_steps_pkey primary key (id),
  constraint lead_scrape_job_steps_job_id_fkey foreign key (job_id)
    references lead_scrape_jobs (id) on delete cascade,
  constraint lead_scrape_job_steps_unique_step unique (job_id, step_number),
  constraint lead_scrape_job_steps_status_check check (
    status = any (array[
      'pending'::text,
      'in_progress'::text,
      'action_required'::text,
      'completed'::text,
      'failed'::text
    ])
  ),
  constraint lead_scrape_job_steps_type_check check (
    step_type = any (array[
      'automatic'::text,
      'action_required'::text
    ])
  )
);

-- Indexes for lead_scrape_job_steps
create index if not exists idx_lead_scrape_job_steps_job_id on public.lead_scrape_job_steps using btree (job_id);
create index if not exists idx_lead_scrape_job_steps_status on public.lead_scrape_job_steps using btree (status);
create index if not exists idx_lead_scrape_job_steps_step_number on public.lead_scrape_job_steps using btree (step_number);

-- Trigger for updated_at
drop trigger if exists update_lead_scrape_job_steps_updated_at on lead_scrape_job_steps;
create trigger update_lead_scrape_job_steps_updated_at
  before update on lead_scrape_job_steps
  for each row execute function update_updated_at_column();


-- ============================================================================
-- 3. CREATE LEADS TABLE
-- ============================================================================
create table if not exists public.leads (
  id uuid not null default extensions.uuid_generate_v4(),
  lead_scrape_job_id uuid not null,
  current_step integer not null default 1,
  step_progression_status text not null default 'available',

  -- Step 1: Initial extraction data
  restaurant_name text not null,
  store_link text null,

  -- Step 2: UberEats store page data
  ubereats_number_of_reviews text null,
  ubereats_average_review_rating numeric(3,1) null,
  ubereats_address text null,
  ubereats_cuisine text[] null,
  ubereats_price_rating integer null,

  -- Google Business Profile data
  google_number_of_reviews text null,
  google_average_review_rating numeric(3,1) null,
  google_address text null,

  -- Step 3+: Contact and business enrichment data
  phone text null,
  email text null,
  website_url text null,
  instagram_url text null,
  facebook_url text null,
  google_maps_url text null,
  contact_name text null,
  contact_email text null,
  contact_phone text null,
  contact_role text null,

  -- Business details
  organisation_name text null,
  number_of_venues integer null,
  city text null,
  region text null,
  country text null default 'nz',
  opening_hours jsonb null,
  opening_hours_text text null,
  website_type text null,

  -- Platform metadata
  platform text null,
  online_ordering_platform text null,
  online_ordering_handles_delivery boolean null,

  -- Tracking fields
  is_duplicate boolean null default false,
  duplicate_of_lead_id uuid null,
  duplicate_of_restaurant_id uuid null,
  validation_errors jsonb null default '[]'::jsonb,
  is_valid boolean null default true,

  -- Conversion tracking
  converted_to_restaurant_id uuid null,
  converted_at timestamp with time zone null,
  converted_by uuid null,

  -- Timestamps
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),

  -- Extra metadata
  metadata jsonb null default '{}'::jsonb,

  constraint leads_pkey primary key (id),
  constraint leads_lead_scrape_job_id_fkey foreign key (lead_scrape_job_id)
    references lead_scrape_jobs (id) on delete cascade,
  constraint leads_converted_to_restaurant_id_fkey foreign key (converted_to_restaurant_id)
    references restaurants (id),
  constraint leads_converted_by_fkey foreign key (converted_by)
    references auth.users (id),
  constraint leads_duplicate_of_lead_id_fkey foreign key (duplicate_of_lead_id)
    references leads (id),
  constraint leads_duplicate_of_restaurant_id_fkey foreign key (duplicate_of_restaurant_id)
    references restaurants (id),
  constraint leads_step_progression_status_check check (
    step_progression_status = any (array[
      'available'::text,
      'processing'::text,
      'processed'::text,
      'passed'::text,
      'failed'::text
    ])
  ),
  constraint leads_ubereats_average_review_rating_check check (
    ubereats_average_review_rating is null or
    (ubereats_average_review_rating >= 0 and ubereats_average_review_rating <= 5)
  ),
  constraint leads_google_average_review_rating_check check (
    google_average_review_rating is null or
    (google_average_review_rating >= 0 and google_average_review_rating <= 5)
  ),
  constraint leads_ubereats_price_rating_check check (
    ubereats_price_rating is null or
    (ubereats_price_rating >= 1 and ubereats_price_rating <= 4)
  ),
  constraint leads_number_of_venues_check check (
    (number_of_venues is null) or (number_of_venues > 0)
  ),
  constraint leads_website_type_check check (
    (website_type is null) or (
      website_type = any (
        array['platform_subdomain'::text, 'custom_domain'::text]
      )
    )
  )
);

-- Indexes for leads
create index if not exists idx_leads_job_id on public.leads using btree (lead_scrape_job_id);
create index if not exists idx_leads_current_step on public.leads using btree (current_step);
create index if not exists idx_leads_progression_status on public.leads using btree (step_progression_status);
create index if not exists idx_leads_restaurant_name on public.leads using btree (restaurant_name);
create index if not exists idx_leads_city on public.leads using btree (city);
create index if not exists idx_leads_platform on public.leads using btree (platform);
create index if not exists idx_leads_is_duplicate on public.leads using btree (is_duplicate);
create index if not exists idx_leads_converted on public.leads using btree (converted_to_restaurant_id);
create index if not exists idx_leads_created_at on public.leads using btree (created_at desc);
create index if not exists idx_leads_job_step on public.leads using btree (lead_scrape_job_id, current_step);

-- Full text search index for restaurant name
create index if not exists idx_leads_restaurant_name_search on public.leads
  using gin (to_tsvector('english', restaurant_name));

-- Trigger for updated_at
drop trigger if exists update_leads_updated_at on leads;
create trigger update_leads_updated_at
  before update on leads
  for each row execute function update_updated_at_column();


-- ============================================================================
-- 4. CREATE CITY_CODES REFERENCE TABLE
-- ============================================================================
create table if not exists public.city_codes (
  id uuid not null default extensions.uuid_generate_v4(),
  country text not null default 'nz',
  city_name text not null,
  city_code text not null,
  region_code text not null,
  ubereats_slug text not null,
  is_active boolean default true,

  constraint city_codes_pkey primary key (id),
  constraint city_codes_city_country_unique unique (city_name, country)
);

-- Indexes for city_codes
create index if not exists idx_city_codes_country on public.city_codes using btree (country);
create index if not exists idx_city_codes_region_code on public.city_codes using btree (region_code);


-- ============================================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ============================================================================
alter table public.lead_scrape_jobs enable row level security;
alter table public.lead_scrape_job_steps enable row level security;
alter table public.leads enable row level security;
alter table public.city_codes enable row level security;


-- ============================================================================
-- 6. CREATE RLS POLICIES
-- ============================================================================

-- Policies for lead_scrape_jobs
drop policy if exists "Users can view their org's scrape jobs" on public.lead_scrape_jobs;
create policy "Users can view their org's scrape jobs" on public.lead_scrape_jobs
  for select using (organisation_id = (auth.jwt() ->> 'org_id')::uuid);

drop policy if exists "Users can create scrape jobs for their org" on public.lead_scrape_jobs;
create policy "Users can create scrape jobs for their org" on public.lead_scrape_jobs
  for insert with check (organisation_id = (auth.jwt() ->> 'org_id')::uuid);

drop policy if exists "Users can update their org's scrape jobs" on public.lead_scrape_jobs;
create policy "Users can update their org's scrape jobs" on public.lead_scrape_jobs
  for update using (organisation_id = (auth.jwt() ->> 'org_id')::uuid);

drop policy if exists "Users can delete their org's scrape jobs" on public.lead_scrape_jobs;
create policy "Users can delete their org's scrape jobs" on public.lead_scrape_jobs
  for delete using (organisation_id = (auth.jwt() ->> 'org_id')::uuid);

-- Policies for lead_scrape_job_steps (inherited from parent job)
drop policy if exists "Users can view steps for their org's jobs" on public.lead_scrape_job_steps;
create policy "Users can view steps for their org's jobs" on public.lead_scrape_job_steps
  for select using (
    exists (
      select 1 from lead_scrape_jobs
      where id = lead_scrape_job_steps.job_id
      and organisation_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );

drop policy if exists "Users can manage steps for their org's jobs" on public.lead_scrape_job_steps;
create policy "Users can manage steps for their org's jobs" on public.lead_scrape_job_steps
  for all using (
    exists (
      select 1 from lead_scrape_jobs
      where id = lead_scrape_job_steps.job_id
      and organisation_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );

-- Policies for leads (inherited from parent job)
drop policy if exists "Users can view leads for their org's jobs" on public.leads;
create policy "Users can view leads for their org's jobs" on public.leads
  for select using (
    exists (
      select 1 from lead_scrape_jobs
      where id = leads.lead_scrape_job_id
      and organisation_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );

drop policy if exists "Users can manage leads for their org's jobs" on public.leads;
create policy "Users can manage leads for their org's jobs" on public.leads
  for all using (
    exists (
      select 1 from lead_scrape_jobs
      where id = leads.lead_scrape_job_id
      and organisation_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );

-- City codes are readable by all authenticated users
drop policy if exists "City codes are readable by authenticated users" on public.city_codes;
create policy "City codes are readable by authenticated users" on public.city_codes
  for select to authenticated using (true);


-- ============================================================================
-- 7. GRANT PERMISSIONS (for service role access)
-- ============================================================================
grant all on public.lead_scrape_jobs to authenticated;
grant all on public.lead_scrape_jobs to service_role;
grant all on public.lead_scrape_job_steps to authenticated;
grant all on public.lead_scrape_job_steps to service_role;
grant all on public.leads to authenticated;
grant all on public.leads to service_role;
grant select on public.city_codes to authenticated;
grant all on public.city_codes to service_role;
