create extension if not exists pgcrypto;

create table admins (
  email text primary key,
  username text,
  role text not null default 'admin' check (role = any (array['owner', 'admin'])),
  can_review_submissions boolean not null default false,
  can_edit_resources boolean not null default false,
  can_delete_resources boolean not null default false,
  can_view_trash boolean not null default false,
  can_view_audit_log boolean not null default false,
  can_view_members boolean not null default false,
  can_manage_contributors boolean not null default false,
  can_edit_members boolean not null default false,
  is_faculty boolean not null default false,
  can_view_analytics boolean not null default false,
  can_manage_settings boolean not null default false,
  is_developer boolean not null default false,
  viewed_tutorial boolean not null default false,
  added_by text,
  created_at timestamptz not null default now()
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_email text not null,
  action text not null,
  table_name text not null,
  record_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

create table contributors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role_type text not null check (role_type = any (array['student', 'faculty'])),
  batch_year text,
  department text,
  profile_pic text,
  is_top_contributor boolean not null default false,
  sort_order integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table global_resources (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

create table subjects (
  id uuid primary key default gen_random_uuid(),
  semester integer not null,
  name text not null,
  is_elective boolean not null default false,
  sort_order integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (semester, name)
);

create table sections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table resources (
  id uuid primary key default gen_random_uuid(),
  semester integer,
  subject text,
  resource_type text not null check (resource_type = any (array['pyq', 'lab', 'syllabus', 'iscode'])),
  name text not null,
  path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  file_size_bytes bigint,
  linked_iscode_id uuid references resources(id) on delete set null,
  section_id uuid references sections(id) on delete set null,
  description text
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  local_id text not null,
  student_name text,
  semester integer,
  subject text,
  resource_type text not null check (resource_type = any (array['pyq', 'lab', 'syllabus', 'semester_syllabus', 'other'])),
  resource_label text not null,
  file_path text not null,
  status text not null default 'pending' check (status = any (array['pending', 'approved', 'rejected'])),
  reviewed_by text,
  reviewed_at timestamptz,
  is_gcu_student boolean not null default true,
  enrollment_no text,
  institution text,
  uploader_semester integer,
  submitter_ip text,
  file_size_bytes bigint,
  rejection_reason text
);

create table resource_events (
  id bigint generated always as identity primary key,
  resource_id uuid not null references resources(id) on delete cascade,
  event_type text not null check (event_type = any (array['view', 'download'])),
  created_at timestamptz not null default now()
);

create index resources_section_idx on resources(section_id);

create index resources_subject_idx on resources(subject);
create index resources_semester_idx on resources(semester);
create index resources_resource_type_idx on resources(resource_type) where deleted_at is null;
create index resources_linked_iscode_id_idx on resources(linked_iscode_id) where linked_iscode_id is not null;

create index subjects_semester_idx on subjects(semester);

create index submissions_submitter_ip_created_at_idx on submissions(submitter_ip, created_at);

create index resource_events_resource_id_idx on resource_events(resource_id);
create index resource_events_created_at_idx on resource_events(created_at);
create index resource_events_type_idx on resource_events(event_type);

create table replaced_files (
  id uuid primary key default gen_random_uuid(),
  resource_name text not null,
  resource_type text,
  github_path text not null,
  jsdelivr_url text,
  file_size_bytes bigint,
  replaced_by text,
  deleted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index replaced_files_deleted_at_idx on replaced_files(deleted_at);

create table announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  created_by text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  title_underline boolean not null default false
);

create index announcements_created_at_idx on announcements(created_at desc);

create table submission_contributors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_key text generated always as (lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))) stored,
  contributions integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index submission_contributors_name_key_idx on submission_contributors(name_key);

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from admins a where lower(a.email) = lower(auth.email()) and a.role = 'owner'
  );
$function$;

create or replace function public.can_view_members_list()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from admins a where lower(a.email) = lower(auth.email())
      and (a.role = 'owner' or a.can_view_members = true or a.can_edit_members = true)
  );
$function$;

create or replace function public.can_edit_members_list()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from admins a where lower(a.email) = lower(auth.email())
      and (a.role = 'owner' or a.can_edit_members = true)
  );
$function$;

create or replace function public.purge_expired_trash()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  delete from resources where deleted_at is not null and deleted_at < now() - interval '30 days';
  delete from subjects where deleted_at is not null and deleted_at < now() - interval '30 days';
  delete from contributors where deleted_at is not null and deleted_at < now() - interval '30 days';
end;
$function$;

