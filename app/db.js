// ============================================================
// DRO.TRACKER · acceso a datos
//
// Todo lo que habla con Supabase pasa por acá. Las pantallas no
// escriben consultas: piden funciones con nombre. Eso hace que
// cambiar una consulta sea editar un lugar, y que se vea de un
// vistazo qué toca la app.
//
// RLS ya decide qué puede ver y escribir cada quien: estas funciones
// no repiten esa lógica. Si una consulta devuelve vacío cuando
// esperabas filas, el problema es de permisos, no de este archivo.
// ============================================================

import { supabase } from './auth.js';

function revisar({ data, error }) {
  if (error) throw error;
  return data;
}

// ------------------------------------------------------------
// Quién entrena
// ------------------------------------------------------------

/**
 * Atletas para los que puedo registrar además de mí mismo: aquellos
 * que me tienen como coach Y me encendieron `puede_registrar`.
 * Si no soy coach de nadie, devuelve lista vacía y la pantalla no
 * muestra el selector.
 */
export async function atletasQuePuedoRegistrar(miId) {
  const filas = revisar(await supabase
    .from('coach_links')
    .select('atleta_id, puede_registrar, profiles!coach_links_atleta_id_fkey(id, nombre, email)')
    .eq('coach_id', miId)
    .eq('puede_registrar', true));

  return (filas || [])
    .map((f) => f.profiles)
    .filter(Boolean)
    .sort((a, b) => (a.nombre || a.email).localeCompare(b.nombre || b.email));
}

// ------------------------------------------------------------
// El plan
// ------------------------------------------------------------

/** La rutina vigente de alguien, o null si todavía no armó ninguna. */
export async function rutinaVigente(userId) {
  return revisar(await supabase
    .from('routines')
    .select('id, nombre, vigente_desde')
    .eq('user_id', userId)
    .is('vigente_hasta', null)
    .maybeSingle());
}

export async function diasDeRutina(routineId) {
  return revisar(await supabase
    .from('routine_days')
    .select('id, orden, nombre')
    .eq('routine_id', routineId)
    .order('orden')) || [];
}

export async function ciclosDeRutina(routineId) {
  return revisar(await supabase
    .from('cycles')
    .select('id, numero')
    .eq('routine_id', routineId)
    .order('numero')) || [];
}

/** Los ejercicios de un día, en orden, con el nombre del catálogo. */
export async function ejerciciosDelDia(routineDayId) {
  const filas = revisar(await supabase
    .from('routine_exercises')
    .select('id, orden, unidad, series_base, reps_base, peso_base, nota, exercise_id, exercises(id, nombre, grupo_muscular, unidad_def)')
    .eq('routine_day_id', routineDayId)
    .eq('activo', true)
    .order('orden')) || [];

  return filas.map((f) => ({
    routineExerciseId: f.id,
    exerciseId: f.exercise_id,
    orden: f.orden,
    nombre: f.exercises?.nombre || 'Ejercicio sin nombre',
    grupo: f.exercises?.grupo_muscular || null,
    unidad: f.unidad || f.exercises?.unidad_def || 'kg',
    seriesBase: f.series_base,
    repsBase: f.reps_base,
    pesoBase: f.peso_base,
    nota: f.nota,
  }));
}

// ------------------------------------------------------------
// El registro
// ------------------------------------------------------------

/**
 * Lo último que hizo esta persona en cada uno de estos ejercicios.
 * Es lo que se precarga en cada fila: registrar pasa a ser confirmar
 * en vez de escribir. Viene de la vista v_ultimo_registro.
 */
export async function ultimoRegistroPorEjercicio(userId, exerciseIds) {
  if (!exerciseIds.length) return new Map();
  const filas = revisar(await supabase
    .from('v_ultimo_registro')
    .select('exercise_id, fecha, series, reps, peso, unidad')
    .eq('user_id', userId)
    .in('exercise_id', exerciseIds)) || [];
  return new Map(filas.map((f) => [f.exercise_id, f]));
}

