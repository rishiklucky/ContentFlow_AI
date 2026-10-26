import axios from 'axios';

const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
  if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    try {
      const parsed = new URL(envUrl);
      parsed.hostname = window.location.hostname;
      return parsed.toString().replace(/\/$/, '');
    } catch {
      return envUrl;
    }
  }
  return envUrl;
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
    const res = await api.get('/auth/google/url');
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
  checkHealth: async () => {
    const res = await api.get('/health');
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
  list: async () => {
    const res = await api.get('/transformations');
    return res.data;
  },
  get: async (id) => {
    const res = await api.get(`/transformations/${id}`);
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
  delete: async (id) => {
    const res = await api.delete(`/transformations/${id}`);
    return res.data;
  },
};

export const projectService = {
  list: async () => {
    const res = await api.get('/projects');
    return res.data;
  },
};

export default api;
