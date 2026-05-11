import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Landing from "@/pages/Landing";
import AuthCallback from "@/pages/AuthCallback";
import Onboarding from "@/pages/Onboarding";
import Dashboard from "@/pages/Dashboard";
import Documents from "@/pages/Documents";
import DocumentDetail from "@/pages/DocumentDetail";
import Folders from "@/pages/Folders";
import FolderDetail from "@/pages/FolderDetail";
import Recap from "@/pages/Recap";
import Quiz from "@/pages/Quiz";
import QuizResult from "@/pages/QuizResult";
import AuditLog from "@/pages/AuditLog";
import Profile from "@/pages/Profile";

function AppRouter() {
  const location = useLocation();
  // Synchronous check for OAuth callback (prevents race conditions)
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/onboarding" element={
        <ProtectedRoute requireOnboarded={false}><Onboarding /></ProtectedRoute>
      } />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dokumen" element={<Documents />} />
        <Route path="/dokumen/:id" element={<DocumentDetail />} />
        <Route path="/folder" element={<Folders />} />
        <Route path="/folder/:id" element={<FolderDetail />} />
        <Route path="/recap/:id" element={<Recap />} />
        <Route path="/kuis/:id" element={<Quiz />} />
        <Route path="/hasil/:id" element={<QuizResult />} />
        <Route path="/audit-log" element={<AuditLog />} />
        <Route path="/profil" element={<Profile />} />
      </Route>
      <Route path="*" element={<Landing />} />
    </Routes>
  );
}

export default function App() {
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
