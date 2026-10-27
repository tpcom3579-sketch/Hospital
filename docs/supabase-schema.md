# Supabase Schema Design

## 1. Architecture Overview

This system is designed with a relational model because the project needs:
- student identity lookup by Student_ID
- multi-item service records
- import and duplicate review
- history filtering and exports
- report aggregation from raw service records
- auditability and security

Recommended stack:
- Supabase PostgreSQL database
- Supabase Auth
- Supabase Storage for XLSX uploads
- RLS (Row Level Security) for access control
- Frontend can call Supabase REST API or server API layer

## 2. Core Business Rules

- `student_id` is the primary key for a student and remains text so leading zeroes are preserved.
- Name, surname, number, and class are not used as unique identifiers.
- A student may have many service records over time.
- A service record may contain multiple items.
- A service item may belong to a symptom group or note group.
- Report data is calculated from raw service records, not separate stored stats.
- Historical service records must remain even if the student is removed from the current student list.

## 3. Assumptions

- Auth will use Supabase Auth with admin staff roles.
- Public student lookup and submission are handled by Supabase Edge Functions; the anon client gets no direct table access.
- Student academic history is tracked in `student_academic_records` by `student_id + academic_year`.
- Exactly one academic record per student may be active at a time; service records reference the academic record active at the visit.
- `service_record_items` stores item selections with optional `other_detail` for the OTHER note.
- `service_item_types` is the master catalog for all symptoms and notes.

## 4. Tables

### 4.1 `students`
Stores the current canonical student record and identity.

```sql
create table public.students (
  student_id text primary key check (student_id ~ '^[0-9]{5}$'),
  current_status text not null default 'ปกติ'
    check (current_status in ('ปกติ', 'ติดตาม', 'ลาพัก')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Notes:
- `student_id` is the unique external key used by student-facing flows.
- `current_status` uses the UI values `ปกติ`, `ติดตาม`, and `ลาพัก`.

### 4.2 `student_academic_records`
Stores academic history and classroom membership across years.

```sql
create table public.student_academic_records (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(student_id),
  academic_year text not null,
  number int,
  sex text not null check (sex in ('ชาย', 'หญิง')),
  name text not null,
  surname text not null,
  class text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id, academic_year),
  unique(id, student_id)
);

create unique index student_academic_records_one_active_per_student
  on public.student_academic_records(student_id) where is_active;
