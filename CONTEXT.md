# CONTEXT.md — Эпотос-ЮрИнтел / Витрина Данных
Дата: 2026-05-30
Статус: Спринт 3 — данные всех компаний заполнены, шаблоны остальных компаний на паузе

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
    INPUT = 'templates_fixed/ИМЯ_ФАЙЛА.docx' — менять под нужный файл
    Имена файлов — БЕЗ подчёркиваний вместо пробелов! Пример:
    INPUT = 'templates_fixed/Договор поставки товара для РФ с авторским надзором (версия от 06.02.2026).docx'

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
  company_requisites:
    Колонки: company_prefix, company_name, inn, kpp, ogrn,
      legal_address, actual_address, bank_name, bank_account,
      bank_bik, bank_corr_account, director_name, director_title,
      phone, email, website, short_name, signatory_name,
      poa_number, poa_date, poa_expires,
      director_short_name, basis, fax, warehouse_address
    (колонки director_short_name, basis, fax, warehouse_address добавлены 29.05.2026)
  contract_checklist (+bitrix_task_id), contract_checklist_archive,
  counterparties — УНИКАЛЬНЫЙ КЛЮЧ: (inn, kpp)!
  system_roles — role CHECK IN ('admin','gc_manager','finance_gc','legal_gc')

approval_participants CHECK:
  status IN ('pending','approved','rejected','acknowledged',
             'disabled','completed_by_initiator')

Данные company_requisites — все компании заполнены (30.05.2026):
  ✅ ТХ: director_short_name='Чащина Е.П.', basis='Устава',
         warehouse_address='Московская обл., г. Мытищи, ул. 1-ая Новая, вл. 57, стр.2'
  ✅ НПП: director_short_name='Веревка А.В.', basis='Устава',
          warehouse_address='Московская обл., г. Мытищи, ул. 1-ая Новая, вл. 57, стр.2'
  ✅ СПТ: director_short_name='Валюк А.Г.', basis='Устава',
          warehouse_address='196641, г. Санкт-Петербург, поселок Металлострой, ул. Дорога на Металлострой, д. 9Б'
  ✅ ОС:  director_short_name='Валюк А.Г.', basis='Устава',
          warehouse_address='196641, г. Санкт-Петербург, поселок Металлострой, ул. Дорога на Металлострой, д. 9Б'
  ✅ Э-К: director_short_name='Молоткин Е.А.', basis='Устава',
          warehouse_address='613048, Кировская область, Кирово-Чепецкий м.р-н, Чепецкое с.п., зд. 10'
  Все fax = NULL


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
✅ AI (EpotosGPT): Legal Review, Паспорт, анализ вложений — модель google/gemini-2.5-flash
✅ Реквизиты компаний, реестр контрагентов (DaData)
✅ Дашборды с фильтром по компании
✅ Контроль исполнения, чек-листы, задачи Б24
✅ Автобэкап Яндекс.Диск (17:00), крон дедлайнов (09:00)

