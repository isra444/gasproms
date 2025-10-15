"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUserStore } from "@/store/useUserStore";

export default function DocenteHome() {
  const user = useUserStore((s) => s.user);
  const [modCount, setModCount] = useState(0);
  const [alumCount, setAlumCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data: mods } = await supabase
        .from("modulos")
        .select("id")
        .eq("docente_id", user.id);
      setModCount(mods?.length ?? 0);

      const { data } = await supabase
        .from("alumnos_modulos")
        .select("id, modulo:modulo_id(docente_id)")
        .in("modulo.docente_id", [user.id]);
      setAlumCount(data?.length ?? 0);
    })();
  }, [user?.id]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Bienvenido/a</h1>

      <div className="rounded-2xl border border-[var(--muted)] p-4 grid md:grid-cols-3 gap-4">
        <div className="col-span-1">
          <div className="text-sm text-[var(--text-muted)]">Docente</div>
          <div className="text-lg font-semibold">{user?.nombre_completo || user?.email}</div>
          <div className="text-sm text-[var(--text-muted)]">{user?.email}</div>
        </div>
        <div className="rounded-xl p-4 bg-[var(--panel)]">
          <div className="text-sm text-[var(--text-muted)]">Módulos asignados</div>
          <div className="text-3xl font-bold">{modCount}</div>
        </div>
        <div className="rounded-xl p-4 bg-[var(--panel)]">
          <div className="text-sm text-[var(--text-muted)]">Alumnos a cargo</div>
          <div className="text-3xl font-bold">{alumCount}</div>
        </div>
      </div>
    </div>
  );
}
