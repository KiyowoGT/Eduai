import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Dashboard from "@/pages/Dashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import TeacherDashboard from "@/pages/TeacherDashboard";

export default function HomeRedirect() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && (user.is_superadmin || user.role === "admin")) {
      navigate("/admin", { replace: true });
    }
  }, [user, navigate]);

  if (!user) return null;

  if (user.is_superadmin || user.role === "admin") {
    return null;
  }

  if (user.role === "pelajar") {
    return <Dashboard />;
  }

  if (user.role === "pengajar") {
    if (user.title === "kepala_sekolah") {
      return <AdminDashboard />;
    }
    return <TeacherDashboard />;
  }

  return <Dashboard />;
}
