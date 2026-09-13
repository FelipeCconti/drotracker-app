// ============================================================
// DRO.TRACKER · configurar la rutina
//
// Acá se decide qué días se entrena y qué ejercicios tiene cada día.
// Es la pantalla que cada persona usa una vez al empezar y después
// cada varios meses.
//
// LA DECISIÓN QUE IMPORTA: editar en sitio o suceder.
//
// Ajustar la rutina vigente —renombrar un día, cambiar las series
// base, sumar o quitar un ejercicio— se hace acá mismo y no rompe
// nada: quitar un ejercicio es un borrado lógico (`activo = false`),
// así que los entrenamientos ya registrados siguen apuntando a una
// fila que existe.
//
// Cambiar la ESTRUCTURA —otra distribución de días, otro enfoque— pide
// una rutina nueva con el botón "Empezar una rutina nueva". Eso cierra
// la vigente con fecha, crea su sucesora copiando todo, y deja el
// historial viejo colgando de la rutina vieja. Es lo que hace que "qué
// rutina hacía en abril" tenga respuesta, y lo que permite que el
// gráfico "Por día" no mezcle el Día 2 de una rutina con el de otra.
//
// Un día con entrenamientos registrados NO se puede borrar. La base lo
// impide a propósito; acá se explica en vez de mostrar el error crudo.
// ============================================================

import {
  rutinaVigente, diasDeRutina, ejerciciosDelDia,
  crearRutina, renombrarRutina, sucederRutina, crearDia, renombrarDia, borrarDia,
  catalogoEjercicios, crearEjercicio, agregarEjercicioADia,
  actualizarEjercicioDeRutina, quitarEjercicioDeDia, reordenarEjercicios,
} from './db.js';

import { esc, aNumero, fmtNum, retrasar, avisar, mensajeDeError, fmtFechaLarga } from './ui.js';
import { sesion, esPropio, permiso, sinPermisoHTML } from './sesion.js';

const S = {
  yo: null,
  atleta: null,
  atletas: [],
  rutina: null,
  dias: [],
  diaId: null,
  ejercicios: [],
  catalogo: [],
  agregando: false,
};

let raiz = null;
const esPropia = () => esPropio();

// ============================================================
// Entrada
// ============================================================
export async function montarRutina(contenedor) {
  raiz = contenedor;
  S.yo = sesion.yo;
  S.atleta = sesion.sujeto;   // quién es se elige en la cabecera

  if (!permiso('plan')) { raiz.innerHTML = sinPermisoHTML('plan'); return; }

  S.diaId = null;
  raiz.innerHTML = `<div class="cargando">Cargando…</div>`;
  try {
    await cargar();
  } catch (e) {
    pintarError(e);
  }
}

async function cargar() {
  S.rutina = await rutinaVigente(S.atleta.id);
  S.catalogo = await catalogoEjercicios(S.atleta.id).catch(() => []);

  if (!S.rutina) { S.dias = []; S.ejercicios = []; return pintarSinRutina(); }

  S.dias = await diasDeRutina(S.rutina.id);
  if (!S.dias.some((d) => d.id === S.diaId)) S.diaId = S.dias[0]?.id || null;
  S.ejercicios = S.diaId ? await ejerciciosDelDia(S.diaId) : [];
  pintar();
}

async function recargarDia() {
  S.ejercicios = S.diaId ? await ejerciciosDelDia(S.diaId) : [];
  pintar();
}

function pintarError(e) {
  raiz.innerHTML = `<div class="vacio">
    <h2 class="vacio-titulo">No se pudo cargar la rutina</h2>
    <p class="vacio-texto">${esc(mensajeDeError(e))}</p></div>`;
}

// ============================================================
// Sin rutina todavía
// ============================================================
function pintarSinRutina() {
  raiz.innerHTML = `
    <div class="vacio">
      <h2 class="vacio-titulo">${esPropia() ? 'Arma tu rutina' : `${esc(S.atleta.nombre || S.atleta.email)} todavía no tiene rutina`}</h2>
      <p class="vacio-texto">
        Una rutina son días, y cada día sus ejercicios. Se puede cambiar
        cuando quieras: empieza con lo que sepas hoy.
      </p>
      <form class="nueva-rutina" id="form-rutina">
        <label class="campo-chico">
          <span class="campo-etiqueta">Nombre de la rutina</span>
          <input type="text" id="nombre-rutina" class="entrada entrada--texto"
                 placeholder="Hipertrofia 2026" required>
        </label>
        <label class="campo-chico">
          <span class="campo-etiqueta">Días por semana</span>
          <input type="number" id="n-dias" class="entrada entrada--num" min="1" max="7" value="4">
        </label>
        <button class="boton" type="submit">Crear</button>
      </form>
    </div>`;

  raiz.querySelector('#form-rutina')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const nombre = raiz.querySelector('#nombre-rutina').value.trim();
    const n = Math.min(7, Math.max(1, aNumero(raiz.querySelector('#n-dias').value) || 1));
    if (!nombre) return avisar('Ponle un nombre a la rutina.', 'error');
    try {
      const r = await crearRutina(S.atleta.id, nombre);
      for (let i = 1; i <= n; i++) await crearDia(r.id, i, `Día ${i}`);
      S.diaId = null;
      await cargar();
      avisar('Rutina creada. Ahora agrégale ejercicios a cada día.');
    } catch (e) { avisar(mensajeDeError(e), 'error'); }
  });
}

