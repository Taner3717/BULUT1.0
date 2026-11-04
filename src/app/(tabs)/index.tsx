import { useCallback } from 'react';
import { router } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Buton, Ekran, Etiket, Halka, Ikon, IkonKutu, Ilerleme, Kart, Satir, Soluk, type IkonAdi } from '../../components/ui';
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
import { useRenk } from '../../lib/tema';
import { useVeri } from '../../lib/useVeri';

const UYKU_HEDEF_DK = 8 * 60;

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
  const sonUyku = uykular[0]?.tarih === bugun ? uykular[0] : null;
  return { profil, son, toplam, su, sonUyku, hedef: gunlukHedefler(profil, son.kilo, suAyari.hedefMl) };
}

function selam() {
  const h = new Date().getHours();
  if (h < 6) return 'İyi geceler';
  if (h < 12) return 'Günaydın';
  if (h < 18) return 'İyi günler';
  return 'İyi akşamlar';
}

function MiniHalka({ etiket, deger, alt, oran, renkli, ikon }: { etiket: string; deger: string; alt: string; oran: number; renkli: string; ikon: IkonAdi }) {
  const r = useRenk();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 8 }}>
      <Halka oran={oran} boyut={84} kalinlik={9} renkli={renkli}>
        <Ikon ad={ikon} boyut={24} renk={renkli} />
      </Halka>
      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: r.metin }}>{deger}</Text>
        <Text style={{ fontSize: 12, color: r.soluk }}>{alt}</Text>
        <Text style={{ fontSize: 12, color: r.soluk, fontWeight: '600', marginTop: 2 }}>{etiket}</Text>
      </View>
    </View>
  );
}

function MakroCubuk({ ad, alinan, hedef, renkli }: { ad: string; alinan: number; hedef?: number; renkli: string }) {
  const r = useRenk();
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Etiket>{ad}</Etiket>
      <Ilerleme oran={hedef ? alinan / hedef : 0} renkli={renkli} />
      <Text style={{ fontSize: 13, color: r.metin, fontWeight: '700' }}>
        {Math.round(alinan)}
        <Text style={{ color: r.soluk, fontWeight: '400' }}>{hedef ? ` / ${hedef} g` : ' g'}</Text>
      </Text>
    </View>
  );
}

function HizliEylem({ ikon, ad, bas, renkli }: { ikon: IkonAdi; ad: string; bas: () => void; renkli: string }) {
  const r = useRenk();
  return (
    <Pressable
      onPress={bas}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 18,
        backgroundColor: r.kart,
        borderWidth: 1,
        borderColor: r.cizgi,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <IkonKutu ad={ikon} renk={renkli} boyut={40} />
      <Text style={{ fontSize: 13, fontWeight: '600', color: r.metin }}>{ad}</Text>
    </Pressable>
  );
}