create or replace function public.record_submission_contributor(p_name text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  clean text;
begin
  clean := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  if clean = '' or lower(clean) = 'anonymous' then
    return;
  end if;
  if not exists (
    select 1 from admins a
    where lower(a.email) = lower(auth.email())
      and (a.role = 'owner' or a.can_review_submissions = true or a.can_manage_contributors = true)
  ) then
    raise exception 'not allowed';
  end if;
  insert into submission_contributors (name) values (clean)
  on conflict (name_key) do update
    set contributions = submission_contributors.contributions + 1,
        updated_at = now();
end;
$function$;

create or replace function public.maintenance_status()
returns table (active boolean, mode boolean, until timestamptz, type text, message text, started_at timestamptz)
language sql
stable
as $function$
  select
    (coalesce(max(value) filter (where key = 'maintenance_mode'), 'false') = 'true')
      and (
        coalesce(max(value) filter (where key = 'maintenance_type'), 'indefinite') <> 'scheduled'
        or nullif(max(value) filter (where key = 'maintenance_until'), '') is null
        or nullif(max(value) filter (where key = 'maintenance_until'), '')::timestamptz > now()
      ) as active,
    (coalesce(max(value) filter (where key = 'maintenance_mode'), 'false') = 'true') as mode,
    nullif(max(value) filter (where key = 'maintenance_until'), '')::timestamptz as until,
    coalesce(max(value) filter (where key = 'maintenance_type'), 'indefinite') as type,
    max(value) filter (where key = 'maintenance_message') as message,
    nullif(max(value) filter (where key = 'maintenance_started_at'), '')::timestamptz as started_at
  from global_resources
  where key in ('maintenance_mode', 'maintenance_until', 'maintenance_type', 'maintenance_message', 'maintenance_started_at');
$function$;

create or replace function public.my_submissions(
  p_local_id text,
  p_limit integer default 5,
  p_offset integer default 0,
  p_only_reviewed boolean default false
)
returns table (
  id uuid,
  resource_label text,
  subject text,
  status text,
  rejection_reason text,
  reviewed_at timestamptz,
  created_at timestamptz,
  total_count bigint
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    s.id,
    s.resource_label,
    s.subject,
    s.status,
    s.rejection_reason,
    s.reviewed_at,
    s.created_at,
    count(*) over () as total_count
  from submissions s
  where p_local_id is not null
    and length(p_local_id) > 0
    and s.local_id = p_local_id
    and (not p_only_reviewed or s.status in ('approved', 'rejected'))
  order by case when p_only_reviewed then s.reviewed_at else s.created_at end desc nulls last
  limit greatest(1, least(coalesce(p_limit, 5), 100))
  offset greatest(0, coalesce(p_offset, 0));
$function$;

create or replace function public.log_audit_event()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into audit_log (actor_email, action, table_name, record_id, details)
  values (
    coalesce(auth.email(), 'system'),
    tg_op,
    tg_table_name,
    coalesce(new.id, old.id)::text,
    case
      when tg_op = 'DELETE' then to_jsonb(old)
      when tg_op = 'UPDATE' then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
      else to_jsonb(new)
    end
  );
  return coalesce(new, old);
end;
$function$;

create or replace function public.log_admin_audit_event()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into audit_log (actor_email, action, table_name, record_id, details)
  values (
    coalesce(auth.email(), 'system'),
    tg_op,
    tg_table_name,
    coalesce(new.email, old.email),
    case
      when tg_op = 'DELETE' then to_jsonb(old)
      when tg_op = 'UPDATE' then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
      else to_jsonb(new)
    end
  );
  return coalesce(new, old);
end;
$function$;

create or replace function public.log_settings_audit_event()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into audit_log (actor_email, action, table_name, record_id, details)
  values (
    coalesce(auth.email(), 'system'),
    tg_op,
    tg_table_name,
    coalesce(new.key, old.key),
    case
      when tg_op = 'DELETE' then to_jsonb(old)
      when tg_op = 'UPDATE' then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
      else to_jsonb(new)
    end
  );
  return coalesce(new, old);
end;
$function$;

create or replace function public.enforce_resources_update_permission()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  is_owner boolean;
  can_edit boolean;
  can_delete boolean;
  only_trash_change boolean;
begin
  if auth.email() is null then
    return new;
  end if;

  select (a.role = 'owner'), a.can_edit_resources, a.can_delete_resources
    into is_owner, can_edit, can_delete
  from admins a where a.email = auth.email();

  if coalesce(is_owner, false) then
    return new;
  end if;

  only_trash_change := (
    new.semester is not distinct from old.semester and
    new.subject is not distinct from old.subject and
    new.resource_type is not distinct from old.resource_type and
    new.name is not distinct from old.name and
    new.path is not distinct from old.path and
    new.sort_order is not distinct from old.sort_order
  );

  if only_trash_change then
    if coalesce(can_delete, false) then
      return new;
    end if;
    raise exception 'not permitted: trash/restore requires can_delete_resources';
  else
    if coalesce(can_edit, false) then
      return new;
    end if;
    raise exception 'not permitted: editing requires can_edit_resources';
  end if;
end;
$function$;

create or replace function public.enforce_subjects_update_permission()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  is_owner boolean;
  can_edit boolean;
  can_delete boolean;
  only_trash_change boolean;
begin
  if auth.email() is null then
    return new;
  end if;

  select (a.role = 'owner'), a.can_edit_resources, a.can_delete_resources
    into is_owner, can_edit, can_delete
  from admins a where a.email = auth.email();

  if coalesce(is_owner, false) then
    return new;
  end if;

  only_trash_change := (
    new.semester is not distinct from old.semester and
    new.name is not distinct from old.name and
    new.is_elective is not distinct from old.is_elective and
    new.sort_order is not distinct from old.sort_order
  );

  if only_trash_change then
    if coalesce(can_delete, false) then
      return new;
    end if;
    raise exception 'not permitted: trash/restore requires can_delete_resources';
  else
    if coalesce(can_edit, false) then
      return new;
    end if;
    raise exception 'not permitted: editing requires can_edit_resources';
  end if;
end;
$function$;

create or replace function public.resource_leaderboard(sort_by text default 'views', limit_count integer default 10, type_filter text default null, days_back integer default null)
returns table (
  resource_id uuid,
  name text,
  subject text,
  semester integer,
  resource_type text,
  view_count bigint,
  download_count bigint,
  file_size_bytes bigint
)
language sql
stable
as $function$
  select
    r.id,
    r.name,
    r.subject,
    r.semester,
    r.resource_type,
    coalesce(v.cnt, 0),
    coalesce(d.cnt, 0),
    r.file_size_bytes
  from resources r
  left join (
    select resource_id, count(*) cnt from resource_events
    where event_type = 'view'
    and (days_back is null or created_at >= now() - (days_back || ' days')::interval)
    group by resource_id
  ) v on v.resource_id = r.id
  left join (
    select resource_id, count(*) cnt from resource_events
    where event_type = 'download'
    and (days_back is null or created_at >= now() - (days_back || ' days')::interval)
    group by resource_id
  ) d on d.resource_id = r.id
  where r.deleted_at is null
  and (type_filter is null or r.resource_type = type_filter)
  order by case when sort_by = 'downloads' then coalesce(d.cnt, 0) else coalesce(v.cnt, 0) end desc
  limit limit_count;
$function$;

create or replace function public.resource_event_trend(days_back integer default 30)
returns table (day date, views bigint, downloads bigint)
language sql
stable
as $function$
  select
    d::date as day,
    coalesce(sum(case when e.event_type = 'view' then 1 else 0 end), 0) as views,
    coalesce(sum(case when e.event_type = 'download' then 1 else 0 end), 0) as downloads
  from generate_series(current_date - (days_back - 1), current_date, interval '1 day') d
  left join resource_events e on e.created_at::date = d::date
  group by d
  order by d;
$function$;

create or replace function public.resource_storage_breakdown()
returns table (resource_type text, total_bytes bigint, file_count bigint)
language sql
stable
as $function$
  select resource_type, coalesce(sum(file_size_bytes), 0), count(*)
  from resources
  where deleted_at is null
  group by resource_type;
$function$;

create or replace function public.analytics_summary()
returns table (
  total_resources bigint,
  total_storage_bytes bigint,
  total_views bigint,
  total_downloads bigint,
  avg_file_size_bytes numeric
)
language sql
stable
as $function$
  select
    (select count(*) from resources where deleted_at is null),
    (select coalesce(sum(file_size_bytes), 0) from resources where deleted_at is null),
    (select count(*) from resource_events where event_type = 'view'),
    (select count(*) from resource_events where event_type = 'download'),
    (select coalesce(avg(file_size_bytes), 0) from resources where deleted_at is null and file_size_bytes is not null);
$function$;

grant select on public.admins to anon;
grant select on public.announcements to anon;
grant select on public.contributors to anon;
grant select on public.global_resources to anon;
grant select on public.resources to anon;
grant select on public.sections to anon;
grant select on public.subjects to anon;
grant insert on public.resource_events to anon;
grant select, insert, update, delete on public.admins to authenticated;
grant select, insert, update, delete on public.announcements to authenticated;
grant select, delete on public.audit_log to authenticated;
grant select, insert, update, delete on public.contributors to authenticated;
grant select, insert, update on public.global_resources to authenticated;
grant select, insert, delete on public.replaced_files to authenticated;
grant select on public.resource_events to authenticated;
grant select, insert, update, delete on public.resources to authenticated;
grant select, insert, update, delete on public.sections to authenticated;
grant select, insert, update, delete on public.subjects to authenticated;
grant select, delete on public.submission_contributors to authenticated;
grant select, update on public.submissions to authenticated;
grant select, insert, update, delete on public.admins to service_role;
grant select, insert, update, delete on public.announcements to service_role;
grant select, insert, update, delete on public.audit_log to service_role;
grant select, insert, update, delete on public.contributors to service_role;
grant select, insert, update, delete on public.global_resources to service_role;
grant select, insert, update, delete on public.replaced_files to service_role;
grant select, insert, update, delete on public.resource_events to service_role;
grant select, insert, update, delete on public.resources to service_role;
grant select, insert, update, delete on public.sections to service_role;
grant select, insert, update, delete on public.subjects to service_role;
grant select, insert, update, delete on public.submission_contributors to service_role;
grant select, insert, update, delete on public.submissions to service_role;

revoke execute on function public.purge_expired_trash() from public, authenticated, anon;
grant execute on function public.purge_expired_trash() to service_role;

revoke execute on function public.maintenance_status() from public;
grant execute on function public.maintenance_status() to anon, authenticated;

revoke execute on function public.my_submissions(text, integer, integer, boolean) from public;
grant execute on function public.my_submissions(text, integer, integer, boolean) to anon, authenticated;

revoke execute on function public.record_submission_contributor(text) from public, anon;
grant execute on function public.record_submission_contributor(text) to authenticated;

revoke execute on function public.can_view_members_list() from public, anon;
revoke execute on function public.can_edit_members_list() from public, anon;
revoke execute on function public.is_owner() from public, anon;
grant execute on function public.can_view_members_list() to authenticated;
grant execute on function public.can_edit_members_list() to authenticated;
grant execute on function public.is_owner() to authenticated;

revoke execute on function public.log_audit_event() from public, anon;
revoke execute on function public.log_admin_audit_event() from public, anon;
revoke execute on function public.log_settings_audit_event() from public, anon;
revoke execute on function public.enforce_subjects_update_permission() from public, anon;
revoke execute on function public.enforce_resources_update_permission() from public, anon;

revoke execute on function resource_leaderboard(text, integer, text, integer) from public, anon;
revoke execute on function resource_event_trend(integer) from public, anon;
revoke execute on function resource_storage_breakdown() from public, anon;
revoke execute on function analytics_summary() from public, anon;
grant execute on function resource_leaderboard(text, integer, text, integer) to authenticated;
grant execute on function resource_event_trend(integer) to authenticated;
grant execute on function resource_storage_breakdown() to authenticated;
grant execute on function analytics_summary() to authenticated;

create trigger trg_admins_audit after insert or update or delete on admins
  for each row execute function log_admin_audit_event();

create trigger trg_contributors_audit after insert or update or delete on contributors
  for each row execute function log_audit_event();

create trigger trg_site_settings_audit after insert or update or delete on global_resources
  for each row execute function log_settings_audit_event();

create trigger trg_resources_update_permission before update on resources
  for each row execute function enforce_resources_update_permission();

create trigger trg_resources_audit after insert or update or delete on resources
  for each row execute function log_audit_event();

create trigger trg_subjects_update_permission before update on subjects
  for each row execute function enforce_subjects_update_permission();

create trigger trg_subjects_audit after insert or update or delete on subjects
  for each row execute function log_audit_event();

create trigger trg_sections_audit after insert or update or delete on sections
  for each row execute function log_audit_event();

create trigger trg_submissions_audit after insert or update on submissions
  for each row execute function log_audit_event();

create trigger trg_replaced_files_audit after insert or update or delete on replaced_files
  for each row execute function log_audit_event();

create trigger trg_announcements_audit after insert or update or delete on announcements
  for each row execute function log_audit_event();

alter table admins enable row level security;
alter table audit_log enable row level security;
alter table contributors enable row level security;
alter table global_resources enable row level security;
alter table subjects enable row level security;
alter table sections enable row level security;
alter table resources enable row level security;
alter table submissions enable row level security;
alter table resource_events enable row level security;
alter table replaced_files enable row level security;
alter table submission_contributors enable row level security;
alter table announcements enable row level security;

create policy "self admin check" on admins for select to public using (auth.email() = email);
create policy "members list visible to permitted staff" on admins for select to authenticated using (can_view_members_list());
create policy "permitted staff can add admins" on admins for insert to authenticated with check (role = 'admin' and can_edit_members_list());
create policy "permitted staff can edit admins" on admins for update to authenticated using (role = 'admin' and can_edit_members_list()) with check (role = 'admin');
create policy "permitted staff can remove admins" on admins for delete to authenticated using (role = 'admin' and can_edit_members_list());

create policy "permitted staff can read audit log" on audit_log for select to authenticated using (
  exists (select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_view_audit_log = true))
);
create policy "owner can delete audit log" on audit_log for delete to authenticated using (
  exists (select 1 from admins a where lower(a.email) = lower(auth.email()) and a.role = 'owner')
);

create policy "public can read active contributors" on contributors for select to public using (deleted_at is null);
create policy "staff can read all contributors" on contributors for select to authenticated using (
  exists (select 1 from admins a where a.email = auth.email())
);
create policy "contributor managers can insert" on contributors for insert to authenticated with check (
  exists (select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_manage_contributors))
);
create policy "contributor managers can update" on contributors for update to authenticated using (
  exists (select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_manage_contributors))
) with check (
  exists (select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_manage_contributors))
);
create policy "owner can hard delete contributors" on contributors for delete to authenticated using (
  exists (select 1 from admins a where a.email = auth.email() and a.role = 'owner')
);

