"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Wallet } from "lucide-react";
import { DeleteButton, EditButton } from "@/components/RowActions";
import { formatMoney } from "@/lib/format";

export interface AffiliateRow {
  id: string;
  name: string;
  tag: string;
  platform: string;
  status: "active" | "review" | "paused";
  cpa: number;
  leads: number;
  valid: number;
  ftd: number;
  conv: number;
  earned: number;
  paid: number;
  awaiting: number;
}

const STATUS_BADGE: Record<string, string> = { active: "b-dep", review: "b-work", paused: "b-off" };
const STATUS_LABEL: Record<string, string> = { active: "Активен", review: "Проверка", paused: "Пауза" };

type FormState = { id?: string; name: string; tag: string; platform: string; status: "active" | "review" | "paused"; cpa: number };
const EMPTY: FormState = { name: "", tag: "", platform: "", status: "active", cpa: 0 };

interface PayoutItem { id: string; amount: number; note: string; createdAt: string }

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function AffiliatesManager({ rows }: { rows: AffiliateRow[] }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState | null>(null);
  const [payoutFor, setPayoutFor] = useState<AffiliateRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const totalAwaiting = rows.reduce((s, r) => s + r.awaiting, 0);
  const totalEarned = rows.reduce((s, r) => s + r.earned, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError(null);
    const isEdit = !!form.id;
    const res = await fetch(isEdit ? `/api/affiliates/${form.id}` : "/api/affiliates", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, tag: form.tag, platform: form.platform, status: form.status, cpa: Number(form.cpa) || 0 }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Ошибка сохранения"); return; }
    setForm(null);
    router.refresh();
  }

  return (
    <>
      <div className="section-head">
        <h2>Аффилиаты · источники трафика</h2>
        <button className="btn btn-primary btn-sm" onClick={() => { setForm({ ...EMPTY }); setError(null); }}>
          <Plus size={16} /> Добавить аффилиата
        </button>
      </div>

      {/* Сводка по выплатам */}
      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        <div className="card kpi"><div className="ic i-blue"><Wallet size={20} /></div><div className="lbl">Начислено аффилиатам</div><div className="val">{formatMoney(totalEarned)}</div></div>
        <div className="card kpi"><div className="ic i-green"><Wallet size={20} /></div><div className="lbl">Выплачено</div><div className="val">{formatMoney(totalPaid)}</div></div>
        <div className="card kpi"><div className="ic i-amber"><Wallet size={20} /></div><div className="lbl">К выплате</div><div className="val" style={{ color: totalAwaiting > 0 ? "var(--amber)" : undefined }}>{formatMoney(totalAwaiting)}</div></div>
      </div>

      <div className="card table-card">
        <div className="tbl-scroll">
          <table>
            <thead>
              <tr>
                <th>Аффилиат</th><th>Метка</th><th>Источник</th><th>Лиды</th><th>FTD</th><th>CPA</th>
                <th>Начислено</th><th>Выплачено</th><th>К выплате</th><th>Статус</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={11} className="muted" style={{ textAlign: "center", padding: 24 }}>Аффилиатов пока нет.</td></tr>}
              {rows.map((a) => (
                <tr key={a.id}>
                  <td><b>{a.name}</b></td>
                  <td><span className="chip aff">{a.tag}</span></td>
                  <td className="muted">{a.platform || "—"}</td>
                  <td className="mono">{a.leads}</td>
                  <td className="mono">{a.ftd}</td>
                  <td className="mono">{formatMoney(a.cpa)}</td>
                  <td className="bal">{formatMoney(a.earned)}</td>
                  <td className="mono muted">{formatMoney(a.paid)}</td>
                  <td className="bal" style={{ color: a.awaiting > 0 ? "var(--amber)" : "var(--text-dim)" }}>{formatMoney(a.awaiting)}</td>
                  <td><span className={`badge ${STATUS_BADGE[a.status]}`}>{STATUS_LABEL[a.status]}</span></td>
                  <td>
                    <div className="row-act" style={{ opacity: 1, gap: 6 }}>
                      <button className="mini" title="Выплатить" onClick={() => setPayoutFor(a)} style={{ color: "var(--green)" }}><Wallet size={15} /></button>
                      <EditButton onClick={() => { setForm({ id: a.id, name: a.name, tag: a.tag, platform: a.platform, status: a.status, cpa: a.cpa }); setError(null); }} />
                      <DeleteButton endpoint={`/api/affiliates/${a.id}`} confirmText={`Удалить аффилиата «${a.name}»?`} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <div className="overlay show" onClick={(e) => e.target === e.currentTarget && setForm(null)}>
          <div className="modal">
            <div className="modal-head">
              <h3>{form.id ? "Редактировать аффилиата" : "Новый аффилиат"}</h3>
              <div className="mini" onClick={() => setForm(null)}><X size={16} /></div>
            </div>
            <form onSubmit={save}>
              <div className="modal-body">
                <div className="field"><label>Название</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="MediaBuy Karl" required /></div>
                <div className="field"><label>Метка (tag)</label><input value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} placeholder="aff_karl" required /></div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="field"><label>Источник трафика</label><input value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} placeholder="Meta Ads" /></div>
                  <div className="field"><label>CPA — выплата за FTD, $</label><input type="number" min={0} step={5} value={form.cpa} onChange={(e) => setForm({ ...form, cpa: Number(e.target.value) })} placeholder="85" /></div>
                </div>
                <div className="field"><label>Статус</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as FormState["status"] })}>
                    <option value="active">Активен</option>
                    <option value="review">Проверка</option>
                    <option value="paused">Пауза</option>
                  </select>
                </div>
                {error && <div style={{ color: "var(--red)", fontSize: 12.5, fontWeight: 600 }}>{error}</div>}
              </div>
              <div className="modal-foot">
                <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Отмена</button>
                <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Сохраняем…" : "Сохранить"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {payoutFor && <PayoutModal affiliate={payoutFor} onClose={() => setPayoutFor(null)} />}
    </>
  );
}

