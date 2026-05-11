import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { GraduationCap, LayoutDashboard, FileText, ScrollText, LogOut, User2 } from "lucide-react";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, tid: "nav-dashboard" },
  { to: "/dokumen", label: "Dokumen", icon: FileText, tid: "nav-documents" },
  { to: "/audit-log", label: "Audit Log", icon: ScrollText, tid: "nav-audit" },
  { to: "/profil", label: "Profil", icon: User2, tid: "nav-profile" },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const doLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#F8F6F0] paper-grain flex" data-testid="app-layout">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-white border-r border-[#E2E0D8] hidden md:flex flex-col">
        <div className="px-6 py-6 border-b border-[#E2E0D8] flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-[#1D2D50] grid place-items-center">
            <GraduationCap className="w-4 h-4 text-[#E5A93C]" />
          </div>
          <div>
            <div className="font-heading text-lg leading-none">EduScanner</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#A0A2B1] mt-0.5">University</div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              data-testid={it.tid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                  isActive ? "bg-[#1D2D50] text-white" : "text-[#646675] hover:bg-[#F8F6F0] hover:text-[#1A1B26]"
                }`
              }
            >
              <it.icon className="w-4 h-4" />
              <span>{it.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-[#E2E0D8]">
          <div className="px-3 py-2 mb-2">
            <div className="text-xs text-[#A0A2B1] uppercase tracking-[0.15em]">Masuk sebagai</div>
            <div className="text-sm font-medium text-[#1A1B26] truncate">{user?.name}</div>
            <div className="text-[11px] text-[#646675] truncate">
              {user?.education_level}{user?.major ? ` · ${user.major.split(" /")[0].split(" (")[0]}` : ""} · {user?.education_level === "Universitas" ? `Sem ${user?.current_semester}` : `Kelas ${user?.current_semester}`}
            </div>
          </div>
          <Button
            data-testid="logout-button"
            variant="ghost"
            onClick={doLogout}
            className="w-full justify-start text-[#B83A4B] hover:bg-[#B83A4B]/5 hover:text-[#B83A4B] h-9"
          >
            <LogOut className="w-4 h-4 mr-2" /> Keluar
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed inset-x-0 top-0 z-30 bg-[#F8F6F0]/90 backdrop-blur-md border-b border-[#E2E0D8] h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-[#1D2D50]" />
          <span className="font-heading text-lg">EduScanner</span>
        </div>
        <Button onClick={doLogout} variant="ghost" size="sm" data-testid="logout-button-mobile">
          <LogOut className="w-4 h-4" />
        </Button>
      </header>

      <main className="flex-1 md:ml-0 md:p-10 p-4 pt-20 md:pt-10 overflow-x-hidden">
        <Outlet />
        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-[#E2E0D8] flex justify-around py-2 z-30">
          {navItems.map((it) => (
            <NavLink key={it.to} to={it.to} className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] ${isActive ? "text-[#1D2D50]" : "text-[#A0A2B1]"}`}>
              <it.icon className="w-4 h-4" />
              <span>{it.label}</span>
            </NavLink>
          ))}
        </nav>
      </main>
    </div>
  );
}
