# CONTEXT.md — Эпотос-ЮрИнтел / Витрина Данных
Дата: 2026-06-03
Статус: Спринт 3 — активная разработка

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
AI: OpenRouter (google/gemini-2.5-flash) — основная модель
AI сравнение PDF: OpenRouter (anthropic/claude-sonnet-4-5) — только для сравнения подписанных документов
Редактор: OnlyOffice (https://office.epotos-port.ru)
Storage: Supabase (bucket: contracts PUBLIC, templates PUBLIC)
Хостинг: Vercel
Генерация .docx: JSZip (прямая замена {{field}} в XML)
PDF извлечение текста: unpdf (для ai-analysis)


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
  contract_checklist (+bitrix_task_id), contract_checklist_archive,
  counterparties — УНИКАЛЬНЫЙ КЛЮЧ: (inn, kpp)!
  system_roles — role CHECK IN ('admin','gc_manager','finance_gc','legal_gc')

  support_requests:
    id, created_at, user_bitrix_id, user_name, admin_bitrix_id, admin_name,
    subject, message, status CHECK IN ('new','in_progress','resolved'),
    admin_reply, replied_at, replied_by
  support_messages:
    id, created_at, request_id→support_requests(CASCADE),
    author_bitrix_id, author_name, is_admin, message
    Realtime: ALTER PUBLICATION supabase_realtime ADD TABLE support_messages

  contracts — дополнительные поля:
    deleted_at, deleted_by_bitrix_id, deleted_by_name, delete_reason (soft delete)
    parent_contract_id UUID REFERENCES contracts(id) — родительский документ
    parent_contract_external TEXT — номер родителя вне системы
    child_number INTEGER — порядковый номер дочернего (1, 2, 3...)
    is_child BOOLEAN DEFAULT FALSE
    company_prefix TEXT — скрытое системное поле для фильтрации (заполняется авто)
    customer_number TEXT — номер документа со стороны контрагента

  signed_documents — дополнительные поля:
    has_discrepancies BOOLEAN DEFAULT FALSE
    discrepancy_comment TEXT
    signed_date DATE

  RLS: включён на всех таблицах (03.06.2026 добавлены политики для:
    counterparties, support_messages, support_requests, system_roles)

approval_participants CHECK:
  status IN ('pending','approved','rejected','acknowledged',
             'disabled','completed_by_initiator')

Данные company_requisites — все компании заполнены:
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
Нумерация дочерних: номер родителя с заменой типа + суффикс -N
  Пример: родитель ТХ-ДОГ-2026/06/1 → спецификация ТХ-СПЕЦ-2026/06/1-1

Типы активные (app/lib/documentTypes.ts):
  Договоры: поставка, услуги, аренда, подряд, купля-продажа,
    агентский, дилерский, лицензионный, сервисный, асц, спецификация
  Соглашения: доп-соглашение, nda, эдо, протокол-разногласий
  Доверенности и согласия: доверенность, персданные

TYPE_CODES в contracts/route.ts:
  'спецификация': 'СПЕЦ', 'другое': 'ДОК' (и все остальные типы)

Статусы: черновик → на_согласовании → согласован → загружен_частично
  → подписан → на_исполнении (↘ отклонён)

БЛОКИРОВКА: после статуса 'согласован' — все поля реквизитов и редактирование
  в OnlyOffice заблокированы
  LOCKED_STATUSES = ['согласован','загружен_частично','подписан','на_исполнении']


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
✅ AI (EpotosGPT): Legal Review, Паспорт, анализ вложений — google/gemini-2.5-flash
   ⚠️ PDF анализ через unpdf — работает нестабильно на Vercel
   ✅ DOCX/XLSX анализ — работает стабильно
✅ Реквизиты компаний, реестр контрагентов (DaData)
✅ Дашборды с фильтром по компании
✅ Контроль исполнения, чек-листы, задачи Б24
✅ Автобэкап Яндекс.Диск (17:00), крон дедлайнов (09:00)

✅ SOFT DELETE:
  - Мягкое удаление с обязательным комментарием
  - Права: admin (все), legal_gc/director (по компаниям), автор (свои)
  - Раздел «Удалённые документы» в Настройки → вкладка «🗑 Удалённые документы»
  - Восстановление (admin) и безвозвратное удаление (admin)
  - API: app/api/deleted-contracts/route.ts
  - contracts-list фильтрует: .is('deleted_at', null)

✅ МОДУЛЬ «ПОМОЩЬ И ПОДДЕРЖКА»:
  - Кнопка «❓ Помощь» в шапке с Realtime счётчиком непрочитанных
  - Страница: app/help/page.tsx
  - API: app/api/support-requests/route.ts (GET/POST/PATCH/DELETE)
  - Таблицы: support_requests, support_messages
  - FAQ — 11 вопросов, аккордеон
  - Форма обращения: выбор администратора + 5 тем + текст
  - Полноценный Realtime чат
  - Статусы: new → in_progress → resolved
  - Чат закрывается только при «Решено» (с подтверждением)
  - Наклейки «новое сообщение» только у получателя
  - Счётчики: localStorage support_seen_{id} vs support_messages.created_at
  - Администраторы: Пирог Роман (ID 30), Чащин Дмитрий (ID 1148)

✅ МОДУЛЬ СВЯЗАННЫХ ДОКУМЕНТОВ:
  - Поля в contracts: parent_contract_id, parent_contract_external, child_number, is_child
  - При создании: выбор «Основной» или «Дополнительный» документ
  - Поиск родителя: только статусы согласован/подписан/на_исполнении
  - Нумерация дочерних: номер родителя + замена типа + суффикс -N
  - Вкладка «🔗 Связанные документы» в карточке
  - Привязка/перепривязка/отвязка после создания
  - Права привязки: author, legal_gc, gc_manager, admin
  - API: app/api/related-contracts/route.ts (GET/POST/DELETE)
  - Компонент: app/components/RelatedDocuments.tsx

✅ INLINE EDIT РЕКВИЗИТОВ:
  - Карандашик ✏️ рядом с каждым полем
  - Редактируемые поля: title, counterparty (с поиском DaData), amount,
    start_date, end_date, customer_number
  - Тип документа — НЕ редактируется
  - После статуса «Согласован» — все поля заблокированы (плашка 🔒)
  - Права: author, legal_gc, gc_manager, admin
  - Лог каждого изменения: «Изменено поле «X»: было → стало»
  - PATCH endpoint: app/api/contracts/[contractId]/route.ts
  - ALLOWED_FIELDS: ['title','counterparty','amount','start_date','end_date','customer_number']

✅ НОМЕР ЗАКАЗЧИКА (customer_number):
  - Поле при создании документа (необязательное)
  - Редактирование в «Реквизитах» через inline edit
  - Участвует в поиске на главной странице

✅ COMPANY_PREFIX (скрытое системное поле):
  - Заполняется автоматически при создании из выбранной компании
  - Используется для фильтрации по компаниям

✅ БЛОКИРОВКА РЕДАКТИРОВАНИЯ ONLYOFFICE:
  - После статуса «Согласован» кнопка «✏️ Редактировать» скрывается
  - Доступен только «👁️ Просмотр»

✅ AI СРАВНЕНИЕ ПОДПИСАННОГО ДОКУМЕНТА:
  - Модалка при загрузке подписанного файла (SignedDocumentUploadModal)
  - Выбор файла для сравнения из версий и доп.материалов
  - API: app/api/ai-document-compare/route.ts
  - PDF передаётся в Claude (anthropic/claude-sonnet-4-5) через OpenRouter как document блок
  - DOCX → JSZip → текст
  - Результат: ✅ соответствует / ⚠️ расхождения с таблицей
  - При расхождениях: обязательный комментарий + лог
  - signed_documents: has_discrepancies, discrepancy_comment, signed_date

✅ МОДУЛЬ ГЕНЕРАЦИИ (шаблоны):
  app/api/generate-from-template/route.ts
  app/components/GenerateFromTemplate.tsx
  Технология: JSZip — split("{{field}}").join(value) в XML
  runtime: nodejs, maxDuration: 60

  EXTRA_FIELDS ключи:
    'дилерский' — territory, min_monthly_purchase_num, contract_end_date(date)
    'дилерский_снг' — territory_country, tax_authority_country, min_monthly_purchase_num, contract_end_date
    'асц' — territory, insurance_amount_num, transport_types, contract_end_date(date)
    'поставка' — payment_days, liability_limit_num, contract_end_date(date)
    'поставка_снг' — payment_days, liability_limit_num, contract_end_date, territory_country, tax_authority_country
    'nda' — nda_penalty_num, nda_penalty_kopecks
    'эдо' — edo_operator, referenced_contract_date(date), contract_end_date(date)
    'персданные' — subject_full_name, subject_birth_year, passport_series, passport_number,
      passport_issued_by, passport_dept_code, subject_address, subject_inn, subject_snils, pd_consent_date

  buildFields из company_requisites:
    supplier_director_short_name ← director_short_name ?? director_name
    supplier_basis ← basis ?? 'Устава'
    supplier_warehouse_address ← warehouse_address
    supplier_fax ← fax (все остальные поля аналогично)

  Автоконвертация прописью:
    nda_penalty_num → nda_penalty_text
    insurance_amount_num → insurance_amount_text
    min_monthly_purchase_num → min_monthly_purchase_text
    liability_limit_num → liability_limit_text

✅ ШАБЛОНЫ ООО ТЕХНО (все 10):
  Согласие ПД, ЭДО, NDA, Дилерский РФ/СНГ, АСЦ без ТО/с ТО,
  Поставка РФ без надзора/с надзором/СНГ

⬜ ШАБЛОНЫ НПП, СПТ, ОС, ЭПОТОС-К — не подготовлены


=============================================================
9. ИЗВЕСТНЫЕ ПРОБЛЕМЫ / ТЕХНИЧЕСКИЙ ДОЛГ
=============================================================
⚠️ PDF анализ (Legal Review, Паспорт) — unpdf не работает на Vercel стабильно
   Нужно найти альтернативное решение для извлечения текста из PDF
⚠️ Скачивание файлов у Ершовой (Firefox/Yandex) — проблема CORS в iframe
   Решение: проксировать все файлы через /api/onlyoffice/file
⚠️ Шаблоны НПП — на паузе (нет файлов)
⚠️ Шаблоны СПТ, ОС, Эпотос-К — не подготовлены
⚠️ Финансовый дашборд — требует проверки
⚠️ Ссылка из уведомления → главная (не конкретный документ)
⚠️ Контрагенты в Генерации — показывать не более 10, поиск по вводу
⚠️ ЭДО-голосование в согласовании
⚠️ Календарь судебных заседаний (ждём ТЗ от юристов)
⚠️ Мобильная адаптация — после Эпотос-Core
⚠️ СБИС интеграция


=============================================================
10. ГДЕ ОСТАНОВИЛИСЬ (03.06.2026)
=============================================================
Сделано в эту сессию:
  ✅ RLS политики добавлены для counterparties, support_messages, support_requests, system_roles
  ✅ AI сравнение PDF подписанного документа — работает через Claude/OpenRouter
  ✅ Тип «Спецификация» добавлен
  ✅ Поиск по номеру контрагента (customer_number)
  ✅ Восстановлен Legal Review и Паспорт для DOCX (убрано URL-кодирование кириллицы)
  ✅ gemini-2.5-flash во всех маршрутах (ai-generate, ai-chat, contract-checklist)
  ✅ PDF content-type при скачивании
  ✅ Инструкция пользователя дополнение v1.1

Следующая сессия — план (по приоритетам):
  1. Исправить скачивание файлов у всех пользователей (проксирование через API)
  2. Решить проблему PDF анализа (unpdf не работает на Vercel)
  3. Карточка контрагента — «Документов» вместо «Договоров», подсчёт всех типов
  4. Список согласующих — метки (согласует)/(ознакамливается) + цвета
  5. Импорт старых договоров через Excel (страница для администратора)
  6. Контрагенты в Генерации — лимит 10 + поиск по вводу
  7. ЭДО-голосование в согласовании
  8. Шаблоны СПТ, ОС, Эпотос-К (когда будут файлы)
  9. Проверить финансовый дашборд


=============================================================
11. ПЛАН РАЗРАБОТКИ
=============================================================
✅ Спринт 1, 2 — завершены
🔄 Спринт 3:
  ✅ Дашборды, реестр контрагентов, фильтры
  ✅ Динамические роли, оптимизация БД
  ✅ Модуль генерации документов + шаблоны Техно
  ✅ Данные company_requisites для всех компаний
  ✅ AI модель обновлена на gemini-2.5-flash
  ✅ Soft delete документов
  ✅ Модуль «Помощь и поддержка»
  ✅ Модуль связанных документов
  ✅ Inline edit реквизитов + блокировка
  ✅ AI сравнение подписанного документа (работает для PDF)
  ✅ RLS безопасность — все таблицы защищены
  ⬜ Исправить скачивание файлов (CORS/iframe)
  ⬜ PDF анализ (стабильное решение)
  ⬜ Карточка контрагента — Документов
  ⬜ Список согласующих — метки и цвета
  ⬜ Импорт старых договоров через Excel
  ⬜ Контрагенты в Генерации — лимит + поиск
  ⬜ ЭДО-голосование
  ⬜ Шаблоны остальных компаний

🔴 Спринт 4:
  - PWA, ЭПОТОС-Core Template Studio
  - Плагин AI для OnlyOffice
  - ЭПОТОС-ПЕРСОНАЛ, ЭПОТОС-РИД (после Core)
  - Мобильная адаптация (просмотр + согласование)
  - Календарь судебных заседаний


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
AI основная: google/gemini-2.5-flash (OpenRouter) — все маршруты кроме PDF сравнения
AI PDF сравнение: anthropic/claude-sonnet-4-5 (OpenRouter) — только ai-document-compare
  ⚠️ Claude через OpenRouter стоит денег — использовать только для сравнения!

Soft delete:
  contracts.deleted_at IS NULL — активные
  contracts.deleted_at IS NOT NULL — только в Настройки → Удалённые
  Права: admin (все), legal_gc/director (по компаниям), автор (свои)

Помощь и поддержка:
  Счётчики: localStorage support_seen_{id} vs support_messages.created_at
  last_seen при onFocus поля ввода и при отправке своего сообщения
  Наклейка только у получателя (author_bitrix_id !== currentUserId)

Связанные документы:
  parent_contract_id — ссылка на родителя в системе
  parent_contract_external — номер родителя вне системы
  Поиск родителей: contracts-list?parent_only=true&search=...
  Нумерация дочерних: номер родителя + замена типа + суффикс -N

AI сравнение PDF (ai-document-compare):
  PDF → base64 → Claude document блок через OpenRouter
  DOCX → JSZip → убираем XML теги → текст
  Промпт: только юридически значимые расхождения, игнорируем подписи/штампы

Блокировка редактирования:
  LOCKED_STATUSES = ['согласован','загружен_частично','подписан','на_исполнении']
  isLocked → скрываем ✏️ в реквизитах + скрываем «Редактировать» в OnlyOffice

Типы шаблонов в БД vs ключи EXTRA_FIELDS:
  дилерский → 'дилерский' / 'дилерский_снг' (по названию)
  асц → 'асц', поставка → 'поставка' / 'поставка_снг'
  nda → 'nda', эдо → 'эдо', персданные → 'персданные'

Проблема разбивки XML runs в Word:
  Word разбивает {{field}} на несколько runs → check_xml.py склеивает
  После КАЖДОЙ правки шаблона в Word → py check_xml.py → загрузить


=============================================================
14. МОДУЛЬ СВЯЗАННЫХ ДОКУМЕНТОВ — АРХИТЕКТУРА
=============================================================
РЕАЛИЗОВАНО (03.06.2026):
  Поля contracts: parent_contract_id, parent_contract_external, child_number, is_child
  При создании: «Основной» или «Дополнительный» → поиск родителя → нумерация
  Вкладка «🔗 Связанные документы»: родитель + дочерние + привязка/отвязка
  API: app/api/related-contracts/route.ts
  Компонент: app/components/RelatedDocuments.tsx


=============================================================
15. БУДУЩИЕ МОДУЛИ
=============================================================
Эпотос-РИД — управление интеллектуальной собственностью (после Эпотос-Core)
  Функции: журнал РИД, карточки НИОКР, договоры с авторами, учёт пошлин
  Связь с ЮрИнтел: метка «связан с РИД» в карточке договора
