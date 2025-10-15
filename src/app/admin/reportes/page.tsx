// app/admin/reportes/page.tsx
"use client";

import Link from "next/link";

export default function ReportesHome() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Reportes</h1>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Por módulo (sin selector aquí) */}
        <section className="rounded-2xl border border-slate-700 bg-slate-900/40">
          <header className="px-4 py-3 border-b border-slate-700">
            <h2 className="font-semibold">Por módulo</h2>
          </header>

          <ul className="p-4 space-y-3 text-[15px]">
            {/* Estos enlaces abren cada reporte; dentro de cada página se elige Programa/Módulo */}
            <li>
              <Link href="/admin/reportes/acta-finales" className="underline">
                ▸ Acta de notas finales
              </Link>
            </li>
            <li>
              <Link href="/admin/reportes/desglose" className="underline">
                ▸ Desglose de notas
              </Link>
            </li>
            <li>
              <Link href="/admin/reportes/inscritos" className="underline">
                ▸ Alumnos inscritos por módulo
              </Link>
            </li>
            <li>
              <Link href="/admin/reportes/modulo-detallado" className="underline">
                ▸ Informe detallado del módulo
              </Link>
            </li>
          </ul>
        </section>

        {/* Generales */}
        <section className="rounded-2xl border border-slate-700 bg-slate-900/40">
          <header className="px-4 py-3 border-b border-slate-700">
            <h2 className="font-semibold">Generales</h2>
          </header>

          <ul className="p-4 space-y-3 text-[15px]">
            <li>
              <Link href="/admin/reportes/programas-modulos" className="underline">
                ▸ Programas y módulos
              </Link>
            </li>
            <li>
              <Link href="/admin/reportes/docentes-activos" className="underline">
                ▸ Docentes activos
              </Link>
            </li>
            <li className="text-slate-400 text-sm">
              Tip: ahora cada reporte permite elegir el programa y el módulo dentro de su propia página.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
