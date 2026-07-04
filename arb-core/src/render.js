// Рендер HTML-дашборда (чистая функция — тестируется без сервера).
// Отдаёт самодостаточную страницу: вилки, value-ставки с размером по Кельли,
// точность прогноза и панель управления. Стиль встроен, тёмная/светлая тема.

import { kellyStake } from "./core/kelly.js";

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtDate(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
  catch { return esc(iso); }
}

function probBar(probs = {}, pickName) {
  const entries = Object.entries(probs);
  const cells = entries.map(([k, v]) => {
    const pct = Math.round(v * 100);
    const hot = k === pickName ? " seg-pick" : "";
    return `<div class="seg${hot}" style="flex:${Math.max(v, 0.001)}" title="${esc(k)} ${pct}%">` +
      `<span>${esc(k)} ${pct}%</span></div>`;
  });
  return `<div class="bar">${cells.join("")}</div>`;
}

function surebetCard(sb, i) {
  const legs = sb.arb.legs.map(l =>
    `<li><b>${esc(l.name)}</b> @ ${l.odds} <span class="bk">${esc(l.bookmaker)}</span> → ставка <b>${l.stake}</b></li>`
  ).join("");
  return `<div class="card sure">
    <div class="row"><div class="teams">${esc(sb.home)} — ${esc(sb.away)}</div>
      <div class="tag ok">маржа +${sb.arb.marginPct}%</div></div>
    <div class="meta">${esc(sb.sport)} · ${esc(sb.market)}${sb.line ? " · " + esc(sb.line) : ""} · ROI ${sb.arb.roi}%</div>
    <ul class="legs">${legs}</ul>
    <div class="meta">банк ${sb.arb.invested} → гаранта ${sb.arb.guaranteedPayout} (профит <b>${sb.arb.profit}</b>)</div>
  </div>`;
}

function valueCard(v, bankroll, kellyFraction, kellyMax) {
  const b = v.valueBet;
  const tier = b.tier === "sharp"
    ? `<span class="tier sharp">резкая</span>` : `<span class="tier soft">софт</span>`;
  const p = v.prediction && v.prediction.probs[b.name];
  let stakeLine = "";
  if (p != null) {
    const k = kellyStake(p, b.odds, { bankroll, fraction: kellyFraction, maxFraction: kellyMax });
    stakeLine = `<div class="stake">ставка <b>${k.stake}</b> · ${(k.fractionOfBank * 100).toFixed(1)}% банка (${kellyFraction}·Kelly)</div>`;
  }
  return `<div class="card val">
    <div class="row"><div class="teams">${esc(v.home)} — ${esc(v.away)}</div>
      <div class="tag edge">+${b.edgePct}%</div></div>
    <div class="meta">${esc(v.sport)} · ${esc(v.market)}${v.line ? " · " + esc(v.line) : ""} · ${fmtDate(v.commence)}</div>
    <div class="pick">➤ <b>${esc(b.name)}</b> @ ${b.odds} <span class="bk">${esc(b.bookmaker)}</span> ${tier}</div>
    ${stakeLine}
    ${v.prediction ? probBar(v.prediction.probs, b.name) : ""}
  </div>`;
}

