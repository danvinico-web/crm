"use client";

import { useState } from "react";
import { MessageSquare, Send } from "lucide-react";

export interface NoteItem {
  id: string;
  text: string;
  author: string;
  source: "import" | "user" | "external";
  createdAt: string;
}

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const SOURCE_LABEL: Record<string, string> = { import: "импорт", user: "агент", external: "источник" };

export default function LeadNotes({ leadId, initialNotes }: { leadId: string; initialNotes: NoteItem[] }) {
  const [notes, setNotes] = useState<NoteItem[]>(initialNotes);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setBusy(true);
    const res = await fetch(`/api/leads/${leadId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: t }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok && data.note) {
      setNotes((n) => [...n, data.note]);
      setText("");
    }
  }

  return (
    <div className="card panel">
      <div className="panel-head">
        <h3>Комментарии</h3>
        <span className="chip src">{notes.length}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
        {notes.length === 0 && <div className="muted" style={{ fontSize: 13 }}>Комментариев нет.</div>}
        {notes.map((n) => (
          <div key={n.id} style={{ display: "flex", gap: 10 }}>
            <div className="ic i-blue" style={{ width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <MessageSquare size={14} />
            </div>
            <div style={{ flex: 1, background: "var(--surface-2)", borderRadius: 10, padding: "9px 12px" }}>
              <div style={{ fontSize: 13.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{n.text}</div>
              <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
                {n.author} · {SOURCE_LABEL[n.source] ?? n.source} · {dateFmt.format(new Date(n.createdAt))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={add} style={{ display: "flex", gap: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Добавить комментарий…"
          style={{ flex: 1, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 13px", color: "var(--text)", fontSize: 13.5, outline: "none" }}
        />
        <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()}><Send size={16} /> {busy ? "…" : "Отправить"}</button>
      </form>
    </div>
  );
}
