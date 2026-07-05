// Человекочитаемые ярлыки для сообщений: спорт (иконка+название), исход
// (Победа/Ничья/Тотал), время до матча. Чистые функции — тестируются.

const SPORTS = [
  ["americanfootball", "🏈", "Ам. футбол"],
  ["soccer", "⚽", "Футбол"],
  ["tennis", "🎾", "Теннис"],
  ["basketball", "🏀", "Баскетбол"],
  ["icehockey", "🏒", "Хоккей"],
  ["baseball", "⚾", "Бейсбол"],
  ["boxing", "🥊", "Бокс"],
  ["mma", "🥊", "MMA"],
  ["cricket", "🏏", "Крикет"],
  ["rugbyleague", "🏉", "Регби"],
  ["rugbyunion", "🏉", "Регби"],
  ["volleyball", "🏐", "Волейбол"],
  ["golf", "⛳", "Гольф"]
];

// "soccer_sweden_allsvenskan" → "⚽ Футбол". Неизвестный спорт → 🏆 + ключ.
export function sportLabel(sportKey = "") {
  const k = String(sportKey).toLowerCase();
  for (const [pre, emoji, name] of SPORTS) {
    if (k.startsWith(pre)) return `${emoji} ${name}`;
  }
  return `🏆 ${sportKey}`;
}

// Исход по-человечески. Для h2h — «Победа X (П1/П2)»/«Ничья (Х)»;
// для тоталов — «Тотал больше/меньше N»; для фор — «Фора …».
export function outcomeLabel({ name, market, home, away, point } = {}) {
  const n = String(name ?? "");
  if (market === "totals") {
    if (n === "Over") return `Тотал больше ${point}`;
    if (n === "Under") return `Тотал меньше ${point}`;
  }
  if (market === "h2h") {
    if (n === home) return `Победа ${home} (П1)`;
    if (n === away) return `Победа ${away} (П2)`;
    if (n.toLowerCase() === "draw") return "Ничья (Х)";
  }
  if (market === "spreads" && point != null) {
    return `Фора ${n} ${point > 0 ? "+" : ""}${point}`;
  }
  return n;
}

// Сколько до начала: «через 25 мин» / «через 3 ч» / «через 3 ч 10 мин» /
// «через 2 дн» / «уже идёт». nowMs передаётся снаружи (детерминизм в тестах).
export function timeUntil(commenceIso, nowMs) {
  if (!commenceIso) return "";
  const t = Date.parse(commenceIso);
  if (Number.isNaN(t)) return "";
  const diff = t - nowMs;
  if (diff < 0) return "уже идёт";
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `через ${mins} мин`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return m ? `через ${h} ч ${m} мин` : `через ${h} ч`;
  return `через ${Math.floor(h / 24)} дн`;
}
