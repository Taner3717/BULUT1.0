import { useEffect, useState } from 'react';
import type { SQLiteDatabase } from 'expo-sqlite';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { besinHesapla, sayiOku } from '../lib/calc';
import { besinAra, besinKaydet, besinKullanildi, disBesinEkle, ogunEkle, porsiyonlariOku, type Besin } from '../lib/db';
import { offAra, type OffUrun } from '../lib/openfoodfacts';
import type { Renkler } from '../lib/tema';
import { useRenk } from '../lib/tema';
import { Alan, Buton, Etiket, Ikon, Kart, Satir, Secenekler, Soluk } from './ui';

const OGUNLER = [
  { deger: 'Kahvaltı', ad: 'Kahvaltı' },
  { deger: 'Öğle', ad: 'Öğle' },
  { deger: 'Akşam', ad: 'Akşam' },
  { deger: 'Ara öğün', ad: 'Ara öğün' },
] as const;

type Alanlar = Record<'kcal' | 'protein' | 'karb' | 'yag' | 'sodyum' | 'potasyum' | 'lif' | 'seker' | 'doymus' | 'kolesterol', string>;
const BOS: Alanlar = { kcal: '', protein: '', karb: '', yag: '', sodyum: '', potasyum: '', lif: '', seker: '', doymus: '', kolesterol: '' };

function varsayilanOgun(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Kahvaltı';
  if (h < 16) return 'Öğle';
  if (h < 21) return 'Akşam';
  return 'Ara öğün';
}

function kaynakBilgisi(k: string, r: Renkler): { ad: string; uzun: string; renk: string } {
  switch (k) {
    case 'usda':
      return { ad: 'USDA', uzun: 'USDA FoodData Central · doğrulandı', renk: r.su };
    case 'fatsecret':
      return { ad: 'FatSecret', uzun: 'FatSecret günlüğünden', renk: r.ana };
    case 'off':
      return { ad: 'İnternet', uzun: 'Open Food Facts · kullanıcı katkılı, etiketle karşılaştır', renk: r.turuncu };
    default:
      return { ad: 'Benim', uzun: 'Kendi kaydın', renk: r.uyku };
  }
}

