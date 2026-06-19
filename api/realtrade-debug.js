export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const serviceKey = process.env.MOLIT_API_KEY;

  // 마곡동 법정동코드: 1150010900
  const url = `https://api.odcloud.kr/api/AptIdInfoSvc/v1/getAptInfo?serviceKey=${encodeURIComponent(serviceKey)}&bjdCode=1150010900&page=1&perPage=30`;

  try {
    const r = await fetch(url);
    const json = await r.json();
    res.status(200).json({ status: r.status, url, data: json });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
