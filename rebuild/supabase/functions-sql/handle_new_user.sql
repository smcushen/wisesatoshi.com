CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  norm_email text := public.normalize_email(new.email);
  seen_before boolean;
  is_disposable boolean;
  granted_trial interval := interval '7 days';
begin
  select exists(
    select 1 from public.profiles where normalized_email = norm_email
  ) into seen_before;

  select exists(
    select 1 from public.disposable_email_domains
    where domain = split_part(lower(new.email), '@', 2)
  ) into is_disposable;

  if seen_before or is_disposable then
    granted_trial := interval '0 seconds';
  end if;

  insert into public.profiles (id, trial_ends_at, normalized_email)
  values (new.id, now() + granted_trial, norm_email);

  return new;
end;
$function$
