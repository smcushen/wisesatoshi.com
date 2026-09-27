CREATE OR REPLACE FUNCTION public.normalize_email(raw_email text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case
    when split_part(lower(raw_email), '@', 2) in ('gmail.com', 'googlemail.com')
      then regexp_replace(split_part(split_part(lower(raw_email), '@', 1), '+', 1), '\.', '', 'g')
           || '@gmail.com'
    else split_part(split_part(lower(raw_email), '@', 1), '+', 1)
         || '@' || split_part(lower(raw_email), '@', 2)
  end;
$function$
