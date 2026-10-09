grant select (item_key) on public.anyuta_reservations to anon;
create policy "public_read_occupied_gift_keys"
on public.anyuta_reservations for select to anon using (true);
