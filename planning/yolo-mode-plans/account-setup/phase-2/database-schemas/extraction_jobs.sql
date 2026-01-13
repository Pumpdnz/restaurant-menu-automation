create table public.extraction_jobs (
  id uuid not null default extensions.uuid_generate_v4 (),
  job_id character varying(100) not null,
  restaurant_id uuid null,
  platform_id uuid null,
  url text not null,
  job_type character varying(50) not null,
  status character varying(50) not null default 'pending'::character varying,
  progress jsonb null default '{}'::jsonb,
  config jsonb null default '{}'::jsonb,
  error text null,
  started_at timestamp with time zone null,
  completed_at timestamp with time zone null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  organisation_id uuid null,
  constraint extraction_jobs_pkey primary key (id),
  constraint extraction_jobs_job_id_key unique (job_id),
  constraint extraction_jobs_organisation_id_fkey foreign KEY (organisation_id) references organisations (id),
  constraint extraction_jobs_platform_id_fkey foreign KEY (platform_id) references platforms (id),
  constraint extraction_jobs_restaurant_id_fkey foreign KEY (restaurant_id) references restaurants (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_extraction_jobs_status on public.extraction_jobs using btree (status) TABLESPACE pg_default;

create index IF not exists idx_extraction_jobs_restaurant on public.extraction_jobs using btree (restaurant_id) TABLESPACE pg_default;

create index IF not exists idx_extraction_jobs_org on public.extraction_jobs using btree (organisation_id) TABLESPACE pg_default;

create trigger update_extraction_jobs_updated_at BEFORE
update on extraction_jobs for EACH row
execute FUNCTION update_updated_at_column ();