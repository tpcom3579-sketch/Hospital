begin;

create function public.delete_service_record(p_record_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_record public.service_records%rowtype;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Admin role required';
  end if;

  if p_record_id is null or p_record_id < 1 then
    raise exception using errcode = '22023', message = 'Invalid service record id';
  end if;

  select service_row.*
  into v_record
  from public.service_records as service_row
  where service_row.id = p_record_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Service record not found';
  end if;

  insert into public.audit_logs (user_id, action, target, before_json)
  values (
    (select auth.uid()),
    'service_record_deleted',
    p_record_id::text,
    pg_catalog.jsonb_build_object(
      'student_id', v_record.student_id,
      'service_datetime', v_record.service_datetime,
      'academic_record_id', v_record.academic_record_id
    )
  );

  delete from public.service_records
  where id = p_record_id;
end;
$$;

revoke all on function public.delete_service_record(bigint) from public, anon, authenticated;
grant execute on function public.delete_service_record(bigint) to authenticated;

commit;
