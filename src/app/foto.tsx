import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { ActivityIndicator, Alert, Image, Pressable, Text, View } from 'react-native';
import { Alan, Buton, Ekran, Etiket, Girdi, Ikon, Kart, Satir, Secenekler, Soluk } from '../components/ui';
import { porsiyonOlcekle, sayiOku, type BesinKalemi } from '../lib/calc';
import { ogunEkle, tarihStr } from '../lib/db';
import { fotoAnalizEt, fotoAnalizHazir, type FotoAnalizSonucu } from '../lib/supabase';
import { useRenk, type Renkler } from '../lib/tema';

const OGUNLER = ['Kahvaltı', 'Öğle', 'Akşam', 'Ara öğün'].map((o) => ({ deger: o, ad: o }));

function guvenBilgisi(g: FotoAnalizSonucu['guven'], r: Renkler) {
  if (g === 'yuksek') return { ad: 'Yüksek güven', renk: r.anaKoyu, arka: r.anaAcik };
  if (g === 'orta') return { ad: 'Orta güven', renk: r.turuncu, arka: r.turuncu + '22' };
  return { ad: 'Düşük güven', renk: r.kirmizi, arka: r.kirmiziAcik };
}

type Satiri = { taban: BesinKalemi; ad: string; gram: string };

function varsayilanOgun() {
  const h = new Date().getHours();
  return h < 11 ? 'Kahvaltı' : h < 16 ? 'Öğle' : h < 21 ? 'Akşam' : 'Ara öğün';
}

/** Görseli 1024 px'e küçültüp JPEG base64'e çevirir (daha hızlı yükleme, daha düşük maliyet). */
async function hazirla(uri: string) {
  const ctx = ImageManipulator.manipulate(uri).resize({ width: 1024 });
  const img = await ctx.renderAsync();
  const sonuc = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  return { uri: sonuc.uri, base64: sonuc.base64 ?? '' };
}

