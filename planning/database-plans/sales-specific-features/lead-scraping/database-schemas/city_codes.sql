create table public.city_codes (
  id uuid not null default extensions.uuid_generate_v4 (),
  country text not null default 'nz'::text,
  city_name text not null,
  city_code text not null,
  region_code text not null,
  ubereats_slug text not null,
  is_active boolean null default true,
  constraint city_codes_pkey primary key (id),
  constraint city_codes_city_country_unique unique (city_name, country)
) TABLESPACE pg_default;

create index IF not exists idx_city_codes_country on public.city_codes using btree (country) TABLESPACE pg_default;

create index IF not exists idx_city_codes_region_code on public.city_codes using btree (region_code) TABLESPACE pg_default;