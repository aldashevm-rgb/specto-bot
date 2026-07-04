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

  -- Ансамблевый прогноз (консенсус рынка + Пуассон + LLM).
  pred_probs        jsonb,                         -- { name: prob } финальные
  pred_sources      jsonb,                         -- какие источники участвовали
  pred_top_name     text,                          -- исход с максимальным value
  pred_top_edge     numeric,                       -- его перевес, %
  pred_agreement    numeric,                       -- согласие источников 0..1

  -- Результат и калибровка (заполняются грейдингом после матча).
  actual_outcome    text,                          -- home | draw | away
  brier             numeric,                       -- Brier score прогноза
  log_loss          numeric,
  graded_at         timestamptz,

  found_at          timestamptz not null default now(),

  -- Одна запись на (событие, рынок, линию): повторный скан обновляет её.
  unique (event_id, market, line)
);

create index if not exists arb_surebets_found_at_idx on arb_surebets (found_at desc);
create index if not exists arb_surebets_margin_idx    on arb_surebets (margin_pct desc);