create policy "public can read site settings" on global_resources for select to public using (true);
create policy "editors can upsert site settings" on global_resources for insert to authenticated with check (
  exists (select 1 from admins a where a.email = auth.email() and (
    a.role = 'owner'
    or (a.is_developer and key in ('maintenance_mode', 'maintenance_until', 'maintenance_message', 'maintenance_type', 'maintenance_started_at'))
    or (a.can_manage_settings and key = 'submission_intake_enabled')
    or (a.can_edit_resources and key not in ('analytics_demo_mode', 'maintenance_mode', 'maintenance_until', 'maintenance_message', 'maintenance_type', 'maintenance_started_at', 'submission_intake_enabled'))
  ))
);
create policy "editors can update site settings" on global_resources for update to authenticated using (
  exists (select 1 from admins a where a.email = auth.email() and (
    a.role = 'owner'
    or (a.is_developer and key in ('maintenance_mode', 'maintenance_until', 'maintenance_message', 'maintenance_type', 'maintenance_started_at'))
    or (a.can_manage_settings and key = 'submission_intake_enabled')
    or (a.can_edit_resources and key not in ('analytics_demo_mode', 'maintenance_mode', 'maintenance_until', 'maintenance_message', 'maintenance_type', 'maintenance_started_at', 'submission_intake_enabled'))
  ))
) with check (
  exists (select 1 from admins a where a.email = auth.email() and (
    a.role = 'owner'
    or (a.is_developer and key in ('maintenance_mode', 'maintenance_until', 'maintenance_message', 'maintenance_type', 'maintenance_started_at'))
    or (a.can_manage_settings and key = 'submission_intake_enabled')
    or (a.can_edit_resources and key not in ('analytics_demo_mode', 'maintenance_mode', 'maintenance_until', 'maintenance_message', 'maintenance_type', 'maintenance_started_at', 'submission_intake_enabled'))
  ))
);

