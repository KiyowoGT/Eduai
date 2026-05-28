import { useState } from "react";
import { Loader2, Music, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import axios from "axios";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

async function generate(prompt, style, engine) {
  const r = await axios.post(`${BACKEND}/dev/music-test`, { prompt, style, engine });
  return r.data;
}

function ResultCard({ label, result, loading, error }) {
  return (
    <div className="bg-white dark:bg-white/5 border border-[#E2E0D8] dark:border-white/10 rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Music className="w-4 h-4 text-[#1D2D50] dark:text-[#E5A93C]" />
        <span className="font-heading text-lg text-[#1A1B26] dark:text-white">{label}</span>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-[#646675] dark:text-white/50">
          <Loader2 className="w-4 h-4 animate-spin" /> Generating...
        </div>
      )}

      {error && <div className="text-sm text-[#B83A4B]">{error}</div>}

      {result && (
        <>
          {result.audio_url && (
            <audio controls src={result.audio_url} className="w-full" />
          )}
          {result.lyrics && (
            <pre className="text-xs text-[#646675] dark:text-white/60 whitespace-pre-wrap bg-[#F8F6F0] dark:bg-white/5 rounded-lg p-4 max-h-64 overflow-y-auto font-mono">
              {result.lyrics}
            </pre>
          )}
          {result.songs?.length > 1 && (
            <div className="space-y-2">
              <div className="text-xs text-[#A0A2B1] uppercase tracking-wider">Variasi lain:</div>
              {result.songs.slice(1).map((s, i) => (
                <audio key={i} controls src={s.audioUrl} className="w-full" />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function MusicTest() {
  const [prompt, setPrompt] = useState("Rangkuman materi fotosintesis untuk pelajar SMA, genre pop ceria");
  const [style, setStyle] = useState("pop, upbeat, educational");
  const [oldResult, setOldResult] = useState(null);
  const [newResult, setNewResult] = useState(null);
  const [oldLoading, setOldLoading] = useState(false);
  const [newLoading, setNewLoading] = useState(false);
  const [oldError, setOldError] = useState(null);
  const [newError, setNewError] = useState(null);

  const runBoth = async () => {
    setOldResult(null); setNewResult(null);
    setOldError(null); setNewError(null);
    setOldLoading(true); setNewLoading(true);

    generate(prompt, style, "old")
      .then(setOldResult).catch(e => setOldError(e?.response?.data?.detail || e.message))
      .finally(() => setOldLoading(false));

    generate(prompt, style, "suno")
      .then(setNewResult).catch(e => setNewError(e?.response?.data?.detail || e.message))
      .finally(() => setNewLoading(false));
  };

  const runOne = async (engine) => {
    if (engine === "old") {
      setOldResult(null); setOldError(null); setOldLoading(true);
      generate(prompt, style, "old")
        .then(setOldResult).catch(e => setOldError(e?.response?.data?.detail || e.message))
        .finally(() => setOldLoading(false));
    } else {
      setNewResult(null); setNewError(null); setNewLoading(true);
      generate(prompt, style, "suno")
        .then(setNewResult).catch(e => setNewError(e?.response?.data?.detail || e.message))
        .finally(() => setNewLoading(false));
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.2em] text-[#A0A2B1] mb-1">Dev Tool</div>
        <h1 className="font-heading text-3xl text-[#1A1B26] dark:text-white">Music Generation Test</h1>
        <p className="text-sm text-[#646675] dark:text-white/50 mt-1">Bandingkan output Ace-Step (lama) vs Suno/nekorinn (baru)</p>
      </div>

      <div className="bg-white dark:bg-white/5 border border-[#E2E0D8] dark:border-white/10 rounded-xl p-5 mb-6 space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-[0.15em] text-[#A0A2B1] mb-1.5">Prompt</label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={3}
            className="w-full px-4 py-2.5 rounded-lg border border-[#E2E0D8] dark:border-white/10 bg-white dark:bg-white/5 text-sm text-[#1A1B26] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20 resize-none"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-[0.15em] text-[#A0A2B1] mb-1.5">Style / Tags</label>
          <input
            value={style}
            onChange={e => setStyle(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-[#E2E0D8] dark:border-white/10 bg-white dark:bg-white/5 text-sm text-[#1A1B26] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1D2D50]/20"
          />
        </div>
        <div className="flex gap-3 flex-wrap">
          <Button onClick={runBoth} disabled={oldLoading || newLoading} className="bg-[#1D2D50] hover:bg-[#1D2D50]/90 text-white">
            <Play className="w-4 h-4 mr-2" /> Generate Keduanya
          </Button>
          <Button variant="outline" onClick={() => runOne("old")} disabled={oldLoading}>
            {oldLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Ace-Step saja
          </Button>
          <Button variant="outline" onClick={() => runOne("suno")} disabled={newLoading}>
            {newLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Suno saja
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <ResultCard label="🎸 Ace-Step (Lama)" result={oldResult} loading={oldLoading} error={oldError} />
        <ResultCard label="🎵 Suno / nekorinn (Baru)" result={newResult} loading={newLoading} error={newError} />
      </div>
    </div>
  );
}
