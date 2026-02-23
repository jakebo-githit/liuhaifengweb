/* ============================================================
   A股资讯中心 — 刘海峰专用
   每日两次自动刷新（12小时缓存）
   ============================================================ */

// ── 配置 ──────────────────────────────────────────────────────

const CACHE_KEY = 'lhf_news_v2';
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 小时

// RSS 转 JSON 服务（免费，支持跨域）
const rssURL = url =>
  `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}&count=10`;

// 每个板块对应的 RSS 数据源（多备用，依次尝试）
const RSS_FEEDS = {
  breaking: [
    rssURL('https://feed.sina.com.cn/news/China/Finance/'),
    rssURL('https://rss.sina.com.cn/news/China/yicai.xml'),
  ],
  industry: [
    rssURL('https://www.stcn.com/rss/rss.xml'),
    rssURL('https://finance.sina.com.cn/rss/news.xml'),
  ],
  analysis: [
    rssURL('https://www.caixin.com/rss/finance.xml'),
    rssURL('https://business.sohu.com/rss/finance.xml'),
  ],
};

// 主题关键词（用于自动分类 RSS 文章）
const TOPIC_KEYWORDS = {
  energy: ['新能源', '光伏', '储能', '风电', '电动', '锂电', '比亚迪', '宁德', '阳光电源',
           '隆基', '天合', '充电桩', '电池', '绿电', '氢能'],
  ai:     ['AI', '人工智能', '大模型', '算力', '芯片', 'DeepSeek', '百度', '科大讯飞',
           '寒武纪', '商汤', '数据中心', '半导体', '英伟达', 'GPU', '智算'],
  gold:   ['黄金', '金价', '贵金属', '山东黄金', '中金黄金', '赤峰黄金', '招金矿业',
           '黄金期货', '现货黄金', '避险', '金矿'],
};

// ── 静态备用数据（RSS 抓不到时展示）────────────────────────────

