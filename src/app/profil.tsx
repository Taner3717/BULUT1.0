import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert, Pressable, Text, View } from 'react-native';
import { Alan, Buton, Ekran, Etiket, Ikon, Kart, Satir, Secenekler, Soluk, type IkonAdi } from '../components/ui';
import { AKTIVITE_SEVIYELERI, HEDEFLER, sayiOku, type Cinsiyet } from '../lib/calc';
import { profilGetir, profilKaydet, sonDegerler, type Profil } from '../lib/db';
import { gunlukHedefler } from '../lib/hedef';
import { useRenk, useTema, type GorunumModu } from '../lib/tema';

const GORUNUMLER: { deger: GorunumModu; ad: string; ikon: IkonAdi }[] = [
  { deger: 'otomatik', ad: 'Otomatik', ikon: 'phone-portrait-outline' },
  { deger: 'acik', ad: 'Açık', ikon: 'sunny-outline' },
  { deger: 'koyu', ad: 'Koyu', ikon: 'moon-outline' },
];

export default function ProfilEkrani() {
  const db = useSQLiteContext();
  const r = useRenk();
  const { mod, modDegistir } = useTema();
  const [boy, setBoy] = useState('');
  const [yas, setYas] = useState('');
  const [cinsiyet, setCinsiyet] = useState<Cinsiyet>('erkek');
  const [aktivite, setAktivite] = useState<number>(1.375);
  const [hedefAyar, setHedefAyar] = useState<number>(0);
  const [hedefKilo, setHedefKilo] = useState('');
  const [kilo, setKilo] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const [p, son] = await Promise.all([profilGetir(db), sonDegerler(db)]);
      setKilo(son.kilo);
      if (!p) return;
      setBoy(String(p.boy));
      setYas(String(p.yas));
      setCinsiyet(p.cinsiyet);
      setAktivite(p.aktivite);
      setHedefAyar(p.hedef_ayar);
      setHedefKilo(p.hedef_kilo ? String(p.hedef_kilo) : '');
    })();
  }, [db]);

  const boyN = sayiOku(boy);
  const yasN = sayiOku(yas);
  const gecerli = boyN != null && boyN > 100 && boyN < 250 && yasN != null && yasN >= 10 && yasN < 110;
  const taslak: Profil | null = gecerli
    ? { boy: boyN, yas: Math.round(yasN), cinsiyet, aktivite, hedef_ayar: hedefAyar, hedef_kilo: sayiOku(hedefKilo) }
    : null;
  const h = gunlukHedefler(taslak, kilo);

  async function kaydet() {
    if (!taslak) {
      Alert.alert('Eksik bilgi', 'Boy (cm) ve yaş değerlerini kontrol et.');
      return;
    }
    await profilKaydet(db, taslak);
    router.back();
  }

  return (
    <Ekran>
      <Kart baslik="Temel bilgiler" ikon="person">
        <Satir>
          <Alan etiket="Boy (cm)" deger={boy} degistir={setBoy} ipucu="178" />
          <Alan etiket="Yaş" deger={yas} degistir={setYas} ipucu="30" klavye="number-pad" />
        </Satir>
        <Secenekler
          secenekler={[
            { deger: 'erkek', ad: 'Erkek' },
            { deger: 'kadin', ad: 'Kadın' },
          ]}
          secili={cinsiyet}
          sec={setCinsiyet}
        />
      </Kart>

      <Kart baslik="Aktivite seviyesi" ikon="walk" ikonRenk={r.uyku}>
        <Secenekler secenekler={AKTIVITE_SEVIYELERI} secili={aktivite} sec={setAktivite} />
        <Soluk>{AKTIVITE_SEVIYELERI.find((a) => a.deger === aktivite)?.aciklama}</Soluk>
      </Kart>

      <Kart baslik="Hedef" ikon="flag" ikonRenk={r.protein}>
        <Secenekler secenekler={HEDEFLER} secili={hedefAyar} sec={setHedefAyar} />
        <Alan etiket="Hedef kilo (isteğe bağlı)" deger={hedefKilo} degistir={setHedefKilo} ipucu="75" />
      </Kart>

      <Kart baslik="Günlük ihtiyacın" ikon="calculator" ikonRenk={r.kirmizi}>
        {kilo == null ? (
          <Soluk>Hesaplama için “Vücut” sekmesinden kilonu gir.</Soluk>
        ) : (
          <Satir>
            {[
              { e: 'BMR', d: h.bmr },
              { e: 'TDEE', d: h.tdee },
              { e: 'HEDEF', d: h.kalori },
            ].map((x, i) => (
              <View
                key={x.e}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 10,
                  borderRadius: 14,
                  backgroundColor: i === 2 ? r.anaAcik : r.kartIkincil,
                }}
              >
                <Etiket>{x.e}</Etiket>
                <Text style={{ fontSize: 20, fontWeight: '800', color: i === 2 ? r.anaKoyu : r.metin }}>{x.d ?? '—'}</Text>
                <Soluk>kcal</Soluk>
              </View>
            ))}
          </Satir>
        )}
      </Kart>

      <Buton baslik="Kaydet" ikon="checkmark" bas={kaydet} />

      <Kart baslik="Görünüm" ikon="color-palette" ikonRenk={r.su}>
        <Satir style={{ gap: 10 }}>
          {GORUNUMLER.map((g) => {
            const aktif = g.deger === mod;
            return (
              <Pressable
                key={g.deger}
                onPress={() => modDegistir(g.deger)}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  gap: 6,
                  paddingVertical: 12,
                  borderRadius: 14,
                  borderWidth: 2,
                  borderColor: aktif ? r.ana : r.cizgi,
                  backgroundColor: aktif ? r.anaAcik : r.girdiArka,
                }}
              >
                <Ikon ad={g.ikon} boyut={22} renk={aktif ? r.anaKoyu : r.soluk} />
                <Text style={{ fontWeight: '700', color: aktif ? r.anaKoyu : r.metin }}>{g.ad}</Text>
              </Pressable>
            );
          })}
        </Satir>
        <Soluk>Otomatik: telefonun karanlık mod ayarını takip eder.</Soluk>
      </Kart>
    </Ekran>
  );
}
