"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  "https://multibroker-trader-multiuser-render.onrender.com";

// Storage keys used by the rest of your UI (Clients.jsx etc.)
const LS_KEY_USERID = "mb_logged_in_userid_v1";
const LS_KEY_TOKEN = "mb_auth_token_v1";

export default function LoginPage() {
  const [userid, setUserid] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e) {
    e?.preventDefault?.();
    if (loading) return;

    const u = (userid || "").trim();
    const p = (password || "").trim();

    if (!u || !p) {
      alert("Enter User ID and Password");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userid: u, password: p }),
      });

      if (!res.ok) {
        alert("Invalid login");
        return;
      }

      const data = await res.json();

      if (!data?.success) {
        alert("Invalid login");
        return;
      }

      // ---- Save userid + token so future requests can send Authorization: Bearer ----
      const token = (data.access_token || data.token || data.jwt || "").toString().trim();
      const uid = (data.userid || u).toString().trim();

      // required keys for multiuser
      localStorage.setItem(LS_KEY_USERID, JSON.stringify(uid));

      if (token) {
        localStorage.setItem(LS_KEY_TOKEN, token);
      } else {
        // If token isn't stored, /get_clients will 401. Better to fail loudly.
        console.warn("Login success but token missing in response:", data);
      }

      // backward compatibility (old key some pages might still read)
      localStorage.setItem("mb_user", JSON.stringify({ userid: uid }));

      router.push("/trade");
    } catch (err) {
      console.error("Login error:", err);
      alert("Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f4f7fb",
      }}
    >
      <div className="card p-4 shadow" style={{ width: 360, borderRadius: 10 }}>
        <h4 className="text-center mb-3">Multibroker Trader</h4>

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
