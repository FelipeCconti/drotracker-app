-- ============================================================
-- Migración 04 · 2026-09-10
--
-- POR QUÉ: `routines.deriva_de` apunta a la propia tabla routines
-- (la cadena de rutinas A → B → C). Al restaurar un respaldo, las
-- filas entran en un solo COPY y una rutina puede aparecer antes que
-- aquella de la que deriva, violando la clave foránea.
--
-- pg_dump resuelve esto con --disable-triggers, pero esa opción emite
-- `ALTER TABLE ... DISABLE TRIGGER ALL`, que exige ser superusuario.
-- En Supabase NO se es superusuario, así que el respaldo se generaba
-- bien y fallaba al restaurarse — la peor clase de respaldo.
--
-- LA SOLUCIÓN: declarar la clave foránea DEFERRABLE. Postgres deja
-- entonces la comprobación para el final de la transacción, cuando
-- todas las filas ya están puestas, y el respaldo se restaura sin
-- privilegios especiales.
--
-- Es idempotente.
-- ============================================================

alter table routines drop constraint if exists routines_deriva_de_fkey;
alter table routines add  constraint routines_deriva_de_fkey
  foreign key (deriva_de) references routines(id)
  on delete set null
  deferrable initially deferred;

-- Comprobación: tiene que decir 'deferrable, diferida'.
select conname as restriccion,
       case when condeferrable and condeferred then 'deferrable, diferida'
            when condeferrable then 'deferrable pero inmediata'
            else 'NO deferrable — la migración no se aplicó' end as estado
  from pg_constraint
 where conname = 'routines_deriva_de_fkey';
