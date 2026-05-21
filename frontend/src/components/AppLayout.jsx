import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { 
  GraduationCap, 
  LayoutDashboard, 
  FileText, 
  ScrollText, 
  LogOut, 
  User2, 
  FolderOpen, 
  Users, 
  BrainCircuit, 
  BookOpen,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import NotificationsDropdown from "@/components/NotificationsDropdown";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, tid: "nav-dashboard" },
  { to: "/dokumen", label: "Dokumen", icon: FileText, tid: "nav-documents" },
  { to: "/pengaturan-belajar", label: "Belajar", icon: BookOpen, tid: "nav-education" },
  { to: "/folder", label: "Folder", icon: FolderOpen, tid: "nav-folders" },
  { to: "/riwayat-kuis", label: "Riwayat", icon: BrainCircuit, tid: "nav-quiz-history" },
  { to: "/teman", label: "Teman", icon: Users, tid: "nav-friends" },
  { to: "/audit-log", label: "Audit Log", icon: ScrollText, tid: "nav-audit" },
  { to: "/profil", label: "Profil", icon: User2, tid: "nav-profile" },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true); // desktop only

  const hideMobileNav = /^\/(dokumen|folder|kuis|hasil|recap)\/.+/.test(location.pathname);

  const doLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  // Mobile bottom nav items (5 only)
  const mobileNavItems = navItems.filter(
    (it) =>
      it.to === "/dashboard" ||
      it.to === "/dokumen" ||
      it.to === "/pengaturan-belajar" ||
      it.to === "/teman" ||
      it.to === "/profil"
  );

  return (
    <div className="min-h-screen bg-[#F8F6F0] paper-grain" data-testid="app-layout">

      {/* Mobile Top Bar */}
      <header className={`md:hidden sticky top-0 z-40 bg-[#F8F6F0] border-b border-[#E2E0D8] h-14 flex items-center justify-between px-4 ${hideMobileNav ? 'hidden' : ''}`}>
        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-[#1D2D50]" />
          <span className="font-heading text-lg">EduScanner</span>
        </div>
        <div>
          <NotificationsDropdown />
        </div>
      </header>

      <div className="flex">

        {/* Sidebar - desktop only */}
        <aside 
          className={`
            hidden md:flex md:sticky md:top-0 md:h-screen inset-y-0 left-0 z-50
            w-60 bg-white border-r border-[#E2E0D8]
            flex flex-col
            ${sidebarOpen ? 'md:w-60' : 'md:w-16'}
          `}
          data-testid="sidebar"
        >
          {/* Sidebar Header: Logo + Toggle Button */}
          <div className="px-3 py-4 border-b border-[#E2E0D8] flex items-center shrink-0 relative">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-[#1D2D50] grid place-items-center shrink-0">
                <GraduationCap className="w-4 h-4 text-[#E5A93C]" />
              </div>
              {sidebarOpen && (
                <div className="overflow-hidden">
                  <div className="font-heading text-lg leading-none truncate">EduScanner</div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#A0A2B1] mt-0.5 truncate">University</div>
                </div>
              )}
            </div>

            {/* Desktop Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden md:flex h-6 w-6 p-0 rounded-full border border-[#E2E0D8] bg-white shadow-sm hover:bg-[#F8F6F0] text-[#646675] absolute -right-3 top-1/2 -translate-y-1/2 z-10"
              data-testid="sidebar-toggle"
              title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {sidebarOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </Button>
          </div>

          {/* Sidebar Navigation */}
          <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
            {navItems.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                data-testid={it.tid}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                    isActive ? "bg-[#1D2D50] text-white" : "text-[#646675] hover:bg-[#F8F6F0] hover:text-[#1A1B26]"
                  } ${!sidebarOpen ? 'md:justify-center md:px-2' : ''}`
                }
                title={!sidebarOpen ? it.label : undefined}
              >
                <it.icon className="w-4 h-4 shrink-0" />
                {sidebarOpen && <span className="truncate">{it.label}</span>}
              </NavLink>
            ))}
          </nav>

          {/* User Section */}
          <div className="p-2 border-t border-[#E2E0D8] mt-auto">
            <div className="px-3 py-2 mb-2">
              {sidebarOpen ? (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs text-[#A0A2B1] uppercase tracking-[0.15em]">Masuk sebagai</div>
                    <NotificationsDropdown />
                  </div>
                  <div className="text-sm font-medium text-[#1A1B26] truncate">{user?.name}</div>
                  <div className="text-[11px] text-[#646675] truncate">
                    {user?.education_level}{user?.major ? ` · ${user.major.split(" /")[0].split(" (")[0]}` : ""} · {user?.education_level === "Universitas" ? `Sem ${user?.current_semester}` : `Kelas ${user?.current_semester}`}
                  </div>
                </>
              ) : (
                <div className="flex justify-center">
                  <NotificationsDropdown />
                </div>
              )}
            </div>
            <Button
              data-testid="logout-button"
              variant="ghost"
              onClick={doLogout}
              className={`w-full justify-start text-[#B83A4B] hover:bg-[#B83A4B]/5 hover:text-[#B83A4B] h-9 ${!sidebarOpen ? 'md:justify-center md:px-2' : ''}`}
              title={!sidebarOpen ? "Keluar" : undefined}
            >
              <LogOut className="w-4 h-4 md:mr-2" />
              {sidebarOpen && <span>Keluar</span>}
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className={`flex-1 md:ml-0 md:p-10 p-4 pt-4 md:pt-10 overflow-x-hidden ${hideMobileNav ? 'pb-4 md:pb-10' : 'pb-24 md:pb-10'}`}>
          <Outlet />
        </main>

      </div>

      {/* Mobile Bottom Nav */}
      <nav data-testid="bottom-nav" className={`md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#E2E0D8]/60 rounded-t-[28px] shadow-[0_-10px_30px_-5px_rgba(29,45,80,0.08)] grid grid-cols-5 h-[68px] z-40 px-2 ${hideMobileNav ? 'hidden' : ''}`}>
        {mobileNavItems.map((it, idx) => {
          const isMiddle = idx === 2;

          if (isMiddle) {
            return (
              <div key={it.to} className="relative flex justify-center items-center">
                <NavLink
                  to={it.to}
                  data-testid={it.tid}
                  className="absolute -top-6 w-12 h-12 bg-[#1D2D50] rounded-[14px] rotate-45 shadow-[0_8px_20px_-4px_rgba(29,45,80,0.4)] flex items-center justify-center active:scale-90 transition-all duration-200"
                  title={it.label}
                >
                  <div className="-rotate-45 text-[#E5A93C]">
                    <it.icon className="w-5 h-5" />
                  </div>
                </NavLink>
              </div>
            );
          }

          return (
            <NavLink
              key={it.to}
              to={it.to}
              data-testid={it.tid}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 h-full transition-colors ${isActive ? "text-[#1D2D50]" : "text-[#A0A2B1]"}`
              }
            >
              <it.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium tracking-tight">{it.label}</span>
            </NavLink>
          );
        })}
      </nav>
     </div>
  );
}
