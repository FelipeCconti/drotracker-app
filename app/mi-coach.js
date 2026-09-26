// ============================================================
// DRO.TRACKER · Mi coach
//
// Una sola pantalla para la pregunta "¿qué puede hacer mi coach
// conmigo?", con los tres interruptores juntos.
//
// Estaban repartidos: el de la composición al final de Composición, y
// los dos del entrenamiento en ningún lado —solo por SQL—. El resultado
// era que nadie encontraba el que necesitaba. Un permiso que no se
// encuentra es un permiso que no existe, y peor: hace creer que la app
// decide sola quién ve qué.
//
// Tres cosas que esta pantalla NO hace, y no son olvidos:
//
//   · No asigna ni quita coaches. Eso lo hace el administrador. Acá se
//     decide qué puede hacer quien ya está asignado.
//   · No enciende nada por ti. Todo nace apagado; un coach asignado
//     solo MIRA hasta que su atleta decide otra cosa.
//   · No la ve nadie más. Es siempre sobre uno mismo, así que ignora a
//     propósito el selector "viendo a" de la cabecera: nadie enciende
//     permisos en nombre de otro, ni un coach ni el administrador.
// ============================================================

import { cambiarPermisoCoach, concederComposicion, revocarComposicion } from './db.js';
import { esc, avisar, mensajeDeError } from './ui.js';
import { sesion, refrescarCoaches } from './sesion.js';

// Los tres interruptores, en orden de lo más frecuente a lo más
// sensible. La composición va al final por algo: es el dato que la app
// protege con más fuerza.
const PERMISOS = [
  {
    id: 'registrar',
    campo: 'puede_registrar',
    titulo: 'Registrar mis entrenamientos',
    enFrase: 'registrar tus entrenamientos',
    detalle: 'Anotar peso, series y repeticiones por mí. Útil cuando en el gimnasio '
           + 'el teléfono lo lleva el coach. Todo lo que escriba queda marcado con su nombre.',
  },
  {
    id: 'plan',
    campo: 'puede_editar_plan',
    titulo: 'Armar y ajustar mi rutina',
    enFrase: 'armar tu rutina',
    detalle: 'Cambiar qué días entreno y qué ejercicios tiene cada día.',
  },
  {
    id: 'composicion',
    campo: null,   // vive en otra tabla, no en coach_links
    titulo: 'Ver mi composición corporal',
    enFrase: 'ver tu composición corporal',
    detalle: 'Peso, grasa, agua y medidas. Solo mirar: corregir esos datos es siempre '
           + 'cosa mía. El administrador no los ve por ser administrador.',
  },
];

let raiz = null;

export function montarMiCoach(contenedor) {
  raiz = contenedor;
  pintar();
}

function pintar() {
  const coaches = sesion.coaches;

  if (!coaches.length) {
    raiz.innerHTML = `
      <div class="vacio">
        <h2 class="vacio-titulo">Todavía no tienes un coach asignado</h2>
        <p class="vacio-texto">
          Cuando el administrador te asigne uno, aparecerá acá y podrás decidir
          qué puede hacer contigo. Mientras tanto, nadie más ve tus datos.
        </p>
      </div>`;
    return;
  }

  raiz.innerHTML = `
    <div class="explicacion">
      <h3 class="explicacion-titulo">Tú decides, y puedes cambiar de opinión</h3>
      <p>
        Todo nace apagado: un coach asignado puede <strong>ver</strong> tu entrenamiento
        y nada más. Lo que enciendas acá se aplica al instante, y apagarlo le corta el
        acceso en el momento — lo que ya haya escrito se queda, con su nombre.
      </p>
      <p class="explicacion-aviso">
        Esta pantalla es siempre sobre ti. Ni tu coach ni el administrador pueden
        encender estos interruptores en tu nombre.
      </p>
    </div>

    ${coaches.map(tarjetaHTML).join('')}`;

  conectar();
}

function tarjetaHTML(c) {
  return `
    <section class="coach-tarjeta">
      <header class="coach-cabecera">
        <h2 class="coach-nombre">${esc(c.nombre || c.email)}</h2>
        ${c.nombre ? `<p class="coach-correo">${esc(c.email)}</p>` : ''}
      </header>

      <ul class="lista-permisos lista-permisos--detallada">
        ${PERMISOS.map((p) => {
          const activo = valorDe(c, p.id);
          return `
            <li class="permiso permiso--detallado">
              <div class="permiso-texto">
                <span class="permiso-nombre">${esc(p.titulo)}</span>
                <span class="permiso-detalle">${esc(p.detalle)}</span>
              </div>
              <label class="interruptor">
                <input type="checkbox" data-coach="${esc(c.id)}" data-permiso="${p.id}"
                       ${activo ? 'checked' : ''}>
                <span>${activo ? 'sí puede' : 'no puede'}</span>
              </label>
            </li>`;
        }).join('')}
      </ul>

      <p class="coach-resumen">${esc(resumen(c))}</p>
    </section>`;
}

function valorDe(c, id) {
  return { registrar: c.puedeRegistrar, plan: c.puedeEditarPlan, composicion: c.veComposicion }[id];
}

/**
 * Una frase que diga en castellano lo que dicen los tres interruptores.
 *
 * Usa `enFrase` y no el título: el título está escrito desde el atleta
 * ("Registrar mis entrenamientos") y la frase habla del coach, así que
 * reusarlo daría "puede registrar mis entrenamientos", que confunde de
 * quién son los datos justo donde no hay que confundirse.
 */
function resumen(c) {
  const puede = PERMISOS.filter((p) => valorDe(c, p.id)).map((p) => p.enFrase);
  if (!puede.length) return 'Hoy solo puede ver tu entrenamiento.';
  if (puede.length === 1) return `Hoy puede ver tu entrenamiento y ${puede[0]}.`;
  return `Hoy puede ver tu entrenamiento, ${puede.slice(0, -1).join(', ')} y ${puede.at(-1)}.`;
}

function conectar() {
  raiz.querySelectorAll('[data-permiso]').forEach((chk) => {
    chk.addEventListener('change', async () => {
      const coachId = chk.dataset.coach;
      const p = PERMISOS.find((x) => x.id === chk.dataset.permiso);
      const encender = chk.checked;

      chk.disabled = true;
      try {
        if (p.campo) {
          await cambiarPermisoCoach(sesion.yo.id, coachId, p.campo, encender);
        } else if (encender) {
          await concederComposicion(sesion.yo.id, coachId);
        } else {
          await revocarComposicion(sesion.yo.id, coachId);
        }

        // Se relee en vez de creerle al checkbox: si RLS rechazó el
        // cambio en silencio, el interruptor tiene que volver solo.
        await refrescarCoaches();
        pintar();
        avisar(encender ? 'Permiso concedido.' : 'Permiso revocado.');
      } catch (e) {
        chk.checked = !encender;     // el interruptor no miente sobre el estado real
        chk.disabled = false;
        avisar(mensajeDeError(e), 'error');
      }
    });
  });
}
