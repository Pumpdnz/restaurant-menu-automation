create table public.sequence_steps (
  id uuid not null default extensions.uuid_generate_v4 (),
  sequence_template_id uuid not null,
  step_order integer not null,
  name text not null,
  description text null,
  task_template_id uuid null,
  type text not null,
  priority text not null default 'medium'::text,
  message_template_id uuid null,
  custom_message text null,
  delay_value integer not null default 0,
  delay_unit text not null default 'days'::text,
  metadata jsonb null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  subject_line text null,
  constraint sequence_steps_pkey primary key (id),
  constraint sequence_steps_unique_order unique (sequence_template_id, step_order),
  constraint sequence_steps_sequence_template_id_fkey foreign KEY (sequence_template_id) references sequence_templates (id) on delete CASCADE,
  constraint sequence_steps_task_template_id_fkey foreign KEY (task_template_id) references task_templates (id) on delete set null,
  constraint sequence_steps_message_template_id_fkey foreign KEY (message_template_id) references message_templates (id) on delete set null,
  constraint sequence_steps_step_order_check check ((step_order > 0)),
  constraint sequence_steps_type_check check (
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
  constraint sequence_steps_priority_check check (
    (
      priority = any (array['low'::text, 'medium'::text, 'high'::text])
    )
  ),
  constraint sequence_steps_delay_value_check check ((delay_value >= 0)),
  constraint sequence_steps_description_check check ((length(description) <= 500)),
  constraint sequence_steps_name_check check (
    (
      (length(name) >= 3)
      and (length(name) <= 100)
    )
  ),
  constraint sequence_steps_delay_unit_check check (
    (
      delay_unit = any (
        array['minutes'::text, 'hours'::text, 'days'::text]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_sequence_steps_template on public.sequence_steps using btree (sequence_template_id) TABLESPACE pg_default;

create index IF not exists idx_sequence_steps_template_order on public.sequence_steps using btree (sequence_template_id, step_order) TABLESPACE pg_default;

create index IF not exists idx_sequence_steps_task_template on public.sequence_steps using btree (task_template_id) TABLESPACE pg_default
where
  (task_template_id is not null);

create trigger update_sequence_steps_updated_at BEFORE
update on sequence_steps for EACH row
execute FUNCTION update_updated_at_column ();