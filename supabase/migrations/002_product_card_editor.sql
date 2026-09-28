-- Extend the existing catalog record; no existing product data is removed.
alter table public.products
  add column if not exists barcode text,
  add column if not exists manufacturer_part_number text,
  add column if not exists grouping_number text,
  add column if not exists tn_ved text,
  add column if not exists cost numeric,
  add column if not exists site_price numeric,
  add column if not exists crossed_price numeric,
  add column if not exists package_length numeric,
  add column if not exists package_width numeric,
  add column if not exists package_height numeric,
  add column if not exists package_weight numeric,
  add column if not exists annotation text,
  add column if not exists description text,
  add column if not exists hashtags jsonb not null default '[]'::jsonb,
  add column if not exists characteristics jsonb not null default '{}'::jsonb,
  add column if not exists riv_vehicles jsonb not null default '[]'::jsonb,
  add column if not exists riv_oem jsonb not null default '[]'::jsonb,
  add column if not exists riv_raw_text text,
  add column if not exists ai_suggestion jsonb not null default '{}'::jsonb;

create index if not exists products_barcode_idx on public.products(store_id, barcode);
create index if not exists products_manufacturer_part_number_idx on public.products(store_id, lower(manufacturer_part_number));
