// Pages for search engines on rqcalc.com: one static page per main search query (calculator, boss timer, database, calendar,
// the Windows program), plus robots.txt, sitemap.xml and the description / link-preview tags of the main page.
// Run by .github/workflows/pages.yml after the site is assembled:  node tools/build-landing.mjs _site
// Texts are Russian (what players search for); numbers come from the data files. Our own words only, nothing copied from the wiki.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(process.argv[2] || '_site');
const SITE = 'https://rqcalc.com';
const DOWNLOAD = 'https://github.com/Yoni300/rq-calc/releases/latest';

// numbers for the texts, rounded down so they stay true as the data grows
const D = require(path.join(ROOT, 'data/rqdata.js'));
const M = require(path.join(ROOT, 'data/base-monsters.js'));
const W = require(path.join(ROOT, 'data/base-world.js'));
const G = require(path.join(ROOT, 'data/base-goods.js'));
global.window = {};
require(path.join(ROOT, 'data/bosses.js'));
const down = (n, step) => (n >= step ? Math.floor(n / step) * step : n).toLocaleString('ru-RU').replace(/ /g, ' ');
const N = {
  classes: D.Class.length,
  gear: down(D.Equipment.length, 100), cards: down(D.Card.length, 50), stamps: down(D.Stamp.length, 10), talents: down(D.Talent.length, 50),
  monsters: down(M.length, 50), locations: down(W.locs.length, 10), npcs: down(W.npcs.length, 10), quests: down(W.quests.length, 100),
  recipes: down(W.recipes.length, 50), goods: down(Array.isArray(G) ? G.length : Object.keys(G).length, 100),
  bosses: window.RQ_BOSSES.reduce((n, b) => n + b.spots.length, 0),
};
const classNames = D.Class.map(c => c.Name).join(', ');

