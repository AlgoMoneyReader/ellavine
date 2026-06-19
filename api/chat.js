export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const { systemPrompt, contents, userContext } = req.body || {};
  if (!contents || !Array.isArray(contents)) {
    return res.status(400).json({ error: 'Invalid contents' });
  }

  const fullPrompt = userContext
    ? `${systemPrompt}\n\n【현재 대화 사용자 정보】\n${userContext}`
    : systemPrompt;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: fullPrompt }] },
          contents,
          generationConfig: { maxOutputTokens: 2000, temperature: 0.7 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errBody = await geminiRes.json().catch(() => ({}));
      const status = geminiRes.status;
      const errCode = status === 429 ? 'QUOTA_EXCEEDED' : `GEMINI_${status}`;
      console.error('Gemini error:', status, JSON.stringify(errBody));
      return res.status(status).json({ error: errCode });
    }

    const data = await geminiRes.json();
    const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    return res.status(200).json({ text });
  } catch (err) {
    console.error('Chat fetch error:', err);
    return res.status(500).json({ error: `FETCH_ERROR: ${err.message}` });
  }
}
