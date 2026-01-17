create table public.option_sets (
  id uuid not null default extensions.uuid_generate_v4 (),
  name character varying(255) not null,
  type character varying(50) null,
  min_selections integer null default 0,
  max_selections integer null,
  is_required boolean null default false,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  organisation_id uuid null,
  description text null,
  display_order integer null default 0,
  multiple_selections_allowed boolean null default false,
  extraction_source character varying(50) null,
  extracted_at timestamp with time zone null default now(),
  source_data jsonb null,
  option_set_hash character varying(64) null,
  constraint option_sets_pkey primary key (id),
  constraint option_sets_organisation_id_fkey foreign KEY (organisation_id) references organisations (id),
  constraint check_extraction_source check (
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
  constraint check_min_max_selections check (
    (
      (min_selections >= 0)
      and (max_selections >= min_selections)
    )
  ),
  constraint option_sets_type_check check (
    (
      (type is null)
      or (
        (type)::text = any (
          (
            array[
              'single_choice'::character varying,
              'multiple_choice'::character varying,
              'required_modifier'::character varying,
              'optional_modifier'::character varying
            ]
          )::text[]
        )
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_option_sets_org on public.option_sets using btree (organisation_id) TABLESPACE pg_default;

create index IF not exists idx_option_sets_organisation on public.option_sets using btree (organisation_id) TABLESPACE pg_default;

create index IF not exists idx_option_sets_hash on public.option_sets using btree (option_set_hash) TABLESPACE pg_default;

create trigger update_option_sets_multiple_selections BEFORE INSERT
or
update OF max_selections on option_sets for EACH row
execute FUNCTION update_multiple_selections_allowed ();

create trigger update_option_sets_updated_at BEFORE
update on option_sets for EACH row
execute FUNCTION update_updated_at_column ();