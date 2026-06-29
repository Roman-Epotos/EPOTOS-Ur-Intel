# CONTEXT-YURINTEL.md — ЮрИнтел-Эпотос
Дата: 2026-06-29
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
Название в Б24: ЮрИнтел-Эпотос
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
ВАЖНО: После переподключения Б24 приложения — обновить BITRIX_CLIENT_ID и
  BITRIX_CLIENT_SECRET в Vercel Environment Variables + Redeploy


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
  ВАЖНО: выбор специалиста ЭДО убран из UI

approval_participants:
  status IN ('pending','approved','rejected','acknowledged','disabled','completed_by_initiator')
  ВАЖНО: ГД (director) и Бухгалтерия (accounting) — обязательны при запуске

document_attachments: без колонки file_type!

system_roles: role IN ('admin','gc_manager','finance_gc','finance_company','legal_gc')
ADMIN_IDS = [30, 1148]


=============================================================
5. НУМЕРАЦИЯ, ТИПЫ, СТАТУСЫ
=============================================================
Нумерация: ПРЕФИКС-ТИПКОД-ГОД/МЕСЯЦ/НН
ВАЖНО: используем numeric max (не ORDER BY) — исправлен баг лексикографической сортировки
ВАЖНО: фильтр deleted_at=is.null при генерации номера
ВАЖНО: Э-К — двойной префикс → company_prefix из БД или startsWith('Э-К')

Статусы: черновик → на_согласовании → согласован → [на_подписи_в_эдо →]
  загружен_частично → подписан → на_исполнении (↘ отклонён)
LOCKED_STATUSES = ['согласован','на_подписи_в_эдо','загружен_частично','подписан','на_исполнении']


=============================================================
6. РЕАЛИЗОВАННЫЙ ФУНКЦИОНАЛ
=============================================================
✅ CORE: документы, версионирование, OnlyOffice, журнал аудита
✅ СОГЛАСОВАНИЕ: ГД + Бухгалтерия обязательны, отмена голоса с причиной
✅ AI (EpotosGPT): Legal Review, Паспорт, Анализ — gemini-2.5-flash
✅ Реквизиты компаний + поле «Адрес склада»
✅ Реестр контрагентов: Российские / Иностранные / Физлица
  Физлица: is_individual=true, паспортные данные, СНИЛС
  Карточка физлица — отдельный вид с паспортными полями
  Переключатель 👤 Физлицо в форме создания документа
✅ Проверка ИНН физлица по алгоритму ФНС (контрольная сумма, на фронте)
  При вводе 12 цифр ИНН → бейдж «✅ ИНН корректен (проверка по алгоритму ФНС)»
  inn_verified_at сохраняется в БД при создании физлица
  API /api/counterparties/check-inn-individual — создан но не используется
✅ Проверка надёжности: DaData, ФССП, ЕФРСБ, РНП ФАС (кэш 10 дней)
✅ Дашборды: юридический, финансовый
✅ Контроль исполнения, чек-листы, задачи Б24
✅ Крон: backup (17:00), checklist-deadline (09:00), edo-reminder (07:00)
✅ Soft delete — фильтр deleted_at во всех запросах и нумерации
✅ Помощь и поддержка, ЭПОТОС-Ассистент (/help, первая вкладка)
✅ Генерация шаблонов (JSZip):
   ТХ — все 10 шаблонов
   СПТ — поставка, nda, персданные (загружены ✅)
   ОС — поставка, nda, персданные (загружены ✅)
   Э-К — Договор поставки типовой (загружен ✅); NDA, персданные — в плане
   НПП — в плане
✅ Прямая загрузка файлов: uploadFileDirect + upload-proxy fallback
   Применено везде: версии, вложения, подписанные, контрагенты, чат, генерация
