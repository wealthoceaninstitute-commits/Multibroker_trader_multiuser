"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  "https://multibroker-trader-multiuser-render.onrender.com";

// Keys used by Clients.jsx / other components
const LS_KEY_USERID = "mb_logged_in_userid_v1";
const LS_KEY_TOKEN = "mb_auth_token_v1";

export default function LoginPage() {
  const [userid, setUserid] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  async function handleLogin() {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userid, password }),
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

      // ---- IMPORTANT: store token + userid for Bearer auth ----
      // Backend should return access_token; support a few fallback names just in case.
      const token =
        (data.access_token || data.token || data.jwt || "").toString().trim();

      // Store userid in the key your UI expects
      localStorage.setItem(LS_KEY_USERID, JSON.stringify((data.userid || userid || "").trim()));

      // Store token for Authorization: Bearer <token>
      if (token) {
        localStorage.setItem(LS_KEY_TOKEN, token);
      } else {
        // If token is missing, future API calls will 401. Better to fail loudly here.
        console.warn("Login success but token missing in response:", data);
      }

      // Backward compatibility (your old key)
      localStorage.setItem("mb_user", JSON.stringify({ userid: (data.userid || userid || "").trim() }));

      router.push("/trade");
    } catch (err) {
      console.error("Login error:", err);
      alert("Login failed");
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

        <input
          className="form-control mb-3"
          placeholder="User ID"
          value={userid}
          onChange={(e) => setUserid(e.target.value)}
        />

        <input
          type="password"
          className="form-control mb-3"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button className="btn btn-primary w-100" onClick={handleLogin}>
          Login
        </button>

        <div className="text-center mt-3">
          <a href="/register" className="text-decoration-none">
            Create new user
          </a>
        </div>
      </div>
    </div>
  );
}
