"use client";

import { useEffect, useMemo, useRef, useState, use as unwrap } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// ===== Tipos =====
type ProgramaItem = { id: string; nombre: string };

type ProgramaInfo = {
  id: string;
  nombre: string;
  grado_academico: string | null;
  // ¡en tu BD este campo se llama con tilde!
  versión: string | null;
  modalidad: string | null;
  sede: string | null;
  fecha_inicio: string | null; // yyyy-mm-dd
  fecha_fin: string | null;    // yyyy-mm-dd
  coordinador_id: string | null;
  coordinador?: { id: string; nombre_completo: string | null; correo: string | null } | null;
};

type Modulo = {
  id: string;
  numero: number | null;
  nombre_asignatura: string;
  docente?: { id: string; nombre_completo: string | null; correo: string | null } | null;
};

// ===== Página =====
export default function ProgramasYModulos({
  params,
}: {
  params: Promise<{ programaId?: string[] }>;
}) {
  // Next 15: params es Promise; unwrap para usarlo sin warning
  const unwrapped = unwrap(params);
  const programaIdFromUrl = unwrapped.programaId?.[0];

  const [programas, setProgramas] = useState<ProgramaItem[]>([]);
  const [selPrograma, setSelPrograma] = useState<string>(programaIdFromUrl ?? "");

  const [program, setProgram] = useState<ProgramaInfo | null>(null);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [loading, setLoading] = useState(false);

  // PDF preview
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const pdfObjectUrlRef = useRef<string | null>(null);

  // ===== Helpers =====
  function fmtDate(d?: string | null) {
    if (!d) return "—";
    try {
      const dt = new Date(d);
      const p = (n: number) => String(n).padStart(2, "0");
      return `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()}`;
    } catch {
      return "—";
    }
  }

  async function loadAsDataURL(src: string): Promise<string | null> {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      return await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  // ===== Cargas =====
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("programas")
        .select("id, nombre")
        .order("nombre", { ascending: true });
      if (error) console.error(error);
      setProgramas((data as ProgramaItem[]) ?? []);
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPdfUrl(null);
      if (!selPrograma) {
        setProgram(null);
        setModulos([]);
        return;
      }
      setLoading(true);

      const [prog, mods] = await Promise.all([
        supabase
          .from("programas")
          .select(
            'id, nombre, grado_academico, "versión", modalidad, sede, fecha_inicio, fecha_fin, coordinador_id, coordinador:coordinador_id ( id, nombre_completo, correo )'
          )
          .eq("id", selPrograma)
          .single(),
        supabase
          .from("modulos")
          .select(
            'id, numero, nombre_asignatura, docente:docente_id ( id, nombre_completo, correo )'
          )
          .eq("programa_id", selPrograma)
          .order("numero", { ascending: true, nullsFirst: true })
          .order("nombre_asignatura", { ascending: true }),
      ]);

      if (!cancelled) {
        if (!prog.error && prog.data) setProgram(prog.data as any);
        else setProgram(null);

        if (!mods.error) setModulos((mods.data as any) ?? []);
        else setModulos([]);

        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (pdfObjectUrlRef.current) {
        URL.revokeObjectURL(pdfObjectUrlRef.current);
        pdfObjectUrlRef.current = null;
      }
    };
  }, [selPrograma]);

  const heading = useMemo(
    () => (program ? `Programa — ${program.nombre}` : "Programas y módulos"),
    [program]
  );

  // ===== PDF =====
  async function previewPDF() {
    if (!program) return;
    setExporting(true);
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default as any;

      const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
      const pageW = doc.internal.pageSize.getWidth();
      const center = pageW / 2;

      // Logos
      const leftLogo = await loadAsDataURL("/logos/gasprom.png");
      const rightLogo = await loadAsDataURL("/logos/unsxx.png");
      const logoW = 64;
      const logoY = 26;
      if (leftLogo) doc.addImage(leftLogo, "PNG", 40, logoY, logoW, logoW, undefined, "FAST");
      if (rightLogo) doc.addImage(rightLogo, "PNG", pageW - 40 - logoW, logoY, logoW, logoW, undefined, "FAST");

      // Encabezado
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text('UNIVERSIDAD NACIONAL "SIGLO XX"', center, 46, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text("DIRECCION DE POSTGRADO", center, 64, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("PROGRAMA Y MODULOS", center, 92, { align: "center" });

      // Programa (nombre)
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text((program.nombre || "—").toUpperCase(), center, 114, { align: "center" });

      // Version - Sede - Modalidad (ASCII, sin bullets)
      const v = (program.versión ?? "").toUpperCase();
      const s = (program.sede ?? "").toUpperCase();
      const m = (program.modalidad ?? "").toUpperCase();
      const linea2 = [v, s, m].filter(Boolean).join(" - ");
      if (linea2) doc.text(linea2, center, 132, { align: "center" });

      // Ficha del programa
      const x = 55;
      let y = 156;
      doc.setFontSize(10);

      doc.setFont("helvetica", "bold"); doc.text("GRADO ACADEMICO:", x, y);
      doc.setFont("helvetica", "normal"); doc.text(program.grado_academico || "—", x + 130, y);

      y += 18;
      doc.setFont("helvetica", "bold"); doc.text("COORDINADOR:", x, y);
      doc.setFont("helvetica", "normal");
      doc.text(
        program.coordinador?.nombre_completo
          ? `${program.coordinador.nombre_completo} (${program.coordinador.correo ?? "—"})`
          : "—",
        x + 110,
        y
      );

      y += 18;
      doc.setFont("helvetica", "bold"); doc.text("FECHAS:", x, y);
      // ASCII: ' a ' en vez de flecha
      doc.setFont("helvetica", "normal"); doc.text(`${fmtDate(program.fecha_inicio)}  a  ${fmtDate(program.fecha_fin)}`, x + 70, y);

      // Tabla de módulos
      const head = [[ "No.", "MODULO", "ASIGNATURA", "DOCENTE" ]]; // "No." para evitar símbolos
      const body = (modulos ?? []).map((m, i) => [
        i + 1,
        m.numero != null ? String(m.numero) : "—",
        m.nombre_asignatura,
        m.docente?.nombre_completo ?? "—",
      ]);

      (autoTable)(doc, {
        startY: y + 24,
        head,
        body,
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 4, overflow: "linebreak" },
        headStyles: { fillColor: [235, 235, 235], textColor: 20, fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 32, halign: "center" }, // No.
          1: { cellWidth: 70, halign: "center" }, // Módulo (número)
          2: { cellWidth: 300 },                  // Asignatura
          3: { cellWidth: 170 },                  // Docente
        },
        margin: { left: 32, right: 32 },
        tableWidth: doc.internal.pageSize.getWidth() - 64,
      });

      // Observación si no hay módulos
      if (!modulos.length) {
        const yEnd = (doc as any).lastAutoTable?.finalY ?? y + 40;
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.text("No hay modulos registrados para este programa.", 40, yEnd + 20);
      }

      // Preview
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      if (pdfObjectUrlRef.current) URL.revokeObjectURL(pdfObjectUrlRef.current);
      pdfObjectUrlRef.current = url;
      setPdfUrl(url);
    } catch (e) {
      console.error("previewPDF error:", e);
      alert("No se pudo generar la vista previa PDF.");
    } finally {
      setExporting(false);
    }
  }

  // ===== Render =====
  return (
    <div className="p-6 text-slate-100">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{heading}</h1>
        <Link href="/admin/reportes" className="underline text-slate-300">Volver</Link>
      </div>

      {/* Filtro */}
      <div className="mt-4 grid md:grid-cols-3 gap-3">
        <select
          className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700"
          value={selPrograma}
          onChange={(e) => setSelPrograma(e.target.value)}
        >
          <option value="">— Selecciona un programa —</option>
          {programas.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>

        <div className="flex gap-2">
          <button
            onClick={previewPDF}
            disabled={!program || loading || exporting}
            className="px-4 py-2 rounded-xl bg-[var(--primary,#6366f1)] text-white disabled:opacity-50"
          >
            {exporting ? "Generando…" : "Vista previa PDF"}
          </button>
          <button
            className="px-4 py-2 rounded-xl border border-slate-700"
            onClick={() => {
              if (pdfUrl) {
                const w = window.open(pdfUrl, "_blank");
                if (w) w.focus();
              }
            }}
            disabled={!pdfUrl}
          >
            Imprimir / Guardar
          </button>
        </div>
      </div>

      {/* Estado */}
      <div className="mt-2 text-sm text-slate-300">
        {loading && <span>Cargando datos…</span>}
        {!loading && !selPrograma && <span>Elige un programa para ver su detalle y módulos.</span>}
        {!loading && selPrograma && !program && <span>No se encontró información del programa.</span>}
      </div>

      {/* PREVIEW */}
      <div className="mt-4">
        <div className="w-full h-[75vh] border border-slate-700 rounded-xl overflow-hidden bg-white">
          {pdfUrl ? (
            <iframe src={pdfUrl} className="w-full h-full" />
          ) : (
            <div className="p-4 text-slate-400">Sin vista previa. Genera el PDF con el botón “Vista previa PDF”.</div>
          )}
        </div>
      </div>
    </div>
  );
}
