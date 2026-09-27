// One static HTML page per covered school, so parents who search Google for
// "thực đơn bán trú <tên trường>" land on KSMeals. Written into the web export (dist/)
// after `expo export`; the daily web build refreshes them with the new menus.
//
// Usage (from app/): node scripts/school-pages.mjs [outDir=dist]
// Env: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (read-only, public),
//      EXPO_BASE_URL (/KSMeals on GitHub Pages), SITE_ORIGIN (https://tnquoc.github.io).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2] ?? 'dist';
const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
const KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const BASE = (process.env.EXPO_BASE_URL ?? '').replace(/\/+$/, '');
const ORIGIN = (process.env.SITE_ORIGIN ?? 'https://tnquoc.github.io').replace(/\/+$/, '');
if (!SUPABASE_URL || !KEY) throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');

// Same labels as src/lib/labels.ts; ward names come from the generated src/lib/wards.ts.
const LEVEL = { mn: 'Mầm non', th: 'Tiểu học', thcs: 'THCS' };
const MEAL = { breakfast: 'Bữa sáng', morning_snack: 'Bữa phụ sáng', lunch: 'Bữa trưa', snack: 'Bữa xế' };
const MEAL_ORDER = ['breakfast', 'morning_snack', 'lunch', 'snack'];
const ALLERGEN = {
  crustacean: 'Tôm, cua', mollusc: 'Mực, sò', fish: 'Cá', egg: 'Trứng', milk: 'Sữa',
  peanut: 'Đậu phộng', soy: 'Đậu nành', gluten: 'Lúa mì', sesame: 'Mè', tree_nut: 'Hạt',
};
const WEEKDAY = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const WARD = Object.fromEntries(
  [...readFileSync(new URL('../src/lib/wards.ts', import.meta.url), 'utf8').matchAll(/^\s*(\w+): "(.+)",$/gm)].map((m) => [m[1], m[2]]),
);

const PAGE = 1000; // Supabase returns at most 1000 rows per request

