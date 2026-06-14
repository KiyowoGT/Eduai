import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { GraduationCap, Sparkles } from "lucide-react";

export default function ProtectedRoute({ children, requireOnboarded = true }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F6F0] dark:bg-[#12131A] flex items-center justify-center p-4">
        <div className="p-10 rounded-[2.5rem] bg-white dark:bg-[#1A1B26] border border-[#E2E0D8] dark:border-white/10 shadow-2xl max-w-sm w-full text-center">
          <div className="fade-up">
            <div className="relative w-24 h-24 mx-auto mb-8 flex items-center justify-center">
              <div className="absolute inset-0 rounded-[2rem] border-2 border-dashed border-[#E5A93C]/40 dark:border-[#E5A93C]/30 animate-[spin_15s_linear_infinite]" />
              <div className="absolute inset-2 rounded-full border-2 border-t-[#E5A93C] border-r-[#1D2D50] border-b-[#B83A4B] border-l-transparent dark:border-r-white/40 animate-[spin_1.5s_linear_infinite]" />
              <div className="absolute inset-4 rounded-2xl bg-[#1D2D50] dark:bg-[#E5A93C] flex items-center justify-center shadow-lg border border-white/10">
                <GraduationCap className="w-7 h-7 text-[#E5A93C] dark:text-[#12131A] animate-pulse" />
              </div>
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#E5A93C] dark:bg-[#1D2D50] border-2 border-white dark:border-[#12131A] flex items-center justify-center shadow-lg animate-bounce">
                <Sparkles className="w-2.5 h-2.5 text-[#1D2D50] dark:text-[#E5A93C]" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="font-heading text-2xl text-[#1A1B26] dark:text-white tracking-tight">Schooly AI</p>
              <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-widest text-[#646675] dark:text-[#A0A2B1] font-bold">
                <div className="w-1.5 h-1.5 rounded-full bg-[#E5A93C] animate-ping" />
                <span>Memeriksa sesi akademik...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;
  const isOnboarded = user.onboarded || user.institution_code || user.enrolled_class || user.education_level || user.role === "pengajar";
  if (requireOnboarded && !isOnboarded && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }
  const needsHobby = user?.role && user.role !== "pengajar" && (user?.hobby === null || user?.hobby === undefined);
  if (requireOnboarded && isOnboarded && needsHobby && location.pathname !== "/onboarding-hobi") {
    return <Navigate to="/onboarding-hobi" replace />;
  }
  return children;
}
