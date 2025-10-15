"use client";

import { useEffect, useMemo, useRef, useState, use as unwrap } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Row = {
  modulo_id: string;
  modulo_nombre: string;
  programa_id: string | null;
  programa_nombre: string | null;
  alumno_id: string;
  alumno_nombre: string;
  alumno_correo: string;
  estado_inscripcion: string | null;
  nota_final: number | null;
  literal: string | null;
  observacion: string | null;
};

type ProgramaListItem = { id: string; nombre: string };

type ProgramaInfo = {
  id: string;
  nombre: string;
  // ¡OJO! en tu BD el campo se llama con tilde
  versión: string | null;
  sede: string | null;
  modalidad: string | null;
};

type Persona = { id: string; nombre_completo: string | null };

type Modulo = {
  id: string;
  nombre_asignatura: string;
  numero: number | null;
  docente?: Persona | null;
};

export default function ActaFinales({
  params,
}: {
  // Catch-all opcional para soportar /acta-finales y /acta-finales/:moduloId
  params: Promise<{ moduloId?: string[] }>;
}) {
  const unwrapped = unwrap(params);
  const moduloIdFromUrl = unwrapped.moduloId?.[0];

  const [programas, setProgramas] = useState<ProgramaListItem[]>([]);
  const [programInfo, setProgramInfo] = useState<ProgramaInfo | null>(null);

  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [selPrograma, setSelPrograma] = useState<string>("");
  const [selModulo, setSelModulo] = useState<string>(moduloIdFromUrl ?? "");

  const [rows, setRows] = useState<Row[]>([]);
  const [moduloInfo, setModuloInfo] = useState<Modulo | null>(null);

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // PDF preview state
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const pdfObjectUrlRef = useRef<string | null>(null);

  // ========== LOADERS ==========

  // Programas para el selector
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("programas")
        .select("id, nombre")
        .order("nombre", { ascending: true });
      if (error) console.error(error);
      setProgramas((data as ProgramaListItem[]) ?? []);
    })();
  }, []);

  // Si viene moduloId en URL, precargar su programa y el módulo
  useEffect(() => {
    if (!moduloIdFromUrl) return;
    (async () => {
      const { data, error } = await supabase
        .from("modulos")
        .select(
          'id, nombre_asignatura, numero, programa_id, docente:docente_id ( id, nombre_completo )'
        )
        .eq("id", moduloIdFromUrl)
        .single();
      if (!error && data) {
        setSelPrograma(data.programa_id ?? "");
        setSelModulo(data.id);
        setModuloInfo({
          id: data.id,
          nombre_asignatura: data.nombre_asignatura,
          numero: (data as any).numero ?? null,
          docente: (data as any).docente ?? null,
        });
      }
    })();
  }, [moduloIdFromUrl]);

  // Al cambiar programa => cargar sus módulos + info de programa (versión/sede/modalidad)
  useEffect(() => {
    if (!selPrograma) {
      setModulos([]);
      setSelModulo("");
      setProgramInfo(null);
      return;
    }
    (async () => {
      const [mods, prog] = await Promise.all([
        supabase
          .from("modulos")
          .select(
            'id, nombre_asignatura, numero, docente:docente_id ( id, nombre_completo )'
          )
          .eq("programa_id", selPrograma)
          .order("numero", { ascending: true, nullsFirst: true })
          .order("nombre_asignatura", { ascending: true }),
        supabase
          .from("programas")
          .select('id, nombre, "versión", sede, modalidad')
          .eq("id", selPrograma)
          .single(),
      ]);

      if (mods.error) console.error(mods.error);
      setModulos((mods.data as any) ?? []);
      if (selModulo && !mods.data?.some((m: any) => m.id === selModulo)) {
        setSelModulo("");
      }

      if (!prog.error && prog.data) {
        setProgramInfo(prog.data as any);
      } else {
        setProgramInfo(null);
      }
    })();
  }, [selPrograma]);

  // Al cambiar módulo => cargar filas e info del módulo
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPdfUrl(null);
      if (!selModulo) {
        setRows([]);
        setModuloInfo(null);
        return;
      }
      setLoading(true);
      const [vw, mod] = await Promise.all([
        supabase
          .from("vw_acta_notas_finales")
          .select("*")
          .eq("modulo_id", selModulo)
          .order("alumno_nombre", { ascending: true }),
        supabase
          .from("modulos")
          .select(
            'id, nombre_asignatura, numero, docente:docente_id ( id, nombre_completo )'
          )
          .eq("id", selModulo)
          .single(),
      ]);

      if (!cancelled) {
        if (vw.error) console.error(vw.error);
        setRows(((vw.data as Row[]) ?? []).filter(Boolean));

        if (!mod.error && mod.data) {
          setModuloInfo({
            id: mod.data.id,
            nombre_asignatura: mod.data.nombre_asignatura,
            numero: (mod.data as any).numero ?? null,
            docente: (mod.data as any).docente ?? null,
          });
        } else {
          setModuloInfo(null);
        }
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
  }, [selModulo]);

  const programaNombre = useMemo(() => {
    const p = programas.find((x) => x.id === selPrograma);
    return p?.nombre ?? programInfo?.nombre ?? "";
  }, [programas, selPrograma, programInfo]);

  const heading = useMemo(() => {
    if (!moduloInfo) return "Acta de notas finales";
    return `Acta — ${moduloInfo.nombre_asignatura} (${programaNombre || "Sin programa"})`;
  }, [moduloInfo, programaNombre]);

  // ========== HELPERS ==========

  function formatDDMMYYYY(d = new Date()) {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  async function loadAsDataURL(src: string): Promise<string | null> {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      return await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  // ========== PDF PREVIEW ==========

  async function previewPDF() {
    if (!selModulo || !moduloInfo) return;
    setExporting(true);
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default as any;

      const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
      const pageW = doc.internal.pageSize.getWidth();
      const center = pageW / 2;

      // Logos
      const leftLogo = await loadAsDataURL("/logos/gasprom.png"); // ajusta ruta si es necesario
      const rightLogo = await loadAsDataURL("/logos/unsxx.png");   // ajusta ruta si es necesario
      const logoW = 64; // ancho aprox
      const logoY = 30;
      if (leftLogo) doc.addImage(leftLogo, "PNG", 40, logoY, logoW, logoW, undefined, "FAST");
      if (rightLogo) doc.addImage(rightLogo, "PNG", pageW - 40 - logoW, logoY, logoW, logoW, undefined, "FAST");

      // Encabezado institucional
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text('UNIVERSIDAD NACIONAL "SIGLO XX"', center, 50, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text("DIRECCIÓN DE POSTGRADO", center, 68, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("ACTA DE NOTAS FINALES", center, 96, { align: "center" });

      // Programa
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      const progNombre = (programInfo?.nombre || programaNombre || "—").toUpperCase();
      doc.text(progNombre, center, 118, { align: "center" });

      // Versión • Sede • Modalidad
      const v = (programInfo?.versión ?? "").toUpperCase();
      const s = (programInfo?.sede ?? "").toUpperCase();
      const m = (programInfo?.modalidad ?? "").toUpperCase();
      const linea2 = [v, s, m].filter(Boolean).join(" • ");
      if (linea2) doc.text(linea2, center, 136, { align: "center" });

      // Bloque informativo
      const y0 = 160, xL = 55, xR = pageW - 55;
      const line = (y: number) => doc.line(xL, y, xR, y);
      doc.setLineWidth(0.7);
      line(y0); line(y0 + 24); line(y0 + 48); line(y0 + 72);

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold"); doc.text("MÓDULO:", xL, y0 - 6);
      doc.setFont("helvetica", "normal");
      doc.text(
        `${moduloInfo.numero ? `MÓDULO ${moduloInfo.numero}: ` : ""}${moduloInfo.nombre_asignatura}`,
        xL + 70, y0 - 6
      );

      doc.setFont("helvetica", "bold"); doc.text("DOCENTE:", xL, y0 + 18);
      doc.setFont("helvetica", "normal");
      doc.text(`${moduloInfo.docente?.nombre_completo ?? "________________________"}`, xL + 70, y0 + 18);

      doc.setFont("helvetica", "bold"); doc.text("CARGA HORARIA:", xL, y0 + 42);
      doc.setFont("helvetica", "normal"); doc.text("__________ hrs", xL + 100, y0 + 42);

      doc.setFont("helvetica", "bold"); doc.text("FECHA:", xL, y0 + 66);
      doc.setFont("helvetica", "normal"); doc.text(formatDDMMYYYY(), xL + 50, y0 + 66);

      // Tabla
      const head = [
        [
          { content: "Nº", rowSpan: 2 },
          { content: "APELLIDOS Y NOMBRES", rowSpan: 2 },
          { content: "CALIFICACIONES", colSpan: 2, styles: { halign: "center" } },
          { content: "OBSERVACIONES", rowSpan: 2 },
        ],
        [{ content: "Numeral" }, { content: "Literal" }],
      ];

      const body = rows.map((r, i) => [
        i + 1,
        r.alumno_nombre,
        r.nota_final ?? "",
        r.literal ?? "",
        r.observacion ?? "",
      ]);

      (autoTable)(doc, {
        startY: y0 + 90,
        head,
        body,
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 6, lineWidth: 0.5 },
        headStyles: { fillColor: [235, 235, 235], textColor: 20, fontStyle: "bold" },
        columnStyles: { 0: { cellWidth: 36 }, 2: { cellWidth: 70 }, 3: { cellWidth: 70 } },
        margin: { left: 40, right: 40 },
        tableWidth: "auto",
      });

      // Firmas
      const yEnd = (doc as any).lastAutoTable?.finalY ?? (y0 + 120);
      doc.setFontSize(10);
      doc.text("Esp.", 55, yEnd + 50);
      doc.text("DOCENTE", 55, yEnd + 66);

      // Blob -> iframe preview
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

  // ========== RENDER ==========

  return (
    <div className="p-6 text-slate-100">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{heading}</h1>
        <Link href="/admin/reportes" className="underline text-slate-300">
          Volver
        </Link>
      </div>

      {/* Filtros: Programa y Módulo */}
      <div className="mt-4 grid md:grid-cols-3 gap-3">
        <select
          className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700"
          value={selPrograma}
          onChange={(e) => setSelPrograma(e.target.value)}
        >
          <option value="">— Selecciona un programa —</option>
          {programas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>

        <select
          className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700"
          value={selModulo}
          onChange={(e) => setSelModulo(e.target.value)}
          disabled={!selPrograma}
        >
          <option value="">— Selecciona un módulo —</option>
          {modulos.map((m) => (
            <option key={m.id} value={m.id}>
              {m.numero ? `M${m.numero} — ` : ""}{m.nombre_asignatura}
            </option>
          ))}
        </select>

        <div className="flex gap-2">
          <button
            className="px-4 py-2 rounded-xl bg-[var(--primary,#6366f1)] text-white disabled:opacity-50"
            onClick={previewPDF}
            disabled={!selModulo || loading || exporting}
          >
            {exporting ? "Generando…" : "Vista previa PDF"}
          </button>
          <button
            className="px-4 py-2 rounded-xl border border-slate-700"
            onClick={() => {
              if (pdfObjectUrlRef.current) {
                const w = window.open(pdfObjectUrlRef.current, "_blank");
                if (w) w.focus();
              }
            }}
            disabled={!pdfUrl}
          >
            Imprimir / Guardar
          </button>
        </div>
      </div>

      <div className="mt-2 text-sm text-slate-300">
        {loading && <span>Cargando datos…</span>}
        {!loading && !selModulo && (
          <span>Elige un programa y un módulo para generar el acta.</span>
        )}
        {!loading && selModulo && rows.length === 0 && (
          <span>No hay alumnos/Notas para este módulo.</span>
        )}
      </div>

      {/* PREVIEW PDF */}
      <div className="mt-4">
        <div className="w-full h-[75vh] border border-slate-700 rounded-xl overflow-hidden bg-white">
          {pdfUrl ? (
            <iframe src={pdfUrl} className="w-full h-full" />
          ) : (
            <div className="p-4 text-slate-400">
              Sin vista previa. Genera el PDF con el botón “Vista previa PDF”.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
