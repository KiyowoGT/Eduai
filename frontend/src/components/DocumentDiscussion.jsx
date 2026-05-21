import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, Send, Loader2, UserPlus, Users, LogOut, XCircle, Bot, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { listMessages, sendMessage, inviteToDiscussion, listDiscussionParticipants, leaveDiscussion, kickFromDiscussion, listFriends } from "@/lib/api";
import useRealtimeSocket from "@/hooks/useRealtimeSocket";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

function mergeMessages(existing, incoming) {
  const map = new Map(existing.map((item) => [item.message_id, item]));
  incoming.forEach((item) => map.set(item.message_id, item));
  return [...map.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

export default function DocumentDiscussion({ documentId }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [inviting, setInviting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const bottomRef = useRef(null);

  const owner = participants.find((p) => p.role === "owner");
  const isOwner = owner?.user_id === user?.user_id;

  const loadMessages = useCallback(async (before) => {
    try {
      return await listMessages(documentId, before);
    } catch {
      return null;
    }
  }, [documentId]);

  const fetchMessages = useCallback(async () => {
    const res = await loadMessages();
    if (!res) return;
    setMessages(res.messages || []);
    setHasMore(res.has_more || false);
  }, [loadMessages]);

  const loadParticipants = useCallback(async () => {
    try {
      const res = await listDiscussionParticipants(documentId);
      setParticipants(res.participants || []);
    } catch {}
  }, [documentId]);

  const loadFriends = useCallback(async () => {
    try {
      const res = await listFriends();
      setFriends(res.friends || []);
    } catch {}
  }, []);

  useEffect(() => {
    Promise.all([fetchMessages(), loadParticipants()]).finally(() => setLoading(false));
  }, [fetchMessages, loadParticipants]);

  useEffect(() => {
    if (dialogOpen) loadFriends();
  }, [dialogOpen, loadFriends]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useRealtimeSocket((payload) => {
    if (payload?.type !== "discussion_message" || payload.document_id !== documentId || !payload.message) return;
    setMessages((prev) => mergeMessages(prev, [payload.message]));
  });

  const loadOlder = useCallback(async () => {
    if (messages.length === 0 || loadingMore) return;
    setLoadingMore(true);
    const oldest = messages[0]?.created_at;
    const res = await loadMessages(oldest);
    if (res?.messages?.length) {
      setMessages((prev) => mergeMessages([...res.messages], prev));
      setHasMore(res.has_more || false);
    } else {
      setHasMore(false);
    }
    setLoadingMore(false);
  }, [messages, loadingMore, loadMessages]);

  const doSend = async () => {
    if (!content.trim()) return;
    setSending(true);
    const text = content.trim();
    setContent("");
    try {
      const msg = await sendMessage(documentId, text);
      setMessages((prev) => mergeMessages(prev, [msg]));
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal mengirim pesan");
      setContent(text);
    } finally {
      setSending(false);
    }
  };

  const doInvite = async () => {
    if (selectedFriends.length === 0) return;
    setInviting(true);
    try {
      const res = await inviteToDiscussion(documentId, selectedFriends);
      toast.success(`${res.count} teman diundang`);
      setDialogOpen(false);
      setSelectedFriends([]);
      loadParticipants();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal mengundang");
    } finally {
      setInviting(false);
    }
  };

  const doLeave = async () => {
    setLeaving(true);
    try {
      await leaveDiscussion(documentId);
      toast.info("Keluar dari diskusi");
      loadParticipants();
      await fetchMessages();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal keluar");
    } finally {
      setLeaving(false);
    }
  };

  const doKick = async (targetId, targetName) => {
    if (!window.confirm(`Keluarkan ${targetName} dari diskusi ini?`)) return;
    try {
      await kickFromDiscussion(documentId, targetId);
      toast.success(`${targetName} dikeluarkan`);
      loadParticipants();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal mengeluarkan");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 bg-white border border-[#E2E0D8] rounded-xl">
        <Loader2 className="w-5 h-5 text-[#1D2D50] animate-spin" />
        <span className="ml-2 text-sm text-[#646675]">Memuat diskusi...</span>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E2E0D8] rounded-xl flex flex-col" style={{ height: "560px" }}>
      <div className="px-5 py-3 border-b border-[#E2E0D8]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#1D2D50]" />
            <span className="text-sm font-medium text-[#1A1B26]">Diskusi</span>
            <button onClick={() => setContent((prev) => (prev ? `${prev} @bot ` : "@bot "))} className="text-[10px] bg-[#E5A93C]/20 text-[#E5A93C] px-1.5 py-0.5 rounded-full hover:bg-[#E5A93C]/30">
              @bot
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#A0A2B1]">{participants.length} peserta</span>
            {isOwner ? (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-[#1D2D50] text-xs">
                    <UserPlus className="w-3.5 h-3.5 mr-1" /> Undang
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-white rounded-xl max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="font-heading text-lg">Undang Teman</DialogTitle>
                  </DialogHeader>
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {friends.length === 0 ? (
                      <div className="text-sm text-[#A0A2B1] py-6 text-center">Belum punya teman</div>
                    ) : (
                      friends.map((friend) => {
                        const alreadyIn = participants.some((p) => p.user_id === friend.user_id);
                        return (
                          <label key={friend.user_id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer ${alreadyIn ? "opacity-40" : "hover:bg-[#F8F6F0]"}`}>
                            <Checkbox checked={selectedFriends.includes(friend.user_id)} onCheckedChange={() => !alreadyIn && setSelectedFriends((prev) => prev.includes(friend.user_id) ? prev.filter((id) => id !== friend.user_id) : [...prev, friend.user_id])} disabled={alreadyIn} />
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={friend.picture} />
                              <AvatarFallback className="bg-[#1D2D50] text-white text-xs">{(friend.name || "U")[0]}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-[#1A1B26] truncate">{friend.name}</div>
                              {friend.friend_code && <div className="text-[10px] text-[#A0A2B1] font-mono">{friend.friend_code}</div>}
                            </div>
                            {alreadyIn && <span className="text-[10px] text-[#A0A2B1]">Sudah</span>}
                          </label>
                        );
                      })
                    )}
                  </div>
                  <Button onClick={doInvite} disabled={inviting || selectedFriends.length === 0} className="bg-[#1D2D50] hover:bg-[#243b63] text-white w-full mt-2">
                    {inviting ? "Mengundang..." : `Undang (${selectedFriends.length})`}
                  </Button>
                </DialogContent>
              </Dialog>
            ) : (
              <Button size="sm" variant="ghost" onClick={doLeave} disabled={leaving} className="h-7 px-2 text-[#B83A4B] text-xs">
                <LogOut className="w-3.5 h-3.5 mr-1" /> Keluar
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-1.5">
          <Users className="w-3 h-3 text-[#A0A2B1]" />
          <div className="flex flex-wrap gap-1">
            {participants.slice(0, 5).map((participant) => (
              <div key={participant.user_id} className="flex items-center gap-1 bg-[#F8F6F0] rounded-full px-2 py-0.5 group relative">
                <div className="w-4 h-4 rounded-full bg-[#1D2D50] text-white text-[8px] grid place-items-center font-medium">
                  {participant.user_id === "bot" ? <Bot className="w-2.5 h-2.5" /> : (participant.name || "U")[0]}
                </div>
                <span className="text-[10px] text-[#646675] max-w-[60px] truncate">{participant.user_id === "bot" ? "EduBot" : participant.name}{participant.role === "owner" ? " 👑" : ""}</span>
                {isOwner && participant.role !== "owner" && (
                  <button onClick={() => doKick(participant.user_id, participant.name)} className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#B83A4B] text-white rounded-full hidden group-hover:grid place-items-center">
                    <XCircle className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            ))}
            {participants.length > 5 && <span className="text-[10px] text-[#A0A2B1]">+{participants.length - 5}</span>}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {hasMore && (
          <div className="text-center">
            <Button size="sm" variant="ghost" onClick={loadOlder} disabled={loadingMore} className="text-[10px] text-[#1D2D50] h-6">
              {loadingMore ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <ChevronUp className="w-3 h-3 mr-1" />}
              Muat pesan sebelumnya
            </Button>
          </div>
        )}
        {messages.length === 0 ? (
          <div className="text-center text-xs text-[#A0A2B1] py-12">Belum ada diskusi. Mulai diskusi tentang materi ini.</div>
        ) : (
          messages.map((msg) => {
            const isBot = msg.user_id === "bot";
            const isMe = msg.user_id === user?.user_id && !isBot;
            const isOwnerMsg = msg.user_id === owner?.user_id && !isBot;
            return (
              <div key={msg.message_id} className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}>
                <Avatar className="w-7 h-7 shrink-0">
                  {isBot ? (
                    <div className="w-full h-full rounded-full bg-[#E5A93C] grid place-items-center">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  ) : (
                    <>
                      <AvatarImage src={msg.user_picture} />
                      <AvatarFallback className="bg-[#1D2D50] text-white text-[10px]">{(msg.user_name || "U")[0]}</AvatarFallback>
                    </>
                  )}
                </Avatar>
                <div className={`max-w-[75%] ${isMe ? "items-end" : ""}`}>
                  <div className={`text-[10px] text-[#A0A2B1] mb-0.5 flex items-center gap-1 ${isMe ? "text-right" : ""}`}>
                    {isBot ? "EduBot" : msg.user_name}{isOwnerMsg ? " 👑" : ""}
                  </div>
                  <div className={`rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-line ${
                    isBot ? "bg-[#E5A93C]/10 text-[#1A1B26] border border-[#E5A93C]/20" : isMe ? "bg-[#1D2D50] text-white" : "bg-[#F8F6F0] text-[#1A1B26]"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-[#E2E0D8]">
        <div className="flex gap-2">
          <Textarea
            placeholder="Tulis pesan... (@bot untuk tanya AI)"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                doSend();
              }
            }}
            rows={1}
            className="min-h-[36px] bg-[#F8F6F0] border-[#E2E0D8] text-sm resize-none"
          />
          <Button onClick={doSend} disabled={sending || !content.trim()} className="bg-[#1D2D50] hover:bg-[#243b63] text-white h-9 w-9 p-0 shrink-0">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
