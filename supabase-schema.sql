-- ============================================================================
-- 1. EXTENSIONS & CUSTOM ENUMS
-- ============================================================================
create extension if not exists "pgcrypto";

create type public.delivery_type as enum (
  'delivery',
  'pickup',
  'dine_in'
);

create type public.payment_method as enum (
  'cash',
  'yape',
  'plin',
  'card'
);

create type public.order_status as enum (
  'pending',
  'confirmed',
  'preparing',
  'delivered',
  'cancelled'
);

create type public.store_role as enum (
  'owner',
  'admin',
  'staff'
);

-- ============================================================================
-- 2. TABLES & COMPOSITE CONSTRAINTS
-- ============================================================================

-- STORES (slug text not null unique automatically creates unique index)
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  phone_whatsapp text,
  currency varchar(3) not null default 'PEN',
  yape_number text,
  plin_number text,
  logo_url text,
  accent_color varchar(7) not null default '#0f172a',
  opening_hours jsonb not null default '{}'::jsonb,
  is_open_manual boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint slug_format check (slug ~* '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

-- STORE MEMBERS
create table public.store_members (
  user_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  role public.store_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (user_id, store_id)
);

-- CATEGORIES
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint uq_categories_store_id unique (store_id, id)
);

-- PRODUCTS
create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  category_id uuid,
  name text not null,
  description text,
  price numeric(10,2) not null check (price >= 0),
  image_url text,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_products_store_category foreign key (store_id, category_id)
    references public.categories(store_id, id)
    on delete set null (category_id)
);

-- ORDERS
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_name text not null,
  customer_phone text not null,
  delivery_type public.delivery_type not null,
  address text,
  payment_method public.payment_method not null,
  items_json jsonb not null,
  total numeric(10,2) not null check (total >= 0),
  status public.order_status not null default 'pending',
  client_request_id uuid unique,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 3. INDEXES
-- ============================================================================
create index idx_store_members_user_store on public.store_members(user_id, store_id);
create index idx_categories_store_sort on public.categories(store_id, sort_order asc);
create index idx_products_store on public.products(store_id);
create index idx_products_category on public.products(category_id);
create index idx_orders_store_created on public.orders(store_id, created_at desc);
create index idx_orders_store_status on public.orders(store_id, status);

-- ============================================================================
-- 4. SECURITY DEFINER FUNCTIONS
-- ============================================================================
create or replace function public.is_store_member(lookup_store_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.store_members
    where store_id = lookup_store_id
      and user_id = (select auth.uid())
  );
$$;

create or replace function public.is_store_admin(lookup_store_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.store_members
    where store_id = lookup_store_id
      and user_id = (select auth.uid())
      and role in ('owner', 'admin')
  );
$$;

grant execute on function public.is_store_member(uuid) to anon, authenticated;
grant execute on function public.is_store_admin(uuid) to anon, authenticated;

-- ============================================================================
-- 5. RPC SECURITY DEFINER FOR SERVER-SIDE ORDER CREATION (service_role only)
-- ============================================================================
drop function if exists public.create_order_secure(uuid, text, text, public.delivery_type, text, public.payment_method, jsonb);

