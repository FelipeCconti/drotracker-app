// ============================================================
// DRO.TRACKER · composición corporal
//
// El dato más sensible que guarda la app, y el que tiene las reglas
// más estrictas:
//
//   · Lo ESCRIBE siempre su dueño. Ni el coach ni el administrador,
//     tengan el permiso que tengan sobre el entrenamiento.
//   · Lo LEE su dueño y quien él haya autorizado, uno por uno, desde
//     el bloque "Quién puede ver esto" del final de esta pantalla.
//     El administrador no lo ve por ser administrador.
//
// Y una regla de producto que no es negociable: **la app muestra
// números y tendencia, nunca categorías ni juicios de salud.** El IMC
// se muestra como cifra y no se traduce a ninguna etiqueta. Interpretar
// estos datos es trabajo de un profesional, no de una pantalla.
//
// Todos los campos son opcionales salvo que haya al menos uno: una
// balanza que no mide grasa visceral deja esa columna nula y el gráfico
// omite esa serie, en vez de dibujar ceros que parecerían un desplome.
// ============================================================

import {
  perfilCompleto, guardarAltura, mediciones, crearMedicion, actualizarMedicion,
  borrarMedicion, misCoachesYAcceso, concederComposicion, revocarComposicion,
} from './db.js';

import { esc, fmtNum, aNumero, mensajeDeError, avisar } from './ui.js';
import { sesion, esPropio as sujetoEsMio, permiso, sinPermisoHTML, refrescarAtletas } from './sesion.js';

const Chart = window.Chart;

// Los campos, en el orden en que se toman de una balanza.
const CAMPOS = [
  { id: 'peso_kg',          etiqueta: 'Peso',           unidad: 'kg' },
  { id: 'grasa_pct',        etiqueta: 'Grasa',          unidad: '%'  },
  { id: 'agua_pct',         etiqueta: 'Agua',           unidad: '%'  },
  { id: 'masa_muscular_kg', etiqueta: 'Masa muscular',  unidad: 'kg' },
  { id: 'masa_osea_kg',     etiqueta: 'Masa ósea',      unidad: 'kg' },
  { id: 'grasa_visceral',   etiqueta: 'Grasa visceral', unidad: ''   },
  { id: 'cintura_cm',       etiqueta: 'Cintura',        unidad: 'cm' },
];

// Dos series por gráfico como máximo, y siempre de la misma unidad:
// nunca dos ejes verticales. Kilos con kilos, por cientos con por
// cientos. Mezclarlos haría que dos curvas parecieran cruzarse cuando
// no tienen nada que ver una con otra.
const GRAFICOS = [
  { titulo: 'Peso y masa muscular', unidad: 'kg', campos: ['peso_kg', 'masa_muscular_kg'] },
  { titulo: 'Grasa y agua',         unidad: '%',  campos: ['grasa_pct', 'agua_pct'] },
  { titulo: 'Cintura',              unidad: 'cm', campos: ['cintura_cm'] },
];

const S = {
  yo: null,
  perfil: null,        // perfil completo, con altura
  viendo: null,        // de quién es la composición en pantalla
  compartidas: [],     // atletas que me compartieron la suya
  filas: [],
  coaches: [],
  editando: null,      // id de la medición en edición, o null
  graficos: [],
};

let raiz = null;
const esPropia = () => sujetoEsMio();

function token(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }

// ============================================================
// Entrada
// ============================================================
export async function montarComposicion(contenedor) {
  raiz = contenedor;
  S.yo = sesion.yo;
  S.viendo = sesion.sujeto;   // quién es se elige en la cabecera

  if (!permiso('composicion')) { raiz.innerHTML = sinPermisoHTML('composicion'); return; }

  raiz.innerHTML = `<div class="cargando">Cargando…</div>`;
  try {
    await cargar();
  } catch (e) {
    raiz.innerHTML = `<div class="vacio">
      <h2 class="vacio-titulo">No se pudo cargar la composición</h2>
      <p class="vacio-texto">${esc(mensajeDeError(e))}</p></div>`;
  }
}

