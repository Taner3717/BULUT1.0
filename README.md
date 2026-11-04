# Bulut 1.0

iOS ve Android için kalori, kilo/vücut ölçüsü, uyku ve su takibi uygulaması.
Expo (React Native) + TypeScript ile yazıldı; tüm veriler telefonda SQLite'ta saklanır.

## Özellikler (MVP)

| Sekme | Ne yapar |
|---|---|
| **Bugün** | Günlük kalori (alınan / hedef / kalan), makrolar, su, son uyku, kilo ve VKİ özeti |
| **Kalori** | Öğün bazlı yemek girişi (kcal, protein, karb., yağ, gram), gün gün geçmiş |
| **Kilo & Ölçü** | Kilo, bel, boyun, kalça, göğüs, kol, bacak; VKİ, yağ oranı (US Navy), yağsız kütle, bel/boy oranı, BMR, TDEE; kilo trendi |
| **Uyku** | Yatış/kalkış saati, süre (gece yarısını geçmeyi hesaplar), kalite, 7 günlük ortalama |
| **Su** | Hızlı ekleme (+200/+250/+500), kiloya göre hedef (35 ml/kg), zamanlı hatırlatıcı bildirimleri; bildirimdeki “+250 ml içtim” butonu suyu direkt kaydeder |
| **Profil** | Boy, yaş, cinsiyet, aktivite seviyesi, hedef (kilo ver / koru / al) |

Hesaplamalar: `src/lib/calc.ts` (Mifflin-St Jeor BMR, aktivite katsayılı TDEE, US Navy yağ oranı,
makro dağılımı: protein 1.8 g/kg, yağ %25, kalan karbonhidrat).

## Çalıştırma

```bash
npm install
npx expo start
```

Telefona **Expo Go** uygulamasını kur, terminaldeki QR kodu okut.
Yerel bildirimler (su hatırlatıcısı) Expo Go'da çalışır.

Kontroller:

```bash
npm test            # hesaplama testleri
npm run typecheck   # TypeScript
```

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
    notifications.ts   Su hatırlatıcısı
```

## Yol haritası

- [ ] **Fotoğraftan kalori:** fotoğraf → sunucu fonksiyonu → görsel yapay zekâ → yemek, gram, kalori ve makro tahmini → kullanıcı onayı → kayıt
- [ ] Barkod okuma / besin veritabanı (Open Food Facts)
- [ ] HealthKit / Health Connect'ten uyku ve adım (development build gerekir)
- [ ] Bulut yedekleme (Supabase / Firebase)
- [ ] Mağaza yayını (EAS Build)

> Bulut tıbbi tavsiye vermez; hesaplamalar genel formüllere dayalı tahminlerdir.
