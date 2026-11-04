import { useCallback, useState } from 'react';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Alert, Pressable, Text, View } from 'react-native';
import { Alan, Buton, Ekran, Etiket, Ikon, Kart, ListeSatiri, MiniGrafik, Satir, Soluk } from '../../components/ui';
import { dkMetin, uykuSuresiDk } from '../../lib/calc';
import { tarihGoster, tarihStr, uykuEkle, uykulariGetir, uykuSil } from '../../lib/db';
import { useRenk } from '../../lib/tema';
import { useVeri } from '../../lib/useVeri';

function Yildizlar({ deger, sec }: { deger: number | null; sec?: (n: number) => void }) {
  const r = useRenk();
  return (
    <Satir style={{ gap: sec ? 10 : 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={sec ? () => sec(n) : undefined} disabled={!sec} hitSlop={6}>
          <Ikon ad={deger != null && n <= deger ? 'star' : 'star-outline'} boyut={sec ? 30 : 14} renk={r.protein} />
        </Pressable>
      ))}
    </Satir>
  );
}

export default function UykuEkrani() {
  const r = useRenk();
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
  const kaliteli = son7.filter((u) => u.kalite != null);
  const ortKalite = kaliteli.length ? kaliteli.reduce((a, u) => a + (u.kalite ?? 0), 0) / kaliteli.length : null;

  return (
    <Ekran>
      <Kart baslik="Dün gece" ikon="moon" ikonRenk={r.uyku}>
        <View style={{ alignItems: 'center', paddingVertical: 4 }}>
          <Text style={{ fontSize: 40, fontWeight: '800', color: sure != null ? r.metin : r.soluk }}>
            {sure != null ? dkMetin(sure) : '—'}
          </Text>
          <Soluk>{sure != null ? 'toplam uyku' : 'Saat formatı SS:DD olmalı'}</Soluk>
        </View>
        <Satir>
          <Alan etiket="🛏️ Yatış" deger={yatis} degistir={setYatis} ipucu="23:30" klavye="numbers-and-punctuation" />
          <Alan etiket="⏰ Kalkış" deger={kalkis} degistir={setKalkis} ipucu="07:00" klavye="numbers-and-punctuation" />
        </Satir>
        <View style={{ gap: 6, alignItems: 'center' }}>
          <Etiket>UYKU KALİTESİ</Etiket>
          <Yildizlar deger={kalite} sec={setKalite} />
        </View>
        <Alan etiket="Not (isteğe bağlı)" deger={notlar} degistir={setNotlar} ipucu="Gece uyandım…" klavye="default" />
        <Buton baslik="Kaydet" ikon="checkmark" bas={kaydet} />
      </Kart>

      <Kart baslik="Son 7 gün" ikon="stats-chart" ikonRenk={r.uyku}>
        <Satir>
          <View style={{ flex: 1 }}>
            <Etiket>ORTALAMA</Etiket>
            <Text style={{ fontSize: 22, fontWeight: '800', color: r.metin }}>{ort != null ? dkMetin(ort) : '—'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Etiket>ORT. KALİTE</Etiket>
            <Text style={{ fontSize: 22, fontWeight: '800', color: r.metin }}>
              {ortKalite != null ? `${ortKalite.toFixed(1)} ★` : '—'}
            </Text>
          </View>
        </Satir>
        <MiniGrafik degerler={son7.map((u) => u.sure_dk).reverse()} renkli={r.uyku} />
        <Soluk>Yetişkinler için önerilen: 7-9 saat.</Soluk>
      </Kart>

      {kayitlar && kayitlar.length > 0 && (
        <Kart baslik="Geçmiş" ikon="time" ikonRenk={r.uyku}>
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
