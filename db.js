const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ready = Boolean(SUPABASE_URL && SERVICE_KEY);
if (!ready) {
  console.warn(
    "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY не заданы — данные НЕ сохраняются. " +
    "Задай их в переменных окружения (см. .env.example)."
  );
}

const BASE = ready ? `${SUPABASE_URL}/rest/v1` : null;

function headers(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    ...extra
  };
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Универсальный ретрай с экспоненциальной задержкой. Используется и поллерами,
// и сторожем. retryOn решает, стоит ли повторять конкретную ошибку.
export async function withRetry(fn, opts = {}) {
  const {
    retries = 3,
    baseMs = 500,
    label = "op",
    retryOn = () => true,
    onWait = (msg) => console.warn(msg),
    wait = sleep
  } = opts;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !retryOn(err)) break;
      const delay = baseMs * 2 ** attempt;
      onWait(`[retry] ${label}: попытка ${attempt + 1} не удалась (${err.message}). Жду ${delay}мс`);
      await wait(delay);
    }
  }
  throw lastErr;
}

async function rest(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  // Ретраим только идемпотентные запросы: GET (чтение) и PATCH (обновление по id).
  // POST (вставка) НЕ ретраим — иначе при обрыве ответа можно задвоить запись.
  const idempotent = method === "GET" || method === "PATCH";
  return withRetry(
    async () => {
      const res = await fetch(`${BASE}${path}`, options);
      if (!res.ok) {
        const text = await res.text();
        const err = new Error(`Supabase ${res.status}: ${text}`);
        err.status = res.status;
        throw err;
      }
      return res;
    },
    {
      retries: idempotent ? 3 : 0,
      label: `Supabase ${method} ${path.split("?")[0]}`,
      // Повторяем только временные сбои: сеть (нет status) / 5xx / 429.
      retryOn: (err) => !err.status || err.status >= 500 || err.status === 429
    }
  );
}

export function isDbReady() {
  return ready;
}

// Дешёвая проверка живости БД для сторожа. true — Supabase отвечает.
export async function healthPing() {
  if (!ready) return false;
  try {
    await rest("/leads?select=id&limit=1", { headers: headers() });
    return true;
  } catch {
    return false;
  }
}

// Время последнего сообщения в чате (ISO) или null. Нужно сторожу, чтобы
// понять, появилась ли новая переписка после квалификации (устаревание).
export async function getLastMessageAt(chatId) {
  if (!ready) return null;
  try {
    const res = await rest(
      `/whatsapp_messages?chat_id=eq.${encodeURIComponent(chatId)}` +
      `&select=created_at&order=created_at.desc&limit=1`,
      { headers: headers() }
    );
    const rows = await res.json();
    return rows[0]?.created_at || null;
  } catch (err) {
    console.error("getLastMessageAt error:", err.message);
    return null;
  }
}

// --- Лиды (specto_bot_orders) ---

export async function saveLead({ phone, name, details, platform }) {
  if (!ready) return;
  try {
    await rest("/specto_bot_orders", {
      method: "POST",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify({ phone, name, details, platform })
    });
  } catch (err) {
    console.error("saveLead error:", err.message);
  }
}

export async function getOrders(limit = 200) {
  if (!ready) return [];
  try {
    const res = await rest(
      `/specto_bot_orders?select=*&order=created_at.desc&limit=${limit}`,
      { headers: headers() }
    );
    return await res.json();
  } catch (err) {
    console.error("getOrders error:", err.message);
    return [];
  }
}

// --- История диалога (specto_bot_messages) ---

export async function saveMessage(chatId, platform, role, content) {
  if (!ready) return;
  try {
    await rest("/specto_bot_messages", {
      method: "POST",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify({ chat_id: chatId, platform, role, content })
    });
  } catch (err) {
    console.error("saveMessage error:", err.message);
  }
}

export async function getHistory(chatId, limit = 30) {
  if (!ready) return [];
  try {
    const res = await rest(
      `/specto_bot_messages?chat_id=eq.${encodeURIComponent(chatId)}&select=role,content&order=created_at.desc&limit=${limit}`,
      { headers: headers() }
    );
    const data = await res.json();
    return data.reverse(); // вернуть в хронологическом порядке
  } catch (err) {
    console.error("getHistory error:", err.message);
    return [];
  }
}

export async function countMessages(chatId) {
  if (!ready) return 0;
  try {
    const res = await rest(
      `/specto_bot_messages?chat_id=eq.${encodeURIComponent(chatId)}&select=id&limit=1`,
      { headers: headers({ Prefer: "count=exact" }) }
    );
    const range = res.headers.get("content-range");
    if (range && range.includes("/")) {
      const total = parseInt(range.split("/")[1], 10);
      if (!Number.isNaN(total)) return total;
    }
    const data = await res.json();
    return data.length;
  } catch (err) {
    console.error("countMessages error:", err.message);
    return 0;
  }
}

