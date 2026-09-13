#!/usr/bin/env node
/* ============================================================
   DRO.TRACKER · convierte la planilla original en SQL

   USO:
     1. En el Google Sheet: Archivo → Descargar → CSV (.csv)
     2. node herramientas/migrar-planilla.js planilla.csv correo@gmail.com 2025-09-01 \
          > sql/05_migracion.sql
     3. Revisar el SQL generado y pegarlo en el SQL Editor de Supabase

   El tercer argumento es la fecha del LUNES en que empezó el ciclo 1,
   semana 1. Es lo único que la planilla no contiene y no se puede
   deducir. Todo lo demás se calcula a partir de ahí.

   QUÉ SUPONE (y por qué)

   · Los pesos de la planilla son lo que se LEVANTÓ, no lo que tocaba.
     Por eso entran como sesiones y series reales (workout_sessions +
     set_logs), no como prescripción.

   · Las repeticiones no están registradas: quedan en NULL. NULL dice
     "no se sabe"; un cero diría "no hizo ninguna", que es falso.

   · "x3" se guarda como `series = 3` en UNA fila. La unidad de
     registro es el ejercicio del día, no la serie: anotar tres filas
     en medio del entrenamiento es tedioso y no aporta nada cuando
     las tres van al mismo peso.

   · Las fechas se reconstruyen: semana N = lunes de inicio + (N-1)
     semanas, y el Día 1 cae lunes, el Día 2 martes, y así. Son
     EXACTAS A LA SEMANA y aproximadas al día. Cada sesión queda
     marcada con esa advertencia en su nota.

   · Una semana sin ningún peso registrado no genera sesión. No se
     inventan entrenamientos que no ocurrieron.

   Idempotente: el SQL se puede ejecutar más de una vez.
   ============================================================ */

const fs = require('fs');

const [,, csvPath, correo, fechaInicio] = process.argv;
if (!csvPath || !correo || !fechaInicio) {
  console.error('Uso: node migrar-planilla.js <archivo.csv> <correo> <AAAA-MM-DD del lunes del ciclo 1 semana 1>');
  process.exit(1);
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio)) {
  console.error('La fecha debe ir como AAAA-MM-DD, por ejemplo 2025-09-01');
  process.exit(1);
}

function parseCSV(texto) {
  const filas = []; let campo = '', fila = [], comillas = false;
  const t = texto.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (comillas) {
      if (c === '"') { if (t[i+1] === '"') { campo += '"'; i++; } else comillas = false; }
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; }
    else campo += c;
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
  return filas;
}

