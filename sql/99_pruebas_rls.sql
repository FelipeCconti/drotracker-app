-- ============================================================
-- DRO.TRACKER · prueba de aislamiento entre usuarios
--
-- NO es una migración. Crea cinco usuarios de prueba, se pone en la
-- piel de cada uno para verificar qué puede ver y escribir, y al
-- terminar los borra a todos. La base queda como estaba.
--
-- CÓMO SE USA: pegar entero en el SQL Editor de Supabase y darle Run.
-- Devuelve una tabla con una fila por prueba. Todas tienen que decir OK.
--
-- Al terminar de revisar, se limpia con:
--     drop table _pruebas_rls;
--
-- QUÉ COMPRUEBA:
--   · Quien no fue invitado queda pendiente y no ve nada
--   · Un atleta no ve ni escribe los datos de otro
--   · El coach lee a su atleta, pero no le edita el entrenamiento
--     mientras el atleta no le encienda puede_registrar
--   · Encendido, el coach registra; revocado, deja de poder al instante
--   · El coach no se enciende ese permiso solo, ni un tercero por él
--   · Cada fila queda sellada con quién la escribió
--   · Registrar NO abre la composición corporal
--   · El admin concede y revoca permisos (mesa de ayuda), reasigna
--     vínculos borrando e insertando, y no reescribe quién es el atleta
--   · La composición corporal no se ve sin permiso expreso del dueño
--   · El admin ve el entrenamiento de todos y la composición de nadie
--   · Nadie puede ascenderse a sí mismo ni auto-aprobarse
-- ============================================================

drop table if exists _pruebas_rls;
create table _pruebas_rls (n int, prueba text, obtenido text, esperado text);
grant all on _pruebas_rls to authenticated;

do $$
declare
  FELIPE constant uuid := '11111111-1111-1111-1111-111111111111';
  BEA    constant uuid := '22222222-2222-2222-2222-222222222222';
  CARLOS constant uuid := '33333333-3333-3333-3333-333333333333';
  DIEGO  constant uuid := '44444444-4444-4444-4444-444444444444';
  EVA    constant uuid := '55555555-5555-5555-5555-555555555555';
  EJERCICIO constant uuid := '66666666-6666-6666-6666-666666666666';
  SESION_CARLOS constant uuid := 'aaaaaaaa-0000-0000-0000-000000000002';
  n int;
  txt text;
