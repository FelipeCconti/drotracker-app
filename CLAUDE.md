# DRO.TRACKER — contexto del proyecto

Claude Code lee este archivo automáticamente al abrir el repo. Mantenerlo actualizado
es lo que evita repetir el contexto en cada sesión.

## Qué es

App web de seguimiento de entrenamiento de gimnasio y composición corporal, para ~20
usuarios. Cada usuario arma su propia rutina (n días por semana, x ejercicios por día),
registra sus series y lleva sus mediciones corporales.

Sucesora del tracker original de un solo usuario, que sigue vivo e intacto en su propio
repo leyendo un Google Sheet.

## Restricción dura: el tracker original no se cae

El sitio antiguo tiene que seguir funcionando en su URL mientras este proyecto se
construye, y por un buen tiempo después. Eso prohíbe tres cosas:

1. **No tocar el repo antiguo**: ni renombrarlo, ni archivarlo, ni cambiar su
   configuración de Pages. Renombrar un repo cambia la URL de su sitio.
2. **No tocar el Google Sheet.** Es la fuente de datos en vivo del tracker antiguo.
   Migrar los datos a Supabase es una operación **de solo lectura**: se exporta o se
   copia, nunca se reestructuran columnas, se reordenan hojas ni se cambia el `gid`.
   Y sobre todo: **no quitar la publicación web de la hoja** (Archivo → Compartir →
   Publicar en la web) aunque parezca que ya no se usa — sin eso, el JSONP del tracker
   antiguo deja de cargar y el sitio queda en blanco.
3. **No reutilizar el nombre del repo antiguo** ni ocupar `<usuario>.github.io` si es
   ahí donde vive.

Si hace falta transformar la planilla para importarla, se trabaja sobre **una copia**
(Archivo → Hacer una copia), nunca sobre el original.

## Stack

- **Frontend**: HTML/CSS/JS sin framework, servido por GitHub Pages desde `main` / raíz.
- **Base de datos y auth**: Supabase (PostgreSQL + Auth con Google + Row Level Security).
- **Gráficos**: Chart.js 4.4.4.
- Sin backend propio: el navegador habla directo con Supabase usando el token de sesión.

## Regla no negociable: nada de CDN

La red del usuario bloquea `cdnjs.cloudflare.com`. **Todas las librerías van
vendorizadas en `vendor/`**, descargadas con `npm pack` y versionadas en el repo.

```bash
npm pack chart.js@4.4.4
npm pack @supabase/supabase-js
tar -xzf <paquete>.tgz && cp package/dist/umd/<archivo>.js vendor/
```

Nunca agregar un `<script src="https://...">` a un CDN. Si hace falta una librería
nueva, se vendoriza igual.

## Seguridad

- La **publishable key** (`sb_publishable_...`) vive en `config.js` y es pública por
  diseño: quien protege los datos es RLS, no el secreto. Está bien que el repo sea
  público. Usar esta y no la vieja `anon` en formato JWT: Supabase la deprecia a fines
  de 2026.
- La **secret key** (`sb_secret_...`, antes `service_role`) **jamás** entra a este repo.
  Se salta RLS por completo.
- Los respaldos (que sí contienen datos de usuarios) viven en un repo privado aparte.

## Quién entra a la app

Entrar con Google **no** es entrar a la app. `profiles.estado` decide:

- `pendiente` — autenticado y sin acceso a ningún dato. Es el estado por defecto.
- `activo` — usa la app normalmente.
- `bloqueado` — se le retiró el acceso sin borrar su historial.

Quien llega con un correo que está en la tabla `invitaciones` nace `activo` y no nota
nada. Quien llega por un link reenviado nace `pendiente` y aparece en la pantalla de
admin para aprobar o rechazar.

**`mi_id()` es la pieza central.** Devuelve el id del usuario solo si su cuenta está
activa, y null si no. Todas las políticas comparan contra `mi_id()` en vez de
`auth.uid()`, así que una cuenta no activa no calza con ninguna fila: no lee nada y no
escribe nada, sin repetir la condición en veinte políticas. **Al escribir una política
nueva, usar `mi_id()`, nunca `auth.uid()`** — salvo en las dos policies de lectura y
edición del propio perfil, que a propósito usan `auth.uid()` para que un pendiente pueda
ver su estado y completar su nombre mientras espera.

