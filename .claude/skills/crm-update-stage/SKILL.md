---
name: crm-update-stage
description: Передвинуть лид по воронке CRM Specto (сменить стадию) или отметить горячим/выигранным. Используй, когда просят перевести лида на этап, изменить статус сделки, отметить оплату/отказ.
---

# Сменить стадию лида в CRM Specto

Сначала прочитай `.claude/crm-reference.md` (стадии, схема, правила).

## Шаги

1. Найди нужный лид (по имени/телефону, см. навык crm-find-lead). Если
   совпадений несколько — покажи список и попроси выбрать конкретный `id`.
2. Определи `project_id` лида и подтяни доступные стадии:
   ```sql
   select id, name, position from stages where project_id = :project order by position;
   ```
3. Сопоставь желаемую стадию (пользователь говорит «в работу», «счёт»,
   «оплата», «отказ») с `stages.id`. Если не уверен — покажи список и спроси.
4. Покажи превью: «лид X — со стадии A на стадию B» и **жди подтверждения**.
5. Обнови строго по id:
   ```sql
   update leads set stage_id = :stage_id
   where id = :lead_id and organization_id = :org
   returning id, name, stage_id;
   ```
6. Доп. флаги по запросу:
   - «горячий»: `is_hot = true`;
   - «выигран/оплата»: дополнительно `won_at = now()`.
7. Залогируй смену стадии в историю:
   ```sql
   insert into lead_activities (lead_id, type, content, author)
   values (:lead_id, 'stage', 'Стадия → '||:stage_name, 'CRM-навык');
   ```
8. Сообщи итог.
