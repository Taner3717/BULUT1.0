-- Fotoğraf analizinde kullanıcı başına günlük limit.
-- Tabloya yalnızca Edge Function (service role) erişir; RLS açık ve politika yok,
-- bu yüzden uygulama içinden okunamaz ve değiştirilemez.

create table if not exists public.foto_analiz_kullanim (
  user_id uuid not null references auth.users (id) on delete cascade,
  gun date not null default current_date,
  adet integer not null default 0,
  primary key (user_id, gun)
);

alter table public.foto_analiz_kullanim enable row level security;

-- Sayacı atomik olarak artırır ve yeni değeri döner.
create or replace function public.foto_kullanim_artir(p_user uuid)
returns integer
language sql
security definer
set search_path = ''
as $$
  insert into public.foto_analiz_kullanim (user_id, gun, adet)
  values (p_user, current_date, 1)
  on conflict (user_id, gun)
  do update set adet = public.foto_analiz_kullanim.adet + 1
  returning adet;
$$;

revoke execute on function public.foto_kullanim_artir(uuid) from public, anon, authenticated;
grant execute on function public.foto_kullanim_artir(uuid) to service_role;
