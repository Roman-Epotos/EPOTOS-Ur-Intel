# CONTEXT.md — Эпотос-ЮрИнтел / Витрина Данных
Документ передачи контекста для нового чата
Дата: 2026-05-23 (финал сессии)
Статус: Спринт 3 в работе — динамические роли реализованы

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
system_roles

Таблица system_roles:
  id UUID PRIMARY KEY, bitrix_user_id INTEGER UNIQUE,
  user_name TEXT, role TEXT, created_by INTEGER, created_at TIMESTAMPTZ
  CHECK role IN ('admin','gc_manager','finance_gc','legal_gc')

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
  - Роли компаний (6-8) → доступ только к своим, все одноранговые
  - При наличии роли ГК — она выше любой роли из согласующих
  - all_roles: возвращает все роли для проверки доступа к дашбордам

ТЕКУЩИЕ НАЗНАЧЕНИЯ system_roles:
  ID 1148 → admin
  ID 1 (Чащина Елена) → gc_manager
  ID 246 (Ершова Евгения) → legal_gc
  ID 504 (Кочкин Сергей) → legal_gc
  ID 10 (Демин Александр) → finance_gc
  ID 154 (Архипова Ольга) → finance_gc

КТО НАЗНАЧАЕТ РОЛИ:
  developer → все роли включая admin
  admin → gc_manager, finance_gc, legal_gc

API: app/api/user-role/route.ts — возвращает role, companies, all_roles
API: app/api/system-roles/route.ts — CRUD для ролей ГК

НАСТРОЙКИ: вкладка «Роли ГК» в app/admin/page.tsx
  Доступ к Настройкам: developer (ID 30) + admin + gc_manager из system_roles

ЭПОТОС Ассистент: ID 678 — технический аккаунт, нет роли


=============================================================
8. РЕАЛИЗОВАННЫЙ ФУНКЦИОНАЛ (23.05.2026)
=============================================================
✅ Документы: список, создание, версионирование, OnlyOffice, журнал аудита
✅ Нумерация: ПРЕФИКС-ТИПКОД-ГОД/МЕСЯЦ/НН
✅ Роли: динамические через system_roles + approval_settings
✅ Дополнительные материалы: загрузка, OnlyOffice, анализ в EpotosGPT
✅ Подписанные экземпляры: загрузка, подтверждение, статусы
✅ Согласование: сессии, участники, Realtime, автозавершение, чат с печатью
✅ Кнопка «Отклонить документ» (с модалом причины)
✅ AI (EpotosGPT): Legal Review, Паспорт, анализ вложений, чат
   ВАЖНО: чек-лист убран из AIAnalysis.tsx — только вкладка «Контроль исполнения»
✅ Реквизиты компаний: CRUD, short_name, доверенность
✅ Контроль исполнения: AI чек-лист, архив/восстановление, редактирование, даты
✅ Переключатель реквизитов: полные / без банковских
   Вкладка Генерация закомментирована — новый модуль в Спринте 3

✅ СПРИНТ 2 — ПОЛНОСТЬЮ ЗАВЕРШЁН

✅ СПРИНТ 3 — В РАБОТЕ:

  ✅ Рабочий стол /dashboard:
    Блоки: согласования, дедлайны, черновики, активные согласования,
           контрагенты с высоким риском, статистика, блок «Аналитика»
    Блок «Аналитика»: показывает только доступные дашборды
    has_dashboard_access, legal_dashboard_access, finance_dashboard_access

  ✅ Юридический дашборд /dashboard-legal:
    Доступ: все роли кроме user; ГК → все компании; остальные → свои
    Блоки: статусы, просроченные согласования, ожидают подписания,
           просроченные чек-листы, динамика (30д/квартал/полгода/год)

  ✅ Финансовый дашборд /dashboard-finance:
    Доступ: все роли кроме user; проверка через all_roles!
    Блоки: суммы по статусам, дебиторка, топ контрагентов,
           договоры без суммы, динамика по компаниям

  ✅ Реестр контрагентов:
    DaData: findById/party, Authorization: Token {DADATA_API_KEY}
    Поля доверенности: signatory_name, poa_number, poa_date, poa_expires

  ✅ Привязка контрагента при создании документа (counterparty_id)

  ✅ Динамические роли (23.05.2026):
    - Таблица system_roles создана и заполнена
    - user-role/route.ts — читает из system_roles + approval_settings
    - contracts-list/route.ts — все роли ГК видят все договоры
    - Вкладка «Роли ГК» в Настройках
    - Доступ к Настройкам через system_roles динамически

  ✅ Исправления:
    - Дедупликация участников согласования
    - Фильтр вложений в my-documents
    - Запрет загрузки версий после согласования
    - Валидация добавления согласующих (обязательный выбор компании)
    - Защита от дублей в согласующих


