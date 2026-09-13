// ============================================================
// DRO.TRACKER · pantalla de registrar entrenamiento
//
// Esta es la pantalla que se usa de pie, con el teléfono en una mano,
// entre serie y serie. Todo lo que sigue está subordinado a eso:
//
//   · Una fila por EJERCICIO, no por serie. "Press banca, 60 kg,
//     3 × 10" son tres datos en una fila.
//   · Cada fila llega precargada con lo que se levantó la última vez.
//     Lo normal es repetir o subir un poco, no escribir desde cero.
//   · No hay botón de guardar. Se guarda solo al salir de cada campo.
//     Un botón de guardar se olvida, y se pierde la sesión entera.
//   · La sesión se crea con el primer dato que se escribe, no al abrir
//     la pantalla: si no, quedan sesiones vacías por todos lados.
//   · Si falla la red, el valor escrito NO se borra nunca. Se reintenta
//     y se avisa en la fila.
//
// Si registrar un día toma más de un minuto, la gente deja de hacerlo
// y la app se muere sola.
// ============================================================

import {
  rutinaVigente, diasDeRutina, ciclosDeRutina,
  ejerciciosDelDia, ultimoRegistroPorEjercicio, ultimaSesion, buscarSesion,
  crearSesion, actualizarSesion, registrosDeSesion, guardarRegistro,
  borrarRegistro, asegurarCiclo,
} from './db.js';

import {
  esc, retrasar, crearCola, fmtNum, aNumero, hoyISO, haceCuanto,
  fmtFechaLarga, avisar, mensajeDeError,
} from './ui.js';

// Se importa con otro nombre porque en este archivo `sesion` ya significa
// una fila de workout_sessions, y dos cosas distintas con el mismo
// nombre en un archivo es como se escriben los errores difíciles.
import { sesion as appSesion, esPropio, permiso, sinPermisoHTML } from './sesion.js';

// ------------------------------------------------------------
// Estado de la pantalla
// ------------------------------------------------------------
const S = {
  yo: null,            // mi perfil
  atleta: null,        // para quién estoy registrando (puedo ser yo)
  atletas: [],         // otros para los que puedo registrar
  rutina: null,
  dias: [],
  ciclos: [],
  dia: null,           // día seleccionado
  fecha: hoyISO(),
  ciclo: null,         // número de ciclo (no el id)
  semana: null,
  sesion: null,        // la fila de workout_sessions, o null si aún no existe
  filas: [],           // una por ejercicio del día
  creandoSesion: null, // promesa en curso, para no crear dos
  cargandoDia: false,
};

let raiz = null;

// ============================================================
// Entrada
// ============================================================
export async function montarEntrenar(contenedor, perfil) {
  raiz = contenedor;
  S.yo = appSesion.yo;
  S.atleta = appSesion.sujeto;   // quién es se elige en la cabecera, una sola vez

  if (!permiso('registrar')) { raiz.innerHTML = sinPermisoHTML('registrar'); return; }

  pintarCargando();
  await cargarAtleta();
}

/** Carga rutina, días y ciclos del atleta seleccionado. */
async function cargarAtleta() {
  pintarCargando();
  try {
    S.rutina = await rutinaVigente(S.atleta.id);
    if (!S.rutina) return pintarSinRutina();

    S.dias = await diasDeRutina(S.rutina.id);
    S.ciclos = await ciclosDeRutina(S.rutina.id);
    if (!S.dias.length) return pintarSinRutina();

    // Ciclo y semana propuestos: los de la sesión más reciente. Dentro
    // de una misma semana se hacen varios días con el mismo par, así
    // que repetirlo acierta casi siempre; y está a un toque de cambiar.
    const ult = await ultimaSesion(S.atleta.id);
    S.ciclo  = ult?.cycles?.numero ?? (S.ciclos.at(-1)?.numero ?? 1);
    S.semana = ult?.semana ?? 1;

    // Día propuesto: el siguiente al último registrado.
    const idxUlt = S.dias.findIndex((d) => d.id === ult?.routine_day_id);
    S.dia = S.dias[(idxUlt + 1) % S.dias.length] || S.dias[0];

    await cargarDia();
  } catch (e) {
    pintarError(e);
  }
}

