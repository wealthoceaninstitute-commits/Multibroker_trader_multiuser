/**
 * SettingsTab.jsx
 * Drop-in Settings tab for Multibroker Trader
 *
 * Usage — add to your tab list:
 *   <button onClick={() => setTab('settings')}>Settings</button>
 *   {tab === 'settings' && <SettingsTab userId={userId} apiBase={API_BASE} />}
 *
 * Props:
 *   userId  — logged-in owner_userid string
 *   apiBase — e.g. "https://your-backend.railway.app"
 */

import { useState, useEffect } from "react";

// ── Inline styles matching the existing app (teal links, white cards, grey bg) ──
const S = {
  page: {
    background: "#f3f4f6",
    minHeight: "100vh",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    fontSize: 14,
    color: "#1f2937",
  },
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
  gridFull: {
    display: "grid",
    gridTemplateColumns: "1fr",
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
    transition: "border-color 0.15s",
    background: "#fff",
  },
  select: {
    border: "1px solid #d1d5db",
    borderRadius: 5,
    padding: "7px 10px",
    fontSize: 13,
    color: "#111827",
    outline: "none",
    background: "#fff",
    cursor: "pointer",
    appearance: "none",
    backgroundImage:
      'url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="%236b7280" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>\')',
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
    paddingRight: 30,
  },
  btnRow: {
    display: "flex",
    gap: 10,
    marginTop: 6,
    alignItems: "center",
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
  sectionDivider: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    margin: "4px 0 16px",
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

// ── Chip selector for trade defaults ──
function ChipSelect({ value, options, onChange }) {
  return (
    <div style={S.chipRow}>
      {options.map((opt) => (
        <button
          key={opt.value}
          style={S.chip(value === opt.value)}
          onClick={() => onChange(opt.value)}
          type="button"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Main component ──
export default function SettingsTab({ userId, apiBase = "" }) {
  const BASE = apiBase.replace(/\/$/, "");

  // Profile state
  const [profile, setProfile] = useState({
    name: "",
    phone: "",
    email: "",
    telegram_chat_id: "",
  });

  // Trade defaults state
  const [defaults, setDefaults] = useState({
    action: "BUY",
    product_type: "DELIVERY",
    order_type: "MARKET",
    order_duration: "DAY",
  });

  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [toast, setToast]           = useState(null); // { ok, msg }
  const [testingTg, setTestingTg]   = useState(false);
  const [tgToast, setTgToast]       = useState(null);

  // ── Auth header helper ──
  const authHeaders = () => {
    const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token") || "";
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : { "x-user-id": userId }),
    };
  };

  // ── Load settings on mount ──
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetch(`${BASE}/user_settings?userid=${encodeURIComponent(userId)}`, {
      headers: authHeaders(),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setProfile((p) => ({ ...p, ...data.profile }));
          setDefaults((d) => ({ ...d, ...data.trade_defaults }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  // ── Show toast briefly ──
  const showToast = (ok, msg, setter = setToast) => {
    setter({ ok, msg });
    setTimeout(() => setter(null), 3500);
  };

  // ── Save settings ──
  const handleSave = async () => {
    setSaving(true);
    try {
      const resp = await fetch(`${BASE}/user_settings`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          userid: userId,
          profile,
          trade_defaults: defaults,
        }),
      });
      const data = await resp.json();
      showToast(data.success, data.success ? "Settings saved" : data.message || "Save failed");
    } catch (e) {
      showToast(false, "Network error");
    } finally {
      setSaving(false);
    }
  };

  // ── Test Telegram ──
  const handleTestTelegram = async () => {
    if (!profile.telegram_chat_id) {
      showToast(false, "Enter your Telegram Chat ID first", setTgToast);
      return;
    }
    setTestingTg(true);
    try {
      // Save chat_id first so the backend can find it
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
      const data = await resp.json();
      showToast(data.success, data.success ? "Test message sent! Check Telegram" : "Failed — check Chat ID", setTgToast);
    } catch {
      showToast(false, "Network error", setTgToast);
    } finally {
      setTestingTg(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, color: "#9ca3af", fontSize: 13 }}>
        Loading settings…
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 0" }}>

      {/* ── Profile Card ── */}
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
                style={{ ...S.btnTest, whiteSpace: "nowrap" }}
                onClick={handleTestTelegram}
                disabled={testingTg}
                type="button"
              >
                {testingTg ? "Sending…" : "Test"}
              </button>
            </div>
            <span style={S.hint}>
              Message @userinfobot on Telegram to get your Chat ID
            </span>
            {tgToast && (
              <span style={{ ...S.toast(tgToast.ok), marginTop: 6 }}>
                {tgToast.ok ? "✓" : "✗"} {tgToast.msg}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Trade Defaults Card ── */}
      <div style={S.card}>
        <div style={S.cardTitle}>Trade Defaults</div>
        <p style={{ fontSize: 12, color: "#6b7280", marginTop: -10, marginBottom: 20 }}>
          These values will be pre-selected every time you open the Trade tab.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px 32px" }}>

          {/* Action */}
          <div style={S.fieldWrap}>
            <label style={S.label}>Default Action</label>
            <ChipSelect
              value={defaults.action}
              onChange={(v) => setDefaults((d) => ({ ...d, action: v }))}
              options={[
                { label: "BUY",  value: "BUY"  },
                { label: "SELL", value: "SELL" },
              ]}
            />
          </div>

          {/* Order Duration */}
          <div style={S.fieldWrap}>
            <label style={S.label}>Default Duration</label>
            <ChipSelect
              value={defaults.order_duration}
              onChange={(v) => setDefaults((d) => ({ ...d, order_duration: v }))}
              options={[
                { label: "DAY", value: "DAY" },
                { label: "IOC", value: "IOC" },
                { label: "GTD", value: "GTD" },
                { label: "EOS", value: "EOS" },
              ]}
            />
          </div>

          {/* Order Type */}
          <div style={S.fieldWrap}>
            <label style={S.label}>Default Order Type</label>
            <ChipSelect
              value={defaults.order_type}
              onChange={(v) => setDefaults((d) => ({ ...d, order_type: v }))}
              options={[
                { label: "MARKET",   value: "MARKET"   },
                { label: "LIMIT",    value: "LIMIT"    },
                { label: "STOPLOSS", value: "STOPLOSS" },
                { label: "SL-M",     value: "SL-M"     },
              ]}
            />
          </div>

          {/* Product Type */}
          <div style={S.fieldWrap}>
            <label style={S.label}>Default Product Type</label>
            <ChipSelect
              value={defaults.product_type}
              onChange={(v) => setDefaults((d) => ({ ...d, product_type: v }))}
              options={[
                { label: "INTRADAY", value: "VALUEPLUS" },
                { label: "DELIVERY", value: "DELIVERY" },
                { label: "NORMAL",   value: "NORMAL"   },
                { label: "BTST",     value: "BTST"     },
                { label: "MTF",      value: "MTF"      },
              ]}
            />
          </div>

        </div>
      </div>

      {/* ── Save Row ── */}
      <div style={S.btnRow}>
        <button
          style={{ ...S.btnSave, opacity: saving ? 0.7 : 1 }}
          onClick={handleSave}
          disabled={saving}
          type="button"
        >
          {saving ? "Saving…" : "Save Settings"}
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
