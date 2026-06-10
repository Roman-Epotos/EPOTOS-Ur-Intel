# CONTEXT-YURINTEL.md — Эпотос-ЮрИнтел
Дата: 2026-06-10
Статус: Спринт 4 активен

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
  edo_specialists — специалисты ЭДО по компаниям
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
    Российские: 4 категории (Устав/Доверенность/Решение-Приказ/Прочее)
    Иностранные: те же категории

  company_requisites:
    company_prefix, company_name, inn, kpp, ogrn,
    legal_address, actual_address, bank_name, bank_account,
    bank_bik, bank_corr_account, director_name, director_title,
    phone, email, website, short_name, signatory_name,
    poa_number, poa_date, poa_expires,
    director_short_name, basis, fax, warehouse_address

  support_requests / support_messages (Realtime)

  contracts — дополнительные поля:
    deleted_at, deleted_by_bitrix_id, deleted_by_name, delete_reason
    parent_contract_id, parent_contract_external, child_number, is_child
    company_prefix, customer_number

  signed_documents: has_discrepancies, discrepancy_comment, signed_date
  approval_messages: reply_to_id, reply_to_author, reply_to_text

  approval_sessions — ЭДО поля:
    edo_requested, edo_requested_by_id, edo_requested_by_name, edo_requested_at
    edo_director_bitrix_id, edo_director_name
    edo_director_decision CHECK IN ('approved','rejected'), edo_director_decided_at
    signing_method CHECK IN ('edo','simple')
    signing_method_set_by_id, signing_method_set_by_name, signing_method_set_at
    edo_specialist_bitrix_id, edo_specialist_name, edo_task_sent_at

  edo_specialists: id, company_prefix, bitrix_user_id, user_name, position
    ТХ/НПП: Наумова Елена(158), Жукова Ольга(164), Симачева Алена(1036)
    НПП: +Виноградова Анна(152); СПТ: Виноградова Анна(152)
    ОС: Крылова Ирина(72)
    Э-К: Окунева Екатерина(894), Шиврина Дарья(1286), Батуева Елена(910), Лямина(216)

approval_participants:
  status IN ('pending','approved','rejected','acknowledged','disabled','completed_by_initiator')
  role: 'required' (согласует, зелёный) | 'optional' (ознакамливается, синий)

company_requisites заполнены:
  ТХ: director_short_name='Чащина Е.П.', НПП: 'Веревка А.В.'
  СПТ/ОС: 'Валюк А.Г.', Э-К: 'Молоткин Е.А.', все basis='Устава', fax=NULL


=============================================================
5. НУМЕРАЦИЯ, ТИПЫ, СТАТУСЫ
=============================================================
Нумерация: ПРЕФИКС-ТИПКОД-ГОД/МЕСЯЦ/НН
Дочерние: номер родителя + замена типа + суффикс -N

Типы: поставка, услуги, аренда, подряд, купля-продажа, агентский, дилерский,
  лицензионный, сервисный, асц, спецификация, доп-соглашение, nda, эдо,
  протокол-разногласий, доверенность, персданные
TYPE_CODES: 'спецификация'='СПЕЦ', 'другое'='ДОК'

Статусы: черновик → на_согласовании → согласован → [на_подписи_в_эдо →]
  загружен_частично → подписан → на_исполнении (↘ отклонён)

statusLabel/statusColor — в 3 местах (ContractsList.tsx х2, ContractTabs.tsx)
  на_подписи_в_эдо: 'На подписи в ЭДО', 'bg-purple-100 text-purple-800'

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
✅ AI (EpotosGPT): Legal Review, Паспорт, Анализ — gemini-2.5-flash
✅ Реквизиты компаний, реестр контрагентов (DaData)
✅ Дашборды: юридический, финансовый
✅ Контроль исполнения, чек-листы, задачи Б24
✅ Автобэкап Яндекс.Диск (17:00), крон дедлайнов (09:00)
✅ Soft delete (скрыт от всех включая рабочий стол)
✅ Помощь и поддержка (FAQ, Realtime чат)
✅ Связанные документы
✅ Inline edit реквизитов + блокировка LOCKED_STATUSES
✅ AI сравнение подписанного документа (Claude — ПЛАТНАЯ!)
✅ Генерация шаблонов (JSZip) — ТХ все 10 шаблонов
✅ Реестр контрагентов: поиск + DaData + запрет ручного ввода
✅ Чат: reply + удаление (5 мин) + редактирование
✅ Главная: sticky шапка, поиск по customer_number, фильтр контрагентов с автодополнением
✅ Realtime сортировка по активности чата
✅ ЭДО-голосование (полный цикл)
✅ Мобильная адаптация (шапка, карточка, дашборды)
✅ База знаний ИИ — вкладка в Настройках (загрузка в Эпотос-Core)
✅ Безопасность: серверная верификация auth_id через /api/bitrix/verify
✅ Уведомления: ссылка → конкретный документ (?contract_id=)
✅ Фильтр шаблонов по компании в Настройках
✅ ЭПОТОС-Ассистент: вкладка в /help (чат с ИИ, первая вкладка)
✅ Иностранные контрагенты: фильтр, добавление, флаги 🇷🇺/🌍 в реестре
✅ Файлы контрагента: 4 категории, Storage bucket counterparty-docs
  API: /api/counterparties/[id]/documents (GET/POST/DELETE)

