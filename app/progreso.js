// ============================================================
// DRO.TRACKER · pantalla de progreso
//
// Dos preguntas, dos vistas. Abre en POR DÍA porque la primera
// pregunta al entrar es "cómo viene la cosa en general", no "cómo
// viene este movimiento en particular".
//
//   POR DÍA        ¿cómo viene cada ejercicio de este día? Un gráfico
//                  pequeño por ejercicio. NO cruza rutinas: el "Día 2"
//                  de una rutina y el de otra no son lo mismo.
//
//   POR EJERCICIO  ¿estoy levantando más que antes en este movimiento?
//                  Sí cruza rutinas: el historial del press banca es
//                  uno solo aunque la rutina haya cambiado tres veces.
//                  Marca con una línea vertical dónde cambió.
//
// SOBRE EL COLOR. La paleta es un solo azul, y un solo azul no puede
// cargar la identidad de ocho ejercicios distintos: quedarían ocho
// barras que nadie distingue. Por eso "Por día" son gráficos pequeños
// uno al lado del otro —cada ejercicio el suyo— en vez de barras
// agrupadas de ocho colores.
//
// Los dos pasos de azul que se usan (--grafico-serie-1 y -2) están
// comprobados: se distinguen entre sí con visión normal y con
// daltonismo, y contrastan con el fondo de las tarjetas.
//
// SOBRE EL HORIZONTE. Por defecto se muestran las últimas cuatro
// semanas: es el ciclo en curso, que es lo que se mira a diario. El
// resto no se esconde —se extiende con el selector— y cuando las
// barras no caben, el gráfico se desliza en lugar de apretarlas hasta
// que no se lean.
// ============================================================

import { historial, rutinaVigente, diasDeRutina, ejerciciosDelDia } from './db.js';
import { esc, fmtNum, fmtFechaLarga, mensajeDeError } from './ui.js';
import { sesion } from './sesion.js';

const Chart = window.Chart;

const S = {
  perfil: null,
  filas: [],
  vista: 'dia',        // 'dia' | 'ejercicio'
  ejercicioId: null,
  rutina: null,
  dias: [],
  diaId: null,
  ejerciciosDeDia: new Map(),   // routine_day_id → [exercise_id]
  // Horizonte por vista: "Por día" abre en el ciclo en curso, que es lo
  // que se mira a diario; "Por ejercicio" abre en 12 semanas, porque
  // ahí la pregunta es la tendencia, no la semana.
  horizonte: { dia: 4, ejercicio: 12 },
  expandido: null,              // exercise_id en foco dentro de "Por día"
  graficos: [],
};

let raiz = null;

const HORIZONTES = [
  { valor: 4,      texto: 'Últimas 4 semanas' },
  { valor: 8,      texto: 'Últimas 8 semanas' },
  { valor: 12,     texto: 'Últimas 12 semanas' },
  { valor: 'todo', texto: 'Todo el historial' },
];

// ------------------------------------------------------------
// Colores: se leen de los tokens, nunca se escriben acá.
// ------------------------------------------------------------
function token(nombre) {
  return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
}

function paleta() {
  return {
    serie1:  token('--grafico-serie-1'),
    serie2:  token('--grafico-serie-2'),
    rejilla: token('--grafico-rejilla'),
    marca:   token('--grafico-marca'),
    texto:   token('--color-texto-tenue'),
    debil:   token('--color-texto-debil'),
  };
}

/** #rrggbb → rgba(...), para el área bajo la curva. */
function conAlfa(hex, alfa) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
}

