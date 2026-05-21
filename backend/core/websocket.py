import asyncio
from typing import Set
from fastapi import WebSocket

class RealtimeHub:
    def __init__(self):
        self._connections: dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            self._connections.setdefault(user_id, set()).add(websocket)

    async def disconnect(self, user_id: str, websocket: WebSocket):
        async with self._lock:
            conns = self._connections.get(user_id)
            if not conns:
                return
            conns.discard(websocket)
            if not conns:
                self._connections.pop(user_id, None)

    async def broadcast(self, user_id: str, payload: dict):
        async with self._lock:
            targets = list(self._connections.get(user_id, set()))
        stale: list[WebSocket] = []
        for ws in targets:
            try:
                await ws.send_json(payload)
            except Exception:
                stale.append(ws)
        if stale:
            async with self._lock:
                conns = self._connections.get(user_id)
                if conns:
                    for ws in stale:
                        conns.discard(ws)
                    if not conns:
                        self._connections.pop(user_id, None)

realtime_hub = RealtimeHub()
