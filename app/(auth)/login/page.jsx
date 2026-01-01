"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  "https://multibroker-trader-multiuser-render.onrender.com";

export default function LoginPage() {
  const [userid, setUserid] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  async function handleLogin() {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userid,
          password,
        }),
      });

      if (!res.ok) {
        alert("Invalid login");
        return;
      }

      const data = await res.json();

      if (data.success) {
        // ✅ single source of truth
        localStorage.setItem(
          "mb_user",
          JSON.stringify({ userid: data.userid })
        );

        router.push("/trade");
      } else {
        alert("Invalid login");
      }
    } catch (err) {
      console.error("Login error:", err);
      alert("Login failed");
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: "100px auto" }}>
      <h2>Multibroker Trader</h2>

      <input
        placeholder="User ID"
        value={userid}
        onChange={(e) => setUserid(e.target.value)}
        style={{ width: "100%", marginBottom: 10 }}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ width: "100%", marginBottom: 10 }}
      />

      <button onClick={handleLogin} style={{ width: "100%" }}>
        Login
      </button>
    </div>
  );
}
