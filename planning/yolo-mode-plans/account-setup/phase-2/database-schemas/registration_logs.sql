create table public.registration_logs (
  id uuid not null default gen_random_uuid (),
  organisation_id uuid not null,
  restaurant_id uuid null,
  pumpd_account_id uuid null,
  pumpd_restaurant_id uuid null,
  action character varying(100) not null,
  status character varying(50) not null,
  request_data jsonb null,
  response_data jsonb null,
  error_message text null,
  script_name character varying(255) null,
  execution_time_ms integer null,
  screenshot_paths text[] null,
  initiated_by character varying(255) null,
  created_at timestamp with time zone null default CURRENT_TIMESTAMP,
  constraint registration_logs_pkey primary key (id),
  constraint registration_logs_organisation_id_fkey foreign KEY (organisation_id) references organisations (id) on delete CASCADE,
  constraint registration_logs_pumpd_account_id_fkey foreign KEY (pumpd_account_id) references pumpd_accounts (id) on delete CASCADE,
  constraint registration_logs_pumpd_restaurant_id_fkey foreign KEY (pumpd_restaurant_id) references pumpd_restaurants (id) on delete CASCADE,
  constraint registration_logs_restaurant_id_fkey foreign KEY (restaurant_id) references restaurants (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_registration_logs_org_id on public.registration_logs using btree (organisation_id) TABLESPACE pg_default;

create index IF not exists idx_registration_logs_restaurant_id on public.registration_logs using btree (restaurant_id) TABLESPACE pg_default;

create index IF not exists idx_registration_logs_action on public.registration_logs using btree (action) TABLESPACE pg_default;

create index IF not exists idx_registration_logs_status on public.registration_logs using btree (status) TABLESPACE pg_default;

create index IF not exists idx_registration_logs_created_at on public.registration_logs using btree (created_at desc) TABLESPACE pg_default;