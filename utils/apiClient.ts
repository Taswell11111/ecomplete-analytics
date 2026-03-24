import axios from 'axios';

// Centralized API client using Axios
export const apiClient = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a response interceptor for global error handling
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // You can handle global errors here (e.g., toast notifications, auth redirects)
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);
