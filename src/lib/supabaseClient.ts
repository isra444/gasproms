// src/lib/supabaseClient.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/* ================================
   ENV SEGURO (no romper en SSR)
================================== */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// No lances error al importar en SSR; valida solo cuando realmente crees el cliente
function assertEnv() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
}

/* ==========================================
   fetch con timeout (se integra a supabase)
========================================== */
async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 15000
) {
  const controller = new AbortController();
  const userSignal = init.signal as AbortSignal | undefined;

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

/* ==========================================
   SINGLETON + control de auto-refresh
========================================== */
declare global {
  // eslint-disable-next-line no-var
  var __supabase__: SupabaseClient | undefined;
  // eslint-disable-next-line no-var
  var __supabaseVisBound__: boolean | undefined;
}

function createSupabaseSingleton(): SupabaseClient {
  assertEnv();

  if (!globalThis.__supabase__) {
    globalThis.__supabase__ = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
        // storage usa localStorage por defecto en browser;
        // no setear en SSR para evitar ReferenceError
      },
      global: {
        fetch: (input, init) => fetchWithTimeout(input, init),
      },
      db: { schema: "public" },
      realtime: {
        params: { eventsPerSecond: 2 },
      },
    });

    // Atamos el manejador de visibilidad **una sola vez** (solo en browser)
    if (typeof window !== "undefined" && !globalThis.__supabaseVisBound__) {
      const onVis = () => {
        if (document.visibilityState === "visible") {
          globalThis.__supabase__!.auth.startAutoRefresh();
        } else {
          globalThis.__supabase__!.auth.stopAutoRefresh();
        }
      };
      document.addEventListener("visibilitychange", onVis);
      // Ejecuta una primera vez según el estado actual
      onVis();
      globalThis.__supabaseVisBound__ = true;
    }
  }

  return globalThis.__supabase__;
}

/* ==========================================
   Export público
========================================== */
export const supabase = createSupabaseSingleton();