const PAGES = [
  {
    slug: 'calculator', short: 'Статы, урон и билды всех классов', tool: 'calc', img: 'calculator', nav: 'Калькулятор',
    title: 'Калькулятор Royal Quest — статы, урон, билды',
    desc: `Калькулятор персонажа Royal Quest онлайн: ${N.classes} классов, снаряжение с заточкой, печати, карты, таланты, бафы и ауры. Урон в секунду, здоровье, защита и PvP-статы, обмен билдами по ссылке.`,
    h1: 'Калькулятор Royal Quest',
    lead: 'Соберите персонажа и сразу увидьте итоговые характеристики: урон в секунду, здоровье, защиту, шанс крита и PvP-статы. Работает в браузере и в программе для Windows, бесплатно.',
    open: 'Открыть калькулятор',
    features: [
      ['Все классы', `${classNames}. Уровень, пол, распределение статов и пассивные бонусы класса.`],
      ['Снаряжение', `Более ${N.gear} предметов с заточкой, ${N.cards}+ карт монстров и ${N.stamps}+ печатей. Бонусы наборов карт и коллекции учитываются.`],
      ['Таланты', `Деревья талантов всех классов (${N.talents}+ талантов) и гильдийские таланты.`],
      ['Эффекты', 'Бафы, эликсиры, еда, ауры группы, ивентовые бонусы, езда верхом. Каждый включается галочкой.'],
      ['Результат', 'Урон в секунду автоатакой, здоровье, защита и снижение урона, крит, уворот, попадание, PvP-характеристики. Видно, откуда взялся каждый бонус.'],
      ['Билды', 'Сохраняйте свои билды, делитесь ссылкой или картинкой, смотрите и оценивайте билды других игроков.'],
    ],
    faq: [
      ['Совпадают ли цифры с игрой?', 'Расчёт повторяет формулы игры: формулы и база взяты из калькулятора RQ Calc и дополнены данными royalquest.info. Если цифра расходится с игрой, нажмите «Сообщить об ошибке» (жучок вверху страницы).'],
      ['Как поделиться билдом?', 'Кнопка «Код» → «Ссылка» копирует ссылку на билд: кто её откроет, увидит ваш билд у себя. Там же — готовый пост для форума и картинка билда, а ещё билд можно опубликовать в общем списке.'],
      ['Нужно ли что-то устанавливать?', 'Нет, калькулятор работает прямо на сайте, в том числе с телефона. Программа для Windows даёт то же самое плюс сканер карт и статистику боя.'],
    ],
  },
  {
    slug: 'boss-timer', short: 'Респаун боссов и элит, общие таймеры для группы', tool: 'timer', img: 'boss-timer', nav: 'Таймер боссов',
    title: 'Таймер боссов Royal Quest — респаун боссов и элит',
    desc: `Таймер респауна боссов и элит Royal Quest: ${N.bosses} мест появления, общие таймеры для группы по коду, звук и оповещение за 5 минут до появления. Бесплатно, в браузере и в программе.`,
    h1: 'Таймер боссов Royal Quest',
    lead: 'Отметьте убийство босса — таймер покажет, когда он появится снова, и напомнит заранее. С друзьями или гильдией можно вести общие таймеры.',
    open: 'Открыть таймер',
    features: [
      ['Боссы и элиты', `${N.bosses} мест появления с уровнем, локацией и временем респауна. Босс, который живёт в нескольких местах, имеет отдельный таймер для каждого.`],
      ['Отметка в один клик', 'Кнопка «Убили» запускает отсчёт. Если убили раньше, можно указать, сколько минут назад или точное время.'],
      ['Оповещения', 'Звук и сообщение за 5 минут до появления и в момент появления. Звёздочкой отмечаются избранные — тогда оповещения только о них.'],
      ['Общие таймеры', 'Создайте группу и отправьте друзьям код из 8 символов: все видят одни и те же таймеры и кто отметил убийство.'],
      ['Своё время респауна', 'Время взято из вики игры. Если в игре иначе, нажмите на время и исправьте.'],
      ['Без регистрации', 'Личные таймеры хранятся на вашем устройстве, для группы нужен только код.'],
    ],
    faq: [
      ['Откуда время респауна?', 'Из вики игры royalquest.info. Его можно поправить для любого босса.'],
      ['Как вести таймеры с гильдией?', 'Нажмите «Создать группу» — код скопируется. Остальные нажимают «Войти по коду» и вставляют его.'],
      ['Будет ли оповещение, если вкладка свёрнута?', 'Да, пока сайт открыт во вкладке. Программа для Windows оповещает, даже когда свёрнута в трей.'],
    ],
  },
  {
    slug: 'base', short: 'Монстры, рецепты, предметы и где что взять', tool: 'base', img: 'base', nav: 'База',
    title: 'База Royal Quest — монстры, рецепты, предметы, где взять',
    desc: `База знаний Royal Quest: ${N.monsters}+ монстров с дропом, ${N.locations}+ локаций с картами, ${N.recipes}+ рецептов с деревом крафта и стоимостью, ${N.quests}+ заданий, НПС, карты, печати и где взять любой предмет.`,
    h1: 'База Royal Quest',
    lead: 'Монстры, локации, НПС, задания, рецепты и предметы в одном месте — с поиском и ответом на главный вопрос: где это взять.',
    open: 'Открыть базу',
    features: [
      ['Монстры', `${N.monsters}+ монстров: уровень, тип, стихия, где живут, что выпадает и какая карта.`],
      ['Локации и НПС', `${N.locations}+ локаций с картами, ${N.npcs}+ НПС с товарами, точки сбора и рыбалки.`],
      ['Задания', `${N.quests}+ заданий и цепочек с наградами.`],
      ['Дерево крафта', `${N.recipes}+ рецептов. Укажите, сколько сделать, — увидите все подрецепты, полный список ресурсов, станки и стоимость крафта по вашим ценам.`],
      ['Где взять', `Для ${N.goods}+ предметов и ресурсов: дроп, сбор, лавки НПС, задания, коробки, ивенты, крафт.`],
      ['Ивенты', 'Игровые события: когда проходят, что в них можно получить и как они работают.'],
    ],
    faq: [
      ['Сколько стоит скрафтить предмет?', 'Откройте рецепт: в «Дереве крафта» впишите свои цены ресурсов — посчитается «Стоимость крафта» с ценами НПС и обработкой на станках.'],
      ['Откуда данные?', 'Факты собраны с вики игры royalquest.info и регулярно обновляются. Описания написаны своими словами.'],
      ['Есть ли поиск?', 'Да, один поиск по всей базе: монстры, предметы, рецепты, задания, НПС.'],
    ],
  },
  {
    slug: 'calendar', short: 'Ивенты, акции и техработы', tool: 'calendar', img: 'calendar', nav: 'Календарь',
    title: 'Календарь Royal Quest — ивенты, акции, техработы',
    desc: 'Календарь событий Royal Quest: какие ивенты и акции идут сейчас, что скоро начнётся, когда техработы. Время в вашем часовом поясе, данные из официальных новостей игры.',
    h1: 'Календарь событий Royal Quest',
    lead: 'Что идёт в игре прямо сейчас, сколько осталось до конца и что начнётся скоро — ивенты, акции, сезоны и техработы на одной странице.',
    open: 'Открыть календарь',
    features: [
      ['Сейчас идёт', 'Текущие ивенты, акции и сезоны с полосой прогресса и временем до конца.'],
      ['Скоро', 'Что начнётся в ближайшие дни.'],
      ['Техработы', 'Когда сервер будет недоступен; ближайшие техработы видны полосой вверху страницы.'],
      ['Ваше время', 'Время переведено из московского в ваш часовой пояс.'],
      ['Новости игры', 'Объявления Royal Quest из Steam — с картинками, прямо рядом с календарём.'],
      ['Всегда свежие', 'Календарь обновляется сам каждые 20 минут по новостям игры.'],
    ],
    faq: [
      ['Откуда даты?', 'Из официальных новостей Royal Quest в Steam: даты берутся из текста объявлений.'],
      ['В каком часовом поясе время?', 'В вашем: время из новостей (МСК) переводится автоматически.'],
    ],
  },
  {
    slug: 'program', short: 'Сканер карт и статистика боя поверх игры', tool: null, img: 'combat-stats', nav: 'Программа',
    title: 'RQ Tools для Windows — сканер карт и статистика боя Royal Quest',
    desc: 'Бесплатная программа для Royal Quest: калькулятор, таймер боссов, база, сканер карт на знаки по F8 и статистика боя поверх игры — DPS, золото, опыт и лут. Обновляется сама.',
    h1: 'RQ Tools для Windows',
    lead: 'Всё, что есть на сайте, плюс два инструмента, которым нужен доступ к экрану игры: сканер карт и статистика боя. Бесплатно, обновляется сама.',
    open: null,
    features: [
      ['Статистика боя', 'Панель поверх игры: DPS с графиком, золото, опыт, убитые мобы и лут вживую. Пауза, сохранение сессий, импорт старых логов чата.'],
      ['Сканер карт', 'Наведите курсор на карту и нажмите F8 — программа покажет, сколько знаков она стоит и сколько это в золоте по вашей цене знака.'],
      ['Всё с сайта', 'Калькулятор, таймер боссов, база, календарь и новости — и без браузера.'],
      ['Трей и оповещения', 'Таймер боссов напоминает о респауне, даже когда окно свёрнуто в трей.'],
      ['Автообновление', 'Новая версия скачивается и ставится сама.'],
      ['Безопасно', 'Программа только читает экран и лог чата, как скриншот, и в игру не вмешивается.'],
    ],
    extraImg: 'card-scanner',
    faq: [
      ['Это бесплатно?', 'Да, полностью. Исходный код открыт на GitHub.'],
      ['Не забанят ли за программу?', 'Программа не трогает файлы и память игры: она только читает экран и лог чата, как обычный скриншот.'],
      ['Какая нужна система?', 'Windows 10 или 11.'],
    ],
  },
];

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const openUrl = p => (p.tool ? `/#${p.tool}` : '/');

