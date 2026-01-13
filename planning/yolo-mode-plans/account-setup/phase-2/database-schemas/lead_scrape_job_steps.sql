create table public.lead_scrape_job_steps (
  id uuid not null default extensions.uuid_generate_v4 (),
  job_id uuid not null,
  step_number integer not null,
  step_name text not null,
  step_description text null,
  step_type text not null default 'automatic'::text,
  status text not null default 'pending'::text,
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
  constraint lead_scrape_job_steps_unique_step unique (job_id, step_number),
  constraint lead_scrape_job_steps_job_id_fkey foreign KEY (job_id) references lead_scrape_jobs (id) on delete CASCADE,
  constraint lead_scrape_job_steps_status_check check (
    (
      status = any (
        array[
          'pending'::text,
          'in_progress'::text,
          'action_required'::text,
          'completed'::text,
          'failed'::text
        ]
      )
    )
  ),
  constraint lead_scrape_job_steps_type_check check (
    (
      step_type = any (array['automatic'::text, 'action_required'::text])
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_lead_scrape_job_steps_job_id on public.lead_scrape_job_steps using btree (job_id) TABLESPACE pg_default;

create index IF not exists idx_lead_scrape_job_steps_status on public.lead_scrape_job_steps using btree (status) TABLESPACE pg_default;

create index IF not exists idx_lead_scrape_job_steps_step_number on public.lead_scrape_job_steps using btree (step_number) TABLESPACE pg_default;

create trigger update_lead_scrape_job_steps_updated_at BEFORE
update on lead_scrape_job_steps for EACH row
execute FUNCTION update_updated_at_column ();