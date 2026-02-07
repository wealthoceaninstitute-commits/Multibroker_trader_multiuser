import axios from "axios";
import { API_BASE } from "../src/lib/apiBase";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
});

// Attach Authorization: Bearer <token> automatically
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("mb_auth_token_v1") || "";
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export default api;
