"use strict";

/**
 * In-memory хранилище тестового MVCRM: аффилиаты (по токену) и их клиенты.
 * Данные живут только в процессе — рестарт сбрасывает состояние (это удобно
 * для повторяемых тестов). Конфигурация читается из env один раз при старте.
 *
 * Тестовые данные — это ЧИСТЫЙ JSON (data/seed-data.json), никакой реальной БД.
 * Файл грузится в память при старте; правь его, чтобы менять моки.
 */

const fs = require("fs");
const path = require("path");

const config = {
  port: Number(process.env.PORT) || 3001,
  host: process.env.HOST || "127.0.0.1",
  // Любой непустой токен принимается и аффилиат создаётся на лету.
  allowAnyToken: /^(1|true|yes)$/i.test(process.env.ALLOW_ANY_TOKEN || ""),
  // Строгая проверка страны (как на реальном MVCRM). Выключить: STRICT_COUNTRY=false.
  strictCountry: !/^(0|false|no)$/i.test(process.env.STRICT_COUNTRY || ""),
  // Логировать каждый запрос в консоль.
  logRequests: !/^(0|false|no)$/i.test(process.env.LOG_REQUESTS || ""),
  // JSON-файл с моками (аффилиаты + клиенты). Можно переопределить env SEED_FILE.
  seedFile: process.env.SEED_FILE || path.join(__dirname, "..", "data", "seed-data.json"),
};

/** @typedef {{ id:number, first_name:string, last_name:string, name:string, email:string, phone:string, source:string, country:string, city:string, details:string, comment:string, status:string, created_at:Date }} Customer */
/** @typedef {{ id:number, token:string, first_name:string, last_name:string, customers:Customer[] }} Affiliate */

/** @type {Map<string, Affiliate>} token → affiliate */
const affiliatesByToken = new Map();

let nextAffiliateId = 1;
let nextCustomerId = 12345; // стартуем с «правдоподобного» id из документации

function addAffiliate(token, firstName, lastName) {
  const aff = {
    id: nextAffiliateId++,
    token,
    first_name: firstName,
    last_name: lastName,
    customers: [],
  };
  affiliatesByToken.set(token, aff);
  return aff;
}

/** Возвращает аффилиата по токену. В allowAnyToken создаёт его на лету. */
function getAffiliate(token) {
  if (!token) return null;
  let aff = affiliatesByToken.get(token);
  if (!aff && config.allowAnyToken) {
    aff = addAffiliate(token, "Auto", "Affiliate");
  }
  return aff || null;
}

/** Есть ли у аффилиата клиент с таким email (регистронезависимо). */
function emailTaken(aff, email) {
  const e = String(email).trim().toLowerCase();
  return aff.customers.some((c) => c.email.toLowerCase() === e);
}

/** Создаёт клиента у аффилиата и возвращает его. */
function addCustomer(aff, data) {
  const first = (data.first_name || "").trim();
  const last = (data.last_name || "").trim();
  const customer = {
    id: nextCustomerId++,
    first_name: first,
    last_name: last,
    name: [first, last].filter(Boolean).join(" ") || first,
    email: String(data.email || "").trim(),
    phone: String(data.phone || "").trim(),
    source: String(data.source || "").trim(),
    country: data.country, // уже канонизировано вызывающим кодом
    city: (data.city || "").trim(),
    details: (data.details || "").trim(),
    comment: (data.comment || "").trim(),
    // Статус во внешнем виде MVCRM ("new", "call back", "ftd", ...) — как есть.
    status: (data.status && String(data.status).trim()) || "new",
    created_at: resolveCreatedAt(data, aff.customers.length),
  };
  aff.customers.push(customer);
  return customer;
}

/**
 * Определяет дату регистрации клиента из мок-записи:
 *   1) явный ISO `date`/`created_at`; иначе
 *   2) относительный `daysAgo` (от сегодня) — данные всегда «свежие»; иначе
 *   3) сейчас.
 * Время суток выводится детерминированно из idx — порядок стабилен между запусками.
 */
function resolveCreatedAt(data, idx) {
  if (data.created_at instanceof Date) return data.created_at;
  if (data.date || data.created_at) {
    const d = new Date(data.date || data.created_at);
    if (!isNaN(d.getTime())) return d;
  }
  const days = Number.isFinite(data.daysAgo) ? data.daysAgo : 0;
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(8 + (idx % 11), (idx * 7) % 60, (idx * 13) % 60, 0);
  return d;
}

/** Инициализация моков. Приоритет: env-токены → allowAnyToken → JSON-файл → дефолт. */
function seed() {
  const fromEnv = (process.env.MVCRM_TOKENS || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (fromEnv.length) {
    fromEnv.forEach((token, i) => addAffiliate(token, `Affiliate ${i + 1}`, "Test"));
    return { source: "MVCRM_TOKENS", affiliates: fromEnv.length, customers: 0 };
  }

  if (config.allowAnyToken) return { source: "ALLOW_ANY_TOKEN", affiliates: 0, customers: 0 };

  // Основной путь: мок-данные из JSON-файла (никакой реальной БД).
  const loaded = loadFromFile(config.seedFile);
  if (loaded) return loaded;

  // Фолбэк, если файла нет — минимальный набор, чтобы сервер был рабочим.
  addAffiliate("test-token-1", "Alice", "Affiliate");
  addAffiliate("test-token-2", "Bob", "Partner");
  return { source: "fallback", affiliates: 2, customers: 0 };
}

/** Грузит аффилиатов и клиентов из JSON-файла. Возвращает сводку или null. */
function loadFromFile(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return null; // файла нет — пусть решает вызывающий
  }
  let json;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    console.error(`[testserver] Не удалось разобрать ${file}: ${err.message}`);
    return null;
  }
  const list = Array.isArray(json) ? json : Array.isArray(json.affiliates) ? json.affiliates : [];
  let customerCount = 0;
  for (const a of list) {
    if (!a || !a.token) continue;
    const aff = addAffiliate(a.token, a.first_name || "Affiliate", a.last_name || "");
    for (const c of a.customers || []) {
      addCustomer(aff, c);
      customerCount++;
    }
  }
  return { source: path.basename(file), affiliates: list.length, customers: customerCount };
}

function listTokens() {
  return [...affiliatesByToken.keys()];
}

module.exports = {
  config,
  seed,
  getAffiliate,
  emailTaken,
  addCustomer,
  listTokens,
};
