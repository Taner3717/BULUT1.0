import { useCallback, useEffect, useRef, useState } from 'react';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Alert, Platform, Pressable, Switch, Text, View } from 'react-native';
import { Alan, Buton, Ekran, Halka, Ikon, Kart, ListeSatiri, Satir, Soluk } from '../../components/ui';
import { saatOku, sayiOku } from '../../lib/calc';
import { ayarGetir, ayarKaydet, sonDegerler, suEkle, suKayitlari, suSil, suToplam, tarihStr } from '../../lib/db';
import { gunlukHedefler } from '../../lib/hedef';
import {
  VARSAYILAN_SU_AYARI,
  bildirimIzniIste,
  hatirlatmaSaatleri,
  suHatirlaticilariniIptalEt,
  suHatirlaticilariniKur,
  type SuAyari,
} from '../../lib/notifications';
import { useRenk } from '../../lib/tema';
import { useVeri } from '../../lib/useVeri';

async function yukle(db: SQLiteDatabase) {
  const bugun = tarihStr();
  const [kayitlar, toplam, ayar, son] = await Promise.all([
    suKayitlari(db, bugun),
    suToplam(db, bugun),
    ayarGetir(db, 'su', VARSAYILAN_SU_AYARI),
    sonDegerler(db),
  ]);
  return {
    kayitlar,
    toplam,
    ayar,
    hedef: gunlukHedefler(null, son.kilo, ayar.hedefMl).su,
    otomatikHedef: gunlukHedefler(null, son.kilo).su,
  };
}

const HIZLI = [
  { ml: 200, ad: 'Bardak', ikon: 'cafe-outline' },
  { ml: 330, ad: 'Kupa', ikon: 'beer-outline' },
  { ml: 500, ad: 'Şişe', ikon: 'water-outline' },
] as const;

