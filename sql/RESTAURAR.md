# Cómo restaurar un respaldo

Procedimiento verificado de punta a punta el 13-09-2026. Léelo completo antes de
empezar: el orden importa y hay un paso que no es obvio.

## Cuándo se usa

- **Prueba periódica** (lo que deberías hacer ahora, y una vez cada varios meses):
  restaurar en el proyecto Supabase de pruebas para confirmar que el respaldo sirve.
- **Desastre real**: se perdió o se corrompió la base de producción.
- **Consulta puntual**: saber qué decía una fila antes de que alguien la editara.

## El detalle que no es obvio

**El respaldo no contiene todo el esquema.** El trigger `on_auth_user_created` —el que
crea el perfil cuando alguien entra por primera vez con Google— vive sobre `auth.users`,
que es una tabla del esquema `auth` de Supabase, no del esquema `public`. `pg_dump`
vuelca `public` y por lo tanto **ese trigger no está en el respaldo**.

Restaurar solo los archivos del respaldo produciría una base que parece correcta y en la
que **nadie nuevo podría entrar jamás**: se autenticarían con Google y no se les crearía
perfil. Es la clase de fallo que se descubre semanas después.

Por eso el esquema **se reconstruye desde `sql/` en el repo**, no desde el archivo de
esquema del respaldo. Del respaldo se usan solo los datos. Como beneficio, el esquema
reconstruido está garantizadamente al día con las migraciones.

El archivo `*-esquema.sql` del respaldo sirve igual: es la foto de cómo estaba la base
ese día, útil para comparar si sospechas que producción se desvió del repo.

## Procedimiento

### 0. Conseguir los archivos

En el repo privado `drotracker-respaldos`, carpeta `respaldos/`, descarga los tres
archivos del día que quieras:

```
AAAA-MM-DD-esquema.sql.gz
AAAA-MM-DD-datos.sql.gz
AAAA-MM-DD-identidades.sql.gz
```

Descomprímelos. En Windows 11 el Explorador abre `.gz` directamente; si no, 7-Zip.

### 1. Reconstruir el esquema desde el repo

En el SQL Editor del proyecto de destino, ejecuta **en este orden**, cada uno en una
query nueva:

```
sql/01_esquema.sql
sql/02_roles_rls.sql
sql/03_fk_borrado_cuenta.sql
sql/04_fk_deferrable.sql
```

Si el proyecto de destino ya tenía tablas de una prueba anterior, empieza por un proyecto
limpio: es más rápido que desenredar.

### 2. Desactivar el trigger de alta

**Este paso es obligatorio.** Si no lo haces, al cargar `identidades` el trigger crea los
perfiles automáticamente, y después la carga de `datos` choca con esos perfiles ya
existentes por clave duplicada.

```sql
drop trigger if exists on_auth_user_created on auth.users;
```

### 3. Cargar las identidades

Abre `AAAA-MM-DD-identidades.sql`, copia todo y ejecútalo. Son las filas de
`auth.users`: los identificadores con los que Google reconoce a cada persona. Sin esto,
los perfiles del paso siguiente quedarían huérfanos.

### 4. Cargar los datos

Abre `AAAA-MM-DD-datos.sql`, copia todo y ejecútalo. Perfiles, rutinas, sesiones, series
y mediciones.

### 5. Volver a crear el trigger

Vuelve a ejecutar **el bloque final de `sql/01_esquema.sql`**, desde
`create or replace function public.crear_perfil()` hasta el final del archivo. Eso
recrea la función y el trigger.

### 6. Comprobar

```sql
select 'perfiles',     count(*) from profiles
union all select 'sesiones',    count(*) from workout_sessions
union all select 'series',      count(*) from set_logs
union all select 'mediciones',  count(*) from body_measurements
union all select 'políticas',   count(*) from pg_policy
union all select 'trigger alta', count(*) from pg_trigger
                                  where tgname = 'on_auth_user_created';
```

Los conteos deben cuadrar con producción y `trigger alta` tiene que ser 1.

Después corre `sql/99_pruebas_rls.sql`: las 21 pruebas en OK confirman que los permisos
se restauraron correctamente, no solo los datos.

## Si esto fuera un desastre real

Después de restaurar hay dos cosas más que la base no sabe:

- **El proveedor de identidad.** Hay que volver a configurar Google como proveedor en
  *Authentication → Providers* del proyecto nuevo, con el mismo cliente OAuth.
- **La app apunta al proyecto viejo.** Hay que actualizar `config.js` en el repo del
  sitio con la URL y la publishable key del proyecto nuevo, y agregar el dominio a las
  URLs autorizadas en Google Cloud y en Supabase Auth.

Ninguna de las dos está en el respaldo, y las dos son necesarias para que alguien pueda
entrar. Vale la pena tenerlas anotadas donde no dependan de esa base.
