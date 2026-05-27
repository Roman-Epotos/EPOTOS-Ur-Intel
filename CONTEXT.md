# CONTEXT.md — Эпотос-ЮрИнтел / Витрина Данных
Дата: 2026-05-27 (финальная версия сессии)
Статус: Спринт 3 — модуль генерации в активной доработке

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
- AI: OpenRouter (google/gemini-2.5-flash)
- Авторизация: Битрикс24 SSO
- Редактор: OnlyOffice (Docker, Selectel, https://office.epotos-port.ru)
- Storage: Supabase (bucket: contracts, templates)
- Хостинг: Vercel
- Генерация .docx: JSZip (прямая замена меток в XML)


=============================================================
3. ПУТЬ К ПРОЕКТУ
=============================================================
F:\ИСКУССТВЕННЫЙ ИНТЕЛЛЕКТ (AI)\ЭПОТОС-ВИТРИНА ДАННЫХ\ДОГОВОРЫ ЭПОТОС\EPOTOS-Ur-Intel

Шаблоны договоров (исправленные, загружены в систему):
F:\ИСКУССТВЕННЫЙ ИНТЕЛЛЕКТ (AI)\ЭПОТОС-ВИТРИНА ДАННЫХ\ДОГОВОРЫ ЭПОТОС\шаблоны\templates_fixed\

Скрипты подготовки шаблонов:
  шаблоны\prepare_templates.py — первичная подготовка меток
  шаблоны\add_fields.py — добавление бизнес-полей
  шаблоны\check_xml.py — исправление XML тегов (запуск: py check_xml.py)

ВАЖНО по скриптам:
  - Открывать папку шаблоны в VS Code отдельно
  - Терминал открывать через VS Code (Ctrl+`) — уже в нужной папке
  - Команда: py check_xml.py (не python, не python3)
  - check_xml.py обрабатывает один файл (INPUT = 'templates_fixed/...')


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

Таблицы:
  contracts (+ counterparty_id UUID → counterparties.id)
  versions, approval_sessions (+ bitrix_chat_id INTEGER)
  approval_participants, approval_messages, approval_settings
  contract_logs, document_attachments, signed_documents
  document_templates, ai_analysis
  company_requisites (+ short_name, signatory_name, poa_number, poa_date, poa_expires)
  contract_checklist (+ bitrix_task_id TEXT), contract_checklist_archive
  counterparties (+ signatory_name, poa_number, poa_date, poa_expires)
    УНИКАЛЬНЫЙ КЛЮЧ: (inn, kpp) — составной!
  system_roles

Таблица system_roles:
  id UUID PRIMARY KEY, bitrix_user_id INTEGER UNIQUE,
  user_name TEXT, role TEXT, created_by INTEGER, created_at TIMESTAMPTZ
  CHECK role IN ('admin','gc_manager','finance_gc','legal_gc')

Индексы: idx_contracts_status_created, idx_contracts_number, idx_contracts_author,
  idx_approval_participants_user_status, idx_approval_sessions_contract,
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

Типы активные:
  Договоры: поставка, услуги, аренда, подряд, купля-продажа,
    агентский, дилерский, лицензионный, сервисный, асц
  Соглашения: доп-соглашение, nda, эдо, протокол-разногласий
  Доверенности и согласия: доверенность, персданные

Статусы:
  черновик → на_согласовании → согласован → загружен_частично → подписан → на_исполнении
                             ↘ отклонён
  UI: подписан="Документы загружены", на_исполнении="На контроле исполнения"


=============================================================
7. АРХИТЕКТУРА РОЛЕЙ
=============================================================
ИЕРАРХИЯ:
  1. developer — ID 30, жёстко в коде
  2. admin — из system_roles
  3. gc_manager — из system_roles
  4. finance_gc — из system_roles
  5. legal_gc — из system_roles
  6. director — из approval_settings (stage=director)
  7. legal — из approval_settings (stage=legal)
  8. finance — из approval_settings (stage=finance/accounting)
  9. user — все остальные

ТЕКУЩИЕ НАЗНАЧЕНИЯ system_roles:
  ID 1148 → admin
  ID 1 (Чащина Елена) → gc_manager
  ID 246 (Ершова Евгения) → legal_gc
  ID 504 (Кочкин Сергей) → legal_gc
  ID 10 (Демин Александр) → finance_gc
  ID 154 (Архипова Ольга) → finance_gc

API: app/api/user-role/route.ts → role, companies, all_roles
     app/api/system-roles/route.ts → CRUD ролей ГК


=============================================================
8. РЕАЛИЗОВАННЫЙ ФУНКЦИОНАЛ
=============================================================
✅ Документы: список, создание, версионирование, OnlyOffice, журнал аудита
✅ Нумерация: сброс с 1 января, без ведущих нулей
✅ Роли: динамические через system_roles + approval_settings
✅ Согласование: сессии, участники, Realtime, автозавершение, чат
✅ AI (EpotosGPT): Legal Review, Паспорт, анализ вложений, чат
✅ Реквизиты компаний: CRUD + все поля включая банк
✅ Контроль исполнения: AI чек-лист, архив, даты
✅ Реестр контрагентов: DaData, уникальный ключ (inn,kpp)
✅ Дашборды: рабочий стол, юридический, финансовый
✅ Фильтр по компании в дашбордах (finance + legal) ✅
✅ Автобэкап на Яндекс.Диск (17:00 МСК)

✅ МОДУЛЬ ГЕНЕРАЦИИ ДОКУМЕНТОВ (27.05.2026):
  Файлы:
    app/api/generate-from-template/route.ts
    app/components/GenerateFromTemplate.tsx
  Технология: JSZip — прямая замена {{field}} в XML
  runtime: nodejs, maxDuration: 60
  Вкладка «Генерация» между «Реквизиты» и «Документы»

  EXTRA_FIELDS ключи (должны совпадать с типом шаблона в БД):
    'дилерский' — territory, min_monthly_purchase_num, contract_end_date
    'асц' — territory, insurance_amount_num, transport_types, contract_end_date
    'поставка' — payment_days, contract_end_date, territory_country, tax_authority_country
    'nda' — nda_penalty_num, nda_penalty_kopecks
    'эдо' — edo_operator, referenced_contract_number, referenced_contract_date, contract_end_date
    'персданные' — subject_full_name, subject_birth_year, passport_series,
      passport_number, passport_issued_by, passport_dept_code, subject_address,
      subject_inn, subject_snils, pd_consent_years
  Старые ключи (dealer_rf, supply_rf, etc.) оставлены для совместимости

  Автоконвертация прописью:
    nda_penalty_num → nda_penalty_text
    insurance_amount_num → insurance_amount_text
    min_monthly_purchase_num → min_monthly_purchase_text

  Поля контрагента (из реестра):
    counterparty_full_name, counterparty_short_name, counterparty_signatory,
    counterparty_signatory_title, counterparty_basis, counterparty_inn,
    counterparty_kpp, counterparty_ogrn, counterparty_address, counterparty_phone,
    counterparty_bank_name, counterparty_bank_account, counterparty_bank_bik,
    counterparty_bank_corr, counterparty_email
  Фоллбэк: если signatory_name пустой → берём director_name

  После генерации — 3 действия:
    1. Скачать на компьютер
    2. Добавить как основной документ (→ /api/versions)
    3. Добавить как доп. материал (→ /api/attachments)
  router.refresh() + onUploaded() callback после загрузки

✅ ШАБЛОНЫ ООО ТЕХНО (10 шаблонов, загружены в систему):
  Дилерский договор РФ — тип: дилерский
  Дилерский договор СНГ — тип: дилерский
  Договор АСЦ - без ТО — тип: асц
  Договор АСЦ - включая ТО — тип: асц
  Договор поставки РФ без авт. надзора — тип: поставка
  Договор поставки РФ с авт. надзором — тип: поставка
  Договор поставки СНГ — тип: поставка
  Согласие на обработку ПД — тип: персданные
  Соглашение NDA — тип: nda
  Соглашение о переходе на ЭДО — тип: эдо

  Все шаблоны прошли через check_xml.py (исправление XML runs)

  ⚠️ ТРЕБУЕТ ПРОВЕРКИ В СЛЕДУЮЩЕЙ СЕССИИ:
    - Согласие на обработку ПД — большинство маяков не заменялось
      (после фикса EXTRA_FIELDS ключей должно работать)
    - Дилерский договор РФ — п.2.2 жёсткая сумма (2 000 000)
      нужно заменить в шаблоне на {{min_monthly_purchase_num}}
    - Дилерский договор РФ — раздел 10 лишнее подчёркивание после названия
    - Договор АСЦ - без ТО — п.3.1.22 жёсткая сумма (120 000 000)
    - Все шаблоны — дата договора через текстовое поле → нужен календарь

  МЕТКИ НАШЕЙ КОМПАНИИ (авто из company_requisites):
    {{supplier_full_name}}, {{supplier_short_name}}
    {{supplier_director_title}}, {{supplier_director_name}}, {{supplier_director_short_name}}
    {{supplier_basis}}, {{supplier_ogrn}}, {{supplier_inn}}, {{supplier_kpp}}
    {{supplier_legal_address}}, {{supplier_warehouse_address}}
    {{supplier_phone}}, {{supplier_fax}}, {{supplier_email}}
    {{supplier_bank_name}}, {{supplier_bank_account}},
    {{supplier_bank_corr_account}}, {{supplier_bank_bik}}

  МЕТКИ ДОКУМЕНТА (авто):
    {{contract_number}}, {{contract_date}}, {{contract_day}},
    {{contract_month}}, {{contract_year}}


=============================================================
9. ИЗВЕСТНЫЕ ПРОБЛЕМЫ / ТЕХНИЧЕСКИЙ ДОЛГ
=============================================================
⚠️ Дата договора в генерации — текстовое поле, нужен calendar picker
⚠️ Дилерский РФ — п.2.2 жёсткая сумма, Дилерский СНГ исправлен ✅
⚠️ АСЦ без ТО — п.3.1.22 жёсткая сумма 120 000 000
⚠️ Согласие ПД — проверить после фикса ключей EXTRA_FIELDS
⚠️ Шаблоны СПТ, НПП ЭПОТОС, Эпотос-К, ОС — не подготовлены
⚠️ Кнопка «Добавить нового контрагента» в генерации — не реализована
⚠️ Финансовый дашборд — фильтр по компании не проверен (после 1 июня)
⚠️ Ссылка из уведомления → главная (не конкретный документ)
⚠️ Realtime статуса — требует репликации Supabase
⚠️ AI модель в ai-analysis/route.ts — ещё gemini-2.0-flash-001, обновить
⚠️ console.log в generate-from-template (Sending fields) — убрать
⚠️ router.refresh() вызывается дважды в handleUploadToCard — убрать дубль
⚠️ Template Studio (ЭПОТОС-Core) — подготовка шаблонов с ИИ — Спринт 4


=============================================================
10. ГДЕ ОСТАНОВИЛИСЬ (27.05.2026)
=============================================================
Сделано в эту сессию:
  ✅ Модуль генерации — полностью работает (JSZip замена)
  ✅ Реквизиты контрагента подставляются в документы
  ✅ Автоконвертация сумм прописью (NDA, АСЦ, дилерские)
  ✅ Загрузка сгенерированного документа в карточку (версия/доп.материал)
  ✅ История действий при генерации
  ✅ EXTRA_FIELDS ключи исправлены (дилерский, поставка, эдо, персданные)
  ✅ 10 шаблонов ООО Техно обновлены и загружены в систему
  ✅ Фоллбэк director_name если signatory_name пустой

Следующая сессия — план:
  1. Проверить Согласие ПД после фикса ключей
  2. Исправить дилерский РФ (п.2.2) и АСЦ без ТО (п.3.1.22)
  3. Добавить calendar picker для даты договора
  4. Убрать console.log и дубль router.refresh()
  5. Подготовить шаблоны СПТ, НПП ЭПОТОС, Эпотос-К, ОС


=============================================================
11. ПОЛНЫЙ ПЛАН РАЗРАБОТКИ
=============================================================
✅ СПРИНТ 1, 2 — ЗАВЕРШЕНЫ
🔄 СПРИНТ 3 (май-июнь 2026):
  ✅ Рабочий стол, реестр контрагентов, дашборды с фильтрами
  ✅ Динамические роли через system_roles
  ✅ Оптимизация БД (индексы + ИНН+КПП)
  ✅ Модуль генерации документов из шаблонов
  ✅ Шаблоны ООО Техно (10 шт.)
  ⬜ Шаблоны остальных компаний (СПТ, НПП, ОС, Э-К)
  ⬜ Доработка генерации (calendar, мелкие баги)

🔴 СПРИНТ 4 (июль 2026):
  - PWA
  - ЭПОТОС-Core: Template Studio (подготовка шаблонов с ИИ)
  - Плагин ЭПОТОС AI для OnlyOffice (выделение + AI команды)
  - Умные зависимости в чек-листе
  - AI-Audit логирование промптов
  - ЭПОТОС-ПЕРСОНАЛ (новый модуль Витрины данных)

🔴 ФИНАЛ: фикс ссылки из уведомления, Realtime статусов


=============================================================
12. СТРАТЕГИЧЕСКИЕ ПРИОРИТЕТЫ
=============================================================
- ЭПОТОС-Core: Template Studio — подготовка шаблонов для всех модулей
- Event Bus в Core
- Контрагент как central entity + AI-score риска
- CoreB24Adapter → прототип: app/lib/bitrix/tasks.ts
- core_activity_feed — единая лента событий
- AI Digest на рабочем столе
- CEO Dashboard с предиктивной аналитикой
- PWA — Спринт 4
- RPC get_user_context() → перед ЭПОТОС-Core
- Supabase RLS → после стабилизации архитектуры
- ЭПОТОС-ПЕРСОНАЛ — следующий большой модуль


=============================================================
13. ПРАВИЛА РАБОТЫ В ЧАТЕ
=============================================================
1. Создание файлов — ТОЛЬКО через терминал:
   New-Item -Path "путь\к\файлу" -ItemType File -Force
   Затем открыть в VS Code и вставить код.

2. Редактирование — ТОЛЬКО вручную через VS Code (Ctrl+H)
   НЕЛЬЗЯ через PowerShell — портит кодировку!

3. Не более 3 блоков кода за раз с пояснениями.

4. Перед деплоем КОДА — npm run build в терминале VS Code.
   При деплое только CONTEXT.md — сразу git команды.

5. Если фрагмент Ctrl+H не найден — обновить repomix.

6. Код предлагается ОДИН РАЗ и только правильный вариант.

7. ВСЕГДА указывать в каком файле производится действие.

8. Repomix — по необходимости, сколько угодно часто.
   CONTEXT.md — только по явному запросу.

9. Команды в PowerShell — построчно в одном блоке.

10. Python скрипты — терминал VS Code из папки шаблоны.
    Команда: py script.py

11. При деплое CONTEXT: замени файл в проекте → git push (без build).


=============================================================
14. КЛЮЧЕВЫЕ АРХИТЕКТУРНЫЕ РЕШЕНИЯ
=============================================================
Уведомления (app/lib/notify.ts):
  sendBitrixNotify, createBitrixChat, addUserToBitrixChat, sendBitrixChatMessage

Крон (vercel.json):
  /api/backup — 17:00 МСК → Яндекс.Диск
  /api/cron-checklist-deadline — 09:00 МСК

Генерация документов:
  JSZip: загрузить .docx → XML → split("{{field}}").join(value) → сохранить
  Шаблон обрабатывается check_xml.py перед загрузкой в систему
  Проблема разбивки runs решена на уровне подготовки шаблонов (не сервер)

Контрагенты: DaData POST findById/party, уникальный ключ (inn, kpp)
OnlyOffice: прокси /api/onlyoffice/file/route.ts
AI: google/gemini-2.5-flash (OpenRouter)
  ВНИМАНИЕ: в ai-analysis/route.ts ещё старая модель — обновить!

Дата в генерации: текстовое поле (TODO: заменить на calendar picker)
Типы шаблонов в БД = ключи EXTRA_FIELDS:
  дилерский, асц, поставка, nda, эдо, персданные
