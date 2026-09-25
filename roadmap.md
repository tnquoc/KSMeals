# KSMeals Roadmap

> Cập nhật: 2026-09-25. Đánh dấu `[x]` khi xong.

**Mục tiêu v1:** app iOS + Android cho phụ huynh TP.HCM xem thực đơn bán trú của trường con, có dinh dưỡng ước tính bằng AI và một chatbot nhỏ. Mục đích là trả lời một câu hỏi: **phụ huynh có mở app đều đặn không?**

**Đang ở:** ✅ Phase 1 + 2 xong (pipeline tự chạy mỗi sáng, có dinh dưỡng và dị ứng; trang xem trước + duyệt). 👉 Tiếp: Phase 3, app Expo.

---

## Tổng quan

| Phase | Nội dung | Thời gian ước tính | Trạng thái |
|---|---|---|---|
| 0 | Khảo sát nguồn dữ liệu | 1 ngày | ✅ Xong |
| 1 | Pipeline: crawl → OCR → tách ngày → database | 1,5–2 tuần | ✅ Xong (19 trường; mở rộng khi sẵn sàng) |
| 2 | Trang web xem và duyệt dữ liệu | 2–3 ngày | ✅ Xong |
| 3 | App Expo: chọn trường, thực đơn, dinh dưỡng, push | 2 tuần | 👉 Tiếp theo |
| 4 | Chatbot | 1 tuần | ⏳ |
| 5 | Hoàn thiện và nộp store | 1 tuần (+ ~2 tuần Google closed testing) | ⏳ |
| 6 | Ra mắt và đo lường | 4–6 tuần sau ra mắt | ⏳ |

Tổng: khoảng 7–8 tuần làm bán thời gian đến khi app có mặt trên store.

---

## Phase 0: Khảo sát nguồn dữ liệu ✅

- [x] Xác định nền tảng: hầu hết trường công TP.HCM dùng CMS Quảng Ích tại `<code>.hcm.edu.vn`
- [x] Tìm ra toàn bộ trường qua 168 cổng phường/xã → **1.293 trường** (`pipeline/discover.py`)
- [x] Đo độ phủ qua `sitemap.xml` (`pipeline/survey.py`)

**Kết quả (25/09/2026):**

| Cấp | Số trường | Đăng đều đặn | Có đăng năm học này |
|---|---|---|---|
| Mầm non | 506 | 143 (28%) | 34% |
| Tiểu học | 502 | 165 (33%) | 40% |
| THCS | 285 | 67 (24%) | 39% |
| **Tổng** | **1.293** | **375 (29%)** | **37%** |

**Kết luận:** làm tiếp. 375 trường đăng đều đặn, gấp khoảng 7 lần mục tiêu 50 trường ban đầu.

**Những điều đã biết:**
- robots.txt cấm `/Timkiem` → không dùng tìm kiếm của site, dùng sitemap thay thế
- Thực đơn chủ yếu là **ảnh**, đăng theo **tuần** → bắt buộc OCR
- Slug và tiêu đề bài thường có khoảng ngày (`tu-ngay-2192026-den-ngay-2592026`) → dùng để xác định tuần áp dụng
- Khoảng 128 trường đã bắt đầu đăng **ảnh khay ăn thực tế**
- Server của Sở chậm → tối đa 4 request đồng thời, có retry

---

## Phase 1: Pipeline dữ liệu 👉

Luồng dữ liệu:

```
sitemap.xml ─► raw_posts ─► tải ảnh gốc ─► OCR (Gemini) ─► menu_weeks (JSON thô)
                                                                 │
                                         tách tuần thành từng ngày + đối chiếu ngày
                                                                 ▼
                                             meals (1 dòng / trường / ngày) ─► app đọc
```

- [x] **1.1 Crawl bài thực đơn** (`pipeline/crawl.py`): sitemap → bài mới → ảnh/tài liệu. Nhận 7 kiểu đăng bài (ảnh trong bài, ảnh ở `/data/doc/`, ảnh thư viện `haydung`, PDF, Word, Excel). Thử nghiệm 20 trường: lấy được file cho 93/97 bài.
- [x] **1.2 Tải ảnh/tài liệu**: ảnh bản gốc; PDF → ảnh từng trang; .docx/.xlsx → chữ. ⏳ Chưa hỗ trợ .doc/.xls đời cũ (cần LibreOffice, sẽ cài trên GitHub Actions).
- [x] **1.3 OCR bằng Gemini** (`pipeline/ocr.py`, `pipeline/process.py`, model `gemini-3.5-flash-lite`): thử nghiệm 90 bài → 75 publish, 4 cần duyệt, 11 không phải thực đơn. Đối chiếu tay: tên món đúng khoảng 95%+.
  - ⚠️ Gói miễn phí: `gemini-3.5-flash` chỉ 20 request/ngày → dùng bản `flash-lite` (đọc đúng 28/28 món trên ảnh chuẩn, nhanh gấp 3). Chạy thật 375 trường cần bật billing hoặc hạn mức cao hơn.
  - Lỗi đã biết: gộp thực đơn **nhà trẻ / mẫu giáo** vào cùng một bữa; đôi khi tách sai món có dấu phẩy ("Trứng chiên, thịt xay"); ảnh "Khẩu phần ăn" bị coi là không phải thực đơn thay vì ảnh khay.
