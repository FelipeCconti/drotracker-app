// ============================================================
// DRO.TRACKER · quién soy y a quién estoy mirando
//
// Un coach no debería tener que volver a elegir a su atleta en cada
// pestaña. Se elige UNA VEZ, en la cabecera, y esa elección viaja con
// él mientras navega: entra a Entrenar y registra a Bea, salta a
// Progreso y sigue viendo a Bea.
//
// Lo que cambia entre pestañas no es la lista de personas —es una
// sola— sino lo que puede hacer con cada una. Por eso los permisos
// viajan pegados al atleta y cada pantalla pregunta por el suyo:
//
//   permiso('registrar')   → escribir entrenamientos
//   permiso('plan')        → editar la rutina
//   permiso('composicion') → ver la composición corporal
//
// Sobre uno mismo siempre se puede todo, así que `yo` no consulta
// nada. RLS hace cumplir esto en la base; esto es solo para que la
// interfaz no ofrezca botones que van a fallar.
// ============================================================

import { misAtletas, misCoachesYPermisos } from './db.js';

export const sesion = {
  yo: null,
  sujeto: null,     // de quién son los datos en pantalla
  atletas: [],      // mis atletas, con lo que ellos me permitieron
  coaches: [],      // mis coaches, con lo que yo les permití
};

/** Se llama una vez al entrar. */
export async function iniciarSesionApp(perfil) {
  sesion.yo = perfil;
  sesion.sujeto = perfil;

  // Las dos listas son independientes y ninguna es un error si viene
  // vacía: no ser coach de nadie es lo normal, y no tener coach también.
  const [atletas, coaches] = await Promise.all([
    misAtletas(perfil.id).catch(() => []),
    misCoachesYPermisos(perfil.id).catch(() => []),
  ]);
  sesion.atletas = atletas;
  sesion.coaches = coaches;
  return sesion;
}

export function esPropio() {
  return sesion.sujeto?.id === sesion.yo?.id;
}

/** ¿Puedo hacer esto con la persona que tengo en pantalla? */
export function permiso(que) {
  if (esPropio()) return true;
  const a = sesion.atletas.find((x) => x.id === sesion.sujeto?.id);
  if (!a) return false;
  return { registrar: a.puedeRegistrar, plan: a.puedeEditarPlan, composicion: a.veComposicion }[que] || false;
}

export function nombreSujeto() {
  return esPropio() ? 'ti' : (sesion.sujeto?.nombre || sesion.sujeto?.email || 'esta persona');
}

export function cambiarSujeto(id) {
  sesion.sujeto = id === sesion.yo.id ? sesion.yo : sesion.atletas.find((a) => a.id === id) || sesion.yo;
  return sesion.sujeto;
}

/** Actualiza los permisos sin recargar la página (tras conceder o revocar). */
export async function refrescarAtletas() {
  try { sesion.atletas = await misAtletas(sesion.yo.id); } catch { /* se queda con lo que había */ }
}

/** Lo mismo del otro lado: lo que yo le permití a mis coaches. */
export async function refrescarCoaches() {
  try { sesion.coaches = await misCoachesYPermisos(sesion.yo.id); } catch { /* idem */ }
}

/** ¿Tengo a alguien asignado como coach? Decide si el inicio ofrece "Mi coach". */
export function tengoCoach() {
  return sesion.coaches.length > 0;
}

/**
 * Aviso estándar para cuando la pantalla existe pero el permiso no.
 * Decirlo es mejor que esconder la pestaña: esconderla deja al coach
 * preguntándose si la app está rota.
 */
export function sinPermisoHTML(que) {
  const textos = {
    registrar: ['registrarle entrenamientos', 'Puede encenderlo desde su propia sesión, en la pantalla "Mi coach".'],
    plan: ['editarle la rutina', 'Puede encenderlo desde su propia sesión, en la pantalla "Mi coach".'],
    composicion: ['ver su composición corporal', 'Solo esa persona puede concederlo, desde su pantalla "Mi coach".'],
  }[que];
  return `
    <div class="vacio">
      <h2 class="vacio-titulo">Sin permiso para ${textos[0]}</h2>
      <p class="vacio-texto">
        ${nombreSujeto()} no te ha dado acceso a esto. ${textos[1]}
      </p>
    </div>`;
}
