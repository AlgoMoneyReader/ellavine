import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

const COMPLEX_COORDS = {
  '마곡엠밸리1단지':     [37.5648, 126.8182],
  '마곡엠밸리2단지':     [37.5641, 126.8200],
  '마곡엠밸리3단지':     [37.5633, 126.8213],
  '마곡엠밸리4단지':     [37.5618, 126.8228],
  '마곡엠밸리5단지':     [37.5610, 126.8248],
  '마곡엠밸리6단지':     [37.5600, 126.8263],
  '마곡엠밸리7단지':     [37.5593, 126.8280],
  '마곡엠밸리8단지':     [37.5619, 126.8268],
  '마곡힐스테이트':      [37.5651, 126.8237],
  '마곡나루경남아파트':  [37.5580, 126.8298],
  '마곡일성트루엘아파트':[37.5573, 126.8308],
  '마곡삼성아파트':      [37.5568, 126.8292],
  '마곡마이스터':        [37.5562, 126.8320],
  '마곡나루8단지':       [37.5575, 126.8285],
  '마곡10단지':          [37.5605, 126.8240],
  '래미안엘라비네':      [37.5529, 126.8272],
  '래미안 엘라비네':     [37.5529, 126.8272],
  '힐스테이트 등촌역':   [37.5582, 126.8437],

  // ── 마곡동 추가 ──
  '마곡엠밸리9단지':      [37.5628, 126.8255],
  '마곡엠밸리11단지':     [37.5560, 126.8335],
  '마곡엠밸리12단지':     [37.5548, 126.8352],
  '마곡엠밸리13단지':     [37.5535, 126.8368],
  '마곡엠밸리14단지':     [37.5520, 126.8392],

  // ── 내발산동 / 발산역 ──
  'e편한세상발산':         [37.5505, 126.8448],
  'e편한세상 발산':        [37.5505, 126.8448],
  '발산역엠밸리':          [37.5510, 126.8492],
  '힐스테이트발산역':      [37.5502, 126.8480],
  '힐스테이트 발산역':     [37.5502, 126.8480],

  // ── 외발산동 / 우장산 ──
  '우장산아이파크':        [37.5562, 126.8580],
  '우장산숲아이파크':      [37.5555, 126.8598],
  '강서힐스테이트':        [37.5558, 126.8618],
  '강서힐스테이트1차':     [37.5556, 126.8615],
  '강서힐스테이트2차':     [37.5552, 126.8622],

  // ── 화곡동 ──
  '화곡래미안':            [37.5472, 126.8530],
  '화곡래미안아파트':      [37.5472, 126.8530],
  '화곡코오롱하늘채':      [37.5458, 126.8555],
  '화곡두산위브':          [37.5465, 126.8542],

  // ── 가양동 ──
  '가양1단지':             [37.5630, 126.8598],
  '가양2단지':             [37.5622, 126.8610],
  '가양3단지':             [37.5615, 126.8595],
  '가양LG빌리지1단지':     [37.5618, 126.8625],
  '가양LG빌리지2단지':     [37.5608, 126.8630],
  '가양LG빌리지3단지':     [37.5600, 126.8635],
  '가양롯데캐슬':          [37.5638, 126.8620],
  '가양더샵마에스트로':    [37.5612, 126.8642],

  // ── 등촌동 ──
  '등촌주공1단지':         [37.5625, 126.8445],
  '등촌주공2단지':         [37.5615, 126.8458],
  '등촌주공3단지':         [37.5605, 126.8462],
  '등촌주공5단지':         [37.5632, 126.8432],
  '등촌주공7단지':         [37.5595, 126.8470],
  '등촌SK아파트':          [37.5638, 126.8435],
  '등촌SK':                [37.5638, 126.8435],

  // ── 염창동 ──
  '염창동아이파크':        [37.5548, 126.8842],
  '신목동아이파크':        [37.5520, 126.8830],
  '염창동동아에코빌':      [37.5540, 126.8855],

  // ── 공항동 ──
  '공항동에코숲아파트':    [37.5600, 126.8042],
  '공항동현대아파트':      [37.5598, 126.8038],
};