async function cargar() {
  const [perfil, filas] = await Promise.all([
    esPropia() ? perfilCompleto(S.yo.id) : Promise.resolve(null),
    mediciones(S.viendo.id),
  ]);
  if (perfil) S.perfil = perfil;
  S.filas = filas;
  S.coaches = esPropia() ? await misCoachesYAcceso(S.yo.id).catch(() => []) : [];
  pintar();
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
  const ultima = S.filas.at(-1);

  raiz.innerHTML = `
    ${esPropia() ? bloqueAlturaHTML() : ''}
    ${esPropia() ? formularioHTML() : `<p class="nota-vista">
        Estás viendo la composición de ${esc(S.viendo.nombre || S.viendo.email)}, que te dio acceso.
        Solo ella o él puede registrar y corregir estos datos.</p>`}
    ${ultima ? resumenHTML(ultima) : ''}
    ${S.filas.length ? graficosHTML() : (esPropia() ? `<div class="vacio">
        <h2 class="vacio-titulo">Todavía no hay mediciones</h2>
        <p class="vacio-texto">Registra la primera arriba y los gráficos aparecen solos.</p>
      </div>` : `<div class="vacio"><p class="vacio-texto">Esta persona aún no registra mediciones.</p></div>`)}
    ${S.filas.length ? historialHTML() : ''}
    ${esPropia() ? compartirHTML() : ''}`;

  conectar();
  if (S.filas.length) dibujarTodos();
}

/** El IMC necesita la altura, y la altura vive en el perfil. */
function bloqueAlturaHTML() {
  if (S.perfil?.altura_cm) return '';
  return `
    <div class="explicacion">
      <h3 class="explicacion-titulo">Falta tu altura</h3>
      <p>Sin ella no se puede calcular el IMC. Se guarda una vez en tu perfil, no en cada medición.</p>
      <div class="fila-altura">
        <label class="campo-chico">
          <span class="campo-etiqueta">Altura (cm)</span>
          <input type="text" inputmode="decimal" id="altura" class="entrada entrada--num" placeholder="175">
        </label>
        <button class="boton" id="guardar-altura" type="button">Guardar</button>
      </div>
    </div>`;
}

function formularioHTML() {
  const ed = S.editando ? S.filas.find((f) => f.id === S.editando) : null;
  const valor = (c) => (ed ? fmtNum(ed[c.id]) : '');

  return `
    <form class="medicion-form" id="form-medicion">
      <div class="medicion-cabecera">
        <h2 class="medicion-titulo">${ed ? 'Corregir medición' : 'Nueva medición'}</h2>
        ${ed ? '<button type="button" class="volver" id="cancelar">Cancelar</button>' : ''}
      </div>

      <div class="medicion-campos">
        <label class="campo-chico">
          <span class="campo-etiqueta">Cuándo</span>
          <input type="datetime-local" id="medido_en" class="entrada entrada--fecha"
                 value="${esc(ed ? aLocal(ed.medido_en) : aLocal(new Date().toISOString()))}">
        </label>
        ${CAMPOS.map((c) => `
          <label class="campo-chico">
            <span class="campo-etiqueta">${esc(c.etiqueta)}${c.unidad ? ` (${esc(c.unidad)})` : ''}</span>
            <input type="text" inputmode="decimal" data-campo="${c.id}"
                   class="entrada entrada--num" value="${esc(valor(c))}" placeholder="—">
          </label>`).join('')}
      </div>

      <label class="campo campo--nota">
        <span class="campo-etiqueta">Nota (opcional)</span>
        <input type="text" id="nota" class="entrada entrada--texto"
               value="${esc(ed?.nota || '')}" placeholder="en ayunas, después de entrenar…">
      </label>

      <div class="medicion-pie">
        <button class="boton" type="submit">${ed ? 'Guardar cambios' : 'Registrar'}</button>
        <p class="pie-nota">
          Completa solo lo que midas. La hora se guarda porque 77,4 kg en ayunas
          y 77,4 kg después de almorzar no significan lo mismo.
        </p>
      </div>
    </form>`;
}