/** Carga los ejercicios del día, lo ya registrado y el "última vez". */
async function cargarDia() {
  // Marco inmediato para que el cambio de día se sienta instantáneo,
  // pero sin las filas del día anterior: dejarlas ahí un instante
  // invita a escribir en la fila equivocada.
  S.filas = [];
  S.cargandoDia = true;
  pintar();

  try {
    const ejercicios = await ejerciciosDelDia(S.dia.id);
    const ids = ejercicios.map((e) => e.exerciseId);

    const [ultimos, sesion] = await Promise.all([
      ultimoRegistroPorEjercicio(S.atleta.id, ids),
      buscarSesion(S.atleta.id, S.dia.id, S.fecha),
    ]);

    S.sesion = sesion;
    if (sesion) {
      S.ciclo  = S.ciclos.find((c) => c.id === sesion.cycle_id)?.numero ?? S.ciclo;
      S.semana = sesion.semana ?? S.semana;
    }

    const registrados = sesion ? await registrosDeSesion(sesion.id) : new Map();

    S.filas = ejercicios.map((ej) => {
      const ya = registrados.get(ej.exerciseId);
      const ultimo = ultimos.get(ej.exerciseId);
      return {
        ...ej,
        setLogId: ya?.id ?? null,
        // Lo ya registrado manda; si no hay, se precarga la última vez;
        // si tampoco, los valores base del plan.
        peso:   ya?.peso   ?? ultimo?.peso   ?? ej.pesoBase   ?? null,
        series: ya?.series ?? ultimo?.series ?? ej.seriesBase ?? 3,
        reps:   ya?.reps   ?? ultimo?.reps   ?? ej.repsBase   ?? null,
        guardado: Boolean(ya),
        ultimo,
        editado: ya?.actualizado_en ?? null,
        estado: ya ? 'guardado' : 'limpio',
        cola: crearCola(),
        pendiente: null,   // último intento fallido, para reintentar
        tocada: false,     // ¿la persona escribió algo en esta fila?
      };
    });

    S.cargandoDia = false;
    pintar();
  } catch (e) {
    pintarError(e);
  }
}

// ============================================================
// Guardado
// ============================================================

/**
 * Crea la sesión si todavía no existe. Se llama desde varias filas a
 * la vez, así que la promesa se comparte: una sola sesión, siempre.
 */
function asegurarSesion() {
  if (S.sesion) return Promise.resolve(S.sesion);
  if (S.creandoSesion) return S.creandoSesion;

  S.creandoSesion = (async () => {
    const cycleId = await asegurarCiclo(S.rutina.id, S.ciclo);
    const s = await crearSesion({
      userId: S.atleta.id,
      routineDayId: S.dia.id,
      cycleId,
      semana: S.semana,
      fecha: S.fecha,
    });
    S.sesion = s;
    return s;
  })();

  S.creandoSesion.catch(() => { S.creandoSesion = null; });
  return S.creandoSesion;
}

/** Guarda una fila. Se encola para que dos ediciones no se pisen. */
function guardarFila(fila) {
  const vacia = fila.peso === null && fila.reps === null;

  return fila.cola(async () => {
    marcarFila(fila, 'guardando');
    try {
      if (vacia && fila.setLogId) {
        await borrarRegistro(fila.setLogId);
        fila.setLogId = null;
        fila.guardado = false;
        marcarFila(fila, 'limpio');
        return;
      }
      if (vacia) { marcarFila(fila, 'limpio'); return; }

      const sesion = await asegurarSesion();
      const guardado = await guardarRegistro({
        setLogId: fila.setLogId,
        sessionId: sesion.id,
        exerciseId: fila.exerciseId,
        routineExerciseId: fila.routineExerciseId,
        series: fila.series,
        reps: fila.reps,
        peso: fila.peso,
        unidad: fila.unidad,
      });

      fila.setLogId = guardado.id;
      fila.guardado = true;
      fila.pendiente = null;
      marcarFila(fila, 'guardado');
    } catch (e) {
      // Lo escrito NO se toca. Se marca y se reintenta.
      fila.pendiente = true;
      marcarFila(fila, 'error', mensajeDeError(e));
    }
  });
}

/** Reintenta todo lo que quedó pendiente. Se dispara al volver la red. */
async function reintentarPendientes() {
  const pendientes = S.filas.filter((f) => f.pendiente);
  if (!pendientes.length) return;
  for (const f of pendientes) await guardarFila(f);
  if (!S.filas.some((f) => f.pendiente)) avisar('Se guardó lo que quedó pendiente.');
}

