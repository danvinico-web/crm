import bcrypt from "bcryptjs";
import User from "@/models/User";
import Team from "@/models/Team";
import Agent from "@/models/Agent";
import Office from "@/models/Office";
import Integration from "@/models/Integration";
import Source from "@/models/Source";
import Affiliate from "@/models/Affiliate";
import Lead from "@/models/Lead";
import Delivery from "@/models/Delivery";
import StatusEvent from "@/models/StatusEvent";
import RoutingRule from "@/models/RoutingRule";
import Payout from "@/models/Payout";
import LeadField from "@/models/LeadField";
import LeadNote from "@/models/LeadNote";
import LeadStatusDef from "@/models/LeadStatusDef";
import { encrypt } from "@/lib/crypto";
import { generateAffiliateApiKey } from "@/lib/apiKey";
import { DEFAULT_STATUS_DEFS, type LeadStatus, type SourceType } from "@/lib/enums";

/** Детерминированный PRNG (mulberry32) — стабильные демо-данные между запусками. */
function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = makeRng(20260711);
const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const randInt = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** Сеет демо-данные, если база пуста. Вызывается из dbConnect(). */
export async function seedIfEmpty(): Promise<void> {
  if (process.env.SEED_ON_EMPTY === "false") return;
  const existing = await User.estimatedDocumentCount();
  if (existing > 0) return;
  await seed();
}

