"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../../../src/lib/apiBase";
import { setAuth, clearAuth } from "../../../src/lib/auth";

export default function LoginPage() {
  const [userid, setUserid] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e) {
    e?.preventDefault?.();
    if (loading) return;

    if (!API_BASE) {
      alert("NEXT_PUBLIC_API_BASE is not set in your frontend environment.");
      return;
    }

    const u = (userid || "").trim();
    const p = (password || "").trim();

    if (!u || !p) {
      alert("Enter User ID and Password");
      return;
    }

    setLoading(true);
    try {
      // Clear old tokens to avoid sending stale auth accidentally
      clearAuth();

      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userid: u, password: p }),
      });

      const txt = await res.text();
      let data = {};
      try { data = JSON.parse(txt); } catch {}

      if (!res.ok || !data?.success) {
        console.error("Login failed:", res.status, txt);
        alert("Invalid login");
        return;
      }

      const token = (data.access_token || data.token || data.jwt || "").toString().trim();
      const uid = (data.userid || u).toString().trim();

      if (!token) {
        console.error("Login response missing access_token:", data);
        alert("Login succeeded but token missing from backend response.");
        return;
      }

      setAuth({ userid: uid, token });

      router.push("/trade");
    } catch (err) {
      console.error("Login error:", err);
      alert("Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f7fb" }}>
      <div className="card p-4 shadow" style={{ width: 360, borderRadius: 10 }}>
        <h4 className="text-center mb-3">Motilal Trader</h4>

        <form onSubmit={handleLogin}>
          <input
            className="form-control mb-3"
            placeholder="User ID"
            value={userid}
            onChange={(e) => setUserid(e.target.value)}
            autoComplete="username"
          />

          <input
            type="password"
            className="form-control mb-3"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          <button className="btn btn-primary w-100" type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="text-center mt-3">
          <a href="/register" className="text-decoration-none">
            Create new user
          </a>
        </div>
      </div>
    </div>
  );
}
