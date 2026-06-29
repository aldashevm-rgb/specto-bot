---
name: crm-add-lead
description: Добавить новый лид (заявку) в CRM Specto. Используй, когда просят завести/создать лида или заявку, записать нового клиента/контакт в воронку.
---

# Добавить лид в CRM Specto

Сначала прочитай `.claude/crm-reference.md` — там project_id Supabase,
организации, воронки, стадии и правила безопасности.

## Шаги

1. Собери данные лида из запроса пользователя. Минимум — **имя** (`name`).
   Полезно: `phone`, `company`, `email`, `city`, `source`, `note`.
2. Определи **организацию** и **воронку** (`organization_id`, `project_id`):
   - если пользователь назвал компанию — сопоставь по таблице из справочника;
   - если не указал — **спроси**, в какую компанию/воронку добавить.
3. Стадия по умолчанию — первая в воронке (`*_new`). Если её нет в `stages`,
   используй `'new'`.
4. Проверь на дубликат по телефону (последние 10 цифр):
   ```sql
   select id, name, phone, stage_id from leads
   where organization_id = :org and right(regexp_replace(phone,'\D','','g'),10) = :tail;
   ```
   Если дубль найден — сообщи и спроси, добавлять ли всё равно.
5. Покажи превью (имя, телефон, компания, организация, воронка, стадия) и
   **дождись подтверждения**.
6. Вставь:
   ```sql
   insert into leads (organization_id, project_id, name, phone, company, email, city, source, stage_id, note)
   values (:org, :project, :name, :phone, :company, :email, :city, :source, :stage, :note)
   returning id, name, stage_id;
   ```
7. Сообщи результат: id и в какую воронку/стадию попал лид.
