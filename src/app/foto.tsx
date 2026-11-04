import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { ActivityIndicator, Alert, Image, Pressable, Text, TextInput, View } from 'react-native';
import { Alan, Buton, Deger, Ekran, Kart, Satir, Secenekler, Soluk, renk, s } from '../components/ui';
import { porsiyonOlcekle, sayiOku, type BesinKalemi } from '../lib/calc';
import { ogunEkle, tarihStr } from '../lib/db';
import { fotoAnalizEt, fotoAnalizHazir, type FotoAnalizSonucu } from '../lib/supabase';

const OGUNLER = ['Kahvaltı', 'Öğle', 'Akşam', 'Ara öğün'].map((o) => ({ deger: o, ad: o }));
const GUVEN: Record<FotoAnalizSonucu['guven'], { ad: string; renk: string }> = {
  yuksek: { ad: 'Yüksek', renk: renk.yesil },
  orta: { ad: 'Orta', renk: renk.turuncu },
  dusuk: { ad: 'Düşük', renk: renk.kirmizi },
};

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
    const r =
      kaynak === 'kamera'
        ? await ImagePicker.launchCameraAsync(secenek)
        : await ImagePicker.launchImageLibraryAsync(secenek);
    if (r.canceled || !r.assets?.[0]) return;
    setSonuc(null);
    setSatirlar([]);
    setGorsel(await hazirla(r.assets[0].uri));
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

  const hesaplanan = satirlar.map((r) => ({
    ...porsiyonOlcekle(r.taban, sayiOku(r.gram) ?? r.taban.gram),
    ad: r.ad.trim() || r.taban.ad,
  }));
  const toplam = hesaplanan.reduce(
    (a, y) => ({ kcal: a.kcal + y.kcal, protein: a.protein + y.protein, karb: a.karb + y.karb, yag: a.yag + y.yag }),
    { kcal: 0, protein: 0, karb: 0, yag: 0 },
  );

  async function kaydet() {
    for (const y of hesaplanan) {
      await ogunEkle(db, { tarih, ogun, yemek: y.ad, gram: y.gram, kcal: y.kcal, protein: y.protein, karb: y.karb, yag: y.yag, kaynak: 'foto' });
    }
    router.back();
  }

  if (!fotoAnalizHazir) {
    return (
      <Ekran>
        <Kart baslik="Kurulum gerekli">
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
      <Kart baslik="Fotoğraf">
        {gorsel ? (
          <Image source={{ uri: gorsel.uri }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 10 }} resizeMode="cover" />
        ) : (
          <Soluk>Tabağın tamamı görünecek şekilde, mümkünse üstten ve iyi ışıkta çek.</Soluk>
        )}
        <Satir>
          <Buton baslik="📷 Çek" tur="ikincil" bas={() => sec('kamera')} />
          <Buton baslik="🖼️ Galeriden" tur="ikincil" bas={() => sec('galeri')} />
        </Satir>
        {gorsel && !sonuc && (
          <>
            <Alan
              etiket="Not (isteğe bağlı)"
              deger={not}
              degistir={setNot}
              ipucu="ör. zeytinyağlı, yarısını yedim"
              klavye="default"
            />
            {yukleniyor ? (
              <Satir style={{ justifyContent: 'center', paddingVertical: 8 }}>
                <ActivityIndicator color={renk.ana} />
                <Soluk>Analiz ediliyor…</Soluk>
              </Satir>
            ) : (
              <Buton baslik="Kaloriyi hesapla" bas={analizEt} />
            )}
          </>
        )}
      </Kart>

      {sonuc && (
        <>
          <Kart
            baslik="Tahmin"
            sag={<Text style={{ color: GUVEN[sonuc.guven].renk, fontWeight: '600' }}>Güven: {GUVEN[sonuc.guven].ad}</Text>}
          >
            {sonuc.not ? <Soluk>{sonuc.not}</Soluk> : null}
            {satirlar.length === 0 && <Soluk>Fotoğrafta yiyecek bulunamadı.</Soluk>}
            {satirlar.map((r, i) => {
              const y = hesaplanan[i];
              return (
                <View key={i} style={{ gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: renk.cizgi }}>
                  <Satir>
                    <TextInput
                      style={[s.girdi, { flex: 1, minWidth: 0 }]}
                      value={r.ad}
                      onChangeText={(t) => setSatirlar((l) => l.map((x, j) => (j === i ? { ...x, ad: t } : x)))}
                    />
                    <TextInput
                      style={[s.girdi, { width: 72, textAlign: 'right' }]}
                      value={r.gram}
                      keyboardType="decimal-pad"
                      onChangeText={(t) => setSatirlar((l) => l.map((x, j) => (j === i ? { ...x, gram: t } : x)))}
                    />
                    <Text style={{ color: renk.soluk }}>g</Text>
                    <Pressable onPress={() => setSatirlar((l) => l.filter((_, j) => j !== i))} hitSlop={10}>
                      <Text style={{ color: renk.kirmizi, fontSize: 16 }}>✕</Text>
                    </Pressable>
                  </Satir>
                  <Soluk>
                    {y.kcal} kcal · P {y.protein} · K {y.karb} · Y {y.yag}
                  </Soluk>
                </View>
              );
            })}
          </Kart>

          {satirlar.length > 0 && (
            <Kart baslik="Toplam">
              <Satir>
                <Deger etiket="Kalori" deger={`${Math.round(toplam.kcal)}`} alt="kcal" />
                <Deger etiket="P" deger={`${Math.round(toplam.protein)}g`} />
                <Deger etiket="K" deger={`${Math.round(toplam.karb)}g`} />
                <Deger etiket="Y" deger={`${Math.round(toplam.yag)}g`} />
              </Satir>
              <Secenekler secenekler={OGUNLER} secili={ogun} sec={setOgun} />
              <Buton baslik="Onayla ve kaydet" bas={kaydet} />
              <Soluk>Fotoğraftan tahmin ±%20-30 sapabilir; gramajları kontrol edip düzelt.</Soluk>
            </Kart>
          )}
          <Buton baslik="Başka fotoğraf" tur="ikincil" bas={() => { setSonuc(null); setSatirlar([]); setGorsel(null); }} />
        </>
      )}
    </Ekran>
  );
}