// ============================================================
// Entrada
// ============================================================
export async function montarProgreso(contenedor) {
  raiz = contenedor;
  // Quién es se elige en la cabecera. Progreso es lectura, y leer el
  // entrenamiento de un atleta asignado no necesita permiso aparte.
  const perfil = sesion.sujeto;
  S.perfil = perfil;
  S.expandido = null;
  raiz.innerHTML = `<div class="cargando">Cargando tu historial…</div>`;

  try {
    const [filas, rutina] = await Promise.all([
      historial(perfil.id),
      rutinaVigente(perfil.id),
    ]);
    S.filas = filas;
    S.rutina = rutina;
    S.dias = rutina ? await diasDeRutina(rutina.id) : [];

    // Qué ejercicio pertenece a qué día. El historial no lo guarda
    // —guarda el ejercicio, que es lo que sobrevive a los cambios de
    // rutina— así que la pertenencia se lee del plan vigente.
    const porDia = await Promise.all(S.dias.map((d) => ejerciciosDelDia(d.id)));
    S.ejerciciosDeDia = new Map(
      S.dias.map((d, i) => [d.id, porDia[i].map((e) => e.exerciseId)]));

    if (!S.filas.length) return pintarVacio();

    S.diaId = S.diaId || S.dias[0]?.id;
    S.ejercicioId = S.ejercicioId || ejerciciosAgrupados()[0]?.ejercicios[0]?.id;
    pintar();
  } catch (e) {
    raiz.innerHTML = `<div class="vacio">
      <h2 class="vacio-titulo">No se pudo cargar el progreso</h2>
      <p class="vacio-texto">${esc(mensajeDeError(e))}</p></div>`;
  }
}

function pintarVacio() {
  raiz.innerHTML = `<div class="vacio">
    <h2 class="vacio-titulo">Todavía no hay nada que graficar</h2>
    <p class="vacio-texto">Registra un entrenamiento y esta pantalla se llena sola.</p>
  </div>`;
}

// ------------------------------------------------------------
// Datos derivados
// ------------------------------------------------------------

/**
 * Los ejercicios del historial agrupados por día de la rutina vigente,
 * que es como la gente los busca: "el press de hombro, el del día de
 * empuje". Los que ya no están en ninguna rutina caen en "Otros" — no
 * desaparecen, porque su historial sigue siendo válido.
 */
function ejerciciosAgrupados() {
  const nombres = new Map();
  for (const f of S.filas) if (!nombres.has(f.exercise_id)) nombres.set(f.exercise_id, f.ejercicio);

  const usados = new Set();
  const grupos = [];

  for (const d of S.dias) {
    const ids = (S.ejerciciosDeDia.get(d.id) || []).filter((id) => nombres.has(id));
    if (!ids.length) continue;
    ids.forEach((id) => usados.add(id));
    grupos.push({
      titulo: d.nombre,
      ejercicios: ids.map((id) => ({ id, nombre: nombres.get(id) })),
    });
  }

  const otros = [...nombres].filter(([id]) => !usados.has(id))
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  if (otros.length) grupos.push({ titulo: 'Fuera de la rutina vigente', ejercicios: otros });

  return grupos;
}

/** Recorta a los últimos N registros. El horizonte se aplica siempre
 *  al final de la serie: lo reciente es lo que se mira. */
function recortar(filas, horizonte = S.horizonte[S.vista]) {
  if (horizonte === 'todo') return filas;
  return filas.slice(-Number(horizonte));
}

function selectorHorizonte() {
  return `
    <label class="campo-chico">
      <span class="campo-etiqueta">Horizonte</span>
      <select id="sel-horizonte" class="entrada entrada--select">
        ${HORIZONTES.map((h) => `<option value="${h.valor}" ${String(h.valor) === String(S.horizonte[S.vista]) ? 'selected' : ''}>${esc(h.texto)}</option>`).join('')}
      </select>
    </label>`;
}

function conectarHorizonte(cont) {
  const sel = cont.querySelector('#sel-horizonte');
  if (!sel) return;
  sel.addEventListener('change', (ev) => {
    S.horizonte[S.vista] = ev.target.value === 'todo' ? 'todo' : Number(ev.target.value);
    pintar();
  });
}

// ============================================================
// Pintado
// ============================================================

function destruirGraficos() {
  S.graficos.forEach((g) => g.destroy());
  S.graficos = [];
}

