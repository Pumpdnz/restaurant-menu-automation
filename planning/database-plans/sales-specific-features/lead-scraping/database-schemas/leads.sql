create table public.leads (
  id uuid not null default extensions.uuid_generate_v4 (),
  lead_scrape_job_id uuid not null,
  current_step integer not null default 1,
  step_progression_status text not null default 'available'::text,
  restaurant_name text not null,
  store_link text null,
  ubereats_number_of_reviews text null,
  ubereats_average_review_rating numeric(3, 1) null,
  ubereats_address text null,
  ubereats_cuisine text[] null,
  ubereats_price_rating integer null,
  google_number_of_reviews text null,
  google_average_review_rating numeric(3, 1) null,
  google_address text null,
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
  organisation_name text null,
  number_of_venues integer null,
  city text null,
  region text null,
  country text null default 'nz'::text,
  opening_hours jsonb null,
  opening_hours_text text null,
  website_type text null,
  platform text null,
  online_ordering_platform text null,
  online_ordering_handles_delivery boolean null,
  is_duplicate boolean null default false,
  duplicate_of_lead_id uuid null,
  duplicate_of_restaurant_id uuid null,
  validation_errors jsonb null default '[]'::jsonb,
  is_valid boolean null default true,
  converted_to_restaurant_id uuid null,
  converted_at timestamp with time zone null,
  converted_by uuid null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  metadata jsonb null default '{}'::jsonb,
  ordering_platform_url text null,
  ordering_platform_name text null,
  ordering_source text null,
  organisation_id uuid not null,
  ubereats_og_image text null,
  constraint leads_pkey primary key (id),
  constraint leads_duplicate_of_restaurant_id_fkey foreign KEY (duplicate_of_restaurant_id) references restaurants (id),
  constraint leads_organisation_id_fkey foreign KEY (organisation_id) references organisations (id),
  constraint leads_lead_scrape_job_id_fkey foreign KEY (lead_scrape_job_id) references lead_scrape_jobs (id) on delete CASCADE,
  constraint leads_converted_by_fkey foreign KEY (converted_by) references auth.users (id),
  constraint leads_duplicate_of_lead_id_fkey foreign KEY (duplicate_of_lead_id) references leads (id),
  constraint leads_converted_to_restaurant_id_fkey foreign KEY (converted_to_restaurant_id) references restaurants (id),
  constraint leads_website_type_check check (
    (
      (website_type is null)
      or (
        website_type = any (
          array['platform_subdomain'::text, 'custom_domain'::text]
        )
      )
    )
  ),
  constraint leads_google_average_review_rating_check check (
    (
      (google_average_review_rating is null)
      or (
        (google_average_review_rating >= (0)::numeric)
        and (google_average_review_rating <= (5)::numeric)
      )
    )
  ),
  constraint leads_number_of_venues_check check (
    (
      (number_of_venues is null)
      or (number_of_venues > 0)
    )
  ),
  constraint leads_step_progression_status_check check (
    (
      step_progression_status = any (
        array[
          'available'::text,
          'processing'::text,
          'processed'::text,
          'passed'::text,
          'failed'::text
        ]
      )
    )
  ),
  constraint leads_ubereats_average_review_rating_check check (
    (
      (ubereats_average_review_rating is null)
      or (
        (ubereats_average_review_rating >= (0)::numeric)
        and (ubereats_average_review_rating <= (5)::numeric)
      )
    )
  ),
  constraint leads_ubereats_price_rating_check check (
    (
      (ubereats_price_rating is null)
      or (
        (ubereats_price_rating >= 1)
        and (ubereats_price_rating <= 4)
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_leads_job_id on public.leads using btree (lead_scrape_job_id) TABLESPACE pg_default;

create index IF not exists idx_leads_current_step on public.leads using btree (current_step) TABLESPACE pg_default;

create index IF not exists idx_leads_progression_status on public.leads using btree (step_progression_status) TABLESPACE pg_default;

create index IF not exists idx_leads_restaurant_name on public.leads using btree (restaurant_name) TABLESPACE pg_default;

create index IF not exists idx_leads_city on public.leads using btree (city) TABLESPACE pg_default;

create index IF not exists idx_leads_platform on public.leads using btree (platform) TABLESPACE pg_default;

create index IF not exists idx_leads_is_duplicate on public.leads using btree (is_duplicate) TABLESPACE pg_default;

create index IF not exists idx_leads_converted on public.leads using btree (converted_to_restaurant_id) TABLESPACE pg_default;

create index IF not exists idx_leads_created_at on public.leads using btree (created_at desc) TABLESPACE pg_default;

create index IF not exists idx_leads_job_step on public.leads using btree (lead_scrape_job_id, current_step) TABLESPACE pg_default;

create index IF not exists idx_leads_restaurant_name_search on public.leads using gin (
  to_tsvector('english'::regconfig, restaurant_name)
) TABLESPACE pg_default;

create index IF not exists idx_leads_org_store_link on public.leads using btree (organisation_id, store_link) TABLESPACE pg_default;

create trigger update_leads_updated_at BEFORE
update on leads for EACH row
execute FUNCTION update_updated_at_column ();