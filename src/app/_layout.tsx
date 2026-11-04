import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { DB_ADI, ayarGetir, ayarKaydet, suEkle, veritabaniHazirla } from '../lib/db';
import { SU_AKSIYON_ML, SU_EKLE_AKSIYON, bildirimIsleyiciKur } from '../lib/notifications';

bildirimIsleyiciKur();

/** Bildirimdeki "+250 ml içtim" butonuna basılınca su kaydı ekler. */
function SuBildirimDinleyici() {
  const db = useSQLiteContext();

  useEffect(() => {
    if (Platform.OS === 'web') return;

    async function isle(yanit: Notifications.NotificationResponse) {
      if (yanit.actionIdentifier !== SU_EKLE_AKSIYON) return;
      // Aynı yanıtı iki kez işlememek için (uygulama soğuk açılışta son yanıtı tekrar verir)
      const anahtar = `${yanit.notification.request.identifier}@${yanit.notification.date}`;
      const son = await ayarGetir(db, 'son_su_yaniti', { anahtar: '' });
      if (son.anahtar === anahtar) return;
      await ayarKaydet(db, 'son_su_yaniti', { anahtar });
      await suEkle(db, SU_AKSIYON_ML);
      await Notifications.dismissNotificationAsync(yanit.notification.request.identifier);
    }

    const son = Notifications.getLastNotificationResponse();
    if (son) isle(son);
    const abonelik = Notifications.addNotificationResponseReceivedListener(isle);
    return () => abonelik.remove();
  }, [db]);

  return null;
}

export default function KokDuzen() {
  return (
    <SQLiteProvider databaseName={DB_ADI} onInit={veritabaniHazirla}>
      <StatusBar style="dark" />
      <SuBildirimDinleyici />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="profil" options={{ title: 'Profil', presentation: 'modal' }} />
        <Stack.Screen name="foto" options={{ title: 'Fotoğrafla ekle', presentation: 'modal' }} />
      </Stack>
    </SQLiteProvider>
  );
}