/** La sesión más reciente, para proponer ciclo y semana. */
export async function ultimaSesion(userId) {
  return revisar(await supabase
    .from('workout_sessions')
    .select('id, fecha, semana, cycle_id, routine_day_id, cycles(numero)')
    .eq('user_id', userId)
    .order('fecha', { ascending: false })
    .limit(1)
    .maybeSingle());
}

/** ¿Ya hay una sesión de este día en esta fecha? */
export async function buscarSesion(userId, routineDayId, fecha) {
  return revisar(await supabase
    .from('workout_sessions')
    .select('id, fecha, semana, cycle_id, nota, actualizado_en')
    .eq('user_id', userId)
    .eq('routine_day_id', routineDayId)
    .eq('fecha', fecha)
    .maybeSingle());
}

export async function crearSesion({ userId, routineDayId, cycleId, semana, fecha }) {
  return revisar(await supabase
    .from('workout_sessions')
    .insert({
      user_id: userId,
      routine_day_id: routineDayId,
      cycle_id: cycleId || null,
      semana: semana || null,
      fecha,
    })
    .select('id, fecha, semana, cycle_id')
    .single());
}

export async function actualizarSesion(sessionId, campos) {
  return revisar(await supabase
    .from('workout_sessions')
    .update(campos)
    .eq('id', sessionId)
    .select('id, semana, cycle_id, nota')
    .single());
}

/**
 * Lo ya registrado en una sesión, indexado por la fila del PLAN cuando
 * la hay y por el ejercicio cuando no (registro fuera de la rutina).
 *
 * La distinción importa si alguien repite el mismo movimiento dos veces
 * en un día: indexado por ejercicio, la segunda fila taparía a la
 * primera y una de las dos cargas se perdería al volver a abrir.
 */
export async function registrosDeSesion(sessionId) {
  const filas = revisar(await supabase
    .from('set_logs')
    .select('id, exercise_id, routine_exercise_id, series, reps, peso, unidad, rpe, actualizado_en, registrado_por')
    .eq('session_id', sessionId)) || [];
  return new Map(filas.map((f) => [f.routine_exercise_id ?? f.exercise_id, f]));
}

/**
 * Guarda un ejercicio del día. Una fila por ejercicio, no por serie:
 * "press banca, 60 kg, 3 × 10" es una fila con tres datos.
 *
 * Si `setLogId` viene, actualiza; si no, inserta. Devuelve la fila
 * guardada para que la pantalla se quede con el id.
 */
export async function guardarRegistro({ setLogId, sessionId, exerciseId, routineExerciseId, series, reps, peso, unidad }) {
  const campos = {
    series: series ?? 1,
    reps: reps ?? null,
    peso: peso ?? null,
    unidad: unidad || 'kg',
  };

  if (setLogId) {
    return revisar(await supabase
      .from('set_logs')
      .update(campos)
      .eq('id', setLogId)
      .select('id, series, reps, peso, unidad, actualizado_en')
      .single());
  }

  return revisar(await supabase
    .from('set_logs')
    .insert({
      ...campos,
      session_id: sessionId,
      exercise_id: exerciseId,
      routine_exercise_id: routineExerciseId || null,
    })
    .select('id, series, reps, peso, unidad, actualizado_en')
    .single());
}

export async function borrarRegistro(setLogId) {
  const { error } = await supabase.from('set_logs').delete().eq('id', setLogId);
  if (error) throw error;
}

/** Borra la sesión y, por cascada, todo lo que se registró en ella. */
export async function borrarSesion(sessionId) {
  const { error } = await supabase.from('workout_sessions').delete().eq('id', sessionId);
  if (error) throw error;
}

// ------------------------------------------------------------
// Historial
// ------------------------------------------------------------

