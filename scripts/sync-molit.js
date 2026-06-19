#!/usr/bin/env node
/**
 * 🏠 MOLIT → Supabase 수동 동기화 스크립트
 *
 * 실행: node scripts/sync-molit.js
 *
 * 필요 환경변수 (.env 파일 또는 env로 직접 전달):
 *   MOLIT_API_KEY=...
 *   SUPABASE_URL=https://xxx.supabase.co
 *   SUPABASE_SERVICE_KEY=...
 *
 * 왜 필요한가:
 *   MOLIT(apis.data.go.kr)이 Vercel 등 클라우드 IP를 차단함.
 *   Mac(한국 ISP)에서 실행하면 정상 호출 가능.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = join(__dir, '..');

// 회사 프록시 우회: MOLIT은 NO_PROXY로 직접 연결
process.env.NO_PROXY  = 'apis.data.go.kr';
process.env.no_proxy  = 'apis.data.go.kr';

// MOLIT WAF 우회용 공통 헤더
const MOLIT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'application/xml, text/xml, */*',
};

// .env 파싱 (dotenv 없이)
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

const MOLIT_KEY       = process.env.MOLIT_API_KEY;
const SUPABASE_URL    = process.env.SUPABASE_URL    || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY    = process.env.SUPABASE_SERVICE_KEY;
const MONTHS_BACK     = parseInt(process.env.MONTHS_BACK || '3');
// SYNC_TYPE=trade(기본)|rent|all
const SYNC_TYPE       = (process.env.SYNC_TYPE || 'trade').toLowerCase();

// 서울 25개 구 LAWD 코드
const SEOUL_ALL = [
  '11680','11740','11305','11500','11620','11215','11530','11545',
  '11350','11320','11230','11590','11440','11410','11650','11200',
  '11290','11710','11470','11560','11170','11380','11110','11140','11260',
];
// LAWD_CD=ALL → 25개 구 전체, LAWD_CD=11500,11440 → 지정 구만, 기본=강서구
const rawLawd = process.env.LAWD_CD || '11500';
const LAWD_CODES = rawLawd.toUpperCase() === 'ALL'
  ? SEOUL_ALL
  : rawLawd.split(',').map(c => c.trim()).filter(Boolean);

if (!MOLIT_KEY)    { console.error('❌ MOLIT_API_KEY 없음'); process.exit(1); }
if (!SUPABASE_URL) { console.error('❌ SUPABASE_URL 없음'); process.exit(1); }
if (!SUPABASE_KEY) { console.error('❌ SUPABASE_SERVICE_KEY 없음'); process.exit(1); }

// ── 유틸 ──────────────────────────────────────────────
function getTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

function parseItems(xml, lawdCd) {
  const items = [];
  const blocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  for (const b of blocks) {
    const block = b[1];
    if (getTag(block, 'cdealType').trim()) continue; // 계약 해제 제외

    const name = getTag(block, 'aptNm').trim()
              || getTag(block, 'mhouseNm').trim()
              || getTag(block, 'srgbCdNm').trim();

    const year  = getTag(block, 'dealYear');
    const month = getTag(block, 'dealMonth').padStart(2, '0');
    const day   = getTag(block, 'dealDay').padStart(2, '0');
    const price = getTag(block, 'dealAmount').replace(/,/g, '').replace(/\s/g, '');
    const area  = getTag(block, 'excluUseAr');
    const floor = getTag(block, 'floor');

    if (!name || !price) continue;

    items.push({
      trade_key:  `${lawdCd}_${name}_${year}${month}${day}_${price}_${area}_${floor}`,
      lawd_cd:    lawdCd,
      apt_name:   name,
      price, area, floor,
      deal_year:  year,
      deal_month: month,
      deal_day:   day,
      dong:       getTag(block, 'umdNm').trim(),
      trade_type: getTag(block, 'dealingGbn') || '매매',
    });
  }
  return items;
}

