/** Минимальный CSV-парсер (client-safe): кавычки, экранирование "", переводы строк. */
export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCsv(text: string, delimiter = ","): ParsedCsv {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
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

  const nonEmpty = rows.filter((r) => r.some((v) => v.trim() !== ""));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const headers = nonEmpty[0].map((h) => h.trim());
  const dataRows = nonEmpty.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim();
    });
    return obj;
  });

  return { headers, rows: dataRows };
}

/** Внутренние поля лида, на которые маппятся колонки CSV. */
export const INTERNAL_FIELDS = [
  { key: "fullName", label: "Имя" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Телефон" },
  { key: "geo", label: "Гео" },
  { key: "affiliateTag", label: "Метка аффилиата" },
] as const;

/** Автоугадывание маппинга колонка → внутреннее поле по названию заголовка. */
export function guessMapping(headers: string[]): Record<string, string> {
  const guess: Record<string, string> = {};
  const rules: Record<string, RegExp> = {
    fullName: /(full[_ ]?name|name|имя|fio|contact)/i,
    email: /(e[-_ ]?mail|почта)/i,
    phone: /(phone|tel|телефон|msisdn)/i,
    geo: /(geo|country|страна|гео)/i,
    affiliateTag: /(aff|sub[_ ]?id|publisher|метка|source[_ ]?tag)/i,
  };
  for (const [internal, re] of Object.entries(rules)) {
    const found = headers.find((h) => re.test(h));
    if (found) guess[internal] = found;
  }
  return guess;
}
