create table public.tasks (
  id uuid not null default extensions.uuid_generate_v4 (),
  organisation_id uuid not null,
  restaurant_id uuid null,
  task_template_id uuid null,
  message_template_id uuid null,
  assigned_to uuid null,
  created_by uuid null,
  name text not null,
  description text null,
  status text not null default 'pending'::text,
  type text not null,
  priority text not null default 'medium'::text,
  message text null,
  message_rendered text null,
  due_date timestamp with time zone null,
  completed_at timestamp with time zone null,
  cancelled_at timestamp with time zone null,
  metadata jsonb null default '{}'::jsonb,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  sequence_instance_id uuid null,
  sequence_step_order integer null,
  subject_line text null,
  subject_line_rendered text null,
  constraint tasks_pkey primary key (id),
  constraint tasks_created_by_fkey foreign KEY (created_by) references auth.users (id) on delete set null,
  constraint tasks_message_template_id_fkey foreign KEY (message_template_id) references message_templates (id) on delete set null,
  constraint tasks_organisation_id_fkey foreign KEY (organisation_id) references organisations (id) on delete CASCADE,
  constraint tasks_assigned_to_fkey foreign KEY (assigned_to) references auth.users (id) on delete set null,
  constraint tasks_restaurant_id_fkey foreign KEY (restaurant_id) references restaurants (id) on delete CASCADE,
  constraint tasks_sequence_instance_id_fkey foreign KEY (sequence_instance_id) references sequence_instances (id) on delete set null,
  constraint tasks_task_template_id_fkey foreign KEY (task_template_id) references task_templates (id) on delete set null,
  constraint tasks_type_check check (
    (
      type = any (
        array[
          'internal_activity'::text,
          'social_message'::text,
          'text'::text,
          'email'::text,
          'call'::text,
          'demo_meeting'::text
        ]
      )
    )
  ),
  constraint tasks_sequence_step_order_check check (
    (
      (sequence_step_order is null)
      or (sequence_step_order > 0)
    )
  ),
  constraint tasks_priority_check check (
    (
      priority = any (array['low'::text, 'medium'::text, 'high'::text])
    )
  ),
  constraint tasks_status_check check (
    (
      status = any (
        array[
          'pending'::text,
          'active'::text,
          'completed'::text,
          'cancelled'::text
        ]
      )
    )
  ),
  constraint tasks_sequence_consistency_check check (
    (
      (
        (sequence_instance_id is null)
        and (sequence_step_order is null)
      )
      or (
        (sequence_instance_id is not null)
        and (sequence_step_order is not null)
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_tasks_organisation on public.tasks using btree (organisation_id) TABLESPACE pg_default;

create index IF not exists idx_tasks_restaurant on public.tasks using btree (restaurant_id) TABLESPACE pg_default;

create index IF not exists idx_tasks_status on public.tasks using btree (status) TABLESPACE pg_default;

create index IF not exists idx_tasks_type on public.tasks using btree (type) TABLESPACE pg_default;

create index IF not exists idx_tasks_priority on public.tasks using btree (priority) TABLESPACE pg_default;

create index IF not exists idx_tasks_assigned_to on public.tasks using btree (assigned_to) TABLESPACE pg_default;

create index IF not exists idx_tasks_due_date on public.tasks using btree (due_date) TABLESPACE pg_default;

create index IF not exists idx_tasks_created_at on public.tasks using btree (created_at) TABLESPACE pg_default;

create index IF not exists idx_tasks_status_priority on public.tasks using btree (status, priority) TABLESPACE pg_default;

create index IF not exists idx_tasks_restaurant_status on public.tasks using btree (restaurant_id, status) TABLESPACE pg_default;

create index IF not exists idx_tasks_assigned_status on public.tasks using btree (assigned_to, status) TABLESPACE pg_default;

create index IF not exists idx_tasks_sequence_status on public.tasks using btree (sequence_instance_id, status) TABLESPACE pg_default
where
  (sequence_instance_id is not null);

create index IF not exists idx_tasks_sequence_instance on public.tasks using btree (sequence_instance_id) TABLESPACE pg_default
where
  (sequence_instance_id is not null);

create index IF not exists idx_tasks_sequence_instance_order on public.tasks using btree (sequence_instance_id, sequence_step_order) TABLESPACE pg_default
where
  (sequence_instance_id is not null);

create index IF not exists idx_tasks_restaurant_active on public.tasks using btree (restaurant_id, due_date, created_at) TABLESPACE pg_default
where
  (
    status <> all (array['completed'::text, 'cancelled'::text])
  );

create trigger update_tasks_updated_at BEFORE
update on tasks for EACH row
execute FUNCTION update_updated_at_column ();