-- ============================================================
-- Migración 08 · 2026-09-13
--
-- POR QUÉ: en el gimnasio muchas veces es el coach quien tiene el
-- teléfono en la mano. El modelo original dejaba el registro como
-- territorio exclusivo del atleta; eso es correcto por defecto, pero
-- tiene que poder abrirse.
--
-- CÓMO: mismo patrón que puede_editar_plan — un permiso por vínculo,
-- apagado por defecto, que el ATLETA enciende y apaga. El admin
-- asigna el coach; el atleta decide qué puede tocar.
--
-- El admin también puede moverlo, a propósito: es la mesa de ayuda.
-- Puede hacerlo desde el SQL Editor sin que exista pantalla alguna.
--
-- Y queda rastro: registrado_por dice quién escribió cada fila.
-- null = viene de la migración de la planilla.
--
-- Es idempotente.
-- ============================================================

alter table coach_links
  add column if not exists puede_registrar boolean not null default false;

comment on column coach_links.puede_registrar is
  'El coach puede escribir el REGISTRO de entrenamientos del atleta. Lo enciende y apaga el atleta (y el admin, como mesa de ayuda).';

alter table workout_sessions
  add column if not exists registrado_por uuid references profiles(id) on delete set null;
alter table set_logs
  add column if not exists registrado_por uuid references profiles(id) on delete set null;

comment on column set_logs.registrado_por is
  'Quién escribió esta fila. null = migrada de la planilla.';
comment on column workout_sessions.registrado_por is
  'Quién escribió esta fila. null = migrada de la planilla.';

-- ------------------------------------------------------------
-- ¿puedo escribir el registro de este atleta?
-- El nombre calza con el de la columna a propósito, igual que
-- puede_editar_plan. La columna va calificada (cl.) para que no
-- haya ambigüedad posible al resolver el identificador.
-- ------------------------------------------------------------
create or replace function public.puede_registrar(atleta uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select atleta = public.mi_id() or exists (
    select 1 from public.coach_links cl
     where cl.coach_id = public.mi_id()
       and cl.atleta_id = atleta
       and cl.puede_registrar
  )
$$;

-- ------------------------------------------------------------
-- Sella quién escribió, para que la app no pueda olvidarlo.
--
-- auth.uid() es null cuando la sentencia viene del SQL Editor: en ese
-- caso no se toca la columna, que es lo que deja intactas las filas
-- migradas de la planilla.
-- ------------------------------------------------------------
create or replace function public.sellar_autor()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.registrado_por := public.mi_id();
  end if;
  return new;
end $$;

drop trigger if exists tr_autor_sesion on workout_sessions;
create trigger tr_autor_sesion before insert or update on workout_sessions
  for each row execute function public.sellar_autor();

drop trigger if exists tr_autor_serie on set_logs;
create trigger tr_autor_serie before insert or update on set_logs
  for each row execute function public.sellar_autor();

-- ------------------------------------------------------------
-- Las políticas del registro, ampliadas.
-- ------------------------------------------------------------
drop policy if exists "mis sesiones" on workout_sessions;
create policy "mis sesiones" on workout_sessions for all
  using (puede_registrar(user_id)) with check (puede_registrar(user_id));

drop policy if exists "mis series" on set_logs;
create policy "mis series" on set_logs for all
  using (exists (select 1 from workout_sessions s
                  where s.id = session_id and puede_registrar(s.user_id)))
  with check (exists (select 1 from workout_sessions s
                  where s.id = session_id and puede_registrar(s.user_id)));

-- ------------------------------------------------------------
-- El atleta maneja los permisos de SU vínculo.
--
-- El admin sigue siendo el único que crea y borra vínculos: esta
-- política es solo de UPDATE, y los grants de columna la acotan a los
-- dos interruptores. coach_id y atleta_id no los puede mover nadie
-- por esta vía; cambiar una asignación es borrar e insertar, y eso
-- solo lo hace el admin.
-- ------------------------------------------------------------
revoke update on coach_links from authenticated;
grant  update (puede_registrar, puede_editar_plan) on coach_links to authenticated;

drop policy if exists "yo decido qué toca mi coach" on coach_links;
create policy "yo decido qué toca mi coach" on coach_links for update
  using (atleta_id = mi_id()) with check (atleta_id = mi_id());

-- Comprobación
select coach_id, atleta_id, puede_editar_plan, puede_registrar
  from coach_links;