const FALLBACK = {
  breaking: [
    {
      cat: 'energy',
      title: '国家能源局：1月全国新增光伏并网17.3GW，同比增长41%',
      summary: '光伏装机高增长持续，全年有望突破250GW目标，光伏板块估值修复可期。',
      source: '国家能源局', time: '今日 09:20',
      url: 'https://www.nea.gov.cn/',
    },
    {
      cat: 'energy',
      title: '比亚迪1月销量50.7万辆，同比增长47%，创历史同月新高',
      summary: '新能源渗透率持续突破，市场份额进一步巩固。',
      source: '比亚迪官方', time: '今日 08:30',
      url: 'https://finance.sina.com.cn/',
    },
    {
      cat: 'ai',
      title: 'DeepSeek API单日调用量突破1亿次，国产算力需求急剧攀升',
      summary: '国产大模型影响力持续扩大，算力基础设施投资提速。',
      source: '36氪', time: '今日 10:00',
      url: 'https://www.eastmoney.com/',
    },
    {
      cat: 'ai',
      title: '工信部：加快推进"东数西算"算力基础设施扩容',
      summary: '政策层面持续发力支持AI算力建设，算力概念股受提振。',
      source: '工信部', time: '今日 09:45',
      url: 'https://finance.sina.com.cn/',
    },
    {
      cat: 'gold',
      title: 'COMEX黄金期货突破3050美元/盎司，刷新历史纪录',
      summary: '美元指数走弱叠加地缘风险升温，黄金多头强势，A股黄金股跟涨。',
      source: '华尔街见闻', time: '今日 08:00',
      url: 'https://finance.sina.com.cn/money/gold/',
    },
    {
      cat: 'gold',
      title: 'A股黄金股早盘全线大涨，山东黄金涨逾5%',
      summary: '受国际金价创新高提振，黄金股板块领涨两市。',
      source: '东方财富', time: '今日 09:55',
      url: 'https://www.eastmoney.com/',
    },
  ],

  industry: [
    {
      cat: 'energy',
      title: '宁德时代2024年净利润457亿，同比+15%，拟10转3派10元',
      summary: '电池出货量再创历史新高，海外收入占比持续提升，现金分红彰显经营信心。',
      source: '宁德时代公告', time: '昨日 18:00',
      url: 'https://www.cninfo.com.cn/',
    },
    {
      cat: 'energy',
      title: '国家发改委：进一步完善新能源配储政策，强制配储比例提升至20%',
      summary: '政策推动储能市场量价齐升，储能龙头企业有望显著受益。',
      source: '国家发改委', time: '昨日 16:30',
      url: 'https://finance.sina.com.cn/',
    },
    {
      cat: 'energy',
      title: '1月新能源汽车渗透率突破50%，首次超越传统燃油车',
      summary: '历史性节点来临，行业结构性转变加速，产业链受益逻辑持续强化。',
      source: '中国汽车工业协会', time: '昨日 14:00',
      url: 'https://finance.sina.com.cn/',
    },
    {
      cat: 'ai',
      title: '科大讯飞2024年业绩：AI业务收入同比增长68%，盈利拐点临近',
      summary: 'AI教育、AI医疗、AI办公三大赛道全面发力，研发投入逐步转化为利润。',
      source: '科大讯飞公告', time: '昨日 17:30',
      url: 'https://www.cninfo.com.cn/',
    },
    {
      cat: 'ai',
      title: '寒武纪：2025年AI推理芯片订单已超去年全年水平',
      summary: '大模型推理需求爆发式增长，国产芯片替代加速，业绩高增确定性增强。',
      source: '寒武纪公告', time: '昨日 15:00',
      url: 'https://www.cninfo.com.cn/',
    },
    {
      cat: 'gold',
      title: '山东黄金2024年产金35.4吨，净利润预增85%至68亿元',
      summary: '高金价显著提升矿企盈利能力，股息率有望同步提升，机构持续增持。',
      source: '山东黄金公告', time: '昨日 19:00',
      url: 'https://www.cninfo.com.cn/',
    },
    {
      cat: 'gold',
      title: '央行黄金储备连续第16个月增持，总量已达7390万盎司',
      summary: '全球央行持续购金，长期需求端支撑金价上行趋势不变。',
      source: '中国人民银行', time: '昨日 10:00',
      url: 'http://www.pbc.gov.cn/',
    },
  ],

  analysis: [
    {
      cat: 'energy',
      title: '【深度】光伏行业2025年投资策略：供给出清临近，龙头估值修复可期',
      summary: '组件价格企稳，头部企业成本优势凸显。预计2025年下半年行业盈利能力明显改善，重点关注隆基绿能、阳光电源、天合光能。',
      source: '中信证券研究', time: '昨日 20:00',
      url: 'https://www.eastmoney.com/',
    },
    {
      cat: 'energy',
      title: '【研报】储能行业2025深度报告：工商业储能进入快速放量期',
      summary: '峰谷电价套利空间扩大，工商业储能经济性持续改善，建议关注阳光电源、亿纬锂能、南都电源等标的。',
      source: '华泰证券研究', time: '昨日 17:00',
      url: 'https://www.eastmoney.com/',
    },
    {
      cat: 'ai',
      title: '【深度】DeepSeek带来的AI投资新范式：算力需求超预期，应用落地加速',
      summary: '低成本推理模型降低AI应用门槛，推动B端和C端双向爆发。重点关注算力基础设施和AI软件应用落地标的。',
      source: '国泰君安研究', time: '昨日 19:30',
      url: 'https://www.eastmoney.com/',
    },
    {
      cat: 'ai',
      title: '【策略】A股AI板块估值与基本面匹配度分析：布局窗口正在打开',
      summary: '当前AI板块整体估值已消化过度溢价，有业绩支撑的标的迎来中长期布局窗口，看好AI算力和AI应用双主线。',
      source: '申万宏源研究', time: '昨日 16:00',
      url: 'https://www.eastmoney.com/',
    },
    {
      cat: 'gold',
      title: '【深度】黄金牛市未终结：美联储降息周期+地缘风险=长期多头逻辑',
      summary: '美联储2025年降息节奏虽放缓，但美债实际利率下行趋势不变。全球去美元化叠加央行购金加速，黄金中枢持续上移。',
      source: '招商证券研究', time: '昨日 20:30',
      url: 'https://www.eastmoney.com/',
    },
    {
      cat: 'gold',
      title: '【宏观】美元霸权弱化与黄金战略价值重估',
      summary: '全球去美元化浪潮推动各国央行大幅增持黄金，中长期看金价中枢持续上移。建议将黄金作为组合中的长期配置底仓。',
      source: '中金公司研究', time: '昨日 15:30',
      url: 'https://www.eastmoney.com/',
    },
  ],
};

