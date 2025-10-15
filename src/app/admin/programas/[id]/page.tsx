// src/app/admin/programas/[id]/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Programa = {
  id: string;
  nombre: string;
  grado_academico: string | null;
  versión: string | null;
  modalidad: string | null;
  sede: string | null; // usado como "DEPARTAMENTO" en encabezado
  fecha_inicio: string | null;
  fecha_fin: string | null;
  coordinador_id: string | null;
  coordinador?: { id: string; nombre_completo: string; correo: string } | null;
};

type Persona = { id: string; nombre_completo: string; correo: string };

type Modulo = {
  id: string;
  nombre_asignatura: string;
  numero: number | null;          // número de módulo
  docente_id: string | null;
  docente?: Persona | null;
};

export default function ProgramaDetallePage() {
  const { id } = useParams() as { id: string };

  const [prog, setProg] = useState<Programa | null>(null);
  const [mods, setMods] = useState<Modulo[]>([]);
  const [docentes, setDocentes] = useState<Persona[]>([]);
  const [alumnos, setAlumnos] = useState<Persona[]>([]);

  // Crear módulo
  const [mNombre, setMNombre] = useState("");
  const [mNumero, setMNumero] = useState<string>("");

  // Gestionar alumnos por módulo
  const [openModulo, setOpenModulo] = useState<string | null>(null);
  const [inscritosPorModulo, setInscritosPorModulo] = useState<Record<string, Persona[]>>({});
  const [qAlumno, setQAlumno] = useState("");

  // Reportes
  const [openReportModulo, setOpenReportModulo] = useState<string | null>(null);
  const [reportType, setReportType] = useState<"inscritos" | "acta-final" | "acta-desglosada">("inscritos");
  const [exporting, setExporting] = useState(false);

  // Preview
  const [previewKind, setPreviewKind] = useState<null | "html" | "pdf">(null);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const pdfObjectUrlRef = useRef<string | null>(null);

  // ==== Helpers ====
  const candidatosAlumno = useMemo(() => {
    if (!openModulo) return [];
    const inscritos = inscritosPorModulo[openModulo] ?? [];
    const ya = new Set(inscritos.map((a) => a.id));
    const s = qAlumno.toLowerCase();
    return alumnos
      .filter((a) => !ya.has(a.id))
      .filter((a) => a.nombre_completo?.toLowerCase().includes(s) || a.correo?.toLowerCase().includes(s));
  }, [alumnos, inscritosPorModulo, openModulo, qAlumno]);

  useEffect(() => {
    loadPrograma();
    loadModulos();
    loadDocentes();
    loadAlumnos();
    return () => {
      if (pdfObjectUrlRef.current) {
        URL.revokeObjectURL(pdfObjectUrlRef.current);
        pdfObjectUrlRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadPrograma() {
    const { data } = await supabase
      .from("programas")
      .select("*, coordinador:coordinador_id ( id, nombre_completo, correo )")
      .eq("id", id)
      .single();
    setProg(data as any);
  }

  async function loadModulos() {
    const { data, error } = await supabase
      .from("modulos")
      .select("id, nombre_asignatura, numero, docente_id, docente:docente_id ( id, nombre_completo, correo )")
      .eq("programa_id", id)
      .order("numero", { ascending: true, nullsFirst: true })
      .order("nombre_asignatura", { ascending: true });
    if (error) console.error(error);
    setMods((data as any) ?? []);
  }

  async function loadDocentes() {
    const { data, error } = await supabase
      .from("usuarios")
      .select("id, nombre_completo, correo, roles_usuario!inner(rol)")
      .eq("roles_usuario.rol", "docente")
      .order("nombre_completo");
    if (error) console.error(error);
    setDocentes((data as any) ?? []);
  }

  async function loadAlumnos() {
    const { data, error } = await supabase
      .from("usuarios")
      .select("id, nombre_completo, correo, roles_usuario!inner(rol)")
      .eq("roles_usuario.rol", "alumno")
      .order("nombre_completo");
    if (error) console.error(error);
    setAlumnos((data as any) ?? []);
  }

  async function loadInscritos(moduloId: string) {
    const { data, error } = await supabase
      .from("alumnos_modulos")
      .select("alumno:alumno_id ( id, nombre_completo, correo )")
      .eq("modulo_id", moduloId);
    if (error) console.error(error);
    setInscritosPorModulo((prev) => ({
      ...prev,
      [moduloId]: ((data as any) ?? []).map((x: any) => x.alumno),
    }));
  }

  // ==== Crear / actualizar / borrar módulo ====
  async function crearModulo() {
    if (!mNombre.trim()) return alert("El nombre de la asignatura es obligatorio.");
    const n = Number(mNumero);
    const numeroVal = Number.isFinite(n) && n > 0 ? n : null;

    const { error } = await supabase
      .from("modulos")
      .insert([{ programa_id: id, nombre_asignatura: mNombre.trim(), numero: numeroVal }]);

    if (error) {
      console.error("Insert módulo:", error);
      alert(/(duplicate|unique)/i.test(error.message) ? "Ya existe un módulo con ese número en este programa." : error.message);
      return;
    }
    setMNombre("");
    setMNumero("");
    await loadModulos();
  }

  async function asignarDocente(moduloId: string, docenteId: string) {
    const { error } = await supabase.from("modulos").update({ docente_id: docenteId || null }).eq("id", moduloId);
    if (error) {
      console.error("Actualizar docente_id falló:", error);
      alert(/row-level security|RLS/i.test(error.message) ? "Permisos insuficientes (RLS): requiere rol admin o coordinador." : error.message);
      return;
    }
    await loadModulos();
  }

  async function eliminarModulo(moduloId: string) {
    if (!confirm("¿Eliminar este módulo?")) return;
    const { error } = await supabase.from("modulos").delete().eq("id", moduloId);
    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }
    setInscritosPorModulo((prev) => {
      const copy = { ...prev };
      delete copy[moduloId];
      return copy;
    });
    await loadModulos();
  }

  // ==== Inscripciones ====
  async function agregarAlumno(moduloId: string, alumnoId: string) {
    const { error } = await supabase.from("alumnos_modulos").insert([{ modulo_id: moduloId, alumno_id: alumnoId }]);
    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }
    await loadInscritos(moduloId);
  }

  async function quitarAlumno(moduloId: string, alumnoId: string) {
    if (!confirm("¿Quitar alumno del módulo?")) return;
    const { error } = await supabase.from("alumnos_modulos").delete().match({ modulo_id: moduloId, alumno_id: alumnoId });
    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }
    await loadInscritos(moduloId);
  }

  // ==== Reportes ====
  async function fetchReporteData(moduloId: string) {
    const { data, error } = await supabase
      .from("alumnos_modulos")
      .select(`
        id,
        estado,
        alumno:alumno_id (
          id,
          nombre_completo,
          correo,
          celular,
          género,
          profesión,
          universidad_titulado,
          fecha_inscripción,
          estado,
          cedula,
          expedido
        ),
        nota:notas ( asistencia, teoria, practica, examen_final, nota_final, literal, observacion )
      `)
      .eq("modulo_id", moduloId)
      .order("id", { ascending: true });

    if (error) throw error;

    const rows = (data ?? []).map((r: any) => ({
      alumno_id: r.alumno?.id,
      nombre_completo: r.alumno?.nombre_completo ?? "—",
      correo: r.alumno?.correo ?? "—",
      celular: r.alumno?.celular ?? "—",
      genero: r.alumno?.género ?? r.alumno?.genero ?? "—",
      profesion: r.alumno?.profesión ?? r.alumno?.profesion ?? "—",
      universidad_titulado: r.alumno?.universidad_titulado ?? "—",
      fecha_inscripcion: r.alumno?.fecha_inscripción ?? r.alumno?.fecha_inscripcion ?? null,
      estado: r.alumno?.estado ?? r.estado ?? "activo",
      cedula: r.alumno?.cedula ?? "—",
      expedido: r.alumno?.expedido ?? "—",
      asistencia: r.nota?.[0]?.asistencia ?? null,
      teoria: r.nota?.[0]?.teoria ?? null,
      practica: r.nota?.[0]?.practica ?? null,
      examen_final: r.nota?.[0]?.examen_final ?? null,
      nota_final: r.nota?.[0]?.nota_final ?? null,
      literal: r.nota?.[0]?.literal ?? null,
      observacion: r.nota?.[0]?.observacion ?? null,
    }));

    return rows;
  }

  // ← FALTABA: prepara filas para vista previa HTML según tipo de reporte
  async function buildPreview(moduloId: string) {
    const data = await fetchReporteData(moduloId);

    if (reportType === "inscritos") {
      return data.map((r: any, i: number) => ({
        N: i + 1,
        CEDULA: r.cedula,
        EXPEDIDO: r.expedido,
        NOMBRE: r.nombre_completo,
        GENERO: r.genero,
        PROFESION: r.profesion,
        UNIVERSIDAD_TITULADO: r.universidad_titulado,
        CELULAR: r.celular,
        CORREO: r.correo,
        FECHA_INSCRIPCION: r.fecha_inscripcion ? String(r.fecha_inscripcion).slice(0, 10) : "—",
      }));
    }

    if (reportType === "acta-final") {
      return data.map((r: any) => ({
        ALUMNO: r.nombre_completo,
        CORREO: r.correo,
        ASISTENCIA: r.asistencia ?? "",
        EXAMEN_FINAL: r.examen_final ?? "",
        NOTA_FINAL: r.nota_final ?? "",
        LITERAL: r.literal ?? "",
        OBS: r.observacion ?? "",
      }));
    }

    // acta-desglosada
    return data.map((r: any) => ({
      ALUMNO: r.nombre_completo,
      CORREO: r.correo,
      ASISTENCIA: r.asistencia ?? "",
      TEORIA: r.teoria ?? "",
      PRACTICA: r.practica ?? "",
      EXAMEN_FINAL: r.examen_final ?? "",
      NOTA_FINAL: r.nota_final ?? "",
      LITERAL: r.literal ?? "",
      OBS: r.observacion ?? "",
    }));
  }

  function makeFilename(base: string, ext: "xlsx" | "pdf") {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(
      now.getHours()
    )}${pad(now.getMinutes())}`;
    return `${base}_${stamp}.${ext}`;
  }

  // Excel
  async function exportExcel(modulo: Modulo) {
    setExporting(true);
    try {
      const ExcelJS: any = await import("exceljs");
      const data = await fetchReporteData(modulo.id);

      let columns: { header: string; key: string; width?: number }[] = [];
      let rows: any[] = [];
      let sheetName = "";

      if (reportType === "inscritos") {
        sheetName = "Inscritos";
        columns = [
          { header: "N°", key: "n", width: 6 },
          { header: "Cédula identidad", key: "cedula", width: 18 },
          { header: "Expedido", key: "expedido", width: 12 },
          { header: "Nombre completo", key: "nombre_completo", width: 32 },
          { header: "Género", key: "genero", width: 10 },
          { header: "Profesión", key: "profesion", width: 18 },
          { header: "Universidad titulado", key: "universidad_titulado", width: 28 },
          { header: "Celular", key: "celular", width: 14 },
          { header: "Correo electrónico", key: "correo", width: 30 },
          { header: "Fecha inscripción", key: "fecha_inscripcion", width: 16 },
        ];
        rows = data.map((r, idx) => ({
          n: idx + 1,
          ...r,
          fecha_inscripcion: r.fecha_inscripcion ? String(r.fecha_inscripcion).slice(0, 10) : "—",
        }));
      } else if (reportType === "acta-final") {
        sheetName = "Acta Final";
        columns = [
          { header: "Alumno", key: "nombre_completo", width: 32 },
          { header: "Correo", key: "correo", width: 28 },
          { header: "Asistencia", key: "asistencia", width: 12 },
          { header: "Examen Final", key: "examen_final", width: 14 },
          { header: "Nota Final", key: "nota_final", width: 12 },
          { header: "Literal", key: "literal", width: 10 },
          { header: "Observación", key: "observacion", width: 24 },
        ];
        rows = data;
      } else {
        sheetName = "Acta Desglosada";
        columns = [
          { header: "Alumno", key: "nombre_completo", width: 32 },
          { header: "Correo", key: "correo", width: 28 },
          { header: "Asistencia", key: "asistencia", width: 12 },
          { header: "Teoría", key: "teoria", width: 10 },
          { header: "Práctica", key: "practica", width: 10 },
          { header: "Examen Final", key: "examen_final", width: 14 },
          { header: "Nota Final", key: "nota_final", width: 12 },
          { header: "Literal", key: "literal", width: 10 },
          { header: "Observación", key: "observacion", width: 24 },
        ];
        rows = data;
      }

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(sheetName);
      ws.columns = columns;
      ws.addRows(rows);
      ws.getRow(1).font = { bold: true };

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const filename = makeFilename(`${modulo.nombre_asignatura.replace(/\s+/g, "_")}_${reportType}`, "xlsx");

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("exportExcel error:", e);
      alert("No se pudo generar el Excel. Revisa la consola para más detalles.");
    } finally {
      setExporting(false);
    }
  }

  // PDF (descargar)
  async function exportPDF(modulo: Modulo, programaNombre: string) {
    setExporting(true);
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const orientation = reportType === "inscritos" || reportType === "acta-desglosada" ? "landscape" : "portrait";
      const doc = new jsPDF({ unit: "pt", format: "a4", orientation });
      const pageWidth = doc.internal.pageSize.getWidth();
      const centerX = pageWidth / 2;

      // Encabezado
      doc.setFontSize(11); doc.setFont("helvetica","bold"); doc.text("POSTGRADO", centerX, 40, { align:"center" });
      doc.setFontSize(13); doc.text("UNIVERSIDAD NACIONAL SIGLO XX", centerX, 60, { align:"center" });
      doc.setFontSize(10); doc.setFont("helvetica","normal"); doc.text("CONVENIO: GASPROMs S.R.L.", centerX, 78, { align:"center" });
      doc.setFont("helvetica","bold");
      doc.text(`PROGRAMA: ${programaNombre || "—"}`, centerX, 98, { align: "center" });
      doc.text(`VERSIÓN: ${prog?.versión || "—"}`, centerX, 116, { align: "center" });
      doc.text(`DEPARTAMENTO: ${prog?.sede || "—"}`, centerX, 134, { align: "center" });
      doc.setFontSize(12);
      doc.text(
        reportType === "inscritos" ? "LISTA DE ALUMNOS INSCRITOS" :
        reportType === "acta-final" ? "ACTA DE NOTAS (FINAL)" : "ACTA DE NOTAS (DESGLOSADA)",
        centerX, 158, { align:"center" }
      );

      const data = await fetchReporteData(modulo.id);
      let head: string[] = [];
      let body: any[][] = [];

      if (reportType === "inscritos") {
        head = ["N°","CÉDULA IDENTIDAD","EXPEDIDO","NOMBRE COMPLETO","GÉNERO","PROFESIÓN","UNIVERSIDAD TITULADO","CELULAR","CORREO ELECTRÓNICO","FECHA DE INSCRIPCIÓN"];
        body = data.map((r, idx) => [idx + 1, r.cedula, r.expedido, r.nombre_completo, r.genero, r.profesion, r.universidad_titulado, r.celular, r.correo, r.fecha_inscripcion ? String(r.fecha_inscripcion).slice(0,10) : "—"]);
      } else if (reportType === "acta-final") {
        head = ["ALUMNO","CORREO","ASISTENCIA","EXAMEN FINAL","NOTA FINAL","LITERAL","OBS."];
        body = data.map((r) => [r.nombre_completo, r.correo, r.asistencia ?? "", r.examen_final ?? "", r.nota_final ?? "", r.literal ?? "", r.observacion ?? ""]);
      } else {
        head = ["ALUMNO","CORREO","ASIST.","TEORÍA","PRÁCTICA","EX. FINAL","NOTA FIN.","LITERAL","OBS."];
        body = data.map((r) => [r.nombre_completo, r.correo, r.asistencia ?? "", r.teoria ?? "", r.practica ?? "", r.examen_final ?? "", r.nota_final ?? "", r.literal ?? "", r.observacion ?? ""]);
      }

      (autoTable as any)(doc, {
        startY: 180,
        head: [head],
        body,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
        headStyles: { fillColor: [230,230,230], textColor: 20, fontStyle: "bold" },
        margin: { left: 24, right: 24 },
        tableWidth: "auto",
      });

      const filename = makeFilename(`${modulo.nombre_asignatura.replace(/\s+/g, "_")}_${reportType}`, "pdf");
      doc.save(filename);
    } catch (e) {
      console.error("exportPDF error:", e);
      alert("No se pudo generar el PDF. Revisa la consola para más detalles.");
    } finally {
      setExporting(false);
    }
  }

  // PDF (preview en iframe)
  async function previewPDF(modulo: Modulo, programaNombre: string) {
    setExporting(true);
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const orientation = reportType === "inscritos" || reportType === "acta-desglosada" ? "landscape" : "portrait";
      const doc = new jsPDF({ unit: "pt", format: "a4", orientation });
      const pageWidth = doc.internal.pageSize.getWidth();
      const centerX = pageWidth / 2;

      // Encabezado
      doc.setFontSize(11); doc.setFont("helvetica","bold"); doc.text("POSTGRADO", centerX, 40, { align:"center" });
      doc.setFontSize(13); doc.text("UNIVERSIDAD NACIONAL SIGLO XX", centerX, 60, { align:"center" });
      doc.setFontSize(10); doc.setFont("helvetica","normal"); doc.text("CONVENIO: GASPROMs S.R.L.", centerX, 78, { align:"center" });
      doc.setFont("helvetica","bold");
      doc.text(`PROGRAMA: ${programaNombre || "—"}`, centerX, 98, { align: "center" });
      doc.text(`VERSIÓN: ${prog?.versión || "—"}`, centerX, 116, { align: "center" });
      doc.text(`DEPARTAMENTO: ${prog?.sede || "—"}`, centerX, 134, { align: "center" });
      doc.setFontSize(12);
      doc.text(
        reportType === "inscritos" ? "LISTA DE ALUMNOS INSCRITOS" :
        reportType === "acta-final" ? "ACTA DE NOTAS (FINAL)" : "ACTA DE NOTAS (DESGLOSADA)",
        centerX, 158, { align:"center" }
      );

      const rows = await fetchReporteData(modulo.id);
      let head: string[][] = [];
      let body: any[][] = [];

      if (reportType === "inscritos") {
        head = [[ "N°","CÉDULA IDENTIDAD","EXPEDIDO","NOMBRE COMPLETO","GÉNERO","PROFESIÓN","UNIVERSIDAD TITULADO","CELULAR","CORREO ELECTRÓNICO","FECHA DE INSCRIPCIÓN" ]];
        body = rows.map((r, idx) => [idx + 1, r.cedula, r.expedido, r.nombre_completo, r.genero, r.profesion, r.universidad_titulado, r.celular, r.correo, r.fecha_inscripcion ? String(r.fecha_inscripcion).slice(0,10) : "—"]);
      } else if (reportType === "acta-final") {
        head = [[ "ALUMNO","CORREO","ASISTENCIA","EXAMEN FINAL","NOTA FINAL","LITERAL","OBS." ]];
        body = rows.map((r) => [r.nombre_completo, r.correo, r.asistencia ?? "", r.examen_final ?? "", r.nota_final ?? "", r.literal ?? "", r.observacion ?? ""]);
      } else {
        head = [[ "ALUMNO","CORREO","ASIST.","TEORÍA","PRÁCTICA","EX. FINAL","NOTA FIN.","LITERAL","OBS." ]];
        body = rows.map((r) => [r.nombre_completo, r.correo, r.asistencia ?? "", r.teoria ?? "", r.practica ?? "", r.examen_final ?? "", r.nota_final ?? "", r.literal ?? "", r.observacion ?? ""]);
      }

      (autoTable as any)(doc, {
        startY: 180,
        head,
        body,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
        headStyles: { fillColor: [230,230,230], textColor: 20, fontStyle: "bold" },
        margin: { left: 24, right: 24 },
        tableWidth: "auto",
      });

      const blob = doc.output("blob");
      const objectUrl = URL.createObjectURL(blob);
      if (pdfObjectUrlRef.current) URL.revokeObjectURL(pdfObjectUrlRef.current);
      pdfObjectUrlRef.current = objectUrl;
      setPdfUrl(objectUrl);
      setPreviewKind("pdf");
    } catch (e) {
      console.error("previewPDF error:", e);
      alert("No se pudo generar la vista previa PDF.");
    } finally {
      setExporting(false);
    }
  }

  // Tabla simple para preview HTML
  function PreviewTable({ rows }: { rows: any[] }) {
    if (!rows.length) return <div className="text-sm text-[var(--text-muted)]">Sin datos para previsualizar.</div>;
    const cols = Object.keys(rows[0]);
    return (
      <div className="overflow-x-auto rounded-xl border border-[var(--muted)]">
        <table className="min-w-full text-xs">
          <thead className="bg-[var(--panel)]">
            <tr>
              {cols.map((c) => (
                <th key={c} className="text-left p-2 uppercase tracking-wide">{c.replaceAll("_", " ")}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-[var(--muted)]">
                {cols.map((c) => (
                  <td key={c} className="p-2 whitespace-nowrap">{r[c]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ==== Render ====
  if (!prog) return <div className="p-6">Cargando…</div>;

  return (
    <div className="p-6 space-y-8">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{prog.nombre}</h1>
          <p className="text-sm text-[var(--text-muted)]">
            {prog.grado_academico || "—"} • {prog.versión || "—"} • {prog.modalidad || "—"} • {prog.sede || "—"}
          </p>
          <p className="text-sm text-[var(--text-muted)]">
            {prog.fecha_inicio || "¿inicio?"} → {prog.fecha_fin || "¿fin?"} {prog.coordinador ? `• Coord.: ${prog.coordinador.nombre_completo}` : ""}
          </p>
        </div>
        <a href="/admin/programas" className="px-3 py-2 rounded-xl border border-[var(--muted)]">← Volver a Programas</a>
      </div>

      {/* Módulos */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Módulos</h2>

        {/* Crear módulo */}
        <div className="grid md:grid-cols-5 gap-3 rounded-2xl border border-[var(--muted)] p-4">
          <input
            placeholder="N°"
            type="number"
            min={1}
            className="px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--muted)]"
            value={mNumero}
            onChange={(e) => setMNumero(e.target.value)}
          />
          <input
            placeholder="Nombre de la asignatura *"
            className="px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--muted)] md:col-span-3"
            value={mNombre}
            onChange={(e) => setMNombre(e.target.value)}
          />
          <button onClick={crearModulo} className="px-4 py-2 rounded-xl bg-[var(--success)] text-white">Añadir módulo</button>
        </div>

        {/* Lista módulos */}
        <div className="overflow-x-auto rounded-2xl border border-[var(--muted)]">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--panel)]">
              <tr>
                <th className="text-left p-3">Asignatura</th>
                <th className="text-left p-3">Docente</th>
                <th className="text-left p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {mods.map((m) => (
                <tr key={m.id} className="border-t border-[var(--muted)] align-top">
                  <td className="p-3">{m.numero ? `M${m.numero} — ` : ""}{m.nombre_asignatura}</td>
                  <td className="p-3">
                    <select
                      value={m.docente_id ?? ""}
                      onChange={(e) => asignarDocente(m.id, e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--muted)]"
                    >
                      <option value="">— Sin docente —</option>
                      {docentes.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nombre_completo} ({d.correo})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3 space-x-2">
                    <button
                      onClick={() => { setOpenModulo(openModulo === m.id ? null : m.id); setQAlumno(""); if (openModulo !== m.id) loadInscritos(m.id); }}
                      className="px-3 py-1 rounded-lg bg-[var(--primary)] text-white"
                    >
                      {openModulo === m.id ? "Cerrar alumnos" : "Gestionar alumnos"}
                    </button>

                    <button
                      onClick={() => { setOpenReportModulo(openReportModulo === m.id ? null : m.id); setReportType("inscritos"); setPreviewKind(null); setPdfUrl(null); }}
                      className="px-3 py-1 rounded-lg bg-[var(--panel)] border border-[var(--muted)]"
                    >
                      Reportes
                    </button>

                    <button onClick={() => eliminarModulo(m.id)} className="px-3 py-1 rounded-lg bg-[var(--danger)] text-white">
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {mods.length === 0 && (
                <tr>
                  <td className="p-3 text-[var(--text-muted)]" colSpan={3}>Sin módulos.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Panel alumnos por módulo */}
        {openModulo && (
          <div className="rounded-2xl border border-[var(--muted)] p-4 space-y-4">
            <h3 className="font-semibold">Alumnos del módulo</h3>

            {/* Añadir alumno */}
            <div className="space-y-2">
              <input
                value={qAlumno}
                onChange={(e) => setQAlumno(e.target.value)}
                placeholder="Buscar alumno por nombre o correo…"
                className="w-full md:w-1/2 px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--muted)]"
              />
              <div className="max-h-56 overflow-auto border border-[var(--muted)] rounded-xl">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--panel)]">
                    <tr>
                      <th className="text-left p-2">Nombre</th>
                      <th className="text-left p-2">Correo</th>
                      <th className="text-left p-2">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidatosAlumno.map((a) => (
                      <tr key={a.id} className="border-t border-[var(--muted)]">
                        <td className="p-2">{a.nombre_completo}</td>
                        <td className="p-2">{a.correo}</td>
                        <td className="p-2">
                          <button onClick={() => agregarAlumno(openModulo, a.id)} className="px-3 py-1 rounded-lg bg-[var(--primary)] text-white">
                            Añadir
                          </button>
                        </td>
                      </tr>
                    ))}
                    {candidatosAlumno.length === 0 && (
                      <tr>
                        <td className="p-2 text-[var(--text-muted)]" colSpan={3}>No hay candidatos (o ya están inscritos).</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Lista inscritos */}
            <div className="overflow-x-auto rounded-xl border border-[var(--muted)]">
              <table className="min-w-full text-sm">
                <thead className="bg-[var(--panel)]">
                  <tr>
                    <th className="text-left p-3">Nombre</th>
                    <th className="text-left p-3">Correo</th>
                    <th className="text-left p-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {(inscritosPorModulo[openModulo] ?? []).map((a) => (
                    <tr key={a.id} className="border-t border-[var(--muted)]">
                      <td className="p-3">{a.nombre_completo}</td>
                      <td className="p-3">{a.correo}</td>
                      <td className="p-3">
                        <button onClick={() => quitarAlumno(openModulo, a.id)} className="px-3 py-1 rounded-lg bg-[var(--muted)]">
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(inscritosPorModulo[openModulo] ?? []).length === 0 && (
                    <tr>
                      <td className="p-3 text-[var(--text-muted)]" colSpan={3}>Aún no hay alumnos en este módulo.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Panel Reportes */}
        {openReportModulo && (
          <div className="rounded-2xl border border-[var(--muted)] p-4 space-y-4">
            <h3 className="font-semibold">Reportes del módulo</h3>

            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm text-[var(--text-muted)]">Tipo:</label>
              <select
                value={reportType}
                onChange={(e) => { setReportType(e.target.value as any); setPreviewKind(null); setPdfUrl(null); }}
                className="px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--muted)]"
              >
                <option value="inscritos">Lista de alumnos inscritos</option>
                <option value="acta-final">Acta de notas (final)</option>
                <option value="acta-desglosada">Acta de notas (desglosada)</option>
              </select>

              <div className="flex flex-wrap gap-2 ml-auto">
                <button
                  disabled={exporting}
                  onClick={async () => {
                    const modulo = mods.find((mm) => mm.id === openReportModulo)!;
                    const rows = await buildPreview(modulo.id);
                    setPreviewRows(rows);
                    setPdfUrl(null);
                    setPreviewKind("html");
                  }}
                  className="px-4 py-2 rounded-xl border border-[var(--muted)]"
                >
                  Ver en pantalla
                </button>

                <button
                  disabled={exporting}
                  onClick={() => {
                    const modulo = mods.find((mm) => mm.id === openReportModulo)!;
                    previewPDF(modulo, prog?.nombre ?? "");
                  }}
                  className="px-4 py-2 rounded-xl border border-[var(--muted)]"
                >
                  Vista previa PDF
                </button>

                <button
                  disabled={exporting}
                  onClick={() => {
                    const modulo = mods.find((mm) => mm.id === openReportModulo)!;
                    exportExcel(modulo);
                  }}
                  className="px-4 py-2 rounded-xl bg-[var(--success)] text-white disabled:opacity-60"
                >
                  {exporting ? "Generando…" : "Exportar Excel"}
                </button>
                <button
                  disabled={exporting}
                  onClick={() => {
                    const modulo = mods.find((mm) => mm.id === openReportModulo)!;
                    exportPDF(modulo, prog?.nombre ?? "");
                  }}
                  className="px-4 py-2 rounded-xl bg-[var(--primary)] text-white disabled:opacity-60"
                >
                  {exporting ? "Generando…" : "Descargar PDF"}
                </button>
                <button
                  onClick={() => {
                    setOpenReportModulo(null);
                    setPreviewKind(null);
                    if (pdfObjectUrlRef.current) {
                      URL.revokeObjectURL(pdfObjectUrlRef.current);
                      pdfObjectUrlRef.current = null;
                    }
                    setPdfUrl(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-[var(--muted)]"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <p className="text-sm text-[var(--text-muted)]">
              * Los reportes se generan con los datos actuales de inscripciones y notas del módulo.
            </p>

            {previewKind === "html" && (
              <div className="space-y-3">
                <h4 className="font-semibold">Vista previa (en pantalla)</h4>
                <PreviewTable rows={previewRows} />
              </div>
            )}

            {previewKind === "pdf" && (
              <div className="space-y-3">
                <h4 className="font-semibold">Vista previa PDF</h4>
                <div className="w-full h-[70vh] border border-[var(--muted)] rounded-xl overflow-hidden">
                  {pdfUrl ? <iframe src={pdfUrl} className="w-full h-full" /> : <div className="p-4 text-[var(--text-muted)]">Generando…</div>}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