function parseRentItems(xml, lawdCd) {
  const items = [];
  const blocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  for (const b of blocks) {
    const block = b[1];
    const name = getTag(block, 'aptNm').trim();
    if (!name) continue;

    const year    = getTag(block, 'dealYear');
    const month   = getTag(block, 'dealMonth').padStart(2, '0');
    const day     = getTag(block, 'dealDay').padStart(2, '0');
    const deposit = getTag(block, 'deposit').replace(/,/g, '').replace(/\s/g, '');
    const monthly = parseInt(getTag(block, 'monthlyRent').replace(/,/g, '') || '0');
    const area    = getTag(block, 'excluUseAr');
    const floor   = getTag(block, 'floor');

    if (!deposit || parseInt(deposit) === 0) continue;
    if (monthly > 0) continue; // 월세 제외, 전세만

    items.push({
      trade_key:  `${lawdCd}_RENT_${name}_${year}${month}${day}_${deposit}_${area}_${floor}`,
      lawd_cd:    lawdCd,
      apt_name:   name,
      price:      deposit, // 보증금 = 전세금
      area, floor,
      deal_year:  year,
      deal_month: month,
      deal_day:   day,
      dong:       getTag(block, 'umdNm').trim(),
      trade_type: '전세',
    });
  }
  return items;
}

async function fetchRentMonth(month, lawdCd) {
  const PER_PAGE = 1000;
  const base = `https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent`
    + `?serviceKey=${encodeURIComponent(MOLIT_KEY)}&LAWD_CD=${lawdCd}&DEAL_YMD=${month}&numOfRows=${PER_PAGE}`;

  const r1 = await fetch(`${base}&pageNo=1`, { headers: MOLIT_HEADERS });
  if (!r1.ok) throw new Error(`HTTP ${r1.status}`);
  const xml1 = await r1.text();

  const resultCode = (xml1.match(/<resultCode>([^<]+)<\/resultCode>/) || [])[1]?.trim();
  if (resultCode && resultCode !== '00' && resultCode !== '000') {
    const msg = (xml1.match(/<resultMsg>([^<]+)<\/resultMsg>/) || [])[1]?.trim();
    throw new Error(`MOLIT 오류 ${resultCode}: ${msg}`);
  }

  const totalCount = parseInt((xml1.match(/<totalCount>(\d+)<\/totalCount>/) || [])[1] || '0');
  const totalPages = Math.ceil(totalCount / PER_PAGE);

  let items = parseRentItems(xml1, lawdCd);
  console.log(`  [전세] ${month}: ${totalCount}건 (전세만 ${items.length}건)`);

  if (totalPages > 1) {
    for (let p = 2; p <= totalPages; p++) {
      const r = await fetch(`${base}&pageNo=${p}`, { headers: MOLIT_HEADERS });
      if (r.ok) items = items.concat(parseRentItems(await r.text(), lawdCd));
    }
  }
  return items;
}

async function fetchMonth(month, lawdCd) {
  const PER_PAGE = 1000;
  const base = `https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev`
    + `?serviceKey=${encodeURIComponent(MOLIT_KEY)}&LAWD_CD=${lawdCd}&DEAL_YMD=${month}&numOfRows=${PER_PAGE}`;

  const r1 = await fetch(`${base}&pageNo=1`, { headers: MOLIT_HEADERS });
  if (!r1.ok) throw new Error(`HTTP ${r1.status}`);
  const xml1 = await r1.text();

  const resultCode = (xml1.match(/<resultCode>([^<]+)<\/resultCode>/) || [])[1]?.trim();
  if (resultCode && resultCode !== '00' && resultCode !== '000') {
    const msg = (xml1.match(/<resultMsg>([^<]+)<\/resultMsg>/) || [])[1]?.trim();
    throw new Error(`MOLIT 오류 ${resultCode}: ${msg}`);
  }

  const totalCount = parseInt((xml1.match(/<totalCount>(\d+)<\/totalCount>/) || [])[1] || '0');
  const totalPages = Math.ceil(totalCount / PER_PAGE);

  let items = parseItems(xml1, lawdCd);
  console.log(`  ${month}: ${totalCount}건 (${totalPages}페이지)`);

  if (totalPages > 1) {
    for (let p = 2; p <= totalPages; p++) {
      const r = await fetch(`${base}&pageNo=${p}`, { headers: MOLIT_HEADERS });
      if (r.ok) items = items.concat(parseItems(await r.text(), lawdCd));
    }
  }
  return items;
}

