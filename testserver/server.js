"use strict";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  MVCRM Test Server — локальный мок API MyView CRM (mvcrm.online).
 *
 *  Точно повторяет контракт интеграции аффилиатов, чтобы тестировать LeadHub
 *  без обращения к реальному https://mvcrm.online. Нулевые зависимости —
 *  только встроенный модуль http, запускается через `node server.js`.
 *
 *  Роуты (авторизация через ?api_token=... ИЛИ заголовок Authorization: Bearer):
 *    POST /customers/integration   — регистрация клиента
 *    GET  /customers/integration   — список клиентов (фильтр ?from=&to=)
 *    GET  /health                  — healthcheck
 *    GET  /                        — информация о сервере
 * ─────────────────────────────────────────────────────────────────────────────
 */

const http = require("http");
const { URL } = require("url");
const { config, seed, getAffiliate, emailTaken, addCustomer, listTokens } = require("./lib/store");
const { resolveCountry } = require("./lib/countries");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Утилиты ответа ──────────────────────────────────────────────────────────

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    // Мок server-to-server, но CORS не мешает, если кто-то дёрнет из браузера.
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  res.end(payload);
}

/** Достаёт api_token из query или из заголовка Authorization: Bearer <token>. */
function extractToken(url, req) {
  const q = url.searchParams.get("api_token");
  if (q) return q.trim();
  const auth = req.headers["authorization"];
  if (auth && /^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, "").trim();
  return "";
}

/** Читает тело запроса и парсит JSON или x-www-form-urlencoded. */
function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 1_000_000) {
        // защита от гигантских тел — обрываем
        req.destroy();
        resolve({});
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) return resolve({});
      const ctype = String(req.headers["content-type"] || "");
      try {
        if (ctype.includes("application/json")) {
          return resolve(JSON.parse(raw));
        }
        if (ctype.includes("application/x-www-form-urlencoded")) {
          return resolve(Object.fromEntries(new URLSearchParams(raw)));
        }
        // Пытаемся угадать: сначала JSON, потом form.
        try {
          return resolve(JSON.parse(raw));
        } catch {
          return resolve(Object.fromEntries(new URLSearchParams(raw)));
        }
      } catch {
        return resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

// ── Валидация (в стиле Laravel — как отвечает реальный MVCRM) ────────────────

/** Правила required-полей в порядке проверки. */
const REQUIRED_FIELDS = ["first_name", "email", "phone", "source", "country"];

/** Человекочитаемое имя атрибута: first_name → "first name". */
function attr(field) {
  return field.replace(/_/g, " ");
}

/**
 * Собирает ошибки валидации в bag { field: [messages] } (порядок сохраняется).
 * Возвращает null, если ошибок нет.
 */
function validateCustomer(aff, data) {
  const errors = {};
  const push = (field, msg) => {
    (errors[field] ||= []).push(msg);
  };

  for (const field of REQUIRED_FIELDS) {
    const v = data[field];
    if (v == null || String(v).trim() === "") {
      push(field, `The ${attr(field)} field is required.`);
    }
  }

  // Формат email — только если он вообще передан.
  const email = data.email == null ? "" : String(data.email).trim();
  if (email && !EMAIL_RE.test(email)) {
    push("email", "The email must be a valid email address.");
  }

  // Уникальность email в рамках аффилиата.
  if (email && EMAIL_RE.test(email) && emailTaken(aff, email)) {
    push("email", "The email has already been taken.");
  }

  return Object.keys(errors).length ? errors : null;
}

/** Формирует top-level message как Laravel: "<first> (and N more errors)". */
function summaryMessage(errors) {
  const flat = [];
  for (const field of Object.keys(errors)) {
    for (const m of errors[field]) flat.push(m);
  }
  const more = flat.length - 1;
  if (more <= 0) return flat[0];
  return `${flat[0]} (and ${more} more error${more > 1 ? "s" : ""})`;
}

// ── Хендлеры ────────────────────────────────────────────────────────────────

async function handleCreateCustomer(url, req, res) {
  const token = extractToken(url, req);
  const aff = getAffiliate(token);

  // Пример #3 из документации.
  if (!aff) {
    return sendJson(res, 200, {
      success: false,
      message: `Affiliate with this token ${token} not found!`,
    });
  }

  const data = await readBody(req);

  // Симуляция сбоя сохранения (Пример #1) — для тестов ветки ошибки.
  // Триггеры: заголовок `x-simulate: save-fail` или email содержит "+fail".
  const simulateFail =
    String(req.headers["x-simulate"] || "").toLowerCase() === "save-fail" ||
    String(data.email || "").toLowerCase().includes("+fail@");
  if (simulateFail) {
    return sendJson(res, 200, { success: false, message: "Cannot save customer!" });
  }

  // Пример #2 — ошибки валидации (required / email / unique).
  const errors = validateCustomer(aff, data);
  if (errors) {
    return sendJson(res, 200, {
      success: false,
      message: summaryMessage(errors),
      errors,
    });
  }

  // Пример #4 — проверка страны.
  let country = String(data.country).trim();
  if (config.strictCountry) {
    const resolved = resolveCountry(country);
    if (!resolved) {
      return sendJson(res, 200, {
        success: false,
        message: `Country ${country} is not found!`,
      });
    }
    country = resolved;
  }

  const customer = addCustomer(aff, { ...data, country });

  if (config.logRequests) {
    console.log(`[POST] created customer #${customer.id} (${customer.email}) for aff #${aff.id}`);
  }

  // Успех.
  return sendJson(res, 200, {
    success: true,
    customer_id: customer.id,
    message: "Customer created successfully!",
  });
}

function handleListCustomers(url, req, res) {
  const token = extractToken(url, req);
  const aff = getAffiliate(token);

  // Для GET реальный MVCRM отвечает без success-флага, только message.
  if (!aff) {
    return sendJson(res, 200, { message: "Affiliate with this token not found!" });
  }

  const from = parseFrom(url.searchParams.get("from"));
  const to = parseTo(url.searchParams.get("to"));

  const customers = aff.customers
    .filter((c) => {
      const t = c.created_at.getTime();
      if (from && t < from) return false;
      if (to && t > to) return false;
      return true;
    })
    .map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      status: c.status,
      date: formatDateTime(c.created_at),
    }));

  if (config.logRequests) {
    console.log(`[GET] aff #${aff.id} → ${customers.length} customer(s)`);
  }

  return sendJson(res, 200, {
    affiliate: {
      id: aff.id,
      first_name: aff.first_name,
      last_name: aff.last_name,
    },
    customers,
  });
}

