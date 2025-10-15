"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUserStore } from "@/store/useUserStore";

type Usuario = {
  id: string;
  nombre_completo: string;
  correo: string;
  celular: string | null;
  género?: string | null;
  genero?: string | null;
  profesión?: string | null;
  profesion?: string | null;
  universidad_titulado?: string | null;
  fecha_inscripción?: string | null;
  estado?: string | null;
  cedula?: string | null;
  expedido?: string | null;
};

export default function AlumnoInicio() {
  const user = useUserStore((s) => s.user);
  const [perfil, setPerfil] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from("usuarios").select("*").eq("id", user.id).single();
      if (!error) setPerfil((data as any) ?? null);
      setLoading(false);
    })();
  }, [user?.id]);

  const nombre = useMemo(
    () => perfil?.nombre_completo || user?.nombre_completo || user?.email || "",
    [perfil, user]
  );

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Hola, {nombre}</h1>

      <section className="rounded-2xl border border-[var(--muted)] p-4">
        <h2 className="text-lg font-semibold mb-3">Mi información</h2>
        {loading ? (
          <div className="opacity-70">Cargando…</div>
        ) : perfil ? (
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <Info label="Nombre" value={perfil.nombre_completo} />
            <Info label="Correo" value={perfil.correo} />
            <Info label="Celular" value={perfil.celular || "—"} />
            <Info label="Género" value={perfil.género ?? perfil.genero ?? "—"} />
            <Info label="Profesión" value={perfil.profesión ?? perfil.profesion ?? "—"} />
            <Info label="Univ. Titulado" value={perfil.universidad_titulado || "—"} />
            <Info label="Fecha inscripción" value={perfil.fecha_inscripción?.slice(0, 10) || "—"} />
            <Info label="Estado" value={perfil.estado || "—"} />
            {"cedula" in (perfil as any) && <Info label="Cédula" value={(perfil as any).cedula || "—"} />}
            {"expedido" in (perfil as any) && <Info label="Expedido" value={(perfil as any).expedido || "—"} />}
          </div>
        ) : (
          <div className="opacity-70">No se encontró tu perfil.</div>
        )}
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--panel)] border border-[var(--muted)] rounded-lg px-3 py-2 flex justify-between">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
