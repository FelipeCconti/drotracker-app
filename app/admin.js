// ============================================================
// DRO.TRACKER · administración
//
// Solo para el rol `admin`. Es la pantalla con más poder de la app y
// la que más cuidado pide, así que conviene tener presente qué hace y
// qué NO hace.
//
// HACE: aprobar y bloquear cuentas, cambiar roles, gestionar la lista
// de invitados, y decidir qué atletas ve cada coach.
//
// NO HACE, a propósito y no por olvido:
//
//   · Escribir el entrenamiento de nadie. Para eso el administrador
//     tendría que asignarse como coach Y que el atleta se lo permita.
//     Un admin que puede editar cualquier historial es un admin en
//     quien nadie confía del todo.
//   · Ver la composición corporal. Esa puerta la abre solo su dueño;
//     el rol no entra en esa pregunta.
//   · Borrar cuentas. Borrar arrastra por cascada todo el historial de
//     esa persona y no se deshace. Bloquear cubre el caso real y
//     conserva los datos. Si de verdad hay que borrar, sigue siendo un
//     trámite incómodo en el SQL Editor — la incomodidad ahí es la
//     función, no un defecto.
//
// Ninguna de estas acciones abre permisos nuevos: son las mismas
// políticas de sql/02 y sql/08 que ya cubrían las 51 pruebas. Lo único
// que cambia es que ahora hay botones.
//
// Y una red que ya estaba en la base: el trigger `tr_rol_y_estado`
// impide quitarle el rol al único administrador. No puedes dejarte
// fuera por accidente.
// ============================================================

import {
  todosLosPerfiles, cambiarRol, cambiarEstado,
  listaInvitaciones, agregarInvitacion, quitarInvitacion,
  todosLosVinculos, asignarAtleta, desasignarAtleta,
} from './db.js';

import { esc, avisar, mensajeDeError, fmtFechaLarga, retrasar } from './ui.js';
import { sesion, refrescarAtletas } from './sesion.js';

const ROLES = [
  { valor: 'atleta', texto: 'Atleta' },
  { valor: 'coach',  texto: 'Coach' },
  { valor: 'admin',  texto: 'Administrador' },
];

const ESTADOS = [
  { valor: 'pendiente', texto: 'Pendiente' },
  { valor: 'activo',    texto: 'Activo' },
  { valor: 'bloqueado', texto: 'Bloqueado' },
];

const S = {
  yo: null,
  perfiles: [],
  invitaciones: [],
  vinculos: [],
  busqueda: '',
  coachId: '',     // coach elegido en el bloque de asignación
};

let raiz = null;

// ============================================================
// Entrada
// ============================================================
export async function montarAdmin(contenedor, perfil) {
  raiz = contenedor;
  S.yo = perfil;

  if (perfil.rol !== 'admin') {
    raiz.innerHTML = `<div class="vacio">
      <h2 class="vacio-titulo">Esta pantalla es solo para el administrador</h2>
      <p class="vacio-texto">Si crees que deberías tener acceso, pídeselo a quien administra la app.</p>
    </div>`;
    return;
  }

  raiz.innerHTML = `<div class="cargando">Cargando…</div>`;
  try {
    await cargar();
  } catch (e) {
    raiz.innerHTML = `<div class="vacio">
      <h2 class="vacio-titulo">No se pudo cargar la administración</h2>
      <p class="vacio-texto">${esc(mensajeDeError(e))}</p></div>`;
  }
}

async function cargar() {
  const [perfiles, invitaciones, vinculos] = await Promise.all([
    todosLosPerfiles(), listaInvitaciones(), todosLosVinculos(),
  ]);
  S.perfiles = perfiles;
  S.invitaciones = invitaciones;
  S.vinculos = vinculos;
  pintar();
}

// ------------------------------------------------------------
// Datos derivados
// ------------------------------------------------------------
const nombreDe = (p) => p.nombre || p.email || '—';
const coaches  = () => S.perfiles.filter((p) => p.rol === 'coach' || p.rol === 'admin');
const cuantosAdmins = () => S.perfiles.filter((p) => p.rol === 'admin').length;

