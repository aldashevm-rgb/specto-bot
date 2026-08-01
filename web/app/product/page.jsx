import Link from "next/link";
import SiteNav from "@/components/site-nav";
import SiteFooter from "@/components/site-footer";
import Reveal from "@/components/reveal";
import { Icon } from "@/components/icons";

export const metadata = {
  title: "Возможности",
  description:
    "Как устроен SPECTO: ИИ-диалог голосом менеджера, квалификация лидов, догоняющие сообщения, авто-назначение, агент-сторож, дашборд и сводки.",
};

const blocks = [
  {
    icon: "chat",
    eyebrow: "Диалог",
    title: "Отвечает как ваш лучший менеджер",
    text: "«Алина» работает на Claude и ведёт живой диалог по вашему скрипту продаж: отвечает на вопросы, снимает возражения, уточняет потребность. Клиент общается естественно — как с человеком, только без задержек и в любое время суток.",
    points: [
      "Системный промпт под ваш бизнес и тон общения",
      "Модель Claude Sonnet (настраивается)",
      "Вся переписка сохраняется в базе",
    ],
    chips: ["Естественный язык", "Ваш скрипт", "24/7"],
  },
  {
    icon: "filter",
    eyebrow: "Квалификация",
    title: "ИИ отделяет горячих от холодных",
    text: "Каждая переписка автоматически оценивается: насколько лид готов к покупке, что ему нужно, какой тариф подходит. Менеджеры не тратят время на «просто посмотреть» — в работу попадают только те, кто реально покупает.",
    points: [
      "Оценка «горячий / тёплый / холодный»",
      "Обоснование оценки для менеджера",
      "Автопереоценка при новых сообщениях",
    ],
    chips: ["Скоринг", "Приоритизация", "Прозрачность"],
  },
  {
    icon: "clock",
    eyebrow: "Догоняющие",
    title: "Возвращает тех, кто замолчал",
    text: "Лид написал и пропал? SPECTO сам напомнит о себе цепочкой сообщений по таймингу. Состояние хранится в базе и переживает перезапуск, а как только клиент ответит — цепочка мгновенно останавливается.",
    points: [
      "Настраиваемая цепочка по времени",
      "Состояние переживает рестарт сервиса",
      "Авто-стоп при ответе клиента",
    ],
    chips: ["Реактивация", "Тайминги", "Без спама"],
  },
  {
    icon: "users",
    eyebrow: "Распределение",
    title: "Горячие лиды не зависают без ответа",
    text: "Как только лид становится горячим, он мгновенно назначается наименее загруженному менеджеру. Никаких «ничьих» заявок и потерянных клиентов между сменами.",
    points: [
      "Авто-назначение по загрузке",
      "Мгновенная передача горячих",
      "Контроль ответственных",
    ],
    chips: ["Роутинг", "Баланс нагрузки"],
  },
  {
    icon: "shield",
    eyebrow: "Надёжность",
    title: "Агент-сторож следит за воронкой",
    text: "Фоновый ИИ постоянно проверяет здоровье системы: чинит пропущенные оценки, переоценивает устаревшие, находит застрявших горячих лидов и алертит команду. Воронка не «протекает» незаметно.",
    points: [
      "Авто-ремонт пропусков квалификации",
      "Алерты о застрявших горячих",
      "Мониторинг здоровья сервиса и БД",
    ],
    chips: ["Самоконтроль", "Алерты"],
  },
  {
    icon: "chart",
    eyebrow: "Аналитика",
    title: "Вся воронка в одном месте",
    text: "Живой дашборд горячих лидов и ежедневная сводка держат руководителя в курсе без ручных отчётов. Видно, сколько заявок, кто в работе и где узкие места.",
    points: [
      "Дашборд горячих лидов в реальном времени",
      "Ежедневная сводка по продажам",
      "Экспорт лидов через защищённый API",
    ],
    chips: ["Дашборд", "Сводки", "API"],
  },
];

