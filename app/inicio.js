// ============================================================
// DRO.TRACKER · pantalla de inicio
//
// Lo primero que se ve al entrar. Cinco destinos, cada uno con su
// símbolo, su nombre y una línea que dice qué se hace ahí — porque
// "Composición" no significa nada para alguien que abre la app por
// primera vez.
//
// El logo de la cabecera vuelve siempre acá. Eso es lo que convierte
// esta pantalla en un punto de referencia y no en un trámite: si te
// pierdes, pinchas el logo y estás de vuelta.
//
// Los símbolos son SVG dibujados a mano y no emojis: un emoji cambia
// de forma en cada sistema operativo y no obedece a los tokens de
// color.
// ============================================================

import { esc } from './ui.js';
import { sesion, esPropio, nombreSujeto } from './sesion.js';

const ICONOS = {
  entrenar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
      stroke-linecap="round" stroke-linejoin="round"><path d="M3 9v6M6 7v10M18 7v10M21 9v6"/>
      <path d="M6 12h12"/></svg>`,
  progreso: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
      stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5"/><path d="M4 19h16"/>
      <path d="m7 15 4-5 3 3 5-7"/></svg>`,
  composicion: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
      stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/>
      <path d="M12 4v4M12 16v4M4 12h4M16 12h4"/><circle cx="12" cy="12" r="2.5"/></svg>`,
  rutina: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
      stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/>
      <path d="M8 2v4M16 2v4M3 10h18"/><path d="M8 14h3M8 17h6"/></svg>`,
  instrucciones: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
      stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/>
      <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.3"/><path d="M12 17h.01"/></svg>`,
  admin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
      stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/>
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17.5" cy="6.5" r="2.4"/>
      <path d="M16 12.5a4 4 0 0 1 4.5 3"/></svg>`,
};

const DESTINOS = [
  { id: 'entrenar', titulo: 'Entrenar',
    sub: 'Anota el peso, las series y las repeticiones del día.' },
  { id: 'progreso', titulo: 'Progreso',
    sub: 'Mira cómo ha cambiado tu carga a lo largo de las semanas.' },
  { id: 'composicion', titulo: 'Composición',
    sub: 'Registra peso, grasa y agua, y sigue su evolución.' },
  { id: 'rutina', titulo: 'Rutina',
    sub: 'Define qué días entrenas y qué ejercicios tiene cada uno.' },
  { id: 'instrucciones', titulo: 'Cómo se usa',
    sub: 'Para qué sirve cada pantalla y quién puede ver qué.', ancho: true },
  // Solo para el administrador. Se filtra abajo por rol: no basta con
  // esconder el botón —RLS es quien decide de verdad— pero ofrecer una
  // puerta que va a fallar es una forma tonta de confundir a la gente.
  { id: 'admin', titulo: 'Administración',
    sub: 'Aprobar cuentas, asignar roles y repartir atletas entre coaches.',
    ancho: true, soloAdmin: true },
];

export function montarInicio(contenedor, perfil, ir) {
  const nombre = (perfil.nombre || perfil.email || '').split(' ')[0];

  contenedor.innerHTML = `
    <div class="inicio">
      <h1 class="inicio-saludo">Hola, ${esc(nombre)}</h1>
      <p class="inicio-bajada">
        ${esPropio()
          ? '¿Qué quieres hacer?'
          : `Estás trabajando con <strong>${esc(nombreSujeto())}</strong>. Puedes cambiar de persona arriba, en la cabecera.`}
      </p>

      <div class="destinos">
        ${DESTINOS.filter((d) => !d.soloAdmin || perfil.rol === 'admin').map((d) => `
          <button class="destino ${d.ancho ? 'destino--ancho' : ''}" type="button" data-ir="${d.id}">
            <span class="destino-icono" aria-hidden="true">${ICONOS[d.id]}</span>
            <span class="destino-texto">
              <span class="destino-titulo">${esc(d.titulo)}</span>
              <span class="destino-sub">${esc(d.sub)}</span>
            </span>
          </button>`).join('')}
      </div>
    </div>`;

  contenedor.querySelectorAll('[data-ir]').forEach((b) => {
    b.addEventListener('click', () => ir(b.dataset.ir));
  });
}
