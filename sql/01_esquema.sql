-- ============================================================
-- DRO.TRACKER · esquema base
-- Ejecutar en Supabase → SQL Editor, en este orden:
--   01_esquema.sql  →  02_roles_rls.sql  →  03_seed_ejercicios.sql
--
-- Nota de diseño: el modelo asume que una rutina NO es para siempre.
-- Cambia, se reemplaza, y el historial tiene que sobrevivir al cambio.
-- Ver la sección "Rutinas en el tiempo" más abajo.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Roles: todos son atletas. El rol solo agrega permisos sobre
-- datos ajenos, y nunca sobre el REGISTRO de lo que alguien hizo.
-- ------------------------------------------------------------
do $$ begin
  create type app_rol as enum ('atleta', 'coach', 'admin');
exception when duplicate_object then null;
end $$;

-- Estado de acceso. Entrar con Google NO es entrar a la app.
--   pendiente → autenticado pero sin acceso a ningún dato; espera aprobación
--   activo    → usa la app con normalidad
--   bloqueado → se le retiró el acceso sin borrar su historial
do $$ begin
  create type app_estado as enum ('pendiente', 'activo', 'bloqueado');
exception when duplicate_object then null;
end $$;

create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  nombre       text not null,
  email        text,
  rol          app_rol    not null default 'atleta',
  estado       app_estado not null default 'pendiente',
  altura_cm    numeric(5,1),
  unidad_def   text not null default 'kg',
  creado       timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Lista de invitados: los correos que entran sin trámite.
-- Quien llega al link sin estar acá queda 'pendiente' y aparece en
-- la pantalla de admin para aprobar o rechazar.
-- ------------------------------------------------------------
create table if not exists invitaciones (
  email       text primary key,
  nota        text,
  invitado_por uuid references profiles(id),
  creado      timestamptz not null default now()
);

-- Qué atletas ve cada coach. El admin crea y borra estas filas.
create table if not exists coach_links (
  coach_id          uuid not null references profiles(id) on delete cascade,
  atleta_id         uuid not null references profiles(id) on delete cascade,
  -- El coach puede armar y ajustar el PLAN del atleta (rutina, días,
  -- ejercicios, prescripción). Nunca su REGISTRO de entrenamientos.
  puede_editar_plan boolean not null default true,
  -- La composición corporal NO se otorga desde acá: vive en
  -- composition_access, que solo el atleta controla.
  creado_por        uuid references profiles(id),
  creado            timestamptz not null default now(),
  primary key (coach_id, atleta_id),
  constraint coach_no_es_su_propio_coach check (coach_id <> atleta_id)
);

-- ------------------------------------------------------------
-- Catálogo de ejercicios: globales + los que crea cada usuario.
-- Esta tabla es la identidad permanente del ejercicio: sobrevive a
-- todas las rutinas que vengan y es lo que hace posible el gráfico
-- "progreso de press banca desde siempre".
-- ------------------------------------------------------------
create table if not exists exercises (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references profiles(id) on delete cascade,  -- null = global
  nombre         text not null,
  grupo_muscular text,
  unidad_def     text not null default 'kg',
  es_global      boolean not null default false,
  creado         timestamptz not null default now()
);
create index if not exists ix_exercises_user on exercises(user_id);

-- ============================================================
-- RUTINAS EN EL TIEMPO
--
-- Un usuario tiene varias rutinas a lo largo de su vida deportiva:
-- la que armó en marzo, la que la reemplazó en julio. Tres columnas
-- hacen que eso sea consultable en vez de adivinable:
--
--   vigente_desde / vigente_hasta → qué rutina estaba haciendo en abril
--   deriva_de                     → la cadena: A → B → C
--
-- Regla práctica de cuándo editar y cuándo crear una rutina nueva:
--   · Ajuste de cargas o reps      → editar la prescripción (abajo)
--   · Cambio de días o ejercicios  → rutina nueva con deriva_de
-- ============================================================
create table if not exists routines (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  nombre        text not null,
  deriva_de     uuid references routines(id) on delete set null,
  vigente_desde date not null default current_date,
  vigente_hasta date,                        -- null = es la vigente hoy
  creado        timestamptz not null default now(),
  constraint vigencia_coherente check (vigente_hasta is null or vigente_hasta >= vigente_desde)
);
create index if not exists ix_routines_user on routines(user_id, vigente_desde desc);