function Rozet({ metin: m, renk }: { metin: string; renk: string }) {
  return (
    <View style={{ backgroundColor: renk + '22', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
      <Text style={{ color: renk, fontSize: 10, fontWeight: '800' }}>{m}</Text>
    </View>
  );
}

function metin(v: number | null | undefined) {
  return v == null ? '' : String(Math.round(v * 10) / 10);
}

export function ElleEkleFormu({ db, tarih, eklendi }: { db: SQLiteDatabase; tarih: string; eklendi: () => void }) {
  const r = useRenk();
  const [ogun, setOgun] = useState<string>(varsayilanOgun());
  const [yemek, setYemek] = useState('');
  const [miktar, setMiktar] = useState('');
  const [alan, setAlan] = useState<Alanlar>(BOS);
  const [secili, setSecili] = useState<Besin | null>(null);
  const [oneriler, setOneriler] = useState<Besin[]>([]);
  const [digerAcik, setDigerAcik] = useState(false);
  const [webSonuc, setWebSonuc] = useState<OffUrun[] | null>(null);
  const [webAraniyor, setWebAraniyor] = useState(false);
  const [webHata, setWebHata] = useState<string | null>(null);

  async function internetteAra() {
    setWebAraniyor(true);
    setWebHata(null);
    try {
      setWebSonuc(await offAra(yemek.trim()));
    } catch (e) {
      setWebHata(e instanceof Error ? e.message : String(e));
    } finally {
      setWebAraniyor(false);
    }
  }

  async function webSec(u: OffUrun) {
    const b = await disBesinEkle(db, u);
    setWebSonuc(null);
    if (b) sec(b);
  }

  useEffect(() => {
    if (secili) return; // seçim yapılmışken öneri listesi gizli
    let iptal = false;
    besinAra(db, yemek, 10).then((l) => !iptal && setOneriler(l));
    return () => {
      iptal = true;
    };
  }, [db, yemek, secili]);

  function doldur(b: Besin, m: number) {
    const d = besinHesapla(b, m);
    setAlan({
      kcal: metin(d.kcal),
      protein: metin(d.protein),
      karb: metin(d.karb),
      yag: metin(d.yag),
      sodyum: metin(d.sodyum),
      potasyum: metin(d.potasyum),
      lif: metin(d.lif),
      seker: metin(d.seker),
      doymus: metin(d.doymus),
      kolesterol: metin(d.kolesterol),
    });
  }

  function sec(b: Besin) {
    const m = b.birim === 'porsiyon' ? 1 : (b.varsayilan ?? b.referans);
    setSecili(b);
    setYemek(b.ad);
    setMiktar(String(m));
    doldur(b, m);
  }

  function miktarDegisti(t: string) {
    setMiktar(t);
    const m = sayiOku(t);
    if (secili && m != null && m >= 0) doldur(secili, m);
  }

  function temizle() {
    setYemek('');
    setMiktar('');
    setAlan(BOS);
    setSecili(null);
    setWebSonuc(null);
  }

  async function ekle() {
    const kcal = sayiOku(alan.kcal);
    if (!yemek.trim() || kcal == null || kcal < 0) {
      Alert.alert('Eksik bilgi', 'En az yemek adı ve kalori gir.');
      return;
    }
    const m = sayiOku(miktar);
    const porsiyon = secili?.birim === 'porsiyon';
    const deger = {
      kcal,
      protein: sayiOku(alan.protein) ?? 0,
      karb: sayiOku(alan.karb) ?? 0,
      yag: sayiOku(alan.yag) ?? 0,
      sodyum: sayiOku(alan.sodyum),
      potasyum: sayiOku(alan.potasyum),
      lif: sayiOku(alan.lif),
      seker: sayiOku(alan.seker),
      doymus: sayiOku(alan.doymus),
      kolesterol: sayiOku(alan.kolesterol),
    };
    const ad = porsiyon && m != null && m !== 1 ? `${yemek.trim()} × ${m}` : yemek.trim();
    await ogunEkle(db, { tarih, ogun, yemek: ad, gram: porsiyon ? null : m, kaynak: 'elle', ...deger });
    if (secili) await besinKullanildi(db, secili.id, m);
    else await besinKaydet(db, { ad: yemek.trim(), gram: m, ...deger });
    temizle();
    eklendi();
  }

  const miktarEtiketi = secili?.birim === 'porsiyon' ? 'Adet' : secili?.birim === 'ml' ? 'ml' : 'Gram';
  const hizliSecim = !yemek.trim();

  return (
    <Kart baslik="Elle ekle" ikon="create-outline">
      <Secenekler secenekler={OGUNLER} secili={ogun} sec={setOgun} />

      <View style={{ gap: 8 }}>
        <Satir style={{ alignItems: 'flex-end' }}>
          <Alan
            etiket="Yemek ara"
            deger={yemek}
            degistir={(t) => {
              setYemek(t);
              setWebSonuc(null);
              setWebHata(null);
              if (secili && t !== secili.ad) setSecili(null);
            }}
            ipucu="ör. tavuk, muz, yoğurt"
            klavye="default"
            genis={2}
          />
          <Alan etiket={miktarEtiketi} deger={miktar} degistir={miktarDegisti} ipucu="150" />
        </Satir>

        {secili && (
          <View style={{ backgroundColor: r.anaAcik, borderRadius: 12, padding: 10, gap: 8 }}>
            <Satir>
              <Ikon ad="checkmark-circle" boyut={18} renk={r.anaKoyu} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: r.anaKoyu, fontWeight: '700', fontSize: 13 }}>{kaynakBilgisi(secili.kaynak, r).uzun}</Text>
                <Text style={{ color: r.anaKoyu, fontSize: 12 }}>
                  {secili.referans} {secili.birim === 'porsiyon' ? 'porsiyon' : secili.birim} = {Math.round(secili.kcal)} kcal
                  {secili.kullanim > 0 ? ` · ${secili.kullanim} kez yendi` : ''}
                </Text>
              </View>
              <Pressable onPress={temizle} hitSlop={8}>
                <Ikon ad="close" boyut={18} renk={r.anaKoyu} />
              </Pressable>
            </Satir>
            {secili.birim !== 'porsiyon' && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {[{ ad: '100 ' + secili.birim, gram: 100 }, ...porsiyonlariOku(secili)].map((p) => {
                  const aktif = sayiOku(miktar) === p.gram;
                  return (
                    <Pressable
                      key={p.ad}
                      onPress={() => miktarDegisti(String(p.gram))}
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        backgroundColor: aktif ? r.ana : r.kart,
                        borderWidth: 1,
                        borderColor: aktif ? r.ana : r.cizgi,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: aktif ? r.anaYazi : r.metin }}>
                        {p.ad}
                        {p.ad.startsWith('100 ') ? '' : ` · ${p.gram} ${secili.birim}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {!secili && oneriler.length > 0 && (
          <View style={{ gap: 6 }}>
            <Etiket>{hizliSecim ? 'SIK YEDİKLERİN' : 'YİYECEKLERİM'}</Etiket>
            {hizliSecim ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {oneriler.map((b) => (
                  <Pressable
                    key={b.id}
                    onPress={() => sec(b)}
                    style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: r.kartIkincil }}
                  >
                    <Text style={{ color: r.metin, fontWeight: '600', fontSize: 13 }}>{b.ad}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={{ borderRadius: 12, borderWidth: 1, borderColor: r.cizgi, overflow: 'hidden' }}>
                {oneriler.map((b, i) => (
                  <Pressable
                    key={b.id}
                    onPress={() => sec(b)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      backgroundColor: pressed ? r.anaAcik : r.girdiArka,
                      borderTopWidth: i ? 1 : 0,
                      borderTopColor: r.cizgi,
                    })}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Satir style={{ gap: 6 }}>
                        <Text style={{ color: r.metin, fontWeight: '600', flexShrink: 1 }}>{b.ad}</Text>
                        <Rozet metin={kaynakBilgisi(b.kaynak, r).ad} renk={kaynakBilgisi(b.kaynak, r).renk} />
                      </Satir>
                      <Text style={{ color: r.soluk, fontSize: 12 }}>
                        {Math.round(b.kcal)} kcal / {b.referans} {b.birim === 'porsiyon' ? 'porsiyon' : b.birim}
                        {b.sodyum != null ? ` · Na ${Math.round(b.sodyum)} mg` : ''}
                      </Text>
                    </View>
                    <Ikon ad="add-circle" boyut={22} renk={r.ana} />
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        {!secili && yemek.trim().length >= 3 && (
          <View style={{ gap: 6 }}>
            {!webSonuc && (
              <Pressable onPress={internetteAra} disabled={webAraniyor} hitSlop={6}>
                <Satir style={{ paddingVertical: 4 }}>
                  {webAraniyor ? <ActivityIndicator size="small" color={r.anaKoyu} /> : <Ikon ad="globe-outline" boyut={18} renk={r.anaKoyu} />}
                  <Text style={{ color: r.anaKoyu, fontWeight: '700' }}>
                    {oneriler.length ? 'Aradığın yok mu? ' : ''}İnternette ara: “{yemek.trim()}” (paketli ürünler)
                  </Text>
                </Satir>
              </Pressable>
            )}
            {webHata && <Text style={{ color: r.kirmizi, fontSize: 13 }}>{webHata}</Text>}
            {webSonuc && (
              <>
                <Etiket>İNTERNET · OPEN FOOD FACTS</Etiket>
                {webSonuc.length === 0 && <Soluk>Sonuç bulunamadı; değerleri etiketten elle girebilirsin.</Soluk>}
                <View style={{ borderRadius: 12, borderWidth: webSonuc.length ? 1 : 0, borderColor: r.cizgi, overflow: 'hidden' }}>
                  {webSonuc.slice(0, 10).map((u, i) => (
                    <Pressable
                      key={u.kod}
                      onPress={() => webSec(u)}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        backgroundColor: pressed ? r.anaAcik : r.girdiArka,
                        borderTopWidth: i ? 1 : 0,
                        borderTopColor: r.cizgi,
                      })}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={{ color: r.metin, fontWeight: '600' }}>{u.ad}</Text>
                        <Text style={{ color: r.soluk, fontSize: 12 }}>
                          {u.kcal} kcal / 100 g · P {u.protein ?? '?'} · K {u.karb ?? '?'} · Y {u.yag ?? '?'}
                          {u.sodyum != null ? ` · Na ${u.sodyum} mg` : ''}
                        </Text>
                        {u.supheli && (
                          <Text style={{ color: r.turuncu, fontSize: 11, fontWeight: '600' }}>
                            ⚠️ Kalori ile makrolar tutarsız; etiketle kontrol et
                          </Text>
                        )}
                      </View>
                      <Ikon ad="add-circle" boyut={22} renk={r.ana} />
                    </Pressable>
                  ))}
                </View>
                <Soluk>Kullanıcıların girdiği veridir; paketteki etiketle karşılaştırman önerilir.</Soluk>
              </>
            )}
          </View>
        )}
      </View>

      <Satir>
        <Alan etiket="Kalori" deger={alan.kcal} degistir={(t) => setAlan((a) => ({ ...a, kcal: t }))} ipucu="kcal" />
        <Alan etiket="Protein" deger={alan.protein} degistir={(t) => setAlan((a) => ({ ...a, protein: t }))} ipucu="g" />
        <Alan etiket="Karb." deger={alan.karb} degistir={(t) => setAlan((a) => ({ ...a, karb: t }))} ipucu="g" />
        <Alan etiket="Yağ" deger={alan.yag} degistir={(t) => setAlan((a) => ({ ...a, yag: t }))} ipucu="g" />
      </Satir>
      <Satir>
        <Alan etiket="Sodyum (mg)" deger={alan.sodyum} degistir={(t) => setAlan((a) => ({ ...a, sodyum: t }))} ipucu="mg" />
        <Alan etiket="Potasyum (mg)" deger={alan.potasyum} degistir={(t) => setAlan((a) => ({ ...a, potasyum: t }))} ipucu="mg" />
      </Satir>

      <Pressable onPress={() => setDigerAcik((a) => !a)} hitSlop={6}>
        <Satir>
          <Ikon ad={digerAcik ? 'chevron-up' : 'chevron-down'} boyut={16} renk={r.anaKoyu} />
          <Text style={{ color: r.anaKoyu, fontWeight: '600' }}>Diğer besinler (lif, şeker, doymuş yağ, kolesterol)</Text>
        </Satir>
      </Pressable>
      {digerAcik && (
        <>
          <Satir>
            <Alan etiket="Lif (g)" deger={alan.lif} degistir={(t) => setAlan((a) => ({ ...a, lif: t }))} ipucu="g" />
            <Alan etiket="Şeker (g)" deger={alan.seker} degistir={(t) => setAlan((a) => ({ ...a, seker: t }))} ipucu="g" />
          </Satir>
          <Satir>
            <Alan etiket="Doymuş yağ (g)" deger={alan.doymus} degistir={(t) => setAlan((a) => ({ ...a, doymus: t }))} ipucu="g" />
            <Alan
              etiket="Kolesterol (mg)"
              deger={alan.kolesterol}
              degistir={(t) => setAlan((a) => ({ ...a, kolesterol: t }))}
              ipucu="mg"
            />
          </Satir>
        </>
      )}

      <Buton baslik="Ekle" ikon="add" bas={ekle} />
      <Soluk>Listede olmayan bir yiyeceği eklediğinde Yiyeceklerim’e kaydedilir; bir dahaki sefere aratman yeter.</Soluk>
    </Kart>
  );
}
