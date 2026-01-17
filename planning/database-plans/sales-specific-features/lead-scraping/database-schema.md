# Lead Scraping Database Schema

## Overview

This document defines the database schema for the lead scraping feature. The schema consists of three main tables that work together to manage the scraping workflow:

1. **lead_scrape_jobs** - Parent table for scraping job configurations
2. **lead_scrape_job_steps** - Steps within each scraping job
3. **leads** - Individual lead records extracted from platforms

## Entity Relationship Diagram

```
┌─────────────────────┐       ┌─────────────────────────┐
│  lead_scrape_jobs   │───────│  lead_scrape_job_steps  │
│                     │  1:M  │                         │
│  - id (PK)          │       │  - id (PK)              │
│  - platform         │       │  - job_id (FK)          │
│  - country          │       │  - step_number          │
│  - city             │       │  - status               │
│  - cuisine          │       │  - ...                  │
│  - status           │       └─────────────────────────┘
│  - ...              │               │
└─────────────────────┘               │
         │                            │
         │ 1:M                        │ M:1
         │                            │
         ▼                            ▼
┌─────────────────────────────────────────────────────────┐
│                        leads                             │
│                                                          │
│  - id (PK)                                               │
│  - lead_scrape_job_id (FK to lead_scrape_jobs)          │
│  - current_step (relates to lead_scrape_job_steps)      │
│  - restaurant_name                                       │
│  - store_link                                            │
│  - ... enrichment fields                                 │
└─────────────────────────────────────────────────────────┘
         │
         │ 1:1 (on conversion)
         ▼
┌─────────────────────┐
│    restaurants      │
│  (existing table)   │
└─────────────────────┘
```

## Tables

### 1. lead_scrape_jobs

Stores the configuration and status of each lead scraping job.

```sql
create table public.lead_scrape_jobs (
  id uuid not null default extensions.uuid_generate_v4(),
  name text not null,
  platform text not null,
  country text not null default 'nz',
  city text null,
  city_code text null,
  region_code text null,
  cuisine text null,
  leads_limit integer not null default 21,
  page_offset integer null default 0,
  initial_url text null,
  status text not null default 'draft',
  current_step integer null default 0,
  total_steps integer null,
  leads_extracted integer null default 0,
  leads_passed integer null default 0,
  leads_failed integer null default 0,
  organisation_id uuid null,
  created_by uuid null,
  started_at timestamp with time zone null,
  completed_at timestamp with time zone null,
  cancelled_at timestamp with time zone null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  metadata jsonb null default '{}'::jsonb,

  constraint lead_scrape_jobs_pkey primary key (id),
  constraint lead_scrape_jobs_created_by_fkey foreign key (created_by) references auth.users (id),
  constraint lead_scrape_jobs_organisation_id_fkey foreign key (organisation_id) references organisations (id),
  constraint lead_scrape_jobs_status_check check (
    status = any (array[
      'draft'::text,
      'pending'::text,
      'in_progress'::text,
      'completed'::text,
      'cancelled'::text,
      'failed'::text
    ])
  ),
  constraint lead_scrape_jobs_leads_limit_check check (leads_limit > 0 and leads_limit <= 999),
  constraint lead_scrape_jobs_page_offset_check check (page_offset >= 0 and page_offset <= 999)
) tablespace pg_default;

-- Indexes
create index idx_lead_scrape_jobs_status on public.lead_scrape_jobs using btree (status);
create index idx_lead_scrape_jobs_platform on public.lead_scrape_jobs using btree (platform);
create index idx_lead_scrape_jobs_city on public.lead_scrape_jobs using btree (city);
create index idx_lead_scrape_jobs_cuisine on public.lead_scrape_jobs using btree (cuisine);
create index idx_lead_scrape_jobs_org on public.lead_scrape_jobs using btree (organisation_id);
create index idx_lead_scrape_jobs_created_at on public.lead_scrape_jobs using btree (created_at desc);

-- Trigger for updated_at
create trigger update_lead_scrape_jobs_updated_at
  before update on lead_scrape_jobs
  for each row execute function update_updated_at_column();
```

### 2. lead_scrape_job_steps

Stores the steps for each scraping job, defining the extraction pipeline.

```sql
create table public.lead_scrape_job_steps (
  id uuid not null default extensions.uuid_generate_v4(),
  job_id uuid not null,
  step_number integer not null,
  step_name text not null,
  step_description text null,
  step_type text not null default 'automatic',
  status text not null default 'pending',
  target_url_template text null,
  leads_received integer null default 0,
  leads_processed integer null default 0,
  leads_passed integer null default 0,
  leads_failed integer null default 0,
  started_at timestamp with time zone null,
  completed_at timestamp with time zone null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  metadata jsonb null default '{}'::jsonb,
  error_message text null,

  constraint lead_scrape_job_steps_pkey primary key (id),
  constraint lead_scrape_job_steps_job_id_fkey foreign key (job_id)
    references lead_scrape_jobs (id) on delete cascade,
  constraint lead_scrape_job_steps_unique_step unique (job_id, step_number),
  constraint lead_scrape_job_steps_status_check check (
    status = any (array[
      'pending'::text,
      'in_progress'::text,
      'action_required'::text,
      'completed'::text,
      'failed'::text
    ])
  ),
  constraint lead_scrape_job_steps_type_check check (
    step_type = any (array[
      'automatic'::text,
      'action_required'::text
    ])
  )
) tablespace pg_default;

-- Indexes
create index idx_lead_scrape_job_steps_job_id on public.lead_scrape_job_steps using btree (job_id);
create index idx_lead_scrape_job_steps_status on public.lead_scrape_job_steps using btree (status);
create index idx_lead_scrape_job_steps_step_number on public.lead_scrape_job_steps using btree (step_number);

-- Trigger for updated_at
create trigger update_lead_scrape_job_steps_updated_at
  before update on lead_scrape_job_steps
  for each row execute function update_updated_at_column();
```

### 3. leads

Stores individual lead records with all enrichment data.

