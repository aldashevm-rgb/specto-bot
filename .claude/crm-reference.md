# CRM Specto — справочник для навыков

Общий контекст для всех навыков `crm-*`. Эти навыки работают с базой
**Supabase «CRM Specto»** через MCP-инструменты Supabase
(`mcp__Supabase__execute_sql`, `mcp__Supabase__apply_migration`).

- **project_id (Supabase):** `lxmhjqnxzocehjrqurfq`
- Всегда передавай этот `project_id` в вызовы Supabase MCP.

## Мультитенантность

База общая для нескольких компаний. У каждого лида есть:
- `organization_id` (bigint, **обязателен**) — компания-владелец;
- `project_id` (text) — воронка внутри компании.

**Организации и их воронки (project_id):**

| organization_id | Компания | project_id |
|---|---|---|
| 1 | Steel Groups | `stalfed` (основная), `specto` |
| 3 | ТОО Мухамедьярова | `too-muhamedyarova_67e4t` |
| 4 | Мурат | `murat_kl7d5` |
| 5 | WST Group | `wst-group_ko55i` |
| 6 | ТОО Асель | `too-asel_xuxjd` |

Если пользователь не указал компанию/воронку явно — **уточни**, прежде чем
писать. Не подставляй организацию наугад. При неоднозначности можно
свериться: `select distinct organization_id, project_id from leads;`.

## Стадии воронки

Стадии лежат в таблице `stages` и зависят от `project_id`. Типовой набор
(`*_new` Новые → `*_working`/`*_work` В работе → `*_invoice` Счёт →
`*_contract` Договор → `*_paid` Оплата → `*_lost` Отказ). У `stalfed` свой
расширенный набор. Узнавать актуальные стадии воронки:

```sql
select id, name, position from stages where project_id = :project order by position;
```

Поле лида со стадией — `leads.stage_id` (text, default `'new'`).

## Ключевые таблицы и поля

**leads** (заявки/лиды):
- `id` uuid (auto), `organization_id` bigint **(обязателен)**, `project_id` text
- `name` text **(обязателен)**, `phone`, `company`, `email`, `city`, `source`
- `stage_id` text (default `'new'`), `is_hot` bool, `score` text
- `amount` bigint, `note`, `comment`, `pinned_note`, `assignee`, `manager_id` uuid
- `needs_callback` bool, `won_at` timestamptz, `created_at`

**lead_activities** (история действий по лиду — заметки, звонки):
- `lead_id` uuid **(обязателен)**, `type` text **(обязателен)** (`note`/`call`/...)
- `content` text, `author` text, `result`, `duration_sec`, `created_at`

**clients** (клиенты на сопровождении):
- `company` text **(обязателен)**, `niche`, `contact_name`, `phone`,
  `manager_id` uuid, `status` (default `'active'`), `contract_date`

**deals** (сделки):
- `client_id` uuid, `lead_id` uuid, `value` numeric, `stage` (default `'new'`),
  `manager_id` uuid

**tasks** (задачи/напоминания):
- `title` text **(обязателен)**, `description`, `status` (default `'new'`),
  `priority` (default `'medium'`), `assignee`, `lead_id` uuid, `project_id`,
  `deadline` timestamptz, `reminder_at` timestamptz

## Правила безопасности (обязательны для всех write-навыков)

1. Это **боевая база**. Перед любым INSERT/UPDATE покажи пользователю
   превью (что и куда запишешь) и **дождись подтверждения**.
2. У UPDATE/DELETE всегда есть `where` по конкретному `id`. Никогда не
   выполняй UPDATE/DELETE без точного условия.
3. Всегда указывай `organization_id` (и `project_id`, где он есть).
4. Не трогай строки за пределами организации, о которой просили.
5. Телефоны сравнивай гибко (по последним 10 цифрам), т.к. форматы разные.
6. После записи покажи краткий результат (id и ключевые поля).
