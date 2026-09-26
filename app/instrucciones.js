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

      <section class="guia-seccion guia-seccion--primera">
        <h2>Si es tu primera vez: cuatro pasos</h2>
        <p>
          Lo único imprescindible son los dos primeros. Con eso ya puedes entrenar hoy;
          el resto se llena solo con el uso.
        </p>

        <ol class="pasos">
          <li class="paso">
            <span class="paso-n">1</span>
            <div class="paso-texto">
              <h3>Arma tu rutina</h3>
              <p>
                Ve a <strong>Rutina</strong>, ponle un nombre y di cuántos días entrenas
                por semana. Después, para cada día, agrega sus ejercicios desde el catálogo
                —o créalos si no están— y pon cuántas series haces.
              </p>
              <p class="paso-aparte">
                No tiene que quedar perfecta. Se cambia cuando quieras y no rompe nada.
              </p>
            </div>
          </li>

          <li class="paso">
            <span class="paso-n">2</span>
            <div class="paso-texto">
              <h3>Anota tu primer entrenamiento</h3>
              <p>
                En <strong>Entrenar</strong>, elige el día que te toca y escribe el peso,
                las series y las repeticiones de cada ejercicio. Se guarda solo mientras
                escribes: no hay botón de guardar.
              </p>
              <p class="paso-aparte">
                La primera vez hay que escribirlo todo. De la segunda en adelante, cada
                ejercicio llega con lo que hiciste la vez anterior y solo corriges lo que
                cambió.
              </p>
            </div>
          </li>

          <li class="paso">
            <span class="paso-n">3</span>
            <div class="paso-texto">
              <h3>Si quieres, registra tu composición corporal</h3>
              <p>
                Opcional y aparte. En <strong>Composición</strong> pones tu altura una vez
                y luego las mediciones que vayas tomando: peso, grasa, agua, lo que mida tu
                balanza. Completas solo lo que tengas.
              </p>
              <p class="paso-aparte">
                Esto no lo ve nadie más que tú hasta que tú lo autorices, y lo puedes
                revocar después.
              </p>
            </div>
          </li>

          <li class="paso">
            <span class="paso-n">4</span>
            <div class="paso-texto">
              <h3>Vuelve en unas semanas</h3>
              <p>
                <strong>Progreso</strong> empieza vacío y se llena solo con lo que vayas
                anotando. Con tres o cuatro semanas ya se ve una tendencia; antes de eso,
                son puntos sueltos.
              </p>
            </div>
          </li>
        </ol>
      </section>

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
              siquiera el administrador, hasta que tú se la abras a un coach. Se revoca
              cuando quieras y el acceso se corta al instante.</li>
          <li><strong>Escribir es otra cosa que leer.</strong> Que tu coach vea tu
              entrenamiento no significa que pueda cambiarlo: eso lo enciendes tú, aparte.</li>
          <li><strong>Los tres interruptores están en <em>Mi coach</em></strong>, en el
              inicio: registrar tus entrenamientos, armar tu rutina y ver tu composición.
              Nacen apagados y solo los mueves tú. Ese botón aparece cuando tienes un
              coach asignado.</li>
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

      <div class="guia-pie">
        <button class="boton" type="button" id="volver-inicio">Volver al inicio</button>
        <button class="boton boton--secundario" type="button" id="ir-rutina">Empezar por mi rutina</button>
      </div>
    </article>`;

  contenedor.querySelector('#volver-inicio').addEventListener('click', () => ir('inicio'));
  contenedor.querySelector('#ir-rutina').addEventListener('click', () => ir('rutina'));
}
