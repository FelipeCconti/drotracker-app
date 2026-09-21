# Mesa de ayuda

Lo corriente —aprobar cuentas, bloquear, nombrar coaches, invitar, asignar atletas— ya se
hace desde la **pantalla de Administración** de la app, que solo ve el administrador.

Este archivo es para lo que esa pantalla NO hace, a propósito: borrar cuentas, mover
permisos de un vínculo a mano, y averiguar quién escribió un dato. Son operaciones raras
y algunas irreversibles; que exijan abrir el SQL Editor es parte del diseño.

> El SQL Editor corre como dueño de la base y **se salta RLS**. Es potente y no avisa.
> Lee la consulta antes de darle Run, y fíjate en el `where`.

Si alguna de estas empieza a pedirse todas las semanas, esa es la señal de que merece
pantalla. Hasta entonces, no.

---

## Ver quién es quién

```sql
select email, nombre, rol, estado, creado
  from profiles
 order by creado;
```

## Aprobar a alguien que quedó pendiente

> Esto ya se hace desde la pantalla de Administración. La consulta queda por si acaso.

Pasa cuando entra con un correo que no estaba en `invitaciones` — típicamente un link
reenviado, o un gmail distinto al que anotaste.

```sql
update profiles set estado = 'activo'
 where email = 'persona@gmail.com';
```

Para que el siguiente entre directo, mejor invitarlo antes:

```sql
insert into invitaciones (email) values ('persona@gmail.com')
on conflict do nothing;
```

## Retirar el acceso sin borrar el historial

```sql
update profiles set estado = 'bloqueado'
 where email = 'persona@gmail.com';
```

`bloqueado` deja de ver y de escribir al instante, pero sus datos siguen ahí. Es lo que
se usa casi siempre; borrar la cuenta se lleva todo su historial por cascada y no se
puede deshacer.

## Dar o quitar el rol de coach

```sql
update profiles set rol = 'coach'  where email = 'persona@gmail.com';
update profiles set rol = 'atleta' where email = 'persona@gmail.com';
```

Todo rol es además atleta. Quitar el rol no borra los vínculos: si vuelve a ser coach,
sus atletas siguen asignados.

## Asignar un coach a un atleta

```sql
insert into coach_links (coach_id, atleta_id, creado_por)
select c.id, a.id, f.id
  from profiles c, profiles a, profiles f
 where c.email = 'coach@gmail.com'
   and a.email = 'atleta@gmail.com'
   and f.email = 'felipe.contreras.loyola8@gmail.com'
on conflict do nothing;
```

El vínculo nace con `puede_editar_plan = true` y `puede_registrar = false`.

## Quitar la asignación

```sql
delete from coach_links
 where coach_id = (select id from profiles where email = 'coach@gmail.com')
   and atleta_id = (select id from profiles where email = 'atleta@gmail.com');
```

**Reasignar es borrar e insertar**, nunca editar `atleta_id`: esa columna está fuera del
grant de UPDATE justamente para que una reasignación no pase inadvertida.

## Conceder o revocar permisos de un coach

Normalmente lo hace el propio atleta desde la app. Esto es para cuando no puede o no
entiende cómo.

```sql
-- que el coach pueda registrar los entrenamientos del atleta
update coach_links set puede_registrar = true
 where coach_id  = (select id from profiles where email = 'coach@gmail.com')
   and atleta_id = (select id from profiles where email = 'atleta@gmail.com');

-- revocarlo
update coach_links set puede_registrar = false
 where coach_id  = (select id from profiles where email = 'coach@gmail.com')
   and atleta_id = (select id from profiles where email = 'atleta@gmail.com');
```

Lo mismo con `puede_editar_plan` para el permiso sobre la rutina.

## Ver cómo está configurado un vínculo

```sql
select c.email as coach, a.email as atleta,
       l.puede_editar_plan, l.puede_registrar, l.creado
  from coach_links l
  join profiles c on c.id = l.coach_id
  join profiles a on a.id = l.atleta_id
 order by a.email;
```

## Lo que el admin NO puede hacer, ni desde aquí ni desde la app

- **Ver la composición corporal de nadie.** Vive en `composition_access` y solo el
  atleta la concede. Desde el SQL Editor técnicamente podrías leer la tabla —te saltas
  RLS— pero es la clase de cosa que si se hace una vez deja de ser una app en la que la
  gente confía. No lo hagas.
- **Concederse a sí mismo acceso a una composición.** La política no lo permite ni al
  admin autenticado en la app.

## Quién escribió un dato

Cuando alguien dice "yo no puse eso":

```sql
select ws.fecha, e.nombre, sl.peso, sl.series, sl.reps,
       p.email as lo_escribio, sl.actualizado_en
  from set_logs sl
  join workout_sessions ws on ws.id = sl.session_id
  join exercises e         on e.id = sl.exercise_id
  left join profiles p     on p.id = sl.registrado_por
 where ws.user_id = (select id from profiles where email = 'atleta@gmail.com')
 order by ws.fecha desc
 limit 50;
```

`lo_escribio` en null significa que la fila viene de la migración de la planilla.
`actualizado_en` en null significa que nunca se editó.

## Recuperar un dato que alguien pisó

El respaldo diario guarda 30 días. Ver `RESTAURAR.md` — se restaura en el proyecto
`drotracker-pruebas` y se consulta ahí, sin tocar producción.

## Después de cualquier cambio de permisos

```sql
-- pegar sql/99_pruebas_rls.sql entero
```

Las 64 pruebas tienen que decir OK. Crea y borra sus propios usuarios de prueba, así que
se puede correr en producción sin miedo. Al terminar: `drop table _pruebas_rls;`
