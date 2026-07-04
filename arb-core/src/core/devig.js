// De-vig: снятие маржи букмекера и консенсус «честных» вероятностей по всем БК.
//
// Коэффициенты содержат маржу (overround): Σ(1/odds) > 1. Убрав её, получаем
// оценку реальной вероятности, заложенной рынком. Консенсус по многим БК — один
// из сильнейших предикторов исхода. Чистые функции — тестируются без сети.

// Снять маржу пропорционально (multiplicative method).
// oddsArr → массив вероятностей, сумма = 1. null при мусоре.
export function noVig(oddsArr = []) {
  const imp = oddsArr.map(o => 1 / Number(o));
  if (imp.length < 2 || imp.some(x => !Number.isFinite(x) || x <= 0)) return null;
  const s = imp.reduce((a, b) => a + b, 0);
  if (!(s > 0)) return null;
  return imp.map(p => p / s);
}

// То же, но с привязкой к именам исходов. [{name, odds}] → { name: prob }.
export function noVigByName(outcomes = []) {
  const p = noVig(outcomes.map(o => o.odds));
  if (!p) return null;
  const m = {};
  outcomes.forEach((o, i) => { m[o.name] = p[i]; });
  return m;
}

// Overround (маржа рынка) в процентах: (Σ(1/odds) − 1)·100.
export function overroundPct(oddsArr = []) {
  const imp = oddsArr.map(o => 1 / Number(o));
  if (imp.some(x => !Number.isFinite(x) || x <= 0)) return null;
  const s = imp.reduce((a, b) => a + b, 0);
  return Math.round((s - 1) * 1000) / 10;
}

// Консенсус по всем БК события: для каждого БК с полным рынком снимаем маржу и
// усредняем вероятности по исходам. Возвращает { name: prob } (сумма = 1) или null.
//
// point — для рынков с линией (тоталы). Консенсус ОБЯЗАН считаться в пределах
// одной линии: нельзя мешать Тотал 2.5 и Тотал 3.5. Если задан, берём у каждого
// БК только исходы с этим point (h2h — point не нужен).
export function marketConsensus(event, marketKey = "h2h", point = null) {
  if (!event || !Array.isArray(event.bookmakers)) return null;
  const acc = {};
  const cnt = {};
  for (const bk of event.bookmakers) {
    const market = (bk.markets || []).find(m => m.key === marketKey);
    if (!market) continue;
    let ocs = (market.outcomes || []).filter(o => Number(o.price) > 1);
    if (point != null) ocs = ocs.filter(o => o.point === point);
    if (ocs.length < 2) continue;
    const nv = noVigByName(ocs.map(o => ({ name: o.name, odds: o.price })));
    if (!nv) continue;
    for (const name of Object.keys(nv)) {
      acc[name] = (acc[name] || 0) + nv[name];
      cnt[name] = (cnt[name] || 0) + 1;
    }
  }
  const names = Object.keys(acc);
  if (names.length < 2) return null;
  const avg = {};
  let s = 0;
  for (const name of names) { avg[name] = acc[name] / cnt[name]; s += avg[name]; }
  for (const name of names) avg[name] /= s; // ренормировка
  return avg;
}
