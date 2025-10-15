"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUserStore } from "@/store/useUserStore";

// ----------- Tipos -----------
type ReportType = "lista" | "desglosadas" | "alumno";
type Modulo = { id: string; nombre_asignatura: string; programa?: { nombre: string } | null };
type Alumno = {
  id: string;
  nombre_completo: string;
  correo: string;
  celular: string | null;
  género: string | null;
  profesión: string | null;
  universidad_titulado: string | null;
  fecha_inscripción: string | null; // date
  estado: string | null;
  cedula?: string | null;   // si agregaste columnas
  expedido?: string | null; // si agregaste columnas
};
type Fila = {
  alumno_id: string;
  nombre_completo: string;
  correo: string;
  celular: string | null;
  genero: string | null;
  profesion: string | null;
  universidad_titulado: string | null;
  fecha_inscripcion: string | null;
  cedula?: string | null;
  expedido?: string | null;

  asistencia?: number | null;
  teoria?: number | null;
  practica?: number | null;
  examen_final?: number | null;
  nota_final?: number | null;
  literal?: string | null;
  observacion?: string | null;
};

// ----------- Utiles -----------
function fmtDateISO(d?: string | null) {
  if (!d) return "—";
  return String(d).slice(0, 10);
}
function filename(base: string, ext: "xlsx" | "pdf") {
  const n = (x: number) => String(x).padStart(2, "0");
  const t = new Date();
  return `${base}_${t.getFullYear()}-${n(t.getMonth() + 1)}-${n(t.getDate())}_${n(t.getHours())}${n(
    t.getMinutes()
  )}.${ext}`;
}