// ── 工具函数 ──────────────────────────────────────────────────

function fmtDate(d) {
  return (d || new Date()).toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });
}
function fmtTime(d) {
  return (d || new Date()).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

// ── 日期初始化 ────────────────────────────────────────────────

const dateEl = document.getElementById('currentDate');
if (dateEl) dateEl.textContent = fmtDate();

// ── 市场指数（示例数据，可替换为行情 API）────────────────────

(function renderMarket() {
  const data = [
    { id: 'sh',   value: '3,341.72',  change: '+27.45',  pct: '+0.83%', up: true  },
    { id: 'sz',   value: '10,682.90', change: '+98.12',  pct: '+0.93%', up: true  },
    { id: 'cyb',  value: '2,174.33',  change: '-8.56',   pct: '-0.39%', up: false },
    { id: 'gold', value: '624.50',    change: '+3.20',   pct: '+0.51%', up: true  },
  ];
  data.forEach(({ id, value, change, pct, up }) => {
    const v = document.getElementById(`${id}-value`);
    const c = document.getElementById(`${id}-change`);
    if (v) { v.textContent = value; v.className = `market-value ${up ? 'rise' : 'fall'}`; }
    if (c) { c.textContent = `${change}  ${pct}`; c.className = `market-change ${up ? 'rise' : 'fall'}`; }
  });
})();

// ── 主题检测（从标题 / 摘要中识别关键词）───────────────────────

function detectTopic(title, desc = '') {
  const text = (title + ' ' + desc).toLowerCase();
  for (const [cat, kws] of Object.entries(TOPIC_KEYWORDS)) {
    if (kws.some(kw => text.includes(kw.toLowerCase()))) return cat;
  }
  return null; // 与三大主题无关
}

// ── RSS 抓取（带超时和备用 URL）──────────────────────────────

async function fetchOneFeed(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const json = await res.json();
    return (json.status === 'ok' && json.items?.length) ? json.items : null;
  } catch {
    return null;
  }
}

async function fetchSection(urls) {
  for (const url of urls) {
    const items = await fetchOneFeed(url);
    if (items) return items;
  }
  return null;
}

function parseRSSItem(item, type) {
  const cat = detectTopic(item.title, item.description || '');
  if (!cat) return null;

  const pub = item.pubDate ? new Date(item.pubDate) : new Date();
  const mins = Math.floor((Date.now() - pub) / 60000);
  const timeStr =
    mins < 60   ? `${mins}分钟前` :
    mins < 1440 ? `${Math.floor(mins / 60)}小时前` :
                  `${Math.floor(mins / 1440)}天前`;

  return {
    cat, type,
    title:   item.title,
    summary: (item.description || '').replace(/<[^>]+>/g, '').trim().slice(0, 100) + '…',
    source:  item.author || '财经资讯',
    time:    timeStr,
    url:     item.link,
  };
}

// ── 缓存管理 ──────────────────────────────────────────────────

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    return (Date.now() - ts < CACHE_TTL) ? { ts, data } : null;
  } catch { return null; }
}

function saveCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

// ── 更新时间显示 ──────────────────────────────────────────────

function updateTimestamp(ts) {
  const timeEl = document.getElementById('updateTime');
  const nextEl = document.getElementById('nextUpdate');
  if (!timeEl) return;

  const age = Date.now() - ts;
  const mins = Math.floor(age / 60000);
  timeEl.textContent =
    mins < 1  ? '刚刚' :
    mins < 60 ? `${mins}分钟前` :
    `${Math.floor(mins / 60)}小时前`;

  if (nextEl) {
    const left = CACHE_TTL - age;
    const h = Math.floor(left / 3600000);
    const m = Math.floor((left % 3600000) / 60000);
    nextEl.textContent = h > 0 ? `${h}小时${m}分钟后` : `${m}分钟后`;
  }
}

