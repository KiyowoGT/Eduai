// Polls an async fetch function until predicate returns truthy (status === 'ready'),
// or 'failed'/'cancelled' status throws. Returns final object.
export async function pollUntilReady(fetchFn, { intervalMs = 2500, maxMs = 180000, signal } = {}) {
  const start = Date.now();
  while (true) {
    if (signal?.aborted) {
      const err = new Error("Dibatalkan");
      err.cancelled = true;
      throw err;
    }
    const data = await fetchFn();
    const status = data?.status;
    if (status === "ready") return data;
    if (status === "failed") {
      const err = new Error(data?.error || "Proses gagal");
      err.data = data;
      throw err;
    }
    if (status === "cancelled" || status === "deleted") {
      const err = new Error("Proses dibatalkan");
      err.cancelled = true;
      err.data = data;
      throw err;
    }
    if (Date.now() - start > maxMs) {
      throw new Error("Waktu tunggu habis. Coba lagi nanti.");
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
