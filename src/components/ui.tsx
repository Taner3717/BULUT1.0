import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export const renk = {
  arka: '#F2F5FA',
  kart: '#FFFFFF',
  ana: '#2E86DE',
  anaAcik: '#E3F0FC',
  metin: '#1B2733',
  soluk: '#6B7A89',
  cizgi: '#E1E7EE',
  yesil: '#2BAE66',
  turuncu: '#F39C12',
  kirmizi: '#E74C3C',
};

export function Ekran({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: renk.arka }}
      contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 12 }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Kart({ baslik, children, sag }: { baslik?: string; children: ReactNode; sag?: ReactNode }) {
  return (
    <View style={s.kart}>
      {(baslik || sag) && (
        <View style={s.satirArasi}>
          {baslik ? <Text style={s.kartBaslik}>{baslik}</Text> : <View />}
          {sag}
        </View>
      )}
      {children}
    </View>
  );
}

export function Satir({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', gap: 8, alignItems: 'center' }, style]}>{children}</View>;
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
  return (
    <View style={{ flex: genis, gap: 4 }}>
      <Text style={s.etiket}>{etiket}</Text>
      <TextInput
        style={s.girdi}
        value={deger}
        onChangeText={degistir}
        placeholder={ipucu}
        placeholderTextColor="#A5B1BD"
        keyboardType={klavye}
      />
    </View>
  );
}

export function Buton({
  baslik,
  bas,
  tur = 'ana',
  devreDisi,
}: {
  baslik: string;
  bas: () => void;
  tur?: 'ana' | 'ikincil' | 'tehlike';
  devreDisi?: boolean;
}) {
  const arka = tur === 'ana' ? renk.ana : tur === 'tehlike' ? '#FDECEA' : renk.anaAcik;
  const yazi = tur === 'ana' ? '#fff' : tur === 'tehlike' ? renk.kirmizi : renk.ana;
  return (
    <Pressable
      onPress={bas}
      disabled={devreDisi}
      style={({ pressed }) => [s.buton, { backgroundColor: arka, opacity: devreDisi ? 0.5 : pressed ? 0.8 : 1 }]}
    >
      <Text style={[s.butonYazi, { color: yazi }]}>{baslik}</Text>
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
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {secenekler.map((o) => {
        const aktif = o.deger === secili;
        return (
          <Pressable
            key={String(o.deger)}
            onPress={() => sec(o.deger)}
            style={[s.cip, aktif && { backgroundColor: renk.ana, borderColor: renk.ana }]}
          >
            <Text style={{ color: aktif ? '#fff' : renk.metin, fontWeight: '500' }}>{o.ad}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Deger({ etiket, deger, alt, renkli }: { etiket: string; deger: string; alt?: string; renkli?: string }) {
  return (
    <View style={{ flex: 1, minWidth: 90 }}>
      <Text style={s.etiket}>{etiket}</Text>
      <Text style={[s.buyukDeger, renkli ? { color: renkli } : null]}>{deger}</Text>
      {alt ? <Text style={s.soluk}>{alt}</Text> : null}
    </View>
  );
}

export function Ilerleme({ oran, renkli = renk.ana }: { oran: number; renkli?: string }) {
  const yuzde = Math.max(0, Math.min(1, oran)) * 100;
  return (
    <View style={s.ilerlemeArka}>
      <View style={[s.ilerlemeDolu, { width: `${yuzde}%`, backgroundColor: oran > 1 ? renk.turuncu : renkli }]} />
    </View>
  );
}

export function ListeSatiri({ sol, alt, sag, sil }: { sol: string; alt?: string; sag?: string; sil?: () => void }) {
  return (
    <View style={s.listeSatiri}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: renk.metin, fontWeight: '500' }}>{sol}</Text>
        {alt ? <Text style={s.soluk}>{alt}</Text> : null}
      </View>
      {sag ? <Text style={{ color: renk.metin, fontWeight: '600' }}>{sag}</Text> : null}
      {sil ? (
        <Pressable onPress={sil} hitSlop={10} style={{ paddingLeft: 12 }}>
          <Text style={{ color: renk.kirmizi, fontSize: 16 }}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function TarihGezgini({ metin, geri, ileri }: { metin: string; geri: () => void; ileri?: () => void }) {
  return (
    <View style={[s.kart, s.satirArasi, { paddingVertical: 10 }]}>
      <Pressable onPress={geri} hitSlop={12}>
        <Text style={s.ok}>‹</Text>
      </Pressable>
      <Text style={s.kartBaslik}>{metin}</Text>
      <Pressable onPress={ileri} disabled={!ileri} hitSlop={12}>
        <Text style={[s.ok, !ileri && { opacity: 0.2 }]}>›</Text>
      </Pressable>
    </View>
  );
}

export function Soluk({ children }: { children: ReactNode }) {
  return <Text style={s.soluk}>{children}</Text>;
}

/** Bar grafiği (ek kütüphane gerektirmez). degerler eskiden yeniye sıralı olmalı. */
export function MiniGrafik({ degerler, yukseklik = 60 }: { degerler: number[]; yukseklik?: number }) {
  if (degerler.length < 2) return <Soluk>Grafik için en az 2 kayıt gerekli.</Soluk>;
  const min = Math.min(...degerler);
  const max = Math.max(...degerler);
  const aralik = max - min || 1;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: yukseklik, gap: 3 }}>
      {degerler.map((d, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 6 + ((d - min) / aralik) * (yukseklik - 6),
            backgroundColor: i === degerler.length - 1 ? renk.ana : '#A9CCF0',
            borderRadius: 3,
          }}
        />
      ))}
    </View>
  );
}

export const s = StyleSheet.create({
  kart: { backgroundColor: renk.kart, borderRadius: 14, padding: 14, gap: 10 },
  kartBaslik: { fontSize: 16, fontWeight: '700', color: renk.metin },
  satirArasi: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  etiket: { fontSize: 12, color: renk.soluk, fontWeight: '500' },
  girdi: {
    borderWidth: 1,
    borderColor: renk.cizgi,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 16,
    color: renk.metin,
    backgroundColor: '#FAFCFE',
  },
  buton: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', flexGrow: 1 },
  butonYazi: { fontSize: 15, fontWeight: '600' },
  cip: {
    borderWidth: 1,
    borderColor: renk.cizgi,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#fff',
  },
  buyukDeger: { fontSize: 22, fontWeight: '700', color: renk.metin },
  soluk: { fontSize: 13, color: renk.soluk },
  ilerlemeArka: { height: 10, borderRadius: 5, backgroundColor: renk.cizgi, overflow: 'hidden' },
  ilerlemeDolu: { height: '100%', borderRadius: 5 },
  listeSatiri: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: renk.cizgi,
  },
  ok: { fontSize: 28, color: renk.ana, paddingHorizontal: 8, lineHeight: 30 },
});
