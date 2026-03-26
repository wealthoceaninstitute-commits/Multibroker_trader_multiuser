"use client";

import { useState, useEffect } from "react";

const S = {
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: "24px 28px",
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 18,
    paddingBottom: 10,
    borderBottom: "1px solid #f0f0f0",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px 24px",
  },
  fieldWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: "#374151",
  },
  input: {
    border: "1px solid #d1d5db",
    borderRadius: 5,
    padding: "7px 10px",
    fontSize: 13,
    color: "#111827",
    outline: "none",
    background: "#fff",
  },
  btnRow: {
    display: "flex",
    gap: 10,
    marginTop: 6,
    alignItems: "center",
    flexWrap: "wrap",
  },
  btnSave: {
    background: "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: 5,
    padding: "8px 20px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  btnTest: {
    background: "#fff",
    color: "#0891b2",
    border: "1px solid #0891b2",
    borderRadius: 5,
    padding: "7px 16px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  toast: (ok) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 600,
    color: ok ? "#16a34a" : "#dc2626",
    background: ok ? "#f0fdf4" : "#fef2f2",
    border: `1px solid ${ok ? "#bbf7d0" : "#fecaca"}`,
    borderRadius: 5,
    padding: "5px 12px",
  }),
  hint: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 3,
  },
  chipRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  chip: (active) => ({
    padding: "6px 14px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    border: active ? "none" : "1px solid #d1d5db",
    background: active ? "#0891b2" : "#fff",
    color: active ? "#fff" : "#6b7280",
    transition: "all 0.15s",
  }),
};

