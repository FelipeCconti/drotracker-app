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
  select count(*) into n from exercises;
  insert into _pruebas_rls values (4, 'Eva pendiente ve el catálogo', n::text, '0');

  execute 'reset role';

  -- ==========================================================
  -- BEA · atleta activa, sin coach
  -- ==========================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', BEA, 'role','authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into n from workout_sessions;
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

  select count(*) into n from workout_sessions;
  insert into _pruebas_rls values (18, 'Admin ve el entrenamiento de todos', n::text, '2');

  select count(*) into n from body_measurements where user_id <> FELIPE;
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

  -- ----------------------------------------------------------
  -- Limpieza: se van los cinco y todo lo que colgaba de ellos
  -- ----------------------------------------------------------
  delete from auth.users where id in (FELIPE, BEA, CARLOS, DIEGO, EVA);
  delete from invitaciones where email like '%@prueba.local';
end $$;

select n, prueba, obtenido, esperado,
       case when obtenido = esperado then 'OK' else '*** FALLA ***' end as veredicto
  from _pruebas_rls order by n;
