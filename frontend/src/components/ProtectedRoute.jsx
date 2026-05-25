import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import DualLoader from "@/components/DualLoader";

export default function ProtectedRoute({ children, requireOnboarded = true }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return <DualLoader variant="full" type="default" text="Memeriksa sesi akademik..." />;
  }
  if (!user) return <Navigate to="/" replace />;
  if (requireOnboarded && !user.onboarded && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }
  return children;
}
