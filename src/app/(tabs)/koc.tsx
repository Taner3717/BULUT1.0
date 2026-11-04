import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Pressable, ScrollView, Text, View } from 'react-native';
import {
  Alan,
  Buton,
  Ekran,
  Etiket,
  Ikon,
  IkonKutu,
  Ilerleme,
  Kart,
  Satir,
  Secenekler,
  Soluk,
  TarihGezgini,
  type IkonAdi,
} from '../../components/ui';
import { sayiOku } from '../../lib/calc';
import { kocGunKaydet, kocGunVerileri, kocProgramGetir, tarihStr } from '../../lib/db';
import {
  degerlendir,
  gunHedefi,
  haftaGunleri,
  haftaNo,
  haftaOzeti,
  hedefKilo,
  type Bulgu,
  type GunTipi,
  type GunVerisi,
  type KocProgram,
} from '../../lib/koc';
import { useRenk, type Renkler } from '../../lib/tema';
import { useVeri } from '../../lib/useVeri';

const GUN_KISA = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const PUAN = [1, 2, 3, 4, 5].map((n) => ({ deger: n, ad: String(n) }));

function kisaTarih(t: string) {
  const [y, m, d] = t.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

function bulguGorunumu(s: Bulgu['seviye'], r: Renkler): { ikon: IkonAdi; renk: string } {
  if (s === 'iyi') return { ikon: 'checkmark-circle', renk: r.ana };
  if (s === 'onemli') return { ikon: 'alert-circle', renk: r.kirmizi };
  return { ikon: 'warning', renk: r.turuncu };
}

type Form = {
  gun_tipi: GunTipi;
  kilo: string;
  uyku: string;
  stres: number | null;
  enerji: number | null;
  aclik: number | null;
  sindirim: number | null;
  kardiyo: string;
  adim: string;
  notlar: string;
};

function formdan(g: GunVerisi | undefined, not: string | null): Form {
  const s = (v: number | null | undefined) => (v == null ? '' : String(v));
  return {
    gun_tipi: g?.gun_tipi ?? 'normal',
    kilo: s(g?.kilo),
    uyku: s(g?.uyku),
    stres: g?.stres ?? null,
    enerji: g?.enerji ?? null,
    aclik: g?.aclik ?? null,
    sindirim: g?.sindirim ?? null,
    kardiyo: g?.kardiyo ?? '',
    adim: s(g?.adim),
    notlar: not ?? '',
  };
}

type KocVerisi =
  | { program: null }
  | {
      program: KocProgram;
      n: number;
      buHafta: number;
      gunler: string[];
      veri: GunVerisi[];
      oz: ReturnType<typeof haftaOzeti>;
      oncekiKilo: number | null;
      gecenGun: number;
      notlar: Map<string, string | null>;
      bulgular: Bulgu[];
    };

async function yukle(db: SQLiteDatabase, hafta: number | null): Promise<KocVerisi> {
  const program = await kocProgramGetir(db);
  if (!program) return { program: null };
  const bugun = tarihStr();
  const buHafta = Math.min(Math.max(haftaNo(program, bugun), 1), program.hafta);
  const n = hafta ?? buHafta;
  const gunler = haftaGunleri(program, n);
  const [veri, onceki, notlar] = await Promise.all([
    kocGunVerileri(db, gunler),
    n > 1 ? kocGunVerileri(db, haftaGunleri(program, n - 1)) : Promise.resolve([] as GunVerisi[]),
    db.getAllAsync<{ tarih: string; notlar: string | null }>(
      `SELECT tarih, notlar FROM koc_gunluk WHERE tarih IN (${gunler.map(() => '?').join(',')})`,
      ...gunler,
    ),
  ]);
  const oz = haftaOzeti(veri);
  const oncekiKilo = n > 1 ? haftaOzeti(onceki).ort.kilo : program.baslangic_kilo;
  const gecenGun = gunler.filter((g) => g <= bugun).length;
  return {
    program,
    n,
    buHafta,
    gunler,
    veri,
    oz,
    oncekiKilo,
    gecenGun,
    notlar: new Map(notlar.map((x) => [x.tarih, x.notlar])),
    bulgular: gecenGun > 0 ? degerlendir(program, oz, oncekiKilo, gecenGun) : [],
  };
}

export default function KocEkrani() {
  const r = useRenk();
  const [hafta, setHafta] = useState<number | null>(null);
  const [secili, setSecili] = useState<string>(tarihStr());
  const { veri, yenile, db } = useVeri(useCallback((d: SQLiteDatabase) => yukle(d, hafta), [hafta]));
  if (!veri) return <Ekran>{null}</Ekran>;

  if (!veri.program) {
    return (
      <Ekran>
        <Kart baslik="8 haftalık koçluk" ikon="trophy" ikonRenk={r.protein}>
          <Soluk>
            Koç dosyandaki sistemle çalışır: her gün kilo, uyku, stres, enerji, açlık, sindirim, kardiyo ve adım check-in’i; normal ve
            yüksek gün makro hedefleri; haftalık ortalamalar, hedef kiloya göre gidişat ve her hafta koç değerlendirmesi.
          </Soluk>
          <Soluk>Beslenme, su, sodyum ve potasyum uygulamadaki kayıtlarından otomatik gelir.</Soluk>
          <Buton baslik="Programı kur" ikon="arrow-forward" bas={() => router.push('/koc-program')} />
        </Kart>
      </Ekran>
    );
  }

  const { program: p, n, buHafta, gunler, veri: gunlerVeri, oz, oncekiKilo, bulgular } = veri;
  const hedefBuHafta = hedefKilo(p, n);
  const bitis = hedefKilo(p, p.hafta);
  const bugun = tarihStr();
  // Seçili gün bu haftada değilse: bugün (bu haftadaysa) ya da haftanın ilk günü
  const etkin = gunler.includes(secili) ? secili : gunler.includes(bugun) ? bugun : gunler[0];
  const gunVerisi = gunlerVeri.find((g) => g.tarih === etkin);
  const ilerleme = p.baslangic_kilo !== bitis && oz.ort.kilo != null ? (p.baslangic_kilo - oz.ort.kilo) / (p.baslangic_kilo - bitis) : 0;

  return (
    <Ekran>
      <TarihGezgini
        metin={`${n}. hafta · ${kisaTarih(gunler[0])} - ${kisaTarih(gunler[6])}`}
        geri={n > 1 ? () => setHafta(n - 1) : () => {}}
        ileri={n < p.hafta ? () => setHafta(n + 1) : undefined}
      />

      <Kart>
        <Satir style={{ justifyContent: 'space-between' }}>
          <View>
            <Etiket>HAFTA ORTALAMASI</Etiket>
            <Text style={{ fontSize: 30, fontWeight: '800', color: r.metin }}>
              {oz.ort.kilo != null ? oz.ort.kilo.toFixed(1) : '—'}
              <Text style={{ fontSize: 15, color: r.soluk }}> kg</Text>
            </Text>
            {oz.ort.kilo != null && oncekiKilo != null && (
              <Text style={{ color: oz.ort.kilo - oncekiKilo <= 0 ? r.anaKoyu : r.kirmizi, fontWeight: '700' }}>
                {oz.ort.kilo - oncekiKilo > 0 ? '+' : ''}
                {(oz.ort.kilo - oncekiKilo).toFixed(1)} kg {n === 1 ? 'başlangıca göre' : 'geçen haftaya göre'}
              </Text>
            )}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Etiket>BU HAFTA HEDEF</Etiket>
            <Text style={{ fontSize: 20, fontWeight: '800', color: r.metin }}>{hedefBuHafta} kg</Text>
            <Soluk>
              {p.baslangic_kilo} → {bitis} kg
            </Soluk>
          </View>
        </Satir>
        <Ilerleme oran={Math.max(0, ilerleme)} />
        <Satir style={{ justifyContent: 'space-between' }}>
          <Soluk>
            {n}/{p.hafta}. hafta {n === buHafta ? '(bu hafta)' : ''}
          </Soluk>
          <Soluk>Check-in: {oz.checkinGun}/7 gün</Soluk>
        </Satir>
      </Kart>

      <Kart baslik="Günlük check-in" ikon="create" sag={<Text style={{ color: r.soluk, fontWeight: '600' }}>{kisaTarih(etkin)}</Text>}>
        <Satir style={{ justifyContent: 'space-between' }}>
          {gunler.map((g, i) => {
            const aktif = g === etkin;
            const dolu = gunlerVeri[i].kilo != null || gunlerVeri[i].adim != null || gunlerVeri[i].stres != null;
            const gelecek = g > bugun;
            return (
              <Pressable
                key={g}
                onPress={() => setSecili(g)}
                disabled={gelecek}
                style={{
                  width: 40,
                  paddingVertical: 6,
                  borderRadius: 12,
                  alignItems: 'center',
                  backgroundColor: aktif ? r.ana : r.kartIkincil,
                  opacity: gelecek ? 0.35 : 1,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: aktif ? r.anaYazi : r.soluk }}>{GUN_KISA[i]}</Text>
                <Text style={{ fontSize: 15, fontWeight: '800', color: aktif ? r.anaYazi : r.metin }}>{Number(g.slice(8))}</Text>
                <View style={{ width: 6, height: 6, borderRadius: 3, marginTop: 2, backgroundColor: dolu ? (aktif ? r.anaYazi : r.ana) : 'transparent' }} />
              </Pressable>
            );
          })}
        </Satir>

        <GunlukCheckin
          key={`${etkin}-${n}`}
          db={db}
          program={p}
          tarih={etkin}
          gunVerisi={gunVerisi}
          not={veri.notlar.get(etkin) ?? null}
          kaydedildi={yenile}
        />
      </Kart>

      <Kart baslik="Haftalık tablo" ikon="grid" ikonRenk={r.su}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            {[
              ['Gün', 'Kilo', 'Uyku', 'Str', 'Enj', 'Açl', 'Snd', 'Adım', 'kcal', 'P', 'Y', 'K', 'Na', 'Kard.'],
              ...gunlerVeri.map((g, i) => [
                `${GUN_KISA[i]}${g.gun_tipi === 'yuksek' ? '↑' : ''}`,
                g.kilo?.toFixed(1) ?? '',
                g.uyku?.toString() ?? '',
                g.stres?.toString() ?? '',
                g.enerji?.toString() ?? '',
                g.aclik?.toString() ?? '',
                g.sindirim?.toString() ?? '',
                g.adim != null ? (g.adim / 1000).toFixed(1) + 'k' : '',
                g.kcal ? String(Math.round(g.kcal)) : '',
                g.kcal ? String(Math.round(g.protein ?? 0)) : '',
                g.kcal ? String(Math.round(g.yag ?? 0)) : '',
                g.kcal ? String(Math.round(g.karb ?? 0)) : '',
                g.sodyum ? (g.sodyum / 1000).toFixed(1) + 'k' : '',
                g.kardiyo ? (/^yap[ıi]lmad[ıi]/i.test(g.kardiyo) ? '✕' : '✓') : '',
              ]),
              [
                'Ort.',
                oz.ort.kilo?.toFixed(1) ?? '',
                oz.ort.uyku?.toFixed(1) ?? '',
                oz.ort.stres?.toFixed(1) ?? '',
                oz.ort.enerji?.toFixed(1) ?? '',
                oz.ort.aclik?.toFixed(1) ?? '',
                oz.ort.sindirim?.toFixed(1) ?? '',
                oz.ort.adim != null ? (oz.ort.adim / 1000).toFixed(1) + 'k' : '',
                oz.ort.kcal != null ? String(Math.round(oz.ort.kcal)) : '',
                oz.ort.protein != null ? String(Math.round(oz.ort.protein)) : '',
                oz.ort.yag != null ? String(Math.round(oz.ort.yag)) : '',
                oz.ort.karb != null ? String(Math.round(oz.ort.karb)) : '',
                oz.ort.sodyum != null ? (oz.ort.sodyum / 1000).toFixed(1) + 'k' : '',
                `${oz.kardiyoGun}g`,
              ],
            ].map((satir, i, tum) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  paddingVertical: 7,
                  borderTopWidth: i ? 1 : 0,
                  borderTopColor: r.cizgi,
                  backgroundColor: i === tum.length - 1 ? r.anaAcik : 'transparent',
                  borderRadius: i === tum.length - 1 ? 8 : 0,
                }}
              >
                {satir.map((h, j) => (
                  <Text
                    key={j}
                    style={{
                      width: j === 0 ? 44 : j === 13 ? 46 : 42,
                      textAlign: j === 0 ? 'left' : 'center',
                      fontSize: 12,
                      fontWeight: i === 0 || i === tum.length - 1 || j === 0 ? '800' : '500',
                      color: i === 0 ? r.soluk : r.metin,
                    }}
                  >
                    {h}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
        <Soluk>↑ yüksek gün · Str/Enj/Açl/Snd: 1-5 puan · beslenme sütunları kayıtlarından gelir</Soluk>
      </Kart>

      <Kart baslik="Koç değerlendirmesi" ikon="chatbubbles" ikonRenk={r.uyku}>
        {bulgular.length === 0 && <Soluk>Bu hafta için henüz veri yok.</Soluk>}
        {bulgular.map((b, i) => {
          const g = bulguGorunumu(b.seviye, r);
          return (
            <Satir key={i} style={{ alignItems: 'flex-start', gap: 10 }}>
              <IkonKutu ad={g.ikon} renk={g.renk} boyut={30} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: r.metin, fontWeight: '700' }}>{b.konu}</Text>
                <Text style={{ color: r.soluk, fontSize: 13, lineHeight: 18 }}>{b.metin}</Text>
              </View>
            </Satir>
          );
        })}
        <Soluk>Genel takip önerileridir; kalori ve program değişikliklerini koçunla birlikte karar ver.</Soluk>
      </Kart>

      {p.notlar ? (
        <Kart baslik="Koç notları" ikon="document-text" ikonRenk={r.su}>
          {p.notlar.split('\n').map((l, i) => (
            <Satir key={i} style={{ alignItems: 'flex-start' }}>
              <Ikon ad="ellipse" boyut={6} renk={r.ana} />
              <Text style={{ color: r.metin, flex: 1, fontSize: 14 }}>{l}</Text>
            </Satir>
          ))}
        </Kart>
      ) : null}

      <Buton baslik="Programı düzenle" ikon="settings-outline" tur="ikincil" bas={() => router.push('/koc-program')} />
    </Ekran>
  );
}

/** Seçili günün check-in formu. Gün değişince `key` ile yeniden oluşturulur (form o günün verisiyle başlar). */
function GunlukCheckin({
  db,
  program: p,
  tarih,
  gunVerisi,
  not,
  kaydedildi,
}: {
  db: SQLiteDatabase;
  program: KocProgram;
  tarih: string;
  gunVerisi: GunVerisi | undefined;
  not: string | null;
  kaydedildi: () => void;
}) {
  const r = useRenk();
  const [form, setForm] = useState<Form>(() => formdan(gunVerisi, not));
  const [kaydedildiMi, setKaydedildi] = useState(false);
  const hedef = gunHedefi(p, form.gun_tipi);
  const gunlukKcal = gunVerisi?.kcal ?? 0;

  async function kaydet() {
    await kocGunKaydet(db, {
      tarih,
      gun_tipi: form.gun_tipi,
      kilo: sayiOku(form.kilo),
      uyku: sayiOku(form.uyku),
      stres: form.stres,
      enerji: form.enerji,
      aclik: form.aclik,
      sindirim: form.sindirim,
      kardiyo: form.kardiyo.trim() || null,
      adim: sayiOku(form.adim) != null ? Math.round(sayiOku(form.adim)!) : null,
      notlar: form.notlar.trim() || null,
    });
    setKaydedildi(true);
    kaydedildi();
  }

  const puanAlani = (etiket: string, k: 'stres' | 'enerji' | 'aclik' | 'sindirim', ipucu: string) => (
    <View style={{ gap: 6 }}>
      <Satir style={{ justifyContent: 'space-between' }}>
        <Etiket>{etiket}</Etiket>
        <Text style={{ color: r.soluk, fontSize: 11 }}>{ipucu}</Text>
      </Satir>
      <Secenekler secenekler={PUAN} secili={form[k]} sec={(v) => setForm((f) => ({ ...f, [k]: f[k] === v ? null : v }))} />
    </View>
  );

  return (
    <>
        <Secenekler
          secenekler={[
            { deger: 'normal', ad: `Normal gün · ${gunHedefi(p, 'normal').kalori} kcal` },
            { deger: 'yuksek', ad: `Yüksek gün · ${gunHedefi(p, 'yuksek').kalori} kcal` },
          ]}
          secili={form.gun_tipi}
          sec={(v) => setForm((f) => ({ ...f, gun_tipi: v as GunTipi }))}
        />
        <Satir>
          <Alan etiket="Kilo (kg)" deger={form.kilo} degistir={(t) => setForm((f) => ({ ...f, kilo: t }))} ipucu="sabah aç" />
          <Alan etiket="Uyku (saat)" deger={form.uyku} degistir={(t) => setForm((f) => ({ ...f, uyku: t }))} ipucu="7.5" />
          <Alan etiket="Adım" deger={form.adim} degistir={(t) => setForm((f) => ({ ...f, adim: t }))} ipucu={String(p.adim_hedef)} klavye="number-pad" />
        </Satir>
        {puanAlani('STRES', 'stres', '1 düşük · 5 yüksek')}
        {puanAlani('ENERJİ', 'enerji', '1 düşük · 5 yüksek')}
        {puanAlani('AÇLIK', 'aclik', '1 tok · 5 çok aç')}
        {puanAlani('SİNDİRİM', 'sindirim', '1 kötü · 5 çok iyi')}
        <Alan
          etiket="Kardiyo"
          deger={form.kardiyo}
          degistir={(t) => setForm((f) => ({ ...f, kardiyo: t }))}
          ipucu='ör. 30 dk yürüyüş 5.5 hız 1 eğim · yoksa "Yapılmadı"'
          klavye="default"
        />
        <Alan etiket="Not" deger={form.notlar} degistir={(t) => setForm((f) => ({ ...f, notlar: t }))} ipucu="Koçuna not" klavye="default" />

        <View style={{ backgroundColor: r.kartIkincil, borderRadius: 14, padding: 12, gap: 8 }}>
          <Etiket>BESLENME (KAYITLARINDAN)</Etiket>
          <Satir style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: r.metin, fontWeight: '800', fontSize: 18 }}>
              {Math.round(gunlukKcal)} <Text style={{ color: r.soluk, fontSize: 13 }}>/ {hedef.kalori} kcal</Text>
            </Text>
            <Text style={{ color: r.soluk, fontSize: 12 }}>
              P {Math.round(gunVerisi?.protein ?? 0)}/{hedef.protein} · Y {Math.round(gunVerisi?.yag ?? 0)}/{hedef.yag} · K{' '}
              {Math.round(gunVerisi?.karb ?? 0)}/{hedef.karb}
            </Text>
          </Satir>
          <Ilerleme oran={hedef.kalori ? gunlukKcal / hedef.kalori : 0} />
          <Soluk>
            Su {gunVerisi?.su_l ?? 0} / {p.su_hedef_l} L · Na {Math.round(gunVerisi?.sodyum ?? 0)} mg · K⁺ {Math.round(gunVerisi?.potasyum ?? 0)} mg
          </Soluk>
        </View>

        <Buton baslik={kaydedildiMi ? 'Kaydedildi' : 'Check-in kaydet'} ikon="checkmark" bas={kaydet} />
    </>
  );
}
