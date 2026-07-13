"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Check, FileSpreadsheet } from "lucide-react";
import { aoaToParsed, looksLikeHeader, guessMapping, guessMappingByContent, INTERNAL_FIELDS, type ParsedCsv } from "@/lib/csv";
import { readSpreadsheetAoa } from "@/lib/spreadsheet";
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
  const [aoa, setAoa] = useState<string[][] | null>(null);
  const [firstRowHeader, setFirstRowHeader] = useState(true);
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [customFields, setCustomFields] = useState<{ key: string; label: string }[]>([]);

  useEffect(() => {
    fetch("/api/lead-fields").then((r) => r.json()).then((d) => setCustomFields(d.fields ?? [])).catch(() => {});
  }, []);

  // Ядро + метка аффилиата + кастомные поля клиента как цели маппинга.
  const targetFields = [
    ...INTERNAL_FIELDS.map((f) => ({ key: f.key, label: f.label })),
    ...customFields.map((f) => ({ key: `custom:${f.key}`, label: `${f.label} (доп. поле)` })),
  ];

  /** Пересобирает {headers, rows} и авто-маппинг из «массива массивов». */
  function applyParse(rows2d: string[][], header: boolean) {
    const p = aoaToParsed(rows2d, header);
    setParsed(p);
    // По содержимому (работает и без заголовков) + по названиям колонок (перекрывает).
    setMapping({ ...guessMappingByContent(p), ...(header ? guessMapping(p.headers) : {}) });
  }

  async function onFile(file: File) {
    try {
      const rows2d = await readSpreadsheetAoa(file);
      if (rows2d.length === 0) { setError("Файл пустой или не распознан."); return; }
      const header = looksLikeHeader(rows2d);
      setError(null);
      setSummary(null);
      setFileName(file.name);
      setAoa(rows2d);
      setFirstRowHeader(header);
      applyParse(rows2d, header);
    } catch {
      setError("Не удалось прочитать файл. Поддерживаются CSV и Excel (.xlsx).");
    }
  }

  function toggleHeader(next: boolean) {
    setFirstRowHeader(next);
    if (aoa) applyParse(aoa, next);
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
  const preview = parsed?.rows.slice(0, 3) ?? [];

  return (
    <div className="card panel">
      <div className="panel-head">
        <h3>Загрузка таблицей</h3>
        <span className="chip src">CSV · Excel</span>
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
        accept=".csv,.xlsx,.xls,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        style={{ display: "none" }}
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      <div className="drop" onClick={() => fileRef.current?.click()}>
        <div className="ic"><UploadCloud size={24} /></div>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{fileName ?? "Нажмите, чтобы выбрать файл"}</div>
        <div className="muted" style={{ fontSize: 12.5 }}>CSV или Excel (.xlsx) · автоопределение колонок и дублей</div>
      </div>

      {parsed && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={firstRowHeader} onChange={(e) => toggleHeader(e.target.checked)} />
              Первая строка — заголовки
            </label>
            <span className="muted" style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 5 }}>
              <FileSpreadsheet size={14} /> строк к импорту: <b>{parsed.rows.length}</b>
            </span>
          </div>

          {/* Превью первых строк */}
          <div className="tbl-scroll" style={{ marginTop: 10, maxHeight: 160, border: "1px solid var(--border)", borderRadius: 10 }}>
            <table style={{ fontSize: 12 }}>
              <thead>
                <tr>{parsed.headers.map((h) => <th key={h} style={{ whiteSpace: "nowrap" }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i}>{parsed.headers.map((h) => <td key={h} className="muted" style={{ whiteSpace: "nowrap", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>{r[h] || "—"}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="section-title">Маппинг колонок</div>
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