// ── Хелперы дат ─────────────────────────────────────────────────────────────

/** from=YYYY-MM-DD → начало дня (ms). */
function parseFrom(s) {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00`);
  return isNaN(d.getTime()) ? null : d.getTime();
}

/** to=YYYY-MM-DD → конец дня (ms). */
function parseTo(s) {
  if (!s) return null;
  const d = new Date(`${s}T23:59:59.999`);
  return isNaN(d.getTime()) ? null : d.getTime();
}

/** Дата → "YYYY-MM-DD HH:mm:ss" (как отдаёт Laravel). */
function formatDateTime(d) {
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  );
}

// ── Роутер ──────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  } catch {
    return sendJson(res, 400, { success: false, message: "Bad request URL" });
  }

  const path = url.pathname.replace(/\/+$/, "") || "/";

  // Preflight.
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    });
    return res.end();
  }

  try {
    if (path === "/customers/integration") {
      if (req.method === "POST") return await handleCreateCustomer(url, req, res);
      if (req.method === "GET") return handleListCustomers(url, req, res);
      return sendJson(res, 405, { success: false, message: "Method not allowed" });
    }

    if (path === "/health" && req.method === "GET") {
      return sendJson(res, 200, { ok: true, service: "mvcrm-testserver" });
    }

    if (path === "/" && req.method === "GET") {
      return sendJson(res, 200, {
        service: "mvcrm-testserver",
        description: "Local mock of the MVCRM (MyView CRM) affiliate integration API.",
        endpoints: {
          create: "POST /customers/integration?api_token={token}",
          list: "GET /customers/integration?api_token={token}&from=YYYY-MM-DD&to=YYYY-MM-DD",
          health: "GET /health",
        },
        tokens: listTokens(),
        strictCountry: config.strictCountry,
        allowAnyToken: config.allowAnyToken,
      });
    }

    return sendJson(res, 404, { success: false, message: "Not found" });
  } catch (err) {
    console.error("[testserver] unhandled error:", err);
    return sendJson(res, 500, { success: false, message: "Internal server error" });
  }
});

// ── Старт ───────────────────────────────────────────────────────────────────

const seedInfo = seed();

server.listen(config.port, config.host, () => {
  const base = `http://${config.host}:${config.port}`;
  console.log("");
  console.log("  ┌───────────────────────────────────────────────────────────┐");
  console.log("  │  MVCRM Test Server (mock of mvcrm.online)                  │");
  console.log("  └───────────────────────────────────────────────────────────┘");
  console.log(`  Base URL : ${base}`);
  console.log(`  Endpoint : ${base}/customers/integration`);
  console.log(`  Tokens   : ${listTokens().join(", ") || "(any — ALLOW_ANY_TOKEN)"}`);
  console.log(`  Mock data: ${seedInfo.customers} customer(s) across ${seedInfo.affiliates} affiliate(s) — source: ${seedInfo.source}`);
  console.log(`  Country  : strict=${config.strictCountry}   AnyToken=${config.allowAnyToken}`);
  console.log("");
  console.log("  Put this in crm/.env.local to point LeadHub at the mock:");
  console.log(`    MVCRM_BASE_URL=${base}`);
  console.log(`    MVCRM_API_TOKEN=${listTokens()[0] || "<your-token>"}`);
  console.log("");
});

// Аккуратное завершение.
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.log(`\n[testserver] ${sig} — shutting down`);
    server.close(() => process.exit(0));
  });
}
