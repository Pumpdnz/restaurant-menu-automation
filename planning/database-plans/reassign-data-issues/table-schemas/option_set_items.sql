create table public.option_set_items (
  id uuid not null default extensions.uuid_generate_v4 (),
  option_set_id uuid not null,
  name character varying(255) not null,
  price numeric(10, 2) null default 0,
  is_default boolean null default false,
  is_available boolean null default true,
  metadata jsonb null default '{}'::jsonb,
  created_at timestamp with time zone null default now(),
  organisation_id uuid null,
  description text null,
  price_display text null,
  display_order integer null default 0,
  extraction_source character varying(50) null,
  extracted_at timestamp with time zone null default now(),
  constraint options_pkey primary key (id),
  constraint options_option_set_id_fkey foreign KEY (option_set_id) references option_sets (id) on delete CASCADE,
  constraint options_organisation_id_fkey foreign KEY (organisation_id) references organisations (id),
  constraint check_extraction_source_items check (
    (
      (extraction_source is null)
      or (
        (extraction_source)::text = any (
          (
            array[
              'ubereats'::character varying,
              'doordash'::character varying,
              'menulog'::character varying,
              'manual'::character varying,
              'import'::character varying
            ]
          )::text[]
        )
      )
    )
  ),
  constraint check_price_range check (
    (
      (price >= ('-1000'::integer)::numeric)
      and (price <= (1000)::numeric)
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_options_org on public.option_set_items using btree (organisation_id) TABLESPACE pg_default;

create index IF not exists idx_option_set_items_option_set on public.option_set_items using btree (option_set_id) TABLESPACE pg_default;

create index IF not exists idx_option_set_items_organisation on public.option_set_items using btree (organisation_id) TABLESPACE pg_default;

create index IF not exists idx_option_set_items_display_order on public.option_set_items using btree (option_set_id, display_order) TABLESPACE pg_default;

create index IF not exists idx_option_set_items_availability on public.option_set_items using btree (option_set_id, is_available) TABLESPACE pg_default;