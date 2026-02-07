"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../../../src/lib/apiBase";
import { setAuth, clearAuth } from "../../../src/lib/auth";

export default function RegisterPage() {
  const [userid, setUserid] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRegister(e) {
    e?.preventDefault?.();
    if (loading) return;

    if (!API_BASE) {
      alert("NEXT_PUBLIC_API_BASE is not set in your frontend environment.");
      return;
    }

    const u = (userid || "").trim();
    const em = (email || "").trim();
    const p = (password || "").trim();
    const c = (confirm || "").trim();

    if (!u || !em || !p || !c) {
      alert("Fill all fields");
      return;
    }
    if (p !== c) {
      alert("Password and Confirm Password must match");
      return;
    }

    setLoading(true);
    try {
      clearAuth();

      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userid: u, email: em, password: p }),
      });

      const txt = await res.text();
      let data = {};
      try {
        data = JSON.parse(txt);
      } catch {}

      if (!res.ok || !data?.success) {
        console.error("Register failed:", res.status, txt);
        alert(data?.detail || "Register failed");
        return;
      }

      // If backend returns token on register, store it and go to /trade.
      // If it doesn't, go back to /login.
      const token = (data.access_token || data.token || data.jwt || "").toString().trim();
      const uid = (data.userid || u).toString().trim();

      if (token) {
        setAuth({ userid: uid, token });
        router.push("/trade");
      } else {
        router.push("/login");
      }
    } catch (err) {
      console.error("Register error:", err);
      alert("Register failed");
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
      <div className="card p-4 shadow" style={{ width: 420, borderRadius: 10 }}>
        <h4 className="text-center mb-3">Create Account</h4>

        <form onSubmit={handleRegister}>
          <input className="form-control mb-3" placeholder="User ID" value={userid} onChange={(e) => setUserid(e.target.value)} />
          <input className="form-control mb-3" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="password" className="form-control mb-3" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <input type="password" className="form-control mb-3" placeholder="Confirm Password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />

          <button className="btn btn-primary w-100" type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create Account"}
          </button>
        </form>

        <div className="text-center mt-3">
          <a href="/login" className="text-decoration-none">
            Back to Login
          </a>
        </div>
      </div>
    </div>
  );
}
