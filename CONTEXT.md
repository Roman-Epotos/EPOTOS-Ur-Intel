# CONTEXT.md — Эпотос-ЮрИнтел
Документ передачи контекста для нового чата
Дата: 2026-05-15 финал (обновлён по итогам всех сессий 08-15 мая 2026)
Статус: Активная разработка — Альфа-тест до 22 мая 2026

=============================================================
1. О ПРОЕКТЕ
=============================================================
Название системы: Эпотос-ЮрИнтел (ранее — ЭПОТОС-ДОК)
Назначение: Внутренняя корпоративная система управления юридически значимыми документами ГК ЭПОТОС
Компания: ГК ЭПОТОС (epotos.ru) — производство противопожарного оборудования

Дочерние компании (5 юрлиц):
- ООО Техно — префикс ТХ
- ООО НПП ЭПОТОС — префикс НПП
- ООО СПТ — префикс СПТ
- ООО ОС — префикс ОС
- ООО Эпотос-К — префикс Э-К

URL системы: https://epotos-ur-intel.vercel.app
GitHub: https://github.com/Roman-Epotos/EPOTOS-Ur-Intel
Битрикс24: https://gkepotos.bitrix24.ru/marketplace/app/248/

ВАЖНО: Система интегрирована в Битрикс24 как iframe-приложение (app ID: 248).
Авторизация — через Битрикс24 SSO. Все пользователи входят через Битрикс24.


