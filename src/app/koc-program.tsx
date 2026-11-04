import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert, Text, TextInput, View } from 'react-native';
import { Alan, Buton, Ekran, Etiket, Kart, Satir, Soluk } from '../components/ui';
import { sayiOku } from '../lib/calc';
import { kocProgramGetir, kocProgramKaydet } from '../lib/db';
import { VARSAYILAN_PROGRAM, hedefKilo, makroKalori, type KocProgram } from '../lib/koc';
import { useRenk } from '../lib/tema';

type Form = Record<Exclude<keyof KocProgram, 'notlar'>, string> & { notlar: string };

function formdan(p: KocProgram): Form {
  return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v == null ? '' : String(v)])) as Form;
}

export default function KocProgramEkrani() {
  const db = useSQLiteContext();
  const r = useRenk();
  const [f, setF] = useState<Form>(formdan(VARSAYILAN_PROGRAM));
  const [yeni, setYeni] = useState(true);

  useEffect(() => {
    kocProgramGetir(db).then((p) => {
      if (p) {
        setF(formdan(p));
        setYeni(false);
      }
    });
  }, [db]);

  const alan = (k: keyof Form) => (t: string) => setF((x) => ({ ...x, [k]: t }));
  const n = (k: keyof Form) => sayiOku(f[k]);

  const normalKcal = makroKalori(n('normal_p') ?? 0, n('normal_y') ?? 0, n('normal_k') ?? 0);
  const yuksekKcal = makroKalori(n('yuksek_p') ?? 0, n('yuksek_y') ?? 0, n('yuksek_k') ?? 0);
  const bitisKilo =
    n('baslangic_kilo') != null && n('haftalik_hedef') != null
      ? hedefKilo({ baslangic_kilo: n('baslangic_kilo')!, haftalik_hedef: n('haftalik_hedef')! }, n('hafta') ?? 8)
      : null;

  async function kaydet() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.baslangic.trim())) {
      Alert.alert('Başlangıç tarihi', 'Tarihi YYYY-AA-GG biçiminde gir (ör. 2026-11-02).');
      return;
    }
    const sayisal = [
      'hafta', 'baslangic_kilo', 'haftalik_hedef', 'normal_p', 'normal_y', 'normal_k', 'yuksek_p', 'yuksek_y', 'yuksek_k',
      'adim_hedef', 'sodyum_min', 'sodyum_max', 'potasyum_min', 'potasyum_max', 'su_hedef_l', 'yuksek_gun_hafta',
    ] as const;
    const eksik = sayisal.filter((k) => n(k) == null);
    if (eksik.length) {
      Alert.alert('Eksik bilgi', 'Tüm sayısal alanları doldur.');
      return;
    }
    const p = {
      ...(Object.fromEntries(sayisal.map((k) => [k, n(k)])) as Record<(typeof sayisal)[number], number>),
      baslangic: f.baslangic.trim(),
      notlar: f.notlar.trim() || null,
    } as KocProgram;
    p.hafta = Math.round(p.hafta);
    p.adim_hedef = Math.round(p.adim_hedef);
    p.yuksek_gun_hafta = Math.round(p.yuksek_gun_hafta);
    await kocProgramKaydet(db, p);
    router.back();
  }

  return (
    <Ekran>
      {yeni && (
        <Kart style={{ backgroundColor: r.anaAcik, borderColor: r.anaAcik }}>
          <Soluk>Alanlar koç dosyandaki (“Kilo Takip Tablosu”) değerlerle dolduruldu. Gerekirse değiştirip kaydet.</Soluk>
        </Kart>
      )}

      <Kart baslik="Program" ikon="calendar">
        <Satir>
          <Alan etiket="Başlangıç (pazartesi)" deger={f.baslangic} degistir={alan('baslangic')} ipucu="2026-11-02" klavye="numbers-and-punctuation" genis={2} />
          <Alan etiket="Süre (hafta)" deger={f.hafta} degistir={alan('hafta')} klavye="number-pad" />
        </Satir>
        <Satir>
          <Alan etiket="Başlangıç kilosu" deger={f.baslangic_kilo} degistir={alan('baslangic_kilo')} />
          <Alan etiket="Haftalık hedef (kg)" deger={f.haftalik_hedef} degistir={alan('haftalik_hedef')} ipucu="-0.5" klavye="numbers-and-punctuation" />
        </Satir>
        <Soluk>
          Kilo vermek için eksi değer gir.{bitisKilo != null ? ` Program sonu hedef: ${bitisKilo} kg.` : ''}
        </Soluk>
      </Kart>

      <Kart baslik="Beslenme hedefleri" ikon="restaurant" ikonRenk={r.protein}>
        {(['normal', 'yuksek'] as const).map((tip) => (
          <View key={tip} style={{ gap: 6 }}>
            <Satir style={{ justifyContent: 'space-between' }}>
              <Etiket>{tip === 'normal' ? 'NORMAL GÜN' : 'YÜKSEK GÜN'}</Etiket>
              <Text style={{ color: r.metin, fontWeight: '800' }}>{tip === 'normal' ? normalKcal : yuksekKcal} kcal</Text>
            </Satir>
            <Satir>
              <Alan etiket="Protein (g)" deger={f[`${tip}_p`]} degistir={alan(`${tip}_p`)} />
              <Alan etiket="Yağ (g)" deger={f[`${tip}_y`]} degistir={alan(`${tip}_y`)} />
              <Alan etiket="Karb (g)" deger={f[`${tip}_k`]} degistir={alan(`${tip}_k`)} />
            </Satir>
          </View>
        ))}
        <Alan etiket="Haftada kaç yüksek gün" deger={f.yuksek_gun_hafta} degistir={alan('yuksek_gun_hafta')} klavye="number-pad" />
      </Kart>

      <Kart baslik="Aktivite, su ve mineraller" ikon="walk" ikonRenk={r.uyku}>
        <Satir>
          <Alan etiket="Adım hedefi" deger={f.adim_hedef} degistir={alan('adim_hedef')} klavye="number-pad" />
          <Alan etiket="Su (L)" deger={f.su_hedef_l} degistir={alan('su_hedef_l')} />
        </Satir>
        <Satir>
          <Alan etiket="Sodyum min (mg)" deger={f.sodyum_min} degistir={alan('sodyum_min')} klavye="number-pad" />
          <Alan etiket="Sodyum max (mg)" deger={f.sodyum_max} degistir={alan('sodyum_max')} klavye="number-pad" />
        </Satir>
        <Satir>
          <Alan etiket="Potasyum min (mg)" deger={f.potasyum_min} degistir={alan('potasyum_min')} klavye="number-pad" />
          <Alan etiket="Potasyum max (mg)" deger={f.potasyum_max} degistir={alan('potasyum_max')} klavye="number-pad" />
        </Satir>
      </Kart>

      <Kart baslik="Koç notları" ikon="document-text" ikonRenk={r.su}>
        <TextInput
          value={f.notlar}
          onChangeText={alan('notlar')}
          multiline
          placeholder="Koçunun kuralları ve notları"
          placeholderTextColor={r.soluk + '99'}
          style={{
            minHeight: 100,
            borderWidth: 1,
            borderColor: r.cizgi,
            borderRadius: 12,
            padding: 12,
            color: r.metin,
            backgroundColor: r.girdiArka,
            fontSize: 15,
            textAlignVertical: 'top',
          }}
        />
      </Kart>

      <Buton baslik={yeni ? 'Programı başlat' : 'Kaydet'} ikon="checkmark" bas={kaydet} />
    </Ekran>
  );
}
