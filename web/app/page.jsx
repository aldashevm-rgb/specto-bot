import Link from "next/link";
import SiteNav from "@/components/site-nav";
import SiteFooter from "@/components/site-footer";
import Reveal from "@/components/reveal";
import DashboardMock from "@/components/dashboard-mock";
import { Icon } from "@/components/icons";

const steps = [
  { n: "01", title: "Подключаем WhatsApp", text: "Интеграция с WhatsApp Cloud API за час. Ваш номер, ваш скрипт." },
  { n: "02", title: "Обучаем «Алину»", text: "Загружаем прайс, услуги и тон общения — ИИ отвечает как ваш лучший менеджер." },
  { n: "03", title: "Ловим и квалифицируем", text: "Каждый входящий получает ответ за секунды, ИИ квалифицирует и ведёт лида." },
  { n: "04", title: "Закрываете горячих", text: "Менеджеры работают только с готовыми к покупке. Дашборд под контролем." },
];

const stats = [
  { value: "<5 сек", label: "Средняя скорость ответа" },
  { value: "24/7", label: "Без выходных и обедов" },
  { value: "×3", label: "Больше доведённых до менеджера" },
  { value: "0", label: "Упущенных горячих ночью" },
];

const plans = [
  {
    name: "Start",
    price: "9 900 ₽",
    period: "/мес",
    desc: "Для небольших команд, запускающих продажи в WhatsApp.",
    features: ["До 300 лидов/мес", "ИИ-ответы «Алина»", "Квалификация лидов", "Дашборд горячих"],
    cta: "Начать",
    highlight: false,
  },
  {
    name: "Business",
    price: "24 900 ₽",
    period: "/мес",
    desc: "Для растущих отделов продаж с потоком заявок.",
    features: ["До 1500 лидов/мес", "Всё из Start", "Догоняющие сообщения", "Авто-назначение", "Ежедневные сводки"],
    cta: "Запросить демо",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Индивид.",
    period: "",
    desc: "Для крупных компаний с несколькими филиалами.",
    features: ["Безлимит лидов", "Всё из Business", "Мультитенантность", "Агент-сторож 24/7", "Приоритетная поддержка"],
    cta: "Связаться",
    highlight: false,
  },
];

