// src/app/admin/programas/[id]/modulos/crear/CrearModuloClient.tsx
"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

function isUUID(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

type Props = {
  programaId: string;
};

type ModuloInsert = {
  programa_id: string;
  numero: number;
  nombre_asignatura: string;
  docente_id: string | null;
};

export default function CrearModuloClient({ programaId }: Props) {
  const router = useRouter();

  const programaIdValido = useMemo(() => isUUID(programaId), [programaId]);

  const [numero, setNumero] = useState<string>("");
  const [nombreAsignatura, setNombreAsignatura] = useState<string>("");
  const [docenteId, setDocenteId] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!programaIdValido) {
      setErrorMsg("El ID de programa no es válido.");
      return;
    }
    const n = Number(numero);
    if (!Number.isFinite(n) || n < 1) {
      setErrorMsg("El número de módulo debe ser un entero ≥ 1.");
      return;
    }
    if (!nombreAsignatura.trim()) {
      setErrorMsg("El nombre de la asignatura es obligatorio.");
      return;
    }

    setSaving(true);

    const payload: ModuloInsert = {
      programa_id: programaId,
      numero: n,
      nombre_asignatura: nombreAsignatura.trim(),
      docente_id: docenteId ? docenteId : null,
    };

    const { error } = await supabase.from("modulos").insert([payload]);

    setSaving(false);

    if (error) {
      console.error("Insert modulos error:", error);
      if (/row-level security|RLS/i.test(error.message)) {
        setErrorMsg(
          "Permisos insuficientes (RLS). Asegúrate de tener rol 'admin' o 'coordinador' y de tener la policy de insert."
        );
      } else if (/(duplicate|unique)/i.test(error.message)) {
        setErrorMsg("Ya existe un módulo con ese número en este programa.");
      } else if (/foreign key/i.test(error.message)) {
        setErrorMsg("El programa no existe o no es accesible (FK).");
      } else {
        setErrorMsg(error.message);
      }
      return;
    }

    router.push(`/admin/programas/${programaId}`);
  };

  return (
    <div className="p-6 text-slate-100 max-w-xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Nuevo módulo</h1>
        <Link href={`/admin/programas/${programaId}`} className="underline text-slate-300">
          Volver
        </Link>
      </div>

      <div className="mb-4 text-sm text-slate-300">
        <span className="text-slate-400">Programa ID:</span>{" "}
        <span className={!programaIdValido ? "text-red-400" : ""}>{programaId}</span>
        {!programaIdValido && <span className="text-red-400 ml-2">UUID inválido</span>}
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 rounded-lg bg-red-900/20 border border-red-600 text-red-300">
            {errorMsg}
          </div>
        )}

        <div>
          <label className="block text-sm text-slate-300">Número de módulo</label>
          <input
            type="number"
            min={1}
            step={1}
            className="mt-1 w-full bg-slate-800 text-white rounded-xl px-3 py-2"
            placeholder="Ej. 1"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm text-slate-300">Nombre de la asignatura</label>
          <input
            className="mt-1 w-full bg-slate-800 text-white rounded-xl px-3 py-2"
            placeholder="Ej. Implantología"
            value={nombreAsignatura}
            onChange={(e) => setNombreAsignatura(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm text-slate-300">Docente (opcional, UUID)</label>
          <input
            className="mt-1 w-full bg-slate-800 text-white rounded-xl px-3 py-2"
            placeholder="UUID del docente"
            value={docenteId}
            onChange={(e) => setDocenteId(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-xl bg-slate-700 text-white hover:bg-slate-600 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Crear módulo"}
        </button>
      </form>
    </div>
  );
}
