"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import type { Rol } from "@/lib/repositories/usuariosRepo";

const ALL_ROLES: Rol[] = ["admin", "docente", "alumno", "coordinador"];

type Props = {
  open: boolean;
  onClose: () => void;
  initialRoles: Rol[];
  onSave: (roles: Rol[]) => Promise<void>;
  title?: string;
};

export default function RolesDialog({
  open,
  onClose,
  initialRoles,
  onSave,
  title = "Cambiar roles",
}: Props) {
  const [roles, setRoles] = useState<Rol[]>(initialRoles);

  useEffect(() => {
    setRoles(initialRoles);
  }, [initialRoles, open]);

  function toggle(role: Rol) {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={title} widthClass="max-w-md">
      <div className="space-y-3">
        {ALL_ROLES.map((r) => (
          <label key={r} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={roles.includes(r)}
              onChange={() => toggle(r)}
            />
            <span className="capitalize">{r}</span>
          </label>
        ))}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded border border-[var(--border)]"
          >
            Cancelar
          </button>
          <button
            onClick={async () => {
              await onSave(roles);
              onClose();
            }}
            className="px-3 py-2 rounded bg-[var(--accent)] text-[var(--onAccent)]"
          >
            Guardar
          </button>
        </div>
      </div>
    </Modal>
  );
}
