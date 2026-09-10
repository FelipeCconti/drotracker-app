// ============================================================
// DRO.TRACKER · configuración pública de Supabase
//
// Estos dos valores son PÚBLICOS por diseño. Quien protege los datos
// es Row Level Security en la base, no el secreto de esta clave. Está
// bien que este archivo viva en un repo público.
//
//   · SUPABASE_URL              → https://<ref-del-proyecto>.supabase.co
//   · SUPABASE_PUBLISHABLE_KEY  → la clave `sb_publishable_...`
//     (Project Settings → API Keys). Es la que reemplaza a la vieja
//     `anon` en formato JWT, que Supabase deprecia a fines de 2026.
//
// LO QUE NUNCA ENTRA ACÁ: la `sb_secret_...` (antes `service_role`).
// Se salta RLS por completo y no toca este repo jamás.
//
// La URL del sitio no se configura acá: el código usa
// `window.location.origin`, así migrar a drotracker.cl no toca código.
// ============================================================

export const SUPABASE_URL = 'https://TU-REF-DE-PROYECTO.supabase.co';

export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_TU_CLAVE_AQUI';