function page(p) {
  const url = `${SITE}/${p.slug}/`;
  const img = `${SITE}/landing/img/${p.img}.jpg`;
  const ld = [
    { '@context': 'https://schema.org', '@type': 'WebApplication', name: p.h1, url, applicationCategory: 'GameApplication', operatingSystem: p.tool ? 'Any' : 'Windows', description: p.desc, image: img, inLanguage: 'ru', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: p.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ];
  const nav = PAGES.map(x => `<a href="/${x.slug}/"${x === p ? ' aria-current="page"' : ''}>${esc(x.nav)}</a>`).join('');
  const cta = (p.open ? `<a class="btn gold" href="${openUrl(p)}">${esc(p.open)}</a>` : '') +
    `<a class="btn${p.open ? '' : ' gold'}" href="${DOWNLOAD}" rel="noopener">Скачать для Windows</a>`;
  const shot = name => `<figure class="shot"><img src="/landing/img/${name}.jpg" width="1200" height="675" alt="${esc(p.h1)} — снимок экрана" loading="${name === p.img ? 'eager' : 'lazy'}"></figure>`;
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(p.title)} | RQ Tools</title>
  <meta name="description" content="${esc(p.desc)}">
  <link rel="canonical" href="${url}">
  <link rel="icon" type="image/png" href="/app/favicon.png">
  <link rel="apple-touch-icon" href="/app/apple-touch-icon.png">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="RQ Tools">
  <meta property="og:locale" content="ru_RU">
  <meta property="og:title" content="${esc(p.title)}">
  <meta property="og:description" content="${esc(p.desc)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${img}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="675">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#0b0a08">
  <link rel="stylesheet" href="/landing/landing.css">
  <script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
  <header class="top"><div class="wrap">
    <a class="brand" href="/"><span class="logo">◆</span> RQ Tools</a>
    <nav>${nav}</nav>
  </div></header>
  <main class="wrap">
    <section class="hero">
      <h1>${esc(p.h1)}</h1>
      <p class="lead">${esc(p.lead)}</p>
      <div class="cta">${cta}</div>
    </section>
    ${shot(p.img)}
    <section>
      <h2>Что умеет</h2>
      <div class="grid">${p.features.map(([t, d]) => `<div class="card"><h3>${esc(t)}</h3><p>${esc(d)}</p></div>`).join('')}</div>
    </section>
    ${p.extraImg ? shot(p.extraImg) : ''}
    <section>
      <h2>Вопросы и ответы</h2>
      <div class="faq">${p.faq.map(([q, a]) => `<details open><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
    </section>
    <section class="more">
      <h2>Другие инструменты RQ Tools</h2>
      <div class="links">${PAGES.filter(x => x !== p).map(x => `<a href="/${x.slug}/"><b>${esc(x.h1)}</b><span>${esc(x.short)}</span></a>`).join('')}</div>
    </section>
  </main>
  <footer class="wrap">
    <p>RQ Tools — бесплатный фанатский проект для игроков Royal Quest. Не связан с разработчиками игры. Связь: Discord <b>ondirty</b>.</p>
  </footer>
  <script>if (location.protocol === 'https:') new Image().src = 'https://rqtools.goatcounter.com/count?' + new URLSearchParams({ p: location.pathname, t: document.title, r: document.referrer, s: [screen.width, screen.height, window.devicePixelRatio || 1].join(','), rnd: Math.random().toString(36).slice(2) });</script>
</body>
</html>
`;
}

// main page of the site (the app itself): description and link preview, so search results and Discord show more than «RQ Tools»
function patchMain() {
  const f = path.join(OUT, 'index.html');
  let s = fs.readFileSync(f, 'utf8');
  const desc = 'RQ Tools — бесплатные инструменты для Royal Quest: калькулятор персонажа и билдов, таймер боссов, база монстров, рецептов и предметов, календарь ивентов.';
  const tags = [
    `<meta name="description" content="${esc(desc)}">`,
    `<link rel="canonical" href="${SITE}/">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="RQ Tools">',
    '<meta property="og:title" content="RQ Tools — калькулятор, таймер боссов и база Royal Quest">',
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${SITE}/">`,
    `<meta property="og:image" content="${SITE}/landing/img/calculator.jpg">`,
    '<meta name="twitter:card" content="summary_large_image">',
  ].map(t => '  ' + t).join('\n');
  s = s.replace('<title>RQ Tools</title>', '<title>RQ Tools — калькулятор, таймер боссов и база Royal Quest</title>\n' + tags);
  if (!s.includes('og:image')) throw new Error('main page: <title>RQ Tools</title> not found');
  fs.writeFileSync(f, s);
}

fs.mkdirSync(path.join(OUT, 'landing', 'img'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'web/landing/landing.css'), path.join(OUT, 'landing/landing.css'));
for (const f of fs.readdirSync(path.join(ROOT, 'web/landing/img'))) fs.copyFileSync(path.join(ROOT, 'web/landing/img', f), path.join(OUT, 'landing/img', f));
for (const p of PAGES) {
  fs.mkdirSync(path.join(OUT, p.slug), { recursive: true });
  fs.writeFileSync(path.join(OUT, p.slug, 'index.html'), page(p));
}
patchMain();
const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${['', ...PAGES.map(p => p.slug + '/')].map(u => `  <url><loc>${SITE}/${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`);
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
console.log('landing pages:', PAGES.map(p => p.slug).join(', '), N);
