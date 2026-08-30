-- Incrémente le compteur mensuel de transcriptions IA. Appelée uniquement
-- par la fonction edge `ocr` (clé de service), jamais par l'application.
create function increment_ai_usage(p_user_id uuid, p_month text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into ai_usage (user_id, month, count)
  values (p_user_id, p_month, 1)
  on conflict (user_id, month)
  do update set count = ai_usage.count + 1;
end;
$$;

revoke execute on function increment_ai_usage(uuid, text) from anon, authenticated;
