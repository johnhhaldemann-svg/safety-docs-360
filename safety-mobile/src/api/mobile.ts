import { api } from "@/api/client";
import type { MobileMe } from "@/types/mobile";

type MobilePhoto = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

export async function login(email: string, password: string) {
  const { data } = await api.post("/auth/login", { email, password });
  return data as {
    accessToken: string;
    refreshToken?: string;
    user: { id: string; email: string };
  };
}

export async function getMe() {
  const { data } = await api.get("/me");
  return data as MobileMe;
}

export async function getFeatures() {
  const { data } = await api.get("/me/features");
  return data as Pick<MobileMe, "features" | "featureMap">;
}

export async function listJsas() {
  const { data } = await api.get("/jsa");
  return data.jsas ?? [];
}

export async function createJsa(body: Record<string, unknown>) {
  const { data } = await api.post("/jsa", body);
  return data;
}

export async function createJsaActivity(body: Record<string, unknown>) {
  const { data } = await api.post("/jsa-activities", body);
  return data;
}

export async function submitJsa(id: string) {
  const { data } = await api.post(`/jsa/${id}/submit`);
  return data;
}

async function uploadPhoto(endpoint: string, photo: MobilePhoto) {
  const formData = new FormData();
  const fileName = photo.fileName || photo.uri.split("/").pop() || "photo.jpg";
  const mimeType = photo.mimeType || "image/jpeg";
  formData.append("photo", {
    uri: photo.uri,
    name: fileName,
    type: mimeType
  } as unknown as Blob);
  formData.append("fileName", fileName);
  formData.append("mimeType", mimeType);
  const { data } = await api.post(endpoint, formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return data;
}

export async function uploadJsaPhoto(id: string, photo: MobilePhoto) {
  return uploadPhoto(`/jsa/${id}/photos`, photo);
}

export async function signJsa(id: string, signatureText: string) {
  const { data } = await api.post(`/jsa/${id}/signatures`, {
    signatureText,
    crewAcknowledged: true,
    supervisorReviewed: true
  });
  return data;
}

export async function listFieldIssues() {
  const { data } = await api.get("/field-issues");
  return data.observations ?? [];
}

export async function createFieldIssue(body: Record<string, unknown>) {
  const { data } = await api.post("/field-issues", body);
  return data;
}

export async function uploadFieldIssuePhoto(id: string, photo: MobilePhoto) {
  return uploadPhoto(`/field-issues/${id}/photos`, photo);
}

export async function closeFieldIssue(id: string) {
  const { data } = await api.post(`/field-issues/${id}/close`);
  return data;
}

export async function listAudits() {
  const { data } = await api.get("/audits");
  return data.audits ?? [];
}

export async function getAuditTemplates() {
  const { data } = await api.get("/audits/templates");
  return data.templates ?? [];
}

export async function createAudit(body: Record<string, unknown>) {
  const { data } = await api.post("/audits", body);
  return data;
}

export async function signAudit(id: string, signatureText: string) {
  const { data } = await api.post(`/audits/${id}/signatures`, { signatureText });
  return data;
}

export async function uploadAuditPhoto(id: string, photo: MobilePhoto) {
  return uploadPhoto(`/audits/${id}/photos`, photo);
}
