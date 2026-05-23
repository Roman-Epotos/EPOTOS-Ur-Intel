# CONTEXT.md — Эпотос-ЮрИнтел / Витрина Данных
Документ передачи контекста для нового чата
Дата: 2026-05-23 (обновлён — новая архитектура ролей)
Статус: Спринт 3 в работе

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
F:\ИСКУССТВЕННЫЙ ИНТЕЛЛЕКТ (AI)\ЭПОТОС-ВИТРИНА ДАННЫХ\ДОГОВОРЫ ЭПОТОС\EPOTOS-Ur-Intel


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
YANDEX_DISK_TOKEN=<OAuth токен Яндекс.Диска>
DADATA_API_KEY=<API ключ dadata.ru>

ВАЖНО: BITRIX_WEBHOOK_URL — вебхук от "ЭПОТОС Ассистент" (ID: 678)
ВАЖНО: Environment Variables в Vercel — в левом меню (не в Settings!)
ВАЖНО: В Битрикс24 имя = "Фамилия Имя" → приветствие: split(' ')[1]


=============================================================
5. СТРУКТУРА БАЗЫ ДАННЫХ
=============================================================
ВАЖНО: Supabase требует GRANT для новых таблиц:
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO anon;
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO authenticated;
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO service_role;

Таблицы: contracts (+ counterparty_id UUID),
versions, approval_sessions (+ bitrix_chat_id INTEGER),
approval_participants, approval_messages, approval_settings,
contract_logs, document_attachments, signed_documents,
document_templates, ai_analysis,
company_requisites (+ short_name + signatory_name + poa_number + poa_date + poa_expires),
contract_checklist (+ bitrix_task_id TEXT),
contract_checklist_archive,
counterparties (+ signatory_name + poa_number + poa_date + poa_expires),
system_roles (НОВАЯ — для ролей ГК, см. ниже)

Таблица system_roles (НУЖНО СОЗДАТЬ):
  id, bitrix_user_id INTEGER, user_name TEXT,
  role TEXT CHECK ('developer','admin','gc_manager','finance_gc','legal_gc'),
  created_by INTEGER, created_at TIMESTAMPTZ

ВАЖНО: approval_participants CHECK:
CHECK (status IN ('pending','approved','rejected','acknowledged',
                  'disabled','completed_by_initiator'))


=============================================================
6. НУМЕРАЦИЯ, ТИПЫ, СТАТУСЫ
=============================================================
Нумерация: ПРЕФИКС-ТИПКОД-ГОД/МЕСЯЦ/НН
Типы: АКТИВНЫЕ — Договоры (9) + Соглашения (4). Остальные скрыты.
Статусы:
  черновик → на_согласовании → согласован → загружен_частично → подписан → на_исполнении
                             ↘ отклонён


=============================================================
7. НОВАЯ АРХИТЕКТУРА РОЛЕЙ (23.05.2026)
=============================================================
ВАЖНО: Единственная жёсткая роль в коде — Разработчик (ID 30).
       ВСЕ остальные роли назначаются динамически из БД!

ИЕРАРХИЯ РОЛЕЙ (от высшей к низшей):
  1. developer    — Разработчик (ID 30, жёстко в коде)
  2. admin        — Администратор (из system_roles)
  3. gc_manager   — Менеджер ГК (из system_roles)
  4. finance_gc   — Финансист ГК (из system_roles)
  5. legal_gc     — Юрист ГК (из system_roles)
  6. director     — ГД компании (из approval_settings, stage=director)
  7. legal        — Юрист компании (из approval_settings, stage=legal)
  8. finance      — Финансист компании (из approval_settings, stage=finance/accounting)
  9. user         — Обычный пользователь

ПРАВИЛА:
  - Пользователь может иметь несколько ролей → применяется НАИВЫСШАЯ
  - Пример: Чащина Елена — gc_manager И director → получает gc_manager
  - Роли ГК (1-5) → доступ ко всем компаниям
  - Роли компаний (6-8) → доступ только к своим компаниям

