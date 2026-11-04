import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Alert, Text } from 'react-native';
import {
  Alan,
  Buton,
  Deger,
  Ekran,
  Ilerleme,
  Kart,
  ListeSatiri,
  Satir,
  Secenekler,
  TarihGezgini,
  renk,
} from '../../components/ui';
import { sayiOku } from '../../lib/calc';
import {
  gunEkle,
  gunlukToplam,
  ogunEkle,
  ogunleriGetir,
  ogunSil,
  profilGetir,
  sonDegerler,
  tarihGoster,
  tarihStr,
} from '../../lib/db';
import { gunlukHedefler } from '../../lib/hedef';
import { useVeri } from '../../lib/useVeri';

const OGUNLER = [
  { deger: 'Kahvaltı', ad: 'Kahvaltı' },
  { deger: 'Öğle', ad: 'Öğle' },
  { deger: 'Akşam', ad: 'Akşam' },
  { deger: 'Ara öğün', ad: 'Ara öğün' },
] as const;

function varsayilanOgun(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Kahvaltı';
  if (h < 16) return 'Öğle';
  if (h < 21) return 'Akşam';
  return 'Ara öğün';
}

export default function KaloriEkrani() {
  const [tarih, setTarih] = useState(tarihStr());
  const [ogun, setOgun] = useState<string>(varsayilanOgun());
  const [yemek, setYemek] = useState('');
  const [gram, setGram] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [karb, setKarb] = useState('');
  const [yag, setYag] = useState('');

  const yukle = useCallback(
    async (db: SQLiteDatabase) => {
      const [liste, toplam, profil, son] = await Promise.all([
        ogunleriGetir(db, tarih),
        gunlukToplam(db, tarih),
        profilGetir(db),
        sonDegerler(db),
      ]);
      return { liste, toplam, hedef: gunlukHedefler(profil, son.kilo) };
    },
    [tarih],
  );
  const { veri, yenile, db } = useVeri(yukle);

  async function ekle() {
    const k = sayiOku(kcal);
    if (!yemek.trim() || k == null || k < 0) {
      Alert.alert('Eksik bilgi', 'En az yemek adı ve kalori gir.');
      return;
    }
    await ogunEkle(db, {
      tarih,
      ogun,
      yemek: yemek.trim(),
      gram: sayiOku(gram),
      kcal: k,
      protein: sayiOku(protein) ?? 0,
      karb: sayiOku(karb) ?? 0,
      yag: sayiOku(yag) ?? 0,
      kaynak: 'elle',
    });
    setYemek('');
    setGram('');
    setKcal('');
    setProtein('');
    setKarb('');
    setYag('');
    yenile();
  }

  const bugun = tarihStr();
  const hedefKcal = veri?.hedef.kalori ?? null;

  return (
    <Ekran>
      <TarihGezgini
        metin={tarihGoster(tarih)}
        geri={() => setTarih(gunEkle(tarih, -1))}
        ileri={tarih < bugun ? () => setTarih(gunEkle(tarih, 1)) : undefined}
      />

      {veri && (
        <Kart baslik="Günlük toplam">
          <Satir>
            <Deger etiket="Kalori" deger={`${Math.round(veri.toplam.kcal)}`} alt={hedefKcal ? `/ ${hedefKcal} kcal` : 'kcal'} />
            <Deger etiket="P" deger={`${Math.round(veri.toplam.protein)}g`} />
            <Deger etiket="K" deger={`${Math.round(veri.toplam.karb)}g`} />
            <Deger etiket="Y" deger={`${Math.round(veri.toplam.yag)}g`} />
          </Satir>
          {hedefKcal ? <Ilerleme oran={veri.toplam.kcal / hedefKcal} /> : null}
        </Kart>
      )}

      <Buton baslik="📷 Fotoğrafla ekle" bas={() => router.push({ pathname: '/foto', params: { tarih } })} />

      <Kart baslik="Elle ekle">
        <Secenekler secenekler={OGUNLER} secili={ogun} sec={setOgun} />
        <Satir>
          <Alan etiket="Yemek" deger={yemek} degistir={setYemek} ipucu="Tavuk göğsü" klavye="default" genis={2} />
          <Alan etiket="Gram" deger={gram} degistir={setGram} ipucu="150" />
        </Satir>
        <Satir>
          <Alan etiket="Kalori" deger={kcal} degistir={setKcal} ipucu="kcal" />
          <Alan etiket="Protein" deger={protein} degistir={setProtein} ipucu="g" />
          <Alan etiket="Karb." deger={karb} degistir={setKarb} ipucu="g" />
          <Alan etiket="Yağ" deger={yag} degistir={setYag} ipucu="g" />
        </Satir>
        <Buton baslik="Ekle" bas={ekle} />
      </Kart>

      {veri &&
        OGUNLER.map(({ deger: ad }) => {
          const kalemler = veri.liste.filter((o) => o.ogun === ad);
          if (kalemler.length === 0) return null;
          const t = kalemler.reduce((a, o) => a + o.kcal, 0);
          return (
            <Kart key={ad} baslik={ad} sag={<Text style={{ color: renk.soluk }}>{Math.round(t)} kcal</Text>}>
              {kalemler.map((o) => (
                <ListeSatiri
                  key={o.id}
                  sol={o.yemek + (o.gram ? ` · ${o.gram} g` : '')}
                  alt={`P ${Math.round(o.protein)} · K ${Math.round(o.karb)} · Y ${Math.round(o.yag)}`}
                  sag={`${Math.round(o.kcal)}`}
                  sil={async () => {
                    await ogunSil(db, o.id);
                    yenile();
                  }}
                />
              ))}
            </Kart>
          );
        })}
    </Ekran>
  );
}