function perfilesFiltrados() {
  const q = S.busqueda.trim().toLowerCase();
  if (!q) return S.perfiles;
  return S.perfiles.filter((p) =>
    (p.nombre || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q));
}

// ============================================================
// Pintado
// ============================================================
function pintar() {
  const pendientes = S.perfiles.filter((p) => p.estado === 'pendiente');

  raiz.innerHTML = `
    <h1 class="guia-titulo">Administración</h1>

    ${pendientes.length ? `
      <div class="explicacion">
        <h3 class="explicacion-titulo">
          ${pendientes.length === 1 ? 'Hay una cuenta esperando aprobación' : `Hay ${pendientes.length} cuentas esperando aprobación`}
        </h3>
        <p>
          ${pendientes.map((p) => esc(nombreDe(p))).join(', ')}.
          Entraron con un correo que no estaba en la lista de invitados, así que no ven
          nada hasta que las actives abajo.
        </p>
      </div>` : ''}

    ${bloquePersonasHTML()}
    ${bloqueInvitacionesHTML()}
    ${bloqueCoachesHTML()}

    <p class="pie-nota">
      Desde acá no se escriben datos de entrenamiento ajenos, no se ve la composición
      corporal de nadie, y no se borran cuentas. Bloquear retira el acceso y conserva
      el historial.
    </p>`;

  conectar();
}

function bloquePersonasHTML() {
  const filtrados = perfilesFiltrados();
  return `
    <section class="admin-bloque">
      <div class="admin-cabecera">
        <h2 class="admin-titulo">Personas <span class="admin-cuenta">${S.perfiles.length}</span></h2>
        <label class="campo-chico">
          <span class="campo-etiqueta">Buscar</span>
          <input type="search" id="buscar" class="entrada entrada--texto"
                 value="${esc(S.busqueda)}" placeholder="nombre o correo">
        </label>
      </div>

      ${filtrados.length ? `
        <ul class="lista-personas">
          ${filtrados.map(personaHTML).join('')}
        </ul>` : `<p class="vacio-texto">Nadie calza con esa búsqueda.</p>`}
    </section>`;
}

function personaHTML(p) {
  const soyYo = p.id === S.yo.id;
  const comoAtleta = S.vinculos.filter((v) => v.atleta_id === p.id).length;
  const comoCoach  = S.vinculos.filter((v) => v.coach_id === p.id).length;

  return `
    <li class="persona persona--${esc(p.estado)}" data-persona="${esc(p.id)}">
      <div class="persona-quien">
        <span class="persona-nombre">
          ${esc(nombreDe(p))}${soyYo ? '<span class="persona-yo">tú</span>' : ''}
        </span>
        <span class="persona-correo">${esc(p.email || '')}</span>
        <span class="persona-meta">
          entró el ${esc(fmtFechaLarga(String(p.creado).slice(0, 10)))}
          ${comoCoach ? ` · coach de ${comoCoach}` : ''}
          ${comoAtleta ? ` · ${comoAtleta} coach${comoAtleta > 1 ? 'es' : ''} asignado${comoAtleta > 1 ? 's' : ''}` : ''}
        </span>
      </div>

      <div class="persona-controles">
        <label class="campo-chico">
          <span class="campo-etiqueta">Rol</span>
          <select class="entrada entrada--select" data-rol="${esc(p.id)}">
            ${ROLES.map((r) => `<option value="${r.valor}" ${r.valor === p.rol ? 'selected' : ''}>${r.texto}</option>`).join('')}
          </select>
        </label>
        <label class="campo-chico">
          <span class="campo-etiqueta">Estado</span>
          <select class="entrada entrada--select entrada--estado" data-estado="${esc(p.id)}">
            ${ESTADOS.map((e) => `<option value="${e.valor}" ${e.valor === p.estado ? 'selected' : ''}>${e.texto}</option>`).join('')}
          </select>
        </label>
      </div>
    </li>`;
}