- [x] **1.4 Tách tuần → ngày** (`pipeline/dates.py`, `pipeline/split.py`): dùng khoảng ngày trong tiêu đề/slug làm mốc chính, đối chiếu với ngày OCR đọc được. Lệch ngày, sai thứ, ngày quá xa ngày đăng → `needs_review`.
- [x] **1.5 Dinh dưỡng + nhận xét** (`pipeline/nutrition.py`): 1 lần gọi AI (chỉ gửi chữ) cho mỗi trường mỗi tuần → kcal, đạm, béo, bột đường theo độ tuổi, nguyên liệu chính, 1 câu nhận xét trung lập về nhóm chất. 418/418 bữa đã có. Trung vị bữa trưa: mầm non ~490 kcal, tiểu học ~590, THCS ~660.
  - Dị ứng do **code** dò từ khóa (`pipeline/allergens.py`) trên tên món + nguyên liệu, không để AI kết luận. 10 nhóm: tôm cua, mực sò, cá, trứng, sữa, đậu phộng, đậu nành, lúa mì, mè, hạt.
  - Chạy trong `daily.yml` sau bước OCR.
- [x] **1.6 Supabase** (project `KSMeals`, Singapore): schema `0001_init.sql` + `0002_meal_courses_trays.sql`, RLS + phân quyền rõ ràng (app chỉ đọc `schools`/`meals` đã publish). `pipeline/sync.py` đã đẩy: 1.293 trường (19 active), 97 bài, 406 bữa ăn. Chạy lại an toàn (upsert). ⏳ Còn kiểm tra quyền bằng publishable key.
- [x] **1.7 GitHub Actions**: `daily.yml` chạy **5h sáng mỗi ngày** (crawl + OCR, hiện chỉ các trường đã active; chạy tay chọn được `all-regular-and-active`). Trạng thái nằm hết trên Supabase nên runner trống vẫn chạy tiếp được. Đã kiểm chứng: GitHub vào được site trường; lần chạy đầu lấy 14 bài mới, có thực đơn tuần sau.

**Xong khi:** ≥80% bài của các trường "regular" được bóc thành thực đơn theo ngày mà không cần sửa tay.

Schema tối thiểu:

```sql
schools(id, code, name, level, ward, status, active)
raw_posts(id, school_id, post_id UNIQUE, title, url, published_at, image_urls[], status, crawled_at)
  -- status: pending → ocr_done → published | needs_review
menu_weeks(id, raw_post_id, week_start, week_end, json_raw, model, ocr_confidence)
meals(id, school_id, date, meal_type, dishes[], ingredients[], allergens[],
      nutrition jsonb, ai_note, source_url, status)   -- UNIQUE(school_id, date, meal_type)
devices(id, push_token, school_id, created_at)
chat_usage(device_id, date, count)
```

---

## Phase 2: Trang web xem và duyệt dữ liệu ✅

Chạy: `uv run python -m pipeline.devserver` → http://127.0.0.1:8765

- [x] Trang xem trước (`web/index.html`): chọn trường → thực đơn theo tuần, món nhóm theo loại (món mặn, canh, xào...), ảnh khay, link bài gốc. Dùng publishable key → thấy đúng những gì app thấy.
- [x] Trang duyệt (`web/review.html`): bài `needs_review`/`failed` cạnh ảnh/tài liệu gốc; Duyệt, Loại, OCR lại, sửa JSON → xem trước → lưu. Secret key chỉ ở server local.
- [x] Từ dữ liệu thật: bỏ báo động giả khi ngày đã có trong tiêu đề (4/5 bài cần duyệt là do Gemini đếm sai thứ). Bài còn lại (THCS Lê Quý Đôn) là lỗi thật của trường: tiêu đề 14–18/9 nhưng cột ghi 8–12/9.
- [x] Migration `0004_public_post_links.sql`: key công khai đọc được link bài gốc, các cột riêng tư vẫn bị chặn.
- Quan sát cho thiết kế app: mầm non có 3 bữa (sáng/trưa/xế), tiểu học/THCS chủ yếu trưa + xế; nhiều trường đăng ảnh khay theo ngày; một số tài liệu có tên **đơn vị cung cấp suất ăn** (dùng cho hồ sơ nhà cung cấp ở v2).

---

## Phase 3: App mobile (Expo)

- [ ] Chọn trường (tìm theo tên/phường), lưu trên máy, không cần đăng nhập
- [ ] Màn "Hôm nay": thực đơn, ảnh khay (nếu trường có đăng), link bài gốc
- [ ] Lịch sử theo tuần
- [ ] Chi tiết dinh dưỡng ước tính + nhận xét AI
- [ ] Push thông báo buổi sáng (Expo Notifications)
- [ ] Màn "Trường của bạn chưa được hỗ trợ" + nút "Báo tôi khi có"
- [ ] Nút chia sẻ thực đơn hôm nay dạng ảnh (để phụ huynh tự lan truyền trong nhóm Zalo)
- [ ] Analytics (PostHog hoặc Firebase)

