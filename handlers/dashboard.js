// Рендер простого HTML-дашборда горячих лидов. Чистая функция — тестируется.

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// Только цифры номера — безопасно для href (tel:/wa.me). WhatsApp хранит
// телефон в международном формате без «+», так что цифр достаточно.
function digits(s) {
  return String(s ?? "").replace(/\D/g, "");
}

// Ячейка с телефоном: кликабельные кнопки дозвона (звонок + WhatsApp).
// Если номера нет — просто прочерк.
function phoneCell(phone) {
  const d = digits(phone);
  if (!d) return "<td>—</td>";
  return (
    "<td class=\"phone\">" +
    `<a class="call" href="tel:+${d}" title="Позвонить">📞 ${esc(phone)}</a>` +
    `<a class="wa" href="https://wa.me/${d}" target="_blank" rel="noopener" title="Написать в WhatsApp">WhatsApp</a>` +
    "</td>"
  );
}

// leads: массив строк из getHotLeads. Возвращает строку HTML.
export function renderHotHtml(leads = []) {
  const rows = leads.map((l) => {
    const p = l.ai_qual_profile || {};
    return (
      "<tr>" +
      `<td class="s">${esc(l.ai_qual_score)}</td>` +
      `<td>${esc(l.name)}</td>` +
      phoneCell(l.phone) +
      `<td>${esc(p.readiness)}</td>` +
      `<td>${esc(p.category || p.niche)}</td>` +
      `<td>${esc(p.urgency)}</td>` +
      `<td>${esc(p.next_step || p.summary)}</td>` +
      "</tr>"
    );
  }).join("\n");

  return (
    '<!doctype html><html lang="ru"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    "<title>Горячие лиды — SPECTO</title>" +
    "<style>" +
    "body{font-family:system-ui,Arial,sans-serif;margin:24px;color:#1a1a1a}" +
    "table{border-collapse:collapse;width:100%}" +
    "th,td{border:1px solid #ddd;padding:6px 8px;font-size:14px;text-align:left;vertical-align:top}" +
    "th{background:#f5f5f5;position:sticky;top:0}" +
    ".s{font-weight:700;text-align:center}" +
    "tr:hover{background:#fafafa}" +
    "h2{margin:0 0 16px}" +
    ".phone{white-space:nowrap}" +
    ".phone a{display:inline-block;text-decoration:none;padding:4px 8px;border-radius:6px;font-size:13px;margin:1px 0}" +
    ".call{background:#e8f5e9;color:#1b5e20;font-weight:600}" +
    ".call:hover{background:#c8e6c9}" +
    ".wa{background:#e3f2fd;color:#0d47a1;margin-left:4px}" +
    ".wa:hover{background:#bbdefb}" +
    "</style></head><body>" +
    `<h2>🔥 Горячие лиды (${leads.length})</h2>` +
    "<table><thead><tr>" +
    "<th>Score</th><th>Имя</th><th>Телефон</th><th>Готовность</th>" +
    "<th>Категория/ниша</th><th>Срочность</th><th>След. шаг</th>" +
    "</tr></thead><tbody>" +
    rows +
    "</tbody></table></body></html>"
  );
}
