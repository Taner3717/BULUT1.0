import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRenk } from '../../lib/tema';

type IkonAdi = ComponentProps<typeof Ionicons>['name'];

function ikon(aktif: IkonAdi, pasif: IkonAdi) {
  return function SekmeIkonu({ focused, color }: { focused: boolean; color: ColorValue }) {
    return <Ionicons name={focused ? aktif : pasif} size={24} color={color as string} />;
  };
}

export default function SekmeDuzeni() {
  const r = useRenk();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: r.ana,
        tabBarInactiveTintColor: r.soluk,
        tabBarStyle: { backgroundColor: r.kart, borderTopColor: r.cizgi },
        tabBarLabelStyle: { fontWeight: '600' },
        headerStyle: { backgroundColor: r.arka },
        headerTintColor: r.metin,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '800', fontSize: 20 },
        sceneStyle: { backgroundColor: r.arka },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Bugün', headerShown: false, tabBarIcon: ikon('today', 'today-outline') }} />
      <Tabs.Screen name="koc" options={{ title: 'Koç', tabBarIcon: ikon('trophy', 'trophy-outline') }} />
      <Tabs.Screen name="kalori" options={{ title: 'Kalori', tabBarIcon: ikon('restaurant', 'restaurant-outline') }} />
      <Tabs.Screen name="olcum" options={{ title: 'Vücut', tabBarIcon: ikon('body', 'body-outline') }} />
      <Tabs.Screen name="uyku" options={{ title: 'Uyku', tabBarIcon: ikon('moon', 'moon-outline') }} />
      <Tabs.Screen name="su" options={{ title: 'Su', tabBarIcon: ikon('water', 'water-outline') }} />
    </Tabs>
  );
}
