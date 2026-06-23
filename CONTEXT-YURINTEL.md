# CONTEXT-YURINTEL.md — ЮрИнтел-Эпотос
Дата: 2026-06-23
Статус: Спринт 4 активен

=============================================================
1. О ПРОЕКТЕ
=============================================================
Название: ЮрИнтел-Эпотос (первый модуль платформы ЭПОТОС-Витрина Данных)
Компания: ГК ЭПОТОС (epotos.ru) — производство противопожарного оборудования
Дочерние: ООО Техно (ТХ), НПП ЭПОТОС (НПП), СПТ (СПТ), ОС (ОС), Эпотос-К (Э-К)

URL: https://epotos-ur-intel.vercel.app
GitHub: https://github.com/Roman-Epotos/EPOTOS-Ur-Intel
Битрикс24: https://gkepotos.bitrix24.ru/marketplace/app/248/
ВАЖНО: iframe-приложение в Битрикс24. Авторизация через Битрикс24 SSO.
Название в Б24: ЮрИнтел-Эпотос (переименовано 22.06.2026)

Путь к проекту: F:\ИСКУССТВЕННЫЙ ИНТЕЛЛЕКТ (AI)\ЭПОТОС-ВИТРИНА ДАННЫХ\ДОГОВОРЫ ЭПОТОС\EPOTOS-Ur-Intel


