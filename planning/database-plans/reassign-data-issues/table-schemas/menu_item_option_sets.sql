create table public.menu_item_option_sets (
  id uuid not null default extensions.uuid_generate_v4 (),
  menu_item_id uuid not null,
  option_set_id uuid not null,
  display_order integer null default 0,
  created_at timestamp with time zone null default now(),
  organisation_id uuid null,
  constraint menu_item_option_sets_pkey primary key (id),
  constraint menu_item_option_sets_menu_item_id_option_set_id_key unique (menu_item_id, option_set_id),
  constraint menu_item_option_sets_menu_item_id_fkey foreign KEY (menu_item_id) references menu_items (id) on delete CASCADE,
  constraint menu_item_option_sets_option_set_id_fkey foreign KEY (option_set_id) references option_sets (id) on delete CASCADE,
  constraint menu_item_option_sets_organisation_id_fkey foreign KEY (organisation_id) references organisations (id)
) TABLESPACE pg_default;

create index IF not exists idx_menu_item_option_sets_menu_item on public.menu_item_option_sets using btree (menu_item_id) TABLESPACE pg_default;

create index IF not exists idx_menu_item_option_sets_option_set on public.menu_item_option_sets using btree (option_set_id) TABLESPACE pg_default;

create index IF not exists idx_menu_item_option_sets_org on public.menu_item_option_sets using btree (organisation_id) TABLESPACE pg_default;