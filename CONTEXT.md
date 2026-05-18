# CONTEXT.md — Эпотос-ЮрИнтел / Витрина Данных
Документ передачи контекста для нового чата
Дата: 2026-05-16 (обновлён с актуальным состоянием Спринта 2)
Статус: Активная разработка — Спринт 2

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
E:\ИСКУССТВЕННЫЙ ИНТЕЛЛЕКТ (AI)\ДОГОВОРЫ ЭПОТОС\EPOTOS-Ur-Intel


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
BITRIX_WEBHOOK_URL=https://gkepotos.bitrix24.ru/rest/30/2qkl1pp6kdi8zvtz/
ONLYOFFICE_URL=https://office.epotos-port.ru
ONLYOFFICE_JWT_SECRET=<см. .env.local>

ВАЖНО: BITRIX_WEBHOOK_URL добавлен в Vercel Environment Variables (левое меню).
Webhook scope: im, tasks, messageservice, pull + другие
Метод уведомлений: im.notify.system.add (работает!)
Ссылки из уведомлений: https://gkepotos.bitrix24.ru/marketplace/app/248/?contract_id=<id>
ПРОБЛЕМА: ссылка открывает главную, не конкретный документ → пофиксим в финале


=============================================================
5. СТРУКТУРА БАЗЫ ДАННЫХ
=============================================================
ВАЖНО: С 30.10.2026 Supabase требует GRANT для новых таблиц:
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO anon;
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO authenticated;
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO service_role;

ВАЖНО: contracts CHECK constraint:
CHECK (status IN ('черновик','на_согласовании','согласован','отклонён',
                  'загружен_частично','подписан','на_исполнении','архив'))

Таблицы: contracts, versions, approval_sessions, approval_participants,
approval_messages, approval_settings, contract_logs, document_attachments,
signed_documents, document_templates, ai_analysis,
company_requisites (+ поле short_name),
contract_checklist, contract_checklist_archive

Storage: contracts (Public), templates (Public)


=============================================================
6. НУМЕРАЦИЯ, ТИПЫ, СТАТУСЫ
=============================================================
Нумерация: ПРЕФИКС-ТИПКОД-ГОД/МЕСЯЦ/НН

Типы: АКТИВНЫЕ — Договоры (9) + Соглашения (4). Остальные скрыты.

Статусы:
  черновик → на_согласовании → согласован → загружен_частично → подписан → на_исполнении
                             ↘ отклонён
  UI: подписан="Документы загружены", на_исполнении="На исполнении"


=============================================================
7. РОЛИ
=============================================================
admin (30, 1148) — Пирог Роман (30)
gc_manager (1, 246, 504) — Чащина Елена (1), Ершова (246), Кочкин (504)
director: 592→НПП, 6→СПТ/ОС, 954→Э-К
SPECIAL_SIGNERS: 782 Владимиров→Э-К, 152 Виноградова→СПТ/ОС/НПП


=============================================================
8. РЕАЛИЗОВАННЫЙ ФУНКЦИОНАЛ (16.05.2026)
=============================================================
✅ Документы: список, создание, версионирование, OnlyOffice, журнал аудита
✅ Нумерация: ПРЕФИКС-ТИПКОД-ГОД/МЕСЯЦ/НН
✅ Роли: admin, gc_manager, director, user
✅ Дополнительные материалы: загрузка, OnlyOffice, анализ в EpotosGPT
✅ Подписанные экземпляры: загрузка, подтверждение, статусы
✅ Согласование: сессии, участники, Realtime, автозавершение, чат с печатью
✅ AI (EpotosGPT): Legal Review, Паспорт, анализ вложений, чат
✅ Реквизиты компаний: CRUD, short_name, предпросмотр/печать
✅ Контроль исполнения: AI чек-лист, архив/восстановление, редактирование, даты

✅ Уведомления Битрикс24 (ПОЛНОСТЬЮ РЕАЛИЗОВАНЫ 16.05.2026):
  Метод: im.notify.system.add через вебхук
  sendBitrixNotify() в app/lib/notify.ts — ПРЯМОЙ вызов Битрикс API
  (НЕ через self-fetch — Vercel не может вызывать сам себя!)

  События и получатели:
  - Запуск согласования → все участники
  - Добавление участника → добавленному участнику
  - Исключение участника → исключённому участнику
  - Документ согласован → автор + все участники + gc_manager
  - Документ отклонён → автор (+ смена статуса на 'отклонён')
  - Загрузка подписанных документов → автор + участники + gc_manager

  Файлы с уведомлениями:
  - app/lib/notify.ts — sendBitrixNotify()
  - app/api/bitrix-notify/route.ts — API роут
  - app/api/approvals/route.ts — запуск согласования
  - app/api/approvals/[sessionId]/approve/route.ts — согласование/отклонение
  - app/api/approvals/[sessionId]/participants/route.ts — добавление/удаление
  - app/api/signed-documents/route.ts — загрузка подписанных


=============================================================
9. ИЗВЕСТНЫЕ ПРОБЛЕМЫ / ТЕХНИЧЕСКИЙ ДОЛГ
=============================================================
⚠️ Ссылка из уведомления → главная (не конкретный документ) — финал
⚠️ Статус после согласования у последнего участника — перезагрузка — финал
⚠️ Статусы в Реквизитах не realtime — финал
⚠️ Таблица contracts не переименована в documents — долг
⚠️ proxy.ts (middleware) — до SSO отключён


=============================================================
10. ПОЛНЫЙ ПЛАН РАЗРАБОТКИ ЮРИНТЕЛ
=============================================================

