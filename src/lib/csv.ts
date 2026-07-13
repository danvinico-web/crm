/** Минимальный CSV-парсер (client-safe): кавычки, экранирование "", переводы строк. */
export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

/** Парсит CSV в «массив массивов» (учитывает кавычки и авто-детект разделителя). */
export function parseCsvAoa(text: string, delimiter?: string): string[][] {
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/^﻿/, "");
  // Авто-детект разделителя по первой строке: ; \t или ,
  const firstLine = src.slice(0, src.indexOf("\n") >= 0 ? src.indexOf("\n") : src.length);
  const delim = delimiter ?? (firstLine.includes(";") ? ";" : firstLine.includes("\t") ? "\t" : ",");

  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

/** Преобразует «массив массивов» в {headers, rows}. firstRowHeader — брать ли 1-ю строку как заголовки. */
export function aoaToParsed(aoa: string[][], firstRowHeader: boolean): ParsedCsv {
  if (aoa.length === 0) return { headers: [], rows: [] };
  const width = aoa.reduce((m, r) => Math.max(m, r.length), 0);
  const headers = firstRowHeader
    ? aoa[0].map((h, i) => (h.trim() || `Колонка ${i + 1}`))
    : Array.from({ length: width }, (_, i) => `Колонка ${i + 1}`);
  const body = firstRowHeader ? aoa.slice(1) : aoa;
  const rows = body.map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = (r[idx] ?? "").toString().trim(); });
    return obj;
  });
  return { headers, rows };
}

export function parseCsv(text: string, delimiter?: string): ParsedCsv {
  return aoaToParsed(parseCsvAoa(text, delimiter), true);
}

/** Похоже ли, что первая строка — заголовки (нет email/длинных телефонов в ней). */
export function looksLikeHeader(aoa: string[][]): boolean {
  if (aoa.length < 2) return true;
  const first = aoa[0];
  const hasData = first.some((v) => {
    const s = (v ?? "").toString();
    return s.includes("@") || (s.replace(/\D/g, "").length >= 8);
  });
  return !hasData;
}

/** Внутренние поля лида, на которые маппятся колонки CSV. */
export const INTERNAL_FIELDS = [
  { key: "fullName", label: "Имя" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Телефон" },
  { key: "geo", label: "Гео" },
  { key: "affiliateTag", label: "Метка аффилиата" },
  { key: "balance", label: "Баланс / капитал" },
  { key: "comment", label: "Комментарий" },
] as const;

/**
 * Автоугадывание маппинга по СОДЕРЖИМОМУ колонок (для файлов без заголовков):
 * email — по «@», телефон — по цифрам, гео — по 2-буквенному коду, имя — первый
 * текстовый столбец. Возвращает { internalField: header }.
 */
export function guessMappingByContent(parsed: ParsedCsv): Record<string, string> {
  const sample = parsed.rows.slice(0, 30);
  const share = (header: string, pred: (v: string) => boolean) => {
    const vals = sample.map((r) => r[header]).filter((v) => v && v.trim() !== "");
    if (vals.length === 0) return 0;
    return vals.filter(pred).length / vals.length;
  };
  const isEmail = (v: string) => v.includes("@");
  const isPhone = (v: string) => v.replace(/\D/g, "").length >= 8 && !v.includes("@");
  const isGeo = (v: string) => /^[a-z]{2}$/i.test(v.trim());
  // Баланс/капитал: содержит «$», диапазон «-», «+», «k» или короткое число.
  const isBalance = (v: string) => /[$€£]|\d[\d.,]*\s*[-–+]|\bk\b|^\s*\d{2,7}\s*\$?\s*$/i.test(v.trim());

  const out: Record<string, string> = {};
  const used = new Set<string>();
  const claim = (field: string, header?: string) => {
    if (header && !used.has(header)) { out[field] = header; used.add(header); }
  };

  const emailCol = parsed.headers.find((h) => share(h, isEmail) >= 0.5);
  claim("email", emailCol);
  const phoneCol = parsed.headers.find((h) => !used.has(h) && share(h, isPhone) >= 0.5);
  claim("phone", phoneCol);
  const geoCol = parsed.headers.find((h) => !used.has(h) && share(h, isGeo) >= 0.5);
  claim("geo", geoCol);
  const balanceCol = parsed.headers.find((h) => !used.has(h) && share(h, isBalance) >= 0.5);
  claim("balance", balanceCol);
  // Имя — первый ещё не занятый столбец с преимущественно текстовыми значениями.
  const nameCol = parsed.headers.find(
    (h) => !used.has(h) && share(h, (v) => /[a-zа-яё]/i.test(v) && !isEmail(v) && !isPhone(v)) >= 0.5,
  );
  claim("fullName", nameCol);
  return out;
}

/** Автоугадывание маппинга колонка → внутреннее поле по названию заголовка. */
export function guessMapping(headers: string[]): Record<string, string> {
  const guess: Record<string, string> = {};
  const rules: Record<string, RegExp> = {
    fullName: /(full[_ ]?name|name|имя|fio|contact)/i,
    email: /(e[-_ ]?mail|почта)/i,
    phone: /(phone|tel|телефон|msisdn)/i,
    geo: /(geo|country|страна|гео)/i,
    affiliateTag: /(aff|sub[_ ]?id|publisher|метка|source[_ ]?tag)/i,
    comment: /(comment|коммент|заметк|note|примечан)/i,
  };
  for (const [internal, re] of Object.entries(rules)) {
    const found = headers.find((h) => re.test(h));
    if (found) guess[internal] = found;
  }
  return guess;
}