=============================================================
9. ИЗВЕСТНЫЕ ПРОБЛЕМЫ / ТЕХНИЧЕСКИЙ ДОЛГ
=============================================================
⚠️ Фильтр по компании в дашбордах — выпадающий список — не реализован
⚠️ Ссылка из уведомления → главная (не конкретный документ) — финал
⚠️ Realtime статуса — требует репликации Supabase → ЭПОТОС-Core
⚠️ Таблица contracts не переименована в documents — долг
⚠️ Уведомление в чат Б24 при загрузке подписанных документов — не реализовано
⚠️ console.log в bitrix-tasks/route.ts — убрать перед продакшном
⚠️ roleLabels в ContractsList.tsx не включает все новые роли (developer, finance_gc и т.д.)


=============================================================
10. ГДЕ ОСТАНОВИЛИСЬ (23.05.2026)
=============================================================
✅ Динамические роли — РЕАЛИЗОВАНЫ
✅ Вкладка «Роли ГК» в Настройках — РЕАЛИЗОВАНА

Следующие задачи Спринта 3:
  ⬜ Фильтр по компании в дашбордах (выпадающий список)
  ⬜ Модуль создания документов из шаблонов ({{field}} + docxtemplater)
  ⬜ Обновить roleLabels в ContractsList.tsx для новых ролей


=============================================================
11. ПОЛНЫЙ ПЛАН РАЗРАБОТКИ
=============================================================

✅ СПРИНТ 1, 2 — ЗАВЕРШЕНЫ
🔄 СПРИНТ 3 (май-июнь 2026):
  ✅ Рабочий стол, реестр контрагентов, дашборды
  ✅ Динамические роли через system_roles
  ⬜ Фильтр по компании в дашбордах
  ⬜ Модуль создания документов из шаблонов

🔴 СПРИНТ 4 (июль 2026):
  - PWA (вместо просто мобильной адаптации)
  - Плагин ЭПОТОС AI для OnlyOffice
  - Умные зависимости в чек-листе
  - AI-Audit логирование промптов

🔴 ФИНАЛ: фикс ссылки из уведомления, Realtime статусов


=============================================================
12. СТРАТЕГИЧЕСКИЕ ПРИОРИТЕТЫ
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
13. ПРАВИЛА РАБОТЫ В ЧАТЕ
=============================================================
1. Создание файлов/папок — ТОЛЬКО через терминал:
   New-Item -Path "путь\к\файлу" -ItemType File -Force

2. Редактирование файлов — ТОЛЬКО вручную через VS Code (Ctrl+H)
   НЕЛЬЗЯ редактировать через PowerShell — портит кодировку!

3. Step-by-step — не более 3 блоков кода в одном ответе с пояснениями

4. Перед деплоем — ВСЕГДА запускать npm run build локально

5. Если фрагмент для Ctrl+H не найден — обновить repomix

6. Код предлагается ОДИН РАЗ и только правильный вариант
   НЕЛЬЗЯ: предложить код → попросить заменить → сказать "нет, это неправильно"

7. PowerShell только для: New-Item, git команды, npm команды

8. notify.ts — только через VS Code (Ctrl+A, удалить, вставить)

9. AIAnalysis.tsx — чек-лист убран! Только в ExecutionControl.tsx

10. task.checklistitem.add (НЕ tasks.task.!) — TASKID заглавными

11. sendBitrixMessage УБРАНА из роутов — только колокольчик + чат

12. При создании новых страниц/API — сначала New-Item через терминал,
    затем открыть в VS Code и вставить код


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

Роли:
  user-role/route.ts: возвращает role, companies, all_roles
  system-roles/route.ts: CRUD для ролей ГК
  developer (ID 30) → жёстко в коде
  Роли ГК → system_roles; Роли компаний → approval_settings

Дашборды:
  Доступ проверяется через all_roles (не только основная роль!)
  dashboard/route.ts: проверяет доступ напрямую из БД (не через fetch)

Контрагенты:
  DaData: POST .../findById/party, Authorization: Token {DADATA_API_KEY}

Согласование:
  Дедупликация по bitrix_user_id в approvals/route.ts
  Фильтр вложений: category !== 'attachment'
  Запрет загрузки при: согласован/загружен_частично/подписан/на_исполнении

Реквизиты: id исключается из тела запроса при UPDATE
OnlyOffice: прокси /api/onlyoffice/file/route.ts
Supabase в компонентах: supabaseClient с PUBLISHABLE_KEY
Транслитерация: все файлы + №→N
Печать: utils/chatPrint.ts → buildChatHtml() (.ts не .tsx)
