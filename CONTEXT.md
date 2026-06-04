# CONTEXT.md — Эпотос-ЮрИнтел / Витрина Данных
Дата: 2026-06-04
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
AI основная: OpenRouter (google/gemini-2.5-flash) — все маршруты кроме PDF сравнения
AI PDF сравнение: OpenRouter (anthropic/claude-sonnet-4-5) — только ai-document-compare
  ⚠️ Claude через OpenRouter стоит денег — использовать только для сравнения!
Редактор: OnlyOffice (https://office.epotos-port.ru)
Storage: Supabase (bucket: contracts PUBLIC, templates PUBLIC)
Хостинг: Vercel
Генерация .docx: JSZip (прямая замена {{field}} в XML)
PDF извлечение текста: unpdf — нестабилен на Vercel! Показываем ошибку с просьбой конвертировать в DOCX


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
RLS включён на всех таблицах.

Основные таблицы:
  contracts, versions, approval_sessions (+bitrix_chat_id),
  approval_participants, approval_messages, approval_settings,
  contract_logs, document_attachments, signed_documents,
  document_templates, ai_analysis, ai_chats,
  contract_checklist (+bitrix_task_id), contract_checklist_archive,
  counterparties — УНИКАЛЬНЫЙ КЛЮЧ: (inn, kpp)!
  system_roles — role CHECK IN ('admin','gc_manager','finance_gc','legal_gc')

  company_requisites:
    company_prefix, company_name, inn, kpp, ogrn,
    legal_address, actual_address, bank_name, bank_account,
    bank_bik, bank_corr_account, director_name, director_title,
    phone, email, website, short_name, signatory_name,
    poa_number, poa_date, poa_expires,
    director_short_name, basis, fax, warehouse_address

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
    parent_contract_id UUID REFERENCES contracts(id)
    parent_contract_external TEXT
    child_number INTEGER
    is_child BOOLEAN DEFAULT FALSE
    company_prefix TEXT — скрытое системное поле для фильтрации
    customer_number TEXT — номер документа со стороны контрагента

  signed_documents — дополнительные поля:
    has_discrepancies BOOLEAN DEFAULT FALSE
    discrepancy_comment TEXT
    signed_date DATE

  approval_messages — дополнительные поля (добавлены 04.06.2026):
    reply_to_id UUID REFERENCES approval_messages(id) ON DELETE SET NULL
    reply_to_author TEXT — имя автора цитируемого сообщения
    reply_to_text TEXT — текст цитаты (первые 100 символов)

approval_participants CHECK:
  status IN ('pending','approved','rejected','acknowledged','disabled','completed_by_initiator')
  role: 'required' (согласует, зелёный) | 'optional' (ознакамливается, синий)

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
  Пример: ТХ-ДОГ-2026/06/1 → спецификация ТХ-СПЕЦ-2026/06/1-1

Типы (app/lib/documentTypes.ts):
  Договоры: поставка, услуги, аренда, подряд, купля-продажа,
    агентский, дилерский, лицензионный, сервисный, асц, спецификация
  Соглашения: доп-соглашение, nda, эдо, протокол-разногласий
  Доверенности и согласия: доверенность, персданные

TYPE_CODES в contracts/route.ts:
  'спецификация': 'СПЕЦ', 'другое': 'ДОК' (остальные типы стандартные)

Статусы: черновик → на_согласовании → согласован → загружен_частично
  → подписан → на_исполнении (↘ отклонён)

LOCKED_STATUSES = ['согласован','загружен_частично','подписан','на_исполнении']
  → блокируют: inline edit реквизитов + кнопку «Редактировать» в OnlyOffice


=============================================================
7. АРХИТЕКТУРА РОЛЕЙ
=============================================================
1. developer (ID 30) — жёстко в коде
2-5. admin, gc_manager, finance_gc, legal_gc — из system_roles
6-8. director, legal, finance — из approval_settings
9. user — все остальные

Текущие system_roles:
  1148 → admin (Чащин Дмитрий)
  1 → gc_manager (Чащина Елена)
  246, 504 → legal_gc (Ершова Евгения, Кочкин Сергей)
  10, 154 → finance_gc

Администраторы системы (ID): 30 (Пирог Роман), 1148 (Чащин Дмитрий)
ADMIN_IDS = [30, 1148] — жёстко во всех файлах API


=============================================================
8. РЕАЛИЗОВАННЫЙ ФУНКЦИОНАЛ
=============================================================

✅ CORE: документы, версионирование, OnlyOffice, журнал аудита
✅ СОГЛАСОВАНИЕ: сессии, Realtime, чат, уведомления Б24
  - role: 'required' = согласует (зелёный фон), 'optional' = ознакамливается (синий фон)
✅ AI (EpotosGPT):
  - Legal Review, Паспорт документа, Анализ вложений — google/gemini-2.5-flash
  - Промпты на русском, игнорируют форматирование и пробелы
  - DOCX/XLSX: работает стабильно
  - PDF: показывает ошибку «конвертируйте в DOCX» (unpdf нестабилен на Vercel)
✅ Реквизиты компаний, реестр контрагентов (DaData)
  - Карточка контрагента: документы разбиты на блоки по статусам
    (На согласовании / Действующие / Прочие)
  - Поиск документов по counterparty_id И по текстовому полю counterparty
✅ Дашборды с фильтром по компании
✅ Контроль исполнения, чек-листы, задачи Б24
✅ Автобэкап Яндекс.Диск (17:00), крон дедлайнов (09:00)

✅ SOFT DELETE:
  - Мягкое удаление с обязательным комментарием
  - Права: admin (все), legal_gc/director (по компаниям), автор (свои)
  - Настройки → «🗑 Удалённые документы» → восстановление или безвозвратное удаление
  - Удалённый документ скрыт от ВСЕХ пользователей (contracts-list + page.tsx)
  - API: app/api/deleted-contracts/route.ts
  - contracts-list: .is('deleted_at', null)
  - contracts/[id]/page.tsx: if (!contract || contract.deleted_at) notFound()

✅ ПОМОЩЬ И ПОДДЕРЖКА:
  - Кнопка «❓ Помощь» в шапке с Realtime счётчиком непрочитанных
  - Страница: app/help/page.tsx
  - API: app/api/support-requests/route.ts (GET/POST/PATCH/DELETE)
  - Таблицы: support_requests, support_messages (Realtime)
  - FAQ аккордеон, форма обращения, Realtime чат, статусы new→in_progress→resolved
  - Наклейки только у получателя (localStorage support_seen_{id})
  - Администраторы: Пирог Роман (30), Чащин Дмитрий (1148)

✅ СВЯЗАННЫЕ ДОКУМЕНТЫ:
  - contracts: parent_contract_id, parent_contract_external, child_number, is_child
  - При создании: «Основной» или «Дополнительный»
  - Поиск родителя: только согласован/подписан/на_исполнении
  - Нумерация дочерних: номер родителя + замена типа + суффикс -N
  - Вкладка «🔗 Связанные документы» в карточке
  - Привязка/перепривязка/отвязка
  - Права привязки: author, legal_gc, gc_manager, admin
  - API: app/api/related-contracts/route.ts
  - Компонент: app/components/RelatedDocuments.tsx

✅ INLINE EDIT РЕКВИЗИТОВ:
  - Карандашик ✏️ рядом с полями (кроме типа документа)
  - Поля: title, counterparty (с поиском DaData), amount, start_date, end_date, customer_number
  - После LOCKED_STATUSES — плашка 🔒, поля заблокированы
  - Права: author, legal_gc, gc_manager, admin
  - Лог каждого изменения
  - PATCH: app/api/contracts/[contractId]/route.ts

✅ COMPANY_PREFIX — скрытое поле для фильтрации по компании
✅ CUSTOMER_NUMBER — номер документа со стороны контрагента (поиск)
✅ БЛОКИРОВКА OnlyOffice — кнопка «Редактировать» скрыта после LOCKED_STATUSES
✅ КЛИК ПО НАЗВАНИЮ документа открывает карточку (ContractsList.tsx)

✅ AI СРАВНЕНИЕ ПОДПИСАННОГО ДОКУМЕНТА:
  - Компонент: app/components/SignedDocumentUploadModal.tsx
  - API: app/api/ai-document-compare/route.ts
  - PDF → base64 → Claude (anthropic/claude-sonnet-4-5) через OpenRouter
  - DOCX → JSZip → текст
  - Промпт: только юридически значимые расхождения, игнорируем подписи/штампы
  - При расхождениях: обязательный комментарий + лог
  - signed_documents: has_discrepancies, discrepancy_comment, signed_date
  - Поддержка temp_upload и confirm_upload в signed-documents API

✅ МОДУЛЬ ГЕНЕРАЦИИ (шаблоны):
  - app/api/generate-from-template/route.ts
  - app/components/GenerateFromTemplate.tsx
  - JSZip: split("{{field}}").join(value)
  - runtime: nodejs, maxDuration: 60
  - Контрагент: поиск с подсказками (limit 10) + модалка добавления через DaData
  - Запрет ручного ввода контрагента — только из реестра или через DaData

  EXTRA_FIELDS ключи:
    'дилерский' — territory, min_monthly_purchase_num, contract_end_date
    'дилерский_снг' — territory_country, tax_authority_country, min_monthly_purchase_num, contract_end_date
    'асц' — territory, insurance_amount_num, transport_types, contract_end_date
    'поставка' — payment_days, liability_limit_num, contract_end_date
    'поставка_снг' — payment_days, liability_limit_num, contract_end_date, territory_country, tax_authority_country
    'nda' — nda_penalty_num, nda_penalty_kopecks
    'эдо' — edo_operator, referenced_contract_date, contract_end_date
    'персданные' — subject_full_name, subject_birth_year, passport_series, passport_number,
      passport_issued_by, passport_dept_code, subject_address, subject_inn, subject_snils, pd_consent_date

  buildFields из company_requisites:
    supplier_director_short_name ← director_short_name ?? director_name
    supplier_basis ← basis ?? 'Устава'
    supplier_warehouse_address ← warehouse_address
    supplier_fax ← fax (остальные поля аналогично)

  Автоконвертация прописью:
    nda_penalty_num → nda_penalty_text
    insurance_amount_num → insurance_amount_text
    min_monthly_purchase_num → min_monthly_purchase_text
    liability_limit_num → liability_limit_text

✅ ШАБЛОНЫ ООО ТЕХНО (все 10 проверены):
  Согласие ПД, ЭДО, NDA, Дилерский РФ/СНГ, АСЦ без ТО/с ТО,
  Поставка РФ без надзора/с надзором/СНГ

⬜ ШАБЛОНЫ НПП, СПТ, ОС, ЭПОТОС-К — не подготовлены

✅ РЕЕСТР КОНТРАГЕНТОВ:
  - Поиск с подсказками (limit 10) по названию и ИНН
  - Добавление через DaData (check-inn API)
  - При дублировании (inn+kpp): человекочитаемая ошибка на русском
  - Запрет ручного ввода контрагента при создании документа
  - Валидация counterpartyId при отправке формы нового документа
  - Модалка добавления контрагента прямо из формы создания документа

✅ ЧАТ СОГЛАСОВАНИЯ (улучшения 04.06.2026):
  - Ответ на конкретное сообщение (reply): кнопка ↩ при hover
  - Цитата отображается над текстом ответа с синим именем автора
  - Редактирование своего сообщения: ✏️, пометка «(изм.)», обновление без перезагрузки
  - Удаление последнего сообщения: 🗑 при hover
    Условия удаления: своё сообщение + последнее в чате + не старше 5 минут
    + после него нет сообщений от других пользователей
  - API: POST/PATCH/DELETE app/api/approvals/[sessionId]/messages/route.ts
  - approval_messages: reply_to_id, reply_to_author, reply_to_text

✅ СОРТИРОВКА НА ГЛАВНОЙ (Realtime):
  - Документы сортируются по MAX(last_message_at, created_at)
  - Документ с новым сообщением поднимается вверх без перезагрузки страницы
  - contracts-list API возвращает last_message_at для каждого документа
  - Сортировка применяется при загрузке и при Realtime обновлении


=============================================================
9. ИЗВЕСТНЫЕ ПРОБЛЕМЫ / ТЕХНИЧЕСКИЙ ДОЛГ
=============================================================
⚠️ PDF анализ (Legal Review, Паспорт) — показываем ошибку, просим конвертировать в DOCX
⚠️ Скачивание файлов у Ершовой — решено через VPN (региональный провайдер)
⚠️ Шаблоны НПП — на паузе (нет файлов)
⚠️ Шаблоны СПТ, ОС, Эпотос-К — не подготовлены
⚠️ Финансовый дашборд — требует проверки
⚠️ Ссылка из уведомления → главная (не конкретный документ)
⚠️ ЭДО-голосование в согласовании (разрешение ГД + отправка специалисту ЭДО)
⚠️ Календарь судебных заседаний (ждём ТЗ от юристов)
⚠️ Мобильная адаптация — после Эпотос-Core
⚠️ СБИС интеграция (проверка контрагентов)


=============================================================
10. ГДЕ ОСТАНОВИЛИСЬ (04.06.2026 — вечер)
=============================================================
Сделано в эту сессию:
  ✅ Контрагент в форме нового документа — поиск + модалка DaData + запрет ручного ввода
  ✅ Контрагент в Генерации — поиск с подсказками вместо select + модалка DaData
  ✅ Человекочитаемая ошибка при дублировании контрагента (inn+kpp unique)
  ✅ Soft delete: удалённый документ скрыт от всех пользователей (page.tsx + contracts-list)
  ✅ Чат: редактирование сообщения обновляет UI без перезагрузки
  ✅ Чат: reply на конкретное сообщение с цитатой и синим именем автора
  ✅ Чат: удаление последнего сообщения (5 мин, нет ответов других)
  ✅ Realtime сортировка на главной по активности чата

Следующая сессия — план (по приоритетам):
  1. ЭДО-голосование в согласовании
  2. Шаблоны СПТ, ОС, Эпотос-К (когда будут файлы)
  3. Проверить финансовый дашборд
  4. Импорт старых договоров через Excel — после Эпотос-Core
  5. Мобильная адаптация — после Эпотос-Core
  6. СБИС интеграция
  7. Календарь судебных заседаний (после ТЗ)
  8. Эпотос-РИД — после Эпотос-Core


=============================================================
11. ПЛАН РАЗРАБОТКИ
=============================================================
✅ Спринт 1, 2 — завершены
🔄 Спринт 3:
  ✅ Все базовые функции
  ✅ Модули: генерация, помощь, связанные документы, soft delete
  ✅ AI сравнение PDF подписанного документа
  ✅ Inline edit + блокировка
  ✅ RLS безопасность
  ✅ Карточка контрагента улучшена
  ✅ Список согласующих с метками
  ✅ Контрагенты: поиск + DaData модалка + запрет ручного ввода
  ✅ Soft delete: скрыт от всех пользователей
  ✅ Чат: reply + удаление + редактирование с обновлением UI
  ✅ Realtime сортировка по активности чата
  ⬜ ЭДО-голосование
  ⬜ Шаблоны остальных компаний
  ⬜ Финансовый дашборд — проверка

🔴 Спринт 4 (Эпотос-Core):
  - PWA, Template Studio
  - Плагин AI для OnlyOffice
  - ЭПОТОС-ПЕРСОНАЛ

🔴 Спринт 5 (после Core):
  - Импорт старых договоров через Excel
  - Мобильная адаптация (просмотр + согласование)
  - СБИС интеграция
  - Календарь судебных заседаний
  - Эпотос-РИД (управление ИС)


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
12. Repomix — всегда 3 команды построчно:
    npx repomix --config repomix-api.config.json
    npx repomix --config repomix-components.config.json
    npx repomix --config repomix-pages.config.json
13. Деплой — всегда 3 строки в одном блоке:
    git add -A
    git commit -m "..."
    git push
14. Если фрагмент Ctrl+H не найден → обновить repomix перед следующей попыткой
15. Код предлагать ОДИН РАЗ и только правильный вариант


=============================================================
13. АРХИТЕКТУРНЫЕ РЕШЕНИЯ
=============================================================
Уведомления: notify.ts — колокольчик + чат Б24
Крон: /api/backup (17МСК), /api/cron-checklist-deadline (9МСК)
Генерация: JSZip, шаблоны исправляются check_xml.py перед загрузкой
Контрагенты: DaData, уникальный ключ (inn, kpp)

AI:
  Основная: google/gemini-2.5-flash (OpenRouter)
  PDF сравнение: anthropic/claude-sonnet-4-5 (OpenRouter) — ПЛАТНАЯ, только для сравнения!
  Промпты AI анализа на русском языке, игнорируют форматирование/пробелы

Soft delete:
  contracts.deleted_at IS NULL — активные
  contracts.deleted_at IS NOT NULL — только Настройки → Удалённые
  Права: admin (все), legal_gc/director (по компаниям), автор (свои)
  contracts/[id]/page.tsx: if (!contract || contract.deleted_at) notFound()

Помощь и поддержка:
  Счётчики: localStorage support_seen_{id} vs support_messages.created_at
  Наклейка только у получателя (author_bitrix_id !== currentUserId)
  last_seen при onFocus поля ввода

Связанные документы:
  parent_contract_id — родитель в системе
  parent_contract_external — родитель вне системы
  Поиск: contracts-list?parent_only=true&search=...
  Нумерация: номер родителя + замена типа + суффикс -N

AI сравнение PDF:
  PDF → base64 → __PDF_BASE64__ флаг → Claude document блок
  DOCX → JSZip → убираем XML теги
  Промпт: только юридически значимые расхождения

Блокировка редактирования:
  LOCKED_STATUSES = ['согласован','загружен_частично','подписан','на_исполнении']

Типы шаблонов → EXTRA_FIELDS:
  дилерский → 'дилерский' / 'дилерский_снг' (по названию)
  асц → 'асц'
  поставка → 'поставка' / 'поставка_снг' (по названию)
  nda → 'nda', эдо → 'эдо', персданные → 'персданные'

Проблема XML runs в Word:
  Word разбивает {{field}} → check_xml.py склеивает
  После КАЖДОЙ правки в Word → py check_xml.py → загрузить

Карточка контрагента:
  Документы ищутся по counterparty_id И по текстовому полю counterparty
  Разбиты на блоки: На согласовании / Действующие / Прочие

Чат согласования (reply):
  approval_messages: reply_to_id, reply_to_author, reply_to_text
  Удаление: только своё последнее сообщение + 5 мин + нет ответов других
  API: POST/PATCH/DELETE /api/approvals/[sessionId]/messages/route.ts

Сортировка на главной:
  contracts-list API возвращает last_message_at (из approval_messages активной сессии)
  ContractsList сортирует: MAX(last_message_at, created_at) descending
  Применяется при первой загрузке и при каждом Realtime обновлении


=============================================================
14. БУДУЩИЕ МОДУЛИ
=============================================================
Эпотос-РИД — управление ИС (после Эпотос-Core)
  Функции: журнал РИД, НИОКР, договоры с авторами, учёт пошлин
  Связь с ЮрИнтел: метка «связан с РИД»

ЭПОТОС-ПЕРСОНАЛ — кадровый модуль (Спринт 4)
