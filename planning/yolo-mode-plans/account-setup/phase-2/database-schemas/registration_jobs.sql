create table public.registration_jobs (
  id uuid not null default extensions.uuid_generate_v4 (),
  batch_job_id uuid not null,
  restaurant_id uuid not null,
  organisation_id uuid not null,
  status text not null default 'pending'::text,
  current_step integer null default 1,
  total_steps integer null default 6,
  execution_config jsonb not null default '{}'::jsonb,
  pumpd_user_id uuid null,
  pumpd_restaurant_id uuid null,
  execution_results jsonb null default '{}'::jsonb,
  error_message text null,
  last_error_details jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  started_at timestamp with time zone null,
  completed_at timestamp with time zone null,
  metadata jsonb null default '{}'::jsonb,
  constraint registration_jobs_pkey primary key (id),
  constraint registration_jobs_unique_restaurant_batch unique (batch_job_id, restaurant_id),
  constraint registration_jobs_batch_fk foreign KEY (batch_job_id) references registration_batch_jobs (id) on delete CASCADE,
  constraint registration_jobs_org_fk foreign KEY (organisation_id) references organisations (id),
  constraint registration_jobs_restaurant_fk foreign KEY (restaurant_id) references restaurants (id) on delete CASCADE,
  constraint registration_jobs_status_check check (
    (
      status = any (
        array[
          'pending'::text,
          'in_progress'::text,
          'completed'::text,
          'failed'::text,
          'cancelled'::text,
          'skipped'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_registration_jobs_batch on public.registration_jobs using btree (batch_job_id) TABLESPACE pg_default;

create index IF not exists idx_registration_jobs_restaurant on public.registration_jobs using btree (restaurant_id) TABLESPACE pg_default;

create index IF not exists idx_registration_jobs_status on public.registration_jobs using btree (status) TABLESPACE pg_default;

create index IF not exists idx_registration_jobs_org on public.registration_jobs using btree (organisation_id) TABLESPACE pg_default;

create trigger update_registration_jobs_updated_at BEFORE
update on registration_jobs for EACH row
execute FUNCTION update_updated_at_column ();