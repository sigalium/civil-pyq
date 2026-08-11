create table if not exists admins (
  email text primary key,
  username text,
  role text not null default 'admin' check (role in ('owner', 'admin')),
  is_faculty boolean not null default false,
  can_review_submissions boolean not null default false,
  can_edit_resources boolean not null default false,
  can_delete_resources boolean not null default false,
  can_view_trash boolean not null default false,
  can_view_audit_log boolean not null default false,
  can_view_members boolean not null default false,
  can_manage_contributors boolean not null default false,
  can_edit_members boolean not null default false,
  added_by text,
  created_at timestamptz not null default now()
);

alter table admins add column if not exists is_faculty boolean not null default false;

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  local_id text not null,
  student_name text,
  semester int not null,
  subject text not null,
  resource_type text not null check (resource_type in ('pyq', 'lab', 'syllabus')),
  resource_label text not null,
  file_path text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by text,
  reviewed_at timestamptz,
  is_gcu_student boolean not null default true,
  enrollment_no text,
  institution text,
  uploader_semester int,
  submitter_ip text
);

create index if not exists submissions_submitter_ip_created_at_idx on submissions (submitter_ip, created_at);

create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  semester int not null,
  name text not null,
  is_elective boolean not null default false,
  sort_order int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (semester, name)
);

create table if not exists resources (
  id uuid primary key default gen_random_uuid(),
  semester int not null,
  subject text not null,
  resource_type text not null check (resource_type in ('pyq', 'lab', 'syllabus')),
  name text not null,
  path text not null,
  sort_order int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists contributors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role_type text not null check (role_type in ('student', 'faculty')),
  batch_year text,
  department text,
  profile_pic text,
  is_top_contributor boolean not null default false,
  sort_order int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists global_resources (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_email text not null,
  action text not null,
  table_name text not null,
  record_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

alter table admins enable row level security;
alter table submissions enable row level security;
alter table subjects enable row level security;
alter table resources enable row level security;
alter table contributors enable row level security;
alter table global_resources enable row level security;
alter table audit_log enable row level security;

insert into storage.buckets (id, name, public)
values ('pending-uploads', 'pending-uploads', false)
on conflict (id) do nothing;

update storage.buckets
set file_size_limit = 26214400,
    allowed_mime_types = array['application/pdf']
where id = 'pending-uploads';

create or replace function is_owner()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from admins a where lower(a.email) = lower(auth.email()) and a.role = 'owner'
  );
$$;

create or replace function can_view_members_list()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from admins a where lower(a.email) = lower(auth.email())
      and (a.role = 'owner' or a.can_view_members = true or a.can_edit_members = true)
  );
$$;

create or replace function can_edit_members_list()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from admins a where lower(a.email) = lower(auth.email())
      and (a.role = 'owner' or a.can_edit_members = true)
  );
$$;

drop policy if exists "self admin check" on admins;
drop policy if exists "members list visible to permitted staff" on admins;
do $$
begin
  create policy "members list visible to permitted staff"
on admins
for select
to authenticated
using (can_view_members_list());
exception when duplicate_object then null;
end $$;

drop policy if exists "owners can add admins" on admins;
drop policy if exists "permitted staff can add admins" on admins;
do $$
begin
  create policy "permitted staff can add admins"
on admins
for insert
to authenticated
with check (role = 'admin' and can_edit_members_list());
exception when duplicate_object then null;
end $$;

drop policy if exists "owners can edit admins" on admins;
drop policy if exists "permitted staff can edit admins" on admins;
do $$
begin
  create policy "permitted staff can edit admins"
on admins
for update
to authenticated
using (role = 'admin' and can_edit_members_list())
with check (role = 'admin');
exception when duplicate_object then null;
end $$;

drop policy if exists "owners can remove admins" on admins;
drop policy if exists "permitted staff can remove admins" on admins;
do $$
begin
  create policy "permitted staff can remove admins"
on admins
for delete
to authenticated
using (role = 'admin' and can_edit_members_list());
exception when duplicate_object then null;
end $$;

drop policy if exists "anon can submit" on submissions;
drop policy if exists "admins can read submissions" on submissions;
drop policy if exists "admins can update submissions" on submissions;
drop policy if exists "reviewers can read submissions" on submissions;
drop policy if exists "reviewers can update submissions" on submissions;

do $$
begin
  create policy "reviewers can read submissions"
on submissions for select
to authenticated
using (exists (select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_review_submissions)));
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "reviewers can update submissions"
on submissions for update
to authenticated
using (exists (select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_review_submissions)))
with check (exists (select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_review_submissions)));
exception when duplicate_object then null;
end $$;

