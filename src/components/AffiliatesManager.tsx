"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Wallet, KeyRound, Copy, Check, RefreshCw, Eye } from "lucide-react";
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
  apiKeyPrefix: string | null;
}

const STATUS_BADGE: Record<string, string> = { active: "b-dep", review: "b-work", paused: "b-off" };
const STATUS_LABEL: Record<string, string> = { active: "Активен", review: "Проверка", paused: "Пауза" };

type FormState = { id?: string; name: string; tag: string; platform: string; status: "active" | "review" | "paused"; cpa: number };
const EMPTY: FormState = { name: "", tag: "", platform: "", status: "active", cpa: 0 };

interface PayoutItem { id: string; amount: number; note: string; createdAt: string }

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function AffiliatesManager({ rows, isAdmin, appUrl }: { rows: AffiliateRow[]; isAdmin: boolean; appUrl: string }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState | null>(null);
  const [payoutFor, setPayoutFor] = useState<AffiliateRow | null>(null);
  const [keyFor, setKeyFor] = useState<AffiliateRow | null>(null);
  const [newKey, setNewKey] = useState<{ name: string; key: string } | null>(null);
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
    const created = !isEdit;
    const createdName = form.name;
    setForm(null);
    router.refresh();
    // Новый аффилиат — показываем сгенерированный API-ключ один раз.
    if (created && data.apiKey) setNewKey({ name: createdName, key: data.apiKey });
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
                <th>Начислено</th><th>Выплачено</th><th>К выплате</th><th>API-ключ</th><th>Статус</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={12} className="muted" style={{ textAlign: "center", padding: 24 }}>Аффилиатов пока нет.</td></tr>}
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
                  <td>
                    <button className="chip aff mono" title="Управление API-доступом" onClick={() => setKeyFor(a)} style={{ cursor: "pointer", border: "none" }}>
                      <KeyRound size={12} style={{ marginRight: 4, verticalAlign: "-1px" }} />
                      {a.apiKeyPrefix ? `${a.apiKeyPrefix}…` : "выдать"}
                    </button>
                  </td>
                  <td><span className={`badge ${STATUS_BADGE[a.status]}`}>{STATUS_LABEL[a.status]}</span></td>
                  <td>
                    <div className="row-act" style={{ opacity: 1, gap: 6 }}>
                      <button className="mini" title="API-доступ" onClick={() => setKeyFor(a)} style={{ color: "var(--blue)" }}><KeyRound size={15} /></button>
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
      {keyFor && <ApiKeyModal affiliate={keyFor} isAdmin={isAdmin} appUrl={appUrl} onClose={() => setKeyFor(null)} onChanged={() => router.refresh()} />}
      {newKey && <NewKeyModal name={newKey.name} apiKey={newKey.key} appUrl={appUrl} onClose={() => setNewKey(null)} />}
    </>
  );
}

/** Кнопка «скопировать» с галочкой-подтверждением. */
function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="mini"
      title="Скопировать"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch { /* clipboard недоступен */ }
      }}
    >
      {done ? <Check size={15} style={{ color: "var(--green)" }} /> : <Copy size={15} />}
    </button>
  );
}

/** Блок с примерами эндпоинтов приёма/статуса лидов для аффилиата. */
function EndpointDocs({ appUrl, tokenPlaceholder }: { appUrl: string; tokenPlaceholder: string }) {
  const post = `${appUrl}/api/affiliate/leads`;
  const curl = `curl -X POST "${post}" \\
  -H "Authorization: Bearer ${tokenPlaceholder}" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"John Doe","email":"john@example.com","phone":"+15551234567","geo":"US"}'`;
  return (
    <>
      <div className="map-col" style={{ fontFamily: "monospace", fontSize: 12, marginBottom: 6 }}>
        <span>POST&nbsp; {post}</span><span className="chip aff">upload</span>
      </div>
      <div className="map-col" style={{ fontFamily: "monospace", fontSize: 12, marginBottom: 6 }}>
        <span>GET&nbsp;&nbsp; {post}?from=YYYY-MM-DD&amp;to=YYYY-MM-DD</span><span className="chip aff">status</span>
      </div>
      <div className="map-col" style={{ fontFamily: "monospace", fontSize: 12, marginBottom: 10 }}>
        <span>GET&nbsp;&nbsp; {post}/&#123;ref&#125;</span><span className="chip aff">1 лид</span>
      </div>
      <div className="section-title">Пример запроса</div>
      <pre style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, fontSize: 11.5, overflowX: "auto", lineHeight: 1.5, whiteSpace: "pre" }}>{curl}</pre>
    </>
  );
}

