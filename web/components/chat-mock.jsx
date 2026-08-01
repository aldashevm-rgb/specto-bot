import { Icon } from "./icons";

const messages = [
  { from: "lead", text: "Здравствуйте! Сколько стоит внедрение?" },
  {
    from: "bot",
    text: "Здравствуйте 👋 Меня зовут Алина. Стоимость зависит от объёма лидов. Подскажите, сколько заявок в месяц вы обрабатываете?",
  },
  { from: "lead", text: "Примерно 400–500 в WhatsApp" },
  {
    from: "bot",
    text: "Отлично, для такого объёма подойдёт тариф Business. Давайте покажу на демо — вам удобно завтра в 15:00?",
  },
];

export default function ChatMock() {
  return (
    <div className="relative w-full max-w-sm">
      {/* glow */}
      <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-tr from-accent-blue/25 via-accent-indigo/20 to-accent-violet/25 blur-2xl animate-pulse-glow" />

      <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-ink-850 shadow-2xl">
        {/* header */}
        <div className="flex items-center gap-3 border-b border-white/[0.06] bg-ink-800 px-5 py-4">
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-accent-blue to-accent-violet font-display text-sm font-bold text-white">
              А
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ink-800 bg-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">Алина · SPECTO</p>
            <p className="flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> отвечает за секунды
            </p>
          </div>
          <span className="ml-auto flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
            <Icon name="sparkle" className="h-3 w-3 text-accent-indigo" /> ИИ
          </span>
        </div>

        {/* body */}
        <div className="space-y-3 bg-ink-850 px-4 py-5">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.from === "bot" ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.from === "bot"
                    ? "rounded-tl-md border border-white/[0.06] bg-ink-700 text-zinc-100"
                    : "rounded-tr-md bg-gradient-to-br from-accent-blue to-accent-indigo text-white"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}

          {/* qualification chip */}
          <div className="flex justify-center pt-1">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
              <Icon name="check" className="h-3.5 w-3.5" />
              Лид квалифицирован · Горячий · Тариф Business
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