// --- Состояние диалога / фоллоапы (specto_bot_state) ---

export async function upsertState(chatId, row) {
  if (!ready) return;
  try {
    await rest("/specto_bot_state?on_conflict=chat_id", {
      method: "POST",
      headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify({ chat_id: chatId, ...row })
    });
  } catch (err) {
    console.error("upsertState error:", err.message);
  }
}

export async function updateState(chatId, fields) {
  if (!ready) return;
  try {
    await rest(`/specto_bot_state?chat_id=eq.${encodeURIComponent(chatId)}`, {
      method: "PATCH",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify(fields)
    });
  } catch (err) {
    console.error("updateState error:", err.message);
  }
}

export async function getDueFollowups(nowIso, limit = 50) {
  if (!ready) return [];
  try {
    const path =
      "/specto_bot_state?select=chat_id,platform,followup_step,last_user_at" +
      "&status=eq.active&next_followup_at=not.is.null" +
      `&next_followup_at=lte.${encodeURIComponent(nowIso)}` +
      `&order=next_followup_at.asc&limit=${limit}`;
    const res = await rest(path, { headers: headers() });
    return await res.json();
  } catch (err) {
    console.error("getDueFollowups error:", err.message);
    return [];
  }
}

// --- ИИ-квалификация лидов (таблицы CRM: whatsapp_messages + leads) ---
//
// Внимание: это НЕ таблицы бота (specto_bot_*). Квалификация работает с боевыми
// данными CRM: переписка лежит в whatsapp_messages (chat_id вида "7701...@c.us",
// direction in/out), лиды — в leads. Связь: leads.phone_norm = последние 10 цифр
// номера из chat_id, в рамках одного project_id.

// Уникальные WhatsApp-чаты (chat_id + project_id), по которым была переписка.
// sinceIso — брать только чаты с сообщениями не раньше этого момента (для поллера);
// null — все чаты (для бэкфилла). msgLimit ограничивает число просканированных строк.
export async function getRecentWaChats({ sinceIso = null, msgLimit = 5000 } = {}) {
  if (!ready) return [];
  try {
    let path =
      "/whatsapp_messages?select=chat_id,project_id,created_at" +
      "&order=created_at.desc" +
      `&limit=${msgLimit}`;
    if (sinceIso) path += `&created_at=gte.${encodeURIComponent(sinceIso)}`;
    const res = await rest(path, { headers: headers() });
    const rows = await res.json();
    const seen = new Set();
    const chats = [];
    for (const r of rows) {
      if (!r.chat_id || seen.has(r.chat_id)) continue;
      seen.add(r.chat_id);
      chats.push({ chat_id: r.chat_id, project_id: r.project_id });
    }
    return chats;
  } catch (err) {
    console.error("getRecentWaChats error:", err.message);
    return [];
  }
}

// Самый свежий лид с данным phone_norm в рамках project_id (или без привязки к проекту,
// если projectId не задан). Возвращает объект лида или null.
export async function getLeadForPhone(phoneNorm, projectId = null) {
  if (!ready || !phoneNorm) return null;
  try {
    let path =
      `/leads?select=id,name,project_id,ai_qual_at,ai_qual_score,ai_qual_profile` +
      `&phone_norm=eq.${encodeURIComponent(phoneNorm)}`;
    if (projectId) path += `&project_id=eq.${encodeURIComponent(projectId)}`;
    path += "&order=created_at.desc&limit=1";
    const res = await rest(path, { headers: headers() });
    const rows = await res.json();
    return rows[0] || null;
  } catch (err) {
    console.error("getLeadForPhone error:", err.message);
    return null;
  }
}

// Переписка по чату в хронологическом порядке: [{ direction, text, created_at }].
export async function getConversation(chatId, limit = 200) {
  if (!ready) return [];
  try {
    const res = await rest(
      `/whatsapp_messages?chat_id=eq.${encodeURIComponent(chatId)}` +
      `&select=direction,text,created_at&order=created_at.asc&limit=${limit}`,
      { headers: headers() }
    );
    return await res.json();
  } catch (err) {
    console.error("getConversation error:", err.message);
    return [];
  }
}

