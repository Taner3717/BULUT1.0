# Bulut 1.0

Windows 11 için **AirDrop benzeri** yerel ağ dosya paylaşımı.

- Aynı Wi-Fi / ağdaki Bulut çalışan bilgisayarları **otomatik bulur**.
- Dosyayı cihazın üstüne **sürükle-bırak** ya da tıklayıp seç.
- Alıcı tarafta **"Kabul et / Reddet"** penceresi çıkar (ses + bildirim).
- **Arka planda çalışır:** Windows açılınca gizlice başlar, saatin yanında bulut simgesi durur.
- Dosya isteği gelince **Windows bildirimi** çıkar; tıklayınca onay ekranı açılır.
- **Telefonlar** (iPhone / Android) uygulama kurmadan, **QR kodu okutup** tarayıcıdan bilgisayara dosya gönderebilir.
- Bilgisayardan telefona: "Telefonlara paylaş" listesine eklenen dosyalar telefondan indirilebilir.
- İnternet gerekmez. Dosyalar doğrudan cihazlar arasında, yerel ağ üzerinden aktarılır.
- Gelen dosyalar varsayılan olarak `İndirilenler\Bulut` klasörüne kaydedilir.

> Not: Apple'ın gerçek AirDrop'u Windows'ta bulunmayan özel bir kablosuz protokol kullanır. Bulut aynı deneyimi yerel ağ üzerinden sağlar. Cihazların **aynı ağa** bağlı olması gerekir.

## Kurulum (Windows 11)

1. **Python 3'ü kurun:** <https://www.python.org/downloads/>. Kurulumda **"Add python.exe to PATH"** kutusunu işaretleyin.
2. Bu depoyu indirin (GitHub'da **Code → Download ZIP**) ve bir klasöre çıkarın.
3. **`baslat.bat`** dosyasına çift tıklayın.
   - İlk seferde gerekli iki paket (`pystray`, `Pillow`) otomatik kurulur.
   - Tarayıcıda Bulut arayüzü açılır, saatin yanında (gerekirse `^` okunun altında) bulut simgesi belirir.
   - Bulut bundan sonra **Windows açılışında kendiliğinden** arka planda başlar.
4. Windows Güvenlik Duvarı izin isterse **"Özel ağlar"** için izin verin.
   - Pencere çıkmadıysa ya da cihazlar birbirini görmüyorsa: `guvenlik_duvari.bat` dosyasına sağ tıklayıp **Yönetici olarak çalıştır** seçin.
   - Ağ profilinin **Özel** olduğundan emin olun: *Ayarlar → Ağ ve İnternet → Wi-Fi → (ağınız) → Ağ profili türü: Özel*.

Diğer bilgisayarda da aynı adımları uygulayın. Birkaç saniye içinde iki bilgisayar birbirini "Yakındaki cihazlar" listesinde görür.

### Python'suz kullanım (tek dosya .exe)

Python kurulu bir bilgisayarda `exe_olustur.bat` dosyasını çalıştırın. Oluşan `dist\Bulut.exe` dosyası, Python kurulu olmayan Windows bilgisayarlara kopyalanıp doğrudan çalıştırılabilir.

### Arka planda çalışma ve otomatik başlatma

- Bulut konsol penceresi olmadan, bildirim alanındaki **bulut simgesiyle** çalışır.
  - **Sol tık:** arayüzü açar.
  - **Sağ tık:** *Bulut'u aç*, *Gelen dosyalar klasörü*, *Windows ile başlat*, *Çıkış*.
- Bekleyen bir dosya isteği varsa simgede **kırmızı nokta** görünür.
- Arayüz açık değilken bir istek gelirse **Windows bildirimi** çıkar. Tıklayınca onay ekranı açılır. Dosyalar alınınca da bildirim gelir.
- **Windows ile başlatma** ilk çalıştırmada açılır. Arayüzdeki "Windows açılışında başlat" kutusundan veya simge menüsünden kapatılabilir.
- Bulut klasörünü başka bir yere taşırsanız `baslat.bat`'ı bir kez yeniden çalıştırın, başlangıç kaydı yeni yere güncellenir.
- Sorun yaşarsanız `konsol_modu.bat` ile mesajları görebilirsiniz. Günlük dosyası: `%LOCALAPPDATA%\Bulut\bulut.log`.

## Kullanım

| İşlem | Nasıl |
|---|---|
| Bilgisayardan bilgisayara | "Yakındaki cihazlar"da cihaza tıklayın veya dosyaları üstüne sürükleyin. Karşı taraf kabul edince gönderim başlar. |
| Telefondan bilgisayara | Telefonla QR kodu okutun (veya ekrandaki `http://192.168.x.x:8765` adresini açın) → **Dosya seçin**. Bilgisayarda **Kabul et**'e basın. |
| Bilgisayardan telefona | **Telefonlara paylaş → + Dosya ekle**. Telefondaki Bulut sayfasında **İndir**'e basın. |
| Cihaz görünmüyorsa | **+ IP ile ekle** ile diğer bilgisayarın IP adresini girin (o bilgisayarın Bulut ekranında, "Telefonla bağlan" kutusunda yazar). |
| Kapatma | Saatin yanındaki bulut simgesine sağ tıklayın → **Çıkış**. |
| Onaysız alma | "Gelen dosyaları otomatik kabul et" kutusunu işaretleyin (sadece güvendiğiniz ağlarda). |

Komut satırı seçenekleri:

```
py bulut.py --name "Ofis PC" --folder "D:\Gelenler" --port 8765 --no-browser
py bulut.py --background   # tarayıcı açmadan arka planda başlat
py bulut.py --console      # simge olmadan konsolda çalıştır
```

## Teknik bilgi

- `bulut.py`: Sunucu. Yalnızca Python standart kütüphanesini kullanır.
- `bulut_windows.py`: Tepsi simgesi (`pystray`, `Pillow`), Windows bildirimi ve otomatik başlatma (`HKCU\...\Run` kaydı). Paketler yoksa Bulut konsol modunda çalışmaya devam eder.
- `static/index.html`: Arayüz. Bilgisayarda kontrol paneli, telefonda gönder/indir ekranı olarak açılır.
- Keşif: UDP **8766** portundan 3 saniyede bir yayın (broadcast) yapılır.
- Aktarım: HTTP, TCP **8765** portu. Dosyalar parça parça akıtılır, büyük dosyalar belleği doldurmaz.
- Güvenlik:
  - Dosya yüklenebilmesi için alıcının teklifi onaylaması gerekir.
  - Her teklif tahmin edilemez bir kimlik taşır. Dosya adı ve boyutu teklifle birebir eşleşmelidir.
  - Ayarlar ve onay işlemleri yalnızca bilgisayarın kendisinden (`localhost`) yapılabilir. Bu uçlar başka web sitelerinden gelen isteklere (CSRF / DNS rebinding) karşı korunur.
  - Dosya adları Windows için temizlenir (`..`, `:`, `CON` vb.).
  - Bağlantı şifrelenmez (HTTP). Bu yüzden Bulut'u yalnızca güvendiğiniz ev veya ofis ağlarında kullanın.
- Ayarlar: `%LOCALAPPDATA%\Bulut\config.json`