function resumenHTML(u) {
  const flecha = (d) => (d == null ? '' : (d > 0 ? '▲' : d < 0 ? '▼' : '='));
  const clase  = (d) => (d == null ? '' : (d > 0 ? 'delta--sube' : d < 0 ? 'delta--baja' : ''));

  const tarjeta = (etiqueta, valor, unidad, delta) => (valor == null ? '' : `
    <div class="metrica">
      <span class="metrica-etiqueta">${esc(etiqueta)}</span>
      <span class="metrica-valor">${esc(fmtNum(valor))}<small>${esc(unidad)}</small></span>
      ${delta != null && delta !== 0 ? `<span class="metrica-delta ${clase(delta)}">
        ${flecha(delta)} ${esc(fmtNum(Math.abs(delta)))} ${esc(unidad)} vs. la anterior</span>` : ''}
    </div>`);

  return `
    <div class="metricas">
      ${tarjeta('Peso', u.peso_kg, 'kg', u.delta_peso)}
      ${tarjeta('Grasa', u.grasa_pct, '%', u.delta_grasa)}
      ${tarjeta('Masa muscular', u.masa_muscular_kg, 'kg', null)}
      ${u.imc != null ? `
        <div class="metrica">
          <span class="metrica-etiqueta">IMC</span>
          <span class="metrica-valor">${esc(fmtNum(u.imc))}</span>
          <span class="metrica-delta">con ${esc(fmtNum(u.altura_cm))} cm</span>
        </div>` : ''}
    </div>
    <p class="nota-vista nota-imc">
      Son cifras y su variación, no un diagnóstico. El IMC en particular no distingue
      músculo de grasa, así que puede subir justamente cuando las cosas van bien.
      Quien interpreta esto es un profesional de la salud.
    </p>`;
}

function graficosHTML() {
  return `
    <div class="graficos-composicion">
      ${GRAFICOS.map((g, i) => {
        const conDatos = g.campos.filter((c) => S.filas.some((f) => f[c] != null));
        if (!conDatos.length) return '';   // sin datos no se dibuja un gráfico vacío
        return `
          <figure class="grafico-figura">
            <figcaption class="grafico-titulo">
              ${esc(g.titulo)}<span class="grafico-sub">${esc(g.unidad)}</span>
            </figcaption>
            <div class="grafico-lienzo grafico-lienzo--medio"><canvas id="c-${i}"></canvas></div>
            ${conDatos.length > 1 ? `<div class="leyenda">
              ${conDatos.map((c, j) => `<span class="leyenda-item">
                <i class="leyenda-marca" style="background:${token(j === 0 ? '--grafico-serie-1' : '--grafico-serie-2')}"></i>
                ${esc(CAMPOS.find((x) => x.id === c).etiqueta)}</span>`).join('')}
            </div>` : ''}
          </figure>`;
      }).join('')}
    </div>`;
}

