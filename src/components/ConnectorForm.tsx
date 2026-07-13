"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Plus, Trash2 } from "lucide-react";
import { API_TYPES, API_TYPE_LABEL, LEAD_STATUSES, LEAD_STATUS_LABEL, type ApiType, type LeadStatus } from "@/lib/enums";

const INTERNAL_FIELDS = ["firstName", "lastName", "fullName", "email", "phone", "geo", "affiliateTag"];

interface FieldMap { externalField: string; internalField: string }
interface StatusMap { externalValue: string; internalValue: LeadStatus }

interface FormState {
  office: { name: string; code: string; logoText: string; color: string };
  name: string;
  apiType: ApiType;
  baseUrl: string;
  authScheme: "header" | "query" | "body";
  authKeyName: string;
  apiKey: string;
  sendPath: string;
  statusPath: string;
  sandbox: boolean;
  fieldMappings: FieldMap[];
  statusMappings: StatusMap[];
}

const DEFAULT_FORM: FormState = {
  office: { name: "", code: "", logoText: "OF", color: "#4f7cff,#6a5cff" },
  name: "",
  apiType: "REST_JSON",
  baseUrl: "https://",
  authScheme: "header",
  authKeyName: "Authorization",
  apiKey: "",
  sendPath: "/api/leads",
  statusPath: "",
  sandbox: true,
  fieldMappings: [
    { externalField: "first_name", internalField: "firstName" },
    { externalField: "last_name", internalField: "lastName" },
    { externalField: "email", internalField: "email" },
    { externalField: "phone", internalField: "phone" },
    { externalField: "country", internalField: "geo" },
    { externalField: "source", internalField: "affiliateTag" },
  ],
  statusMappings: [
    { externalValue: "new", internalValue: "NEW" },
    { externalValue: "call back", internalValue: "CALLBACK" },
    { externalValue: "no answer", internalValue: "NO_ANSWER" },
    { externalValue: "wrong info", internalValue: "WRONG_INFO" },
    { externalValue: "not interested", internalValue: "NOT_INTERESTED" },
    { externalValue: "ftd", internalValue: "DEPOSIT" },
  ],
};

