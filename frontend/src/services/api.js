import axios from 'axios';

const getBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    // If running in development Vite dev server (port 5173 or 3000)
    if (window.location.port === '5173' || window.location.port === '3000') {
      return `http://${window.location.hostname}:8000/api/v1`;
    }
    // Single-service production deployment (same origin on Render)
    return '/api/v1';
  }
  return 'http://localhost:8000/api/v1';
};

const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000,
});

// Request interceptor: attach verified JWT token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('cf_auth_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle errors and token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If token is invalid or expired, clear local token
    if (error.response?.status === 401) {
      localStorage.removeItem('cf_auth_token');
    }
    const errorDetails = {
      message: error.response?.data?.detail || error.message || 'Network error occurred. Please check your connection.',
      status: error.response?.status,
    };
    return Promise.reject(errorDetails);
  }
);

export const authService = {
  register: async (userData) => {
    const res = await api.post('/auth/register', userData);
    return res.data;
  },
  login: async (credentials) => {
    const res = await api.post('/auth/login', credentials);
    return res.data;
  },
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Stateless logout: proceed with client cleanup even if network fails
    } finally {
      localStorage.removeItem('cf_auth_token');
    }
  },
  getProfile: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },
  socialLogin: async (data) => {
    const res = await api.post('/auth/social-login', data);
    return res.data;
  },
  initiateNeonGoogleAuth: async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const res = await api.get('/auth/google/url', {
      params: { frontend_origin: origin },
    });
    if (res.data?.url) {
      window.location.href = res.data.url;
    } else {
      throw new Error('No redirect URL returned by Neon Auth.');
    }
  },
  verifyNeonSession: async () => {
    const res = await api.post('/auth/google/verify-session');
    return res.data;
  },
  getNeonSession: async () => {
    const neonAuthUrl = import.meta.env.VITE_NEON_AUTH_URL || 'https://ep-aged-frog-b3927eke.neonauth.c-4.ap-southeast-1.aws.neon.tech/neondb/auth';
    try {
      const res = await fetch(`${neonAuthUrl}/get-session`, {
        credentials: 'include',
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },
};

export const systemService = {
  checkHealth: async (timeoutMs = 6000) => {
    // Lightweight /api/health check for cold-start wakeups
    const rootHealthUrl =
      typeof window !== 'undefined' &&
      (window.location.port === '5173' || window.location.port === '3000')
        ? `http://${window.location.hostname}:8000/api/health`
        : '/api/health';
    const res = await axios.get(rootHealthUrl, { timeout: timeoutMs });
    return res.data;
  },
  getSystemInfo: async () => {
    const res = await api.get('/system-info');
    return res.data;
  },
};

export const sourceService = {
  uploadFile: async (formData, onProgress) => {
    const res = await api.post('/sources/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percent);
        }
      },
    });
    return res.data;
  },
  createText: async (data) => {
    const res = await api.post('/sources/text', data);
    return res.data;
  },
  createUrl: async (data) => {
    const res = await api.post('/sources/url', data);
    return res.data;
  },
  list: async () => {
    const res = await api.get('/sources');
    return res.data;
  },
  get: async (id) => {
    const res = await api.get(`/sources/${id}`);
    return res.data;
  },
  delete: async (id) => {
    const res = await api.delete(`/sources/${id}`);
    return res.data;
  },
  analyze: async (id) => {
    const res = await api.post(`/sources/${id}/analyze`, {}, { timeout: 120000 });
    return res.data;
  },
  getAnalysis: async (id) => {
    const res = await api.get(`/sources/${id}/analysis`, { timeout: 60000 });
    return res.data;
  },
};

export const transformationService = {
  create: async (data) => {
    const res = await api.post('/transformations', data, { timeout: 180000 });
    return res.data;
  },
  list: async (params = {}) => {
    const res = await api.get('/transformations', { params });
    return res.data;
  },
  get: async (id) => {
    const res = await api.get(`/transformations/${id}`);
    return res.data;
  },
  update: async (id, data) => {
    const res = await api.put(`/transformations/${id}`, data);
    return res.data;
  },
  duplicate: async (id) => {
    const res = await api.post(`/transformations/${id}/duplicate`);
    return res.data;
  },
  updateOutput: async (transformationId, outputId, data) => {
    const res = await api.put(`/transformations/${transformationId}/outputs/${outputId}`, data);
    return res.data;
  },
  regenerateOutput: async (transformationId, outputId) => {
    const res = await api.post(`/transformations/${transformationId}/outputs/${outputId}/regenerate`, {}, { timeout: 120000 });
    return res.data;
  },
  verifyOutput: async (transformationId, outputId, payload = {}) => {
    const res = await api.post(`/transformations/${transformationId}/outputs/${outputId}/verify`, payload, { timeout: 120000 });
    return res.data;
  },
  getOutputVerification: async (transformationId, outputId) => {
    const res = await api.get(`/transformations/${transformationId}/outputs/${outputId}/verification`);
    return res.data;
  },
  exportOutput: async (transformationId, outputId, format = 'md') => {
    const res = await api.get(`/transformations/${transformationId}/outputs/${outputId}/export`, {
      params: { format },
      responseType: 'blob',
    });
    return res;
  },
  exportAll: async (transformationId) => {
    const res = await api.get(`/transformations/${transformationId}/export-all`, {
      responseType: 'blob',
    });
    return res;
  },
  delete: async (id) => {
    const res = await api.delete(`/transformations/${id}`);
    return res.data;
  },
};

export const projectService = {
  list: async (params = {}) => {
    const res = await api.get('/projects', { params });
    return res.data;
  },
  get: async (id) => {
    const res = await api.get(`/projects/${id}`);
    return res.data;
  },
  create: async (data) => {
    const res = await api.post('/projects', data);
    return res.data;
  },
  update: async (id, data) => {
    const res = await api.put(`/projects/${id}`, data);
    return res.data;
  },
  duplicate: async (id) => {
    const res = await api.post(`/projects/${id}/duplicate`);
    return res.data;
  },
  delete: async (id) => {
    const res = await api.delete(`/projects/${id}`);
    return res.data;
  },
  assignTransformation: async (projectId, transformationId) => {
    const res = await api.post(`/projects/${projectId}/transformations/${transformationId}`);
    return res.data;
  },
};

export const dashboardService = {
  getMetrics: async () => {
    const res = await api.get('/dashboard/metrics');
    return res.data;
  },
};

export default api;

