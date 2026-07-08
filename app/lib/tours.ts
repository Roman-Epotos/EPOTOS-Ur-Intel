export interface TourStep {
  route: string
  selector: string
  title: string
  description: string
  popoverSide?: 'top' | 'bottom' | 'left' | 'right'
  // Шаг завершается сменой страницы на заранее неизвестный URL
  // (например, отправка формы создания документа → страница нового
  // договора с только что сгенерированным ID)
  advanceOnRouteChange?: boolean
}

export interface Tour {
  id: string
  title: string
  description: string
  icon: string
  steps: TourStep[]
}

export const TOURS: Tour[] = [
  {
    id: 'create-and-approve',
    title: 'Создать и запустить согласование',
    description: 'Как создать новый документ и отправить его на согласование',
    icon: '📄',
    steps: [
      {
        route: '/',
        selector: '[data-tour="new-doc-btn"]',
        title: 'Создание документа',
        description: 'Нажмите сюда, чтобы создать новый документ',
        popoverSide: 'bottom',
      },
      {
        route: '/contracts/new',
        selector: '[data-tour="submit-new-doc-btn"]',
        title: 'Заполните форму',
        description: 'Укажите компанию, контрагента и остальные поля формы, затем нажмите эту кнопку',
        popoverSide: 'top',
        advanceOnRouteChange: true,
      },
      {
        route: '/contracts/*',
        selector: '[data-tour="tab-approval"]',
        title: 'Вкладка «Согласование»',
        description: 'Документ создан. Перейдите на эту вкладку, чтобы запустить согласование',
        popoverSide: 'bottom',
      },
      {
        route: '/contracts/*',
        selector: '[data-tour="start-approval-btn"]',
        title: 'Запуск согласования',
        description: 'Нажмите эту кнопку, чтобы отправить документ на согласование',
        popoverSide: 'top',
      },
    ],
  },
]