// Записать результат квалификации в лид. score — int 0..100, profile — объект (jsonb).
export async function saveQualification(leadId, score, profile) {
  if (!ready) return false;
  try {
    await rest(`/leads?id=eq.${encodeURIComponent(leadId)}`, {
      method: "PATCH",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify({
        ai_qual_score: score,
        ai_qual_profile: profile,
        ai_qual_at: new Date().toISOString()
      })
    });
    return true;
  } catch (err) {
    console.error("saveQualification error:", err.message);
    return false;
  }
}

// --- Дашборд / сторож ---

// Горячие (квалифицированные) лиды, отсортированные по баллу. Для дашборда /hot.
export async function getHotLeads({ limit = 50, minScore = 0, projectId = null } = {}) {
  if (!ready) return [];
  try {
    let path =
      `/leads?select=id,name,phone,project_id,ai_qual_score,ai_qual_profile,ai_qual_at` +
      `&ai_qual_at=not.is.null&ai_qual_score=gte.${minScore}` +
      `&order=ai_qual_score.desc&limit=${limit}`;
    if (projectId) path += `&project_id=eq.${encodeURIComponent(projectId)}`;
    const res = await rest(path, { headers: headers() });
    return await res.json();
  } catch (err) {
    console.error("getHotLeads error:", err.message);
    return [];
  }
}

// Все квалифицированные лиды (для ежедневной сводки). Сортировка по баллу.
export async function getAllQualified(limit = 2000) {
  if (!ready) return [];
  try {
    const res = await rest(
      `/leads?ai_qual_at=not.is.null` +
      `&select=name,ai_qual_score,ai_qual_at,ai_qual_profile,assignee` +
      `&order=ai_qual_score.desc&limit=${limit}`,
      { headers: headers() }
    );
    return await res.json();
  } catch (err) {
    console.error("getAllQualified error:", err.message);
    return [];
  }
}

// Последнее сообщение в чате: { direction, created_at } или null.
// Нужно сторожу, чтобы найти «застрявшие» лиды (последнее слово за клиентом).
export async function getLastMessage(chatId) {
  if (!ready) return null;
  try {
    const res = await rest(
      `/whatsapp_messages?chat_id=eq.${encodeURIComponent(chatId)}` +
      `&select=direction,created_at&order=created_at.desc&limit=1`,
      { headers: headers() }
    );
    const rows = await res.json();
    return rows[0] || null;
  } catch (err) {
    console.error("getLastMessage error:", err.message);
    return null;
  }
}

// --- Онбординг: профиль ниши проекта ---

// Сохраняет профиль ниши в projects. Дублируем industry→niche и geo→city,
// чтобы старый UI, читающий projects.niche/city, продолжал работать.
export async function saveNicheProfile(projectId, profile, text) {
  if (!ready || !projectId) return false;
  try {
    await rest(`/projects?id=eq.${encodeURIComponent(projectId)}`, {
      method: "PATCH",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify({
        niche_profile: profile,
        onboarding_text: text,
        niche_profile_at: new Date().toISOString(),
        niche: profile.industry,
        city: profile.geo
      })
    });
    return true;
  } catch (err) {
    console.error("saveNicheProfile error:", err.message);
    return false;
  }
}

// --- Плейбуки (скелеты автоматизаций/стадий/маркетинга под нишу) ---

// Один проект целиком (нужно CLI плейбуков: niche_profile + organization_id).
export async function getProject(projectId) {
  if (!ready || !projectId) return null;
  try {
    const res = await rest(
      `/projects?id=eq.${encodeURIComponent(projectId)}&select=*&limit=1`,
      { headers: headers() }
    );
    const rows = await res.json();
    return rows[0] || null;
  } catch (err) {
    console.error("getProject error:", err.message);
    return null;
  }
}

// Активные плейбуки-скелеты (niche_playbooks). Из них matchPlaybook выбирает
// подходящий по модели/отрасли.
export async function getPlaybooks() {
  if (!ready) return [];
  try {
    const res = await rest(
      "/niche_playbooks?is_active=eq.true&select=*",
      { headers: headers() }
    );
    return await res.json();
  } catch (err) {
    console.error("getPlaybooks error:", err.message);
    return [];
  }
}

// Сохраняет применённый плейбук в проект.
export async function savePlaybook(projectId, playbook) {
  if (!ready || !projectId) return false;
  try {
    await rest(`/projects?id=eq.${encodeURIComponent(projectId)}`, {
      method: "PATCH",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify({
        playbook,
        playbook_at: new Date().toISOString()
      })
    });
    return true;
  } catch (err) {
    console.error("savePlaybook error:", err.message);
    return false;
  }
}

