# CONTEXT.md — Эпотос-ЮрИнтел / Витрина Данных
Документ передачи контекста для нового чата
Дата: 2026-05-24 (финальная версия сессии)
Статус: Спринт 3 — задеплоен, шаблоны готовы

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
- AI: OpenRouter (google/gemini-2.5-flash) ← обновлено 24.05.2026
- Авторизация: Битрикс24 SSO
- Редактор: OnlyOffice (Docker, Selectel, https://office.epotos-port.ru)
- Storage: Supabase (bucket: contracts, templates)
- Хостинг: Vercel


=============================================================
3. ПУТЬ К ПРОЕКТУ
=============================================================
F:\ИСКУССТВЕННЫЙ ИНТЕЛЛЕКТ (AI)\ЭПОТОС-ВИТРИНА ДАННЫХ\ДОГОВОРЫ ЭПОТОС\EPOTOS-Ur-Intel

Шаблоны договоров:
F:\ИСКУССТВЕННЫЙ ИНТЕЛЛЕКТ (AI)\ЭПОТОС-ВИТРИНА ДАННЫХ\ДОГОВОРЫ ЭПОТОС\шаблоны\templates_ready\


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

Таблицы:
  contracts (+ counterparty_id UUID → counterparties.id)
  versions
  approval_sessions (+ bitrix_chat_id INTEGER)
  approval_participants
  approval_messages
  approval_settings
  contract_logs
  document_attachments
  signed_documents
  document_templates
  ai_analysis
  company_requisites (+ short_name, signatory_name, poa_number, poa_date, poa_expires)
  contract_checklist (+ bitrix_task_id TEXT)
  contract_checklist_archive
  counterparties (+ signatory_name, poa_number, poa_date, poa_expires)
    УНИКАЛЬНЫЙ КЛЮЧ: (inn, kpp) — составной!
  system_roles

Таблица system_roles:
  id UUID PRIMARY KEY, bitrix_user_id INTEGER UNIQUE,
  user_name TEXT, role TEXT, created_by INTEGER, created_at TIMESTAMPTZ
  CHECK role IN ('admin','gc_manager','finance_gc','legal_gc')

Индексы созданы:
  idx_contracts_status_created, idx_contracts_number, idx_contracts_author
  idx_approval_participants_user_status, idx_approval_sessions_contract
  idx_checklist_contract, idx_checklist_due_date

ВАЖНО: approval_participants CHECK:
CHECK (status IN ('pending','approved','rejected','acknowledged',
                  'disabled','completed_by_initiator'))


=============================================================
6. НУМЕРАЦИЯ, ТИПЫ, СТАТУСЫ
=============================================================
Нумерация: ПРЕФИКС-ТИПКОД-ГОД/МЕСЯЦ/НН
  - Счётчик сбрасывается 1 января каждого года (начинается с 1)
  - Без ведущих нулей: ТХ-ДОГ-2026/05/1, ТХ-ДОГ-2027/01/1
  - Реализовано в app/api/contracts/route.ts (убран padStart)
Типы: АКТИВНЫЕ — Договоры (9) + Соглашения (4). Остальные скрыты.
Статусы:
  черновик → на_согласовании → согласован → загружен_частично → подписан → на_исполнении
                             ↘ отклонён
  UI: подписан="Документы загружены", на_исполнении="На контроле исполнения"


=============================================================
7. АРХИТЕКТУРА РОЛЕЙ (РЕАЛИЗОВАНА 23.05.2026)
=============================================================
ВАЖНО: Единственная жёсткая роль в коде — Разработчик (ID 30).
       ВСЕ остальные роли назначаются динамически из БД!

ИЕРАРХИЯ (от высшей к низшей):
  1. developer    — ID 30, жёстко в коде
  2. admin        — из system_roles
  3. gc_manager   — из system_roles
  4. finance_gc   — из system_roles
  5. legal_gc     — из system_roles
  6. director     — из approval_settings (stage=director)
  7. legal        — из approval_settings (stage=legal)
  8. finance      — из approval_settings (stage=finance/accounting)
  9. user         — все остальные

ПРАВИЛА:
  - Роли ГК (1-5) → доступ ко всем компаниям
  - Роли компаний (6-8) → одноранговые, дополняют друг друга
  - При наличии роли ГК — она выше любой роли из согласующих
  - all_roles: все роли пользователя для проверки доступа к дашбордам
  - Пример: Чащина Елена — gc_manager + director → применяется gc_manager

ТЕКУЩИЕ НАЗНАЧЕНИЯ system_roles:
  ID 1148 → admin
  ID 1 (Чащина Елена) → gc_manager
  ID 246 (Ершова Евгения) → legal_gc
  ID 504 (Кочкин Сергей) → legal_gc
  ID 10 (Демин Александр) → finance_gc
  ID 154 (Архипова Ольга) → finance_gc

КТО НАЗНАЧАЕТ РОЛИ:
  developer (ID 30) → все роли включая admin
  admin → gc_manager, finance_gc, legal_gc

API:
  app/api/user-role/route.ts → возвращает role, companies, all_roles
  app/api/system-roles/route.ts → CRUD для ролей ГК (GET/POST/DELETE)

НАСТРОЙКИ: вкладка «Роли ГК» в app/admin/page.tsx
  Доступ к Настройкам: developer + admin + gc_manager из system_roles

ЭПОТОС Ассистент: ID 678 — технический аккаунт, нет роли


=============================================================
8. РЕАЛИЗОВАННЫЙ ФУНКЦИОНАЛ
=============================================================
✅ Документы: список, создание, версионирование, OnlyOffice, журнал аудита
✅ Нумерация: ПРЕФИКС-ТИПКОД-ГОД/МЕСЯЦ/НН (сброс с 1 января, без ведущих нулей)
✅ Роли: динамические через system_roles + approval_settings
✅ Дополнительные материалы: загрузка, OnlyOffice, анализ в EpotosGPT
✅ Подписанные экземпляры: загрузка, подтверждение, статусы
✅ Согласование: сессии, участники, Realtime, автозавершение, чат с печатью
✅ Кнопка «Отклонить документ» (с модалом причины)
✅ AI (EpotosGPT): Legal Review, Паспорт, анализ вложений, чат
   ВАЖНО: чек-лист убран из AIAnalysis.tsx — только вкладка «Контроль исполнения»
✅ Реквизиты компаний: CRUD, short_name, доверенность (signatory_name, poa_*)
✅ Контроль исполнения: AI чек-лист, архив/восстановление, редактирование, даты
✅ Переключатель реквизитов: полные / без банковских (подчёркивания)
   Вкладка «Генерация» закомментирована — новый модуль в Спринте 3

✅ СПРИНТ 2 — ПОЛНОСТЬЮ ЗАВЕРШЁН:
  - Уведомления Б24 (колокольчик + групповой чат)
  - Задачи из чек-листа в Битрикс24 (3 режима)
  - ЭПОТОС Ассистент (ID: 678) как технический аккаунт
  - Автобэкап БД на Яндекс.Диск (17:00 МСК)
  - Крон-задача дедлайна чек-листа (09:00 МСК)

✅ СПРИНТ 3 — В РАБОТЕ (24.05.2026):

  ✅ Рабочий стол /dashboard:
    API: app/api/dashboard/route.ts
    Блоки: согласования, дедлайны, черновики, активные согласования,
           контрагенты с высоким риском, статистика, блок «Аналитика»
    Блок «Аналитика»: показывает только доступные дашборды
    Флаги: has_dashboard_access, legal_dashboard_access, finance_dashboard_access
    Проверка доступа напрямую из БД (не через fetch к user-role!)

  ✅ Юридический дашборд /dashboard-legal:
    API: app/api/dashboard-legal/route.ts
    Доступ через all_roles; ГК → все компании; остальные → свои
    Блоки: статусы, просроченные согласования, ожидают подписания,
           просроченные чек-листы, динамика (30д/квартал/полгода/год)
    Фильтр по компании: выпадающий список, динамически из company_requisites
    Возврат: «← Рабочий стол»

  ✅ Финансовый дашборд /dashboard-finance:
    API: app/api/dashboard-finance/route.ts
    Доступ через all_roles (важно для пользователей с несколькими ролями!)
    Блоки: суммы по статусам, дебиторка, топ контрагентов,
           договоры без суммы, динамика по компаниям
    Фильтр по компании: выпадающий список, динамически из company_requisites
    Возврат: «← Рабочий стол»

  ✅ Реестр контрагентов:
    Страницы: /counterparties, /counterparties/[id]
    API: /api/counterparties, /api/counterparties/check-inn
    DaData: findById/party, Authorization: Token {DADATA_API_KEY}
    Уникальный ключ: (inn, kpp) составной!
    Поля доверенности: signatory_name, poa_number, poa_date, poa_expires

  ✅ Привязка контрагента при создании документа
    counterparty_id сохраняется в contracts

  ✅ Динамические роли (23.05.2026):
    Таблица system_roles + вкладка «Роли ГК» в Настройках
    contracts-list/route.ts — все роли ГК видят все договоры
    Доступ к Настройкам через system_roles динамически

  ✅ Оптимизация БД (23.05.2026):
    7 индексов для дашбордов и согласования
    Составной ключ (inn, kpp) для контрагентов

  ✅ Исправления интерфейса (24.05.2026):
    roleLabels в ContractsList.tsx — все роли: developer, admin, gc_manager,
      finance_gc, legal_gc, director, legal, finance, user
    Нумерация — убран padStart(2,'0'), сброс с 1 января работает
    Фильтр по компании в дашбордах (finance + legal) — выпадающий список

  ✅ Подготовка шаблонов договоров ООО Техно (24.05.2026):
    10 шаблонов с метками {{field}} готовы к загрузке в систему
    Расположение: шаблоны\templates_ready\
    Метки нашей компании (авто из company_requisites):
      {{supplier_full_name}}, {{supplier_short_name}}
      {{supplier_director_title}}, {{supplier_director_name}}, {{supplier_director_short_name}}
      {{supplier_basis}}, {{supplier_ogrn}}, {{supplier_inn}}, {{supplier_kpp}}
      {{supplier_legal_address}}, {{supplier_phone}}, {{supplier_fax}}, {{supplier_email}}
      {{supplier_bank_name}}, {{supplier_bank_account}},
      {{supplier_bank_corr_account}}, {{supplier_bank_bik}}
    Метки документа (авто из карточки):
      {{contract_number}}, {{contract_date}}, {{contract_day}},
      {{contract_month}}, {{contract_year}}
    Метки контрагента (из реестра + ввод пользователя):
      {{counterparty_full_name}}, {{counterparty_short_name}},
      {{counterparty_signatory}}, {{counterparty_signatory_title}},
      {{counterparty_basis}}
    Бизнес-поля (ввод при генерации):
      {{min_monthly_purchase_num}}, {{min_monthly_purchase_text}}
      {{payment_days}}, {{contract_end_date}}, {{nda_penalty_num}},
      {{nda_penalty_text}}, {{territory}}, {{territory_country}},
      {{insurance_amount_num}}, {{insurance_amount_text}},
      {{transport_types}}, {{edo_operator}},
      {{referenced_contract_number}}, {{referenced_contract_date}}
    Спец. поля (Согласие ПД):
      {{subject_full_name}}, {{subject_birth_year}}, {{passport_series}},
      {{passport_number}}, {{passport_issued_by}}, {{passport_dept_code}},
      {{subject_address}}, {{subject_inn}}, {{subject_snils}},
      {{pd_consent_years}}
    Скрипты подготовки: шаблоны\prepare_templates.py, шаблоны\add_fields.py


=============================================================
9. ИЗВЕСТНЫЕ ПРОБЛЕМЫ / ТЕХНИЧЕСКИЙ ДОЛГ
=============================================================
⚠️ Ссылка из уведомления → главная (не конкретный документ) — финал
⚠️ Realtime статуса — требует репликации Supabase → ЭПОТОС-Core
⚠️ Таблица contracts не переименована в documents — долг
⚠️ Уведомление в чат Б24 при загрузке подписанных документов — не реализовано
⚠️ console.log в bitrix-tasks/route.ts — убрать перед продакшном
⚠️ Cascad запросов в user-role/route.ts → заменить на RPC get_user_context()
⚠️ AI модель в ai-analysis/route.ts — ещё указана gemini-2.0-flash-001, обновить на gemini-2.5-flash


=============================================================
10. ГДЕ ОСТАНОВИЛИСЬ (24.05.2026)
=============================================================
Сделано в эту сессию:
  ✅ roleLabels в ContractsList.tsx — все роли добавлены
  ✅ Нумерация — убран padStart, сброс с 1 января
  ✅ Фильтр по компании в дашбордах (finance + legal)
  ✅ Подготовка 10 шаблонов ООО Техно с метками {{field}}
     (скрипты: prepare_templates.py + add_fields.py)

Следующая задача Спринта 3:
  ⬜ Модуль создания документов из шаблонов (docxtemplater)
     - Вкладка «Генерация» в ContractTabs.tsx (раскомментировать + переработать)
     - API: app/api/generate-from-template/route.ts (новый)
     - Логика: выбор шаблона → форма полей → docxtemplater → скачать .docx
     - Поля: авто (из карточки + company_requisites + counterparties) + ручные
     - Доступ: все у кого есть доступ к документу
     - Шаблоны ООО Техно готовы, остальные компании — позже


=============================================================
11. ПОЛНЫЙ ПЛАН РАЗРАБОТКИ
=============================================================

✅ СПРИНТ 1, 2 — ЗАВЕРШЕНЫ
🔄 СПРИНТ 3 (май-июнь 2026):
  ✅ Рабочий стол, реестр контрагентов, дашборды
  ✅ Динамические роли через system_roles
  ✅ Оптимизация БД (индексы + ИНН+КПП)
  ✅ Фильтр по компании в дашбордах
  ✅ Обновить roleLabels
  ✅ Нумерация (сброс с 1 января, без padStart)
  ✅ Подготовка шаблонов договоров (10 шт., ООО Техно)
  ⬜ Модуль создания документов из шаблонов (docxtemplater)

🔴 СПРИНТ 4 (июль 2026):
  - PWA (вместо просто мобильной адаптации)
  - Плагин ЭПОТОС AI для OnlyOffice
  - Умные зависимости в чек-листе
  - AI-Audit логирование промптов
  - Шаблоны остальных компаний ГК (СПТ, НПП, ОС, Э-К)

🔴 ФИНАЛ: фикс ссылки из уведомления, Realtime статусов


=============================================================
12. СТРАТЕГИЧЕСКИЕ ПРИОРИТЕТЫ
=============================================================
- Event Bus в Core
- Контрагент как central entity + AI-score риска
- CoreB24Adapter → прототип: app/lib/bitrix/tasks.ts
- core_activity_feed — единая лента событий
- AI Digest на рабочем столе
- CEO Dashboard с предиктивной аналитикой
- PWA — Спринт 4
- AI-Audit — Спринт 4
- RPC get_user_context() → перед ЭПОТОС-Core
- Supabase RLS → после стабилизации архитектуры


=============================================================
13. ПРАВИЛА РАБОТЫ В ЧАТЕ
=============================================================
1. Создание файлов/папок — ТОЛЬКО через терминал:
   New-Item -Path "путь\к\файлу" -ItemType File -Force
   Затем открыть в VS Code и вставить код.

2. Редактирование файлов — ТОЛЬКО вручную через VS Code (Ctrl+H)
   НЕЛЬЗЯ редактировать через PowerShell — портит кодировку!

3. Step-by-step — не более 3 блоков кода в одном ответе.
   Каждый блок с пояснением что делаем и зачем.

4. Перед деплоем — ВСЕГДА запускать npm run build локально.

5. Если фрагмент для Ctrl+H не найден — сначала обновить repomix,
   затем искать точный фрагмент из базы знаний.

6. Код предлагается ОДИН РАЗ и только правильный вариант.
   НЕЛЬЗЯ: предложить код → попросить вставить → сказать "нет, неправильно".

7. PowerShell только для: New-Item, git команды, npm команды.
   НЕ для редактирования .ts/.tsx файлов!

8. notify.ts — только через VS Code (Ctrl+A, удалить, вставить).

9. AIAnalysis.tsx — чек-лист убран! Только в ExecutionControl.tsx.

10. task.checklistitem.add (НЕ tasks.task.!) — TASKID заглавными.

11. sendBitrixMessage УБРАНА из роутов — только колокольчик + чат.

12. При проблемах с кодировкой — всегда VS Code, не терминал.

13. Перед любой правкой файла — убедиться что repomix актуален.

14. Repomix — обновлять по необходимости, сколько угодно часто.
    CONTEXT.md — только по явному запросу (обычно перед завершением сессии).

15. Команды в PowerShell — давать построчно, в одном блоке.


=============================================================
14. КЛЮЧЕВЫЕ АРХИТЕКТУРНЫЕ РЕШЕНИЯ
=============================================================
Уведомления (app/lib/notify.ts):
  sendBitrixNotify — колокольчик (im.notify.system.add)
  createBitrixChat — создать чат (im.chat.add)
  addUserToBitrixChat — добавить в чат (im.chat.user.add)
  sendBitrixChatMessage — сообщение в чат (DIALOG_ID=chat{id})

Крон-задачи (vercel.json):
  /api/backup — 0 14 * * * (17:00 МСК) → Яндекс.Диск
  /api/cron-checklist-deadline — 0 6 * * * (09:00 МСК)

Задачи Битрикс24:
  tasks.task.add — создание задачи
  task.checklistitem.add — пункт чек-листа (TASKID заглавными!)
  3 режима: single / single_with_checklist / по выбранным пунктам

Роли:
  user-role/route.ts → role, companies, all_roles
  system-roles/route.ts → CRUD ролей ГК
  developer (ID 30) → жёстко в коде, только этот!
  Роли ГК → system_roles; Роли компаний → approval_settings
  Проверка доступа к дашбордам → all_roles (не только основная роль!)
  dashboard/route.ts → проверяет доступ напрямую из БД

Дашборды:
  /dashboard — рабочий стол (главная точка входа)
  /dashboard-legal — юридический (фильтр по компании ✅)
  /dashboard-finance — финансовый (фильтр по компании ✅)
  Возврат из дашбордов → «← Рабочий стол» (не главная!)
  Фильтр компании: selectedCompany state + company_requisites API
  Логика: GC роли — все компании; остальные — только свои

Контрагенты:
  DaData: POST .../findById/party, Authorization: Token {DADATA_API_KEY}
  Уникальный ключ: (inn, kpp) составной

Согласование:
  Дедупликация по bitrix_user_id в approvals/route.ts
  Фильтр вложений: category !== 'attachment' в my-documents
  Запрет загрузки при: согласован/загружен_частично/подписан/на_исполнении
  Групповой чат Б24 создаётся при запуске согласования

Реквизиты: id исключается из тела запроса при UPDATE
OnlyOffice: прокси /api/onlyoffice/file/route.ts
Supabase в компонентах: supabaseClient с PUBLISHABLE_KEY
Транслитерация: все файлы + №→N
Печать: utils/chatPrint.ts → buildChatHtml() (.ts не .tsx)

Шаблоны документов:
  Таблица: document_templates (name, type, company_prefix, file_url, is_active)
  Bucket: templates (Supabase Storage)
  API: app/api/templates/route.ts (GET/POST/DELETE/PATCH)
  Управление: вкладка «Шаблоны» в app/admin/page.tsx
  Формат меток: {{field_name}} (docxtemplater совместимый)
  ООО Техно: 10 шаблонов готовы (templates_ready\)
  Остальные компании: в Спринте 4

AI в проекте:
  Модель: google/gemini-2.5-flash (через OpenRouter)
  ВНИМАНИЕ: в ai-analysis/route.ts ещё старая модель — обновить!
  Fallback: ['google/gemini-2.5-flash', 'anthropic/claude-haiku-4-5', 'qwen/qwen3-235b-a22b']
  EpotosGPT: Legal Review, Паспорт, анализ вложений, чат
  AI-Generate: генерация .docx через AI (письмо, служебная записка)