export default function Bugun() {
  const r = useRenk();
  const ust = useSafeAreaInsets().top;
  const { veri, yenile, db } = useVeri(useCallback((d: SQLiteDatabase) => yukle(d), []));
  if (!veri) return <View style={{ flex: 1, backgroundColor: r.arka }} />;
  const { profil, son, toplam, su, sonUyku, hedef } = veri;

  const kalan = hedef.kalori != null ? Math.round(hedef.kalori - toplam.kcal) : null;
  const v = profil && son.kilo ? vki(son.kilo, profil.boy) : null;
  const yag = profil && son.bel && son.boyun ? navyYagOrani(profil.cinsiyet, profil.boy, son.bel, son.boyun, son.kalca) : null;
  const tarihMetni = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });

  return (
    <View style={{ flex: 1, backgroundColor: r.arka, paddingTop: ust }}>
      <Ekran>
        <Satir style={{ justifyContent: 'space-between', paddingTop: 8 }}>
          <View>
            <Text style={{ fontSize: 14, color: r.soluk, fontWeight: '600' }}>{tarihMetni}</Text>
            <Text style={{ fontSize: 28, color: r.metin, fontWeight: '800' }}>{selam()} 👋</Text>
          </View>
          <Pressable
            onPress={() => router.push('/profil')}
            hitSlop={8}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: r.anaAcik, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ikon ad="person" boyut={22} renk={r.anaKoyu} />
          </Pressable>
        </Satir>

        {(!profil || !son.kilo) && (
          <Kart baslik="Başlayalım" ikon="sparkles" style={{ backgroundColor: r.anaAcik, borderColor: r.anaAcik }}>
            <Soluk>
              Hedeflerini hesaplayabilmem için {!profil ? 'profilini' : ''}
              {!profil && !son.kilo ? ' ve ' : ''}
              {!son.kilo ? 'kilonu' : ''} girmen yeterli.
            </Soluk>
            <Buton
              baslik={!profil ? 'Profili doldur' : 'Kilonu gir'}
              ikon="arrow-forward"
              bas={() => router.push(!profil ? '/profil' : '/olcum')}
            />
          </Kart>
        )}

        <Kart>
          <View style={{ alignItems: 'center', paddingTop: 4 }}>
            <Halka oran={hedef.kalori ? toplam.kcal / hedef.kalori : 0} boyut={210} kalinlik={18}>
              <Ikon ad="flame" boyut={22} renk={kalan != null && kalan < 0 ? r.turuncu : r.ana} />
              <Text style={{ fontSize: 40, fontWeight: '800', color: r.metin, marginTop: 2 }}>
                {kalan != null ? Math.abs(kalan) : Math.round(toplam.kcal)}
              </Text>
              <Text style={{ fontSize: 13, color: r.soluk, fontWeight: '600' }}>
                {kalan == null ? 'kcal alındı' : kalan >= 0 ? 'kcal kaldı' : 'kcal fazla'}
              </Text>
            </Halka>
          </View>
          <Satir style={{ justifyContent: 'space-around' }}>
            <View style={{ alignItems: 'center' }}>
              <Etiket>ALINAN</Etiket>
              <Text style={{ fontSize: 18, fontWeight: '800', color: r.metin }}>{Math.round(toplam.kcal)}</Text>
            </View>
            <View style={{ width: 1, height: 28, backgroundColor: r.cizgi }} />
            <View style={{ alignItems: 'center' }}>
              <Etiket>HEDEF</Etiket>
              <Text style={{ fontSize: 18, fontWeight: '800', color: r.metin }}>{hedef.kalori ?? '—'}</Text>
            </View>
          </Satir>
          <Satir style={{ gap: 14, alignItems: 'flex-start' }}>
            <MakroCubuk ad="Protein" alinan={toplam.protein} hedef={hedef.makro?.protein} renkli={r.protein} />
            <MakroCubuk ad="Karb." alinan={toplam.karb} hedef={hedef.makro?.karb} renkli={r.su} />
            <MakroCubuk ad="Yağ" alinan={toplam.yag} hedef={hedef.makro?.yag} renkli={r.uyku} />
          </Satir>
        </Kart>

        <Kart>
          <Satir style={{ alignItems: 'flex-start' }}>
            <MiniHalka
              etiket="Su"
              ikon="water"
              renkli={r.su}
              oran={su / hedef.su}
              deger={`${(su / 1000).toFixed(1)} L`}
              alt={`/ ${(hedef.su / 1000).toFixed(1)} L`}
            />
            <MiniHalka
              etiket="Protein"
              ikon="barbell"
              renkli={r.protein}
              oran={hedef.makro ? toplam.protein / hedef.makro.protein : 0}
              deger={`${Math.round(toplam.protein)} g`}
              alt={hedef.makro ? `/ ${hedef.makro.protein} g` : 'hedef yok'}
            />
            <MiniHalka
              etiket="Uyku"
              ikon="moon"
              renkli={r.uyku}
              oran={sonUyku ? sonUyku.sure_dk / UYKU_HEDEF_DK : 0}
              deger={sonUyku ? dkMetin(sonUyku.sure_dk) : '—'}
              alt="/ 8 sa"
            />
          </Satir>
        </Kart>

        <Satir style={{ gap: 10 }}>
          <HizliEylem ikon="camera" ad="Fotoğraf" renkli={r.ana} bas={() => router.push('/foto')} />
          <HizliEylem ikon="add-circle" ad="Yemek" renkli={r.protein} bas={() => router.push('/kalori')} />
          <HizliEylem
            ikon="water"
            ad="+250 ml"
            renkli={r.su}
            bas={async () => {
              await suEkle(db, 250);
              yenile();
            }}
          />
        </Satir>

        <Pressable onPress={() => router.push('/olcum')}>
          <Kart baslik="Vücut" ikon="body" sag={<Ikon ad="chevron-forward" boyut={18} renk={r.soluk} />}>
            <Satir style={{ alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <Etiket>KİLO</Etiket>
                <Text style={{ fontSize: 26, fontWeight: '800', color: r.metin }}>
                  {son.kilo ? yuvarla(son.kilo) : '—'}
                  <Text style={{ fontSize: 15, color: r.soluk, fontWeight: '600' }}> kg</Text>
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Etiket>VKİ</Etiket>
                <Text style={{ fontSize: 18, fontWeight: '800', color: r.metin }}>{v ? yuvarla(v) : '—'}</Text>
                {v ? <Soluk>{vkiKategori(v)}</Soluk> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Etiket>YAĞ ORANI</Etiket>
                <Text style={{ fontSize: 18, fontWeight: '800', color: r.metin }}>{yag != null ? `%${yuvarla(yag)}` : '—'}</Text>
                {yag == null ? <Soluk>bel+boyun gir</Soluk> : null}
              </View>
            </Satir>
          </Kart>
        </Pressable>

        <Soluk>Bulut tıbbi tavsiye vermez; değerler genel formüllere dayalı tahminlerdir.</Soluk>
      </Ekran>
    </View>
  );
}