function historialHTML() {
  return `
    <details class="tabla-datos" ${S.filas.length <= 6 ? 'open' : ''}>
      <summary>Historial · ${esc(S.filas.length)} mediciones</summary>
      <div class="tabla-envoltura">
        <table class="tabla">
          <thead><tr>
            <th>Cuándo</th>
            ${CAMPOS.map((c) => `<th>${esc(c.etiqueta)}</th>`).join('')}
            <th>Nota</th>${esPropia() ? '<th></th>' : ''}
          </tr></thead>
          <tbody>
            ${[...S.filas].reverse().map((f) => `<tr>
              <td>${esc(fmtCuando(f.medido_en))}${f.actualizado_en ? ' <span class="editado">editada</span>' : ''}</td>
              ${CAMPOS.map((c) => `<td>${esc(fmtNum(f[c.id]) || '—')}</td>`).join('')}
              <td class="celda-nota">${esc(f.nota || '')}</td>
              ${esPropia() ? `<td class="celda-acciones">
                <button type="button" class="enlace" data-editar="${esc(f.id)}">editar</button>
                <button type="button" class="enlace enlace--riesgo" data-borrar="${esc(f.id)}">borrar</button>
              </td>` : ''}
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </details>`;
}

function compartirHTML() {
  if (!S.coaches.length) {
    return `<div class="explicacion">
      <h3 class="explicacion-titulo">Quién puede ver esto</h3>
      <p>Nadie más que tú. Ni tu administrador.</p>
      <p class="explicacion-aviso">Cuando tengas un coach asignado aparecerá acá,
        con un interruptor para darle acceso si quieres. Mientras no lo enciendas,
        no ve nada de esta pantalla.</p>
    </div>`;
  }
  return `
    <div class="explicacion">
      <h3 class="explicacion-titulo">Quién puede ver esto</h3>
      <p>Tú decides, coach por coach. Se puede revocar en cualquier momento y el
         acceso se corta al instante.</p>
      <ul class="lista-permisos">
        ${S.coaches.map((c) => `
          <li class="permiso">
            <span class="permiso-nombre">${esc(c.nombre || c.email)}</span>
            <label class="interruptor">
              <input type="checkbox" data-coach="${esc(c.id)}" ${c.tieneAcceso ? 'checked' : ''}>
              <span>${c.tieneAcceso ? 'puede verla' : 'no la ve'}</span>
            </label>
          </li>`).join('')}
      </ul>
    </div>`;
}

// ------------------------------------------------------------
// Conexiones
// ------------------------------------------------------------
function conectar() {
  const q = (sel) => raiz.querySelector(sel);

  q('#guardar-altura')?.addEventListener('click', async () => {
    const cm = aNumero(q('#altura').value);
    if (!cm || cm < 100 || cm > 250) return avisar('Una altura en centímetros, entre 100 y 250.', 'error');
    try {
      await guardarAltura(S.yo.id, cm);
      await cargar();
      avisar('Altura guardada.');
    } catch (e) { avisar(mensajeDeError(e), 'error'); }
  });

  q('#cancelar')?.addEventListener('click', () => { S.editando = null; pintar(); });
  q('#form-medicion')?.addEventListener('submit', enviarMedicion);

  raiz.querySelectorAll('[data-editar]').forEach((b) => b.addEventListener('click', () => {
    S.editando = b.dataset.editar;
    pintar();
    raiz.querySelector('#form-medicion')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));

  raiz.querySelectorAll('[data-borrar]').forEach((b) => b.addEventListener('click', async () => {
    const f = S.filas.find((x) => x.id === b.dataset.borrar);
    if (!confirm(`¿Borrar la medición del ${fmtCuando(f.medido_en)}? No se puede deshacer.`)) return;
    try {
      await borrarMedicion(b.dataset.borrar);
      if (S.editando === b.dataset.borrar) S.editando = null;
      await cargar();
      avisar('Medición borrada.');
    } catch (e) { avisar(mensajeDeError(e), 'error'); }
  }));

  raiz.querySelectorAll('[data-coach]').forEach((chk) => chk.addEventListener('change', async () => {
    const coachId = chk.dataset.coach;
    try {
      if (chk.checked) await concederComposicion(S.yo.id, coachId);
      else await revocarComposicion(S.yo.id, coachId);
      S.coaches = await misCoachesYAcceso(S.yo.id);
      await refrescarAtletas();   // el cambio se nota al instante en la cabecera
      pintar();
      avisar(chk.checked ? 'Acceso concedido.' : 'Acceso revocado.');
    } catch (e) {
      chk.checked = !chk.checked;      // el interruptor no miente sobre el estado real
      avisar(mensajeDeError(e), 'error');
    }
  }));
}

async function enviarMedicion(ev) {
  ev.preventDefault();
  const form = ev.currentTarget;

  const campos = {};
  form.querySelectorAll('[data-campo]').forEach((i) => { campos[i.dataset.campo] = aNumero(i.value); });

  if (!Object.values(campos).some((v) => v != null)) {
    return avisar('Completa al menos un dato: una medición vacía no es una medición.', 'error');
  }

  const cuando = form.querySelector('#medido_en').value;
  campos.medido_en = cuando ? new Date(cuando).toISOString() : new Date().toISOString();
  campos.nota = form.querySelector('#nota').value.trim() || null;

  try {
    if (S.editando) {
      await actualizarMedicion(S.editando, campos);
      S.editando = null;
      avisar('Medición corregida.');
    } else {
      // Más de una medición el mismo día está permitida por diseño, pero
      // casi siempre es una corrección y no un dato nuevo. Preguntar es
      // más barato que dejar dos pesos contradictorios del mismo día.
      const mismoDia = S.filas.find((f) => f.medido_en.slice(0, 10) === campos.medido_en.slice(0, 10));
      if (mismoDia) {
        const reemplazar = confirm(
          `Ya hay una medición del ${fmtCuando(mismoDia.medido_en)}.\n\n` +
          `Aceptar: la reemplaza.\nCancelar: agrega otra y quedan las dos.`);
        if (reemplazar) {
          await actualizarMedicion(mismoDia.id, campos);
          await cargar();
          return avisar('Medición del día reemplazada.');
        }
      }
      await crearMedicion(S.yo.id, campos);
      avisar('Medición registrada.');
    }
    await cargar();
  } catch (e) {
    avisar(mensajeDeError(e), 'error');
  }
}

// ------------------------------------------------------------
// Gráficos
// ------------------------------------------------------------
function dibujarTodos() {
  GRAFICOS.forEach((g, i) => {
    const canvas = raiz.querySelector(`#c-${i}`);
    if (!canvas) return;
    const conDatos = g.campos.filter((c) => S.filas.some((f) => f[c] != null));
    dibujarSeries(canvas, conDatos, g.unidad);
  });
}