КТО НАЗНАЧАЕТ РОЛИ:
  - developer → может назначать всех включая admin
  - admin → может назначать gc_manager, finance_gc, legal_gc
  - Роли компаний (director, legal, finance) — берутся из approval_settings автоматически

ТАБЛИЦА system_roles — хранит роли ГК:
  developer, admin, gc_manager, finance_gc, legal_gc

НАЧАЛЬНОЕ СОСТОЯНИЕ (после создания таблицы):
  ID 30 (Пирог Роман) → developer (жёстко в коде, не в БД)
  ID 1 (Чащина Елена) → gc_manager
  ID 246 (Ершова Евгения) → legal_gc (была gc_manager — юрист ГК)
  ID 504 (Кочкин Сергей) → legal_gc (был gc_manager — юрист ГК)
  ID 10 (Демин Александр) → finance_gc
  ID 154 (Архипова Ольга) → finance_gc
  ID 1148 → admin

ЭПОТОС Ассистент: ID 678 — технический аккаунт, не имеет роли


=============================================================
8. ЧТО НУЖНО РЕАЛИЗОВАТЬ ДЛЯ НОВОЙ АРХИТЕКТУРЫ РОЛЕЙ
=============================================================
⬜ 1. Создать таблицу system_roles в Supabase
⬜ 2. Заполнить начальными данными (см. выше)
⬜ 3. Обновить user-role/route.ts — убрать хардкод, читать из system_roles
⬜ 4. Добавить вкладку «Роли ГК» в панель Настроек (после «Реквизиты компаний»)
      - Список текущих ролей ГК
      - Форма добавления: ФИО + Битрикс ID + роль
      - developer видит все роли и может управлять всеми
      - admin видит и управляет gc_manager, finance_gc, legal_gc
⬜ 5. Добавить фильтр по компании в дашборды (выпадающий список)
⬜ 6. Обновить доступ к дашбордам согласно новой иерархии


=============================================================
9. РЕАЛИЗОВАННЫЙ ФУНКЦИОНАЛ (23.05.2026)
=============================================================
✅ Документы, согласование, OnlyOffice, AI анализ, реквизиты
✅ Контроль исполнения + задачи Битрикс24
✅ Уведомления Б24 (колокольчик + групповой чат)
✅ Автобэкап на Яндекс.Диск + крон дедлайнов

✅ СПРИНТ 3 — В РАБОТЕ:
  ✅ Рабочий стол /dashboard (Personal Feed)
  ✅ Реестр контрагентов + DaData
  ✅ Поля доверенности в реквизитах компаний и контрагентов
  ✅ Юридический дашборд /dashboard-legal
  ✅ Финансовый дашборд /dashboard-finance
  ✅ Новые роли финансистов (finance_gc, finance) — временно в коде
  ✅ Динамический доступ к блоку «Аналитика» на рабочем столе
  ✅ Валидация добавления согласующих (обязательный выбор компании)
  ✅ Защита от дублей в согласующих

  🔄 В РАБОТЕ:
  ⬜ Таблица system_roles + вкладка «Роли ГК» в Настройках
  ⬜ Обновление user-role/route.ts на динамические роли
  ⬜ Фильтр по компании в дашбордах
  ⬜ Модуль создания документов из шаблонов


=============================================================
10. ГДЕ ОСТАНОВИЛИСЬ (23.05.2026)
=============================================================
Согласована новая архитектура ролей ✅

Первое что делаем в следующей сессии:
  1. Создать таблицу system_roles в Supabase
  2. Обновить user-role/route.ts
  3. Добавить вкладку «Роли ГК» в Настройки


=============================================================
11. ПРАВИЛА РАБОТЫ В ЧАТЕ
=============================================================
1. Создание файлов/папок — ТОЛЬКО через терминал:
   New-Item -Path "путь\к\файлу" -ItemType File -Force

2. Редактирование файлов — ТОЛЬКО вручную через VS Code (Ctrl+H для замены)
   НЕЛЬЗЯ редактировать через PowerShell — портит кодировку!

3. Step-by-step — не более 3 блоков кода в одном ответе с пояснениями