create policy "public can read active subjects" on subjects for select to public using (deleted_at is null);
create policy "staff can read all subjects" on subjects for select to authenticated using (
  exists (select 1 from admins a where a.email = auth.email())
);
create policy "editors can insert subjects" on subjects for insert to authenticated with check (
  exists (select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_edit_resources))
);
create policy "staff can update subjects" on subjects for update to authenticated using (
  exists (select 1 from admins a where a.email = auth.email())
) with check (
  exists (select 1 from admins a where a.email = auth.email())
);
create policy "owner can hard delete subjects" on subjects for delete to authenticated using (
  exists (select 1 from admins a where a.email = auth.email() and a.role = 'owner')
);

create policy "public can read active sections" on sections for select to public using (deleted_at is null);
create policy "staff can read all sections" on sections for select to authenticated using (
  exists (select 1 from admins a where a.email = auth.email())
);
create policy "editors can insert sections" on sections for insert to authenticated with check (
  exists (select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_edit_resources))
);
create policy "editors can update sections" on sections for update to authenticated using (
  exists (select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_edit_resources or a.can_delete_resources))
) with check (
  exists (select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_edit_resources or a.can_delete_resources))
);
create policy "owner can hard delete sections" on sections for delete to authenticated using (
  exists (select 1 from admins a where a.email = auth.email() and a.role = 'owner')
);

