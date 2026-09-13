# vendor/

Librerías de terceros vendorizadas y versionadas en el repo. La red del usuario
bloquea los CDN, así que **nada se carga desde `https://`** — todo vive acá.

Cada archivo es la build UMD (un `<script>` clásico que deja un global), no un
módulo ES. Se cargan en `index.html` antes de los `<script type="module">` de
`app/`, y los módulos los usan a través de `window.<global>`.

| Archivo | Paquete | Versión | Global | SHA-256 |
|---|---|---|---|---|
| `supabase.js` | `@supabase/supabase-js` | 2.116.0 | `window.supabase` (`.createClient`) | `84ee9bf45695c1dd3ba1595b6bcfb0f09672434631351ffc8ebe9140545d5ff6` |
| `chart.js` | `chart.js` | 4.4.4 | `window.Chart` | `fed6a739f8d0f0687174de6cd14745fc0fc7809144ab113d22908a26bf0d7fea` |

## Cómo actualizar / re-generar

```bash
npm pack @supabase/supabase-js
tar -xzf supabase-supabase-js-*.tgz
cp package/dist/umd/supabase.js vendor/
cp package/LICENSE               vendor/supabase-js.LICENSE

npm pack chart.js@4.4.4
tar -xzf chart.js-4.4.4.tgz
cp package/dist/chart.umd.js vendor/chart.js
cp package/LICENSE.md        vendor/chart.js.LICENSE
```

Ojo con Chart.js: la build que sirve es `dist/chart.umd.js` (deja
`window.Chart`). `dist/chart.js` es un módulo ES y no funciona con un
`<script>` clásico.

Sin `npm` a mano se puede bajar el tarball directo del registro y extraerlo:

```bash
curl -sO https://registry.npmjs.org/@supabase/supabase-js/-/supabase-js-2.116.0.tgz
tar -xzf supabase-js-2.116.0.tgz && cp package/dist/umd/supabase.js vendor/
```

Verificar el hash contra la tabla de arriba después de reemplazar el archivo.
