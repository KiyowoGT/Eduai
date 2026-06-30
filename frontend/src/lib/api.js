import axios from "axios";
import { supabase } from "@/lib/supabase";

const RAW_BACKEND_URL = process.env.REACT_APP_BACKEND_URL?.trim();

const CONFIGURED_BACKEND_URL = RAW_BACKEND_URL && RAW_BACKEND_URL !== "undefined"
  ? RAW_BACKEND_URL.replace(/\/+$/, "")
  : "";

// Gunakan REACT_APP_BACKEND_URL jika disediakan; fallback ke origin saat deploy satu domain.
const BACKEND_URL = CONFIGURED_BACKEND_URL || (typeof window !== "undefined" ? window.location.origin : "");

export const API = `${BACKEND_URL}/api`;
export const WS_API = `${BACKEND_URL.replace(/^http/i, "ws")}/api/ws`;

export const http = axios.create({
  baseURL: API,
  withCredentials: true,
});

http.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

let signingOutOnAuthError = false;
http.interceptors.response.use(
  (resp) => resp,
  async (err) => {
    const status = err?.response?.status;
    if ((status === 401 || status === 403) && !signingOutOnAuthError) {
      signingOutOnAuthError = true;
      try { await supabase.auth.signOut(); } catch {}
      // Force a clean unauthenticated state to avoid runtime crashes.
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    }
    return Promise.reject(err);
  }
);

export async function fetchMe() {
  const r = await http.get("/auth/me");
  return r.data;
}

export async function logout() {
  await http.post("/auth/logout");
}

export async function updateProfile(payload) {
  const r = await http.put("/profile", payload);
  return r.data;
}

export async function updateFriendCode(friend_code) {
  const r = await http.put("/profile/friend-code", { friend_code });
  return r.data;
}