-- Una sola rutina vigente por usuario a la vez.
create unique index if not exists ux_una_rutina_vigente
  on routines(user_id) where vigente_hasta is null;

create table if not exists routine_days (
  id         uuid primary key default gen_random_uuid(),
  routine_id uuid not null references routines(id) on delete cascade,
  orden      smallint not null,
  nombre     text not null,
  unique (routine_id, orden)
);

create table if not exists routine_exercises (
  id             uuid primary key default gen_random_uuid(),
  routine_day_id uuid not null references routine_days(id) on delete cascade,
  exercise_id    uuid not null references exercises(id),
  orden          smallint not null,
  unidad         text not null default 'kg',
  -- Valores base: lo que se usa si esa semana no tiene prescripción propia.
  series_base    smallint,
  reps_base      smallint,
  peso_base      numeric(6,2),
  descanso_s     smallint,
  nota           text,
  activo         boolean not null default true   -- borrado lógico: no rompe el historial
);
create index if not exists ix_rex_day on routine_exercises(routine_day_id);

-- ------------------------------------------------------------
-- Periodización: ciclos de 4 semanas con sobrecarga progresiva
-- ------------------------------------------------------------
create table if not exists cycles (
  id         uuid primary key default gen_random_uuid(),
  routine_id uuid not null references routines(id) on delete cascade,
  numero     smallint not null,
  inicio     date,
  fin        date,
  nota       text,
  unique (routine_id, numero)
);

-- ------------------------------------------------------------
-- La prescripción, semana a semana.
--
-- Esto es literalmente tu planilla actual:
--   Rutina · Ejercicio · Peso · Unidad · Semana · Ciclo
--
-- Un solo peso objetivo por ejercicio no puede expresar una
-- sobrecarga progresiva donde el peso sube y las reps bajan de ~15
-- a ~6 hacia la semana 4. El plan es función de (ejercicio, ciclo,
-- semana), y así se guarda.
-- ------------------------------------------------------------
create table if not exists exercise_targets (
  id                  uuid primary key default gen_random_uuid(),
  routine_exercise_id uuid not null references routine_exercises(id) on delete cascade,
  cycle_id            uuid not null references cycles(id) on delete cascade,
  semana              smallint not null check (semana between 1 and 12),
  series_obj          smallint,
  reps_obj            smallint,
  peso_obj            numeric(6,2),
  nota                text,
  unique (routine_exercise_id, cycle_id, semana)
);
create index if not exists ix_targets_ciclo on exercise_targets(cycle_id, semana);

-- ------------------------------------------------------------
-- Lo ejecutado
-- ------------------------------------------------------------
create table if not exists workout_sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references profiles(id) on delete cascade,
  routine_day_id uuid references routine_days(id),
  cycle_id       uuid references cycles(id),
  semana         smallint,
  fecha          date not null default current_date,
  duracion_min   smallint,
  nota           text,
  creado         timestamptz not null default now(),
  actualizado_en timestamptz          -- null = nunca se editó
);
create index if not exists ix_sessions_user_fecha on workout_sessions(user_id, fecha desc);
create index if not exists ix_sessions_ciclo      on workout_sessions(cycle_id, semana);

-- ------------------------------------------------------------
-- El registro real.
--
-- exercise_id va DENORMALIZADO a propósito: es lo que hace que el
-- historial de un ejercicio sea continuo a través de rutinas
-- distintas, que sobreviva a borrar un ejercicio de la rutina, y que
-- se pueda registrar algo que no estaba en el plan
-- (routine_exercise_id nulo). Sin esta columna, "el progreso de
-- press banca" se corta cada vez que cambia la rutina.
-- ------------------------------------------------------------
create table if not exists set_logs (
  id                  uuid primary key default gen_random_uuid(),
  session_id          uuid not null references workout_sessions(id) on delete cascade,
  exercise_id         uuid not null references exercises(id),
  routine_exercise_id uuid references routine_exercises(id),   -- null = fuera del plan
  n_serie             smallint not null,
  reps                smallint,
  peso                numeric(6,2),
  unidad              text not null default 'kg',   -- congelada: cambiar unidad hoy no reescribe el pasado
  rpe                 numeric(3,1),
  completada          boolean not null default true,
  actualizado_en      timestamptz          -- null = nunca se editó
);
create index if not exists ix_setlogs_session  on set_logs(session_id);
create index if not exists ix_setlogs_ejercicio on set_logs(exercise_id);

