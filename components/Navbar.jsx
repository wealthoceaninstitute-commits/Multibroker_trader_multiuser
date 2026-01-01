"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const [user, setUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const u = localStorage.getItem("mb_user");
    if (u) setUser(JSON.parse(u));
  }, []);

  if (!user) return null;

  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 20px",
      borderBottom: "1px solid #e0e0e0",
      background: "#fff"
    }}>
      <div style={{ fontWeight: 600 }}>
        Multibroker Trader
      </div>

      <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
        <span>
          Welcome, <b>{user.userid}</b>
        </span>

        <button
          onClick={() => {
            localStorage.removeItem("mb_user");
            router.push("/login");
          }}
          style={{
            background: "transparent",
            border: "none",
            color: "#d32f2f",
            cursor: "pointer",
            fontWeight: 500
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}
