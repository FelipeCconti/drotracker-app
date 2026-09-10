-- ============================================================
-- DRO.TRACKER · roles y Row Level Security
--
-- Regla de oro del modelo:
--   ESCRIBIR  → solo el dueño del dato. Sin excepciones, ni para el admin.
--   LEER      → el dueño, su coach asignado, y el admin.
--   COMPOSICIÓN CORPORAL → solo el dueño, salvo que él conceda el
--                          acceso en composition_access. Ni el admin
--                          la ve por el hecho de ser admin, ni puede
--                          concederse ese acceso.
-- ============================================================

-- ------------------------------------------------------------
-- Funciones auxiliares.
-- security definer evita la recursión infinita que se produce cuando
-- una política sobre profiles necesita consultar profiles.
-- ------------------------------------------------------------
-- ------------------------------------------------------------
-- mi_id() es la pieza central del control de acceso.
--
-- Devuelve el id del usuario SOLO si su cuenta está activa; si está
-- pendiente o bloqueada, devuelve null. Como todas las políticas
-- comparan contra mi_id(), una cuenta no activa no calza con ninguna
-- fila: no lee nada y no escribe nada, sin tener que repetir la
-- condición en veinte políticas.
-- ------------------------------------------------------------
create or replace function public.mi_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select id from public.profiles
   where id = auth.uid() and estado = 'activo'
$$;

create or replace function public.esta_activo()
returns boolean
language sql stable security definer set search_path = public
as $$ select public.mi_id() is not null $$;

create or replace function public.mi_rol()
returns app_rol
language sql stable security definer set search_path = public
as $$ select rol from public.profiles where id = auth.uid() and estado = 'activo' $$;

create or replace function public.es_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.mi_rol() = 'admin', false) $$;

-- ¿soy coach asignado de este atleta?
create or replace function public.soy_coach_de(atleta uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.coach_links
    where coach_id = mi_id() and atleta_id = atleta
  )
$$;

