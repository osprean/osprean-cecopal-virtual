import axios, { type AxiosError, type AxiosRequestConfig } from "axios";
import { tokenStorage } from "@/lib/tokenStorage";
import type { TokenPair } from "@/types/api";

export const apiClient = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.getAccess();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface RetriableConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

let refreshInFlight: Promise<string> | null = null;

async function refreshAccess(): Promise<string> {
  const refresh = tokenStorage.getRefresh();
  if (!refresh) {
    throw new Error("No refresh token available");
  }
  const { data } = await axios.post<TokenPair>("/api/v1/auth/refresh", {
    refresh_token: refresh,
  });
  tokenStorage.set(data.access_token, data.refresh_token);
  return data.access_token;
}

apiClient.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    if (status === 401 && config && !config._retry && config.url !== "/auth/login") {
      config._retry = true;
      try {
        refreshInFlight ??= refreshAccess().finally(() => {
          refreshInFlight = null;
        });
        const newAccess = await refreshInFlight;
        config.headers = { ...(config.headers ?? {}), Authorization: `Bearer ${newAccess}` };
        return apiClient.request(config);
      } catch (refreshErr) {
        tokenStorage.clear();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        return Promise.reject(refreshErr);
      }
    }
    return Promise.reject(error);
  },
);
