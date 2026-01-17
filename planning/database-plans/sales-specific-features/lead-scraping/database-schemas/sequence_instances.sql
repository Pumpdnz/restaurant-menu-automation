create table public.sequence_instances (
  id uuid not null default extensions.uuid_generate_v4 (),
  sequence_template_id uuid not null,
  restaurant_id uuid not null,
  organisation_id uuid not null,
  name text not null,
  status text not null default 'active'::text,
  current_step_order integer null default 1,
  total_steps integer not null,
  assigned_to uuid null,
  created_by uuid null,
  started_at timestamp with time zone not null default now(),
  paused_at timestamp with time zone null,
  completed_at timestamp with time zone null,
  cancelled_at timestamp with time zone null,
  metadata jsonb null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint sequence_instances_pkey primary key (id),
  constraint sequence_instances_restaurant_id_fkey foreign KEY (restaurant_id) references restaurants (id) on delete CASCADE,
  constraint sequence_instances_sequence_template_id_fkey foreign KEY (sequence_template_id) references sequence_templates (id) on delete CASCADE,
  constraint sequence_instances_organisation_id_fkey foreign KEY (organisation_id) references organisations (id) on delete CASCADE,
  constraint sequence_instances_assigned_to_fkey foreign KEY (assigned_to) references auth.users (id) on delete set null,
  constraint sequence_instances_created_by_fkey foreign KEY (created_by) references auth.users (id) on delete set null,
  constraint sequence_instances_total_steps_check check ((total_steps > 0)),
  constraint sequence_instances_cancelled_check check (
    (
      (
        (status = 'cancelled'::text)
        and (cancelled_at is not null)
      )
      or (
        (status <> 'cancelled'::text)
        and (cancelled_at is null)
      )
    )
  ),
  constraint sequence_instances_completed_check check (
    (
      (
        (status = 'completed'::text)
        and (completed_at is not null)
      )
      or (
        (status <> 'completed'::text)
        and (completed_at is null)
      )
    )
  ),
  constraint sequence_instances_paused_check check (
    (
      (
        (status = 'paused'::text)
        and (paused_at is not null)
      )
      or (
        (status <> 'paused'::text)
        and (paused_at is null)
      )
    )
  ),
  constraint sequence_instances_status_check check (
    (
      status = any (
        array[
          'active'::text,
          'paused'::text,
          'completed'::text,
          'cancelled'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_sequence_instances_template on public.sequence_instances using btree (sequence_template_id) TABLESPACE pg_default;

create index IF not exists idx_sequence_instances_restaurant on public.sequence_instances using btree (restaurant_id) TABLESPACE pg_default;

create index IF not exists idx_sequence_instances_org on public.sequence_instances using btree (organisation_id) TABLESPACE pg_default;

create index IF not exists idx_sequence_instances_status on public.sequence_instances using btree (status) TABLESPACE pg_default;

create index IF not exists idx_sequence_instances_assigned on public.sequence_instances using btree (assigned_to) TABLESPACE pg_default
where
  (assigned_to is not null);

create index IF not exists idx_sequence_instances_restaurant_status on public.sequence_instances using btree (restaurant_id, status) TABLESPACE pg_default;

create index IF not exists idx_sequence_instances_org_status on public.sequence_instances using btree (organisation_id, status) TABLESPACE pg_default;

create trigger update_sequence_instances_updated_at BEFORE
update on sequence_instances for EACH row
execute FUNCTION update_updated_at_column ();