drop policy if exists "anon can upload pending files" on storage.objects;
drop policy if exists "admins can read pending files" on storage.objects;
drop policy if exists "admins can delete pending files" on storage.objects;
drop policy if exists "reviewers can read pending files" on storage.objects;
drop policy if exists "reviewers can delete pending files" on storage.objects;

do $$
begin
  create policy "reviewers can read pending files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'pending-uploads'
  and exists (select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_review_submissions))
);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "reviewers can delete pending files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'pending-uploads'
  and exists (select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_review_submissions))
);
exception when duplicate_object then null;
end $$;

drop policy if exists "public can read subjects" on subjects;
drop policy if exists "admins can insert subjects" on subjects;
drop policy if exists "admins can update subjects" on subjects;
drop policy if exists "admins can delete subjects" on subjects;
drop policy if exists "public can read active subjects" on subjects;
drop policy if exists "staff can read all subjects" on subjects;
drop policy if exists "editors can insert subjects" on subjects;
drop policy if exists "staff can update subjects" on subjects;
drop policy if exists "owner can hard delete subjects" on subjects;

do $$
begin
  create policy "public can read active subjects"
on subjects for select
using (deleted_at is null);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "staff can read all subjects"
on subjects for select
to authenticated
using (exists (select 1 from admins a where a.email = auth.email()));
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "editors can insert subjects"
on subjects for insert
to authenticated
with check (exists (select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_edit_resources)));
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "staff can update subjects"
on subjects for update
to authenticated
using (exists (select 1 from admins a where a.email = auth.email()))
with check (exists (select 1 from admins a where a.email = auth.email()));
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "owner can hard delete subjects"
on subjects for delete
to authenticated
using (exists (select 1 from admins a where a.email = auth.email() and a.role = 'owner'));
exception when duplicate_object then null;
end $$;

drop policy if exists "public can read resources" on resources;
drop policy if exists "admins can insert resources" on resources;
drop policy if exists "admins can update resources" on resources;
drop policy if exists "admins can delete resources" on resources;
drop policy if exists "public can read active resources" on resources;
drop policy if exists "staff can read all resources" on resources;
drop policy if exists "editors can insert resources" on resources;
drop policy if exists "staff can update resources" on resources;
drop policy if exists "owner can hard delete resources" on resources;

do $$
begin
  create policy "public can read active resources"
on resources for select
using (deleted_at is null);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "staff can read all resources"
on resources for select
to authenticated
using (exists (select 1 from admins a where a.email = auth.email()));
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "editors can insert resources"
on resources for insert
to authenticated
with check (exists (select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_edit_resources)));
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "staff can update resources"
on resources for update
to authenticated
using (exists (select 1 from admins a where a.email = auth.email()))
with check (exists (select 1 from admins a where a.email = auth.email()));
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "owner can hard delete resources"
on resources for delete
to authenticated
using (exists (select 1 from admins a where a.email = auth.email() and a.role = 'owner'));
exception when duplicate_object then null;
end $$;

drop policy if exists "public can read active contributors" on contributors;
do $$
begin
  create policy "public can read active contributors"
on contributors for select
using (deleted_at is null);
exception when duplicate_object then null;
end $$;

drop policy if exists "staff can read all contributors" on contributors;
do $$
begin
  create policy "staff can read all contributors"
on contributors for select
to authenticated
using (exists (select 1 from admins a where a.email = auth.email()));
exception when duplicate_object then null;
end $$;

drop policy if exists "contributor managers can insert" on contributors;
do $$
begin
  create policy "contributor managers can insert"
on contributors for insert
to authenticated
with check (exists (select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_manage_contributors)));
exception when duplicate_object then null;
end $$;

drop policy if exists "contributor managers can update" on contributors;
do $$
begin
  create policy "contributor managers can update"
on contributors for update
to authenticated
using (exists (select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_manage_contributors)))
with check (exists (select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_manage_contributors)));
exception when duplicate_object then null;
end $$;

drop policy if exists "owner can hard delete contributors" on contributors;
do $$
begin
  create policy "owner can hard delete contributors"
on contributors for delete
to authenticated
using (exists (select 1 from admins a where a.email = auth.email() and a.role = 'owner'));
exception when duplicate_object then null;
end $$;

drop policy if exists "public can read site settings" on global_resources;
do $$
begin
  create policy "public can read site settings"
on global_resources for select
using (true);
exception when duplicate_object then null;
end $$;

