create table public.pumpd_restaurants (
  id uuid not null default gen_random_uuid (),
  organisation_id uuid not null,
  restaurant_id uuid not null,
  pumpd_account_id uuid null,
  pumpd_restaurant_id character varying(255) null,
  pumpd_subdomain character varying(255) null,
  pumpd_full_url text null,
  registration_status character varying(50) null default 'pending'::character varying,
  registration_date timestamp with time zone null,
  registration_type character varying(50) null,
  configured_name character varying(255) null,
  configured_address text null,
  configured_phone character varying(50) null,
  configured_hours jsonb null,
  configured_locale character varying(50) null default 'en-NZ'::character varying,
  configured_timezone character varying(50) null default 'Pacific/Auckland'::character varying,
  configured_currency character varying(10) null default 'NZD'::character varying,
  tax_in_prices boolean null default true,
  dashboard_url text null,
  settings_url text null,
  menu_url text null,
  is_active boolean null default true,
  last_sync_date timestamp with time zone null,
  sync_status character varying(50) null,
  last_error text null,
  error_count integer null default 0,
  created_at timestamp with time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone null default CURRENT_TIMESTAMP,
  setup_completion jsonb null default '{}'::jsonb,
  webhook_secret text null,
  api_keys jsonb null default '[]'::jsonb,
  system_settings_completed_at timestamp with time zone null,
  api_key_created_at timestamp with time zone null,
  uber_integration_completed_at timestamp with time zone null,
  constraint pumpd_restaurants_pkey primary key (id),
  constraint pumpd_restaurants_organisation_id_restaurant_id_key unique (organisation_id, restaurant_id),
  constraint pumpd_restaurants_pumpd_subdomain_key unique (pumpd_subdomain),
  constraint pumpd_restaurants_organisation_id_fkey foreign KEY (organisation_id) references organisations (id) on delete CASCADE,
  constraint pumpd_restaurants_pumpd_account_id_fkey foreign KEY (pumpd_account_id) references pumpd_accounts (id) on delete set null,
  constraint pumpd_restaurants_restaurant_id_fkey foreign KEY (restaurant_id) references restaurants (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_pumpd_restaurants_org_id on public.pumpd_restaurants using btree (organisation_id) TABLESPACE pg_default;

create index IF not exists idx_pumpd_restaurants_restaurant_id on public.pumpd_restaurants using btree (restaurant_id) TABLESPACE pg_default;

create index IF not exists idx_pumpd_restaurants_account_id on public.pumpd_restaurants using btree (pumpd_account_id) TABLESPACE pg_default;

create index IF not exists idx_pumpd_restaurants_status on public.pumpd_restaurants using btree (registration_status) TABLESPACE pg_default;

create index IF not exists idx_pumpd_restaurants_subdomain on public.pumpd_restaurants using btree (pumpd_subdomain) TABLESPACE pg_default;

create index IF not exists idx_pumpd_restaurants_setup_completion on public.pumpd_restaurants using gin (setup_completion) TABLESPACE pg_default;

create trigger update_pumpd_restaurants_updated_at BEFORE
update on pumpd_restaurants for EACH row
execute FUNCTION update_updated_at_column ();