function ChipSelect({ value, options, onChange }) {
  return (
    <div style={S.chipRow}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          style={S.chip(value === opt.value)}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function SettingsTab({ userId = "", apiBase = "" }) {
  const BASE = (apiBase || "").replace(/\/$/, "");

  const [profile, setProfile] = useState({
    name: "",
    phone: "",
    email: "",
    telegram_chat_id: "",
  });

  const [defaults, setDefaults] = useState({
    action: "BUY",
    product_type: "DELIVERY",
    order_type: "MARKET",
    order_duration: "DAY",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [testingTg, setTestingTg] = useState(false);
  const [tgToast, setTgToast] = useState(null);

  const authHeaders = () => {
    let token = "";
    try {
      token =
        localStorage.getItem("mb_auth_token_v1") ||
        sessionStorage.getItem("mb_auth_token_v1") ||
        localStorage.getItem("access_token") ||
        sessionStorage.getItem("access_token") ||
        "";
    } catch {
      token = "";
    }

    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(userId ? { "x-user-id": userId } : {}),
    };
  };

  const showToast = (ok, msg, setter = setToast) => {
    setter({ ok, msg });
    setTimeout(() => setter(null), 3500);
  };

  useEffect(() => {
    if (!userId || !BASE) {
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);

    fetch(`${BASE}/user_settings?userid=${encodeURIComponent(userId)}`, {
      headers: authHeaders(),
    })
      .then(async (r) => {
        let data = {};
        try {
          data = await r.json();
        } catch {
          data = {};
        }
        return { ok: r.ok, data };
      })
      .then(({ ok, data }) => {
        if (!alive) return;

        if (ok && data?.success) {
          setProfile((p) => ({ ...p, ...(data.profile || {}) }));
          setDefaults((d) => ({
            ...d,
            ...(data.trade_defaults || {}),
            order_duration: String(
              data?.trade_defaults?.order_duration || d.order_duration
            ).toUpperCase(),
            order_type: String(
              data?.trade_defaults?.order_type || d.order_type
            ).toUpperCase(),
            product_type: String(
              data?.trade_defaults?.product_type || d.product_type
            ).toUpperCase(),
            action: String(data?.trade_defaults?.action || d.action).toUpperCase(),
          }));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [userId, BASE]);

  const handleSave = async () => {
    if (!userId || !BASE) {
      showToast(false, "Missing userId or API base");
      return;
    }

    setSaving(true);
    try {
      const resp = await fetch(`${BASE}/user_settings`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          userid: userId,
          profile,
          trade_defaults: {
            action: String(defaults.action || "BUY").toUpperCase(),
            product_type: String(defaults.product_type || "DELIVERY").toUpperCase(),
            order_type: String(defaults.order_type || "MARKET").toUpperCase(),
            order_duration: String(defaults.order_duration || "DAY").toUpperCase(),
          },
        }),
      });

      let data = {};
      try {
        data = await resp.json();
      } catch {
        data = {};
      }

      showToast(
        !!data?.success,
        data?.success ? "Settings saved" : data?.message || "Save failed"
      );
    } catch {
      showToast(false, "Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleTestTelegram = async () => {
    if (!profile.telegram_chat_id) {
      showToast(false, "Enter your Telegram Chat ID first", setTgToast);
      return;
    }

    if (!userId || !BASE) {
      showToast(false, "Missing userId or API base", setTgToast);
      return;
    }

    setTestingTg(true);
    try {
      await fetch(`${BASE}/user_settings`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          userid: userId,
          profile: { telegram_chat_id: profile.telegram_chat_id },
        }),
      });

      const resp = await fetch(`${BASE}/test_telegram`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ userid: userId }),
      });

      let data = {};
      try {
        data = await resp.json();
      } catch {
        data = {};
      }

      showToast(
        !!data?.success,
        data?.success ? "Test message sent! Check Telegram" : "Failed - check Chat ID",
        setTgToast
      );
    } catch {
      showToast(false, "Network error", setTgToast);
    } finally {
      setTestingTg(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 40, color: "#9ca3af", fontSize: 13 }}>Loading settings...</div>;
  }

  if (!userId) {
    return <div style={{ padding: 24, color: "#dc2626", fontSize: 13 }}>Missing userId.</div>;
  }

  if (!BASE) {
    return <div style={{ padding: 24, color: "#dc2626", fontSize: 13 }}>Missing API base URL.</div>;
  }

  return (
    <div style={{ padding: "20px 0" }}>
      <div style={S.card}>
        <div style={S.cardTitle}>Profile</div>

        <div style={S.grid}>
          <div style={S.fieldWrap}>
            <label style={S.label}>Full Name</label>
            <input
              style={S.input}
              placeholder="Your name"
              value={profile.name}
              onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
            />
          </div>

          <div style={S.fieldWrap}>
            <label style={S.label}>Phone Number</label>
            <input
              style={S.input}
              placeholder="10-digit mobile number"
              value={profile.phone}
              onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
              maxLength={15}
            />
          </div>

          <div style={S.fieldWrap}>
            <label style={S.label}>Email</label>
            <input
              style={S.input}
              type="email"
              placeholder="you@example.com"
              value={profile.email}
              onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
            />
          </div>

          <div style={S.fieldWrap}>
            <label style={S.label}>Telegram Chat ID</label>

            <div style={{ display: "flex", gap: 8 }}>
              <input
                style={{ ...S.input, flex: 1 }}
                placeholder="e.g. 123456789"
                value={profile.telegram_chat_id}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, telegram_chat_id: e.target.value }))
                }
              />
              <button
                type="button"
                style={{ ...S.btnTest, whiteSpace: "nowrap" }}
                onClick={handleTestTelegram}
                disabled={testingTg}
              >
                {testingTg ? "Sending..." : "Test"}
              </button>
            </div>

            <span style={S.hint}>Message @userinfobot on Telegram to get your Chat ID</span>

            {tgToast && (
              <span style={{ ...S.toast(tgToast.ok), marginTop: 6 }}>
                {tgToast.ok ? "✓" : "✗"} {tgToast.msg}
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Trade Defaults</div>

        <p style={{ fontSize: 12, color: "#6b7280", marginTop: -10, marginBottom: 20 }}>
          These values will be pre-selected every time you open the Trade tab.
        </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px 32px" }}>
          <div style={S.fieldWrap}>
            <label style={S.label}>Default Action</label>
            <ChipSelect
              value={defaults.action}
              onChange={(v) => setDefaults((d) => ({ ...d, action: v }))}
              options={[
                { label: "BUY", value: "BUY" },
                { label: "SELL", value: "SELL" },
              ]}
            />
          </div>

          <div style={S.fieldWrap}>
            <label style={S.label}>Default Duration</label>
            <ChipSelect
              value={defaults.order_duration}
              onChange={(v) => setDefaults((d) => ({ ...d, order_duration: v }))}
              options={[
                { label: "DAY", value: "DAY" },
                { label: "IOC", value: "IOC" },
                { label: "GTC", value: "GTC" },
                { label: "GTD", value: "GTD" },
              ]}
            />
          </div>

          <div style={S.fieldWrap}>
            <label style={S.label}>Default Order Type</label>
            <ChipSelect
              value={defaults.order_type}
              onChange={(v) => setDefaults((d) => ({ ...d, order_type: v }))}
              options={[
                { label: "MARKET", value: "MARKET" },
                { label: "LIMIT", value: "LIMIT" },
                { label: "STOPLOSS", value: "STOPLOSS" },
                { label: "SL-M", value: "SL-M" },
              ]}
            />
          </div>

          <div style={S.fieldWrap}>
            <label style={S.label}>Default Product Type</label>
            <ChipSelect
              value={defaults.product_type}
              onChange={(v) => setDefaults((d) => ({ ...d, product_type: v }))}
              options={[
                { label: "INTRADAY", value: "VALUEPLUS" },
                { label: "DELIVERY", value: "DELIVERY" },
                { label: "NORMAL", value: "NORMAL" },
                { label: "SELLFROMDP", value: "SELLFROMDP" },
                { label: "BTST", value: "BTST" },
                { label: "MTF", value: "MTF" },
              ]}
            />
          </div>
        </div>
      </div>

      <div style={S.btnRow}>
        <button
          type="button"
          style={{ ...S.btnSave, opacity: saving ? 0.7 : 1 }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>

        {toast && (
          <span style={S.toast(toast.ok)}>
            {toast.ok ? "✓" : "✗"} {toast.msg}
          </span>
        )}
      </div>
    </div>
  );
}
