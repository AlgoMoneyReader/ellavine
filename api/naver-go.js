export default async function handler(req, res) {
  const { name } = req.query;
  if (!name) return res.redirect(302, 'https://fin.land.naver.com/');

  const fallback = `https://fin.land.naver.com/map?query=${encodeURIComponent(name)}`;

  try {
    const r = await fetch(
      `https://fin.land.naver.com/?keyword=${encodeURIComponent(name)}`,
      {
        redirect: 'manual',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9',
          Referer: 'https://fin.land.naver.com/',
        },
      }
    );

    const location = r.headers.get('location');
    if (location) {
      const fullUrl = location.startsWith('http')
        ? location
        : `https://fin.land.naver.com${location}`;
      return res.redirect(302, fullUrl);
    }

    return res.redirect(302, fallback);
  } catch {
    return res.redirect(302, fallback);
  }
}
