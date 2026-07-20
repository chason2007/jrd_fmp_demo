import { api } from './client.js';
import { compressImage } from '../utils/imageCompressor.js';

const enc = encodeURIComponent;

/** Upload one photo (multipart). Returns { id, mimeType, sizeBytes }. */
export async function uploadPhoto(file) {
  const compressedFile = await compressImage(file);
  const fd = new FormData();
  fd.append('photo', compressedFile);
  return api.post('/api/apartment/photos', fd).then((r) => r.data.data.photo);
}

export function fetchPhotoUrl(id) {
  const safeId = parseInt(id, 10);
  if (isNaN(safeId) || safeId <= 0) throw new Error('Invalid photo ID');
  return api.get(`/api/apartment/photos/${safeId}`, { responseType: 'blob' }).then((r) => URL.createObjectURL(r.data));
}

export const saveAudit = (payload) => api.post('/api/apartment/audits', payload).then((r) => r.data.data);
export const listAudits = () => api.get('/api/apartment/audits').then((r) => r.data.data.audits);
export const getAudit = (code) => api.get(`/api/apartment/audits/${enc(code)}`).then((r) => r.data.data.audit);
export const deleteAudit = (code) => api.delete(`/api/apartment/audits/${enc(code)}`).then((r) => r.data.data);

export const saveDraft = (payload) => api.post('/api/apartment/drafts', payload).then((r) => r.data.data.draft);
export const listDrafts = () => api.get('/api/apartment/drafts').then((r) => r.data.data.drafts);
export const getDraft = (id) => {
  const safeId = parseInt(id, 10);
  if (isNaN(safeId) || safeId <= 0) throw new Error('Invalid draft ID');
  return api.get(`/api/apartment/drafts/${safeId}`).then((r) => r.data.data.draft);
};
export const deleteDraft = (id) => {
  const safeId = parseInt(id, 10);
  if (isNaN(safeId) || safeId <= 0) throw new Error('Invalid draft ID');
  return api.delete(`/api/apartment/drafts/${safeId}`).then((r) => r.data.data);
};

export const getStats = () => api.get('/api/apartment/stats').then((r) => r.data.data.stats);
