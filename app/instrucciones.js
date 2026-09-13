// ============================================================
// DRO.TRACKER · cómo se usa
//
// El quinto botón del inicio. No es documentación técnica: es lo que
// alguien necesita saber la primera vez que entra, y sobre todo la
// respuesta a la pregunta que todos hacen — "¿quién puede ver mis
// datos?".
//
// Esa respuesta está acá y no escondida en un aviso legal a propósito.
// Si la gente no sabe quién ve qué, o no registra nada, o registra
// creyendo que es privado cuando no lo es. Las dos cosas son peores
// que una pantalla de texto.
// ============================================================

import { esc } from './ui.js';
import { sesion } from './sesion.js';

export function montarInstrucciones(contenedor, perfil, ir) {
  const esCoach = perfil.rol === 'coach' || perfil.rol === 'admin';

  contenedor.innerHTML = `
    <article class="guia">
      <h1 class="guia-titulo">Cómo se usa DRO.TRACKER</h1>

      <section class="guia-seccion">
        <h2>El día a día</h2>
        <p>
          Entras a <strong>Entrenar</strong>, eliges el día de tu rutina, y cada ejercicio
          llega con el peso y las repeticiones que hiciste la última vez. Lo normal es
          repetir o subir un poco: corriges el número y listo.
        </p>
        <p>
          <strong>No hay botón de guardar.</strong> Se guarda solo a medida que escribes.
          Si el gimnasio tiene mala señal, lo que escribiste no se pierde: la fila queda
          marcada y se reintenta sola cuando vuelve la conexión.
        </p>
      </section>

      <section class="guia-seccion">
        <h2>Una fila por ejercicio, no por serie</h2>
        <p>
          "Press banca, 60 kg, 3 × 10" es una fila con tres datos, no tres filas. Está
          hecho así para que anotar entre serie y serie tome segundos.
        </p>
      </section>

      <section class="guia-seccion">
        <h2>Cuándo cambiar la rutina y cuándo crear una nueva</h2>
        <p>
          Ajustes sueltos —cambiar las series de un ejercicio, sumar o quitar uno, renombrar
          un día— se hacen en <strong>Rutina</strong> y no rompen nada. Lo que ya registraste
          se conserva aunque quites el ejercicio del plan.
        </p>
        <p>
          Si cambias de enfoque —otra distribución de días, otro programa— usa
          <strong>"Empezar una rutina nueva"</strong>. Eso cierra la rutina actual con
          fecha y crea una copia para editar. El historial viejo queda asociado a la
          rutina vieja, que es lo que permite responder "¿qué hacía yo en abril?".
        </p>
      </section>

      <section class="guia-seccion">
        <h2>Los números de Progreso</h2>
        <p>
          <strong>Por día</strong> muestra un gráfico por ejercicio de ese día. Pincha el
          título de cualquiera para verlo grande con todo su historial.
        </p>
        <p>
          <strong>Por ejercicio</strong> cruza rutinas: el historial de tu press banca es
          uno solo aunque hayas cambiado de programa tres veces, y una línea vertical marca
          dónde cambió.
        </p>
        <p>
          El <strong>1RM estimado</strong> —la línea punteada— es cuánto podrías levantar
          <em>una sola vez</em>, calculado a partir del peso y las repeticiones que sí
          hiciste. Sirve para comparar sesiones distintas entre sí. <strong>No es una meta
          ni una recomendación de cargar ese peso.</strong>
        </p>
      </section>

      <section class="guia-seccion guia-seccion--destacada">
        <h2>Quién puede ver tus datos</h2>
        <p>Esta es la parte importante, y es corta:</p>
        <ul class="guia-lista">
          <li><strong>Tu entrenamiento</strong> lo ves tú, tu coach asignado y el
              administrador.</li>
          <li><strong>Tu composición corporal</strong> no la ve nadie más que tú, ni
              siquiera el administrador, hasta que tú enciendas el interruptor de un coach
              al final de esa pantalla. Se revoca cuando quieras y el acceso se corta al
              instante.</li>
          <li><strong>Escribir es otra cosa que leer.</strong> Que tu coach vea tu
              entrenamiento no significa que pueda cambiarlo: eso lo enciendes tú, aparte.</li>
          <li><strong>El administrador no escribe datos ajenos.</strong> Asigna coaches y
              aprueba cuentas; no toca el historial de nadie.</li>
          <li>Cada dato guarda <strong>quién lo escribió</strong> y si fue editado después.</li>
        </ul>
      </section>

      ${esCoach ? `
      <section class="guia-seccion">
        <h2>Si eres coach</h2>
        <p>
          En la cabecera, arriba, hay un selector de persona. Eliges a tu atleta
          <strong>una vez</strong> y esa elección te acompaña mientras navegas: entras a
          Entrenar y registras por él, saltas a Progreso y sigues viendo sus números.
          Para volver a lo tuyo, eliges "Yo".
        </p>
        <p>
          Lo que puedes hacer con cada atleta depende de lo que él te haya concedido. Si
          una pantalla te dice que no tienes permiso, no está rota: falta que esa persona
          lo encienda.
        </p>
      </section>` : ''}

      <section class="guia-seccion">
        <h2>Si algo se ve mal</h2>
        <p>
          Corregir un dato antiguo siempre se puede, por viejo que sea y aunque ese
          ejercicio ya no esté en tu rutina. Y hay un respaldo diario de los últimos 30
          días, así que nada se pierde de verdad.
        </p>
      </section>

      <button class="boton" type="button" id="volver-inicio">Volver al inicio</button>
    </article>`;

  contenedor.querySelector('#volver-inicio').addEventListener('click', () => ir('inicio'));
}
