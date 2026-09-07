// Веб-инструменты: чтение страницы и поиск в интернете (бесплатно, без ключа).

function htmlToText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// Скачивает страницу и возвращает читаемый текст (обрезано).
export async function fetchUrl(url) {
  let u = String(url || "").trim();
  if (!u) throw new Error("пустой URL");
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  const res = await fetch(u, {
    headers: { "user-agent": "Mozilla/5.0 copilot" },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`сайт вернул ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  const body = await res.text();
  const text = ct.includes("html") ? htmlToText(body) : body;
  return text.slice(0, 8000) || "(пустая страница)";
}

// Поиск в интернете через DuckDuckGo (HTML-версия, без ключа). Возвращает
// список: заголовок + ссылка.
export async function webSearch(query) {
  const q = String(query || "").trim();
  if (!q) throw new Error("пустой запрос");
  const res = await fetch("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q), {
    headers: { "user-agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`поиск вернул ${res.status}`);
  const html = await res.text();
  const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const out = [];
  let m;
  while ((m = re.exec(html)) && out.length < 6) {
    let link = m[1];
    const uddg = link.match(/uddg=([^&]+)/);
    if (uddg) link = decodeURIComponent(uddg[1]);
    const title = htmlToText(m[2]);
    if (title) out.push(`${title}\n${link}`);
  }
  return out.length ? out.join("\n\n") : "Ничего не найдено.";
}