async function seed(): Promise<void> {
  const now = Date.now();

  // ── Определения статусов лида (редактируемые) ───────────────────────────
  await LeadStatusDef.create(DEFAULT_STATUS_DEFS);

  // ── Пользователи ────────────────────────────────────────────────────────
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@leadhub.local").toLowerCase();
  const adminPass = process.env.ADMIN_PASSWORD || "admin12345";
  const admin = await User.create({
    name: process.env.ADMIN_NAME || "Главный админ",
    email: adminEmail,
    passwordHash: bcrypt.hashSync(adminPass, 10),
    role: "ADMIN",
  });

  const userSeed = [
    { name: "Иван Петров", email: "ivan@leadhub.local" },
    { name: "Мария Кузьменко", email: "maria@leadhub.local" },
  ];
  const users = await User.create(
    userSeed.map((u) => ({
      name: u.name,
      email: u.email,
      passwordHash: bcrypt.hashSync("demo1234", 10),
      role: "USER" as const,
      createdBy: admin._id,
    })),
  );

  // ── Команды (создаёт пользователь) ──────────────────────────────────────
  const teams = await Team.create([
    { name: "Команда Альфа", code: "alpha", owner: users[0]._id },
    { name: "Команда Ретеншн", code: "retention", owner: users[1]._id },
  ]);

  // ── Агенты ──────────────────────────────────────────────────────────────
  const agentSeed = [
    { name: "Иван Петров", title: "Team Lead", online: true, color: "#4f7cff,#6a5cff", t: 0, cap: 15 },
    { name: "Мария Кузьменко", title: "Retention", online: true, color: "#f5a524,#f5455c", t: 1, cap: 12 },
    { name: "Ольга Савченко", title: "Sales agent", online: true, color: "#25c281,#1fa86e", t: 0, cap: 10 },
    { name: "Дмитрий Коваль", title: "Sales agent", online: false, color: "#9b6dff,#6a5cff", t: 0, cap: 10 },
    { name: "Наталья Лис", title: "Retention", online: true, color: "#4f7cff,#25c281", t: 1, cap: 12 },
    { name: "Роман Бондар", title: "Sales agent", online: false, color: "#f5455c,#9b6dff", t: 1, cap: 8 },
  ];
  const agents = await Agent.create(
    agentSeed.map((a) => ({
      name: a.name,
      title: a.title,
      isOnline: a.online,
      color: a.color,
      capacity: a.cap,
      team: teams[a.t]._id,
      owner: teams[a.t].owner,
    })),
  );

  // ── Офисы (получатели лидов) ────────────────────────────────────────────
  const officeSeed = [
    { name: "Office Alpha", code: "office_alpha", logoText: "TB", color: "#4f7cff,#6a5cff", crm: "Trackbox", apiType: "REST_JSON" as const, conn: "ok" as const },
    { name: "Office Beta", code: "office_beta", logoText: "T3", color: "#25c281,#1fa86e", crm: "Track360", apiType: "REST_JSON" as const, conn: "ok" as const },
    { name: "Office Gamma", code: "office_gamma", logoText: "API", color: "#f5455c,#9b6dff", crm: "Custom API", apiType: "XML" as const, conn: "err" as const },
    { name: "Office Delta", code: "office_delta", logoText: "CL", color: "#f5a524,#f5455c", crm: "Close CRM", apiType: "REST_JSON" as const, conn: "idle" as const },
  ];
  const offices = await Office.create(
    officeSeed.map((o) => ({ name: o.name, code: o.code, logoText: o.logoText, color: o.color, isActive: o.conn !== "err" })),
  );

  // Стандартный маппинг статусов внешней CRM → внутренние
  const statusMappings = [
    { externalValue: "new", internalValue: "NEW" as LeadStatus },
    { externalValue: "call back", internalValue: "CALLBACK" as LeadStatus },
    { externalValue: "callback", internalValue: "CALLBACK" as LeadStatus },
    { externalValue: "no answer", internalValue: "NO_ANSWER" as LeadStatus },
    { externalValue: "wrong info", internalValue: "WRONG_INFO" as LeadStatus },
    { externalValue: "wrong number", internalValue: "WRONG_INFO" as LeadStatus },
    { externalValue: "not interested", internalValue: "NOT_INTERESTED" as LeadStatus },
    { externalValue: "in progress", internalValue: "IN_PROGRESS" as LeadStatus },
    { externalValue: "ftd", internalValue: "DEPOSIT" as LeadStatus },
    { externalValue: "deposit", internalValue: "DEPOSIT" as LeadStatus },
    { externalValue: "rejected", internalValue: "REJECTED" as LeadStatus },
  ];
  const outFieldMap = [
    { externalField: "first_name", internalField: "firstName" },
    { externalField: "last_name", internalField: "lastName" },
    { externalField: "email", internalField: "email" },
    { externalField: "phone", internalField: "phone" },
    { externalField: "country", internalField: "geo" },
    { externalField: "aff_sub", internalField: "affiliateTag" },
  ];
  const integrations = await Integration.create(
    officeSeed.map((o, i) => ({
      office: offices[i]._id,
      name: `${o.crm} · ${o.name}`,
      apiType: o.apiType,
      baseUrl: `https://api.${o.code.replace("office_", "")}-crm.example.com`,
      authScheme: "header" as const,
      authKeyName: "Authorization",
      apiKeyEnc: encrypt(`demo_${o.code}_${Math.floor(rnd() * 1e9).toString(36)}`),
      sendPath: "/api/v2/leads",
      statusPath: "/api/v2/leads/status",
      callbackSecretEnc: encrypt(`whsec_${Math.floor(rnd() * 1e12).toString(36)}`),
      fieldMappings: outFieldMap,
      statusMappings,
      isActive: o.conn !== "err",
      sandbox: true, // демо: отгрузка симулируется (dry-run), без реального HTTP
      connState: o.conn,
    })),
  );

  // ── Реальный коннектор MVCRM (если задан токен в env) ────────────────────
  const mvToken = process.env.MVCRM_API_TOKEN?.trim();
  if (mvToken) {
    const mvOffice = await Office.create({
      name: "MyView CRM",
      code: "mvcrm",
      logoText: "MV",
      color: "#6a5cff,#4f7cff",
      isActive: true,
    });
    await Integration.create({
      office: mvOffice._id,
      name: "MVCRM · MyView CRM",
      apiType: "REST_JSON",
      baseUrl: process.env.MVCRM_BASE_URL?.trim() || "https://mvcrm.online",
      authScheme: "query", // ?api_token=...
      authKeyName: "api_token",
      apiKeyEnc: encrypt(mvToken),
      sendPath: "/customers/integration",
      statusPath: "/customers/integration",
      callbackSecretEnc: encrypt("mvcrm_" + Math.floor(rnd() * 1e12).toString(36)),
      // наши поля → поля MVCRM (first_name, email, phone, source, country обязательны)
      fieldMappings: [
        { externalField: "first_name", internalField: "firstName" },
        { externalField: "last_name", internalField: "lastName" },
        { externalField: "email", internalField: "email" },
        { externalField: "phone", internalField: "phone" },
        { externalField: "country", internalField: "geo" },
        { externalField: "source", internalField: "affiliateTag" },
      ],
      statusMappings,
      isActive: true,
      sandbox: false, // РЕАЛЬНАЯ отправка по HTTP
      connState: "ok",
    });
    // eslint-disable-next-line no-console
    console.log("[leadhub] Подключён реальный коннектор MVCRM (sandbox=false).");
  }

  // ── Источники ───────────────────────────────────────────────────────────
  const inFieldMap = [
    { externalField: "name", internalField: "fullName" },
    { externalField: "email", internalField: "email" },
    { externalField: "phone", internalField: "phone", transform: "phone_e164" },
    { externalField: "geo", internalField: "geo" },
    { externalField: "aff", internalField: "affiliateTag" },
  ];
  const sourceSeed: { name: string; type: SourceType; config: Record<string, unknown> }[] = [
    { name: "Google Sheet — aff_karl", type: "GOOGLE_SHEET", config: { spreadsheetId: "1AbCdEf_demo", sheet: "Leads", range: "A2:F", cursorRow: 320 } },
    { name: "Google Form — Quiz DE", type: "GOOGLE_FORM", config: { formId: "1FAIpQLSd_demo", linkedSheetId: "1GhIjKl_demo" } },
    { name: "Quiz Platform Webhook", type: "QUIZ", config: { platform: "TypeformClone" } },
    { name: "CSV импорт", type: "CSV", config: {} },
    { name: "Direct API", type: "API", config: {} },
  ];
  const sources = await Source.create(
    sourceSeed.map((s) => ({
      name: s.name,
      type: s.type,
      secretEnc: encrypt(`src_${Math.floor(rnd() * 1e12).toString(36)}`),
      config: s.config,
      fieldMappings: inFieldMap,
      isActive: true,
    })),
  );

  // ── Аффилиаты ───────────────────────────────────────────────────────────
  const affiliateSeed = [
    { name: "MediaBuy Karl", tag: "aff_karl", platform: "Meta Ads", status: "active" as const, cpa: 85 },
    { name: "FB Traffic Pro", tag: "fb_pro", platform: "Facebook", status: "active" as const, cpa: 70 },
    { name: "Google Ads Nord", tag: "g_nord", platform: "Google", status: "active" as const, cpa: 90 },
    { name: "Native Stream", tag: "nat_str", platform: "Taboola", status: "review" as const, cpa: 60 },
  ];
  // Каждому аффилиату сразу выдаём API-ключ для приёма лидов (см. lib/apiKey).
  const affiliates = await Affiliate.create(
    affiliateSeed.map((a) => {
      const gen = generateAffiliateApiKey();
      return {
        ...a,
        apiKeyHash: gen.apiKeyHash,
        apiKeyEnc: gen.apiKeyEnc,
        apiKeyPrefix: gen.apiKeyPrefix,
        apiKeyCreatedAt: gen.apiKeyCreatedAt,
      };
    }),
  );
  const affTags = affiliateSeed.map((a) => a.tag);

  // Пара уже сделанных выплат (частичные) — чтобы «выплачено» и «к выплате» были не нулевыми.
  await Payout.create([
    { affiliate: affiliates[0]._id, amount: 170, note: "USDT TRC20" },
    { affiliate: affiliates[2]._id, amount: 90, note: "инвойс #204" },
  ]);

  // ── Кастомные поля лида (пример: Воронка, Реклама) ──────────────────────
  await LeadField.create([
    { key: "funnel", label: "Воронка", order: 0 },
    { key: "ad", label: "Реклама", order: 1 },
  ]);
  const funnels = ["Crypto Pro", "Forex VIP", "Trading Boost", "Invest Elite"];
  const ads = ["fb_video_1", "google_search", "native_bnr", "tt_reels_3"];

  // ── Правила авто-роутинга (выключены по умолчанию) ──────────────────────
  await RoutingRule.create([
    { name: "Karl DE/AT → Alpha", priority: 1, enabled: false, office: offices[0]._id, conditions: { affiliateTags: ["aff_karl"], geos: ["DE", "AT"], balanceZero: false } },
    { name: "PL/CZ баланс 0 → Beta", priority: 2, enabled: false, office: offices[1]._id, conditions: { affiliateTags: [], geos: ["PL", "CZ"], balanceZero: true } },
  ]);

  // ── Лиды + отгрузки + история статусов ──────────────────────────────────
  const firstNames = ["Lukas", "Anna", "Carlos", "Giulia", "Thomas", "Emma", "Jan", "Mikael", "Sofia", "Marco", "Elena", "Piotr", "Nina", "Hugo", "Laura", "Andreas"];
  const lastNames = ["Müller", "Kowalska", "Sánchez", "Romano", "Nielsen", "Martin", "de Vries", "Berg", "Novak", "Rossi", "García", "Wójcik", "Andersson", "Dubois", "Bianchi", "Schmidt"];
  const emailDomains = ["gmx.de", "wp.pl", "gmail.com", "libero.it", "mail.dk", "free.fr", "ziggo.nl", "telia.se"];
  const geos = ["DE", "PL", "ES", "IT", "DK", "FR", "NL", "SE", "AT", "CZ"];
  const comments = ["Внёс FTD, интересует VIP", "Перезвон завтра 12:00", "Ожидает звонка", "Второй депозит", "Не распределён", "Совпадение по телефону", "Звонок ок", "Думает, перезвон пн", "Нет ответа, 2 попытки", "Отказ — нет времени"];

  // Распределение статусов по ~32 лидам
  const statusPlan: LeadStatus[] = [
    "DEPOSIT", "DEPOSIT", "DEPOSIT", "DEPOSIT", "DEPOSIT",
    "SENT", "SENT", "SENT", "SENT",
    "IN_PROGRESS", "IN_PROGRESS", "IN_PROGRESS",
    "CALLBACK", "CALLBACK", "CALLBACK",
    "NO_ANSWER", "NO_ANSWER",
    "WRONG_INFO", "WRONG_INFO",
    "NOT_INTERESTED",
    "REJECTED",
    "DUPLICATE",
    "NEW", "NEW", "NEW", "NEW", "NEW", "NEW",
  ];

  const rawStatusFor: Record<LeadStatus, string> = {
    NEW: "new", SENT: "new", CALLBACK: "call back", NO_ANSWER: "no answer",
    WRONG_INFO: "wrong info", NOT_INTERESTED: "not interested", IN_PROGRESS: "in progress",
    DEPOSIT: "ftd", DUPLICATE: "duplicate", REJECTED: "rejected",
  };

  const deliveries: Record<string, unknown>[] = [];
  const events: Record<string, unknown>[] = [];
  const notes: Record<string, unknown>[] = [];
  let extSeq = 88_400;

  for (let i = 0; i < statusPlan.length; i++) {
    const status = statusPlan[i];
    const fn = pick(firstNames);
    const ln = pick(lastNames);
    const fullName = `${fn} ${ln}`;
    const email = `${fn.toLowerCase()}.${ln.toLowerCase().replace(/[^a-z]/g, "")}@${pick(emailDomains)}`;
    const phone = `+${randInt(30, 49)}${randInt(100000000, 999999999)}`;
    const geo = pick(geos);
    const tag = pick(affTags);
    const isNew = status === "NEW";
    const isDuplicate = status === "DUPLICATE";
    const hasOffice = !isNew && !isDuplicate;
    const officeIdx = hasOffice ? randInt(0, offices.length - 1) : -1;
    const assignAgent = hasOffice && rnd() > 0.25;
    const createdAt = new Date(now - randInt(0, 13) * DAY - randInt(0, 23) * HOUR);
    const sentAt = hasOffice ? new Date(createdAt.getTime() + randInt(1, 8) * HOUR) : null;
    const balance = status === "DEPOSIT" ? randInt(200, 1500) : 0;

    const enc = Lead.buildEncrypted({ fullName, email, phone, raw: { name: fullName, email, phone, geo, aff: tag } });
    const externalId = hasOffice ? `TB-${extSeq++}` : undefined;
    const comment = pick(comments);

    const lead = await Lead.create({
      ...enc,
      geo,
      affiliateTag: tag,
      balance,
      comment,
      custom: { funnel: pick(funnels), ad: pick(ads) },
      source: sources[randInt(0, sources.length - 1)]._id,
      sourceType: sourceSeed[0].type,
      office: officeIdx >= 0 ? offices[officeIdx]._id : null,
      agent: assignAgent ? agents[randInt(0, agents.length - 1)]._id : null,
      status,
      externalId,
      sentAt,
      consent: { source: "landing", at: createdAt },
      createdAt,
      updatedAt: sentAt ?? createdAt,
    });

    // Комментарий как импортированная заметка (эмуляция базы клиента).
    notes.push({ lead: lead._id, text: comment, author: "Импорт", source: "import", createdAt });

    // История статусов: NEW → (SENT) → текущий
    const evAt = createdAt;
    events.push({ lead: lead._id, rawStatus: "new", status: "NEW", source: "SYSTEM", createdAt: evAt });
    if (hasOffice) {
      const sentTime = sentAt ?? new Date(evAt.getTime() + HOUR);
      events.push({ lead: lead._id, integration: integrations[officeIdx]._id, rawStatus: "sent", status: "SENT", source: "SYSTEM", createdAt: sentTime });
      if (status !== "SENT") {
        events.push({
          lead: lead._id,
          integration: integrations[officeIdx]._id,
          rawStatus: rawStatusFor[status],
          status,
          source: rnd() > 0.5 ? "CALLBACK" : "POLL",
          createdAt: new Date(sentTime.getTime() + randInt(1, 20) * HOUR),
        });
      }
      // Отгрузка
      const delivered = status !== "REJECTED" && status !== "WRONG_INFO";
      deliveries.push({
        lead: lead._id,
        integration: integrations[officeIdx]._id,
        office: offices[officeIdx]._id,
        status: officeIdx === 2 ? "ERROR" : delivered ? "ACCEPTED" : "REJECTED",
        method: officeSeed[officeIdx].apiType === "XML" ? "XML POST" : "API POST",
        requestBody: { first_name: fn, last_name: ln, country: geo, aff_sub: tag },
        responseBody: officeIdx === 2 ? { error: "timeout" } : { lead_id: externalId, status: "ok" },
        externalId,
        httpStatus: officeIdx === 2 ? 504 : 200,
        attempts: officeIdx === 2 ? 2 : 1,
        error: officeIdx === 2 ? "timeout · retry" : undefined,
        sentAt: sentAt ?? createdAt,
      });
    }
  }

  if (deliveries.length) await Delivery.create(deliveries);
  if (events.length) await StatusEvent.create(events);
  if (notes.length) await LeadNote.create(notes);

  // eslint-disable-next-line no-console
  console.log(
    `[leadhub] Демо-данные засеяны: ${users.length + 1} польз., ${agents.length} агентов, ${offices.length} офисов, ${statusPlan.length} лидов.`,
  );
}
