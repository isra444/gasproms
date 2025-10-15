"use client";

import { useEffect, useMemo, useRef, useState, use as unwrap } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// ========== Tipos ==========
type ProgramaItem = { id: string; nombre: string };
type ProgramaInfo = {
  id: string;
  nombre: string;
  // ¡en tu BD el campo se llama con tilde!
  versión: string | null;
  sede: string | null;
  modalidad: string | null;
};

type Persona = { id: string; nombre_completo: string | null };

type ModuloInfo = {
  id: string;
  nombre_asignatura: string;
  numero: number | null;
  docente?: Persona | null;
};

type Fila = {
  alumno_id: string;
  nombre_completo: string;
  correo: string | null;
  celular: string | null;

  asistencia: number | null;
  teoria: number | null;
  practica: number | null;
  examen_final: number | null;
  nota_final: number | null;
  literal: string | null;
  observacion: string | null;
};

type Mensaje = { id: string; contenido: string | null; fecha: string | null; docente?: Persona | null };

// ========== Página ==========
export default function InformeModulo({
  params,
}: {
  params: Promise<{ moduloId?: string[] }>;
}) {
  const unwrapped = unwrap(params);
  const moduloIdFromUrl = unwrapped.moduloId?.[0];

  // Estado UI
  const [programas, setProgramas] = useState<ProgramaItem[]>([]);
  const [programInfo, setProgramInfo] = useState<ProgramaInfo | null>(null);

  const [modulos, setModulos] = useState<ModuloInfo[]>([]);
  const [selPrograma, setSelPrograma] = useState<string>("");
  const [selModulo, setSelModulo] = useState<string>(moduloIdFromUrl ?? "");

  const [filas, setFilas] = useState<Fila[]>([]);
  const [moduloInfo, setModuloInfo] = useState<ModuloInfo | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // PDF preview
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const pdfObjectUrlRef = useRef<string | null>(null);

  // ========== Helpers ==========
  function ddmmyyyy(d: Date | string | null | undefined) {
    if (!d) return "—";
    const date = typeof d === "string" ? new Date(d) : d;
    const p = (n: number) => String(n).padStart(2, "0");
    return `${p(date.getDate())}/${p(date.getMonth() + 1)}/${date.getFullYear()}`;
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

  function avg(nums: Array<number | null | undefined>) {
    const vals = nums.filter((n): n is number => typeof n === "number");
    if (!vals.length) return null;
    const s = vals.reduce((a, b) => a + b, 0);
    return Math.round((s / vals.length) * 100) / 100;
  }

  // KPIs
  const kpis = useMemo(() => {
    const total = filas.length;
    const conNota = filas.filter((f) => f.nota_final != null).length;
    const aprobados = filas.filter(
      (f) =>
        (f.literal && f.literal.toUpperCase() === "APROBADO") ||
        (typeof f.nota_final === "number" && f.nota_final >= 51)
    ).length;
    const abandonos = filas.filter((f) => (f.literal ?? "").toUpperCase() === "ABANDONO").length;
    const reprobados = filas.filter(
      (f) =>
        (f.literal && f.literal.toUpperCase() === "REPROBADO") ||
        (typeof f.nota_final === "number" && f.nota_final < 51)
    ).length;

    return { total, conNota, aprobados, reprobados, abandonos };
  }, [filas]);

  const promedios = useMemo(
    () => ({
      asistencia: avg(filas.map((f) => f.asistencia)),
      teoria: avg(filas.map((f) => f.teoria)),
      practica: avg(filas.map((f) => f.practica)),
      examen_final: avg(filas.map((f) => f.examen_final)),
      nota_final: avg(filas.map((f) => f.nota_final)),
    }),
    [filas]
  );

  const programaNombre = useMemo(() => {
    const p = programas.find((x) => x.id === selPrograma);
    return p?.nombre ?? programInfo?.nombre ?? "";
  }, [programas, selPrograma, programInfo]);

  const heading = useMemo(() => {
    if (!moduloInfo) return "Informe detallado del módulo";
    return `Informe — ${moduloInfo.nombre_asignatura} (${programaNombre || "Sin programa"})`;
  }, [moduloInfo, programaNombre]);

  // ========== Loads ==========

  // Programas
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

  // Si viene modulo en URL
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

  // Al elegir programa: módulos + info del programa
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

  // Al cambiar módulo: filas (alumnos + notas), info del módulo, mensajes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPdfUrl(null);
      if (!selModulo) {
        setFilas([]);
        setModuloInfo(null);
        setMensajes([]);
        return;
      }
      setLoading(true);

      const [ins, mod, msgs] = await Promise.all([
        supabase
          .from("alumnos_modulos")
          .select(`
            id,
            estado,
            alumno:alumno_id ( id, nombre_completo, correo, celular ),
            nota:notas ( asistencia, teoria, practica, examen_final, nota_final, literal, observacion )
          `)
          .eq("modulo_id", selModulo)
          .order("id", { ascending: true }),
        supabase
          .from("modulos")
          .select(
            'id, nombre_asignatura, numero, docente:docente_id ( id, nombre_completo )'
          )
          .eq("id", selModulo)
          .single(),
        supabase
          .from("mensajes_modulo")
          .select('id, contenido, fecha, docente:docente_id ( id, nombre_completo )')
          .eq("modulo_id", selModulo)
          .order("fecha", { ascending: true }),
      ]);

      if (!cancelled) {
        if (ins.error) console.error(ins.error);
        const mapped: Fila[] =
          (ins.data ?? []).map((r: any) => ({
            alumno_id: r.alumno?.id,
            nombre_completo: r.alumno?.nombre_completo ?? "—",
            correo: r.alumno?.correo ?? null,
            celular: r.alumno?.celular ?? null,
            asistencia: r.nota?.[0]?.asistencia ?? null,
            teoria: r.nota?.[0]?.teoria ?? null,
            practica: r.nota?.[0]?.practica ?? null,
            examen_final: r.nota?.[0]?.examen_final ?? null,
            nota_final: r.nota?.[0]?.nota_final ?? null,
            literal: r.nota?.[0]?.literal ?? null,
            observacion: r.nota?.[0]?.observacion ?? null,
          })) ?? [];
        setFilas(mapped);

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

        if (!msgs.error) setMensajes((msgs.data as any) ?? []);

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

  // ========== PDF ==========
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
      const leftLogo = await loadAsDataURL("/logos/gasprom.png");
      const rightLogo = await loadAsDataURL("/logos/unsxx.png");
      const logoW = 64;
      const logoY = 26;
      if (leftLogo) doc.addImage(leftLogo, "PNG", 40, logoY, logoW, logoW, undefined, "FAST");
      if (rightLogo) doc.addImage(rightLogo, "PNG", pageW - 40 - logoW, logoY, logoW, logoW, undefined, "FAST");

      // Encabezado institucional
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text('UNIVERSIDAD NACIONAL "SIGLO XX"', center, 46, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text("DIRECCIÓN DE POSTGRADO", center, 64, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("INFORME DETALLADO DEL MÓDULO", center, 92, { align: "center" });

      // Programa
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      const progNombre = (programInfo?.nombre || programaNombre || "—").toUpperCase();
      doc.text(progNombre, center, 114, { align: "center" });

      // Versión • Sede • Modalidad
      const v = (programInfo?.versión ?? "").toUpperCase();
      const s = (programInfo?.sede ?? "").toUpperCase();
      const m = (programInfo?.modalidad ?? "").toUpperCase();
      const linea2 = [v, s, m].filter(Boolean).join(" • ");
      if (linea2) doc.text(linea2, center, 132, { align: "center" });

      // Bloque informativo (Módulo/Docente/Fecha)
      const y0 = 154, xL = 55, xR = pageW - 55;
      const line = (y: number) => doc.line(xL, y, xR, y);
      doc.setLineWidth(0.7);
      line(y0); line(y0 + 24); line(y0 + 48);

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

      doc.setFont("helvetica", "bold"); doc.text("FECHA:", xL, y0 + 42);
      doc.setFont("helvetica", "normal"); doc.text(ddmmyyyy(new Date()), xL + 50, y0 + 42);

      // KPIs (tabla pequeña 2 columnas x 3 filas)
      const kpiRows = [
        ["Inscritos", String(kpis.total)],
        ["Con nota", String(kpis.conNota)],
        ["Aprobados", String(kpis.aprobados)],
        ["Reprobados", String(kpis.reprobados)],
        ["Abandonos", String(kpis.abandonos)],
      ];
      (autoTable)(doc, {
        startY: y0 + 64,
        head: [["INDICADOR", "VALOR"]],
        body: kpiRows,
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [235, 235, 235], textColor: 20, fontStyle: "bold" },
        margin: { left: 40, right: 320 }, // ubicar a la izquierda
        tableWidth: 220,
      });

      // Promedios (a la derecha)
      const promRows = [
        ["Asistencia", promedios.asistencia ?? "—"],
        ["Teoría", promedios.teoria ?? "—"],
        ["Práctica", promedios.practica ?? "—"],
        ["Ex. Final", promedios.examen_final ?? "—"],
        ["Nota Final", promedios.nota_final ?? "—"],
      ];
      (autoTable)(doc, {
        startY: y0 + 64,
        head: [["PROMEDIO", "VALOR"]],
        body: promRows.map((r) => [r[0], typeof r[1] === "number" ? `${r[1]}` : "—"]),
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [235, 235, 235], textColor: 20, fontStyle: "bold" },
        margin: { left: pageW - 40 - 220, right: 40 }, // a la derecha
        tableWidth: 220,
      });

      // Tabla de calificaciones (desglosada)
      const startYDetail = (doc as any).lastAutoTable?.finalY
        ? (doc as any).lastAutoTable.finalY + 20
        : y0 + 180;

      const head = [
        [
          { content: "Nº", rowSpan: 2 },
          { content: "ALUMNO", rowSpan: 2 },
          { content: "CALIFICACIONES", colSpan: 6, styles: { halign: "center" } },
        ],
        [
          { content: "Asist." },
          { content: "Teoría" },
          { content: "Práctica" },
          { content: "Ex. Final" },
          { content: "Nota Final" },
          { content: "Literal" },
        ],
      ];

      const body = filas.map((r, i) => [
        i + 1,
        r.nombre_completo,
        r.asistencia ?? "",
        r.teoria ?? "",
        r.practica ?? "",
        r.examen_final ?? "",
        r.nota_final ?? "",
        r.literal ?? "",
      ]);

      (autoTable)(doc, {
        startY: startYDetail,
        head,
        body,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
        headStyles: { fillColor: [235, 235, 235], textColor: 20, fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 24, halign: "center" },
          1: { cellWidth: 240 },
          2: { cellWidth: 60 },
          3: { cellWidth: 60 },
          4: { cellWidth: 60 },
          5: { cellWidth: 70 },
          6: { cellWidth: 70 },
          7: { cellWidth: 70 },
        },
        margin: { left: 32, right: 32 },
        tableWidth: doc.internal.pageSize.getWidth() - 64,
      });

      // Observaciones del docente / mensajes del módulo
      const yMsgs = (doc as any).lastAutoTable?.finalY
        ? (doc as any).lastAutoTable.finalY + 18
        : undefined;

      if (mensajes.length) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Observaciones / Mensajes del módulo", 40, yMsgs ?? (startYDetail + 200));

        const msgsRows = mensajes.map((m, idx) => [
          idx + 1,
          ddmmyyyy(m.fecha),
          m.docente?.nombre_completo ?? "—",
          m.contenido ?? "",
        ]);

        (autoTable)(doc, {
          startY: (yMsgs ?? startYDetail + 200) + 8,
          head: [["#", "Fecha", "Autor", "Contenido"]],
          body: msgsRows,
          theme: "grid",
          styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
          headStyles: { fillColor: [235, 235, 235], textColor: 20, fontStyle: "bold" },
          columnStyles: {
            0: { cellWidth: 20, halign: "center" },
            1: { cellWidth: 70 },
            2: { cellWidth: 180 },
            3: { cellWidth: doc.internal.pageSize.getWidth() - 40 - 20 - 70 - 180 - 40 },
          },
          margin: { left: 32, right: 32 },
        });
      }

      // Firmas
      const yEnd = (doc as any).lastAutoTable?.finalY ?? (y0 + 220);
      doc.setFontSize(10);
      doc.text("Esp.", 55, yEnd + 50);
      doc.text("DOCENTE", 55, yEnd + 66);

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

  // ========== Render ==========
  return (
    <div className="p-6 text-slate-100">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{heading}</h1>
        <Link href="/admin/reportes" className="underline text-slate-300">
          Volver
        </Link>
      </div>

      {/* Filtros */}
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
        {!loading && !selModulo && <span>Elige un programa y un módulo para generar el informe.</span>}
        {!loading && selModulo && filas.length === 0 && <span>No hay inscripciones/notas para este módulo.</span>}
      </div>

      {/* PREVIEW */}
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
