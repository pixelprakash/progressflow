import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { Layout } from './Layout';
import { ClassPage } from './pages/ClassPage';
import { Login } from './pages/Login';
import { Overview } from './pages/Overview';
import { StudentPage } from './pages/StudentPage';
import { SubmissionPage } from './pages/SubmissionPage';

export function App() {
  const { user, loading } = useAuth();
  if (loading) return <p className="muted pad">Loading…</p>;
  if (!user) return <Login />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Overview />} />
        <Route path="classes/:id" element={<ClassPage />} />
        <Route path="students/:id" element={<StudentPage />} />
        <Route path="submissions/:id" element={<SubmissionPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