export async function uploadDocument(file) {
  const form = new FormData();
  form.append("file", file);
  const r = await http.post("/documents/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return r.data;
}

export async function cancelDocument(id) {
  const r = await http.post(`/documents/${id}/cancel`);
  return r.data;
}

export async function deleteDocument(id) {
  const r = await http.delete(`/documents/${id}`);
  return r.data;
}

export async function cancelQuiz(id) {
  const r = await http.post(`/quiz/${id}/cancel`);
  return r.data;
}

export async function deleteQuiz(id) {
  const r = await http.delete(`/quiz/${id}`);
  return r.data;
}

export async function cancelResult(id) {
  const r = await http.post(`/quiz/result/${id}/cancel`);
  return r.data;
}

export async function deleteResult(id) {
  const r = await http.delete(`/quiz/result/${id}`);
  return r.data;
}

export async function listQuizResults() {
  const r = await http.get("/quiz/results");
  return r.data;
}

export async function chatQuizResult(resultId, question) {
  const r = await http.post(`/quiz/result/${resultId}/chat`, { question });
  return r.data;
}

export async function listDocuments() {
  const r = await http.get("/documents");
  return r.data;
}

export async function getDocument(id) {
  const r = await http.get(`/documents/${id}`);
  return r.data;
}

export async function generateQuiz(body, question_count = 5) {
  // body: string (document_id) | { document_ids?, folder_id?, document_id?, question_count? }
  const payload = typeof body === "string"
    ? { document_id: body, question_count }
    : { question_count, ...body };
  const r = await http.post("/quiz/generate", payload);
  return r.data;
}

export async function getQuiz(quiz_id) {
  const r = await http.get(`/quiz/${quiz_id}`);
  return r.data;
}

export async function saveQuizProgress(quiz_id, answers, current_step) {
  const r = await http.put(`/quiz/${quiz_id}/progress`, { answers, current_step });
  return r.data;
}

export async function getQuizProgress(quiz_id) {
  const r = await http.get(`/quiz/${quiz_id}/progress`);
  return r.data;
}

// Folders
export async function listFolders() {
  const r = await http.get("/folders");
  return r.data;
}

export async function createFolder(name) {
  const r = await http.post("/folders", { name });
  return r.data;
}

export async function getFolder(id) {
  const r = await http.get(`/folders/${id}`);
  return r.data;
}

export async function renameFolder(id, name) {
  const r = await http.put(`/folders/${id}`, { name });
  return r.data;
}

export async function deleteFolder(id) {
  const r = await http.delete(`/folders/${id}`);
  return r.data;
}

export async function moveDocuments(document_ids, folder_id) {
  const r = await http.post("/documents/move", { document_ids, folder_id });
  return r.data;
}

// Recap
export async function createRecap({ document_ids, folder_id }) {
  const r = await http.post("/recap", { document_ids, folder_id });
  return r.data;
}

export async function getRecap(id) {
  const r = await http.get(`/recap/${id}`);
  return r.data;
}

export async function cancelRecap(id) {
  const r = await http.post(`/recap/${id}/cancel`);
  return r.data;
}

export async function deleteRecap(id) {
  const r = await http.delete(`/recap/${id}`);
  return r.data;
}

export async function listRecaps() {
  const r = await http.get("/recaps");
  return r.data;
}

export async function generateRecapAudio(recapId) {
  const r = await http.post(`/recap/${recapId}/tts`);
  return r.data;
}

export async function generateDocumentAudio(documentId) {
  const r = await http.post(`/documents/${documentId}/tts`);
  return r.data;
}

export async function submitQuiz(quiz_id, answers) {
  const r = await http.post("/quiz/submit", { quiz_id, answers });
  return r.data;
}

export async function getQuizResult(id) {
  const r = await http.get(`/quiz/result/${id}`);
  return r.data;
}

export async function getLatestDocResult(docId) {
  const r = await http.get(`/documents/${docId}/latest-result`);
  return r.data;
}

export async function getLatestFolderResult(folderId) {
  const r = await http.get(`/folders/${folderId}/latest-result`);
  return r.data;
}

export async function listAuditLogs() {
  const r = await http.get("/audit-logs");
  return r.data;
}

export async function getProgress() {
  const r = await http.get("/progress");
  return r.data;
}

// Persistent Document Chat (Tanya AI + @mention quiz results)
export async function getChatMessages(documentId) {
  const r = await http.get(`/chat/${documentId}`);
  return r.data;
}

export async function sendChatMessage(documentId, question) {
  const r = await http.post(`/chat/${documentId}`, { question });
  return r.data;
}

export async function clearChatMessages(documentId) {
  const r = await http.delete(`/chat/${documentId}`);
  return r.data;
}

export async function getDocumentQuizResults(documentId) {
  const r = await http.get(`/chat/${documentId}/quiz-results`);
  return r.data;
}

// ============== Friends ==============
export async function searchUsers(query) {
  const r = await http.get("/users/search", { params: { q: query } });
  return r.data;
}

export async function sendFriendRequest(targetUserId) {
  const r = await http.post("/friends/request", { target_user_id: targetUserId });
  return r.data;
}

export async function listFriendRequests() {
  const r = await http.get("/friends/requests");
  return r.data;
}

export async function acceptFriendRequest(requestId) {
  const r = await http.post(`/friends/requests/${requestId}/accept`);
  return r.data;
}

export async function rejectFriendRequest(requestId) {
  const r = await http.post(`/friends/requests/${requestId}/reject`);
  return r.data;
}

export async function listFriends() {
  const r = await http.get("/friends");
  return r.data;
}

export async function unfriend(targetUserId) {
  const r = await http.delete(`/friends/${targetUserId}`);
  return r.data;
}

export async function blockUser(targetUserId) {
  const r = await http.post("/friends/block", { target_user_id: targetUserId });
  return r.data;
}

// ============== Notifications ==============
export async function listNotifications() {
  const r = await http.get("/notifications");
  return r.data;
}

export async function getUnreadCount() {
  const r = await http.get("/notifications/unread-count");
  return r.data;
}

export async function markNotificationRead(notifId) {
  const r = await http.post(`/notifications/${notifId}/read`);
  return r.data;
}

export async function markAllNotificationsRead() {
  const r = await http.post("/notifications/read-all");
  return r.data;
}

// ============== Discussion ==============
export async function listMessages(docId, before) {
  const r = await http.get(`/documents/${docId}/messages`, { params: before ? { before } : {} });
  return r.data;
}

export async function sendMessage(docId, content) {
  const r = await http.post(`/documents/${docId}/messages`, { content });
  return r.data;
}

export async function inviteToDiscussion(docId, userIds) {
  const r = await http.post(`/documents/${docId}/discussion/invite`, { user_ids: userIds });
  return r.data;
}

export async function listDiscussionParticipants(docId) {
  const r = await http.get(`/documents/${docId}/discussion/participants`);
  return r.data;
}

export async function leaveDiscussion(docId) {
  const r = await http.post(`/documents/${docId}/discussion/leave`);
  return r.data;
}

export async function kickFromDiscussion(docId, userId) {
  const r = await http.post(`/documents/${docId}/discussion/kick`, { user_id: userId });
  return r.data;
}

// ============== AI Chat ==============
export async function chatWithDocument(docId, question) {
  const r = await http.post(`/documents/${docId}/chat`, { question });
  return r.data;
}

// ============== PDF ==============
export async function getDocumentPdfUrl(docId) {
  const r = await http.get(`/documents/${docId}/pdf`);
  return r.data;
}

// ============== Education Settings ==============
export async function saveEducationSettings(payload) {
  const r = await http.put("/user/education", payload);
  return r.data;
}

export async function getEducationSettings() {
  const r = await http.get("/user/education");
  return r.data;
}

export async function generateMaterial(payload) {
  const r = await http.post("/user/education/generate", payload);
  return r.data;
}

export async function listMaterials() {
  const r = await http.get("/user/education/materials");
  return r.data;
}

export async function getMaterial(id) {
  const r = await http.get(`/user/education/materials/${id}`);
  return r.data;
}

export async function deleteMaterial(id) {
  const r = await http.delete(`/user/education/materials/${id}`);
  return r.data;
}

// ============== Teaching Methods ==============
export async function updateTeachingMethods(methods) {
  const r = await http.put("/profile/teaching-methods", { teaching_methods: methods });
  return r.data;
}

export async function uploadSubjectMaterial(subjectId, files, onProgress) {
  const form = new FormData();
  for (const f of files) form.append("files", f);
  const r = await http.post(`/documents/upload-subject-material/${subjectId}`, form, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: onProgress,
  });
  return r.data;
}

