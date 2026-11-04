import { Text, View } from 'react-native';
import type { mikroHedefler } from '../lib/calc';
import type { GunlukToplam } from '../lib/db';
import { useRenk } from '../lib/tema';
import { Etiket, Ilerleme, Soluk } from './ui';

type Hedefler = ReturnType<typeof mikroHedefler>;

const SATIRLAR = [
  { a: 'sodyum', ad: 'Sodyum', birim: 'mg', vurgu: true },
  { a: 'potasyum', ad: 'Potasyum', birim: 'mg', vurgu: true },
  { a: 'lif', ad: 'Lif', birim: 'g', vurgu: false },
  { a: 'seker', ad: 'Şeker', birim: 'g', vurgu: false },
  { a: 'doymus', ad: 'Doymuş yağ', birim: 'g', vurgu: false },
  { a: 'kolesterol', ad: 'Kolesterol', birim: 'mg', vurgu: false },
] as const;

function bicimle(v: number, birim: string) {
  return birim === 'mg' ? Math.round(v).toLocaleString('tr-TR') : (Math.round(v * 10) / 10).toLocaleString('tr-TR');
}

/** FatSecret tarzı günlük besin değerleri: sodyum/potasyum öne çıkar, üst sınır aşımı kırmızı. */
export function BesinTablosu({ toplam, hedef, sade }: { toplam: GunlukToplam; hedef: Hedefler; sade?: boolean }) {
  const r = useRenk();
  const satirlar = sade ? SATIRLAR.filter((s) => s.vurgu) : SATIRLAR;
  const eksikler = satirlar.filter((s) => toplam[`${s.a}_eksik`] > 0 && toplam.kayit > 0);

  return (
    <View style={{ gap: 12 }}>
      {satirlar.map(({ a, ad, birim, vurgu }) => {
        const deger = toplam[a];
        const h = hedef[a];
        const oran = h.deger ? deger / h.deger : 0;
        const asim = (h.tur === 'ust' || h.tur === 'aralik') && deger > h.deger;
        const tamam = (h.tur === 'alt' && deger >= h.deger) || (h.tur === 'aralik' && deger >= (h.min ?? 0) && deger <= h.deger);
        const renkli = asim ? r.kirmizi : tamam ? r.ana : a === 'sodyum' ? r.turuncu : a === 'potasyum' ? r.uyku : r.su;
        const eksik = toplam[`${a}_eksik`];
        return (
          <View key={a} style={{ gap: 5 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text style={{ fontSize: vurgu ? 15 : 14, fontWeight: vurgu ? '700' : '600', color: r.metin }}>
                {ad}
                {eksik > 0 && toplam.kayit > 0 ? <Text style={{ color: r.soluk }}> *</Text> : null}
              </Text>
              <Text style={{ fontSize: vurgu ? 15 : 14, color: asim ? r.kirmizi : r.metin, fontWeight: '700' }}>
                {bicimle(deger, birim)}
                <Text style={{ color: r.soluk, fontWeight: '400' }}>
                  {' '}
                  {h.tur === 'aralik'
                    ? `/ ${bicimle(h.min ?? 0, birim)}-${bicimle(h.deger, birim)} ${birim}`
                    : `/ ${h.tur === 'ust' ? '≤' : '≥'} ${bicimle(h.deger, birim)} ${birim}`}
                </Text>
              </Text>
            </View>
            <Ilerleme oran={Math.min(oran, 1)} renkli={renkli} />
            {vurgu && (
              <Etiket>
                {asim
                  ? `Sınırı ${bicimle(deger - h.deger, birim)} ${birim} aştın`
                  : h.tur === 'aralik'
                    ? tamam
                      ? 'Hedef aralığındasın'
                      : `Aralığa ${bicimle((h.min ?? 0) - deger, birim)} ${birim} daha`
                    : h.tur === 'ust'
                    ? `${bicimle(Math.max(0, h.deger - deger), birim)} ${birim} hakkın kaldı`
                    : tamam
                      ? 'Hedefe ulaştın'
                      : `${bicimle(h.deger - deger, birim)} ${birim} daha`}
              </Etiket>
            )}
          </View>
        );
      })}
      {eksikler.length > 0 && (
        <Soluk>
          * Bazı yiyeceklerde bu değer bilinmiyor (
          {eksikler.map((s) => `${s.ad.toLowerCase()}: ${toplam[`${s.a}_eksik`]}/${toplam.kayit}`).join(', ')}); gerçek toplam
          daha yüksek olabilir.
        </Soluk>
      )}
    </View>
  );
}
