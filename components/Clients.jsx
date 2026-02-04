"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { Card, Button, Modal, Form, Table, Badge, ButtonGroup } from "react-bootstrap";

// ✅ DO NOT default to localhost on Vercel
const DEFAULT_RENDER_API = "https://multibroker-trader-multiuser-render.onrender.com";
const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE && process.env.NEXT_PUBLIC_API_BASE.trim()) ||
  DEFAULT_RENDER_API;

// ----- helpers -----
const LS_KEY_GROUPS = "mb_groups_v2_groupMultiplier";
const LS_KEY_USERID = "mb_logged_in_userid_v1";

// 1) Prefer navbar "Welcome, <user>"
const detectUserFromWelcomeText = () => {
  if (typeof window === "undefined") return "";
  try {
    const txt = document.body?.innerText || "";
    const m = txt.match(/Welcome,\s*([^\s]+)/i);
    if (m && m[1]) return String(m[1]).trim();
  } catch {}
  return "";
};

const readLSRaw = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

const writeLS = (k, v) => {
  try {
    localStorage.setItem(k, String(v ?? ""));
  } catch {}
};

const safeJson = async (r) => {
  try {
    return await r.json();
  } catch {
    return null;
  }


// Normalize different backend response shapes into a flat clients array
const normalizeClients = (j) => {
  if (!j) return [];
  if (Array.isArray(j)) return j;

  // common wrappers
  const candidates = [j.clients, j.data, j.items, j.result, j.payload, j.rows];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }

  // broker keyed object: { motilal:[...], dhan:[...], ... } or { clients_by_broker:{...} }
  const maybeMap = j.clients_by_broker && typeof j.clients_by_broker === "object" ? j.clients_by_broker : j;
  if (maybeMap && typeof maybeMap === "object") {
    const out = [];
    for (const [k, v] of Object.entries(maybeMap)) {
      if (Array.isArray(v)) {
        out.push(...v.map((x) => ({ broker: x?.broker || k, ...x })));
      }
    }
    if (out.length) return out;
  }

  return [];
};
};

