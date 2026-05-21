import { useEffect, useRef } from "react";
import { createRealtimeSocket } from "@/lib/api";

export default function useRealtimeSocket(onMessage, enabled = true) {
  const handlerRef = useRef(onMessage);
  const socketRef = useRef(null);
  const retryRef = useRef(null);

  useEffect(() => {
    handlerRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;

    const connect = async () => {
      try {
        const ws = await createRealtimeSocket();
        if (cancelled) {
          ws.close();
          return;
        }
        socketRef.current = ws;
        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            handlerRef.current?.(payload);
          } catch {}
        };
        ws.onclose = () => {
          if (!cancelled) {
            retryRef.current = window.setTimeout(connect, 2000);
          }
        };
      } catch {
        if (!cancelled) {
          retryRef.current = window.setTimeout(connect, 3000);
        }
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (retryRef.current) window.clearTimeout(retryRef.current);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [enabled]);
}
