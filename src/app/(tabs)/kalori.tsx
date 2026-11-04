import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Alert, Text, View } from 'react-native';
import {
  Alan,
  Buton,
  Ekran,
  Etiket,
  Halka,
  Ikon,
  Ilerleme,
  Kart,
  ListeSatiri,
  Satir,
  Secenekler,
  TarihGezgini,
  type IkonAdi,
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
import { useRenk, type Renkler } from '../../lib/tema';
import { useVeri } from '../../lib/useVeri';

const OGUNLER = [
  { deger: 'Kahvaltı', ad: 'Kahvaltı' },
  { deger: 'Öğle', ad: 'Öğle' },
  { deger: 'Akşam', ad: 'Akşam' },
  { deger: 'Ara öğün', ad: 'Ara öğün' },
] as const;

function ogunIkonu(ogun: string, r: Renkler): { ikon: IkonAdi; renk: string } {
  switch (ogun) {
    case 'Kahvaltı':
      return { ikon: 'sunny', renk: r.protein };
    case 'Öğle':
      return { ikon: 'restaurant', renk: r.ana };
    case 'Akşam':
      return { ikon: 'moon', renk: r.uyku };
    default:
      return { ikon: 'cafe', renk: r.su };
  }
}

function varsayilanOgun(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Kahvaltı';
  if (h < 16) return 'Öğle';
  if (h < 21) return 'Akşam';
  return 'Ara öğün';
}

export default function KaloriEkrani() {
  const r = useRenk();
  const [tarih, setTarih] = useState(tarihStr());
  const [formAcik, setFormAcik] = useState(false);
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
  const hedef = veri?.hedef;
  const toplam = veri?.toplam;

  return (
    <Ekran>
      <TarihGezgini
        metin={tarihGoster(tarih)}
        geri={() => setTarih(gunEkle(tarih, -1))}
        ileri={tarih < bugun ? () => setTarih(gunEkle(tarih, 1)) : undefined}
      />

      {toplam && hedef && (
        <Kart>
          <Satir style={{ gap: 16 }}>
            <Halka oran={hedef.kalori ? toplam.kcal / hedef.kalori : 0} boyut={112} kalinlik={11}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: r.metin }}>{Math.round(toplam.kcal)}</Text>
              <Text style={{ fontSize: 11, color: r.soluk, fontWeight: '600' }}>
                {hedef.kalori ? `/ ${hedef.kalori}` : 'kcal'}
              </Text>
            </Halka>
            <View style={{ flex: 1, gap: 10 }}>
              {[
                { ad: 'Protein', d: toplam.protein, h: hedef.makro?.protein, c: r.protein },
                { ad: 'Karbonhidrat', d: toplam.karb, h: hedef.makro?.karb, c: r.su },
                { ad: 'Yağ', d: toplam.yag, h: hedef.makro?.yag, c: r.uyku },
              ].map((m) => (
                <View key={m.ad} style={{ gap: 4 }}>
                  <Satir style={{ justifyContent: 'space-between' }}>
                    <Etiket>{m.ad}</Etiket>
                    <Text style={{ fontSize: 12, color: r.metin, fontWeight: '700' }}>
                      {Math.round(m.d)}
                      {m.h ? ` / ${m.h}` : ''} g
                    </Text>
                  </Satir>
                  <Ilerleme oran={m.h ? m.d / m.h : 0} renkli={m.c} />
                </View>
              ))}
            </View>
          </Satir>
        </Kart>
      )}

      <Satir style={{ gap: 10 }}>
        <Buton baslik="Fotoğrafla ekle" ikon="camera" bas={() => router.push({ pathname: '/foto', params: { tarih } })} />
        <Buton
          baslik={formAcik ? 'Kapat' : 'Elle ekle'}
          ikon={formAcik ? 'close' : 'create-outline'}
          tur="ikincil"
          bas={() => setFormAcik((a) => !a)}
        />
      </Satir>

      {formAcik && (
        <Kart baslik="Elle ekle" ikon="create-outline">
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
          <Buton baslik="Ekle" ikon="add" bas={ekle} />
        </Kart>
      )}

      {veri && veri.liste.length === 0 && (
        <Kart>
          <View style={{ alignItems: 'center', gap: 8, paddingVertical: 12 }}>
            <Ikon ad="restaurant-outline" boyut={36} renk={r.soluk} />
            <Text style={{ color: r.soluk, fontSize: 14 }}>Bu gün için henüz yemek eklenmedi.</Text>
          </View>
        </Kart>
      )}

      {veri &&
        OGUNLER.map(({ deger: ad }) => {
          const kalemler = veri.liste.filter((o) => o.ogun === ad);
          if (kalemler.length === 0) return null;
          const t = kalemler.reduce((a, o) => a + o.kcal, 0);
          const { ikon, renk: ikonRenk } = ogunIkonu(ad, r);
          return (
            <Kart
              key={ad}
              baslik={ad}
              ikon={ikon}
              ikonRenk={ikonRenk}
              sag={<Text style={{ color: r.metin, fontWeight: '800' }}>{Math.round(t)} kcal</Text>}
            >
              {kalemler.map((o) => (
                <ListeSatiri
                  key={o.id}
                  sol={(o.kaynak === 'foto' ? '📷 ' : '') + o.yemek + (o.gram ? ` · ${o.gram} g` : '')}
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