async function get(path) {
  const all = [];
  for (let offset = 0; ; offset += PAGE) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}&limit=${PAGE}&offset=${offset}`, { headers: { apikey: KEY } });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
    const rows = await res.json();
    all.push(...rows);
    if (rows.length < PAGE) return all;
  }
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const dm = (s) => `${Number(s.slice(8, 10))}/${Number(s.slice(5, 7))}`;
const weekday = (s) => WEEKDAY[new Date(`${s}T00:00:00Z`).getUTCDay()];

/** Monday of this week in Vietnam; on weekends the coming week is the one parents look for. */
function currentMonday() {
  const vn = new Date(Date.now() + 7 * 3600000);
  const today = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()));
  const dow = today.getUTCDay();
  const weekend = dow === 0 || dow === 6;
  return { monday: weekend ? addDays(today, dow === 6 ? 2 : 1) : addDays(today, 1 - dow), weekend };
}

const CSS = `
:root{--bg:#F6F7F9;--card:#fff;--text:#1C2430;--muted:#677386;--border:#E3E7EE;--accent:#1F7A4D;--soft:#E6F4EC;--warn:#9A5B00;--warnSoft:#FFF4E0}
@media (prefers-color-scheme:dark){:root{--bg:#12161C;--card:#1B2129;--text:#E6E9EE;--muted:#97A2B3;--border:#2C3440;--accent:#5CC58E;--soft:#1D3328;--warn:#F0B35A;--warnSoft:#3A2D17}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:720px;margin:0 auto;padding:16px}a{color:var(--accent)}h1{font-size:26px;line-height:1.25;margin:8px 0}h2{font-size:19px;margin:28px 0 8px}
.muted{color:var(--muted);font-size:14px}.cta{display:block;text-align:center;background:var(--accent);color:#fff;text-decoration:none;font-weight:700;border-radius:999px;padding:12px;margin:16px 0}
.day{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:12px 16px;margin:10px 0}.day h3{margin:0 0 6px;font-size:16px}
.meal{margin:8px 0}.meal b{color:var(--accent);font-size:13px;text-transform:uppercase;letter-spacing:.4px}.meal ul{margin:4px 0;padding-left:20px}
.tag{display:inline-block;background:var(--warnSoft);color:var(--warn);font-size:12px;font-weight:700;border-radius:999px;padding:1px 8px;margin:2px 4px 0 0}
.brand{display:flex;align-items:center;gap:8px;text-decoration:none;color:var(--text);font-weight:700}.brand img{width:32px;height:32px;border-radius:8px}
ul.schools{padding-left:20px}footer{margin:32px 0 16px;font-size:13px;color:var(--muted)}`;

function page({ title, description, path, body }) {
  const url = `${ORIGIN}${BASE}${path}`;
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}"><meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${ORIGIN}${BASE}/icon-512.png"><link rel="icon" href="${BASE}/favicon.ico">
<style>${CSS}</style></head><body><main>
<a class="brand" href="${BASE}/"><img src="${BASE}/icon-192.png" alt="">KSMeals · Thực đơn bán trú</a>
${body}
<footer>KSMeals là ứng dụng độc lập, không phải ứng dụng chính thức của Sở GD&amp;ĐT TP.HCM hay nhà trường. Thực đơn lấy từ website công khai của các trường; dinh dưỡng là ước tính bằng AI, nhãn dị ứng có thể thiếu hoặc thừa, hãy xác nhận với nhà trường. <a href="${BASE}/privacy">Chính sách quyền riêng tư</a></footer>
</main></body></html>`;
}

function mealHtml(m) {
  const kcal = m.nutrition?.kcal ? ` · ~${Math.round(m.nutrition.kcal)} kcal` : '';
  const tags = (m.allergens ?? []).map((a) => `<span class="tag">${esc(ALLERGEN[a] ?? a)}</span>`).join('');
  return `<div class="meal"><b>${esc(MEAL[m.meal_type] ?? m.meal_type)}</b><span class="muted">${kcal}</span>
<ul>${m.dishes.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>${m.ai_note ? `<div class="muted">${esc(m.ai_note)}</div>` : ''}${tags ? `<div>Có thể chứa: ${tags}</div>` : ''}</div>`;
}

function weekHtml(label, days) {
  if (!days.length) return '';
  return `<h2>${esc(label)}</h2>${days
    .map(([date, meals]) => `<section class="day"><h3>${weekday(date)} ${dm(date)}</h3>${meals.map(mealHtml).join('')}</section>`)
    .join('')}`;
}

async function main() {
  const schools = await get('schools?select=id,code,name,level,ward,address&active=eq.true&order=name');
  const { monday, weekend } = currentMonday();
  const from = iso(monday);
  const lastMonday = iso(addDays(monday, -7));
  const nextMonday = iso(addDays(monday, 7));
  const to = iso(addDays(monday, 11));
  // Last week too: a school that hasn't posted the coming week yet still gets a useful page.
  const meals = await get(
    `meals?select=school_id,date,meal_type,dishes,nutrition,ai_note,allergens,source_post_id&status=eq.published` +
      `&date=gte.${lastMonday}&date=lte.${to}&order=date,id`,
  );
  const postIds = [...new Set(meals.map((m) => m.source_post_id).filter(Boolean))];
  const posts = postIds.length ? await get(`raw_posts?select=id,url&id=in.(${postIds.join(',')})`) : [];
  const postUrl = Object.fromEntries(posts.map((p) => [p.id, p.url]));

  const bySchool = new Map();
  for (const m of meals) {
    if (!m.dishes?.length) continue;
    if (!bySchool.has(m.school_id)) bySchool.set(m.school_id, []);
    bySchool.get(m.school_id).push(m);
  }
  const byWard = new Map();
  for (const s of schools) {
    if (!byWard.has(s.ward)) byWard.set(s.ward, []);
    byWard.get(s.ward).push(s);
  }

  const urls = [];
  for (const s of schools) {
    const own = (bySchool.get(s.id) ?? []).sort(
      (a, b) => a.date.localeCompare(b.date) || MEAL_ORDER.indexOf(a.meal_type) - MEAL_ORDER.indexOf(b.meal_type),
    );
    const group = (list) => [...list.reduce((acc, m) => acc.set(m.date, [...(acc.get(m.date) ?? []), m]), new Map())];
    const lastWeek = group(own.filter((m) => m.date < from));
    const thisWeek = group(own.filter((m) => m.date >= from && m.date < nextMonday));
    const nextWeek = group(own.filter((m) => m.date >= nextMonday));
    const ward = WARD[s.ward] ?? '';
    const place = s.address || ward;
    const range = `${dm(from)}–${dm(iso(addDays(monday, 4)))}`;
    const lunch = own.find((m) => m.meal_type === 'lunch' && m.date >= from) ?? own.find((m) => m.meal_type === 'lunch');
    const sources = [...new Set(own.map((m) => postUrl[m.source_post_id]).filter(Boolean))];
    const neighbours = (byWard.get(s.ward) ?? []).filter((o) => o.id !== s.id).slice(0, 8);
    const path = `/truong/${s.code}/`;
    const body = `
<h1>Thực đơn bán trú ${esc(s.name)}</h1>
<p class="muted">${esc(LEVEL[s.level] ?? s.level)}${place ? ` · ${esc(place)}` : ''}</p>
<p>Thực đơn bữa ăn bán trú của ${esc(s.name)} tuần ${range}, kèm dinh dưỡng ước tính cho từng bữa và nhãn các món thường gây dị ứng. Trang được cập nhật mỗi sáng.</p>
<a class="cta" href="${BASE}/?school=${encodeURIComponent(s.code)}">Mở trong ứng dụng KSMeals</a>
${weekHtml(`${weekend ? 'Tuần tới' : 'Tuần này'} (${range})`, thisWeek) || `<p>Trường chưa đăng thực đơn tuần ${range}.</p>`}
${weekHtml(`${weekend ? 'Tuần sau nữa' : 'Tuần sau'} (${dm(nextMonday)}–${dm(to)})`, nextWeek)}
${weekHtml(`${weekend ? 'Tuần vừa qua' : 'Tuần trước'} (${dm(lastMonday)}–${dm(iso(addDays(monday, -3)))})`, lastWeek)}
${sources.length ? `<p class="muted">Nguồn: ${sources.map((u) => `<a href="${esc(u)}" rel="nofollow">bài đăng trên website trường</a>`).join(', ')}</p>` : ''}
${neighbours.length ? `<h2>Trường khác${ward ? ` ở ${esc(ward)}` : ''}</h2><ul class="schools">${neighbours.map((o) => `<li><a href="${BASE}/truong/${o.code}/">${esc(o.name)}</a></li>`).join('')}</ul>` : ''}
<p><a href="${BASE}/truong/">Tất cả trường có thực đơn trên KSMeals</a></p>`;
    const description = lunch
      ? `Thực đơn bán trú ${s.name} tuần ${range}: ${lunch.dishes.slice(0, 3).join(', ')}… Dinh dưỡng ước tính và nhãn dị ứng từng bữa.`
      : `Thực đơn bán trú ${s.name} mỗi ngày, dinh dưỡng ước tính và nhãn dị ứng từng bữa.`;
    mkdirSync(join(OUT, 'truong', s.code), { recursive: true });
    writeFileSync(
      join(OUT, 'truong', s.code, 'index.html'),
      page({ title: `Thực đơn bán trú ${s.name} tuần ${range} | KSMeals`, description, path, body }),
    );
    urls.push(path);
  }

  const wards = [...byWard].sort(([a], [b]) => (WARD[a] ?? a).localeCompare(WARD[b] ?? b, 'vi'));
  const index = `<h1>Thực đơn bán trú các trường TP.HCM</h1>
<p>${schools.length} trường công lập đang có thực đơn trên KSMeals, cập nhật mỗi sáng từ website của trường.</p>
<a class="cta" href="${BASE}/">Mở ứng dụng KSMeals</a>
${wards.map(([w, list]) => `<h2>${esc(WARD[w] ?? w)}</h2><ul class="schools">${list.map((s) => `<li><a href="${BASE}/truong/${s.code}/">${esc(s.name)}</a> <span class="muted">${esc(LEVEL[s.level] ?? '')}</span></li>`).join('')}</ul>`).join('')}`;
  mkdirSync(join(OUT, 'truong'), { recursive: true });
  writeFileSync(
    join(OUT, 'truong', 'index.html'),
    page({
      title: 'Thực đơn bán trú các trường TP.HCM | KSMeals',
      description: `Thực đơn bán trú mỗi ngày của ${schools.length} trường mầm non, tiểu học, THCS tại TP.HCM, kèm dinh dưỡng ước tính và nhãn dị ứng.`,
      path: '/truong/',
      body: index,
    }),
  );

  const today = iso(new Date());
  const all = ['/', '/truong/', ...urls];
  writeFileSync(
    join(OUT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${all
      .map((p) => `  <url><loc>${ORIGIN}${BASE}${p}</loc><lastmod>${today}</lastmod></url>`)
      .join('\n')}\n</urlset>\n`,
  );
  console.log(`school pages: ${urls.length} schools, ${meals.length} meals, week of ${from}`);
}

await main();
