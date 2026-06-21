import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
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
  ChevronRight,
  Calendar,
  BarChart3,
  School,
  Shield,
  Settings,
  FileSpreadsheet,
  UserPlus,
  ClipboardList,
  Ticket,
  Activity,
  Bug,
  Wrench,
} from "lucide-react";
import NotificationsDropdown from "@/components/NotificationsDropdown";
import ContextSwitcher from "@/components/ContextSwitcher";
import BugReportFAB from "@/components/BugReportFAB";

const labelMap = {
  kepala_sekolah: "Kepala Sekolah",
  kurikulum: "Kurikulum",
  guru_kelas: "Guru Kelas",
  guru_pengajar: "Guru Pengajar",
  kajur: "Kepala Jurusan (Kajur)",
};

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isTeacher = user?.role === "pengajar";
  const isSuperAdmin = user?.is_superadmin === true;
  const isAdmin = isTeacher && user?.title === "kepala_sekolah";
  const isStudent = user?.role === "pelajar";
  const perms = useMemo(() => user?.permissions || [], [user?.permissions]);

  const navItems = useMemo(() => {
    if (isSuperAdmin) {
      return [
        { to: "/admin", label: "Dashboard", icon: LayoutDashboard, tid: "nav-sys-monitor" },
        { to: "/admin/system-health", label: "Server Health", icon: Activity, tid: "nav-sys-health" },
        { to: "/admin/bugs", label: "Bug Tracker", icon: Bug, tid: "nav-sys-bugs" },
        { to: "/admin/maintenance-mode", label: "Maintenance", icon: Wrench, tid: "nav-sys-maint" },
        { to: "/admin/users", label: "User Mgmt", icon: Users, tid: "nav-sys-users" },
        { to: "/admin/audit-logs", label: "Audit Log", icon: ScrollText, tid: "nav-sys-audit" },
      ];
    }

    if (isAdmin) {
      return [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, tid: "nav-dashboard" },
        { to: "/admin/users", label: "Manajemen Akun", icon: Users, tid: "nav-admin-users" },
        { to: "/admin/academic-years", label: "Tahun Ajaran", icon: Calendar, tid: "nav-academic-years" },
        { to: "/admin/audit-logs", label: "Audit Log", icon: ScrollText, tid: "nav-audit" },
        { to: "/audit-log", label: "Aktivitas Saya", icon: User2, tid: "nav-my-audit" },
        { to: "/admin/reports", label: "Laporan", icon: FileSpreadsheet, tid: "nav-reports" },
        { to: "/admin/settings", label: "Pengaturan", icon: Settings, tid: "nav-settings" },
        { to: "/profil", label: "Profil", icon: User2, tid: "nav-profile" },
      ];
    }

    if (isTeacher) {
      const items = [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, tid: "nav-dashboard" },
      ];

      if (perms.includes("studio_materi") || perms.includes("review_materi")) {
        items.push({ to: "/dokumen", label: "Materi", icon: FileText, tid: "nav-materials" });
      }

      if (perms.includes("jadwal_view") || perms.includes("jadwal_master")) {
        items.push({ to: "/teacher/schedules", label: "Jadwal", icon: user?.account_type === "pribadi" ? BarChart3 : Calendar, tid: "nav-schedules" });
      }

      if (perms.includes("ruang_kelas_full") || perms.includes("ruang_kelas_view") || perms.includes("ruang_kelas")) {
        items.push({ to: "/teacher/students", label: "Kelas", icon: Users, tid: "nav-students" });
      }

      if (perms.includes("analitik_kelas") || perms.includes("analitik_butir_soal") || perms.includes("analitik_makro") || perms.includes("analitik_full") || perms.includes("analitik_produktif")) {
        items.push({ to: "/teacher/analytics", label: "Analitik", icon: BarChart3, tid: "nav-analytics" });
      }

      items.push({ to: "/riwayat-kuis", label: "Riwayat Kuis", icon: BrainCircuit, tid: "nav-quiz-history" });
      items.push({ to: "/audit-log", label: "Audit Log", icon: ScrollText, tid: "nav-audit" });
      items.push({ to: "/profil", label: "Profil", icon: User2, tid: "nav-profile" });

      return items;
    }

    // Student / Default
    const studentItems = [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, tid: "nav-dashboard" },
      { to: "/dokumen", label: "Dokumen", icon: FileText, tid: "nav-documents" },
      { to: "/pengaturan-belajar", label: "Belajar", icon: BookOpen, tid: "nav-education" },
      { to: "/folder", label: "Folder", icon: FolderOpen, tid: "nav-folders" },
      { to: "/riwayat-kuis", label: "Riwayat", icon: BrainCircuit, tid: "nav-quiz-history" },
    ];
    if (isStudent && !user?.institution_code) {
      studentItems.push({ to: "/portal", label: "Portal Mandiri", icon: Ticket, tid: "nav-portal" });
    }
    studentItems.push(
      { to: "/teman", label: "Teman", icon: Users, tid: "nav-friends" },
      { to: "/audit-log", label: "Audit Log", icon: ScrollText, tid: "nav-audit" },
      { to: "/profil", label: "Profil", icon: User2, tid: "nav-profile" },
    );
    return studentItems;
  }, [isAdmin, isTeacher, perms, user]);

  const mobileNavItems = useMemo(() => {
    let items;
    if (isSuperAdmin) {
      items = [
        { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
        { to: "/admin/system-health", label: "Health", icon: Activity },
        { to: "/admin/bugs", label: "Bugs", icon: Bug },
        { to: "/admin/maintenance-mode", label: "Maint", icon: Wrench },
        { to: "/profil", label: "Profil", icon: User2 },
      ];
    } else if (isAdmin) {
      items = [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { to: "/admin/users", label: "Akun", icon: User2 },
        { to: "/admin/academic-years", label: "Ajaran", icon: Calendar },
        { to: "/admin/reports", label: "Laporan", icon: FileSpreadsheet },
        { to: "/profil", label: "Profil", icon: User2 },
      ];
    } else if (isTeacher) {
      const candidates = [];
      if (perms.includes("studio_materi") || perms.includes("review_materi")) {
        candidates.push({ to: "/dokumen", label: "Materi", icon: FileText });
      }
      if (perms.includes("jadwal_view") || perms.includes("jadwal_master")) {
        candidates.push({ to: "/teacher/schedules", label: "Jadwal", icon: user?.account_type === "pribadi" ? BarChart3 : Calendar });
      }
      if (perms.includes("ruang_kelas_full") || perms.includes("ruang_kelas_view") || perms.includes("ruang_kelas")) {
        candidates.push({ to: "/teacher/students", label: "Kelas", icon: Users });
      }
      if (perms.includes("analitik_kelas") || perms.includes("analitik_makro") || perms.includes("analitik_produktif")) {
        candidates.push({ to: "/teacher/analytics", label: "Analitik", icon: BarChart3 });
      }

      // Fallbacks to always fill exactly 5 items
      candidates.push({ to: "/riwayat-kuis", label: "Riwayat", icon: BrainCircuit });
      candidates.push({ to: "/audit-log", label: "Audit Log", icon: ScrollText });
      candidates.push({ to: "/pengaturan-belajar", label: "Belajar", icon: BookOpen });

      items = [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        ...candidates.slice(0, 3),
        { to: "/profil", label: "Profil", icon: User2 },
      ];
    } else {
      items = [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { to: "/dokumen", label: "Dokumen", icon: FileText },
        { to: "/pengaturan-belajar", label: "Belajar", icon: BookOpen },
      ];
      items.push(
        { to: "/profil", label: "Profil", icon: User2 },
      );
      if (isStudent && !user?.institution_code) {
        items.splice(3, 0, { to: "/portal", label: "Portal Mandiri", icon: Ticket });
      } else {
        items.splice(3, 0, { to: "/teman", label: "Teman", icon: Users });
      }
    }
    return items;
  }, [isAdmin, isTeacher, perms, user]);

  const hideMobileNav = /^\/(dokumen|folder|kuis|hasil|recap|admin)\/.+/.test(location.pathname);
  const hideMobileNavBottom = /^\/(dokumen|folder|kuis|hasil|recap)\/.+/.test(location.pathname);

  const doLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const userTitle = isSuperAdmin
    ? "Super Admin"
    : isAdmin
    ? "Kepala Sekolah"
    : isTeacher
      ? labelMap[user?.title] || user?.title
      : isStudent
        ? user?.education_level
          ? `${user.education_level}${user?.major ? ` · ${user.major}` : ""}`
          : "Pelajar"
        : "";

  const userSubtitle = isSuperAdmin
    ? "Schooly AI Core"
    : isAdmin
    ? user?.institution || ""
    : isTeacher
      ? user?.assigned_class
        ? `${user.assigned_class}${user?.assigned_subject ? ` · ${user.assigned_subject}` : ""}`
        : user?.institution || ""
      : isStudent
        ? user?.current_semester
          ? `Kelas ${user.current_semester}`
          : user?.institution || ""
        : "";

  return (
    <div className="min-h-screen bg-[#F8F6F0] paper-grain" data-testid="app-layout">

      {/* Mobile Top Bar */}
      <header className={`md:hidden sticky top-0 z-40 bg-[#F8F6F0] border-b border-[#E2E0D8] h-14 flex items-center justify-between px-4 ${hideMobileNav ? 'hidden' : ''}`}>
        <div className="flex items-center gap-2">
          <img src="/img/logo-schooly-owl.png" alt="Schooly AI" className="w-12 h-12 object-contain" />
          <span className="font-heading text-lg">
            {isAdmin ? "Admin" : "Schooly AI"}
          </span>
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
            bg-white border-r border-[#E2E0D8]
            flex flex-col
            ${sidebarOpen ? 'md:w-60' : 'md:w-16'}
          `}
          data-testid="sidebar"
        >
          {/* Sidebar Header: Logo + Toggle */}
          <div className="px-3 py-4 border-b border-[#E2E0D8] flex items-center shrink-0 relative">
            <div className="flex items-center gap-2.5">
              <img src="/img/logo-schooly-owl.png" alt="Schooly AI" className="w-10 h-10 object-contain shrink-0" />
              {sidebarOpen && (
                <div className="overflow-hidden">
                  <div className="font-heading text-lg leading-none truncate">
                    {isSuperAdmin ? "Schooly Admin" : isAdmin ? "Schooly Admin" : "Schooly AI"}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#A0A2B1] mt-0.5 truncate">
                    {isSuperAdmin ? "Super Admin" : isAdmin ? "Kepala Sekolah" : isTeacher ? "Portal Guru" : "University"}
                  </div>
                </div>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden md:flex h-6 w-6 p-0 rounded-full border border-[#E2E0D8] bg-white shadow-sm hover:bg-[#F8F6F0] dark:hover:bg-white/10 text-[#646675] absolute -right-3 top-1/2 -translate-y-1/2 z-10"
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
                end={it.to === "/admin" || it.to === "/dashboard"}
                data-testid={it.tid}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${isActive ? "bg-[#1D2D50] dark:bg-[#E5A93C] text-white dark:text-[#12131A]" : "text-[#646675] hover:bg-[#F8F6F0] dark:hover:bg-white/5 hover:text-[#1A1B26] dark:hover:text-white"
                  } ${!sidebarOpen ? 'md:justify-center md:px-2' : ''}`
                }
                title={!sidebarOpen ? it.label : undefined}
              >
                <it.icon className="w-4 h-4 shrink-0" />
                {sidebarOpen && <span className="truncate">{it.label}</span>}
              </NavLink>
            ))}
          </nav>

          {/* ContextSwitcher - multi-role toggle */}
          <ContextSwitcher collapsed={!sidebarOpen} />

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
                    {userTitle}{userSubtitle ? ` · ${userSubtitle}` : ""}
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
        <main className={`flex-1 md:ml-0 md:p-10 p-4 pt-4 md:pt-10 overflow-x-hidden ${hideMobileNavBottom ? 'pb-4 md:pb-10' : 'pb-24 md:pb-10'}`}>
          <Outlet />
        </main>

      </div>

      {/* Mobile Bottom Nav */}
      <nav data-testid="bottom-nav" className={`md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#E2E0D8]/60 rounded-t-[28px] shadow-[0_-10px_30px_-5px_rgba(29,45,80,0.08)] grid grid-cols-5 h-[68px] z-40 px-2 ${hideMobileNavBottom ? 'hidden' : ''}`}>
        {mobileNavItems.map((it, idx) => {
          if (it.placeholder) {
            return <div key={`spacer-${idx}`} />;
          }

          const isMiddle = idx === 2;

          if (isMiddle) {
            return (
              <div key={it.to} className="relative flex justify-center items-center">
                <NavLink
                  to={it.to}
                  end={it.to === "/admin" || it.to === "/dashboard"}
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
              end={it.to === "/admin" || it.to === "/dashboard"}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 h-full transition-colors ${isActive ? "text-[#1D2D50] dark:text-[#E5A93C]" : "text-[#A0A2B1] dark:text-zinc-400"}`
              }
            >
              <it.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium tracking-tight">{it.label}</span>
            </NavLink>
          );
        })}
      </nav>
      {/* Floating Action Button untuk Lapor Bug */}
      <BugReportFAB />
    </div>
  );
}