export async function createRealtimeSocket() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Sesi login tidak tersedia");
  return new WebSocket(`${WS_API}?token=${encodeURIComponent(token)}`);
}

/**
 * Tunggu status dari WebSocket (pengganti polling).
 * typePrefix: "quiz", "recap", "document", "quiz_result"
 * Membuat koneksi WS sementara, resolve ketika status "ready"/"failed"/"cancelled", timeout jika melebihi batas.
 * Dukung signal dari AbortController untuk pembatalan dari sisi client.
 */
// ============== Auth Helpers ==============
export async function resolveIdentifier(q) {
  const r = await http.get("/auth/resolve-identifier", { params: { q } });
  return r.data;
}

export async function checkExistence(params) {
  const r = await http.get("/auth/check-existence", { params });
  return r.data;
}

// ============== Teacher Role & Dashboard ==============
export async function fetchRoles() {
  const r = await http.get("/auth/roles");
  return r.data;
}

export async function switchRole(role_type) {
  const r = await http.post("/auth/switch-role", { role_type });
  return r.data;
}

export async function onboardingComplete(payload) {
  const r = await http.post("/onboarding/complete", payload);
  return r.data;
}

export async function getTeacherDashboard() {
  const r = await http.get("/teacher/dashboard");
  return r.data;
}

export async function getClassSummary() {
  const r = await http.get("/teacher/analytics/class-summary");
  return r.data;
}

export async function listTeacherStudents() {
  const r = await http.get("/teacher/students");
  return r.data;
}

export async function createStudent(payload) {
  const r = await http.post("/teacher/students", payload);
  return r.data;
}

export async function updateStudent(studentId, payload) {
  const r = await http.put(`/teacher/students/${studentId}`, payload);
  return r.data;
}

export async function deleteStudent(studentId) {
  const r = await http.delete(`/teacher/students/${studentId}`);
  return r.data;
}