Nadie se auto-aprueba: `rol` y `estado` están fuera del grant de columnas del atleta y
solo los mueve la política del admin.

La UI tiene que manejar el caso `pendiente` con una pantalla propia — "tu acceso está en
revisión" — y no como un error. Un pendiente que ve la app vacía y llena de fallos cree
que está rota.

## Modelo de permisos

Todos los usuarios son atletas. El rol solo agrega permisos de **lectura** sobre datos
ajenos, nunca de escritura.

| Rol | Qué puede hacer de más |
|---|---|
| `atleta` | nada; gestiona lo suyo |
| `coach` | lee el entrenamiento de los atletas que el admin le asignó |
| `admin` | asigna y quita el rol de coach, crea vínculos coach–atleta, lee todo el entrenamiento |

Tres líneas que no se cruzan:

1. **El plan lo puede escribir el coach; el registro nunca.** Un coach con
   `puede_editar_plan` arma y ajusta la rutina de su atleta (`routines`, `routine_days`,
   `routine_exercises`, `cycles`, `exercise_targets`). Lo que alguien efectivamente
   levantó (`workout_sessions`, `set_logs`) solo lo escribe esa persona. Ni el admin.
2. **La composición corporal no se abre por rol.** El permiso vive en
   `composition_access`, una tabla que **solo el atleta** escribe: el admin no puede
   concederlo y el coach no puede concedérselo. El admin tampoco la ve por ser admin.
3. **Toda vista nueva lleva `security_invoker = on`.** Sin eso una vista se salta RLS.

El esquema y las políticas están en `sql/`. Al cambiar una política, actualizar el
archivo correspondiente en `sql/` — es la fuente de verdad, no el panel de Supabase.

## Estructura

```
index.html              punto de entrada
config.js               URL y publishable key de Supabase (públicas)
app/                    un módulo por pantalla: auth, rutina, entrenar,
                        progreso, composicion, admin — más db.js (acceso
                        a datos) y ui.js (helpers compartidos)
css/tokens.css          TODO el color, tipografía y espaciado
css/app.css             componentes, siempre en términos de los tokens
vendor/                 librerías vendorizadas (chart.js, supabase-js)
sql/                    esquema, RLS y migraciones — fuente de verdad
```

## El proyecto está hecho para cambiar seguido

La app va a crecer y el estilo va a cambiar varias veces. Cuatro reglas mantienen eso
barato; romper cualquiera de ellas hace que cada cambio siguiente cueste más.

**1. El estilo vive solo en `css/tokens.css`.** Un bloque `:root` con las variables de
color, tipografía y espaciado. Ningún componente escribe un color literal: todos usan
`var(--...)`. Cambiar la identidad visual entera es editar ese archivo, no cazar
hexadecimales por seis módulos. La paleta actual es la gama azul única
`#aebfc9` → `#1d3a4a`; verde y rojo se reservan para significado (progreso vs.
estancamiento), nunca para estética.

**2. Módulos ES nativos, sin bundler.** `<script type="module">` y `import` funcionan
directo en el navegador y en GitHub Pages, así que cada pantalla es su propio archivo en
`app/` sin paso de compilación. Agregar una pantalla es agregar un archivo, no tocar un
monolito. Importante: los módulos ES no funcionan abriendo el archivo con `file://` —
hay que servirlo (ver punto 4).

**3. El esquema se cambia con migraciones nuevas, nunca editando las viejas.** Una vez
que `01_esquema.sql` y `02_roles_rls.sql` corrieron, son historia: se agrega `03_...sql`,
`04_...sql`, numerados y con fecha en la cabecera.

No es solo higiene, es que **editar el 01 no tiene efecto**: usa `create table if not
exists`, así que sobre una base que ya existe no modifica nada y el cambio se pierde en
silencio. Cambiar una columna o una clave foránea exige `alter table` en una migración
propia. Toda migración lleva `if exists` / `if not exists` para poder repetirse, y
termina con un `select` que comprueba que se aplicó.

