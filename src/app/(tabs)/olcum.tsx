import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Alert } from 'react-native';
import { Alan, Buton, Deger, Ekran, Kart, ListeSatiri, MiniGrafik, Satir, Soluk, renk } from '../../components/ui';
import { belBoyOrani, navyYagOrani, sayiOku, vki, vkiKategori, yagsizKutle, yuvarla } from '../../lib/calc';
import { olcumEkle, olcumleriGetir, olcumSil, profilGetir, sonDegerler, tarihGoster, tarihStr } from '../../lib/db';
import { gunlukHedefler } from '../../lib/hedef';
import { useVeri } from '../../lib/useVeri';

const ALANLAR = [
  { k: 'kilo', ad: 'Kilo (kg)' },
  { k: 'bel', ad: 'Bel (cm)' },
  { k: 'boyun', ad: 'Boyun (cm)' },
  { k: 'kalca', ad: 'Kalça (cm)' },
  { k: 'gogus', ad: 'Göğüs (cm)' },
  { k: 'kol', ad: 'Kol (cm)' },
  { k: 'bacak', ad: 'Bacak (cm)' },
] as const;
type AlanAdi = (typeof ALANLAR)[number]['k'];

const BOS: Record<AlanAdi, string> = { kilo: '', bel: '', boyun: '', kalca: '', gogus: '', kol: '', bacak: '' };

async function yukle(db: SQLiteDatabase) {
  const [profil, son, gecmis] = await Promise.all([profilGetir(db), sonDegerler(db), olcumleriGetir(db, 60)]);
  return { profil, son, gecmis };
}

export default function OlcumEkrani() {
  const { veri, yenile, db } = useVeri(useCallback(yukle, []));
  const [form, setForm] = useState(BOS);

  async function kaydet() {
    const sayilar = Object.fromEntries(ALANLAR.map(({ k }) => [k, sayiOku(form[k])])) as Record<AlanAdi, number | null>;
    if (Object.values(sayilar).every((v) => v == null)) {
      Alert.alert('Boş kayıt', 'En az bir ölçü gir.');
      return;
    }
    if (sayilar.kilo != null && (sayilar.kilo < 25 || sayilar.kilo > 350)) {
      Alert.alert('Kontrol et', 'Kilo değeri geçersiz görünüyor.');
      return;
    }
    await olcumEkle(db, { tarih: tarihStr(), ...sayilar });
    setForm(BOS);
    yenile();
  }

  if (!veri) return <Ekran>{null}</Ekran>;
  const { profil, son, gecmis } = veri;

  const kiloSerisi = gecmis
    .filter((o) => o.kilo != null)
    .map((o) => o.kilo as number)
    .slice(0, 30)
    .reverse();
  const ilkKilo = kiloSerisi[0];
  const degisim = son.kilo != null && ilkKilo != null ? son.kilo - ilkKilo : null;

  const v = profil && son.kilo ? vki(son.kilo, profil.boy) : null;
  const yag = profil && son.bel && son.boyun ? navyYagOrani(profil.cinsiyet, profil.boy, son.bel, son.boyun, son.kalca) : null;
  const bbo = profil && son.bel ? belBoyOrani(son.bel, profil.boy) : null;
  const h = gunlukHedefler(profil, son.kilo);

  return (
    <Ekran>
      <Kart baslik="Bugünkü ölçüm">
        <Satir style={{ flexWrap: 'wrap' }}>
          {ALANLAR.map(({ k, ad }) => (
            <Satir key={k} style={{ width: '47%' }}>
              <Alan
                etiket={ad}
                deger={form[k]}
                degistir={(t) => setForm((f) => ({ ...f, [k]: t }))}
                ipucu={son[k] != null ? `son: ${son[k]}` : undefined}
              />
            </Satir>
          ))}
        </Satir>
        <Buton baslik="Kaydet" bas={kaydet} />
        <Soluk>Yağ oranı için bel (göbek hizası) ve boyun ölçüsü gerekli; kadınlarda kalça da.</Soluk>
      </Kart>

      <Kart baslik="Hesaplanan değerler">
        {!profil ? (
          <>
            <Soluk>Hesaplamalar için önce profilini doldur.</Soluk>
            <Buton baslik="Profili doldur" tur="ikincil" bas={() => router.push('/profil')} />
          </>
        ) : (
          <>
            <Satir style={{ flexWrap: 'wrap' }}>
              <Deger etiket="VKİ" deger={v ? `${yuvarla(v)}` : '—'} alt={v ? vkiKategori(v) : undefined} />
              <Deger
                etiket="Yağ oranı"
                deger={yag != null ? `%${yuvarla(yag)}` : '—'}
                alt={yag != null && son.kilo ? `Yağsız ${yuvarla(yagsizKutle(son.kilo, yag))} kg` : 'US Navy'}
              />
              <Deger
                etiket="Bel / boy"
                deger={bbo ? `${yuvarla(bbo, 2)}` : '—'}
                alt={bbo ? (bbo < 0.5 ? 'İyi' : 'Riskli') : undefined}
                renkli={bbo ? (bbo < 0.5 ? renk.yesil : renk.turuncu) : undefined}
              />
            </Satir>
            <Satir>
              <Deger etiket="BMR" deger={h.bmr ? `${h.bmr}` : '—'} alt="kcal/gün" />
              <Deger etiket="TDEE" deger={h.tdee ? `${h.tdee}` : '—'} alt="kcal/gün" />
              <Deger etiket="Su hedefi" deger={`${(h.su / 1000).toFixed(1)} L`} />
            </Satir>
          </>
        )}
      </Kart>

      <Kart
        baslik="Kilo trendi"
        sag={
          degisim != null ? (
            <Soluk>
              {degisim > 0 ? '+' : ''}
              {yuvarla(degisim)} kg ({kiloSerisi.length} kayıt)
            </Soluk>
          ) : undefined
        }
      >
        <MiniGrafik degerler={kiloSerisi} />
        {profil?.hedef_kilo && son.kilo ? (
          <Soluk>
            Hedefe kalan: {yuvarla(Math.abs(son.kilo - profil.hedef_kilo))} kg (hedef {profil.hedef_kilo} kg)
          </Soluk>
        ) : null}
      </Kart>

      {gecmis.length > 0 && (
        <Kart baslik="Geçmiş">
          {gecmis.slice(0, 20).map((o) => (
            <ListeSatiri
              key={o.id}
              sol={tarihGoster(o.tarih)}
              alt={ALANLAR.filter(({ k }) => k !== 'kilo' && o[k] != null)
                .map(({ k }) => `${k} ${o[k]}`)
                .join(' · ')}
              sag={o.kilo != null ? `${o.kilo} kg` : undefined}
              sil={async () => {
                await olcumSil(db, o.id);
                yenile();
              }}
            />
          ))}
        </Kart>
      )}
    </Ekran>
  );
}