function pintar() {
  destruirGraficos();

  raiz.innerHTML = `
    <div class="subtabs" role="tablist">
      <button class="subtab ${S.vista === 'dia' ? 'subtab--activo' : ''}"
              data-vista="dia" role="tab">Por día</button>
      <button class="subtab ${S.vista === 'ejercicio' ? 'subtab--activo' : ''}"
              data-vista="ejercicio" role="tab">Por ejercicio</button>
    </div>
    <div id="vista"></div>`;

  raiz.querySelectorAll('[data-vista]').forEach((b) => {
    b.addEventListener('click', () => { S.vista = b.dataset.vista; S.expandido = null; pintar(); });
  });

  if (S.vista === 'dia') pintarPorDia();
  else pintarPorEjercicio();
}

// ------------------------------------------------------------
// POR DÍA · gráficos pequeños, uno por ejercicio
// ------------------------------------------------------------
function pintarPorDia() {
  const cont = raiz.querySelector('#vista');

  if (S.expandido) return pintarEnfocado(cont);

  if (!S.dias.length) {
    cont.innerHTML = `<div class="vacio"><p class="vacio-texto">
      Esta vista necesita una rutina vigente con días definidos.</p></div>`;
    return;
  }

  const dia = S.dias.find((d) => d.id === S.diaId) || S.dias[0];
  const deEsteDia = new Set(S.ejerciciosDeDia.get(dia.id) || []);

  // Solo la rutina vigente: el "Día 2" de una rutina y el de otra no
  // son lo mismo, así que esta vista no cruza rutinas a propósito.
  const delDia = S.filas.filter((f) =>
    deEsteDia.has(f.exercise_id) && f.routine_id === S.rutina?.id);

  const porEjercicio = new Map();
  for (const f of delDia) {
    if (!porEjercicio.has(f.exercise_id)) porEjercicio.set(f.exercise_id, { nombre: f.ejercicio, filas: [] });
    porEjercicio.get(f.exercise_id).filas.push(f);
  }

  cont.innerHTML = `
    <div class="filtros">
      <label class="campo-chico">
        <span class="campo-etiqueta">Día</span>
        <select id="sel-dia" class="entrada entrada--select">
          ${S.dias.map((d) => `<option value="${esc(d.id)}" ${d.id === dia.id ? 'selected' : ''}>Día ${d.orden} · ${esc(nombreCorto(d.nombre))}</option>`).join('')}
        </select>
      </label>
      ${selectorHorizonte()}
    </div>

    <h2 class="titulo-dia">${esc(dia.nombre)}</h2>
    <p class="nota-vista">
      Un gráfico por ejercicio. Cada uno tiene su propia escala —una sentadilla y
      una elevación lateral no comparten números— así que compara la forma de la
      curva, no la altura entre gráficos.
    </p>

    <div class="multiples">
      ${porEjercicio.size ? '' : '<p class="vacio-texto">Este día todavía no tiene registros.</p>'}
      ${[...porEjercicio].map(([id, e], i) => {
        const filas = recortar(e.filas);
        return `
        <figure class="multiple">
          <button class="multiple-abrir" type="button" data-abrir="${esc(id)}"
                  title="Ver el historial completo de ${esc(e.nombre)}">
            <span class="multiple-linea">
              <span class="multiple-titulo">${esc(e.nombre)}</span>
              ${textoSeries(filas) ? `<span class="multiple-series">– ${esc(textoSeries(filas))}</span>` : ''}
              <span class="multiple-lupa" aria-hidden="true">${LUPA}</span>
            </span>
            <span class="multiple-meta">${esc(textoUnidadReps(filas))}</span>
          </button>
          <div class="multiple-scroll">
            <div class="multiple-lienzo" style="min-width:${anchoNecesario(filas.length)}px">
              <canvas id="m-${i}"></canvas>
            </div>
          </div>
        </figure>`;
      }).join('')}
    </div>`;

  cont.querySelector('#sel-dia').addEventListener('change', (ev) => { S.diaId = ev.target.value; pintar(); });
  conectarHorizonte(cont);

  cont.querySelectorAll('[data-abrir]').forEach((b) => {
    b.addEventListener('click', () => { S.expandido = b.dataset.abrir; pintar(); });
  });

  [...porEjercicio].forEach(([id, e], i) => {
    dibujarMultiple(cont.querySelector(`#m-${i}`), recortar(e.filas));
  });
}

