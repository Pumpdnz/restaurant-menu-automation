create table public.registration_batch_jobs (
  id uuid not null default extensions.uuid_generate_v4 (),
  name text not null,
  organisation_id uuid not null,
  source_lead_scrape_job_id uuid null,
  status text not null default 'pending'::text,
  execution_mode text not null default 'parallel'::text,
  total_restaurants integer null default 0,
  completed_restaurants integer null default 0,
  failed_restaurants integer null default 0,
  current_step integer null default 1,
  total_steps integer null default 6,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  started_at timestamp with time zone null,
  completed_at timestamp with time zone null,
  cancelled_at timestamp with time zone null,
  metadata jsonb null default '{}'::jsonb,
  constraint registration_batch_jobs_pkey primary key (id),
  constraint registration_batch_jobs_org_fk foreign KEY (organisation_id) references organisations (id),
  constraint registration_batch_jobs_source_job_fk foreign KEY (source_lead_scrape_job_id) references lead_scrape_jobs (id) on delete set null,
  constraint registration_batch_jobs_mode_check check (
    (
      execution_mode = any (array['sequential'::text, 'parallel'::text])
    )
  ),
  constraint registration_batch_jobs_status_check check (
    (
      status = any (
        array[
          'draft'::text,
          'pending'::text,
          'in_progress'::text,
          'completed'::text,
          'failed'::text,
          'cancelled'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_registration_batch_jobs_status on public.registration_batch_jobs using btree (status) TABLESPACE pg_default;

create index IF not exists idx_registration_batch_jobs_org on public.registration_batch_jobs using btree (organisation_id) TABLESPACE pg_default;

create index IF not exists idx_registration_batch_jobs_created_at on public.registration_batch_jobs using btree (created_at desc) TABLESPACE pg_default;

create index IF not exists idx_registration_batch_jobs_source_job on public.registration_batch_jobs using btree (source_lead_scrape_job_id) TABLESPACE pg_default;

create trigger update_registration_batch_jobs_updated_at BEFORE
update on registration_batch_jobs for EACH row
execute FUNCTION update_updated_at_column ();