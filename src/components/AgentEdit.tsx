"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";

interface AgentData {
  id: string;
  name: string;
  title: string;
  teamId: string | null;
  ownerId: string | null;
  isOnline: boolean;
}

interface Props {
  agent: AgentData;
  teams: { id: string; name: string }[];
  curators: { id: string; name: string }[];
}

/** Открыть агента и внести правки: имя, роль, команда, куратор, онлайн. */
export default function AgentEdit({ agent, teams, curators }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(agent.name);
  const [title, setTitle] = useState(agent.title);
  const [teamId, setTeamId] = useState(agent.teamId ?? "");
  const [ownerId, setOwnerId] = useState(agent.ownerId ?? "");
  const [isOnline, setIsOnline] = useState(agent.isOnline);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/agents/${agent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, title, isOnline, teamId: teamId || null, ownerId: ownerId || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Ошибка сохранения"); return; }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        className="mini"
        title="Редактировать агента"
        onClick={() => setOpen(true)}
        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-mute)", padding: 4 }}
      >
        <Pencil size={15} />
      </button>
      {open && (
        <div className="overlay show" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-head"><h3>Агент · {agent.name}</h3><div className="mini" onClick={() => setOpen(false)}><X size={16} /></div></div>
            <form onSubmit={save}>
              <div className="modal-body">
                <div className="field"><label>Имя</label><input value={name} onChange={(e) => setName(e.target.value)} required /></div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="field"><label>Роль</label>
                    <select value={title} onChange={(e) => setTitle(e.target.value)}>
                      <option>Sales agent</option><option>Retention</option><option>Team Lead</option>
                    </select>
                  </div>
                  <div className="field"><label>Команда</label>
                    <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                      <option value="">— без команды —</option>
                      {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="field"><label>Куратор (кто смотрит за агентом)</label>
                  <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                    <option value="">— не выбран —</option>
                    {curators.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                  <input type="checkbox" checked={isOnline} onChange={(e) => setIsOnline(e.target.checked)} style={{ width: 16, height: 16 }} /> Онлайн
                </label>
                {error && <div style={{ color: "var(--red)", fontSize: 12.5, fontWeight: 600, marginTop: 10 }}>{error}</div>}
              </div>
              <div className="modal-foot">
                <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Отмена</button>
                <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Сохраняем…" : "Сохранить"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
