import 'expo-sqlite/localStorage/install';
import { createClient, FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import type { BesinKalemi } from './calc';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANAHTAR = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const fotoAnalizHazir = Boolean(URL && ANAHTAR);

let istemci: SupabaseClient | null = null;

function supabase(): SupabaseClient {
  if (!URL || !ANAHTAR) throw new Error('Supabase ayarları eksik (.env dosyasını doldur).');
  if (!istemci) {
    istemci = createClient(URL, ANAHTAR, {
      auth: {
        storage: localStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
    if (Platform.OS !== 'web') {
      // Uygulama ön plandayken oturum jetonunu yenile
      AppState.addEventListener('change', (durum) => {
        if (durum === 'active') istemci?.auth.startAutoRefresh();
        else istemci?.auth.stopAutoRefresh();
      });
    }
  }
  return istemci;
}

/** Hesap gerektirmeden cihaza özel anonim kullanıcı oturumu açar (bir kez). */
async function oturumuGaranti() {
  const s = supabase();
  const { data } = await s.auth.getSession();
  if (data.session) return;
  const { error } = await s.auth.signInAnonymously();
  if (error) throw new Error('Sunucuya bağlanılamadı: ' + error.message);
}

export type FotoAnalizSonucu = {
  yemekler: BesinKalemi[];
  guven: 'dusuk' | 'orta' | 'yuksek';
  not: string;
};

export async function fotoAnalizEt(base64: string, tur: string, not: string): Promise<FotoAnalizSonucu> {
  await oturumuGaranti();
  const { data, error } = await supabase().functions.invoke<FotoAnalizSonucu>('yemek-analiz', {
    body: { gorsel: base64, tur, not },
  });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const govde = await error.context.json().catch(() => null);
      throw new Error(govde?.hata ?? 'Analiz başarısız oldu.');
    }
    throw new Error('Bağlantı hatası, internetini kontrol et.');
  }
  if (!data) throw new Error('Boş yanıt');
  return data;
}