✅ СПРИНТ 1 (май 2026) — ЗАВЕРШЁН
✅ СПРИНТ 2 (июнь 2026) — В РАБОТЕ:
  ✅ Уведомления Битрикс24 — все события реализованы
  ⬜ 💬 Личные сообщения (важные события: отклонён, дедлайн) через im.message.add
  ⬜ 🔔 Уведомления при новом сообщении в чате согласования
  ⬜ ✅ Создание задач из чек-листа в Битрикс24 (tasks.task.add)
  ⬜ 📋 Расширенный функционал реквизитов:
      • Несколько наборов на компанию (разные банки/счета)
      • Выбор без банковских реквизитов
      • Выбор набора при создании документа
  ⬜ 💾 Автобэкап БД
  ⬜ ⚡ Realtime обновление статусов без перезагрузки

🔴 СПРИНТ 3 (июль 2026):
  - 🏢 Реестр контрагентов + ФНС/ЕГРЮЛ
  - 📊 Дашборды (юридический, финансовый с дебиторкой, ГД, руководитель ГК)
  - 📝 Модуль создания документов из шаблонов:
      • Метод тегированных шаблонов: {{field}} в .docx
      • document_templates + contract_clauses (библиотека оговорок)
      • AI извлекает JSON, docxtemplater собирает .docx
      • Вариант А: боковая AI-панель рядом с OnlyOffice

🔴 СПРИНТ 4 (август 2026):
  - 📱 Адаптация для мобильного Битрикс24
  - 🔌 Вариант Б: Плагин ЭПОТОС AI для OnlyOffice
      (выделил текст → задача → AI правит точечно через GetSelectedText/PasteText)
      Комбо: Плагин Б (точечная правка) + Панель А (глобальная работа)
  - 🔗 Умные зависимости в чек-листе (A→B→C)
  - 🔍 Сравнение версий документов (AI)

🔴 ФИНАЛ (технический долг):
  - Фикс ссылки из уведомления
  - Realtime статусов
  - Скрытые типы документов с полными сценариями


=============================================================
11. ПЛАН ПОСЛЕ ЮРИНТЕЛ
=============================================================

📋 ЭПОТОС-CORE (сентябрь 2026, ~4-6 недель):
  Единое ядро для всех модулей. Подсистемы:
  - CoreAIService: фасад OpenRouter, Prompt Registry в БД, токеномика
  - CoreB24Service: синхронизация оргструктуры, роутер уведомлений/задач
  - CoreDocEngine: OnlyOffice + docxtemplater как общий сервис
  - Global RAG Engine: core_vector_knowledge с source_module
  Таблицы: core_users, core_prompts, core_ai_logs, core_vector_knowledge, core_b24_tasks
  Правило: core/ НЕ импортирует из modules/
  После: миграция ЮрИнтел → первый потребитель Core

📋 МОДУЛЬ 2 — ЭПОТОС-ПЕРСОНАЛ (октябрь 2026)
📋 МОДУЛЬ 3 — ЭПОТОС-РЕКЛАМАЦИИ (декабрь 2026)
📋 МОДУЛЬ 4 — ЭПОТОС-КОММЕРЦИЯ (Q1 2027)

📋 ЦЕНТРАЛЬНЫЙ ДАШБОРД РУКОВОДИТЕЛЯ ГК:
  KPI, дебиторская задолженность, финансы, HR

📋 ИНФРАСТРУКТУРА (Q3-Q4 2026):
  Российский хостинг, единый SSO, Supabase Pro при необходимости


=============================================================
12. КАК ОБНОВЛЯТЬ КОД ДЛЯ CLAUDE
=============================================================
В начале каждой сессии:
  npx repomix --config repomix-api.config.json
  npx repomix --config repomix-components.config.json
  npx repomix --config repomix-pages.config.json

Загрузить в базу знаний: repomix-api.txt, repomix-components.txt, repomix-pages.txt + CONTEXT.md

ВАЖНО: Ctrl+H в VS Code. Если фрагмент не найден — обновить repomix.
ВАЖНО: Claude создаёт CONTEXT.md как файл (не текст в чате).
ВАЖНО: Секретные ключи НЕ вставлять в CONTEXT.md
ВАЖНО: Environment Variables в Vercel — в левом меню (не в Settings!)
ВАЖНО: sendBitrixNotify() — прямой вызов Битрикс API, НЕ self-fetch


=============================================================
13. КЛЮЧЕВЫЕ АРХИТЕКТУРНЫЕ РЕШЕНИЯ
=============================================================

Уведомления:
  - sendBitrixNotify() в app/lib/notify.ts — прямой вызов im.notify.system.add
  - Получатели: всегда включать gc_manager [1, 246, 504] + автор + участники
  - BITRIX_WEBHOOK_URL обязательно в Vercel ENV

Реквизиты: SELECT→UPDATE/INSERT. id исключается из тела запроса.

Чек-лист:
  - /api/contract-checklist/route.ts + ExecutionControl.tsx
  - files[]: {file_url, file_name, source}
  - Архив: map(({ id, ...item }) => ({ ...item, original_id: id }))
  - action='restore_archive'

Создание из шаблонов (Спринт 3):
  - AI только в JSON, docxtemplater собирает .docx
  - contract_clauses — AI выбирает оговорку, не пишет её

OnlyOffice: version_id / attachment_id, прокси /api/onlyoffice/file/route.ts
Согласование: contract_id из сессии в approve/route.ts
Realtime: ContractsList=INSERT, ContractTabs=UPDATE, Чат=INSERT
Supabase в компонентах: supabaseClient с PUBLISHABLE_KEY
Транслитерация: все файлы + №→N
Печать: utils/chatPrint.ts → buildChatHtml() (.ts не .tsx)