-- ============================================================
-- COMPOSICIÓN CORPORAL
--
-- Independiente de la rutina: su curva es continua aunque la rutina
-- cambie, y es justo donde se ve el efecto de haber cambiado.
--
-- `medido_en` es timestamp, no fecha, por dos razones:
--   · Permite más de una medición el mismo día sin que la base lo
--     impida. Si hay que preguntar "¿reemplazo la de hoy o agrego
--     otra?", eso lo decide la app, no una restricción.
--   · La hora importa para leer el dato: 77,4 kg en ayunas y 77,4 kg
--     después de almorzar no significan lo mismo.
-- ============================================================
create table if not exists body_measurements (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references profiles(id) on delete cascade,
  medido_en        timestamptz not null default now(),
  peso_kg          numeric(5,2) check (peso_kg          between 20  and 400),
  grasa_pct        numeric(4,1) check (grasa_pct        between 1   and 70),
  agua_pct         numeric(4,1) check (agua_pct         between 20  and 80),
  masa_muscular_kg numeric(5,2) check (masa_muscular_kg between 5   and 150),
  masa_osea_kg     numeric(4,2) check (masa_osea_kg     between 0.5 and 10),
  grasa_visceral   numeric(4,1) check (grasa_visceral   between 1   and 60),
  cintura_cm       numeric(5,1) check (cintura_cm       between 30  and 250),
  nota             text,
  actualizado_en   timestamptz,        -- null = nunca se editó
  -- Una medición vacía no es una medición.
  constraint al_menos_un_valor check (
    num_nonnulls(peso_kg, grasa_pct, agua_pct, masa_muscular_kg,
                 masa_osea_kg, grasa_visceral, cintura_cm) > 0
  )
);
create index if not exists ix_medidas_user_fecha on body_measurements(user_id, medido_en desc);

-- Los rangos de arriba no son un juicio clínico: solo atajan el error
-- de tipeo (770 en vez de 77,0) que, sin ellos, aplana el eje del
-- gráfico para siempre y es un fastidio de encontrar después.

-- ------------------------------------------------------------
-- Quién puede ver la composición corporal de quién.
--
-- Tabla aparte y no una columna de coach_links, a propósito: así el
-- permiso lo otorga y lo revoca ÚNICAMENTE el atleta. El admin
-- asigna coaches, pero no puede abrirse el acceso a este dato.
-- Una fila = permiso concedido.
-- ------------------------------------------------------------
create table if not exists composition_access (
  atleta_id uuid not null references profiles(id) on delete cascade,
  coach_id  uuid not null references profiles(id) on delete cascade,
  creado    timestamptz not null default now(),
  primary key (atleta_id, coach_id),
  constraint no_a_si_mismo check (atleta_id <> coach_id)
);

-- ------------------------------------------------------------
-- Vista de seguimiento: cada medición con su IMC, la variación
-- respecto de la anterior y respecto de la primera. Es lo que
-- convierte una tabla de números en un seguimiento.
-- ------------------------------------------------------------
create or replace view v_composicion as
select
  m.*,
  p.altura_cm,
  case when p.altura_cm > 0
       then round(m.peso_kg / power(p.altura_cm / 100.0, 2), 1) end as imc,
  m.peso_kg - lag(m.peso_kg)   over (partition by m.user_id order by m.medido_en) as delta_peso,
  m.grasa_pct - lag(m.grasa_pct) over (partition by m.user_id order by m.medido_en) as delta_grasa,
  m.peso_kg - first_value(m.peso_kg)
              over (partition by m.user_id order by m.medido_en
                    rows between unbounded preceding and current row)              as delta_peso_total,
  row_number() over (partition by m.user_id order by m.medido_en)                  as n_medicion
from body_measurements m
join profiles p on p.id = m.user_id;

