-- Таблица лога найденных вилок (arb-core). Применить в Supabase (SQL editor).
-- Хранит саму вилку и ИИ-разбор — чтобы позже сверять прогноз с результатом.

create table if not exists arb_surebets (
  id                bigint generated always as identity primary key,
  event_id          text        not null,
  sport             text,
  market            text        not null default 'h2h',
  line              text,                          -- null для h2h, "Тотал 2.5" и т.п.
  home              text,
  away              text,
  commence          timestamptz,

  margin_pct        numeric,                       -- гарантированная маржа вилки, %
  roi_pct           numeric,
  invested          numeric,
  guaranteed_payout numeric,
  profit            numeric,
  legs              jsonb,                         -- раскладка ставок по исходам

  ai_needs_win      text,                          -- home | away | both | neither
  ai_likely         text,                          -- home | draw | away
  ai_confidence     int,
  ai_probs          jsonb,                         -- { home, draw, away } доли
  ai_reasoning      text,

  found_at          timestamptz not null default now(),

  -- Одна запись на (событие, рынок, линию): повторный скан обновляет её.
  unique (event_id, market, line)
);

create index if not exists arb_surebets_found_at_idx on arb_surebets (found_at desc);
create index if not exists arb_surebets_margin_idx    on arb_surebets (margin_pct desc);