// ============================================================
// Pantalla principal
// ============================================================
function pintar() {
  const dia = S.dias.find((d) => d.id === S.diaId);

  raiz.innerHTML = `
    <div class="rutina-cabecera">
      <label class="campo campo--titulo">
        <span class="campo-etiqueta">Rutina vigente</span>
        <input type="text" id="nombre-rutina" class="entrada entrada--titulo"
               value="${esc(S.rutina.nombre)}">
      </label>
      <div class="rutina-meta">
        <span>desde ${esc(fmtFechaLarga(S.rutina.vigente_desde))}</span>
        <button class="volver" type="button" id="suceder">Empezar una rutina nueva</button>
      </div>
    </div>

    <div class="barra-dias" role="tablist" aria-label="Días de la rutina">
      ${S.dias.map((d) => `
        <button class="chip ${d.id === S.diaId ? 'chip--activo' : ''}"
                role="tab" data-dia="${esc(d.id)}" type="button">
          <span class="chip-orden">Día ${d.orden}</span>
          <span class="chip-nombre">${esc(nombreCorto(d.nombre))}</span>
        </button>`).join('')}
      <button class="chip chip--sumar" type="button" id="agregar-dia" title="Agregar un día">
        <span class="chip-orden">+</span>
        <span class="chip-nombre">Agregar día</span>
      </button>
    </div>

    ${dia ? `
      <div class="dia-cabecera">
        <label class="campo campo--titulo">
          <span class="campo-etiqueta">Nombre del día ${esc(dia.orden)}</span>
          <input type="text" id="nombre-dia" class="entrada entrada--titulo"
                 value="${esc(dia.nombre)}">
        </label>
        <button class="enlace enlace--riesgo" type="button" id="borrar-dia">Borrar este día</button>
      </div>

      <ul class="lista-ejercicios lista-plan">
        ${S.ejercicios.length ? S.ejercicios.map(filaHTML).join('')
          : `<li class="vacio vacio--fino"><p class="vacio-texto">
               Este día no tiene ejercicios todavía.</p></li>`}
      </ul>

      ${S.agregando ? agregarHTML() : `
        <button class="boton" type="button" id="abrir-agregar">+ Agregar ejercicio</button>`}
    ` : `<div class="vacio"><p class="vacio-texto">Esta rutina no tiene días. Agrega uno arriba.</p></div>`}

    <p class="pie-nota">
      Los cambios se guardan solos. Quitar un ejercicio no borra lo que ya registraste con él.
    </p>`;

  conectar();
}

function filaHTML(e, i) {
  return `
    <li class="ejercicio ejercicio--plan" data-fila="${i}">
      <div class="ejercicio-cabecera">
        <span class="ejercicio-orden">${e.orden}</span>
        <div class="ejercicio-titulo">
          <h3 class="ejercicio-nombre">${esc(e.nombre)}</h3>
          ${e.grupo ? `<p class="ejercicio-referencia">${esc(e.grupo)}</p>` : ''}
        </div>
        <div class="plan-acciones">
          <button class="icono" type="button" data-subir="${i}" ${i === 0 ? 'disabled' : ''} title="Subir">↑</button>
          <button class="icono" type="button" data-bajar="${i}" ${i === S.ejercicios.length - 1 ? 'disabled' : ''} title="Bajar">↓</button>
          <button class="icono icono--riesgo" type="button" data-quitar="${esc(e.routineExerciseId)}" title="Quitar del plan">✕</button>
        </div>
      </div>
      <div class="ejercicio-campos">
        <label class="campo">
          <span class="campo-etiqueta">Series</span>
          <input type="text" inputmode="numeric" class="entrada entrada--num"
                 data-campo="series_base" value="${esc(e.seriesBase ?? '')}" placeholder="—">
        </label>
        <label class="campo">
          <span class="campo-etiqueta">Reps</span>
          <input type="text" inputmode="numeric" class="entrada entrada--num"
                 data-campo="reps_base" value="${esc(e.repsBase ?? '')}" placeholder="—">
        </label>
        <label class="campo">
          <span class="campo-etiqueta">Unidad</span>
          <select class="entrada entrada--select" data-campo="unidad">
            ${['kg', 'lb', 'placas', 'seg', 'reps'].map((u) => `
              <option value="${u}" ${u === e.unidad ? 'selected' : ''}>${u}</option>`).join('')}
          </select>
        </label>
      </div>
    </li>`;
}

