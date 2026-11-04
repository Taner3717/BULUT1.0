import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { ayarGetir, ayarKaydet } from './db';

const acik = {
  arka: '#F3FAF6',
  kart: '#FFFFFF',
  kartIkincil: '#ECF7F1',
  ana: '#10B981',
  anaKoyu: '#059669',
  anaAcik: '#D1FAE5',
  anaYazi: '#FFFFFF',
  vurgu: '#84CC16',
  metin: '#0F2A1F',
  soluk: '#5B7268',
  cizgi: '#E2EEE7',
  girdiArka: '#F8FCFA',
  halkaArka: '#E3F1E9',
  su: '#0EA5E9',
  uyku: '#8B5CF6',
  protein: '#F59E0B',
  kirmizi: '#EF4444',
  kirmiziAcik: '#FEE2E2',
  turuncu: '#F59E0B',
  golge: '#0F2A1F',
};

export type Renkler = typeof acik;

const koyu: Renkler = {
  arka: '#0B1410',
  kart: '#13201A',
  kartIkincil: '#1A2A22',
  ana: '#34D399',
  anaKoyu: '#10B981',
  anaAcik: '#123B2C',
  anaYazi: '#06281C',
  vurgu: '#A3E635',
  metin: '#E6F4EC',
  soluk: '#8FA89C',
  cizgi: '#223229',
  girdiArka: '#0F1A15',
  halkaArka: '#1E3128',
  su: '#38BDF8',
  uyku: '#A78BFA',
  protein: '#FBBF24',
  kirmizi: '#F87171',
  kirmiziAcik: '#3B1A1A',
  turuncu: '#FBBF24',
  golge: '#000000',
};

export type GorunumModu = 'otomatik' | 'acik' | 'koyu';

type TemaDegeri = { renk: Renkler; koyuMu: boolean; mod: GorunumModu; modDegistir: (m: GorunumModu) => void };

const TemaContext = createContext<TemaDegeri>({ renk: acik, koyuMu: false, mod: 'otomatik', modDegistir: () => {} });

/** Sistem temasını izler; kullanıcı "Açık" veya "Koyu" seçerse onu uygular (SQLite'ta saklanır). */
export function TemaSaglayici({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const sistem = useColorScheme();
  const [mod, setMod] = useState<GorunumModu>('otomatik');

  useEffect(() => {
    ayarGetir(db, 'gorunum', { mod: 'otomatik' as GorunumModu }).then((a) => setMod(a.mod));
  }, [db]);

  const modDegistir = useCallback(
    (m: GorunumModu) => {
      setMod(m);
      ayarKaydet(db, 'gorunum', { mod: m });
    },
    [db],
  );

  const koyuMu = mod === 'koyu' || (mod === 'otomatik' && sistem === 'dark');
  const deger = useMemo(() => ({ renk: koyuMu ? koyu : acik, koyuMu, mod, modDegistir }), [koyuMu, mod, modDegistir]);
  return <TemaContext.Provider value={deger}>{children}</TemaContext.Provider>;
}

export function useTema() {
  return useContext(TemaContext);
}

export function useRenk() {
  return useContext(TemaContext).renk;
}
