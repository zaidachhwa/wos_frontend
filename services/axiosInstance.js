import axios from "axios";

import { useAuthStore } from "@/store/authStore";

const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
});

axiosInstance.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshPromise = null;

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const noRetry = ["/auth/login", "/auth/refresh", "/auth/logout"].some((path) =>
      original?.url?.includes(path)
    );
    if (error.response?.status !== 401 || original?._retried || noRetry) {
      return Promise.reject(error);
    }
    original._retried = true;
    try {
      refreshPromise =
        refreshPromise ||
        axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );
      const { data } = await refreshPromise;
      refreshPromise = null;
      const accessToken = data.data.accessToken;
      useAuthStore.getState().setAccessToken(accessToken);
      original.headers.Authorization = `Bearer ${accessToken}`;
      return axiosInstance(original);
    } catch (refreshError) {
      refreshPromise = null;
      useAuthStore.getState().clearAuth();
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
      return Promise.reject(refreshError);
    }
  }
);

export default axiosInstance;