export default function SuEkrani() {
  const r = useRenk();
  const { veri, yenile, db } = useVeri(useCallback((d: SQLiteDatabase) => yukle(d), []));
  const [ozel, setOzel] = useState('');
  const [ayar, setAyar] = useState<SuAyari>(VARSAYILAN_SU_AYARI);
  const [hedefMetin, setHedefMetin] = useState('');
  const [aralikMetin, setAralikMetin] = useState(String(VARSAYILAN_SU_AYARI.aralikDk));
  const formDolduruldu = useRef(false);

  // Kayıtlı ayarları forma yalnızca ilk yüklemede aktar
  useEffect(() => {
    if (!veri || formDolduruldu.current) return;
    formDolduruldu.current = true;
    setAyar(veri.ayar);
    setHedefMetin(veri.ayar.hedefMl ? String(veri.ayar.hedefMl) : '');
    setAralikMetin(String(veri.ayar.aralikDk));
  }, [veri]);

  async function ekle(ml: number) {
    await suEkle(db, ml);
    yenile();
  }

  async function ayarlariKaydet() {
    const bas = saatOku(ayar.baslangic);
    const bit = saatOku(ayar.bitis);
    const aralik = sayiOku(aralikMetin);
    if (bas == null || bit == null || bit <= bas) {
      Alert.alert('Saatleri kontrol et', 'Başlangıç ve bitiş SS:DD olmalı, bitiş başlangıçtan sonra olmalı.');
      return;
    }
    if (aralik == null || aralik < 15 || aralik > 480) {
      Alert.alert('Aralık', 'Aralık 15 ile 480 dakika arasında olmalı.');
      return;
    }
    const hedef = sayiOku(hedefMetin);
    const yeni: SuAyari = { ...ayar, aralikDk: Math.round(aralik), hedefMl: hedef && hedef >= 500 ? Math.round(hedef) : null };

    if (Platform.OS === 'web') {
      await ayarKaydet(db, 'su', { ...yeni, aktif: false });
      Alert.alert('Bilgi', 'Bildirimler web sürümünde çalışmaz; telefonda dene.');
      yenile();
      return;
    }

    if (yeni.aktif) {
      const izin = await bildirimIzniIste();
      if (!izin) {
        Alert.alert('İzin gerekli', 'Hatırlatıcı için ayarlardan bildirim iznini aç.');
        yeni.aktif = false;
      }
    }
    await ayarKaydet(db, 'su', yeni);
    if (yeni.aktif) {
      const adet = await suHatirlaticilariniKur(hatirlatmaSaatleri(bas, bit, yeni.aralikDk));
      Alert.alert('Hatırlatıcı kuruldu', `Her gün ${ayar.baslangic}-${ayar.bitis} arası ${adet} bildirim gelecek.`);
    } else {
      await suHatirlaticilariniIptalEt();
    }
    yenile();
  }

  if (!veri) return <Ekran>{null}</Ekran>;
  const { kayitlar, toplam, hedef, otomatikHedef } = veri;
  const kalan = Math.max(0, hedef - toplam);

  return (
    <Ekran>
      <Kart>
        <View style={{ alignItems: 'center', paddingTop: 4, gap: 6 }}>
          <Halka oran={toplam / hedef} boyut={200} kalinlik={18} renkli={r.su}>
            <Ikon ad="water" boyut={24} renk={r.su} />
            <Text style={{ fontSize: 36, fontWeight: '800', color: r.metin }}>{(toplam / 1000).toFixed(2)}</Text>
            <Text style={{ fontSize: 13, color: r.soluk, fontWeight: '600' }}>/ {(hedef / 1000).toFixed(1)} L</Text>
          </Halka>
          <Text style={{ color: toplam >= hedef ? r.anaKoyu : r.soluk, fontWeight: '600' }}>
            {toplam >= hedef ? 'Hedefe ulaştın 🎉' : `${kalan} ml kaldı`}
          </Text>
        </View>
        <Satir style={{ gap: 10 }}>
          {HIZLI.map((h) => (
            <Pressable
              key={h.ml}
              onPress={() => ekle(h.ml)}
              style={({ pressed }) => ({
                flex: 1,
                alignItems: 'center',
                gap: 4,
                paddingVertical: 12,
                borderRadius: 16,
                backgroundColor: r.su + '1A',
                transform: [{ scale: pressed ? 0.96 : 1 }],
              })}
            >
              <Ikon ad={h.ikon} boyut={24} renk={r.su} />
              <Text style={{ fontWeight: '800', color: r.metin }}>+{h.ml}</Text>
              <Text style={{ fontSize: 11, color: r.soluk }}>{h.ad}</Text>
            </Pressable>
          ))}
        </Satir>
        <Satir style={{ alignItems: 'flex-end' }}>
          <Alan etiket="Özel miktar (ml)" deger={ozel} degistir={setOzel} ipucu="750" klavye="number-pad" />
          <View>
            <Buton
              baslik="Ekle"
              ikon="add"
              bas={() => {
                const n = sayiOku(ozel);
                if (n && n > 0 && n <= 3000) {
                  ekle(Math.round(n));
                  setOzel('');
                }
              }}
            />
          </View>
        </Satir>
      </Kart>

      <Kart
        baslik="Hatırlatıcı"
        ikon="notifications"
        ikonRenk={r.su}
        sag={
          <Switch
            value={ayar.aktif}
            onValueChange={(v) => setAyar((a) => ({ ...a, aktif: v }))}
            trackColor={{ true: r.ana, false: r.cizgi }}
            thumbColor="#FFFFFF"
          />
        }
      >
        <Satir>
          <Alan
            etiket="Başlangıç"
            deger={ayar.baslangic}
            degistir={(t) => setAyar((a) => ({ ...a, baslangic: t }))}
            klavye="numbers-and-punctuation"
          />
          <Alan
            etiket="Bitiş"
            deger={ayar.bitis}
            degistir={(t) => setAyar((a) => ({ ...a, bitis: t }))}
            klavye="numbers-and-punctuation"
          />
          <Alan etiket="Aralık (dk)" deger={aralikMetin} degistir={setAralikMetin} klavye="number-pad" />
        </Satir>
        <Alan
          etiket="Günlük hedef (ml) · boş bırakırsan kilona göre"
          deger={hedefMetin}
          degistir={setHedefMetin}
          ipucu={`otomatik: ${otomatikHedef}`}
          klavye="number-pad"
        />
        <Buton baslik="Ayarları kaydet" ikon="checkmark" bas={ayarlariKaydet} />
        <Soluk>
          {Platform.OS === 'web'
            ? 'Web uygulamasında (Safari / Ana Ekran) bildirim gönderilemez; hatırlatıcı yalnızca TestFlight ya da mağaza sürümünde çalışır.'
            : 'Bildirimdeki “+250 ml içtim” butonu suyu doğrudan kaydeder.'}
        </Soluk>
      </Kart>

      {kayitlar.length > 0 && (
        <Kart
          baslik="Bugün"
          ikon="time"
          ikonRenk={r.su}
          sag={<Text style={{ color: r.soluk, fontWeight: '600' }}>{kayitlar.length} kez</Text>}
        >
          {kayitlar.map((k) => (
            <ListeSatiri
              key={k.id}
              sol={k.zaman}
              sag={`${k.ml} ml`}
              sil={async () => {
                await suSil(db, k.id);
                yenile();
              }}
            />
          ))}
        </Kart>
      )}
    </Ekran>
  );
}
