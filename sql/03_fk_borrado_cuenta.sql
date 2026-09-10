-- ============================================================
-- Migración 03 · 2026-09-10
--
-- POR QUÉ: `coach_links.creado_por` e `invitaciones.invitado_por`
-- se crearon sin acción de borrado, así que bloqueaban eliminar la
-- cuenta de quien hubiera creado un vínculo o enviado una invitación
-- — empezando por la del propio administrador. Con `on delete set
-- null` el vínculo sobrevive y solo se pierde el dato de quién lo creó.
--
-- QUÉ HACE: reemplaza esas dos claves foráneas. No toca ningún dato.
--
-- POR QUÉ VA EN UN ARCHIVO APARTE: `01_esquema.sql` usa
-- `create table if not exists`, así que sobre una base que ya existe
-- no modifica nada. Los cambios de esquema posteriores siempre van en
-- una migración numerada nueva, nunca editando el 01.
--
-- Es idempotente: se puede correr las veces que haga falta.
-- ============================================================

alter table coach_links  drop constraint if exists coach_links_creado_por_fkey;
alter table coach_links  add  constraint coach_links_creado_por_fkey
  foreign key (creado_por) references profiles(id) on delete set null;

alter table invitaciones drop constraint if exists invitaciones_invitado_por_fkey;
alter table invitaciones add  constraint invitaciones_invitado_por_fkey
  foreign key (invitado_por) references profiles(id) on delete set null;

-- Comprobación: las dos tienen que decir 'set null'.
select conrelid::regclass || '.' || a.attname as columna,
       case confdeltype when 'n' then 'set null'
                        when 'a' then 'SIN ACCIÓN — la migración no se aplicó'
                        else confdeltype::text end as al_borrar
  from pg_constraint c
  join unnest(c.conkey) with ordinality k(attnum, ord) on true
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
 where c.contype = 'f'
   and c.conname in ('coach_links_creado_por_fkey','invitaciones_invitado_por_fkey')
 order by 1;