const security = [
  { icon: "shield", title: "Meta HMAC-подпись", text: "Проверка подписи каждого вебхука WhatsApp — чужой запрос не пройдёт." },
  { icon: "shield", title: "Supabase + RLS", text: "Данные лидов в защищённой базе с изоляцией по организациям." },
  { icon: "sparkle", title: "Мультитенантность", text: "Несколько филиалов и номеров в одном контуре, данные разделены." },
];

export default function ProductPage() {
  return (
    <>
      <SiteNav />
      <main className="overflow-clip pt-16">
        {/* HERO */}
        <section className="relative py-20 lg:py-28">
          <div className="pointer-events-none absolute inset-0 -z-10 grid-dots [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]" />
          <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-accent-indigo/20 blur-[120px]" />
          <div className="container-x max-w-3xl text-center">
            <Reveal>
              <span className="eyebrow">Возможности продукта</span>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="mt-6 font-display text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl">
                Всё, что делает{" "}
                <span className="text-gradient-animated">ваш отдел продаж</span> —
                только без перерывов
              </h1>
            </Reveal>
            <Reveal delay={140}>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">
                SPECTO берёт на себя первую линию: отвечает, квалифицирует,
                догоняет и распределяет. Ниже — как работает каждый модуль.
              </p>
            </Reveal>
            <Reveal delay={200}>
              <div className="mt-8 flex justify-center gap-3">
                <Link href="/#contact" className="btn-primary">
                  Запросить демо
                  <Icon name="arrow" className="h-4 w-4" />
                </Link>
                <Link href="/#pricing" className="btn-ghost">
                  Тарифы
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* FEATURE BLOCKS */}
        <section className="py-8">
          <div className="container-x space-y-8">
            {blocks.map((b, i) => (
              <Reveal key={b.title}>
                <article
                  className={`card grid items-center gap-8 rounded-3xl p-8 lg:grid-cols-2 lg:p-12 ${
                    i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
                  }`}
                >
                  <div>
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-accent-indigo">
                      <Icon name={b.icon} className="h-5 w-5" />
                      {b.eyebrow}
                    </span>
                    <h2 className="mt-4 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                      {b.title}
                    </h2>
                    <p className="mt-4 text-base leading-relaxed text-zinc-400">
                      {b.text}
                    </p>
                    <ul className="mt-6 space-y-3">
                      {b.points.map((p) => (
                        <li key={p} className="flex items-start gap-2.5 text-sm text-zinc-300">
                          <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-accent-indigo" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* visual */}
                  <div className="relative">
                    <div className="pointer-events-none absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-tr from-accent-blue/10 via-transparent to-accent-violet/10 blur-2xl" />
                    <div className="flex aspect-[4/3] flex-col items-center justify-center gap-6 rounded-2xl border border-white/[0.08] bg-ink-850 p-8">
                      <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-accent-blue/20 to-accent-violet/20 text-accent-indigo">
                        <Icon name={b.icon} className="h-10 w-10" />
                      </div>
                      <div className="flex flex-wrap justify-center gap-2">
                        {b.chips.map((c) => (
                          <span
                            key={c}
                            className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-300"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* SECURITY */}
        <section className="py-24">
          <div className="container-x">
            <Reveal className="mx-auto max-w-2xl text-center">
              <span className="eyebrow">Безопасность</span>
              <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Данные клиентов под защитой
              </h2>
            </Reveal>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {security.map((s, i) => (
                <Reveal key={s.title} delay={i * 70}>
                  <div className="card h-full p-6">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-accent-indigo">
                      <Icon name={s.icon} className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 font-display text-lg font-semibold text-white">
                      {s.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                      {s.text}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section id="contact" className="pb-24">
          <div className="container-x">
            <Reveal>
              <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-ink-850 p-10 text-center sm:p-16">
                <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-accent-violet/25 blur-[100px]" />
                <h2 className="relative font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Готовы увидеть SPECTO в деле?
                </h2>
                <p className="relative mx-auto mt-4 max-w-xl text-lg text-zinc-400">
                  Настроим на ваших реальных заявках и покажем результат за 14 дней.
                </p>
                <div className="relative mt-8 flex justify-center">
                  <Link href="mailto:hello@specto.app" className="btn-primary">
                    Запросить демо
                    <Icon name="arrow" className="h-4 w-4" />
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