✅ Прокси файлов Supabase: proxyUrl(url) → /api/file-proxy
✅ PDF просмотр: кнопка «👁️ Просмотр» для PDF в разделе Документы и вложениях
✅ Просмотр всех форматов в «Подписанных экземплярах»: кнопка «👁️ Просмотр» для любого файла
✅ Drag & drop загрузка подписанного файла (pdf, docx, xlsx)
✅ ЭДО упрощён: убран выбор специалиста, подписание вне системы
✅ Уведомления при загрузке подписанного файла + крон-напоминание
✅ Бейдж статуса ЭДО на главной странице
✅ Безопасность: редирект гостей на Б24 (window.self === window.top)
✅ Таблица документов: статус всегда виден, numeric нумерация
✅ Sanitize имён файлов: кириллица→латиница, №→_, спецсимволы→_
✅ Ссылка из чата Б24 → карточка документа:
   app/page.tsx читает contract_id из URL → router.replace('/contracts/{id}')
   useBitrixAuth.ts после авторизации тоже делает редирект по contract_id
✅ app/page.tsx переведён в 'use client' для поддержки useEffect/useRouter


=============================================================
7. ИЗВЕСТНЫЕ ПРОБЛЕМЫ / НА ПАУЗЕ
=============================================================
⚠️ PDF анализ — просим конвертировать в DOCX
⚠️ Баг: кнопка загрузки в базе знаний зависает (файл загружается) — отложено
⚠️ Рабочий стол: мягко удалённые документы — частично исправлено
   (my-documents API фильтрует, dashboard/page.tsx с no-store cache)
⚠️ Систематически у пользователей не получается войти с первого раза
   (помогает Ctrl+Shift+R) — требует исследования


=============================================================
8. ГДЕ ОСТАНОВИЛИСЬ (29.06.2026)
=============================================================
Сделано в текущую сессию:
  ✅ Drag & drop загрузка подписанного файла (pdf, docx, xlsx)
     SignedDocumentUploadModal — onDrop + isDragging state
  ✅ Шаблон Э-К «Договор поставки (типовой)» — размечен, обработан, загружен
     Якорные метки: contract_number, place, contract_date, counterparty_*/buyer_*
     реквизиты, prepayment_pct/words, postpayment_pct/words,
     payment_days/words, counterparty_warehouse, fine_amount/words
     EXTRA_FIELDS: поставка_эк (13 полей включая fine_amount/words)
     isEk = company_prefix === 'Э-К' → templateKey = type + '_эк'
     buyer_* поля в buildFields → из company_requisites Э-К
  ✅ Переподключение Б24 приложения:
     Новый client_id/client_secret обновлены в Vercel + Redeploy

Следующие задачи (по приоритету):
  1. ⬜ Шаблоны Э-К: NDA
  2. ⬜ Шаблоны Э-К: Персданные
  3. ⬜ ЭПОТОС-ПЕРСОНАЛ
  4. ⬜ ЭПОТОС-РИД (результаты интеллектуальной деятельности)


=============================================================
9. ПЛАН РАЗРАБОТКИ
=============================================================
✅ Спринт 1, 2, 3 — завершены
🔄 Спринт 4 (активен):
  ✅ ЭПОТОС-Ассистент, иностранные контрагенты, файлы контрагента
  ✅ Инструкция, проверка надёжности, реорганизация вкладок
  ✅ Прокси + прямая загрузка, отмена согласования, бейдж ЭДО
  ✅ Адрес склада, шаблоны СПТ, физлица в реестре
  ✅ PDF просмотр, фикс нумерации, sanitize файлов
  ✅ Проверка ИНН физлица (алгоритм ФНС)
  ✅ Шаблоны ОС (поставка, nda, персданные)
  ✅ Ссылка Б24 чат → карточка документа
  ✅ Просмотр файлов в Подписанных экземплярах
  ✅ Drag & drop загрузка подписанного файла
  ✅ Шаблон Э-К: Договор поставки (типовой)
  ⬜ Шаблоны Э-К: NDA, персданные
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
  Без sessionStorage И без URL params → редирект на Б24
  window.self === window.top → прямая ссылка без авторизации
  Мобильный Б24: нет auth_id → разрешаем (storedUser без auth_id)