create or replace function public.create_order_secure(
  p_store_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_delivery_type public.delivery_type,
  p_address text,
  p_payment_method public.payment_method,
  p_items jsonb,
  p_client_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
  v_db_product record;
  v_existing_order record;
  v_items_snapshot jsonb := '[]'::jsonb;
  v_total numeric(10,2) := 0.00;
  v_new_order_id uuid;
begin
  -- 0. Check store active status (membership suspension)
  if not exists (select 1 from public.stores where id = p_store_id and is_active = true) then
    raise exception 'Este local se encuentra inactivo por falta de membresía';
  end if;

  -- 1. Validate customer inputs (lengths & mandatory checks)
  if length(trim(coalesce(p_customer_name, ''))) not between 2 and 80 then
    raise exception 'El nombre del cliente debe tener entre 2 y 80 caracteres';
  end if;

  if length(trim(coalesce(p_customer_phone, ''))) not between 6 and 20 then
    raise exception 'El teléfono debe tener entre 6 y 20 caracteres';
  end if;

  if p_delivery_type = 'delivery' then
    if p_address is null or length(trim(p_address)) < 1 then
      raise exception 'La dirección es obligatoria para pedidos con delivery';
    end if;
    if length(trim(p_address)) > 200 then
      raise exception 'La dirección no puede superar los 200 caracteres';
    end if;
  else
    if p_address is not null and length(trim(p_address)) > 200 then
      raise exception 'La dirección no puede superar los 200 caracteres';
    end if;
  end if;

  -- 2. Validate p_items (not null, is json array, 1 to 50 items)
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'p_items debe ser un arreglo JSON válido';
  end if;

  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'El pedido debe contener entre 1 y 50 productos';
  end if;

  -- 3. Loop items, validate qty (1..99, not null) and recalculate price
  for v_item in select * from jsonb_to_recordset(p_items) as x(product_id uuid, qty int)
  loop
    if v_item.product_id is null then
      raise exception 'ID de producto nulo o inválido en el pedido';
    end if;

    if v_item.qty is null or v_item.qty < 1 or v_item.qty > 99 then
      raise exception 'La cantidad del producto % debe ser un entero entre 1 y 99', v_item.product_id;
    end if;

    select id, name, price, is_available
    into v_db_product
    from public.products
    where id = v_item.product_id
      and store_id = p_store_id;

    if not found then
      raise exception 'Producto % no encontrado en este local', v_item.product_id;
    end if;

    if not v_db_product.is_available then
      raise exception 'El producto "%" no se encuentra disponible', v_db_product.name;
    end if;

    v_total := v_total + (v_db_product.price * v_item.qty);
    v_items_snapshot := v_items_snapshot || jsonb_build_object(
      'product_id', v_db_product.id,
      'name', v_db_product.name,
      'price', v_db_product.price,
      'qty', v_item.qty
    );
  end loop;

  -- 4. Insert order with on conflict (client_request_id) do nothing
  insert into public.orders (
    store_id,
    customer_name,
    customer_phone,
    delivery_type,
    address,
    payment_method,
    items_json,
    total,
    status,
    client_request_id
  ) values (
    p_store_id,
    trim(p_customer_name),
    trim(p_customer_phone),
    p_delivery_type,
    case when p_delivery_type = 'delivery' then trim(p_address) else null end,
    p_payment_method,
    v_items_snapshot,
    round(v_total, 2),
    'pending',
    p_client_request_id
  )
  on conflict (client_request_id) do nothing
  returning id into v_new_order_id;

  -- If no row inserted due to conflict on client_request_id, return existing order
  if v_new_order_id is null and p_client_request_id is not null then
    select id, total, items_json
    into v_existing_order
    from public.orders
    where client_request_id = p_client_request_id
      and store_id = p_store_id;

    if found then
      return jsonb_build_object(
        'order_id', v_existing_order.id,
        'total', v_existing_order.total,
        'items', v_existing_order.items_json
      );
    end if;
  end if;

  -- Returns order ID, server calculated total, and official items snapshot
  return jsonb_build_object(
    'order_id', v_new_order_id,
    'total', round(v_total, 2),
    'items', v_items_snapshot
  );
end;
$$;

revoke all on function public.create_order_secure(uuid, text, text, public.delivery_type, text, public.payment_method, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.create_order_secure(uuid, text, text, public.delivery_type, text, public.payment_method, jsonb, uuid) to service_role;

-- Trigger para updated_at con search_path seguro
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_stores_updated_at on public.stores;
create trigger set_stores_updated_at
  before update on public.stores
  for each row execute function public.handle_updated_at();

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at
  before update on public.products
  for each row execute function public.handle_updated_at();

-- ============================================================================
-- 5B. ONBOARDING FUNCTION FOR NEW STORE CREATION (service_role only)
-- ============================================================================
create or replace function public.create_store(
  p_slug text,
  p_name text,
  p_whatsapp text,
  p_owner_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid;
  v_clean_slug text;
  v_reserved_slugs text[] := array['admin', 'login', 'api', 'dashboard', 'auth', 'static', '_next', 'menuki', 'catalogo'];
begin
  v_clean_slug := lower(trim(p_slug));

  -- Validate slug format: 3-50 chars, lowercase alphanumeric with hyphens, not at boundaries
  if v_clean_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v_clean_slug) < 3 or length(v_clean_slug) > 50 then
    raise exception 'Slug inválido. Debe contener entre 3 y 50 caracteres alfanuméricos en minúsculas y guiones simples.';
  end if;

  -- Check reserved slugs
  if v_clean_slug = any(v_reserved_slugs) then
    raise exception 'El slug "%" está reservado por el sistema.', v_clean_slug;
  end if;

  -- Check slug uniqueness
  if exists (select 1 from public.stores where slug = v_clean_slug) then
    raise exception 'El slug "%" ya se encuentra registrado.', v_clean_slug;
  end if;

  -- Insert store
  insert into public.stores (
    slug,
    name,
    phone_whatsapp,
    currency,
    is_open_manual,
    accent_color
  ) values (
    v_clean_slug,
    trim(p_name),
    trim(p_whatsapp),
    'PEN',
    true,
    '#E11D48'
  )
  returning id into v_store_id;

  -- Insert owner membership
  insert into public.store_members (
    store_id,
    user_id,
    role
  ) values (
    v_store_id,
    p_owner_user_id,
    'owner'
  );

  return jsonb_build_object(
    'store_id', v_store_id,
    'slug', v_clean_slug
  );
end;
$$;

revoke all on function public.create_store(text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.create_store(text, text, text, uuid) to service_role;

-- ============================================================================
-- 6. PERMISSIONS & RLS
-- ============================================================================
revoke all on public.stores from public, anon, authenticated;
revoke all on public.store_members from public, anon, authenticated;
revoke all on public.categories from public, anon, authenticated;
revoke all on public.products from public, anon, authenticated;
revoke all on public.orders from public, anon, authenticated;

grant select on public.stores to anon, authenticated;
grant update (name, phone_whatsapp, yape_number, plin_number, logo_url, accent_color, opening_hours, is_open_manual) on public.stores to authenticated;
grant select on public.store_members to authenticated;
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant select on public.orders to authenticated;
grant update (status) on public.orders to authenticated;

alter table public.stores enable row level security;
alter table public.store_members enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;

create policy "Public can view stores" on public.stores for select to anon, authenticated using (true);
create policy "Admins can update their store" on public.stores for update to authenticated using (public.is_store_admin(id)) with check (public.is_store_admin(id));

create policy "Members can view store memberships" on public.store_members for select to authenticated using (user_id = (select auth.uid()) or public.is_store_member(store_id));

create policy "Public can view categories" on public.categories for select to anon, authenticated using (true);
create policy "Members can insert categories" on public.categories for insert to authenticated with check (public.is_store_member(store_id));
create policy "Members can update categories" on public.categories for update to authenticated using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));
create policy "Admins can delete categories" on public.categories for delete to authenticated using (public.is_store_admin(store_id));

create policy "Public can view all products" on public.products for select to anon, authenticated using (true);
create policy "Members can insert products" on public.products for insert to authenticated with check (public.is_store_member(store_id));
create policy "Members can update products" on public.products for update to authenticated using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));
create policy "Admins can delete products" on public.products for delete to authenticated using (public.is_store_admin(store_id));

