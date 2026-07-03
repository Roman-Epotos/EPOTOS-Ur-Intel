# CONTEXT-YURINTEL.md — ЮрИнтел-Эпотос
Дата: 2026-07-03
Статус: Спринт 4 активен

=============================================================
1. О ПРОЕКТЕ
=============================================================
Название: ЮрИнтел-Эпотос (первый модуль платформы ЭПОТОС-Витрина Данных)
Компания: ГК ЭПОТОС (epotos.ru) — производство противопожарного оборудования
Дочерние: ООО Техно (ТХ), НПП ЭПОТОС (НПП), СПТ (СПТ), ОС (ОС), Эпотос-К (Э-К)

URL: https://epotos-ur-intel.vercel.app
GitHub: https://github.com/Roman-Epotos/EPOTOS-Ur-Intel
Битрикс24: https://gkepotos.bitrix24.ru/marketplace/app/252/
Название в Б24: ЮрИнтел-Эпотос
ВАЖНО: iframe-приложение в Битрикс24. Авторизация через Битрикс24 SSO.
ВАЖНО: код приложения в Б24 менялся 248 → 252 после переустановки.
  Если приложение переустанавливали снова — проверить актуальный код
  в URL Б24 (gkepotos.bitrix24.ru/marketplace/app/{код}/) и при
  необходимости заменить во всех ссылках (notify.ts, компоненты).

Путь к проекту: E:\ИСКУССТВЕННЫЙ ИНТЕЛЛЕКТ (AI)\ЭПОТОС-ВИТРИНА ДАННЫХ\ДОГОВОРЫ ЭПОТОС\EPOTOS-Ur-Intel
ВАЖНО: диск именно E:\ — не F:\ (регулярная путаница в PowerShell)


