"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Persona = { id: string; nombre_completo: string; correo: string };

type ProgramaForm = {
  nombre: string;
  grado_academico: string;
  versión: string;
  modalidad: string;
  sede: string;
  fecha_inicio: string; // yyyy-mm-dd
  fecha_fin: string; // yyyy-mm-dd
  coordinador_id: string;
};

type ModuloForm = {
  crearModulo: boolean;
  numero: string; // mantenemos como string para controlar el input; convertimos a number al guardar
  nombre_asignatura: string;
};

export default function CrearProgramaPage() {
  const router = useRouter();

  const [form, setForm] = useState<ProgramaForm>({
    nombre: "",
    grado_academico: "",
    versión: "",
    modalidad: "",
    sede: "",
    fecha_inicio: "",
    fecha_fin: "",
    coordinador_id: "",
  });

  // campos del primer módulo (opcional)
  const [modulo, setModulo] = useState<ModuloForm>({
    crearModulo: false,
    numero: "",
    nombre_asignatura: "",
  });

  const [coordinadores, setCoordinadores] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // carga coordinadores con rol 'coordinador'
    (async () => {
      const { data, error } = await supabase
        .from("usuarios")
        .select("id, nombre_completo, correo, roles_usuario!inner(rol)")
        .eq("roles_usuario.rol", "coordinador")
        .order("nombre_completo", { ascending: true });

      if (!error) setCoordinadores((data as any) ?? []);
      else console.error(error);
    })();
  }, []);

  function onChange<K extends keyof ProgramaForm>(k: K, v: ProgramaForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function onChangeModulo<K extends keyof ModuloForm>(k: K, v: ModuloForm[K]) {
    setModulo((m) => ({ ...m, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (form.fecha_inicio && form.fecha_fin && form.fecha_fin < form.fecha_inicio) {
      setError("La fecha de fin no puede ser anterior a la fecha de inicio.");
      return;
    }

    // Validaciones del módulo si el usuario decidió crearlo
    if (modulo.crearModulo) {
      if (!modulo.numero || Number(modulo.numero) < 1) {
        setError("El número de módulo debe ser un entero ≥ 1.");
        return;
      }
      if (!modulo.nombre_asignatura.trim()) {
        setError("El nombre de la asignatura del módulo es obligatorio.");
        return;
      }
    }

    setLoading(true);

    // 1) Crear programa
    const payloadPrograma: any = {
      nombre: form.nombre.trim(),
      grado_academico: form.grado_academico || null,
      // ¡respetar acento, coincide con la BD!
      "versión": form.versión || null,
      modalidad: form.modalidad || null,
      sede: form.sede || null,
      fecha_inicio: form.fecha_inicio || null,
      fecha_fin: form.fecha_fin || null,
      coordinador_id: form.coordinador_id || null,
    };

    const { data: prog, error: errProg } = await supabase
      .from("programas")
      .insert([payloadPrograma])
      .select("id")
      .single();

    if (errProg) {
      console.error(errProg);
      setLoading(false);
      setError("No se pudo crear el programa. Intenta nuevamente.");
      return;
    }

    // 2) Crear primer módulo (opcional)
    if (modulo.crearModulo && prog?.id) {
      const numeroInt = Number(modulo.numero);
      const payloadModulo: any = {
        programa_id: prog.id,
        numero: Number.isFinite(numeroInt) ? numeroInt : null,
        nombre_asignatura: modulo.nombre_asignatura.trim(),
        docente_id: null, // si luego deseas permitir docente aquí, agrégalo al formulario
      };

      const { error: errMod } = await supabase.from("modulos").insert([payloadModulo]);

      if (errMod) {
        console.error(errMod);
        setLoading(false);
        // feedback claro si choca el índice único (programa_id, numero)
        if (/(duplicate|unique)/i.test(errMod.message)) {
          setError(
            "El módulo no se pudo crear: ya existe un módulo con ese número en este programa. El programa sí fue creado."
          );
        } else {
          setError(
            "El programa fue creado, pero no se pudo crear el primer módulo. Puedes crearlo luego desde el detalle del programa."
          );
        }
        // Redirigimos igual al detalle del programa para que lo veas y puedas crear el módulo desde ahí
        router.push(`/admin/programas/${prog.id}`);
        return;
      }
    }

    setLoading(false);
    // Ir al detalle del nuevo programa
    router.push(`/admin/programas/${prog!.id}`);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Crear programa</h1>
        <button
          onClick={() => router.push("/admin/programas")}
          className="px-3 py-2 rounded-xl border border-[var(--muted)]"
        >
          ← Volver
        </button>
      </div>

      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-[var(--muted)] p-4 grid md:grid-cols-3 gap-3"
      >
        {error && (
          <div className="md:col-span-3 p-3 rounded-lg bg-[var(--danger)]/10 border border-[var(--danger)] text-[var(--danger)]">
            {error}
          </div>
        )}

        {/* Campos del programa */}
        <input
          className="px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--muted)]"
          placeholder="Nombre *"
          value={form.nombre}
          onChange={(e) => onChange("nombre", e.target.value)}
          required
        />
        <input
          className="px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--muted)]"
          placeholder="Grado académico"
          value={form.grado_academico}
          onChange={(e) => onChange("grado_academico", e.target.value)}
        />
        <input
          className="px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--muted)]"
          placeholder="Versión"
          value={form.versión}
          onChange={(e) => onChange("versión", e.target.value)}
        />
        <input
          className="px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--muted)]"
          placeholder="Modalidad"
          value={form.modalidad}
          onChange={(e) => onChange("modalidad", e.target.value)}
        />
        <input
          className="px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--muted)]"
          placeholder="Sede"
          value={form.sede}
          onChange={(e) => onChange("sede", e.target.value)}
        />
        <input
          type="date"
          className="px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--muted)]"
          value={form.fecha_inicio}
          onChange={(e) => onChange("fecha_inicio", e.target.value)}
        />
        <input
          type="date"
          className="px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--muted)]"
          value={form.fecha_fin}
          onChange={(e) => onChange("fecha_fin", e.target.value)}
        />

        <select
          className="px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--muted)]"
          value={form.coordinador_id}
          onChange={(e) => onChange("coordinador_id", e.target.value)}
        >
          <option value="">— Coordinador —</option>
          {coordinadores.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre_completo} ({c.correo})
            </option>
          ))}
        </select>

        {/* Separador visual */}
        <div className="md:col-span-3 h-px bg-[var(--muted)] my-2" />

        {/* Bloque opcional: primer módulo */}
        <div className="md:col-span-3 flex items-center gap-2">
          <input
            id="crearModulo"
            type="checkbox"
            checked={modulo.crearModulo}
            onChange={(e) => onChangeModulo("crearModulo", e.target.checked)}
            className="h-4 w-4"
          />
          <label htmlFor="crearModulo" className="text-sm">
            Crear también el <b>primer módulo</b> de este programa
          </label>
        </div>

        <input
          type="number"
          min={1}
          step={1}
          disabled={!modulo.crearModulo}
          className="px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--muted)] disabled:opacity-50"
          placeholder="Número de módulo (ej. 1)"
          value={modulo.numero}
          onChange={(e) => onChangeModulo("numero", e.target.value)}
        />
        <input
          disabled={!modulo.crearModulo}
          className="px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--muted)] disabled:opacity-50"
          placeholder="Nombre de la asignatura del módulo"
          value={modulo.nombre_asignatura}
          onChange={(e) => onChangeModulo("nombre_asignatura", e.target.value)}
        />

        <div className="col-span-full flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-[var(--success)] text-white disabled:opacity-60"
          >
            {loading ? "Guardando…" : "Crear programa"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/programas")}
            className="px-4 py-2 rounded-xl bg-[var(--muted)]"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