function formatPriceBubble(rawStr) {
  const num = parseInt(String(rawStr).replace(/,/g, '')) || 0;
  if (num >= 10000) {
    const eok = Math.floor(num / 10000);
    const man = num % 10000;
    return man > 0 ? `${eok}억<br/><span style="font-size:9px">${Number(man).toLocaleString()}만</span>` : `${eok}억`;
  }
  return `${num.toLocaleString()}만`;
}

function formatPriceText(rawStr) {
  const num = parseInt(String(rawStr).replace(/,/g, '')) || 0;
  if (num >= 10000) {
    const eok = Math.floor(num / 10000);
    const man = num % 10000;
    return man > 0 ? `${eok}억 ${Number(man).toLocaleString()}만` : `${eok}억`;
  }
  return `${num.toLocaleString()}만`;
}

function getLatestPriceByComplex(trades) {
  const map = {};
  for (const t of trades) {
    if (!map[t.name]) {
      map[t.name] = { ...t, count: 0 };
    }
    map[t.name].count++;
  }
  return Object.values(map);
}

export default function TradeMap({ trades = [], center = [37.5610, 126.8250], zoom = 14 }) {
  const mapRef = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || instanceRef.current) return;

    import('leaflet').then(({ default: L }) => {
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current, { center, zoom });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 18,
      }).addTo(map);

      instanceRef.current = map;

      const complexData = getLatestPriceByComplex(trades);
      let plotted = 0;

      for (const c of complexData) {
        const coords = COMPLEX_COORDS[c.name];
        if (!coords) continue;
        plotted++;

        const shortName = c.name
          .replace(/아파트$/, '')
          .replace(/단지$/, '')
          .slice(0, 8);

        const html = `
          <div style="
            background:#0B2849; color:#fff;
            border-radius:10px; padding:5px 9px;
            font-size:12px; font-weight:700;
            white-space:nowrap; text-align:center;
            box-shadow:0 2px 8px rgba(0,0,0,0.3);
            border:1.5px solid rgba(200,168,64,0.7);
            line-height:1.4; cursor:pointer;
          ">
            <div style="font-size:9px;color:#C8A840;margin-bottom:1px;">${shortName}</div>
            <div>${formatPriceBubble(c.price)}</div>
          </div>
          <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:7px solid #0B2849;margin:0 auto;"></div>
        `;

        const icon = L.divIcon({ html, className: '', iconAnchor: [42, 48], iconSize: [84, 48] });
        const marker = L.marker(coords, { icon }).addTo(map);

        marker.bindPopup(`
          <div style="min-width:150px;font-family:sans-serif;">
            <div style="font-weight:700;color:#0B2849;font-size:13px;margin-bottom:4px;">${c.name}</div>
            <div style="font-size:13px;font-weight:700;color:#0B2849;">${formatPriceText(c.price)}</div>
            <div style="font-size:11px;color:#888;margin-top:2px;">${c.area}㎡ · ${c.floor}층 · ${c.year}.${c.month}</div>
            <div style="font-size:10px;color:#aaa;">총 ${c.count}건 거래</div>
          </div>
        `);
      }

      if (plotted === 0) {
        L.marker([37.5610, 126.8250]).addTo(map).bindPopup('마곡동 중심').openPopup();
      }
    });

    return () => {
      if (instanceRef.current) {
        instanceRef.current.remove();
        instanceRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{ position:'relative' }}>
      <div ref={mapRef} style={{ height:460, borderRadius:16, overflow:'hidden', border:'1px solid var(--border)' }} />
      <div style={{
        position:'absolute', bottom:12, left:12, zIndex:1000,
        background:'rgba(255,255,255,0.92)', borderRadius:8,
        padding:'5px 10px', fontSize:10, color:'var(--text-2)',
        border:'1px solid var(--border)',
      }}>
        버블 클릭 → 상세정보
      </div>
    </div>
  );
}