create policy "public can read active resources" on resources for select to public using (deleted_at is null);
create policy "staff can read all resources" on resources for select to authenticated using (
  exists (select 1 from admins a where a.email = auth.email())
);
create policy "editors can insert resources" on resources for insert to authenticated with check (
  exists (select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_edit_resources))
);
create policy "staff can update resources" on resources for update to authenticated using (
  exists (select 1 from admins a where a.email = auth.email())
) with check (
  exists (select 1 from admins a where a.email = auth.email())
);
create policy "owner can hard delete resources" on resources for delete to authenticated using (
  exists (select 1 from admins a where a.email = auth.email() and a.role = 'owner')
);

create policy "reviewers can read submissions" on submissions for select to authenticated using (
  exists (select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_review_submissions))
);
create policy "reviewers can update submissions" on submissions for update to authenticated using (
  exists (select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_review_submissions))
) with check (
  exists (select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_review_submissions))
);

create policy "public can log resource events" on resource_events for insert to public with check (
  event_type = any (array['view', 'download'])
);
create policy "analytics viewers can read events" on resource_events for select to authenticated using (
  exists (select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_view_analytics))
);

create policy "staff can read all replaced files" on replaced_files for select to authenticated using (
  exists (select 1 from admins a where a.email = auth.email())
);
create policy "editors can insert replaced files" on replaced_files for insert to authenticated with check (
  exists (select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_edit_resources))
);
create policy "owner can hard delete replaced files" on replaced_files for delete to authenticated using (
  exists (select 1 from admins a where a.email = auth.email() and a.role = 'owner')
);