-- ¿puedo ver la composición corporal de este atleta?
-- Solo si él me lo concedió. El rol no entra en esta pregunta.
create or replace function public.puedo_ver_composicion(atleta uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select atleta = mi_id() or exists (
    select 1 from public.composition_access
    where coach_id = mi_id() and atleta_id = atleta
  )
$$;

-- ¿puedo leer los datos de entrenamiento de este atleta?
create or replace function public.puedo_leer(atleta uuid)
returns boolean
language sql stable security definer set search_path = public
as $$ select atleta = mi_id() or public.es_admin() or public.soy_coach_de(atleta) $$;

-- ¿puedo editar el PLAN de este atleta (rutina, días, ejercicios,
-- prescripción)? El coach arma la rutina junto al atleta; nadie más.
-- Esto NO da permiso sobre el registro de entrenamientos.
create or replace function public.puede_editar_plan(atleta uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select atleta = mi_id() or exists (
    select 1 from public.coach_links
    where coach_id = mi_id() and atleta_id = atleta and puede_editar_plan
  )
$$;

-- ============================================================
-- PROFILES
-- ============================================================
alter table profiles enable row level security;

-- Nadie puede cambiar su propio rol ni auto-aprobarse: el permiso de
-- UPDATE se otorga columna por columna y `rol` y `estado` quedan fuera
-- del alcance del atleta. Es más robusto que un check, porque la
-- restricción vive en el motor y no en la política.
revoke update on profiles from authenticated;
grant  select on profiles to authenticated;
grant  update (nombre, altura_cm, unidad_def) on profiles to authenticated;

drop policy if exists "leer perfiles visibles" on profiles;
create policy "leer perfiles visibles" on profiles for select
  using (id = auth.uid() or es_admin() or soy_coach_de(id));

drop policy if exists "editar mi perfil" on profiles;
create policy "editar mi perfil" on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- El admin es el único que mueve roles.
drop policy if exists "el admin gestiona roles" on profiles;
drop policy if exists "el admin gestiona roles y accesos" on profiles;
create policy "el admin gestiona roles y accesos" on profiles for update
  using (es_admin()) with check (es_admin());

grant update (rol, estado) on profiles to authenticated;  -- filtrado por la política de arriba

-- Salvaguarda: que nunca quede el sistema sin administrador.
create or replace function public.proteger_ultimo_admin()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.rol = 'admin' and new.rol <> 'admin'
     and (select count(*) from public.profiles where rol = 'admin') <= 1 then
    raise exception 'No se puede quitar el rol al único administrador.';
  end if;
  return new;
end $$;

drop trigger if exists tr_ultimo_admin on profiles;
create trigger tr_ultimo_admin
  before update of rol on profiles
  for each row execute function public.proteger_ultimo_admin();

-- ============================================================
-- INVITACIONES · la lista blanca. Solo el admin.
-- ============================================================
alter table invitaciones enable row level security;

drop policy if exists "el admin gestiona invitaciones" on invitaciones;
create policy "el admin gestiona invitaciones" on invitaciones for all
  using (es_admin()) with check (es_admin());

-- ============================================================
-- COACH_LINKS · solo el admin asigna y desasigna
-- ============================================================
alter table coach_links enable row level security;

drop policy if exists "ver mis vínculos" on coach_links;
create policy "ver mis vínculos" on coach_links for select
  using (coach_id = mi_id() or atleta_id = mi_id() or es_admin());

drop policy if exists "el admin asigna coaches" on coach_links;
create policy "el admin asigna coaches" on coach_links for all
  using (es_admin()) with check (es_admin());

-- Nota: el acceso a la composición corporal NO se gestiona acá.
-- Ver composition_access, más abajo.

-- ============================================================
-- EXERCISES · catálogo global (solo lectura) + propios
-- ============================================================
alter table exercises enable row level security;

drop policy if exists "leer catálogo" on exercises;
create policy "leer catálogo" on exercises for select
  using ((es_global and esta_activo()) or user_id = mi_id() or puedo_leer(user_id));

drop policy if exists "gestionar mis ejercicios" on exercises;
create policy "gestionar mis ejercicios" on exercises for all
  using (user_id = mi_id() and not es_global)
  with check (user_id = mi_id() and not es_global);

-- ============================================================
-- EL PLAN · routines / routine_days / routine_exercises / cycles
--           / exercise_targets
--
-- Escribe el dueño, y su coach si tiene puede_editar_plan.
-- Lee además el admin.
-- ============================================================
alter table routines          enable row level security;
alter table routine_days      enable row level security;
alter table routine_exercises enable row level security;
alter table cycles            enable row level security;
alter table exercise_targets  enable row level security;

drop policy if exists "gestionar la rutina" on routines;
create policy "gestionar la rutina" on routines for all
  using (puede_editar_plan(user_id)) with check (puede_editar_plan(user_id));

drop policy if exists "leer rutinas visibles" on routines;
create policy "leer rutinas visibles" on routines for select
  using (puedo_leer(user_id));

-- Las tablas hijas heredan el permiso a través de su rutina.
drop policy if exists "gestionar los días" on routine_days;
create policy "gestionar los días" on routine_days for all
  using (exists (select 1 from routines r where r.id = routine_id and puede_editar_plan(r.user_id)))
  with check (exists (select 1 from routines r where r.id = routine_id and puede_editar_plan(r.user_id)));

drop policy if exists "leer días visibles" on routine_days;
create policy "leer días visibles" on routine_days for select
  using (exists (select 1 from routines r where r.id = routine_id and puedo_leer(r.user_id)));

drop policy if exists "gestionar ejercicios de rutina" on routine_exercises;
create policy "gestionar ejercicios de rutina" on routine_exercises for all
  using (exists (select 1 from routine_days d join routines r on r.id = d.routine_id
                 where d.id = routine_day_id and puede_editar_plan(r.user_id)))
  with check (exists (select 1 from routine_days d join routines r on r.id = d.routine_id
                 where d.id = routine_day_id and puede_editar_plan(r.user_id)));

drop policy if exists "leer ejercicios de rutina visibles" on routine_exercises;
create policy "leer ejercicios de rutina visibles" on routine_exercises for select
  using (exists (select 1 from routine_days d join routines r on r.id = d.routine_id
                 where d.id = routine_day_id and puedo_leer(r.user_id)));

drop policy if exists "gestionar ciclos" on cycles;
create policy "gestionar ciclos" on cycles for all
  using (exists (select 1 from routines r where r.id = routine_id and puede_editar_plan(r.user_id)))
  with check (exists (select 1 from routines r where r.id = routine_id and puede_editar_plan(r.user_id)));

drop policy if exists "leer ciclos visibles" on cycles;
create policy "leer ciclos visibles" on cycles for select
  using (exists (select 1 from routines r where r.id = routine_id and puedo_leer(r.user_id)));

-- La prescripción semana a semana: es plan, no registro.
drop policy if exists "gestionar la prescripción" on exercise_targets;
create policy "gestionar la prescripción" on exercise_targets for all
  using (exists (select 1 from routine_exercises re
                   join routine_days d on d.id = re.routine_day_id
                   join routines r     on r.id = d.routine_id
                  where re.id = routine_exercise_id and puede_editar_plan(r.user_id)))
  with check (exists (select 1 from routine_exercises re
                   join routine_days d on d.id = re.routine_day_id
                   join routines r     on r.id = d.routine_id
                  where re.id = routine_exercise_id and puede_editar_plan(r.user_id)));

drop policy if exists "leer prescripción visible" on exercise_targets;
create policy "leer prescripción visible" on exercise_targets for select
  using (exists (select 1 from routine_exercises re
                   join routine_days d on d.id = re.routine_day_id
                   join routines r     on r.id = d.routine_id
                  where re.id = routine_exercise_id and puedo_leer(r.user_id)));

-- ============================================================
-- EL REGISTRO · workout_sessions / set_logs
--
-- Aquí NO entra puede_editar_plan. El coach arma el plan; lo que
-- alguien efectivamente levantó solo lo escribe esa persona.
-- Es la línea que separa "te ayudo a entrenar" de "te modifico
-- el historial".
-- ============================================================
alter table workout_sessions enable row level security;
alter table set_logs         enable row level security;

drop policy if exists "mis sesiones" on workout_sessions;
create policy "mis sesiones" on workout_sessions for all
  using (user_id = mi_id()) with check (user_id = mi_id());

drop policy if exists "leer sesiones visibles" on workout_sessions;
create policy "leer sesiones visibles" on workout_sessions for select
  using (puedo_leer(user_id));

drop policy if exists "mis series" on set_logs;
create policy "mis series" on set_logs for all
  using (exists (select 1 from workout_sessions s where s.id = session_id and s.user_id = mi_id()))
  with check (exists (select 1 from workout_sessions s where s.id = session_id and s.user_id = mi_id()));

drop policy if exists "leer series visibles" on set_logs;
create policy "leer series visibles" on set_logs for select
  using (exists (select 1 from workout_sessions s where s.id = session_id and puedo_leer(s.user_id)));

-- ============================================================
-- COMPOSICIÓN CORPORAL · la excepción deliberada
--
-- Ni el admin ni el coach la ven por su rol. Solo si el atleta
-- concedió el acceso, y solo él puede concederlo o quitarlo.
-- ============================================================
alter table body_measurements  enable row level security;
alter table composition_access enable row level security;

-- El atleta ingresa, corrige y borra sus mediciones cuando quiera.
drop policy if exists "mis mediciones" on body_measurements;
create policy "mis mediciones" on body_measurements for all
  using (user_id = mi_id()) with check (user_id = mi_id());

drop policy if exists "leer mediciones autorizadas" on body_measurements;
create policy "leer mediciones autorizadas" on body_measurements for select
  using (puedo_ver_composicion(user_id));

-- El permiso lo maneja el atleta y nadie más: ni el coach se lo
-- concede a sí mismo, ni el admin se lo concede a nadie.
drop policy if exists "yo decido quién ve mi composición" on composition_access;
create policy "yo decido quién ve mi composición" on composition_access for all
  using (atleta_id = mi_id()) with check (atleta_id = mi_id());

-- El coach puede ver qué accesos le concedieron (para saber qué
-- mostrar en su panel), pero no crearlos ni borrarlos.
drop policy if exists "ver los accesos que me dieron" on composition_access;
create policy "ver los accesos que me dieron" on composition_access for select
  using (coach_id = mi_id());

-- ============================================================
-- VISTAS
-- Sin esto una vista se ejecuta con los permisos de quien la creó
-- y se salta RLS: cualquiera vería el historial de todos.
-- ============================================================
alter view v_historial_ejercicio set (security_invoker = on);
alter view v_composicion         set (security_invoker = on);

-- ============================================================
-- Nombrar al primer administrador (correr una sola vez, tras el
-- primer login de Felipe con Google):
--
--   update profiles set rol = 'admin', estado = 'activo'
--    where email = 'tu-correo@gmail.com';
--
-- (Tu propio perfil también nace 'pendiente': eres el primero en llegar
--  y todavía no hay lista de invitados ni nadie que apruebe.)
--
-- Después, cargar la lista de invitados de una vez:
--
--   insert into invitaciones (email) values
--     ('amigo1@gmail.com'), ('amigo2@gmail.com')
--   on conflict do nothing;
-- ============================================================
