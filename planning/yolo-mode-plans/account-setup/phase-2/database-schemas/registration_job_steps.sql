create table public.registration_job_steps (
  id uuid not null default extensions.uuid_generate_v4 (),
  job_id uuid not null,
  step_number integer not null,
  step_name text not null,
  step_description text null,
  step_type text not null default 'automatic'::text,
  status text not null default 'pending'::text,
  sub_step_progress jsonb null default '{}'::jsonb,
  started_at timestamp with time zone null,
  completed_at timestamp with time zone null,
  duration_ms integer null,
  error_message text null,
  error_details jsonb null,
  retry_count integer null default 0,
  max_retries integer null default 3,
  result_data jsonb null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  metadata jsonb null default '{}'::jsonb,
  constraint registration_job_steps_pkey primary key (id),
  constraint registration_job_steps_unique unique (job_id, step_number),
  constraint registration_job_steps_job_fk foreign KEY (job_id) references registration_jobs (id) on delete CASCADE,
  constraint registration_job_steps_status_check check (
    (
      status = any (
        array[
          'pending'::text,
          'in_progress'::text,
          'action_required'::text,
          'completed'::text,
          'failed'::text,
          'skipped'::text,
          'retrying'::text
        ]
      )
    )
  ),
  constraint registration_job_steps_step_range check (
    (
      (step_number >= 1)
      and (step_number <= 6)
    )
  ),
  constraint registration_job_steps_type_check check (
    (
      step_type = any (array['automatic'::text, 'action_required'::text])
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_registration_job_steps_job on public.registration_job_steps using btree (job_id) TABLESPACE pg_default;

create index IF not exists idx_registration_job_steps_status on public.registration_job_steps using btree (status) TABLESPACE pg_default;

create index IF not exists idx_registration_job_steps_step_number on public.registration_job_steps using btree (step_number) TABLESPACE pg_default;

create trigger update_registration_job_steps_updated_at BEFORE
update on registration_job_steps for EACH row
execute FUNCTION update_updated_at_column ();