ЭДО (упрощённый алгоритм):
  Финансист → ГД → решение → способ подписания (без специалиста)
  Подписание вне системы → бухгалтер/инициатор загружает файл
  Крон /api/cron/edo-reminder (07:00) — напоминание через 3 дня

Прямая загрузка файлов:
  app/utils/uploadFile.ts → uploadFileDirect(file, bucket, folder)
  Сначала PUT на signed_url Supabase → fallback POST /api/upload-proxy
  API presigned: POST /api/counterparties/upload-url
  Buckets: counterparty-docs, contracts

Прокси файлов: GET /api/file-proxy?url=... → proxyUrl(url)

Drag & drop подписанного файла:
  SignedDocumentUploadModal — label с onDragOver/onDragLeave/onDrop
  Разрешённые форматы: .pdf, .docx, .xlsx (isAllowedFile проверяет расширение)
  isDragging state → синяя рамка + иконка 📂 + текст «Отпустите файл...»

Редирект по contract_id:
  useBitrixAuth.ts: после авторизации через URL params проверяет contract_id
    → window.location.replace('/contracts/{id}')
  app/page.tsx: useEffect проверяет contract_id в URL
    → router.replace('/contracts/{id}')

Реестр контрагентов — типы:
  Российские: is_foreign=false, is_individual=false
  Иностранные: is_foreign=true, is_individual=false
  Физлица: is_individual=true
  API фильтры: ?individual_only=true / ?foreign_only=true / ?russian_only=true
  В select: is_individual добавлен

Проверка ИНН физлица:
  Алгоритм ФНС (контрольная сумма, 12 цифр) — на фронте, без внешних запросов
  Коэффициенты 11-й цифры: 7,2,4,10,3,5,9,4,6,8
  Коэффициенты 12-й цифры: 3,7,2,4,10,3,5,9,4,6,8
  При совпадении → innVerified=true → inn_verified_at=now() в БД
  DaData не поддерживает поиск физлиц по ИНН (закрытые данные ФНС)

Шаблоны документов:
  check_xml.py: INPUT = 'ИмяФайла.docx' (без templates_fixed)
  Готовы: ТХ (10), СПТ (поставка, nda, персданные), ОС (поставка, nda, персданные)
          Э-К (поставка типовой)
  EXTRA_FIELDS:
    поставка (ТХ): payment_days, contract_end_date, liability_limit_num
    поставка_спт (СПТ/ОС): payment_days, contract_end_date
    поставка_эк: place, counterparty_signatory_title, counterparty_basis,
      buyer_signatory_title, buyer_basis, prepayment_pct, prepayment_pct_words,
      postpayment_pct, postpayment_pct_words, payment_days, payment_days_words,
      counterparty_warehouse, fine_amount, fine_amount_words, contract_end_date
    nda: liability_limit_num
    персданные: subject_full_name, subject_birth_year, passport_series,
      passport_number, passport_issued_by, passport_dept_code,
      subject_address, subject_inn, subject_snils, pd_consent_date
  isSptOs = ['СПТ','ОС'].includes(company_prefix)
  isEk = company_prefix === 'Э-К'
  templateKey: _снг / _спт / _эк / base type
  buyer_* поля в buildFields → из company_requisites (реквизиты Э-К как Покупатель)
  counterparty_signatory = signatory_name из карточки (формат «Фамилия И.О.»)

Notify types: document_created, sent_for_approval, approval_required,
  document_approved, document_rejected, documents_uploaded,
  checklist_generated, checklist_deadline, edo_reminder

Вкладки карточки документа:
  details=Реквизиты/Чат, generate=Генерация, documents=Документы,
  approval=Согласование, ai=EpotosGPT, execution=Контроль исполнения,
  related=Связанные документы, history=История

Фикс Э-К:
  company_prefix = contract.company_prefix ?? (startsWith('Э-К') ? 'Э-К' : split('-')[0])


=============================================================
11. ПРАВИЛА РАБОТЫ
=============================================================
1. Новые файлы — New-Item в PowerShell
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
9. Если фрагмент не найден → обновить repomix
10. git log завис → нажать q
11. check_xml.py: INPUT = 'ИмяФайла.docx'
