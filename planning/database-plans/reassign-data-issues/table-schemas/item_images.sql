create table public.item_images (
  id uuid not null default extensions.uuid_generate_v4 (),
  menu_item_id uuid not null,
  url text not null,
  type character varying(50) null default 'primary'::character varying,
  width integer null,
  height integer null,
  file_size integer null,
  is_downloaded boolean null default false,
  local_path text null,
  created_at timestamp with time zone null default now(),
  organisation_id uuid null,
  cdn_uploaded boolean null default false,
  cdn_id uuid null,
  cdn_url text null,
  cdn_filename character varying(255) null,
  cdn_metadata jsonb null,
  upload_status character varying(50) null,
  upload_error text null,
  uploaded_at timestamp without time zone null,
  constraint item_images_pkey primary key (id),
  constraint item_images_menu_item_id_fkey foreign KEY (menu_item_id) references menu_items (id) on delete CASCADE,
  constraint item_images_organisation_id_fkey foreign KEY (organisation_id) references organisations (id)
) TABLESPACE pg_default;

create index IF not exists idx_item_images_menu_item on public.item_images using btree (menu_item_id) TABLESPACE pg_default;

create index IF not exists idx_item_images_org on public.item_images using btree (organisation_id) TABLESPACE pg_default;

create index IF not exists idx_item_images_cdn_uploaded on public.item_images using btree (cdn_uploaded) TABLESPACE pg_default;

create index IF not exists idx_item_images_menu_item_id on public.item_images using btree (menu_item_id) TABLESPACE pg_default;