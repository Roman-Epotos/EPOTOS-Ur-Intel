# CONTEXT.md — Эпотос-ЮрИнтел
Документ передачи контекста для нового чата
Дата: 2026-05-15 (обновлён по итогам сессий 08-15 мая 2026)
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

ВАЖНО: Система интегрирована в Битрикс24 как iframe-приложение.
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
- RAG: pgvector + Gemini Embeddings
- Авторизация: Битрикс24 SSO (OAuth / iframe-приложение) — реализована
- Редактор документов: OnlyOffice (self-hosted, https://office.epotos-port.ru)
- Хранилище файлов: Supabase Storage (bucket: contracts — основной, templates — шаблоны)
- IDE: VS Code
- Текущий хостинг: Vercel
- Будущий хостинг: Timeweb / Yandex Cloud / Selectel


=============================================================
3. ПУТЬ К ПРОЕКТУ
=============================================================
E:\ИСКУССТВЕННЫЙ ИНТЕЛЛЕКТ (AI)\ДОГОВОРЫ ЭПОТОС\EPOTOS-Ur-Intel


=============================================================
4. ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ (.env.local)
=============================================================
NEXT_PUBLIC_SUPABASE_URL=https://qmzyybisajjmneydekoo.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_BBx_i0H3W07ukMbSXzOhHA_yOBlWop2
SUPABASE_SECRET_KEY=<см. .env.local>
OPENROUTER_API_KEY=<см. .env.local>
BITRIX_CLIENT_ID=local.69f0ee5932a0e5.80295916
BITRIX_CLIENT_SECRET=1N1s7t4iV7o8ZjldSTvrm6Qdu4Ng76v0TUnLz4V4oHgJsHY4Yp
BITRIX_PORTAL=gkepotos.bitrix24.ru
ONLYOFFICE_URL=https://office.epotos-port.ru
ONLYOFFICE_JWT_SECRET=epotos_office_secret_2026

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

document_attachments — дополнительные материалы к документам
  id, contract_id, attachment_type, number, title, file_url, file_name,
  comment, uploaded_by_name, uploaded_by_bitrix_id, created_at

signed_documents — подписанные экземпляры документов
  id, contract_id, file_url, file_name, uploaded_by_name,
  uploaded_by_bitrix_id, created_at

document_templates — шаблоны документов
  id, name, type, content, file_url, company_prefix, region, is_active, created_at

ai_analysis — результаты AI-анализа
  id, contract_id, type, result_json, version_id, attachment_id,
  status, model_used, created_at
  ВАЖНО: attachment_id добавлен для анализа вложений (FK bug fix 14.05.2026)

company_requisites — реквизиты компаний
  id, company_prefix, company_name, short_name, inn, kpp, ogrn,
  legal_address, actual_address, bank_name, bank_account, bank_bik,
  bank_corr_account, director_name, director_title, phone, email, website
  ВАЖНО: short_name добавлен 15.05.2026
  ВАЖНО: upsert заменён на SELECT→UPDATE/INSERT (фикс duplicate key 15.05.2026)

notifications — уведомления
  id, user_id, document_id, type, message, is_read, created_at

users — пользователи системы
  id, bitrix_id, name, email, role, company_prefix, created_at

contract_checklist — чек-лист исполнения договора
  id, contract_id, item_order, category, title, description,
  due_date, responsible, source_document,
  is_done, done_at, done_by_name, done_by_bitrix_id, created_at

contract_checklist_archive — архив предыдущей версии чек-листа
  id, contract_id, original_id, item_order, category, title, description,
  due_date, responsible, source_document,
  is_done, done_at, done_by_name, done_by_bitrix_id, created_at

Storage buckets:
  contracts — все файлы (Public). Структура путей:
    versions/{contract_id}/{filename}
    attachments/{contract_id}/{safeType}_{number}_{timestamp}_{filename}
    signed/{contract_id}/{timestamp}_{filename}
    chat/{session_id}/{timestamp}_{filename}
  templates — шаблоны (Public)


=============================================================
6. НУМЕРАЦИЯ ДОКУМЕНТОВ
=============================================================
Формат: ПРЕФИКС-ТИПКОД-ГОД/МЕСЯЦ/НН
Примеры: ТХ-ДОГ-2026/05/01, НПП-ДОП-2026/05/03, ТХ-КОНФ-2026/05/01

TYPE_CODES (app/api/contracts/route.ts):
  поставка, услуги, аренда, подряд, купля-продажа,
  агентский, дилерский, лицензионный, сервисный → ДОГ
  доп-соглашение → ДОП
  nda → КОНФ
  эдо → ЭДО
  протокол-разногласий → ПРТ
  претензия, ответ-претензию → ПРЗ
  исковое → ИСК
  положение, инструкция, служебная-записка → ОРД
  доверенность → ДОВ
  персданные → СПД
  акт → АКТ
  заключение → ПРВ
  справка → СПР
  устав → УСТ
  письмо → ПСМ
  счет → СЧТ
  другое → ДОК


=============================================================
7. ТИПЫ ДОКУМЕНТОВ (app/lib/documentTypes.ts)
=============================================================
АКТИВНЫЕ (отображаются в интерфейсе):
  Договоры: поставка, услуги, аренда, подряд, купля-продажа,
            агентский, дилерский, лицензионный, сервисный
  Соглашения: доп-соглашение, nda, эдо, протокол-разногласий

ВРЕМЕННО СКРЫТЫ (закомментированы, не удалены):
  Претензионно-исковые, Организационно-распорядительные,
  Доверенности и согласия, Акты и заключения, Учредительные, Прочие


=============================================================
8. СТАТУСЫ ДОКУМЕНТОВ И ЦЕПОЧКА ПЕРЕХОДОВ
=============================================================
черновик → на_согласовании → согласован → загружен_частично → подписан → на_исполнении
                           ↘ отклонён

UI-названия статусов:
  черновик         → "Черновик"
  на_согласовании  → "На согласовании"
  согласован       → "Согласован"
  отклонён         → "Отклонён"
  загружен_частично → "Загружены частично"
  подписан         → "Документы загружены"
  на_исполнении    → "На исполнении"

Триггеры переходов:
  черновик → на_согласовании: запуск согласования
  на_согласовании → согласован: все обязательные участники согласовали
  согласован → загружен_частично: загружен первый подписанный файл
  загружен_частично → подписан: кнопка "Подтвердить — все документы загружены"
    ВАЖНО: status_only проверяется ДО работы с файлом (фикс 14.05.2026)
  подписан → на_исполнении: генерация AI чек-листа во вкладке "Контроль исполнения"

ВАЖНО: При добавлении участника в completed сессию →
  сессия → active, контракт → на_согласовании.
ВАЖНО: При удалении участника — если все оставшиеся согласовали →
  автоматически завершается согласование.


=============================================================
9. РОЛИ ПОЛЬЗОВАТЕЛЕЙ (app/api/user-role/route.ts)
=============================================================
admin (bitrix_id: 30, 1148):
  - Полный доступ + админ-панель
  - Пирог Роман (ID 30), второй администратор (ID 1148)

gc_manager (bitrix_id: 1, 246, 504):
  - Видит документы ВСЕХ компаний ГК
  - Чащина Елена (ID 1) — руководитель ГК
  - Ершова Евгения (ID 246) — юрисконсульт
  - Кочкин Сергей (ID 504) — начальник отдела

director:
  - 592 → ['НПП']
  - 6 → ['СПТ', 'ОС']
  - 954 → ['Э-К']

SPECIAL_SIGNERS (могут загружать подписанные документы):
  - 782 (Владимиров Вячеслав) → ['Э-К']
  - 152 (Виноградова Анна) → ['СПТ', 'ОС', 'НПП']

Файл с пользователями Битрикс24: FINAL_BITRIX_OK.xlsx в корне проекта.
Столбцы: A=ID, B=Фамилия, C=Имя, D=Компания, E=Email, F=Должность, G=Подразделение.


=============================================================
10. ФАЙЛОВАЯ СТРУКТУРА ПРОЕКТА
=============================================================
EPOTOS-Ur-Intel/
├── app/
│   ├── page.tsx                              — Главная страница
│   ├── admin/page.tsx                        — Админ-панель (только admin)
│   ├── editor/page.tsx                       — Редактор OnlyOffice
│   ├── contracts/
│   │   ├── [id]/page.tsx                     — Карточка документа
│   │   ├── [id]/upload/page.tsx              — Загрузка версии
│   │   ├── [id]/approval-portal/page.tsx     — Портал согласования
│   │   ├── [id]/approve/page.tsx             — Страница согласования
│   │   └── new/page.tsx                      — Создание документа
│   ├── lib/
│   │   └── documentTypes.ts                 — DOCUMENT_TYPES, REGIONS
│   ├── hooks/
│   │   └── useBitrixAuth.ts                 — Хук авторизации Битрикс24
│   ├── api/
│   │   ├── contracts/route.ts               — CRUD + генерация номера
│   │   ├── contracts/[contractId]/route.ts  — GET одного контракта
│   │   ├── contracts/[contractId]/delegate/route.ts — Делегирование
│   │   ├── contracts-list/route.ts          — Список с фильтрами по роли
│   │   ├── versions/route.ts                — Версии документов
│   │   ├── attachments/route.ts             — Дополнительные материалы
│   │   ├── signed-documents/route.ts        — Подписанные экземпляры
│   │   ├── approvals/route.ts               — Сессии согласования
│   │   ├── approvals/[sessionId]/approve/route.ts      — Согласование
│   │   ├── approvals/[sessionId]/messages/route.ts     — Чат
│   │   ├── approvals/[sessionId]/participants/route.ts — Участники
│   │   ├── onlyoffice/route.ts              — Конфиг OnlyOffice
│   │   ├── onlyoffice/callback/route.ts     — Callback сохранения
│   │   ├── onlyoffice/file/route.ts         — Проксирование файлов
│   │   ├── ai-analysis/route.ts             — AI анализ (EpotosGPT)
│   │   ├── ai-chat/route.ts                 — AI чат по документу
│   │   ├── ai-generate/route.ts             — AI генерация
│   │   ├── contract-checklist/route.ts      — Чек-лист исполнения
│   │   ├── templates/route.ts               — Шаблоны
│   │   ├── user-role/route.ts               — Роли пользователей
│   │   ├── approval-settings/route.ts       — Настройки маршрутов
│   │   ├── my-documents/route.ts            — Мои документы
│   │   └── company-requisites/route.ts      — Реквизиты компаний
│   └── components/
│       ├── ContractsList.tsx                — Список документов + Realtime
│       ├── ContractTabs.tsx                 — Вкладки карточки документа
│       ├── AIAnalysis.tsx                   — AI анализ (EpotosGPT)
│       ├── ExecutionControl.tsx             — Контроль исполнения
│       ├── AIGenerate.tsx                   — AI генерация документов
│       ├── ApproveButton.tsx                — Кнопка запуска согласования
│       ├── DelegateApproveCheckbox.tsx      — Делегирование согласования
│       ├── CancelApprovalButton.tsx         — Отмена согласования
│       ├── DeleteContractButton.tsx         — Удаление документа
│       ├── MyDocuments.tsx                  — Мои документы (виджет)
│       ├── PersonalStats.tsx                — Персональная статистика
│       └── Header.tsx                       — Шапка
├── utils/
│   ├── chatPrint.ts                         — buildChatHtml() для печати чата
│   ├── supabase/client.ts                   — Supabase client
│   └── supabase/server.ts                   — Supabase server client
├── repomix-api.config.json
├── repomix-components.config.json
├── repomix-pages.config.json
├── FINAL_BITRIX_OK.xlsx                     — Список пользователей Битрикс24
├── proxy.ts                                 — Middleware
├── .env.local
└── CONTEXT.md                               — Этот файл


=============================================================
11. КАК ОБНОВЛЯТЬ КОД ДЛЯ CLAUDE
=============================================================
В начале каждой сессии:
  npx repomix --config repomix-api.config.json
  npx repomix --config repomix-components.config.json
  npx repomix --config repomix-pages.config.json

Загрузить в базу знаний проекта: repomix-api.txt, repomix-components.txt, repomix-pages.txt
Также загрузить: CONTEXT.md

ВАЖНО для Windows:
  - grep не работает → использовать Select-String и Get-Content
  - Пути с кириллицей и [] нужно экранировать в PowerShell
  - Создание файлов/папок только через New-Item

Предпочтительный способ правок — Ctrl+H в VS Code (Find & Replace).
Избегать правок через PowerShell (риск потери данных при работе с большими файлами).

ВАЖНО: Claude всегда создаёт CONTEXT.md как файл (не текст в чате).
ВАЖНО: Если фрагмент не найден при Ctrl+H — сразу обновить repomix.


=============================================================
12. РЕАЛИЗОВАННЫЙ ФУНКЦИОНАЛ (по состоянию на 15.05.2026)
=============================================================

✅ Документы:
- Список с фильтрацией, поиском, горизонтальным скроллом
- Создание с AI-генерацией и по шаблонам
- Версионирование (загрузка, скачивание, просмотр, редактирование, удаление)
- Онлайн-редактор OnlyOffice для DOCX и XLSX
- Журнал аудита всех действий
- Типы документов: только Договоры и Соглашения (остальные скрыты временно)

✅ Нумерация: ПРЕФИКС-ТИПКОД-ГОД/МЕСЯЦ/НН, автогенерация, ручное переопределение

✅ Роли: admin, gc_manager, director, user

✅ Дополнительные материалы: загрузка PDF/DOCX/XLSX, OnlyOffice, анализ в EpotosGPT

✅ Подписанные экземпляры: загрузка, подтверждение, статусы загружен_частично/подписан

✅ Согласование: сессии, участники, Realtime, автозавершение, чат с печатью

✅ AI (EpotosGPT): Legal Review, Паспорт, анализ вложений, чат по документу

✅ Реквизиты компаний (Админ-панель) — обновлено 15.05.2026:
- CRUD для каждой компании
- Поле short_name (Сокращённое наименование)
- Предпросмотр и печать реквизитов
- Фикс duplicate key и перезаписи данных

✅ Вкладка "Контроль исполнения" (ExecutionControl.tsx) — обновлено 15.05.2026:
- AI чек-лист из ВСЕХ документов (основной + вложения)
- Консолидированный анализ, группировка по источнику
- Модальное окно ключевых дат (расчёт относительных → абсолютных сроков)
- Улучшенный AI промпт с явными примерами расчёта дат
- Архивирование и восстановление предыдущей версии (кнопка ↩️)
- Переключение между версиями (архив ↔ текущая)
- Редактирование пунктов (модальное окно)
- Отметка выполнения, добавление вручную, удаление
- Прогресс-бар, история изменений
- При генерации статус → на_исполнении


=============================================================
13. ИЗВЕСТНЫЕ ПРОБЛЕМЫ / ТЕХНИЧЕСКИЙ ДОЛГ
=============================================================

⚠️ После согласования последним участником — у него статус обновляется
   только после перезагрузки. Отложено на финал.

⚠️ Статусы во вкладке Реквизиты не обновляются в реалтайм после
   добавления/удаления участников. Отложено на финал.

⚠️ Таблица contracts не переименована в documents (технический долг).

⚠️ proxy.ts (middleware) — до SSO отключён.


=============================================================
14. ПЛАН РАЗРАБОТКИ
=============================================================

🔴 СПРИНТ 1 (до 22 мая 2026) — В РАБОТЕ:
  ✅ Б1 — Скрыть лишние типы документов
  ✅ А1-А5 — Вкладка "Контроль исполнения" (реализована, протестирована)
  ✅ Фикс реквизитов компаний (duplicate key, перезапись, short_name, печать)
  ⬜ Оставшиеся доработки по отзыву тестирования

🔴 СПРИНТ 2 (июнь 2026):
  - В1 — Уведомления через Битрикс24 REST API (im.notify)
  - В2 — Создание задач из чек-листа в Битрикс24 (tasks.task.add)
  - Расширенный функционал реквизитов (несколько наборов на компанию,
    выбор без банковских реквизитов)
  - Автобэкап БД
  - Realtime обновление статусов без перезагрузки

🔴 СПРИНТ 3 (июль 2026):
  - Реестр контрагентов + проверка ФНС/ЕГРЮЛ
  - Юридический дашборд
  - Финансовый дашборд (дебиторская задолженность везде где возможно)
  - Дашборд ГД (каждый видит свои компании)
  - Дашборд руководителя ГК (Чащина, ID 1 — всё + сводная аналитика)
  - Ш1-Ш3 — Модуль создания документов из шаблонов ({{field}} + {{ai:block}})

🔴 СПРИНТ 4 (август 2026):
  - Умные зависимости в чек-листе (A→B→C, критический путь)
  - Сравнение версий документов (AI)
  - Аудит и расширенные уведомления

📋 МОДУЛЬ 2 — ЭПОТОС-ПЕРСОНАЛ (сентябрь 2026+)

📋 ПЛАТФОРМА — ЭПОТОС-ВИТРИНА ДАННЫХ (Q3-Q4 2026):
  - Центральный дашборд руководителя ГК
  - Единый SSO через Битрикс24
  - Перенос на российский хостинг


=============================================================
15. КЛЮЧЕВЫЕ АРХИТЕКТУРНЫЕ РЕШЕНИЯ
=============================================================

OnlyOffice: version_id (версии) и attachment_id (вложения).
  Файлы проксируются через /api/onlyoffice/file/route.ts.

Согласование: contract_id берётся из сессии в approve/route.ts (не из тела).

Realtime: Supabase Realtime.
  ContractsList: только INSERT (не UPDATE — иначе закрываются дропдауны).
  ContractTabs: UPDATE конкретного контракта.
  Чат: INSERT в approval_messages.

AI анализ вложений: attachment_id отдельно от version_id.
  При анализе вложения: version_id=null, attachment_id=<id>.

Реквизиты компаний: SELECT→UPDATE/INSERT вместо upsert.
  id исключается из тела: const { admin_bitrix_id, id, ...requisites } = body

Чек-лист исполнения:
  - API: /api/contract-checklist/route.ts
  - Компонент: ExecutionControl.tsx
  - Таблицы: contract_checklist + contract_checklist_archive
  - files[]: массив {file_url, file_name, source} — все документы сразу
  - Архивирование: map(({ id, ...item }) => ({ ...item, original_id: id }))
  - Восстановление: action='restore_archive' — меняет местами текущий и архив
  - check_archive=true в GET — проверяет наличие архива без загрузки пунктов
  - Даты: signed_date, effective_date, custom_date_label/value

Supabase в компонентах: supabaseClient с PUBLISHABLE_KEY.
Транслитерация: все файлы при загрузке + символ №→N.
Печать чата: utils/chatPrint.ts → buildChatHtml() (.ts, не .tsx).
