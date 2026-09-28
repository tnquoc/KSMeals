// KSMeals chat: answers parents' questions from the chosen school's published menus, plus any
// other covered school the parent names (to ask about it or compare).
//
// Called by the app with the publishable key (not a JWT, so gateway JWT checks are off and
// the key is checked here). The Gemini key and the database secret key stay on the server.
//
// POST { device_id: uuid, school_id: number, messages: [{ role: "user" | "assistant", content }],
//        allergies: [group id | term typed by the parent] }
// -> { reply, remaining }

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SECRET_KEY = Object.values(JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}"))[0] as string;
const PUBLISHABLE_KEYS = Object.values(JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}")) as string[];
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const LLM_BASE_URL = Deno.env.get("LLM_BASE_URL") ?? "https://generativelanguage.googleapis.com/v1beta/openai/";
const LLM_MODEL = Deno.env.get("LLM_MODEL") ?? "gemini-3.5-flash-lite";

// Messages per device per day. The chat shares the Gemini free-tier quota with the daily pipeline,
// so keep it low until billing is on; change with `supabase secrets set CHAT_DAILY_LIMIT=...`.
const DAILY_LIMIT = Number(Deno.env.get("CHAT_DAILY_LIMIT") ?? 20);
const MAX_MESSAGE_CHARS = 500;
const MAX_HISTORY = 8;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, content-type, authorization, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MEAL: Record<string, string> = {
  breakfast: "Bữa sáng", morning_snack: "Bữa phụ sáng", lunch: "Bữa trưa", snack: "Bữa xế",
};
const ALLERGEN: Record<string, string> = {
  crustacean: "tôm/cua", mollusc: "mực/sò/nghêu", fish: "cá", egg: "trứng", milk: "sữa",
  peanut: "đậu phộng", soy: "đậu nành", gluten: "lúa mì (gluten)", sesame: "mè", tree_nut: "các loại hạt",
};
const LEVEL: Record<string, string> = { mn: "mầm non (3-5 tuổi)", th: "tiểu học (6-10 tuổi)", thcs: "THCS (11-14 tuổi)" };
const WEEKDAY = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

const SYSTEM_PROMPT = `Bạn là trợ lý của KSMeals, giúp phụ huynh hiểu bữa ăn bán trú của con ở trường.
Quy tắc:
- Chỉ dùng DỮ LIỆU THỰC ĐƠN bên dưới khi nói về món trường nấu. Ngày nào không có dữ liệu thì nói trường chưa đăng, không đoán.
- Được phép: trả lời về thực đơn, món ăn, dinh dưỡng ước tính, gợi ý bữa tối ở nhà để cân bằng với bữa ở trường.
- Dị ứng: CHỈ lấy món từ CHỈ MỤC DỊ ỨNG (danh sách đầy đủ, đã được kiểm tra), chép đúng ngày, bữa và tên món trong khoảng thời gian được hỏi, không thêm món nào khác; nhắc thêm "thành phần ẩn" nếu bữa đó có. Nếu chỉ mục không có món nào cho chất đó thì nói là không thấy món nào có nhãn đó. Viết tự nhiên (ví dụ "Củ sắn xào tôm (có tôm)"), không chép nguyên cú pháp [có thể chứa: ...]. LUÔN nhắc ba mẹ xác nhận lại với nhà trường. Không bao giờ nói món nào "an toàn" hay "chắc chắn không có".
- Không chẩn đoán hay khuyên điều trị; vấn đề sức khỏe thì khuyên hỏi bác sĩ.
- Trường: mặc định trả lời theo TRƯỜNG ĐANG CHỌN của ba mẹ. Nếu ba mẹ hỏi về một trường có trong mục TRƯỜNG KHÁC thì trả lời theo dữ liệu trường đó (ghi rõ tên trường) và được so sánh các trường. Nếu hỏi về trường không có dữ liệu bên dưới: nói em chưa có thực đơn trường đó trong câu hỏi này, mời ba mẹ gõ đầy đủ tên trường (ví dụ "Tiểu học Phan Chu Trinh"), hoặc đổi trường ở tab Hồ sơ; nếu trường chưa có trên KSMeals thì bấm "Báo tôi khi có" ở tab Hồ sơ. Không nói là em chỉ biết một trường.
- Câu hỏi ngoài chủ đề bữa ăn của trẻ: từ chối nhẹ nhàng và gợi ý câu hỏi phù hợp.
- Không nhận xét tiêu cực về nhà trường.
- Ghi ngày dạng "Thứ Năm 24/9", không ghi năm. Câu hỏi theo tuần ("tuần này", "tuần sau"): chỉ dùng các ngày có nhãn đúng tuần đó trong dữ liệu và nói rõ khoảng ngày (ví dụ "tuần 21/9–25/9").
- Xưng "em", gọi người hỏi là "ba mẹ". Trả lời bằng tiếng Việt, thân thiện, ngắn gọn (tối đa khoảng 120 từ), dùng gạch đầu dòng khi liệt kê, không dùng bảng, không in đậm/in nghiêng.`;

