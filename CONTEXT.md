# CONTEXT.md — Эпотос-ЮрИнтел / Витрина Данных
Дата: 2026-06-06
Статус: Спринт 3 — финальная стадия

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
    Имена файлов — БЕЗ подчёркиваний вместо пробелов!

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
  system_roles — role CHECK IN ('admin','gc_manager','finance_gc','finance_company','legal_gc')
  company_directors — справочник ГД (НЕ используется для ЭДО! см. ниже)
  edo_specialists — специалисты ЭДО по компаниям
  user_badge_seen — хранит last_seen_at для каждого пользователя (bitrix_user_id UNIQUE)
  badge_count — API для подсчёта непрочитанных событий (/api/badge-count GET/POST)

  company_requisites:
    company_prefix, company_name, inn, kpp, ogrn,
    legal_address, actual_address, bank_name, bank_account,
    bank_bik, bank_corr_account, director_name, director_title,
    phone, email, website, short_name, signatory_name,
    poa_number, poa_date, poa_expires,
    director_short_name, basis, fax, warehouse_address

  support_requests / support_messages (Realtime)

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

  approval_messages — дополнительные поля:
    reply_to_id UUID REFERENCES approval_messages(id) ON DELETE SET NULL
    reply_to_author TEXT
    reply_to_text TEXT

  approval_sessions — ЭДО поля:
    edo_requested BOOLEAN DEFAULT FALSE
    edo_requested_by_id INT, edo_requested_by_name TEXT, edo_requested_at TIMESTAMPTZ
    edo_director_bitrix_id INT, edo_director_name TEXT
    edo_director_decision TEXT CHECK IN ('approved','rejected')
    edo_director_decided_at TIMESTAMPTZ
    signing_method TEXT CHECK IN ('edo','simple')
    signing_method_set_by_id INT, signing_method_set_by_name TEXT, signing_method_set_at TIMESTAMPTZ
    edo_specialist_bitrix_id INT, edo_specialist_name TEXT, edo_task_sent_at TIMESTAMPTZ

  edo_specialists:
    id, company_prefix, bitrix_user_id, user_name, position, created_at
    Специалисты ЭДО по компаниям — управление в Настройки → Согласующие → вкладка «Специалисты ЭДО»
    ТХ/НПП: Наумова Елена(158), Жукова Ольга(164), Симачева Алена(1036)
    НПП: +Виноградова Анна(152)
    СПТ: Виноградова Анна(152)
    ОС: Крылова Ирина(72)
    Э-К: Окунева Екатерина(894), Шиврина Дарья(1286), Батуева Елена(910), Лямина Елена(216)

approval_participants CHECK:
  status IN ('pending','approved','rejected','acknowledged','disabled','completed_by_initiator')
  role: 'required' (согласует, зелёный) | 'optional' (ознакамливается, синий)

Данные company_requisites — все компании заполнены:
  ✅ ТХ: director_short_name='Чащина Е.П.', basis='Устава'
  ✅ НПП: director_short_name='Веревка А.В.', basis='Устава'
  ✅ СПТ: director_short_name='Валюк А.Г.', basis='Устава'
  ✅ ОС:  director_short_name='Валюк А.Г.', basis='Устава'
  ✅ Э-К: director_short_name='Молоткин Е.А.', basis='Устава'
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

Статусы: черновик → на_согласовании → согласован → [на_подписи_в_эдо →] загружен_частично
  → подписан → на_исполнении (↘ отклонён)
  на_подписи_в_эдо — только если выбран метод ЭДО бухгалтером

statusLabel и statusColor — определены в 3 местах (ContractsList.tsx дважды, ContractTabs.tsx)
  на_подписи_в_эдо: label='На подписи в ЭДО', color='bg-purple-100 text-purple-800'

LOCKED_STATUSES = ['согласован','загружен_частично','подписан','на_исполнении']
  → блокируют: inline edit реквизитов + кнопку «Редактировать» в OnlyOffice


=============================================================
7. АРХИТЕКТУРА РОЛЕЙ
=============================================================
1. developer (ID 30) — жёстко в коде
2-6. admin, gc_manager, finance_gc, finance_company, legal_gc — из system_roles
7-9. director, legal, finance — из approval_settings
10. user — все остальные

Текущие system_roles:
  1148 → admin (Чащин Дмитрий)
  1 → gc_manager (Чащина Елена)
  246, 504 → legal_gc (Ершова Евгения, Кочкин Сергей)
  10, 154 → finance_gc

