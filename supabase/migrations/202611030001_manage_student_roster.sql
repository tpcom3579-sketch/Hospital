begin;

alter table public.student_academic_records
  drop constraint student_academic_records_student_id_fkey,
  add constraint student_academic_records_student_id_fkey
    foreign key (student_id) references public.students(student_id)
    on update cascade on delete restrict;

alter table public.service_records
  drop constraint service_records_student_id_fkey,
  add constraint service_records_student_id_fkey
    foreign key (student_id) references public.students(student_id)
    on update cascade on delete restrict,
  drop constraint service_records_academic_student_fk,
  add constraint service_records_academic_student_fk
    foreign key (academic_record_id, student_id)
    references public.student_academic_records(id, student_id)
    on update cascade on delete restrict;

create function public.update_student_academic_record(
  p_original_student_id text,
  p_student_id text,
  p_number integer,
  p_sex text,
  p_name text,
  p_surname text,
  p_class text,
  p_academic_year text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Admin role required';
  end if;

  if p_original_student_id is null or p_original_student_id !~ '^[0-9]{5}$'
    or p_student_id is null or p_student_id !~ '^[0-9]{5}$'
    or p_number is null or p_number < 1
    or p_sex is null or p_sex not in ('ชาย', 'หญิง')
    or p_name is null or pg_catalog.length(pg_catalog.btrim(p_name)) = 0
    or p_surname is null or pg_catalog.length(pg_catalog.btrim(p_surname)) = 0
    or p_class is null or pg_catalog.length(pg_catalog.btrim(p_class)) = 0
    or p_academic_year is null or p_academic_year !~ '^[0-9]{4}$' then
    raise exception using errcode = '22023', message = 'Invalid student data';
  end if;

  perform 1
  from public.students
  where student_id = p_original_student_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Student not found';
  end if;

  select pg_catalog.jsonb_build_object(
    'student_id', academic.student_id,
    'number', academic.number,
    'sex', academic.sex,
    'name', academic.name,
    'surname', academic.surname,
    'class', academic.class,
    'academic_year', academic.academic_year
  )
  into v_before
  from public.student_academic_records as academic
  where academic.student_id = p_original_student_id
    and academic.is_active
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Active student record not found';
  end if;

  update public.students
  set student_id = p_student_id,
      updated_at = pg_catalog.now()
  where student_id = p_original_student_id;

  update public.student_academic_records
  set number = p_number,
      sex = p_sex,
      name = pg_catalog.btrim(p_name),
      surname = pg_catalog.btrim(p_surname),
      class = pg_catalog.btrim(p_class),
      academic_year = p_academic_year,
      updated_at = pg_catalog.now()
  where student_id = p_student_id
    and is_active;

  insert into public.audit_logs (user_id, action, target, before_json, after_json)
  values (
    (select auth.uid()),
    'student_academic_record_updated',
    p_student_id,
    v_before,
    pg_catalog.jsonb_build_object(
      'student_id', p_student_id,
      'number', p_number,
      'sex', p_sex,
      'name', pg_catalog.btrim(p_name),
      'surname', pg_catalog.btrim(p_surname),
      'class', pg_catalog.btrim(p_class),
      'academic_year', p_academic_year
    )
  );
end;
$$;

create function public.remove_student_from_roster(p_student_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Admin role required';
  end if;

  if p_student_id is null or p_student_id !~ '^[0-9]{5}$' then
    raise exception using errcode = '22023', message = 'Invalid student id';
  end if;

  perform 1
  from public.student_academic_records
  where student_id = p_student_id and is_active
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Active student record not found';
  end if;

  select pg_catalog.jsonb_build_object(
    'student_id', academic.student_id,
    'number', academic.number,
    'sex', academic.sex,
    'name', academic.name,
    'surname', academic.surname,
    'class', academic.class,
    'academic_year', academic.academic_year
  )
  into v_before
  from public.student_academic_records as academic
  where academic.student_id = p_student_id and academic.is_active;

  update public.student_academic_records
  set is_active = false,
      updated_at = pg_catalog.now()
  where student_id = p_student_id
    and is_active;

  insert into public.audit_logs (user_id, action, target, before_json)
  values (
    (select auth.uid()),
    'student_removed_from_roster',
    p_student_id,
    v_before
  );
end;
$$;

revoke all on function public.update_student_academic_record(text, text, integer, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.update_student_academic_record(text, text, integer, text, text, text, text, text)
  to authenticated;

revoke all on function public.remove_student_from_roster(text)
  from public, anon, authenticated;
grant execute on function public.remove_student_from_roster(text)
  to authenticated;

commit;