export default function HomePage() {
  return (
    <>
      <SiteNav />
      <main className="overflow-clip pt-16">
        {/* ================= HERO ================= */}
        <section className="relative">
          <div className="pointer-events-none absolute inset-0 -z-10 grid-lines [mask-image:radial-gradient(75%_55%_at_50%_0%,black,transparent)]" />
          <div className="pointer-events-none absolute -top-52 left-[8%] -z-10 h-[34rem] w-[34rem] rounded-full bg-signal-500/12 blur-[130px] animate-aurora" />

          <div className="container-x grid items-center gap-16 py-20 lg:grid-cols-[1fr_1fr] lg:py-28">
            <div>
              <Reveal>
                <span className="kicker">
                  <span className="h-1.5 w-1.5 rounded-full bg-signal-500" />
                  ИИ-менеджер продаж · WhatsApp
                </span>
              </Reveal>

              <Reveal delay={80}>
                <h1 className="mt-6 font-display text-5xl font-bold leading-[0.98] tracking-tight text-white sm:text-6xl lg:text-[4.5rem]">
                  Отвечает первым.
                  <br />
                  <span className="text-signal">Продаёт лучше.</span>
                  <br />
                  Не спит.
                </h1>
              </Reveal>

              <Reveal delay={140}>
                <p className="mt-7 max-w-lg text-lg leading-relaxed text-zinc-400">
                  «Алина» отвечает клиентам в WhatsApp за секунды, квалифицирует
                  их и ведёт догоняющие. Ваши менеджеры работают только с теми,
                  кто готов купить — а не с теми, кто «просто спросить».
                </p>
              </Reveal>

              <Reveal delay={200}>
                <div className="mt-9 flex flex-wrap items-center gap-3">
                  <Link href="/#contact" className="btn-primary">
                    Запросить демо
                    <Icon name="arrow" className="h-4 w-4" />
                  </Link>
                  <Link href="/product" className="btn-ghost">
                    Как это работает
                  </Link>
                </div>
              </Reveal>

              <Reveal delay={260}>
                <div className="mt-9 flex items-center gap-6 border-t border-white/[0.06] pt-6">
                  <div>
                    <p className="font-display text-2xl font-bold text-white">1 день</p>
                    <p className="text-xs text-zinc-500">до запуска</p>
                  </div>
                  <div className="h-8 w-px bg-white/10" />
                  <div>
                    <p className="font-display text-2xl font-bold text-white">2.1 сек</p>
                    <p className="text-xs text-zinc-500">средний ответ</p>
                  </div>
                  <div className="h-8 w-px bg-white/10" />
                  <div>
                    <p className="font-display text-2xl font-bold text-white">×3</p>
                    <p className="text-xs text-zinc-500">конверсия в встречу</p>
                  </div>
                </div>
              </Reveal>
            </div>

            <Reveal delay={220} className="flex justify-center lg:justify-end">
              <DashboardMock />
            </Reveal>
          </div>
        </section>

        {/* ================= TRUST STRIP ================= */}
        <section className="border-y border-white/[0.06] bg-white/[0.012]">
          <div className="container-x flex flex-col items-center gap-4 py-6 sm:flex-row sm:justify-between">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-600">
              Работает на
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 font-display text-sm font-semibold text-zinc-500">
              <span>Claude AI</span>
              <span className="text-zinc-700">/</span>
              <span>WhatsApp Cloud API</span>
              <span className="text-zinc-700">/</span>
              <span>Supabase</span>
              <span className="text-zinc-700">/</span>
              <span>Meta HMAC</span>
            </div>
          </div>
        </section>

        {/* ================= BENTO FEATURES ================= */}
        <section id="features" className="relative py-24">
          <div className="container-x">
            <Reveal className="max-w-2xl">
              <span className="kicker">Возможности</span>
              <h2 className="mt-4 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Целый отдел продаж
                <br />
                внутри одного чата
              </h2>
            </Reveal>

            <div className="mt-14 grid auto-rows-[minmax(0,1fr)] gap-4 md:grid-cols-6">
              {/* Big card */}
              <Reveal className="md:col-span-4">
                <article className="card group h-full overflow-hidden p-8">
                  <div className="flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-signal-500/20 bg-signal-500/10 text-signal-400">
                      <Icon name="chat" className="h-6 w-6" />
                    </div>
                    <span className="chip">Claude Sonnet</span>
                  </div>
                  <h3 className="mt-6 font-display text-2xl font-semibold text-white">
                    Диалог голосом вашего менеджера
                  </h3>
                  <p className="mt-3 max-w-lg text-base leading-relaxed text-zinc-400">
                    «Алина» ведёт живой разговор по вашему скрипту: отвечает на
                    вопросы, снимает возражения, доводит до целевого действия.
                    Клиент не отличит от живого человека — только без задержек и
                    в любое время суток.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <span className="chip">Естественный язык</span>
                    <span className="chip">Ваш скрипт продаж</span>
                    <span className="chip">Память диалога</span>
                  </div>
                </article>
              </Reveal>

              {/* Qualification */}
              <Reveal delay={60} className="md:col-span-2">
                <article className="card group h-full p-7">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-signal-500/20 bg-signal-500/10 text-signal-400">
                    <Icon name="filter" className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 font-display text-lg font-semibold text-white">
                    ИИ-квалификация
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">
                    Горячий, тёплый или холодный — оценка каждой переписки
                    автоматически, с обоснованием.
                  </p>
                </article>
              </Reveal>

              {/* Follow-ups */}
              <Reveal delay={80} className="md:col-span-2">
                <article className="card group h-full p-7">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-signal-500/20 bg-signal-500/10 text-signal-400">
                    <Icon name="clock" className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 font-display text-lg font-semibold text-white">
                    Догоняющие
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">
                    Клиент замолчал — SPECTO вернёт его цепочкой. Ответил —
                    цепочка останавливается.
                  </p>
                </article>
              </Reveal>

              {/* Auto-assign */}
              <Reveal delay={100} className="md:col-span-2">
                <article className="card group h-full p-7">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-signal-500/20 bg-signal-500/10 text-signal-400">
                    <Icon name="users" className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 font-display text-lg font-semibold text-white">
                    Авто-назначение
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">
                    Горячий лид мгновенно уходит наименее загруженному менеджеру.
                  </p>
                </article>
              </Reveal>

              {/* Watchdog + analytics wide */}
              <Reveal delay={120} className="md:col-span-2">
                <article className="card group h-full p-7">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-signal-500/20 bg-signal-500/10 text-signal-400">
                    <Icon name="shield" className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 font-display text-lg font-semibold text-white">
                    Агент-сторож
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">
                    Фоновый ИИ чинит пропуски и алертит о застрявших горячих.
                  </p>
                </article>
              </Reveal>

              <Reveal delay={140} className="md:col-span-4">
                <article className="card group flex h-full flex-col justify-between gap-5 p-7 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-signal-500/20 bg-signal-500/10 text-signal-400">
                      <Icon name="chart" className="h-5 w-5" />
                    </div>
                    <h3 className="mt-5 font-display text-lg font-semibold text-white">
                      Дашборд и ежедневные сводки
                    </h3>
                    <p className="mt-2.5 max-w-md text-sm leading-relaxed text-zinc-400">
                      Живая картина воронки и отчёт каждое утро — без ручной
                      работы менеджеров.
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-6 border-l border-white/10 pl-6">
                    <div>
                      <p className="font-display text-3xl font-bold text-signal-400">100%</p>
                      <p className="text-xs text-zinc-500">лидов в базе</p>
                    </div>
                    <div>
                      <p className="font-display text-3xl font-bold text-white">API</p>
                      <p className="text-xs text-zinc-500">экспорт</p>
                    </div>
                  </div>
                </article>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ================= HOW IT WORKS ================= */}
        <section id="how" className="relative py-24">
          <div className="container-x">
            <Reveal className="max-w-2xl">
              <span className="kicker">Как работает</span>
              <h2 className="mt-4 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
                От заявки до сделки — за 4 шага
              </h2>
            </Reveal>

            <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.05] md:grid-cols-4">
              {steps.map((s, i) => (
                <Reveal key={s.n} delay={i * 70}>
                  <div className="group h-full bg-ink-900 p-7 transition-colors hover:bg-ink-850">
                    <span className="font-mono text-sm font-medium text-signal-500">{s.n}</span>
                    <h3 className="mt-4 font-display text-lg font-semibold text-white">
                      {s.title}
                    </h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">{s.text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ================= STATS ================= */}
        <section className="py-8">
          <div className="container-x">
            <Reveal>
              <div className="grid gap-8 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-10 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map((s) => (
                  <div key={s.label} className="text-center">
                    <p className="font-display text-4xl font-bold text-signal-400 sm:text-5xl">
                      {s.value}
                    </p>
                    <p className="mt-2 text-sm text-zinc-400">{s.label}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* ================= PRICING ================= */}
        <section id="pricing" className="relative py-24">
          <div className="container-x">
            <Reveal className="max-w-2xl">
              <span className="kicker">Тарифы</span>
              <h2 className="mt-4 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Платите за результат
              </h2>
              <p className="mt-4 text-lg text-zinc-400">
                Первые 14 дней — бесплатно, без карты.
              </p>
            </Reveal>

            <div className="mt-14 grid items-stretch gap-5 lg:grid-cols-3">
              {plans.map((p, i) => (
                <Reveal key={p.name} delay={i * 70} className="h-full">
                  <div
                    className={`relative flex h-full flex-col rounded-2xl border p-7 transition-all duration-300 ${
                      p.highlight
                        ? "border-signal-500/40 bg-signal-500/[0.06] glow-signal"
                        : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.16]"
                    }`}
                  >
                    {p.highlight && (
                      <span className="absolute -top-3 left-7 rounded-full bg-signal-500 px-3 py-1 text-xs font-bold text-ink-950">
                        Популярный
                      </span>
                    )}
                    <h3 className="font-display text-xl font-semibold text-white">{p.name}</h3>
                    <p className="mt-2 text-sm text-zinc-400">{p.desc}</p>
                    <div className="mt-6 flex items-end gap-1">
                      <span className="font-display text-4xl font-bold text-white">{p.price}</span>
                      <span className="pb-1 text-sm text-zinc-500">{p.period}</span>
                    </div>
                    <ul className="mt-6 space-y-3">
                      {p.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-300">
                          <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-signal-500" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/#contact"
                      className={`mt-8 ${p.highlight ? "btn-primary" : "btn-ghost"} w-full`}
                    >
                      {p.cta}
                    </Link>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ================= TESTIMONIAL ================= */}
        <section className="py-16">
          <div className="container-x">
            <Reveal>
              <figure className="mx-auto max-w-3xl text-center">
                <blockquote className="font-display text-2xl font-medium leading-snug text-white sm:text-3xl">
                  «Раньше мы теряли половину заявок из WhatsApp по ночам. С SPECTO
                  клиенты получают ответ мгновенно, а менеджеры утром видят{" "}
                  <span className="text-signal">только горячих</span>. Конверсия в
                  встречу выросла втрое.»
                </blockquote>
                <figcaption className="mt-6 text-sm text-zinc-400">
                  <span className="font-semibold text-white">Руслан Ким</span> · руководитель
                  отдела продаж
                </figcaption>
              </figure>
            </Reveal>
          </div>
        </section>

        {/* ================= CTA ================= */}
        <section id="contact" className="py-20">
          <div className="container-x">
            <Reveal>
              <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-ink-850 to-ink-900 p-10 text-center sm:p-16">
                <div className="pointer-events-none absolute -bottom-32 left-1/2 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-signal-500/15 blur-[110px]" />
                <h2 className="relative font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
                  Перестаньте терять лидов
                  <br />
                  уже завтра
                </h2>
                <p className="relative mx-auto mt-5 max-w-xl text-lg text-zinc-400">
                  Покажем SPECTO на ваших реальных заявках. 14 дней бесплатно, без
                  карты и обязательств.
                </p>
                <div className="relative mt-8 flex flex-wrap justify-center gap-3">
                  <Link href="mailto:hello@specto.app" className="btn-primary">
                    Запросить демо
                    <Icon name="arrow" className="h-4 w-4" />
                  </Link>
                  <Link href="/product" className="btn-ghost">
                    Смотреть возможности
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
