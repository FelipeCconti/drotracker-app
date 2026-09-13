-- ============================================================
-- Migración 10 · 2026-09-13
--
-- POR QUÉ: probando la pantalla de configurar rutina apareció que
-- **borrar una cuenta falla** si esa persona creó algún ejercicio
-- propio y lo usó en su rutina.
--
-- La cadena: borrar la cuenta arrastra su perfil, y el perfil arrastra
-- por cascada tanto sus rutinas (→ días → routine_exercises) como sus
-- ejercicios propios. Pero routine_exercises y set_logs apuntaban a
-- exercises SIN regla de borrado, así que si PostgreSQL borra primero
-- el ejercicio, la clave foránea lo rechaza y la operación entera se
-- cae. Es la misma familia de fallo que arregló la migración 03.
--
-- QUÉ HACE:
--
-- 1. Las dos claves foráneas hacia exercises pasan a `on delete
--    cascade`. Al irse una cuenta, se van sus ejercicios propios y
--    todo lo que colgaba de ellos.
--
-- 2. Y JUSTAMENTE POR ESO, se le quita a la app el permiso de borrar
--    ejercicios. Con la cascada puesta, un `delete` sobre un ejercicio
--    se llevaría en silencio todo su historial de entrenamiento — no
--    es una operación que deba existir con un clic. Quitar un ejercicio
--    del plan ya se hace con `routine_exercises.activo = false`, que
--    conserva el historial, y es lo que usa la pantalla.
--
--    Las cascadas del sistema no pasan por RLS ni por los grants, así
--    que borrar la cuenta sigue funcionando.
--
-- Los ejercicios del catálogo global nunca se borran por esta vía:
-- no cuelgan de ningún perfil y la política ya se los negaba.
--
-- Es idempotente.
-- ============================================================

alter table routine_exercises drop constraint if exists routine_exercises_exercise_id_fkey;
alter table routine_exercises
  add constraint routine_exercises_exercise_id_fkey
  foreign key (exercise_id) references exercises(id) on delete cascade;

alter table set_logs drop constraint if exists set_logs_exercise_id_fkey;
alter table set_logs
  add constraint set_logs_exercise_id_fkey
  foreign key (exercise_id) references exercises(id) on delete cascade;

-- ------------------------------------------------------------
-- Crear y renombrar sí; borrar no.
-- ------------------------------------------------------------
drop policy if exists "gestionar mis ejercicios" on exercises;

drop policy if exists "crear mis ejercicios" on exercises;
create policy "crear mis ejercicios" on exercises for insert
  with check (user_id = mi_id() and not es_global);

drop policy if exists "editar mis ejercicios" on exercises;
create policy "editar mis ejercicios" on exercises for update
  using (user_id = mi_id() and not es_global)
  with check (user_id = mi_id() and not es_global);

-- Sin política de DELETE no hay fila que calce, y además se le retira
-- el privilegio: dos cierres para la misma puerta.
revoke delete on exercises from authenticated;

-- Comprobación
select 'fk routine_exercises' as que,
       case confdeltype when 'c' then 'cascade' else confdeltype::text end as valor
  from pg_constraint where conname = 'routine_exercises_exercise_id_fkey'
union all
select 'fk set_logs',
       case confdeltype when 'c' then 'cascade' else confdeltype::text end
  from pg_constraint where conname = 'set_logs_exercise_id_fkey'
union all
select 'políticas de exercises', string_agg(polname || ' (' || polcmd::text || ')', ', ' order by polname)
  from pg_policy where polrelid = 'exercises'::regclass;