Роль finance_company — новая, бухгалтер конкретной компании
  Права: видит ЭДО-блок в согласовании, может выбирать метод подписания

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
  - DOCX/XLSX: работает стабильно
  - PDF: показывает ошибку «конвертируйте в DOCX» (unpdf нестабилен на Vercel)
✅ Реквизиты компаний, реестр контрагентов (DaData)
  - Карточка контрагента: документы разбиты на блоки по статусам
  - Sticky шапка + поиск при скролле
✅ Дашборды:
  - Юридический: фильтр по компании исправлен (динамика за период)
  - Финансовый: работает корректно
✅ Контроль исполнения, чек-листы, задачи Б24
✅ Автобэкап Яндекс.Диск (17:00), крон дедлайнов (09:00)

✅ SOFT DELETE:
  - Мягкое удаление с обязательным комментарием
  - contracts/[id]/page.tsx: if (!contract || contract.deleted_at) notFound()
  - Скрыт от всех пользователей включая рабочий стол (my-documents API)

✅ ПОМОЩЬ И ПОДДЕРЖКА:
  - Кнопка «❓ Помощь» в шапке с Realtime счётчиком непрочитанных
  - FAQ аккордеон, форма обращения, Realtime чат, статусы new→in_progress→resolved

✅ СВЯЗАННЫЕ ДОКУМЕНТЫ:
  - Нумерация дочерних: номер родителя + замена типа + суффикс -N
  - Вкладка «🔗 Связанные документы» в карточке

✅ INLINE EDIT РЕКВИЗИТОВ:
  - Карандашик ✏️ рядом с полями, блокировка после LOCKED_STATUSES

✅ AI СРАВНЕНИЕ ПОДПИСАННОГО ДОКУМЕНТА:
  - PDF → base64 → Claude (anthropic/claude-sonnet-4-5) — ПЛАТНАЯ!

✅ МОДУЛЬ ГЕНЕРАЦИИ (шаблоны):
  - JSZip: split("{{field}}").join(value)
  - Контрагент: поиск с подсказками (limit 10) + модалка DaData
  - Запрет ручного ввода контрагента
  - Шаблоны ООО Техно (все 10 проверены)
  - Фильтр шаблонов по компании в панели администратора
  ⬜ Шаблоны НПП, СПТ, ОС, Эпотос-К — после Эпотос-Core

✅ РЕЕСТР КОНТРАГЕНТОВ:
  - Поиск с подсказками (limit 10), добавление через DaData
  - При дублировании: человекочитаемая ошибка на русском
  - Запрет ручного ввода при создании документа
  - Модалка добавления прямо из формы создания документа

✅ ЧАТ СОГЛАСОВАНИЯ:
  - Reply на сообщение с цитатой (синее имя автора)
  - Редактирование своего сообщения (пометка «(изм.)»)
  - Удаление последнего сообщения (5 мин + нет ответов других)
  - approval_messages: reply_to_id, reply_to_author, reply_to_text

✅ ГЛАВНАЯ СТРАНИЦА:
  - Sticky шапка с фильтрами (высота calc(100vh - 60px))
  - Поиск: номер, название, контрагент, № заказчика (customer_number)
  - Фильтр контрагентов с автодополнением
  - Realtime сортировка по MAX(last_message_at, created_at)
  - Фильтр статусов включает «На подписи в ЭДО»
  - PersonalStats: счётчик «На подписи в ЭДО» (фиолетовый, 5 колонок)
  - MyDocuments: вкладка «На подписи в ЭДО» (фиолетовый фон)

✅ ЭДО-ГОЛОСОВАНИЕ:
  - Роль finance_company (Бухгалтер компании)
  - Специалисты ЭДО: Настройки → Согласующие → «Специалисты ЭДО»
  - Блок «🖊 Способ подписания» в правой колонке вкладки Согласование
  - ГД выбирается из approval_settings (stage='director', company=company_prefix)
  - Шаги: запрос → решение ГД → выбор метода бухгалтером → статус на_подписи_в_эдо
  - API: /api/approvals/[sessionId]/edo
  - ЭДО-события записываются в contract_logs (журнал аудита)
  ⚠️ НЕ использовать company_directors для ЭДО!