window.addEventListener('online', reintentarPendientes);

// ============================================================
// Pintado
// ============================================================

function pintarCargando() {
  raiz.innerHTML = `<div class="cargando">Cargando…</div>`;
}

function pintarError(e) {
  console.error('[entrenar]', e);
  raiz.innerHTML = `
    <div class="vacio">
      <h2 class="vacio-titulo">No se pudo cargar el entrenamiento</h2>
      <p class="vacio-texto">${esc(mensajeDeError(e))}</p>
      <button class="boton" id="reintentar">Reintentar</button>
    </div>`;
  raiz.querySelector('#reintentar').addEventListener('click', cargarAtleta);
}

function pintarSinRutina() {
  const esOtro = !esPropio();
  raiz.innerHTML = `
    <div class="vacio">
      <h2 class="vacio-titulo">Todavía no hay una rutina</h2>
      <p class="vacio-texto">
        ${esOtro
          ? `${esc(S.atleta.nombre || S.atleta.email)} todavía no tiene una rutina vigente.`
          : 'Arma tu rutina —qué días entrenas y qué ejercicios hace cada día— y esta pantalla se llena sola.'}
      </p>
    </div>`;
}

function pintar() {
  raiz.innerHTML = `
    <div class="barra-dias" role="tablist" aria-label="Días de la rutina">
      ${S.dias.map((d) => `
        <button class="chip ${d.id === S.dia?.id ? 'chip--activo' : ''}"
                role="tab" aria-selected="${d.id === S.dia?.id}"
                data-dia="${esc(d.id)}" type="button">
          <span class="chip-orden">Día ${d.orden}</span>
          <span class="chip-nombre">${esc(nombreCorto(d.nombre))}</span>
        </button>`).join('')}
    </div>

    <div class="contexto">
      <label class="campo-chico">
        <span class="campo-etiqueta">Fecha</span>
        <input type="date" id="fecha" class="entrada entrada--fecha" value="${esc(S.fecha)}" max="${esc(hoyISO())}">
      </label>
      <label class="campo-chico">
        <span class="campo-etiqueta">Ciclo</span>
        <input type="number" id="ciclo" class="entrada entrada--num" min="1" step="1" inputmode="numeric" value="${S.ciclo ?? ''}">
      </label>
      <label class="campo-chico">
        <span class="campo-etiqueta">Semana</span>
        <input type="number" id="semana" class="entrada entrada--num" min="1" max="8" step="1" inputmode="numeric" value="${S.semana ?? ''}">
      </label>
      <p class="contexto-fecha">${esc(fmtFechaLarga(S.fecha))}</p>
    </div>

    ${S.cargandoDia
      ? `<div class="cargando">Cargando el día…</div>`
      : (S.filas.length ? '' : `<div class="vacio"><p class="vacio-texto">Este día no tiene ejercicios en el plan.</p></div>`)}

    <ul class="lista-ejercicios">
      ${S.filas.map(filaHTML).join('')}
    </ul>

    ${S.filas.length ? `<p class="pie-nota">Se guarda solo, a medida que escribes.</p>` : ''}
  `;

  conectarDias();
  conectarContexto();
  S.filas.forEach(conectarFila);
}

function nombreCorto(nombre) {
  // "Día 1 – Empuje / Tren superior" → "Empuje / Tren superior"
  return String(nombre).replace(/^d[ií]a\s*\d+\s*[–-]\s*/i, '');
}

function filaHTML(f, i) {
  const ult = f.ultimo;
  const referencia = ult
    ? `última vez: ${fmtNum(ult.peso)} ${esc(ult.unidad)}${ult.reps ? ` · ${ult.series}×${ult.reps}` : ` · ${ult.series} series`} · ${haceCuanto(ult.fecha)}`
    : 'primera vez en este ejercicio';

  return `
    <li class="ejercicio" data-fila="${i}">
      <div class="ejercicio-cabecera">
        <span class="ejercicio-orden">${f.orden}</span>
        <div class="ejercicio-titulo">
          <h3 class="ejercicio-nombre">${esc(f.nombre)}</h3>
          <p class="ejercicio-referencia">${esc(referencia)}</p>
        </div>
        <span class="estado estado--${f.estado}" data-estado>${textoEstado(f.estado)}</span>
      </div>

      <div class="ejercicio-campos">
        <label class="campo">
          <span class="campo-etiqueta">Peso (${esc(f.unidad)})</span>
          <input type="text" inputmode="decimal" class="entrada entrada--peso"
                 data-campo="peso" value="${esc(fmtNum(f.peso))}" placeholder="—">
        </label>
        <label class="campo">
          <span class="campo-etiqueta">Series</span>
          <input type="text" inputmode="numeric" class="entrada entrada--num"
                 data-campo="series" value="${esc(f.series ?? '')}" placeholder="—">
        </label>
        <label class="campo">
          <span class="campo-etiqueta">Reps</span>
          <input type="text" inputmode="numeric" class="entrada entrada--num"
                 data-campo="reps" value="${esc(f.reps ?? '')}" placeholder="—">
        </label>
      </div>

      ${f.editado ? `<p class="ejercicio-editado">editado el ${esc(fmtFechaLarga(String(f.editado).slice(0, 10)))}</p>` : ''}
    </li>`;
}

