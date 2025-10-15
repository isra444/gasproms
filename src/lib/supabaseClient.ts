// lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

// Lee variables de entorno públicas
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}

/**
 * fetch con timeout para evitar requests que nunca terminan.
 * Usa AbortController y respeta el signal entrante si existe.
 */
async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 15000 // 15s por defecto; ajusta si lo necesitas
) {
  const controller = new AbortController();
  const userSignal = init.signal as AbortSignal | undefined;

  // Si ya viene un signal, encadenamos abortos
  const onAbort = () => controller.abort();
  if (userSignal) {
    if (userSignal.aborted) controller.abort();
    else userSignal.addEventListener("abort", onAbort, { once: true });
  }

  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    if (userSignal) userSignal.removeEventListener("abort", onAbort);
  }
}

// ✅ Exporta una única instancia con opciones robustas
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
  // Aplica el fetch con timeout a TODAS las llamadas (auth, db, storage)
  global: {
    fetch: (input, init) => fetchWithTimeout(input, init),
  },
  // (Opcional) Si usas un schema distinto a 'public', cámbialo aquí
  db: { schema: "public" },
  // (Opcional) Limita eventos realtime si no los usas mucho
  realtime: {
    params: {
      eventsPerSecond: 2,
    },
  },
});
