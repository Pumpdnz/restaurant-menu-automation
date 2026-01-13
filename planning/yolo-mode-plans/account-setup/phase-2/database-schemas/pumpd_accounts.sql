create table public.pumpd_accounts (
  id uuid not null default gen_random_uuid (),
  organisation_id uuid not null,
  restaurant_id uuid not null,
  email character varying(255) not null,
  user_password_hint character varying(255) null,
  registration_status character varying(50) null default 'pending'::character varying,
  registration_date timestamp with time zone null,
  registration_method character varying(50) null,
  restaurant_count integer null default 0,
  is_primary_account boolean null default true,
  pumpd_user_id character varying(255) null,
  pumpd_dashboard_url text null,
  last_error text null,
  retry_count integer null default 0,
  created_at timestamp with time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone null default CURRENT_TIMESTAMP,
  constraint pumpd_accounts_pkey primary key (id),
  constraint pumpd_accounts_organisation_id_email_key unique (organisation_id, email),
  constraint pumpd_accounts_organisation_id_restaurant_id_email_key unique (organisation_id, restaurant_id, email),
  constraint pumpd_accounts_organisation_id_fkey foreign KEY (organisation_id) references organisations (id) on delete CASCADE,
  constraint pumpd_accounts_restaurant_id_fkey foreign KEY (restaurant_id) references restaurants (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_pumpd_accounts_org_id on public.pumpd_accounts using btree (organisation_id) TABLESPACE pg_default;

create index IF not exists idx_pumpd_accounts_restaurant_id on public.pumpd_accounts using btree (restaurant_id) TABLESPACE pg_default;

create index IF not exists idx_pumpd_accounts_email on public.pumpd_accounts using btree (email) TABLESPACE pg_default;

create index IF not exists idx_pumpd_accounts_status on public.pumpd_accounts using btree (registration_status) TABLESPACE pg_default;

create trigger update_pumpd_accounts_updated_at BEFORE
update on pumpd_accounts for EACH row
execute FUNCTION update_updated_at_column ();