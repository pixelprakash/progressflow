import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { useLang } from './i18n';
import { Layout } from './Layout';
import { ClassPage } from './pages/ClassPage';
import { Login } from './pages/Login';
import { Overview } from './pages/Overview';
import { StudentPage } from './pages/StudentPage';
import { SubmissionPage } from './pages/SubmissionPage';
import { StudentApp } from './student/StudentApp';

export function App() {
  const { user, loading } = useAuth();
  const { t, chosen, setLang } = useLang();
  const onStudentPages = useLocation().pathname.startsWith('/student');

  // A teacher who has not picked a language yet gets the one from their profile.
  useEffect(() => {
    // never let a signed-in teacher's profile decide a student's language
    if (user && !chosen && !onStudentPages) setLang(user.language);
    // eslint-disable-next-line
  }, [user]);

  return (
    <Routes>
      <Route path="/student/*" element={<StudentApp />} />
      <Route
        path="*"
        element={
          loading ? (
            <p className="muted pad">{t('common.loading')}</p>
          ) : !user ? (
            <Login />
          ) : (
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Overview />} />
                <Route path="classes/:id" element={<ClassPage />} />
                <Route path="students/:id" element={<StudentPage />} />
                <Route path="submissions/:id" element={<SubmissionPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          )
        }
      />
    </Routes>
  );
}