insert into storage.buckets (id, name, public, file_size_limit) values ('pending-uploads', 'pending-uploads', false, 19000000)
on conflict (id) do update set file_size_limit = 19000000;

create policy "reviewers can upload pending files" on storage.objects for insert to authenticated with check (
  bucket_id = 'pending-uploads' and exists (
    select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_review_submissions)
  )
);

create policy "reviewers can overwrite pending files" on storage.objects for update to authenticated using (
  bucket_id = 'pending-uploads' and exists (
    select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_review_submissions)
  )
) with check (
  bucket_id = 'pending-uploads' and exists (
    select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_review_submissions)
  )
);

create policy "reviewers can read pending files" on storage.objects for select to authenticated using (
  bucket_id = 'pending-uploads' and exists (
    select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_review_submissions)
  )
);

create policy "reviewers can delete pending files" on storage.objects for delete to authenticated using (
  bucket_id = 'pending-uploads' and exists (
    select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_review_submissions)
  )
);

create policy "contributor managers can read submission contributors" on submission_contributors for select to authenticated using (
  exists (select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_manage_contributors))
);
create policy "contributor managers can delete submission contributors" on submission_contributors for delete to authenticated using (
  exists (select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_manage_contributors))
);

create policy "public can read active announcements" on announcements for select to public using (deleted_at is null);
create policy "settings managers can read all announcements" on announcements for select to authenticated using (
  exists (select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_manage_settings))
);
create policy "settings managers can insert announcements" on announcements for insert to authenticated with check (
  exists (select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_manage_settings))
);
create policy "settings managers can update announcements" on announcements for update to authenticated using (
  exists (select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_manage_settings))
) with check (
  exists (select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_manage_settings))
);
create policy "owner can hard delete announcements" on announcements for delete to authenticated using (
  exists (select 1 from admins a where a.email = auth.email() and a.role = 'owner')
);

create table cleanup_settings (
  id integer primary key default 1 check (id = 1),
  enabled boolean not null default true,
  run_day integer not null default 2 check (run_day between 1 and 28),
  dry_run boolean not null default true,
  skipped_months text[] not null default '{}',
  token_expires_at timestamptz,
  repo_pushed_at timestamptz,
  updated_by text,
  updated_at timestamptz not null default now()
);

insert into cleanup_settings (id) values (1) on conflict (id) do nothing;

create table history_cleanup_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('scheduled', 'fallback', 'emergency')),
  dry_run boolean not null default true,
  phase text not null default 'started',
  status text not null default 'running' check (status in ('waiting', 'running', 'succeeded', 'failed', 'rolled_back', 'aborted')),
  started_by text,
  reason text,
  run_month text,
  lock_until timestamptz,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  old_head_sha text,
  tree_sha text,
  new_head_sha text,
  backup_ref text,
  repo_size_before_kb integer,
  repo_size_after_kb integer,
  followup_done boolean not null default false,
  details jsonb not null default '{}'::jsonb,
  error text
);

create index history_cleanup_runs_started_at_idx on history_cleanup_runs(started_at desc);

alter table cleanup_settings enable row level security;
alter table history_cleanup_runs enable row level security;

create policy "admins can read cleanup settings" on cleanup_settings for select to authenticated using (
  exists (select 1 from admins a where a.email = auth.email())
);
create policy "admins can read cleanup runs" on history_cleanup_runs for select to authenticated using (
  exists (select 1 from admins a where a.email = auth.email())
);