// Включает/выключает правило автоматизации по коду (trigger_type) в организации.
export async function setAutomationActive(organizationId, code, active) {
  if (!ready || !organizationId || !code) return false;
  try {
    await rest(
      `/automation_rules?organization_id=eq.${encodeURIComponent(organizationId)}` +
      `&trigger_type=eq.${encodeURIComponent(code)}`,
      {
        method: "PATCH",
        headers: headers({ Prefer: "return=minimal" }),
        body: JSON.stringify({ is_active: active })
      }
    );
    return true;
  } catch (err) {
    console.error("setAutomationActive error:", err.message);
    return false;
  }
}

// --- Аналитика эффективности плейбуков (вьюхи) ---

// Метрики плейбуков по проектам (вьюха playbook_metrics). Только с непустым
// объёмом лидов, по убыванию.
export async function getPlaybookMetrics() {
  if (!ready) return [];
  try {
    const res = await rest(
      "/playbook_metrics?leads=gt.0&select=*&order=leads.desc",
      { headers: headers() }
    );
    return await res.json();
  } catch (err) {
    console.error("getPlaybookMetrics error:", err.message);
    return [];
  }
}

// Влияние автоматизаций на конверсию (вьюха automation_impact): строки по парам
// (model, automation, is_active) с конверсией и объёмом.
export async function getAutomationImpact() {
  if (!ready) return [];
  try {
    const res = await rest(
      "/automation_impact?select=*",
      { headers: headers() }
    );
    return await res.json();
  } catch (err) {
    console.error("getAutomationImpact error:", err.message);
    return [];
  }
}

// --- Авто-назначение менеджеров ---

// Активные менеджеры проекта (role=manager). Возвращает массив имён (full_name).
export async function getActiveManagers(projectId) {
  if (!ready || !projectId) return [];
  try {
    const res = await rest(
      `/profiles?select=full_name&role=eq.manager&is_active=eq.true` +
      `&project_id=eq.${encodeURIComponent(projectId)}`,
      { headers: headers() }
    );
    const rows = await res.json();
    return rows.map(r => r.full_name).filter(Boolean);
  } catch (err) {
    console.error("getActiveManagers error:", err.message);
    return [];
  }
}

// Сколько лидов сейчас на менеджере в проекте (для стратегии «наименее загруженному»).
export async function countLeadsByAssignee(projectId, assignee) {
  if (!ready) return 0;
  try {
    const res = await rest(
      `/leads?project_id=eq.${encodeURIComponent(projectId)}` +
      `&assignee=eq.${encodeURIComponent(assignee)}&select=id&limit=1`,
      { headers: headers({ Prefer: "count=exact" }) }
    );
    const range = res.headers.get("content-range");
    if (range && range.includes("/")) {
      const total = parseInt(range.split("/")[1], 10);
      if (!Number.isNaN(total)) return total;
    }
    return (await res.json()).length;
  } catch (err) {
    console.error("countLeadsByAssignee error:", err.message);
    return 0;
  }
}

// Горячие лиды в корзине «director»/пусто (ничьи). minScore — порог.
export async function getUnassignedHotLeads(minScore = 60) {
  if (!ready) return [];
  try {
    const res = await rest(
      `/leads?select=id,name,project_id,phone_norm,ai_qual_score` +
      `&ai_qual_score=gte.${minScore}` +
      `&or=(assignee.eq.director,assignee.is.null)` +
      `&order=ai_qual_score.desc`,
      { headers: headers() }
    );
    return await res.json();
  } catch (err) {
    console.error("getUnassignedHotLeads error:", err.message);
    return [];
  }
}

// Кто уже ведёт этого клиента: самый свежий лид с тем же phone_norm, у которого
// назначен реальный ответственный (не «director»/пусто). Возвращает имя или null.
// Нужно, чтобы горячий лид уходил «своему» менеджеру, а не перекидывал клиента.
export async function getResponsibleAssignee(phoneNorm, projectId) {
  if (!ready || !phoneNorm) return null;
  try {
    const res = await rest(
      `/leads?select=assignee,created_at&phone_norm=eq.${encodeURIComponent(phoneNorm)}` +
      `&project_id=eq.${encodeURIComponent(projectId)}` +
      `&assignee=not.is.null&assignee=neq.director` +
      `&order=created_at.desc&limit=1`,
      { headers: headers() }
    );
    const rows = await res.json();
    const who = rows[0]?.assignee;
    return who && who.trim() ? who : null;
  } catch (err) {
    console.error("getResponsibleAssignee error:", err.message);
    return null;
  }
}

export async function setAssignee(leadId, assignee) {
  if (!ready) return false;
  try {
    await rest(`/leads?id=eq.${encodeURIComponent(leadId)}`, {
      method: "PATCH",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify({ assignee })
    });
    return true;
  } catch (err) {
    console.error("setAssignee error:", err.message);
    return false;
  }
}