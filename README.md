# vip.uzb — premium kiyimlar onlayn do'koni

Virtual kiyib ko'rish (AI), o'lcham tavsiyasi, savat, buyurtma va Telegram bot.
Netlify'da ishlaydi, kompyuter va telefonga moslashgan.

## Tuzilma

```
frontend/              ← SAYT (Netlify shu papkani chiqaradi)
  index.html           sahifa
  styles.css           dizayn (mobil + kompyuter)
  app.js               katalog, filtr, savat, buyurtma, kiyib ko'rish
  garments.js          kiyim rasmlari va tanaga joylash geometriyasi
  config.js            backend manzili

backend/               ← SERVER (Netlify Functions)
  functions/
    products.mjs       GET  /api/products
    orders.mjs         POST /api/orders         → bazaga yozadi + Telegramga yuboradi
    telegram.mjs       POST /api/telegram       → bot webhook (buyruqlar, tugmalar)
    telegram-setup.mjs GET  /api/telegram-setup → botni saytga ulash (bir marta)
    admin.mjs          GET  /api/admin/orders, /api/admin/stats
    health.mjs         GET  /api/health
  lib/db.mjs           ma'lumotlar bazasi (Netlify Blobs)
  lib/telegram.mjs     Telegram xabarlari va bot buyruqlari
  data/products.mjs    mahsulotlar katalogi (shu yerda tahrirlanadi)

netlify.toml           Netlify sozlamalari
```

## Ma'lumotlar bazasi

Netlify Blobs ishlatiladi (Netlify'ning ichki bazasi, alohida ro'yxatdan o'tish shart emas):

| Store       | Nima saqlanadi                                             |
|-------------|------------------------------------------------------------|
| `orders`    | Har bir buyurtma: mijoz, manzil, mahsulotlar, summa, holat |
| `customers` | Mijozlar (telefon bo'yicha): buyurtmalar soni, jami xarid  |
| `meta`      | Telegram adminlar ro'yxati                                 |

Ma'lumotlarni ko'rish: Netlify → loyiha → **Blobs** bo'limi, yoki
`https://SAYTINGIZ/api/admin/orders?key=ADMIN_PAROL`.

## Netlify'ga joylash (deploy)

> Backend funksiyalari bo'lgani uchun "drag & drop" usuli **ishlamaydi**. GitHub orqali joylang.

1. Loyihani GitHub'ga yuklang (`.env` fayli avtomatik yuklanmaydi — bu to'g'ri).
2. [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project** → GitHub repo'ni tanlang.
   Sozlamalar `netlify.toml` dan avtomatik olinadi, hech narsa o'zgartirmang.
3. **Site configuration → Environment variables** bo'limiga qo'shing:
   - `TELEGRAM_BOT_TOKEN` = bot tokeni
   - `ADMIN_PASSWORD` = o'zingiz o'ylab topgan murakkab parol
4. **Deploys → Trigger deploy** (o'zgaruvchilar kuchga kirishi uchun).
5. Botni saytga ulash — brauzerda bir marta oching:
   `https://SAYTINGIZ.netlify.app/api/telegram-setup?key=ADMIN_PAROL`
6. Telegramda **@vipuzz_bot** ga `/start` yozing. Birinchi yozgan odam avtomatik admin bo'ladi.
   Boshqa xodimlar `/login ADMIN_PAROL` yozib qo'shiladi.

Shundan keyin har bir buyurtma botga keladi. Xabar tagida holatni o'zgartirish tugmalari bo'ladi:
✅ Tasdiqlash · 🚚 Yuborildi · 📦 Yetkazildi · ❌ Bekor qilish.

### Bot buyruqlari (adminlar uchun)
`/orders` — oxirgi buyurtmalar · `/new` — yangilari · `/stats` — statistika ·
`/status KOD holat` — holatni o'zgartirish · `/stop` — xabarlarni o'chirish

## Lokal ishga tushirish (ixtiyoriy)

Node.js 18+ kerak:
```bash
npm install
npx netlify-cli dev      # http://localhost:8888
```
`.env` fayli lokal sinov uchun ishlatiladi.

## Mahsulot qo'shish

`backend/data/products.mjs` fayliga yangi obyekt qo'shing (`type`: tshirt, shirt, hoodie,
jacket, coat, dress, pants, jeans, skirt). GitHub'ga yuklasangiz, Netlify avtomatik yangilaydi.

## Virtual kiyib ko'rish qanday ishlaydi

1. Mijoz rasm yuklaydi yoki telefon kamerasi bilan suratga oladi.
2. Brauzerdagi MediaPipe Pose modeli yelka, son va to'piq nuqtalarini topadi.
3. Bo'y va vazn (va rasmdan o'lchangan yelka kengligi) asosida o'lcham tavsiya qilinadi.
4. Kiyim tanaga moslab kiydiriladi: kattaroq o'lcham erkinroq, kichigi torroq ko'rinadi.
5. Rasm serverga yuklanmaydi. Faqat mijoz rozilik belgisini qo'ysa, buyurtma bilan menejerga yuboriladi.

## Xavfsizlik

- Bot tokeni chatda ochiq yozilgan. Ishga tushirishdan oldin @BotFather → `/revoke` orqali
  yangi token oling va uni faqat Netlify Environment variables'ga yozing.
- Narxlar har doim serverdagi katalogdan hisoblanadi, brauzerdan kelgan narxga ishonilmaydi.
- Telegram webhook maxfiy kalit bilan himoyalangan.
