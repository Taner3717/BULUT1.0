# Bulut 1.0

iOS ve Android için kalori, kilo/vücut ölçüsü, uyku ve su takibi uygulaması.
Expo (React Native) + TypeScript ile yazıldı; tüm veriler telefonda SQLite'ta saklanır.
Tasarım: yeşil palet, otomatik karanlık mod (Profil → Görünüm'den Açık/Koyu seçilebilir), halkalı ana ekran.

## Özellikler (MVP)

| Sekme | Ne yapar |
|---|---|
| **Bugün** | Günlük kalori (alınan / hedef / kalan), makrolar, su, son uyku, kilo ve VKİ özeti |
| **Kalori** | Öğün bazlı yemek girişi (kcal, protein, karb., yağ, gram), gün gün geçmiş |
| **Kilo & Ölçü** | Kilo, bel, boyun, kalça, göğüs, kol, bacak; VKİ, yağ oranı (US Navy), yağsız kütle, bel/boy oranı, BMR, TDEE; kilo trendi |
| **Uyku** | Yatış/kalkış saati, süre (gece yarısını geçmeyi hesaplar), kalite, 7 günlük ortalama |
| **Su** | Hızlı ekleme (+200/+250/+500), kiloya göre hedef (35 ml/kg), zamanlı hatırlatıcı bildirimleri; bildirimdeki “+250 ml içtim” butonu suyu direkt kaydeder |
| **Profil** | Boy, yaş, cinsiyet, aktivite seviyesi, hedef (kilo ver / koru / al) |
| **Besin değerleri** | Kalorinin altında FatSecret tarzı tablo: sodyum (≤ 2000 mg) ve potasyum (≥ 3500 mg) öne çıkar; lif, şeker, doymuş yağ, kolesterol. Bilinmeyen değerler `*` ile işaretlenir |
| **Yiyecek arama** | 268 doğrulanmış yiyecek (USDA FoodData Central, Türkçe adlar, Türk porsiyonları) uygulamayla gelir; Türkçe karaktersiz de arar ("cig kofte"). Seçince gram yaz ya da porsiyon seç (ör. "1 orta boy · 118 g"), değerler dolar. Bulunamazsa **İnternette ara** ile Open Food Facts'te paketli ürünler (Eti, Ülker, İçim…). Kendi girdiğin yiyecekler de listeye eklenir |
| **📷 Fotoğrafla ekle** | Yemek fotoğrafı → her yiyecek için tahmini gram, kalori ve makro → gramı düzelt (değerler orantılı güncellenir) → öğüne kaydet |

Hesaplamalar: `src/lib/calc.ts` (Mifflin-St Jeor BMR, aktivite katsayılı TDEE, US Navy yağ oranı,
makro dağılımı: protein 1.8 g/kg, yağ %25, kalan karbonhidrat).

## Çalıştırma

```bash
npm install
npx expo start
```

Telefona **Expo Go** uygulamasını kur, terminaldeki QR kodu okut.
Yerel bildirimler (su hatırlatıcısı) ve fotoğraf seçimi Expo Go'da çalışır.

Kontroller:

```bash
npm test            # hesaplama testleri
npm run typecheck   # TypeScript
npx expo lint       # lint
```

## Fotoğraftan kalori kurulumu

Fotoğraf analizi Claude (Anthropic) ile yapılır. Güvenlik için API anahtarı **uygulamada değil**,
Supabase Edge Function'da (sunucuda) durur:

```
Telefon ──(anonim oturum + fotoğraf)──▶ Supabase Edge Function ──(gizli anahtar)──▶ Claude
                                         • kimlik doğrulama (JWT)
                                         • kişi başı günlük limit (varsayılan 30)
                                         • boyut/tür kontrolü
```

1. **Supabase projesi aç** (ücretsiz): https://supabase.com → New project.
2. **Anonim girişi aç:** Authentication → Sign In / Providers → *Allow anonymous sign-ins*.
3. **Anthropic API anahtarı al:** https://console.anthropic.com → API Keys. Aynı yerde aylık harcama limiti koy.
4. Proje klasöründe:
   ```bash
   npx supabase login
   npx supabase link --project-ref <proje-ref>        # Supabase URL'sindeki kısa kod
   npx supabase db push                                # günlük limit tablosu
   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   npx supabase functions deploy yemek-analiz
   ```
5. `.env.example` dosyasını `.env` olarak kopyala, Supabase → **Connect** ekranındaki URL ve
   *publishable key* değerlerini yaz, `npx expo start` ile yeniden başlat.

İsteğe bağlı: `npx supabase secrets set FOTO_GUNLUK_LIMIT=50` ile günlük limiti değiştir.

Maliyet: fotoğraf 1024 px'e küçültülüp gönderilir; analiz başına tahmini birkaç sent.

## FatSecret'ten aktarma

FatSecret → Raporlar → *Food Diary* PDF'ini indir, sonra:

```bash
pdftotext -layout FoodDiary.pdf diary.txt          # poppler-utils
python3 scripts/fatsecret_aktar.py diary.txt src/data/kisisel/fatsecret.json
```

Uygulama açılışta bu dosyadaki yiyecekleri **Yiyeceklerim**'e, günlük kayıtlarını ilgili günlere bir kez aktarır.
Betik her günün kalori toplamını PDF'teki toplamla karşılaştırır. `src/data/kisisel/fatsecret.json`
kişisel veridir; depo herkese açıksa commit etme.

## Besin veritabanı

Kaynaklar ve doğrulama: [`docs/besin-dogrulama.md`](docs/besin-dogrulama.md)

| Kaynak | Ne için | Lisans |
|---|---|---|
| USDA FoodData Central (Foundation, SR Legacy, FNDDS) | Genel yiyecekler ve yemekler, uygulamaya gömülü | Kamu malı |
| Open Food Facts | Paketli ürünler, internette arama (yalnız telefonda) | ODbL, kullanıcı katkılı |

Listeyi güncellemek: `scripts/besin_listesi.tsv`'ye satır ekle (Türkçe ad, kategori, USDA eşleşmesi, porsiyonlar), sonra
`scripts/usda_dizin.py` → `scripts/besin_eslestir.py <dizin.json> src/data/... ` → `scripts/besin_dogrula.py` çalıştır
ve `src/data/besinler-usda.json`'daki `surum`'u değiştir (uygulama yeni sürümü bir kez yükler).

## Klasör yapısı

```
src/
  app/                 Ekranlar (Expo Router)
    _layout.tsx        Veritabanı sağlayıcısı + bildirim dinleyici
    profil.tsx
    (tabs)/            index, kalori, olcum, uyku, su
  components/ui.tsx    Ortak arayüz bileşenleri
  lib/
    calc.ts            Vücut/beslenme formülleri (+ calc.test.ts)
    db.ts              SQLite tabloları ve sorgular
    hedef.ts           Günlük kalori/makro/su hedefleri
    tema.tsx           Açık/koyu renk paletleri ve tema seçimi
    notifications.ts   Su hatırlatıcısı
    supabase.ts        Anonim oturum + fotoğraf analizi çağrısı
supabase/
  functions/yemek-analiz/   Edge Function (Claude çağrısı, limit, doğrulama)
  migrations/               Günlük limit tablosu
```

## Yol haritası

- [x] **Fotoğraftan kalori** (Supabase + Claude)
- [ ] Barkod okuma / besin veritabanı (Open Food Facts)
- [ ] HealthKit / Health Connect'ten uyku ve adım (development build gerekir)
- [ ] Bulut yedekleme (Supabase / Firebase)
- [ ] Mağaza yayını (EAS Build)

> Bulut tıbbi tavsiye vermez; hesaplamalar genel formüllere dayalı tahminlerdir.
