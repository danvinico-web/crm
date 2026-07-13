"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Pencil } from "lucide-react";

/** Кнопка удаления с подтверждением. Работает и внутри серверных таблиц. */
export function DeleteButton({
  endpoint,
  confirmText,
  title = "Удалить",
  onDeleted,
}: {
  endpoint: string;
  confirmText?: string;
  title?: string;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function del() {
    if (!window.confirm(confirmText ?? "Удалить этот элемент? Действие необратимо.")) return;
    setBusy(true);
    const res = await fetch(endpoint, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Ошибка удаления");
      return;
    }
    onDeleted?.();
    router.refresh();
  }

  return (
    <button className="mini" onClick={del} disabled={busy} title={title} style={{ color: "var(--red)" }}>
      <Trash2 size={15} />
    </button>
  );
}

/** Кнопка-иконка «редактировать». */
export function EditButton({ onClick, title = "Редактировать" }: { onClick: () => void; title?: string }) {
  return (
    <button className="mini" onClick={onClick} title={title}>
      <Pencil size={15} />
    </button>
  );
}