/**
 * Todo el historial de entrenamiento de alguien, plano y ordenado por
 * fecha. Viene de v_historial_ejercicio, que ya cruza rutinas: el
 * historial de un ejercicio es continuo aunque la rutina haya cambiado.
 *
 * Se trae entero y se agrupa en el navegador. Con un año de registro
 * son unos cientos de filas; el día que sean miles, esto pasa a ser
 * una consulta por ejercicio.
 */
export async function historial(userId) {
  return revisar(await supabase
    .from('v_historial_ejercicio')
    .select('exercise_id, ejercicio, grupo_muscular, fecha, routine_id, rutina, ciclo, semana, series, reps, peso, volumen, rm_estimado')
    .eq('user_id', userId)
    .not('peso', 'is', null)
    .order('fecha')
    .limit(5000)) || [];
}

/** Crea el ciclo si no existe. Devuelve su id, o null si no se pudo. */
export async function asegurarCiclo(routineId, numero) {
  if (!numero) return null;
  const existente = revisar(await supabase
    .from('cycles')
    .select('id')
    .eq('routine_id', routineId)
    .eq('numero', numero)
    .maybeSingle());
  if (existente) return existente.id;

  // Un coach con permiso de registro pero no de plan no puede crear
  // ciclos. No es motivo para impedirle registrar: la sesión queda
  // con cycle_id null y el dueño lo ordena después.
  try {
    const creado = revisar(await supabase
      .from('cycles')
      .insert({ routine_id: routineId, numero })
      .select('id')
      .single());
    return creado.id;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------
// Composición corporal
//
// Es el dato más sensible que guarda la app. Quien lo escribe es
// SIEMPRE su dueño —ni el coach ni el admin— y quien lo lee es su
// dueño más aquellos a los que él se lo concedió, uno por uno, en
// composition_access. Estas funciones no reproducen esa lógica: la
// hace cumplir RLS. Están escritas para que se note que existe.
// ------------------------------------------------------------

/** Perfil propio con los campos que la app puede editar. */
export async function perfilCompleto(userId) {
  return revisar(await supabase
    .from('profiles')
    .select('id, nombre, email, rol, estado, altura_cm, unidad_def')
    .eq('id', userId)
    .maybeSingle());
}

/** La altura vive en el perfil, no en cada medición: no cambia. */
export async function guardarAltura(userId, alturaCm) {
  return revisar(await supabase
    .from('profiles')
    .update({ altura_cm: alturaCm })
    .eq('id', userId)
    .select('altura_cm')
    .single());
}

/** Mediciones con IMC y variaciones ya calculadas (vista v_composicion). */
export async function mediciones(userId) {
  return revisar(await supabase
    .from('v_composicion')
    .select('id, user_id, medido_en, peso_kg, grasa_pct, agua_pct, masa_muscular_kg, masa_osea_kg, grasa_visceral, cintura_cm, nota, actualizado_en, altura_cm, imc, delta_peso, delta_grasa, delta_peso_total, n_medicion')
    .eq('user_id', userId)
    .order('medido_en')) || [];
}

export async function crearMedicion(userId, campos) {
  return revisar(await supabase
    .from('body_measurements')
    .insert({ user_id: userId, ...campos })
    .select('id')
    .single());
}

export async function actualizarMedicion(id, campos) {
  return revisar(await supabase
    .from('body_measurements')
    .update(campos)
    .eq('id', id)
    .select('id')
    .single());
}

export async function borrarMedicion(id) {
  const { error } = await supabase.from('body_measurements').delete().eq('id', id);
  if (error) throw error;
}

/** Mis coaches, y si les concedí ver mi composición. */
export async function misCoachesYAcceso(miId) {
  const [vinculos, accesos] = await Promise.all([
    supabase.from('coach_links')
      .select('coach_id, profiles!coach_links_coach_id_fkey(id, nombre, email)')
      .eq('atleta_id', miId),
    supabase.from('composition_access').select('coach_id').eq('atleta_id', miId),
  ]);
  if (vinculos.error) throw vinculos.error;
  if (accesos.error) throw accesos.error;

  const concedidos = new Set((accesos.data || []).map((a) => a.coach_id));
  return (vinculos.data || [])
    .map((v) => v.profiles)
    .filter(Boolean)
    .map((p) => ({ ...p, tieneAcceso: concedidos.has(p.id) }));
}

export async function concederComposicion(atletaId, coachId) {
  const { error } = await supabase
    .from('composition_access')
    .insert({ atleta_id: atletaId, coach_id: coachId });
  if (error && error.code !== '23505') throw error;   // ya concedido: no es un error
}

export async function revocarComposicion(atletaId, coachId) {
  const { error } = await supabase
    .from('composition_access')
    .delete()
    .eq('atleta_id', atletaId)
    .eq('coach_id', coachId);
  if (error) throw error;
}

/** Atletas que me concedieron ver SU composición. Solo lectura. */
export async function atletasQueMeCompartieron(miId) {
  const filas = revisar(await supabase
    .from('composition_access')
    .select('atleta_id, profiles!composition_access_atleta_id_fkey(id, nombre, email)')
    .eq('coach_id', miId)) || [];
  return filas.map((f) => f.profiles).filter(Boolean)
    .sort((a, b) => (a.nombre || a.email).localeCompare(b.nombre || b.email));
}

// ------------------------------------------------------------
// Editar el plan
//
// Quién puede: el dueño, y su coach si tiene `puede_editar_plan`.
// Eso NO da permiso sobre el registro de entrenamientos, que es otra
// puerta (`puede_registrar`).
// ------------------------------------------------------------

/** Atletas cuyo plan puedo editar además del mío. */
export async function atletasCuyoPlanPuedoEditar(miId) {
  const filas = revisar(await supabase
    .from('coach_links')
    .select('atleta_id, profiles!coach_links_atleta_id_fkey(id, nombre, email)')
    .eq('coach_id', miId)
    .eq('puede_editar_plan', true)) || [];
  return filas.map((f) => f.profiles).filter(Boolean)
    .sort((a, b) => (a.nombre || a.email).localeCompare(b.nombre || b.email));
}

export async function crearRutina(userId, nombre) {
  return revisar(await supabase
    .from('routines')
    .insert({ user_id: userId, nombre })
    .select('id, nombre, vigente_desde')
    .single());
}

export async function renombrarRutina(id, nombre) {
  return revisar(await supabase
    .from('routines').update({ nombre }).eq('id', id)
    .select('id, nombre').single());
}

/**
 * Cierra la rutina vigente y abre su sucesora copiando días,
 * ejercicios y valores base. El historial NO se copia ni se toca: las
 * sesiones viejas siguen colgando de la rutina vieja, que es lo que
 * hace que "qué rutina hacía en abril" tenga respuesta.
 */
export async function sucederRutina(rutinaVieja, nombreNuevo) {
  const { data, error } = await supabase.rpc('suceder_rutina', {
    rutina_vieja: rutinaVieja, nombre_nuevo: nombreNuevo,
  });
  if (error) throw error;
  return data;
}

export async function crearDia(routineId, orden, nombre) {
  return revisar(await supabase
    .from('routine_days')
    .insert({ routine_id: routineId, orden, nombre })
    .select('id, orden, nombre').single());
}

export async function renombrarDia(id, nombre) {
  return revisar(await supabase
    .from('routine_days').update({ nombre }).eq('id', id)
    .select('id, nombre').single());
}

/**
 * Borra un día. Falla si ya tiene entrenamientos registrados, y esa
 * negativa es deliberada: la clave foránea de workout_sessions no
 * lleva `on delete cascade` para que borrar un día no se lleve por
 * delante meses de historial sin avisar.
 */
export async function borrarDia(id) {
  const { error } = await supabase.from('routine_days').delete().eq('id', id);
  if (error) throw error;
}

/** Catálogo: los ejercicios globales más los que creó esta persona. */
export async function catalogoEjercicios(userId) {
  const filas = revisar(await supabase
    .from('exercises')
    .select('id, nombre, grupo_muscular, unidad_def, es_global, user_id')
    .or(`es_global.eq.true,user_id.eq.${userId}`)
    .order('nombre')) || [];
  return filas;
}

export async function crearEjercicio(userId, { nombre, grupo_muscular, unidad_def }) {
  return revisar(await supabase
    .from('exercises')
    .insert({ user_id: userId, nombre, grupo_muscular: grupo_muscular || null,
              unidad_def: unidad_def || 'kg', es_global: false })
    .select('id, nombre, grupo_muscular, unidad_def, es_global, user_id')
    .single());
}

export async function agregarEjercicioADia(routineDayId, exerciseId, orden, base = {}) {
  return revisar(await supabase
    .from('routine_exercises')
    .insert({
      routine_day_id: routineDayId,
      exercise_id: exerciseId,
      orden,
      unidad: base.unidad || 'kg',
      series_base: base.series_base ?? 3,
      reps_base: base.reps_base ?? null,
    })
    .select('id').single());
}

export async function actualizarEjercicioDeRutina(id, campos) {
  return revisar(await supabase
    .from('routine_exercises').update(campos).eq('id', id)
    .select('id').single());
}

/**
 * Quitar un ejercicio del plan es un borrado LÓGICO (`activo = false`).
 * La fila se conserva porque los set_logs registrados apuntan a ella;
 * borrarla de verdad dejaría huérfano el historial.
 */
export async function quitarEjercicioDeDia(id) {
  return revisar(await supabase
    .from('routine_exercises').update({ activo: false }).eq('id', id)
    .select('id').single());
}

/** Reordena en bloque: se manda el orden nuevo de cada fila. */
export async function reordenarEjercicios(pares) {
  for (const { id, orden } of pares) {
    const { error } = await supabase.from('routine_exercises').update({ orden }).eq('id', id);
    if (error) throw error;
  }
}

// ------------------------------------------------------------
// Mis atletas, con todo lo que puedo hacer con cada uno
//
// Una sola consulta para todas las pantallas. Antes cada una pedía su
// propia lista con su propio filtro, y el resultado era que un coach
// tenía que volver a elegir a la persona en cada pestaña — y peor, que
// la lista cambiaba de una pestaña a otra sin explicación.
//
// Acá la lista es una sola: TODOS mis atletas. Lo que cambia por
// pestaña son los permisos, y van en la misma fila para que cada
// pantalla pueda decir "a esta persona puedes verla pero no
// registrarle" en vez de esconderla.
// ------------------------------------------------------------
export async function misAtletas(miId) {
  const [vinculos, composicion] = await Promise.all([
    supabase.from('coach_links')
      .select('atleta_id, puede_editar_plan, puede_registrar, profiles!coach_links_atleta_id_fkey(id, nombre, email)')
      .eq('coach_id', miId),
    supabase.from('composition_access').select('atleta_id').eq('coach_id', miId),
  ]);
  if (vinculos.error) throw vinculos.error;
  if (composicion.error) throw composicion.error;

  const conComposicion = new Set((composicion.data || []).map((c) => c.atleta_id));

  return (vinculos.data || [])
    .filter((v) => v.profiles)
    .map((v) => ({
      id: v.profiles.id,
      nombre: v.profiles.nombre,
      email: v.profiles.email,
      puedeEditarPlan: v.puede_editar_plan,
      puedeRegistrar: v.puede_registrar,
      veComposicion: conComposicion.has(v.atleta_id),
    }))
    .sort((a, b) => (a.nombre || a.email).localeCompare(b.nombre || b.email));
}
