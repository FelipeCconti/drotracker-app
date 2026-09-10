// ============================================================
// DRO.TRACKER · auth
//
// Entrar con Google NO es entrar a la app. Quien decide es
// `profiles.estado`:
//
//   pendiente → autenticado, sin acceso a ningún dato. Ve solo la
//               pantalla "tu acceso está en revisión". Es el estado
//               por defecto, así el link se puede reenviar sin que
//               eso signifique nada.
//   activo    → usa la app con normalidad.
//   bloqueado → se le retiró el acceso; su historial sigue intacto.
//
// Este módulo:
//   · crea el cliente de Supabase (global `window.supabase` desde
//     vendor/supabase.js — nunca un <script> de un CDN),
//   · expone `protegerApp({ alEntrar })`, que resuelve la sesión y el
//     estado y solo llama a `alEntrar` cuando la cuenta está activa,
//   · dibuja las pantallas de login, de revisión y de bloqueo.
//
// El color y la tipografía salen de css/tokens.css: acá no se escribe
// ni un hexadecimal.
// ============================================================

import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../config.js';

const ns = window.supabase;
if (!ns || typeof ns.createClient !== 'function') {
  throw new Error(
    'vendor/supabase.js no se cargó. Incluí <script src="vendor/supabase.js"></script> ' +
    'antes de los módulos de app/ y no lo reemplaces por un CDN.'
  );
}

if (SUPABASE_URL.includes('TU-REF') || SUPABASE_PUBLISHABLE_KEY.includes('TU_CLAVE')) {
  console.warn('[auth] config.js todavía tiene los valores de ejemplo: el login va a fallar.');
}

/** Cliente único de Supabase para toda la app. */
export const supabase = ns.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});

// ------------------------------------------------------------
// Acciones de sesión
// ------------------------------------------------------------

/** Abre el flujo de Google. Vuelve a esta misma URL (origin + path),
 *  así migrar a drotracker.cl no toca código. */
export async function iniciarSesionConGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
  if (error) throw error;
}

/** Cierra la sesión y vuelve a la pantalla de login. */
export async function cerrarSesion() {
  await supabase.auth.signOut();
  window.location.reload();
}

/** Perfil del usuario autenticado, o null si no hay sesión.
 *  Un 'pendiente' puede leer su propia fila (la policy usa auth.uid()). */
export async function cargarPerfil() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nombre, email, rol, estado')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ------------------------------------------------------------
// Guardia principal
// ------------------------------------------------------------

/**
 * Resuelve sesión + estado y decide qué se ve.
 *
 * @param {object}   opts
 * @param {(ctx: {perfil: object, supabase: object, cerrarSesion: Function}) => void} opts.alEntrar
 *        Se llama SOLO cuando la cuenta está activa.
 * @param {HTMLElement} [opts.raiz]  Contenedor donde se dibujan las
 *        pantallas de auth. Por defecto #app, o <body>.
 */
export async function protegerApp({ alEntrar, raiz } = {}) {
  const cont = raiz || document.getElementById('app') || document.body;
  inyectarEstilos();

  // Si vuelve a cerrar sesión en otra pestaña, recargamos a login.
  supabase.auth.onAuthStateChange((evento) => {
    if (evento === 'SIGNED_OUT') window.location.reload();
  });

  let session = null;
  try {
    ({ data: { session } } = await supabase.auth.getSession());
  } catch (e) {
    return pantallaError(cont, 'No se pudo contactar a Supabase.', e);
  }

  limpiarUrlOAuth();

  if (!session) return pantallaLogin(cont);

  let perfil;
  try {
    perfil = await cargarPerfil();
  } catch (e) {
    return pantallaError(cont, 'No se pudo leer tu perfil.', e);
  }

  if (!perfil) {
    // La sesión existe pero el trigger de alta aún no creó la fila.
    return pantallaRevision(cont, { nombre: '', email: session.user.email });
  }

  switch (perfil.estado) {
    case 'activo':
      cont.innerHTML = '';
      return alEntrar({ perfil, supabase, cerrarSesion });
    case 'bloqueado':
      return pantallaBloqueado(cont, perfil);
    case 'pendiente':
    default:
      return pantallaRevision(cont, perfil);
  }
}

// ------------------------------------------------------------
// Pantallas
// ------------------------------------------------------------

