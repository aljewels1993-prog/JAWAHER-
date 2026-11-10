import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Link, MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { I18nProvider, useI18n } from './i18n';
import { AuthProvider, useAuth } from './state/auth';
import { FeedbackProvider } from './state/feedback';
import { TimerProvider } from './state/timer';
import { NotificationsProvider } from './state/notifications';
import { AppShell } from './components/AppShell';
import { Spinner } from './components/ui';
import { Mascot } from './components/Mascot';
import { LoginPage, SignupPage, ForgotPasswordPage, ResetPasswordPage } from './pages/auth/AuthPages';
import { HomePage } from './pages/Home';

// Less-used screens are split into their own chunks.
const PlannerPage = lazy(() => import('./pages/Planner'));
const TimerPage = lazy(() => import('./pages/Timer'));
const AchievementsPage = lazy(() => import('./pages/Achievements'));
const ReportsPage = lazy(() => import('./pages/Reports'));
const NotificationsPage = lazy(() => import('./pages/Notifications'));
const ProfilePage = lazy(() => import('./pages/Profile'));
const TeacherHome = lazy(() => import('./pages/teacher/TeacherHome'));
const TeacherStudent = lazy(() => import('./pages/teacher/TeacherStudent'));

function Splash() {
  const { t } = useI18n();
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--grad-hero)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 120, margin: '0 auto' }}><Mascot mood="idle" /></div>
        <h1 style={{ color: 'var(--navy)', marginTop: 8 }}>{t('app.name')}</h1>
        <Spinner />
      </div>
    </div>
  );
}

function RequireStudent({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  const loc = useLocation();
  if (!account) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (account.role === 'teacher') return <Navigate to="/teacher" replace />;
  return <AppShell><Suspense fallback={<Spinner />}>{children}</Suspense></AppShell>;
}

function RequireTeacher({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  if (!account) return <Navigate to="/login" replace />;
  if (account.role !== 'teacher') return <Navigate to="/" replace />;
  return <AppShell><Suspense fallback={<Spinner />}>{children}</Suspense></AppShell>;
}

/** Profile works for both roles. */
function RequireSignedIn({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  if (!account) return <Navigate to="/login" replace />;
  return <AppShell><Suspense fallback={<Spinner />}>{children}</Suspense></AppShell>;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  if (account) return <Navigate to={account.role === 'teacher' ? '/teacher' : '/'} replace />;
  return <>{children}</>;
}

function NotFound() {
  const { t } = useI18n();
  return (
    <div className="page" style={{ textAlign: 'center', paddingTop: 40 }}>
      <div style={{ width: 140, margin: '0 auto' }}><Mascot mood="wink" /></div>
      <h1 style={{ color: 'var(--navy)' }}>{t('notFound.title')}</h1>
      <p style={{ color: 'var(--ink-2)', margin: '8px 0 16px', fontWeight: 700 }}>{t('notFound.body')}</p>
      <Link className="btn" to="/">{t('nav.home')}</Link>
    </div>
  );
}

function AppRoutes() {
  const { loading, recovering } = useAuth();
  if (loading) return <Splash />;
  if (recovering) return <ResetPasswordPage />;
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
      <Route path="/signup" element={<PublicOnly><SignupPage /></PublicOnly>} />
      <Route path="/forgot-password" element={<PublicOnly><ForgotPasswordPage /></PublicOnly>} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route path="/" element={<RequireStudent><HomePage /></RequireStudent>} />
      <Route path="/planner" element={<RequireStudent><PlannerPage /></RequireStudent>} />
      <Route path="/timer" element={<RequireStudent><TimerPage /></RequireStudent>} />
      <Route path="/achievements" element={<RequireStudent><AchievementsPage /></RequireStudent>} />
      <Route path="/reports" element={<RequireStudent><ReportsPage /></RequireStudent>} />
      <Route path="/notifications" element={<RequireStudent><NotificationsPage /></RequireStudent>} />
      <Route path="/profile" element={<RequireSignedIn><ProfilePage /></RequireSignedIn>} />

      <Route path="/teacher" element={<RequireTeacher><TeacherHome /></RequireTeacher>} />
      <Route path="/teacher/students/:id" element={<RequireTeacher><TeacherStudent /></RequireTeacher>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

// The single-file preview runs inside a frame, so it routes in memory.
const Router = import.meta.env.VITE_ROUTER === 'memory' ? MemoryRouter : BrowserRouter;

export default function App() {
  return (
    <Router>
      <I18nProvider>
        <AuthProvider>
          <FeedbackProvider>
            <TimerProvider>
              <NotificationsProvider>
                <AppRoutes />
              </NotificationsProvider>
            </TimerProvider>
          </FeedbackProvider>
        </AuthProvider>
      </I18nProvider>
    </Router>
  );
}
