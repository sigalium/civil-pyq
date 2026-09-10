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
  file_size_bytes bigint
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

revoke execute on function public.purge_expired_trash() from public, authenticated, anon;
grant execute on function public.purge_expired_trash() to service_role;

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

alter table admins enable row level security;
alter table audit_log enable row level security;
alter table contributors enable row level security;
alter table global_resources enable row level security;
alter table subjects enable row level security;
alter table sections enable row level security;
alter table resources enable row level security;
alter table submissions enable row level security;
alter table resource_events enable row level security;

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
    or (a.is_developer and key in ('maintenance_mode', 'maintenance_until', 'maintenance_message', 'maintenance_auto_off'))
    or (a.can_manage_settings and key = 'submission_intake_enabled')
    or (a.can_edit_resources and key not in ('analytics_demo_mode', 'maintenance_mode', 'maintenance_until', 'maintenance_message', 'maintenance_auto_off', 'submission_intake_enabled'))
  ))
);
create policy "editors can update site settings" on global_resources for update to authenticated using (
  exists (select 1 from admins a where a.email = auth.email() and (
    a.role = 'owner'
    or (a.is_developer and key in ('maintenance_mode', 'maintenance_until', 'maintenance_message', 'maintenance_auto_off'))
    or (a.can_manage_settings and key = 'submission_intake_enabled')
    or (a.can_edit_resources and key not in ('analytics_demo_mode', 'maintenance_mode', 'maintenance_until', 'maintenance_message', 'maintenance_auto_off', 'submission_intake_enabled'))
  ))
) with check (
  exists (select 1 from admins a where a.email = auth.email() and (
    a.role = 'owner'
    or (a.is_developer and key in ('maintenance_mode', 'maintenance_until', 'maintenance_message', 'maintenance_auto_off'))
    or (a.can_manage_settings and key = 'submission_intake_enabled')
    or (a.can_edit_resources and key not in ('analytics_demo_mode', 'maintenance_mode', 'maintenance_until', 'maintenance_message', 'maintenance_auto_off', 'submission_intake_enabled'))
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

insert into storage.buckets (id, name, public) values ('pending-uploads', 'pending-uploads', false)
on conflict (id) do nothing;

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
