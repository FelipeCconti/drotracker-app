-- ============================================================
-- Migración 09 · 2026-09-13
--
-- POR QUÉ: la pantalla de registrar entrenamiento necesita dos cosas
-- que hoy no existen como consulta simple.
--
-- 1. v_historial_ejercicio se escribió antes de la migración 06 y
--    todavía no sabe de `series`. Sin eso el volumen sale mal: un
--    "60 kg × 3 × 10" se contaba como si fuera una sola serie.
--    De paso expone `set_log_id`, para poder editar la fila que se
--    está mirando sin una segunda consulta.
--
-- 2. v_ultimo_registro responde "¿qué levanté la última vez en este
--    ejercicio?" en una sola consulta. Es el dato que la pantalla
--    precarga en cada fila, y lo que hace que registrar un día sea
--    confirmar en vez de escribir.
--
-- Las dos llevan security_invoker = on: sin eso una vista se ejecuta
-- con los permisos de quien la creó y se salta RLS entera.
--
-- Es idempotente.
-- ============================================================

-- create or replace no puede insertar columnas en medio de una vista
-- existente, así que esta se rehace.
drop view if exists v_historial_ejercicio;

create view v_historial_ejercicio as
select
  s.user_id,
  sl.id           as set_log_id,
  sl.exercise_id,
  e.nombre        as ejercicio,
  e.grupo_muscular,
  s.fecha,
  r.id            as routine_id,
  r.nombre        as rutina,
  c.numero        as ciclo,
  s.semana,
  sl.series, sl.n_serie, sl.reps, sl.peso, sl.unidad, sl.rpe,
  -- Volumen del ejercicio ese día: peso × series × reps.
  case when sl.reps > 0 and sl.peso is not null
       then round(sl.peso * sl.series * sl.reps, 1) end as volumen,
  -- 1RM estimado (Epley), para comparar entre ciclos y rutinas.
  case when sl.reps > 0 and sl.peso is not null
       then round(sl.peso * (1 + sl.reps / 30.0), 1) end as rm_estimado,
  sl.registrado_por,
  sl.actualizado_en
from set_logs sl
join workout_sessions s  on s.id = sl.session_id
join exercises e         on e.id = sl.exercise_id
left join cycles c       on c.id = s.cycle_id
left join routine_days d on d.id = s.routine_day_id
left join routines r     on r.id = d.routine_id;

alter view v_historial_ejercicio set (security_invoker = on);

-- ------------------------------------------------------------
-- Lo último que hizo cada persona en cada ejercicio.
--
-- distinct on se queda con la primera fila de cada grupo según el
-- order by: por eso el orden empieza por las mismas columnas del
-- distinct y sigue por fecha descendente.
-- ------------------------------------------------------------
drop view if exists v_ultimo_registro;

create view v_ultimo_registro as
select distinct on (s.user_id, sl.exercise_id)
  s.user_id,
  sl.exercise_id,
  s.fecha,
  sl.series,
  sl.reps,
  sl.peso,
  sl.unidad
from set_logs sl
join workout_sessions s on s.id = sl.session_id
where sl.peso is not null
order by s.user_id, sl.exercise_id, s.fecha desc, sl.id desc;

alter view v_ultimo_registro set (security_invoker = on);

-- Supabase concede esto por privilegios por defecto, pero una vista
-- recreada a mano puede quedarse sin el grant y fallar con un 401 que
-- parece un problema de sesión y no lo es. Explícito y se acabó.
grant select on v_historial_ejercicio to authenticated;
grant select on v_ultimo_registro     to authenticated;

-- Comprobación: las dos vistas con security_invoker en on.
select c.relname as vista,
       coalesce((select option_value from pg_options_to_table(c.reloptions)
                  where option_name = 'security_invoker'), 'off') as security_invoker
  from pg_class c
 where c.relname in ('v_historial_ejercicio', 'v_ultimo_registro', 'v_composicion')
 order by c.relname;
