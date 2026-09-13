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

/** Lo ya registrado en una sesión, indexado por ejercicio. */
export async function registrosDeSesion(sessionId) {
  const filas = revisar(await supabase
    .from('set_logs')
    .select('id, exercise_id, routine_exercise_id, series, reps, peso, unidad, rpe, actualizado_en, registrado_por')
    .eq('session_id', sessionId)) || [];
  return new Map(filas.map((f) => [f.exercise_id, f]));
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
