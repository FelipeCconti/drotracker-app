-- ============================================================
-- Migración 06 · 2026-09-13
--
-- POR QUÉ: registrar serie por serie es demasiado tedioso en medio
-- del entrenamiento. La unidad real de registro es el EJERCICIO del
-- día: "press banca, 60 kg, 3 series de 10". Una fila, tres datos.
--
-- QUÉ CAMBIA en set_logs:
--   · se agrega `series`  → cuántas series a ese peso (por defecto 1)
--   · `n_serie` pasa a ser opcional
--
-- Las dos formas de registrar conviven sin ambigüedad:
--   simple   → una fila, series = 3, n_serie null
--   detallada → tres filas, series = 1, n_serie = 1, 2, 3
--               (para cuando cada serie llevó un peso distinto)
--
-- Y las consultas salen iguales en ambos casos:
--   volumen     = sum(peso * series * reps)
--   carga máxima = max(peso)
--
-- Es idempotente.
-- ============================================================

alter table set_logs add column if not exists series smallint not null default 1;
alter table set_logs alter column n_serie drop not null;

comment on column set_logs.series  is 'Cuántas series a este peso. 1 si se registra serie por serie.';
comment on column set_logs.n_serie is 'Cuál serie, solo si se registró una por una. Null en el registro simple.';

-- Comprobación
select column_name as columna,
       is_nullable as acepta_null,
       coalesce(column_default, '—') as por_defecto
  from information_schema.columns
 where table_name = 'set_logs' and column_name in ('series','n_serie','reps','peso')
 order by column_name;