begin
  -- ----------------------------------------------------------
  -- Montaje. Corre como dueño de las tablas, así que salta RLS.
  -- ----------------------------------------------------------
  delete from auth.users where id in (FELIPE, BEA, CARLOS, DIEGO, EVA);
  delete from invitaciones where email like '%@prueba.local';

  insert into invitaciones (email) values
    ('felipe@prueba.local'), ('bea@prueba.local'),
    ('carlos@prueba.local'), ('diego@prueba.local');
  -- eva@prueba.local queda fuera de la lista a propósito

  insert into auth.users (id, email) values
    (FELIPE, 'felipe@prueba.local'), (BEA, 'bea@prueba.local'),
    (CARLOS, 'carlos@prueba.local'), (DIEGO, 'diego@prueba.local'),
    (EVA,   'eva@prueba.local');

  update profiles set rol = 'admin' where id = FELIPE;
  update profiles set rol = 'coach' where id = DIEGO;

  insert into coach_links (coach_id, atleta_id, creado_por)
  values (DIEGO, CARLOS, FELIPE);

  insert into exercises (id, nombre, es_global)
  values (EJERCICIO, 'Press banca de prueba', true);

  insert into workout_sessions (id, user_id, fecha) values
    ('aaaaaaaa-0000-0000-0000-000000000001', BEA,    current_date),
    ('aaaaaaaa-0000-0000-0000-000000000002', CARLOS, current_date);

  insert into body_measurements (user_id, medido_en, peso_kg) values
    (BEA, now(), 70), (CARLOS, now(), 80);

  -- ==========================================================
  -- EVA · no fue invitada
  -- ==========================================================
  select estado::text into txt from profiles where id = EVA;
  insert into _pruebas_rls values (1, 'Eva (no invitada) nace pendiente', txt, 'pendiente');

  perform set_config('request.jwt.claims',
    json_build_object('sub', EVA, 'role','authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into n from workout_sessions;
  insert into _pruebas_rls values (2, 'Eva pendiente ve sesiones', n::text, '0');
  select count(*) into n from body_measurements;
  insert into _pruebas_rls values (3, 'Eva pendiente ve mediciones', n::text, '0');
  -- (estas dos sí van sin filtro: un pendiente no debe ver NADA de
  --  nadie, ni siquiera de usuarios que no son de prueba)
  select count(*) into n from exercises;
  insert into _pruebas_rls values (4, 'Eva pendiente ve el catálogo', n::text, '0');

  execute 'reset role';

  -- ==========================================================
  -- BEA · atleta activa, sin coach
  -- ==========================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', BEA, 'role','authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into n from workout_sessions where user_id in (FELIPE, BEA, CARLOS, DIEGO, EVA);
  insert into _pruebas_rls values (5, 'Bea ve solo su sesión', n::text, '1');

  select count(*) into n from workout_sessions where user_id = CARLOS;
  insert into _pruebas_rls values (6, 'Bea ve la sesión de Carlos', n::text, '0');

  select count(*) into n from body_measurements where user_id = CARLOS;
  insert into _pruebas_rls values (7, 'Bea ve mediciones de Carlos', n::text, '0');

  begin
    insert into workout_sessions (user_id, fecha) values (CARLOS, current_date);
    insert into _pruebas_rls values (8, 'Bea escribe como Carlos', 'PERMITIDO', 'RECHAZADO');
  exception when others then
    insert into _pruebas_rls values (8, 'Bea escribe como Carlos', 'RECHAZADO', 'RECHAZADO');
  end;

  begin
    update profiles set rol = 'admin' where id = BEA;
    insert into _pruebas_rls values (9, 'Bea intenta ascenderse a admin',
      case when found then 'PERMITIDO' else 'RECHAZADO' end, 'RECHAZADO');
  exception when others then
    insert into _pruebas_rls values (9, 'Bea intenta ascenderse a admin', 'RECHAZADO', 'RECHAZADO');
  end;

  begin
    update profiles set estado = 'activo' where id = EVA;
    insert into _pruebas_rls values (10, 'Bea intenta aprobar a Eva',
      case when found then 'PERMITIDO' else 'RECHAZADO' end, 'RECHAZADO');
  exception when others then
    insert into _pruebas_rls values (10, 'Bea intenta aprobar a Eva', 'RECHAZADO', 'RECHAZADO');
  end;

  execute 'reset role';

  select rol::text into txt from profiles where id = BEA;
  insert into _pruebas_rls values (11, 'El rol de Bea sigue siendo atleta', txt, 'atleta');

  -- ==========================================================
  -- DIEGO · coach de Carlos
  -- ==========================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', DIEGO, 'role','authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into n from workout_sessions where user_id = CARLOS;
  insert into _pruebas_rls values (12, 'Coach ve la sesión de su atleta', n::text, '1');

  select count(*) into n from workout_sessions where user_id = BEA;
  insert into _pruebas_rls values (13, 'Coach ve la sesión de Bea (no asignada)', n::text, '0');

  select count(*) into n from body_measurements where user_id = CARLOS;
  insert into _pruebas_rls values (14, 'Coach ve composición sin permiso', n::text, '0');

  begin
    update workout_sessions set nota = 'editado por el coach'
     where id = 'aaaaaaaa-0000-0000-0000-000000000002';
    insert into _pruebas_rls values (15, 'Coach edita la sesión de su atleta',
      case when found then 'PERMITIDO' else 'RECHAZADO' end, 'RECHAZADO');
  exception when others then
    insert into _pruebas_rls values (15, 'Coach edita la sesión de su atleta', 'RECHAZADO', 'RECHAZADO');
  end;

  begin
    insert into composition_access (atleta_id, coach_id) values (CARLOS, DIEGO);
    insert into _pruebas_rls values (16, 'Coach se auto-concede composición', 'PERMITIDO', 'RECHAZADO');
  exception when others then
    insert into _pruebas_rls values (16, 'Coach se auto-concede composición', 'RECHAZADO', 'RECHAZADO');
  end;

  execute 'reset role';

  -- ==========================================================
  -- CARLOS abre su composición a Diego
  -- ==========================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', CARLOS, 'role','authenticated')::text, true);
  execute 'set local role authenticated';
  insert into composition_access (atleta_id, coach_id) values (CARLOS, DIEGO);
  execute 'reset role';

  perform set_config('request.jwt.claims',
    json_build_object('sub', DIEGO, 'role','authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from body_measurements where user_id = CARLOS;
  insert into _pruebas_rls values (17, 'Coach ve composición tras el permiso', n::text, '1');
  execute 'reset role';

  -- ==========================================================
  -- FELIPE · administrador
  -- ==========================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', FELIPE, 'role','authenticated')::text, true);
  execute 'set local role authenticated';

  -- Acotado a los usuarios de prueba A PROPÓSITO. Contar todas las
  -- filas de la base haría que esta prueba fallara en cuanto hubiera
  -- datos reales: diría "FALLA" sin que nada esté mal, y una suite que
  -- cría falsos positivos se deja de mirar.
  select count(*) into n from workout_sessions where user_id in (BEA, CARLOS);
  insert into _pruebas_rls values (18, 'Admin ve el entrenamiento de todos', n::text, '2');

  select count(*) into n from body_measurements where user_id in (BEA, CARLOS);
  insert into _pruebas_rls values (19, 'Admin ve composición ajena', n::text, '0');

  begin
    update workout_sessions set nota = 'editado por el admin'
     where id = 'aaaaaaaa-0000-0000-0000-000000000001';
    insert into _pruebas_rls values (20, 'Admin edita datos ajenos',
      case when found then 'PERMITIDO' else 'RECHAZADO' end, 'RECHAZADO');
  exception when others then
    insert into _pruebas_rls values (20, 'Admin edita datos ajenos', 'RECHAZADO', 'RECHAZADO');
  end;

  update profiles set estado = 'activo' where id = EVA;
  execute 'reset role';

  select estado::text into txt from profiles where id = EVA;
  insert into _pruebas_rls values (21, 'Admin aprueba a un pendiente', txt, 'activo');

  -- ==========================================================
  -- EL PERMISO DE REGISTRO (migración 08)
  --
  -- Lo enciende y apaga el atleta. El admin también, como mesa de
  -- ayuda. El coach no, ni sobre su propio vínculo.
  -- ==========================================================

  -- El dueño de los datos sigue escribiendo lo suyo. Parece obvio,
  -- pero la migración 08 reescribió justo esa política: si se rompe,
  -- la app deja de guardar entrenamientos y nadie lo nota hasta el
  -- gimnasio.
  perform set_config('request.jwt.claims',
    json_build_object('sub', BEA, 'role','authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    insert into workout_sessions (user_id, fecha) values (BEA, current_date - 1);
    insert into _pruebas_rls values (22, 'El atleta registra lo suyo', 'PERMITIDO', 'PERMITIDO');
  exception when others then
    insert into _pruebas_rls values (22, 'El atleta registra lo suyo', 'RECHAZADO', 'PERMITIDO');
  end;
  execute 'reset role';

  -- Carlos se lo concede a Diego
  perform set_config('request.jwt.claims',
    json_build_object('sub', CARLOS, 'role','authenticated')::text, true);
  execute 'set local role authenticated';
  update coach_links set puede_registrar = true
   where coach_id = DIEGO and atleta_id = CARLOS;
  execute 'reset role';

  select puede_registrar::text into txt from coach_links
   where coach_id = DIEGO and atleta_id = CARLOS;
  insert into _pruebas_rls values (23, 'El atleta enciende el permiso', txt, 'true');

  -- Diego, ahora con permiso
  perform set_config('request.jwt.claims',
    json_build_object('sub', DIEGO, 'role','authenticated')::text, true);
  execute 'set local role authenticated';

  begin
    update workout_sessions set nota = 'registrado por el coach'
     where id = SESION_CARLOS;
    insert into _pruebas_rls values (24, 'Coach CON permiso edita la sesión',
      case when found then 'PERMITIDO' else 'RECHAZADO' end, 'PERMITIDO');
  exception when others then
    insert into _pruebas_rls values (24, 'Coach CON permiso edita la sesión', 'RECHAZADO', 'PERMITIDO');
  end;

  begin
    insert into set_logs (session_id, exercise_id, series, reps, peso)
    values (SESION_CARLOS, EJERCICIO, 3, 10, 60);
    insert into _pruebas_rls values (25, 'Coach CON permiso registra un ejercicio', 'PERMITIDO', 'PERMITIDO');
  exception when others then
    insert into _pruebas_rls values (25, 'Coach CON permiso registra un ejercicio', 'RECHAZADO', 'PERMITIDO');
  end;

  -- El permiso de registro NO abre la composición corporal.
  begin
    insert into body_measurements (user_id, medido_en, peso_kg)
    values (CARLOS, now(), 81);
    insert into _pruebas_rls values (26, 'Coach CON permiso escribe composición', 'PERMITIDO', 'RECHAZADO');
  exception when others then
    insert into _pruebas_rls values (26, 'Coach CON permiso escribe composición', 'RECHAZADO', 'RECHAZADO');
  end;

  -- Y sigue sin alcanzar a quien no es su atleta.
  begin
    insert into workout_sessions (user_id, fecha) values (BEA, current_date);
    insert into _pruebas_rls values (27, 'Coach CON permiso escribe a Bea (no asignada)', 'PERMITIDO', 'RECHAZADO');
  exception when others then
    insert into _pruebas_rls values (27, 'Coach CON permiso escribe a Bea (no asignada)', 'RECHAZADO', 'RECHAZADO');
  end;

  execute 'reset role';

  -- Queda constancia de quién escribió.
  select registrado_por::text into txt from set_logs
   where session_id = SESION_CARLOS and exercise_id = EJERCICIO;
  insert into _pruebas_rls values (28, 'La fila queda sellada con el id del coach',
    coalesce(txt, 'null'), DIEGO::text);

  -- ==========================================================
  -- Carlos lo revoca
  -- ==========================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', CARLOS, 'role','authenticated')::text, true);
  execute 'set local role authenticated';
  update coach_links set puede_registrar = false
   where coach_id = DIEGO and atleta_id = CARLOS;
  execute 'reset role';

  perform set_config('request.jwt.claims',
    json_build_object('sub', DIEGO, 'role','authenticated')::text, true);
  execute 'set local role authenticated';

  begin
    update workout_sessions set nota = 'después de revocar'
     where id = SESION_CARLOS;
    insert into _pruebas_rls values (29, 'Coach edita tras revocarle el permiso',
      case when found then 'PERMITIDO' else 'RECHAZADO' end, 'RECHAZADO');
  exception when others then
    insert into _pruebas_rls values (29, 'Coach edita tras revocarle el permiso', 'RECHAZADO', 'RECHAZADO');
  end;

  -- El coach no se lo devuelve solo.
  begin
    update coach_links set puede_registrar = true
     where coach_id = DIEGO and atleta_id = CARLOS;
    insert into _pruebas_rls values (30, 'Coach se enciende el permiso solo',
      case when found then 'PERMITIDO' else 'RECHAZADO' end, 'RECHAZADO');
  exception when others then
    insert into _pruebas_rls values (30, 'Coach se enciende el permiso solo', 'RECHAZADO', 'RECHAZADO');
  end;

  execute 'reset role';

  -- Ni un tercero sobre el vínculo ajeno.
  perform set_config('request.jwt.claims',
    json_build_object('sub', BEA, 'role','authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    update coach_links set puede_registrar = true
     where coach_id = DIEGO and atleta_id = CARLOS;
    insert into _pruebas_rls values (31, 'Bea toca el vínculo de Carlos',
      case when found then 'PERMITIDO' else 'RECHAZADO' end, 'RECHAZADO');
  exception when others then
    insert into _pruebas_rls values (31, 'Bea toca el vínculo de Carlos', 'RECHAZADO', 'RECHAZADO');
  end;
  execute 'reset role';

  -- ==========================================================
  -- FELIPE como mesa de ayuda
  -- ==========================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', FELIPE, 'role','authenticated')::text, true);
  execute 'set local role authenticated';

  begin
    update coach_links set puede_registrar = true
     where coach_id = DIEGO and atleta_id = CARLOS;
    insert into _pruebas_rls values (32, 'Admin concede el permiso (mesa de ayuda)',
      case when found then 'PERMITIDO' else 'RECHAZADO' end, 'PERMITIDO');
  exception when others then
    insert into _pruebas_rls values (32, 'Admin concede el permiso (mesa de ayuda)', 'RECHAZADO', 'PERMITIDO');
  end;

  -- Pero reasignar un vínculo es borrar e insertar, no editar quién
  -- es el atleta: esa columna no la mueve nadie por UPDATE.
  begin
    update coach_links set atleta_id = BEA
     where coach_id = DIEGO and atleta_id = CARLOS;
    insert into _pruebas_rls values (33, 'Admin reescribe el atleta del vínculo',
      case when found then 'PERMITIDO' else 'RECHAZADO' end, 'RECHAZADO');
  exception when others then
    insert into _pruebas_rls values (33, 'Admin reescribe el atleta del vínculo', 'RECHAZADO', 'RECHAZADO');
  end;

  -- Reasignar de la forma correcta sí funciona.
  begin
    delete from coach_links where coach_id = DIEGO and atleta_id = CARLOS;
    insert into coach_links (coach_id, atleta_id, creado_por) values (DIEGO, BEA, FELIPE);
    insert into _pruebas_rls values (34, 'Admin reasigna borrando e insertando', 'PERMITIDO', 'PERMITIDO');
  exception when others then
    insert into _pruebas_rls values (34, 'Admin reasigna borrando e insertando', 'RECHAZADO', 'PERMITIDO');
  end;

  execute 'reset role';

  -- ==========================================================
  -- LAS VISTAS (migración 09)
  --
  -- Una vista sin security_invoker se ejecuta con los permisos de
  -- quien la creó y se salta RLS entera: cualquiera vería el
  -- historial de todos. Esto lo comprueba en vez de suponerlo.
  -- ==========================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', BEA, 'role','authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into n from v_historial_ejercicio where user_id = CARLOS;
  insert into _pruebas_rls values (35, 'Bea ve el historial de Carlos (vista)', n::text, '0');

  select count(*) into n from v_ultimo_registro where user_id = CARLOS;
  insert into _pruebas_rls values (36, 'Bea ve el último registro de Carlos (vista)', n::text, '0');

  execute 'reset role';

  -- ----------------------------------------------------------
  -- Limpieza: se van los cinco y todo lo que colgaba de ellos
  -- ----------------------------------------------------------
  delete from auth.users where id in (FELIPE, BEA, CARLOS, DIEGO, EVA);
  delete from invitaciones where email like '%@prueba.local';
  delete from exercises where id = EJERCICIO;
end $$;

select n, prueba, obtenido, esperado,
       case when obtenido = esperado then 'OK' else '*** FALLA ***' end as veredicto
  from _pruebas_rls order by n;
