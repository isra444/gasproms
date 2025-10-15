// src/app/admin/programas/[id]/modulos/crear/page.tsx
import CrearModuloClient from "./CrearModuloClient";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params; // 👈 en Next 15 params es Promise
  return <CrearModuloClient programaId={id} />;
}