export default function ConnectorForm({ integrationId, onClose }: { integrationId?: string; onClose: () => void }) {
  const router = useRouter();
  const isEdit = !!integrationId;
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!integrationId) return;
    fetch(`/api/integrations/${integrationId}`)
      .then((r) => r.json())
      .then((d) => {
        const i = d.integration;
        if (!i) return;
        setForm({
          office: { name: i.office?.name ?? "", code: i.office?.code ?? "", logoText: i.office?.logoText ?? "OF", color: i.office?.color ?? "#4f7cff,#6a5cff" },
          name: i.name,
          apiType: i.apiType,
          baseUrl: i.baseUrl,
          authScheme: i.authScheme,
          authKeyName: i.authKeyName,
          apiKey: "",
          sendPath: i.sendPath,
          statusPath: i.statusPath ?? "",
          sandbox: i.sandbox,
          fieldMappings: i.fieldMappings ?? [],
          statusMappings: i.statusMappings ?? [],
        });
      })
      .catch(() => setError("Не удалось загрузить интеграцию"))
      .finally(() => setLoading(false));
  }, [integrationId]);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = {
      name: form.name,
      apiType: form.apiType,
      baseUrl: form.baseUrl,
      authScheme: form.authScheme,
      authKeyName: form.authKeyName,
      apiKey: form.apiKey || undefined,
      sendPath: form.sendPath,
      statusPath: form.statusPath || undefined,
      fieldMappings: form.fieldMappings.filter((m) => m.externalField && m.internalField),
      statusMappings: form.statusMappings.filter((m) => m.externalValue),
      sandbox: form.sandbox,
      ...(isEdit ? {} : { office: form.office }),
    };
    const res = await fetch(isEdit ? `/api/integrations/${integrationId}` : "/api/integrations", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Ошибка сохранения");
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div className="overlay show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 640, maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div className="modal-head">
          <h3>{isEdit ? "Редактировать коннектор" : "Подключить офис / CRM"}</h3>
          <div className="mini" onClick={onClose}><X size={16} /></div>
        </div>
        <form onSubmit={save} style={{ overflowY: "auto" }}>
          <div className="modal-body">
            {loading ? (
              <div className="muted">Загрузка…</div>
            ) : (
              <>
                {!isEdit && (
                  <>
                    <div className="section-title" style={{ margin: "0 0 12px" }}>Офис</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div className="field"><label>Название офиса</label><input value={form.office.name} onChange={(e) => set("office", { ...form.office, name: e.target.value })} placeholder="Office X" required /></div>
                      <div className="field"><label>Код</label><input value={form.office.code} onChange={(e) => set("office", { ...form.office, code: e.target.value })} placeholder="office_x" required /></div>
                      <div className="field"><label>Плитка (2-3 буквы)</label><input value={form.office.logoText} onChange={(e) => set("office", { ...form.office, logoText: e.target.value })} maxLength={3} /></div>
                      <div className="field"><label>Градиент</label><input value={form.office.color} onChange={(e) => set("office", { ...form.office, color: e.target.value })} placeholder="#4f7cff,#6a5cff" /></div>
                    </div>
                  </>
                )}

                <div className="section-title">Коннектор</div>
                <div className="field"><label>Название</label><input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Trackbox · Office X" required /></div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="field"><label>Тип API</label>
                    <select value={form.apiType} onChange={(e) => set("apiType", e.target.value as ApiType)}>
                      {API_TYPES.map((t) => <option key={t} value={t}>{API_TYPE_LABEL[t]}</option>)}
                    </select>
                  </div>
                  <div className="field"><label>Base URL</label><input value={form.baseUrl} onChange={(e) => set("baseUrl", e.target.value)} placeholder="https://api.crm.com" required /></div>
                  <div className="field"><label>Путь отправки</label><input value={form.sendPath} onChange={(e) => set("sendPath", e.target.value)} placeholder="/api/leads" required /></div>
                  <div className="field"><label>Путь статуса (опц.)</label><input value={form.statusPath} onChange={(e) => set("statusPath", e.target.value)} placeholder="/api/leads/status" /></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="field"><label>Авторизация</label>
                    <select value={form.authScheme} onChange={(e) => set("authScheme", e.target.value as FormState["authScheme"])}>
                      <option value="header">Заголовок (header)</option>
                      <option value="query">Query-параметр</option>
                      <option value="body">В теле (body)</option>
                    </select>
                  </div>
                  <div className="field"><label>Имя ключа</label><input value={form.authKeyName} onChange={(e) => set("authKeyName", e.target.value)} placeholder="Authorization / api_token" required /></div>
                </div>
                <div className="field"><label>API-ключ {isEdit && <span className="muted">(пусто = не менять)</span>}</label><input type="password" value={form.apiKey} onChange={(e) => set("apiKey", e.target.value)} placeholder={isEdit ? "••••••" : "секретный ключ CRM"} {...(isEdit ? {} : { required: true })} /></div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                  <input type="checkbox" checked={form.sandbox} onChange={(e) => set("sandbox", e.target.checked)} style={{ width: 16, height: 16 }} />
                  Sandbox (dry-run — не делать реальный HTTP)
                </label>

                {/* Маппинг полей */}
                <div className="section-title">Маппинг полей (наше → их поле)</div>
                {form.fieldMappings.map((m, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 30px", gap: 8, marginBottom: 8, alignItems: "center" }}>
                    <select value={m.internalField} onChange={(e) => { const fm = [...form.fieldMappings]; fm[i] = { ...m, internalField: e.target.value }; set("fieldMappings", fm); }}
                      style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 11px", color: "var(--text)", fontSize: 13 }}>
                      {INTERNAL_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <input value={m.externalField} onChange={(e) => { const fm = [...form.fieldMappings]; fm[i] = { ...m, externalField: e.target.value }; set("fieldMappings", fm); }}
                      placeholder="их поле" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 11px", color: "var(--text)", fontSize: 13 }} />
                    <button type="button" className="mini" style={{ color: "var(--red)" }} onClick={() => set("fieldMappings", form.fieldMappings.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
                  </div>
                ))}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => set("fieldMappings", [...form.fieldMappings, { externalField: "", internalField: "email" }])}><Plus size={14} /> Поле</button>

                {/* Маппинг статусов */}
                <div className="section-title">Маппинг статусов (их статус → наш)</div>
                {form.statusMappings.map((m, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 30px", gap: 8, marginBottom: 8, alignItems: "center" }}>
                    <input value={m.externalValue} onChange={(e) => { const sm = [...form.statusMappings]; sm[i] = { ...m, externalValue: e.target.value }; set("statusMappings", sm); }}
                      placeholder="их статус (напр. deposit)" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 11px", color: "var(--text)", fontSize: 13 }} />
                    <select value={m.internalValue} onChange={(e) => { const sm = [...form.statusMappings]; sm[i] = { ...m, internalValue: e.target.value as LeadStatus }; set("statusMappings", sm); }}
                      style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 11px", color: "var(--text)", fontSize: 13 }}>
                      {LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>)}
                    </select>
                    <button type="button" className="mini" style={{ color: "var(--red)" }} onClick={() => set("statusMappings", form.statusMappings.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
                  </div>
                ))}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => set("statusMappings", [...form.statusMappings, { externalValue: "", internalValue: "NEW" }])}><Plus size={14} /> Статус</button>

                {error && <div style={{ color: "var(--red)", fontSize: 12.5, fontWeight: 600, marginTop: 12 }}>{error}</div>}
              </>
            )}
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn-primary" disabled={busy || loading}>{busy ? "Сохраняем…" : isEdit ? "Сохранить" : "Подключить"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