```sql
create table public.leads (
  id uuid not null default extensions.uuid_generate_v4(),
  lead_scrape_job_id uuid not null,
  current_step integer not null default 1,
  step_progression_status text not null default 'available',

  -- Step 1: Initial extraction data
  restaurant_name text not null,
  store_link text null,

  -- Step 2: UberEats store page data
  ubereats_number_of_reviews text null,
  ubereats_average_review_rating numeric(3,1) null,
  ubereats_address text null,
  ubereats_cuisine text[] null,
  ubereats_price_rating integer null,

  -- Google Business Profile data
  google_number_of_reviews text null,
  google_average_review_rating numeric(3,1) null,
  google_address text null,

  -- Step 3+: Contact and business enrichment data
  phone text null,
  email text null,
  website_url text null,
  instagram_url text null,
  facebook_url text null,
  google_maps_url text null,
  contact_name text null,
  contact_email text null,
  contact_phone text null,
  contact_role text null,

  -- Business details
  organisation_name text null,
  number_of_venues integer null,
  city text null,
  region text null,
  country text null default 'nz',
  opening_hours jsonb null,
  opening_hours_text text null,
  website_type text null,

  -- Platform metadata
  platform text null,
  online_ordering_platform text null,
  online_ordering_handles_delivery boolean null,

  -- Tracking fields
  is_duplicate boolean null default false,
  duplicate_of_lead_id uuid null,
  duplicate_of_restaurant_id uuid null,
  validation_errors jsonb null default '[]'::jsonb,
  is_valid boolean null default true,

  -- Conversion tracking
  converted_to_restaurant_id uuid null,
  converted_at timestamp with time zone null,
  converted_by uuid null,

  -- Timestamps
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),

  -- Extra metadata
  metadata jsonb null default '{}'::jsonb,

  constraint leads_pkey primary key (id),
  constraint leads_lead_scrape_job_id_fkey foreign key (lead_scrape_job_id)
    references lead_scrape_jobs (id) on delete cascade,
  constraint leads_converted_to_restaurant_id_fkey foreign key (converted_to_restaurant_id)
    references restaurants (id),
  constraint leads_converted_by_fkey foreign key (converted_by)
    references auth.users (id),
  constraint leads_duplicate_of_lead_id_fkey foreign key (duplicate_of_lead_id)
    references leads (id),
  constraint leads_duplicate_of_restaurant_id_fkey foreign key (duplicate_of_restaurant_id)
    references restaurants (id),
  constraint leads_step_progression_status_check check (
    step_progression_status = any (array[
      'available'::text,
      'processing'::text,
      'processed'::text,
      'passed'::text,
      'failed'::text
    ])
  ),
  constraint leads_ubereats_average_review_rating_check check (
    ubereats_average_review_rating is null or
    (ubereats_average_review_rating >= 0 and ubereats_average_review_rating <= 5)
  ),
  constraint leads_google_average_review_rating_check check (
    google_average_review_rating is null or
    (google_average_review_rating >= 0 and google_average_review_rating <= 5)
  ),
  constraint leads_ubereats_price_rating_check check (
    ubereats_price_rating is null or
    (ubereats_price_rating >= 1 and ubereats_price_rating <= 4)
  ),
  constraint leads_number_of_venues_check check (
    (number_of_venues is null) or (number_of_venues > 0)
  ),
  constraint leads_website_type_check check (
    (website_type is null) or (
      website_type = any (
        array['platform_subdomain'::text, 'custom_domain'::text]
      )
    )
  )
) tablespace pg_default;

-- Indexes
create index idx_leads_job_id on public.leads using btree (lead_scrape_job_id);
create index idx_leads_current_step on public.leads using btree (current_step);
create index idx_leads_progression_status on public.leads using btree (step_progression_status);
create index idx_leads_restaurant_name on public.leads using btree (restaurant_name);
create index idx_leads_city on public.leads using btree (city);
create index idx_leads_platform on public.leads using btree (platform);
create index idx_leads_is_duplicate on public.leads using btree (is_duplicate);
create index idx_leads_converted on public.leads using btree (converted_to_restaurant_id);
create index idx_leads_created_at on public.leads using btree (created_at desc);
create index idx_leads_job_step on public.leads using btree (lead_scrape_job_id, current_step);

-- Full text search index for restaurant name
create index idx_leads_restaurant_name_search on public.leads
  using gin (to_tsvector('english', restaurant_name));

-- Trigger for updated_at
create trigger update_leads_updated_at
  before update on leads
  for each row execute function update_updated_at_column();
```

## UberEats Step Definitions

When a UberEats scrape job is created, these steps should be seeded into `lead_scrape_job_steps`:

| Step | Name | Type | Description | Schema Fields |
|------|------|------|-------------|---------------|
| 1 | Category Page Scan | Automatic | Initial extraction from category listing page | restaurant_name, store_link |
| 2 | Store Page Enrichment | Automatic | Batch extract from individual store pages | ubereats_number_of_reviews, ubereats_average_review_rating, ubereats_address, ubereats_cuisine, ubereats_price_rating |
| 3 | Google Business Lookup | Action Required | Search Google for business details | phone, website_url, opening_hours, google_number_of_reviews, google_average_review_rating, google_address |
| 4 | Social Media Discovery | Action Required | Find social media profiles | instagram_url, facebook_url |
| 5 | Contact Enrichment | Action Required | Find contact information | contact_name, contact_email, contact_phone |

## City Code Mapping (New Zealand & Australia)