function textoEstado(estado) {
  return { limpio: '', guardando: 'guardando…', guardado: 'guardado', error: 'sin guardar' }[estado] || '';
}

function marcarFila(fila, estado, detalle) {
  fila.estado = estado;
  const i = S.filas.indexOf(fila);
  const el = raiz.querySelector(`[data-fila="${i}"] [data-estado]`);
  if (!el) return;
  el.className = `estado estado--${estado}`;
  el.textContent = textoEstado(estado);
  if (detalle) el.title = detalle;
  if (estado === 'error' && detalle) avisar(detalle, 'error');
}

// ------------------------------------------------------------
// Conexiones
// ------------------------------------------------------------

function conectarDias() {
  raiz.querySelectorAll('[data-dia]').forEach((b) => {
    b.addEventListener('click', async () => {
      if (b.dataset.dia === S.dia?.id) return;
      S.dia = S.dias.find((d) => d.id === b.dataset.dia);
      await cargarDia();
    });
  });
}

function conectarContexto() {
  const fecha  = raiz.querySelector('#fecha');
  const ciclo  = raiz.querySelector('#ciclo');
  const semana = raiz.querySelector('#semana');
  if (!fecha) return;

  fecha.addEventListener('change', async () => {
    S.fecha = fecha.value || hoyISO();
    await cargarDia();          // otra fecha es otra sesión
  });

  const guardarContexto = retrasar(async () => {
    S.ciclo  = aNumero(ciclo.value);
    S.semana = aNumero(semana.value);
    if (!S.sesion) return;      // sin sesión todavía, solo queda anotado
    try {
      const cycleId = await asegurarCiclo(S.rutina.id, S.ciclo);
      await actualizarSesion(S.sesion.id, { cycle_id: cycleId, semana: S.semana });
    } catch (e) {
      avisar(mensajeDeError(e), 'error');
    }
  }, 800);

  ciclo.addEventListener('input', guardarContexto);
  semana.addEventListener('input', guardarContexto);
}

function conectarFila(fila, i) {
  const li = raiz.querySelector(`[data-fila="${i}"]`);
  if (!li) return;

  const guardar = retrasar(() => guardarFila(fila), 700);

  li.querySelectorAll('[data-campo]').forEach((input) => {
    const campo = input.dataset.campo;

    input.addEventListener('input', () => {
      fila[campo] = aNumero(input.value);
      fila.tocada = true;
      if (fila.estado !== 'guardando') marcarFila(fila, 'guardando');
      guardar();
    });

    // Salir del campo guarda de inmediato: en el gimnasio la pantalla
    // se apaga sola y no hay que esperar al debounce.
    // Salir del campo guarda de inmediato, pero SOLO si se escribió
    // algo: pasar por encima de una fila precargada no debe crear un
    // registro que nadie confirmó.
    input.addEventListener('blur', () => {
      if (!fila.tocada) return;
      fila[campo] = aNumero(input.value);
      guardar.ahora();
    });

    // Enter salta al campo siguiente en vez de recargar nada.
    input.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      if (fila.tocada) guardar.ahora();
      const todos = [...raiz.querySelectorAll('[data-campo]')];
      const sig = todos[todos.indexOf(input) + 1];
      if (sig) { sig.focus(); sig.select?.(); }
      else input.blur();
    });
  });
}

// Al cerrar la pestaña, forzar lo que quede en el aire.
window.addEventListener('pagehide', () => {
  S.filas.forEach((f) => { if (f.estado === 'guardando') guardarFila(f); });
});
