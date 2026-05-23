import "@/App.css";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import SignUp from "@/pages/SignUp";
import AuthCallback from "@/pages/AuthCallback";
import ForgotPassword from "@/pages/ForgotPassword";
import Onboarding from "@/pages/Onboarding";
import HomeRedirect from "@/components/HomeRedirect";
import Documents from "@/pages/Documents";
import Friends from "@/pages/Friends";
import EducationSettings from "@/pages/EducationSettings";
import DocumentDetail from "@/pages/DocumentDetail";
import Folders from "@/pages/Folders";
import FolderDetail from "@/pages/FolderDetail";
import Recap from "@/pages/Recap";
import Quiz from "@/pages/Quiz";
import QuizResult from "@/pages/QuizResult";
import QuizHistory from "@/pages/QuizHistory";
import AuditLog from "@/pages/AuditLog";
import Profile from "@/pages/Profile";
import TeacherSchedules from "@/pages/teacher/TeacherSchedules";
import TeacherStudents from "@/pages/teacher/TeacherStudents";
import TeacherAnalytics from "@/pages/teacher/TeacherAnalytics";
import UserManagement from "@/pages/admin/UserManagement";
import CreateTeacher from "@/pages/admin/CreateTeacher";
import TeacherDetail from "@/pages/admin/TeacherDetail";
import MutationManager from "@/pages/admin/MutationManager";
import AcademicYearManager from "@/pages/admin/AcademicYearManager";
import ReportsPage from "@/pages/admin/ReportsPage";
import SettingsPage from "@/pages/admin/SettingsPage";
import AuditLogViewer from "@/pages/admin/AuditLogViewer";

function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/onboarding" element={
        <ProtectedRoute requireOnboarded={false}><Onboarding /></ProtectedRoute>
      } />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<HomeRedirect />} />
        <Route path="/dokumen" element={<Documents />} />
        <Route path="/dokumen/:id" element={<DocumentDetail />} />
        <Route path="/teman" element={<Friends />} />
        <Route path="/folder" element={<Folders />} />
        <Route path="/folder/:id" element={<FolderDetail />} />
        <Route path="/recap/:id" element={<Recap />} />
        <Route path="/kuis/:id" element={<Quiz />} />
        <Route path="/hasil/:id" element={<QuizResult />} />
        <Route path="/riwayat-kuis" element={<QuizHistory />} />
        <Route path="/pengaturan-belajar" element={<EducationSettings />} />
        <Route path="/audit-log" element={<AuditLog />} />
        <Route path="/profil" element={<Profile />} />
        <Route path="/teacher/schedules" element={<TeacherSchedules />} />
        <Route path="/teacher/students" element={<TeacherStudents />} />
        <Route path="/teacher/analytics" element={<TeacherAnalytics />} />
        <Route path="/admin/users" element={<UserManagement />} />
        <Route path="/admin/users/teachers/new" element={<CreateTeacher />} />
        <Route path="/admin/users/teachers/:id" element={<TeacherDetail />} />
        <Route path="/admin/users/mutations" element={<MutationManager />} />
        <Route path="/admin/academic-years" element={<AcademicYearManager />} />
        <Route path="/admin/audit-logs" element={<AuditLogViewer />} />
        <Route path="/admin/reports" element={<ReportsPage />} />
        <Route path="/admin/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Landing />} />
    </Routes>
  );
}

export default function App() {
  useEffect(() => {
    const applyTheme = (theme) => {
      if (theme === 'system' || !theme) {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        document.documentElement.classList.toggle('dark', mq.matches);
      } else {
        document.documentElement.classList.toggle('dark', theme === 'dark');
      }
    };

    const stored = localStorage.getItem('theme') || 'system';
    applyTheme(stored);

    if (stored === 'system' || !stored) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e) => document.documentElement.classList.toggle('dark', e.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, []);

  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}
