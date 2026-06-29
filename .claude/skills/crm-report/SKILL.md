---
name: crm-report
description: Сводка по воронке CRM Specto — новые лиды за период, разбивка по стадиям, горячие лиды, выигранные сделки. Используй, когда просят отчёт, статистику, сводку, «сколько лидов», «что по воронке».
---

# Отчёт по воронке CRM Specto

Сначала прочитай `.claude/crm-reference.md` (организации, воронки, схема).

## Шаги

1. Уточни период (по умолчанию — последние 7 дней) и организацию/воронку.
   Если организация не названа — сделай разбивку по всем или спроси.
2. Сегодняшнюю дату бери из контекста сессии; считай окно как
   `created_at >= now() - interval '7 days'` (или по запросу).

### Полезные запросы

Новые лиды за период по организациям:
```sql
select o.name as org, count(*) as leads
from leads l join organizations o on o.id = l.organization_id
where l.created_at >= now() - interval '7 days'
group by o.name order by leads desc;
```

Разбивка по стадиям (для конкретной воронки):
```sql
select s.name as stage, count(*) as leads
from leads l join stages s on s.id = l.stage_id
where l.project_id = :project
group by s.name, s.position order by s.position;
```

Горячие лиды без движения:
```sql
select name, phone, company, stage_id, created_at
from leads where organization_id = :org and is_hot = true
order by created_at desc limit 50;
```

Выигранные за период и сумма:
```sql
select count(*) as won, coalesce(sum(amount),0) as total
from leads
where organization_id = :org and won_at >= now() - interval '30 days';
```

3. Сведи результат в короткую сводку: всего новых, по стадиям, горячих,
   выиграно и на сумму. Подсвечивай узкие места (где скопились лиды).