grant select on public.cleanup_settings to authenticated;
grant select on public.history_cleanup_runs to authenticated;
grant select, insert, update, delete on public.cleanup_settings to service_role;
grant select, insert, update, delete on public.history_cleanup_runs to service_role;

create or replace function public.cleanup_schedule(p_now timestamptz default now())
returns table (run_at timestamptz, kind text, lock_start timestamptz, lock_end timestamptz, run_month text, satisfied boolean)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  s cleanup_settings%rowtype;
  base date;
  month_start date;
  i integer;
  d timestamptz;
begin
  select * into s from cleanup_settings where id = 1;
  if not found or not s.enabled then
    return;
  end if;
  base := date_trunc('month', p_now at time zone 'Asia/Kolkata')::date;
  for i in -1..1 loop
    month_start := (base + make_interval(months => i))::date;
    run_month := to_char(month_start, 'YYYY-MM');
    if run_month = any (s.skipped_months) then
      continue;
    end if;
    d := make_timestamptz(extract(year from month_start)::integer, extract(month from month_start)::integer, s.run_day, 3, 0, 0, 'Asia/Kolkata');
    run_at := d;
    kind := 'scheduled';
    lock_start := d - interval '2 hours';
    lock_end := d + interval '2 hours';
    satisfied := exists (
      select 1 from history_cleanup_runs r
      where r.run_month = cleanup_schedule.run_month and r.kind = 'scheduled' and r.status = 'succeeded'
    );
    return next;
    if p_now >= d + interval '2 hours' and not exists (
      select 1 from history_cleanup_runs r
      where r.run_month = cleanup_schedule.run_month and r.kind in ('scheduled', 'fallback') and r.status = 'succeeded'
    ) then
      run_at := d + interval '1 day';
      kind := 'fallback';
      lock_start := run_at - interval '2 hours';
      lock_end := run_at + interval '2 hours';
      satisfied := exists (
        select 1 from history_cleanup_runs r
        where r.run_month = cleanup_schedule.run_month and r.kind = 'fallback' and r.status = 'succeeded'
      );
      return next;
    end if;
  end loop;
end;
$function$;

create or replace function public.cleanup_lock_status(p_now timestamptz default now())
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  emergency history_cleanup_runs%rowtype;
  win record;
  nxt record;
  locked boolean := false;
  reason text;
  starts timestamptz;
  ends timestamptz;
  stage text := 'none';
begin
  select * into emergency from history_cleanup_runs r
  where r.kind = 'emergency' and r.status in ('waiting', 'running') and r.lock_until is not null and r.lock_until > p_now
  order by r.started_at desc limit 1;

  if found then
    locked := true;
    reason := 'emergency';
    starts := emergency.started_at;
    ends := emergency.lock_until;
  else
    select * into win from cleanup_schedule(p_now) w
    where p_now >= w.lock_start and p_now < w.lock_end and not w.satisfied
    order by w.lock_start limit 1;
    if found then
      locked := true;
      reason := win.kind;
      starts := win.lock_start;
      ends := win.lock_end;
    end if;
  end if;

  select * into nxt from cleanup_schedule(p_now) w
  where w.lock_end > p_now and not w.satisfied
  order by w.lock_start limit 1;

  if locked then
    stage := 'locked';
  elsif nxt.run_at is not null then
    if p_now >= nxt.lock_start - interval '2 hours' then
      stage := 'two_hours';
    elsif p_now >= nxt.lock_start - interval '24 hours' then
      stage := 'day_before';
    end if;
  end if;

  return jsonb_build_object(
    'locked', locked,
    'reason', reason,
    'starts_at', starts,
    'ends_at', ends,
    'stage', stage,
    'next_run_at', nxt.run_at,
    'next_kind', nxt.kind,
    'next_lock_start', nxt.lock_start,
    'next_lock_end', nxt.lock_end,
    'next_run_month', nxt.run_month
  );
end;
$function$;

create or replace function public.enforce_cleanup_lock()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  status jsonb;
begin
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;
  status := cleanup_lock_status();
  if coalesce((status ->> 'locked')::boolean, false) then
    raise exception 'The dashboard is paused for the monthly cleanup until % IST.',
      to_char((status ->> 'ends_at')::timestamptz at time zone 'Asia/Kolkata', 'HH12:MI AM')
      using errcode = 'P0423';
  end if;
  return coalesce(new, old);
end;
$function$;

create trigger trg_cleanup_lock before insert or update or delete on resources
  for each row execute function enforce_cleanup_lock();
create trigger trg_cleanup_lock before insert or update or delete on subjects
  for each row execute function enforce_cleanup_lock();
