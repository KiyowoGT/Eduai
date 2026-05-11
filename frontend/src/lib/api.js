import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const http = axios.create({
  baseURL: API,
  withCredentials: true,
});

export async function fetchMe() {
  const r = await http.get("/auth/me");
  return r.data;
}
export async function logout() {
  await http.post("/auth/logout");
}
export async function processSession(session_id) {
  const r = await http.post("/auth/session", { session_id });
  return r.data;
}
export async function updateProfile(payload) {
  const r = await http.put("/profile", payload);
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
export async function listDocuments() {
  const r = await http.get("/documents");
  return r.data;
}
export async function getDocument(id) {
  const r = await http.get(`/documents/${id}`);
  return r.data;
}
export async function generateQuiz(document_id, question_count = 5) {
  const r = await http.post("/quiz/generate", { document_id, question_count });
  return r.data;
}
export async function getQuiz(quiz_id) {
  const r = await http.get(`/quiz/${quiz_id}`);
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
export async function listAuditLogs() {
  const r = await http.get("/audit-logs");
  return r.data;
}
export async function getProgress() {
  const r = await http.get("/progress");
  return r.data;
}
