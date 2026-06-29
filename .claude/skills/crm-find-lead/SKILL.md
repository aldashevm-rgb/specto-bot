---
name: crm-find-lead
description: Найти лида/клиента в CRM Specto по имени, телефону или компании. Используй, когда просят найти, посмотреть или проверить лида/заявку/контакт.
---

# Найти лид в CRM Specto

Сначала прочитай `.claude/crm-reference.md` (project_id, организации, схема).

## Шаги

1. Возьми из запроса критерий поиска: имя, телефон, компания или город.
2. Если пользователь назвал компанию-владельца — ограничь по
   `organization_id`. Если нет — ищи по всем и покажи столбец организации.
3. Поиск гибкий (регистронезависимо, телефон — по последним цифрам):
   ```sql
   select l.id, l.name, l.phone, l.company, l.city, l.stage_id, l.is_hot,
          l.created_at, o.name as org
   from leads l left join organizations o on o.id = l.organization_id
   where (:q is null
          or l.name ilike '%'||:q||'%'
          or l.company ilike '%'||:q||'%'
          or right(regexp_replace(coalesce(l.phone,''),'\D','','g'),10)
             = right(regexp_replace(:q,'\D','','g'),10))
   order by l.created_at desc
   limit 20;
   ```
4. Выведи результат компактной таблицей: имя, телефон, компания, стадия,
   «горячий», дата, организация. Если нашлось >20 — скажи, что показаны
   последние 20, и предложи уточнить.
5. Если по лиду нужны детали — предложи показать историю
   (`lead_activities` и `lead_messages` по `lead_id`).
