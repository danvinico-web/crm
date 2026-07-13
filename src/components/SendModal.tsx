"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Send } from "lucide-react";
import type { OfficeLite } from "@/app/api/offices/route";

type Props = {
  selection: { body: Record<string, unknown>; count: number };
  onClose: () => void;
};

export default function SendModal({ selection, onClose }: Props) {
  const router = useRouter();
  const [offices, setOffices] = useState<OfficeLite[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; capped?: boolean; cap?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/offices")
      .then((r) => r.json())
      .then((d) => {
        const list: OfficeLite[] = d.offices ?? [];
        setOffices(list);
        const firstReady = list.find((o) => o.hasIntegration);
        if (firstReady) setSelected(firstReady.id);
      })
      .catch(() => setError("Не удалось загрузить офисы"));
  }, []);

  async function send() {
    if (!selected) return;
    setSending(true);
    setError(null);
    const res = await fetch("/api/leads/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...selection.body, officeId: selected }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) {
      setError(data.error ?? "Ошибка отгрузки");
      return;
    }
    setResult({ sent: data.sent ?? 0, failed: data.failed ?? 0, capped: data.capped, cap: data.cap });
    router.refresh();
  }

  return (
    <div className="overlay show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <h3>Отправить в офис</h3>
          <div className="mini" onClick={onClose}><X size={16} /></div>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Выбрано лидов</label>
            <input value={`${selection.count.toLocaleString("ru-RU")} лид(ов) к отгрузке`} readOnly />
          </div>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--text-dim)", marginBottom: 9 }}>
            Офис назначения
          </label>
          {offices.map((o) => (
            <div
              key={o.id}
              className={`office-opt${selected === o.id ? " sel" : ""}`}
              onClick={() => o.hasIntegration && setSelected(o.id)}
              style={{ opacity: o.hasIntegration ? 1 : 0.5, cursor: o.hasIntegration ? "pointer" : "not-allowed" }}
            >
              <div className="lg" style={{ background: `linear-gradient(135deg,${o.color})` }}>{o.logoText}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{o.name}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {o.hasIntegration ? o.apiTypeLabel : "нет активной интеграции"}
                </div>
              </div>
              <span className={`conn ${o.connState === "ok" ? "ok" : "idle"}`}>●</span>
            </div>
          ))}

          {error && <div style={{ color: "var(--red)", fontSize: 12.5, fontWeight: 600, marginTop: 10 }}>{error}</div>}
          {result && (
            <div style={{ color: "var(--green)", fontSize: 13, fontWeight: 600, marginTop: 12 }}>
              Отгружено: {result.sent}{result.failed ? ` · ошибок: ${result.failed}` : ""}{result.capped ? ` · (лимит ${result.cap} за раз)` : ""}
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>{result ? "Закрыть" : "Отмена"}</button>
          {!result && (
            <button className="btn btn-primary" onClick={send} disabled={sending || !selected}>
              <Send size={16} /> {sending ? "Отправляем…" : "Отправить сейчас"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
