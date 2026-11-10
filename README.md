# BULUT 1.0 — Koçluk Sistemi

Natürel vücut geliştirme hazırlığı için kişisel koçluk uygulaması. Günlük verileri toplar, haftalık
ortalamaları çıkarır ve kalori, makro, adım ve kardiyo hedefleri için kural tabanlı **koç kararları** üretir.
Kurulum gerektirmez, telefonda tarayıcıda çalışır. Veriler cihazın tarayıcısında saklanır.

## Çalıştırma

```bash
npm start          # http://localhost:8080
npm test           # koç motoru testleri
```

**Telefona kurma:** Uygulama PWA'dır. GitHub Pages gibi bir HTTPS adresinden açıp tarayıcı menüsünden
"Ana ekrana ekle" dersen uygulama gibi açılır ve ilk açılıştan sonra internetsiz de çalışır.

GitHub Pages ile de yayınlanabilir (statik dosyalar, derleme adımı yok).

## Ekranlar

| Ekran | İçerik |
|---|---|
| **Pano** | Bugünün özel günü (refeed, diyet molası, peak week), 7 günlük ortalama kilo, haftalık/toplam değişim, bel değişimi, yarışa kalan gün, uyum, toparlanma, kilo trendi grafiği, koç kararı |
| **Kayıt** | Günlük giriş: kilo, uyku, stres/enerji/açlık (1–10), adım, kardiyo, antrenman, FatSecret gün sonu makroları, not. Kayıttan sonra o günün etkin hedeflerine göre geri bildirim. Haftalık vücut ölçüleri (bel, kalça, göğüs, kol, bacak, yağ %), geçmiş kayıtlar |
| **İdman** | Hazır ya da kendi oluşturduğun programlar (program düzenleyici, kütüphaneye özel hareket ekleme), set/kilo/tekrar/RIR kaydı (taslak otomatik saklanır), bir sonraki seans için ağırlık önerisi, kas grubu başına haftalık hacim, hareket bazında kuvvet grafiği (e1RM), plato ve deload uyarıları |
| **İlerleme** | İlerleme fotoğrafları (ön, yan, arka, poz) ve iki tarihi yan yana karşılaştırma; haftalık özetler ve koç değerlendirmeleri |
| **Plan** | Diyet molası ve refeed takvimi (otomatik öneri), peak week planlayıcı |
| **Ayarlar** | Profil, yarış takvimi, hedef hız, günlük hedefler, hedef değişiklik geçmişi, JSON yedek, CSV dışa aktarma, Google Sheets'ten yapıştırarak/CSV ile içe aktarma |

## Koç karar motoru (`js/coach.js`)

Haftalar başlangıç tarihinden itibaren 7'şer günlük bloklardır. Karar, en az 4 tartısı olan son haftanın
ortalamasının önceki haftaya göre **yüzde değişimine** dayanır. Kurallar sırayla uygulanır:

1. **Veri yetersiz**: 4'ten az tartı ya da önceki hafta yoksa değişiklik yapılmaz.
2. **Uyum < %80**: hedefler değiştirilmez, önce plana uyum. Uyum günlük olarak kalori ±%7, protein ≥%90,
   adım ≥%90 (ve varsa kardiyo ≥%90) ile ölçülür.
3. **Peak week** (yarışa ≤7 gün): plan sabit tutulur, sert su/sodyum manipülasyonu önerilmez.
4. **Yarış sonrası**: reverse diet, haftalık +150 kcal.
5. **Hazırlık (cut)**:
   - Toparlanma skoru < 40 ve kayıp makulse: **refeed / diyet molası**.
   - Kayıp < hedefin yarısı ama **bel o hafta ≥0.5 cm inceldiyse**: değişiklik yok (rekompozisyon / su tutulumu).
   - Kayıp < hedefin yarısı: açık kadar kalori düşülür (100 kcal ile kalorinin %10'u arası). %75'i karbonhidrattan,
     %25'i yağdan alınır. Yağ 0.6 g/kg'ın, karbonhidrat 80 g'ın altına inmez. Kalan açık adım hedefiyle kapatılır.
     Protein sabit kalır.
   - Kayıp > hedefin 1.5 katı: kas koruma için +100–250 kcal karbonhidrat eklenir.
   - Arada ise plan aynen devam eder.
6. **Bulk / koruma**: ±150 / ±100 kcal ayarları.

Ek uyarılar: düşük uyku (<6.5 s), yüksek stres (≥7), düşük enerji (≤4), yüksek açlık (≥8), protein <2.0 g/kg,
yağ <0.6 g/kg, haftada %1.5'ten hızlı kayıp ve yarış tarihine göre gerekli hızın hedefin çok üstünde ya da
altında olması.

**Toparlanma skoru (0–100)**: uyku (5→8 saat), stres (ters), enerji ve açlık (ters, düşük ağırlık) ortalaması.

“Önerileri uygula” yeni hedefleri kaydeder ve değişikliği gerekçesiyle birlikte hedef geçmişine yazar.
“Check-in raporunu kopyala” haftalık özeti mesaj olarak paylaşılabilir metne çevirir.

> Bu sistem genel kurallara dayanan bir karar desteğidir. Tıbbi tavsiye yerine geçmez. Sağlık sorunlarında
> ve peak week uygulamalarında hekim ve koçla birlikte karar ver.

## Antrenman koçu (`js/training.js`)

- **Programlar**: full body (3 gün), üst/alt (4 gün), push/pull/legs (6 gün). Her hareketin set sayısı,
  tekrar aralığı ve hedef RIR'ı var. Sıradaki gün otomatik vurgulanır.
- **Çift ilerleme**: o ağırlıktaki tüm setler üst tekrara ulaştıysa ağırlık artar (bileşik hareketlerde +%2.5,
  en az 2.5 kg; izole hareketlerde +%5, en az 1 kg). Aralık içindeysen aynı ağırlıkla +1 tekrar hedeflenir.
  Alt tekrarın altında kalırsan ağırlık sabit kalır, bu iki seans üst üste olursa %5 azaltılır.
- **Plato**: bir hareketin son 3 seanstaki en iyi e1RM'i (Epley) önceki en iyisini geçmiyorsa plato sayılır.
- **Deload**: takip edilen hareketlerin en az %40'ı platodaysa ya da toparlanma skoru 40'ın altındayken en az iki
  hareket platodaysa deload haftası önerilir.
- **Program düzenleyici**: hazır programı kopyalayıp gün/hareket ekleyip çıkarabilir, set, tekrar aralığı ve
  RIR'ı değiştirebilirsin. Kütüphanede olmayan hareketleri kas grubu ve türüyle eklersin (hacim ve ilerleme
  hesaplarına dahil olur). Kaydetmeden önce program doğrulanır.
