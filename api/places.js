export const config = { runtime: 'edge' };

const PROMPT = `서울 강서구 방화동 래미안 엘라비네 아파트(신방화역 도보 5분, 방화뉴타운) 기준 반경 2km 이내 추천 장소 20곳을 Google Search로 검색해서 아래 JSON 형식으로만 반환해주세요. 반드시 순수 JSON 배열만 반환하고 다른 텍스트는 일절 포함하지 마세요.

[절대 조건 — 위반 시 무효]
1. 구글 리뷰 100개 이상 & 구글 평점 4.0점 이상인 장소만
2. "방화동 순대타운", "마곡나루 카페거리", "방화동 곱창골목" 처럼 특정 업소명이 없는 지역/골목/타운/거리 이름은 절대 금지 → 반드시 구글맵에서 실제로 검색되는 정확한 상호명(지점명 포함)만
3. 이미 없어진 점포나 존재하지 않는 지점명 금지 (예: CGV 마곡점 없음, 이케아 강서점 없음)
4. 맛집(restaurant) 8곳·카페(cafe) 4곳·마트/편의(mart) 4곳·여가(leisure) 4곳

[
  {
    "name": "스타벅스 방화역점",
    "cat": "restaurant",
    "dist": "도보 X분 또는 차량 X분",
    "rating": "4.2",
    "reviews": "230",
    "desc": "한 줄 특징 (20자 이내)",
    "emoji": "☕",
    "naverUrl": "https://map.naver.com/v5/search/스타벅스%20방화역점"
  }
]`;

export default async function handler(req) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500, headers });
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tools: [{ google_search: {} }],
          contents: [{ parts: [{ text: PROMPT }] }],
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Gemini ${res.status}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    const match = text.replace(/```json|```/g, '').trim().match(/\[[\s\S]*\]/);

    if (!match) throw new Error('No JSON array in response');

    const places = JSON.parse(match[0]);
    if (!Array.isArray(places) || places.length < 3) throw new Error('Too few results');

    return new Response(JSON.stringify(places), { headers });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e?.message || 'Unknown error') }),
      { status: 500, headers }
    );
  }
}
