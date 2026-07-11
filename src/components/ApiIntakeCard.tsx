"use client";

import { useState } from "react";
import Link from "next/link";
import { Zap, Eye, EyeOff } from "lucide-react";
import type { SourceLite } from "@/app/(app)/import/page";

type TestResult = {
  outcome: string;
  leadId?: string;
  sample?: { name: string; email: string; geo: string; aff: string };
};

const OUTCOME_LABEL: Record<string, string> = {
  created: "создан",
  duplicate: "дубль",
  idempotent: "повтор (идемпотентно)",
  rejected: "отклонён",
};

export default function ApiIntakeCard({ sources, isAdmin }: { sources: SourceLite[]; isAdmin: boolean }) {
  const nonCsv = sources.filter((s) => s.type !== "CSV");
  const list = nonCsv.length ? nonCsv : sources;
  const [sourceId, setSourceId] = useState(list[0]?.id ?? "");
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = sources.find((s) => s.id === sourceId);
  const isGoogle = selected?.type === "GOOGLE_SHEET" || selected?.type === "GOOGLE_FORM" || selected?.type === "QUIZ";

  const appsScript = selected
    ? `function onFormSubmit(e){
  var url = "${selected.webhookUrl}";
  var secret = "${isAdmin && selected.secret ? selected.secret : "<СЕКРЕТ_ИСТОЧНИКА>"}";
  var body = JSON.stringify({
    name:  e.namedValues["Имя"]?.[0],
    email: e.namedValues["Email"]?.[0],
    phone: e.namedValues["Телефон"]?.[0],
    geo:   e.namedValues["Гео"]?.[0],
    aff:   e.namedValues["aff"]?.[0]
  });
  var sig = Utilities.computeHmacSha256Signature(body, secret)
    .map(function(b){return ("0"+(b&0xFF).toString(16)).slice(-2);}).join("");
  UrlFetchApp.fetch(url, { method:"post", contentType:"application/json",
    headers:{ "X-Signature": sig }, payload: body });
}`
    : "";

  async function sendTest() {
    if (!sourceId) return;
    setTesting(true);
    setError(null);
    const res = await fetch("/api/import/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId }),
    });
    const data = await res.json().catch(() => ({}));
    setTesting(false);
    if (!res.ok) {
      setError(data.error ?? "Ошибка");
      return;
    }
    setResult(data);
  }

  return (
    <div className="card panel">
      <div className="panel-head">
        <h3>Приём по API</h3>
        <span className="chip src">real-time</span>
      </div>
      <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
        Квизы, формы и Apps Script шлют лиды на ваш endpoint (проверка по HMAC-подписи). Валидация, дедуп и роутинг — мгновенно.
      </p>

      <div className="field">
        <label>Источник</label>
        <select value={sourceId} onChange={(e) => { setSourceId(e.target.value); setResult(null); }}>
          {list.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div className="map-col" style={{ fontFamily: "monospace", fontSize: 12, marginBottom: 8 }}>
        <span>POST&nbsp; {selected?.webhookUrl}</span>
        <span className="chip aff">HMAC</span>
      </div>

      {isAdmin && selected?.secret && (
        <div className="map-col" style={{ fontFamily: "monospace", fontSize: 12, marginBottom: 8 }}>
          <span>secret: {showSecret ? selected.secret : "•".repeat(18)}</span>
          <button className="mini" onClick={() => setShowSecret((v) => !v)} title="Показать/скрыть секрет">
            {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      )}

      {isGoogle && (
        <>
          <div className="section-title">Google Apps Script (onFormSubmit)</div>
          <pre style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, fontSize: 11.5, overflowX: "auto", lineHeight: 1.5 }}>
            {appsScript}
          </pre>
        </>
      )}

      <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={sendTest} disabled={testing || !sourceId}>
        <Zap size={16} /> {testing ? "Отправляем…" : "Отправить тестовый лид"}
      </button>

      {error && <div style={{ color: "var(--red)", fontSize: 12.5, fontWeight: 600, marginTop: 12 }}>{error}</div>}

      {result && (
        <div className="card" style={{ marginTop: 12, padding: 12, background: "var(--surface-2)" }}>
          <div style={{ fontSize: 13 }}>
            Лид <b>{result.sample?.name}</b> ({result.sample?.geo}, {result.sample?.aff}) —{" "}
            <b style={{ color: result.outcome === "created" ? "var(--green)" : "var(--amber)" }}>
              {OUTCOME_LABEL[result.outcome] ?? result.outcome}
            </b>
          </div>
          <Link href="/leads" className="btn btn-soft btn-sm" style={{ marginTop: 10 }}>Открыть в списке лидов →</Link>
        </div>
      )}
    </div>
  );
}
