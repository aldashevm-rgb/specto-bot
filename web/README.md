# SPECTO — сайт

Маркетинговый сайт SPECTO: ИИ-менеджер продаж в WhatsApp.

Собран на **Next.js 14 (App Router)** + **Tailwind CSS**. Тёмный tech-дизайн
(в духе Linear/Vercel): свечения, стекло, grain, крупная типографика,
анимации появления на скролле.

## Страницы

- `/` — лендинг (hero, возможности, как работает, метрики, тарифы, отзыв, CTA)
- `/product` — детальный разбор возможностей + безопасность

## Локальный запуск

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

## Сборка

```bash
npm run build
npm start
```

## Деплой на Vercel

Сайт лежит в подпапке `web/` внутри репозитория `specto-bot`. При импорте
проекта в Vercel укажите:

- **Root Directory:** `web`
- **Framework Preset:** Next.js (определится автоматически)

Больше ничего настраивать не нужно — переменные окружения сайту не требуются.

## Структура

```
web/
  app/
    layout.jsx        шрифты, метаданные, глобальные стили
    globals.css       дизайн-токены, эффекты (grain, glow, reveal)
    page.jsx          главная страница
    product/page.jsx  страница «Возможности»
    icon.svg          фавикон
  components/
    site-nav.jsx      шапка (sticky, blur)
    site-footer.jsx   подвал
    chat-mock.jsx     макет переписки WhatsApp для hero
    reveal.jsx        появление на скролле (IntersectionObserver)
    icons.jsx         логотип и набор иконок
  tailwind.config.js  палитра, шрифты, анимации
```

## Дизайн-токены

- Фон: `#0A0A0B` (ink-900)
- Акцент-градиент: `#4F7CFF → #6D6BFF → #A855F7`
- Шрифты: Space Grotesk (заголовки), Inter (текст), JetBrains Mono (акценты)
