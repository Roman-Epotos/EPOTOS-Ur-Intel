export function buildChatHtml(
  contract: { number: string; title: string },
  messages: {
    author_name: string
    created_at: string
    message?: string | null
    file_name?: string | null
  }[],
  periodLabel: string
): string {
  const rows = messages.length === 0
    ? '<div class="empty">Нет сообщений за выбранный период</div>'
    : messages.map(m => {
        const text = m.message
          ? '<div class="msg-text">' + m.message.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>'
          : ''
        const file = m.file_name
          ? '<div class="msg-file">📎 ' + m.file_name + '</div>'
          : ''
        const date = new Date(m.created_at).toLocaleString('ru-RU')
        return '<div class="msg"><div class="msg-header"><span class="msg-author">' +
          m.author_name + '</span><span class="msg-date">' + date + '</span></div>' +
          text + file + '</div>'
      }).join('')

  const printDate = new Date().toLocaleString('ru-RU')

  return '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<title>Чат согласования — ' + contract.number + '</title>' +
    '<style>' +
    'body{font-family:Arial,sans-serif;font-size:13px;color:#111;padding:24px;max-width:800px;margin:0 auto}' +
    'h2{font-size:16px;margin-bottom:4px}' +
    '.meta{color:#666;font-size:12px;margin-bottom:6px}' +
    '.period{color:#333;font-size:12px;font-weight:bold;margin-bottom:20px;border-bottom:2px solid #333;padding-bottom:8px}' +
    '.msg{border-bottom:1px solid #eee;padding:10px 0}' +
    '.msg-header{display:flex;gap:12px;margin-bottom:4px}' +
    '.msg-author{font-weight:bold}' +
    '.msg-date{color:#888;font-size:11px}' +
    '.msg-text{color:#333;white-space:pre-wrap}' +
    '.msg-file{color:#555;font-size:11px;margin-top:4px}' +
    '.empty{color:#888;font-style:italic;margin-top:20px}' +
    '@media print{body{padding:0}}' +
    '</style></head><body>' +
    '<h2>Чат согласования — ' + contract.number + '</h2>' +
    '<div class="meta">' + contract.title + '</div>' +
    '<div class="meta">Распечатано: ' + printDate + '</div>' +
    '<div class="period">' + periodLabel + ' · Сообщений: ' + messages.length + '</div>' +
    rows +
    '</body></html>'
}