Numeración: `01`, `02` son la base; `03` en adelante, migraciones; `99_` en adelante,
diagnósticos y pruebas que no cambian nada.

**4. Probar local antes de publicar.** Desde la raíz del repo:

```
python3 -m http.server 8000     # y abrir http://localhost:8000
```

Un cambio de estilo se ve en un refresco, en vez de commit + push + esperar a Pages. Lo
que llega a `main` es lo que la gente usa: no se prueba ahí.

## Estilo

- **Paleta azul única**: `#aebfc9` (claro) → `#1d3a4a` (oscuro), en toda la app.
  Verde y rojo se reservan para significado (progreso vs. estancamiento), no para estética.
- Todo en español, incluidos nombres de tablas y columnas donde ya está establecido.
- Las dos vistas heredadas del tracker original — "Por día" y "Por ejercicio" — mantienen
  su comportamiento: filtros de ciclo y semana, barras agrupadas por semana con etiquetas
  de valor, línea de progreso, y la barra cargada con discos para el PR.

## Periodización

Los datos son de ciclos de 4 semanas con sobrecarga progresiva: el peso sube y las reps
bajan de ~15 a ~6 hacia la semana 4. `ciclo` y `semana` son ejes de primera clase en el
modelo, no metadatos: los gráficos se agrupan por ellos, no solo por fecha.

El plan vive en `exercise_targets` — una fila por (ejercicio, ciclo, semana), que es
exactamente la forma de la planilla original. `routine_exercises.*_base` son solo los
valores por defecto para una semana sin prescripción propia.

## Rutinas en el tiempo

Una rutina no es para siempre: se arma, se sigue unos meses y se reemplaza.

- `routines.vigente_desde` / `vigente_hasta` responden "qué rutina hacía en abril".
  `vigente_hasta is null` = la vigente hoy, y hay un índice único que garantiza una sola.
- `routines.deriva_de` encadena A → B → C. La función `suceder_rutina()` cierra la vieja
  y crea la nueva copiando días y ejercicios.
- Regla: ajustar cargas o reps → editar `exercise_targets`. Cambiar días o la selección
  de ejercicios → rutina nueva con `deriva_de`.

**`set_logs.exercise_id` está denormalizado a propósito.** Es lo que hace que el historial
de un ejercicio sea continuo a través de rutinas distintas, sobreviva a que se borre un
ejercicio del plan, y permita registrar algo fuera de la rutina (`routine_exercise_id`
nulo). Nunca resolver el ejercicio navegando por `routine_exercise_id`: usar
`set_logs.exercise_id` o la vista `v_historial_ejercicio`.

En los gráficos: "Por ejercicio" cruza rutinas y marca con una línea vertical dónde
cambió la rutina. "Por día" **no** cruza rutinas — el "Día 2" de una rutina y el de otra
no son lo mismo — así que el selector de día se agrupa por rutina y por defecto muestra
la vigente.

## Corregir datos antiguos

Se puede siempre: las políticas del dueño son `for all` (leer, crear, **editar y borrar**)
y no hay ninguna restricción por antigüedad. Corregir una serie de hace tres meses
funciona aunque ese ejercicio ya no esté en la rutina vigente — es el pago de tener
`set_logs.exercise_id` denormalizado.

Tres cosas que la UI debe manejar:

- **Toda edición deja rastro.** `actualizado_en` se llena solo por trigger en
  `workout_sessions`, `set_logs` y `body_measurements`. Null = nunca se editó. Mostrarlo
  discreto ("editado el 3 de mayo") en el historial, no como advertencia.
- **Borrar una sesión se lleva sus series** (`on delete cascade`). Confirmar antes.
- **Vaciar el último campo de una medición falla** por el check `al_menos_un_valor`: si
  el usuario quiere dejarla sin datos, lo que corresponde es borrar la medición. El
  mensaje de error tiene que decir eso, no mostrar el nombre de la restricción.

Si aparece algo que ni así se puede reconstruir, el respaldo diario guarda 30 días de
historia y sirve para consultar qué decía una fila antes.

## Composición corporal

