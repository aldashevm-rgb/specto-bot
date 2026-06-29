---
name: crm-add-task
description: Создать задачу или напоминание (follow-up) в CRM Specto, при необходимости привязав к лиду. Используй, когда просят поставить задачу, напоминание, перезвонить клиенту к дате.
---

# Создать задачу/напоминание

Сначала прочитай `.claude/crm-reference.md` (схема, правила).

## Шаги

1. Возьми из запроса **заголовок** (`title`, обязателен), при наличии —
   описание, срок (`deadline`), напоминание (`reminder_at`), исполнителя
   (`assignee`), приоритет (`priority`: low/medium/high).
2. Если задача про конкретного клиента — найди лид и возьми его `id`
   (`lead_id`) и `project_id`.
3. Распарси относительные сроки («завтра в 15:00», «через 3 дня») в
   конкретный timestamptz. Сегодняшнюю дату бери из контекста сессии.
4. Покажи превью (заголовок, срок, исполнитель, к какому лиду) и **жди
   подтверждения**.
5. Вставь:
   ```sql
   insert into tasks (title, description, priority, assignee, lead_id, project_id, deadline, reminder_at)
   values (:title, :desc, :priority, :assignee, :lead_id, :project, :deadline, :reminder)
   returning id, title, deadline;
   ```
6. Сообщи результат: id и срок.
