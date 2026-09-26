-- ElectroHub database schema
-- Run this once in your Supabase project's SQL Editor (Supabase Dashboard
-- -> SQL Editor -> New query -> paste all of this -> Run).

-- Needed for fast partial-text search on name/brand (ILIKE with an index).
create extension if not exists pg_trgm;

create table if not exists public.products (
  id bigint generated always as identity primary key,
  name text not null check (char_length(trim(name)) > 0),
  brand text not null check (char_length(trim(brand)) > 0),
  category text not null check (
    category in (
      'Smartphones', 'Laptops', 'Headphones', 'Monitors',
      'Cameras', 'Gaming', 'TVs', 'Accessories'
    )
  ),
  price numeric(10, 2) not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  min_stock integer not null default 5 check (min_stock >= 0),
  image text,
  description text,
  -- Generated (not stored client-side) so low/out-of-stock filtering can
  -- happen in the database instead of being faked in the frontend.
  status text generated always as (
    case
      when stock = 0 then 'out'
      when stock <= min_stock then 'low'
      else 'good'
    end
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_category_idx on public.products (category);
create index if not exists products_status_idx on public.products (status);
create index if not exists products_created_at_idx on public.products (created_at desc);
create index if not exists products_name_trgm_idx on public.products using gin (name gin_trgm_ops);
create index if not exists products_brand_trgm_idx on public.products using gin (brand gin_trgm_ops);

-- Keep updated_at accurate on every UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

-- Row Level Security: only signed-in (authenticated) users can read or
-- write products. There is no public/anonymous access at all, matching
-- "dashboard/products can be viewed only after authentication".
alter table public.products enable row level security;

drop policy if exists "Authenticated users can view products" on public.products;
create policy "Authenticated users can view products"
  on public.products for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert products" on public.products;
create policy "Authenticated users can insert products"
  on public.products for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update products" on public.products;
create policy "Authenticated users can update products"
  on public.products for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete products" on public.products;
create policy "Authenticated users can delete products"
  on public.products for delete
  to authenticated
  using (true);

-- Optional: seed a few demo products so the dashboard isn't empty the
-- first time you log in. Safe to skip or delete afterwards.
insert into public.products (name, brand, category, price, stock, min_stock, image, description)
values
  ('iPhone 15 Pro Max', 'Apple', 'Smartphones', 1199, 24, 10, 'https://images.unsplash.com/photo-1696446701796-da61225697cc?auto=format&fit=crop&w=160&q=85', 'Titanium design, A17 Pro chip and a pro camera system.'),
  ('Galaxy Book4 Pro', 'Samsung', 'Laptops', 1449, 8, 10, 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=160&q=85', 'Ultra-thin AMOLED laptop built for high-performance work.'),
  ('WH-1000XM5', 'Sony', 'Headphones', 398, 42, 12, 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=160&q=85', 'Industry-leading noise canceling with all-day comfort.'),
  ('UltraGear 27 OLED', 'LG', 'Monitors', 899, 3, 8, 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=160&q=85', 'QHD OLED gaming monitor with 240Hz refresh rate.'),
  ('EOS R6 Mark II', 'Canon', 'Cameras', 2499, 0, 5, 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=160&q=85', 'Full-frame mirrorless camera for creators and professionals.'),
  ('MacBook Air M3', 'Apple', 'Laptops', 1099, 18, 10, 'https://images.unsplash.com/photo-1517336714739-489689fd1ca8?auto=format&fit=crop&w=160&q=85', 'Strikingly thin with the power of Apple silicon.')
on conflict do nothing;
