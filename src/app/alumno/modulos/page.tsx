"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUserStore, UsuarioEstado } from "@/store/useUserStore";

type ModuloLite = {
  id: string;
  nombre_asignatura: string;
  programa?: { nombre: string } | null;
  docente?: { nombre_completo: string; correo: string } | null;
};

type Inscripcion = {
  alumno_modulo_id: string;
  modulo: ModuloLite;
};

type Nota = {
  asistencia: number | null;
  teoria: number | null;
  practica: number | null;
  examen_final: number | null;
  nota_final: number | null;
  literal: string | null;
  observacion: string | null;
};

function EstadoBadge({ estado }: { estado?: string | null }) {
  const e = (estado as UsuarioEstado) ?? "activo";
  const cls =
    e === "activo"
      ? "bg-emerald-900/30 text-emerald-300"
      : e === "abandono"
      ? "bg-amber-900/30 text-amber-300"
      : "bg-zinc-800 text-zinc-300"; // inactivo
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${cls}`}>{e}</span>;
}

export default function AlumnoModulos() {
  const user = useUserStore((s) => s.user);

  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [notasMap, setNotasMap] = useState<Record<string, Nota | undefined>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    (async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("alumnos_modulos")
        .select(`
          id,
          modulo:modulo_id(
            id,
            nombre_asignatura,
            programa:programa_id(nombre),
            docente:docente_id(nombre_completo, correo)
          )
        `)
        .eq("alumno_id", user.id)
        .order("id");

      if (error) console.error(error);

      const base: Inscripcion[] = ((data as any) ?? []).map((r: any) => ({
        alumno_modulo_id: r.id as string,
        modulo: r.modulo as ModuloLite,
      }));
      setInscripciones(base);

      if (base.length) {
        const amIds = base.map((i) => i.alumno_modulo_id);
        const { data: ns, error: e2 } = await supabase
          .from("notas")
          .select("*")
          .in("alumno_modulo_id", amIds);

        if (e2) console.error(e2);

        const map: Record<string, Nota> = {};
        (ns ?? []).forEach((n: any) => {
          map[n.alumno_modulo_id] = {
            asistencia: n.asistencia ?? null,
            teoria: n.teoria ?? null,
            practica: n.practica ?? null,
            examen_final: n.examen_final ?? null,
            nota_final: n.nota_final ?? null,
            literal: n.literal ?? null,
            observacion: n.observacion ?? null,
          };
        });
        setNotasMap(map);
      } else {
        setNotasMap({});
      }

      setLoading(false);
    })();
  }, [user?.id]);

  const isAbandono = user?.estado === "abandono";

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold flex items-center gap-2">
        Mis módulos
        {isAbandono && (
          <span className="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded bg-amber-900/30 text-amber-300 border border-amber-700/30">
            Abandono
          </span>
        )}
      </h1>

      {loading ? (
        <div className="opacity-70">Cargando…</div>
      ) : inscripciones.length === 0 ? (
        <div className="opacity-70">Aún no estás inscrito en módulos.</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--muted)]">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--panel)]">
              <tr>
                <th className="p-2 text-left">Módulo</th>
                <th className="p-2 text-left">Programa</th>
                <th className="p-2 text-left">Docente</th>
                <th className="p-2">Asist.</th>
                <th className="p-2">Teoría</th>
                <th className="p-2">Práctica</th>
                <th className="p-2">Examen</th>
                <th className="p-2">Final</th>
                <th className="p-2">Literal</th>
                <th className="p-2">Estado</th>
                <th className="p-2 text-left">Observación</th>
              </tr>
            </thead>
            <tbody>
              {inscripciones.map((i) => {
                const n = notasMap[i.alumno_modulo_id];
                return (
                  <tr key={i.alumno_modulo_id} className="border-t border-[var(--muted)]">
                    <td className="p-2">{i.modulo.nombre_asignatura}</td>
                    <td className="p-2">{i.modulo.programa?.nombre ?? "—"}</td>
                    <td className="p-2">{i.modulo.docente?.nombre_completo ?? "—"}</td>
                    <td className="p-2 text-center">{n?.asistencia ?? "—"}</td>
                    <td className="p-2 text-center">{n?.teoria ?? "—"}</td>
                    <td className="p-2 text-center">{n?.practica ?? "—"}</td>
                    <td className="p-2 text-center">{n?.examen_final ?? "—"}</td>
                    <td className="p-2 text-center font-semibold">{n?.nota_final ?? "—"}</td>
                    <td className="p-2 text-center">{n?.literal ?? "—"}</td>
                    <td className="p-2 text-center">
                      <EstadoBadge estado={user?.estado} />
                    </td>
                    <td className="p-2">{n?.observacion ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