function pantallaLogin(cont) {
  cont.innerHTML = tarjeta(`
    <h1 class="auth-marca">DRO.TRACKER</h1>
    <p class="auth-texto">Seguimiento de entrenamiento y composición corporal.</p>
    <button class="auth-boton" id="auth-google" type="button">Entrar con Google</button>
    <p class="auth-nota">
      Entrar con Google no te da acceso automático: un administrador aprueba
      las cuentas nuevas. Si te invitaron por correo, entras directo.
    </p>
  `);
  cont.querySelector('#auth-google').addEventListener('click', async (ev) => {
    ev.currentTarget.disabled = true;
    ev.currentTarget.textContent = 'Abriendo Google…';
    try {
      await iniciarSesionConGoogle();
    } catch (e) {
      ev.currentTarget.disabled = false;
      ev.currentTarget.textContent = 'Entrar con Google';
      pantallaError(cont, 'No se pudo iniciar el login con Google.', e);
    }
  });
}

function pantallaRevision(cont, perfil) {
  cont.innerHTML = tarjeta(`
    <h1 class="auth-titulo">Tu acceso está en revisión</h1>
    <p class="auth-texto">
      Entraste con <strong>${esc(perfil.email || 'tu cuenta de Google')}</strong>.
      Un administrador tiene que aprobar tu cuenta antes de que puedas usar la
      app. No hace falta que hagas nada más: cuando te aprueben, entras normal.
    </p>

    <form class="auth-campo" id="auth-form-nombre" autocomplete="off">
      <label for="auth-nombre">Tu nombre (lo podés dejar listo mientras esperás)</label>
      <div class="auth-fila">
        <input id="auth-nombre" name="nombre" type="text" maxlength="80"
               value="${esc(perfil.nombre || '')}" placeholder="Nombre y apellido">
        <button class="auth-boton auth-boton--secundario" type="submit">Guardar</button>
      </div>
      <span class="auth-aviso" id="auth-nombre-aviso" hidden></span>
    </form>

    <div class="auth-fila">
      <button class="auth-boton" id="auth-recheck" type="button">Revisar de nuevo</button>
      <button class="auth-boton auth-boton--fantasma" id="auth-salir" type="button">Cerrar sesión</button>
    </div>
  `);

  cont.querySelector('#auth-recheck').addEventListener('click', () => window.location.reload());
  cont.querySelector('#auth-salir').addEventListener('click', cerrarSesion);

  const form = cont.querySelector('#auth-form-nombre');
  const aviso = cont.querySelector('#auth-nombre-aviso');
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const nombre = form.nombre.value.trim();
    if (!nombre) return;
    const boton = form.querySelector('button');
    boton.disabled = true;
    const { error } = await supabase.auth.getUser().then(({ data: { user } }) =>
      supabase.from('profiles').update({ nombre }).eq('id', user.id)
    );
    boton.disabled = false;
    aviso.hidden = false;
    if (error) {
      aviso.textContent = 'No se pudo guardar. Probá de nuevo.';
      aviso.classList.add('auth-aviso--error');
    } else {
      aviso.textContent = 'Guardado.';
      aviso.classList.remove('auth-aviso--error');
    }
  });
}

function pantallaBloqueado(cont, perfil) {
  cont.innerHTML = tarjeta(`
    <h1 class="auth-titulo">Tu acceso fue retirado</h1>
    <p class="auth-texto">
      La cuenta <strong>${esc(perfil.email || '')}</strong> ya no tiene acceso a
      la app. Tu historial de entrenamientos y mediciones sigue guardado. Si
      creés que es un error, hablá con el administrador.
    </p>
    <button class="auth-boton auth-boton--fantasma" id="auth-salir" type="button">Cerrar sesión</button>
  `);
  cont.querySelector('#auth-salir').addEventListener('click', cerrarSesion);
}

function pantallaError(cont, mensaje, err) {
  if (err) console.error('[auth]', mensaje, err);
  cont.innerHTML = tarjeta(`
    <h1 class="auth-titulo">Algo falló</h1>
    <p class="auth-texto">${esc(mensaje)}</p>
    ${err ? `<pre class="auth-detalle">${esc(String(err.message || err))}</pre>` : ''}
    <button class="auth-boton" id="auth-reintentar" type="button">Reintentar</button>
  `);
  cont.querySelector('#auth-reintentar').addEventListener('click', () => window.location.reload());
}

// ------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------

function tarjeta(interior) {
  return `<div class="auth-envoltura"><div class="auth-tarjeta">${interior}</div></div>`;
}