```sql
-- Reference table for city codes (UberEats format)
create table public.city_codes (
  id uuid not null default extensions.uuid_generate_v4(),
  country text not null default 'nz',
  city_name text not null,
  city_code text not null,
  region_code text not null,
  ubereats_slug text not null,
  is_active boolean default true,

  constraint city_codes_pkey primary key (id),
  constraint city_codes_city_country_unique unique (city_name, country)
) tablespace pg_default;

-- Indexes
create index idx_city_codes_country on public.city_codes using btree (country);
create index idx_city_codes_region_code on public.city_codes using btree (region_code);

-- Initial seed data for New Zealand
insert into public.city_codes (country, city_name, city_code, region_code, ubereats_slug) values
  -- Auckland Region (auk)
  ('nz', 'Auckland', 'auckland', 'auk', 'auckland-auk'),
  ('nz', 'Beachlands', 'beachlands', 'auk', 'beachlands-auk'),
  ('nz', 'Bombay', 'bombay', 'auk', 'bombay-auk'),
  ('nz', 'Clevedon', 'clevedon', 'auk', 'clevedon-auk'),
  ('nz', 'Dairy Flat', 'dairy-flat', 'auk', 'dairy-flat-auk'),
  ('nz', 'Helensville', 'helensville', 'auk', 'helensville-auk'),
  ('nz', 'Karaka', 'karaka', 'auk', 'karaka-auk'),
  ('nz', 'Kumeu', 'kumeu', 'auk', 'kumeu-auk'),
  ('nz', 'Long Bay', 'long-bay', 'auk', 'long-bay-auk'),
  ('nz', 'Maraetai', 'maraetai', 'auk', 'maraetai-auk'),
  ('nz', 'Omaha', 'omaha', 'auk', 'omaha-auk'),
  ('nz', 'Orewa', 'orewa', 'auk', 'orewa-auk'),
  ('nz', 'Paerata', 'paerata', 'auk', 'paerata-auk'),
  ('nz', 'Parakai', 'parakai', 'auk', 'parakai-auk'),
  ('nz', 'Pukekohe', 'pukekohe', 'auk', 'pukekohe-auk'),
  ('nz', 'Puni', 'puni', 'auk', 'puni-auk'),
  ('nz', 'Ramarama', 'ramarama', 'auk', 'ramarama-auk'),
  ('nz', 'Rangitoto Island', 'rangitoto-island', 'auk', 'rangitoto-island-auk'),
  ('nz', 'Red Beach', 'red-beach', 'auk', 'red-beach-auk'),
  ('nz', 'Silverdale', 'silverdale', 'auk', 'silverdale-auk'),
  ('nz', 'Snells Beach', 'snells-beach', 'auk', 'snells-beach-auk'),
  ('nz', 'Stillwater', 'stillwater', 'auk', 'stillwater-auk'),
  ('nz', 'Swanson', 'swanson', 'auk', 'swanson-auk'),
  ('nz', 'Waimauku', 'waimauku', 'auk', 'waimauku-auk'),
  ('nz', 'Waiuku', 'waiuku', 'auk', 'waiuku-auk'),
  ('nz', 'Warkworth', 'warkworth', 'auk', 'warkworth-auk'),
  ('nz', 'Whangaparaoa', 'whangaparaoa', 'auk', 'whangaparaoa-auk'),
  ('nz', 'Whitford', 'whitford', 'auk', 'whitford-auk'),
  ('nz', 'Wainui', 'wainui', 'auk', 'wainui-auk'),
  -- Bay of Plenty Region (bop)
  ('nz', 'Bowentown', 'bowentown', 'bop', 'bowentown-bop'),
  ('nz', 'Ngongotaha', 'ngongotaha', 'bop', 'ngongotaha-bop'),
  ('nz', 'Omanawa', 'omanawa', 'bop', 'omanawa-bop'),
  ('nz', 'Omokoroa', 'omokoroa', 'bop', 'omokoroa-bop'),
  ('nz', 'Otakiri', 'otakiri', 'bop', 'otakiri-bop'),
  ('nz', 'Papamoa', 'papamoa', 'bop', 'papamoa-bop'),
  ('nz', 'Pyes Pa', 'pyes-pa', 'bop', 'pyes-pa-bop'),
  ('nz', 'Rotorua', 'rotorua', 'bop', 'rotorua-bop'),
  ('nz', 'Tauranga', 'tauranga', 'bop', 'tauranga-bop'),
  ('nz', 'Te Puke', 'te-puke', 'bop', 'te-puke-bop'),
  ('nz', 'Te Puna', 'te-puna', 'bop', 'te-puna-bop'),
  ('nz', 'Welcome Bay', 'welcome-bay', 'bop', 'welcome-bay-bop'),
  ('nz', 'Whakamarama', 'whakamarama', 'bop', 'whakamarama-bop'),
  ('nz', 'Whakarewarewa', 'whakarewarewa', 'bop', 'whakarewarewa-bop'),
  ('nz', 'Whakatane', 'whakatane', 'bop', 'whakatane-bop'),
  -- Canterbury Region (can)
  ('nz', 'Ashburton', 'ashburton', 'can', 'ashburton-can'),
  ('nz', 'Christchurch', 'christchurch', 'can', 'christchurch-can'),
  ('nz', 'Lincoln', 'lincoln', 'can', 'lincoln-can'),
  ('nz', 'Lyttelton', 'lyttelton', 'can', 'lyttelton-can'),
  ('nz', 'Ohoka', 'ohoka', 'can', 'ohoka-can'),
  ('nz', 'Pegasus', 'pegasus', 'can', 'pegasus-can'),
  ('nz', 'Prebbleton', 'prebbleton', 'can', 'prebbleton-can'),
  ('nz', 'Rangiora', 'rangiora', 'can', 'rangiora-can'),
  ('nz', 'Rolleston', 'rolleston', 'can', 'rolleston-can'),
  ('nz', 'Templeton', 'templeton', 'can', 'templeton-can'),
  ('nz', 'Timaru', 'timaru', 'can', 'timaru-can'),
  ('nz', 'Waikuku', 'waikuku', 'can', 'waikuku-can'),
  ('nz', 'West Melton', 'west-melton', 'can', 'west-melton-can'),
  ('nz', 'Woodend', 'woodend', 'can', 'woodend-can'),
  ('nz', 'Yaldhurst', 'yaldhurst', 'can', 'yaldhurst-can'),
  ('nz', 'Kaiapoi', 'kaiapoi', 'can', 'kaiapoi-can'),
  -- Gisborne Region (gis)
  ('nz', 'Gisborne', 'gisborne', 'gis', 'gisborne-gis'),
  -- Hawke''s Bay Region (hkb)
  ('nz', 'Bay View', 'bay-view', 'hkb', 'bay-view-hkb'),
  ('nz', 'Flaxmere', 'flaxmere', 'hkb', 'flaxmere-hkb'),
  ('nz', 'Hastings', 'hastings', 'hkb', 'hastings-hkb'),
  ('nz', 'Havelock North', 'havelock-north', 'hkb', 'havelock-north-hkb'),
  ('nz', 'Meeanee', 'meeanee', 'hkb', 'meeanee-hkb'),
  ('nz', 'Napier', 'napier', 'hkb', 'napier-hkb'),
  ('nz', 'Waipukurau', 'waipukurau', 'hkb', 'waipukurau-hkb'),
  -- Manawatu-Wanganui Region (mwt)
  ('nz', 'Bunnythorpe', 'bunnythorpe', 'mwt', 'bunnythorpe-mwt'),
  ('nz', 'Dannevirke', 'dannevirke', 'mwt', 'dannevirke-mwt'),
  ('nz', 'Feilding', 'feilding', 'mwt', 'feilding-mwt'),
  ('nz', 'Levin', 'levin', 'mwt', 'levin-mwt'),
  ('nz', 'Longburn', 'longburn', 'mwt', 'longburn-mwt'),
  ('nz', 'Okoia', 'okoia', 'mwt', 'okoia-mwt'),
  ('nz', 'Palmerston North', 'palmerston-north', 'mwt', 'palmerston-north-mwt'),
  ('nz', 'Whanganui', 'whanganui', 'mwt', 'whanganui-mwt'),
  -- Marlborough Region (mbh)
  ('nz', 'Blenheim', 'blenheim', 'mbh', 'blenheim-mbh'),
  -- Nelson Region (nsn)
  ('nz', 'Nelson', 'nelson', 'nsn', 'nelson-nsn'),
  -- Northland Region (ntl)
  ('nz', 'Dargaville', 'dargaville', 'ntl', 'dargaville-ntl'),
  ('nz', 'Kaikohe', 'kaikohe', 'ntl', 'kaikohe-ntl'),
  ('nz', 'Kaitaia', 'kaitaia', 'ntl', 'kaitaia-ntl'),
  ('nz', 'Kerikeri', 'kerikeri', 'ntl', 'kerikeri-ntl'),
  ('nz', 'Waipapa', 'waipapa', 'ntl', 'waipapa-ntl'),
  ('nz', 'Whangarei', 'whangarei', 'ntl', 'whangarei-ntl'),
  ('nz', 'Kamo', 'kamo', 'ntl', 'kamo-ntl'),
  ('nz', 'Maunu', 'maunu', 'ntl', 'maunu-ntl'),
  ('nz', 'Ruakaka', 'ruakaka', 'ntl', 'ruakaka-ntl'),
  -- Otago Region (ota)
  ('nz', 'Alexandra', 'alexandra', 'ota', 'alexandra-ota'),
  ('nz', 'Arrowtown', 'arrowtown', 'ota', 'arrowtown-ota'),
  ('nz', 'Arthurs Point', 'arthurs-point', 'ota', 'arthurs-point-ota'),
  ('nz', 'Cromwell', 'cromwell', 'ota', 'cromwell-ota'),
  ('nz', 'Dunedin', 'dunedin', 'ota', 'dunedin-ota'),
  ('nz', 'Jacks Point', 'jacks-point', 'ota', 'jacks-point-ota'),
  ('nz', 'Lower Shotover', 'lower-shotover', 'ota', 'lower-shotover-ota'),
  ('nz', 'Mosgiel', 'mosgiel', 'ota', 'mosgiel-ota'),
  ('nz', 'Oamaru', 'oamaru', 'ota', 'oamaru-ota'),
  ('nz', 'Port Chalmers', 'port-chalmers', 'ota', 'port-chalmers-ota'),
  ('nz', 'Queenstown', 'queenstown', 'ota', 'queenstown-ota'),
  ('nz', 'Wanaka', 'wanaka', 'ota', 'wanaka-ota'),
  ('nz', 'Lake Hayes', 'lake-hayes', 'ota', 'lake-hayes-ota'),
  -- Taranaki Region (tki)
  ('nz', 'Bell Block', 'bell-block', 'tki', 'bell-block-tki'),
  ('nz', 'Cardiff', 'cardiff', 'tki', 'cardiff-tki'),
  ('nz', 'Hawera', 'hawera', 'tki', 'hawera-tki'),
  ('nz', 'Inglewood', 'inglewood', 'tki', 'inglewood-tki'),
  ('nz', 'New Plymouth', 'new-plymouth', 'tki', 'new-plymouth-tki'),
  ('nz', 'Stratford', 'stratford', 'tki', 'stratford-tki'),
  ('nz', 'Waitara', 'waitara', 'tki', 'waitara-tki'),
  -- Tasman Region (tas)
  ('nz', 'Appleby', 'appleby', 'tas', 'appleby-tas'),
  ('nz', 'Hope', 'hope', 'tas', 'hope-tas'),
  ('nz', 'Motueka', 'motueka', 'tas', 'motueka-tas'),
  ('nz', 'Richmond', 'richmond', 'tas', 'richmond-tas'),
  -- Waikato Region (wko)
  ('nz', 'Cambridge', 'cambridge', 'wko', 'cambridge-wko'),
  ('nz', 'Gordonton', 'gordonton', 'wko', 'gordonton-wko'),
  ('nz', 'Hamilton', 'hamilton', 'wko', 'hamilton-wko'),
  ('nz', 'Huntly', 'huntly', 'wko', 'huntly-wko'),
  ('nz', 'Kihikihi', 'kihikihi', 'wko', 'kihikihi-wko'),
  ('nz', 'Matamata', 'matamata', 'wko', 'matamata-wko'),
  ('nz', 'Mercer', 'mercer', 'wko', 'mercer-wko'),
  ('nz', 'Morrinsville', 'morrinsville', 'wko', 'morrinsville-wko'),
  ('nz', 'Newstead', 'newstead', 'wko', 'newstead-wko'),
  ('nz', 'Ngaruawahia', 'ngaruawahia', 'wko', 'ngaruawahia-wko'),
  ('nz', 'Nukuhau', 'nukuhau', 'wko', 'nukuhau-wko'),
  ('nz', 'Pokeno', 'pokeno', 'wko', 'pokeno-wko'),
  ('nz', 'Tamahere', 'tamahere', 'wko', 'tamahere-wko'),
  ('nz', 'Taupiri', 'taupiri', 'wko', 'taupiri-wko'),
  ('nz', 'Taupo', 'taupo', 'wko', 'taupo-wko'),
  ('nz', 'Te Awamutu', 'te-awamutu', 'wko', 'te-awamutu-wko'),
  ('nz', 'Te Kowhai', 'te-kowhai', 'wko', 'te-kowhai-wko'),
  ('nz', 'Te Kuiti', 'te-kuiti', 'wko', 'te-kuiti-wko'),
  ('nz', 'Thames', 'thames', 'wko', 'thames-wko'),
  ('nz', 'Tokoroa', 'tokoroa', 'wko', 'tokoroa-wko'),
  ('nz', 'Tuakau', 'tuakau', 'wko', 'tuakau-wko'),
  ('nz', 'Waihi', 'waihi', 'wko', 'waihi-wko'),
  ('nz', 'Whitianga', 'whitianga', 'wko', 'whitianga-wko'),
  -- Wellington Region (wgn)
  ('nz', 'Carterton', 'carterton', 'wgn', 'carterton-wgn'),
  ('nz', 'Kuripuni', 'kuripuni', 'wgn', 'kuripuni-wgn'),
  ('nz', 'Lansdowne', 'lansdowne', 'wgn', 'lansdowne-wgn'),
  ('nz', 'Lower Hutt', 'lower-hutt', 'wgn', 'lower-hutt-wgn'),
  ('nz', 'Otaki', 'otaki', 'wgn', 'otaki-wgn'),
  ('nz', 'Paraparaumu', 'paraparaumu', 'wgn', 'paraparaumu-wgn'),
  ('nz', 'Porirua', 'porirua', 'wgn', 'porirua-wgn'),
  ('nz', 'Solway', 'solway', 'wgn', 'solway-wgn'),
  ('nz', 'Upper Hutt', 'upper-hutt', 'wgn', 'upper-hutt-wgn'),
  ('nz', 'Wellington', 'wellington', 'wgn', 'wellington-wgn'),
  ('nz', 'Masterton', 'masterton', 'wgn', 'masterton-wgn'),
  -- West Coast Region (wtc)
  ('nz', 'Greymouth', 'greymouth', 'wtc', 'greymouth-wtc'),
  ('nz', 'Paroa', 'paroa', 'wtc', 'paroa-wtc'),
  -- Southland Region (stl)
  ('nz', 'Gore', 'gore', 'stl', 'gore-stl'),
  ('nz', 'Otatara', 'otatara', 'stl', 'otatara-stl'),
  ('nz', 'Invercargill', 'invercargill', 'stl', 'invercargill-stl');

-- Initial seed data for Australia
insert into public.city_codes (country, city_name, city_code, region_code, ubereats_slug) values
  -- Australian Capital Territory (act)
  ('au', 'Canberra', 'canberra', 'act', 'canberra-act'),
  ('au', 'Hall', 'hall', 'act', 'hall-act'),
  -- New South Wales (nsw)
  ('au', 'Albury', 'albury', 'nsw', 'albury-nsw'),
  ('au', 'Alstonville', 'alstonville', 'nsw', 'alstonville-nsw'),
  ('au', 'Appin', 'appin', 'nsw', 'appin-nsw'),
  ('au', 'Armidale', 'armidale', 'nsw', 'armidale-nsw'),
  ('au', 'Ballina', 'ballina', 'nsw', 'ballina-nsw'),
  ('au', 'Batemans Bay', 'batemans-bay', 'nsw', 'batemans-bay-nsw'),
  ('au', 'Bathurst', 'bathurst', 'nsw', 'bathurst-nsw'),
  ('au', 'Bega', 'bega', 'nsw', 'bega-nsw'),
  ('au', 'Belimbla Park', 'belimbla-park', 'nsw', 'belimbla-park-nsw'),
  ('au', 'Blue Mountains', 'blue-mountains', 'nsw', 'blue-mountains-nsw'),
  ('au', 'Bonny Hills', 'bonny-hills', 'nsw', 'bonny-hills-nsw'),
  ('au', 'Bowral - Mittagong', 'bowral---mittagong', 'nsw', 'bowral---mittagong-nsw'),
  ('au', 'Branxton', 'branxton', 'nsw', 'branxton-nsw'),
  ('au', 'Broke', 'broke', 'nsw', 'broke-nsw'),
  ('au', 'Broken Hill', 'broken-hill', 'nsw', 'broken-hill-nsw'),
  ('au', 'Bungendore', 'bungendore', 'nsw', 'bungendore-nsw'),
  ('au', 'Byron Bay', 'byron-bay', 'nsw', 'byron-bay-nsw'),
  ('au', 'Camden Haven', 'camden-haven', 'nsw', 'camden-haven-nsw'),
  ('au', 'Casino', 'casino', 'nsw', 'casino-nsw'),
  ('au', 'Catherine Field', 'catherine-field', 'nsw', 'catherine-field-nsw'),
  ('au', 'Central Coast', 'central-coast', 'nsw', 'central-coast-nsw'),
  ('au', 'Cessnock', 'cessnock', 'nsw', 'cessnock-nsw'),
  ('au', 'Coffs Harbour', 'coffs-harbour', 'nsw', 'coffs-harbour-nsw'),
  ('au', 'Cooma', 'cooma', 'nsw', 'cooma-nsw'),
  ('au', 'Cowra', 'cowra', 'nsw', 'cowra-nsw'),
  ('au', 'Deniliquin', 'deniliquin', 'nsw', 'deniliquin-nsw'),
  ('au', 'Douglas Park', 'douglas-park', 'nsw', 'douglas-park-nsw'),
  ('au', 'Dubbo', 'dubbo', 'nsw', 'dubbo-nsw'),
  ('au', 'Estella', 'estella', 'nsw', 'estella-nsw'),
  ('au', 'Forbes', 'forbes', 'nsw', 'forbes-nsw'),
  ('au', 'Forest Hill', 'forest-hill', 'nsw', 'forest-hill-nsw'),
  ('au', 'Forster - Tuncurry', 'forster---tuncurry', 'nsw', 'forster---tuncurry-nsw'),
  ('au', 'Freemans Reach', 'freemans-reach', 'nsw', 'freemans-reach-nsw'),
  ('au', 'Galston', 'galston', 'nsw', 'galston-nsw'),
  ('au', 'Gillieston Heights', 'gillieston-heights', 'nsw', 'gillieston-heights-nsw'),
  ('au', 'Glen Innes', 'glen-innes', 'nsw', 'glen-innes-nsw'),
  ('au', 'Glenorie', 'glenorie', 'nsw', 'glenorie-nsw'),
  ('au', 'Glossodia', 'glossodia', 'nsw', 'glossodia-nsw'),
  ('au', 'Goulburn', 'goulburn', 'nsw', 'goulburn-nsw'),
  ('au', 'Grafton', 'grafton', 'nsw', 'grafton-nsw'),
  ('au', 'Greta', 'greta', 'nsw', 'greta-nsw'),
  ('au', 'Griffith', 'griffith', 'nsw', 'griffith-nsw'),
  ('au', 'Gunnedah', 'gunnedah', 'nsw', 'gunnedah-nsw'),
  ('au', 'Hastings Point', 'hastings-point', 'nsw', 'hastings-point-nsw'),
  ('au', 'Heddon Greta', 'heddon-greta', 'nsw', 'heddon-greta-nsw'),
  ('au', 'Huskisson', 'huskisson', 'nsw', 'huskisson-nsw'),
  ('au', 'Inverell', 'inverell', 'nsw', 'inverell-nsw'),
  ('au', 'Kempsey', 'kempsey', 'nsw', 'kempsey-nsw'),
  ('au', 'Kiama', 'kiama', 'nsw', 'kiama-nsw'),
  ('au', 'Kurmond', 'kurmond', 'nsw', 'kurmond-nsw'),
  ('au', 'Kurrajong', 'kurrajong', 'nsw', 'kurrajong-nsw'),
  ('au', 'Kurrajong Heights', 'kurrajong-heights', 'nsw', 'kurrajong-heights-nsw'),
  ('au', 'Kurri Kurri - Weston', 'kurri-kurri---weston', 'nsw', 'kurri-kurri---weston-nsw'),
  ('au', 'Lake Cathie', 'lake-cathie', 'nsw', 'lake-cathie-nsw'),
  ('au', 'Leeton', 'leeton', 'nsw', 'leeton-nsw'),
  ('au', 'Lennox Head', 'lennox-head', 'nsw', 'lennox-head-nsw'),
  ('au', 'Leppington', 'leppington', 'nsw', 'leppington-nsw'),
  ('au', 'Lismore', 'lismore', 'nsw', 'lismore-nsw'),
  ('au', 'Lithgow', 'lithgow', 'nsw', 'lithgow-nsw'),
  ('au', 'Luddenham', 'luddenham', 'nsw', 'luddenham-nsw'),
  ('au', 'Maitland', 'maitland', 'nsw', 'maitland-nsw'),
  ('au', 'Medlow Bath', 'medlow-bath', 'nsw', 'medlow-bath-nsw'),
  ('au', 'Medowie', 'medowie', 'nsw', 'medowie-nsw'),
  ('au', 'Menangle', 'menangle', 'nsw', 'menangle-nsw'),
  ('au', 'Merimbula', 'merimbula', 'nsw', 'merimbula-nsw'),
  ('au', 'Milton', 'milton', 'nsw', 'milton-nsw'),
  ('au', 'Moama', 'moama', 'nsw', 'moama-nsw'),
  ('au', 'Moonee Beach', 'moonee-beach', 'nsw', 'moonee-beach-nsw'),
  ('au', 'Moree', 'moree', 'nsw', 'moree-nsw'),
  ('au', 'Morisset - Cooranbong', 'morisset---cooranbong', 'nsw', 'morisset---cooranbong-nsw'),
  ('au', 'Moss Vale', 'moss-vale', 'nsw', 'moss-vale-nsw'),
  ('au', 'Mount Vernon', 'mount-vernon', 'nsw', 'mount-vernon-nsw'),
  ('au', 'Mudgee', 'mudgee', 'nsw', 'mudgee-nsw'),
  ('au', 'Mulgoa', 'mulgoa', 'nsw', 'mulgoa-nsw'),
  ('au', 'Mulwala', 'mulwala', 'nsw', 'mulwala-nsw'),
  ('au', 'Murwillumbah', 'murwillumbah', 'nsw', 'murwillumbah-nsw'),
  ('au', 'Muswellbrook', 'muswellbrook', 'nsw', 'muswellbrook-nsw'),
  ('au', 'Narrabri', 'narrabri', 'nsw', 'narrabri-nsw'),
  ('au', 'Nelson Bay - Corlette', 'nelson-bay---corlette', 'nsw', 'nelson-bay---corlette-nsw'),
  ('au', 'Newcastle', 'newcastle', 'nsw', 'newcastle-nsw'),
  ('au', 'Nowra - Bomaderry', 'nowra---bomaderry', 'nsw', 'nowra---bomaderry-nsw'),
  ('au', 'Old Erowal Bay', 'old-erowal-bay', 'nsw', 'old-erowal-bay-nsw'),
  ('au', 'Orange', 'orange', 'nsw', 'orange-nsw'),
  ('au', 'Pambula', 'pambula', 'nsw', 'pambula-nsw'),
  ('au', 'Parkes', 'parkes', 'nsw', 'parkes-nsw'),
  ('au', 'Picton', 'picton', 'nsw', 'picton-nsw'),
  ('au', 'Pitt Town', 'pitt-town', 'nsw', 'pitt-town-nsw'),
  ('au', 'Port Macquarie', 'port-macquarie', 'nsw', 'port-macquarie-nsw'),
  ('au', 'Pottsville', 'pottsville', 'nsw', 'pottsville-nsw'),
  ('au', 'Queanbeyan', 'queanbeyan', 'nsw', 'queanbeyan-nsw'),
  ('au', 'Raymond Terrace', 'raymond-terrace', 'nsw', 'raymond-terrace-nsw'),
  ('au', 'Richmond North', 'richmond-north', 'nsw', 'richmond-north-nsw'),
  ('au', 'Salamander Bay - Soldiers Point', 'salamander-bay---soldiers-point', 'nsw', 'salamander-bay---soldiers-point-nsw'),
  ('au', 'Salt Ash', 'salt-ash', 'nsw', 'salt-ash-nsw'),
  ('au', 'Sandy Beach - Emerald Beach', 'sandy-beach---emerald-beach', 'nsw', 'sandy-beach---emerald-beach-nsw'),
  ('au', 'Scone', 'scone', 'nsw', 'scone-nsw'),
  ('au', 'Shoal Bay', 'shoal-bay', 'nsw', 'shoal-bay-nsw'),
  ('au', 'Silverdale - Warragamba', 'silverdale---warragamba', 'nsw', 'silverdale---warragamba-nsw'),
  ('au', 'Singleton', 'singleton', 'nsw', 'singleton-nsw'),
  ('au', 'St Georges Basin - Sanctuary Point', 'st-georges-basin---sanctuary-point', 'nsw', 'st-georges-basin---sanctuary-point-nsw'),
  ('au', 'Suffolk Park', 'suffolk-park', 'nsw', 'suffolk-park-nsw'),
  ('au', 'Sydney', 'sydney', 'nsw', 'sydney-nsw'),
  ('au', 'Tahmoor', 'tahmoor', 'nsw', 'tahmoor-nsw'),
  ('au', 'Tamworth', 'tamworth', 'nsw', 'tamworth-nsw'),
  ('au', 'Taree', 'taree', 'nsw', 'taree-nsw'),
  ('au', 'Temora', 'temora', 'nsw', 'temora-nsw'),
  ('au', 'The Oaks', 'the-oaks', 'nsw', 'the-oaks-nsw'),
  ('au', 'Thirlmere', 'thirlmere', 'nsw', 'thirlmere-nsw'),
  ('au', 'Tomago', 'tomago', 'nsw', 'tomago-nsw'),
  ('au', 'Tweed Heads', 'tweed-heads', 'nsw', 'tweed-heads-nsw'),
  ('au', 'Ulladulla', 'ulladulla', 'nsw', 'ulladulla-nsw'),
  ('au', 'Uranquinty', 'uranquinty', 'nsw', 'uranquinty-nsw'),
  ('au', 'Vincentia', 'vincentia', 'nsw', 'vincentia-nsw'),
  ('au', 'Wagga Wagga', 'wagga-wagga', 'nsw', 'wagga-wagga-nsw'),
  ('au', 'Wauchope', 'wauchope', 'nsw', 'wauchope-nsw'),
  ('au', 'Wellington', 'wellington', 'nsw', 'wellington-nsw'),
  ('au', 'Wilberforce', 'wilberforce', 'nsw', 'wilberforce-nsw'),
  ('au', 'Wilton', 'wilton', 'nsw', 'wilton-nsw'),
  ('au', 'Wingham', 'wingham', 'nsw', 'wingham-nsw'),
  ('au', 'Wollongong', 'wollongong', 'nsw', 'wollongong-nsw'),
  ('au', 'Woolgoolga', 'woolgoolga', 'nsw', 'woolgoolga-nsw'),
  ('au', 'Wyee', 'wyee', 'nsw', 'wyee-nsw'),
  ('au', 'Wyong', 'wyong', 'nsw', 'wyong-nsw'),
  ('au', 'Yamba', 'yamba', 'nsw', 'yamba-nsw'),
  ('au', 'Yass', 'yass', 'nsw', 'yass-nsw'),
  ('au', 'Young', 'young', 'nsw', 'young-nsw'),
  -- Northern Territory (nt)
  ('au', 'Alice Springs', 'alice-springs', 'nt', 'alice-springs-nt'),
  ('au', 'Darwin', 'darwin', 'nt', 'darwin-nt'),
  ('au', 'Humpty Doo', 'humpty-doo', 'nt', 'humpty-doo-nt'),
  ('au', 'Tennant Creek', 'tennant-creek', 'nt', 'tennant-creek-nt'),
  -- Queensland (qld)
  ('au', 'Airlie Beach - Cannonvale', 'airlie-beach---cannonvale', 'qld', 'airlie-beach---cannonvale-qld'),
  ('au', 'Atherton', 'atherton', 'qld', 'atherton-qld'),
  ('au', 'Ayr', 'ayr', 'qld', 'ayr-qld'),
  ('au', 'Bargara - Innes Park', 'bargara---innes-park', 'qld', 'bargara---innes-park-qld'),
  ('au', 'Beachmere', 'beachmere', 'qld', 'beachmere-qld'),
  ('au', 'Beaudesert', 'beaudesert', 'qld', 'beaudesert-qld'),
  ('au', 'Beerwah', 'beerwah', 'qld', 'beerwah-qld'),
  ('au', 'Blackwater', 'blackwater', 'qld', 'blackwater-qld'),
  ('au', 'Bongaree - Woorim', 'bongaree---woorim', 'qld', 'bongaree---woorim-qld'),
  ('au', 'Bowen', 'bowen', 'qld', 'bowen-qld'),
  ('au', 'Brandon', 'brandon', 'qld', 'brandon-qld'),
  ('au', 'Brisbane', 'brisbane', 'qld', 'brisbane-qld'),
  ('au', 'Bundaberg', 'bundaberg', 'qld', 'bundaberg-qld'),
  ('au', 'Burnett Heads', 'burnett-heads', 'qld', 'burnett-heads-qld'),
  ('au', 'Cairns', 'cairns', 'qld', 'cairns-qld'),
  ('au', 'Calliope', 'calliope', 'qld', 'calliope-qld'),
  ('au', 'Chinchilla', 'chinchilla', 'qld', 'chinchilla-qld'),
  ('au', 'Cooroy', 'cooroy', 'qld', 'cooroy-qld'),
  ('au', 'Dalby', 'dalby', 'qld', 'dalby-qld'),
  ('au', 'Doonan - Tinbeerwah', 'doonan---tinbeerwah', 'qld', 'doonan---tinbeerwah-qld'),
  ('au', 'Emerald', 'emerald', 'qld', 'emerald-qld'),
  ('au', 'Emu Park', 'emu-park', 'qld', 'emu-park-qld'),
  ('au', 'Eumundi', 'eumundi', 'qld', 'eumundi-qld'),
  ('au', 'Gatton', 'gatton', 'qld', 'gatton-qld'),
  ('au', 'Gladstone', 'gladstone', 'qld', 'gladstone-qld'),
  ('au', 'Glass House Mountains', 'glass-house-mountains', 'qld', 'glass-house-mountains-qld'),
  ('au', 'Gold Coast', 'gold-coast', 'qld', 'gold-coast-qld'),
  ('au', 'Gordonvale', 'gordonvale', 'qld', 'gordonvale-qld'),
  ('au', 'Gracemere', 'gracemere', 'qld', 'gracemere-qld'),
  ('au', 'Gympie', 'gympie', 'qld', 'gympie-qld'),
  ('au', 'Hervey Bay', 'hervey-bay', 'qld', 'hervey-bay-qld'),
  ('au', 'Highfields', 'highfields', 'qld', 'highfields-qld'),
  ('au', 'Ingham', 'ingham', 'qld', 'ingham-qld'),
  ('au', 'Innisfail', 'innisfail', 'qld', 'innisfail-qld'),
  ('au', 'Jacobs Well', 'jacobs-well', 'qld', 'jacobs-well-qld'),
  ('au', 'Jimboomba', 'jimboomba', 'qld', 'jimboomba-qld'),
  ('au', 'Jimboomba - West', 'jimboomba---west', 'qld', 'jimboomba---west-qld'),
  ('au', 'Kingaroy', 'kingaroy', 'qld', 'kingaroy-qld'),
  ('au', 'Kinka Beach', 'kinka-beach', 'qld', 'kinka-beach-qld'),
  ('au', 'Kuranda', 'kuranda', 'qld', 'kuranda-qld'),
  ('au', 'Landsborough', 'landsborough', 'qld', 'landsborough-qld'),
  ('au', 'Logan Village', 'logan-village', 'qld', 'logan-village-qld'),
  ('au', 'Mackay', 'mackay', 'qld', 'mackay-qld'),
  ('au', 'Maleny', 'maleny', 'qld', 'maleny-qld'),
  ('au', 'Marburg', 'marburg', 'qld', 'marburg-qld'),
  ('au', 'Mareeba', 'mareeba', 'qld', 'mareeba-qld'),
  ('au', 'Maryborough', 'maryborough', 'qld', 'maryborough-qld'),
  ('au', 'Mooloolah', 'mooloolah', 'qld', 'mooloolah-qld'),
  ('au', 'Moore Park', 'moore-park', 'qld', 'moore-park-qld'),
  ('au', 'Moranbah', 'moranbah', 'qld', 'moranbah-qld'),
  ('au', 'Mount Cotton', 'mount-cotton', 'qld', 'mount-cotton-qld'),
  ('au', 'Mount Isa', 'mount-isa', 'qld', 'mount-isa-qld'),
  ('au', 'Mount Nathan', 'mount-nathan', 'qld', 'mount-nathan-qld'),
  ('au', 'Nambour', 'nambour', 'qld', 'nambour-qld'),
  ('au', 'Palmwoods', 'palmwoods', 'qld', 'palmwoods-qld'),
  ('au', 'Plainland', 'plainland', 'qld', 'plainland-qld'),
  ('au', 'Port Douglas - Craiglie', 'port-douglas---craiglie', 'qld', 'port-douglas---craiglie-qld'),
  ('au', 'Rockhampton', 'rockhampton', 'qld', 'rockhampton-qld'),
  ('au', 'Roma', 'roma', 'qld', 'roma-qld'),
  ('au', 'Samford Valley - Highvale', 'samford-valley---highvale', 'qld', 'samford-valley---highvale-qld'),
  ('au', 'Samford Village', 'samford-village', 'qld', 'samford-village-qld'),
  ('au', 'Sandstone Point - Ningi', 'sandstone-point---ningi', 'qld', 'sandstone-point---ningi-qld'),
  ('au', 'Sarina', 'sarina', 'qld', 'sarina-qld'),
  ('au', 'Stanthorpe', 'stanthorpe', 'qld', 'stanthorpe-qld'),
  ('au', 'Sunshine Coast', 'sunshine-coast', 'qld', 'sunshine-coast-qld'),
  ('au', 'Tamborine Mountain', 'tamborine-mountain', 'qld', 'tamborine-mountain-qld'),
  ('au', 'Tannum Sands Boyne Island', 'tannum-sands-boyne-island', 'qld', 'tannum-sands-boyne-island-qld'),
  ('au', 'Toorbul', 'toorbul', 'qld', 'toorbul-qld'),
  ('au', 'Toowoomba', 'toowoomba', 'qld', 'toowoomba-qld'),
  ('au', 'Townsville', 'townsville', 'qld', 'townsville-qld'),
  ('au', 'Walloon', 'walloon', 'qld', 'walloon-qld'),
  ('au', 'Warwick', 'warwick', 'qld', 'warwick-qld'),
  ('au', 'Westbrook', 'westbrook', 'qld', 'westbrook-qld'),
  ('au', 'Withcott', 'withcott', 'qld', 'withcott-qld'),
  ('au', 'Yandina', 'yandina', 'qld', 'yandina-qld'),
  ('au', 'Yeppoon', 'yeppoon', 'qld', 'yeppoon-qld'),
  -- South Australia (sa)
  ('au', 'Adelaide', 'adelaide', 'sa', 'adelaide-sa'),
  ('au', 'Aldinga', 'aldinga', 'sa', 'aldinga-sa'),
  ('au', 'Angaston', 'angaston', 'sa', 'angaston-sa'),
  ('au', 'Angle Vale', 'angle-vale', 'sa', 'angle-vale-sa'),
  ('au', 'Balhannah', 'balhannah', 'sa', 'balhannah-sa'),
  ('au', 'Berri', 'berri', 'sa', 'berri-sa'),
  ('au', 'Callington', 'callington', 'sa', 'callington-sa'),
  ('au', 'Crafers - Bridgewater', 'crafers---bridgewater', 'sa', 'crafers---bridgewater-sa'),
  ('au', 'Gawler', 'gawler', 'sa', 'gawler-sa'),
  ('au', 'Hahndorf', 'hahndorf', 'sa', 'hahndorf-sa'),
  ('au', 'Kadina', 'kadina', 'sa', 'kadina-sa'),
  ('au', 'McLaren Vale', 'mclaren-vale', 'sa', 'mclaren-vale-sa'),
  ('au', 'Mount Barker', 'mount-barker', 'sa', 'mount-barker-sa'),
  ('au', 'Mount Gambier', 'mount-gambier', 'sa', 'mount-gambier-sa'),
  ('au', 'Murray Bridge', 'murray-bridge', 'sa', 'murray-bridge-sa'),
  ('au', 'Nairne', 'nairne', 'sa', 'nairne-sa'),
  ('au', 'Naracoorte', 'naracoorte', 'sa', 'naracoorte-sa'),
  ('au', 'Nuriootpa', 'nuriootpa', 'sa', 'nuriootpa-sa'),
  ('au', 'Port Augusta', 'port-augusta', 'sa', 'port-augusta-sa'),
  ('au', 'Port Lincoln', 'port-lincoln', 'sa', 'port-lincoln-sa'),
  ('au', 'Port Pirie', 'port-pirie', 'sa', 'port-pirie-sa'),
  ('au', 'Renmark', 'renmark', 'sa', 'renmark-sa'),
  ('au', 'Strathalbyn', 'strathalbyn', 'sa', 'strathalbyn-sa'),
  ('au', 'Tanunda', 'tanunda', 'sa', 'tanunda-sa'),
  ('au', 'Two Wells', 'two-wells', 'sa', 'two-wells-sa'),
  ('au', 'Victor Harbor - Goolwa', 'victor-harbor---goolwa', 'sa', 'victor-harbor---goolwa-sa'),
  ('au', 'Virginia', 'virginia', 'sa', 'virginia-sa'),
  ('au', 'Wallaroo', 'wallaroo', 'sa', 'wallaroo-sa'),
  ('au', 'Whyalla', 'whyalla', 'sa', 'whyalla-sa'),
  ('au', 'Willunga', 'willunga', 'sa', 'willunga-sa'),
  -- Tasmania (tas) - Note: same region code as NZ Tasman
  ('au', 'Burnie - Somerset', 'burnie---somerset', 'tas', 'burnie---somerset-tas'),
  ('au', 'Devonport', 'devonport', 'tas', 'devonport-tas'),
  ('au', 'Hobart', 'hobart', 'tas', 'hobart-tas'),
  ('au', 'Huonville', 'huonville', 'tas', 'huonville-tas'),
  ('au', 'Latrobe', 'latrobe', 'tas', 'latrobe-tas'),
  ('au', 'Launceston', 'launceston', 'tas', 'launceston-tas'),
  ('au', 'Legana', 'legana', 'tas', 'legana-tas'),
  ('au', 'Margate', 'margate', 'tas', 'margate-tas'),
  ('au', 'New Norfolk', 'new-norfolk', 'tas', 'new-norfolk-tas'),
  ('au', 'Ranelagh', 'ranelagh', 'tas', 'ranelagh-tas'),
  ('au', 'Snug', 'snug', 'tas', 'snug-tas'),
  ('au', 'Sorell', 'sorell', 'tas', 'sorell-tas'),
  ('au', 'Ulverstone', 'ulverstone', 'tas', 'ulverstone-tas'),
  -- Victoria (vic)
  ('au', 'Ararat', 'ararat', 'vic', 'ararat-vic'),
  ('au', 'Bacchus Marsh', 'bacchus-marsh', 'vic', 'bacchus-marsh-vic'),
  ('au', 'Bairnsdale', 'bairnsdale', 'vic', 'bairnsdale-vic'),
  ('au', 'Ballarat', 'ballarat', 'vic', 'ballarat-vic'),
  ('au', 'Balnarring Beach', 'balnarring-beach', 'vic', 'balnarring-beach-vic'),
  ('au', 'Bannockburn', 'bannockburn', 'vic', 'bannockburn-vic'),
  ('au', 'Baranduda', 'baranduda', 'vic', 'baranduda-vic'),
  ('au', 'Beaconsfield Upper', 'beaconsfield-upper', 'vic', 'beaconsfield-upper-vic'),
  ('au', 'Benalla', 'benalla', 'vic', 'benalla-vic'),
  ('au', 'Bendigo', 'bendigo', 'vic', 'bendigo-vic'),
  ('au', 'Broadford', 'broadford', 'vic', 'broadford-vic'),
  ('au', 'Bulla', 'bulla', 'vic', 'bulla-vic'),
  ('au', 'Castlemaine', 'castlemaine', 'vic', 'castlemaine-vic'),
  ('au', 'Clyde', 'clyde', 'vic', 'clyde-vic'),
  ('au', 'Cobram', 'cobram', 'vic', 'cobram-vic'),
  ('au', 'Colac', 'colac', 'vic', 'colac-vic'),
  ('au', 'Cowes', 'cowes', 'vic', 'cowes-vic'),
  ('au', 'Diggers Rest', 'diggers-rest', 'vic', 'diggers-rest-vic'),
  ('au', 'Drouin', 'drouin', 'vic', 'drouin-vic'),
  ('au', 'Drysdale - Clifton Springs', 'drysdale---clifton-springs', 'vic', 'drysdale---clifton-springs-vic'),
  ('au', 'Echuca', 'echuca', 'vic', 'echuca-vic'),
  ('au', 'Euroa', 'euroa', 'vic', 'euroa-vic'),
  ('au', 'Geelong', 'geelong', 'vic', 'geelong-vic'),
  ('au', 'Gembrook', 'gembrook', 'vic', 'gembrook-vic'),
  ('au', 'Gisborne', 'gisborne', 'vic', 'gisborne-vic'),
  ('au', 'Hamilton', 'hamilton', 'vic', 'hamilton-vic'),
  ('au', 'Healesville', 'healesville', 'vic', 'healesville-vic'),
  ('au', 'Horsham', 'horsham', 'vic', 'horsham-vic'),
  ('au', 'Inverloch', 'inverloch', 'vic', 'inverloch-vic'),
  ('au', 'Kilmore', 'kilmore', 'vic', 'kilmore-vic'),
  ('au', 'Koo Wee Rup', 'koo-wee-rup', 'vic', 'koo-wee-rup-vic'),
  ('au', 'Lara', 'lara', 'vic', 'lara-vic'),
  ('au', 'Leopold', 'leopold', 'vic', 'leopold-vic'),
  ('au', 'Little River', 'little-river', 'vic', 'little-river-vic'),
  ('au', 'Longwarry', 'longwarry', 'vic', 'longwarry-vic'),
  ('au', 'Maffra', 'maffra', 'vic', 'maffra-vic'),
  ('au', 'Maryborough', 'maryborough', 'vic', 'maryborough-vic'),
  ('au', 'Melbourne', 'melbourne', 'vic', 'melbourne-vic'),
  ('au', 'Melton', 'melton', 'vic', 'melton-vic'),
  ('au', 'Mildura', 'mildura', 'vic', 'mildura-vic'),
  ('au', 'Moe Newborough', 'moe-newborough', 'vic', 'moe-newborough-vic'),
  ('au', 'Morwell', 'morwell', 'vic', 'morwell-vic'),
  ('au', 'Ocean Grove - Barwon Heads', 'ocean-grove---barwon-heads', 'vic', 'ocean-grove---barwon-heads-vic'),
  ('au', 'Officer', 'officer', 'vic', 'officer-vic'),
  ('au', 'Pakenham', 'pakenham', 'vic', 'pakenham-vic'),
  ('au', 'Point Lonsdale - Queenscliff', 'point-lonsdale---queenscliff', 'vic', 'point-lonsdale---queenscliff-vic'),
  ('au', 'Portarlington', 'portarlington', 'vic', 'portarlington-vic'),
  ('au', 'Portland', 'portland', 'vic', 'portland-vic'),
  ('au', 'Red Hill South', 'red-hill-south', 'vic', 'red-hill-south-vic'),
  ('au', 'Riddells Creek', 'riddells-creek', 'vic', 'riddells-creek-vic'),
  ('au', 'Rockbank', 'rockbank', 'vic', 'rockbank-vic'),
  ('au', 'Sale', 'sale', 'vic', 'sale-vic'),
  ('au', 'San Remo', 'san-remo', 'vic', 'san-remo-vic'),
  ('au', 'Seville', 'seville', 'vic', 'seville-vic'),
  ('au', 'Seymour', 'seymour', 'vic', 'seymour-vic'),
  ('au', 'Shepparton - Mooroopna', 'shepparton---mooroopna', 'vic', 'shepparton---mooroopna-vic'),
  ('au', 'St Leonards', 'st-leonards', 'vic', 'st-leonards-vic'),
  ('au', 'Stawell', 'stawell', 'vic', 'stawell-vic'),
  ('au', 'Sunbury', 'sunbury', 'vic', 'sunbury-vic'),
  ('au', 'Swan Hill', 'swan-hill', 'vic', 'swan-hill-vic'),
  ('au', 'Tooradin', 'tooradin', 'vic', 'tooradin-vic'),
  ('au', 'Torquay - Jan Juc', 'torquay---jan-juc', 'vic', 'torquay---jan-juc-vic'),
  ('au', 'Trafalgar', 'trafalgar', 'vic', 'trafalgar-vic'),
  ('au', 'Traralgon', 'traralgon', 'vic', 'traralgon-vic'),
  ('au', 'Wallan', 'wallan', 'vic', 'wallan-vic'),
  ('au', 'Wangaratta', 'wangaratta', 'vic', 'wangaratta-vic'),
  ('au', 'Warragul', 'warragul', 'vic', 'warragul-vic'),
  ('au', 'Warrnambool', 'warrnambool', 'vic', 'warrnambool-vic'),
  ('au', 'Whittlesea', 'whittlesea', 'vic', 'whittlesea-vic'),
  ('au', 'Wodonga', 'wodonga', 'vic', 'wodonga-vic'),
  ('au', 'Wonga Park', 'wonga-park', 'vic', 'wonga-park-vic'),
  ('au', 'Wonthaggi', 'wonthaggi', 'vic', 'wonthaggi-vic'),
  ('au', 'Woori Yallock - Launching Place', 'woori-yallock---launching-place', 'vic', 'woori-yallock---launching-place-vic'),
  ('au', 'Yarrawonga', 'yarrawonga', 'vic', 'yarrawonga-vic'),
  -- Western Australia (wa)
  ('au', 'Albany', 'albany', 'wa', 'albany-wa'),
  ('au', 'Baldivis', 'baldivis', 'wa', 'baldivis-wa'),
  ('au', 'Broome', 'broome', 'wa', 'broome-wa'),
  ('au', 'Bunbury', 'bunbury', 'wa', 'bunbury-wa'),
  ('au', 'Busselton', 'busselton', 'wa', 'busselton-wa'),
  ('au', 'Collie', 'collie', 'wa', 'collie-wa'),
  ('au', 'Dardanup', 'dardanup', 'wa', 'dardanup-wa'),
  ('au', 'Dunsborough', 'dunsborough', 'wa', 'dunsborough-wa'),
  ('au', 'Ellenbrook', 'ellenbrook', 'wa', 'ellenbrook-wa'),
  ('au', 'Esperance', 'esperance', 'wa', 'esperance-wa'),
  ('au', 'Geraldton', 'geraldton', 'wa', 'geraldton-wa'),
  ('au', 'Herne Hill', 'herne-hill', 'wa', 'herne-hill-wa'),
  ('au', 'Kalgoorlie - Boulder', 'kalgoorlie---boulder', 'wa', 'kalgoorlie---boulder-wa'),
  ('au', 'Karratha', 'karratha', 'wa', 'karratha-wa'),
  ('au', 'Manjimup', 'manjimup', 'wa', 'manjimup-wa'),
  ('au', 'Margaret River', 'margaret-river', 'wa', 'margaret-river-wa'),
  ('au', 'Northam', 'northam', 'wa', 'northam-wa'),
  ('au', 'Perth', 'perth', 'wa', 'perth-wa'),
  ('au', 'Pinjarra', 'pinjarra', 'wa', 'pinjarra-wa'),
  ('au', 'Port Hedland', 'port-hedland', 'wa', 'port-hedland-wa'),
  ('au', 'Yanchep', 'yanchep', 'wa', 'yanchep-wa');
```

