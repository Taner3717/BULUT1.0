import { useCallback } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Buton, Deger, Ekran, Ilerleme, Kart, Satir, Soluk, renk } from '../../components/ui';
import { dkMetin, navyYagOrani, vki, vkiKategori, yuvarla } from '../../lib/calc';
import {
  ayarGetir,
  gunlukToplam,
  profilGetir,
  sonDegerler,
  suEkle,
  suToplam,
  tarihStr,
  uykulariGetir,
} from '../../lib/db';
import { gunlukHedefler } from '../../lib/hedef';
import { VARSAYILAN_SU_AYARI } from '../../lib/notifications';
import { useVeri } from '../../lib/useVeri';

async function yukle(db: SQLiteDatabase) {
  const bugun = tarihStr();
  const [profil, son, toplam, su, uykular, suAyari] = await Promise.all([
    profilGetir(db),
    sonDegerler(db),
    gunlukToplam(db, bugun),
    suToplam(db, bugun),
    uykulariGetir(db, 1),
    ayarGetir(db, 'su', VARSAYILAN_SU_AYARI),
  ]);
  return { profil, son, toplam, su, sonUyku: uykular[0] ?? null, hedef: gunlukHedefler(profil, son.kilo, suAyari.hedefMl) };
}

export default function Bugun() {
  const { veri, yenile, db } = useVeri(useCallback(yukle, []));
  if (!veri) return <Ekran>{null}</Ekran>;
  const { profil, son, toplam, su, sonUyku, hedef } = veri;

  const kalan = hedef.kalori != null ? hedef.kalori - toplam.kcal : null;
  const v = profil && son.kilo ? vki(son.kilo, profil.boy) : null;
  const yag =
    profil && son.bel && son.boyun ? navyYagOrani(profil.cinsiyet, profil.boy, son.bel, son.boyun, son.kalca) : null;

  return (
    <Ekran>
      {(!profil || !son.kilo) && (
        <Kart baslik="Hoş geldin 👋">
          <Soluk>
            Kalori ve su hedeflerini hesaplayabilmem için {!profil ? 'profilini (boy, yaş, cinsiyet, aktivite)' : ''}
            {!profil && !son.kilo ? ' ve ' : ''}
            {!son.kilo ? '"Kilo & Ölçü" sekmesinden kilonu' : ''} girmen gerekiyor.
          </Soluk>
          {!profil && (
            <Buton baslik="Profili doldur" bas={() => router.push('/profil')} />
          )}
        </Kart>
      )}

      <Kart baslik="Kalori">
        <Satir>
          <Deger etiket="Alınan" deger={`${Math.round(toplam.kcal)}`} alt="kcal" />
          <Deger etiket="Hedef" deger={hedef.kalori != null ? `${hedef.kalori}` : '—'} alt="kcal" />
          <Deger
            etiket="Kalan"
            deger={kalan != null ? `${Math.round(kalan)}` : '—'}
            alt="kcal"
            renkli={kalan != null && kalan < 0 ? renk.kirmizi : renk.yesil}
          />
        </Satir>
        {hedef.kalori != null && <Ilerleme oran={toplam.kcal / hedef.kalori} />}
        <Satir>
          <Deger
            etiket="Protein"
            deger={`${Math.round(toplam.protein)} g`}
            alt={hedef.makro ? `/ ${hedef.makro.protein} g` : undefined}
          />
          <Deger etiket="Karb." deger={`${Math.round(toplam.karb)} g`} alt={hedef.makro ? `/ ${hedef.makro.karb} g` : undefined} />
          <Deger etiket="Yağ" deger={`${Math.round(toplam.yag)} g`} alt={hedef.makro ? `/ ${hedef.makro.yag} g` : undefined} />
        </Satir>
      </Kart>

      <Kart baslik="Su">
        <Satir>
          <Deger etiket="İçilen" deger={`${(su / 1000).toFixed(2)} L`} alt={`Hedef ${(hedef.su / 1000).toFixed(1)} L`} />
        </Satir>
        <Ilerleme oran={su / hedef.su} renkli="#3FA9F5" />
        <Buton
          baslik="+250 ml"
          tur="ikincil"
          bas={async () => {
            await suEkle(db, 250);
            yenile();
          }}
        />
      </Kart>

      <Satir style={{ alignItems: 'stretch' }}>
        <View style={{ flex: 1 }}>
          <Kart baslik="Son uyku">
            <Deger
              etiket={sonUyku ? `${sonUyku.yatis} → ${sonUyku.kalkis}` : 'Kayıt yok'}
              deger={sonUyku ? dkMetin(sonUyku.sure_dk) : '—'}
              alt={sonUyku?.kalite ? `Kalite ${'★'.repeat(sonUyku.kalite)}` : undefined}
            />
          </Kart>
        </View>
        <View style={{ flex: 1 }}>
          <Kart baslik="Vücut">
            <Deger
              etiket="Kilo"
              deger={son.kilo ? `${yuvarla(son.kilo)} kg` : '—'}
              alt={v ? `VKİ ${yuvarla(v)} · ${vkiKategori(v)}` : undefined}
            />
            {yag != null && <Soluk>Yağ oranı ≈ %{yuvarla(yag)}</Soluk>}
          </Kart>
        </View>
      </Satir>

      {profil && (
        <Buton baslik="Profili düzenle" tur="ikincil" bas={() => router.push('/profil')} />
      )}
      <Soluk>Bulut tıbbi tavsiye vermez; hesaplamalar genel formüllere dayalı tahminlerdir.</Soluk>
    </Ekran>
  );
}
