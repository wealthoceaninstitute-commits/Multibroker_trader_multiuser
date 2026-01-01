import { useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_BASE;
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  "https://multibroker-trader-multiuser-render.onrender.com";

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
    localStorage.setItem("token", data.token);
   const res = await fetch(`${API_BASE}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
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
    <div className="card p-4 shadow" style={{ width: 360 }}>
      <h4 className="text-primary text-center mb-3">
        Multibroker Trader
      </h4>
    <div style={{ maxWidth: 400, margin: "100px auto" }}>
      <h2>Multibroker Trader</h2>

      <input
        className="form-control mb-3"
        placeholder="User ID"
        value={userid}
        onChange={e => setUserid(e.target.value)}
        onChange={(e) => setUserid(e.target.value)}
        style={{ width: "100%", marginBottom: 10 }}
      />

      <input
        type="password"
        className="form-control mb-3"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        onChange={(e) => setPassword(e.target.value)}
        style={{ width: "100%", marginBottom: 10 }}
      />

      <button
        className="btn btn-primary w-100"
        onClick={handleLogin}
      >
      <button onClick={handleLogin} style={{ width: "100%" }}>
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
