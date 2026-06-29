---
name: crm-add-note
description: Добавить заметку или зафиксировать звонок/действие по лиду в CRM Specto. Используй, когда просят записать комментарий, заметку, результат звонка или примечание по клиенту.
---

# Добавить заметку/действие по лиду

Сначала прочитай `.claude/crm-reference.md` (схема, правила).

## Шаги

1. Найди лид (по имени/телефону, см. crm-find-lead). Уточни `id`, если
   совпадений несколько.
2. Определи тип записи (`type`): `note` (заметка по умолчанию), `call`
   (звонок), `meeting`, `task` и т.п.
3. Для звонка можно указать `result` (итог) и `duration_sec` (длительность).
4. Покажи превью и **жди подтверждения**.
5. Вставь действие:
   ```sql
   insert into lead_activities (lead_id, type, content, author, result, duration_sec)
   values (:lead_id, :type, :content, :author, :result, :duration)
   returning id, created_at;
   ```
   `author` — имя сотрудника из запроса, иначе `'CRM-навык'`.
6. Если заметку нужно «закрепить» в карточке — продублируй в
   `leads.pinned_note`:
   ```sql
   update leads set pinned_note = :content where id = :lead_id;
   ```
7. Сообщи результат.