/** Одноразовый показ сгенерированного ключа при создании аффилиата. */
function NewKeyModal({ name, apiKey, appUrl, onClose }: { name: string; apiKey: string; appUrl: string; onClose: () => void }) {
  return (
    <div className="overlay show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-head"><h3>API-ключ · {name}</h3><div className="mini" onClick={onClose}><X size={16} /></div></div>
        <div className="modal-body">
          <div style={{ color: "var(--amber)", fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>
            Ключ показывается один раз — сохраните его сейчас. Позже админ сможет посмотреть его снова или перевыпустить.
          </div>
          <div className="map-col" style={{ fontFamily: "monospace", fontSize: 12.5, marginBottom: 14, wordBreak: "break-all" }}>
            <span>{apiKey}</span><CopyBtn text={apiKey} />
          </div>
          <EndpointDocs appUrl={appUrl} tokenPlaceholder={apiKey} />
        </div>
        <div className="modal-foot"><button type="button" className="btn btn-primary" onClick={onClose}>Готово</button></div>
      </div>
    </div>
  );
}

/** Управление API-доступом аффилиата: показать (админ), перевыпустить, документация. */
function ApiKeyModal({ affiliate, isAdmin, appUrl, onClose, onChanged }: { affiliate: AffiliateRow; isAdmin: boolean; appUrl: string; onClose: () => void; onChanged: () => void }) {
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState<"reveal" | "rotate" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reveal() {
    setBusy("reveal"); setError(null);
    const res = await fetch(`/api/affiliates/${affiliate.id}/key`);
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setError(data.error ?? "Ошибка"); return; }
    setKey(data.apiKey);
    if (!affiliate.apiKeyPrefix) onChanged(); // ключ создан на лету — обновим список
  }

  async function rotate() {
    if (!window.confirm(`Перевыпустить ключ для «${affiliate.name}»? Старый ключ перестанет работать.`)) return;
    setBusy("rotate"); setError(null);
    const res = await fetch(`/api/affiliates/${affiliate.id}/key`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setError(data.error ?? "Ошибка"); return; }
    setKey(data.apiKey);
    onChanged();
  }

  const tokenPlaceholder = key ?? (affiliate.apiKeyPrefix ? `${affiliate.apiKeyPrefix}…` : "<ВАШ_КЛЮЧ>");

  return (
    <div className="overlay show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-head"><h3>API-доступ · {affiliate.name}</h3><div className="mini" onClick={onClose}><X size={16} /></div></div>
        <div className="modal-body">
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
            Аффилиат отправляет лиды и запрашивает их статусы по ключу (заголовок <code>Authorization: Bearer</code>).
            Метка <span className="chip aff">{affiliate.tag}</span> проставляется лидам автоматически.
          </p>

          <div className="map-col" style={{ fontFamily: "monospace", fontSize: 12.5, marginBottom: 12, wordBreak: "break-all" }}>
            <span>{key ? key : affiliate.apiKeyPrefix ? `${affiliate.apiKeyPrefix}${"•".repeat(12)}` : "ключ ещё не выдан"}</span>
            {key && <CopyBtn text={key} />}
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {isAdmin && (
              <button type="button" className="btn btn-soft btn-sm" onClick={reveal} disabled={busy !== null}>
                <Eye size={15} /> {busy === "reveal" ? "Показываем…" : affiliate.apiKeyPrefix ? "Показать ключ" : "Выдать ключ"}
              </button>
            )}
            {isAdmin && (
              <button type="button" className="btn btn-soft btn-sm" onClick={rotate} disabled={busy !== null}>
                <RefreshCw size={15} /> {busy === "rotate" ? "Выпускаем…" : "Перевыпустить"}
              </button>
            )}
          </div>
          {!isAdmin && <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>Показывать и перевыпускать ключ может только администратор.</div>}
          {error && <div style={{ color: "var(--red)", fontSize: 12.5, fontWeight: 600, marginBottom: 12 }}>{error}</div>}

          <EndpointDocs appUrl={appUrl} tokenPlaceholder={tokenPlaceholder} />
        </div>
        <div className="modal-foot"><button type="button" className="btn btn-primary" onClick={onClose}>Закрыть</button></div>
      </div>
    </div>
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
