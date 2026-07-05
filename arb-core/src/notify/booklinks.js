// Ссылки на сайты букмекеров + поиск матча — для кнопок в Telegram, чтобы
// открыть контору и быстро найти событие. Ставку подтверждаешь сам в приложении
// (без автоматизации — не нарушает правил контор). Чистые функции.

const SITES = [
  ["1xbet", "https://1xbet.com"],
  ["betfair", "https://www.betfair.com"],
  ["pinnacle", "https://www.pinnacle.com"],
  ["matchbook", "https://www.matchbook.com"],
  ["williamhill", "https://sports.williamhill.com"],
  ["unibet", "https://www.unibet.com"],
  ["coolbet", "https://www.coolbet.com"],
  ["betway", "https://betway.com"],
  ["marathonbet", "https://www.marathonbet.com"],
  ["betsson", "https://www.betsson.com"],
  ["888sport", "https://www.888sport.com"],
  ["betonline", "https://www.betonline.ag"],
  ["smarkets", "https://smarkets.com"],
  ["nordicbet", "https://www.nordicbet.com"],
  ["bet365", "https://www.bet365.com"],
  ["parimatch", "https://www.parimatch.kz"],
  ["melbet", "https://melbet.com"],
  ["betcity", "https://betcity.kz"],
  ["olimp", "https://olimpbet.kz"],
  ["mostbet", "https://mostbet.com"],
  ["1win", "https://1win.com"],
  ["pinup", "https://pin-up.kz"]
];

// Сайт конторы по названию (или null, если не знаем).
export function bookmakerUrl(title = "") {
  const t = String(title).toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const [key, url] of SITES) if (t.includes(key)) return url;
  return null;
}

// Ссылка «найти матч» — веб-поиск по конторе и командам.
export function searchUrl(bookmaker, home, away) {
  const q = encodeURIComponent(`${bookmaker} ${home} ${away}`.trim());
  return `https://www.google.com/search?q=${q}`;
}
