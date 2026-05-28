import { useCallback, useEffect, useState } from "react";
import { Users, UserPlus, Search, Check, X, Clock, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { searchUsers, sendFriendRequest, listFriendRequests, acceptFriendRequest, rejectFriendRequest, listFriends, unfriend, blockUser } from "@/lib/api";
import PageSkeleton from "@/components/PageSkeleton";

export default function Friends() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [friendRes, requestRes] = await Promise.all([listFriends(), listFriendRequests()]);
      setFriends(friendRes?.friends ?? []);
      setRequests(requestRes?.requests ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const doSearch = async (value) => {
    setQuery(value);
    if (!value.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await searchUsers(value);
      setSearchResults(res?.users ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const doSendRequest = async (targetId) => {
    try {
      await sendFriendRequest(targetId);
      toast.success("Permintaan pertemanan dikirim");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal mengirim permintaan");
    }
  };

  const doAccept = async (requestId) => {
    try {
      await acceptFriendRequest(requestId);
      toast.success("Permintaan diterima");
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal menerima");
    }
  };

  const doReject = async (requestId) => {
    try {
      await rejectFriendRequest(requestId);
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal menolak");
    }
  };

  const doUnfriend = async (targetId) => {
    try {
      await unfriend(targetId);
      toast.success("Pertemanan dihapus");
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal menghapus teman");
    }
  };

  const doBlock = async (targetId) => {
    try {
      await blockUser(targetId);
      toast.success("User diblokir");
      loadData();
      if (query.trim()) doSearch(query);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal memblokir user");
    }
  };

  return (
    <div className="w-full" data-testid="friends-page">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1] flex items-center gap-2">
          <Users className="w-3.5 h-3.5" /> Sosial
        </div>
        <h1 className="font-heading text-3xl lg:text-4xl text-[#1A1B26] mt-2 leading-tight">Teman</h1>
      </div>

      <div className="mb-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A2B1]" />
          <Input placeholder="Cari teman berdasarkan nama, email, atau friend code..." value={query} onChange={(e) => doSearch(e.target.value)} className="pl-10 bg-white border-[#E2E0D8]" />
        </div>
        {query.trim() && (
          <div className="mt-3 bg-white border border-[#E2E0D8] rounded-xl overflow-hidden">
            {searching ? (
              <div className="p-4 text-sm text-[#646675]">Mencari...</div>
            ) : searchResults.length === 0 ? (
              <div className="p-4 text-sm text-[#646675]">Tidak ditemukan</div>
            ) : (
              searchResults.map((item) => (
                <div key={item.user_id} className="flex items-center justify-between p-3 hover:bg-[#F8F6F0] border-b border-[#E2E0D8] last:border-0">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={item.picture} />
                      <AvatarFallback className="bg-[#1D2D50] text-white text-xs">{(item.name || "U")[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-medium text-[#1A1B26]">{item.name}</div>
                      <div className="text-xs text-[#A0A2B1]">
                        {item.friend_code && <span className="font-mono text-[#1D2D50]">{item.friend_code}</span>}
                        {item.friend_code && (item.education_level || item.institution) ? " · " : ""}
                        {item.education_level || ""}{item.institution ? ` ${item.institution}` : ""}
                      </div>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => doSendRequest(item.user_id)} className="bg-[#1D2D50] hover:bg-[#243b63] text-white h-8 px-3 text-xs">
                    <UserPlus className="w-3.5 h-3.5 mr-1" /> Tambah
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <Tabs defaultValue="teman" className="w-full">
        <TabsList className="bg-white border border-[#E2E0D8] p-1 h-auto mb-6">
          <TabsTrigger value="teman" className="data-[state=active]:bg-[#1D2D50] data-[state=active]:text-white px-4 py-2">
            <UserCheck className="w-4 h-4 mr-2" /> Teman ({friends.length})
          </TabsTrigger>
          <TabsTrigger value="permintaan" className="data-[state=active]:bg-[#1D2D50] data-[state=active]:text-white px-4 py-2">
            <Clock className="w-4 h-4 mr-2" /> Permintaan ({requests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="teman">
          {loading ? (
            <PageSkeleton variant="friends" />
          ) : friends.length === 0 ? (
            <div className="bg-white border border-dashed border-[#E2E0D8] rounded-xl p-10 text-center text-sm text-[#646675]">
              Belum punya teman. Cari dan tambah teman di atas.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {friends.map((friend) => (
                <div key={friend.user_id} className="bg-white border border-[#E2E0D8] rounded-xl p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={friend.picture} />
                      <AvatarFallback className="bg-[#1D2D50] text-white">{(friend.name || "U")[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-medium text-[#1A1B26]">{friend.name}</div>
                      <div className="text-xs text-[#A0A2B1]">
                        {friend.friend_code && <span className="font-mono text-[#1D2D50]">{friend.friend_code}</span>}
                        {friend.friend_code && (friend.education_level || friend.institution) ? " · " : ""}
                        {friend.education_level || ""}{friend.institution ? ` ${friend.institution}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => doUnfriend(friend.user_id)} className="border-[#E2E0D8] text-[#646675] h-8 px-3 text-xs">
                      Unfriend
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => doBlock(friend.user_id)} className="border-[#E2E0D8] text-[#B83A4B] h-8 px-3 text-xs">
                      Block
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="permintaan">
          {requests.length === 0 ? (
            <div className="bg-white border border-dashed border-[#E2E0D8] rounded-xl p-10 text-center text-sm text-[#646675]">
              Tidak ada permintaan pertemanan.
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <div key={req.friend_request_id} className="bg-white border border-[#E2E0D8] rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#1D2D50] grid place-items-center text-white text-sm font-medium">
                      {(req.from_user_name || "?")[0]}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[#1A1B26]">{req.from_user_name}</div>
                      <div className="text-xs text-[#A0A2B1]">Ingin menjadi teman</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => doAccept(req.friend_request_id)} className="bg-[#1D2D50] text-white h-8 px-3 text-xs">
                      <Check className="w-3.5 h-3.5 mr-1" /> Terima
                    </Button>
                    <Button size="sm" onClick={() => doReject(req.friend_request_id)} variant="outline" className="border-[#E2E0D8] text-[#646675] h-8 px-3 text-xs">
                      <X className="w-3.5 h-3.5 mr-1" /> Tolak
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