const LUPA = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
       stroke-linecap="round" width="17" height="17">
    <circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>
    <path d="M11 8v6M8 11h6"/>
  </svg>`;

/**
 * Un solo ejercicio, grande y con TODO su historial.
 *
 * El horizonte no se aplica acá a propósito: se entra a esta vista
 * justamente para ver lo que el recorte dejaba fuera. Si no cabe, el
 * gráfico se desliza.
 */
function pintarEnfocado(cont) {
  const filas = S.filas.filter((f) => f.exercise_id === S.expandido);
  const nombre = filas[0]?.ejercicio || 'Ejercicio';
  const dia = S.dias.find((d) => d.id === S.diaId);
  const pr = filas.reduce((a, f) => (Number(f.peso) > Number(a?.peso ?? -1) ? f : a), null);
  const unidad = filas.at(-1)?.unidad || 'kg';

  cont.innerHTML = `
    <button class="volver" type="button" id="volver">← Volver a ${esc(dia ? `Día ${dia.orden}` : 'el día')}</button>

    <h2 class="titulo-dia">
      ${esc(nombre)}${textoSeries(filas) ? ` <span class="titulo-series">– ${esc(textoSeries(filas))}</span>` : ''}
    </h2>
    <p class="nota-vista">${esc(textoUnidadReps(filas))} · historial completo · ${esc(filas.length)} registros</p>

    ${pr ? tarjetaPR(pr, unidad) : ''}

    <figure class="grafico-figura">
      <figcaption class="grafico-titulo">
        Carga levantada
        <span class="grafico-sub">${esc(unidad)}</span>
      </figcaption>
      <div class="multiple-scroll">
        <div class="grafico-lienzo" style="min-width:${anchoNecesario(filas.length)}px">
          <canvas id="g-enfocado"></canvas>
        </div>
      </div>
    </figure>`;

  cont.querySelector('#volver').addEventListener('click', () => { S.expandido = null; pintar(); });
  dibujarMultiple(cont.querySelector('#g-enfocado'), filas, 12);
}

/** Ancho mínimo para que las barras se lean. Si supera el de la
 *  tarjeta, el contenedor se desliza en vez de aplastarlas. */
function anchoNecesario(n) {
  return Math.max(0, n * 46);
}

/**
 * La prescripción de lo que se está viendo, partida en dos porque van a
 * dos sitios distintos: las SERIES al título, junto al nombre, porque
 * son lo que define la forma del ejercicio; la unidad y las
 * REPETICIONES al subtítulo, que es detalle de lectura del gráfico.
 *
 * Un coach con varios atletas no tiene por qué recordar de memoria a
 * cuánto trabaja cada uno: lo lee acá.
 *
 * Se muestran rangos cuando el valor cambia entre semanas, que es lo
 * normal en un ciclo con sobrecarga progresiva: las reps bajan de 12 a
 * 6 mientras el peso sube.
 */
function rango(valores) {
  const v = valores.filter((x) => x != null && x !== '').map(Number).filter(Number.isFinite);
  if (!v.length) return null;
  const min = Math.min(...v), max = Math.max(...v);
  return min === max ? String(min) : `${min}–${max}`;
}

/** "3 series" · "2–3 series" · null si no hay dato. */
function textoSeries(filas) {
  const s = rango(filas.map((f) => f.series));
  if (!s) return null;
  return s === '1' ? '1 serie' : `${s} series`;
}

/** "kg · 6–12 reps", o solo la unidad si no hay repeticiones. */
function textoUnidadReps(filas) {
  const unidad = filas.at(-1)?.unidad || 'kg';
  const r = rango(filas.map((f) => f.reps));
  return r ? `${unidad} · ${r} reps` : unidad;
}

function nombreCorto(nombre) {
  return String(nombre).replace(/^d[ií]a\s*\d+\s*[–-]\s*/i, '');
}

function dibujarMultiple(canvas, filas, tamEtiqueta = 10) {
  if (!canvas || !filas.length) return;
  const p = paleta();
  const orden = [...filas].sort((a, b) => (a.ciclo - b.ciclo) || (a.semana - b.semana));
  const etiquetas = orden.map((f) => `C${f.ciclo ?? '?'}·S${f.semana ?? '?'}`);

  S.graficos.push(new Chart(canvas, {
    type: 'bar',
    data: {
      labels: etiquetas,
      datasets: [{
        label: 'Peso',
        data: orden.map((f) => Number(f.peso)),
        backgroundColor: p.serie1,
        borderRadius: 4,
        borderSkipped: 'bottom',
        maxBarThickness: 30,
      }],
    },
    options: {
      ...opcionesBase(p, 'kg'),
      scales: {
        x: { grid: { display: false }, ticks: { color: p.debil, font: { size: 10 }, maxRotation: 0, autoSkip: false } },
        // Desde cero: en un gráfico de barras la LONGITUD es el dato, y
        // una base recortada exagera diferencias pequeñas hasta hacerlas
        // parecer saltos. (La vista de líneas sí puede recortar: ahí el
        // dato es la pendiente, no la altura de la barra.)
        y: { grid: { color: p.rejilla }, border: { display: false }, ticks: { color: p.debil, font: { size: 10 } }, beginAtZero: true },
      },
    },
    // Pocas barras: acá sí caben los números encima de todas.
    plugins: [pluginEtiquetas(new Set(orden.map((_, i) => i)), p, tamEtiqueta)],
  }));
}

// ------------------------------------------------------------
// POR EJERCICIO
// ------------------------------------------------------------
function pintarPorEjercicio() {
  const cont = raiz.querySelector('#vista');
  const grupos = ejerciciosAgrupados();
  const todos = S.filas.filter((f) => f.exercise_id === S.ejercicioId);
  const datos = recortar(todos);
  const pr = todos.reduce((a, f) => (Number(f.peso) > Number(a?.peso ?? -1) ? f : a), null);
  const unidad = todos.at(-1)?.unidad || 'kg';
  const p = paleta();

  cont.innerHTML = `
    <div class="filtros">
      <label class="campo-chico campo-chico--ancho">
        <span class="campo-etiqueta">Ejercicio</span>
        <select id="sel-ejercicio" class="entrada entrada--select">
          ${grupos.map((g) => `<optgroup label="${esc(g.titulo)}">
            ${g.ejercicios.map((e) => `<option value="${esc(e.id)}" ${e.id === S.ejercicioId ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}
          </optgroup>`).join('')}
        </select>
      </label>
      ${selectorHorizonte()}
    </div>

    ${pr ? tarjetaPR(pr, unidad) : ''}

    <figure class="grafico-figura">
      <figcaption class="grafico-titulo">
        Carga levantada
        <span class="grafico-sub">${esc(datos.length)} de ${esc(todos.length)} registros · ${esc(unidad)}</span>
      </figcaption>
      <div class="grafico-lienzo"><canvas id="g-ejercicio"></canvas></div>
      <div class="leyenda">
        <span class="leyenda-item"><i class="leyenda-marca" style="background:${p.serie1}"></i>Peso levantado</span>
        <span class="leyenda-item"><i class="leyenda-marca leyenda-marca--guion"></i>1RM estimado</span>
      </div>
    </figure>

    <div class="explicacion">
      <h3 class="explicacion-titulo">Qué es el 1RM estimado</h3>
      <p>
        Es cuánto podrías levantar <strong>una sola vez</strong> en ese ejercicio, calculado
        a partir del peso y las repeticiones que sí hiciste. La fórmula es la de Epley:
        <code>peso × (1 + reps ÷ 30)</code>.
      </p>
      <p>
        Sirve para comparar sesiones que no son comparables a simple vista.
        60 kg × 12 y 80 kg × 6 parecen dos cosas distintas; llevadas a 1RM son
        84 y 96, y ahí se ve que la segunda fue más fuerte.
      </p>
      <p class="explicacion-aviso">
        No es una proyección ni una meta: es una estimación de lo que ya podías
        hacer ese día. Pierde precisión por encima de unas 12 repeticiones, y
        <strong>nunca es una recomendación de cargar ese peso</strong> — un 1RM real
        se intenta con progresión y alguien mirando.
      </p>
    </div>

    <details class="tabla-datos">
      <summary>Ver los datos</summary>
      <div class="tabla-envoltura">
        <table class="tabla">
          <thead><tr><th>Fecha</th><th>Ciclo</th><th>Sem.</th><th>Peso</th><th>Series</th><th>Reps</th><th>1RM est.</th></tr></thead>
          <tbody>
            ${[...datos].reverse().map((f) => `<tr>
              <td>${esc(f.fecha)}</td><td>${esc(f.ciclo ?? '—')}</td><td>${esc(f.semana ?? '—')}</td>
              <td>${esc(fmtNum(f.peso))}</td><td>${esc(f.series ?? '—')}</td>
              <td>${esc(f.reps ?? '—')}</td><td>${esc(fmtNum(f.rm_estimado) || '—')}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </details>`;

  cont.querySelector('#sel-ejercicio').addEventListener('change', (ev) => {
    S.ejercicioId = ev.target.value;
    pintar();
  });
  conectarHorizonte(cont);

  dibujarLineaEjercicio(cont.querySelector('#g-ejercicio'), datos, unidad);
}

// Trofeo dibujado a mano en SVG y no un emoji: un emoji cambia de
// forma en cada sistema operativo y no obedece a los tokens de color.
// Este hereda currentColor y se ve igual en todas partes.
const TROFEO = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
       stroke-linecap="round" stroke-linejoin="round" width="28" height="28">
    <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/>
    <path d="M7 6H4.5a2.5 2.5 0 0 0 2.5 5"/>
    <path d="M17 6h2.5a2.5 2.5 0 0 1-2.5 5"/>
    <path d="M12 14v3"/>
    <path d="M9 20h6"/>
    <path d="M10 17h4l.6 3H9.4l.6-3Z"/>
  </svg>`;

/** Marca el récord y, si se puede armar con discos, cómo se carga la barra. */
function tarjetaPR(pr, unidad) {
  const peso = Number(pr.peso);
  const discos = repartirDiscos(peso);
  return `
    <div class="pr">
      <span class="pr-simbolo" aria-hidden="true">${TROFEO}</span>
      <div class="pr-numero">
        <span class="pr-valor">${esc(fmtNum(peso))}<small>${esc(unidad)}</small></span>
        <span class="pr-etiqueta">Máximo registrado · ${esc(fmtFechaLarga(pr.fecha))}</span>
      </div>
      ${discos ? `
        <div class="pr-barra" aria-hidden="true">
          <span class="barra-manga"></span>
          ${discos.map((d) => `<span class="disco" style="height:${40 + d * 3}%" title="${d} kg">${fmtNum(d)}</span>`).join('')}
          <span class="barra-eje"></span>
        </div>
        <p class="pr-nota">barra de 20 kg + estos discos por lado</p>`
      : ''}
    </div>`;
}

/**
 * Discos por lado para un peso dado, con barra olímpica de 20 kg.
 * Devuelve null si no calza exacto — no vale la pena dibujar una barra
 * que miente, y en máquinas el peso no se arma con discos.
 */
function repartirDiscos(total) {
  const DISCOS = [20, 15, 10, 5, 2.5, 1.25];
  let porLado = (total - 20) / 2;
  if (porLado <= 0) return null;
  const salida = [];
  for (const d of DISCOS) {
    while (porLado >= d - 1e-9) { salida.push(d); porLado = Math.round((porLado - d) * 100) / 100; }
  }
  return porLado === 0 ? salida : null;
}

function dibujarLineaEjercicio(canvas, datos, unidad) {
  if (!canvas || !datos.length) return;
  const p = paleta();

  // Dónde cambió la rutina: una línea vertical y nada más. Es contexto,
  // no un dato: si el peso bajó ahí, probablemente cambió el ejercicio
  // de sitio en el plan, no la persona de fuerza.
  const cortes = [];
  for (let i = 1; i < datos.length; i++) {
    if (datos[i].routine_id !== datos[i - 1].routine_id) {
      cortes.push({ i, nombre: datos[i].rutina || 'otra rutina' });
    }
  }

  // Se etiquetan solo el máximo y el último punto. Un número sobre cada
  // punto convierte el gráfico en una tabla ilegible.
  const iMax = datos.reduce((m, f, i) => (Number(f.peso) > Number(datos[m].peso) ? i : m), 0);
  const aEtiquetar = new Set([iMax, datos.length - 1]);

  S.graficos.push(new Chart(canvas, {
    type: 'line',
    data: {
      labels: datos.map((f) => f.fecha),
      datasets: [
        {
          label: `Peso (${unidad})`,
          data: datos.map((f) => Number(f.peso)),
          borderColor: p.serie1,
          backgroundColor: conAlfa(p.serie1, 0.14),   // el área de lo realmente levantado
          fill: 'origin',
          borderWidth: 2, pointRadius: 4, pointHoverRadius: 8, tension: 0.15,
        },
        {
          label: `1RM estimado (${unidad})`,
          data: datos.map((f) => (f.rm_estimado == null ? null : Number(f.rm_estimado))),
          borderColor: p.serie2, backgroundColor: p.serie2,
          borderWidth: 2, borderDash: [5, 4], pointRadius: 0, pointHoverRadius: 6,
          tension: 0.15, spanGaps: true, fill: false,
        },
      ],
    },
    options: opcionesBase(p, unidad),
    plugins: [pluginCortes(cortes, p), pluginEtiquetas(aEtiquetar, p)],
  }));
}

// ------------------------------------------------------------
// Opciones y complementos de Chart.js
// ------------------------------------------------------------
function opcionesBase(p, unidad) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    layout: { padding: { top: 22, right: 12 } },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },        // la leyenda se dibuja en HTML
      tooltip: {
        backgroundColor: token('--color-superficie-alta'),
        borderColor: token('--color-borde'),
        borderWidth: 1,
        titleColor: token('--color-texto'),
        bodyColor: token('--color-texto-tenue'),
        padding: 10,
        displayColors: true,
        callbacks: { label: (c) => `${c.dataset.label}: ${fmtNum(c.parsed.y)}` },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: p.debil, maxRotation: 0, autoSkipPadding: 24 } },
      y: {
        grid: { color: p.rejilla },
        border: { display: false },
        ticks: { color: p.debil, callback: (v) => `${fmtNum(v)}` },
        title: { display: true, text: unidad, color: p.debil },
      },
    },
  };
}