function dibujarSeries(canvas, campos, unidad) {
  const colores = [token('--grafico-serie-1'), token('--grafico-serie-2')];
  const rejilla = token('--grafico-rejilla');
  const debil   = token('--color-texto-debil');

  S.graficos.push(new Chart(canvas, {
    type: 'line',
    data: {
      labels: S.filas.map((f) => f.medido_en.slice(0, 10)),
      datasets: campos.map((c, j) => ({
        label: CAMPOS.find((x) => x.id === c).etiqueta,
        // spanGaps une los puntos a ambos lados de un hueco: una balanza
        // que no midió ese día no debe abrir un agujero en la curva.
        data: S.filas.map((f) => (f[c] == null ? null : Number(f[c]))),
        borderColor: colores[j], backgroundColor: colores[j],
        borderWidth: 2, borderDash: j === 1 ? [5, 4] : [],
        pointRadius: 3, pointHoverRadius: 7, tension: 0.2, spanGaps: true,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: token('--color-superficie-alta'),
          borderColor: token('--color-borde'), borderWidth: 1,
          titleColor: token('--color-texto'), bodyColor: token('--color-texto-tenue'),
          padding: 10,
          callbacks: { label: (c) => `${c.dataset.label}: ${fmtNum(c.parsed.y)} ${unidad}` },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: debil, maxRotation: 0, autoSkipPadding: 24 } },
        // Eje libre, no desde cero: acá el dato es el MOVIMIENTO. Nadie
        // baja de 80 a 0 kg, y forzar el cero aplastaría contra el borde
        // superior justo los dos kilos que interesa ver.
        y: { grid: { color: rejilla }, border: { display: false },
             ticks: { color: debil }, title: { display: true, text: unidad, color: debil } },
      },
    },
  }));
}

// ------------------------------------------------------------
// Fechas
// ------------------------------------------------------------

/** ISO → el formato que quiere <input type="datetime-local">, en hora local. */
function aLocal(iso) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d - off).toISOString().slice(0, 16);
}

function fmtCuando(iso) {
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
