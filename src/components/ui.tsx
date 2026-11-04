import { createContext, useContext, useState, type ComponentProps, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useRenk, type Renkler } from '../lib/tema';

export type IkonAdi = ComponentProps<typeof Ionicons>['name'];

/** Bileşenin yatay bir Satir içinde olup olmadığını bilir; esneme davranışı buna göre seçilir. */
const SatirIcinde = createContext(false);

function golge(r: Renkler): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: { shadowColor: r.golge, shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
    android: { elevation: 1 },
    default: { boxShadow: '0 4px 16px rgba(15,42,31,0.06)' } as ViewStyle,
  })!;
}

export function Ikon({ ad, boyut = 20, renk }: { ad: IkonAdi; boyut?: number; renk?: string }) {
  const r = useRenk();
  return <Ionicons name={ad} size={boyut} color={renk ?? r.metin} />;
}

/** Renkli arka planlı yuvarlak köşeli ikon kutusu */
export function IkonKutu({ ad, renk, boyut = 36 }: { ad: IkonAdi; renk: string; boyut?: number }) {
  return (
    <View
      style={{
        width: boyut,
        height: boyut,
        borderRadius: boyut / 3,
        backgroundColor: renk + '22',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={ad} size={boyut * 0.55} color={renk} />
    </View>
  );
}

export function Ekran({ children }: { children: ReactNode }) {
  const r = useRenk();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: r.arka }}
      contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 14 }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Kart({
  baslik,
  ikon,
  ikonRenk,
  children,
  sag,
  style,
}: {
  baslik?: string;
  ikon?: IkonAdi;
  ikonRenk?: string;
  children: ReactNode;
  sag?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const r = useRenk();
  return (
    <View style={[{ backgroundColor: r.kart, borderRadius: 20, padding: 16, gap: 12, borderWidth: 1, borderColor: r.cizgi }, golge(r), style]}>
      {(baslik || sag) && (
        <View style={st.satirArasi}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
            {ikon ? <IkonKutu ad={ikon} renk={ikonRenk ?? r.ana} boyut={30} /> : null}
            {baslik ? <Text style={{ fontSize: 16, fontWeight: '700', color: r.metin }}>{baslik}</Text> : null}
          </View>
          {sag}
        </View>
      )}
      {children}
    </View>
  );
}

export function Satir({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <SatirIcinde.Provider value={true}>
      <View style={[{ flexDirection: 'row', gap: 8, alignItems: 'center' }, style]}>{children}</View>
    </SatirIcinde.Provider>
  );
}

export function Girdi({ style, ...props }: TextInputProps) {
  const r = useRenk();
  return (
    <TextInput
      placeholderTextColor={r.soluk + '99'}
      {...props}
      style={[
        {
          borderWidth: 1,
          borderColor: r.cizgi,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 16,
          color: r.metin,
          backgroundColor: r.girdiArka,
          minWidth: 0,
        },
        style,
      ]}
    />
  );
}

export function Alan({
  etiket,
  deger,
  degistir,
  ipucu,
  klavye = 'decimal-pad',
  genis = 1,
}: {
  etiket: string;
  deger: string;
  degistir: (s: string) => void;
  ipucu?: string;
  klavye?: KeyboardTypeOptions;
  genis?: number;
}) {
  const yatay = useContext(SatirIcinde);
  return (
    <View style={[{ gap: 6, minWidth: 0 }, yatay && { flex: genis }]}>
      <Etiket>{etiket}</Etiket>
      <Girdi value={deger} onChangeText={degistir} placeholder={ipucu} keyboardType={klavye} />
    </View>
  );
}

export function Buton({
  baslik,
  bas,
  tur = 'ana',
  ikon,
  devreDisi,
}: {
  baslik: string;
  bas: () => void;
  tur?: 'ana' | 'ikincil' | 'tehlike';
  ikon?: IkonAdi;
  devreDisi?: boolean;
}) {
  const r = useRenk();
  const yatay = useContext(SatirIcinde);
  const arka = tur === 'ana' ? r.ana : tur === 'tehlike' ? r.kirmiziAcik : r.anaAcik;
  const yazi = tur === 'ana' ? r.anaYazi : tur === 'tehlike' ? r.kirmizi : r.anaKoyu;
  return (
    <Pressable
      onPress={bas}
      disabled={devreDisi}
      style={({ pressed }) => [
        st.buton,
        yatay && { flexGrow: 1 },
        { backgroundColor: arka, opacity: devreDisi ? 0.5 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}
    >
      {ikon ? <Ionicons name={ikon} size={18} color={yazi} /> : null}
      <Text style={{ fontSize: 15, fontWeight: '700', color: yazi }}>{baslik}</Text>
    </Pressable>
  );
}

export function Secenekler<T extends string | number>({
  secenekler,
  secili,
  sec,
}: {
  secenekler: readonly { deger: T; ad: string }[];
  secili: T | null;
  sec: (d: T) => void;
}) {
  const r = useRenk();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {secenekler.map((o) => {
        const aktif = o.deger === secili;
        return (
          <Pressable
            key={String(o.deger)}
            onPress={() => sec(o.deger)}
            style={{
              borderWidth: 1,
              borderColor: aktif ? r.ana : r.cizgi,
              backgroundColor: aktif ? r.ana : r.girdiArka,
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <Text style={{ color: aktif ? r.anaYazi : r.metin, fontWeight: '600' }}>{o.ad}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Deger({ etiket, deger, alt, renkli }: { etiket: string; deger: string; alt?: string; renkli?: string }) {
  const r = useRenk();
  return (
    <View style={{ flex: 1, minWidth: 80, gap: 2 }}>
      <Etiket>{etiket}</Etiket>
      <Text style={{ fontSize: 22, fontWeight: '800', color: renkli ?? r.metin }}>{deger}</Text>
      {alt ? <Soluk>{alt}</Soluk> : null}
    </View>
  );
}

export function Ilerleme({ oran, renkli }: { oran: number; renkli?: string }) {
  const r = useRenk();
  const yuzde = Math.max(0, Math.min(1, oran)) * 100;
  return (
    <View style={{ height: 10, borderRadius: 5, backgroundColor: r.halkaArka, overflow: 'hidden' }}>
      <View
        style={{ height: '100%', borderRadius: 5, width: `${yuzde}%`, backgroundColor: oran > 1 ? r.turuncu : (renkli ?? r.ana) }}
      />
    </View>
  );
}

/** Dairesel ilerleme halkası. oran 1'i geçerse uyarı rengine döner. */
export function Halka({
  oran,
  boyut = 180,
  kalinlik = 16,
  renkli,
  children,
}: {
  oran: number;
  boyut?: number;
  kalinlik?: number;
  renkli?: string;
  children?: ReactNode;
}) {
  const r = useRenk();
  const yaricap = (boyut - kalinlik) / 2;
  const cevre = 2 * Math.PI * yaricap;
  const o = Math.max(0, Math.min(1, Number.isFinite(oran) ? oran : 0));
  const merkez = boyut / 2;
  return (
    <View style={{ width: boyut, height: boyut, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={boyut} height={boyut} style={StyleSheet.absoluteFill}>
        <Circle cx={merkez} cy={merkez} r={yaricap} stroke={r.halkaArka} strokeWidth={kalinlik} fill="none" />
        {o > 0 && (
          <Circle
            cx={merkez}
            cy={merkez}
            r={yaricap}
            stroke={oran > 1 ? r.turuncu : (renkli ?? r.ana)}
            strokeWidth={kalinlik}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${cevre} ${cevre}`}
            strokeDashoffset={cevre * (1 - o)}
            transform={`rotate(-90 ${merkez} ${merkez})`}
          />
        )}
      </Svg>
      {children}
    </View>
  );
}

export function ListeSatiri({ sol, alt, sag, sil }: { sol: string; alt?: string; sag?: string; sil?: () => void }) {
  const r = useRenk();
  return (
    <View style={[st.listeSatiri, { borderTopColor: r.cizgi }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: r.metin, fontWeight: '600', fontSize: 15 }}>{sol}</Text>
        {alt ? <Soluk>{alt}</Soluk> : null}
      </View>
      {sag ? <Text style={{ color: r.metin, fontWeight: '700', fontSize: 15 }}>{sag}</Text> : null}
      {sil ? (
        <Pressable onPress={sil} hitSlop={10} style={{ paddingLeft: 12 }}>
          <Ionicons name="trash-outline" size={18} color={r.kirmizi} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function TarihGezgini({ metin, geri, ileri }: { metin: string; geri: () => void; ileri?: () => void }) {
  const r = useRenk();
  const dugme = (ad: IkonAdi, bas: (() => void) | undefined) => (
    <Pressable
      onPress={bas}
      disabled={!bas}
      hitSlop={8}
      style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: r.anaAcik, alignItems: 'center', justifyContent: 'center', opacity: bas ? 1 : 0.35 }}
    >
      <Ionicons name={ad} size={20} color={r.anaKoyu} />
    </Pressable>
  );
  return (
    <View style={[st.satirArasi, { paddingHorizontal: 4 }]}>
      {dugme('chevron-back', geri)}
      <Text style={{ fontSize: 17, fontWeight: '700', color: r.metin }}>{metin}</Text>
      {dugme('chevron-forward', ileri)}
    </View>
  );
}

export function Etiket({ children }: { children: ReactNode }) {
  const r = useRenk();
  return <Text style={{ fontSize: 12, color: r.soluk, fontWeight: '600', letterSpacing: 0.3 }}>{children}</Text>;
}

export function Soluk({ children }: { children: ReactNode }) {
  const r = useRenk();
  return <Text style={{ fontSize: 13, color: r.soluk, lineHeight: 18 }}>{children}</Text>;
}

export function Yazi({ children, boyut = 15, kalin, renkli }: { children: ReactNode; boyut?: number; kalin?: boolean; renkli?: string }) {
  const r = useRenk();
  return <Text style={{ fontSize: boyut, color: renkli ?? r.metin, fontWeight: kalin ? '700' : '400' }}>{children}</Text>;
}

/** Çubuk grafik. degerler eskiden yeniye sıralı olmalı. Taban 0'dan başlar (süre gibi değerler için). */
export function MiniGrafik({ degerler, yukseklik = 70, renkli }: { degerler: number[]; yukseklik?: number; renkli?: string }) {
  const r = useRenk();
  if (degerler.length < 2) return <Soluk>Grafik için en az 2 kayıt gerekli.</Soluk>;
  const max = Math.max(...degerler) || 1;
  const ana = renkli ?? r.ana;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', height: yukseklik, gap: 6 }}>
      {degerler.map((d, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            maxWidth: 28,
            height: Math.max(6, (d / max) * yukseklik),
            backgroundColor: i === degerler.length - 1 ? ana : ana + '55',
            borderRadius: 6,
          }}
        />
      ))}
    </View>
  );
}

/** Dolgulu çizgi grafik (kilo trendi gibi). degerler eskiden yeniye sıralı olmalı. */
export function CizgiGrafik({ degerler, yukseklik = 90, renkli }: { degerler: number[]; yukseklik?: number; renkli?: string }) {
  const r = useRenk();
  const [genislik, setGenislik] = useState(0);
  if (degerler.length < 2) return <Soluk>Trend için en az 2 kayıt gerekli.</Soluk>;
  const ana = renkli ?? r.ana;
  const min = Math.min(...degerler);
  const max = Math.max(...degerler);
  const aralik = max - min || 1;
  const pay = 8;
  const noktalar = degerler.map((d, i) => ({
    x: pay + (i / (degerler.length - 1)) * Math.max(0, genislik - pay * 2),
    y: pay + (1 - (d - min) / aralik) * (yukseklik - pay * 2),
  }));
  const cizgi = noktalar.map((n, i) => `${i ? 'L' : 'M'}${n.x.toFixed(1)},${n.y.toFixed(1)}`).join(' ');
  const alan = `${cizgi} L${noktalar[noktalar.length - 1].x},${yukseklik} L${noktalar[0].x},${yukseklik} Z`;
  const son = noktalar[noktalar.length - 1];
  return (
    <View style={{ gap: 4 }}>
      <View style={{ height: yukseklik }} onLayout={(e) => setGenislik(e.nativeEvent.layout.width)}>
        {genislik > 0 && (
          <Svg width={genislik} height={yukseklik}>
            <Defs>
              <LinearGradient id="dolgu" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={ana} stopOpacity={0.3} />
                <Stop offset="1" stopColor={ana} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={alan} fill="url(#dolgu)" />
            <Path d={cizgi} stroke={ana} strokeWidth={3} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            <Circle cx={son.x} cy={son.y} r={5} fill={r.kart} stroke={ana} strokeWidth={3} />
          </Svg>
        )}
      </View>
      <View style={st.satirArasi}>
        <Soluk>en düşük {Math.round(min * 10) / 10}</Soluk>
        <Soluk>en yüksek {Math.round(max * 10) / 10}</Soluk>
      </View>
    </View>
  );
}

export const st = StyleSheet.create({
  satirArasi: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  buton: {
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  listeSatiri: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
