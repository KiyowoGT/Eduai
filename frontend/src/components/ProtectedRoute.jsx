import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function ProtectedRoute({ children, requireOnboarded = true }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#F8F6F0]">
        <div className="w-8 h-8 rounded-full border-2 border-[#1D2D50] border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;
  if (requireOnboarded && !user.onboarded && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }
  return children;
}
