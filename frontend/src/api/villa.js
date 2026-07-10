import { api } from './client.js';
import { compressImage } from '../utils/imageCompressor.js';

const enc = encodeURIComponent;

/** Upload one photo (multipart). Returns { id, mimeType, sizeBytes }. */
export async function uploadPhoto(file) {
  const compressedFile = await compressImage(file);
  const fd = new FormData();
  fd.append('photo', compressedFile);
  return api.post('/api/villa/photos', fd).then((r) => r.data.data.photo);
}

export function fetchPhotoUrl(id) {
  const safeId = parseInt(id, 10);
  if (isNaN(safeId) || safeId <= 0) throw new Error('Invalid photo ID');
  return api.get(`/api/villa/photos/${safeId}`, { responseType: 'blob' }).then((r) => URL.createObjectURL(r.data));
}

export const saveInspection = (payload) => api.post('/api/villa/inspections', payload).then((r) => r.data.data);
export const listReports = () => api.get('/api/villa/reports').then((r) => r.data.data.reports);
export const getReport = (code) => api.get(`/api/villa/reports/${enc(code)}`).then((r) => r.data.data.audit);
export const deleteReport = (code) => api.delete(`/api/villa/reports/${enc(code)}`).then((r) => r.data.data);

export const saveDraft = (payload) => api.post('/api/villa/drafts', payload).then((r) => r.data.data.draft);
export const listDrafts = () => api.get('/api/villa/drafts').then((r) => r.data.data.drafts);
export const getDraft = (id) => {
  const safeId = parseInt(id, 10);
  if (isNaN(safeId) || safeId <= 0) throw new Error('Invalid draft ID');
  return api.get(`/api/villa/drafts/${safeId}`).then((r) => r.data.data.draft);
};
export const deleteDraft = (id) => {
  const safeId = parseInt(id, 10);
  if (isNaN(safeId) || safeId <= 0) throw new Error('Invalid draft ID');
  return api.delete(`/api/villa/drafts/${safeId}`).then((r) => r.data.data);
};