create policy "Members can view store orders" on public.orders for select to authenticated using (public.is_store_member(store_id));
create policy "Members can update store order status" on public.orders for update to authenticated using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));

-- ============================================================================
-- 7. SUPABASE STORAGE (store-assets bucket and member-scoped RLS)
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'store-assets',
  'store-assets',
  true,
  2097152, -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

create policy "Public can view store assets"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'store-assets');

create policy "Store members can upload store assets"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'store-assets'
    and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_store_member(split_part(name, '/', 1)::uuid)
  );

create policy "Store members can update store assets"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'store-assets'
    and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_store_member(split_part(name, '/', 1)::uuid)
  );

create policy "Store members can delete store assets"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'store-assets'
    and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_store_member(split_part(name, '/', 1)::uuid)
  );

-- ============================================================================
-- 8. SEED DATA
-- ============================================================================
do $$
declare
  v_store_id uuid;
  v_cat_calientes uuid;
  v_cat_frias uuid;
  v_cat_pasteleria uuid;
  v_cat_sandwiches uuid;
begin
  insert into public.stores (
    slug, name, phone_whatsapp, currency, yape_number, plin_number, logo_url, accent_color, opening_hours, is_open_manual
  ) values (
    'cafe-altomayo-lima', 'Altomayo Café de Especialidad', '51987654321', 'PEN', '987654321', '987654321',
    'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=400&q=80', '#92400e',
    '{
      "monday":    {"open": "07:30", "close": "21:00", "closed": false},
      "tuesday":   {"open": "07:30", "close": "21:00", "closed": false},
      "wednesday": {"open": "07:30", "close": "21:00", "closed": false},
      "thursday":  {"open": "07:30", "close": "21:00", "closed": false},
      "friday":    {"open": "07:30", "close": "22:00", "closed": false},
      "saturday":  {"open": "08:00", "close": "22:00", "closed": false},
      "sunday":    {"open": "08:30", "close": "19:00", "closed": false}
    }'::jsonb, true
  ) returning id into v_store_id;

  insert into public.categories (store_id, name, sort_order) values (v_store_id, 'Cafetería Caliente', 1) returning id into v_cat_calientes;
  insert into public.categories (store_id, name, sort_order) values (v_store_id, 'Bebidas Frías & Cold Brew', 2) returning id into v_cat_frias;
  insert into public.categories (store_id, name, sort_order) values (v_store_id, 'Pastelería Artesanal', 3) returning id into v_cat_pasteleria;
  insert into public.categories (store_id, name, sort_order) values (v_store_id, 'Sánguches & Salados', 4) returning id into v_cat_sandwiches;

  insert into public.products (store_id, category_id, name, description, price, is_available) values
  (v_store_id, v_cat_calientes, 'Espresso Doble Origen Cusco', 'Extracción doble con notas a cacao amargo y frutos secos.', 8.50, true),
  (v_store_id, v_cat_calientes, 'Cappuccino Clásico', 'Espresso, leche texturizada y microespuma sedosa con canela opcional.', 12.00, true),
  (v_store_id, v_cat_calientes, 'Flat White Cajamarca', 'Doble ristretto y leche emulsionada de textura fina.', 13.50, true),
  (v_store_id, v_cat_frias, 'Cold Brew Tradicional (18 hrs)', 'Macerado en frío por 18 horas, perfil suave y achocolatado.', 14.00, true),
  (v_store_id, v_cat_frias, 'Iced Latte Caramelo Salado', 'Leche fría, espresso fresco y sirope artesanal de caramelo con sal de Maras.', 15.50, true),
  (v_store_id, v_cat_frias, 'Tónica Espresso & Cítricos', 'Agua tónica premium, espresso extraction y piel de naranja Huando.', 16.00, true),
  (v_store_id, v_cat_pasteleria, 'Croissant Clásico de Mantequilla', 'Hojaldre artesanal horneado a diario con mantequilla pura.', 9.00, true),
  (v_store_id, v_cat_pasteleria, 'Queque de Plátano con Chispas de Cacao', 'Porción húmeda con plátano de la selva y nibs de cacao al 70%.', 8.00, true),
  (v_store_id, v_cat_pasteleria, 'Tarta de Manzana con Crema Pastelera', 'Base crujiente de almendras, manzana caramelizada y canela.', 13.00, true),
  (v_store_id, v_cat_sandwiches, 'Pan con Chicharrón Criollo', 'Panceta crocante, camote frito y sarza criolla en pan francés tradicional.', 18.50, true),
  (v_store_id, v_cat_sandwiches, 'Sánguche de Pollo Deshilachado Especial', 'Pechuga deshilachada, apio picado, mayonesa casera y lechuga hidropónica.', 14.00, true),
  (v_store_id, v_cat_sandwiches, 'Tostón de Palta Fuerte & Huevo Poché', 'Pan de masa madre tostado, palta cremosa, oliva extra virgen y huevo de corral.', 16.50, true);
end $$;
