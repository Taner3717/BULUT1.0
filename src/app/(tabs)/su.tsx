import { useCallback, useEffect, useRef, useState } from 'react';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Alert, Platform, Switch, Text } from 'react-native';
import { Alan, Buton, Deger, Ekran, Ilerleme, Kart, ListeSatiri, Satir, Soluk, renk } from '../../components/ui';
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

export default function SuEkrani() {
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

  return (
    <Ekran>
      <Kart baslik="Bugün">
        <Satir>
          <Deger etiket="İçilen" deger={`${toplam} ml`} />
          <Deger etiket="Hedef" deger={`${hedef} ml`} />
          <Deger etiket="Kalan" deger={`${Math.max(0, hedef - toplam)} ml`} renkli={toplam >= hedef ? renk.yesil : undefined} />
        </Satir>
        <Ilerleme oran={toplam / hedef} renkli="#3FA9F5" />
        <Satir>
          <Buton baslik="+200" tur="ikincil" bas={() => ekle(200)} />
          <Buton baslik="+250" tur="ikincil" bas={() => ekle(250)} />
          <Buton baslik="+500" tur="ikincil" bas={() => ekle(500)} />
        </Satir>
        <Satir style={{ alignItems: 'flex-end' }}>
          <Alan etiket="Özel miktar (ml)" deger={ozel} degistir={setOzel} ipucu="330" klavye="number-pad" />
          <Buton
            baslik="Ekle"
            bas={() => {
              const n = sayiOku(ozel);
              if (n && n > 0 && n <= 3000) {
                ekle(Math.round(n));
                setOzel('');
              }
            }}
          />
        </Satir>
      </Kart>

      <Kart
        baslik="Hatırlatıcı"
        sag={<Switch value={ayar.aktif} onValueChange={(v) => setAyar((a) => ({ ...a, aktif: v }))} />}
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
          etiket="Günlük hedef (ml) — boş bırakırsan kilona göre hesaplanır"
          deger={hedefMetin}
          degistir={setHedefMetin}
          ipucu={`otomatik: ${otomatikHedef}`}
          klavye="number-pad"
        />
        <Buton baslik="Ayarları kaydet" bas={ayarlariKaydet} />
        <Soluk>Bildirimdeki “+250 ml içtim” butonu suyu doğrudan kaydeder.</Soluk>
      </Kart>

      {kayitlar.length > 0 && (
        <Kart baslik="Bugünkü kayıtlar" sag={<Text style={{ color: renk.soluk }}>{kayitlar.length} kez</Text>}>
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
