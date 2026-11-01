/* Bug report: a short form in a dialog, sent to Supabase (server/007-bug-reports.sql, function send_bug_report).
   Nobody can read reports through the app; the author reads them in Supabase → Table Editor → bug_reports.
   Uses globals from app.js / builds.js at call time (h, T, ch, tab, store, sb, openModal, toast, …). */

const REPORT_T = {
  uk: {
    btn: 'Повідомити про помилку', title: 'Повідомити про помилку', what: 'Що не так?',
    whatPh: 'Наприклад: печатка Ловкача на масці 59 рівня показує +13, а в грі +12',
    contact: 'Як з вами зв\'язатися (необов\'язково)', contactPh: 'Нік у Discord чи в грі',
    attach: 'Додати поточний білд (щоб я міг відтворити)', send: 'Надіслати', cancel: 'Скасувати',
    sent: 'Дякую! Повідомлення надіслано', short: 'Опишіть проблему трохи детальніше', fail: 'Не вдалося надіслати: ', limit: 'Забагато повідомлень поспіль, спробуйте за кілька хвилин',
    offline: 'Сервер не налаштований, напишіть у Discord: ondirty',
  },
  ru: {
    btn: 'Сообщить об ошибке', title: 'Сообщить об ошибке', what: 'Что не так?',
    whatPh: 'Например: печать Ловкача на маске 59 уровня показывает +13, а в игре +12',
    contact: 'Как с вами связаться (необязательно)', contactPh: 'Ник в Discord или в игре',
    attach: 'Приложить текущий билд (чтобы я мог воспроизвести)', send: 'Отправить', cancel: 'Отмена',
    sent: 'Спасибо! Сообщение отправлено', short: 'Опишите проблему чуть подробнее', fail: 'Не удалось отправить: ', limit: 'Слишком много сообщений подряд, попробуйте через несколько минут',
    offline: 'Сервер не настроен, напишите в Discord: ondirty',
  },
  en: {
    btn: 'Report a bug', title: 'Report a bug', what: 'What is wrong?',
    whatPh: 'For example: the Agile stamp on a level 59 mask shows +13, in the game it is +12',
    contact: 'How to reach you (optional)', contactPh: 'Discord or in-game name',
    attach: 'Attach the current build (so I can reproduce it)', send: 'Send', cancel: 'Cancel',
    sent: 'Thank you! The report has been sent', short: 'Please describe the problem in a bit more detail', fail: 'Could not send: ', limit: 'Too many reports in a row, try again in a few minutes',
    offline: 'The server is not set up, write on Discord: ondirty',
  },
};
const RT = () => REPORT_T[lang] || REPORT_T.ru;

function openReport() {
  const t = RT();
  if (!sbConfigured()) { toast(t.offline); return; }
  const msg = h('textarea', { class: 'code-area rp-msg', placeholder: t.whatPh, maxLength: 3000, spellcheck: true });
  msg.value = store.get('reportDraft', '');
  msg.addEventListener('input', () => store.set('reportDraft', msg.value));
  const contact = h('input', { class: 'inp', placeholder: t.contactPh, maxLength: 80, value: store.get('reportContact', '') });
  const inCalc = !toolOfTab(tab);
  const attach = h('input', { type: 'checkbox', checked: inCalc });
  const err = h('div', { class: 'warn', style: 'margin-top:6px' });
  const send = h('button', { class: 'btn primary', onclick: async () => {
    const text = msg.value.trim();
    if (text.length < 5) { err.textContent = t.short; msg.focus(); return; }
    send.disabled = true; err.textContent = '';
    try {
      await sb('rpc/send_bug_report', { method: 'POST', body: JSON.stringify({
        p_message: text, p_contact: contact.value.trim(), p_place: curTool() === 'calc' ? 'calc:' + tab : curTool(),
        p_version: (window.RQC_VERSION || {}).version || '', p_lang: lang, p_platform: window.RQC_WEB ? 'web' : 'app',
        p_build: attach.checked ? { name: buildName, ch } : null,
      }) });
      store.set('reportDraft', ''); store.set('reportContact', contact.value.trim());
      closeModal(); toast(t.sent);
    } catch (e) {
      send.disabled = false;
      err.textContent = /too many/.test(e.message) ? t.limit : t.fail + e.message;
    }
  } }, t.send);
  openModal(h('div', { class: 'dialog narrow' },
    h('div', { class: 'dialog-head' }, h('h3', null, t.title), h('button', { class: 'btn small ghost', onclick: closeModal }, '✕')),
    h('div', { class: 'dialog-body' },
      h('div', { class: 'hint', style: 'margin:0 0 6px' }, t.what), msg,
      h('div', { class: 'hint', style: 'margin:10px 0 6px' }, t.contact), contact,
      h('label', { class: 'check', style: 'margin-top:10px' }, attach, t.attach), err,
      h('div', { class: 'dialog-btns' }, h('button', { class: 'btn ghost', onclick: closeModal }, t.cancel), send))));
  setTimeout(() => msg.focus(), 50);
}