## Row Level Security (RLS)

```sql
-- Enable RLS on all tables
alter table public.lead_scrape_jobs enable row level security;
alter table public.lead_scrape_job_steps enable row level security;
alter table public.leads enable row level security;
alter table public.city_codes enable row level security;

-- Policies for lead_scrape_jobs
create policy "Users can view their org's scrape jobs" on public.lead_scrape_jobs
  for select using (organisation_id = auth.jwt() ->> 'org_id'::text);

create policy "Users can create scrape jobs for their org" on public.lead_scrape_jobs
  for insert with check (organisation_id = auth.jwt() ->> 'org_id'::text);

create policy "Users can update their org's scrape jobs" on public.lead_scrape_jobs
  for update using (organisation_id = auth.jwt() ->> 'org_id'::text);

create policy "Users can delete their org's scrape jobs" on public.lead_scrape_jobs
  for delete using (organisation_id = auth.jwt() ->> 'org_id'::text);

-- Policies for lead_scrape_job_steps (inherited from parent job)
create policy "Users can view steps for their org's jobs" on public.lead_scrape_job_steps
  for select using (
    exists (
      select 1 from lead_scrape_jobs
      where id = lead_scrape_job_steps.job_id
      and organisation_id = auth.jwt() ->> 'org_id'::text
    )
  );

create policy "Users can manage steps for their org's jobs" on public.lead_scrape_job_steps
  for all using (
    exists (
      select 1 from lead_scrape_jobs
      where id = lead_scrape_job_steps.job_id
      and organisation_id = auth.jwt() ->> 'org_id'::text
    )
  );

-- Policies for leads (inherited from parent job)
create policy "Users can view leads for their org's jobs" on public.leads
  for select using (
    exists (
      select 1 from lead_scrape_jobs
      where id = leads.lead_scrape_job_id
      and organisation_id = auth.jwt() ->> 'org_id'::text
    )
  );

create policy "Users can manage leads for their org's jobs" on public.leads
  for all using (
    exists (
      select 1 from lead_scrape_jobs
      where id = leads.lead_scrape_job_id
      and organisation_id = auth.jwt() ->> 'org_id'::text
    )
  );

-- City codes are readable by all authenticated users
create policy "City codes are readable by authenticated users" on public.city_codes
  for select to authenticated using (true);
```