function agregarHTML() {
  const enElDia = new Set(S.ejercicios.map((e) => e.exerciseId));
  const mios   = S.catalogo.filter((c) => !c.es_global && !enElDia.has(c.id));
  const global = S.catalogo.filter((c) => c.es_global && !enElDia.has(c.id));

  return `
    <div class="agregar">
      <div class="agregar-cabecera">
        <h3 class="explicacion-titulo">Agregar ejercicio</h3>
        <button class="volver" type="button" id="cerrar-agregar">Cancelar</button>
      </div>

      <div class="agregar-fila">
        <label class="campo campo--ancho">
          <span class="campo-etiqueta">Del catálogo</span>
          <select id="sel-catalogo" class="entrada entrada--select">
            <option value="">— elegir —</option>
            ${mios.length ? `<optgroup label="Mis ejercicios">
              ${mios.map((c) => `<option value="${esc(c.id)}">${esc(c.nombre)}</option>`).join('')}
            </optgroup>` : ''}
            ${global.length ? `<optgroup label="Catálogo general">
              ${global.map((c) => `<option value="${esc(c.id)}">${esc(c.nombre)}</option>`).join('')}
            </optgroup>` : ''}
          </select>
        </label>
        <button class="boton" type="button" id="agregar-del-catalogo">Agregar</button>
      </div>

      <p class="agregar-o">o crea uno que no esté</p>

      <form class="agregar-fila" id="form-nuevo-ejercicio">
        <label class="campo campo--ancho">
          <span class="campo-etiqueta">Nombre</span>
          <input type="text" id="nuevo-nombre" class="entrada entrada--texto"
                 placeholder="Remo en polea baja" required>
        </label>
        <label class="campo-chico">
          <span class="campo-etiqueta">Grupo (opcional)</span>
          <input type="text" id="nuevo-grupo" class="entrada entrada--texto" placeholder="Espalda">
        </label>
        <button class="boton" type="submit">Crear y agregar</button>
      </form>

      <p class="explicacion-aviso">
        Los ejercicios que crees son tuyos: no aparecen en el catálogo de los demás.
      </p>
    </div>`;
}

function nombreCorto(nombre) {
  return String(nombre).replace(/^d[ií]a\s*\d+\s*[–-]\s*/i, '');
}

