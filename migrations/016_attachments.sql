-- Rose Concrete — File attachments (polymorphic)
--
-- One table + one Storage bucket, all entities share it. Photos, permits,
-- inspection reports, signed contracts, MOASURE screenshots — anything
-- Ronnie wants to keep on the record lands here.
--
-- Storage layout: key = `<entity_type>/<entity_id>/<uuid>-<filename>`.
-- The UUID prefix prevents filename collisions without stripping Ronnie's
-- original name from the URL (useful when the client downloads it).
--
-- Run in the Supabase SQL editor, then run the Storage bucket section
-- below (or run it via the dashboard → Storage → New bucket).

do $$ begin
  create type attachment_entity as enum (
    'client',
    'project',
    'quote',
    'visit',
    'task',
    'permit'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.attachments (
  id           uuid primary key default uuid_generate_v4(),
  entity_type  attachment_entity not null,
  entity_id    uuid not null,
  storage_key  text not null unique,
  filename     text not null,
  mime_type    text not null,
  size_bytes   bigint not null,
  caption      text,
  uploaded_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists attachments_entity_idx
  on public.attachments (entity_type, entity_id, created_at desc);

alter table public.attachments enable row level security;

create policy "admin office full access attachments" on public.attachments
  for all using (public.is_office_or_admin());
create policy "authenticated reads attachments" on public.attachments
  for select using (auth.uid() is not null);

-- Storage bucket: `attachments` (private). Objects are signed-URL access
-- only; no public read. The app issues short-lived signed URLs via the
-- service-role client when rendering the panel.
insert into storage.buckets (id, name, public)
  values ('attachments', 'attachments', false)
  on conflict (id) do nothing;

-- Storage RLS — only admin/office can upload or delete objects; any
-- authenticated user can read via a signed URL request.
do $$ begin
  create policy "admin office upload attachments" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'attachments' and public.is_office_or_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "admin office delete attachments" on storage.objects
    for delete to authenticated
    using (bucket_id = 'attachments' and public.is_office_or_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "authenticated read attachments" on storage.objects
    for select to authenticated
    using (bucket_id = 'attachments');
exception when duplicate_object then null; end $$;
