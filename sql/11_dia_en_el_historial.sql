-- ============================================================
-- Migración 11 · 2026-09-25
--
-- POR QUÉ: el gráfico "Por día" mostraba registros de OTROS días.
--
-- La vista no exponía a qué día de la rutina pertenecía cada sesión,
-- así que la pantalla hacía lo único que podía: filtrar por "este
-- ejercicio está en el plan del día elegido". Funciona mientras cada
-- ejercicio viva en un solo día. En cuanto uno aparece en dos —un press
-- banca que está en el día de empuje Y en el día opcional— el gráfico
-- de cada uno muestra los registros de los dos, y parecen duplicados
-- cuando no lo son.
--
-- Se nota sobre todo al entrenar dos días en una jornada: quedan dos
-- registros del mismo ejercicio con la misma fecha, ciclo y semana, uno
-- de cada día, y el gráfico los apila como si fueran el mismo día.
--
-- QUÉ HACE: agrega `routine_day_id`, `dia_orden` y `dia` a la vista,
-- para que la pantalla filtre por el día REAL de la sesión.
--
-- Es idempotente.
-- ============================================================

drop view if exists v_historial_ejercicio;

create view v_historial_ejercicio as
select
  s.user_id,
  sl.id           as set_log_id,
  sl.exercise_id,
  e.nombre        as ejercicio,
  e.grupo_muscular,
  s.fecha,
  s.id            as session_id,
  r.id            as routine_id,
  r.nombre        as rutina,
  -- Lo que faltaba: de qué día de la rutina fue esta sesión.
  d.id            as routine_day_id,
  d.orden         as dia_orden,
  d.nombre        as dia,
  c.numero        as ciclo,
  s.semana,
  sl.series, sl.n_serie, sl.reps, sl.peso, sl.unidad, sl.rpe,
  case when sl.reps > 0 and sl.peso is not null
       then round(sl.peso * sl.series * sl.reps, 1) end as volumen,
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
grant select on v_historial_ejercicio to authenticated;

-- Comprobación: la vista trae el día y sigue con security_invoker.
select 'columnas del día' as que,
       string_agg(column_name, ', ' order by column_name) as valor
  from information_schema.columns
 where table_name = 'v_historial_ejercicio'
   and column_name in ('routine_day_id', 'dia', 'dia_orden', 'session_id')
union all
select 'security_invoker',
       coalesce((select option_value from pg_options_to_table(c.reloptions)
                  where option_name = 'security_invoker'), 'off')
  from pg_class c where c.relname = 'v_historial_ejercicio';
