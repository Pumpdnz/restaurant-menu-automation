create table public.platforms (
  id uuid not null default extensions.uuid_generate_v4 (),
  name character varying(50) not null,
  base_url character varying(255) null,
  is_active boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint platforms_pkey primary key (id),
  constraint platforms_name_key unique (name)
) TABLESPACE pg_default;