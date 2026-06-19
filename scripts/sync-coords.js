#!/usr/bin/env node
/**
 * 🗺️  단지명 → Kakao 좌표 변환 후 Supabase apt_coordinates 저장
 *
 * 실행: node scripts/sync-coords.js
 *
 * 환경변수:
 *   KAKAO_REST_API_KEY=...
 *   SUPABASE_URL=...
 *   SUPABASE_SERVICE_KEY=...
 *   LAWD_CD=11500  (기본값: 강서구)
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = join(__dir, '..');

// .env 파싱
function loadEnv() {
  for (const file of ['.env', '.env.local']) {
    try {
      const lines = readFileSync(join(root, file), 'utf8').split('\n');
      for (const line of lines) {
        const m = line.match(/^([A-Z0-9_]+)=["']?(.+?)["']?\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
      }
    } catch {}
  }
}
loadEnv();

const KAKAO_KEY    = process.env.KAKAO_REST_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const MOLIT_KEY    = process.env.MOLIT_API_KEY;
const LAWD_CD      = process.env.LAWD_CD || '11500';

if (!KAKAO_KEY)    { console.error('❌ KAKAO_REST_API_KEY 없음'); process.exit(1); }
if (!SUPABASE_URL) { console.error('❌ SUPABASE_URL 없음'); process.exit(1); }
if (!SUPABASE_KEY) { console.error('❌ SUPABASE_SERVICE_KEY 없음'); process.exit(1); }

// ── Kakao Local 키워드 검색 ──────────────────────────────
async function kakaoSearchApt(query) {
  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=5`;
  const r = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_KEY}` }
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Kakao API ${r.status}: ${body}`);
  }
  const json = await r.json();
  return json.documents || [];
}

// ── Supabase 단지 목록 조회 (페이지네이션) ────────────────
async function getDistinctApts() {
  const PAGE = 1000;
  const seen = new Set();
  const apts = [];
  let offset = 0;

  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/trade_snapshots?select=apt_name,dong,lawd_cd&lawd_cd=eq.${LAWD_CD}&order=apt_name&limit=${PAGE}&offset=${offset}`;
    const r = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    if (!r.ok) throw new Error(`Supabase ${r.status}`);
    const rows = await r.json();
    for (const row of rows) {
      const key = `${row.apt_name}__${row.dong}`;
      if (!seen.has(key)) {
        seen.add(key);
        apts.push({ apt_name: row.apt_name, dong: row.dong, lawd_cd: row.lawd_cd });
      }
    }
    if (rows.length < PAGE) break; // 마지막 페이지
    offset += PAGE;
  }
  return apts;
}

// ── 이미 저장된 단지 조회 ────────────────────────────────
async function getExistingCoords() {
  const url = `${SUPABASE_URL}/rest/v1/apt_coordinates?select=apt_name&lawd_cd=eq.${LAWD_CD}`;
  const r = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  if (!r.ok) return new Set();
  const rows = await r.json();
  return new Set(rows.map(r => r.apt_name));
}

// ── Supabase upsert ──────────────────────────────────────
async function upsertCoords(rows) {
  const url = `${SUPABASE_URL}/rest/v1/apt_coordinates`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Supabase upsert ${r.status}: ${err}`);
  }
}

// ── MOLIT API에서 직접 단지 목록 조회 (trade_snapshots 없는 구 대응) ──
async function getDistinctAptsFromMolit() {
  if (!MOLIT_KEY) return [];
  const apts = new Map(); // key: apt_name__dong

  // 최근 6개월
  const now = new Date();
  const months = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}`);
  }

  for (const month of months) {
    try {
      const url = `https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev?serviceKey=${encodeURIComponent(MOLIT_KEY)}&LAWD_CD=${LAWD_CD}&DEAL_YMD=${month}&numOfRows=1000&pageNo=1`;
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/xml' } });
      if (!r.ok) continue;
      const xml = await r.text();
      const blocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
      for (const b of blocks) {
        const block = b[1];
        const getTag = (tag) => (block.match(new RegExp(`<${tag}>([^<]*)</${tag}>`)) || [])[1]?.trim() || '';
        const apt_name = getTag('aptNm');
        const dong = getTag('umdNm');
        if (!apt_name) continue;
        const key = `${apt_name}__${dong}`;
        if (!apts.has(key)) apts.set(key, { apt_name, dong, lawd_cd: LAWD_CD });
      }
      await new Promise(r => setTimeout(r, 150));
    } catch {}
  }
  return [...apts.values()];
}

// ── 메인 ──────────────────────────────────────────────────
async function main() {
  console.log(`🗺️  단지 좌표 동기화 시작 (lawd_cd=${LAWD_CD})`);

  let allApts = await getDistinctApts();

  // trade_snapshots에 데이터 없으면 MOLIT API에서 직접 조회
  if (allApts.length === 0 && MOLIT_KEY) {
    console.log(`  trade_snapshots 없음 → MOLIT API에서 단지 조회 중...`);
    allApts = await getDistinctAptsFromMolit();
    console.log(`  MOLIT에서 ${allApts.length}개 단지 조회`);
  }

  const existing  = await getExistingCoords();
  const todo      = allApts.filter(a => !existing.has(a.apt_name));

  console.log(`  전체 단지: ${allApts.length}개, 기존 저장: ${existing.size}개, 신규: ${todo.length}개`);
  if (todo.length === 0) { console.log('✅ 모두 저장됨'); return; }

  let ok = 0, fail = 0;
  const batch = [];

  for (const apt of todo) {
    const query = apt.dong ? `${apt.dong} ${apt.apt_name}` : apt.apt_name;
    try {
      const results = await kakaoSearchApt(query);
      if (!results.length) {
        // fallback: 단지명만으로 재검색
        const r2 = await kakaoSearchApt(apt.apt_name);
        if (!r2.length) { fail++; continue; }
        results.push(...r2);
      }
      // 서울 좌표 범위 필터 (lat: 37.4~37.7, lng: 126.7~127.2)
      const seoulResults = results.filter(r => {
        const lat = parseFloat(r.y), lng = parseFloat(r.x);
        return lat >= 37.4 && lat <= 37.7 && lng >= 126.7 && lng <= 127.2;
      });
      if (!seoulResults.length) { fail++; console.error(`\n  ⚠️ ${apt.apt_name}: 서울 좌표 없음 (검색결과 ${results.length}건 모두 범위 외)`); continue; }
      const best = seoulResults[0];
      batch.push({
        lawd_cd:        apt.lawd_cd,
        apt_name:       apt.apt_name,
        dong:           apt.dong,
        lat:            parseFloat(best.y),
        lng:            parseFloat(best.x),
        kakao_place_id: best.id,
        kakao_name:     best.place_name,
      });
      ok++;
      process.stdout.write(`  [${ok}/${todo.length}] ${apt.apt_name} → ${best.y}, ${best.x}\r`);

      // 100개 배치마다 upsert + Kakao API 부하 방지
      if (batch.length >= 20) {
        await upsertCoords(batch.splice(0));
        await new Promise(r => setTimeout(r, 100));
      }
    } catch (e) {
      console.error(`\n  ⚠️ ${apt.apt_name}: ${e.message}`);
      fail++;
    }
  }

  // 잔여 배치
  if (batch.length > 0) await upsertCoords(batch);

  console.log(`\n✅ 완료: 성공 ${ok}개, 실패 ${fail}개`);
}

main().catch(e => { console.error('오류:', e.message); process.exit(1); });
