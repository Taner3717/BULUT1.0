import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

export const SU_KATEGORI = 'su_hatirlatici';
export const SU_EKLE_AKSIYON = 'su_ekle_250';
export const SU_AKSIYON_ML = 250;
const KANAL = 'su';
const ID_ON_EK = 'su_';

export type SuAyari = {
  aktif: boolean;
  baslangic: string; // "09:00"
  bitis: string; // "22:00"
  aralikDk: number;
  hedefMl: number | null; // null → kiloya göre otomatik
};

export const VARSAYILAN_SU_AYARI: SuAyari = {
  aktif: false,
  baslangic: '09:00',
  bitis: '22:00',
  aralikDk: 90,
  hedefMl: null,
};

export function bildirimIsleyiciKur() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function bildirimIzniIste(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(KANAL, {
      name: 'Su hatırlatıcısı',
      importance: AndroidImportance.DEFAULT,
    });
  }
  const mevcut = await Notifications.getPermissionsAsync();
  if (mevcut.granted) return true;
  const istek = await Notifications.requestPermissionsAsync();
  return istek.granted;
}

/** Başlangıç-bitiş arasında her aralikDk'da bir saat üretir. */
export function hatirlatmaSaatleri(baslangicDk: number, bitisDk: number, aralikDk: number) {
  const saatler: { hour: number; minute: number }[] = [];
  if (aralikDk < 15 || bitisDk <= baslangicDk) return saatler;
  for (let t = baslangicDk; t <= bitisDk && saatler.length < 48; t += aralikDk) {
    saatler.push({ hour: Math.floor(t / 60), minute: t % 60 });
  }
  return saatler;
}

export async function suHatirlaticilariniIptalEt() {
  if (Platform.OS === 'web') return;
  const planli = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    planli
      .filter((n) => n.identifier.startsWith(ID_ON_EK))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/** Her hatırlatma saati için günlük tekrarlayan yerel bildirim kurar. Kurulan bildirim sayısını döner. */
export async function suHatirlaticilariniKur(saatler: { hour: number; minute: number }[]) {
  await suHatirlaticilariniIptalEt();
  await Notifications.setNotificationCategoryAsync(SU_KATEGORI, [
    {
      identifier: SU_EKLE_AKSIYON,
      buttonTitle: `+${SU_AKSIYON_ML} ml içtim`,
      options: { opensAppToForeground: true },
    },
  ]);
  for (const { hour, minute } of saatler) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${ID_ON_EK}${hour}_${minute}`,
      content: {
        title: 'Su vakti 💧',
        body: 'Bir bardak su içmeyi unutma.',
        categoryIdentifier: SU_KATEGORI,
        data: { tip: 'su' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: KANAL,
      },
    });
  }
  return saatler.length;
}
