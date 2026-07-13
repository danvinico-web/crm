"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Check } from "lucide-react";
import { parseCsv, guessMapping, INTERNAL_FIELDS, type ParsedCsv } from "@/lib/csv";
import type { SourceLite } from "@/app/(app)/import/page";

type Summary = {
  total: number;
  created: number;
  duplicate: number;
  idempotent: number;
  rejected: number;
  errorsSample?: string[];
};

export default function CsvImport({ sources }: { sources: SourceLite[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const defaultSource = sources.find((s) => s.type === "CSV") ?? sources[0];
  const [sourceId, setSourceId] = useState(defaultSource?.id ?? "");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [customFields, setCustomFields] = useState<{ key: string; label: string }[]>([]);

  useEffect(() => {
    fetch("/api/lead-fields").then((r) => r.json()).then((d) => setCustomFields(d.fields ?? [])).catch(() => {});
  }, []);

  // Ядро + кастомные поля клиента как цели маппинга.
  const targetFields = [
    ...INTERNAL_FIELDS.map((f) => ({ key: f.key, label: f.label })),
    ...customFields.map((f) => ({ key: `custom:${f.key}`, label: `${f.label} (доп. поле)` })),
  ];

  async function onFile(file: File) {
    const text = await file.text();
    const p = parseCsv(text);
    if (p.headers.length === 0) {
      setError("Не удалось распознать CSV.");
      return;
    }
    setError(null);
    setSummary(null);
    setFileName(file.name);
    setParsed(p);
    setMapping(guessMapping(p.headers));
  }

  async function runImport() {
    if (!parsed || !sourceId) return;
    setLoading(true);
    setError(null);
    const res = await fetch("/api/import/csv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId, mapping, rows: parsed.rows }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Ошибка импорта");
      return;
    }
    setSummary(data);
    router.refresh();
  }

  const canImport = parsed && parsed.rows.length > 0 && !!mapping.fullName && !loading;

  return (
    <div className="card panel">
      <div className="panel-head">
        <h3>Загрузка таблицей</h3>
        <span className="chip src">CSV</span>
      </div>

      <div className="field">
        <label>Источник (куда отнести лиды)</label>
        <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: "none" }}
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      <div className="drop" onClick={() => fileRef.current?.click()}>
        <div className="ic"><UploadCloud size={24} /></div>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{fileName ?? "Нажмите, чтобы выбрать CSV"}</div>
        <div className="muted" style={{ fontSize: 12.5 }}>Автоопределение колонок и дублей</div>
      </div>

      {parsed && (
        <>
          <div className="section-title">Маппинг колонок · строк: {parsed.rows.length}</div>
          {targetFields.map((f) => (
            <div className="map-row" key={f.key} style={{ gridTemplateColumns: "1fr 24px 1fr" }}>
              <div className="map-col">
                <select
                  value={mapping[f.key] ?? ""}
                  onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                  style={{ background: "transparent", border: "none", color: "var(--text)", width: "100%", outline: "none" }}
                >
                  <option value="">— не импортировать —</option>
                  {parsed.headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <span className="t">колонка файла</span>
              </div>
              <span className="arrow" style={{ textAlign: "center" }}>→</span>
              <div className="map-col">
                <span><b>{f.label}</b></span>
                <span className="t">поле CRM</span>
              </div>
            </div>
          ))}

          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={runImport} disabled={!canImport}>
            <Check size={16} /> {loading ? "Импортируем…" : `Импортировать ${parsed.rows.length} лидов`}
          </button>
          {!mapping.fullName && <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Укажите колонку для «Имя», чтобы импортировать.</div>}
        </>
      )}

      {error && <div style={{ color: "var(--red)", fontSize: 12.5, fontWeight: 600, marginTop: 12 }}>{error}</div>}

      {summary && (
        <div className="card" style={{ marginTop: 14, padding: 14, background: "var(--surface-2)" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Импортировано из {summary.total} строк:</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
            <span><b style={{ color: "var(--green)" }}>{summary.created}</b> создано</span>
            <span><b style={{ color: "var(--amber)" }}>{summary.duplicate}</b> дублей</span>
            <span><b className="muted">{summary.idempotent}</b> повторов</span>
            <span><b style={{ color: "var(--red)" }}>{summary.rejected}</b> отклонено</span>
          </div>
          {summary.errorsSample && summary.errorsSample.length > 0 && (
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Примеры ошибок: {summary.errorsSample.join(" · ")}</div>
          )}
        </div>
      )}
    </div>
  );
}
