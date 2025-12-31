"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

NEXT_PUBLIC_API_BASE = https://multibroker-trader-multiuser-render.onrender.com

export default function RegisterPage() {
  const router = useRouter();

  const [userid, setUserid] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!userid || !email || !password || !confirmPassword) {
      alert("All fields are required");
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userid,
          email,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data?.detail || "Registration failed");
        return;
      }

      alert("Account created successfully. Please login.");
      router.push("/login");

    } catch (err) {
      alert("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="card shadow p-4"
      style={{ width: 380, borderRadius: 12 }}
    >
      <h4 className="text-primary text-center mb-4">
        Create Account
      </h4>

      <input
        className="form-control mb-3"
        placeholder="User ID"
        value={userid}
        onChange={(e) => setUserid(e.target.value)}
      />

      <input
        type="email"
        className="form-control mb-3"
        placeholder="Email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        type="password"
        className="form-control mb-3"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <input
        type="password"
        className="form-control mb-4"
        placeholder="Confirm Password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />

      <button
        className="btn btn-primary w-100"
        onClick={handleRegister}
        disabled={loading}
      >
        {loading ? "Creating..." : "Create User"}
      </button>

      <div className="text-center mt-3">
        <a href="/login" className="text-decoration-none">
          Already have an account? Login
        </a>
      </div>
    </div>
  );
}
