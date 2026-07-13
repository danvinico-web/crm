"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X, Plus } from "lucide-react";

export default function AddLeadModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({ fullName: "", email: "", phone: "", geo: "", affiliateTag: "", comment: "" });
  const [customFields, setCustomFields] = useState<{ key: string; label: string }[]>([]);
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/lead-fields").then((r) => r.json()).then((d) => setCustomFields(d.fields ?? [])).catch(() => {});
  }, []);

  function set(k: keyof typeof f, v: string) {
    setF((p) => ({ ...p, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, custom }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Ошибка создания");
      return;
    }
    onClose();
    router.push("/leads");
    router.refresh();
  }

  // Рендерим через портал в body: топбар с backdrop-filter иначе становится
  // containing-block для position:fixed и «обрезает» модалку.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="overlay show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-head"><h3>Новый лид</h3><div className="mini" onClick={onClose}><X size={16} /></div></div>
        <form onSubmit={save}>
          <div className="modal-body">
            <div className="field"><label>Имя *</label><input value={f.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="Иван Иванов" required /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="field"><label>Email</label><input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="ivan@mail.com" /></div>
              <div className="field"><label>Телефон</label><input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+49..." /></div>
              <div className="field"><label>Гео (ISO-2)</label><input value={f.geo} onChange={(e) => set("geo", e.target.value)} placeholder="DE" maxLength={2} /></div>
              <div className="field"><label>Метка аффилиата</label><input value={f.affiliateTag} onChange={(e) => set("affiliateTag", e.target.value)} placeholder="aff_karl" /></div>
            </div>
            <div className="field"><label>Комментарий</label><input value={f.comment} onChange={(e) => set("comment", e.target.value)} placeholder="Заметка" /></div>
            {customFields.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {customFields.map((cf) => (
                  <div className="field" key={cf.key} style={{ marginBottom: 0 }}>
                    <label>{cf.label}</label>
                    <input value={custom[cf.key] ?? ""} onChange={(e) => setCustom((c) => ({ ...c, [cf.key]: e.target.value }))} placeholder={cf.label} />
                  </div>
                ))}
              </div>
            )}
            <div className="muted" style={{ fontSize: 11.5, marginTop: 12 }}>Нужен хотя бы email или телефон. Данные шифруются at rest.</div>
            {error && <div style={{ color: "var(--red)", fontSize: 12.5, fontWeight: 600, marginTop: 10 }}>{error}</div>}
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn-primary" disabled={busy}><Plus size={16} /> {busy ? "Создаём…" : "Создать лид"}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