create trigger trg_cleanup_lock before insert or update or delete on sections
  for each row execute function enforce_cleanup_lock();
create trigger trg_cleanup_lock before insert or update or delete on contributors
  for each row execute function enforce_cleanup_lock();
create trigger trg_cleanup_lock before insert or update or delete on replaced_files
  for each row execute function enforce_cleanup_lock();
create trigger trg_cleanup_lock before update or delete on submissions
  for each row execute function enforce_cleanup_lock();

create or replace function public.can_control_cleanup()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from admins a
    where a.email = auth.email() and (a.role = 'owner' or a.is_developer)
  );
$function$;

create or replace function public.cleanup_status()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not exists (select 1 from admins a where a.email = auth.email()) then
    return null;
  end if;
  return cleanup_lock_status() || jsonb_build_object(
    'can_control', can_control_cleanup(),
    'settings', (select to_jsonb(s) from cleanup_settings s where s.id = 1),
    'last_run', (
      select jsonb_build_object(
        'id', r.id, 'kind', r.kind, 'dry_run', r.dry_run, 'status', r.status, 'phase', r.phase,
        'started_at', r.started_at, 'finished_at', r.finished_at, 'error', r.error,
        'repo_size_before_kb', r.repo_size_before_kb, 'repo_size_after_kb', r.repo_size_after_kb,
        'started_by', r.started_by,
        'health_ok', (r.details -> 'health' ->> 'ok')::boolean,
        'extra_refs', case when jsonb_typeof(r.details -> 'extraRefs') = 'array' then jsonb_array_length(r.details -> 'extraRefs') else 0 end
      )
      from history_cleanup_runs r order by r.started_at desc limit 1
    ),
    'last_success', (
      select jsonb_build_object(
        'finished_at', r.finished_at, 'dry_run', r.dry_run,
        'repo_size_before_kb', r.repo_size_before_kb, 'repo_size_after_kb', r.repo_size_after_kb,
        'health_ok', (r.details -> 'health' ->> 'ok')::boolean
      )
      from history_cleanup_runs r where r.status = 'succeeded' and not r.dry_run order by r.finished_at desc limit 1
    )
  );
end;
$function$;

create or replace function public.update_cleanup_settings(
  p_enabled boolean,
  p_run_day integer,
  p_dry_run boolean,
  p_skipped_months text[]
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  blocked integer[] := array[6, 10, 14, 18, 22, 26, 30];
  month_value text;
begin
  if not can_control_cleanup() then
    raise exception 'Only the owner or a developer can change the cleanup schedule.' using errcode = '42501';
  end if;
  if p_run_day is null or p_run_day < 1 or p_run_day > 28 or p_run_day = any (blocked) or (p_run_day + 1) = any (blocked) then
    raise exception 'That day overlaps the regular trash purge dates.' using errcode = '22023';
  end if;
  foreach month_value in array coalesce(p_skipped_months, '{}') loop
    if month_value !~ '^\d{4}-(0[1-9]|1[0-2])$' then
      raise exception 'Invalid month: %', month_value using errcode = '22023';
    end if;
  end loop;
  update cleanup_settings
  set enabled = coalesce(p_enabled, enabled),
      run_day = p_run_day,
      dry_run = coalesce(p_dry_run, dry_run),
      skipped_months = coalesce(p_skipped_months, '{}'),
      updated_by = auth.email(),
      updated_at = now()
  where id = 1;
end;
$function$;

create trigger trg_cleanup_settings_audit after insert or update or delete on cleanup_settings
  for each row execute function log_audit_event();

revoke execute on function public.cleanup_schedule(timestamptz) from public, anon, authenticated;
revoke execute on function public.cleanup_lock_status(timestamptz) from public, anon, authenticated;
revoke execute on function public.enforce_cleanup_lock() from public, anon, authenticated;
revoke execute on function public.can_control_cleanup() from public, anon;
revoke execute on function public.cleanup_status() from public, anon;
revoke execute on function public.update_cleanup_settings(boolean, integer, boolean, text[]) from public, anon;
grant execute on function public.cleanup_schedule(timestamptz) to service_role;
grant execute on function public.cleanup_lock_status(timestamptz) to service_role;
grant execute on function public.can_control_cleanup() to authenticated, service_role;
grant execute on function public.cleanup_status() to authenticated;
grant execute on function public.update_cleanup_settings(boolean, integer, boolean, text[]) to authenticated;

create or replace function public.mark_tutorial_viewed()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update admins set viewed_tutorial = true where email = auth.email() and viewed_tutorial = false;
end;
$function$;

revoke execute on function public.mark_tutorial_viewed() from public, anon;
grant execute on function public.mark_tutorial_viewed() to authenticated;
