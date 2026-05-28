export function getDocumentStatusMeta(doc) {
  const stage = doc?.processing_stage || (doc?.status === "processing" ? (doc?.summary ? "hobby" : "analysis") : null);
  const hobbyStatus = doc?.hobby_status || "idle";

  if (doc?.status === "published") {
    return {
      tone: "ready",
      chip: "Terbit",
      detail: "Materi dari pengajar sudah siap dipelajari.",
    };
  }

  if (doc?.status === "ready") {
    if (hobbyStatus === "cancelled") {
      return {
        tone: "ready",
        chip: "Selesai",
        detail: "Rangkuman siap, ubah ke hobi dibatalkan.",
      };
    }
    if (hobbyStatus === "ready") {
      return {
        tone: "ready",
        chip: "Selesai",
        detail: "Analisis, rangkuman, dan personalisasi selesai.",
      };
    }
    return {
      tone: "ready",
      chip: "Selesai",
      detail: "Analisis dan rangkuman selesai.",
    };
  }

  if (doc?.status === "failed") {
    return {
      tone: "failed",
      chip: "Gagal",
      detail: "Proses AI gagal diselesaikan.",
    };
  }

  if (doc?.status === "cancelled") {
    return {
      tone: "cancelled",
      chip: "Dibatalkan",
      detail: "Proses analisis dibatalkan sebelum rangkuman selesai.",
    };
  }

  if (stage === "hobby") {
    return {
      tone: "processing",
      chip: "Proses",
      detail: "Rangkuman sedang diubah sesuai hobi.",
    };
  }

  return {
    tone: "processing",
    chip: "Proses",
    detail: "AI sedang menganalisis file dan membuat rangkuman.",
  };
}

export function getDocumentStatusClasses(tone) {
  if (tone === "ready") return "bg-[#2D6A4F]/10 text-[#2D6A4F]";
  if (tone === "failed") return "bg-[#B83A4B]/10 text-[#B83A4B]";
  if (tone === "cancelled") return "bg-[#A0A2B1]/10 text-[#646675]";
  return "bg-[#E5A93C]/10 text-[#E5A93C]";
}
