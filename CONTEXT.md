# CONTEXT.md — Эпотос-ЮрИнтел / Витрина Данных
Дата: 2026-05-28 (финальная версия сессии)
Статус: Спринт 3 — модуль генерации в активной доработке

=============================================================
1. О ПРОЕКТЕ
=============================================================
Название: Эпотос-ЮрИнтел (первый модуль платформы ЭПОТОС-Витрина Данных)
Компания: ГК ЭПОТОС (epotos.ru) — производство противопожарного оборудования
Дочерние: ООО Техно (ТХ), НПП ЭПОТОС (НПП), СПТ (СПТ), ОС (ОС), Эпотос-К (Э-К)

URL: https://epotos-ur-intel.vercel.app
GitHub: https://github.com/Roman-Epotos/EPOTOS-Ur-Intel
Битрикс24: https://gkepotos.bitrix24.ru/marketplace/app/248/
ВАЖНО: iframe-приложение в Битрикс24. Авторизация через Битрикс24 SSO.


=============================================================
2. ТЕХНОЛОГИЧЕСКИЙ СТЕК
=============================================================
Next.js 14, TypeScript, Tailwind CSS, Supabase (cloud) + pgvector
AI: OpenRouter (google/gemini-2.5-flash)
Редактор: OnlyOffice (https://office.epotos-port.ru)
Storage: Supabase (bucket: contracts, templates)
Хостинг: Vercel
Генерация .docx: JSZip (прямая замена {{field}} в XML)


=============================================================
3. ПУТЬ К ПРОЕКТУ
=============================================================
F:\ИСКУССТВЕННЫЙ ИНТЕЛЛЕКТ (AI)\ЭПОТОС-ВИТРИНА ДАННЫХ\ДОГОВОРЫ ЭПОТОС\EPOTOS-Ur-Intel

Шаблоны (исправленные, загружены в систему):
F:\ИСКУССТВЕННЫЙ ИНТЕЛЛЕКТ (AI)\ЭПОТОС-ВИТРИНА ДАННЫХ\ДОГОВОРЫ ЭПОТОС\шаблоны\templates_fixed\

Скрипты:
  шаблоны\prepare_templates.py — первичная подготовка меток
  шаблоны\add_fields.py — добавление бизнес-полей
  шаблоны\check_xml.py — исправление XML (py check_xml.py)
    INPUT = 'templates_fixed/ИМЯ_ФАЙЛА.docx' — меняй под нужный файл

ВАЖНО: терминал для скриптов — открыть папку шаблоны в VS Code → Ctrl+`


=============================================================
4. ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ
=============================================================
NEXT_PUBLIC_SUPABASE_URL=https://qmzyybisajjmneydekoo.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY — .env.local
OPENROUTER_API_KEY, BITRIX_CLIENT_ID, BITRIX_CLIENT_SECRET — .env.local
BITRIX_PORTAL=gkepotos.bitrix24.ru
BITRIX_WEBHOOK_URL=вебхук ЭПОТОС Ассистент (ID: 678)
ONLYOFFICE_URL=https://office.epotos-port.ru
YANDEX_DISK_TOKEN, DADATA_API_KEY — .env.local

ВАЖНО: Variables в Vercel — в левом меню (не в Settings!)
ВАЖНО: В Битрикс24 имя = "Фамилия Имя" → приветствие: split(' ')[1]


=============================================================
5. СТРУКТУРА БАЗЫ ДАННЫХ
=============================================================
GRANT SELECT,INSERT,UPDATE,DELETE ON public.<table> TO anon,authenticated,service_role;

Таблицы: contracts, versions, approval_sessions (+bitrix_chat_id),
  approval_participants, approval_messages, approval_settings,
  contract_logs, document_attachments, signed_documents,
  document_templates, ai_analysis,
  company_requisites (+short_name, signatory_name, poa_*),
  contract_checklist (+bitrix_task_id), contract_checklist_archive,
  counterparties — УНИКАЛЬНЫЙ КЛЮЧ: (inn, kpp)!
  system_roles — role CHECK IN ('admin','gc_manager','finance_gc','legal_gc')

approval_participants CHECK:
  status IN ('pending','approved','rejected','acknowledged',
             'disabled','completed_by_initiator')


=============================================================
6. НУМЕРАЦИЯ, ТИПЫ, СТАТУСЫ
=============================================================
Нумерация: ПРЕФИКС-ТИПКОД-ГОД/МЕСЯЦ/НН (сброс с 1 января, без padStart)

Типы активные:
  Договоры: поставка, услуги, аренда, подряд, купля-продажа,
    агентский, дилерский, лицензионный, сервисный, асц
  Соглашения: доп-соглашение, nda, эдо, протокол-разногласий
  Доверенности и согласия: доверенность, персданные

Статусы: черновик → на_согласовании → согласован → загружен_частично
  → подписан → на_исполнении (↘ отклонён)


=============================================================
7. АРХИТЕКТУРА РОЛЕЙ
=============================================================
1. developer (ID 30) — жёстко в коде
2-5. admin, gc_manager, finance_gc, legal_gc — из system_roles
6-8. director, legal, finance — из approval_settings
9. user — все остальные

Текущие system_roles: 1148→admin, 1→gc_manager, 246,504→legal_gc, 10,154→finance_gc
API: user-role/route.ts → role, companies, all_roles
     system-roles/route.ts → CRUD ролей ГК


=============================================================
8. РЕАЛИЗОВАННЫЙ ФУНКЦИОНАЛ
=============================================================
✅ Документы, версионирование, OnlyOffice, журнал аудита
✅ Согласование: сессии, Realtime, чат, уведомления Б24
✅ AI (EpotosGPT): Legal Review, Паспорт, анализ вложений
✅ Реквизиты компаний, реестр контрагентов (DaData)
✅ Дашборды с фильтром по компании
✅ Контроль исполнения, чек-листы, задачи Б24
✅ Автобэкап Яндекс.Диск (17:00), крон дедлайнов (09:00)

✅ МОДУЛЬ ГЕНЕРАЦИИ (28.05.2026):
  app/api/generate-from-template/route.ts
  app/components/GenerateFromTemplate.tsx
  Технология: JSZip — split("{{field}}").join(value) в XML
  runtime: nodejs, maxDuration: 60
  Вкладка «Генерация» между «Реквизиты» и «Документы»

  EXTRA_FIELDS ключи (= тип шаблона в БД):
    'дилерский' — territory, min_monthly_purchase_num, contract_end_date(date)
    'дилерский_снг' — определяется по названию шаблона (contains 'снг')
      territory_country, tax_authority_country, min_monthly_purchase_num, contract_end_date(date)
    'дилерский регион' — то же что дилерский_снг (запасной ключ)
    'асц' — territory, insurance_amount_num, transport_types, contract_end_date(date)
    'поставка' — payment_days, contract_end_date(date), territory_country, tax_authority_country
    'nda' — nda_penalty_num, nda_penalty_kopecks
    'эдо' — edo_operator, referenced_contract_date(date), contract_end_date(date)
      referenced_contract_number автоподставляется из карточки!
    'персданные' — subject_full_name, subject_birth_year, passport_series,
      passport_number, passport_issued_by, passport_dept_code, subject_address,
      subject_inn, subject_snils, pd_consent_date(date)
  Логика templateKey: если название содержит 'снг' → тип + '_снг'
  Контрагент скрыт для типа 'персданные'

  Автоконвертация прописью:
    nda_penalty_num → nda_penalty_text
    insurance_amount_num → insurance_amount_text
    min_monthly_purchase_num → min_monthly_purchase_text
  Фоллбэк: signatory_name пустой → director_name

  После генерации: скачать / добавить как версию / добавить как доп.материал
  router.refresh() + onUploaded() callback после загрузки
  ⚠️ router.refresh() вызывается ДВАЖДЫ — убрать дубль!
  ⚠️ console.log('Sending fields:') — убрать!

✅ ШАБЛОНЫ ООО ТЕХНО (загружены в систему, 28.05.2026):

  Статус проверки:
  ✅ Согласие на обработку ПД (персданные) — OK
  ✅ Соглашение о переходе на ЭДО (эдо) — OK
  ✅ Соглашение NDA (nda) — OK
  ✅ Дилерский договор РФ (дилерский) — OK
  ✅ Дилерский договор СНГ (дилерский регион, регион СНГ) — OK
  ✅ Договор АСЦ - без ТО (асц) — OK
  ⬜ Договор АСЦ - включая ТО (асц) — не проверен
  ⬜ Договор поставки РФ без авт. надзора (поставка) — не проверен
  ⬜ Договор поставки РФ с авт. надзором (поставка) — не проверен
  ⬜ Договор поставки СНГ (поставка, регион СНГ) — не проверен

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

  МЕТКИ КОНТРАГЕНТА (из реестра):
    {{counterparty_full_name}}, {{counterparty_short_name}}
    {{counterparty_signatory}}, {{counterparty_signatory_title}}, {{counterparty_basis}}
    {{counterparty_inn}}, {{counterparty_kpp}}, {{counterparty_ogrn}}
    {{counterparty_address}}, {{counterparty_phone}}, {{counterparty_email}}
    {{counterparty_bank_name}}, {{counterparty_bank_account}},
    {{counterparty_bank_bik}}, {{counterparty_bank_corr}}

  ТИПИЧНЫЕ ПРОБЛЕМЫ ШАБЛОНОВ:
    - Метки с пробелами {{ field }} — исправлять в Word Ctrl+H
    - Метки {{}} без имени — Word разбил имя, исправлять вручную
    - Дублирование строк — удалять один экземпляр
    - После правки в Word — ВСЕГДА прогонять check_xml.py!


=============================================================
9. ИЗВЕСТНЫЕ ПРОБЛЕМЫ / ТЕХНИЧЕСКИЙ ДОЛГ
=============================================================
⚠️ router.refresh() дважды в handleUploadToCard — убрать дубль
⚠️ console.log('Sending fields:') — убрать
⚠️ Шаблоны АСЦ-ТО, поставки (3 шт.) — ещё не проверены
⚠️ Шаблоны СПТ, НПП ЭПОТОС, Эпотос-К, ОС — не подготовлены
⚠️ Дата документа — показывает сегодня по умолчанию но в поле пусто
⚠️ Финансовый дашборд — фильтр не проверен (после 1 июня)
⚠️ AI модель в ai-analysis/route.ts — ещё gemini-2.0-flash-001
⚠️ Template Studio (ЭПОТОС-Core) — Спринт 4
⚠️ Ссылка из уведомления → главная (не конкретный документ)


=============================================================
10. ГДЕ ОСТАНОВИЛИСЬ (28.05.2026)
=============================================================
Сделано в эту сессию:
  ✅ Согласие ПД — скрыт контрагент, дата вместо лет, calendar picker
  ✅ ЭДО — counterparty_email, авто-номер договора, даты из календаря
  ✅ Дата документа → calendar picker для всех шаблонов
  ✅ EXTRA_FIELDS — правильные ключи (дилерский, поставка, эдо, персданные)
  ✅ Дилерский РФ — пробелы в маяках, сумма закупки, дата из календаря
  ✅ Дилерский СНГ — ключ дилерский_снг, п.3.1.15 территория
  ✅ АСЦ без ТО — телефон/банк контрагента, «Поставщик», сертификат
  ✅ NDA — фоллбэк director_name

Следующая сессия — план:
  1. Проверить Договор АСЦ - включая ТО
  2. Проверить Договор поставки РФ без авт. надзора
  3. Проверить Договор поставки РФ с авт. надзором
  4. Проверить Договор поставки СНГ
  5. Убрать console.log и дубль router.refresh()
  6. Подготовить шаблоны СПТ, НПП ЭПОТОС, Эпотос-К, ОС


=============================================================
11. ПЛАН РАЗРАБОТКИ
=============================================================
✅ Спринт 1, 2 — завершены
🔄 Спринт 3:
  ✅ Дашборды, реестр контрагентов, фильтры
  ✅ Динамические роли, оптимизация БД
  ✅ Модуль генерации документов
  ✅ Шаблоны ООО Техно (6 из 10 проверены)
  ⬜ Шаблоны Техно (4 осталось) + остальные компании
  ⬜ Мелкие доработки генерации

🔴 Спринт 4:
  - PWA, ЭПОТОС-Core Template Studio
  - Плагин AI для OnlyOffice
  - ЭПОТОС-ПЕРСОНАЛ
  - AI-Audit, умные зависимости в чек-листе


=============================================================
12. ПРАВИЛА РАБОТЫ
=============================================================
1. Файлы — New-Item в терминале, код — вставить в VS Code
2. Редактирование — Ctrl+H в VS Code (не PowerShell!)
3. Не более 3 блоков кода за раз
4. Перед деплоем КОДА — npm run build
5. CONTEXT.md — только по запросу, без build
6. Repomix — по необходимости, сколько угодно
7. ВСЕГДА указывать в каком файле правка
8. PowerShell команды — построчно в одном блоке
9. Python скрипты — терминал VS Code из папки шаблоны


=============================================================
13. АРХИТЕКТУРНЫЕ РЕШЕНИЯ
=============================================================
Уведомления: notify.ts — колокольчик + чат Б24
Крон: /api/backup (17МСК), /api/cron-checklist-deadline (9МСК)
Генерация: JSZip, шаблоны исправляются check_xml.py перед загрузкой
Контрагенты: DaData, уникальный ключ (inn, kpp)
AI: google/gemini-2.5-flash (OpenRouter)
  ⚠️ ai-analysis/route.ts — ещё gemini-2.0-flash-001, обновить!

Типы шаблонов в БД vs ключи EXTRA_FIELDS:
  дилерский → 'дилерский' (РФ) или 'дилерский_снг' (СНГ, по названию)
  асц → 'асц'
  поставка → 'поставка' (РФ и СНГ — одинаковые поля + territory_country для СНГ)
  nda → 'nda'
  эдо → 'эдо'
  персданные → 'персданные'
