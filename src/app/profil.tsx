import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert } from 'react-native';
import { Alan, Buton, Deger, Ekran, Kart, Satir, Secenekler, Soluk } from '../components/ui';
import { AKTIVITE_SEVIYELERI, HEDEFLER, sayiOku, type Cinsiyet } from '../lib/calc';
import { profilGetir, profilKaydet, sonDegerler, type Profil } from '../lib/db';
import { gunlukHedefler } from '../lib/hedef';

export default function ProfilEkrani() {
  const db = useSQLiteContext();
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
      <Kart baslik="Temel bilgiler">
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

      <Kart baslik="Aktivite seviyesi">
        <Secenekler secenekler={AKTIVITE_SEVIYELERI} secili={aktivite} sec={setAktivite} />
        <Soluk>{AKTIVITE_SEVIYELERI.find((a) => a.deger === aktivite)?.aciklama}</Soluk>
      </Kart>

      <Kart baslik="Hedef">
        <Secenekler secenekler={HEDEFLER} secili={hedefAyar} sec={setHedefAyar} />
        <Alan etiket="Hedef kilo (isteğe bağlı)" deger={hedefKilo} degistir={setHedefKilo} ipucu="75" />
      </Kart>

      <Kart baslik="Hesaplanan">
        {kilo == null ? (
          <Soluk>Hesaplama için "Kilo & Ölçü" sekmesinden kilonu gir.</Soluk>
        ) : (
          <Satir>
            <Deger etiket="BMR" deger={h.bmr ? `${h.bmr}` : '—'} alt="kcal" />
            <Deger etiket="TDEE" deger={h.tdee ? `${h.tdee}` : '—'} alt="kcal" />
            <Deger etiket="Günlük hedef" deger={h.kalori ? `${h.kalori}` : '—'} alt="kcal" />
          </Satir>
        )}
      </Kart>

      <Buton baslik="Kaydet" bas={kaydet} />
    </Ekran>
  );
}