✅ УВЕДОМЛЕНИЯ Б24:
  - Типы: document_created, sent_for_approval, approval_required,
    document_approved, document_rejected, documents_uploaded,
    checklist_generated, checklist_deadline,
    edo_request, edo_decision, edo_task (новые)
  - Ссылка в уведомлении → /?contract_id=... → редирект на карточку документа
  - BX24.setTitle() не работает для iframe marketplace приложений в Б24

✅ НАСТРОЙКИ АДМИНИСТРАТОРА:
  - Фильтр шаблонов по компании (выпадающий список)
  - Специалисты ЭДО — отдельная вкладка в «Согласующие»


=============================================================
9. ИЗВЕСТНЫЕ ПРОБЛЕМЫ / ТЕХНИЧЕСКИЙ ДОЛГ
=============================================================
⚠️ PDF анализ (Legal Review, Паспорт) — показываем ошибку, просим конвертировать в DOCX
⚠️ Календарь судебных заседаний (ждём ТЗ от юристов)
⚠️ Мобильная адаптация — после Эпотос-Core
⚠️ СБИС интеграция (проверка контрагентов) — после Эпотос-Core
⚠️ Вкладка «На подписи в ЭДО» в MyDocuments — появляется только при наличии таких документов


=============================================================
10. ГДЕ ОСТАНОВИЛИСЬ (06.06.2026)
=============================================================
Сделано в эту сессию:
  ✅ Ссылка из уведомления Б24 → конкретный документ (useBitrixAuth + bitrix-notify)
  ✅ Мягко удалённые документы скрыты с рабочего стола (my-documents API)
  ✅ Статус «На подписи в ЭДО» — фиолетовый цвет во всех списках
  ✅ Фильтр статусов на главной — добавлена опция «На подписи в ЭДО»
  ✅ PersonalStats — счётчик «На подписи в ЭДО» (5-я колонка)
  ✅ MyDocuments — вкладка «На подписи в ЭДО» (фиолетовый фон)
  ✅ my-documents API — возвращает my_edo (документы автора на подписи в ЭДО)
  ✅ Уведомления Б24 — новые типы edo_request, edo_decision, edo_task
  ✅ Фильтр шаблонов по компании в Настройки → Шаблоны документов
  ✅ ЭДО-события в журнале аудита (уже работали через contract_logs)

Следующая сессия — план (по приоритетам):
  1. ЭПОТОС-Ассистент (RAG) — перенесён в Спринт 4 (Эпотос-Core)
  2. Инструкция пользователя — перенесена в Спринт 4 вместе с ЭПОТОС-Ассистентом
  3. Проверить/доработать ЭДО в живой системе с реальными пользователями
  4. Импорт старых договоров через Excel — после Эпотос-Core
  5. Мобильная адаптация — после Эпотос-Core
  6. СБИС интеграция — после Эпотос-Core
  7. Шаблоны НПП, СПТ, ОС, Эпотос-К — после Эпотос-Core
  8. Календарь судебных заседаний (после ТЗ)
  9. Эпотос-РИД — после Эпотос-Core


=============================================================
11. ПЛАН РАЗРАБОТКИ
=============================================================
✅ Спринт 1, 2 — завершены
✅ Спринт 3 — ЗАВЕРШЁН:
  ✅ Все базовые функции
  ✅ Модули: генерация, помощь, связанные документы, soft delete
  ✅ AI сравнение PDF подписанного документа
  ✅ Inline edit + блокировка
  ✅ RLS безопасность
  ✅ Карточка контрагента улучшена
  ✅ Контрагенты: поиск + DaData модалка + запрет ручного ввода
  ✅ Soft delete: скрыт от всех пользователей включая рабочий стол
  ✅ Чат: reply + удаление + редактирование
  ✅ Realtime сортировка по активности чата
  ✅ ЭДО-голосование (полный цикл)
  ✅ Поиск по customer_number
  ✅ Sticky шапка (главная + реестр контрагентов)
  ✅ Фильтр контрагентов с автодополнением
  ✅ Юридический и финансовый дашборды — исправлены
  ✅ Статус «На подписи в ЭДО» — везде
  ✅ Уведомления Б24 — ссылка на конкретный документ
  ✅ Фильтр шаблонов по компании

🔴 Спринт 4 (Эпотос-Core):
  - ЭПОТОС-Ассистент (RAG на pgvector + Gemini)
    Таблицы: help_knowledge, help_chunks (embedding vector(768))
    Интерфейс: отдельный чат (не в карточке документа)
    Загрузка базы знаний: DOCX/XLSX/TXT (только admin/developer)
    Инструкция пользователя ЮрИнтел — загружается как первый документ базы знаний
  - PWA, Template Studio
  - Плагин AI для OnlyOffice
  - ЭПОТОС-ПЕРСОНАЛ