-- ------------------------------------------------------------
-- Cerrar una rutina y abrir su sucesora, en una sola operación.
-- Copia días, ejercicios y valores base; NO copia el historial.
-- ------------------------------------------------------------
create or replace function public.suceder_rutina(rutina_vieja uuid, nombre_nuevo text)
returns uuid
language plpgsql security invoker set search_path = public
as $$
declare
  nueva uuid;
begin
  update routines set vigente_hasta = current_date
   where id = rutina_vieja and vigente_hasta is null;

  insert into routines (user_id, nombre, deriva_de, vigente_desde)
  select user_id, nombre_nuevo, id, current_date from routines where id = rutina_vieja
  returning id into nueva;

  insert into routine_days (routine_id, orden, nombre)
  select nueva, orden, nombre from routine_days where routine_id = rutina_vieja;

  insert into routine_exercises
    (routine_day_id, exercise_id, orden, unidad, series_base, reps_base, peso_base, descanso_s, nota)
  select dn.id, re.exercise_id, re.orden, re.unidad,
         re.series_base, re.reps_base, re.peso_base, re.descanso_s, re.nota
    from routine_exercises re
    join routine_days dv on dv.id = re.routine_day_id and dv.routine_id = rutina_vieja
    join routine_days dn on dn.routine_id = nueva and dn.orden = dv.orden
   where re.activo;

  return nueva;
end $$;

-- ------------------------------------------------------------
-- Vista: el historial de un ejercicio, continuo a través de rutinas.
-- Es la consulta que alimenta la pestaña "Por ejercicio".
-- ------------------------------------------------------------
create or replace view v_historial_ejercicio as
select
  s.user_id,
  sl.exercise_id,
  e.nombre        as ejercicio,
  e.grupo_muscular,
  s.fecha,
  r.id            as routine_id,
  r.nombre        as rutina,
  c.numero        as ciclo,
  s.semana,
  sl.n_serie, sl.reps, sl.peso, sl.unidad, sl.rpe,
  -- 1RM estimado (Epley), útil para comparar entre ciclos y rutinas
  case when sl.reps > 0 then round(sl.peso * (1 + sl.reps / 30.0), 1) end as rm_estimado
from set_logs sl
join workout_sessions s on s.id = sl.session_id
join exercises e        on e.id = sl.exercise_id
left join cycles c      on c.id = s.cycle_id
left join routine_days d on d.id = s.routine_day_id
left join routines r     on r.id = d.routine_id;

-- ------------------------------------------------------------
-- Corregir un dato antiguo se puede siempre, pero deja rastro.
--
-- No es desconfianza: es que "yo juraría que había puesto 80" sin
-- forma de mirarlo es una conversación incómoda, sobre todo cuando
-- un coach usa esos números como referencia compartida. Con esto la
-- app puede mostrar un discreto "editado el 3 de mayo" y se acabó
-- la discusión.
-- ------------------------------------------------------------
create or replace function public.marcar_actualizacion()
returns trigger language plpgsql as $$
begin
  new.actualizado_en = now();
  return new;
end $$;

drop trigger if exists tr_upd_sesiones on workout_sessions;
create trigger tr_upd_sesiones before update on workout_sessions
  for each row execute function public.marcar_actualizacion();

drop trigger if exists tr_upd_series on set_logs;
create trigger tr_upd_series before update on set_logs
  for each row execute function public.marcar_actualizacion();

drop trigger if exists tr_upd_medidas on body_measurements;
create trigger tr_upd_medidas before update on body_measurements
  for each row execute function public.marcar_actualizacion();

-- ------------------------------------------------------------
-- Alta automática de perfil al primer login con Google
-- ------------------------------------------------------------
-- El perfil se crea siempre, pero nace 'pendiente' salvo que el correo
-- esté en la lista de invitados. Un 'pendiente' está autenticado y no
-- ve absolutamente nada: la app solo le muestra "tu acceso está en
-- revisión". Así el link se puede reenviar sin que eso signifique nada.
create or replace function public.crear_perfil()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  invitado boolean;
begin
  select exists (
    select 1 from public.invitaciones
     where lower(email) = lower(new.email)
  ) into invitado;

  insert into public.profiles (id, nombre, email, estado)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    case when invitado then 'activo'::app_estado else 'pendiente'::app_estado end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.crear_perfil();
