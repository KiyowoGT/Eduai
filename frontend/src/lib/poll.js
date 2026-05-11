// Polls an async fetch function until predicate returns truthy (status === 'ready'),
// or 'failed' status throws. Returns final object.
export async function pollUntilReady(fetchFn, { intervalMs = 2500, maxMs = 180000 } = {}) {
  const start = Date.now();
  while (true) {
    const data = await fetchFn();
    const status = data?.status;
    if (status === "ready") return data;
    if (status === "failed") {
      const msg = data?.error || "Proses gagal";
      const err = new Error(msg);
      err.data = data;
      throw err;
    }
    if (Date.now() - start > maxMs) {
      throw new Error("Waktu tunggu habis. Coba lagi nanti.");
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
