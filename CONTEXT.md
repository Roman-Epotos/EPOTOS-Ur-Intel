# CONTEXT.md — Эпотос-ЮрИнтел / Витрина Данных
Документ передачи контекста для нового чата
Дата: 2026-05-21 (обновлён — Спринт 3 в работе)
Статус: Спринт 3 — реализован реестр контрагентов

=============================================================
1. О ПРОЕКТЕ
=============================================================
Название: Эпотос-ЮрИнтел (первый модуль платформы ЭПОТОС-Витрина Данных)
Компания: ГК ЭПОТОС (epotos.ru) — производство противопожарного оборудования

Дочерние компании:
- ООО Техно — ТХ, ООО НПП ЭПОТОС — НПП, ООО СПТ — СПТ
- ООО ОС — ОС, ООО Эпотос-К — Э-К

URL: https://epotos-ur-intel.vercel.app
GitHub: https://github.com/Roman-Epotos/EPOTOS-Ur-Intel
Битрикс24: https://gkepotos.bitrix24.ru/marketplace/app/248/ (app ID: 248)

ВАЖНО: Система — iframe-приложение в Битрикс24. Авторизация через Битрикс24 SSO.


=============================================================
2. ТЕХНОЛОГИЧЕСКИЙ СТЕК
=============================================================
- Next.js 14 (App Router), TypeScript, Tailwind CSS
- Supabase (cloud) + pgvector
- AI: OpenRouter (google/gemini-2.0-flash-001)
- Авторизация: Битрикс24 SSO
- Редактор: OnlyOffice (Docker, Selectel, https://office.epotos-port.ru)
- Storage: Supabase (bucket: contracts, templates)
- Хостинг: Vercel


=============================================================
3. ПУТЬ К ПРОЕКТУ
=============================================================
E:\ИСКУССТВЕННЫЙ ИНТЕЛЛЕКТ (AI)\ЭПОТОС-ВИТРИНА ДАННЫХ\ДОГОВОРЫ ЭПОТОС\EPOTOS-Ur-Intel


=============================================================
4. ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ
=============================================================
NEXT_PUBLIC_SUPABASE_URL=https://qmzyybisajjmneydekoo.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<см. .env.local>
SUPABASE_SECRET_KEY=<см. .env.local>
OPENROUTER_API_KEY=<см. .env.local>
BITRIX_CLIENT_ID=<см. .env.local>
BITRIX_CLIENT_SECRET=<см. .env.local>
BITRIX_PORTAL=gkepotos.bitrix24.ru
BITRIX_WEBHOOK_URL=<вебхук ЭПОТОС Ассистента, ID пользователя 678>
ONLYOFFICE_URL=https://office.epotos-port.ru
ONLYOFFICE_JWT_SECRET=<см. .env.local>
YANDEX_DISK_TOKEN=<OAuth токен Яндекс.Диска, приложение "ЭПОТОС Бэкап">
DADATA_API_KEY=<API ключ dadata.ru для проверки контрагентов по ИНН>

ВАЖНО: BITRIX_WEBHOOK_URL — вебхук от аккаунта "ЭПОТОС Ассистент" (ID: 678)
ВАЖНО: Environment Variables в Vercel — в левом меню (не в Settings!)


=============================================================
5. СТРУКТУРА БАЗЫ ДАННЫХ
=============================================================
ВАЖНО: Supabase требует GRANT для новых таблиц:
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO anon;
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO authenticated;
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO service_role;

ВАЖНО: contracts CHECK constraint:
CHECK (status IN ('черновик','на_согласовании','согласован','отклонён',
                  'загружен_частично','подписан','на_исполнении','архив'))

ВАЖНО: approval_participants CHECK constraint:
CHECK (status IN ('pending','approved','rejected','acknowledged',
                  'disabled','completed_by_initiator'))

Таблицы: contracts (+ counterparty_id UUID → counterparties.id),
versions, approval_sessions (+ bitrix_chat_id INTEGER),
approval_participants, approval_messages, approval_settings, contract_logs,
document_attachments, signed_documents, document_templates, ai_analysis,
company_requisites (+ short_name),
contract_checklist (+ bitrix_task_id TEXT),
contract_checklist_archive,
counterparties (НОВАЯ — см. ниже)

Таблица counterparties:
  id, inn (UNIQUE), kpp, ogrn, full_name, short_name,
  legal_address, actual_address, director_name, director_title,
  phone, email, website,
  status CHECK ('активный','ликвидирован','в_реорганизации','приостановлен'),
  risk_level CHECK ('низкий','средний','высокий','не_определён'),
  ai_score JSONB, notes, created_at, updated_at

Storage: contracts (Public), templates (Public)


=============================================================
6. НУМЕРАЦИЯ, ТИПЫ, СТАТУСЫ
=============================================================
Нумерация: ПРЕФИКС-ТИПКОД-ГОД/МЕСЯЦ/НН
Типы: АКТИВНЫЕ — Договоры (9) + Соглашения (4). Остальные скрыты.
Статусы:
  черновик → на_согласовании → согласован → загружен_частично → подписан → на_исполнении
                             ↘ отклонён
  UI: подписан="Документы загружены", на_исполнении="На контроле исполнения"


=============================================================
7. РОЛИ
=============================================================
admin (30, 1148) — Пирог Роман (30)
gc_manager (1, 246, 504) — Чащина Елена (1), Ершова (246), Кочкин (504)
director: 592→НПП, 6→СПТ/ОС, 954→Э-К
SPECIAL_SIGNERS: 782 Владимиров→Э-К, 152 Виноградова→СПТ/ОС/НПП
ЭПОТОС Ассистент: ID 678 — технический аккаунт для всех системных сообщений


=============================================================
8. РЕАЛИЗОВАННЫЙ ФУНКЦИОНАЛ (21.05.2026)
=============================================================
✅ Документы: список, создание, версионирование, OnlyOffice, журнал аудита
✅ Нумерация: ПРЕФИКС-ТИПКОД-ГОД/МЕСЯЦ/НН
✅ Роли: admin, gc_manager, director, user
✅ Дополнительные материалы: загрузка, OnlyOffice, анализ в EpotosGPT
✅ Подписанные экземпляры: загрузка, подтверждение, статусы
✅ Согласование: сессии, участники, Realtime, автозавершение, чат с печатью
✅ Кнопка «Отклонить документ» (с модалом причины)
✅ AI (EpotosGPT): Legal Review, Паспорт, анализ вложений, чат
   ВАЖНО: чек-лист убран из AIAnalysis.tsx — только вкладка «Контроль исполнения»
✅ Реквизиты компаний: CRUD, short_name, предпросмотр/печать
✅ Контроль исполнения: AI чек-лист, архив/восстановление, редактирование, даты
✅ Переключатель реквизитов: полные / без банковских (подчёркивания)
   Вкладка Генерация закомментирована — новый модуль в Спринте 3

✅ СПРИНТ 2 — ПОЛНОСТЬЮ ЗАВЕРШЁН:
  - Уведомления Б24 (колокольчик + групповой чат)
  - Задачи из чек-листа в Битрикс24 (3 режима)
  - ЭПОТОС Ассистент (ID: 678) как технический аккаунт
  - Автобэкап БД на Яндекс.Диск (17:00 МСК)
  - Крон-задача дедлайна чек-листа (09:00 МСК)

✅ СПРИНТ 3 — В РАБОТЕ:
  ✅ Реестр контрагентов (21.05.2026):
    Страницы:
      app/counterparties/page.tsx — список реестра
      app/counterparties/[id]/page.tsx — профиль контрагента
    API роуты:
      app/api/counterparties/route.ts — CRUD (GET/POST/DELETE)
      app/api/counterparties/check-inn/route.ts — проверка по ИНН через DaData
    Навигация:
      Header.tsx — кнопка «🏢 Контрагенты» между «+ Новый документ» и «Настройки»
      Реестр — стрелка «← Главная»
      Профиль — стрелка «← Реестр»
    Функции:
      - Поиск по названию и ИНН
      - Добавление по ИНН через DaData API (автозаполнение всех реквизитов)
      - Редактирование профиля (реквизиты, риск, заметки)
      - Список договоров с контрагентом
      - Статус (активный/ликвидирован/в_реорганизации/приостановлен)
      - Уровень риска (низкий/средний/высокий/не_определён)
    DaData API: метод findById/party, возвращает полные реквизиты по ИНН
    ВАЖНО: contracts получила поле counterparty_id UUID → counterparties.id


=============================================================
9. ИЗВЕСТНЫЕ ПРОБЛЕМЫ / ТЕХНИЧЕСКИЙ ДОЛГ
=============================================================
⚠️ Ссылка из уведомления → главная (не конкретный документ) — финал
⚠️ Realtime статуса — требует репликации Supabase → ЭПОТОС-Core
⚠️ Таблица contracts не переименована в documents — долг
⚠️ proxy.ts (middleware) — до SSO отключён
⚠️ Уведомление в чат Б24 при загрузке подписанных документов — не реализовано
⚠️ console.log в bitrix-tasks/route.ts (debug) — убрать перед продакшном
⚠️ counterparty_id в contracts — пока не используется при создании документа


=============================================================
10. ГДЕ ОСТАНОВИЛИСЬ (21.05.2026)
=============================================================
✅ Реестр контрагентов — базовая версия РЕАЛИЗОВАНА

Следующие задачи Спринта 3:
  ⬜ Привязка контрагента при создании документа
     (выбор из реестра в форме создания договора)
  ⬜ 📊 Дашборды (юридический, финансовый, ГД, руководитель ГК)
  ⬜ 📝 Модуль создания документов из шаблонов


=============================================================
11. ПОЛНЫЙ ПЛАН РАЗРАБОТКИ ЮРИНТЕЛ
=============================================================

✅ СПРИНТ 1 (май 2026) — ЗАВЕРШЁН
✅ СПРИНТ 2 (май 2026) — ЗАВЕРШЁН
🔄 СПРИНТ 3 (май-июнь 2026) — В РАБОТЕ:
  ✅ Реестр контрагентов + DaData/ФНС
  ⬜ Привязка контрагента при создании документа
  ⬜ Дашборды (юридический, финансовый, ГД, руководитель ГК)
  ⬜ Модуль создания документов из шаблонов:
      • {{field}} теги в .docx
      • document_templates + contract_clauses
      • AI извлекает JSON, docxtemplater собирает .docx

🔴 СПРИНТ 4 (июль 2026):
  - 📱 Адаптация для мобильного Битрикс24
  - 🔌 Плагин ЭПОТОС AI для OnlyOffice
  - 🔗 Умные зависимости в чек-листе (A→B→C)
  - 🔍 Сравнение версий документов (AI)

🔴 ФИНАЛ: фикс ссылки из уведомления, Realtime статусов


=============================================================
12. СТРАТЕГИЧЕСКИЕ ПРИОРИТЕТЫ (архитектурное ревью)
=============================================================
- Event Bus в Core: contract.approved / checklist.deadline_expired / ...
- Контрагент как central entity (профиль + граф связей + AI-score риска)
- CoreB24Adapter — изоляция Битрикс24 за адаптером
- Universal Activity Feed — единая лента событий
- RAG метаданные: security_level, expires_at, linked_entities
- RBAC + Attribute Based Access (актуально в Спринте 4-5)


=============================================================
13. ПЛАН ПОСЛЕ ЮРИНТЕЛ
=============================================================
📋 ЭПОТОС-CORE (сентябрь 2026): CoreAIService, CoreB24Adapter, Event Bus
📋 МОДУЛЬ 2 — ЭПОТОС-ПЕРСОНАЛ (октябрь 2026)
📋 МОДУЛЬ 3 — ЭПОТОС-РЕКЛАМАЦИИ (декабрь 2026)
📋 МОДУЛЬ 4 — ЭПОТОС-КОММЕРЦИЯ (Q1 2027)
📋 ЦЕНТРАЛЬНЫЙ ДАШБОРД РУКОВОДИТЕЛЯ ГК


=============================================================
14. КАК ОБНОВЛЯТЬ КОД ДЛЯ CLAUDE
=============================================================
В начале каждой сессии:
  npx repomix --config repomix-api.config.json
  npx repomix --config repomix-components.config.json
  npx repomix --config repomix-pages.config.json

Загрузить в базу знаний: repomix-api.txt, repomix-components.txt,
                          repomix-pages.txt + CONTEXT.md

ВАЖНО: Ctrl+H в VS Code. Если фрагмент не найден — обновить repomix.
ВАЖНО: Claude создаёт CONTEXT.md как файл (не текст в чате).
ВАЖНО: Секретные ключи НЕ вставлять в CONTEXT.md
ВАЖНО: Environment Variables в Vercel — в левом меню (не в Settings!)
ВАЖНО: sendBitrixNotify() — прямой вызов Битрикс API, НЕ self-fetch
ВАЖНО: На Windows grep не работает — Select-String и Get-Content
ВАЖНО: PowerShell портит кодировку — редактировать только через VS Code
ВАЖНО: Перед деплоем всегда запускать npm run build локально!
ВАЖНО: task.checklistitem.add (НЕ tasks.task.!) — TASKID заглавными
ВАЖНО: Работаем step-by-step — не более 3 блоков за раз
ВАЖНО: notify.ts — только через VS Code (Ctrl+A, удалить, вставить)
ВАЖНО: AIAnalysis.tsx — чек-лист убран! Только в ExecutionControl.tsx
ВАЖНО: sendBitrixMessage УБРАНА из роутов — только колокольчик + чат!


=============================================================
15. КЛЮЧЕВЫЕ АРХИТЕКТУРНЫЕ РЕШЕНИЯ
=============================================================
Уведомления (app/lib/notify.ts):
  sendBitrixNotify — колокольчик (im.notify.system.add)
  sendBitrixMessage — личное сообщение (УБРАНА из роутов!)
  createBitrixChat — создать групповой чат (im.chat.add)
  addUserToBitrixChat — добавить в чат (im.chat.user.add)
  sendBitrixChatMessage — сообщение в чат (DIALOG_ID=chat{id})

Крон-задачи (vercel.json):
  /api/backup — 0 14 * * * (17:00 МСК) → Яндекс.Диск
  /api/cron-checklist-deadline — 0 6 * * * (09:00 МСК)

Задачи Битрикс24:
  tasks.task.add — создание задачи
  task.checklistitem.add — пункт чек-листа (TASKID заглавными!)
  Режим single_with_checklist — одна задача + все пункты как чек-лист

Контрагенты:
  DaData API: POST https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party
  Authorization: Token {DADATA_API_KEY}
  Возвращает: inn, kpp, ogrn, full_name, short_name, address, director, status

Реквизиты: SELECT→UPDATE/INSERT. id исключается из тела запроса.
Чек-лист: action='restore_archive', files[]: {file_url, file_name, source}
OnlyOffice: version_id / attachment_id, прокси /api/onlyoffice/file/route.ts
Realtime: ContractsList=INSERT, ContractTabs=UPDATE+INSERT (чат)
Supabase в компонентах: supabaseClient с PUBLISHABLE_KEY
Транслитерация: все файлы + №→N
Печать: utils/chatPrint.ts → buildChatHtml() (.ts не .tsx)