function bloqueInvitacionesHTML() {
  const correos = new Set(S.perfiles.map((p) => (p.email || '').toLowerCase()));
  return `
    <section class="admin-bloque">
      <h2 class="admin-titulo">Invitaciones <span class="admin-cuenta">${S.invitaciones.length}</span></h2>
      <p class="nota-vista">
        Quien entre con un correo de esta lista nace <strong>activo</strong> y no nota
        nada. Quien no esté queda pendiente y aparece arriba para que lo apruebes.
      </p>

      <form class="agregar-fila" id="form-invitar">
        <label class="campo campo--ancho">
          <span class="campo-etiqueta">Correo</span>
          <input type="email" id="nuevo-correo" class="entrada entrada--texto"
                 placeholder="persona@gmail.com" required>
        </label>
        <button class="boton" type="submit">Invitar</button>
      </form>

      ${S.invitaciones.length ? `
        <ul class="lista-invitaciones">
          ${S.invitaciones.map((i) => {
            const entro = correos.has(i.email.toLowerCase());
            return `
              <li class="invitacion">
                <span class="invitacion-correo">${esc(i.email)}</span>
                <span class="invitacion-estado ${entro ? 'invitacion-estado--entro' : ''}">
                  ${entro ? 'ya entró' : 'todavía no entra'}
                </span>
                <button type="button" class="enlace enlace--riesgo"
                        data-quitar-inv="${esc(i.email)}">quitar</button>
              </li>`;
          }).join('')}
        </ul>` : `<p class="vacio-texto">Todavía no hay invitaciones cargadas.</p>`}
    </section>`;
}

function bloqueCoachesHTML() {
  const lista = coaches();
  if (!lista.length) {
    return `
      <section class="admin-bloque">
        <h2 class="admin-titulo">Coaches y sus atletas</h2>
        <p class="vacio-texto">
          Todavía no hay nadie con rol de coach. Cambia el rol de alguien arriba y
          aparecerá acá para asignarle atletas.
        </p>
      </section>`;
  }

  const coach = lista.find((c) => c.id === S.coachId) || null;
  const asignados = coach
    ? new Set(S.vinculos.filter((v) => v.coach_id === coach.id).map((v) => v.atleta_id))
    : new Set();

  return `
    <section class="admin-bloque">
      <h2 class="admin-titulo">Coaches y sus atletas</h2>
      <p class="nota-vista">
        Asignar a alguien deja que su coach <strong>vea</strong> su entrenamiento y le
        arme la rutina. Escribirle los entrenamientos es otro permiso, y lo enciende el
        atleta desde su propia sesión.
      </p>

      <label class="campo-chico campo-chico--ancho">
        <span class="campo-etiqueta">Coach</span>
        <select id="sel-coach" class="entrada entrada--select">
          <option value="">— elegir —</option>
          ${lista.map((c) => `<option value="${esc(c.id)}" ${c.id === S.coachId ? 'selected' : ''}>
            ${esc(nombreDe(c))}</option>`).join('')}
        </select>
      </label>

      ${coach ? `
        <ul class="lista-permisos lista-asignacion">
          ${S.perfiles.filter((p) => p.id !== coach.id).map((p) => `
            <li class="permiso">
              <span class="permiso-nombre">
                ${esc(nombreDe(p))}
                ${p.estado !== 'activo' ? `<span class="persona-yo">${esc(p.estado)}</span>` : ''}
              </span>
              <label class="interruptor">
                <input type="checkbox" data-asignar="${esc(p.id)}" ${asignados.has(p.id) ? 'checked' : ''}>
                <span>${asignados.has(p.id) ? 'asignado' : 'sin asignar'}</span>
              </label>
            </li>`).join('')}
        </ul>` : ''}
    </section>`;
}

