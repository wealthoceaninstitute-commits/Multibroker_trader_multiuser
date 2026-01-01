"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_BASE;

export default function LoginPage() {
  const [userid, setUserid] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  async function handleLogin() {
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userid, password })
    });

    if (!res.ok) {
      alert("Invalid login");
      return;
    }

    const data = await res.json();
    localStorage.setItem("token", data.token);
   const res = await fetch(`${API_BASE}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    userid,
    password,
  }),
});

const data = await res.json();

if (data.success) {
  localStorage.setItem(
    "mb_user",
    JSON.stringify({ userid: data.userid })
  );

  router.push("/trade");
} else {
  alert("Invalid login");
}

  }

  return (
    <div className="card p-4 shadow" style={{ width: 360 }}>
      <h4 className="text-primary text-center mb-3">
        Multibroker Trader
      </h4>

      <input
        className="form-control mb-3"
        placeholder="User ID"
        value={userid}
        onChange={e => setUserid(e.target.value)}
      />

      <input
        type="password"
        className="form-control mb-3"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />

      <button
        className="btn btn-primary w-100"
        onClick={handleLogin}
      >
        Login
      </button>

      <div className="text-center mt-3">
        <a href="/register" className="text-decoration-none">
          Create new user
        </a>
      </div>
    </div>
  );
}