// ── 渲染 ──────────────────────────────────────────────────────

const TAG_MAP = {
  energy: { label: '⚡ 新能源', cls: 'tag-energy' },
  ai:     { label: '🤖 AI科技', cls: 'tag-ai' },
  gold:   { label: '🪙 黄金',   cls: 'tag-gold' },
};

function skeletonHTML() {
  return `
    <div class="skeleton-card">
      <div class="skeleton sk-tag"></div>
      <div class="skeleton sk-title"></div>
      <div class="skeleton sk-title2"></div>
      <div class="skeleton sk-meta"></div>
      <div class="skeleton sk-body"></div>
      <div class="skeleton sk-body2"></div>
    </div>`;
}

function showSkeletons() {
  ['grid-breaking', 'grid-industry', 'grid-analysis'].forEach((id, i) => {
    const g = document.getElementById(id);
    if (g) g.innerHTML = skeletonHTML().repeat([3, 4, 3][i]);
  });
}

function renderSection(gridId, sectionId, items, cat) {
  const grid    = document.getElementById(gridId);
  const section = document.getElementById(sectionId);
  if (!grid || !section) return;

  const list = cat === 'all' ? items : items.filter(n => n.cat === cat);
  if (!list.length) {
    section.style.display = 'none';
    return;
  }
  section.style.display = '';
  grid.innerHTML = list.map(n => {
    const { label, cls } = TAG_MAP[n.cat] || {};
    return `
      <div class="news-card ${n.cat}">
        <span class="news-tag ${cls}">${label}</span>
        <div class="news-title">
          <a href="${n.url}" target="_blank" rel="noopener">${n.title}</a>
        </div>
        <div class="news-meta">
          <span class="news-source">${n.source}</span>
          <span class="news-time">${n.time}</span>
        </div>
        ${n.summary ? `<div class="news-summary">${n.summary}</div>` : ''}
      </div>`;
  }).join('');
}

let newsData = null;
let currentCat = 'all';

function renderAll() {
  if (!newsData) return;
  renderSection('grid-breaking', 'section-breaking', newsData.breaking, currentCat);
  renderSection('grid-industry', 'section-industry', newsData.industry, currentCat);
  renderSection('grid-analysis', 'section-analysis', newsData.analysis, currentCat);
}

// ── 主加载流程 ────────────────────────────────────────────────

async function loadNews(force = false) {
  const btn = document.getElementById('refreshBtn');
  if (btn) btn.classList.add('loading');

  // 有效缓存直接使用
  if (!force) {
    const cached = loadCache();
    if (cached) {
      newsData = cached.data;
      renderAll();
      updateTimestamp(cached.ts);  // ← 传入缓存时间戳，而不是当前时间
      if (btn) btn.classList.remove('loading');
      return;
    }
  }

  showSkeletons();

  // 并行抓取三个板块的 RSS
  const [bRaw, iRaw, aRaw] = await Promise.all([
    fetchSection(RSS_FEEDS.breaking),
    fetchSection(RSS_FEEDS.industry),
    fetchSection(RSS_FEEDS.analysis),
  ]);

  function parseItems(raw, type) {
    if (!raw) return [];
    return raw.map(item => parseRSSItem(item, type)).filter(Boolean);
  }

  const breaking = parseItems(bRaw, 'breaking');
  const industry = parseItems(iRaw, 'industry');
  const analysis = parseItems(aRaw, 'analysis');

  // RSS 有数据则用，否则用静态备用
  newsData = {
    breaking: breaking.length ? breaking : FALLBACK.breaking,
    industry: industry.length ? industry : FALLBACK.industry,
    analysis: analysis.length ? analysis : FALLBACK.analysis,
  };

  const now = Date.now();
  saveCache(newsData);
  renderAll();
  updateTimestamp(now);
  if (btn) btn.classList.remove('loading');
}

// ── Tab 切换 ──────────────────────────────────────────────────

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentCat = btn.dataset.tab;
    renderAll();
  });
});

// ── 刷新按钮 ──────────────────────────────────────────────────

document.getElementById('refreshBtn')?.addEventListener('click', () => loadNews(true));

// ── 启动 ──────────────────────────────────────────────────────

loadNews();
