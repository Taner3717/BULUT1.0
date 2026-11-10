# BULUT 1.0 — Koçluk Sistemi

Natürel vücut geliştirme hazırlığı için kişisel koçluk uygulaması. Günlük verileri toplar, haftalık
ortalamaları çıkarır ve kalori, makro, adım ve kardiyo hedefleri için kural tabanlı **koç kararları** üretir.
Kurulum gerektirmez, telefonda tarayıcıda çalışır. Veriler cihazın tarayıcısında saklanır.

## Çalıştırma

```bash
npm start          # http://localhost:8080
npm test           # koç motoru testleri
```

GitHub Pages ile de yayınlanabilir (statik dosyalar, derleme adımı yok).

## Ekranlar

| Ekran | İçerik |
|---|---|
| **Pano** | 7 günlük ortalama kilo, haftalık/toplam değişim, yarışa kalan gün, uyum, toparlanma, kilo trendi grafiği, koç kararı |
| **Kayıt** | Günlük giriş: kilo, uyku, stres/enerji/açlık (1–10), adım, kardiyo, antrenman, FatSecret gün sonu makroları, not. Kayıttan sonra günlük geri bildirim |
| **Haftalar** | Her haftanın özeti ve o haftaya ait koç değerlendirmesi |
| **Geçmiş** | Tüm günlük kayıtlar, düzenleme |
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

## Dosya yapısı

```
index.html        arayüz
css/style.css     stil (açık/koyu tema, mobil öncelikli)
js/coach.js       koç motoru (saf fonksiyonlar)
js/storage.js     localStorage kalıcılığı
js/app.js         ekranlar ve etkileşim
tests/            node:test testleri
```