type Meal = {
  school_id: number; date: string; meal_type: string; dishes: string[]; allergens: string[]; dish_allergens: string[][];
  ingredients: string[] | null; nutrition: { kcal?: number; protein_g?: number } | null; ai_note: string | null;
};
type School = { id: number; name: string; level: string };

const MAX_CUSTOM_ALLERGIES = 5;
const MAX_OTHER_SCHOOLS = 2;

/** Lowercase without diacritics. */
const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
const words = (s: string) => fold(s).replace(/[^a-z0-9]+/g, " ").trim();

// Same rules as customMatcher in app/src/lib/labels.ts: "thịt vịt" finds "Bún măng vịt"; typed with
// diacritics it is exact ("cá" is not "cà"), typed without, diacritics are ignored. Whole words only.
const GENERIC = /^(thịt|con|trái|quả|món|thit|trai|qua|mon)\s+/i;
function customMatcher(term: string): (text: string) => boolean {
  const core = term.trim().toLowerCase().normalize("NFC").replace(GENERIC, "");
  const exact = fold(core) !== core;
  const needle = exact ? core : fold(core);
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|[^\\p{L}])${escaped}($|[^\\p{L}])`, "u");
  return (text) => re.test(exact ? text.toLowerCase().normalize("NFC") : fold(text));
}

// "Trường Tiểu học Phan Chu Trinh" -> "phan chu trinh": the part parents actually type.
const LEVEL_PREFIX = /^(truong )?(mam non|mau giao|nha tre|tieu hoc|trung hoc co so|thcs|th|mn|mg) /;

/** Covered schools other than the chosen one that the parent names in their messages. */
function mentionedSchools(texts: string[], schools: School[], chosenId: number): School[] {
  const said = ` ${words(texts.join(" "))} `;
  return schools
    .filter((s) => s.id !== chosenId)
    .filter((s) => {
      const key = words(s.name).replace(LEVEL_PREFIX, "");
      return key.length >= 4 && !/^\d+$/.test(key) && said.includes(` ${key} `);
    })
    .slice(0, MAX_OTHER_SCHOOLS);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function db(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SECRET_KEY, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`db ${path.split("?")[0]}: ${res.status} ${text}`);
  return text ? JSON.parse(text) : null; // writes with return=minimal answer 201 with no body
}

/** Today in Vietnam as YYYY-MM-DD plus the weekday index. */
function vnToday(): { iso: string; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date());
  return { iso: parts, weekday: new Date(`${parts}T00:00:00Z`).getUTCDay() };
}

function shift(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing today (Sunday belongs to the week that just ended). */
const mondayOf = (today: { iso: string; weekday: number }) => shift(today.iso, -((today.weekday + 6) % 7));

/** "2026-09-21" -> "21/9" */
const dm = (iso: string) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`;

function weekLabel(iso: string, monday: string): string {
  const weeks = Math.floor((Date.parse(iso) - Date.parse(monday)) / (7 * 86400000));
  return weeks === 0 ? "tuần này" : weeks === -1 ? "tuần trước" : weeks === 1 ? "tuần sau" : `${weeks > 0 ? "sau" : "trước"} ${Math.abs(weeks)} tuần`;
}

/** Count this message against the device's daily limit; returns messages left after it, or -1 if over. */
async function consume(deviceId: string, today: string): Promise<number> {
  await db("devices?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify([{ id: deviceId }]),
  });
  const rows = await db(`chat_usage?select=count&device_id=eq.${deviceId}&date=eq.${today}`) as { count: number }[];
  const used = rows[0]?.count ?? 0;
  if (used >= DAILY_LIMIT) return -1;
  await db("chat_usage?on_conflict=device_id,date", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ device_id: deviceId, date: today, count: used + 1 }]),
  });
  return DAILY_LIMIT - used - 1;
}

/** Undo `consume` when no answer could be produced. */
async function refund(deviceId: string, today: string, remaining: number) {
  await db("chat_usage?on_conflict=device_id,date", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ device_id: deviceId, date: today, count: DAILY_LIMIT - remaining - 1 }]),
  }).catch((e) => console.error("refund", e));
}

// Google's free models sometimes answer 503 "high demand" for a while; an older model usually still works.
const MODELS = [LLM_MODEL, ...(Deno.env.get("LLM_FALLBACK_MODELS") ?? "gemini-3.1-flash-lite").split(",").map((m) => m.trim())]
  .filter((m, i, all) => m && all.indexOf(m) === i);
