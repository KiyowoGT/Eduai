import { useEffect, useState, useRef, useCallback } from "react";
import { Bell, CheckCheck, UserPlus, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  listNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead,
} from "@/lib/api";
import { useNavigate } from "react-router-dom";

const typeIcons = {
  friend_request: UserPlus,
  friend_accepted: UserPlus,
  discussion_message: MessageSquare,
  discussion_invite: MessageSquare,
};

export default function NotificationsDropdown() {
  const [notifs, setNotifs] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const intervalRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const [n, u] = await Promise.all([listNotifications(), getUnreadCount()]);
      // API may return array directly OR { notifications: [...] }
      setNotifs(Array.isArray(n) ? n : (n?.notifications ?? []));
      setUnread(u?.count ?? (typeof u === 'number' ? u : 0));
    } catch {}
  }, []);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 30000);
    return () => clearInterval(intervalRef.current);
  }, [load]);

  const handleMarkRead = async (notif) => {
    if (!notif.read) {
      try { await markNotificationRead(notif.notification_id); } catch {}
    }
    setOpen(false);
    if (notif.type === "friend_request" || notif.type === "friend_accepted") {
      navigate("/teman");
    } else if (notif.type === "discussion_invite" || notif.type === "discussion_message") {
      const docId = notif.data?.document_id;
      if (docId) navigate(`/dokumen/${docId}?tab=diskusi`);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setUnread(0);
      setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {}
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "baru saja";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}j`;
    return `${Math.floor(hrs / 24)}h`;
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-9 w-9 p-0 text-[#646675] hover:text-[#1A1B26]">
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#B83A4B] text-white text-[9px] font-bold grid place-items-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 bg-white border border-[#E2E0D8] rounded-xl p-2 shadow-lg">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-xs font-medium text-[#1A1B26]">Notifikasi</span>
          {unread > 0 && (
            <button onClick={handleMarkAllRead} className="text-[10px] text-[#1D2D50] hover:underline flex items-center gap-1">
              <CheckCheck className="w-3 h-3" /> Baca semua
            </button>
          )}
        </div>
        <DropdownMenuSeparator className="bg-[#E2E0D8] my-1" />
        {notifs.length === 0 ? (
          <div className="px-2 py-6 text-center text-xs text-[#A0A2B1]">Belum ada notifikasi</div>
        ) : (
          notifs.slice(0, 10).map((n) => {
            const Icon = typeIcons[n.type] || Bell;
            return (
              <DropdownMenuItem
                key={n.notification_id}
                onClick={() => handleMarkRead(n)}
                className={`flex items-start gap-3 px-2 py-2.5 rounded-lg cursor-pointer text-sm ${
                  !n.read ? "bg-[#F8F6F0]" : ""
                }`}
              >
                <div className={`mt-0.5 ${!n.read ? "text-[#1D2D50]" : "text-[#A0A2B1]"}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs ${!n.read ? "font-medium text-[#1A1B26]" : "text-[#646675]"}`}>
                    {n.message}
                  </div>
                  <div className="text-[10px] text-[#A0A2B1] mt-0.5">{timeAgo(n.created_at)}</div>
                </div>
                {!n.read && <div className="w-2 h-2 rounded-full bg-[#1D2D50] mt-1.5 shrink-0" />}
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}