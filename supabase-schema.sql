create extension if not exists pgcrypto;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null check (report_type in ('rat_sighting', 'leptospirosis_case')),
  latitude double precision not null check (latitude between 1.15 and 1.50),
  longitude double precision not null check (longitude between 103.55 and 104.10),
  sighted_at timestamptz not null,
  location_name text,
  dog_name text,
  dog_outcome text check (dog_outcome in ('survived', 'did_not_survive', 'ongoing_treatment')),
  notes text check (char_length(coalesce(notes, '')) <= 280),
  moderation_status text not null default 'approved'
    check (moderation_status in ('approved', 'pending', 'rejected')),
  created_at timestamptz not null default timezone('utc', now()),
  constraint lepto_case_requires_dog_details check (
    report_type <> 'leptospirosis_case'
    or (dog_name is not null and length(trim(dog_name)) > 0 and dog_outcome is not null)
  )
);

create index if not exists reports_sighted_at_idx on public.reports (sighted_at desc);
create index if not exists reports_report_type_idx on public.reports (report_type);
create index if not exists reports_dog_name_idx on public.reports (lower(dog_name));
create index if not exists reports_moderation_status_idx on public.reports (moderation_status);

alter table public.reports enable row level security;

drop policy if exists "Approved reports are viewable by everyone" on public.reports;
create policy "Approved reports are viewable by everyone"
on public.reports
for select
to anon, authenticated
using (moderation_status = 'approved');

drop policy if exists "Anyone can submit a report" on public.reports;
create policy "Anyone can submit a report"
on public.reports
for insert
to anon, authenticated
with check (
  report_type in ('rat_sighting', 'leptospirosis_case')
  and moderation_status = 'approved'
);

revoke update, delete on public.reports from anon, authenticated;