const q = s => "'" + String(s).replace(/'/g, "''") + "'";
const numero = s => {
  const v = String(s || '').trim().replace(/\./g, '').replace(',', '.');
  if (v === '') return null;
  const n = Number(v);
  return (!isFinite(n) || n === 0) ? null : n;
};
const sumarDias = (iso, n) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const filas = parseCSV(fs.readFileSync(csvPath, 'utf8')).filter(f => f.some(c => c.trim()));
filas.shift();   // encabezado

const dias = [];
const ejercicios = new Map();
const registros = [];
const problemas = [];

for (const f of filas) {
  const [dia, ejRaw, peso, , unidad, sem, ciclo] = f.map(x => (x || '').trim());
  if (!dia || !ejRaw) continue;

  const m = ejRaw.match(/^(\d+)\.\s*(.+?)\s*x\s*(\d+)$/i);
  if (!m) { problemas.push(ejRaw); continue; }
  const orden = +m[1], nombre = m[2].trim(), series = +m[3];

  if (!dias.includes(dia)) dias.push(dia);
  if (!ejercicios.has(nombre)) ejercicios.set(nombre, { nombre, dia, orden, series, unidad: unidad || 'kg' });

  const sg = parseInt(String(sem).replace(/[^0-9]/g, ''), 10);
  const cl = parseInt(String(ciclo).replace(/[^0-9]/g, ''), 10);
  if (!sg || !cl) { problemas.push(`semana/ciclo ilegible: ${sem}/${ciclo}`); continue; }

  registros.push({ nombre, dia, ciclo: cl, semana: ((sg - 1) % 4) + 1, semanaGlobal: sg,
                   peso: numero(peso), series, unidad: unidad || 'kg' });
}

if (problemas.length) {
  console.error('Filas que no se pudieron interpretar:');
  problemas.slice(0, 10).forEach(p => console.error('  · ' + p));
}

// Sesiones: una por (ciclo, semana, día) que tenga al menos un peso
const sesiones = new Map();
for (const r of registros) {
  if (r.peso === null) continue;
  const k = `${r.ciclo}|${r.semana}|${r.dia}`;
  if (!sesiones.has(k)) {
    const diaIdx = dias.indexOf(r.dia);                 // 0..4
    const fecha = sumarDias(fechaInicio, (r.semanaGlobal - 1) * 7 + diaIdx);
    sesiones.set(k, { ciclo: r.ciclo, semana: r.semana, dia: r.dia,
                      diaIdx: diaIdx + 1, fecha, series: [] });
  }
  sesiones.get(k).series.push(r);
}

const ciclos = [...new Set(registros.map(r => r.ciclo))].sort((a, b) => a - b);
const totalFilas = [...sesiones.values()].reduce((n, s) => n + s.series.length, 0);
const totalSeries = [...sesiones.values()].reduce((n, s) => n + s.series.reduce((m, r) => m + r.series, 0), 0);

console.error(`\nLeído: ${dias.length} días · ${ejercicios.size} ejercicios · ${ciclos.length} ciclos`);
console.error(`Se generarán ${sesiones.size} sesiones y ${totalFilas} registros (${totalSeries} series en total)`);
console.error(`Rango de fechas: ${fechaInicio} a ${[...sesiones.values()].map(s=>s.fecha).sort().pop()}`);

const L = [];
L.push(`-- ============================================================`);
L.push(`-- Migración 05 · generada el ${new Date().toISOString().slice(0,10)}`);
L.push(`-- por herramientas/migrar-planilla.js desde la planilla original`);
L.push(`--`);
L.push(`--   ${dias.length} días · ${ejercicios.size} ejercicios · ${ciclos.length} ciclos`);
L.push(`--   ${sesiones.size} sesiones · ${totalFilas} registros · ${totalSeries} series`);
L.push(`--`);
L.push(`-- Los pesos son lo LEVANTADO, no lo planificado: entran como`);
L.push(`-- sesiones y series reales. Las repeticiones no estaban`);
L.push(`-- registradas y quedan en NULL.`);
L.push(`--`);
L.push(`-- Las fechas están reconstruidas a partir del ${fechaInicio}:`);
L.push(`-- son exactas a la semana y aproximadas al día.`);
L.push(`--`);
L.push(`-- Idempotente: se puede ejecutar más de una vez.`);
L.push(`-- ============================================================`);
L.push('');
L.push(`do $$`);
L.push(`declare`);
L.push(`  v_user   uuid;`);
L.push(`  v_rutina uuid;`);
L.push(`begin`);
L.push(`  select id into v_user from profiles where lower(email) = lower(${q(correo)});`);
L.push(`  if v_user is null then`);
L.push(`    raise exception 'No existe un perfil con el correo %. Entra una vez a la app con Google antes de migrar.', ${q(correo)};`);
L.push(`  end if;`);
L.push('');
L.push(`  -- 1. Catálogo de ejercicios (global: sirve para todos los usuarios)`);
for (const e of ejercicios.values()) {
  L.push(`  insert into exercises (user_id, nombre, grupo_muscular, unidad_def, es_global)`);
  L.push(`  select null, ${q(e.nombre)}, ${q(e.dia)}, ${q(e.unidad)}, true`);
  L.push(`   where not exists (select 1 from exercises where nombre = ${q(e.nombre)} and es_global);`);
}
L.push('');
L.push(`  -- 2. La rutina y sus días`);
L.push(`  select id into v_rutina from routines where user_id = v_user and nombre = 'Rutina original';`);
L.push(`  if v_rutina is null then`);
L.push(`    insert into routines (user_id, nombre, vigente_desde)`);
L.push(`    values (v_user, 'Rutina original', ${q(fechaInicio)}) returning id into v_rutina;`);
L.push(`  end if;`);
L.push('');
dias.forEach((d, i) => {
  L.push(`  insert into routine_days (routine_id, orden, nombre) values (v_rutina, ${i+1}, ${q(d)})`);
  L.push(`  on conflict (routine_id, orden) do update set nombre = excluded.nombre;`);
});
L.push('');
L.push(`  -- 3. Los ejercicios de cada día`);
for (const e of ejercicios.values()) {
  L.push(`  insert into routine_exercises (routine_day_id, exercise_id, orden, unidad, series_base)`);
  L.push(`  select d.id, x.id, ${e.orden}, ${q(e.unidad)}, ${e.series}`);
  L.push(`    from routine_days d, exercises x`);
  L.push(`   where d.routine_id = v_rutina and d.orden = ${dias.indexOf(e.dia)+1}`);
  L.push(`     and x.nombre = ${q(e.nombre)} and x.es_global`);
  L.push(`     and not exists (select 1 from routine_exercises re`);
  L.push(`                      where re.routine_day_id = d.id and re.exercise_id = x.id);`);
}
L.push('');
L.push(`  -- 4. Ciclos`);
for (const c of ciclos) {
  L.push(`  insert into cycles (routine_id, numero) values (v_rutina, ${c})`);
  L.push(`  on conflict (routine_id, numero) do nothing;`);
}
L.push('');
L.push(`  -- 5. Sesiones entrenadas`);
L.push(`  insert into workout_sessions (id, user_id, routine_day_id, cycle_id, semana, fecha, nota)`);
L.push(`  select md5(v_rutina::text || v.ciclo || '-' || v.semana || '-' || v.dia)::uuid,`);
L.push(`         v_user, d.id, c.id, v.semana, v.fecha::date,`);
L.push(`         'Importado de la planilla original. Fecha exacta a la semana, aproximada al día.'`);
L.push(`    from (values`);
L.push([...sesiones.values()].map(s =>
  `      (${s.ciclo}, ${s.semana}, ${s.diaIdx}, ${q(s.fecha)})`).join(',\n'));
L.push(`    ) as v(ciclo, semana, dia, fecha)`);
L.push(`    join routine_days d on d.routine_id = v_rutina and d.orden = v.dia`);
L.push(`    join cycles c on c.routine_id = v_rutina and c.numero = v.ciclo`);
L.push(`  on conflict (id) do update set fecha = excluded.fecha;`);
L.push('');
L.push(`  -- 6. Series levantadas. reps queda NULL: no estaban registradas.`);
L.push(`  delete from set_logs sl using workout_sessions s`);
L.push(`   where sl.session_id = s.id and s.user_id = v_user`);
L.push(`     and s.nota like 'Importado de la planilla original%';`);
L.push('');
L.push(`  insert into set_logs (session_id, exercise_id, routine_exercise_id, series, reps, peso, unidad)`);
L.push(`  select md5(v_rutina::text || v.ciclo || '-' || v.semana || '-' || v.dia)::uuid,`);
L.push(`         x.id, re.id, v.series, null, v.peso, v.unidad`);
L.push(`    from (values`);
const seriesVals = [];
for (const s of sesiones.values()) {
  for (const r of s.series) {
    seriesVals.push(`      (${s.ciclo}, ${s.semana}, ${s.diaIdx}, ${q(r.nombre)}, ${r.series}, ${r.peso}, ${q(r.unidad)})`);
  }
}
L.push(seriesVals.join(',\n'));
L.push(`    ) as v(ciclo, semana, dia, nombre, series, peso, unidad)`);
L.push(`    join exercises x on x.nombre = v.nombre and x.es_global`);
L.push(`    join routine_days d on d.routine_id = v_rutina and d.orden = v.dia`);
L.push(`    join routine_exercises re on re.routine_day_id = d.id and re.exercise_id = x.id;`);
L.push('');
L.push(`  raise notice 'Migración completada: % sesiones', (select count(*) from workout_sessions where user_id = v_user);`);
L.push(`end $$;`);
L.push('');
L.push(`-- Comprobación`);
L.push(`select 'ejercicios en catálogo' as que, count(*)::text as cuantos from exercises where es_global`);
L.push(`union all select 'sesiones', count(*)::text from workout_sessions`);
L.push(`union all select 'registros de ejercicio', count(*)::text from set_logs`);
L.push(`union all select 'series en total', sum(series)::text from set_logs`);
L.push(`union all select 'registros sin repeticiones', count(*)::text from set_logs where reps is null`);
L.push(`union all select 'peso máximo registrado', max(peso)::text from set_logs;`);

console.log(L.join('\n'));
