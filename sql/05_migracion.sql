-- ============================================================
-- Migración 05 · generada el 2026-09-13
-- por herramientas/migrar-planilla.js desde la planilla original
--
--   5 días · 28 ejercicios · 4 ciclos
--   79 sesiones · 437 registros · 1111 series
--
-- Los pesos son lo LEVANTADO, no lo planificado: entran como
-- sesiones y series reales. Las repeticiones no estaban
-- registradas y quedan en NULL.
--
-- Las fechas están reconstruidas a partir del 2026-05-25:
-- son exactas a la semana y aproximadas al día.
--
-- Idempotente: se puede ejecutar más de una vez.
-- ============================================================

do $$
declare
  v_user   uuid;
  v_rutina uuid;
begin
  select id into v_user from profiles where lower(email) = lower('felipe.contreras.loyola8@gmail.com');
  if v_user is null then
    raise exception 'No existe un perfil con el correo %. Entra una vez a la app con Google antes de migrar.', 'felipe.contreras.loyola8@gmail.com';
  end if;

  -- 1. Catálogo de ejercicios (global: sirve para todos los usuarios)
  insert into exercises (user_id, nombre, grupo_muscular, unidad_def, es_global)
  select null, 'Press banca con barra', 'Día 1 – Empuje / Tren superior', 'kg', true
   where not exists (select 1 from exercises where nombre = 'Press banca con barra' and es_global);
  insert into exercises (user_id, nombre, grupo_muscular, unidad_def, es_global)
  select null, 'Press vertical hombro', 'Día 1 – Empuje / Tren superior', 'kg', true
   where not exists (select 1 from exercises where nombre = 'Press vertical hombro' and es_global);
  insert into exercises (user_id, nombre, grupo_muscular, unidad_def, es_global)
  select null, 'Press inclinado', 'Día 1 – Empuje / Tren superior', 'kg', true
   where not exists (select 1 from exercises where nombre = 'Press inclinado' and es_global);
  insert into exercises (user_id, nombre, grupo_muscular, unidad_def, es_global)
  select null, 'Pect Fly (apertura máquina o polea)', 'Día 1 – Empuje / Tren superior', 'kg', true
   where not exists (select 1 from exercises where nombre = 'Pect Fly (apertura máquina o polea)' and es_global);
  insert into exercises (user_id, nombre, grupo_muscular, unidad_def, es_global)
  select null, 'Elevaciones laterales hombros', 'Día 1 – Empuje / Tren superior', 'kg', true
   where not exists (select 1 from exercises where nombre = 'Elevaciones laterales hombros' and es_global);
  insert into exercises (user_id, nombre, grupo_muscular, unidad_def, es_global)
  select null, 'Tríceps polea', 'Día 1 – Empuje / Tren superior', 'discos', true
   where not exists (select 1 from exercises where nombre = 'Tríceps polea' and es_global);
  insert into exercises (user_id, nombre, grupo_muscular, unidad_def, es_global)
  select null, 'Peso muerto (convencional o rumano)', 'Día 2 – Cadera', 'kg', true
   where not exists (select 1 from exercises where nombre = 'Peso muerto (convencional o rumano)' and es_global);
  insert into exercises (user_id, nombre, grupo_muscular, unidad_def, es_global)
  select null, 'Banco rumano (30 seg)', 'Día 2 – Cadera', 'kg', true
   where not exists (select 1 from exercises where nombre = 'Banco rumano (30 seg)' and es_global);
  insert into exercises (user_id, nombre, grupo_muscular, unidad_def, es_global)
  select null, 'Flexión rodilla / Leg curl', 'Día 2 – Cadera', 'kg', true
   where not exists (select 1 from exercises where nombre = 'Flexión rodilla / Leg curl' and es_global);
  insert into exercises (user_id, nombre, grupo_muscular, unidad_def, es_global)
  select null, 'Abducción de cadera (apertura)', 'Día 2 – Cadera', 'kg', true
   where not exists (select 1 from exercises where nombre = 'Abducción de cadera (apertura)' and es_global);
  insert into exercises (user_id, nombre, grupo_muscular, unidad_def, es_global)
  select null, 'Pantorrilla parado', 'Día 2 – Cadera', 'kg', true
   where not exists (select 1 from exercises where nombre = 'Pantorrilla parado' and es_global);
  insert into exercises (user_id, nombre, grupo_muscular, unidad_def, es_global)
  select null, 'Dominadas', 'Día 3 – Tracción / Tren superior', 'kg', true
   where not exists (select 1 from exercises where nombre = 'Dominadas' and es_global);
  insert into exercises (user_id, nombre, grupo_muscular, unidad_def, es_global)
  select null, 'Remo sentado', 'Día 3 – Tracción / Tren superior', 'kg', true
   where not exists (select 1 from exercises where nombre = 'Remo sentado' and es_global);
  insert into exercises (user_id, nombre, grupo_muscular, unidad_def, es_global)
  select null, 'Remo a una mano (polea 45°)', 'Día 3 – Tracción / Tren superior', 'discos', true
   where not exists (select 1 from exercises where nombre = 'Remo a una mano (polea 45°)' and es_global);
  insert into exercises (user_id, nombre, grupo_muscular, unidad_def, es_global)
  select null, 'Apertura espalda', 'Día 3 – Tracción / Tren superior', 'kg', true
   where not exists (select 1 from exercises where nombre = 'Apertura espalda' and es_global);
  insert into exercises (user_id, nombre, grupo_muscular, unidad_def, es_global)
  select null, 'Pull Over (polea)', 'Día 3 – Tracción / Tren superior', 'discos', true
   where not exists (select 1 from exercises where nombre = 'Pull Over (polea)' and es_global);
  insert into exercises (user_id, nombre, grupo_muscular, unidad_def, es_global)
  select null, 'Bíceps polea o máquina', 'Día 3 – Tracción / Tren superior', 'kg', true
   where not exists (select 1 from exercises where nombre = 'Bíceps polea o máquina' and es_global);
  insert into exercises (user_id, nombre, grupo_muscular, unidad_def, es_global)
  select null, 'Prensa (Hack squat)', 'Día 4 – Rodilla', 'kg', true
   where not exists (select 1 from exercises where nombre = 'Prensa (Hack squat)' and es_global);
  insert into exercises (user_id, nombre, grupo_muscular, unidad_def, es_global)
  select null, 'Zancadas / Sentadilla búlgara / Estocadas', 'Día 4 – Rodilla', 'kg', true
   where not exists (select 1 from exercises where nombre = 'Zancadas / Sentadilla búlgara / Estocadas' and es_global);
  insert into exercises (user_id, nombre, grupo_muscular, unidad_def, es_global)
  select null, 'Extensión de rodilla', 'Día 4 – Rodilla', 'kg', true
   where not exists (select 1 from exercises where nombre = 'Extensión de rodilla' and es_global);
  insert into exercises (user_id, nombre, grupo_muscular, unidad_def, es_global)
  select null, 'Aducción de cadera (cerrar)', 'Día 4 – Rodilla', 'kg', true
   where not exists (select 1 from exercises where nombre = 'Aducción de cadera (cerrar)' and es_global);
  insert into exercises (user_id, nombre, grupo_muscular, unidad_def, es_global)
  select null, 'Pantorrilla sentado', 'Día 4 – Rodilla', 'kg', true
   where not exists (select 1 from exercises where nombre = 'Pantorrilla sentado' and es_global);
  insert into exercises (user_id, nombre, grupo_muscular, unidad_def, es_global)
  select null, 'Press banca con mancuernas o Chest Press (máquina)', 'Día Opcional – Mix Empuje/Tracción', 'kg', true
   where not exists (select 1 from exercises where nombre = 'Press banca con mancuernas o Chest Press (máquina)' and es_global);
  insert into exercises (user_id, nombre, grupo_muscular, unidad_def, es_global)
  select null, 'Remo T o Remo con polea', 'Día Opcional – Mix Empuje/Tracción', 'kg', true
   where not exists (select 1 from exercises where nombre = 'Remo T o Remo con polea' and es_global);
  insert into exercises (user_id, nombre, grupo_muscular, unidad_def, es_global)
  select null, 'Fondos', 'Día Opcional – Mix Empuje/Tracción', 'cantidad', true
   where not exists (select 1 from exercises where nombre = 'Fondos' and es_global);
  insert into exercises (user_id, nombre, grupo_muscular, unidad_def, es_global)
  select null, 'Pull Down', 'Día Opcional – Mix Empuje/Tracción', 'discos', true
   where not exists (select 1 from exercises where nombre = 'Pull Down' and es_global);
  insert into exercises (user_id, nombre, grupo_muscular, unidad_def, es_global)
  select null, 'Curl de bíceps en máquina', 'Día Opcional – Mix Empuje/Tracción', 'kg', true
   where not exists (select 1 from exercises where nombre = 'Curl de bíceps en máquina' and es_global);
  insert into exercises (user_id, nombre, grupo_muscular, unidad_def, es_global)
  select null, 'Tríceps máquina o Press francés', 'Día Opcional – Mix Empuje/Tracción', 'kg', true
   where not exists (select 1 from exercises where nombre = 'Tríceps máquina o Press francés' and es_global);

  -- 2. La rutina y sus días
  select id into v_rutina from routines where user_id = v_user and nombre = 'Rutina original';
  if v_rutina is null then
    insert into routines (user_id, nombre, vigente_desde)
    values (v_user, 'Rutina original', '2026-05-25') returning id into v_rutina;
  end if;

  insert into routine_days (routine_id, orden, nombre) values (v_rutina, 1, 'Día 1 – Empuje / Tren superior')
  on conflict (routine_id, orden) do update set nombre = excluded.nombre;
  insert into routine_days (routine_id, orden, nombre) values (v_rutina, 2, 'Día 2 – Cadera')
  on conflict (routine_id, orden) do update set nombre = excluded.nombre;
  insert into routine_days (routine_id, orden, nombre) values (v_rutina, 3, 'Día 3 – Tracción / Tren superior')
  on conflict (routine_id, orden) do update set nombre = excluded.nombre;
  insert into routine_days (routine_id, orden, nombre) values (v_rutina, 4, 'Día 4 – Rodilla')
  on conflict (routine_id, orden) do update set nombre = excluded.nombre;
  insert into routine_days (routine_id, orden, nombre) values (v_rutina, 5, 'Día Opcional – Mix Empuje/Tracción')
  on conflict (routine_id, orden) do update set nombre = excluded.nombre;

  -- 3. Los ejercicios de cada día
  insert into routine_exercises (routine_day_id, exercise_id, orden, unidad, series_base)
  select d.id, x.id, 1, 'kg', 3
    from routine_days d, exercises x
   where d.routine_id = v_rutina and d.orden = 1
     and x.nombre = 'Press banca con barra' and x.es_global
     and not exists (select 1 from routine_exercises re
                      where re.routine_day_id = d.id and re.exercise_id = x.id);
  insert into routine_exercises (routine_day_id, exercise_id, orden, unidad, series_base)
  select d.id, x.id, 2, 'kg', 3
    from routine_days d, exercises x
   where d.routine_id = v_rutina and d.orden = 1
     and x.nombre = 'Press vertical hombro' and x.es_global
     and not exists (select 1 from routine_exercises re
                      where re.routine_day_id = d.id and re.exercise_id = x.id);
  insert into routine_exercises (routine_day_id, exercise_id, orden, unidad, series_base)
  select d.id, x.id, 3, 'kg', 2
    from routine_days d, exercises x
   where d.routine_id = v_rutina and d.orden = 1
     and x.nombre = 'Press inclinado' and x.es_global
     and not exists (select 1 from routine_exercises re
                      where re.routine_day_id = d.id and re.exercise_id = x.id);
  insert into routine_exercises (routine_day_id, exercise_id, orden, unidad, series_base)
  select d.id, x.id, 4, 'kg', 2
    from routine_days d, exercises x
   where d.routine_id = v_rutina and d.orden = 1
     and x.nombre = 'Pect Fly (apertura máquina o polea)' and x.es_global
     and not exists (select 1 from routine_exercises re
                      where re.routine_day_id = d.id and re.exercise_id = x.id);
  insert into routine_exercises (routine_day_id, exercise_id, orden, unidad, series_base)
  select d.id, x.id, 5, 'kg', 2
    from routine_days d, exercises x
   where d.routine_id = v_rutina and d.orden = 1
     and x.nombre = 'Elevaciones laterales hombros' and x.es_global
     and not exists (select 1 from routine_exercises re
                      where re.routine_day_id = d.id and re.exercise_id = x.id);
  insert into routine_exercises (routine_day_id, exercise_id, orden, unidad, series_base)
  select d.id, x.id, 6, 'discos', 3
    from routine_days d, exercises x
   where d.routine_id = v_rutina and d.orden = 1
     and x.nombre = 'Tríceps polea' and x.es_global
     and not exists (select 1 from routine_exercises re
                      where re.routine_day_id = d.id and re.exercise_id = x.id);
  insert into routine_exercises (routine_day_id, exercise_id, orden, unidad, series_base)
  select d.id, x.id, 1, 'kg', 3
    from routine_days d, exercises x
   where d.routine_id = v_rutina and d.orden = 2
     and x.nombre = 'Peso muerto (convencional o rumano)' and x.es_global
     and not exists (select 1 from routine_exercises re
                      where re.routine_day_id = d.id and re.exercise_id = x.id);
  insert into routine_exercises (routine_day_id, exercise_id, orden, unidad, series_base)
  select d.id, x.id, 2, 'kg', 3
    from routine_days d, exercises x
   where d.routine_id = v_rutina and d.orden = 2
     and x.nombre = 'Banco rumano (30 seg)' and x.es_global
     and not exists (select 1 from routine_exercises re
                      where re.routine_day_id = d.id and re.exercise_id = x.id);
  insert into routine_exercises (routine_day_id, exercise_id, orden, unidad, series_base)
  select d.id, x.id, 3, 'kg', 3
    from routine_days d, exercises x
   where d.routine_id = v_rutina and d.orden = 2
     and x.nombre = 'Flexión rodilla / Leg curl' and x.es_global
     and not exists (select 1 from routine_exercises re
                      where re.routine_day_id = d.id and re.exercise_id = x.id);
  insert into routine_exercises (routine_day_id, exercise_id, orden, unidad, series_base)
  select d.id, x.id, 4, 'kg', 2
    from routine_days d, exercises x
   where d.routine_id = v_rutina and d.orden = 2
     and x.nombre = 'Abducción de cadera (apertura)' and x.es_global
     and not exists (select 1 from routine_exercises re
                      where re.routine_day_id = d.id and re.exercise_id = x.id);
  insert into routine_exercises (routine_day_id, exercise_id, orden, unidad, series_base)
  select d.id, x.id, 5, 'kg', 3
    from routine_days d, exercises x
   where d.routine_id = v_rutina and d.orden = 2
     and x.nombre = 'Pantorrilla parado' and x.es_global
     and not exists (select 1 from routine_exercises re
                      where re.routine_day_id = d.id and re.exercise_id = x.id);
  insert into routine_exercises (routine_day_id, exercise_id, orden, unidad, series_base)
  select d.id, x.id, 1, 'kg', 3
    from routine_days d, exercises x
   where d.routine_id = v_rutina and d.orden = 3
     and x.nombre = 'Dominadas' and x.es_global
     and not exists (select 1 from routine_exercises re
                      where re.routine_day_id = d.id and re.exercise_id = x.id);
  insert into routine_exercises (routine_day_id, exercise_id, orden, unidad, series_base)
  select d.id, x.id, 2, 'kg', 3
    from routine_days d, exercises x
   where d.routine_id = v_rutina and d.orden = 3
     and x.nombre = 'Remo sentado' and x.es_global
     and not exists (select 1 from routine_exercises re
                      where re.routine_day_id = d.id and re.exercise_id = x.id);
  insert into routine_exercises (routine_day_id, exercise_id, orden, unidad, series_base)
  select d.id, x.id, 3, 'discos', 2
    from routine_days d, exercises x
   where d.routine_id = v_rutina and d.orden = 3
     and x.nombre = 'Remo a una mano (polea 45°)' and x.es_global
     and not exists (select 1 from routine_exercises re
                      where re.routine_day_id = d.id and re.exercise_id = x.id);
  insert into routine_exercises (routine_day_id, exercise_id, orden, unidad, series_base)
  select d.id, x.id, 4, 'kg', 2
    from routine_days d, exercises x
   where d.routine_id = v_rutina and d.orden = 3
     and x.nombre = 'Apertura espalda' and x.es_global
     and not exists (select 1 from routine_exercises re
                      where re.routine_day_id = d.id and re.exercise_id = x.id);
  insert into routine_exercises (routine_day_id, exercise_id, orden, unidad, series_base)
  select d.id, x.id, 5, 'discos', 2
    from routine_days d, exercises x
   where d.routine_id = v_rutina and d.orden = 3
     and x.nombre = 'Pull Over (polea)' and x.es_global
     and not exists (select 1 from routine_exercises re
                      where re.routine_day_id = d.id and re.exercise_id = x.id);
  insert into routine_exercises (routine_day_id, exercise_id, orden, unidad, series_base)
  select d.id, x.id, 6, 'kg', 3
    from routine_days d, exercises x
   where d.routine_id = v_rutina and d.orden = 3
     and x.nombre = 'Bíceps polea o máquina' and x.es_global
     and not exists (select 1 from routine_exercises re
                      where re.routine_day_id = d.id and re.exercise_id = x.id);
  insert into routine_exercises (routine_day_id, exercise_id, orden, unidad, series_base)
  select d.id, x.id, 1, 'kg', 3
    from routine_days d, exercises x
   where d.routine_id = v_rutina and d.orden = 4
     and x.nombre = 'Prensa (Hack squat)' and x.es_global
     and not exists (select 1 from routine_exercises re
                      where re.routine_day_id = d.id and re.exercise_id = x.id);
  insert into routine_exercises (routine_day_id, exercise_id, orden, unidad, series_base)
  select d.id, x.id, 2, 'kg', 2
    from routine_days d, exercises x
   where d.routine_id = v_rutina and d.orden = 4
     and x.nombre = 'Zancadas / Sentadilla búlgara / Estocadas' and x.es_global
     and not exists (select 1 from routine_exercises re
                      where re.routine_day_id = d.id and re.exercise_id = x.id);
  insert into routine_exercises (routine_day_id, exercise_id, orden, unidad, series_base)
  select d.id, x.id, 3, 'kg', 3
    from routine_days d, exercises x
   where d.routine_id = v_rutina and d.orden = 4
     and x.nombre = 'Extensión de rodilla' and x.es_global
     and not exists (select 1 from routine_exercises re
                      where re.routine_day_id = d.id and re.exercise_id = x.id);
  insert into routine_exercises (routine_day_id, exercise_id, orden, unidad, series_base)
  select d.id, x.id, 4, 'kg', 2
    from routine_days d, exercises x
   where d.routine_id = v_rutina and d.orden = 4
     and x.nombre = 'Aducción de cadera (cerrar)' and x.es_global
     and not exists (select 1 from routine_exercises re
                      where re.routine_day_id = d.id and re.exercise_id = x.id);
  insert into routine_exercises (routine_day_id, exercise_id, orden, unidad, series_base)
  select d.id, x.id, 5, 'kg', 3
    from routine_days d, exercises x
   where d.routine_id = v_rutina and d.orden = 4
     and x.nombre = 'Pantorrilla sentado' and x.es_global
     and not exists (select 1 from routine_exercises re
                      where re.routine_day_id = d.id and re.exercise_id = x.id);
  insert into routine_exercises (routine_day_id, exercise_id, orden, unidad, series_base)
  select d.id, x.id, 1, 'kg', 3
    from routine_days d, exercises x
   where d.routine_id = v_rutina and d.orden = 5
     and x.nombre = 'Press banca con mancuernas o Chest Press (máquina)' and x.es_global
     and not exists (select 1 from routine_exercises re
                      where re.routine_day_id = d.id and re.exercise_id = x.id);
  insert into routine_exercises (routine_day_id, exercise_id, orden, unidad, series_base)
  select d.id, x.id, 2, 'kg', 3
    from routine_days d, exercises x
   where d.routine_id = v_rutina and d.orden = 5
     and x.nombre = 'Remo T o Remo con polea' and x.es_global
     and not exists (select 1 from routine_exercises re
                      where re.routine_day_id = d.id and re.exercise_id = x.id);
  insert into routine_exercises (routine_day_id, exercise_id, orden, unidad, series_base)
  select d.id, x.id, 3, 'cantidad', 2
    from routine_days d, exercises x
   where d.routine_id = v_rutina and d.orden = 5
     and x.nombre = 'Fondos' and x.es_global
     and not exists (select 1 from routine_exercises re
                      where re.routine_day_id = d.id and re.exercise_id = x.id);
  insert into routine_exercises (routine_day_id, exercise_id, orden, unidad, series_base)
  select d.id, x.id, 4, 'discos', 2
    from routine_days d, exercises x
   where d.routine_id = v_rutina and d.orden = 5
     and x.nombre = 'Pull Down' and x.es_global
     and not exists (select 1 from routine_exercises re
                      where re.routine_day_id = d.id and re.exercise_id = x.id);
  insert into routine_exercises (routine_day_id, exercise_id, orden, unidad, series_base)
  select d.id, x.id, 5, 'kg', 2
    from routine_days d, exercises x
   where d.routine_id = v_rutina and d.orden = 5
     and x.nombre = 'Curl de bíceps en máquina' and x.es_global
     and not exists (select 1 from routine_exercises re
                      where re.routine_day_id = d.id and re.exercise_id = x.id);
  insert into routine_exercises (routine_day_id, exercise_id, orden, unidad, series_base)
  select d.id, x.id, 6, 'kg', 2
    from routine_days d, exercises x
   where d.routine_id = v_rutina and d.orden = 5
     and x.nombre = 'Tríceps máquina o Press francés' and x.es_global
     and not exists (select 1 from routine_exercises re
                      where re.routine_day_id = d.id and re.exercise_id = x.id);

  -- 4. Ciclos
  insert into cycles (routine_id, numero) values (v_rutina, 1)
  on conflict (routine_id, numero) do nothing;
  insert into cycles (routine_id, numero) values (v_rutina, 2)
  on conflict (routine_id, numero) do nothing;
  insert into cycles (routine_id, numero) values (v_rutina, 3)
  on conflict (routine_id, numero) do nothing;
  insert into cycles (routine_id, numero) values (v_rutina, 4)
  on conflict (routine_id, numero) do nothing;

  -- 5. Sesiones entrenadas
  insert into workout_sessions (id, user_id, routine_day_id, cycle_id, semana, fecha, nota)
  select md5(v_rutina::text || v.ciclo || '-' || v.semana || '-' || v.dia)::uuid,
         v_user, d.id, c.id, v.semana, v.fecha::date,
         'Importado de la planilla original. Fecha exacta a la semana, aproximada al día.'
    from (values
      (1, 1, 1, '2026-05-25'),
      (1, 1, 2, '2026-05-26'),
      (1, 1, 3, '2026-05-27'),
      (1, 1, 4, '2026-05-28'),
      (1, 1, 5, '2026-05-29'),
      (1, 2, 1, '2026-06-01'),
      (1, 2, 2, '2026-06-02'),
      (1, 2, 3, '2026-06-03'),
      (1, 2, 4, '2026-06-04'),
      (1, 2, 5, '2026-06-05'),
      (1, 3, 1, '2026-06-08'),
      (1, 3, 2, '2026-06-09'),
      (1, 3, 3, '2026-06-10'),
      (1, 3, 4, '2026-06-11'),
      (1, 3, 5, '2026-06-12'),
      (1, 4, 1, '2026-06-15'),
      (1, 4, 2, '2026-06-16'),
      (1, 4, 3, '2026-06-17'),
      (1, 4, 4, '2026-06-18'),
      (1, 4, 5, '2026-06-19'),
      (2, 1, 1, '2026-06-22'),
      (2, 1, 2, '2026-06-23'),
      (2, 1, 3, '2026-06-24'),
      (2, 1, 4, '2026-06-25'),
      (2, 1, 5, '2026-06-26'),
      (2, 2, 1, '2026-06-29'),
      (2, 2, 2, '2026-06-30'),
      (2, 2, 3, '2026-07-01'),
      (2, 2, 4, '2026-07-02'),
      (2, 2, 5, '2026-07-03'),
      (2, 3, 1, '2026-07-06'),
      (2, 3, 2, '2026-07-07'),
      (2, 3, 3, '2026-07-08'),
      (2, 3, 4, '2026-07-09'),
      (2, 3, 5, '2026-07-10'),
      (2, 4, 1, '2026-07-13'),
      (2, 4, 2, '2026-07-14'),
      (2, 4, 3, '2026-07-15'),
      (2, 4, 4, '2026-07-16'),
      (2, 4, 5, '2026-07-17'),
      (3, 1, 1, '2026-07-20'),
      (3, 1, 2, '2026-07-21'),
      (3, 1, 3, '2026-07-22'),
      (3, 1, 4, '2026-07-23'),
      (3, 2, 1, '2026-07-27'),
      (3, 2, 2, '2026-07-28'),
      (3, 2, 3, '2026-07-29'),
      (3, 2, 4, '2026-07-30'),
      (3, 2, 5, '2026-07-31'),
      (3, 3, 1, '2026-08-03'),
      (3, 3, 2, '2026-08-04'),
      (3, 3, 3, '2026-08-05'),
      (3, 3, 4, '2026-08-06'),
      (3, 3, 5, '2026-08-07'),
      (3, 4, 1, '2026-08-10'),
      (3, 4, 2, '2026-08-11'),
      (3, 4, 3, '2026-08-12'),
      (3, 4, 4, '2026-08-13'),
      (3, 4, 5, '2026-08-14'),
      (4, 1, 1, '2026-08-17'),
      (4, 1, 2, '2026-08-18'),
      (4, 1, 3, '2026-08-19'),
      (4, 1, 4, '2026-08-20'),
      (4, 1, 5, '2026-08-21'),
      (4, 2, 1, '2026-08-24'),
      (4, 2, 2, '2026-08-25'),
      (4, 2, 3, '2026-08-26'),
      (4, 2, 4, '2026-08-27'),
      (4, 2, 5, '2026-08-28'),
      (4, 3, 1, '2026-08-31'),
      (4, 3, 2, '2026-09-01'),
      (4, 3, 3, '2026-09-02'),
      (4, 3, 4, '2026-09-03'),
      (4, 3, 5, '2026-09-04'),
      (4, 4, 1, '2026-09-07'),
      (4, 4, 2, '2026-09-08'),
      (4, 4, 3, '2026-09-09'),
      (4, 4, 4, '2026-09-10'),
      (4, 4, 5, '2026-09-11')
    ) as v(ciclo, semana, dia, fecha)
    join routine_days d on d.routine_id = v_rutina and d.orden = v.dia
    join cycles c on c.routine_id = v_rutina and c.numero = v.ciclo
  on conflict (id) do update set fecha = excluded.fecha;

  -- 6. Series levantadas. reps queda NULL: no estaban registradas.
  delete from set_logs sl using workout_sessions s
   where sl.session_id = s.id and s.user_id = v_user
     and s.nota like 'Importado de la planilla original%';

  insert into set_logs (session_id, exercise_id, routine_exercise_id, series, reps, peso, unidad)
  select md5(v_rutina::text || v.ciclo || '-' || v.semana || '-' || v.dia)::uuid,
         x.id, re.id, v.series, null, v.peso, v.unidad
    from (values
      (1, 1, 1, 'Press banca con barra', 3, 52.5, 'kg'),
      (1, 1, 1, 'Press vertical hombro', 3, 27, 'kg'),
      (1, 1, 1, 'Press inclinado', 2, 42.5, 'kg'),
      (1, 1, 1, 'Pect Fly (apertura máquina o polea)', 2, 27, 'kg'),
      (1, 1, 1, 'Elevaciones laterales hombros', 2, 7.5, 'kg'),
      (1, 1, 1, 'Tríceps polea', 3, 8, 'discos'),
      (1, 1, 2, 'Peso muerto (convencional o rumano)', 3, 51.5, 'kg'),
      (1, 1, 2, 'Banco rumano (30 seg)', 3, 5, 'kg'),
      (1, 1, 2, 'Flexión rodilla / Leg curl', 3, 18, 'kg'),
      (1, 1, 2, 'Abducción de cadera (apertura)', 2, 22, 'kg'),
      (1, 1, 2, 'Pantorrilla parado', 3, 50, 'kg'),
      (1, 1, 3, 'Dominadas', 3, 58.5, 'kg'),
      (1, 1, 3, 'Remo sentado', 3, 40.5, 'kg'),
      (1, 1, 3, 'Remo a una mano (polea 45°)', 2, 6, 'discos'),
      (1, 1, 3, 'Apertura espalda', 2, 22, 'kg'),
      (1, 1, 3, 'Pull Over (polea)', 2, 6, 'discos'),
      (1, 1, 3, 'Bíceps polea o máquina', 3, 13.5, 'kg'),
      (1, 1, 4, 'Prensa (Hack squat)', 3, 42.5, 'kg'),
      (1, 1, 4, 'Zancadas / Sentadilla búlgara / Estocadas', 2, 16, 'kg'),
      (1, 1, 4, 'Extensión de rodilla', 3, 22.7, 'kg'),
      (1, 1, 4, 'Aducción de cadera (cerrar)', 2, 22.7, 'kg'),
      (1, 1, 4, 'Pantorrilla sentado', 3, 38, 'kg'),
      (1, 1, 5, 'Press banca con mancuernas o Chest Press (máquina)', 3, 49, 'kg'),
      (1, 2, 1, 'Press banca con barra', 3, 60, 'kg'),
      (1, 2, 1, 'Press vertical hombro', 3, 36, 'kg'),
      (1, 2, 1, 'Press inclinado', 2, 51.5, 'kg'),
      (1, 2, 1, 'Pect Fly (apertura máquina o polea)', 2, 27, 'kg'),
      (1, 2, 1, 'Elevaciones laterales hombros', 2, 8, 'kg'),
      (1, 2, 1, 'Tríceps polea', 3, 9, 'discos'),
      (1, 2, 2, 'Peso muerto (convencional o rumano)', 3, 60, 'kg'),
      (1, 2, 2, 'Banco rumano (30 seg)', 3, 5, 'kg'),
      (1, 2, 2, 'Flexión rodilla / Leg curl', 3, 27, 'kg'),
      (1, 2, 2, 'Abducción de cadera (apertura)', 2, 27, 'kg'),
      (1, 2, 2, 'Pantorrilla parado', 3, 50, 'kg'),
      (1, 2, 3, 'Dominadas', 3, 67.5, 'kg'),
      (1, 2, 3, 'Remo sentado', 3, 50, 'kg'),
      (1, 2, 3, 'Remo a una mano (polea 45°)', 2, 7, 'discos'),
      (1, 2, 3, 'Apertura espalda', 2, 27.5, 'kg'),
      (1, 2, 3, 'Pull Over (polea)', 2, 7, 'discos'),
      (1, 2, 3, 'Bíceps polea o máquina', 3, 18, 'kg'),
      (1, 2, 4, 'Prensa (Hack squat)', 3, 51.5, 'kg'),
      (1, 2, 4, 'Zancadas / Sentadilla búlgara / Estocadas', 2, 24, 'kg'),
      (1, 2, 4, 'Extensión de rodilla', 3, 31.8, 'kg'),
      (1, 2, 4, 'Aducción de cadera (cerrar)', 2, 27.2, 'kg'),
      (1, 2, 4, 'Pantorrilla sentado', 3, 49.5, 'kg'),
      (1, 2, 5, 'Press banca con mancuernas o Chest Press (máquina)', 3, 40, 'kg'),
      (1, 2, 5, 'Remo T o Remo con polea', 3, 42.5, 'kg'),
      (1, 2, 5, 'Fondos', 2, 15, 'cantidad'),
      (1, 2, 5, 'Pull Down', 2, 8, 'discos'),
      (1, 2, 5, 'Curl de bíceps en máquina', 2, 22, 'kg'),
      (1, 2, 5, 'Tríceps máquina o Press francés', 2, 10, 'kg'),
      (1, 3, 1, 'Press banca con barra', 3, 70, 'kg'),
      (1, 3, 1, 'Press vertical hombro', 3, 45, 'kg'),
      (1, 3, 1, 'Press inclinado', 2, 50, 'kg'),
      (1, 3, 1, 'Pect Fly (apertura máquina o polea)', 2, 45, 'kg'),
      (1, 3, 1, 'Elevaciones laterales hombros', 2, 10, 'kg'),
      (1, 3, 1, 'Tríceps polea', 3, 10, 'discos'),
      (1, 3, 2, 'Peso muerto (convencional o rumano)', 3, 70, 'kg'),
      (1, 3, 2, 'Banco rumano (30 seg)', 3, 5, 'kg'),
      (1, 3, 2, 'Flexión rodilla / Leg curl', 3, 36, 'kg'),
      (1, 3, 2, 'Abducción de cadera (apertura)', 2, 36, 'kg'),
      (1, 3, 2, 'Pantorrilla parado', 3, 50, 'kg'),
      (1, 3, 3, 'Dominadas', 3, 76.5, 'kg'),
      (1, 3, 3, 'Remo sentado', 3, 81, 'kg'),
      (1, 3, 3, 'Remo a una mano (polea 45°)', 2, 9, 'discos'),
      (1, 3, 3, 'Apertura espalda', 2, 31.5, 'kg'),
      (1, 3, 3, 'Pull Over (polea)', 2, 9, 'discos'),
      (1, 3, 3, 'Bíceps polea o máquina', 3, 18.5, 'kg'),
      (1, 3, 4, 'Prensa (Hack squat)', 3, 60.5, 'kg'),
      (1, 3, 4, 'Zancadas / Sentadilla búlgara / Estocadas', 2, 32, 'kg'),
      (1, 3, 4, 'Extensión de rodilla', 3, 40.5, 'kg'),
      (1, 3, 4, 'Aducción de cadera (cerrar)', 2, 31.5, 'kg'),
      (1, 3, 4, 'Pantorrilla sentado', 3, 61.3, 'kg'),
      (1, 3, 5, 'Press banca con mancuernas o Chest Press (máquina)', 3, 50, 'kg'),
      (1, 3, 5, 'Remo T o Remo con polea', 3, 50, 'kg'),
      (1, 3, 5, 'Fondos', 2, 10, 'cantidad'),
      (1, 3, 5, 'Pull Down', 2, 9, 'discos'),
      (1, 3, 5, 'Curl de bíceps en máquina', 2, 22.5, 'kg'),
      (1, 3, 5, 'Tríceps máquina o Press francés', 2, 22.5, 'kg'),
      (1, 4, 1, 'Press banca con barra', 3, 72.5, 'kg'),
      (1, 4, 1, 'Press vertical hombro', 3, 45, 'kg'),
      (1, 4, 1, 'Press inclinado', 2, 59, 'kg'),
      (1, 4, 1, 'Pect Fly (apertura máquina o polea)', 2, 49.5, 'kg'),
      (1, 4, 1, 'Elevaciones laterales hombros', 2, 12.5, 'kg'),
      (1, 4, 1, 'Tríceps polea', 3, 10, 'discos'),
      (1, 4, 2, 'Peso muerto (convencional o rumano)', 3, 83, 'kg'),
      (1, 4, 2, 'Banco rumano (30 seg)', 3, 5, 'kg'),
      (1, 4, 2, 'Flexión rodilla / Leg curl', 3, 45, 'kg'),
      (1, 4, 2, 'Abducción de cadera (apertura)', 2, 36, 'kg'),
      (1, 4, 2, 'Pantorrilla parado', 3, 50, 'kg'),
      (1, 4, 3, 'Dominadas', 3, 85, 'kg'),
      (1, 4, 3, 'Remo sentado', 3, 90.5, 'kg'),
      (1, 4, 3, 'Remo a una mano (polea 45°)', 2, 11, 'discos'),
      (1, 4, 3, 'Apertura espalda', 2, 36, 'kg'),
      (1, 4, 3, 'Pull Over (polea)', 2, 11, 'discos'),
      (1, 4, 3, 'Bíceps polea o máquina', 3, 18.5, 'kg'),
      (1, 4, 4, 'Prensa (Hack squat)', 3, 60, 'kg'),
      (1, 4, 4, 'Zancadas / Sentadilla búlgara / Estocadas', 2, 32, 'kg'),
      (1, 4, 4, 'Extensión de rodilla', 3, 36, 'kg'),
      (1, 4, 4, 'Aducción de cadera (cerrar)', 2, 59, 'kg'),
      (1, 4, 4, 'Pantorrilla sentado', 3, 70, 'kg'),
      (1, 4, 5, 'Press banca con mancuernas o Chest Press (máquina)', 3, 50, 'kg'),
      (1, 4, 5, 'Remo T o Remo con polea', 3, 56.3, 'kg'),
      (1, 4, 5, 'Fondos', 2, 10, 'cantidad'),
      (1, 4, 5, 'Pull Down', 2, 11, 'discos'),
      (1, 4, 5, 'Curl de bíceps en máquina', 2, 22.5, 'kg'),
      (1, 4, 5, 'Tríceps máquina o Press francés', 2, 22.5, 'kg'),
      (2, 1, 1, 'Press banca con barra', 3, 51.5, 'kg'),
      (2, 1, 1, 'Press vertical hombro', 3, 27, 'kg'),
      (2, 1, 1, 'Press inclinado', 2, 42.5, 'kg'),
      (2, 1, 1, 'Pect Fly (apertura máquina o polea)', 2, 27, 'kg'),
      (2, 1, 1, 'Elevaciones laterales hombros', 2, 8, 'kg'),
      (2, 1, 1, 'Tríceps polea', 3, 8, 'discos'),
      (2, 1, 2, 'Peso muerto (convencional o rumano)', 3, 51, 'kg'),
      (2, 1, 2, 'Banco rumano (30 seg)', 3, 5, 'kg'),
      (2, 1, 2, 'Flexión rodilla / Leg curl', 3, 49.9, 'kg'),
      (2, 1, 2, 'Abducción de cadera (apertura)', 2, 31, 'kg'),
      (2, 1, 2, 'Pantorrilla parado', 3, 50, 'kg'),
      (2, 1, 3, 'Dominadas', 3, 58.5, 'kg'),
      (2, 1, 3, 'Remo sentado', 3, 63, 'kg'),
      (2, 1, 3, 'Remo a una mano (polea 45°)', 2, 7, 'discos'),
      (2, 1, 3, 'Apertura espalda', 2, 22, 'kg'),
      (2, 1, 3, 'Pull Over (polea)', 2, 8, 'discos'),
      (2, 1, 3, 'Bíceps polea o máquina', 3, 13.1, 'kg'),
      (2, 1, 4, 'Prensa (Hack squat)', 3, 50, 'kg'),
      (2, 1, 4, 'Zancadas / Sentadilla búlgara / Estocadas', 2, 16, 'kg'),
      (2, 1, 4, 'Extensión de rodilla', 3, 49.5, 'kg'),
      (2, 1, 4, 'Aducción de cadera (cerrar)', 2, 31, 'kg'),
      (2, 1, 4, 'Pantorrilla sentado', 3, 50, 'kg'),
      (2, 1, 5, 'Press banca con mancuernas o Chest Press (máquina)', 3, 40, 'kg'),
      (2, 1, 5, 'Remo T o Remo con polea', 3, 40, 'kg'),
      (2, 1, 5, 'Fondos', 2, 10, 'cantidad'),
      (2, 1, 5, 'Pull Down', 2, 8, 'discos'),
      (2, 1, 5, 'Curl de bíceps en máquina', 2, 13.5, 'kg'),
      (2, 1, 5, 'Tríceps máquina o Press francés', 2, 10, 'kg'),
      (2, 2, 1, 'Press banca con barra', 3, 60, 'kg'),
      (2, 2, 1, 'Press vertical hombro', 3, 36, 'kg'),
      (2, 2, 1, 'Press inclinado', 2, 50, 'kg'),
      (2, 2, 1, 'Pect Fly (apertura máquina o polea)', 2, 27, 'kg'),
      (2, 2, 1, 'Elevaciones laterales hombros', 2, 10, 'kg'),
      (2, 2, 1, 'Tríceps polea', 3, 9, 'discos'),
      (2, 2, 2, 'Peso muerto (convencional o rumano)', 3, 60, 'kg'),
      (2, 2, 2, 'Banco rumano (30 seg)', 3, 5, 'kg'),
      (2, 2, 2, 'Flexión rodilla / Leg curl', 3, 49.9, 'kg'),
      (2, 2, 2, 'Abducción de cadera (apertura)', 2, 31, 'kg'),
      (2, 2, 2, 'Pantorrilla parado', 3, 50, 'kg'),
      (2, 2, 3, 'Dominadas', 3, 81, 'kg'),
      (2, 2, 3, 'Remo sentado', 3, 63, 'kg'),
      (2, 2, 3, 'Remo a una mano (polea 45°)', 2, 8, 'discos'),
      (2, 2, 3, 'Apertura espalda', 2, 40.5, 'kg'),
      (2, 2, 3, 'Pull Over (polea)', 2, 8, 'discos'),
      (2, 2, 3, 'Bíceps polea o máquina', 3, 17, 'kg'),
      (2, 2, 4, 'Prensa (Hack squat)', 3, 60, 'kg'),
      (2, 2, 4, 'Zancadas / Sentadilla búlgara / Estocadas', 2, 16, 'kg'),
      (2, 2, 4, 'Extensión de rodilla', 3, 59, 'kg'),
      (2, 2, 4, 'Aducción de cadera (cerrar)', 2, 36, 'kg'),
      (2, 2, 4, 'Pantorrilla sentado', 3, 60, 'kg'),
      (2, 2, 5, 'Press banca con mancuernas o Chest Press (máquina)', 3, 45, 'kg'),
      (2, 2, 5, 'Remo T o Remo con polea', 3, 51.8, 'kg'),
      (2, 2, 5, 'Fondos', 2, 12, 'cantidad'),
      (2, 2, 5, 'Pull Down', 2, 8, 'discos'),
      (2, 2, 5, 'Curl de bíceps en máquina', 2, 22.5, 'kg'),
      (2, 2, 5, 'Tríceps máquina o Press francés', 2, 10, 'kg'),
      (2, 3, 1, 'Press banca con barra', 3, 70, 'kg'),
      (2, 3, 1, 'Press vertical hombro', 3, 45, 'kg'),
      (2, 3, 1, 'Press inclinado', 2, 50, 'kg'),
      (2, 3, 1, 'Pect Fly (apertura máquina o polea)', 2, 36, 'kg'),
      (2, 3, 1, 'Elevaciones laterales hombros', 2, 12.5, 'kg'),
      (2, 3, 1, 'Tríceps polea', 3, 10, 'discos'),
      (2, 3, 2, 'Peso muerto (convencional o rumano)', 3, 70, 'kg'),
      (2, 3, 2, 'Banco rumano (30 seg)', 3, 11.3, 'kg'),
      (2, 3, 2, 'Flexión rodilla / Leg curl', 3, 68, 'kg'),
      (2, 3, 2, 'Abducción de cadera (apertura)', 2, 36.5, 'kg'),
      (2, 3, 2, 'Pantorrilla parado', 3, 72.5, 'kg'),
      (2, 3, 3, 'Dominadas', 3, 94.5, 'kg'),
      (2, 3, 3, 'Remo sentado', 3, 81, 'kg'),
      (2, 3, 3, 'Remo a una mano (polea 45°)', 2, 8, 'discos'),
      (2, 3, 3, 'Apertura espalda', 2, 49.5, 'kg'),
      (2, 3, 3, 'Pull Over (polea)', 2, 10, 'discos'),
      (2, 3, 3, 'Bíceps polea o máquina', 3, 18.1, 'kg'),
      (2, 3, 4, 'Prensa (Hack squat)', 3, 70, 'kg'),
      (2, 3, 4, 'Zancadas / Sentadilla búlgara / Estocadas', 2, 20, 'kg'),
      (2, 3, 4, 'Extensión de rodilla', 3, 68, 'kg'),
      (2, 3, 4, 'Aducción de cadera (cerrar)', 2, 40.5, 'kg'),
      (2, 3, 4, 'Pantorrilla sentado', 3, 65, 'kg'),
      (2, 3, 5, 'Press banca con mancuernas o Chest Press (máquina)', 3, 50, 'kg'),
      (2, 3, 5, 'Remo T o Remo con polea', 3, 60.8, 'kg'),
      (2, 3, 5, 'Fondos', 2, 12, 'cantidad'),
      (2, 3, 5, 'Pull Down', 2, 10, 'discos'),
      (2, 3, 5, 'Curl de bíceps en máquina', 2, 22.5, 'kg'),
      (2, 3, 5, 'Tríceps máquina o Press francés', 2, 10, 'kg'),
      (2, 4, 1, 'Press banca con barra', 3, 79, 'kg'),
      (2, 4, 1, 'Press vertical hombro', 3, 54, 'kg'),
      (2, 4, 1, 'Press inclinado', 2, 60.5, 'kg'),
      (2, 4, 1, 'Pect Fly (apertura máquina o polea)', 2, 40.5, 'kg'),
      (2, 4, 1, 'Elevaciones laterales hombros', 2, 15, 'kg'),
      (2, 4, 1, 'Tríceps polea', 3, 11, 'discos'),
      (2, 4, 2, 'Peso muerto (convencional o rumano)', 3, 83, 'kg'),
      (2, 4, 2, 'Banco rumano (30 seg)', 3, 11.3, 'kg'),
      (2, 4, 2, 'Flexión rodilla / Leg curl', 3, 68, 'kg'),
      (2, 4, 2, 'Abducción de cadera (apertura)', 2, 40.5, 'kg'),
      (2, 4, 2, 'Pantorrilla parado', 3, 72.5, 'kg'),
      (2, 4, 3, 'Dominadas', 3, 94, 'kg'),
      (2, 4, 3, 'Remo sentado', 3, 95, 'kg'),
      (2, 4, 3, 'Remo a una mano (polea 45°)', 2, 11, 'discos'),
      (2, 4, 3, 'Apertura espalda', 2, 58.5, 'kg'),
      (2, 4, 3, 'Pull Over (polea)', 2, 11, 'discos'),
      (2, 4, 3, 'Bíceps polea o máquina', 3, 22.7, 'kg'),
      (2, 4, 4, 'Prensa (Hack squat)', 3, 80, 'kg'),
      (2, 4, 4, 'Zancadas / Sentadilla búlgara / Estocadas', 2, 32, 'kg'),
      (2, 4, 4, 'Extensión de rodilla', 3, 77, 'kg'),
      (2, 4, 4, 'Aducción de cadera (cerrar)', 2, 40, 'kg'),
      (2, 4, 4, 'Pantorrilla sentado', 3, 70, 'kg'),
      (2, 4, 5, 'Press banca con mancuernas o Chest Press (máquina)', 3, 62, 'kg'),
      (2, 4, 5, 'Remo T o Remo con polea', 3, 60.8, 'kg'),
      (2, 4, 5, 'Fondos', 2, 12, 'cantidad'),
      (2, 4, 5, 'Pull Down', 2, 11, 'discos'),
      (2, 4, 5, 'Curl de bíceps en máquina', 2, 22.5, 'kg'),
      (2, 4, 5, 'Tríceps máquina o Press francés', 2, 22, 'kg'),
      (3, 1, 1, 'Press banca con barra', 3, 60, 'kg'),
      (3, 1, 1, 'Press vertical hombro', 3, 27, 'kg'),
      (3, 1, 1, 'Press inclinado', 2, 51.5, 'kg'),
      (3, 1, 1, 'Pect Fly (apertura máquina o polea)', 2, 31.5, 'kg'),
      (3, 1, 1, 'Elevaciones laterales hombros', 2, 10, 'kg'),
      (3, 1, 1, 'Tríceps polea', 3, 9, 'discos'),
      (3, 1, 2, 'Peso muerto (convencional o rumano)', 3, 60, 'kg'),
      (3, 1, 2, 'Banco rumano (30 seg)', 3, 11.5, 'kg'),
      (3, 1, 2, 'Flexión rodilla / Leg curl', 3, 59, 'kg'),
      (3, 1, 2, 'Abducción de cadera (apertura)', 2, 36, 'kg'),
      (3, 1, 2, 'Pantorrilla parado', 3, 70, 'kg'),
      (3, 1, 3, 'Dominadas', 3, 67, 'kg'),
      (3, 1, 3, 'Remo sentado', 3, 60, 'kg'),
      (3, 1, 3, 'Remo a una mano (polea 45°)', 2, 7, 'discos'),
      (3, 1, 3, 'Apertura espalda', 2, 36, 'kg'),
      (3, 1, 3, 'Pull Over (polea)', 2, 8, 'discos'),
      (3, 1, 3, 'Bíceps polea o máquina', 3, 13.1, 'kg'),
      (3, 1, 4, 'Prensa (Hack squat)', 3, 50, 'kg'),
      (3, 1, 4, 'Zancadas / Sentadilla búlgara / Estocadas', 2, 16, 'kg'),
      (3, 1, 4, 'Extensión de rodilla', 3, 49.5, 'kg'),
      (3, 1, 4, 'Aducción de cadera (cerrar)', 2, 31, 'kg'),
      (3, 1, 4, 'Pantorrilla sentado', 3, 50, 'kg'),
      (3, 2, 1, 'Press banca con barra', 3, 65, 'kg'),
      (3, 2, 1, 'Press vertical hombro', 3, 36, 'kg'),
      (3, 2, 1, 'Press inclinado', 2, 51.5, 'kg'),
      (3, 2, 1, 'Pect Fly (apertura máquina o polea)', 2, 36, 'kg'),
      (3, 2, 1, 'Elevaciones laterales hombros', 2, 12, 'kg'),
      (3, 2, 1, 'Tríceps polea', 3, 10, 'discos'),
      (3, 2, 2, 'Peso muerto (convencional o rumano)', 3, 74, 'kg'),
      (3, 2, 2, 'Banco rumano (30 seg)', 3, 11.5, 'kg'),
      (3, 2, 2, 'Flexión rodilla / Leg curl', 3, 68, 'kg'),
      (3, 2, 2, 'Abducción de cadera (apertura)', 2, 41, 'kg'),
      (3, 2, 2, 'Pantorrilla parado', 3, 76.5, 'kg'),
      (3, 2, 3, 'Dominadas', 3, 76, 'kg'),
      (3, 2, 3, 'Remo sentado', 3, 80, 'kg'),
      (3, 2, 3, 'Remo a una mano (polea 45°)', 2, 9, 'discos'),
      (3, 2, 3, 'Apertura espalda', 2, 40, 'kg'),
      (3, 2, 3, 'Pull Over (polea)', 2, 10, 'discos'),
      (3, 2, 3, 'Bíceps polea o máquina', 3, 18.5, 'kg'),
      (3, 2, 4, 'Prensa (Hack squat)', 3, 60, 'kg'),
      (3, 2, 4, 'Zancadas / Sentadilla búlgara / Estocadas', 2, 24, 'kg'),
      (3, 2, 4, 'Extensión de rodilla', 3, 68, 'kg'),
      (3, 2, 4, 'Aducción de cadera (cerrar)', 2, 40, 'kg'),
      (3, 2, 4, 'Pantorrilla sentado', 3, 65, 'kg'),
      (3, 2, 5, 'Press banca con mancuernas o Chest Press (máquina)', 3, 45, 'kg'),
      (3, 2, 5, 'Remo T o Remo con polea', 3, 50, 'kg'),
      (3, 2, 5, 'Fondos', 2, 12, 'cantidad'),
      (3, 2, 5, 'Pull Down', 2, 9, 'discos'),
      (3, 2, 5, 'Curl de bíceps en máquina', 2, 27, 'kg'),
      (3, 2, 5, 'Tríceps máquina o Press francés', 2, 10, 'kg'),
      (3, 3, 1, 'Press banca con barra', 3, 70, 'kg'),
      (3, 3, 1, 'Press vertical hombro', 3, 40, 'kg'),
      (3, 3, 1, 'Press inclinado', 2, 60, 'kg'),
      (3, 3, 1, 'Pect Fly (apertura máquina o polea)', 2, 40, 'kg'),
      (3, 3, 1, 'Elevaciones laterales hombros', 2, 15, 'kg'),
      (3, 3, 1, 'Tríceps polea', 3, 11, 'discos'),
      (3, 3, 2, 'Peso muerto (convencional o rumano)', 3, 80, 'kg'),
      (3, 3, 2, 'Banco rumano (30 seg)', 3, 11, 'kg'),
      (3, 3, 2, 'Flexión rodilla / Leg curl', 3, 77, 'kg'),
      (3, 3, 2, 'Abducción de cadera (apertura)', 2, 41, 'kg'),
      (3, 3, 2, 'Pantorrilla parado', 3, 80, 'kg'),
      (3, 3, 3, 'Dominadas', 3, 86, 'kg'),
      (3, 3, 3, 'Remo sentado', 3, 85, 'kg'),
      (3, 3, 3, 'Remo a una mano (polea 45°)', 2, 10, 'discos'),
      (3, 3, 3, 'Apertura espalda', 2, 40, 'kg'),
      (3, 3, 3, 'Pull Over (polea)', 2, 10, 'discos'),
      (3, 3, 3, 'Bíceps polea o máquina', 3, 18.5, 'kg'),
      (3, 3, 4, 'Prensa (Hack squat)', 3, 74, 'kg'),
      (3, 3, 4, 'Zancadas / Sentadilla búlgara / Estocadas', 2, 30, 'kg'),
      (3, 3, 4, 'Extensión de rodilla', 3, 77, 'kg'),
      (3, 3, 4, 'Aducción de cadera (cerrar)', 2, 40, 'kg'),
      (3, 3, 4, 'Pantorrilla sentado', 3, 65, 'kg'),
      (3, 3, 5, 'Press banca con mancuernas o Chest Press (máquina)', 3, 62, 'kg'),
      (3, 3, 5, 'Remo T o Remo con polea', 3, 60, 'kg'),
      (3, 3, 5, 'Fondos', 2, 12, 'cantidad'),
      (3, 3, 5, 'Pull Down', 2, 10, 'discos'),
      (3, 3, 5, 'Curl de bíceps en máquina', 2, 22, 'kg'),
      (3, 3, 5, 'Tríceps máquina o Press francés', 2, 22, 'kg'),
      (3, 4, 1, 'Press banca con barra', 3, 83, 'kg'),
      (3, 4, 1, 'Press vertical hombro', 3, 54, 'kg'),
      (3, 4, 1, 'Press inclinado', 2, 70, 'kg'),
      (3, 4, 1, 'Pect Fly (apertura máquina o polea)', 2, 49.5, 'kg'),
      (3, 4, 1, 'Elevaciones laterales hombros', 2, 17.5, 'kg'),
      (3, 4, 1, 'Tríceps polea', 3, 11, 'discos'),
      (3, 4, 2, 'Peso muerto (convencional o rumano)', 3, 90, 'kg'),
      (3, 4, 2, 'Banco rumano (30 seg)', 3, 11, 'kg'),
      (3, 4, 2, 'Flexión rodilla / Leg curl', 3, 77, 'kg'),
      (3, 4, 2, 'Abducción de cadera (apertura)', 2, 40, 'kg'),
      (3, 4, 2, 'Pantorrilla parado', 3, 80, 'kg'),
      (3, 4, 3, 'Dominadas', 3, 95, 'kg'),
      (3, 4, 3, 'Remo sentado', 3, 90, 'kg'),
      (3, 4, 3, 'Remo a una mano (polea 45°)', 2, 10, 'discos'),
      (3, 4, 3, 'Apertura espalda', 2, 54, 'kg'),
      (3, 4, 3, 'Pull Over (polea)', 2, 10, 'discos'),
      (3, 4, 3, 'Bíceps polea o máquina', 3, 18.5, 'kg'),
      (3, 4, 4, 'Prensa (Hack squat)', 3, 90, 'kg'),
      (3, 4, 4, 'Zancadas / Sentadilla búlgara / Estocadas', 2, 35, 'kg'),
      (3, 4, 4, 'Extensión de rodilla', 3, 86, 'kg'),
      (3, 4, 4, 'Aducción de cadera (cerrar)', 2, 45, 'kg'),
      (3, 4, 4, 'Pantorrilla sentado', 3, 65, 'kg'),
      (3, 4, 5, 'Press banca con mancuernas o Chest Press (máquina)', 3, 63, 'kg'),
      (3, 4, 5, 'Remo T o Remo con polea', 3, 65, 'kg'),
      (3, 4, 5, 'Fondos', 2, 12, 'cantidad'),
      (3, 4, 5, 'Pull Down', 2, 12, 'discos'),
      (3, 4, 5, 'Curl de bíceps en máquina', 2, 22, 'kg'),
      (3, 4, 5, 'Tríceps máquina o Press francés', 2, 22, 'kg'),
      (4, 1, 1, 'Press banca con barra', 3, 60, 'kg'),
      (4, 1, 1, 'Press vertical hombro', 3, 20, 'kg'),
      (4, 1, 1, 'Press inclinado', 2, 42.5, 'kg'),
      (4, 1, 1, 'Pect Fly (apertura máquina o polea)', 2, 36, 'kg'),
      (4, 1, 1, 'Elevaciones laterales hombros', 2, 12, 'kg'),
      (4, 1, 1, 'Tríceps polea', 3, 11, 'discos'),
      (4, 1, 2, 'Peso muerto (convencional o rumano)', 3, 60, 'kg'),
      (4, 1, 2, 'Banco rumano (30 seg)', 3, 11, 'kg'),
      (4, 1, 2, 'Flexión rodilla / Leg curl', 3, 59, 'kg'),
      (4, 1, 2, 'Abducción de cadera (apertura)', 2, 36, 'kg'),
      (4, 1, 2, 'Pantorrilla parado', 3, 60, 'kg'),
      (4, 1, 3, 'Dominadas', 3, 67, 'kg'),
      (4, 1, 3, 'Remo sentado', 3, 62, 'kg'),
      (4, 1, 3, 'Remo a una mano (polea 45°)', 2, 10, 'discos'),
      (4, 1, 3, 'Apertura espalda', 2, 36, 'kg'),
      (4, 1, 3, 'Pull Over (polea)', 2, 10, 'discos'),
      (4, 1, 3, 'Bíceps polea o máquina', 3, 13.1, 'kg'),
      (4, 1, 4, 'Prensa (Hack squat)', 3, 62, 'kg'),
      (4, 1, 4, 'Zancadas / Sentadilla búlgara / Estocadas', 2, 20, 'kg'),
      (4, 1, 4, 'Extensión de rodilla', 3, 49.5, 'kg'),
      (4, 1, 4, 'Aducción de cadera (cerrar)', 2, 36, 'kg'),
      (4, 1, 4, 'Pantorrilla sentado', 3, 50, 'kg'),
      (4, 1, 5, 'Press banca con mancuernas o Chest Press (máquina)', 3, 45, 'kg'),
      (4, 1, 5, 'Remo T o Remo con polea', 3, 50, 'kg'),
      (4, 1, 5, 'Fondos', 2, 12, 'cantidad'),
      (4, 1, 5, 'Pull Down', 2, 9, 'discos'),
      (4, 1, 5, 'Curl de bíceps en máquina', 2, 27, 'kg'),
      (4, 1, 5, 'Tríceps máquina o Press francés', 2, 10, 'kg'),
      (4, 2, 1, 'Press banca con barra', 3, 61, 'kg'),
      (4, 2, 1, 'Press vertical hombro', 3, 36.5, 'kg'),
      (4, 2, 1, 'Press inclinado', 2, 50, 'kg'),
      (4, 2, 1, 'Pect Fly (apertura máquina o polea)', 2, 40, 'kg'),
      (4, 2, 1, 'Elevaciones laterales hombros', 2, 12, 'kg'),
      (4, 2, 1, 'Tríceps polea', 3, 11, 'discos'),
      (4, 2, 2, 'Peso muerto (convencional o rumano)', 3, 70, 'kg'),
      (4, 2, 2, 'Banco rumano (30 seg)', 3, 11, 'kg'),
      (4, 2, 2, 'Flexión rodilla / Leg curl', 3, 68, 'kg'),
      (4, 2, 2, 'Abducción de cadera (apertura)', 2, 40, 'kg'),
      (4, 2, 2, 'Pantorrilla parado', 3, 74, 'kg'),
      (4, 2, 3, 'Dominadas', 3, 76.5, 'kg'),
      (4, 2, 3, 'Remo sentado', 3, 72, 'kg'),
      (4, 2, 3, 'Remo a una mano (polea 45°)', 2, 11, 'discos'),
      (4, 2, 3, 'Apertura espalda', 2, 40, 'kg'),
      (4, 2, 3, 'Pull Over (polea)', 2, 11, 'discos'),
      (4, 2, 3, 'Bíceps polea o máquina', 3, 18.5, 'kg'),
      (4, 2, 4, 'Prensa (Hack squat)', 3, 70, 'kg'),
      (4, 2, 4, 'Zancadas / Sentadilla búlgara / Estocadas', 2, 24, 'kg'),
      (4, 2, 4, 'Extensión de rodilla', 3, 68, 'kg'),
      (4, 2, 4, 'Aducción de cadera (cerrar)', 2, 40, 'kg'),
      (4, 2, 4, 'Pantorrilla sentado', 3, 70, 'kg'),
      (4, 2, 5, 'Press banca con mancuernas o Chest Press (máquina)', 3, 50, 'kg'),
      (4, 2, 5, 'Remo T o Remo con polea', 3, 55, 'kg'),
      (4, 2, 5, 'Fondos', 2, 12, 'cantidad'),
      (4, 2, 5, 'Pull Down', 2, 10, 'discos'),
      (4, 2, 5, 'Curl de bíceps en máquina', 2, 22, 'kg'),
      (4, 2, 5, 'Tríceps máquina o Press francés', 2, 10, 'kg'),
      (4, 3, 1, 'Press banca con barra', 3, 70, 'kg'),
      (4, 3, 1, 'Press vertical hombro', 3, 45, 'kg'),
      (4, 3, 1, 'Press inclinado', 2, 60, 'kg'),
      (4, 3, 1, 'Pect Fly (apertura máquina o polea)', 2, 40, 'kg'),
      (4, 3, 1, 'Elevaciones laterales hombros', 2, 12, 'kg'),
      (4, 3, 1, 'Tríceps polea', 3, 13, 'discos'),
      (4, 3, 2, 'Peso muerto (convencional o rumano)', 3, 80, 'kg'),
      (4, 3, 2, 'Banco rumano (30 seg)', 3, 11, 'kg'),
      (4, 3, 2, 'Flexión rodilla / Leg curl', 3, 68, 'kg'),
      (4, 3, 2, 'Abducción de cadera (apertura)', 2, 40, 'kg'),
      (4, 3, 2, 'Pantorrilla parado', 3, 74, 'kg'),
      (4, 3, 3, 'Dominadas', 3, 85.5, 'kg'),
      (4, 3, 3, 'Remo sentado', 3, 91, 'kg'),
      (4, 3, 3, 'Remo a una mano (polea 45°)', 2, 11, 'discos'),
      (4, 3, 3, 'Apertura espalda', 2, 49, 'kg'),
      (4, 3, 3, 'Pull Over (polea)', 2, 11, 'discos'),
      (4, 3, 3, 'Bíceps polea o máquina', 3, 18.5, 'kg'),
      (4, 3, 4, 'Prensa (Hack squat)', 3, 70, 'kg'),
      (4, 3, 4, 'Zancadas / Sentadilla búlgara / Estocadas', 2, 30, 'kg'),
      (4, 3, 4, 'Extensión de rodilla', 3, 68, 'kg'),
      (4, 3, 4, 'Aducción de cadera (cerrar)', 2, 40, 'kg'),
      (4, 3, 4, 'Pantorrilla sentado', 3, 70, 'kg'),
      (4, 3, 5, 'Press banca con mancuernas o Chest Press (máquina)', 3, 62, 'kg'),
      (4, 3, 5, 'Remo T o Remo con polea', 3, 60, 'kg'),
      (4, 3, 5, 'Fondos', 2, 12, 'cantidad'),
      (4, 3, 5, 'Pull Down', 2, 10, 'discos'),
      (4, 3, 5, 'Curl de bíceps en máquina', 2, 22, 'kg'),
      (4, 3, 5, 'Tríceps máquina o Press francés', 2, 10, 'kg'),
      (4, 4, 1, 'Press banca con barra', 3, 80, 'kg'),
      (4, 4, 1, 'Press vertical hombro', 3, 54, 'kg'),
      (4, 4, 1, 'Press inclinado', 2, 60, 'kg'),
      (4, 4, 1, 'Pect Fly (apertura máquina o polea)', 2, 49.5, 'kg'),
      (4, 4, 1, 'Elevaciones laterales hombros', 2, 15, 'kg'),
      (4, 4, 1, 'Tríceps polea', 3, 13, 'discos'),
      (4, 4, 2, 'Peso muerto (convencional o rumano)', 3, 92.5, 'kg'),
      (4, 4, 2, 'Banco rumano (30 seg)', 3, 11, 'kg'),
      (4, 4, 2, 'Flexión rodilla / Leg curl', 3, 77, 'kg'),
      (4, 4, 2, 'Abducción de cadera (apertura)', 2, 45, 'kg'),
      (4, 4, 2, 'Pantorrilla parado', 3, 74, 'kg'),
      (4, 4, 3, 'Dominadas', 3, 95, 'kg'),
      (4, 4, 3, 'Remo sentado', 3, 100, 'kg'),
      (4, 4, 3, 'Remo a una mano (polea 45°)', 2, 11, 'discos'),
      (4, 4, 3, 'Apertura espalda', 2, 49, 'kg'),
      (4, 4, 3, 'Pull Over (polea)', 2, 11, 'discos'),
      (4, 4, 3, 'Bíceps polea o máquina', 3, 22.5, 'kg'),
      (4, 4, 4, 'Prensa (Hack squat)', 3, 70, 'kg'),
      (4, 4, 4, 'Zancadas / Sentadilla búlgara / Estocadas', 2, 40, 'kg'),
      (4, 4, 4, 'Extensión de rodilla', 3, 89, 'kg'),
      (4, 4, 4, 'Aducción de cadera (cerrar)', 2, 45, 'kg'),
      (4, 4, 4, 'Pantorrilla sentado', 3, 60, 'kg'),
      (4, 4, 5, 'Press banca con mancuernas o Chest Press (máquina)', 3, 67.5, 'kg'),
      (4, 4, 5, 'Remo T o Remo con polea', 3, 70, 'kg'),
      (4, 4, 5, 'Fondos', 2, 12, 'cantidad'),
      (4, 4, 5, 'Pull Down', 2, 11, 'discos'),
      (4, 4, 5, 'Curl de bíceps en máquina', 2, 27, 'kg'),
      (4, 4, 5, 'Tríceps máquina o Press francés', 2, 11, 'kg')
    ) as v(ciclo, semana, dia, nombre, series, peso, unidad)
    join exercises x on x.nombre = v.nombre and x.es_global
    join routine_days d on d.routine_id = v_rutina and d.orden = v.dia
    join routine_exercises re on re.routine_day_id = d.id and re.exercise_id = x.id;

  raise notice 'Migración completada: % sesiones', (select count(*) from workout_sessions where user_id = v_user);
end $$;

-- Comprobación
select 'ejercicios en catálogo' as que, count(*)::text as cuantos from exercises where es_global
union all select 'sesiones', count(*)::text from workout_sessions
union all select 'registros de ejercicio', count(*)::text from set_logs
union all select 'series en total', sum(series)::text from set_logs
union all select 'registros sin repeticiones', count(*)::text from set_logs where reps is null
union all select 'peso máximo registrado', max(peso)::text from set_logs;
