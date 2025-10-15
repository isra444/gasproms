// src/lib/supaSafe.ts
import { supabase } from "./supabaseClient";

export class SupaError extends Error {
  constructor(message: string, public cause?: any) {
    super(message);
    this.name = "SupaError";
  }
}

/** Envuelve una llamada Supabase con timeout, abort y logs */
export async function supaCall<T>(
  tag: string,
  fn: (signal: AbortSignal) => Promise<T>,
  { timeoutMs = 15000 }: { timeoutMs?: number } = {}
): Promise<T> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(`timeout:${tag}`), timeoutMs);
  console.time(tag);
  try {
    const res = await fn(ac.signal);
    console.timeEnd(tag);
    return res;
  } catch (e: any) {
    console.timeEnd(tag);
    if (e?.name === "AbortError" || String(e).includes("timeout:")) {
      throw new SupaError(`Timeout en ${tag}`, e);
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

/** Patrones de lectura comunes */
export async function getSingleOrNull<T>(table: string, filter: (q: any) => any, tag?: string) {
  return supaCall(tag ?? `GET:${table}`, async () => {
    const q = filter(supabase.from(table).select("*"));
    // maybeSingle devuelve { data: null } si no hay fila (no error)
    const { data, error } = await q.maybeSingle();
    if (error) throw error;
    return data as T | null;
  });
}

/** Patrones de listado comunes */
export async function getList<T>(table: string, filter: (q: any) => any, tag?: string) {
  return supaCall(tag ?? `LIST:${table}`, async () => {
    const q = filter(supabase.from(table).select("*"));
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as T[];
  });
}

/** Patrones de mutación comunes */
export async function mutate<T>(tag: string, fn: () => Promise<{ data: T; error: any }>) {
  return supaCall(tag, async () => {
    const { data, error } = await fn();
    if (error) throw error;
    return data;
  });
}
