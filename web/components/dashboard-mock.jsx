import { Icon } from "./icons";

const leads = [
  { name: "Айгерим С.", msg: "Готовы оплатить сегодня", score: 96, tag: "Горячий", tone: "hot", initials: "АС" },
  { name: "Данияр К.", msg: "Сколько стоит для 500 заявок?", score: 88, tag: "Горячий", tone: "hot", initials: "ДК" },
  { name: "Марат О.", msg: "Пришлите КП на почту", score: 74, tag: "Тёплый", tone: "warm", initials: "МО" },
  { name: "Гульнара Т.", msg: "Подумаю, спасибо", score: 41, tag: "Холодный", tone: "cold", initials: "ГТ" },
];

const toneStyles = {
  hot: "border-signal-500/30 bg-signal-500/10 text-signal-400",
  warm: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  cold: "border-white/10 bg-white/5 text-zinc-400",
};

const barStyles = {
  hot: "bg-signal-500",
  warm: "bg-amber-400",
  cold: "bg-zinc-600",
};

export default function DashboardMock() {
  return (
    <div className="relative w-full max-w-[560px]">
      {/* glow */}
      <div className="pointer-events-none absolute -inset-8 -z-10 rounded-[2.5rem] bg-signal-500/15 blur-[80px] animate-pulse-glow" />

      {/* main dashboard panel */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-ink-850/90 shadow-2xl backdrop-blur">
        {/* window bar */}
        <div className="flex items-center gap-2 border-b border-white/[0.06] bg-ink-800 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="ml-3 font-mono text-xs text-zinc-500">specto.app/hot</span>
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-signal-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-signal-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal-500" /> Live
          </span>
        </div>

        {/* header row */}
        <div className="flex items-center justify-between px-5 pt-5">
          <div>
            <p className="font-display text-lg font-semibold text-white">Горячие лиды</p>
            <p className="text-xs text-zinc-500">Обновляется в реальном времени</p>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-bold text-signal-400">12</p>
            <p className="text-xs text-zinc-500">в работе</p>
          </div>
        </div>

        {/* leads list */}
        <div className="space-y-2 p-4">
          {leads.map((l) => (
            <div
              key={l.name}
              className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-ink-600 to-ink-700 text-xs font-semibold text-zinc-200">
                {l.initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-100">{l.name}</p>
                <p className="truncate text-xs text-zinc-500">{l.msg}</p>
              </div>
              <div className="hidden w-24 sm:block">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className={`h-full rounded-full ${barStyles[l.tone]}`} style={{ width: `${l.score}%` }} />
                </div>
                <p className="mt-1 text-right font-mono text-[10px] text-zinc-500">{l.score}</p>
              </div>
              <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${toneStyles[l.tone]}`}>
                {l.tag}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* floating chat card for depth */}
      <div className="absolute -bottom-10 -left-6 hidden w-64 rounded-2xl border border-white/10 bg-ink-800/95 p-4 shadow-2xl backdrop-blur-md animate-float-slow sm:block">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-signal-500 text-xs font-bold text-ink-950">
            А
          </div>
          <div>
            <p className="text-xs font-semibold text-white">Алина отвечает</p>
            <p className="flex items-center gap-1 text-[10px] text-signal-400">
              <span className="h-1 w-1 rounded-full bg-signal-500" /> 2.1 сек
            </p>
          </div>
        </div>
        <p className="mt-3 rounded-lg rounded-tl-sm bg-ink-700 px-3 py-2 text-xs leading-relaxed text-zinc-200">
          Отлично! Забронировала для вас демо на завтра в 15:00 ✅
        </p>
      </div>

      {/* floating metric chip */}
      <div className="absolute -right-4 -top-6 hidden rounded-xl border border-white/10 bg-ink-800/95 px-4 py-3 shadow-xl backdrop-blur-md animate-float sm:block">
        <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">ответ за</p>
        <p className="font-display text-xl font-bold text-signal-400">&lt; 5 сек</p>
      </div>
    </div>
  );
}