async function supabaseUpsert(rows) {
  const url = `${SUPABASE_URL}/rest/v1/trade_snapshots`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'resolution=ignore-duplicates', // ON CONFLICT DO NOTHING
    },
    body: JSON.stringify(rows),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Supabase 오류 ${r.status}: ${err}`);
  }
}

// ── 구 하나 동기화 ─────────────────────────────────────
async function syncOne(lawdCd, months, today) {
  console.log(`\n📍 [${lawdCd}] 동기화 시작`);
  let allItems = [];
  for (const m of months) {
    try {
      const items = await fetchMonth(m, lawdCd);
      allItems = allItems.concat(items);
      process.stdout.write(`  ${m}: ${items.length}건\r`);
    } catch (e) {
      console.error(`  ⚠️  ${lawdCd} ${m} 실패: ${e.message}`);
    }
  }
  if (allItems.length === 0) { console.log(`  → 데이터 없음`); return 0; }

  const seen = new Set();
  const rows = allItems
    // report_date = 실거래일 기준 (동기화 실행일 X → 차트가 날짜별로 분산됨)
    .map(t => ({ ...t, report_date: `${t.deal_year}-${t.deal_month}-${t.deal_day}` }))
    .filter(t => { if (seen.has(t.trade_key)) return false; seen.add(t.trade_key); return true; });

  const BATCH = 100;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    await supabaseUpsert(rows.slice(i, i + BATCH));
    upserted += Math.min(BATCH, rows.length - i);
  }
  console.log(`  ✅ [${lawdCd}] ${upserted}건 완료`);
  return upserted;
}

// ── 전세 구 하나 동기화 ────────────────────────────────
async function syncRentOne(lawdCd, months) {
  console.log(`\n🏘️  [${lawdCd}] 전세 동기화 시작`);
  let allItems = [];
  for (const m of months) {
    try {
      const items = await fetchRentMonth(m, lawdCd);
      allItems = allItems.concat(items);
    } catch (e) {
      console.error(`  ⚠️  [전세] ${lawdCd} ${m} 실패: ${e.message}`);
    }
  }
  if (allItems.length === 0) { console.log(`  → 전세 데이터 없음`); return 0; }

  const seen = new Set();
  const rows = allItems
    .map(t => ({ ...t, report_date: `${t.deal_year}-${t.deal_month}-${t.deal_day}` }))
    .filter(t => { if (seen.has(t.trade_key)) return false; seen.add(t.trade_key); return true; });

  const BATCH = 100;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    await supabaseUpsert(rows.slice(i, i + BATCH));
    upserted += Math.min(BATCH, rows.length - i);
  }
  console.log(`  ✅ [${lawdCd}] 전세 ${upserted}건 완료`);
  return upserted;
}

// ── 메인 ──────────────────────────────────────────────
async function main() {
  console.log('🏠 MOLIT → Supabase 동기화 시작');
  console.log(`  대상 구: ${LAWD_CODES.join(', ')} (${LAWD_CODES.length}개)`);
  console.log(`  최근 ${MONTHS_BACK}개월 / SYNC_TYPE=${SYNC_TYPE}`);

  const now = new Date();
  const months = [];
  for (let i = 0; i < MONTHS_BACK; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  console.log(`  조회 월: ${months.join(', ')}`);

  const today = now.toISOString().slice(0, 10);
  let total = 0;

  if (SYNC_TYPE === 'trade' || SYNC_TYPE === 'all') {
    for (const lawdCd of LAWD_CODES) {
      total += await syncOne(lawdCd, months, today);
    }
  }

  if (SYNC_TYPE === 'rent' || SYNC_TYPE === 'all') {
    for (const lawdCd of LAWD_CODES) {
      total += await syncRentOne(lawdCd, months);
    }
  }

  console.log(`\n🎉 전체 완료: ${LAWD_CODES.length}개 구, 총 ${total}건 동기화`);
}

main().catch(e => { console.error('오류:', e.message); process.exit(1); });
