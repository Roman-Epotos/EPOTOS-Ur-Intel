export const DOCUMENT_TYPES = [
  {
    group: 'Договоры',
    types: [
      { value: 'поставка', label: 'Договор поставки' },
      { value: 'услуги', label: 'Договор услуг' },
      { value: 'аренда', label: 'Договор аренды' },
      { value: 'подряд', label: 'Договор подряда' },
      { value: 'купля-продажа', label: 'Договор купли-продажи' },
      { value: 'агентский', label: 'Агентский договор' },
      { value: 'дилерский', label: 'Дилерский договор' },
      { value: 'лицензионный', label: 'Лицензионный договор' },
      { value: 'сервисный', label: 'Сервисный договор' },
    ]
  },
  {
    group: 'Соглашения',
    types: [
      { value: 'доп-соглашение', label: 'Дополнительное соглашение' },
      { value: 'nda', label: 'NDA / Соглашение о конфиденциальности' },
      { value: 'эдо', label: 'Соглашение о переходе на ЭДО' },
      { value: 'протокол-разногласий', label: 'Протокол разногласий' },
    ]
  },
  {
    group: 'Претензионно-исковые',
    types: [
      { value: 'претензия', label: 'Претензия' },
      { value: 'исковое', label: 'Исковое заявление' },
      { value: 'ответ-претензию', label: 'Ответ на претензию' },
    ]
  },
  {
    group: 'Организационно-распорядительные',
    types: [
      { value: 'положение', label: 'Положение' },
      { value: 'инструкция', label: 'Инструкция' },
      { value: 'служебная-записка', label: 'Служебная записка' },
    ]
  },
  {
    group: 'Доверенности и согласия',
    types: [
      { value: 'доверенность', label: 'Доверенность' },
      { value: 'персданные', label: 'Согласие на обработку персональных данных' },
    ]
  },
  {
    group: 'Акты и заключения',
    types: [
      { value: 'акт', label: 'Акт приёма-передачи' },
      { value: 'заключение', label: 'Правовое заключение' },
      { value: 'справка', label: 'Справка' },
    ]
  },
  {
    group: 'Учредительные',
    types: [
      { value: 'устав', label: 'Устав' },
      { value: 'учредительный', label: 'Учредительный договор' },
    ]
  },
  {
    group: 'Прочие',
    types: [
      { value: 'письмо', label: 'Письмо' },
      { value: 'счет', label: 'Счёт' },
      { value: 'другое', label: 'Другое' },
    ]
  },
]

// Категории для определения типа анализа AI
export const CONTRACT_DOCUMENT_TYPES = [
  'поставка', 'услуги', 'аренда', 'подряд', 'купля-продажа',
  'агентский', 'дилерский', 'лицензионный', 'сервисный',
  'доп-соглашение', 'nda', 'эдо', 'протокол-разногласий',
  'претензия', 'исковое', 'ответ-претензию'
]

// Регионы
export const REGIONS = [
  { value: '', label: 'Не указан' },
  { value: 'РФ', label: 'Российская Федерация' },
  { value: 'СНГ', label: 'Страны СНГ' },
  { value: 'международный', label: 'Международный' },
]

// Вспомогательная функция для получения label по value
export function getDocumentTypeLabel(value: string): string {
  for (const group of DOCUMENT_TYPES) {
    const found = group.types.find(t => t.value === value)
    if (found) return found.label
  }
  return value
}

// JSX helper для рендера optgroup
export function renderDocumentTypeOptions() {
  return DOCUMENT_TYPES.map(group => ({
    group: group.group,
    options: group.types,
  }))
}