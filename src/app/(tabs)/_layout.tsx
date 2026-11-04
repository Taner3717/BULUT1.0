import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { renk } from '../../components/ui';

function ikon(emoji: string) {
  return function SekmeIkonu({ focused }: { focused: boolean }) {
    return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
  };
}

export default function SekmeDuzeni() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: renk.ana,
        headerStyle: { backgroundColor: renk.arka },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Bugün', tabBarIcon: ikon('☁️') }} />
      <Tabs.Screen name="kalori" options={{ title: 'Kalori', tabBarIcon: ikon('🍽️') }} />
      <Tabs.Screen name="olcum" options={{ title: 'Kilo & Ölçü', tabBarIcon: ikon('⚖️') }} />
      <Tabs.Screen name="uyku" options={{ title: 'Uyku', tabBarIcon: ikon('🌙') }} />
      <Tabs.Screen name="su" options={{ title: 'Su', tabBarIcon: ikon('💧') }} />
    </Tabs>
  );
}
