import Link from "next/link";
import SiteNav from "@/components/site-nav";
import SiteFooter from "@/components/site-footer";
import Reveal from "@/components/reveal";
import ChatMock from "@/components/chat-mock";
import { Icon } from "@/components/icons";

const features = [
  {
    icon: "chat",
    title: "Диалог голосом менеджера",
    text: "«Алина» на базе Claude общается с лидами естественно, по вашему скрипту продаж — клиент не отличит от живого менеджера.",
  },
  {
    icon: "filter",
    title: "ИИ-квалификация лидов",
    text: "Каждая переписка оценивается автоматически: горячий, тёплый или холодный. Менеджеры видят только тех, кто готов покупать.",
  },
  {
    icon: "clock",
    title: "Догоняющие сообщения",
    text: "Клиент замолчал? SPECTO сам вернёт его цепочкой напоминаний по таймингу. Ответил — цепочка останавливается.",
  },
  {
    icon: "users",
    title: "Авто-назначение менеджеров",
    text: "Горячие лиды мгновенно уходят наименее загруженному менеджеру. Ни одна заявка не зависает без ответственного.",
  },
  {
    icon: "shield",
    title: "Агент-сторож",
    text: "Фоновый ИИ следит за здоровьем воронки, чинит пропуски, переоценивает устаревшие оценки и алертит о застрявших горячих.",
  },
  {
    icon: "chart",
    title: "Дашборд и сводки",
    text: "Живой дашборд горячих лидов и ежедневная сводка по продажам — вся картина по воронке в одном месте.",
  },
];

const steps = [
  {
    n: "01",
    title: "Подключаем WhatsApp",
    text: "Интеграция с WhatsApp Cloud API за час. Ваш номер, ваш скрипт — настраиваем под ваш бизнес.",
  },
  {
    n: "02",
    title: "Обучаем «Алину»",
    text: "Загружаем прайс, услуги и тон общения. ИИ отвечает так, как отвечал бы ваш лучший менеджер.",
  },
  {
    n: "03",
    title: "Ловим и квалифицируем",
    text: "Каждый входящий получает ответ за секунды, ИИ квалифицирует и ведёт лида до передачи менеджеру.",
  },
  {
    n: "04",
    title: "Закрываете горячих",
    text: "Менеджеры работают только с готовыми к покупке. Дашборд и сводки держат воронку под контролем.",
  },
];

const stats = [
  { value: "<5 сек", label: "Средняя скорость ответа лиду" },
  { value: "24/7", label: "Работает без выходных и обедов" },
  { value: "×3", label: "Больше доведённых до менеджера" },
  { value: "0", label: "Упущенных горячих лидов ночью" },
];

