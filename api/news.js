export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const clientId     = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Naver API credentials not configured' });
  }

  const HEADERS = {
    'X-Naver-Client-Id': clientId,
    'X-Naver-Client-Secret': clientSecret,
  };

  const CAT_MAP = {
    // 시세/분양
    '미계약': 'price', '분양가': 'price', '청약': 'price', '시세': 'price',
    '전세': 'price', '매매': 'price', '실거래': 'price', '무순위': 'price',
    '줍줍': 'price', '계약': 'price',
    // 정책/규제
    '분양가상한제': 'policy', '규제': 'policy', '정책': 'policy', '대출': 'policy',
    '취득세': 'policy', '세금': 'policy', '금리': 'policy', '주택법': 'policy',
    '재건축': 'policy', '재개발': 'policy', '임대차': 'policy', '전매': 'policy',
    '보유세': 'policy', '양도세': 'policy', '기준금리': 'policy', '공급': 'policy',
    // 교통/개발
    '교통': 'infra', '개발': 'infra', '마곡': 'infra', '공항': 'infra',
    '지하철': 'infra', '노선': 'infra', '강서구': 'infra', '방화': 'infra',
    'GTX': 'infra', '도시철도': 'infra', '버스': 'infra', '광역철도': 'infra',
    '복합단지': 'infra', '뉴타운': 'infra', '재정비': 'infra',
    // 입주민
    '입주민': 'community', '관리비': 'community', '커뮤니티': 'community',
  };

  function guessCategory(text, forceCat) {
    if (forceCat) return forceCat;
    for (const [kw, cat] of Object.entries(CAT_MAP)) {
      if (text.includes(kw)) return cat;
    }
    return 'price';
  }

  function stripTags(raw = '') {
    return raw
      .replace(/<b>/g, '').replace(/<\/b>/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
      .replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseNewsDate(raw = '') {
    try {
      const d = new Date(raw);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    } catch { return raw; }
  }

  function parseBlogDate(raw = '') {
    if (raw.length === 8) {
      return `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`;
    }
    return raw;
  }

  async function fetchNews(query, display = 10) {
    const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(query)}&display=${display}&sort=date`;
    const r = await fetch(url, { headers: HEADERS });
    if (!r.ok) throw new Error(`Naver news ${r.status}`);
    const json = await r.json();
    return json.items || [];
  }

  async function fetchBlog(query, display = 8) {
    const url = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(query)}&display=${display}&sort=date`;
    const r = await fetch(url, { headers: HEADERS });
    if (!r.ok) throw new Error(`Naver blog ${r.status}`);
    const json = await r.json();
    return json.items || [];
  }

  // 쿼리 목록: [query, forcedCategory | null, display]
  const NEWS_QUERIES = [
    ['래미안 엘라비네',              null,     10],
    ['방화뉴타운 분양',              'price',   8],
    ['분양가상한제 부동산 정책',      'policy',  8],
    ['부동산 대출규제 청약제도',      'policy',  6],
    ['강서구 교통 개발',             'infra',   8],
    ['마곡 방화 도시개발',           'infra',   6],
  ];

  const BLOG_QUERIES = [
    ['래미안 엘라비네',  null,   8],
  ];

  try {
    const [newsResults, blogResults] = await Promise.all([
      Promise.allSettled(NEWS_QUERIES.map(([q, cat, d]) => fetchNews(q, d).then(items => ({ items, cat })))),
      Promise.allSettled(BLOG_QUERIES.map(([q, cat, d]) => fetchBlog(q, d ?? 8).then(items => ({ items, cat })))),
    ]);

    const seenLinks = new Set();

    function dedup(item) {
      const key = item.originallink || item.link;
      if (!key || seenLinks.has(key)) return false;
      seenLinks.add(key);
      return true;
    }

    // 뉴스 변환
    const newsItems = newsResults.flatMap(r => {
      if (r.status !== 'fulfilled') return [];
      const { items, cat } = r.value;
      return items.filter(dedup).map(it => {
        const text = stripTags(it.title) + ' ' + stripTags(it.description);
        return {
          title:    stripTags(it.title),
          source:   '언론사',
          date:     parseNewsDate(it.pubDate),
          summary:  stripTags(it.description) || stripTags(it.title),
          category: guessCategory(text, cat),
          url:      it.originallink || it.link,
          srcType:  'news',
        };
      });
    });

    // 블로그 변환
    const blogItems = blogResults.flatMap(r => {
      if (r.status !== 'fulfilled') return [];
      const { items, cat } = r.value;
      return items.filter(dedup).map(it => {
        const text = stripTags(it.title) + ' ' + stripTags(it.description);
        return {
          title:    stripTags(it.title),
          source:   stripTags(it.bloggername) || '블로거',
          date:     parseBlogDate(it.postdate),
          summary:  stripTags(it.description) || stripTags(it.title),
          category: guessCategory(text, cat),
          url:      it.link,
          srcType:  'blog',
        };
      });
    });

    const combined = [...newsItems, ...blogItems].sort((a, b) => {
      if (a.date > b.date) return -1;
      if (a.date < b.date) return 1;
      return 0;
    });

    if (combined.length === 0) throw new Error('empty');

    res.status(200).json(combined);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
