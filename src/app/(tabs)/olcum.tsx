import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Alert, Text, View } from 'react-native';
import {
  Alan,
  Buton,
  Ekran,
  Etiket,
  IkonKutu,
  Kart,
  ListeSatiri,
  CizgiGrafik,
  Satir,
  Soluk,
  type IkonAdi,
} from '../../components/ui';
import { belBoyOrani, navyYagOrani, sayiOku, vki, vkiKategori, yagsizKutle, yuvarla } from '../../lib/calc';
import { olcumEkle, olcumleriGetir, olcumSil, profilGetir, sonDegerler, tarihGoster, tarihStr } from '../../lib/db';
import { gunlukHedefler } from '../../lib/hedef';
import { useRenk } from '../../lib/tema';
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

function Karo({ ikon, renk, etiket, deger, alt }: { ikon: IkonAdi; renk: string; etiket: string; deger: string; alt?: string }) {
  const r = useRenk();
  return (
    <View
      style={{
        width: '48%',
        flexGrow: 1,
        backgroundColor: r.kartIkincil,
        borderRadius: 16,
        padding: 12,
        gap: 8,
      }}
    >
      <Satir>
        <IkonKutu ad={ikon} renk={renk} boyut={28} />
        <Etiket>{etiket}</Etiket>
      </Satir>
      <Text style={{ fontSize: 22, fontWeight: '800', color: r.metin }}>{deger}</Text>
      {alt ? <Soluk>{alt}</Soluk> : null}
    </View>
  );
}

export default function OlcumEkrani() {
  const r = useRenk();
  const { veri, yenile, db } = useVeri(useCallback((d: SQLiteDatabase) => yukle(d), []));
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
  const degisim = son.kilo != null && ilkKilo != null && kiloSerisi.length > 1 ? son.kilo - ilkKilo : null;

  const v = profil && son.kilo ? vki(son.kilo, profil.boy) : null;
  const yag = profil && son.bel && son.boyun ? navyYagOrani(profil.cinsiyet, profil.boy, son.bel, son.boyun, son.kalca) : null;
  const bbo = profil && son.bel ? belBoyOrani(son.bel, profil.boy) : null;
  const h = gunlukHedefler(profil, son.kilo);

  return (
    <Ekran>
      <Kart
        baslik="Kilo"
        ikon="scale"
        sag={
          degisim != null ? (
            <View
              style={{
                backgroundColor: degisim <= 0 ? r.anaAcik : r.kirmiziAcik,
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <Text style={{ color: degisim <= 0 ? r.anaKoyu : r.kirmizi, fontWeight: '700', fontSize: 13 }}>
                {degisim > 0 ? '+' : ''}
                {yuvarla(degisim)} kg
              </Text>
            </View>
          ) : undefined
        }
      >
        <Text style={{ fontSize: 40, fontWeight: '800', color: r.metin }}>
          {son.kilo ? yuvarla(son.kilo) : '—'}
          <Text style={{ fontSize: 18, color: r.soluk, fontWeight: '600' }}> kg</Text>
        </Text>
        <CizgiGrafik degerler={kiloSerisi} />
        {profil?.hedef_kilo && son.kilo ? (
          <Soluk>
            Hedef {profil.hedef_kilo} kg · kalan {yuvarla(Math.abs(son.kilo - profil.hedef_kilo))} kg
          </Soluk>
        ) : null}
      </Kart>

      {!profil ? (
        <Kart baslik="Hesaplamalar" ikon="calculator">
          <Soluk>VKİ, yağ oranı ve kalori ihtiyacı için önce profilini doldur.</Soluk>
          <Buton baslik="Profili doldur" ikon="arrow-forward" tur="ikincil" bas={() => router.push('/profil')} />
        </Kart>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Karo ikon="body" renk={r.ana} etiket="VKİ" deger={v ? `${yuvarla(v)}` : '—'} alt={v ? vkiKategori(v) : 'kilo gir'} />
          <Karo
            ikon="water"
            renk={r.protein}
            etiket="YAĞ ORANI"
            deger={yag != null ? `%${yuvarla(yag)}` : '—'}
            alt={yag != null && son.kilo ? `Yağsız ${yuvarla(yagsizKutle(son.kilo, yag))} kg` : 'bel + boyun gir'}
          />
          <Karo
            ikon="resize"
            renk={bbo && bbo >= 0.5 ? r.turuncu : r.su}
            etiket="BEL / BOY"
            deger={bbo ? `${yuvarla(bbo, 2)}` : '—'}
            alt={bbo ? (bbo < 0.5 ? 'Sağlıklı aralık' : 'Riskli (≥ 0.5)') : 'bel gir'}
          />
          <Karo ikon="flame" renk={r.kirmizi} etiket="BMR" deger={h.bmr ? `${h.bmr}` : '—'} alt="kcal / gün (dinlenme)" />
          <Karo ikon="walk" renk={r.uyku} etiket="TDEE" deger={h.tdee ? `${h.tdee}` : '—'} alt="kcal / gün (aktiviteyle)" />
          <Karo ikon="water-outline" renk={r.su} etiket="SU HEDEFİ" deger={`${(h.su / 1000).toFixed(1)} L`} alt="35 ml × kg" />
        </View>
      )}

      <Kart baslik="Yeni ölçüm" ikon="add-circle">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {ALANLAR.map(({ k, ad }) => (
            <Satir key={k} style={{ width: '47%', flexGrow: 1 }}>
              <Alan
                etiket={ad}
                deger={form[k]}
                degistir={(t) => setForm((f) => ({ ...f, [k]: t }))}
                ipucu={son[k] != null ? `son: ${son[k]}` : undefined}
              />
            </Satir>
          ))}
        </View>
        <Buton baslik="Kaydet" ikon="checkmark" bas={kaydet} />
        <Soluk>Yağ oranı için bel (göbek hizası) ve boyun ölçüsü gerekli; kadınlarda kalça da.</Soluk>
      </Kart>

      {gecmis.length > 0 && (
        <Kart baslik="Geçmiş" ikon="time">
          {gecmis.slice(0, 20).map((o) => (
            <ListeSatiri
              key={o.id}
              sol={tarihGoster(o.tarih)}
              alt={
                ALANLAR.filter(({ k }) => k !== 'kilo' && o[k] != null)
                  .map(({ k, ad }) => `${ad.split(' ')[0]} ${o[k]}`)
                  .join(' · ') || undefined
              }
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