function esc(v) {
  return String(v).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** Borra el `?code=` / `#access_token` que deja el redirect de OAuth,
 *  una vez que supabase-js ya lo consumió. */
function limpiarUrlOAuth() {
  const { hash, search, pathname } = window.location;
  if (search.includes('code=') || hash.includes('access_token') || hash.includes('error=')) {
    window.history.replaceState(null, '', pathname);
  }
}

let estilosPuestos = false;
function inyectarEstilos() {
  if (estilosPuestos) return;
  estilosPuestos = true;
  const style = document.createElement('style');
  style.dataset.origen = 'app/auth.js';
  // Solo var(--...) de tokens.css: ni un color literal.
  style.textContent = `
    .auth-envoltura {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--esp-5);
      background: var(--color-fondo);
      color: var(--color-texto);
      font-family: var(--fuente-texto);
    }
    .auth-tarjeta {
      width: 100%;
      max-width: var(--ancho-tarjeta);
      background: var(--color-superficie);
      border: var(--borde-fino);
      border-radius: var(--radio-lg);
      box-shadow: var(--sombra-md);
      padding: var(--esp-6);
      display: flex;
      flex-direction: column;
      gap: var(--esp-4);
    }
    .auth-marca {
      font-family: var(--fuente-titulo);
      font-weight: var(--peso-fuerte);
      font-size: var(--texto-2xl);
      letter-spacing: 0.04em;
      line-height: var(--interlinea-apretada);
      margin: 0;
      color: var(--color-acento-fuerte);
    }
    .auth-titulo {
      font-family: var(--fuente-titulo);
      font-weight: var(--peso-semi);
      font-size: var(--texto-xl);
      line-height: var(--interlinea-apretada);
      margin: 0;
      color: var(--color-texto);
    }
    .auth-texto {
      margin: 0;
      font-size: var(--texto-md);
      line-height: var(--interlinea-normal);
      color: var(--color-texto-tenue);
    }
    .auth-texto strong { color: var(--color-texto); font-weight: var(--peso-semi); }
    .auth-nota {
      margin: 0;
      font-size: var(--texto-sm);
      line-height: var(--interlinea-normal);
      color: var(--color-texto-debil);
    }
    .auth-campo {
      display: flex;
      flex-direction: column;
      gap: var(--esp-2);
    }
    .auth-campo label {
      font-size: var(--texto-sm);
      color: var(--color-texto-debil);
    }
    .auth-fila {
      display: flex;
      gap: var(--esp-2);
      flex-wrap: wrap;
    }
    .auth-fila > .auth-boton { flex: 1 1 auto; }
    .auth-campo input {
      flex: 1 1 12rem;
      min-width: 0;
      padding: var(--esp-3) var(--esp-3);
      font-family: var(--fuente-texto);
      font-size: var(--texto-md);
      color: var(--color-texto);
      background: var(--color-superficie-alta);
      border: var(--borde-fino);
      border-radius: var(--radio-sm);
    }
    .auth-campo input:focus-visible {
      outline: 2px solid var(--color-foco);
      outline-offset: 1px;
    }
    .auth-boton {
      appearance: none;
      cursor: pointer;
      padding: var(--esp-3) var(--esp-5);
      font-family: var(--fuente-texto);
      font-size: var(--texto-md);
      font-weight: var(--peso-semi);
      color: var(--color-texto-sobre-acento);
      background: var(--color-acento);
      border: 1px solid transparent;
      border-radius: var(--radio-sm);
      transition: background var(--trans-rapida), opacity var(--trans-rapida);
    }
    .auth-boton:hover { background: var(--color-acento-fuerte); }
    .auth-boton:disabled { opacity: 0.6; cursor: default; }
    .auth-boton:focus-visible { outline: 2px solid var(--color-foco); outline-offset: 2px; }
    .auth-boton--secundario {
      color: var(--color-texto);
      background: var(--color-superficie-alta);
      border-color: var(--color-borde);
    }
    .auth-boton--secundario:hover { background: var(--color-acento-suave); }
    .auth-boton--fantasma {
      color: var(--color-texto-tenue);
      background: transparent;
      border-color: var(--color-borde);
    }
    .auth-boton--fantasma:hover { background: var(--color-superficie-alta); }
    .auth-aviso {
      font-size: var(--texto-sm);
      color: var(--color-progreso);
    }
    .auth-aviso--error { color: var(--color-estancamiento); }
    .auth-detalle {
      margin: 0;
      padding: var(--esp-3);
      font-family: var(--fuente-mono);
      font-size: var(--texto-xs);
      color: var(--color-texto-debil);
      background: var(--color-superficie-alta);
      border-radius: var(--radio-sm);
      white-space: pre-wrap;
      overflow-x: auto;
    }
  `;
  document.head.appendChild(style);
}