=============================================================
2. ТЕХНОЛОГИЧЕСКИЙ СТЕК
=============================================================
Next.js 14, TypeScript, Tailwind CSS, Supabase (cloud) + pgvector
AI основная: OpenRouter (google/gemini-2.5-flash)
AI PDF сравнение: OpenRouter (anthropic/claude-sonnet-4-5) — ПЛАТНАЯ! только ai-document-compare
Редактор: OnlyOffice (https://office.epotos-port.ru)
Storage: Supabase (buckets: contracts PUBLIC, templates PUBLIC, counterparty-docs PUBLIC)
Хостинг: Vercel
Генерация .docx: JSZip (прямая замена {{field}} в XML)
PDF извлечение текста: unpdf — нестабилен на Vercel! Показываем ошибку


=============================================================
3. ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ
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
4. СТРУКТУРА БАЗЫ ДАННЫХ
=============================================================
GRANT SELECT,INSERT,UPDATE,DELETE ON public.<table> TO anon,authenticated,service_role;
RLS включён на всех таблицах.

Основные таблицы:
  contracts, versions, approval_sessions (+bitrix_chat_id),
  approval_participants, approval_messages, approval_settings,
  contract_logs, document_attachments, signed_documents,
  document_templates, ai_analysis, ai_chats,
  contract_checklist (+bitrix_task_id), contract_checklist_archive,
  counterparties — УНИКАЛЬНЫЙ КЛЮЧ: (inn, kpp)!
  system_roles — role CHECK IN ('admin','gc_manager','finance_gc','finance_company','legal_gc')
  company_directors — справочник ГД (НЕ используется для ЭДО!)
  edo_specialists — специалисты ЭДО по компаниям (таблица есть но выбор убран из UI)
  user_badge_seen — last_seen_at (bitrix_user_id UNIQUE)

  counterparties — дополнительные поля:
    is_foreign BOOLEAN DEFAULT FALSE
    country TEXT
    registration_number TEXT
    Иностранные контрагенты: inn = 'FOREIGN-{timestamp}', kpp = NULL
    Поиск по иностранным: только по нашей базе (без DaData)

  counterparty_documents:
    id, counterparty_id → counterparties(CASCADE),
    category (charter/poa/order/other), file_name, file_url, file_type,
    uploaded_by_id, uploaded_by_name, created_at
    Storage bucket: counterparty-docs (PUBLIC)
    ВАЖНО: загрузка напрямую в Supabase через presigned URL (uploadFileDirect)

  counterparty_checks — кэш проверок надёжности (10 дней):
    id, counterparty_id → counterparties(CASCADE),
    inn, checked_at, expires_at (NOW() + 10 days),
    risk_level CHECK IN ('low','medium','high'),
    dadata JSONB, fssp JSONB, bankrupt JSONB, rnp JSONB,
    summary TEXT, created_at

  company_requisites:
    company_prefix, company_name, inn, kpp, ogrn,
    legal_address, actual_address, warehouse_address,  ← НОВОЕ ПОЛЕ
    bank_name, bank_account, bank_bik, bank_corr_account,
    director_name, director_title, phone, email, website,
    short_name, signatory_name, poa_number, poa_date, poa_expires,
    director_short_name, basis, fax

  approval_sessions — ЭДО поля:
    edo_requested, edo_requested_by_id, edo_requested_by_name, edo_requested_at
    edo_director_bitrix_id, edo_director_name
    edo_director_decision CHECK IN ('approved','rejected'), edo_director_decided_at
    signing_method CHECK IN ('edo','simple')
    signing_method_set_by_id, signing_method_set_by_name, signing_method_set_at
    edo_specialist_bitrix_id, edo_specialist_name, edo_task_sent_at
    ВАЖНО: выбор специалиста ЭДО убран из UI — подписание происходит вне системы

approval_participants:
  status IN ('pending','approved','rejected','acknowledged','disabled','completed_by_initiator')
  role: 'required' (согласует) | 'optional' (ознакамливается)
  ВАЖНО: при запуске согласования обязательны ГД (director) и Бухгалтерия (accounting)

company_requisites заполнены:
  ТХ: director_short_name='Чащина Е.П.', НПП: 'Веревка А.В.'
  СПТ/ОС: 'Валюк А.Г.', Э-К: 'Молоткин Е.А.', все basis='Устава', fax=NULL
  warehouse_address заполнен для всех компаний


=============================================================
5. НУМЕРАЦИЯ, ТИПЫ, СТАТУСЫ
=============================================================
Нумерация: ПРЕФИКС-ТИПКОД-ГОД/МЕСЯЦ/НН
Дочерние: номер родителя + замена типа + суффикс -N
ВАЖНО: Э-К имеет двойной префикс → company_prefix из БД или startsWith('Э-К')

Статусы: черновик → на_согласовании → согласован → [на_подписи_в_эдо →]
  загружен_частично → подписан → на_исполнении (↘ отклонён)

LOCKED_STATUSES = ['согласован','на_подписи_в_эдо','загружен_частично','подписан','на_исполнении']


=============================================================
6. АРХИТЕКТУРА РОЛЕЙ
=============================================================
1. developer (ID 30) — жёстко в коде
2-6. admin, gc_manager, finance_gc, finance_company, legal_gc — из system_roles
7-9. director, legal, finance — из approval_settings
10. user — все остальные

system_roles: 1148→admin, 1→gc_manager, 246/504→legal_gc, 10/154→finance_gc
ADMIN_IDS = [30, 1148]


=============================================================
7. РЕАЛИЗОВАННЫЙ ФУНКЦИОНАЛ
=============================================================
✅ CORE: документы, версионирование, OnlyOffice, журнал аудита
✅ СОГЛАСОВАНИЕ: сессии, Realtime, чат, уведомления Б24
✅ ГД и Бухгалтерия обязательны при запуске согласования
✅ Отмена согласования: ГД — своего, Admin — любого + причина в чат
✅ AI (EpotosGPT): Legal Review, Паспорт, Анализ — gemini-2.5-flash
✅ Реквизиты компаний + поле «Адрес склада» (warehouse_address)
✅ Реестр контрагентов (DaData + иностранные)
✅ Дашборды: юридический, финансовый
✅ Контроль исполнения, чек-листы, задачи Б24
✅ Автобэкап Яндекс.Диск (17:00), крон дедлайнов (09:00)
✅ Крон ЭДО-напоминания (07:00) — через 3 дня если файл не загружен
✅ Soft delete, Помощь и поддержка, Связанные документы
✅ Inline edit реквизитов + блокировка LOCKED_STATUSES
✅ AI сравнение подписанного документа (Claude — ПЛАТНАЯ!)
✅ Генерация шаблонов (JSZip):
   ТХ — все 10 шаблонов
   СПТ — Договор поставки (загружен и протестирован ✅)
   ОС — Договор поставки (тот же шаблон, другая компания)
✅ Реестр контрагентов: поиск + DaData + иностранные
✅ Проверка надёжности контрагентов: DaData, ФССП, ЕФРСБ, РНП ФАС
✅ Вкладки карточки: Реквизиты/Чат + История
✅ Инструкция пользователя + база знаний ЭПОТОС-Ассистента
✅ Документы контрагента в карточке договора
✅ Прокси файлов Supabase через Vercel (proxyUrl)
✅ Прямая загрузка файлов в Supabase (uploadFileDirect + upload-proxy fallback)
✅ Бейдж статуса ЭДО на главной + улучшенные уведомления
✅ Переименование: ЮрИнтел-Эпотос
✅ Таблица документов: статус всегда виден
✅ Безопасность: редирект гостей на Б24 (window.self === window.top)
✅ ЭДО упрощён: убран выбор специалиста, подписание вне системы
✅ Уведомление участникам при загрузке подписанного файла
✅ GenerateFromTemplate: поставка_спт без лимита ответственности
✅ Фикс company_prefix для Э-К в модалке добавления участника


=============================================================
8. ИЗВЕСТНЫЕ ПРОБЛЕМЫ / НА ПАУЗЕ
=============================================================
⚠️ PDF анализ — просим конвертировать в DOCX (unpdf нестабилен)
⚠️ Баг: выпадашки «Для информирования»/«Обязательный» за границами блока
    в форме запуска согласования — НА ПАУЗЕ
⚠️ Баг: кнопка загрузки в базе знаний зависает на ⏳ — отложено до Core
⚠️ Горизонтальный скролл на главной при бейдже ЭДО — оставлен намеренно
⬜ Drag & drop для загрузки подписанного файла — в плане


=============================================================
9. ГДЕ ОСТАНОВИЛИСЬ (23.06.2026)
=============================================================
Сделано в текущую сессию:
  ✅ Исправлена мобильная уязвимость (редирект гостей на Б24)
  ✅ Исправлен upload-proxy fallback для России
  ✅ ЭДО упрощён (убран специалист ЭДО)
  ✅ Бухгалтерия и ГД обязательны при согласовании
  ✅ Уведомления при загрузке подписанного файла
  ✅ Крон-напоминание ЭДО через 3 дня
  ✅ Поле «Адрес склада» в реквизитах компаний
  ✅ Шаблон СПТ Договор поставки — готов и загружен
  ✅ GenerateFromTemplate: поставка_спт без лимита ответственности

Следующие задачи (по приоритету):
  1. Шаблоны ОС — тот же файл СПТ, загрузить с company_prefix=ОС
  2. Остальные шаблоны СПТ/ОС/Эпотос-К (заготовки у Романа)
  3. Drag & drop для загрузки подписанного файла
  4. ЭПОТОС-ПЕРСОНАЛ


=============================================================
10. ПЛАН РАЗРАБОТКИ
=============================================================
✅ Спринт 1, 2, 3 — завершены
🔄 Спринт 4 (активен):
  ✅ ЭПОТОС-Ассистент, иностранные контрагенты, файлы контрагента
  ✅ Переключатель рос/иностр, инструкция, проверка надёжности
  ✅ Реорганизация вкладок, документы контрагента в карточке
  ✅ Прокси + прямая загрузка файлов
  ✅ Отмена согласования, бейдж ЭДО, переименование
  ✅ Фикс таблицы + прокрутка, мобильная безопасность
  ✅ ЭДО упрощён, уведомления загрузки, крон-напоминание
  ✅ Адрес склада, шаблон СПТ поставка
  ⬜ Шаблоны ОС / остальные СПТ/ОС/Э-К
  ⬜ Drag & drop загрузка подписанного файла
  ⬜ ЭПОТОС-ПЕРСОНАЛ

🔴 Спринт 5:
  - Шаблоны НПП
  - Импорт договоров из Excel
  - Календарь судебных заседаний
  - Эпотос-РИД


=============================================================
11. АРХИТЕКТУРНЫЕ РЕШЕНИЯ
=============================================================
Безопасность:
  auth_id → sessionStorage → /api/bitrix/verify → Б24 profile API
  Без auth_id в sessionStorage И без URL params → редирект на Б24
  window.self === window.top → значит открыт не в iframe (прямая ссылка)
  Мобильный Б24: нет auth_id → разрешаем (storedUser без auth_id)

ЭДО (упрощённый алгоритм):
  1. Финансист → запрос у ГД (edo_request)
  2. ГД → решение ✅/❌ (edo_decision) — уведомление инициатору персонально
  3. Финансист → выбирает ЭДО или простую подпись (без назначения специалиста)
  4. Подписание происходит вне системы
  5. Бухгалтер или инициатор → загружает подписанный файл
  6. Система → уведомляет всех участников (documents_uploaded)
  Крон /api/cron/edo-reminder — каждый день 07:00, напоминание через 3 дня

Прямая загрузка файлов:
  Утилита: app/utils/uploadFile.ts → uploadFileDirect(file, bucket, folder)
  Сначала пробует PUT на signed_url Supabase (быстро)
  Fallback: POST /api/upload-proxy (через Vercel, для России)
  API presigned: POST /api/counterparties/upload-url
  Разрешённые buckets: counterparty-docs, contracts

Прокси файлов Supabase:
  API: GET /api/file-proxy?url=...
  Утилита: app/utils/proxyUrl.ts → proxyUrl(url)

Шаблоны документов:
  После правки в Word → py check_xml.py → загрузить из шаблоны\
  ВАЖНО: check_xml.py нужно указывать INPUT = 'НазваниеФайла.docx' (без templates_fixed)
  Готовы: ТХ (10), СПТ (1 — поставка)
  В работе: ОС (тот же файл СПТ), Э-К

  Метки шаблонов (34 штуки):
  supplier_*: full_name, short_name, director_title, director_name,
    director_short_name, basis, ogrn, inn, kpp, legal_address,
    warehouse_address, phone, fax, email, bank_name, bank_account,
    bank_corr_account, bank_bik
  counterparty_*: full_name, signatory_title, signatory, basis,
    inn, kpp, ogrn, address, phone, email, bank_name, bank_account,
    bank_bik, bank_corr
  contract_*: number, day, month, year

  EXTRA_FIELDS по типам:
    поставка (ТХ): payment_days, contract_end_date, liability_limit_num
    поставка_спт (СПТ/ОС): payment_days, contract_end_date (БЕЗ лимита!)
    Определение: isSptOs = ['СПТ','ОС'].includes(company_prefix)

  counterparty_signatory = signatory_name из карточки контрагента
  ВАЖНО: заполнять в формате «Фамилия И.О.» прямо в карточке контрагента

Фикс Э-К:
  company_prefix = contract.company_prefix ?? (startsWith('Э-К') ? 'Э-К' : split('-')[0])
  Применено в: openAddParticipantModal, approve/page.tsx

Notify types: document_created, sent_for_approval, approval_required,
  document_approved, document_rejected, documents_uploaded,
  checklist_generated, checklist_deadline, edo_reminder

Вкладки карточки документа:
  details=Реквизиты/Чат, generate=Генерация, documents=Документы,
  approval=Согласование, ai=EpotosGPT, execution=Контроль исполнения,
  related=Связанные документы, history=История


=============================================================
12. ПРАВИЛА РАБОТЫ
=============================================================
1. Новые файлы — New-Item в PowerShell
2. Редактирование — ТОЛЬКО Ctrl+H в VS Code
3. Не более 3 блоков кода за раз, ждать подтверждения
4. Перед деплоем КОДА — npm run build
5. CONTEXT — без build, сразу git push
6. При зависании деплоя — git commit --allow-empty + git push
7. Repomix (суффикс -yurintel):
   npx repomix --config repomix-api.config.json
   npx repomix --config repomix-components.config.json
   npx repomix --config repomix-pages.config.json
8. Деплой: git add -A / git commit -m "..." / git push
9. Если фрагмент не найден → обновить repomix
10. git log завис → нажать q
11. check_xml.py: указать INPUT = 'ИмяФайла.docx' в начале скрипта