`body_measurements.medido_en` es `timestamptz`, no fecha, y **no hay restricción de una
medición por día**: se puede registrar cuando sea. Si ya existe una de hoy, es la app la
que pregunta "¿reemplazo la de hoy o agrego otra?" — esa decisión es de producto, no de
la base. La hora se muestra junto al dato porque 77,4 kg en ayunas y 77,4 kg después de
almorzar no significan lo mismo.

Todos los campos son opcionales salvo que haya al menos uno: una balanza que no mide
grasa visceral simplemente deja esa columna nula, y el gráfico omite esa serie en lugar
de dibujar ceros. Los `check` de rango existen solo para atajar errores de tipeo.

La vista `v_composicion` entrega IMC, variación respecto de la medición anterior y
respecto de la primera. **La app muestra números y tendencia, no categorías ni juicios
de salud** — nada de etiquetar a alguien según su IMC. Interpretar esos datos es de un
profesional, no de la app.

## Unidades

`kg` por defecto en el perfil, sobrescribible por ejercicio, y **congelada** en cada
`set_log`. Cambiar la unidad hoy no debe reescribir el pasado.

## Dominio

Hoy en el subdominio de GitHub. Si se migra a `drotracker.cl`, los únicos puntos a tocar
son el archivo `CNAME`, los DNS en NIC Chile, y las URLs autorizadas en Google Cloud y
en Supabase Auth. Por eso el código nunca hardcodea la URL del sitio: usa
`window.location.origin`.

## La unidad de registro es el ejercicio, no la serie

Quien está entrenando —o su coach— tiene que poder anotar rápido y con una mano. Por eso
una fila de `set_logs` es **un ejercicio del día**: peso, cuántas series y a cuántas
repeticiones se trabajó. "Press banca, 60 kg, 3 × 10" es una fila con tres datos, no tres
filas.

- `series` → cuántas series a ese peso
- `reps` → las repeticiones de ese día
- `n_serie` → null en el registro simple

Si alguien quiere detallar serie por serie porque llevó pesos distintos, puede: varias
filas con `series = 1` y `n_serie = 1, 2, 3`. Las consultas no cambian en ninguno de los
dos casos:

```
volumen      = sum(peso * series * reps)
carga máxima = max(peso)
```

**La interfaz debe optimizar para el caso simple.** Repetir el peso de la sesión anterior
precargado, teclado numérico en el móvil, y guardar sin confirmaciones. Si registrar un
día toma más de un minuto, la gente deja de hacerlo y la app se muere sola.

## Migrar la planilla original

`herramientas/migrar-planilla.js` convierte el Google Sheet original en SQL:

```
node herramientas/migrar-planilla.js planilla.csv tu-correo@gmail.com 2026-05-25 > sql/05_migracion.sql
```

El tercer argumento es el lunes en que empezó el ciclo 1, semana 1 — el único dato que la
planilla no contiene. Para el historial de Felipe es **2026-05-25**, calculado desde que
el Día 5 de la semana 16 fue el viernes 11-09-2026.

Decisiones de la conversión, por si hay que revisarlas:

- **Los pesos son lo levantado, no lo planificado.** Entran como `workout_sessions` +
  `set_logs`, no como `exercise_targets`. La tabla de prescripción queda vacía hasta que
  se planifique un ciclo nuevo.
- **Las repeticiones no estaban registradas y quedan en `NULL`.** NULL dice "no se sabe";
  un cero diría "no hizo ninguna", que es falso. Consecuencia a tener presente: el **1RM
  estimado no se puede calcular** para los datos migrados, porque la fórmula de Epley
  necesita las reps. La vista devuelve NULL ahí, y los gráficos deben omitir esos puntos
  en vez de dibujar un cero. Desde el primer entrenamiento registrado en la app sí habrá
  reps y el 1RM empieza a funcionar.
- **"x3" se guarda como `series = 3` en una sola fila.**
- **Las fechas están reconstruidas**: exactas a la semana, aproximadas al día. Cada sesión
  importada lo dice en su `nota`, y esa nota es también la que usa el script para poder
  reimportar sin duplicar.
- **Una semana sin ningún peso no genera sesión.** No se inventan entrenamientos.
- El nombre limpio del ejercicio va al catálogo **global**, así los 20 usuarios parten con
  esos ejercicios cargados. El orden y las series pertenecen a la rutina.
