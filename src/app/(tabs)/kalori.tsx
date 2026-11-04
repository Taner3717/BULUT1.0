import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Text, View } from 'react-native';
import { BesinTablosu } from '../../components/BesinTablosu';
import { ElleEkleFormu } from '../../components/ElleEkleFormu';
import {
  Buton,
  Ekran,
  Etiket,
  Halka,
  Ikon,
  Ilerleme,
  Kart,
  ListeSatiri,
  Satir,
  TarihGezgini,
  type IkonAdi,
} from '../../components/ui';
import {
  gunEkle,
  gunlukToplam,
  kocGunTipi,
  kocProgramGetir,
  ogunleriGetir,
  ogunSil,
  profilGetir,
  sonDegerler,
  tarihGoster,
  tarihStr,
} from '../../lib/db';
import { gunlukHedefler } from '../../lib/hedef';
import { haftaNo } from '../../lib/koc';
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

export default function KaloriEkrani() {
  const r = useRenk();
  const [tarih, setTarih] = useState(tarihStr());
  const [formAcik, setFormAcik] = useState(false);

  const yukle = useCallback(
    async (db: SQLiteDatabase) => {
      const [liste, toplam, profil, son, program, gunTipi] = await Promise.all([
        ogunleriGetir(db, tarih),
        gunlukToplam(db, tarih),
        profilGetir(db),
        sonDegerler(db),
        kocProgramGetir(db),
        kocGunTipi(db, tarih),
      ]);
      const hn = program ? haftaNo(program, tarih) : 0;
      const koc = program && hn >= 1 && hn <= program.hafta ? { program, gunTipi } : null;
      return { liste, toplam, hedef: gunlukHedefler(profil, son.kilo, null, koc), koc };
    },
    [tarih],
  );
  const { veri, yenile, db } = useVeri(yukle);

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
          <View style={{ height: 1, backgroundColor: r.cizgi }} />
          <BesinTablosu toplam={toplam} hedef={hedef.mikro} />
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

      {formAcik && <ElleEkleFormu db={db} tarih={tarih} eklendi={yenile} />}

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
                  alt={
                    `P ${Math.round(o.protein)} · K ${Math.round(o.karb)} · Y ${Math.round(o.yag)}` +
                    (o.sodyum != null ? ` · Na ${Math.round(o.sodyum)} mg` : '') +
                    (o.potasyum != null ? ` · K⁺ ${Math.round(o.potasyum)} mg` : '')
                  }
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