/** Línea vertical donde cambió la rutina. */
function pluginCortes(cortes, p) {
  return {
    id: 'cortes',
    afterDatasetsDraw(chart) {
      if (!cortes.length) return;
      const { ctx, chartArea, scales } = chart;
      ctx.save();
      for (const c of cortes) {
        const paso = scales.x.getPixelForValue(1) - scales.x.getPixelForValue(0);
        const x = scales.x.getPixelForValue(c.i) - paso / 2;
        ctx.beginPath();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = p.marca;
        ctx.lineWidth = 1;
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = p.debil;
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('cambio de rutina', x + 4, chartArea.top + 10);
      }
      ctx.restore();
    },
  };
}

/** Números sobre los puntos indicados. Solo los que valen la pena. */
function pluginEtiquetas(indices, p, tam = 11) {
  return {
    id: 'etiquetas',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      const meta = chart.getDatasetMeta(0);
      ctx.save();
      ctx.fillStyle = p.texto;
      ctx.font = `${tam}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      meta.data.forEach((punto, i) => {
        if (!indices.has(i)) return;
        const v = chart.data.datasets[0].data[i];
        if (v == null) return;
        ctx.fillText(fmtNum(v), punto.x, punto.y - 8);
      });
      ctx.restore();
    },
  };
}