// ============================================================
// Conexiones
// ============================================================
function conectar() {
  const q = (s) => raiz.querySelector(s);

  // --- nombre de la rutina y del día: autoguardado ---
  const guardarNombreRutina = retrasar(async (v) => {
    if (!v.trim()) return;
    try { await renombrarRutina(S.rutina.id, v.trim()); S.rutina.nombre = v.trim(); }
    catch (e) { avisar(mensajeDeError(e), 'error'); }
  }, 700);
  q('#nombre-rutina')?.addEventListener('input', (ev) => guardarNombreRutina(ev.target.value));

  const guardarNombreDia = retrasar(async (v) => {
    if (!v.trim()) return;
    try {
      await renombrarDia(S.diaId, v.trim());
      const d = S.dias.find((x) => x.id === S.diaId);
      if (d) d.nombre = v.trim();
      raiz.querySelector(`[data-dia="${S.diaId}"] .chip-nombre`).textContent = nombreCorto(v.trim());
    } catch (e) { avisar(mensajeDeError(e), 'error'); }
  }, 700);
  q('#nombre-dia')?.addEventListener('input', (ev) => guardarNombreDia(ev.target.value));

  // --- días ---
  raiz.querySelectorAll('[data-dia]').forEach((b) => b.addEventListener('click', async () => {
    if (b.dataset.dia === S.diaId) return;
    S.diaId = b.dataset.dia;
    S.agregando = false;
    await recargarDia();
  }));

  q('#agregar-dia')?.addEventListener('click', async () => {
    if (S.dias.length >= 7) return avisar('Siete días es una semana completa.', 'error');
    const orden = (S.dias.at(-1)?.orden || 0) + 1;
    try {
      const d = await crearDia(S.rutina.id, orden, `Día ${orden}`);
      S.diaId = d.id;
      await cargar();
    } catch (e) { avisar(mensajeDeError(e), 'error'); }
  });

  q('#borrar-dia')?.addEventListener('click', async () => {
    const d = S.dias.find((x) => x.id === S.diaId);
    if (!confirm(`¿Borrar el ${d.nombre}? Se van también sus ejercicios del plan.`)) return;
    try {
      await borrarDia(S.diaId);
      S.diaId = null;
      await cargar();
      avisar('Día borrado.');
    } catch (e) {
      // La negativa de la base es correcta: hay historial colgando.
      if (/violates foreign key|23503/i.test(String(e?.message || e?.code || ''))) {
        avisar('Ese día ya tiene entrenamientos registrados, así que no se puede borrar sin perder ese historial. Si cambiaste de enfoque, usa "Empezar una rutina nueva".', 'error');
      } else {
        avisar(mensajeDeError(e), 'error');
      }
    }
  });

  // --- suceder ---
  q('#suceder')?.addEventListener('click', async () => {
    const nombre = prompt(
      'Se cierra la rutina actual con la fecha de hoy y se crea una copia para seguir editando.\n' +
      'El historial no se toca: queda asociado a la rutina que se cierra.\n\n' +
      'Nombre de la rutina nueva:',
      `${S.rutina.nombre} · v2`);
    if (!nombre?.trim()) return;
    try {
      await sucederRutina(S.rutina.id, nombre.trim());
      S.diaId = null;
      await cargar();
      avisar('Rutina nueva creada a partir de la anterior.');
    } catch (e) { avisar(mensajeDeError(e), 'error'); }
  });

  // --- ejercicios del día ---
  S.ejercicios.forEach((e, i) => {
    const li = raiz.querySelector(`[data-fila="${i}"]`);
    if (!li) return;

    const guardar = retrasar(async () => {
      try {
        await actualizarEjercicioDeRutina(e.routineExerciseId, {
          series_base: e.seriesBase, reps_base: e.repsBase, unidad: e.unidad,
        });
      } catch (err) { avisar(mensajeDeError(err), 'error'); }
    }, 700);

    li.querySelectorAll('[data-campo]').forEach((input) => {
      const evento = input.tagName === 'SELECT' ? 'change' : 'input';
      input.addEventListener(evento, () => {
        if (input.dataset.campo === 'unidad') e.unidad = input.value;
        else if (input.dataset.campo === 'series_base') e.seriesBase = aNumero(input.value);
        else e.repsBase = aNumero(input.value);
        guardar();
      });
    });
  });

  raiz.querySelectorAll('[data-subir]').forEach((b) => b.addEventListener('click',
    () => mover(Number(b.dataset.subir), -1)));
  raiz.querySelectorAll('[data-bajar]').forEach((b) => b.addEventListener('click',
    () => mover(Number(b.dataset.bajar), +1)));

  raiz.querySelectorAll('[data-quitar]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('¿Quitar este ejercicio del plan?\n\nLo que ya registraste con él se conserva y sigue apareciendo en Progreso.')) return;
    try {
      await quitarEjercicioDeDia(b.dataset.quitar);
      await recargarDia();
      avisar('Ejercicio quitado del plan.');
    } catch (e) { avisar(mensajeDeError(e), 'error'); }
  }));

  // --- agregar ---
  q('#abrir-agregar')?.addEventListener('click', () => { S.agregando = true; pintar(); });
  q('#cerrar-agregar')?.addEventListener('click', () => { S.agregando = false; pintar(); });

  q('#agregar-del-catalogo')?.addEventListener('click', async () => {
    const id = q('#sel-catalogo').value;
    if (!id) return avisar('Elige un ejercicio del catálogo.', 'error');
    await sumarAlDia(id);
  });

  q('#form-nuevo-ejercicio')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const nombre = q('#nuevo-nombre').value.trim();
    if (!nombre) return;
    try {
      const nuevo = await crearEjercicio(S.atleta.id, {
        nombre, grupo_muscular: q('#nuevo-grupo').value.trim(),
      });
      S.catalogo.push(nuevo);
      await sumarAlDia(nuevo.id, nuevo.unidad_def);
    } catch (e) { avisar(mensajeDeError(e), 'error'); }
  });
}

async function sumarAlDia(exerciseId, unidad) {
  const orden = (S.ejercicios.at(-1)?.orden || 0) + 1;
  try {
    await agregarEjercicioADia(S.diaId, exerciseId, orden, { unidad });
    S.agregando = false;
    await recargarDia();
    avisar('Ejercicio agregado.');
  } catch (e) { avisar(mensajeDeError(e), 'error'); }
}

/** Intercambia dos ejercicios de sitio y persiste los dos órdenes. */
async function mover(i, delta) {
  const j = i + delta;
  if (j < 0 || j >= S.ejercicios.length) return;
  const a = S.ejercicios[i], b = S.ejercicios[j];
  const ordenA = a.orden, ordenB = b.orden;
  try {
    await reordenarEjercicios([
      { id: a.routineExerciseId, orden: ordenB },
      { id: b.routineExerciseId, orden: ordenA },
    ]);
    await recargarDia();
  } catch (e) { avisar(mensajeDeError(e), 'error'); }
}