// ============================================================
// Conexiones
// ============================================================
function conectar() {
  const q = (s) => raiz.querySelector(s);

  // El buscador no recarga nada: filtra lo que ya está en memoria.
  const buscar = retrasar((v) => {
    S.busqueda = v;
    const cont = raiz.querySelector('.lista-personas')?.parentElement;
    if (!cont) return pintar();
    pintar();
    const campo = raiz.querySelector('#buscar');
    campo?.focus();
    campo?.setSelectionRange(campo.value.length, campo.value.length);
  }, 250);
  q('#buscar')?.addEventListener('input', (ev) => buscar(ev.target.value));

  raiz.querySelectorAll('[data-rol]').forEach((sel) => {
    const anterior = sel.value;
    sel.addEventListener('change', async () => {
      const id = sel.dataset.rol;
      const p = S.perfiles.find((x) => x.id === id);
      const nuevo = sel.value;

      const aviso = nuevo === 'admin'
        ? `${nombreDe(p)} va a poder aprobar cuentas, cambiar roles y asignar coaches.`
        : (p.rol === 'admin' && cuantosAdmins() <= 1
            ? 'Es el único administrador. La base va a rechazar el cambio.'
            : `${nombreDe(p)} pasa a ser ${ROLES.find((r) => r.valor === nuevo).texto.toLowerCase()}.`);

      if (!confirm(`${aviso}\n\n¿Confirmas?`)) { sel.value = anterior; return; }

      try {
        await cambiarRol(id, nuevo);
        p.rol = nuevo;
        await refrescarAtletas();
        pintar();
        avisar('Rol actualizado.');
      } catch (e) {
        sel.value = anterior;
        avisar(mensajeDeError(e), 'error');
      }
    });
  });

  raiz.querySelectorAll('[data-estado]').forEach((sel) => {
    const anterior = sel.value;
    sel.addEventListener('change', async () => {
      const id = sel.dataset.estado;
      const p = S.perfiles.find((x) => x.id === id);
      const nuevo = sel.value;

      if (nuevo === 'bloqueado' &&
          !confirm(`${nombreDe(p)} deja de ver y escribir al instante.\n\n` +
                   'Su historial se conserva entero y puedes reactivarlo cuando quieras.\n\n¿Confirmas?')) {
        sel.value = anterior; return;
      }

      try {
        await cambiarEstado(id, nuevo);
        p.estado = nuevo;
        pintar();
        avisar(nuevo === 'activo' ? 'Cuenta activada.' : 'Estado actualizado.');
      } catch (e) {
        sel.value = anterior;
        avisar(mensajeDeError(e), 'error');
      }
    });
  });

  q('#form-invitar')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const correo = q('#nuevo-correo').value.trim();
    if (!correo) return;
    try {
      await agregarInvitacion(correo, S.yo.id);
      await cargar();
      avisar('Invitación cargada. Ya puede entrar.');
    } catch (e) { avisar(mensajeDeError(e), 'error'); }
  });

  raiz.querySelectorAll('[data-quitar-inv]').forEach((b) => b.addEventListener('click', async () => {
    const email = b.dataset.quitarInv;
    if (!confirm(`¿Quitar a ${email} de la lista de invitados?\n\n` +
                 'Si ya entró, no le pasa nada: sigue con su cuenta y su historial. ' +
                 'Solo deja de estar en la lista.')) return;
    try {
      await quitarInvitacion(email);
      await cargar();
      avisar('Invitación quitada.');
    } catch (e) { avisar(mensajeDeError(e), 'error'); }
  }));

  q('#sel-coach')?.addEventListener('change', (ev) => { S.coachId = ev.target.value; pintar(); });

  raiz.querySelectorAll('[data-asignar]').forEach((chk) => chk.addEventListener('change', async () => {
    const atletaId = chk.dataset.asignar;
    try {
      if (chk.checked) await asignarAtleta(S.coachId, atletaId, S.yo.id);
      else await desasignarAtleta(S.coachId, atletaId);
      S.vinculos = await todosLosVinculos();
      await refrescarAtletas();
      pintar();
      avisar(chk.checked ? 'Atleta asignado.' : 'Asignación retirada.');
    } catch (e) {
      chk.checked = !chk.checked;   // el interruptor no miente sobre el estado real
      avisar(mensajeDeError(e), 'error');
    }
  }));
}
