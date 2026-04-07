const ENV = {
  development: 'http://127.0.0.1:8000',
  ngrok: 'https://hypolithic-earlean-subacademical.ngrok-free.dev',
  production: 'https://api.clipla.app',
};

export const BASE_URL = ENV.development;

async function request(method, path, body = null, isFormData = false) {
  const headers = {};
  if (!isFormData && body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : null,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.detail || data?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

const get    = (path)     => request('GET', path);
const post   = (path, b)  => request('POST', path, b);
const upload = (path, fd) => request('POST', path, fd, true);

export const health = {
  check:      () => get('/health'),
  checkVideo: () => get('/api/video/health'),
};

export const video = {
  upload: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return upload('/api/video/upload', fd);
  },
  analyze: (jobId) => post(`/api/video/process/${jobId}`),
  render:  (jobId) => post(`/api/video/render/${jobId}`),
};

export const stt = {
  transcribe: (audioBlob) => {
    const fd = new FormData();
    fd.append('file', audioBlob, 'command.webm');
    return upload('/api/stt/transcribe', fd);
  },
};

export const chat = {
  send: ({ message, history = [], jobId }) =>
    post('/api/chat', { message, history, job_id: jobId }),
};

export const command = {
  createPlan: ({ commandText, target = 'youtube', preset = 'youtube_16_9', targetDurationSec = 60 }) =>
    post('/api/command', {
      command_text: commandText,
      target,
      preset,
      target_duration_sec: Number(targetDurationSec),
    }),
};

export const autoEdit = {
  run: (jobId, { commandText = '', platform = 'youtube', targetDurationSec = null, editPlan = null } = {}) =>
    post(`/api/auto-edit/${jobId}`, {
      command_text: commandText,
      platform,
      target_duration_sec: targetDurationSec,
      edit_plan: editPlan,
    }),
  status: (jobId) => get(`/api/auto-edit/${jobId}/status`),
};

export const shorts = {
  generate: (jobId, { topN = 5, reencode = false } = {}) =>
    post(`/api/shorts/${jobId}`, { top_n: topN, reencode }),
  list: (jobId) => get(`/api/shorts/${jobId}/list`),
};

const api = { health, video, stt, chat, command, autoEdit, shorts, BASE_URL };
export default api;