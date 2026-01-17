create table public.task_templates (
  id uuid not null default extensions.uuid_generate_v4 (),
  organisation_id uuid not null,
  message_template_id uuid null,
  created_by uuid null,
  name text not null,
  description text null,
  type text not null,
  priority text not null default 'medium'::text,
  default_message text null,
  is_active boolean null default true,
  usage_count integer null default 0,
  metadata jsonb null default '{}'::jsonb,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  subject_line text null,
  constraint task_templates_pkey primary key (id),
  constraint task_templates_created_by_fkey foreign KEY (created_by) references auth.users (id) on delete set null,
  constraint task_templates_message_template_id_fkey foreign KEY (message_template_id) references message_templates (id) on delete set null,
  constraint task_templates_organisation_id_fkey foreign KEY (organisation_id) references organisations (id) on delete CASCADE,
  constraint task_templates_priority_check check (
    (
      priority = any (array['low'::text, 'medium'::text, 'high'::text])
    )
  ),
  constraint task_templates_type_check check (
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
  )
) TABLESPACE pg_default;

create index IF not exists idx_task_templates_organisation on public.task_templates using btree (organisation_id) TABLESPACE pg_default;

create index IF not exists idx_task_templates_type on public.task_templates using btree (type) TABLESPACE pg_default;

create index IF not exists idx_task_templates_is_active on public.task_templates using btree (is_active) TABLESPACE pg_default;

create trigger update_task_templates_updated_at BEFORE
update on task_templates for EACH row
execute FUNCTION update_updated_at_column ();