✅ МОДУЛЬ ГЕНЕРАЦИИ (29.05.2026):
  app/api/generate-from-template/route.ts
  app/components/GenerateFromTemplate.tsx
  Технология: JSZip — split("{{field}}").join(value) в XML
  runtime: nodejs, maxDuration: 60
  Вкладка «Генерация» между «Реквизиты» и «Документы»

  EXTRA_FIELDS ключи (= тип шаблона в БД):
    'дилерский' — territory, min_monthly_purchase_num, contract_end_date(date)
    'дилерский_снг' — по названию шаблона (contains 'снг')
      territory_country, tax_authority_country, min_monthly_purchase_num, contract_end_date(date)
    'дилерский регион' — то же (запасной ключ)
    'асц' — territory, insurance_amount_num, transport_types, contract_end_date(date)
    'поставка' — payment_days, liability_limit_num, contract_end_date(date)
    'поставка_снг' — по названию (contains 'снг')
      payment_days, liability_limit_num, contract_end_date(date),
      territory_country, tax_authority_country
    'nda' — nda_penalty_num, nda_penalty_kopecks
    'эдо' — edo_operator, referenced_contract_date(date), contract_end_date(date)
      referenced_contract_number автоподставляется из карточки!
    'персданные' — subject_full_name, subject_birth_year, passport_series,
      passport_number, passport_issued_by, passport_dept_code, subject_address,
      subject_inn, subject_snils, pd_consent_date(date)
  Логика templateKey: если название содержит 'снг' → тип + '_снг'
  Контрагент скрыт для типа 'персданные'

  buildFields — поля компании из company_requisites:
    supplier_full_name ← company_name
    supplier_short_name ← short_name
    supplier_director_title ← director_title
    supplier_director_name ← director_name
    supplier_director_short_name ← director_short_name ?? director_name
    supplier_basis ← basis ?? 'Устава'
    supplier_ogrn ← ogrn
    supplier_inn ← inn
    supplier_kpp ← kpp
    supplier_legal_address ← legal_address
    supplier_warehouse_address ← warehouse_address
    supplier_phone ← phone
    supplier_fax ← fax
    supplier_email ← email
    supplier_bank_name ← bank_name
    supplier_bank_account ← bank_account
    supplier_bank_corr_account ← bank_corr_account
    supplier_bank_bik ← bank_bik

  Автоконвертация прописью:
    nda_penalty_num → nda_penalty_text
    insurance_amount_num → insurance_amount_text
    min_monthly_purchase_num → min_monthly_purchase_text
    liability_limit_num → liability_limit_text
  Фоллбэк: signatory_name пустой → director_name

  После генерации: скачать / добавить как версию / добавить как доп.материал

✅ ШАБЛОНЫ ООО ТЕХНО (все 10 проверены и загружены, 29.05.2026):
  ✅ Согласие на обработку ПД (персданные)
  ✅ Соглашение о переходе на ЭДО (эдо)
  ✅ Соглашение NDA (nda)
  ✅ Дилерский договор РФ (дилерский)
  ✅ Дилерский договор СНГ (дилерский регион, регион СНГ)
  ✅ Договор АСЦ - без ТО (асц)
  ✅ Договор АСЦ - включая ТО (асц)
  ✅ Договор поставки товара для РФ без авт. надзора (поставка)
  ✅ Договор поставки товара для РФ с авт. надзором (поставка)
  ✅ Договор поставки товара типовой для стран СНГ (поставка_снг)

⬜ ШАБЛОНЫ НПП ЭПОТОС — на паузе (нет файлов)
⬜ ШАБЛОНЫ СПТ — не подготовлены
⬜ ШАБЛОНЫ ОС — не подготовлены
⬜ ШАБЛОНЫ ЭПОТОС-К — не подготовлены

  ТИПИЧНЫЕ ПРОБЛЕМЫ ШАБЛОНОВ:
    - Маяки с пробелами {{ field }} — исправлять в Word Ctrl+H
    - Маяки {{}} без имени — Word разбил имя, исправлять вручную
    - Жёсткие суммы вместо маяков (например 1 000 000) — заменять на {{маяк}}
    - Дублирование строк — удалять один экземпляр
    - После правки в Word — ВСЕГДА прогонять check_xml.py!
    - После check_xml.py — ОБЯЗАТЕЛЬНО загружать в систему!


=============================================================
9. ИЗВЕСТНЫЕ ПРОБЛЕМЫ / ТЕХНИЧЕСКИЙ ДОЛГ
=============================================================
⚠️ Шаблоны НПП ЭПОТОС — на паузе (нет файлов)
⚠️ Шаблоны СПТ, ОС, Эпотос-К — не подготовлены
⚠️ Финансовый дашборд — фильтр не проверен (после 1 июня)
⚠️ Template Studio (ЭПОТОС-Core) — Спринт 4
⚠️ Ссылка из уведомления → главная (не конкретный документ)


