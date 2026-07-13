import * as XLSX from "xlsx";
import { parseCsvAoa } from "@/lib/csv";

/**
 * Читает файл-таблицу (CSV или Excel .xlsx/.xls) в «массив массивов» строк.
 * Excel парсится в браузере (SheetJS), берётся первый лист. Пустые строки
 * отбрасываются. Значения приводятся к строкам.
 */
export async function readSpreadsheetAoa(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  const isExcel = name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".xlsm");

  if (!isExcel) {
    const text = await file.text();
    return parseCsvAoa(text);
  }

  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const first = wb.SheetNames[0];
  if (!first) return [];
  const ws = wb.Sheets[first];
  // raw: true — числа приходят как числа (телефоны не превращаются в 3.9E+11).
  const aoa = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
    header: 1,
    raw: true,
    defval: "",
    blankrows: false,
  });
  return aoa
    .map((r) => r.map((c) => cellToString(c)))
    .filter((r) => r.some((v) => v.trim() !== ""));
}

/** Приводит значение ячейки к строке без экспоненциальной записи для длинных чисел. */
function cellToString(c: string | number | null): string {
  if (c == null) return "";
  if (typeof c === "number") {
    // Целые (телефоны/суммы) — без дробей и экспоненты.
    if (Number.isInteger(c)) return c.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 0 });
    return String(c);
  }
  return String(c);
}

export function fileKind(file: File): "csv" | "excel" {
  const n = file.name.toLowerCase();
  return n.endsWith(".xlsx") || n.endsWith(".xls") || n.endsWith(".xlsm") ? "excel" : "csv";
}
