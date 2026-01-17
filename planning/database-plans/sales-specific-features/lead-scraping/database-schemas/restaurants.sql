create table public.restaurants (
  id uuid not null default extensions.uuid_generate_v4 (),
  name character varying(255) not null,
  slug character varying(255) null,
  address text null,
  phone character varying(50) null,
  email character varying(255) null,
  website character varying(255) null,
  logo_url text null,
  brand_colors jsonb null,
  metadata jsonb null default '{}'::jsonb,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  weekly_sales_range text null,
  contact_name text null,
  contact_email text null,
  contact_phone text null,
  lead_created_at timestamp with time zone null,
  ubereats_url text null,
  doordash_url text null,
  website_url text null,
  instagram_url text null,
  facebook_url text null,
  opening_hours jsonb null,
  opening_hours_text text null,
  cuisine text[] null,
  organisation_name text null,
  theme text null,
  primary_color text null,
  secondary_color text null,
  logo_nobg_url text null,
  logo_standard_url text null,
  logo_thermal_url text null,
  user_email text null,
  user_password_hint text null,
  subdomain text null,
  stripe_connect_url text null,
  payment_settings jsonb null,
  service_settings jsonb null,
  onboarding_status text null default 'lead'::text,
  onboarding_completed_at timestamp with time zone null,
  workflow_notes text null,
  city text null,
  logo_favicon_url text null,
  tertiary_color text null,
  background_color text null,
  accent_color text null,
  meandyou_url text null,
  mobi2go_url text null,
  delivereasy_url text null,
  nextorder_url text null,
  foodhub_url text null,
  ordermeal_url text null,
  saved_images jsonb null default '[]'::jsonb,
  logo_thermal_alt_url text null,
  logo_thermal_contrast_url text null,
  logo_thermal_adaptive_url text null,
  organisation_id uuid null,
  created_by uuid null,
  hosted_logo_url text null,
  lead_type text null,
  lead_category text null,
  lead_engagement_source text null,
  lead_warmth text null,
  lead_stage text null,
  lead_status text null,
  icp_rating integer null,
  last_contacted timestamp with time zone null,
  demo_store_built boolean null default false,
  demo_store_url text null,
  assigned_sales_rep uuid null,
  contact_role text null,
  number_of_venues integer null,
  point_of_sale text null,
  online_ordering_platform text null,
  online_ordering_handles_delivery boolean null,
  self_delivery boolean null,
  weekly_uber_sales_volume numeric(10, 2) null,
  uber_aov numeric(10, 2) null,
  uber_markup numeric(5, 2) null,
  uber_profitability numeric(5, 2) null,
  uber_profitability_description text null,
  current_marketing_description text null,
  website_type text null,
  painpoints jsonb null default '[]'::jsonb,
  core_selling_points jsonb null default '[]'::jsonb,
  features_to_highlight jsonb null default '[]'::jsonb,
  possible_objections jsonb null default '[]'::jsonb,
  details text null,
  meeting_link text null,
  website_og_image text null,
  website_og_description text null,
  website_og_title text null,
  ubereats_og_image text null,
  doordash_og_image text null,
  facebook_cover_image text null,
  full_legal_name text null,
  nzbn text null,
  company_number text null,
  gst_number text null,
  additional_contacts_metadata jsonb null default '{}'::jsonb,
  contact_instagram text null,
  contact_facebook text null,
  contact_linkedin text null,
  additional_ordering_platform_url text null,
  company_name text null,
  constraint restaurants_pkey primary key (id),
  constraint restaurants_slug_key unique (slug),
  constraint restaurants_subdomain_key unique (subdomain),
  constraint restaurants_assigned_sales_rep_fkey foreign KEY (assigned_sales_rep) references auth.users (id),
  constraint restaurants_created_by_fkey foreign KEY (created_by) references auth.users (id),
  constraint restaurants_organisation_id_fkey foreign KEY (organisation_id) references organisations (id),
  constraint restaurants_lead_status_check check (
    (
      lead_status = any (
        array[
          'active'::text,
          'inactive'::text,
          'ghosted'::text,
          'reengaging'::text,
          'closed'::text
        ]
      )
    )
  ),
  constraint restaurants_lead_type_check check (
    (
      lead_type = any (array['inbound'::text, 'outbound'::text])
    )
  ),
  constraint restaurants_lead_warmth_check check (
    (
      lead_warmth = any (
        array[
          'frozen'::text,
          'cold'::text,
          'warm'::text,
          'hot'::text
        ]
      )
    )
  ),
  constraint restaurants_number_of_venues_check check (
    (
      (number_of_venues is null)
      or (number_of_venues > 0)
    )
  ),
  constraint restaurants_weekly_uber_sales_volume_check check (
    (
      (weekly_uber_sales_volume is null)
      or (weekly_uber_sales_volume >= (0)::numeric)
    )
  ),
  constraint restaurants_lead_engagement_source_check check (
    (
      lead_engagement_source = any (
        array[
          'pending'::text,
          'meta_ad_form'::text,
          'landing_page_demo_booking'::text,
          'website_demo_booking'::text,
          'website_live_chat'::text,
          'inbound_social_media_message'::text,
          'inbound_email'::text,
          'inbound_call'::text,
          'cold_social_media_message'::text,
          'cold_email'::text,
          'cold_call'::text,
          'inbound_referral'::text,
          'outbound_referral'::text
        ]
      )
    )
  ),
  constraint restaurants_lead_category_check check (
    (
      lead_category = any (
        array[
          'paid_ads'::text,
          'organic_content'::text,
          'warm_outreach'::text,
          'cold_outreach'::text
        ]
      )
    )
  ),
  constraint restaurants_icp_rating_check check (
    (
      (icp_rating >= 0)
      and (icp_rating <= 10)
    )
  ),
  constraint restaurants_theme_check check (
    (theme = any (array['light'::text, 'dark'::text]))
  ),
  constraint restaurants_uber_aov_check check (
    (
      (uber_aov is null)
      or (uber_aov >= (0)::numeric)
    )
  ),
  constraint restaurants_uber_markup_check check (
    (
      (uber_markup is null)
      or (
        (uber_markup >= (0)::numeric)
        and (uber_markup <= (100)::numeric)
      )
    )
  ),
  constraint restaurants_uber_profitability_check check (
    (
      (uber_profitability is null)
      or (
        (uber_profitability >= ('-100'::integer)::numeric)
        and (uber_profitability <= (100)::numeric)
      )
    )
  ),
  constraint restaurants_website_type_check check (
    (
      (website_type is null)
      or (
        website_type = any (
          array['platform_subdomain'::text, 'custom_domain'::text]
        )
      )
    )
  ),
  constraint restaurants_lead_stage_check check (
    (
      lead_stage = any (
        array[
          'uncontacted'::text,
          'reached_out'::text,
          'in_talks'::text,
          'demo_booked'::text,
          'rebook_demo'::text,
          'demo_completed'::text,
          'contract_sent'::text,
          'closed_won'::text,
          'closed_lost'::text,
          'reengaging'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_restaurants_onboarding_status on public.restaurants using btree (onboarding_status) TABLESPACE pg_default;

create index IF not exists idx_restaurants_contact_email on public.restaurants using btree (contact_email) TABLESPACE pg_default;

create index IF not exists idx_restaurants_user_email on public.restaurants using btree (user_email) TABLESPACE pg_default;

create index IF not exists idx_restaurants_subdomain on public.restaurants using btree (subdomain) TABLESPACE pg_default;

create index IF not exists idx_restaurants_city on public.restaurants using btree (city) TABLESPACE pg_default;

create index IF not exists idx_restaurants_org on public.restaurants using btree (organisation_id) TABLESPACE pg_default;

create index IF not exists idx_restaurants_lead_type on public.restaurants using btree (lead_type) TABLESPACE pg_default;

create index IF not exists idx_restaurants_lead_category on public.restaurants using btree (lead_category) TABLESPACE pg_default;

create index IF not exists idx_restaurants_lead_warmth on public.restaurants using btree (lead_warmth) TABLESPACE pg_default;

create index IF not exists idx_restaurants_lead_stage on public.restaurants using btree (lead_stage) TABLESPACE pg_default;

create index IF not exists idx_restaurants_lead_status on public.restaurants using btree (lead_status) TABLESPACE pg_default;

create index IF not exists idx_restaurants_icp_rating on public.restaurants using btree (icp_rating) TABLESPACE pg_default;

create index IF not exists idx_restaurants_last_contacted on public.restaurants using btree (last_contacted) TABLESPACE pg_default;

create index IF not exists idx_restaurants_demo_store_built on public.restaurants using btree (demo_store_built) TABLESPACE pg_default;

create index IF not exists idx_restaurants_assigned_sales_rep on public.restaurants using btree (assigned_sales_rep) TABLESPACE pg_default;

create index IF not exists idx_restaurants_lead_status_stage on public.restaurants using btree (lead_status, lead_stage) TABLESPACE pg_default;

create index IF not exists idx_restaurants_lead_warmth_stage on public.restaurants using btree (lead_warmth, lead_stage) TABLESPACE pg_default;

create index IF not exists idx_restaurants_contact_role on public.restaurants using btree (contact_role) TABLESPACE pg_default;

create index IF not exists idx_restaurants_number_of_venues on public.restaurants using btree (number_of_venues) TABLESPACE pg_default;

create index IF not exists idx_restaurants_website_type on public.restaurants using btree (website_type) TABLESPACE pg_default;

create index IF not exists idx_restaurants_painpoints on public.restaurants using gin (painpoints) TABLESPACE pg_default;

create index IF not exists idx_restaurants_core_selling_points on public.restaurants using gin (core_selling_points) TABLESPACE pg_default;

create index IF not exists idx_restaurants_features_to_highlight on public.restaurants using gin (features_to_highlight) TABLESPACE pg_default;

create index IF not exists idx_restaurants_possible_objections on public.restaurants using gin (possible_objections) TABLESPACE pg_default;

create index IF not exists idx_restaurants_nzbn on public.restaurants using btree (nzbn) TABLESPACE pg_default
where
  (nzbn is not null);

create index IF not exists idx_restaurants_company_number on public.restaurants using btree (company_number) TABLESPACE pg_default
where
  (company_number is not null);

create index IF not exists idx_restaurants_additional_contacts_metadata on public.restaurants using gin (additional_contacts_metadata) TABLESPACE pg_default;

create trigger update_restaurants_updated_at BEFORE
update on restaurants for EACH row
execute FUNCTION update_updated_at_column ();