=============================================================
2. ТЕХНОЛОГИЧЕСКИЙ СТЕК
=============================================================
- Фреймворк: Next.js 14 (App Router)
- БД: Supabase (cloud) + pgvector
- Стили: Tailwind CSS
- Язык: TypeScript
- AI (разработка/тест): OpenRouter — модель google/gemini-2.0-flash-001
- AI (продакшн): DeepSeek / Claude Haiku
- Авторизация: Битрикс24 SSO (OAuth / iframe-приложение) — реализована
- Редактор документов: OnlyOffice (self-hosted, https://office.epotos-port.ru)
- Хранилище файлов: Supabase Storage (bucket: contracts, templates)
- IDE: VS Code
- Хостинг: Vercel (будущий: Timeweb / Yandex Cloud)


=============================================================
3. ПУТЬ К ПРОЕКТУ
=============================================================
E:\ИСКУССТВЕННЫЙ ИНТЕЛЛЕКТ (AI)\ДОГОВОРЫ ЭПОТОС\EPOTOS-Ur-Intel


=============================================================
4. ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ (.env.local и Vercel)
=============================================================
NEXT_PUBLIC_SUPABASE_URL=https://qmzyybisajjmneydekoo.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<см. .env.local>
SUPABASE_SECRET_KEY=<см. .env.local>
OPENROUTER_API_KEY=<см. .env.local>
BITRIX_CLIENT_ID=<см. .env.local>      ← обновлён 15.05.2026 (пересоздание приложения)
BITRIX_CLIENT_SECRET=<см. .env.local>  ← обновлён 15.05.2026
BITRIX_PORTAL=gkepotos.bitrix24.ru
BITRIX_WEBHOOK_URL=https://gkepotos.bitrix24.ru/rest/30/2qkl1pp6kdi8zvtz/
ONLYOFFICE_URL=https://office.epotos-port.ru
ONLYOFFICE_JWT_SECRET=<см. .env.local>

ВАЖНО: BITRIX_WEBHOOK_URL добавлен в Vercel Environment Variables (левое меню).
Webhook scope: tasks, im.import, messageservice, pull, pull_channel, im (чат и уведомления)
Метод уведомлений: im.notify.system.add (работает!)

Битрикс24 приложение:
- App ID в marketplace: 248
- URL в Битрикс24: https://gkepotos.bitrix24.ru/marketplace/app/248/
- Ссылки из уведомлений: https://gkepotos.bitrix24.ru/marketplace/app/248/?contract_id=<id>
  ПРОБЛЕМА: ссылка открывает главную страницу, не конкретный документ → пофиксим в финале


=============================================================
5. СТРУКТУРА БАЗЫ ДАННЫХ SUPABASE
=============================================================
Все таблицы с включённым RLS, permissive policies.

ВАЖНО: С 30.10.2026 Supabase требует явных GRANT для всех таблиц.
Для каждой новой таблицы ОБЯЗАТЕЛЬНО выполнять:
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO anon;
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO authenticated;
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO service_role;

ВАЖНО: В таблице contracts есть CHECK constraint на статусы:
CHECK (status IN ('черновик','на_согласовании','согласован','отклонён',
                  'загружен_частично','подписан','на_исполнении','архив'))

contracts — юридические документы
  id, number, title, type, status, company_prefix, counterparty,
  author_bitrix_id, allow_others_to_approve, region, document_category,
  signed_at, signed_by_name, signed_by_bitrix_id, created_at, updated_at

versions — версии документов
  id, contract_id, version_number, file_name, file_url, comment, created_by, created_at

approval_sessions — сессии согласования
  id, contract_id, status ('active'/'completed'/'cancelled'), initiated_by_name,
  initiated_by_bitrix_id, deadline, created_at, updated_at

approval_participants — участники согласования
  id, session_id, user_name, bitrix_user_id, role ('required'/'optional'),
  stage, status ('pending'/'approved'/'acknowledged'/'disabled'), comment,
  decided_at, department, created_at

approval_messages — сообщения чата согласования
  id, session_id, message, author_name, bitrix_user_id, is_ai,
  file_url, file_name, file_type, created_at

approval_settings — настройки маршрутов согласования
  id, bitrix_user_id, user_name, stage, company_prefixes, department, ...

contract_logs — журнал всех действий
  id, contract_id, action, user_name, details, created_at

document_attachments — дополнительные материалы
  id, contract_id, attachment_type, number, title, file_url, file_name,
  comment, uploaded_by_name, uploaded_by_bitrix_id, created_at

signed_documents — подписанные экземпляры
  id, contract_id, file_url, file_name, uploaded_by_name, uploaded_by_bitrix_id, created_at

document_templates — шаблоны документов
  id, name, type, content, file_url, company_prefix, region, is_active, created_at

ai_analysis — результаты AI-анализа
  id, contract_id, type, result_json, version_id, attachment_id, status, model_used, created_at

company_requisites — реквизиты компаний
  id, company_prefix, company_name, short_name, inn, kpp, ogrn,
  legal_address, actual_address, bank_name, bank_account, bank_bik,
  bank_corr_account, director_name, director_title, phone, email, website

contract_checklist — чек-лист исполнения
  id, contract_id, item_order, category, title, description,
  due_date, responsible, source_document,
  is_done, done_at, done_by_name, done_by_bitrix_id, created_at

contract_checklist_archive — архив предыдущей версии чек-листа
  id, contract_id, original_id, item_order, category, title, description,
  due_date, responsible, source_document,
  is_done, done_at, done_by_name, done_by_bitrix_id, created_at

Storage buckets:
  contracts (Public): versions/, attachments/, signed/, chat/
  templates (Public)


=============================================================
6. НУМЕРАЦИЯ ДОКУМЕНТОВ
=============================================================
Формат: ПРЕФИКС-ТИПКОД-ГОД/МЕСЯЦ/НН


=============================================================
7. ТИПЫ ДОКУМЕНТОВ (app/lib/documentTypes.ts)
=============================================================
АКТИВНЫЕ: Договоры (9 типов) + Соглашения (4 типа)
ВРЕМЕННО СКРЫТЫ (закомментированы): все остальные категории


=============================================================
8. СТАТУСЫ ДОКУМЕНТОВ
=============================================================
черновик → на_согласовании → согласован → загружен_частично → подписан → на_исполнении
                           ↘ отклонён

UI-названия:
  подписан → "Документы загружены"
  на_исполнении → "На исполнении"

Триггер подписан → на_исполнении: генерация AI чек-листа


=============================================================
9. РОЛИ ПОЛЬЗОВАТЕЛЕЙ
=============================================================
admin (bitrix_id: 30, 1148) — Пирог Роман (30), второй администратор (1148)
gc_manager (bitrix_id: 1, 246, 504) — Чащина Елена (1), Ершова Евгения (246), Кочкин Сергей (504)
director: 592→НПП, 6→СПТ/ОС, 954→Э-К
SPECIAL_SIGNERS: 782 Владимиров→Э-К, 152 Виноградова→СПТ/ОС/НПП


=============================================================
10. ФАЙЛОВАЯ СТРУКТУРА ПРОЕКТА
=============================================================
EPOTOS-Ur-Intel/
├── app/
│   ├── api/
│   │   ├── bitrix-notify/route.ts           — API уведомлений Битрикс24
│   │   ├── contract-checklist/route.ts      — Чек-лист исполнения
│   │   ├── contracts/route.ts
│   │   ├── contracts/[contractId]/route.ts
│   │   ├── contracts/[contractId]/delegate/route.ts
│   │   ├── contracts-list/route.ts
│   │   ├── versions/route.ts
│   │   ├── attachments/route.ts
│   │   ├── signed-documents/route.ts
│   │   ├── approvals/route.ts               — уведомления при запуске согласования
│   │   ├── approvals/[sessionId]/approve/route.ts  — уведомления при согласовании
│   │   ├── approvals/[sessionId]/messages/route.ts
│   │   ├── approvals/[sessionId]/participants/route.ts
│   │   ├── onlyoffice/route.ts
│   │   ├── onlyoffice/callback/route.ts
│   │   ├── onlyoffice/file/route.ts
│   │   ├── ai-analysis/route.ts
│   │   ├── ai-chat/route.ts
│   │   ├── ai-generate/route.ts
│   │   ├── templates/route.ts
│   │   ├── user-role/route.ts
│   │   ├── approval-settings/route.ts
│   │   ├── my-documents/route.ts
│   │   └── company-requisites/route.ts
│   ├── components/
│   │   ├── ContractsList.tsx
│   │   ├── ContractTabs.tsx
│   │   ├── AIAnalysis.tsx
│   │   ├── ExecutionControl.tsx
│   │   ├── AIGenerate.tsx
│   │   ├── ApproveButton.tsx
│   │   ├── DelegateApproveCheckbox.tsx
│   │   ├── CancelApprovalButton.tsx
│   │   ├── DeleteContractButton.tsx
│   │   ├── MyDocuments.tsx
│   │   ├── PersonalStats.tsx
│   │   └── Header.tsx
│   ├── lib/
│   │   ├── documentTypes.ts
│   │   └── notify.ts                        — sendBitrixNotify() — прямой вызов Битрикс API
│   ├── hooks/
│   │   └── useBitrixAuth.ts                 — читает contract_id из URL для редиректа
│   └── pages/...
├── utils/
│   ├── chatPrint.ts
│   ├── supabase/client.ts
│   └── supabase/server.ts
├── FINAL_BITRIX_OK.xlsx
├── proxy.ts
├── .env.local
└── CONTEXT.md


=============================================================
11. КАК ОБНОВЛЯТЬ КОД ДЛЯ CLAUDE
=============================================================
В начале каждой сессии:
  npx repomix --config repomix-api.config.json
  npx repomix --config repomix-components.config.json
  npx repomix --config repomix-pages.config.json

Загрузить в базу знаний: repomix-api.txt, repomix-components.txt, repomix-pages.txt + CONTEXT.md

ВАЖНО для Windows: grep не работает → Select-String и Get-Content
ВАЖНО: Ctrl+H в VS Code для правок. Если фрагмент не найден — сразу обновить repomix.
ВАЖНО: Claude всегда создаёт CONTEXT.md как файл (не текст в чате).
ВАЖНО: Секретные ключи НЕ вставлять в CONTEXT.md — только <см. .env.local>
ВАЖНО: Environment Variables в Vercel — в левом меню (не в Settings!)


=============================================================
12. РЕАЛИЗОВАННЫЙ ФУНКЦИОНАЛ (по состоянию на 15.05.2026 финал)
=============================================================

✅ Документы: список, создание, версионирование, OnlyOffice, журнал аудита

✅ Нумерация: ПРЕФИКС-ТИПКОД-ГОД/МЕСЯЦ/НН

✅ Роли: admin, gc_manager, director, user

✅ Дополнительные материалы: загрузка, OnlyOffice, анализ в EpotosGPT

✅ Подписанные экземпляры: загрузка, подтверждение, статусы

✅ Согласование: сессии, участники, Realtime, автозавершение, чат с печатью

✅ AI (EpotosGPT): Legal Review, Паспорт, анализ вложений, чат по документу

✅ Реквизиты компаний: CRUD, short_name, предпросмотр/печать

✅ Вкладка "Контроль исполнения":
  - AI чек-лист из всех документов, расчёт дат
  - Архив/восстановление, редактирование пунктов
  - Прогресс-бар, история изменений

✅ Уведомления Битрикс24 — РЕАЛИЗОВАНО 15.05.2026:
  - Метод: im.notify.system.add через вебхук
  - Webhook: https://gkepotos.bitrix24.ru/rest/30/2qkl1pp6kdi8zvtz/
  - Права вебхука: im (чат и уведомления) + tasks + messageservice + pull
  - BITRIX_WEBHOOK_URL добавлен в Vercel Environment Variables
  - sendBitrixNotify() — прямой вызов Битрикс API (не через self-fetch)
  - События: запуск согласования (участникам), завершение согласования (автору)
  - Ссылка в уведомлении: https://gkepotos.bitrix24.ru/marketplace/app/248/?contract_id=<id>
  - Градация уведомлений (план Спринт 2):
    🔔 Колокольчик: второстепенные события
    💬 Личное сообщение от ЮрИнтел: важные события (отклонён, дедлайн)
    🔔 Колокольчик при новом сообщении в чате согласования


=============================================================
13. ИЗВЕСТНЫЕ ПРОБЛЕМЫ / ТЕХНИЧЕСКИЙ ДОЛГ
=============================================================

⚠️ Ссылка из уведомления открывает главную страницу ЮрИнтел, а не конкретный документ.
   Причина: useBitrixAuth сбрасывает URL на '/' после авторизации, теряя contract_id.
   Пофиксим в финале разработки.

⚠️ После согласования последним участником — у него статус обновляется
   только после перезагрузки. Отложено на финал.

⚠️ Статусы во вкладке Реквизиты не обновляются в реалтайм. Отложено на финал.

⚠️ Таблица contracts не переименована в documents (технический долг).

⚠️ proxy.ts (middleware) — до SSO отключён.


=============================================================
14. ПЛАН РАЗРАБОТКИ
=============================================================

🔴 СПРИНТ 1 (до 22 мая 2026) — ЗАВЕРШЁН ✅:
  ✅ Скрыть лишние типы документов
  ✅ Вкладка "Контроль исполнения" с AI чек-листом
  ✅ Фикс реквизитов компаний
  ✅ Уведомления Битрикс24 (колокольчик) — работают!

🔴 СПРИНТ 2 (июнь 2026):
  - Личные сообщения от ЮрИнтел (важные события) через im.message.add
  - Уведомления при новом сообщении в чате согласования
  - В2 — Создание задач из чек-листа в Битрикс24 (tasks.task.add)
  - Расширенный функционал реквизитов (несколько наборов, выбор без банк. реквизитов)
  - Автобэкап БД
  - Realtime обновление статусов без перезагрузки

🔴 СПРИНТ 3 (июль 2026):
  - Реестр контрагентов + ФНС/ЕГРЮЛ
  - Дашборды (юридический, финансовый с дебиторкой, ГД, руководитель ГК)
  - Модуль создания документов из шаблонов ({{field}} + {{ai:block}})

🔴 СПРИНТ 4 (август 2026):
  - 📱 Адаптация для мобильного приложения Битрикс24
  - Умные зависимости в чек-листе (A→B→C)
  - Сравнение версий документов (AI)
  - Расширенные уведомления

🔴 ФИНАЛ (технический долг):
  - Фикс ссылки из уведомления (открывать конкретный документ)
  - Realtime статусов в Реквизитах
  - Realtime после согласования последним участником

📋 МОДУЛЬ 2 — ЭПОТОС-ПЕРСОНАЛ (сентябрь 2026+)

📋 ПЛАТФОРМА — ЭПОТОС-ВИТРИНА ДАННЫХ (Q3-Q4 2026):
  - Центральный дашборд руководителя ГК
  - Единый SSO через Битрикс24
  - Перенос на российский хостинг


=============================================================
15. КЛЮЧЕВЫЕ АРХИТЕКТУРНЫЕ РЕШЕНИЯ
=============================================================

Уведомления Битрикс24:
  - app/lib/notify.ts: sendBitrixNotify() — прямой вызов im.notify.system.add
  - НЕ через self-fetch (Vercel не может вызывать сам себя)
  - BITRIX_WEBHOOK_URL должен быть в Vercel ENV (не только в .env.local)
  - Подключено: approvals/route.ts (запуск), approve/route.ts (завершение)
  - Ссылка в уведомлении: marketplace/app/248/?contract_id=<id>

Реквизиты компаний: SELECT→UPDATE/INSERT вместо upsert.
  id исключается: const { admin_bitrix_id, id, ...requisites } = body

Чек-лист исполнения:
  - API: /api/contract-checklist/route.ts
  - Компонент: ExecutionControl.tsx
  - Таблицы: contract_checklist + contract_checklist_archive
  - files[]: массив {file_url, file_name, source}
  - Архивирование: map(({ id, ...item }) => ({ ...item, original_id: id }))
  - Восстановление: action='restore_archive'
  - check_archive=true в GET → проверка без загрузки пунктов

OnlyOffice: version_id / attachment_id, прокси через /api/onlyoffice/file/route.ts
Согласование: contract_id из сессии в approve/route.ts (не из тела)
Realtime: ContractsList=INSERT only, ContractTabs=UPDATE, Чат=INSERT
Supabase в компонентах: supabaseClient с PUBLISHABLE_KEY
Транслитерация: все файлы при загрузке + №→N
Печать чата: utils/chatPrint.ts → buildChatHtml() (.ts не .tsx)