🔴 Спринт 5 (после Core):
  - Шаблоны НПП, СПТ, ОС, Эпотос-К
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
16. git log завис в less → нажать q для выхода


=============================================================
13. АРХИТЕКТУРНЫЕ РЕШЕНИЯ
=============================================================
Уведомления: /api/bitrix-notify (POST напрямую, не импорт функции)
  Типы: document_created, sent_for_approval, approval_required,
    document_approved, document_rejected, documents_uploaded,
    checklist_generated, checklist_deadline,
    edo_request, edo_decision, edo_task
  Ссылка: https://epotos-ur-intel.vercel.app/?contract_id=${document_id}
  useBitrixAuth: при загрузке проверяет contract_id в URL → window.location.replace

Крон: /api/backup (17МСК), /api/cron-checklist-deadline (9МСК)
Генерация: JSZip, шаблоны исправляются check_xml.py перед загрузкой
Контрагенты: DaData, уникальный ключ (inn, kpp)

AI:
  Основная: google/gemini-2.5-flash (OpenRouter)
  PDF сравнение: anthropic/claude-sonnet-4-5 (OpenRouter) — ПЛАТНАЯ, только для сравнения!
  Промпты AI анализа на русском языке, игнорируют форматирование/пробелы

Soft delete:
  contracts.deleted_at IS NULL — активные
  contracts/[id]/page.tsx: if (!contract || contract.deleted_at) notFound()
  my-documents API: фильтрует deleted_at IS NULL для my_drafts и my_edo

ЭДО-голосование:
  ГД для запроса: approval_settings (stage='director', company=contract.company_prefix)
  НЕ использовать company_directors для ЭДО!
  Блок в правой колонке вкладки Согласование
  API: /api/approvals/[sessionId]/edo — actions: request, director_decision, set_method
  ЭДО-события → contract_logs (автоматически попадают в журнал аудита)

Главная страница:
  Высота контейнера: calc(100vh - 60px), flex-col
  Шапка: flex-shrink-0
  Список: flex-1 overflow-y-auto overflow-x-auto
  Фильтр контрагентов: input+dropdown с автодополнением (не select)
  Поиск: number, title, counterparty, customer_number (фронт + API)
  PersonalStats: 5 колонок (добавлен счётчик на_подписи_в_эдо фиолетовый)
  MyDocuments: вкладка 'edo' — показывается только если my_edo.length > 0

Чат согласования:
  approval_messages: reply_to_id, reply_to_author, reply_to_text
  Удаление: только своё последнее сообщение + 5 мин + нет ответов других

Сортировка на главной:
  contracts-list API возвращает last_message_at
  Сортировка: MAX(last_message_at, created_at) descending
  Применяется при загрузке и при Realtime (contracts + approval_messages)

Юридический дашборд:
  prefixFilter(companyPrefix) применяется ко всем запросам включая recentContracts

Типы шаблонов → EXTRA_FIELDS:
  дилерский → 'дилерский' / 'дилерский_снг' (по названию)
  асц → 'асц', поставка → 'поставка' / 'поставка_снг'
  nda → 'nda', эдо → 'эдо', персданные → 'персданные'

Настройки → Шаблоны:
  Фильтр по компании: templateCompanyFilter state, фильтрация на фронте
  templates.filter(t => templateCompanyFilter === 'all' || t.company_prefix === templateCompanyFilter)


=============================================================
14. БУДУЩИЕ МОДУЛИ
=============================================================
ЭПОТОС-Ассистент (Спринт 4 — Эпотос-Core):
  RAG на pgvector + Gemini Embedding + google/gemini-2.5-flash
  Таблицы: help_knowledge, help_chunks (embedding vector(768))
  Интерфейс: отдельный чат (НЕ в карточке документа)
  Загрузка базы знаний: Настройки → «📚 База знаний» (DOCX/XLSX/TXT, только admin/developer)
  Инструкция пользователя ЮрИнтел — первый документ базы знаний
  Используется во всех модулях Витрины Данных

Эпотос-РИД — управление ИС (Спринт 5)
  Функции: журнал РИД, НИОКР, договоры с авторами, учёт пошлин

ЭПОТОС-ПЕРСОНАЛ — кадровый модуль (Спринт 4)