export async function uploadStudentsCsv(file) {
  const form = new FormData();
  form.append("file", file);
  const r = await http.post("/teacher/students/upload", form);
  return r.data;
}

export async function listTeacherMaterials() {
  const r = await http.get("/teacher/materials");
  return r.data;
}

export async function uploadTeacherMaterial(file, subjectName, targetClasses) {
  const form = new FormData();
  form.append("file", file);
  form.append("subject_name", subjectName);
  if (targetClasses && targetClasses.length > 0) {
    form.append("target_classes", JSON.stringify(targetClasses));
  }
  const r = await http.post("/teacher/materials/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return r.data;
}

export async function publishTeacherMaterial(docId) {
  const r = await http.post(`/teacher/materials/${docId}/publish`);
  return r.data;
}

export async function reviewTeacherMaterial(docId, payload) {
  const r = await http.post(`/teacher/materials/${docId}/review`, payload);
  return r.data;
}

export async function updateTeacherMaterial(docId, payload) {
  const r = await http.put(`/teacher/materials/${docId}`, payload);
  return r.data;
}

export async function generateTeacherQuiz(docId, questionCount, targetClasses, deadline) {
  const r = await http.post("/teacher/quizzes/generate", {
    document_id: docId,
    question_count: questionCount,
    target_classes: targetClasses || [],
    deadline: deadline || null,
  });
  return r.data;
}

export async function getTeacherQuizResults(quizId) {
  const r = await http.get(`/teacher/quizzes/${quizId}/results`);
  return r.data;
}

export async function listAssignedQuizzes() {
  const r = await http.get("/quiz/assigned");
  return r.data;
}

export async function getPribadiStudentsAnalysis() {
  const r = await http.get("/teacher/analytics/pribadi/students");
  return r.data;
}

export async function analyzeStudentCharacter(studentId) {
  const r = await http.post(`/teacher/analytics/student/${studentId}/analyze`);
  return r.data;
}

export async function listPendingReviewMaterials() {
  const r = await http.get("/teacher/materials/pending-review");
  return r.data;
}

export async function publishTeacherQuiz(quizId, className, scheduleId) {
  const r = await http.post(`/teacher/quizzes/${quizId}/publish`, {
    class_name: className,
    schedule_id: scheduleId,
  });
  return r.data;
}

export async function generateRedeemCode(quizId, expiresAt) {
  const r = await http.post(`/redeem/teacher/quizzes/${quizId}/redeem-code`, {
    expires_at: expiresAt,
  });
  return r.data;
}

export async function getRedeemQuiz(code) {
  const r = await http.get(`/redeem/${encodeURIComponent(code)}`);
  return r.data;
}

export async function startRedeemQuiz(code) {
  const r = await http.post(`/redeem/${encodeURIComponent(code)}/start`);
  return r.data;
}

export async function submitRedeemQuiz(code, sessionToken, answers, studentIdentifier) {
  const r = await http.post(`/redeem/${encodeURIComponent(code)}/submit`, {
    session_token: sessionToken,
    answers,
    student_identifier: studentIdentifier,
  });
  return r.data;
}

export async function getRedeemSession(sessionId) {
  const r = await http.get(`/redeem/session/${sessionId}`);
  return r.data;
}

export async function listMyRedeemSessions() {
  const r = await http.get("/redeem/my-sessions");
  return r.data;
}

export async function listMyRedeemMaterials() {
  const r = await http.get("/redeem/my-materials");
  return r.data;
}

export async function generateMusicSummary(docId, tags) {
  const r = await http.post(`/documents/${docId}/music-summary`, { tags });
  return r.data;
}

export async function createClassToken(payload) {
  const r = await http.post("/class-tokens", payload);
  return r.data;
}

export async function listClassTokens() {
  const r = await http.get("/class-tokens");
  return r.data;
}

export async function deleteClassToken(token) {
  const r = await http.delete(`/class-tokens/${token}`);
  return r.data;
}

export async function listTeacherMaterialsClasses() {
  const r = await http.get("/teacher/materials/classes");
  return r.data;
}

export async function listTeacherSchedules() {
  const r = await http.get("/teacher/schedules");
  return r.data;
}

export async function getAdminTeachers() {
  const r = await http.get("/admin/users");
  const data = r.data;
  const list = Array.isArray(data) ? data : (data?.users || data?.teachers || []);
  return { users: list, teachers: list };
}

export async function suspendUser(userId, durationMinutes) {
  const r = await http.post(`/admin/users/${userId}/suspend`, { duration_minutes: durationMinutes });
  return r.data;
}

export async function banUser(userId) {
  const r = await http.delete(`/admin/users/${userId}`);
  return r.data;
}

export async function getAdminTeacherDetails(id) {
  const r = await http.get(`/admin/users/teachers/${id}`);
  return r.data;
}

export async function createAdminTeacher(payload) {
  const r = await http.post("/admin/users/teachers", payload);
  return r.data;
}

export async function updateAdminTeacher(id, payload) {
  const r = await http.put(`/admin/users/teachers/${id}`, payload);
  return r.data;
}

export async function getAdminAcademicYears() {
  const r = await http.get("/admin/academic-years");
  return r.data;
}

export async function getAdminAcademicSummary() {
  const r = await http.get("/admin/academic-summary");
  return r.data;
}

export async function redeemShadowWorkspace(code) {
  const r = await http.post("/shadow-workspace/redeem", { redeem_code: code });
  return r.data;
}

export async function listShadowActivities() {
  const r = await http.get("/shadow-workspace/activities");
  return r.data;
}

export async function joinClassByToken(token) {
  const r = await http.post("/student/join-class", { class_token: token });
  return r.data;
}

export function waitForStatus(typePrefix, id, { timeoutMs = 180000, signal } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let ws = null;

    const cleanup = () => {
      settled = true;
      clearTimeout(timer);
      ws?.close();
    };

    if (signal?.aborted) {
      const err = new Error("Dibatalkan");
      err.cancelled = true;
      return reject(err);
    }

    const timer = setTimeout(() => {
      if (!settled) {
        cleanup();
        reject(new Error("Waktu tunggu habis. Coba lagi nanti."));
      }
    }, timeoutMs);

    const onAbort = () => {
      if (!settled) {
        cleanup();
        const err = new Error("Dibatalkan");
        err.cancelled = true;
        reject(err);
      }
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    createRealtimeSocket().then((socket) => {
      if (settled) { socket.close(); return; }
      ws = socket;
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (settled) return;

          const typeKey = `${typePrefix}_id`;
          if (payload.type === `${typePrefix}_status` && payload[typeKey] === id) {
            const status = payload.status;
            if (status === "ready") {
              cleanup();
              signal?.removeEventListener("abort", onAbort);
              resolve(payload);
            } else if (status === "failed") {
              cleanup();
              signal?.removeEventListener("abort", onAbort);
              const err = new Error(payload.error || "Proses gagal");
              err.data = payload;
              reject(err);
            } else if (status === "cancelled" || status === "deleted") {
              cleanup();
              signal?.removeEventListener("abort", onAbort);
              const err = new Error("Proses dibatalkan");
              err.cancelled = true;
              err.data = payload;
              reject(err);
            }
          }
        } catch {}
      };
      ws.onerror = () => {
        if (!settled) {
          cleanup();
          signal?.removeEventListener("abort", onAbort);
          reject(new Error("Koneksi WebSocket gagal"));
        }
      };
    }).catch((err) => {
      if (!settled) {
        cleanup();
        signal?.removeEventListener("abort", onAbort);
        reject(err);
      }
    });
  });
}

// ============== Personality Profiling ==============
export async function getPersonalityQuestions() {
  const r = await http.get("/personality/questions");
  return r.data;
}

export async function submitPersonalityAssessment(answers) {
  const r = await http.post("/personality/submit", { answers });
  return r.data;
}

export async function getPersonalityProfile() {
  const r = await http.get("/personality/profile");
  return r.data;
}

export async function getClassPersonalityInsights(classId) {
  const r = await http.get(`/teacher/class/${classId}/personality-insights`);
  return r.data;
}
