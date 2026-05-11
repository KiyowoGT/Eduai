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
