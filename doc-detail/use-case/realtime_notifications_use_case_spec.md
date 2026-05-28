# Use Case: Real-time Notifications (useRealtimeSocket)

Actor: System (backend), Any connected client (student/teacher)

Description: Mekanisme WebSocket/Realtimesocket untuk mengirim event (document_status, quiz_status, discussion_message, feedback_ready) kepada client yang terhubung.

Preconditions:
- Client telah membuka aplikasi dan inisialisasi koneksi WebSocket (useRealtimeSocket hook).
- Server memiliki endpoint/implementation createRealtimeSocket() yang mengautentikasi koneksi.

Postconditions:
- Event dikirim ke client yang relevan; client bereaksi (refresh data atau tampilkan notifikasi).
- Jika koneksi terputus, client mencoba reconnect (exponential backoff).

Main Flow:
1. Client inisialisasi useRealtimeSocket(callback). Hook membuka koneksi ke createRealtimeSocket().
2. Server mengirim event JSON: {type: 'document_status', document_id, status} atau {type: 'quiz_status', quiz_id, status} etc.
3. Hook mem-parsing payload dan menyalurkan ke handler callback.
4. Client handler merespon: mis. loadData(false) untuk document_status atau navigate ketika quiz ready.

Alternative Flows:
- 2a. Event payload invalid: handler mengabaikan dan log error.
- 1a. Koneksi gagal (auth error): hook menghentikan reconnection dan client menampilkan pesan login.

Mapping ke kode:
- Frontend: src/hooks/useRealtimeSocket.js, components/pages listening to events (DocumentDetail, Dashboard, DocumentDiscussion)
- Backend: createRealtimeSocket() in api client or backend websocket server implementation
- Events: document_status, quiz_status, discussion_message, result_feedback_ready

Security:
- Authenticate WS connection using Bearer token or session cookie.
- Validate event authorization server-side to avoid leaking data across tenants.