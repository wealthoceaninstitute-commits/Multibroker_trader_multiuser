"use client";

export const LS_KEY_USERID = "mb_logged_in_userid_v1";
export const LS_KEY_TOKEN = "mb_auth_token_v1";

export function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(LS_KEY_TOKEN) || "";
}

export function getUserid() {
  if (typeof window === "undefined") return "";
  try {
    return (JSON.parse(localStorage.getItem(LS_KEY_USERID) || '""') || "").toString().trim();
  } catch {
    return (localStorage.getItem(LS_KEY_USERID) || "").toString().trim();
  }
}

export function setAuth({ userid, token }) {
  if (typeof window === "undefined") return;
  const uid = (userid || "").toString().trim();
  const tk = (token || "").toString().trim();
  if (uid) localStorage.setItem(LS_KEY_USERID, JSON.stringify(uid));
  if (tk) localStorage.setItem(LS_KEY_TOKEN, tk);
  // Backward compatibility (some components may still read this)
  if (uid) localStorage.setItem("mb_user", JSON.stringify({ userid: uid }));
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LS_KEY_USERID);
  localStorage.removeItem(LS_KEY_TOKEN);
  // keep mb_user? clear it too
  localStorage.removeItem("mb_user");
}

export function authHeaders(extra = {}) {
  const token = getToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra };
}