const plans = [
  {
    name: "Start",
    price: "9 900 ₽",
    period: "/мес",
    desc: "Для небольших команд, которые запускают продажи в WhatsApp.",
    features: ["До 300 лидов/мес", "ИИ-ответы «Алина»", "Квалификация лидов", "Дашборд горячих"],
    cta: "Начать",
    highlight: false,
  },
  {
    name: "Business",
    price: "24 900 ₽",
    period: "/мес",
    desc: "Для растущих отделов продаж с потоком заявок.",
    features: [
      "До 1500 лидов/мес",
      "Всё из Start",
      "Догоняющие сообщения",
      "Авто-назначение менеджеров",
      "Ежедневные сводки",
    ],
    cta: "Запросить демо",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Индивид.",
    period: "",
    desc: "Для крупных компаний с несколькими филиалами.",
    features: [
      "Безлимит лидов",
      "Всё из Business",
      "Мультитенантность",
      "Агент-сторож 24/7",
      "Приоритетная поддержка",
    ],
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
          <div className="pointer-events-none absolute inset-0 -z-10 grid-dots [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]" />
          <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-accent-indigo/20 blur-[120px]" />

          <div className="container-x grid items-center gap-14 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
            <div>
              <Reveal>
                <span className="eyebrow">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-indigo" />
                  ИИ-менеджер продаж в WhatsApp
                </span>
              </Reveal>

              <Reveal delay={80}>
                <h1 className="mt-6 font-display text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
                  Ни один горячий лид{" "}
                  <span className="text-gradient-animated">больше не сгорит</span>
                </h1>
              </Reveal>

              <Reveal delay={140}>
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-400">
                  SPECTO — это «Алина», ИИ-менеджер, который отвечает клиентам в
                  WhatsApp за секунды, квалифицирует их и сам ведёт догоняющие.
                  Ваши менеджеры работают только с теми, кто готов купить.
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
                <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-zinc-500">
                  <span className="inline-flex items-center gap-2">
                    <Icon name="check" className="h-4 w-4 text-accent-indigo" />
                    Запуск за 1 день
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Icon name="check" className="h-4 w-4 text-accent-indigo" />
                    Без кода
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Icon name="check" className="h-4 w-4 text-accent-indigo" />
                    Интеграция с вашей CRM
                  </span>
                </div>
              </Reveal>
            </div>

            <Reveal delay={200} className="flex justify-center lg:justify-end">
              <div className="animate-float">
                <ChatMock />
              </div>
            </Reveal>
          </div>
        </section>

        {/* ================= TRUST STRIP ================= */}
        <section className="border-y border-white/[0.06] bg-white/[0.015]">
          <div className="container-x py-6">
            <p className="text-center text-xs uppercase tracking-[0.2em] text-zinc-600">
              Работает на технологиях, которым доверяют
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 font-display text-sm font-semibold text-zinc-500">
              <span>Claude AI</span>
              <span className="text-zinc-700">•</span>
              <span>WhatsApp Cloud API</span>
              <span className="text-zinc-700">•</span>
              <span>Supabase</span>
              <span className="text-zinc-700">•</span>
              <span>Meta HMAC-подпись</span>
            </div>
          </div>
        </section>

        {/* ================= FEATURES ================= */}
        <section id="features" className="relative py-24">
          <div className="container-x">
            <Reveal className="mx-auto max-w-2xl text-center">
              <span className="eyebrow">Возможности</span>
              <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Целый отдел продаж внутри WhatsApp
              </h2>
              <p className="mt-4 text-lg text-zinc-400">
                SPECTO закрывает всю рутину — от первого «Здравствуйте» до передачи
                горячего лида менеджеру.
              </p>
            </Reveal>

            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f, i) => (
                <Reveal key={f.title} delay={i * 60}>
                  <article className="card group h-full p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-accent-blue/15 to-accent-violet/15 text-accent-indigo transition-colors group-hover:text-white">
                      <Icon name={f.icon} className="h-6 w-6" />
                    </div>
                    <h3 className="mt-5 font-display text-lg font-semibold text-white">
                      {f.title}
                    </h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">
                      {f.text}
                    </p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ================= HOW IT WORKS ================= */}
        <section id="how" className="relative py-24">
          <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-96 w-[46rem] -translate-x-1/2 rounded-full bg-accent-violet/10 blur-[120px]" />
          <div className="container-x">
            <Reveal className="mx-auto max-w-2xl text-center">
              <span className="eyebrow">Как работает</span>
              <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
                От заявки до сделки — за 4 шага
              </h2>
            </Reveal>

            <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {steps.map((s, i) => (
                <Reveal key={s.n} delay={i * 70}>
                  <div className="card h-full p-6">
                    <span className="font-mono text-sm font-medium text-accent-indigo">
                      {s.n}
                    </span>
                    <h3 className="mt-4 font-display text-lg font-semibold text-white">
                      {s.title}
                    </h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">
                      {s.text}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ================= STATS ================= */}
        <section className="py-12">
          <div className="container-x">
            <Reveal>
              <div className="card grid gap-8 rounded-3xl p-10 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map((s) => (
                  <div key={s.label} className="text-center">
                    <p className="font-display text-4xl font-bold text-gradient">
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
            <Reveal className="mx-auto max-w-2xl text-center">
              <span className="eyebrow">Тарифы</span>
              <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Простые тарифы под ваш поток лидов
              </h2>
              <p className="mt-4 text-lg text-zinc-400">
                Платите за результат, а не за место. Первые 14 дней — бесплатно.
              </p>
            </Reveal>

            <div className="mt-14 grid items-stretch gap-6 lg:grid-cols-3">
              {plans.map((p, i) => (
                <Reveal key={p.name} delay={i * 70} className="h-full">
                  <div
                    className={`relative flex h-full flex-col rounded-2xl border p-7 transition-all duration-300 ${
                      p.highlight
                        ? "border-accent-indigo/40 bg-gradient-to-b from-accent-indigo/[0.12] to-transparent glow-violet"
                        : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.16]"
                    }`}
                  >
                    {p.highlight && (
                      <span className="absolute -top-3 left-7 rounded-full bg-gradient-to-r from-accent-blue to-accent-violet px-3 py-1 text-xs font-semibold text-white">
                        Популярный
                      </span>
                    )}
                    <h3 className="font-display text-xl font-semibold text-white">
                      {p.name}
                    </h3>
                    <p className="mt-2 text-sm text-zinc-400">{p.desc}</p>
                    <div className="mt-6 flex items-end gap-1">
                      <span className="font-display text-4xl font-bold text-white">
                        {p.price}
                      </span>
                      <span className="pb-1 text-sm text-zinc-500">{p.period}</span>
                    </div>
                    <ul className="mt-6 space-y-3">
                      {p.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-300">
                          <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-accent-indigo" />
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
              <figure className="card mx-auto max-w-3xl rounded-3xl p-10 text-center">
                <Icon name="sparkle" className="mx-auto h-7 w-7 text-accent-indigo" />
                <blockquote className="mt-5 font-display text-xl font-medium leading-relaxed text-zinc-100 sm:text-2xl">
                  «Раньше мы теряли половину заявок из WhatsApp по ночам и в
                  выходные. С SPECTO лиды получают ответ мгновенно, а менеджеры
                  утром видят только горячих. Конверсия в встречу выросла втрое.»
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
              <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-ink-850 p-10 text-center sm:p-16">
                <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-accent-indigo/25 blur-[100px]" />
                <h2 className="relative font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Перестаньте терять лидов уже завтра
                </h2>
                <p className="relative mx-auto mt-4 max-w-xl text-lg text-zinc-400">
                  Покажем SPECTO на ваших реальных заявках. 14 дней бесплатно,
                  без карты и обязательств.
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
