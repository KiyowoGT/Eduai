import { Sparkles } from "lucide-react";

export default function DualLoader({ type = "default", text = "Memuat data...", variant = "skeleton" }) {
  // Skeleton renderers based on type
  const renderSkeleton = () => {
    switch (type) {
      case "landing":
        return (
          <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 animate-pulse space-y-16">
            {/* Header skeleton */}
            <div className="h-20 flex items-center justify-between border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-800 rounded-lg" />
                <div className="w-32 h-6 bg-gray-200 dark:bg-gray-800 rounded" />
              </div>
              <div className="flex gap-6">
                <div className="w-20 h-4 bg-gray-200 dark:bg-gray-800 rounded" />
                <div className="w-20 h-4 bg-gray-200 dark:bg-gray-800 rounded" />
              </div>
            </div>
            {/* Hero skeleton */}
            <div className="grid lg:grid-cols-12 gap-16 items-center pt-10">
              <div className="lg:col-span-7 space-y-6">
                <div className="w-48 h-8 bg-gray-200 dark:bg-gray-800 rounded-full" />
                <div className="w-full max-w-xl h-16 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
                <div className="w-3/4 max-w-md h-8 bg-gray-200 dark:bg-gray-800 rounded" />
                <div className="flex gap-4 pt-4">
                  <div className="w-36 h-12 bg-gray-200 dark:bg-gray-800 rounded-xl" />
                  <div className="w-36 h-12 bg-gray-200 dark:bg-gray-800 rounded-xl" />
                </div>
              </div>
              <div className="lg:col-span-5">
                <div className="w-full h-80 bg-gray-200 dark:bg-gray-800 rounded-[2.5rem]" />
              </div>
            </div>
          </div>
        );

      case "dashboard":
        return (
          <div className="w-full animate-pulse space-y-8">
            {/* Welcome banner */}
            <div className="space-y-3">
              <div className="w-32 h-4 bg-gray-200 dark:bg-gray-800 rounded" />
              <div className="w-64 h-8 bg-gray-200 dark:bg-gray-800 rounded" />
            </div>
            {/* Drag & drop zone */}
            <div className="w-full h-44 bg-gray-200 dark:bg-gray-800 rounded-xl" />
            {/* Stats grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl" />
              <div className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl" />
              <div className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl" />
            </div>
            {/* Learning settings card */}
            <div className="w-full h-20 bg-gray-200 dark:bg-gray-800 rounded-xl" />
          </div>
        );

      case "documents":
      case "folders":
      case "friends":
        return (
          <div className="w-full animate-pulse space-y-6">
            <div className="flex justify-between items-center">
              <div className="w-48 h-8 bg-gray-200 dark:bg-gray-800 rounded" />
              <div className="w-24 h-8 bg-gray-200 dark:bg-gray-800 rounded" />
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-40 bg-gray-200 dark:bg-gray-800 rounded-xl p-5 space-y-4">
                  <div className="w-8 h-8 bg-gray-300 dark:bg-gray-700 rounded-full" />
                  <div className="w-full h-6 bg-gray-300 dark:bg-gray-700 rounded" />
                  <div className="w-1/2 h-4 bg-gray-300 dark:bg-gray-700 rounded" />
                </div>
              ))}
            </div>
          </div>
        );

      case "document-detail":
        return (
          <div className="w-full animate-pulse space-y-6">
            {/* Document details header */}
            <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-800">
              <div className="space-y-2">
                <div className="w-64 h-8 bg-gray-200 dark:bg-gray-800 rounded" />
                <div className="w-32 h-4 bg-gray-200 dark:bg-gray-800 rounded" />
              </div>
              <div className="w-24 h-10 bg-gray-200 dark:bg-gray-800 rounded-xl" />
            </div>
            {/* Layout split */}
            <div className="grid lg:grid-cols-12 gap-8 pt-4">
              {/* Left Column PDF skeleton */}
              <div className="lg:col-span-7 h-[600px] bg-gray-200 dark:bg-gray-800 rounded-2xl" />
              {/* Right Column details panel skeleton */}
              <div className="lg:col-span-5 space-y-6">
                <div className="h-44 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
                <div className="h-44 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
                <div className="h-44 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
              </div>
            </div>
          </div>
        );

      case "education-settings":
        return (
          <div className="w-full animate-pulse space-y-6">
            <div className="w-64 h-8 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="grid lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 h-96 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
              <div className="lg:col-span-4 h-96 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
            </div>
          </div>
        );

      case "teacher-detail":
      case "profile":
        return (
          <div className="w-full animate-pulse space-y-8">
            <div className="flex gap-6 items-center">
              <div className="w-20 h-20 bg-gray-200 dark:bg-gray-800 rounded-full" />
              <div className="space-y-3">
                <div className="w-48 h-6 bg-gray-200 dark:bg-gray-800 rounded" />
                <div className="w-32 h-4 bg-gray-200 dark:bg-gray-800 rounded" />
              </div>
            </div>
            <div className="w-full h-80 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
          </div>
        );

      default:
        return (
          <div className="w-full animate-pulse space-y-4 p-6">
            <div className="w-1/3 h-6 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="w-full h-4 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="w-full h-4 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="w-2/3 h-4 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="h-24 bg-gray-200 dark:bg-gray-800 rounded-lg" />
              <div className="h-24 bg-gray-200 dark:bg-gray-800 rounded-lg" />
            </div>
          </div>
        );
    }
  };

  return (
    <div className={`relative w-full ${type === "landing" ? "min-h-screen pt-44" : "min-h-[400px]"} transition-colors duration-500`}>
      {/* Background skeleton layer */}
      <div className="w-full z-0 opacity-40 dark:opacity-20 pointer-events-none">
        {renderSkeleton()}
      </div>

      {/* Foreground cool animated loader overlay — only shown for 'full' variant */}
      {variant === "full" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-transparent backdrop-blur-[2px]">
          <div className="p-8 rounded-[2.5rem] bg-white/90 dark:bg-white/5 border border-white/50 dark:border-white/10 shadow-2xl backdrop-blur-xl text-center scale-95 md:scale-100 transition-all">
            <div className="relative w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <div className="absolute inset-0 rounded-[1.7rem] border-2 border-dashed border-[#E5A93C]/40 dark:border-[#E5A93C]/30 animate-[spin_15s_linear_infinite]" />
              <div className="absolute inset-1.5 rounded-full border-2 border-t-[#E5A93C] border-r-[#1D2D50] border-b-[#B83A4B] border-l-transparent dark:border-r-white/40 animate-[spin_1.5s_linear_infinite]" />
              <div className="absolute inset-3.5 rounded-2xl bg-[#1D2D50] dark:bg-[#E5A93C] flex items-center justify-center shadow-lg border border-white/10 overflow-hidden">
                <img src="/img/logo-schooly-owl.png" alt="Schooly AI" className="w-10 h-10 object-contain animate-pulse" />
              </div>
              <div className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full bg-[#E5A93C] dark:bg-[#1D2D50] border-2 border-white dark:border-[#12131A] flex items-center justify-center shadow-lg animate-bounce">
                <Sparkles className="w-2.5 h-2.5 text-[#1D2D50] dark:text-[#E5A93C]" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="font-heading text-lg text-[#1A1B26] dark:text-white tracking-tight leading-none">Schooly AI</p>
              <p className="text-[10px] uppercase tracking-widest text-[#646675] dark:text-[#A0A2B1] font-black">{text}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