- **Hacim**: kas grubu başına haftalık zor set (RIR ≤ 4). Hedef aralık 10–20 set, yağ yakımı döneminde alt sınır 6.
  Deficit döneminde güçte %5'ten fazla düşüş varsa uyarı verilir.

Antrenman özeti Pano'daki koç kararına ve haftalık check-in raporuna da eklenir. Kaydedilen antrenman, o günün
günlük kaydını "antrenman yapıldı" olarak işaretler.

## Plan: diyet molası, refeed ve peak week (`js/plan.js`)

- **İdame kalorisi tahmini**: son 3 güvenilir haftada `ort. kalori − haftalık değişim × 7700 / 7`.
- **Refeed günü**: karbonhidrat idameye kadar (en az +%30, en fazla 2 katı) çıkar, yağ biraz düşer (≥0.6 g/kg).
- **Diyet molası**: kalori idameye çıkar (artışın %70'i karbonhidrat, %30'u yağ), kardiyo yarıya iner.
- **Otomatik öneri** (hazırlık dönemi): her 8 haftada bir 7 günlük diyet molası (yarışa 5 haftadan fazla varken)
  ve son 8 haftada haftada bir refeed günü. Var olan planla çakışmaz.
- Bu günlerde günlük geri bildirim ve haftalık uyum **o günün hedeflerine** göre hesaplanır. Diyet molası
  olan haftada ve sonraki haftada koç kalori kararı vermez (su/glikojen etkisi).
- **Peak week** (yarıştan önceki 6 gün + yarış günü), muhafazakâr yaklaşım:
  - Su (~0.05 L/kg, en az 3 L) ve sodyum her gün sabit; kesme yok, diüretik yok.
  - Yarıştan önceki 1–3 günde karbonhidrat yüklemesi (5–10 g/kg, varsayılan 2 gün × 7 g/kg), düşük yağ,
    düşük–orta lif. Yarış günü ~3 g/kg küçük öğünler.
  - Günlük antrenman planı (son bacak 5 gün kala), günlük kontrol listesi.
  - Sabah görünümüne göre ayar: düz → karbonhidrat +%25, taşmış/bulanık → −%40, dolu → değişiklik yok.
  - Peak week günlerinin hedefleri Pano ve Kayıt ekranlarına otomatik yansır.

## İlerleme fotoğrafları (`js/photos.js`)

Fotoğraflar uzun kenarı 1080 px olacak şekilde küçültülüp JPEG olarak **IndexedDB'de, yalnızca o cihazda**
saklanır (sunucuya gönderilmez, JSON yedeğe dahil değildir). Birden fazla fotoğraf seçildiğinde pozlar sırayla
atanır (ön → yan → arka → poz). Karşılaştırmada her fotoğrafın altında o tarihteki 7 günlük ortalama kilo görünür.

## Dosya yapısı

```
index.html        arayüz
css/style.css     stil (açık/koyu tema, mobil öncelikli)
js/coach.js       beslenme/kilo koç motoru (saf fonksiyonlar)
js/training.js    antrenman koçu: programlar, ilerleme, hacim, plato
js/plan.js        diyet molası/refeed takvimi, idame tahmini, peak week
js/photos.js      ilerleme fotoğrafları (IndexedDB)
js/storage.js     localStorage kalıcılığı
sw.js             çevrimdışı önbellek (PWA)
manifest.webmanifest, icons/  ana ekrana ekleme
js/app.js         ekranlar ve etkileşim
tests/            node:test testleri
```