```

Notes:
- Academic year history is retained; older records are not overwritten.
- This prevents data loss when a student moves classes or years.

### 4.3 `service_records`
Each row represents one service visit.

```sql
create table public.service_records (
  id bigserial primary key,
  service_datetime timestamptz not null default now(),
  student_id text not null references public.students(student_id),
  academic_record_id uuid not null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (academic_record_id, student_id)
    references public.student_academic_records(id, student_id)
);
```

Notes:
- Minimal record data is intentionally retained.
- Name, surname, sex, class, number are not stored in this table.

### 4.4 `service_item_types`
Master catalog of all selectable service items.

```sql
create table public.service_item_types (
  id serial primary key,
  group_name text not null check (group_name in ('symptom', 'note')),
  code text not null unique,
  name text not null,
  display_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
```

Example values:
- `headache_fever` / symptom
- `runny_nose` / symptom
- `rest` / note
- `accident` / note
- `other` / note

### 4.5 `service_record_items`
Maps a service record to a selected item.

```sql
create table public.service_record_items (
  id bigserial primary key,
  record_id bigint not null references public.service_records(id) on delete cascade,
  item_id int not null references public.service_item_types(id),
  other_detail text,
  created_at timestamptz not null default now()
);
```

Notes:
- Multi-select is handled by multiple rows per record.
- `other_detail` is populated only when item is the OTHER note item.

### 4.6 `users`
Admin/staff identity.

```sql
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  role text not null default 'admin' check (role in ('admin', 'staff')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Notes:
- `username` is not the same as `student_id`.
- Use Supabase Auth as source of credential login.

### 4.7 `audit_logs`
Tracks important change events.

```sql
create table public.audit_logs (
  id bigserial primary key,
  user_id uuid references auth.users(id),
  action text not null,
  target text not null,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);
```

Notes:
- Records important admin actions such as import, duplicate resolution, modifications to student records.

## 5. Recommended Seed Data

Seed `service_item_types` with all required school nurse items:

```sql
insert into public.service_item_types (group_name, code, name, display_order)
values
  ('symptom', 'headache_fever', 'ปวดหัว/เป็นไข้', 1),
  ('symptom', 'menstrual_pain', 'ปวดรอบเดือน', 2),
  ('symptom', 'stomach_pain', 'ปวดท้อง/แสบร้อน', 3),
  ('symptom', 'bloating', 'ปวดท้องอืดเฟ้อ', 4),
  ('symptom', 'diarrhea', 'ท้องเสีย', 5),
  ('symptom', 'nausea_vomit', 'คลื่นไส้/อาเจียน', 6),
  ('symptom', 'runny_nose', 'น้ำมูก/แพ้อากาศ', 7),
  ('symptom', 'cough_phlegm', 'แก้ไอเสมหะ', 8),
  ('symptom', 'allergic_rash', 'แพ้ผื่นคัน/แมลงต่อย', 9),
  ('symptom', 'massage_cool', 'ปวดนวด/ประคบ', 10),
  ('symptom', 'eye_rinse', 'ล้างตา/ตาแดง', 11),
  ('symptom', 'insect_bite', 'แมลงกัดต่อย', 12),
  ('symptom', 'wound_care', 'ทำแผล', 13),
  ('note', 'rest', 'นอนพัก', 14),
  ('note', 'go_home', 'กลับบ้าน', 15),
  ('note', 'accident', 'อุบัติเหตุ', 16),
  ('note', 'send_hospital', 'ส่ง รพ.', 17),
  ('note', 'other', 'อื่นๆ', 18);
```

## 6. Helper Views

### `v_student_current_profile`
Use a view to join current academic record with student identity.

```sql
create view public.v_student_current_profile as
select
  s.student_id,
  s.current_status,
  sar.academic_year,
  sar.number,
  sar.sex,
  sar.name,
  sar.surname,
  sar.class
from public.students s
left join public.student_academic_records sar
  on s.student_id = sar.student_id
where sar.is_active = true;
```

### `v_service_record_detail`
Used by history/export/report logic.

```sql
create view public.v_service_record_detail as
select
  sr.id,
  sr.service_datetime,
  sr.student_id,
  array_agg(sit.name order by sit.display_order) as selected_items,
  string_agg(coalesce(sri.other_detail, ''), ' | ') as other_detail
from public.service_records sr
left join public.service_record_items sri on sri.record_id = sr.id
left join public.service_item_types sit on sit.id = sri.item_id
group by sr.id, sr.service_datetime, sr.student_id;
```

## 7. Row Level Security (RLS)

The initial migration enables RLS on every application table. Authenticated staff can read operational data; admin-only policies control student/catalog writes and audit-log reads. The `anon` role receives no table grants. Public workflows must use Edge Functions, which call narrowly granted database functions using the server-side service role.

Recommended policy summary:

- `students` table: admin/staff can read, public cannot read list
- `student_academic_records`: staff can read; admin can write
- `service_records`: staff can read; service-record writes go through the server-side submission function
- `service_record_items`: staff can read; service-record writes go through the server-side submission function
- Deleting a service record: admin-only `delete_service_record` RPC; the database records the deletion in `audit_logs`, and related item rows are removed by the foreign-key cascade
- `users`: only admin/staff can read own profile and list if allowed
- `audit_logs`: admin only

Example policy concept (the migration contains the complete policies):

```sql
alter table public.students enable row level security;

create policy "Admin can read all students"
on public.students
for select
using (public.is_staff());
```

## 8. API Contract Summary

### Student public flows
- Supabase Edge Function `student-lookup` -> find a student by `student_id`, returning only the confirmation fields
- Supabase Edge Function `service-submit` -> invoke the atomic record-creation database function

### Admin flows
- Sign in with Supabase Auth; the `users` row supplies the active role and display name
- Authenticated Supabase queries/RPCs for dashboard, students, history, export, and reports
- Edge Functions for import preview/confirm and other workflows that need file parsing or multi-step server validation

## 9. Import Rules to Enforce

Validate each row before insert:
- required columns present
- Student_ID is non-empty and 5-digit numeric string
- Student_ID uniqueness within file
- Student_ID uniqueness in database
- Name and surname non-empty
- class non-empty
- sex valid
- reject invalid rows with row/column/error details

Duplicate statuses:
- NEW
- DUPLICATE_SAME
- DUPLICATE_CHANGED
- INVALID

## 10. Transaction Rules

The initial migration includes `create_service_record`, which validates the active student, item codes, duplicates, and OTHER detail, then inserts the record and selected items in one database transaction. On import:
- parse file
- validate rows
- mark duplicates
- create preview
- only on confirm, start database transaction
- insert new student records and academic records as needed
- insert service imports only if applicable
- commit atomically

## 11. Next Step

The next implementation step is to create:
1. SQL migration files for these tables
2. Supabase RLS example policies
3. API contract documentation
4. service layer design
5. mock repository implementation mapped to this schema

This gives a safe foundation before building frontend/backend integration.