4. Перед деплоем — ВСЕГДА запускать npm run build локально

5. Если фрагмент для Ctrl+H не найден — обновить repomix

6. Код предлагается ОДИН РАЗ и только правильный вариант
   НЕЛЬЗЯ: предложить код → попросить заменить → сказать "нет, это неправильно"

7. PowerShell только для:
   - New-Item (создание файлов)
   - git команды
   - npm команды
   НЕ для редактирования .ts/.tsx файлов!

8. notify.ts — только через VS Code (Ctrl+A, удалить, вставить)

9. AIAnalysis.tsx — чек-лист убран! Только в ExecutionControl.tsx

10. task.checklistitem.add (НЕ tasks.task.!) — TASKID заглавными

11. sendBitrixMessage УБРАНА из роутов — только колокольчик + чат


=============================================================
12. ПОЛНЫЙ ПЛАН РАЗРАБОТКИ
=============================================================

✅ СПРИНТ 1, 2 — ЗАВЕРШЕНЫ
🔄 СПРИНТ 3 (май-июнь 2026):
  ✅ Рабочий стол, реестр контрагентов, дашборды
  ⬜ Новая архитектура ролей (system_roles)
  ⬜ Фильтр по компании в дашбордах
  ⬜ Модуль создания документов из шаблонов

🔴 СПРИНТ 4 (июль 2026):
  - PWA (вместо просто мобильной адаптации)
  - Плагин ЭПОТОС AI для OnlyOffice
  - Умные зависимости в чек-листе
  - AI-Audit логирование промптов

🔴 ФИНАЛ: фикс ссылки из уведомления, Realtime статусов


=============================================================
13. СТРАТЕГИЧЕСКИЕ ПРИОРИТЕТЫ
=============================================================
- Event Bus в Core
- Контрагент как central entity + AI-score риска
- CoreB24Adapter (прототип: app/lib/bitrix/tasks.ts)
- core_activity_feed — единая лента событий
- AI Digest на рабочем столе
- CEO Dashboard с предиктивной аналитикой
- PWA — Спринт 4
- AI-Audit — Спринт 4
- ИНН+КПП составной ключ — ЭПОТОС-Core


=============================================================
14. КЛЮЧЕВЫЕ АРХИТЕКТУРНЫЕ РЕШЕНИЯ
=============================================================
Уведомления (app/lib/notify.ts):
  sendBitrixNotify — колокольчик (im.notify.system.add)
  createBitrixChat — создать чат (im.chat.add)
  addUserToBitrixChat — добавить в чат (im.chat.user.add)
  sendBitrixChatMessage — сообщение в чат (DIALOG_ID=chat{id})

Крон-задачи (vercel.json):
  /api/backup — 0 14 * * * (17:00 МСК)
  /api/cron-checklist-deadline — 0 6 * * * (09:00 МСК)

Задачи Битрикс24:
  tasks.task.add + task.checklistitem.add (TASKID заглавными!)

Контрагенты:
  DaData: POST .../findById/party, Authorization: Token {DADATA_API_KEY}

Роли (НОВАЯ СХЕМА):
  developer (ID 30) → жёстко в коде
  admin, gc_manager, finance_gc, legal_gc → таблица system_roles
  director, legal, finance → approval_settings (динамически)
  Применяется НАИВЫСШАЯ роль из всех найденных

Согласование:
  Дедупликация по bitrix_user_id в approvals/route.ts
  Фильтр вложений: category !== 'attachment'
  Запрет загрузки при: согласован/загружен_частично/подписан/на_исполнении

Дашборды:
  /dashboard-legal — юридический
  /dashboard-finance — финансовый
  Доступ: все роли кроме user; ГК роли → все компании; остальные → свои

Реквизиты: id исключается из тела запроса при UPDATE
OnlyOffice: прокси /api/onlyoffice/file/route.ts
Supabase в компонентах: supabaseClient с PUBLISHABLE_KEY
Транслитерация: все файлы + №→N
Печать: utils/chatPrint.ts → buildChatHtml() (.ts не .tsx)
