"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_BASE;

export default function RegisterPage() {
  const [userid, setUserid] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  async function handleRegister() {
    const res = await fetch(`${API}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userid, password })
    });

    if (!res.ok) {
      alert("User already exists");
      return;
    }

    alert("User created. Login now.");
    router.push("/login");
  }

  return (
    <div className="card p-4 shadow" style={{ width: 360 }}>
      <h4 className="text-primary text-center mb-3">
        Create Account
      </h4>

      <input
        className="form-control mb-3"
        placeholder="Choose User ID"
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
        onClick={handleRegister}
      >
        Create User
      </button>
    </div>
  );
}
