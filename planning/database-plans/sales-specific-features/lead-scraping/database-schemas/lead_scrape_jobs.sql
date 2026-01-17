create table public.lead_scrape_jobs (
  id uuid not null default extensions.uuid_generate_v4 (),
  name text not null,
  platform text not null,
  country text not null default 'nz'::text,
  city text null,
  city_code text null,
  region_code text null,
  cuisine text null,
  leads_limit integer not null default 21,
  page_offset integer null default 1,
  initial_url text null,
  status text not null default 'draft'::text,
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
  constraint lead_scrape_jobs_created_by_fkey foreign KEY (created_by) references auth.users (id),
  constraint lead_scrape_jobs_organisation_id_fkey foreign KEY (organisation_id) references organisations (id),
  constraint lead_scrape_jobs_leads_limit_check check (
    (
      (leads_limit > 0)
      and (leads_limit <= 999)
    )
  ),
  constraint lead_scrape_jobs_page_offset_check check (
    (
      (page_offset >= 1)
      and (page_offset <= 999)
    )
  ),
  constraint lead_scrape_jobs_status_check check (
    (
      status = any (
        array[
          'draft'::text,
          'pending'::text,
          'in_progress'::text,
          'completed'::text,
          'cancelled'::text,
          'failed'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_lead_scrape_jobs_status on public.lead_scrape_jobs using btree (status) TABLESPACE pg_default;

create index IF not exists idx_lead_scrape_jobs_platform on public.lead_scrape_jobs using btree (platform) TABLESPACE pg_default;

create index IF not exists idx_lead_scrape_jobs_city on public.lead_scrape_jobs using btree (city) TABLESPACE pg_default;

create index IF not exists idx_lead_scrape_jobs_cuisine on public.lead_scrape_jobs using btree (cuisine) TABLESPACE pg_default;

create index IF not exists idx_lead_scrape_jobs_org on public.lead_scrape_jobs using btree (organisation_id) TABLESPACE pg_default;

create index IF not exists idx_lead_scrape_jobs_created_at on public.lead_scrape_jobs using btree (created_at desc) TABLESPACE pg_default;

create trigger update_lead_scrape_jobs_updated_at BEFORE
update on lead_scrape_jobs for EACH row
execute FUNCTION update_updated_at_column ();