=============================================================
2. ТЕХНОЛОГИЧЕСКИЙ СТЕК
=============================================================
Next.js 14, TypeScript, Tailwind CSS, Supabase (cloud) + pgvector
AI основная: OpenRouter (google/gemini-2.5-flash)
AI PDF сравнение: OpenRouter (anthropic/claude-sonnet-4-5) — ПЛАТНАЯ! только ai-document-compare
Редактор: OnlyOffice (https://office.epotos-port.ru)
Storage: Supabase (buckets: contracts PUBLIC, templates PUBLIC, counterparty-docs PUBLIC)
Хостинг: Vercel Pro (с 03.07.2026, оплачен и подключен, Redeploy выполнен)
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
ВАЖНО: После переподключения Б24 приложения — обновить BITRIX_CLIENT_ID и
  BITRIX_CLIENT_SECRET в Vercel Environment Variables + Redeploy,
  а также проверить код приложения в URL (см. раздел 1)


=============================================================
4. СТРУКТУРА БАЗЫ ДАННЫХ
=============================================================
GRANT SELECT,INSERT,UPDATE,DELETE ON public.<table> TO anon,authenticated,service_role;
RLS включён на всех таблицах.

counterparties — УНИКАЛЬНЫЙ КЛЮЧ: (inn, kpp)!
  Основные поля: id, inn, kpp, ogrn, full_name, short_name, status, risk_level,
    director_name, director_title, phone, email, legal_address, website,
    signatory_name, poa_number, poa_date, poa_expires, notes,
    actual_address, created_at, updated_at
  Иностранные: is_foreign=true, country, registration_number
  Физлица: is_individual=true, person_birth_date, passport_series,
    passport_number, passport_issued_by, passport_issued_date,
    passport_dept_code, person_snils
  Иностранные: inn='FOREIGN-{timestamp}', kpp=NULL
  Физлица: inn=ИНН (12 цифр) или 'IND-{timestamp}' если не указан
  inn_verified_at (timestamptz) — дата подтверждения ИНН физлица по алгоритму ФНС

counterparty_documents:
  category (charter/poa/order/other), Storage: counterparty-docs
  ВАЖНО: загрузка через uploadFileDirect (presigned URL)

counterparty_checks — кэш проверок надёжности (10 дней):
  inn, risk_level IN ('low','medium','high'), dadata/fssp/bankrupt/rnp JSONB
  API: POST /api/counterparties/check, GET /api/counterparties/check-cache

company_requisites:
  Все поля включая: warehouse_address (адрес склада)
  director_short_name, basis, fax

approval_sessions — ЭДО поля:
  edo_requested, edo_director_decision IN ('approved','rejected')
  signing_method IN ('edo','simple')
  status IN ('active','completed','cancelled') — 'cancelled' используется
    при отклонении документа; GET /api/approvals ВОЗВРАЩАЕТ все три статуса
    (история сохраняется, не только active/completed)
  ВАЖНО: выбор специалиста ЭДО убран из UI

approval_participants:
  role IN ('required','optional','observer') — CHECK-ограничение обновлено
    (approval_participants_role_check), добавлена роль 'observer' (Наблюдатель)
  status IN ('pending','approved','rejected','acknowledged','disabled',
    'completed_by_initiator','observing') — CHECK-ограничение обновлено
    (approval_participants_status_check), добавлен статус 'observing'
  Наблюдатель (role='observer') сразу получает status='observing' при
    создании — не блокирует allApproved, не получает push-уведомление,
    но добавляется в чат Б24 и видит внутренний чат согласования
  ВАЖНО: ГД (director) и Бухгалтерия (accounting) — обязательны при запуске

document_attachments: без колонки file_type!

system_roles: role IN ('admin','gc_manager','finance_gc','finance_company','legal_gc')
ADMIN_IDS = [30, 1148]


=============================================================
5. НУМЕРАЦИЯ, ТИПЫ, СТАТУСЫ
=============================================================
Нумерация: ПРЕФИКС-ТИПКОД-ГОД/МЕСЯЦ/НН
ВАЖНО: используем numeric max (не ORDER BY) — исправлен баг лексикографической сортировки
ВАЖНО (ИЗМЕНЕНО 03.07.2026): фильтр deleted_at=is.null УБРАН из запроса
  генерации номера (app/api/contracts/route.ts). Раньше мягко удалённый
  документ "освобождал" номер, и тот переиспользовался при конфликте
  (удалённый документ можно восстановить — номер задваивался). Теперь
  номер мягко удалённого документа продолжает учитываться в максимуме
  и просто пропускается; при безвозвратном удалении номер того года
  остаётся неиспользованным пробелом в последовательности — это ожидаемо.
ВАЖНО: Э-К — двойной префикс → company_prefix из БД или startsWith('Э-К')

Статусы: черновик → на_согласовании → согласован → [на_подписи_в_эдо →]
  загружен_частично → подписан → на_исполнении (↘ отклонён)
LOCKED_STATUSES = ['согласован','на_подписи_в_эдо','загружен_частично','подписан','на_исполнении']


=============================================================
6. РЕАЛИЗОВАННЫЙ ФУНКЦИОНАЛ
=============================================================
✅ CORE: документы, версионирование, OnlyOffice, журнал аудита
✅ СОГЛАСОВАНИЕ: ГД + Бухгалтерия обязательны, отмена голоса с причиной
✅ Роль «Наблюдатель» в согласовании (role='observer', status='observing'):
   Добавляется через ту же модалку «Добавить участника» (3-й пункт списка)
   Не блокирует переход в «Согласован», не получает push «требуется решение»
   Автоматически в чате Б24, видит внутренний чат ЮрИнтел
   Добавление к завершённой сессии НЕ переоткрывает согласование
   Удаление доступно администратору (условие includes 'observing')
   Корректная метка «Наблюдатель» в сообщениях чата/логов
   Фильтр списка участников: Все / Обязательные / Для информирования / Наблюдатели
✅ Отмена ошибочного ОТКЛОНЕНИЯ согласования (по аналогии с отменой согласования):
   GET /api/approvals включает статус 'cancelled' — история не исчезает
   revoke route реактивирует сессию (status→active) и контракт (→на_согласовании)
   UI показывает участников + баннер «❌ Документ отклонён» вместо пустого экрана
   Кнопки Согласовать/Отклонить/Ознакомиться скрыты, пока сессия не активна
✅ Статус «Отклонён» корректно отображается в UI сразу (setContractStatus
   в handleReject и handleRevokeVote — раньше требовался reload)
✅ Крон уведомлений о сроках согласования (/api/cron/approval-reminder, 06:00 UTC):
   За 1 день до дедлайна, в день дедлайна, через 3 дня просрочки (с предложением
   продлить срок) — колокольчик (не согласовавшим + инициатору), чат Б24, ЮрИнтел
✅ Уведомление в чат Б24 о решении ГД по ЭДО (разрешение/отказ)
✅ Наблюдатель-инициатор (WATCHERS) и кликабельная ссылка на карточку документа
   в задачах Б24, создаваемых из пунктов чек-листа «Контроль исполнения»
✅ Лист согласования — кнопка на вкладке «Согласование», доступна на любом
   этапе (показывает текущий статус: кто согласовал/отклонил/наблюдает).
   Реализовано через HTML (не jsPDF — были проблемы с кириллицей) в новой
   вкладке браузера: реквизиты документа, таблица участников, блок ЭДО,
   примечание с ID сессии; верхняя панель — кнопка печати/сохранения PDF
   через window.print()
✅ Чекбокс «Разрешить запуск согласования другим сотрудникам ГК» — формулировка
   прояснена, добавлена подсказка (документ и так виден в общем реестре —
   галочка разрешает коллегам самим нажать «Запустить согласование»)
✅ Фильтр по компаниям в Настройки → Согласующие → Дополнительные
✅ AI (EpotosGPT): Legal Review, Паспорт, Анализ — gemini-2.5-flash
✅ Реквизиты компаний + поле «Адрес склада»
✅ Реестр контрагентов: Российские / Иностранные / Физлица
  Физлица: is_individual=true, паспортные данные, СНИЛС
  Карточка физлица — отдельный вид с паспортными полями
  Переключатель 👤 Физлицо в форме создания документа
✅ Проверка ИНН физлица по алгоритму ФНС (контрольная сумма, на фронте)
✅ Проверка надёжности: DaData, ФССП, ЕФРСБ, РНП ФАС (кэш 10 дней)
✅ Дашборды: юридический, финансовый
✅ Контроль исполнения, чек-листы, задачи Б24
✅ Крон: backup (17:00), checklist-deadline (09:00), edo-reminder (07:00),
   approval-reminder (06:00)
✅ Soft delete — фильтр deleted_at во всех запросах (кроме генерации номера)
✅ Помощь и поддержка, ЭПОТОС-Ассистент (/help, первая вкладка), FAQ дополнен
   (генерация чек-листа, постановка задачи на оплату из чек-листа)
✅ Генерация шаблонов (JSZip):
   ТХ — все 10 шаблонов
   СПТ — поставка, nda, персданные (загружены ✅)
   ОС — поставка, nda, персданные (загружены ✅)
   Э-К — Договор поставки типовой ✅, NDA ✅ (buyer_signatory_title/basis
     автозаполняются из company_requisites); персданные — в плане
   НПП — в плане
✅ Прямая загрузка файлов: uploadFileDirect + upload-proxy fallback.
   Также используется для загрузки НОВОЙ ВЕРСИИ документа (app/contracts/[id]/upload)
   — раньше падало на файлах >4.5MB, /api/versions теперь поддерживает
   JSON-путь (file_url/file_name) в дополнение к старому FormData-пути
✅ Прокси файлов Supabase: proxyUrl(url) → /api/file-proxy
✅ PDF просмотр: кнопка «👁️ Просмотр» для PDF в разделе Документы и вложениях
✅ Просмотр всех форматов в «Подписанных экземплярах»: кнопка «👁️ Просмотр» для любого файла
✅ Drag & drop загрузка подписанного файла (pdf, docx, xlsx)
✅ Подтверждение «Все документы загружены» — исправлена проверка прав для
   спецподписантов (company_prefix теперь верно учитывает двойной дефис Э-К),
   добавлена обработка ошибок на бэке и фронте (раньше ошибка пряталась,
   кнопка закрывала окно как будто всё ок)
✅ ЭДО упрощён: убран выбор специалиста, подписание вне системы
✅ Бейдж статуса ЭДО на главной странице
✅ Безопасность: редирект гостей на Б24 (window.self === window.top)
✅ Таблица документов: статус всегда виден, numeric нумерация
✅ Sanitize имён файлов: кириллица→латиница, №→_, спецсимволы→_
✅ Ссылка из уведомлений/чата Б24 → карточка документа: работает через
   ПКМ «открыть в новой вкладке» при свежей авторизации (см. раздел 7 —
   прямой клик внутри iframe чата Б24 пока не решён до конца)
✅ Оптимизация главной страницы: /api/my-documents грузится один раз,
   передаётся в MyDocuments и PersonalStats через пропсы
✅ Поле ввода внутреннего чата документа: input → textarea с авто-ростом
   до 5 строк (120px, как в WhatsApp/Telegram), Shift+Enter — перенос
   строки, Enter — отправка, высота сбрасывается после отправки


=============================================================
7. ИЗВЕСТНЫЕ ПРОБЛЕМЫ / НА ПАУЗЕ
=============================================================
⚠️ ГЛУБОКАЯ ССЫЛКА ИЗ ЧАТА Б24 (не решено до конца, диагностировано):
   ПКМ → «открыть в новой вкладке» работает корректно при свежей сессии
   (валидный auth_id в sessionStorage).
   Прямой клик по ссылке ВНУТРИ iframe-чата Б24 не работает — Б24 всегда
   открывает iframe с базовым URL приложения, contract_id теряется
   (подтверждено консоль-логами: window.location.search содержит только
   auth_id/domain/member_id, contract_id отсутствует).
   КОРНЕВАЯ причина мерцания «карточка → главная» в отдельной вкладке:
   auth_id Битрикса истекает (~1 час), refresh_id уже получаем и сохраняем
   в sessionStorage, но НЕ используем для тихого обновления токена.
   При истечении токена: verify() возвращает invalid → sessionStorage чистится
   → reload → нет ни URL-параметров, ни сессии → редирект на БАЗОВЫЙ URL
   Б24 (контекст документа теряется).
   РЕШЕНИЕ СПРОЕКТИРОВАНО, не реализовано: новый роут app/api/bitrix/refresh
   через oauth.bitrix24.tech/oauth/token/ (grant_type=refresh_token,
   client_id, client_secret, refresh_token=stored refresh_id) — молча
   обновлять auth_id вместо редиректа на Б24. Следующий шаг на будущее.
⚠️ PDF анализ — просим конвертировать в DOCX
⚠️ Баг: кнопка загрузки в базе знаний зависает (файл загружается) — отложено
⚠️ Рабочий стол: мягко удалённые документы — частично исправлено
   (my-documents API фильтрует, dashboard/page.tsx с no-store cache)
⚠️ Обратная связь пользователей (файл от 01.07.2026) — выполнены п.1, п.2,
   п.4, п.9, п.10; НЕ начаты:
   п.3 — приёмка оригинала документа на хранение в юр. отдел (новая вкладка,
     статус «На хранении»/«На хранении в ЮО», права: юрист ГК — все компании,
     юрист компании — своя)
   п.5 — всплывающие подсказки по системе
   п.6 — доступ к ЭПОТОС-Ассистенту с любой страницы (не только /help)
   п.7 — визуальная инструкция (фото/видео) по сценариям работы
   п.8 — источник данных для дебиторской задолженности на финдашборде


=============================================================
8. ГДЕ ОСТАНОВИЛИСЬ (03.07.2026)
=============================================================
Сделано в текущую сессию (очень объёмная, см. раздел 6 для полного списка):
  ✅ Шаблон Э-К: NDA — размечен, загружен, buyer_signatory_title/basis
     автозаполнение из company_requisites
  ✅ Vercel Pro — оплачен, подключен, Redeploy сделан
  ✅ Переподключение Б24-приложения (client_id/secret), код 248→252
  ✅ Срочный фикс: большие PDF (>4.5MB) при загрузке версии документа
  ✅ Срочный фикс: история согласования сохраняется при отклонении +
     возможность отменить ошибочное отклонение
  ✅ Срочный фикс: статус «Отклонён» в UI, подтверждение загрузки для Э-К
  ✅ Новая роль «Наблюдатель» в согласовании (полностью)
  ✅ Обратная связь: п.1 (лист согласования), п.2 (уведомление ЭДО-решения),
     п.4 (напоминания о сроках), п.9 (watcher+ссылка в задачах), п.10 (FAQ)
  ✅ Фикс нумерации документов (мягко удалённые не освобождают номер)
  ✅ Чекбокс делегирования запуска согласования — прояснена формулировка
  ✅ Поле ввода чата документа — авто-рост textarea
  ⚠️ Диагностирована (не реализована) причина проблемы deep-link из чата Б24

Следующие задачи (по приоритету):
  1. ⬜ Реализовать /api/bitrix/refresh (тихое обновление токена через refresh_id)
     — решает проблему открытия карточки прямо из чата Б24
  2. ⬜ Шаблоны Э-К: Персданные
  3. ⬜ Обратная связь: п.3 (приёмка на хранение), п.6 (Ассистент везде),
     п.5 (тултипы), п.7 (визуальная инструкция), п.8 (дебиторка)
  4. ⬜ ЭПОТОС-ПЕРСОНАЛ
  5. ⬜ ЭПОТОС-РИД (результаты интеллектуальной деятельности)


=============================================================
9. ПЛАН РАЗРАБОТКИ
=============================================================
✅ Спринт 1, 2, 3 — завершены
🔄 Спринт 4 (активен):
  ✅ ЭПОТОС-Ассистент, иностранные контрагенты, файлы контрагента
  ✅ Инструкция, проверка надёжности, реорганизация вкладок
  ✅ Прокси + прямая загрузка, отмена согласования, бейдж ЭДО
  ✅ Адрес склада, шаблоны СПТ, физлица в реестре
  ✅ PDF просмотр, фикс нумерации (лексикографический), sanitize файлов
  ✅ Проверка ИНН физлица (алгоритм ФНС)
  ✅ Шаблоны ОС (поставка, nda, персданные)
  ✅ Ссылка Б24 → карточка документа (частично — см. раздел 7)
  ✅ Просмотр файлов в Подписанных экземплярах
  ✅ Drag & drop загрузка подписанного файла
  ✅ Шаблон Э-К: Договор поставки (типовой), NDA
  ✅ Оптимизация главной страницы
  ✅ Vercel Pro
  ✅ Роль «Наблюдатель» в согласовании
  ✅ Отмена ошибочного отклонения + сохранение истории
  ✅ Лист согласования (HTML/печать)
  ✅ Крон напоминаний о сроках согласования
  ✅ Фикс нумерации при мягком удалении
  ⬜ /api/bitrix/refresh — тихое обновление токена Б24
  ⬜ Шаблоны Э-К: персданные
  ⬜ Обратная связь: п.3, 5, 6, 7, 8
  ⬜ ЭПОТОС-ПЕРСОНАЛ

🔴 Спринт 5:
  - Шаблоны НПП
  - Импорт договоров из Excel
  - Календарь судебных заседаний
  - ЭПОТОС-РИД (результаты интеллектуальной деятельности)


=============================================================
10. АРХИТЕКТУРНЫЕ РЕШЕНИЯ
=============================================================
Безопасность:
  auth_id → sessionStorage → /api/bitrix/verify → Б24 profile API
  Без sessionStorage И без URL params → редирект на Б24 (только если self===top)
  window.self === window.top → прямая ссылка без авторизации
  Мобильный Б24: нет auth_id → разрешаем (storedUser без auth_id)
  ОГРАНИЧЕНИЕ (см. раздел 7): auth_id истекает ~1 час, refresh_id получаем
    но не используем — при истечении токена в отдельной вкладке происходит
    редирект на базовый URL Б24, контекст документа теряется

ЭДО (упрощённый алгоритм):
  Финансист → ГД → решение (уведомление в чат Б24) → способ подписания
  Подписание вне системы → бухгалтер/инициатор загружает файл
  Крон /api/cron/edo-reminder (07:00) — напоминание через 3 дня

Напоминания о сроках согласования:
  Крон /api/cron/approval-reminder (06:00 UTC = 09:00 МСК)
  3 типа: approval_deadline_soon (за 1 день), approval_deadline_reached
    (в день дедлайна), approval_deadline_overdue (через 3 дня просрочки)
  Получатели колокольчика: не согласовавшие участники + инициатор
  Также: сообщение в чат Б24 (sendBitrixChatMessage) + личные сообщения

Отмена отклонения согласования (по аналогии с отменой согласования):
  GET /api/approvals: .in('status', ['active','completed','cancelled'])
  revoke/route.ts: wasRejected = participant.status === 'rejected' →
    при revoke также контракт.status → 'на_согласовании' и
    session.status → 'active' (реактивация)
  Фронт ContractTabs.tsx: hasSession = ['active','completed','cancelled']
    .includes(session.status); isSessionActive = session.status === 'active'
  Кнопки Согласовать/Отклонить/Ознакомиться гейтятся isSessionActive
  Кнопка «↩ Отменить» у участника видна при status IN ('approved','rejected')

Роль «Наблюдатель»:
  DB: approval_participants_role_check и _status_check расширены ALTER TABLE
  role='observer' → status='observing' сразу при создании (не 'pending')
  Прогресс/allApproved считают только role==='required' — наблюдатель
    исключён автоматически (проверки === 'required', не !== 'required')
  addUserToBitrixChat вызывается без условия по role — наблюдатель тоже
    попадает в чат Б24
  При добавлении к session.status==='completed' — реактивация ПРОПУСКАЕТСЯ
    если role==='observer' (условие && role !== 'observer')
  Удаление участника: ADMIN_IDS + status IN ('pending','observing')
  Фильтр списка участников (participantFilter state): all/required/optional/observer

Лист согласования:
  НЕ jsPDF/autoTable (проблема с кириллицей — кракозябры без доп. шрифта)
  HTML-строка → Blob → URL.createObjectURL → window.open(url, '_blank')
  Верхняя fixed-панель с кнопкой печати (window.print()), скрывается
    в @media print через className toolbar
  Данные: реквизиты документа, таблица участников (роль/ФИО/статус/дата/
    комментарий), блок ЭДО если запрошен, примечание с ID сессии

Фикс нумерации (deleted_at):
  app/api/contracts/route.ts — GET-запрос генерации номера БОЛЬШЕ НЕ
    фильтрует &deleted_at=is.null — мягко удалённые документы учитываются
    в maxNum, их номер не переиспользуется

Прямая загрузка файлов:
  app/utils/uploadFile.ts → uploadFileDirect(file, bucket, folder)
  Сначала PUT на signed_url Supabase → fallback POST /api/upload-proxy
  API presigned: POST /api/counterparties/upload-url
  Buckets: counterparty-docs, contracts
  Используется также в app/contracts/[id]/upload/page.tsx (новая версия
    документа) — /api/versions принимает JSON {contract_id, file_url,
    file_name, comment, user_name} в дополнение к старому FormData-пути

Прокси файлов: GET /api/file-proxy?url=... → proxyUrl(url)

Drag & drop подписанного файла:
  SignedDocumentUploadModal — label с onDragOver/onDragLeave/onDrop
  Разрешённые форматы: .pdf, .docx, .xlsx (isAllowedFile проверяет расширение)

Оптимизация главной страницы:
  app/page.tsx: useBitrixAuth + useState<MyDocsData> + useCallback loadMyDocs
  MyDocuments: пропсы (data, loading, onReload) — Realtime вызывает onReload()
  PersonalStats: пропс myDocsData — только один fetch /api/contracts-list

Чат документа — авто-растущее поле ввода:
  input → textarea, onChange вручную ставит style.height по scrollHeight
    (капается на 120px ≈ 5 строк, дальше overflow-y-auto)
  messageInputRef (useRef<HTMLTextAreaElement>) — после handleSendMessage
    высота сбрасывается на '40px'
  Enter с preventDefault() → отправка; Shift+Enter → перенос строки

Реестр контрагентов — типы:
  Российские: is_foreign=false, is_individual=false
  Иностранные: is_foreign=true, is_individual=false
  Физлица: is_individual=true
  API фильтры: ?individual_only=true / ?foreign_only=true / ?russian_only=true

Проверка ИНН физлица:
  Алгоритм ФНС (контрольная сумма, 12 цифр) — на фронте, без внешних запросов
  DaData не поддерживает поиск физлиц по ИНН (закрытые данные ФНС)

Шаблоны документов:
  check_xml.py: INPUT = 'ИмяФайла.docx' (без templates_fixed)
  Готовы: ТХ (10), СПТ (поставка, nda, персданные), ОС (поставка, nda, персданные)
          Э-К (поставка типовой, nda)
  EXTRA_FIELDS:
    поставка (ТХ): payment_days, contract_end_date, liability_limit_num
    поставка_спт (СПТ/ОС): payment_days, contract_end_date
    поставка_эк: place, counterparty_signatory_title, counterparty_basis,
      buyer_signatory_title, buyer_basis, prepayment_pct, prepayment_pct_words,
      postpayment_pct, postpayment_pct_words, payment_days, payment_days_words,
      counterparty_warehouse, fine_amount, fine_amount_words, contract_end_date
    nda: liability_limit_num
    nda_эк: counterparty_signatory_title, counterparty_basis, fine_amount,
      fine_amount_words
    персданные: subject_full_name, subject_birth_year, passport_series,
      passport_number, passport_issued_by, passport_dept_code,
      subject_address, subject_inn, subject_snils, pd_consent_date
  isSptOs = ['СПТ','ОС'].includes(company_prefix)
  isEk = company_prefix === 'Э-К'
  templateKey: _снг / _спт / _эк / base type
  buyer_* поля в buildFields (Э-К как Покупатель, из company_requisites):
    buyer_full_name, buyer_short_name, buyer_signatory, buyer_signatory_title,
    buyer_basis, buyer_ogrn, buyer_inn, buyer_kpp, buyer_address,
    buyer_bank_account, buyer_bank_name, buyer_bank_corr, buyer_bank_bik,
    buyer_phone, buyer_email, buyer_signatory_short

Проверка «Все документы загружены» (companyPrefix фикс):
  app/api/signed-documents/route.ts: companyPrefix = contract.number
    ?.startsWith('Э-К') ? 'Э-К' : (contract.number?.split('-')[0] ?? '')
    (раньше .split('-')[0] давал «Э» вместо «Э-К» — ломало canUploadSigned
    для спецподписанта Э-К, ID 782)
  status_only && confirm_all блок теперь проверяет error от .update()
  Фронт (кнопка «Все загружены») теперь проверяет res.ok/data.error
    перед закрытием модалки и reload — раньше ошибка пряталась

Notify types: document_created, sent_for_approval, approval_required,
  document_approved, document_rejected, documents_uploaded,
  checklist_generated, checklist_deadline, edo_reminder,
  approval_deadline_soon, approval_deadline_reached, approval_deadline_overdue

Вкладки карточки документа:
  details=Реквизиты/Чат, generate=Генерация, documents=Документы,
  approval=Согласование, ai=EpotosGPT, execution=Контроль исполнения,
  related=Связанные документы, history=История

Фикс Э-К:
  company_prefix = contract.company_prefix ?? (startsWith('Э-К') ? 'Э-К' : split('-')[0])
  Этот же паттерн нужно проверять в КАЖДОМ новом месте, где парсится
  company_prefix из contract.number — минимум 2 места это уже подводило
  (signed-documents/route.ts, возможно есть другие непроверенные)


=============================================================
11. ПРАВИЛА РАБОТЫ
=============================================================
1. Новые файлы — New-Item в PowerShell (относительный путь, если терминал
   уже в папке проекта — не указывать полный путь заново, риск опечатки)
2. Редактирование — ТОЛЬКО Ctrl+H в VS Code
3. Не более 3 блоков кода за раз, ждать подтверждения
4. Перед деплоем КОДА — npm run build
5. CONTEXT — без build, сразу git push
6. При зависании деплоя — git commit --allow-empty + git push
7. Repomix:
   npx repomix --config repomix-api.config.json
   npx repomix --config repomix-components.config.json
   npx repomix --config repomix-pages.config.json
8. Деплой (три команды построчно в одном блоке):
   git add -A
   git commit -m "..."
   git push
9. Если фрагмент не найден → обновить repomix, ИСКАТЬ ТОЧНЫЙ путь файла
   через grep/awk по repomix перед предложением замены — никогда не
   угадывать путь файла или содержимое кода
10. git log завис → нажать q
11. check_xml.py: INPUT = 'ИмяФайла.docx'
12. Диск проекта — E:\ (см. раздел 1); при работе с git revert/checkout
    учитывать, что repomix-файлы тоже версионируются и могут дать конфликт
    при merge/revert — разрешать через git checkout --theirs на них
