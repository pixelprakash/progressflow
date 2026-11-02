import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/auth';
import { StoreProvider, useStore } from './src/store';
import { SyncProvider } from './src/sync';
import { scanPages, pickFromGallery } from './src/capture/scan';
import { AuthScreen } from './src/screens/AuthScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ClassScreen } from './src/screens/ClassScreen';
import { ReviewScreen } from './src/screens/ReviewScreen';
import { EvaluateScreen } from './src/screens/EvaluateScreen';
import { StudentScreen } from './src/screens/StudentScreen';
import { theme } from './src/theme';

type Route =
  | { name: 'home' }
  | { name: 'class'; id: string }
  | { name: 'review'; classId: string; uris: string[] }
  | { name: 'evaluate'; id: string }
  | { name: 'student'; id: string };

function Root() {
  const { ready } = useStore();
  const [stack, setStack] = useState<Route[]>([{ name: 'home' }]);
  const route = stack[stack.length - 1] ?? { name: 'home' };
  const push = (r: Route) => setStack((s) => [...s, r]);
  const pop = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 1 && route.name !== 'review') {
        pop();
        return true;
      }
      return route.name === 'review'; // review confirms discard itself
    });
    return () => sub.remove();
  }, [stack.length, route.name]);

  if (!ready)
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={theme.color.primary} />
      </View>
    );

  const startReview = (classId: string) => (uris: string[]) =>
    uris.length && push({ name: 'review', classId, uris });

  switch (route.name) {
    case 'review':
      return (
        <ReviewScreen
          classId={route.classId}
          initialUris={route.uris}
          onCancel={pop}
          onSaved={(ids) =>
            setStack(
              ids.length === 1 && ids[0]
                ? [
                    { name: 'home' },
                    { name: 'class', id: route.classId },
                    { name: 'evaluate', id: ids[0] },
                  ]
                : [{ name: 'home' }, { name: 'class', id: route.classId }],
            )
          }
        />
      );
    case 'evaluate':
      return (
        <EvaluateScreen
          submissionId={route.id}
          onBack={pop}
          onStudent={(id) => push({ name: 'student', id })}
        />
      );
    case 'student':
      return (
        <StudentScreen
          studentId={route.id}
          onBack={pop}
          onOpen={(id) => push({ name: 'evaluate', id })}
        />
      );
    case 'class':
      return (
        <ClassScreen
          classId={route.id}
          onBack={pop}
          onScan={() => void scanPages().then(startReview(route.id))}
          onGallery={() => void pickFromGallery().then(startReview(route.id))}
          onOpenSubmission={(id) => push({ name: 'evaluate', id })}
          onOpenStudent={(id) => push({ name: 'student', id })}
        />
      );
    default:
      return <HomeScreen onOpenClass={(id) => push({ name: 'class', id })} />;
  }
}

function AuthGate() {
  const { loading, current } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={theme.color.primary} />
      </View>
    );
  }
  if (!current) return <AuthScreen />;
  // key: each teacher gets a fresh store and a fresh navigation stack
  return (
    <StoreProvider key={current.id} dataDir={current.dataDir}>
      <SyncProvider>
        <Root />
      </SyncProvider>
    </StoreProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
