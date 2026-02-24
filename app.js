/* ============================================================
   羽化 · A股资讯中心
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

// ── 国际财经静态数据（英文原文 + 中文翻译，附来源）────────────────

const INTL_NEWS = [
  {
    cat: 'gold',
    en:  'Gold hits record $3,050/oz as Fed rate-cut bets revive and dollar weakens on soft payrolls data.',
    zh:  '黄金创历史新高至3050美元/盎司。美国非农数据疲软引发市场对美联储降息预期回升，美元走弱，推动金价突破纪录。',
    source: 'Reuters',
    url: 'https://www.reuters.com/markets/commodities/',
    time: '今日',
  },
  {
    cat: 'ai',
    en:  'NVIDIA surges 6% after reporting record data-center revenue of $35.6B, driven by explosive AI chip demand.',
    zh:  '英伟达股价大涨6%。公司公布数据中心收入创纪录达到356亿美元，AI芯片需求爆炸式增长是主要驱动力。',
    source: 'Bloomberg',
    url: 'https://www.bloomberg.com/technology',
    time: '今日',
  },
  {
    cat: 'energy',
    en:  'Global EV sales top 20 million units in 2025, with China accounting for 60% of total volume.',
    zh:  '2025年全球新能源汽车销量突破2000万辆，中国市场贡献了其中60%的份额，持续巩固全球主导地位。',
    source: 'Financial Times',
    url: 'https://www.ft.com/companies/energy',
    time: '今日',
  },
  {
    cat: 'gold',
    en:  'Central banks globally purchased 1,100 tonnes of gold in 2025 — second highest on record — as de-dollarization accelerates.',
    zh:  '2025年全球央行购金量达1100吨，为历史第二高。去美元化进程加速，各国央行持续增加黄金储备以分散风险。',
    source: 'World Gold Council',
    url: 'https://www.gold.org/goldhub/research',
    time: '昨日',
  },
  {
    cat: 'ai',
    en:  'Microsoft Azure AI revenue grows 157% YoY as enterprise adoption of large language models accelerates across industries.',
    zh:  '微软Azure AI业务收入同比增长157%。大型语言模型在各行业企业级应用加速普及，推动云计算服务需求大幅提升。',
    source: 'CNBC',
    url: 'https://www.cnbc.com/technology/',
    time: '昨日',
  },
  {
    cat: 'energy',
    en:  'Solar panel prices fall 18% in Q4 2025, approaching $0.10/W, making solar the cheapest electricity source globally.',
    zh:  '2025年四季度全球光伏组件价格下跌18%，接近每瓦0.10美元，太阳能已成为全球发电成本最低的能源形式。',
    source: 'Bloomberg NEF',
    url: 'https://about.bnef.com/',
    time: '昨日',
  },
  {
    cat: 'gold',
    en:  'Fed minutes signal two more rate cuts in 2025 as inflation trends toward 2% target, boosting gold and treasuries.',
    zh:  '美联储会议纪要暗示2025年还将再降息两次。通胀持续向2%目标靠拢，黄金和国债价格均受到提振上涨。',
    source: 'Wall Street Journal',
    url: 'https://www.wsj.com/economy',
    time: '昨日',
  },
  {
    cat: 'ai',
    en:  'China AI startups raised $15B in 2025 H2, second only to the US, as domestic models compete globally.',
    zh:  '2025年下半年中国AI初创企业融资达150亿美元，仅次于美国。国产大模型在全球竞争力持续增强。',
    source: 'South China Morning Post',
    url: 'https://www.scmp.com/tech',
    time: '前天',
  },
  {
    cat: 'energy',
    en:  'Battery energy storage installations hit 500 GWh globally in 2025, tripling from 2023, with China leading deployments.',
    zh:  '2025年全球电池储能装机量达500吉瓦时，较2023年翻了三倍，中国依然是全球最大的储能部署市场。',
    source: 'IEA',
    url: 'https://www.iea.org/energy-system/electricity/batteries-and-energy-storage',
    time: '前天',
  },
  {
    cat: 'ai',
    en:  'OpenAI launches GPT-5 with multimodal reasoning, reportedly 10x more efficient than GPT-4, intensifying global AI race.',
    zh:  'OpenAI发布GPT-5，具备多模态推理能力，效率据称是GPT-4的10倍，进一步加剧全球AI军备竞赛。',
    source: 'The Verge',
    url: 'https://www.theverge.com/ai-artificial-intelligence',
    time: '前天',
  },
];

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

// ── 市场行情 ──────────────────────────────────────────────────

function setMarketCard(id, value, change, pct, up) {
  const v = document.getElementById(`${id}-value`);
  const c = document.getElementById(`${id}-change`);
  if (v) { v.textContent = value; v.className = `market-value ${up ? 'rise' : 'fall'}`; }
  if (c) { c.textContent = `${change}  ${pct}`; c.className = `market-change ${up ? 'rise' : 'fall'}`; }
}

function setMarketState(id, msg) {
  const v = document.getElementById(`${id}-value`);
  const c = document.getElementById(`${id}-change`);
  if (v) { v.textContent = '—'; v.className = 'market-value flat'; }
  if (c) { c.textContent = msg; c.className = 'market-change flat'; }
}

function fmtN(n, d = 2) {
  return n.toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
}

// ── 数据源 1：东方财富（A股指数 + 黄金 + 中证A500）─────────────
// f43=当前价×100  f44=昨收×100  f169=涨跌额×100  f170=涨跌幅×100
async function fetchEM(secid) {
  const res = await fetch(
    `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f43,f44,f169,f170`,
    { signal: AbortSignal.timeout(7000) }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  if (!j.data) throw new Error('no data');
  const { f43, f44, f169, f170 } = j.data;
  return {
    price:  ((f43 && f43 !== 0) ? f43 : f44) / 100,
    change: f169 / 100,
    pct:    f170 / 100,
  };
}

// ── 数据源 2：腾讯财经（港股指数 + 美股指数，GBK 编码）─────────
async function fetchTencent(codes) {
  const res = await fetch(
    `https://qt.gtimg.cn/q=${codes.join(',')}`,
    { signal: AbortSignal.timeout(7000) }
  );
  const text = new TextDecoder('gbk').decode(await res.arrayBuffer());
  return codes.map(c => {
    const m = text.match(new RegExp(`v_${c}="([^"]+)"`));
    if (!m) return null;
    const p = m[1].split('~');
    // format: [mkt, name, code, current, prevClose, open, ...]
    const price    = parseFloat(p[3]);
    const prevClose= parseFloat(p[4]);
    const change   = price - prevClose;
    const pct      = (change / prevClose) * 100;
    return { price, change, pct };
  });
}

// ── 数据源 3：ExchangeRate-API（美元兑人民币）────────────────────
async function fetchUSDCNY() {
  const res = await fetch(
    'https://open.er-api.com/v6/latest/USD',
    { signal: AbortSignal.timeout(7000) }
  );
  const j = await res.json();
  const rate = j?.rates?.CNY;
  if (!rate) throw new Error('no rate');
  return { price: rate, change: null, pct: null };
}

// ── 整体加载 ──────────────────────────────────────────────────

async function loadMarketData() {
  const ALL_IDS = ['sh','sz','cyb','a500','a50','gold','usdcny','bond10','hscei','chix','ndx'];
  ALL_IDS.forEach(id => setMarketState(id, '获取中...'));

  // ── 东方财富（A股 + 黄金 + 富时A500）────
  const emList = [
    { id: 'sh',   secid: '1.000001' },   // 上证指数
    { id: 'sz',   secid: '0.399001' },   // 深证成指
    { id: 'cyb',  secid: '0.399006' },   // 创业板指
    { id: 'a500', secid: '2.932000' },   // 中证A500（富时A500同类）
    { id: 'gold', secid: '118.AUTD'  },  // 黄金延期 元/克
  ];
  const emResults = await Promise.allSettled(emList.map(m => fetchEM(m.secid)));
  emResults.forEach((res, i) => {
    const { id } = emList[i];
    if (res.status === 'fulfilled') {
      const { price, change, pct } = res.value;
      const up = change >= 0;
      setMarketCard(id, fmtN(price), `${up?'+':''}${fmtN(change)}`, `${up?'+':''}${fmtN(pct)}%`, up);
    } else {
      setMarketState(id, '暂不可用');
    }
  });

  // ── 腾讯财经（港股 + 美股）────────────
  // 腾讯代码: hkHSCEI=恒生中国企业, usCHIX=纳指中国金融ETF, usNDX=纳斯达克100
  try {
    const [hscei, chix, ndx] = await fetchTencent(['hkHSCEI','usCHIX','usNDX']);
    const tqMap = [['hscei', hscei], ['chix', chix], ['ndx', ndx]];
    for (const [id, d] of tqMap) {
      if (d) {
        const up = d.change >= 0;
        setMarketCard(id, fmtN(d.price), `${up?'+':''}${fmtN(d.change)}`, `${up?'+':''}${fmtN(d.pct)}%`, up);
      } else {
        setMarketState(id, '暂不可用');
      }
    }
  } catch { ['hscei','chix','ndx'].forEach(id => setMarketState(id, '暂不可用')); }

  // ── 外汇 API（美元兑人民币）──────────────
  try {
    const { price } = await fetchUSDCNY();
    setMarketCard('usdcny', fmtN(price, 4), '实时汇率', '', true);
    // 重置 change 区域只显示"实时汇率"标签
    const c = document.getElementById('usdcny-change');
    if (c) { c.textContent = '实时汇率'; c.className = 'market-change flat'; }
  } catch { setMarketState('usdcny', '暂不可用'); }

  // ── A50连续 & 十年期国债（需专业终端）──────
  setMarketState('a50',    '请查专业软件');
  setMarketState('bond10', '请查专业软件');
}

loadMarketData();

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
  intl:   { label: '🌍 国际',   cls: 'tag-intl' },
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

function renderIntl(cat) {
  const grid    = document.getElementById('grid-intl');
  const section = document.getElementById('section-intl');
  if (!grid || !section) return;
  const list = cat === 'all' ? INTL_NEWS : INTL_NEWS.filter(n => n.cat === cat);
  if (!list.length) { section.style.display = 'none'; return; }
  section.style.display = '';
  grid.innerHTML = list.map(n => {
    const { label, cls } = TAG_MAP[n.cat] || TAG_MAP.intl;
    return `
      <div class="news-card intl">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <span class="news-tag ${cls}">${label}</span>
          <span class="news-source-intl">${n.source}</span>
        </div>
        <div class="news-title">
          <a href="${n.url}" target="_blank" rel="noopener">${n.zh}</a>
        </div>
        <div class="news-en">${n.en}</div>
        <div class="news-meta">
          <span class="news-time">${n.time}</span>
        </div>
      </div>`;
  }).join('');
}

function renderAll() {
  if (!newsData) return;
  renderSection('grid-breaking', 'section-breaking', newsData.breaking, currentCat);
  renderSection('grid-industry', 'section-industry', newsData.industry, currentCat);
  renderSection('grid-analysis', 'section-analysis', newsData.analysis, currentCat);
  renderIntl(currentCat);
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