const RETRYABLE = new Set([429, 500, 503]);

const ATTEMPT_MS = 25_000; // an overloaded model sometimes hangs instead of answering 503
const BUDGET_MS = 45_000; // stop trying well before the app (60 s) and the platform give up

/** One chat completion: each model once more after a short pause, then the next model. */
async function complete(messages: { role: string; content: string }[]): Promise<Response> {
  const deadline = Date.now() + BUDGET_MS;
  let last = new Response("timeout", { status: 503 });
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const left = deadline - Date.now();
      if (left < 3_000) return last;
      try {
        last = await fetch(`${LLM_BASE_URL}chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, temperature: 0.3, messages }),
          signal: AbortSignal.timeout(Math.min(ATTEMPT_MS, left)),
        });
      } catch (e) {
        console.error("llm", model, "timed out or failed", e);
        last = new Response("timeout", { status: 503 });
        continue;
      }
      if (last.ok || !RETRYABLE.has(last.status)) return last;
      console.error("llm", model, last.status, (await last.text()).slice(0, 200));
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return last!;
}

/** Menus and the allergen index of one school. Custom terms (typed by the parent) are matched here, in code. */
function schoolContext(school: School, meals: Meal[], custom: string[], monday: string) {
  const lines = [
    `Trường: ${school.name} (${LEVEL[school.level] ?? school.level})`,
    "DỮ LIỆU THỰC ĐƠN (dinh dưỡng là ước tính cho một suất; [có thể chứa: ...] là nhãn dị ứng của từng món):",
  ];
  let lastDate = "";
  for (const m of meals) {
    if (!m.dishes.length) continue;
    if (m.date !== lastDate) {
      lastDate = m.date;
      lines.push(`\n${WEEKDAY[new Date(`${m.date}T00:00:00Z`).getUTCDay()]} ${m.date} (${weekLabel(m.date, monday)}):`);
    }
    const names = (ids: string[]) => ids.map((a) => ALLERGEN[a] ?? a).join(", ");
    const dishes = m.dishes.map((d, i) => {
      const tags = m.dish_allergens?.[i] ?? [];
      return tags.length ? `${d} [có thể chứa: ${names(tags)}]` : d;
    });
    const parts = [`- ${MEAL[m.meal_type] ?? m.meal_type}: ${dishes.join("; ")}`];
    if (m.nutrition?.kcal) parts.push(`~${Math.round(m.nutrition.kcal)} kcal, đạm ${Math.round(m.nutrition.protein_g ?? 0)}g`);
    // Allergens only found in the usual ingredients (e.g. egg in a sponge cake), not in a dish name.
    const hidden = (m.allergens ?? []).filter((a) => !(m.dish_allergens ?? []).some((t) => t.includes(a)));
    if (hidden.length) parts.push(`thành phần ẩn có thể có: ${names(hidden)}`);
    lines.push(parts.join(" | "));
  }
  if (!lastDate) lines.push("(Chưa có thực đơn nào trong khoảng thời gian này.)");

  // Computed here, not by the model: which dishes carry each allergen tag.
  const index: Record<string, string[]> = {};
  for (const m of meals) {
    const when = `${WEEKDAY[new Date(`${m.date}T00:00:00Z`).getUTCDay()]} ${m.date} ${MEAL[m.meal_type] ?? m.meal_type}`;
    m.dishes.forEach((d, i) => {
      for (const a of m.dish_allergens?.[i] ?? []) (index[a] ??= []).push(`${when}: ${d}`);
    });
    for (const a of m.allergens ?? []) {
      if (!(m.dish_allergens ?? []).some((t) => t.includes(a))) (index[a] ??= []).push(`${when}: thành phần ẩn, không rõ món`);
    }
    for (const term of custom) {
      const match = customMatcher(term);
      const hits = m.dishes.filter(match);
      for (const d of hits) (index[term] ??= []).push(`${when}: ${d}`);
      if (!hits.length && (m.ingredients ?? []).some(match)) (index[term] ??= []).push(`${when}: thành phần ẩn, không rõ món`);
    }
  }
  lines.push("CHỈ MỤC DỊ ỨNG (danh sách đầy đủ và duy nhất; dùng mục này khi trả lời về dị ứng):");
  for (const [a, items] of Object.entries(index)) lines.push(`- ${ALLERGEN[a] ?? a}: ${items.join("; ")}`);
  if (!Object.keys(index).length) lines.push("- (không có món nào có nhãn dị ứng)");
  return lines.join("\n");
}

function menuContext(
  chosen: School,
  others: School[],
  meals: Meal[],
  today: { iso: string; weekday: number },
  allergies: string[],
  custom: string[],
) {
  const profile = [...allergies.map((a) => ALLERGEN[a]), ...custom];
  const monday = mondayOf(today);
  const range = (offset: number) => `${dm(shift(monday, 7 * offset))}–${dm(shift(monday, 7 * offset + 4))}`;
  const weekend = today.weekday === 0 || today.weekday === 6;
  const parts = [
    `Hôm nay: ${WEEKDAY[today.weekday]} ${today.iso}`,
    // The model can't work out weeks from bare dates reliably (it once answered "tuần này" with 14/9-18/9).
    `Các tuần: tuần trước = ${range(-1)}; tuần này = ${range(0)}; tuần sau (tuần tới) = ${range(1)}.` +
      (weekend
        ? ` Hôm nay là cuối tuần, trường nghỉ: "tuần này" là tuần ${range(0)} vừa học xong; nếu ba mẹ hỏi món sắp tới thì dùng tuần sau ${range(1)}.`
        : ""),
    profile.length
      ? `Hồ sơ của con: dị ứng với ${profile.join(", ")}. Khi trả lời về một ngày/bữa có món ` +
        "nằm trong CHỈ MỤC DỊ ỨNG của các chất này, chủ động nhắc ba mẹ món đó."
      : "Hồ sơ của con: chưa khai báo dị ứng.",
    `\n=== TRƯỜNG ĐANG CHỌN ===\n${schoolContext(chosen, meals.filter((m) => m.school_id === chosen.id), custom, monday)}`,
  ];
  for (const s of others) {
    parts.push(
      `\n=== TRƯỜNG KHÁC (ba mẹ nhắc tới) ===\n${schoolContext(s, meals.filter((m) => m.school_id === s.id), custom, monday)}`,
    );
  }
  return parts.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!PUBLISHABLE_KEYS.includes(req.headers.get("apikey") ?? "")) return json({ error: "unauthorized" }, 401);

  let body: { device_id?: string; school_id?: number; messages?: { role: string; content: string }[]; allergies?: string[] };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const deviceId = body.device_id ?? "";
  const allergies = (body.allergies ?? []).filter((a) => a in ALLERGEN);
  // Anything else in the profile is a term the parent typed ("thịt vịt").
  const custom = (body.allergies ?? [])
    .filter((a) => typeof a === "string" && !(a in ALLERGEN))
    .map((a) => a.trim().slice(0, 30))
    .filter((a) => a.length >= 2)
    .slice(0, MAX_CUSTOM_ALLERGIES);
  const schoolId = Number(body.school_id);
  const history = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));
  if (!/^[0-9a-f-]{36}$/i.test(deviceId) || !Number.isInteger(schoolId) || history.at(-1)?.role !== "user") {
    return json({ error: "bad request" }, 400);
  }

  try {
    const today = vnToday();
    const remaining = await consume(deviceId, today.iso);
    if (remaining < 0) {
      return json({ error: "limit", reply: `Bạn đã dùng hết ${DAILY_LIMIT} câu hỏi hôm nay. Mai hỏi tiếp nhé!` }, 429);
    }

    const schools = await db("schools?select=id,name,level&active=eq.true") as School[];
    const chosen = schools.find((s) => s.id === schoolId);
    if (!chosen) return json({ error: "unknown school" }, 404);
    // Another covered school named in the conversation ("thực đơn trường Phan Chu Trinh") is added too.
    const others = mentionedSchools(history.filter((m) => m.role === "user").map((m) => m.content), schools, schoolId);
    const ids = [chosen, ...others].map((s) => s.id).join(",");
    // Last week to next week around today.
    const monday = mondayOf(today);
    const meals = await db(
      `meals?select=school_id,date,meal_type,dishes,allergens,dish_allergens,ingredients,nutrition,ai_note&school_id=in.(${ids})` +
        `&status=eq.published&date=gte.${shift(monday, -7)}&date=lte.${shift(monday, 11)}&order=date`,
    ) as Meal[];

    const messages = [
      { role: "system", content: `${SYSTEM_PROMPT}\n\n${menuContext(chosen, others, meals, today, allergies, custom)}` },
      ...history,
    ];
    const res = await complete(messages);
    if (!res.ok) {
      await refund(deviceId, today.iso, remaining); // the parent got no answer: don't count the question
      const busy = res.status === 429 || res.status === 503;
      return json({ error: "llm", reply: busy ? "Trợ lý đang quá tải, bạn thử lại sau ít phút nhé." : "Có lỗi khi trả lời, bạn thử lại sau nhé." }, 502);
    }
    const data = await res.json();
    const reply = (data.choices?.[0]?.message?.content ?? "").trim() || "Mình chưa trả lời được câu này, bạn hỏi lại cách khác nhé.";
    return json({ reply, remaining });
  } catch (e) {
    console.error(e);
    return json({ error: "server", reply: "Có lỗi khi trả lời, bạn thử lại sau nhé." }, 500);
  }
});
