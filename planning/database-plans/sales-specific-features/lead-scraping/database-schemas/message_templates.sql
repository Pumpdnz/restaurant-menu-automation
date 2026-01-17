create table public.message_templates (
  id uuid not null default extensions.uuid_generate_v4 (),
  organisation_id uuid not null,
  created_by uuid null,
  name text not null,
  description text null,
  type text not null,
  message_content text not null,
  is_active boolean null default true,
  usage_count integer null default 0,
  available_variables jsonb null default '[]'::jsonb,
  preview_data jsonb null default '{}'::jsonb,
  metadata jsonb null default '{}'::jsonb,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  subject_line text null,
  constraint message_templates_pkey primary key (id),
  constraint message_templates_created_by_fkey foreign KEY (created_by) references auth.users (id) on delete set null,
  constraint message_templates_organisation_id_fkey foreign KEY (organisation_id) references organisations (id) on delete CASCADE,
  constraint message_templates_type_check check (
    (
      type = any (
        array[
          'social_message'::text,
          'text'::text,
          'email'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_message_templates_organisation on public.message_templates using btree (organisation_id) TABLESPACE pg_default;

create index IF not exists idx_message_templates_type on public.message_templates using btree (type) TABLESPACE pg_default;

create index IF not exists idx_message_templates_is_active on public.message_templates using btree (is_active) TABLESPACE pg_default;

create trigger update_message_templates_updated_at BEFORE
update on message_templates for EACH row
execute FUNCTION update_updated_at_column ();