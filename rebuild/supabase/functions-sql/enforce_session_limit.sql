CREATE OR REPLACE FUNCTION public.enforce_session_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'auth', 'public'
AS $function$
begin
  delete from auth.sessions s
  where s.user_id = new.user_id
    and s.id not in (
      select id
      from auth.sessions
      where user_id = new.user_id
      order by created_at desc
      limit 2
    );
  return new;
end;
$function$
