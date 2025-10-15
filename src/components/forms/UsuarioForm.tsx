"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import type { Usuario } from "@/lib/repositories/usuariosRepo";

type Props = {
  open: boolean;
  onClose: () => void;
  usuario: Usuario | null;
  onSubmit: (values: { nombre_completo: string; correo: string; celular: string | null }) => Promise<void>;
};

export default function UsuarioForm({ open, onClose, usuario, onSubmit }: Props) {
  const [nombre, setNombre] = useState(usuario?.nombre_completo ?? "");
  const [correo, setCorreo] = useState(usuario?.correo ?? "");
  const [celular, setCelular] = useState(usuario?.celular ?? "");

  // si cambia el usuario seleccionado, resetea
  // (opcional, por simplicidad usamos key en el modal para remount)
  return (
    <Modal open={open} onClose={onClose} title="Editar alumno" widthClass="max-w-xl">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          await onSubmit({
            nombre_completo: nombre.trim(),
            correo: correo.trim(),
            celular: celular?.trim() || null,
          });
          onClose();
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm opacity-80">Nombre completo</label>
            <input
              className="mt-1 w-full px-3 py-2 rounded border border-[var(--border)] bg-[var(--muted)]"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm opacity-80">Correo</label>
            <input
              type="email"
              className="mt-1 w-full px-3 py-2 rounded border border-[var(--border)] bg-[var(--muted)]"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm opacity-80">Celular</label>
            <input
              className="mt-1 w-full px-3 py-2 rounded border border-[var(--border)] bg-[var(--muted)]"
              value={celular ?? ""}
              onChange={(e) => setCelular(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded border border-[var(--border)]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-3 py-2 rounded bg-[var(--accent)] text-[var(--onAccent)]"
          >
            Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
}
