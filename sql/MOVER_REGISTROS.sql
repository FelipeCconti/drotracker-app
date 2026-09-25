-- ============================================================
-- Mover registros de un día a otro, dentro de la misma fecha
--
-- NO es una migración: es una herramienta, para correr a mano cuando
-- haga falta. No cambia el esquema.
--
-- CUÁNDO SE USA: entrenaste dos packs la misma jornada y quedaron
-- anotados en la sesión del primero. O quitaste un ejercicio del plan
-- de un día después de haberlo registrado, y su registro se quedó ahí.
-- En los dos casos hay registros en una sesión que pertenecen al pack
-- de otro día.
--
-- QUÉ MUEVE, y solo eso: los registros de la sesión de origen cuyo
-- ejercicio **no está** en el plan del día de origen pero **sí está**
-- en el del día de destino. Lo que sí pertenece al día de origen no se
-- toca, y lo que no pertenece a ninguno de los dos tampoco — para eso
-- primero hay que agregar el ejercicio al plan del destino.
--
-- CÓMO SE USA: corre primero el PASO 0 para sacar el id de la sesión de
-- origen, edita con él las dos líneas marcadas del bloque, y corre el
-- bloque. Va todo en una transacción: si algo falla, no queda a medias.
-- ============================================================

-- PASO 0 · De dónde sale el id que hay que pegar abajo.
-- Cambia el correo y la fecha; copia el valor de la columna "sesion".
select ws.id as sesion, ws.fecha, d.orden as dia_n, d.nombre as dia,
       count(sl.id) as registros,
       string_agg(e.nombre, ' · ' order by e.nombre) as cuales
  from workout_sessions ws
  join profiles p          on p.id = ws.user_id
  left join routine_days d on d.id = ws.routine_day_id
  left join set_logs sl    on sl.session_id = ws.id
  left join exercises e    on e.id = sl.exercise_id
 where p.email = 'felipe.contreras.loyola8@gmail.com'
   and ws.fecha = date '2026-09-17'
 group by ws.id, ws.fecha, d.orden, d.nombre
 order by d.orden;

-- PASO 1 · El movimiento.
do $$
declare
  -- ↓↓↓ LO ÚNICO QUE HAY QUE EDITAR ↓↓↓
  v_sesion_origen constant uuid     := '00000000-0000-0000-0000-000000000000';
  v_dia_destino   constant smallint := 5;   -- el número de día, no su id
  -- ↑↑↑ ---------------------------- ↑↑↑

  v_user uuid; v_fecha date; v_rutina uuid; v_dia_origen uuid;
  v_ciclo uuid; v_semana smallint;
  v_dia_dest_id uuid; v_sesion_destino uuid;
  n int;
begin
  -- Tres formas distintas de fallar acá, y cada una se arregla distinto.
  if v_sesion_origen = '00000000-0000-0000-0000-000000000000' then
    raise exception
      'Falta editar la línea marcada: v_sesion_origen todavía tiene el valor de ejemplo. Pégale el id de la sesión de origen.';
  end if;

  select ws.user_id, ws.fecha, ws.routine_day_id, ws.cycle_id, ws.semana
    into v_user, v_fecha, v_dia_origen, v_ciclo, v_semana
    from workout_sessions ws
   where ws.id = v_sesion_origen;

  if v_user is null then
    raise exception
      'No existe ninguna sesión con id %. Tiene que ser el id de la SESIÓN — la columna "sesion" del PASO 0 — no el de un registro ni el de un día.',
      v_sesion_origen;
  end if;

  if v_dia_origen is null then
    raise exception
      'La sesión % existe pero no tiene día de rutina asociado, así que no hay de dónde mover. Asígnale un routine_day_id primero.',
      v_sesion_origen;
  end if;

  select routine_id into v_rutina from routine_days where id = v_dia_origen;

  select id into v_dia_dest_id
    from routine_days where routine_id = v_rutina and orden = v_dia_destino;

  if v_dia_dest_id is null then
    raise exception 'La rutina no tiene un Día %.', v_dia_destino;
  end if;

  -- Los que califican: no son de este día, sí son del destino.
  create temp table _a_mover on commit drop as
  select sl.id, e.nombre as ejercicio, sl.peso, sl.series, sl.reps, red.id as nuevo_plan
    from set_logs sl
    join exercises e on e.id = sl.exercise_id
    left join routine_exercises reo
           on reo.routine_day_id = v_dia_origen
          and reo.exercise_id = sl.exercise_id
          and reo.activo
    join routine_exercises red
           on red.routine_day_id = v_dia_dest_id
          and red.exercise_id = sl.exercise_id
          and red.activo
   where sl.session_id = v_sesion_origen
     and reo.id is null;

  select count(*) into n from _a_mover;
  if n = 0 then
    raise notice 'No hay nada que mover: todos los registros de esa sesión pertenecen a su día, o el destino no los tiene en el plan.';
    return;
  end if;

  -- La sesión de destino: la que ya exista ese día y esa fecha, o una nueva
  -- con el mismo ciclo y semana que la de origen.
  select id into v_sesion_destino
    from workout_sessions
   where user_id = v_user and routine_day_id = v_dia_dest_id and fecha = v_fecha;

  if v_sesion_destino is null then
    insert into workout_sessions (user_id, routine_day_id, cycle_id, semana, fecha)
    values (v_user, v_dia_dest_id, v_ciclo, v_semana, v_fecha)
    returning id into v_sesion_destino;
    raise notice 'Se creó la sesión del Día % para el %.', v_dia_destino, v_fecha;
  end if;

  -- Se mueve Y se re-ancla al plan del destino, para que la pantalla lo
  -- encuentre por la vía normal la próxima vez.
  update set_logs sl
     set session_id = v_sesion_destino,
         routine_exercise_id = m.nuevo_plan
    from _a_mover m
   where sl.id = m.id;

  raise notice 'Movidos % registros a la sesión % del Día %.', n, v_sesion_destino, v_dia_destino;
end $$;

-- PASO 2 · Cómo quedó: una fila por sesión de esa fecha, con sus ejercicios.
-- Es la misma consulta del PASO 0.
select ws.id as sesion, ws.fecha, d.orden as dia_n, d.nombre as dia,
       count(sl.id) as registros,
       string_agg(e.nombre, ' · ' order by e.nombre) as cuales
  from workout_sessions ws
  join profiles p          on p.id = ws.user_id
  left join routine_days d on d.id = ws.routine_day_id
  left join set_logs sl    on sl.session_id = ws.id
  left join exercises e    on e.id = sl.exercise_id
 where p.email = 'felipe.contreras.loyola8@gmail.com'
   and ws.fecha = date '2026-09-17'
 group by ws.id, ws.fecha, d.orden, d.nombre
 order by d.orden;