drop policy if exists "editors can upsert site settings" on global_resources;
do $$
begin
  create policy "editors can upsert site settings"
on global_resources for insert
to authenticated
with check (exists (select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_edit_resources)));
exception when duplicate_object then null;
end $$;

drop policy if exists "editors can update site settings" on global_resources;
do $$
begin
  create policy "editors can update site settings"
on global_resources for update
to authenticated
using (exists (select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_edit_resources)))
with check (exists (select 1 from admins a where a.email = auth.email() and (a.role = 'owner' or a.can_edit_resources)));
exception when duplicate_object then null;
end $$;

drop policy if exists "permitted staff can read audit log" on audit_log;
do $$
begin
  create policy "permitted staff can read audit log"
on audit_log
for select
to authenticated
using (
  exists (
    select 1 from admins a
    where a.email = auth.email()
    and (a.role = 'owner' or a.can_view_audit_log = true)
  )
);
exception when duplicate_object then null;
end $$;

drop policy if exists "owner can delete audit log" on audit_log;
do $$
begin
  create policy "owner can delete audit log"
on audit_log
for delete
to authenticated
using (
  exists (
    select 1 from admins a
    where a.email = auth.email()
    and a.role = 'owner'
  )
);
exception when duplicate_object then null;
end $$;

create or replace function log_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
$$;

create or replace function log_admin_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
$$;

create or replace function log_global_resources_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
$$;

drop trigger if exists trg_admins_audit on admins;
create trigger trg_admins_audit
after insert or update or delete on admins
for each row execute function log_admin_audit_event();

drop trigger if exists trg_resources_audit on resources;
drop trigger if exists trg_resources_audit_insert on resources;
drop trigger if exists trg_resources_audit_delete on resources;
drop trigger if exists trg_resources_audit_update on resources;

create trigger trg_resources_audit_insert
after insert on resources
for each row execute function log_audit_event();

create trigger trg_resources_audit_delete
after delete on resources
for each row execute function log_audit_event();

create trigger trg_resources_audit_update
after update on resources
for each row
when ((to_jsonb(new) - 'sort_order' - 'updated_at') is distinct from (to_jsonb(old) - 'sort_order' - 'updated_at'))
execute function log_audit_event();

drop trigger if exists trg_subjects_audit on subjects;
drop trigger if exists trg_subjects_audit_insert on subjects;
drop trigger if exists trg_subjects_audit_delete on subjects;
drop trigger if exists trg_subjects_audit_update on subjects;

create trigger trg_subjects_audit_insert
after insert on subjects
for each row execute function log_audit_event();

create trigger trg_subjects_audit_delete
after delete on subjects
for each row execute function log_audit_event();

create trigger trg_subjects_audit_update
after update on subjects
for each row
when ((to_jsonb(new) - 'sort_order') is distinct from (to_jsonb(old) - 'sort_order'))
execute function log_audit_event();

drop trigger if exists trg_contributors_audit on contributors;
drop trigger if exists trg_contributors_audit_insert on contributors;
drop trigger if exists trg_contributors_audit_delete on contributors;
drop trigger if exists trg_contributors_audit_update on contributors;

create trigger trg_contributors_audit_insert
after insert on contributors
for each row execute function log_audit_event();

create trigger trg_contributors_audit_delete
after delete on contributors
for each row execute function log_audit_event();

create trigger trg_contributors_audit_update
after update on contributors
for each row
when ((to_jsonb(new) - 'sort_order') is distinct from (to_jsonb(old) - 'sort_order'))
execute function log_audit_event();

drop trigger if exists trg_submissions_audit on submissions;
create trigger trg_submissions_audit
after insert or update on submissions
for each row execute function log_audit_event();

drop trigger if exists trg_settings_audit on global_resources;
drop trigger if exists trg_global_resources_audit on global_resources;
create trigger trg_global_resources_audit
after insert or update or delete on global_resources
for each row execute function log_global_resources_audit_event();

create or replace function enforce_subjects_update_permission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_owner_ boolean;
  can_edit boolean;
  can_delete boolean;
  only_trash_change boolean;
begin
  select (a.role = 'owner'), a.can_edit_resources, a.can_delete_resources
    into is_owner_, can_edit, can_delete
  from admins a where a.email = auth.email();

  if coalesce(is_owner_, false) then
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
$$;

drop trigger if exists trg_subjects_update_permission on subjects;
create trigger trg_subjects_update_permission
before update on subjects
for each row execute function enforce_subjects_update_permission();

