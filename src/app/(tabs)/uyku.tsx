import { useCallback, useState } from 'react';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Alert } from 'react-native';
import { Alan, Buton, Deger, Ekran, Kart, ListeSatiri, MiniGrafik, Satir, Secenekler, Soluk } from '../../components/ui';
import { dkMetin, uykuSuresiDk } from '../../lib/calc';
import { tarihGoster, tarihStr, uykuEkle, uykulariGetir, uykuSil } from '../../lib/db';
import { useVeri } from '../../lib/useVeri';

const KALITE = [1, 2, 3, 4, 5].map((n) => ({ deger: n, ad: '★'.repeat(n) }));

export default function UykuEkrani() {
  const { veri: kayitlar, yenile, db } = useVeri(useCallback((d: SQLiteDatabase) => uykulariGetir(d, 30), []));
  const [yatis, setYatis] = useState('23:30');
  const [kalkis, setKalkis] = useState('07:00');
  const [kalite, setKalite] = useState<number | null>(null);
  const [notlar, setNotlar] = useState('');

  const sure = uykuSuresiDk(yatis, kalkis);

  async function kaydet() {
    if (sure == null) {
      Alert.alert('Saat formatı', 'Saatleri SS:DD şeklinde gir (ör. 23:30).');
      return;
    }
    await uykuEkle(db, { tarih: tarihStr(), yatis, kalkis, sure_dk: sure, kalite, notlar: notlar.trim() || null });
    setKalite(null);
    setNotlar('');
    yenile();
  }

  const son7 = (kayitlar ?? []).slice(0, 7);
  const ort = son7.length ? son7.reduce((a, u) => a + u.sure_dk, 0) / son7.length : null;

  return (
    <Ekran>
      <Kart baslik="Dün gece">
        <Satir>
          <Alan etiket="Yatış" deger={yatis} degistir={setYatis} ipucu="23:30" klavye="numbers-and-punctuation" />
          <Alan etiket="Kalkış" deger={kalkis} degistir={setKalkis} ipucu="07:00" klavye="numbers-and-punctuation" />
        </Satir>
        <Soluk>{sure != null ? `Süre: ${dkMetin(sure)}` : 'Saat formatı SS:DD olmalı'}</Soluk>
        <Secenekler secenekler={KALITE} secili={kalite} sec={setKalite} />
        <Alan etiket="Not (isteğe bağlı)" deger={notlar} degistir={setNotlar} ipucu="Gece uyandım…" klavye="default" />
        <Buton baslik="Kaydet" bas={kaydet} />
      </Kart>

      <Kart baslik="Son 7 kayıt">
        <Satir>
          <Deger etiket="Ortalama" deger={ort != null ? dkMetin(ort) : '—'} />
          <Deger
            etiket="Ort. kalite"
            deger={(() => {
              const k = son7.filter((u) => u.kalite != null);
              return k.length ? (k.reduce((a, u) => a + (u.kalite ?? 0), 0) / k.length).toFixed(1) : '—';
            })()}
          />
        </Satir>
        <MiniGrafik degerler={son7.map((u) => u.sure_dk).reverse()} />
        <Soluk>Yetişkinler için önerilen: 7-9 saat.</Soluk>
      </Kart>

      {kayitlar && kayitlar.length > 0 && (
        <Kart baslik="Geçmiş">
          {kayitlar.map((u) => (
            <ListeSatiri
              key={u.id}
              sol={`${tarihGoster(u.tarih)} · ${u.yatis} → ${u.kalkis}`}
              alt={[u.kalite ? '★'.repeat(u.kalite) : null, u.notlar].filter(Boolean).join(' · ') || undefined}
              sag={dkMetin(u.sure_dk)}
              sil={async () => {
                await uykuSil(db, u.id);
                yenile();
              }}
            />
          ))}
        </Kart>
      )}
    </Ekran>
  );
}