⬜ Переключатель рос/иностр в форме создания документа
⬜ СБИС интеграция (проверка по ИНН)
⬜ Инструкция пользователя → загрузка в базу знаний
⬜ Шаблоны НПП, СПТ, ОС, Эпотос-К — после Эпотос-Core


=============================================================
8. ИЗВЕСТНЫЕ ПРОБЛЕМЫ
=============================================================
⚠️ PDF анализ — просим конвертировать в DOCX (unpdf нестабилен)
⚠️ Мобильный Б24: пользователь без auth_id → разрешён доступ (компромисс)
⚠️ ЭПОТОС-Ассистент: нужна инструкция пользователя для точных ответов
⚠️ Таблица документов: небольшой горизонтальный скролл в Б24 iframe


=============================================================
9. ГДЕ ОСТАНОВИЛИСЬ (10.06.2026)
=============================================================
Сделано в текущую сессию:
  ✅ Иностранные контрагенты (реестр, фильтр, модалка добавления)
  ✅ Файлы контрагента (4 категории, Storage, API)
  ✅ Миграция БД: is_foreign, country, registration_number в counterparties
  ✅ Новая таблица counterparty_documents
  ✅ Bucket counterparty-docs в Supabase Storage

Следующие задачи (по приоритету):
  1. Переключатель рос/иностр в форме создания документа (new/page.tsx)
  2. СБИС интеграция (нужен Client ID + Client Secret из СБИС)
  3. Написать и загрузить инструкцию пользователя → тестирование ассистента
  4. Тестирование ЭДО с реальными пользователями


=============================================================
10. ПЛАН РАЗРАБОТКИ
=============================================================
✅ Спринт 1, 2, 3 — завершены
🔄 Спринт 4 (активен):
  ✅ ЭПОТОС-Ассистент API + интерфейс
  ✅ Иностранные контрагенты
  ✅ Файлы контрагента
  ⬜ Переключатель рос/иностр в создании документа
  ⬜ СБИС интеграция
  ⬜ Инструкция пользователя
  ⬜ ЭПОТОС-ПЕРСОНАЛ

🔴 Спринт 5:
  - Шаблоны НПП, СПТ, ОС, Эпотос-К
  - Импорт договоров из Excel
  - Календарь судебных заседаний
  - Эпотос-РИД


=============================================================
11. АРХИТЕКТУРНЫЕ РЕШЕНИЯ
=============================================================
Уведомления: /api/bitrix-notify (POST напрямую)
  Ссылка: /?contract_id=${id} → useBitrixAuth → window.location.replace
  Типы: document_created, sent_for_approval, approval_required,
    document_approved, document_rejected, documents_uploaded,
    checklist_generated, checklist_deadline,
    edo_request, edo_decision, edo_task

Безопасность:
  auth_id → sessionStorage → /api/bitrix/verify → Б24 profile API
  Без auth_id (мобильный) → доступ разрешён (компромисс)

ЭДО: ГД из approval_settings (stage='director') — НЕ company_directors!
  Блок «Способ подписания» в правой колонке вкладки Согласование
  API: /api/approvals/[sessionId]/edo

Иностранные контрагенты:
  is_foreign=true, inn='FOREIGN-{timestamp}', country, registration_number
  Поиск: только по нашей базе
  Флаг 🌍 в реестре, фильтр Все/Российские/Иностранные

Файлы контрагента:
  Storage: counterparty-docs (PUBLIC)
  Категории: charter/poa/order/other
  API: /api/counterparties/[id]/documents (GET/POST/DELETE)
  Путь в Storage: {counterparty_id}/{category}/{timestamp}_{filename}

ЭПОТОС-Ассистент:
  Бэкенд: https://epotos-core.vercel.app
  coreUrl = 'https://epotos-core.vercel.app'
  Интерфейс: /help → первая вкладка «🤖 ЭПОТОС-Ассистент»

Шаблоны:
  После правки в Word → py check_xml.py → загрузить
  Путь: шаблоны\templates_fixed\


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
8. Деплой:
   git add -A / git commit -m "..." / git push
9. Если фрагмент не найден → обновить repomix
10. git log завис → нажать q
11. Python скрипты → терминал из папки шаблоны (py script.py)
