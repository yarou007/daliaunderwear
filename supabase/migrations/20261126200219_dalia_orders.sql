begin;

create table public.dalia_order_managers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9][a-z0-9_-]{1,31}$'),
  granted_at timestamptz not null default now()
);

create table public.dalia_orders (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  phone text not null check (phone ~ '^[+]216[0-9]{8}$'),
  base_pack jsonb not null,
  addon_pack jsonb,
  total integer not null check (total > 0),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'unreachable', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users (id) on delete set null,
  constraint dalia_orders_base_pack_check check ((
    jsonb_typeof(base_pack) = 'object'
    and jsonb_typeof(base_pack -> 'packId') = 'string'
    and base_pack ->> 'packId' ~ '^[a-z0-9_-]{1,64}$'
  ) is true),
  constraint dalia_orders_addon_pack_check check (addon_pack is null or (
    jsonb_typeof(addon_pack) = 'object'
    and jsonb_typeof(addon_pack -> 'packId') = 'string'
    and addon_pack ->> 'packId' ~ '^[a-z0-9_-]{1,64}$'
    and addon_pack ->> 'packId' <> base_pack ->> 'packId'
  ) is true),
  constraint dalia_orders_packs_total_check check (
    case
      when jsonb_typeof(base_pack -> 'price') = 'number'
        and (addon_pack is null or jsonb_typeof(addon_pack -> 'price') = 'number')
      then (base_pack -> 'price')::numeric > 0
        and (base_pack -> 'price')::numeric = trunc((base_pack -> 'price')::numeric)
        and (addon_pack is null or (
          (addon_pack -> 'price')::numeric > 0
          and (addon_pack -> 'price')::numeric = trunc((addon_pack -> 'price')::numeric)
        ))
        and total::numeric = (base_pack -> 'price')::numeric
          + coalesce((addon_pack -> 'price')::numeric, 0)
      else false
    end
  )
);

create index dalia_orders_recent_idx on public.dalia_orders (created_at desc, id desc);
create index dalia_orders_status_recent_idx on public.dalia_orders (status, created_at desc, id desc);

alter table public.dalia_orders enable row level security;
alter table public.dalia_order_managers enable row level security;

-- Browser roles have no table access. The server verifies manager access before reading orders.
revoke all on table public.dalia_orders, public.dalia_order_managers
  from public, anon, authenticated, service_role;
grant select on table public.dalia_orders, public.dalia_order_managers to service_role;
grant insert on table public.dalia_orders to service_role;
grant update (addon_pack, total, status, confirmed_at, confirmed_by) on public.dalia_orders to service_role;

create function public.dalia_touch_order_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;

revoke all on function public.dalia_touch_order_updated_at()
  from public, anon, authenticated, service_role;
grant execute on function public.dalia_touch_order_updated_at() to service_role;

create trigger dalia_orders_touch_updated_at
before update on public.dalia_orders
for each row execute function public.dalia_touch_order_updated_at();

commit;