// ----------- Página -----------
export default function ReportesDocente() {
  const user = useUserStore((s) => s.user);

  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [moduloId, setModuloId] = useState<string>("");

  const [tipo, setTipo] = useState<ReportType>("lista");

  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [alumnoId, setAlumnoId] = useState<string>("");

  const [rows, setRows] = useState<Fila[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const moduloActual = useMemo(() => modulos.find((m) => m.id === moduloId) || null, [modulos, moduloId]);
  const programaNombre = moduloActual?.programa?.nombre ?? "";

  // Cargar módulos del docente
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data, error } = await supabase
        .from("modulos")
        .select("id, nombre_asignatura, programa:programa_id(nombre)")
        .eq("docente_id", user.id)
        .order("nombre_asignatura");
      if (error) console.error(error);
      const list = (data as any) ?? [];
      setModulos(list);
      if (list.length && !moduloId) setModuloId(list[0].id);
    })();
  }, [user?.id]);

  // Cargar alumnos inscritos del módulo (para selector de “alumno” y para lista)
  useEffect(() => {
    if (!moduloId) return;
    (async () => {
      // alumnos del módulo
      const { data, error } = await supabase
        .from("alumnos_modulos")
        .select(
          `alumno:alumno_id(
            id, nombre_completo, correo, celular, género, profesión,
            universidad_titulado, fecha_inscripción, estado, cedula, expedido
          )`
        )
        .eq("modulo_id", moduloId);
      if (error) console.error(error);
      const al: Alumno[] = ((data as any) ?? []).map((r: any) => r.alumno);
      // ordenar por nombre
      al.sort((a, b) => (a?.nombre_completo || "").localeCompare(b?.nombre_completo || ""));
      setAlumnos(al);
      if (al.length) setAlumnoId(al[0].id);
    })();
  }, [moduloId]);

  // Cargar datos del reporte
  useEffect(() => {
    if (!moduloId) return;
    (async () => {
      setLoading(true);

      // Traer inscripciones (siempre base)
      const { data: am, error: e1 } = await supabase
        .from("alumnos_modulos")
        .select(
          `id,
           alumno:alumno_id(
            id, nombre_completo, correo, celular, género, profesión,
            universidad_titulado, fecha_inscripción, estado, cedula, expedido
           )`
        )
        .eq("modulo_id", moduloId)
        .order("id");
      if (e1) console.error(e1);

      type Base = {
        alumno_modulo_id: string;
        alumno: Alumno;
      };
      const base: Base[] = (((am as any) ?? []) as any[]).map((r: any): Base => ({
        alumno_modulo_id: r.id,
        alumno: r.alumno as Alumno,
      }));

      // Notas de esos alumnos
      const ids = base.map((b) => b.alumno_modulo_id);
      let notasMap = new Map<string, any>();
      if (ids.length) {
        const { data: ns, error: e2 } = await supabase
          .from("notas")
          .select("*")
          .in("alumno_modulo_id", ids);
        if (e2) console.error(e2);
        (ns ?? []).forEach((n: any) => notasMap.set(n.alumno_modulo_id, n));
      }

      // Construir filas según tipo
      let out: Fila[] = base.map((b) => {
        const n = notasMap.get(b.alumno_modulo_id) || {};
        return {
          alumno_id: b.alumno.id,
          nombre_completo: b.alumno.nombre_completo,
          correo: b.alumno.correo,
          celular: b.alumno.celular ?? null,
          genero: (b.alumno as any)?.género ?? (b.alumno as any)?.genero ?? null,
          profesion: (b.alumno as any)?.profesión ?? (b.alumno as any)?.profesion ?? null,
          universidad_titulado: b.alumno.universidad_titulado ?? null,
          fecha_inscripcion: b.alumno.fecha_inscripción ?? null,
          cedula: (b.alumno as any)?.cedula ?? null,
          expedido: (b.alumno as any)?.expedido ?? null,

          asistencia: n.asistencia ?? null,
          teoria: n.teoria ?? null,
          practica: n.practica ?? null,
          examen_final: n.examen_final ?? null,
          nota_final: n.nota_final ?? null,
          literal: n.literal ?? null,
          observacion: n.observacion ?? null,
        };
      });

      if (tipo === "alumno" && alumnoId) {
        out = out.filter((r) => r.alumno_id === alumnoId);
      }

      setRows(out);
      setLoading(false);
    })();
  }, [moduloId, tipo, alumnoId]);

  // -------------- Render: tabla/ficha --------------
  function RenderContenido() {
    if (loading) return <div className="opacity-70">Cargando…</div>;
    if (!rows.length)
      return <div className="opacity-70">Sin datos para el filtro seleccionado.</div>;

    if (tipo === "alumno") {
      const a = rows[0];
      return (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-[var(--muted)] p-4 space-y-2">
            <h3 className="font-semibold text-lg">Ficha del alumno</h3>
            <div><span className="text-[var(--text-muted)]">Nombre: </span>{a.nombre_completo}</div>
            <div><span className="text-[var(--text-muted)]">Correo: </span>{a.correo}</div>
            <div><span className="text-[var(--text-muted)]">Celular: </span>{a.celular ?? "—"}</div>
            <div><span className="text-[var(--text-muted)]">Género: </span>{a.genero ?? "—"}</div>
            <div><span className="text-[var(--text-muted)]">Profesión: </span>{a.profesion ?? "—"}</div>
            <div><span className="text-[var(--text-muted)]">Univ. Titulado: </span>{a.universidad_titulado ?? "—"}</div>
            <div><span className="text-[var(--text-muted)]">Fecha inscripción: </span>{fmtDateISO(a.fecha_inscripcion)}</div>
            <div><span className="text-[var(--text-muted)]">Cédula: </span>{a.cedula ?? "—"}</div>
            <div><span className="text-[var(--text-muted)]">Expedido: </span>{a.expedido ?? "—"}</div>
          </div>

          <div className="rounded-2xl border border-[var(--muted)] p-4 space-y-2">
            <h3 className="font-semibold text-lg">Notas del módulo</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[var(--panel)]">
                  <tr>
                    <th className="p-2">Asistencia</th>
                    <th className="p-2">Teoría</th>
                    <th className="p-2">Práctica</th>
                    <th className="p-2">Examen</th>
                    <th className="p-2">Final</th>
                    <th className="p-2">Literal</th>
                    <th className="p-2">Observación</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-[var(--muted)]">
                    <td className="p-2 text-center">{a.asistencia ?? "—"}</td>
                    <td className="p-2 text-center">{a.teoria ?? "—"}</td>
                    <td className="p-2 text-center">{a.practica ?? "—"}</td>
                    <td className="p-2 text-center">{a.examen_final ?? "—"}</td>
                    <td className="p-2 text-center font-semibold">{a.nota_final ?? "—"}</td>
                    <td className="p-2 text-center">{a.literal ?? "—"}</td>
                    <td className="p-2">{a.observacion ?? "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    // Tabla para lista y desglosadas
    return (
      <div className="overflow-x-auto rounded-2xl border border-[var(--muted)]">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--panel)]">
            <tr>
              {tipo === "lista" ? (
                <>
                  <th className="p-2 text-left">N°</th>
                  <th className="p-2 text-left">Cédula</th>
                  <th className="p-2 text-left">Expedido</th>
                  <th className="p-2 text-left">Nombre</th>
                  <th className="p-2">Género</th>
                  <th className="p-2 text-left">Profesión</th>
                  <th className="p-2 text-left">Univ. Titulado</th>
                  <th className="p-2">Celular</th>
                  <th className="p-2 text-left">Correo</th>
                  <th className="p-2">Fecha inscrip.</th>
                </>
              ) : (
                <>
                  <th className="p-2 text-left">Alumno</th>
                  <th className="p-2 text-left">Correo</th>
                  <th className="p-2">Asist.</th>
                  <th className="p-2">Teoría</th>
                  <th className="p-2">Práctica</th>
                  <th className="p-2">Examen</th>
                  <th className="p-2">Final</th>
                  <th className="p-2">Literal</th>
                  <th className="p-2 text-left">Observación</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {tipo === "lista"
              ? rows.map((r, i) => (
                  <tr key={r.alumno_id} className="border-t border-[var(--muted)]">
                    <td className="p-2">{i + 1}</td>
                    <td className="p-2">{r.cedula ?? "—"}</td>
                    <td className="p-2">{r.expedido ?? "—"}</td>
                    <td className="p-2">{r.nombre_completo}</td>
                    <td className="p-2 text-center">{r.genero ?? "—"}</td>
                    <td className="p-2">{r.profesion ?? "—"}</td>
                    <td className="p-2">{r.universidad_titulado ?? "—"}</td>
                    <td className="p-2 text-center">{r.celular ?? "—"}</td>
                    <td className="p-2">{r.correo}</td>
                    <td className="p-2 text-center">{fmtDateISO(r.fecha_inscripcion)}</td>
                  </tr>
                ))
              : rows.map((r) => (
                  <tr key={r.alumno_id} className="border-t border-[var(--muted)]">
                    <td className="p-2">{r.nombre_completo}</td>
                    <td className="p-2">{r.correo}</td>
                    <td className="p-2 text-center">{r.asistencia ?? ""}</td>
                    <td className="p-2 text-center">{r.teoria ?? ""}</td>
                    <td className="p-2 text-center">{r.practica ?? ""}</td>
                    <td className="p-2 text-center">{r.examen_final ?? ""}</td>
                    <td className="p-2 text-center font-semibold">{r.nota_final ?? ""}</td>
                    <td className="p-2 text-center">{r.literal ?? ""}</td>
                    <td className="p-2">{r.observacion ?? ""}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    );
  }

  // -------------- Export: Excel --------------
  async function exportExcel() {
    setExporting(true);
    try {
      const ExcelJS: any = await import("exceljs");
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(
        tipo === "lista" ? "Inscritos" : tipo === "desglosadas" ? "Notas" : "Alumno"
      );

      if (tipo === "lista") {
        ws.columns = [
          { header: "N°", key: "n", width: 6 },
          { header: "Cédula", key: "cedula", width: 16 },
          { header: "Expedido", key: "expedido", width: 12 },
          { header: "Nombre", key: "nombre_completo", width: 32 },
          { header: "Género", key: "genero", width: 8 },
          { header: "Profesión", key: "profesion", width: 22 },
          { header: "Univ. Titulado", key: "universidad_titulado", width: 26 },
          { header: "Celular", key: "celular", width: 14 },
          { header: "Correo", key: "correo", width: 30 },
          { header: "Fecha inscripción", key: "fecha_inscripcion", width: 16 },
        ];
        ws.addRows(
          rows.map((r, i) => ({
            n: i + 1,
            cedula: r.cedula ?? "",
            expedido: r.expedido ?? "",
            nombre_completo: r.nombre_completo,
            genero: r.genero ?? "",
            profesion: r.profesion ?? "",
            universidad_titulado: r.universidad_titulado ?? "",
            celular: r.celular ?? "",
            correo: r.correo,
            fecha_inscripcion: fmtDateISO(r.fecha_inscripcion),
          }))
        );
      } else if (tipo === "desglosadas") {
        ws.columns = [
          { header: "Alumno", key: "nombre_completo", width: 32 },
          { header: "Correo", key: "correo", width: 30 },
          { header: "Asistencia", key: "asistencia", width: 12 },
          { header: "Teoría", key: "teoria", width: 10 },
          { header: "Práctica", key: "practica", width: 10 },
          { header: "Examen", key: "examen_final", width: 12 },
          { header: "Final", key: "nota_final", width: 10 },
          { header: "Literal", key: "literal", width: 12 },
          { header: "Observación", key: "observacion", width: 26 },
        ];
        ws.addRows(rows);
      } else {
        // alumno
        ws.columns = [
          { header: "Nombre", key: "nombre_completo", width: 32 },
          { header: "Correo", key: "correo", width: 30 },
          { header: "Celular", key: "celular", width: 14 },
          { header: "Género", key: "genero", width: 8 },
          { header: "Profesión", key: "profesion", width: 22 },
          { header: "Univ. Titulado", key: "universidad_titulado", width: 26 },
          { header: "Cédula", key: "cedula", width: 16 },
          { header: "Expedido", key: "expedido", width: 12 },
          { header: "Fecha inscripción", key: "fecha_inscripcion", width: 16 },
          { header: "Asist.", key: "asistencia", width: 10 },
          { header: "Teoría", key: "teoria", width: 10 },
          { header: "Práctica", key: "practica", width: 10 },
          { header: "Examen", key: "examen_final", width: 10 },
          { header: "Final", key: "nota_final", width: 10 },
          { header: "Literal", key: "literal", width: 12 },
          { header: "Observación", key: "observacion", width: 24 },
        ];
        ws.addRows(rows);
      }
      ws.getRow(1).font = { bold: true };

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename(
        `reporte_${tipo}_${moduloActual?.nombre_asignatura || "modulo"}`,
        "xlsx"
      );
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  // -------------- Export: PDF --------------
  async function exportPDF() {
    setExporting(true);
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      const landscape = tipo !== "alumno"; // alumno en vertical, tablas anchas en horizontal
      const doc = new jsPDF({
        unit: "pt",
        format: "a4",
        orientation: landscape ? "landscape" : "portrait",
      });

      const W = doc.internal.pageSize.getWidth();
      const CX = W / 2;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("POSTGRADO", CX, 40, { align: "center" });
      doc.setFontSize(13);
      doc.text("UNIVERSIDAD NACIONAL SIGLO XX", CX, 60, { align: "center" });
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("CONVENIO: GASPROMs S.R.L.", CX, 78, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.text(`PROGRAMA: ${programaNombre || "—"}`, CX, 98, { align: "center" });

      const titulo =
        tipo === "lista"
          ? "LISTA DE ALUMNOS POR MÓDULO"
          : tipo === "desglosadas"
          ? "NOTAS DESGLOSADAS DE ALUMNOS"
          : "INFORMACIÓN DE ALUMNO";
      doc.text(titulo, CX, 118, { align: "center" });

      if (tipo === "alumno") {
        const a = rows[0];
        const left = 40;
        let y = 150;
        doc.setFontSize(10);
        const line = (label: string, value: string) => {
          doc.setFont("helvetica", "bold");
          doc.text(`${label}:`, left, y);
          doc.setFont("helvetica", "normal");
          doc.text(value || "—", left + 120, y);
          y += 18;
        };
        line("Nombre", a.nombre_completo);
        line("Correo", a.correo);
        line("Celular", a.celular ?? "");
        line("Género", a.genero ?? "");
        line("Profesión", a.profesion ?? "");
        line("Univ. Titulado", a.universidad_titulado ?? "");
        line("Cédula", a.cedula ?? "");
        line("Expedido", a.expedido ?? "");
        line("Fecha inscripción", fmtDateISO(a.fecha_inscripcion));

        (autoTable as any)(doc, {
          startY: y + 10,
          head: [["Asistencia", "Teoría", "Práctica", "Examen", "Final", "Literal", "Observación"]],
          body: [[
            a.asistencia ?? "",
            a.teoria ?? "",
            a.practica ?? "",
            a.examen_final ?? "",
            a.nota_final ?? "",
            a.literal ?? "",
            a.observacion ?? "",
          ]],
          theme: "grid",
          styles: { fontSize: 9, cellPadding: 4 },
          headStyles: { fillColor: [230, 230, 230], textColor: 20, fontStyle: "bold" },
          margin: { left: 24, right: 24 },
        });
      } else {
        const head =
          tipo === "lista"
            ? [
                "N°",
                "CÉDULA",
                "EXPEDIDO",
                "NOMBRE",
                "GÉNERO",
                "PROFESIÓN",
                "UNIV. TITULADO",
                "CELULAR",
                "CORREO",
                "FECHA INSCRIP.",
              ]
            : [
                "ALUMNO",
                "CORREO",
                "ASIST.",
                "TEORÍA",
                "PRÁCTICA",
                "EXAMEN",
                "FINAL",
                "LITERAL",
                "OBS.",
              ];
        const body =
          tipo === "lista"
            ? rows.map((r, i) => [
                i + 1,
                r.cedula ?? "",
                r.expedido ?? "",
                r.nombre_completo,
                r.genero ?? "",
                r.profesion ?? "",
                r.universidad_titulado ?? "",
                r.celular ?? "",
                r.correo,
                fmtDateISO(r.fecha_inscripcion),
              ])
            : rows.map((r) => [
                r.nombre_completo,
                r.correo,
                r.asistencia ?? "",
                r.teoria ?? "",
                r.practica ?? "",
                r.examen_final ?? "",
                r.nota_final ?? "",
                r.literal ?? "",
                r.observacion ?? "",
              ]);

        (autoTable as any)(doc, {
          startY: 140,
          head: [head],
          body,
          theme: "grid",
          styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
          headStyles: { fillColor: [230, 230, 230], textColor: 20, fontStyle: "bold" },
          margin: { left: 24, right: 24 },
          tableWidth: "auto",
        });
      }

      doc.save(
        filename(`reporte_${tipo}_${moduloActual?.nombre_asignatura || "modulo"}`, "pdf")
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Reportes</h1>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-[var(--text-muted)]">Módulo:</span>
        <select
          value={moduloId}
          onChange={(e) => setModuloId(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--muted)]"
        >
          {modulos.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre_asignatura}
            </option>
          ))}
        </select>

        <span className="text-sm text-[var(--text-muted)]">Tipo:</span>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as ReportType)}
          className="px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--muted)]"
        >
          <option value="lista">Lista de alumnos por módulo</option>
          <option value="desglosadas">Notas desglosadas de alumnos</option>
          <option value="alumno">Información de alumno</option>
        </select>

        {tipo === "alumno" && (
          <>
            <span className="text-sm text-[var(--text-muted)]">Alumno:</span>
            <select
              value={alumnoId}
              onChange={(e) => setAlumnoId(e.target.value)}
              className="px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--muted)]"
            >
              {alumnos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre_completo}
                </option>
              ))}
            </select>
          </>
        )}

        <div className="flex gap-2 ml-auto">
          <button
            onClick={exportExcel}
            disabled={exporting || loading || !rows.length}
            className="px-4 py-2 rounded-xl bg-[var(--success)] text-white disabled:opacity-60"
          >
            {exporting ? "Generando…" : "Exportar Excel"}
          </button>
          <button
            onClick={exportPDF}
            disabled={exporting || loading || !rows.length}
            className="px-4 py-2 rounded-xl bg-[var(--primary)] text-white disabled:opacity-60"
          >
            {exporting ? "Generando…" : "Descargar PDF"}
          </button>
        </div>
      </div>

      <RenderContenido />
    </div>
  );
}
