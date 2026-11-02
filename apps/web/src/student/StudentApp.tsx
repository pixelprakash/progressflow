import { Link, Route, Routes } from 'react-router-dom';
import { LanguageSwitch, useLang } from '../i18n';
import { PeerList } from './PeerList';
import { ReviewForm } from './ReviewForm';
import { StudentHome } from './StudentHome';
import { StudentLogin } from './StudentLogin';
import { StudentPiece } from './StudentPiece';
import { StudentSession, useStudent } from './session';

function Shell() {
  const { portal, loading, logout } = useStudent();
  const { t } = useLang();
  if (loading) return <p className="muted pad">{t('common.loading')}</p>;
  if (!portal) return <StudentLogin />;

  return (
    <div className="student-shell">
      <header className="student-head">
        <Link to="/student" className="brand-row">
          <span className="logo" aria-hidden>
            ↗
          </span>
          <strong>ProgressFlow</strong>
        </Link>
        <div className="row gap">
          <LanguageSwitch />
          <button className="ghost" onClick={() => void logout()}>
            {t('common.signOut')}
          </button>
        </div>
      </header>
      <main className="student-main">
        <Routes>
          <Route index element={<StudentHome />} />
          <Route path="work/:id" element={<StudentPiece />} />
          <Route path="review/:id" element={<ReviewForm key="self" kind="self" />} />
          <Route path="peer" element={<PeerList />} />
          <Route path="peer/:id" element={<ReviewForm key="peer" kind="peer" />} />
          <Route path="*" element={<StudentHome />} />
        </Routes>
      </main>
    </div>
  );
}

export function StudentApp() {
  return (
    <StudentSession>
      <Shell />
    </StudentSession>
  );
}