=============================================================
10. ГДЕ ОСТАНОВИЛИСЬ (30.05.2026)
=============================================================
Сделано в эту сессию:
  ✅ Данные company_requisites заполнены для НПП, СПТ, ОС, Э-К
  ✅ AI модель обновлена на google/gemini-2.5-flash в ai-analysis/route.ts

Следующая сессия — план:
  1. Подготовить шаблоны СПТ (загрузить файлы → проверить маяки → check_xml.py → загрузить)
  2. Подготовить шаблоны ОС
  3. Подготовить шаблоны Эпотос-К
  4. Подготовить шаблоны НПП (когда появятся файлы)
  5. Проверить финансовый дашборд (после 1 июня)


=============================================================
11. ПЛАН РАЗРАБОТКИ
=============================================================
✅ Спринт 1, 2 — завершены
🔄 Спринт 3:
  ✅ Дашборды, реестр контрагентов, фильтры
  ✅ Динамические роли, оптимизация БД
  ✅ Модуль генерации документов
  ✅ Шаблоны Техно (все 10) — завершены
  ✅ Данные company_requisites для всех компаний — завершены
  ✅ AI модель обновлена на gemini-2.5-flash
  ⬜ Шаблоны остальных компаний (НПП, СПТ, ОС, Эпотос-К)

🔴 Спринт 4:
  - PWA, ЭПОТОС-Core Template Studio
  - Плагин AI для OnlyOffice (выделение + AI команды)
  - ЭПОТОС-ПЕРСОНАЛ
  - AI-Audit, умные зависимости в чек-листе


=============================================================
12. ПРАВИЛА РАБОТЫ
=============================================================
1. Файлы — New-Item в PowerShell, код — вставить в VS Code
2. Редактирование — ТОЛЬКО Ctrl+H в VS Code (не PowerShell!)
3. Не более 3 блоков кода за раз с пояснениями
4. Перед деплоем КОДА — npm run build в терминале VS Code
5. CONTEXT.md — только по запросу, без build, сразу git push
6. Repomix — по необходимости, сколько угодно часто
7. ВСЕГДА указывать в каком файле производится правка
8. PowerShell команды — построчно в одном блоке
9. Python скрипты — терминал VS Code из папки шаблоны (py script.py)
10. После правки шаблона в Word — ВСЕГДА check_xml.py → загрузить в систему
11. При зависании деплоя Vercel — git commit --allow-empty + git push
12. Repomix — всегда 3 команды:
    npx repomix --config repomix-api.config.json
    npx repomix --config repomix-components.config.json
    npx repomix --config repomix-pages.config.json
13. Деплой — всегда 3 строки в одном блоке:
    git add -A
    git commit -m "..."
    git push


=============================================================
13. АРХИТЕКТУРНЫЕ РЕШЕНИЯ
=============================================================
Уведомления: notify.ts — колокольчик + чат Б24
Крон: /api/backup (17МСК), /api/cron-checklist-deadline (9МСК)
Генерация: JSZip, шаблоны исправляются check_xml.py перед загрузкой
Контрагенты: DaData, уникальный ключ (inn, kpp)
AI: google/gemini-2.5-flash (OpenRouter) — все маршруты

Типы шаблонов в БД vs ключи EXTRA_FIELDS:
  дилерский → 'дилерский' (РФ) или 'дилерский_снг' (СНГ, по названию)
  асц → 'асц'
  поставка → 'поставка' (РФ) или 'поставка_снг' (СНГ, по названию)
  nda → 'nda'
  эдо → 'эдо'
  персданные → 'персданные'

Проблема разбивки XML runs в Word:
  Word разбивает {{field_name}} на несколько XML runs при сохранении
  Решение: check_xml.py исправляет runs склеивая {{ + имя + }} в один run
  После КАЖДОЙ правки шаблона в Word → py check_xml.py → загрузить в систему
