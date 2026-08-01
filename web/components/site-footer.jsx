import Link from "next/link";
import { Logo } from "./icons";

export default function SiteFooter() {
  return (
    <footer className="relative mt-24 border-t border-white/[0.06]">
      <div className="container-x py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2.5">
              <Logo className="h-8 w-8" />
              <span className="font-display text-lg font-bold tracking-tight text-white">
                SPECTO
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-zinc-500">
              ИИ-менеджер продаж в WhatsApp. Отвечает, квалифицирует и догоняет
              лидов — чтобы вы не теряли ни одного горячего клиента.
            </p>
          </div>

          <FooterCol
            title="Продукт"
            items={[
              { label: "Возможности", href: "/product" },
              { label: "Как работает", href: "/#how" },
              { label: "Тарифы", href: "/#pricing" },
            ]}
          />
          <FooterCol
            title="Компания"
            items={[
              { label: "О нас", href: "/#contact" },
              { label: "Контакты", href: "/#contact" },
              { label: "Демо", href: "/#contact" },
            ]}
          />
          <FooterCol
            title="Правовое"
            items={[
              { label: "Политика конфиденциальности", href: "#" },
              { label: "Условия использования", href: "#" },
            ]}
          />
        </div>

        <div className="mt-12 hairline" />
        <div className="mt-6 flex flex-col items-start justify-between gap-3 text-sm text-zinc-500 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} SPECTO. Все права защищены.</p>
          <p className="font-mono text-xs text-zinc-600">
            Работает на Claude · WhatsApp Cloud API
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, items }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-white">{title}</h4>
      <ul className="mt-4 space-y-3">
        {items.map((it) => (
          <li key={it.label}>
            <Link
              href={it.href}
              className="text-sm text-zinc-500 transition-colors hover:text-zinc-200"
            >
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