---

## Phase 4: Chatbot

- [ ] Supabase Edge Function giữ API key; app không bao giờ chứa key
- [ ] Đưa thẳng thực đơn 1–2 tuần của trường vào prompt (chưa cần RAG)
- [ ] Giới hạn khoảng 20 tin/ngày/thiết bị
- [ ] Câu hỏi gợi ý: "Hôm nay con ăn gì?", "Tối nay nên nấu gì để bù bữa trưa?", "Món này có tôm/đậu phộng không?"
- [ ] Quy tắc: chỉ trả lời về bữa ăn của trường đã chọn; không có dữ liệu thì nói không biết; câu về dị ứng thì nêu nguyên liệu tìm thấy, nhắc xác nhận lại với trường, không bao giờ khẳng định "an toàn"
- [ ] Bộ 20 câu hỏi test

---

## Phase 5: Hoàn thiện và nộp store

- [ ] Chính sách quyền riêng tư (bắt buộc)
- [ ] Icon, ảnh chụp màn hình, mô tả có từ khóa: "thực đơn bán trú", "bữa ăn học đường", "suất ăn trường học TP.HCM"
- [ ] Làm mờ mặt trẻ trong ảnh khay trước khi hiển thị
- [ ] Google Play: closed testing với nhóm tester (tài khoản cá nhân mới cần khoảng 12 tester trong 14 ngày, kiểm tra lại chính sách hiện hành)
- [ ] App Store: trong mô tả gửi duyệt, nhấn mạnh push, dinh dưỡng AI, chatbot (tránh bị coi là app "chỉ hiển thị lại website")

---

## Phase 6: Ra mắt và đo lường

- [ ] Đăng một lần vào nhóm phụ huynh của các phường có nhiều trường được hỗ trợ (Phú Thọ Hòa, Bình Phú, An Hội Đông, Hòa Hưng...)
- [ ] Theo dõi sau 4–6 tuần:
  - % người mở app ≥3 ngày/tuần (**chỉ số quan trọng nhất**)
  - % bấm vào thông báo buổi sáng
  - % dùng chatbot và họ hỏi gì
  - Trường nào được yêu cầu nhiều nhưng chưa hỗ trợ

---

## Backlog v2 (chỉ làm nếu v1 có người dùng đều)

- Ảnh khay ăn thực tế: đối chiếu với thực đơn (đã có khoảng 128 trường đăng, có thể đưa lên sớm hơn)
- Hồ sơ dị ứng cho từng con, cảnh báo khi thực đơn có nguyên liệu dị ứng
- Hồ sơ nhà cung cấp, hóa đơn (khi trường bắt đầu đăng)
- Phân tích chi phí/suất (nhạy cảm, trình bày trung lập, không phán xét)
- Mở rộng ngoài nền tảng Quảng Ích (trường tư, Facebook)

---

## Quyết định kỹ thuật

| Hạng mục | Chọn | Lý do |
|---|---|---|
| App | Expo (React Native) | 1 codebase cho iOS và Android, build qua EAS không cần máy Mac |
| Backend/DB | Supabase (Postgres, Storage, Edge Functions) | Không phải tự vận hành server, gói miễn phí đủ cho v1 |
| Crawler | Python 3.12 + httpx + BeautifulSoup, môi trường quản lý bằng **uv** (`pyproject.toml` ghim `==`, `uv.lock`), chạy bằng GitHub Actions | Không có server nào phải trông; cài đặt tái lập chính xác |
| AI (OCR, dinh dưỡng, chat) | **Gemini** (API key từ Google AI Studio), qua endpoint tương thích OpenAI | Đọc ảnh tiếng Việt tốt, có gói miễn phí. Có thể đổi sang DeepSeek bằng cấu hình |
| Push | Expo Notifications | Miễn phí, đơn giản |
| Analytics | PostHog hoặc Firebase | Gói miễn phí |

---

## Việc cần bạn làm

Những việc này cần tài khoản của bạn, mình không làm thay được:

| Việc | Khi nào cần | Ghi chú |
|---|---|---|
| ✅ Tạo API key Gemini tại Google AI Studio | Xong | Gói Google One/Google AI Pro **không** kèm API key; key tạo riêng, có gói miễn phí. Đặt vào `.env`: `GEMINI_API_KEY=...`, đừng dán vào chat |
| Đăng ký Apple Developer (~99 USD/năm) | **Ngay** | Xác minh có thể mất vài ngày đến vài tuần |
| Đăng ký Google Play Console (~25 USD một lần) | **Ngay** | Như trên |
| ✅ Tạo repo GitHub | Xong (`tnquoc/KSMeals`) | Để chạy GitHub Actions |
| ✅ Tạo project Supabase | Xong | Gói Free tự tạm dừng nếu không hoạt động ~1 tuần |
| Tài khoản Expo | Phase 3 | Miễn phí |
| Chuẩn bị khoảng 12 phụ huynh quen làm tester | Phase 5 | Cho Google Play closed testing |
| 1 máy Android + 1 iPhone để test | Phase 3 | Dùng app Expo Go |
