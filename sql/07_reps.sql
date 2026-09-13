-- ============================================================
-- Migración 07 · 2026-09-13
--
-- POR QUÉ: la planilla no tenía columna de repeticiones, pero el
-- esquema del ciclo sí se cumplió: semana 1 → 12 reps, semana 2 → 10,
-- semana 3 → 8, semana 4 → 6. Son datos reales, no estimados; lo que
-- faltaba era la columna donde anotarlos.
--
-- Sin reps no hay volumen (peso × series × reps), que es la métrica
-- principal de los gráficos de progreso.
--
-- Solo toca filas con reps en null y fecha hasta el 11-09-2026: lo
-- que se registre de aquí en adelante entra con sus propias reps.
--
-- Es idempotente.
-- ============================================================

update set_logs sl
   set reps = case ws.semana
                when 1 then 12
                when 2 then 10
                when 3 then 8
                when 4 then 6
              end
  from workout_sessions ws
 where ws.id = sl.session_id
   and sl.reps is null
   and ws.semana between 1 and 4
   and ws.fecha <= date '2026-09-11';

-- Comprobación: cuatro filas, con 12/10/8/6 y ningún registro sin reps.
select ws.semana,
       sl.reps,
       count(*)                                 as registros,
       sum(sl.peso * sl.series * sl.reps)::int  as volumen_kg
  from set_logs sl
  join workout_sessions ws on ws.id = sl.session_id
 group by ws.semana, sl.reps
 order by ws.semana;
