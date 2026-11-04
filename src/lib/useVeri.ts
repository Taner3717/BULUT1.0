import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';

/**
 * Ekran her odaklandığında (sekme değişince) ve yenile() çağrılınca veriyi yeniden yükler.
 * yukle fonksiyonu bağımlılıklar değişince yeniden oluşturulmalı (useCallback).
 */
export function useVeri<T>(yukle: (db: SQLiteDatabase) => Promise<T>) {
  const db = useSQLiteContext();
  const [veri, setVeri] = useState<T | null>(null);

  const yenile = useCallback(async () => {
    setVeri(await yukle(db));
  }, [db, yukle]);

  useFocusEffect(
    useCallback(() => {
      yenile();
    }, [yenile]),
  );

  return { veri, yenile, db };
}
