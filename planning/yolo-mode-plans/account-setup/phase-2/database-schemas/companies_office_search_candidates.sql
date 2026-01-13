create table public.companies_office_search_candidates (
  id uuid not null default extensions.uuid_generate_v4 (),
  restaurant_id uuid not null,
  registration_job_id uuid null,
  search_queries jsonb not null,
  name_results jsonb null default '[]'::jsonb,
  address_results jsonb null default '[]'::jsonb,
  combined_results jsonb null default '[]'::jsonb,
  candidate_count integer null default 0,
  selected_company_number text null,
  selected_company_data jsonb null,
  status text not null default 'pending'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  searched_at timestamp with time zone null,
  selected_at timestamp with time zone null,
  constraint companies_office_search_candidates_pkey primary key (id),
  constraint companies_search_unique_restaurant unique (restaurant_id, registration_job_id),
  constraint companies_search_job_fk foreign KEY (registration_job_id) references registration_jobs (id) on delete set null,
  constraint companies_search_restaurant_fk foreign KEY (restaurant_id) references restaurants (id) on delete CASCADE,
  constraint companies_search_status_check check (
    (
      status = any (
        array[
          'pending'::text,
          'searching'::text,
          'awaiting_selection'::text,
          'selected'::text,
          'no_match'::text,
          'failed'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_companies_search_restaurant on public.companies_office_search_candidates using btree (restaurant_id) TABLESPACE pg_default;

create index IF not exists idx_companies_search_job on public.companies_office_search_candidates using btree (registration_job_id) TABLESPACE pg_default;

create index IF not exists idx_companies_search_status on public.companies_office_search_candidates using btree (status) TABLESPACE pg_default;

create trigger update_companies_search_updated_at BEFORE
update on companies_office_search_candidates for EACH row
execute FUNCTION update_updated_at_column ();