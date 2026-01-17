create table public.sequence_templates (
  id uuid not null default extensions.uuid_generate_v4 (),
  organisation_id uuid not null,
  created_by uuid null,
  name text not null,
  description text null,
  tags text[] null default array[]::text[],
  is_active boolean not null default true,
  usage_count integer not null default 0,
  metadata jsonb null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint sequence_templates_pkey primary key (id),
  constraint sequence_templates_created_by_fkey foreign KEY (created_by) references auth.users (id) on delete set null,
  constraint sequence_templates_organisation_id_fkey foreign KEY (organisation_id) references organisations (id) on delete CASCADE,
  constraint sequence_templates_description_check check ((length(description) <= 1000)),
  constraint sequence_templates_name_check check (
    (
      (length(name) >= 3)
      and (length(name) <= 100)
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_sequence_templates_org on public.sequence_templates using btree (organisation_id) TABLESPACE pg_default;

create index IF not exists idx_sequence_templates_active on public.sequence_templates using btree (is_active) TABLESPACE pg_default
where
  (is_active = true);

create index IF not exists idx_sequence_templates_tags on public.sequence_templates using gin (tags) TABLESPACE pg_default;

create trigger update_sequence_templates_updated_at BEFORE
update on sequence_templates for EACH row
execute FUNCTION update_updated_at_column ();