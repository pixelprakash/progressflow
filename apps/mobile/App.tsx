import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/auth';
import { LangProvider, useLang } from './src/lang';
import { StoreProvider, useStore } from './src/store';
import { SyncProvider } from './src/sync';
import { scanPages, pickFromGallery } from './src/capture/scan';
import { useIntake } from './src/capture/intake';
import { PermissionsGate } from './src/permissions';
import { usePrefs } from './src/hooks';
import { AuthScreen } from './src/screens/AuthScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ClassScreen } from './src/screens/ClassScreen';
import { BatchCaptureScreen } from './src/screens/BatchCaptureScreen';
import { InboxScreen } from './src/screens/InboxScreen';
import { RubricScreen } from './src/screens/RubricScreen';
import { EvaluateScreen } from './src/screens/EvaluateScreen';
import { StudentScreen } from './src/screens/StudentScreen';
import { theme } from './src/theme';

type Route =
  | { name: 'home' }
  | { name: 'class'; id: string }
  | { name: 'capture'; classId: string; replaceId?: string }
  | { name: 'inbox'; classId: string }
  | { name: 'rubric' }
  | { name: 'evaluate'; id: string }
  | { name: 'student'; id: string };

function Root() {
  const { ready } = useStore();
  const { t } = useLang();
  const [stack, setStack] = useState<Route[]>([{ name: 'home' }]);
  const route = stack[stack.length - 1] ?? { name: 'home' };
  const push = (r: Route) => setStack((s) => [...s, r]);
  const pop = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 1) {
        pop();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [stack.length, route.name]);

  if (!ready)
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={theme.color.primary} />
      </View>
    );

  switch (route.name) {
    case 'capture':
      return (
        <BatchCaptureScreen
          classId={route.classId}
          {...(route.replaceId ? { replaceId: route.replaceId } : {})}
          onDone={() => {
            // Straight to the inbox so the papers can be sorted; a retake returns to it too.
            const classId = route.classId;
            setStack((st) => [
              ...st.slice(0, -1).filter((r) => r.name !== 'inbox'),
              { name: 'inbox', classId },
            ]);
          }}
        />
      );
    case 'inbox':
      return (
        <InboxScreen
          classId={route.classId}
          onBack={pop}
          onCapture={(replaceId) =>
            push({ name: 'capture', classId: route.classId, ...(replaceId ? { replaceId } : {}) })
          }
          onFiled={(n) => {
            pop();
            Alert.alert(t('m.inb.filedTitle'), t('m.inb.filedBody', { n }));
          }}
        />
      );
    case 'rubric':
      return <RubricScreen onBack={pop} />;
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
      return <ClassRoute id={route.id} pop={pop} push={push} />;
    default:
      return (
        <HomeScreen
          onOpenClass={(id) => push({ name: 'class', id })}
          onRubric={() => push({ name: 'rubric' })}
        />
      );
  }
}

/** The class screen with its capture shortcuts: camera, scanner or gallery all end in the inbox. */
function ClassRoute({ id, push, pop }: { id: string; push: (r: Route) => void; pop: () => void }) {
  const intake = useIntake(id);
  const prefs = usePrefs();
  const toInbox = (uris: string[]) => {
    if (uris.length) void intake(uris).then((n) => n && push({ name: 'inbox', classId: id }));
  };
  return (
    <ClassScreen
      classId={id}
      onBack={pop}
      onCapture={() =>
        prefs.captureMode === 'original'
          ? push({ name: 'capture', classId: id })
          : void scanPages().then(toInbox)
      }
      onGallery={() => void pickFromGallery().then(toInbox)}
      onOpenInbox={() => push({ name: 'inbox', classId: id })}
      onOpenSubmission={(sid) => push({ name: 'evaluate', id: sid })}
      onOpenStudent={(sid) => push({ name: 'student', id: sid })}
    />
  );
}

function AuthGate() {
  const { loading, current } = useAuth();
  const { chosen, suggest } = useLang();
  // Until the teacher picks a language, follow the one on their profile.
  useEffect(() => {
    if (current && !chosen) suggest(current.language);
  }, [current, chosen, suggest]);
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
      <LangProvider>
        <PermissionsGate>
          <AuthProvider>
            <AuthGate />
          </AuthProvider>
        </PermissionsGate>
      </LangProvider>
    </SafeAreaProvider>
  );
}