// POST helper: try multiple endpoints until one is not 404
async function postWithFallback(paths, body, headers) {
  let last = null;

  for (const p of paths) {
    try {
      const r = await fetch(`${API_BASE}${p}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const text = await r.text().catch(() => "");

      // If route not found, try next
      if (r.status === 404) {
        last = { path: p, status: r.status, ok: r.ok, text };
        continue;
      }

      return { path: p, status: r.status, ok: r.ok, text };
    } catch (e) {
      last = { path: p, status: -1, ok: false, text: String(e?.message || e) };
    }
  }

  return last || { path: paths?.[0] || "", status: -1, ok: false, text: "No endpoint matched" };
}

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [selectedClients, setSelectedClients] = useState(new Set());
  const [subtab, setSubtab] = useState("clients");

  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const [broker, setBroker] = useState("dhan");
  const [addForm, setAddForm] = useState({
    name: "",
    userid: "",
    mobile: "",
    pin: "",
    apikey: "",
    api_secret: "",
    totpkey: "",
    capital: "",
  });

  const [editingKey, setEditingKey] = useState({ broker: null, userid: null });
  const [loggingNow, setLoggingNow] = useState(new Set());
  const pollingAbortRef = useRef(false);

  // Groups
  const [groups, setGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState(new Set());

  // UI unchanged: input exists but auto-fills
  const [userId, setUserId] = useState("");
  const userTouchedRef = useRef(false);

  const setUserIdFromSession = (next) => {
    const v = String(next || "").trim();
    if (!v) return;
    setUserId(v);
    writeLS(LS_KEY_USERID, v);
  };

  const saveUserId = (v) => {
    userTouchedRef.current = true;
    const next = String(v || "");
    setUserId(next);
    writeLS(LS_KEY_USERID, next);
  };

  const getUid = () => {
    const w = detectUserFromWelcomeText();
    if (w) {
      if (!userTouchedRef.current && w !== userId) setUserIdFromSession(w);
      return w;
    }
    return (userId || "").trim();
  };

  // ---- On mount: take real login user from "Welcome, ..." or fallback LS ----
  useEffect(() => {
    if (typeof window === "undefined") return;

    const welcome = detectUserFromWelcomeText();
    if (welcome) {
      setUserIdFromSession(welcome);
    } else {
      const ls = (readLSRaw(LS_KEY_USERID) || "").trim();
      if (ls) setUserId(ls);
    }

    // Keep watching for login change (user switch)
    const applyWelcome = () => {
      const w = detectUserFromWelcomeText();
      if (!w) return;
      if (!userTouchedRef.current && w !== userId) setUserIdFromSession(w);
    };

    const obs = new MutationObserver(() => applyWelcome());
    try {
      obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    } catch {}

    // small delayed retries (hydration timing)
    let tries = 0;
    const t = setInterval(() => {
      tries += 1;
      applyWelcome();
      if (tries >= 12) clearInterval(t);
    }, 500);

    return () => {
      obs.disconnect();
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- robust clients fetch ----------
  async function fetchClientsFor(uid) {
    const headers = uid ? { "x-user-id": uid } : undefined;

    // Try a bunch of common variants (your backend may implement any one of these)
    const urls = [
      // path-style
      `${API_BASE}/clients/${encodeURIComponent(uid)}`,
      `${API_BASE}/clients/${encodeURIComponent(uid)}/all`,
      `${API_BASE}/get_clients/${encodeURIComponent(uid)}`,

      // query-style
      `${API_BASE}/clients?user_id=${encodeURIComponent(uid)}`,
      `${API_BASE}/clients?userid=${encodeURIComponent(uid)}`,
      `${API_BASE}/clients?uid=${encodeURIComponent(uid)}`,
      `${API_BASE}/get_clients?user_id=${encodeURIComponent(uid)}`,
      `${API_BASE}/get_clients?userid=${encodeURIComponent(uid)}`,

      // header-style only
      `${API_BASE}/clients`,
      `${API_BASE}/get_clients`,
    ];

    let lastArr = null;

    for (const url of urls) {
      try {
        const r = await fetch(url, { cache: "no-store", headers });

        // If backend says "not found", try next url
        if (r.status === 404) continue;
        if (!r.ok) continue;

        const j = await safeJson(r);
        const arr = normalizeClients(j);

        // If it returned a non-empty list, take it immediately
        if (Array.isArray(arr) && arr.length > 0) return arr;

        // Remember last empty array so UI can show "No clients yet" cleanly
        if (Array.isArray(arr)) lastArr = arr;
      } catch {}
    }

    return lastArr ?? [];
  }

  async function loadClients() {
    const uid = getUid();
    if (!uid) {
      setClients([]);
      return;
    }
    const list = await fetchClientsFor(uid);
    setClients(list);
  }

  async function loadGroups() {
    const uid = getUid();
    try {
      const r = await fetch(`${API_BASE}/groups`, {
        cache: "no-store",
        headers: uid ? { "x-user-id": uid } : undefined,
      });
      if (r.ok) {
        const j = await safeJson(r);
        const arr = Array.isArray(j) ? j : j?.groups || [];
        setGroups(arr);
        try {
          localStorage.setItem(LS_KEY_GROUPS, JSON.stringify(arr));
        } catch {}
        return;
      }
      throw new Error("not ready");
    } catch {
      try {
        const v = JSON.parse(localStorage.getItem(LS_KEY_GROUPS) || "[]");
        setGroups(Array.isArray(v) ? v : []);
      } catch {
        setGroups([]);
      }
    }
  }

  useEffect(() => {
    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Key helper
  const keyOf = (c) => `${(c.broker || "").toLowerCase()}::${c.userid || c.client_id || ""}`;
  const allClientKeys = useMemo(() => clients.map(keyOf), [clients]);
  const toggleAllClients = (ch) => setSelectedClients(ch ? new Set(allClientKeys) : new Set());
  const toggleOneClient = (k, ch) =>
    setSelectedClients((prev) => {
      const s = new Set(prev);
      ch ? s.add(k) : s.delete(k);
      return s;
    });

  const groupKey = (g) => g.id || g.name;
  const allGroupKeys = useMemo(() => groups.map(groupKey), [groups]);
  const toggleAllGroups = (ch) => setSelectedGroups(ch ? new Set(allGroupKeys) : new Set());
  const toggleOneGroup = (k, ch) =>
    setSelectedGroups((prev) => {
      const s = new Set(prev);
      ch ? s.add(k) : s.delete(k);
      return s;
    });

  const statusBadge = (c) => {
    const k = keyOf(c);
    if (loggingNow.has(k)) return <Badge bg="warning">logging…</Badge>;
    const s =
      c.session_active === true
        ? "logged_in"
        : c.session_active === false
        ? "logged_out"
        : c.status || "pending";
    const v =
      s === "logged_in"
        ? "success"
        : s === "logged_out"
        ? "secondary"
        : s === "failed"
        ? "danger"
        : "warning";
    return <Badge bg={v}>{s}</Badge>;
  };

  const openAdd = () => {
    setEditMode(false);
    setBroker("dhan");
    setAddForm({
      name: "",
      userid: "",
      mobile: "",
      pin: "",
      apikey: "",
      api_secret: "",
      totpkey: "",
      capital: "",
    });
    setEditingKey({ broker: null, userid: null });
    setShowModal(true);
  };

  const openEdit = () => {
    if (selectedClients.size !== 1) return;
    const k = [...selectedClients][0];
    const row = clients.find((c) => keyOf(c) === k);
    if (!row) return;

    setEditMode(true);
    const b = (row.broker || "").toLowerCase();
    setBroker(b);

    setAddForm({
      name: row.name || row.display_name || "",
      userid: row.userid || row.client_id || "",
      mobile: row.mobile || "",
      pin: row.pin || "",
      apikey: row.apikey || "",
      api_secret: row.api_secret || row.pan || "",
      totpkey: row.totpkey || "",
      capital: row.capital?.toString?.() || "",
    });

    setEditingKey({ broker: b, userid: row.userid || row.client_id || "" });
    setShowModal(true);
  };

  // ✅ DELETE with fallback endpoints + good error reporting
  const onDelete = async () => {
    if (!selectedClients.size) return;
    if (!confirm(`Delete ${selectedClients.size} client(s)?`)) return;

    const uid = getUid();
    if (!uid) {
      alert("Login user not detected. Please re-login and try again.");
      return;
    }

    const items = [...selectedClients]
      .map((k) => {
        const r = clients.find((c) => keyOf(c) === k);
        return { broker: (r?.broker || "").toLowerCase(), userid: r?.userid || r?.client_id || "" };
      })
      .filter((x) => x && x.broker && x.userid);

    const payload = { user_id: uid, items };
    const headers = { "Content-Type": "application/json", "x-user-id": uid };

    // Try likely backend route names (one of these usually exists)
    const candidates = [
      "/delete_client",
      "/delete_clients",
      "/clients/delete",
      "/remove_client",
      "/client/delete",
    ];

    const res = await postWithFallback(candidates, payload, headers);

    if (!res || res.status === 404) {
      alert(
        "Backend has no delete route (404).\n\nTried:\n" +
          candidates.join("\n") +
          "\n\nFix backend by adding POST /delete_client or update frontend to correct route."
      );
      return;
    }

    if (!res.ok) {
      alert(`Delete failed (${res.status}) via ${res.path}\n${res.text || ""}`);
      return;
    }

    setSelectedClients(new Set());
    await loadClients();
  };

  async function pollUntilLoggedIn(broker, userid, { intervalMs = 1000, maxTries = 15 } = {}) {
    const uid = getUid();
    const targetKey = `${broker}::${userid}`;
    setLoggingNow((prev) => new Set(prev).add(targetKey));
    pollingAbortRef.current = false;

    let tries = 0;
    while (!pollingAbortRef.current && tries < maxTries) {
      try {
        const list = await fetchClientsFor(uid);
        const hit = list.find(
          (c) => (c.broker || "").toLowerCase() === broker && (c.userid || c.client_id || "") === userid
        );
        if (hit) {
          setClients(list);
          if (hit.session_active === true) break;
        }
      } catch {}
      tries++;
      await new Promise((res) => setTimeout(res, intervalMs));
    }

    setLoggingNow((prev) => {
      const n = new Set(prev);
      n.delete(targetKey);
      return n;
    });
  }

  const onSubmit = async (e) => {
    e.preventDefault();

    const uid = getUid();
    if (!uid) {
      alert("Login user not detected. Please re-login and try again.");
      return;
    }

    if (broker === "dhan") {
      if (!addForm.mobile || !addForm.pin || !addForm.apikey || !addForm.api_secret || !addForm.totpkey) {
        alert("All Dhan fields are required.");
        return;
      }
    }
    if (broker === "motilal") {
      if (!addForm.apikey || !addForm.pin || !addForm.api_secret) {
        alert("API Key, Password and PAN are required for Motilal.");
        return;
      }
    }

    const capitalNum = addForm.capital === "" ? undefined : Number(addForm.capital) || 0;

    const creds =
      broker === "dhan"
        ? { mobile: addForm.mobile, pin: addForm.pin, apikey: addForm.apikey, api_secret: addForm.api_secret, totpkey: addForm.totpkey }
        : { apikey: addForm.apikey, password: addForm.pin, pan: addForm.api_secret, totpkey: addForm.totpkey };

    const bodyBase = {
      broker,
      name: addForm.name || undefined,
      client_id: addForm.userid,
      user_id: uid,
      capital: capitalNum,
      creds,
      ...creds,
    };

    if (editMode && editingKey.userid) {
      bodyBase.original_broker = editingKey.broker;
      bodyBase.original_userid = editingKey.userid;
    }

    const endpoint = editMode ? "edit_client" : "add_client";

    try {
      const r = await fetch(`${API_BASE}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": uid },
        body: JSON.stringify(bodyBase),
      });

      setShowModal(false);
      setSelectedClients(new Set());
      await loadClients();

      const b = (editMode ? editingKey.broker : broker) || broker;
      const id = editMode ? editingKey.userid : addForm.userid;
      if (b && id) pollUntilLoggedIn(b, id);

      if (!r.ok) console.warn(`/${endpoint} failed`, await r.text().catch(() => ""));
    } catch {
      setShowModal(false);
    }
  };

  // ---------------- UI (UNCHANGED) ----------------
  return (
    <Card className="p-3">
      <div className="d-flex mb-3" style={{ gap: 10 }}>
        {subtab === "clients" ? (
          <>
            <Form.Control
              size="sm"
              style={{ maxWidth: 220 }}
              placeholder="Logged-in User ID"
              value={userId}
              onChange={(e) => saveUserId(e.target.value)}
            />
            <Button variant="success" onClick={openAdd}>
              Add Client
            </Button>
            <Button variant="secondary" disabled={selectedClients.size !== 1} onClick={openEdit}>
              Edit
            </Button>
            <Button variant="danger" disabled={selectedClients.size === 0} onClick={onDelete}>
              Delete
            </Button>
          </>
        ) : (
          <>
            <Button variant="success" disabled>
              Create Group
            </Button>
            <Button variant="secondary" disabled>
              Edit Group
            </Button>
            <Button variant="danger" disabled>
              Delete Group
            </Button>
            <Button variant="primary" disabled>
              Copy Setup
            </Button>
          </>
        )}
      </div>

      <ButtonGroup className="mb-3">
        <Button variant={subtab === "clients" ? "primary" : "outline-primary"} onClick={() => setSubtab("clients")}>
          Clients
        </Button>
        <Button variant={subtab === "groups" ? "primary" : "outline-primary"} onClick={() => setSubtab("groups")}>
          Groups
        </Button>
      </ButtonGroup>

      {subtab === "clients" && (
        <Table bordered hover responsive size="sm" className="align-middle">
          <thead>
            <tr>
              <th style={{ width: "1%" }}>
                <Form.Check
                  type="checkbox"
                  checked={selectedClients.size === clients.length && clients.length > 0}
                  onChange={(e) => toggleAllClients(e.target.checked)}
                />
              </th>
              <th>Name</th>
              <th>Broker</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center">
                  No clients yet.
                </td>
              </tr>
            )}
            {clients.map((c) => {
              const k = keyOf(c);
              return (
                <tr key={k}>
                  <td>
                    <Form.Check
                      type="checkbox"
                      checked={selectedClients.has(k)}
                      onChange={(e) => toggleOneClient(k, e.target.checked)}
                    />
                  </td>
                  <td>{c.name || c.display_name || c.userid || c.client_id}</td>
                  <td>{c.broker || ""}</td>
                  <td>{statusBadge(c)}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      {subtab === "groups" && (
        <Table bordered hover responsive size="sm" className="align-middle">
          <thead>
            <tr>
              <th style={{ width: "1%" }}>
                <Form.Check
                  type="checkbox"
                  checked={selectedGroups.size === groups.length && groups.length > 0}
                  onChange={(e) => toggleAllGroups(e.target.checked)}
                />
              </th>
              <th>Name</th>
              <th>Multiplier</th>
              <th>Members</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center">
                  No groups yet.
                </td>
              </tr>
            )}
            {groups.map((g) => {
              const k = groupKey(g);
              return (
                <tr key={k}>
                  <td>
                    <Form.Check
                      type="checkbox"
                      checked={selectedGroups.has(k)}
                      onChange={(e) => toggleOneGroup(k, e.target.checked)}
                    />
                  </td>
                  <td>{g.name}</td>
                  <td>{g.multiplier}</td>
                  <td>{(g.members || []).map((m) => `${(m.broker || "").toUpperCase()}:${m.userid || m.client_id}`).join(", ")}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      {/* Add/Edit Client Modal (same as your UI) */}
      <Modal show={showModal} onHide={() => { setShowModal(false); pollingAbortRef.current = true; }}>
        <Form onSubmit={onSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>{editMode ? "Edit Client" : "Add Client"}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Broker</Form.Label>
              <Form.Select
                value={broker}
                disabled={editMode}
                onChange={(e) => {
                  setBroker(e.target.value);
                  setAddForm({ name: "", userid: "", mobile: "", pin: "", apikey: "", api_secret: "", totpkey: "", capital: "" });
                }}
              >
                <option value="dhan">Dhan</option>
                <option value="motilal">Motilal</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-2">
              <Form.Label>Name</Form.Label>
              <Form.Control value={addForm.name} onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))} />
            </Form.Group>

            <Form.Group className="mb-2">
              <Form.Label>Client ID *</Form.Label>
              <Form.Control
                required
                disabled={editMode}
                value={addForm.userid}
                onChange={(e) => setAddForm((p) => ({ ...p, userid: e.target.value.trim() }))}
              />
            </Form.Group>

            <Form.Group className="mb-2">
              <Form.Label>Mobile Number *</Form.Label>
              <Form.Control
                required={broker === "dhan"}
                value={addForm.mobile}
                onChange={(e) => setAddForm((p) => ({ ...p, mobile: e.target.value.trim() }))}
              />
            </Form.Group>

            <Form.Group className="mb-2">
              <Form.Label>{broker === "dhan" ? "PIN *" : "Password *"}</Form.Label>
              <Form.Control
                type="password"
                required
                value={addForm.pin}
                onChange={(e) => setAddForm((p) => ({ ...p, pin: e.target.value.trim() }))}
              />
            </Form.Group>

            <Form.Group className="mb-2">
              <Form.Label>API Key *</Form.Label>
              <Form.Control
                required
                value={addForm.apikey}
                onChange={(e) => setAddForm((p) => ({ ...p, apikey: e.target.value.trim() }))}
              />
            </Form.Group>

            <Form.Group className="mb-2">
              <Form.Label>{broker === "dhan" ? "API Secret *" : "PAN *"}</Form.Label>
              <Form.Control
                type="password"
                required
                value={addForm.api_secret}
                onChange={(e) => setAddForm((p) => ({ ...p, api_secret: e.target.value.trim() }))}
              />
            </Form.Group>

            <Form.Group className="mb-2">
              <Form.Label>TOTP Key {broker === "dhan" ? "*" : "(optional)"}</Form.Label>
              <Form.Control
                type="password"
                required={broker === "dhan"}
                value={addForm.totpkey}
                onChange={(e) => setAddForm((p) => ({ ...p, totpkey: e.target.value.trim() }))}
              />
              <Form.Text muted>Used for auto login OTP generation.</Form.Text>
            </Form.Group>

            <Form.Group className="mb-2">
              <Form.Label>Capital</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                min="0"
                value={addForm.capital}
                onChange={(e) => setAddForm((p) => ({ ...p, capital: e.target.value }))}
              />
            </Form.Group>
          </Modal.Body>

          <Modal.Footer>
            <Button variant="secondary" onClick={() => { setShowModal(false); pollingAbortRef.current = true; }}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save & Login
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Card>
  );
}
