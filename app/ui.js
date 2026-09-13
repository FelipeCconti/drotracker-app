// ============================================================
// DRO.TRACKER · helpers compartidos de interfaz
//
// Nada de estilo acá dentro: el estilo vive en css/tokens.css y
// css/app.css. Esto son solo utilidades que usan todas las pantallas.
// ============================================================

/** Escapa texto que va a innerHTML. Todo lo que venga de la base pasa por acá. */
export function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** Retrasa la ejecución hasta que pasen `ms` sin llamadas nuevas. */
export function retrasar(fn, ms = 600) {
  let t;
  const envuelta = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  envuelta.cancelar = () => clearTimeout(t);
  envuelta.ahora = (...args) => { clearTimeout(t); fn(...args); };
  return envuelta;
}

/**
 * Encola trabajo para que dos guardados de la misma fila nunca corran
 * a la vez. Sin esto, un insert y un update lanzados con 100 ms de
 * diferencia pueden terminar creando dos filas para el mismo ejercicio.
 */
export function crearCola() {
  let ultima = Promise.resolve();
  return (tarea) => {
    const siguiente = ultima.then(tarea, tarea);
    ultima = siguiente.catch(() => {});
    return siguiente;
  };
}

/** Número a texto sin ceros de relleno: 60.00 → "60", 62.50 → "62,5". */
export function fmtNum(v) {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (!isFinite(n)) return '';
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

/** Texto de un input numérico a número, aceptando coma decimal. */
export function aNumero(txt) {
  if (txt === null || txt === undefined) return null;
  const limpio = String(txt).trim().replace(',', '.');
  if (limpio === '') return null;
  const n = Number(limpio);
  return isFinite(n) ? n : null;
}

/** 'YYYY-MM-DD' de hoy en la zona horaria del navegador (no UTC). */
export function hoyISO() {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d - off).toISOString().slice(0, 10);
}

/** "hace 5 días", "ayer", "hoy". Para el dato de la última vez. */
export function haceCuanto(fechaISO) {
  if (!fechaISO) return '';
  const dias = Math.round(
    (new Date(hoyISO()) - new Date(fechaISO)) / 86400000
  );
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 7) return `hace ${dias} días`;
  if (dias < 14) return 'hace una semana';
  if (dias < 60) return `hace ${Math.round(dias / 7)} semanas`;
  return `hace ${Math.round(dias / 30)} meses`;
}

/** Fecha larga en español: "viernes 11 de septiembre". */
export function fmtFechaLarga(fechaISO) {
  if (!fechaISO) return '';
  const [a, m, d] = fechaISO.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

/**
 * Aviso breve abajo de la pantalla. Para confirmaciones y errores que
 * no justifican interrumpir lo que la persona está haciendo.
 */
export function avisar(mensaje, tipo = 'info') {
  let cont = document.getElementById('avisos');
  if (!cont) {
    cont = document.createElement('div');
    cont.id = 'avisos';
    cont.className = 'avisos';
    document.body.appendChild(cont);
  }
  const a = document.createElement('div');
  a.className = `aviso aviso--${tipo}`;
  a.textContent = mensaje;
  cont.appendChild(a);
  setTimeout(() => {
    a.classList.add('aviso--saliendo');
    setTimeout(() => a.remove(), 300);
  }, tipo === 'error' ? 5000 : 2600);
}

/** Traduce un error de Postgres a algo que una persona pueda entender. */
export function mensajeDeError(err) {
  const txt = String(err?.message || err || '');
  if (/al_menos_un_valor/.test(txt)) {
    return 'Una medición necesita al menos un dato. Si quieres dejarla vacía, bórrala.';
  }
  if (/row-level security|violates row-level/i.test(txt)) {
    return 'No tienes permiso para escribir estos datos.';
  }
  if (/Failed to fetch|NetworkError|network/i.test(txt)) {
    return 'Sin conexión. Lo escrito se guarda apenas vuelva.';
  }
  return txt || 'Algo falló y no sabemos qué.';
}
