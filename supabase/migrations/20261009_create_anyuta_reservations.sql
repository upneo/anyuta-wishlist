create table public.anyuta_reservations (
  item_key text primary key check (item_key in (
    'shirt','cosmetics','pancho','shrek','deepins','instax','action-camera',
    'minion-plush','minion-mug','minion-keychain','minion-accessories','minion-slippers','minion-bottle'
  )),
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
alter table public.anyuta_reservations enable row level security;
revoke all on public.anyuta_reservations from public, anon, authenticated;
grant select, insert, delete on public.anyuta_reservations to service_role;