function PayoutModal({ affiliate, onClose }: { affiliate: AffiliateRow; onClose: () => void }) {
  const router = useRouter();
  const [amount, setAmount] = useState<number>(affiliate.awaiting || 0);
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<PayoutItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/payouts?affiliateId=${affiliate.id}`).then((r) => r.json()).then((d) => setHistory(d.payouts ?? [])).catch(() => {});
  }, [affiliate.id]);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ affiliateId: affiliate.id, amount: Number(amount), note }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Ошибка"); return; }
    onClose();
    router.refresh();
  }

  return (
    <div className="overlay show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-head"><h3>Выплата · {affiliate.name}</h3><div className="mini" onClick={onClose}><X size={16} /></div></div>
        <form onSubmit={pay}>
          <div className="modal-body">
            <div className="int-body" style={{ marginBottom: 16 }}>
              <div className="m"><div className="v" style={{ fontSize: 15 }}>{formatMoney(affiliate.earned)}</div><div className="k">начислено</div></div>
              <div className="m"><div className="v" style={{ fontSize: 15 }}>{formatMoney(affiliate.paid)}</div><div className="k">выплачено</div></div>
              <div className="m"><div className="v" style={{ fontSize: 15, color: "var(--amber)" }}>{formatMoney(affiliate.awaiting)}</div><div className="k">к выплате</div></div>
            </div>
            <div className="field"><label>Сумма выплаты, $</label><input type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} required /></div>
            <div className="field"><label>Заметка</label><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="напр. USDT, инвойс #123" /></div>
            {error && <div style={{ color: "var(--red)", fontSize: 12.5, fontWeight: 600 }}>{error}</div>}
            {history.length > 0 && (
              <>
                <div className="section-title">История выплат</div>
                {history.slice(0, 6).map((p) => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "5px 0", borderBottom: "1px solid var(--border-soft)" }}>
                    <span className="bal">{formatMoney(p.amount)}</span>
                    <span className="muted">{p.note || "—"}</span>
                    <span className="muted mono">{dateFmt.format(new Date(p.createdAt))}</span>
                  </div>
                ))}
              </>
            )}
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn-primary" disabled={busy}><Wallet size={16} /> {busy ? "Записываем…" : "Записать выплату"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