create or replace function enforce_resources_update_permission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_owner_ boolean;
  can_edit boolean;
  can_delete boolean;
  only_trash_change boolean;
begin
  select (a.role = 'owner'), a.can_edit_resources, a.can_delete_resources
    into is_owner_, can_edit, can_delete
  from admins a where a.email = auth.email();

  if coalesce(is_owner_, false) then
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
$$;

drop trigger if exists trg_resources_update_permission on resources;
create trigger trg_resources_update_permission
before update on resources
for each row execute function enforce_resources_update_permission();

create or replace function purge_expired_trash()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from resources where deleted_at is not null and deleted_at < now() - interval '30 days';
  delete from subjects where deleted_at is not null and deleted_at < now() - interval '30 days';
  delete from contributors where deleted_at is not null and deleted_at < now() - interval '30 days';
end;
$$;

revoke execute on function purge_expired_trash() from public, anon, authenticated;
grant execute on function purge_expired_trash() to service_role;

insert into global_resources (key, value)
values ('academic_calendar_path', 'https://cdn.jsdelivr.net/gh/sigalium/civil-pyq-pdf@index/pdfs/Academic_Calendar_2025-2026.pdf')
on conflict (key) do nothing;

insert into global_resources (key, value, updated_at)
select 'syllabus_semester_1', 'https://cdn.jsdelivr.net/gh/sigalium/civil-pyq-pdf@index/pdfs/Semester1/Syllabus.pdf', now()
where not exists (select 1 from global_resources where key = 'syllabus_semester_1');

insert into global_resources (key, value, updated_at)
select 'syllabus_semester_2', 'https://cdn.jsdelivr.net/gh/sigalium/civil-pyq-pdf@index/pdfs/Semester2/Syllabus.pdf', now()
where not exists (select 1 from global_resources where key = 'syllabus_semester_2');

insert into global_resources (key, value, updated_at)
select 'syllabus_semester_3', 'https://cdn.jsdelivr.net/gh/sigalium/civil-pyq-pdf@index/pdfs/Semester3/Syllabus.pdf', now()
where not exists (select 1 from global_resources where key = 'syllabus_semester_3');

insert into global_resources (key, value, updated_at)
select 'syllabus_semester_4', 'https://cdn.jsdelivr.net/gh/sigalium/civil-pyq-pdf@index/pdfs/Semester4/Syllabus.pdf', now()
where not exists (select 1 from global_resources where key = 'syllabus_semester_4');

insert into global_resources (key, value, updated_at)
select 'syllabus_semester_5', 'https://cdn.jsdelivr.net/gh/sigalium/civil-pyq-pdf@index/pdfs/Semester5/Syllabus.pdf', now()
where not exists (select 1 from global_resources where key = 'syllabus_semester_5');

insert into global_resources (key, value, updated_at)
select 'syllabus_semester_6', 'https://cdn.jsdelivr.net/gh/sigalium/civil-pyq-pdf@index/pdfs/Semester6/Syllabus.pdf', now()
where not exists (select 1 from global_resources where key = 'syllabus_semester_6');

insert into resources (semester, subject, resource_type, name, path, sort_order)
select 3, 'Mathematics III', 'syllabus', 'Syllabus',
  'https://cdn.jsdelivr.net/gh/sigalium/civil-pyq-pdf@index/pdfs/Semester3/Mathematics III/Syllabus.pdf', 0
where not exists (
  select 1 from resources where subject = 'Mathematics III' and semester = 3 and resource_type = 'syllabus' and deleted_at is null
);

insert into resources (semester, subject, resource_type, name, path, sort_order)
select 3, 'IKS', 'syllabus', 'Syllabus',
  'https://cdn.jsdelivr.net/gh/sigalium/civil-pyq-pdf@index/pdfs/Semester3/IKS/Syllabus.pdf', 0
where not exists (
  select 1 from resources where subject = 'IKS' and semester = 3 and resource_type = 'syllabus' and deleted_at is null
);

insert into admins (email, username, role, can_review_submissions, can_edit_resources, can_delete_resources, can_view_trash, can_view_audit_log, can_view_members, can_manage_contributors, can_edit_members)
values ('piku007.bhuyan@gmail.com', 'Piku', 'owner', true, true, true, true, true, true, true, true)
on conflict (email) do update set
  role = 'owner',
  can_review_submissions = true,
  can_edit_resources = true,
  can_delete_resources = true,
  can_view_trash = true,
  can_view_audit_log = true,
  can_view_members = true,
  can_manage_contributors = true,
  can_edit_members = true;

notify pgrst, 'reload schema';
