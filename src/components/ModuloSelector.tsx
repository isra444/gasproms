// app/components/ModuloSelector.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Modulo = { id: string; nombre_asignatura: string };

export default function ModuloSelector({
  value,
  onChange,
  label = "Módulo",
}: {
  value?: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const [mods, setMods] = useState<Modulo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("modulos")
        .select("id,nombre_asignatura")
        .order("nombre_asignatura", { ascending: true });

      if (cancelled) return;
      if (error) {
        console.error(error);
        setMods([]);
      } else {
        setMods((data as Modulo[]) ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <label className="block">
      <span className="text-sm text-slate-300">{label}</span>
      <select
        className="mt-1 w-full bg-slate-800 text-white rounded-xl px-3 py-2"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
      >
        <option value="">{loading ? "Cargando..." : "Selecciona un módulo"}</option>
        {mods.map((m) => (
          <option key={m.id} value={m.id}>
            {m.nombre_asignatura}
          </option>
        ))}
      </select>
    </label>
  );
}