export function renderDashboardHtml(data) {
  const { sport, settings, surebets = [], values = [], accuracy = {} } = data;
  const s = settings;
  const src = s.sources || {};
  const q = (k, def) => `value="${esc(def)}"`;

  const controls = `<form class="controls" method="get">
    <label>Спорт <input name="sport" value="${esc(sport)}" placeholder="upcoming"></label>
    <label>Окно, ч <input name="hours" type="number" ${q("hours", s.maxHours)}></label>
    <label>Банк <input name="bank" type="number" ${q("bank", s.bankroll)}></label>
    <label>Порог % <input name="edge" type="number" step="0.5" ${q("edge", s.minEdgePct)}></label>
    <label class="chk"><input type="checkbox" name="sharp" value="1" ${s.sharpOnly ? "checked" : ""}> резкие</label>
    <label class="chk"><input type="checkbox" name="ai" value="1" ${s.enrichAi ? "checked" : ""}> +ИИ</label>
    <button type="submit">Обновить</button>
  </form>`;

  const acc = accuracy.count
    ? `<div class="accgrid">
        <div><span class="num">${accuracy.count}</span><span class="lbl">оценено</span></div>
        <div><span class="num">${accuracy.brier}</span><span class="lbl">Brier</span></div>
        <div><span class="num">${accuracy.hitRatePct}%</span><span class="lbl">hit rate</span></div>
        ${accuracy.bets ? `<div><span class="num">${accuracy.betRoiPct >= 0 ? "+" : ""}${accuracy.betRoiPct}%</span><span class="lbl">ROI (${accuracy.betWins}/${accuracy.bets})</span></div>` : ""}
      </div>`
    : `<div class="empty">Нет оценённых прогнозов. Скан копит их в лог; после матчей — <code>npm run grade</code>.</div>`;

  const sureHtml = surebets.length
    ? surebets.map(surebetCard).join("")
    : `<div class="empty">Вилок нет — это норма (чистые вилки редки и живут секунды).</div>`;
  const valHtml = values.length
    ? values.map(v => valueCard(v, s.bankroll, s.kellyFraction ?? 0.25, s.kellyMax ?? 0.05)).join("")
    : `<div class="empty">Value-ставок выше порога нет — на ликвидном рынке это обычное дело.</div>`;

  const srcBadge = (on, name) => `<span class="src ${on ? "on" : "off"}">${name} ${on ? "✓" : "—"}</span>`;

  return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SPECTO ARB — дашборд</title>
<style>
:root{color-scheme:light dark;--bg:#0f1216;--card:#171c22;--mut:#8b97a5;--line:#252c34;--fg:#e6edf3;--ok:#2ea043;--edge:#3b82f6;--soft:#b4790a;--sharp:#2ea043}
@media (prefers-color-scheme:light){:root{--bg:#f4f6f8;--card:#fff;--mut:#5b6672;--line:#e3e8ee;--fg:#101418}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif}
.wrap{max-width:900px;margin:0 auto;padding:20px}
h1{font-size:20px;margin:0 0 4px}.sub{color:var(--mut);font-size:13px;margin-bottom:14px}
.src{font-size:12px;margin-right:8px}.src.on{color:var(--ok)}.src.off{color:var(--mut)}
.controls{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:18px}
.controls label{display:flex;flex-direction:column;font-size:12px;color:var(--mut);gap:4px}
.controls input[type=number],.controls input[type=text],.controls input:not([type]){width:110px;padding:7px 9px;background:var(--bg);border:1px solid var(--line);border-radius:8px;color:var(--fg)}
.controls .chk{flex-direction:row;align-items:center;gap:6px;color:var(--fg);font-size:14px}
.controls button{padding:9px 16px;background:var(--edge);color:#fff;border:0;border-radius:8px;font-weight:600;cursor:pointer}
h2{font-size:15px;margin:22px 0 10px;display:flex;align-items:center;gap:8px}h2 .c{color:var(--mut);font-weight:400}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;margin-bottom:10px}
.row{display:flex;justify-content:space-between;align-items:center;gap:10px}
.teams{font-weight:600}.meta{color:var(--mut);font-size:12px;margin:2px 0}
.tag{font-size:13px;font-weight:700;padding:3px 9px;border-radius:20px;white-space:nowrap}
.tag.ok{background:rgba(46,160,67,.15);color:var(--ok)}.tag.edge{background:rgba(59,130,246,.15);color:var(--edge)}
.legs{margin:8px 0;padding-left:18px}.legs li{margin:2px 0}.bk{color:var(--mut)}
.pick{margin:8px 0 6px;font-size:15px}.stake{font-size:13px;color:var(--mut);margin-bottom:8px}
.tier{font-size:11px;padding:1px 7px;border-radius:20px;margin-left:6px}
.tier.sharp{background:rgba(46,160,67,.18);color:var(--sharp)}.tier.soft{background:rgba(180,121,10,.18);color:var(--soft)}
.bar{display:flex;height:22px;border-radius:6px;overflow:hidden;border:1px solid var(--line)}
.seg{display:flex;align-items:center;justify-content:center;min-width:0;background:var(--bg);border-right:1px solid var(--line);font-size:11px;color:var(--mut);overflow:hidden;white-space:nowrap}
.seg:last-child{border-right:0}.seg-pick{background:rgba(59,130,246,.22);color:var(--fg);font-weight:600}
.accgrid{display:flex;flex-wrap:wrap;gap:14px}.accgrid>div{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 18px;text-align:center;flex:1;min-width:90px}
.accgrid .num{display:block;font-size:22px;font-weight:700}.accgrid .lbl{color:var(--mut);font-size:12px}
.empty{color:var(--mut);background:var(--card);border:1px dashed var(--line);border-radius:12px;padding:16px;font-size:14px}
code{background:var(--bg);padding:2px 6px;border-radius:5px}
</style></head><body><div class="wrap">
<h1>SPECTO ARB — дашборд</h1>
<div class="sub">${esc(sport)} · рынки [${esc((s.markets || []).join(", "))}] · окно ${s.maxHours > 0 ? s.maxHours + "ч" : "выкл"} · банк ${s.bankroll} ·
  ${srcBadge(true, "Odds")}${srcBadge(src.football, "Football")}${srcBadge(src.claude, "Claude")}${srcBadge(src.telegram, "Telegram")}</div>
${controls}
<h2>Вилки (surebet) <span class="c">${surebets.length}</span></h2>${sureHtml}
<h2>Value-ставки <span class="c">${values.length}</span></h2>${valHtml}
<h2>Точность прогноза</h2>${acc}
<div class="sub" style="margin-top:20px">Данные обновляются при нажатии «Обновить». Точность по факту — <code>npm run grade</code> после матчей.</div>
</div></body></html>`;
}