export default function FotoEkrani() {
  const db = useSQLiteContext();
  const r = useRenk();
  const params = useLocalSearchParams<{ tarih?: string }>();
  const tarih = params.tarih ?? tarihStr();

  const [gorsel, setGorsel] = useState<{ uri: string; base64: string } | null>(null);
  const [not, setNot] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);
  const [sonuc, setSonuc] = useState<FotoAnalizSonucu | null>(null);
  const [satirlar, setSatirlar] = useState<Satiri[]>([]);
  const [ogun, setOgun] = useState(varsayilanOgun());

  async function sec(kaynak: 'kamera' | 'galeri') {
    const izin =
      kaynak === 'kamera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!izin.granted) {
      Alert.alert('İzin gerekli', kaynak === 'kamera' ? 'Kamera izni ver.' : 'Fotoğraf erişim izni ver.');
      return;
    }
    const secenek: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
    const sonucSec =
      kaynak === 'kamera'
        ? await ImagePicker.launchCameraAsync(secenek)
        : await ImagePicker.launchImageLibraryAsync(secenek);
    if (sonucSec.canceled || !sonucSec.assets?.[0]) return;
    setSonuc(null);
    setSatirlar([]);
    setGorsel(await hazirla(sonucSec.assets[0].uri));
  }

  async function analizEt() {
    if (!gorsel) return;
    setYukleniyor(true);
    try {
      const s = await fotoAnalizEt(gorsel.base64, 'image/jpeg', not.trim());
      setSonuc(s);
      setSatirlar(s.yemekler.map((y) => ({ taban: y, ad: y.ad, gram: String(Math.round(y.gram)) })));
    } catch (e) {
      Alert.alert('Analiz yapılamadı', e instanceof Error ? e.message : String(e));
    } finally {
      setYukleniyor(false);
    }
  }

  function sifirla() {
    setSonuc(null);
    setSatirlar([]);
    setGorsel(null);
    setNot('');
  }

  const hesaplanan = satirlar.map((s) => ({
    ...porsiyonOlcekle(s.taban, sayiOku(s.gram) ?? s.taban.gram),
    ad: s.ad.trim() || s.taban.ad,
  }));
  const toplam = hesaplanan.reduce(
    (a, y) => ({
      kcal: a.kcal + y.kcal,
      protein: a.protein + y.protein,
      karb: a.karb + y.karb,
      yag: a.yag + y.yag,
      sodyum: a.sodyum + (y.sodyum ?? 0),
      potasyum: a.potasyum + (y.potasyum ?? 0),
    }),
    { kcal: 0, protein: 0, karb: 0, yag: 0, sodyum: 0, potasyum: 0 },
  );

  async function kaydet() {
    for (const y of hesaplanan) {
      await ogunEkle(db, {
        tarih,
        ogun,
        yemek: y.ad,
        gram: y.gram,
        kcal: y.kcal,
        protein: y.protein,
        karb: y.karb,
        yag: y.yag,
        sodyum: y.sodyum ?? null,
        potasyum: y.potasyum ?? null,
        lif: y.lif ?? null,
        seker: y.seker ?? null,
        doymus: y.doymus ?? null,
        kolesterol: y.kolesterol ?? null,
        kaynak: 'foto',
      });
    }
    router.back();
  }

  if (!fotoAnalizHazir) {
    return (
      <Ekran>
        <Kart baslik="Kurulum gerekli" ikon="construct" ikonRenk={r.turuncu}>
          <Soluk>
            Fotoğraf analizi için Supabase bağlantısı ayarlanmamış. Proje kökündeki .env dosyasına
            EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY değerlerini ekle (README’deki adımlar).
          </Soluk>
        </Kart>
      </Ekran>
    );
  }

  return (
    <Ekran>
      {!gorsel ? (
        <Pressable
          onPress={() => sec('kamera')}
          style={{
            aspectRatio: 4 / 3,
            borderRadius: 24,
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: r.ana,
            backgroundColor: r.anaAcik,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: 20,
          }}
        >
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: r.ana, alignItems: 'center', justifyContent: 'center' }}>
            <Ikon ad="camera" boyut={34} renk={r.anaYazi} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '800', color: r.metin }}>Tabağının fotoğrafını çek</Text>
          <Text style={{ fontSize: 13, color: r.soluk, textAlign: 'center' }}>
            Tabağın tamamı görünsün; üstten ve iyi ışıkta çekersen tahmin daha doğru olur.
          </Text>
        </Pressable>
      ) : (
        <View style={{ borderRadius: 24, overflow: 'hidden' }}>
          <Image source={{ uri: gorsel.uri }} style={{ width: '100%', aspectRatio: 4 / 3 }} resizeMode="cover" />
          {yukleniyor && (
            <View
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.45)',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              <ActivityIndicator color="#fff" size="large" />
              <Text style={{ color: '#fff', fontWeight: '700' }}>Yemekler tanınıyor…</Text>
            </View>
          )}
        </View>
      )}

      <Satir style={{ gap: 10 }}>
        <Buton baslik="Çek" ikon="camera-outline" tur="ikincil" bas={() => sec('kamera')} />
        <Buton baslik="Galeriden" ikon="images-outline" tur="ikincil" bas={() => sec('galeri')} />
      </Satir>

      {gorsel && !sonuc && !yukleniyor && (
        <Kart>
          <Alan etiket="Not (isteğe bağlı)" deger={not} degistir={setNot} ipucu="ör. zeytinyağlı, yarısını yedim" klavye="default" />
          <Buton baslik="Kaloriyi hesapla" ikon="sparkles" bas={analizEt} />
        </Kart>
      )}

      {sonuc && (
        <>
          <Kart
            baslik="Bulunan yiyecekler"
            ikon="restaurant"
            sag={(() => {
              const g = guvenBilgisi(sonuc.guven, r);
              return (
                <View style={{ backgroundColor: g.arka, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: g.renk, fontWeight: '700', fontSize: 12 }}>{g.ad}</Text>
                </View>
              );
            })()}
          >
            {sonuc.not ? (
              <Satir style={{ alignItems: 'flex-start' }}>
                <Ikon ad="information-circle" boyut={18} renk={r.soluk} />
                <View style={{ flex: 1 }}>
                  <Soluk>{sonuc.not}</Soluk>
                </View>
              </Satir>
            ) : null}
            {satirlar.length === 0 && <Soluk>Fotoğrafta yiyecek bulunamadı.</Soluk>}
            {satirlar.map((s, i) => {
              const y = hesaplanan[i];
              return (
                <View key={i} style={{ gap: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: r.cizgi }}>
                  <Satir>
                    <Girdi
                      style={{ flex: 1, fontWeight: '600' }}
                      value={s.ad}
                      onChangeText={(t) => setSatirlar((l) => l.map((x, j) => (j === i ? { ...x, ad: t } : x)))}
                    />
                    <Girdi
                      style={{ width: 72, textAlign: 'right' }}
                      value={s.gram}
                      keyboardType="decimal-pad"
                      onChangeText={(t) => setSatirlar((l) => l.map((x, j) => (j === i ? { ...x, gram: t } : x)))}
                    />
                    <Text style={{ color: r.soluk }}>g</Text>
                    <Pressable onPress={() => setSatirlar((l) => l.filter((_, j) => j !== i))} hitSlop={10}>
                      <Ikon ad="trash-outline" boyut={18} renk={r.kirmizi} />
                    </Pressable>
                  </Satir>
                  <Satir style={{ gap: 12 }}>
                    <Text style={{ color: r.metin, fontWeight: '800' }}>{y.kcal} kcal</Text>
                    <Soluk>
                      P {y.protein} · K {y.karb} · Y {y.yag}
                      {y.sodyum != null ? ` · Na ${Math.round(y.sodyum)} mg` : ''}
                    </Soluk>
                  </Satir>
                </View>
              );
            })}
          </Kart>

          {satirlar.length > 0 && (
            <Kart>
              <Satir style={{ justifyContent: 'space-between' }}>
                <View>
                  <Etiket>TOPLAM</Etiket>
                  <Text style={{ fontSize: 30, fontWeight: '800', color: r.metin }}>
                    {Math.round(toplam.kcal)}
                    <Text style={{ fontSize: 15, color: r.soluk }}> kcal</Text>
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: r.protein, fontWeight: '700' }}>P {Math.round(toplam.protein)} g</Text>
                  <Text style={{ color: r.su, fontWeight: '700' }}>K {Math.round(toplam.karb)} g</Text>
                  <Text style={{ color: r.uyku, fontWeight: '700' }}>Y {Math.round(toplam.yag)} g</Text>
                </View>
              </Satir>
              <Satir style={{ gap: 10 }}>
                <View style={{ flex: 1, backgroundColor: r.kartIkincil, borderRadius: 12, padding: 10 }}>
                  <Etiket>SODYUM</Etiket>
                  <Text style={{ fontSize: 17, fontWeight: '800', color: r.metin }}>{Math.round(toplam.sodyum)} mg</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: r.kartIkincil, borderRadius: 12, padding: 10 }}>
                  <Etiket>POTASYUM</Etiket>
                  <Text style={{ fontSize: 17, fontWeight: '800', color: r.metin }}>{Math.round(toplam.potasyum)} mg</Text>
                </View>
              </Satir>
              <Etiket>ÖĞÜN</Etiket>
              <Secenekler secenekler={OGUNLER} secili={ogun} sec={setOgun} />
              <Buton baslik="Onayla ve kaydet" ikon="checkmark-circle" bas={kaydet} />
              <Soluk>Fotoğraftan tahmin ±%20-30 sapabilir; gramajları kontrol edip düzelt.</Soluk>
            </Kart>
          )}
          <Buton baslik="Başka fotoğraf" ikon="refresh" tur="ikincil" bas={sifirla} />
        </>
      )}
    </Ekran>
  );
}