## Migration File

The complete migration should be named: `YYYYMMDDHHMMSS_add_lead_scraping_tables.sql`

```sql
-- Migration: Add Lead Scraping Tables
-- Description: Creates tables for lead scraping feature

-- 1. Create lead_scrape_jobs table
-- [Include full table definition from above]

-- 2. Create lead_scrape_job_steps table
-- [Include full table definition from above]

-- 3. Create leads table
-- [Include full table definition from above]

-- 4. Create city_codes reference table
-- [Include full table definition from above]

-- 5. Enable RLS and create policies
-- [Include all RLS policies from above]

-- 6. Seed initial city codes
-- [Include seed data from above]
```

## Data Relationships

### Lead Scrape Job → Steps (1:M)
- Each job has multiple predefined steps based on platform
- Steps are created when job starts (not when in draft)

### Lead Scrape Job → Leads (1:M)
- Each job produces multiple leads
- Lead count limited by `leads_limit`

### Lead → Restaurant (1:1 on conversion)
- A lead can be converted to a restaurant
- `converted_to_restaurant_id` tracks this relationship
- Conversion is one-time and irreversible

### Lead Progression Through Steps
- `current_step` indicates which step the lead is at
- `step_progression_status` tracks progress within current step:
  - `available` - Ready for processing in current step
  - `processing` - Currently being processed
  - `processed` - Processing complete, awaiting review
  - `passed` - Approved to move to next step
  - `failed` - Failed validation, won't progress
