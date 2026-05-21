import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getChatMessages, sendChatMessage, getDocumentQuizResults } from "@/lib/api";
import { toast } from "sonner";

function MarkdownText({ text }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => {
        const heading = line.match(/^###\s+(.+)/);
        if (heading) {
          return <h3 key={i} className="font-heading text-base text-[#1A1B26] mt-3 mb-1">{heading[1]}</h3>;
        }
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        const nodes = parts.map((part, j) => {
          const bold = part.match(/^\*\*(.+)\*\*$/);
          if (bold) {
            return <strong key={j} className="font-semibold text-[#1A1B26]">{bold[1]}</strong>;
          }
          return part;
        });
        return <p key={i} className="text-sm leading-relaxed">{nodes}</p>;
      })}
    </>
  );
}

function TypingDots() {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-[#E5A93C]/20 grid place-items-center shrink-0">
        <Bot className="w-4 h-4 text-[#E5A93C]" />
      </div>
      <div className="bg-[#F8F6F0] rounded-xl px-3 py-2">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-[#E5A93C] rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 bg-[#E5A93C] rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 bg-[#E5A93C] rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

function MentionDropdown({ results, query, onSelect, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const filtered = results.filter((r) => {
    const label = `@Quiz ${(r.created_at || "").slice(0, 10)} ${r.score}/100`;
    return label.toLowerCase().includes(query.toLowerCase());
  });

  if (filtered.length === 0) return null;

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-[#E2E0D8] rounded-lg shadow-lg max-h-40 overflow-y-auto z-10"
    >
      {filtered.map((r) => (
        <button
          key={r.result_id}
          type="button"
          onClick={() => onSelect(r)}
          className="w-full text-left px-3 py-2 text-sm text-[#1A1B26] hover:bg-[#F8F6F0] transition-colors"
        >
          <span className="font-mono text-[#E5A93C]">@</span>
          <span>Quiz </span>
          <span className="text-[#A0A2B1]">{(r.created_at || "").slice(0, 10)}</span>
          <span className="ml-2 font-semibold">{r.score}/100</span>
        </button>
      ))}
    </div>
  );
}

function mentionLabel(result) {
  return `@Quiz ${(result.created_at || "").slice(0, 10)} ${result.score}/100 @result:${result.result_id}`;
}

export default function DocumentAiChat({ documentId, prefillResultId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [quizResults, setQuizResults] = useState([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const prefillDone = useRef(false);

  useEffect(() => {
    let cancelled = false;
    prefillDone.current = false;
    setInitialLoading(true);
    setMessages([]);
    (async () => {
      try {
        const [chatData, resultsData] = await Promise.all([
          getChatMessages(documentId),
          getDocumentQuizResults(documentId),
        ]);
        if (cancelled) return;
        setMessages(chatData.messages || []);
        setQuizResults(resultsData.results || []);
      } catch {
        if (!cancelled) toast.error("Gagal memuat percakapan");
      }
      if (!cancelled) setInitialLoading(false);
    })();
    return () => { cancelled = true; };
  }, [documentId]);

  useEffect(() => {
    if (prefillDone.current || !prefillResultId || quizResults.length === 0) return;
    const match = quizResults.find((r) => r.result_id === prefillResultId);
    if (match) {
      setInput(`${mentionLabel(match)} `);
      prefillDone.current = true;
      inputRef.current?.focus();
    }
  }, [prefillResultId, quizResults]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInput(val);
    const atIdx = val.lastIndexOf("@");
    if (atIdx !== -1) {
      const after = val.slice(atIdx + 1);
      if (!after.includes(" ") && quizResults.length > 0) {
        setMentionOpen(true);
        setMentionQuery(after);
        return;
      }
    }
    setMentionOpen(false);
  };

  const handleMentionSelect = useCallback((result) => {
    setInput((prev) => {
      const atIdx = prev.lastIndexOf("@");
      const before = atIdx >= 0 ? prev.slice(0, atIdx) : prev;
      return `${before}${mentionLabel(result)} `;
    });
    setMentionOpen(false);
    inputRef.current?.focus();
  }, []);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setMentionOpen(false);
    const userMsg = { role: "user", content: q, created_at: new Date().toISOString() };
    setMessages((m) => [...m, userMsg]);
    setLoading(true);
    try {
      const res = await sendChatMessage(documentId, q);
      const aiMsg = { role: "ai", content: res.answer, created_at: new Date().toISOString() };
      setMessages((m) => [...m, aiMsg]);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal menjawab pertanyaan");
      setMessages((m) => [
        ...m,
        { role: "ai", content: "Maaf, gagal menjawab. Coba lagi.", created_at: new Date().toISOString() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (mentionOpen && e.key === "Escape") {
      setMentionOpen(false);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (initialLoading) {
    return (
      <div
        className="bg-white border border-[#E2E0D8] rounded-xl flex flex-col items-center justify-center text-xs text-[#A0A2B1]"
        style={{ height: "500px" }}
        data-testid="document-ai-chat"
      >
        Memuat percakapan…
      </div>
    );
  }

  return (
    <div
      className="bg-white border border-[#E2E0D8] rounded-xl flex flex-col"
      style={{ height: "500px" }}
      data-testid="document-ai-chat"
    >
      <div className="px-5 py-3 border-b border-[#E2E0D8] flex items-center gap-2 shrink-0">
        <Bot className="w-4 h-4 text-[#1D2D50]" />
        <span className="text-sm font-medium text-[#1A1B26]">Tanya AI</span>
        <span className="text-xs text-[#A0A2B1] ml-auto">Tanya tentang dokumen ini</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="text-xs text-[#A0A2B1] text-center pt-10">
            Halo! Ada yang ingin ditanyakan tentang dokumen ini?
            {quizResults.length > 0 && (
              <div className="mt-2">
                Ketik <span className="font-mono text-[#E5A93C]">@</span> untuk menyebut hasil kuis.
              </div>
            )}
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div
              className={`w-7 h-7 rounded-full grid place-items-center shrink-0 ${
                msg.role === "ai" ? "bg-[#E5A93C]/20 text-[#E5A93C]" : "bg-[#1D2D50] text-white"
              }`}
            >
              {msg.role === "ai" ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>
            <div className={`max-w-[80%] ${msg.role === "user" ? "items-end" : ""}`}>
              <div
                className={`rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user" ? "bg-[#1D2D50] text-white" : "bg-[#F8F6F0] text-[#1A1B26]"
                }`}
              >
                {msg.role === "user" ? msg.content : <MarkdownText text={msg.content} />}
              </div>
            </div>
          </div>
        ))}
        {loading && <TypingDots />}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-[#E2E0D8] relative shrink-0">
        {mentionOpen && (
          <MentionDropdown
            results={quizResults}
            query={mentionQuery}
            onSelect={handleMentionSelect}
            onClose={() => setMentionOpen(false)}
          />
        )}
        <div className="flex gap-2">
          <Textarea
            ref={inputRef}
            placeholder="Tanya tentang dokumen ini…"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={1}
            className="min-h-[36px] bg-[#F8F6F0] border-[#E2E0D8] text-sm resize-none placeholder:text-[#A0A2B1]"
          />
          <Button
            onClick={send}
            disabled={loading || !input.trim()}
            className="bg-[#1D2D50] hover:bg-[#243b63] text-white h-9 w-9 p-0 shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
