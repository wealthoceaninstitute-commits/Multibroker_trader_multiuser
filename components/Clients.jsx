"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { Card, Button, Modal, Form, Table, Badge, ButtonGroup } from "react-bootstrap";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:5001";

// ----- helpers -----
const LS_KEY_GROUPS = "mb_groups_v2_groupMultiplier";
const LS_KEY_USERID = "mb_logged_in_userid_v1";

// --------- robust user detection ---------
// 1) Prefer the visible navbar text: "Welcome, <user>"
// 2) Fallback to localStorage if navbar not available
const detectUserFromWelcomeText = () => {
  if (typeof window === "undefined") return "";

  try {
    // Fast path: scan body text for "Welcome, xyz"
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
};

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

  // UI unchanged: still shows the input, but we auto-fill correctly.
  const [userId, setUserId] = useState("");
  const userTouchedRef = useRef(false); // if user manually edits, don't fight them

  const setUserIdFromSession = (next) => {
    const v = String(next || "").trim();
    if (!v) return;
    setUserId(v);
    writeLS(LS_KEY_USERID, v);
  };

  // ---- 1) On mount, set userId from Welcome text (authoritative) ----
  useEffect(() => {
    if (typeof window === "undefined") return;

    const welcome = detectUserFromWelcomeText();
    if (welcome) {
      setUserIdFromSession(welcome);
      return;
    }

    // fallback to LS only if Welcome isn't detected yet
    const ls = (readLSRaw(LS_KEY_USERID) || "").trim();
    if (ls) setUserId(ls);

    // Then keep trying for a few seconds because UI hydration may be late
    let tries = 0;
    const t = setInterval(() => {
      tries += 1;
      const w = detectUserFromWelcomeText();
      if (w) {
        // If user did NOT manually type, always trust welcome text
        if (!userTouchedRef.current) setUserIdFromSession(w);
        clearInterval(t);
      }
      if (tries >= 16) clearInterval(t); // ~8s
    }, 500);

    return () => clearInterval(t);
  }, []);

  // ---- 2) Keep watching for changes (when user logs out/in or user changes) ----
  useEffect(() => {
    if (typeof window === "undefined") return;

    const applyWelcome = () => {
      const w = detectUserFromWelcomeText();
      if (!w) return;
      // Always override stale "pra" with actual logged-in user
      // unless user manually typed in this session.
      if (!userTouchedRef.current) {
        if (w !== userId) setUserIdFromSession(w);
      }
    };

    // MutationObserver catches navbar updates without polling forever
    const obs = new MutationObserver(() => applyWelcome());
    try {
      obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    } catch {}

    // also do one immediate check
    applyWelcome();

    return () => obs.disconnect();
  }, [userId]);

  const saveUserId = (v) => {
    userTouchedRef.current = true;
    const next = String(v || "");
    setUserId(next);
    writeLS(LS_KEY_USERID, next);
  };

  const getUid = () => {
    // Always prefer Welcome username if available
    const w = detectUserFromWelcomeText();
    if (w) {
      if (!userTouchedRef.current && w !== userId) setUserIdFromSession(w);
      return w;
    }
    return (userId || "").trim();
  };

  // Load clients and groups
  async function loadClients() {
    const uid = getUid();
    if (!uid) {
      setClients([]);
      return;
    }
    try {
      const url = `${API_BASE}/clients?user_id=${encodeURIComponent(uid)}`;
      const r = await fetch(url, { cache: "no-store", headers: { "x-user-id": uid } });
      const j = await safeJson(r);
      setClients(Array.isArray(j) ? j : j?.clients || []);
    } catch {
      setClients([]);
    }
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

  // Groups
  const [groups, setGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState(new Set());
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editGroupMode, setEditGroupMode] = useState(false);

  const [groupForm, setGroupForm] = useState({
    id: null,
    name: "",
    multiplier: "1",
    members: {},
  });

  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyForm, setCopyForm] = useState({
    name: "",
    master: "",
    rows: {},
  });

  useEffect(() => {
    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // when session user changes, auto-load that user's clients
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

  // Group helpers
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
      s === "logged_in" ? "success" : s === "logged_out" ? "secondary" : s === "failed" ? "danger" : "warning";
    return <Badge bg={v}>{s}</Badge>;
  };

  const openAdd = () => {
    setEditMode(false);
    setBroker("dhan");
    setAddForm({ name: "", userid: "", mobile: "", pin: "", apikey: "", api_secret: "", totpkey: "", capital: "" });
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

    try {
      await fetch(`${API_BASE}/delete_client`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": uid },
        body: JSON.stringify({ user_id: uid, items }),
      });
      await loadClients();
    } catch {}
    setSelectedClients(new Set());
  };

  async function pollUntilLoggedIn(broker, userid, { intervalMs = 1000, maxTries = 15 } = {}) {
    const uid = getUid();
    const targetKey = `${broker}::${userid}`;
    setLoggingNow((prev) => new Set(prev).add(targetKey));
    pollingAbortRef.current = false;

    let tries = 0;
    while (!pollingAbortRef.current && tries < maxTries) {
      try {
        const r = await fetch(`${API_BASE}/clients?user_id=${encodeURIComponent(uid)}`, {
          cache: "no-store",
          headers: uid ? { "x-user-id": uid } : undefined,
        });
        const j = await safeJson(r);
        const list = Array.isArray(j) ? j : j?.clients || [];
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
        ? {
            mobile: addForm.mobile,
            pin: addForm.pin,
            apikey: addForm.apikey,
            api_secret: addForm.api_secret,
            totpkey: addForm.totpkey,
          }
        : broker === "motilal"
        ? {
            apikey: addForm.apikey,
            password: addForm.pin,
            pan: addForm.api_secret,
            totpkey: addForm.totpkey,
          }
        : {};

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
      bodyBase._original = { broker: editingKey.broker, userid: editingKey.userid };
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

      if (!r.ok) {
        console.warn(`/${endpoint} failed`, await r.text().catch(() => ""));
      }
    } catch {
      setShowModal(false);
    }
  };

  const membersArrayFromForm = () => {
    const a = [];
    for (const k of Object.keys(groupForm.members || {})) {
      if (!groupForm.members[k]) continue;
      const [b, id] = k.split("::");
      if (!b || !id) continue;
      a.push({ broker: b, userid: id });
    }
    return a;
  };

  const prefillGroupForm = (g) => {
    const map = {};
    (g.members || []).forEach((m) => {
      const k = `${(m.broker || "").toLowerCase()}::${m.userid || m.client_id || ""}`;
      map[k] = true;
    });
    setGroupForm({
      id: g.id ?? null,
      name: g.name || "",
      multiplier: g.multiplier?.toString?.() || "1",
      members: map,
    });
  };

  const openCreateGroup = () => {
    setEditGroupMode(false);
    setGroupForm({ id: null, name: "", multiplier: "1", members: {} });
    setShowGroupModal(true);
  };

  const openEditGroup = () => {
    if (selectedGroups.size !== 1) return;
    const k = [...selectedGroups][0];
    const g = groups.find((x) => groupKey(x) === k);
    if (!g) return;
    setEditGroupMode(true);
    prefillGroupForm(g);
    setShowGroupModal(true);
  };

  const onDeleteGroup = async () => {
    if (!selectedGroups.size) return;
    if (!confirm(`Delete ${selectedGroups.size} group(s)?`)) return;

    const uid = getUid();
    if (!uid) {
      alert("Login user not detected. Please re-login and try again.");
      return;
    }

    const ids = [...selectedGroups];
    let ok = false;
    try {
      const r = await fetch(`${API_BASE}/delete_group`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": uid },
        body: JSON.stringify({ ids, names: ids }),
      });
      ok = r.ok;
    } catch {}

    if (ok) await loadGroups();
    setSelectedGroups(new Set());
  };

  const onSubmitGroup = async (e) => {
    e.preventDefault();

    const uid = getUid();
    if (!uid) {
      alert("Login user not detected. Please re-login and try again.");
      return;
    }

    const members = membersArrayFromForm();
    const m = groupForm.multiplier === "" ? 1 : Number(groupForm.multiplier);
    if (!groupForm.name.trim() || members.length === 0 || !isFinite(m) || m <= 0) {
      alert("Enter name, select members & valid multiplier.");
      return;
    }

    const payload = {
      id: groupForm.id || undefined,
      name: groupForm.name.trim(),
      multiplier: m,
      members,
    };

    const endpoint = editGroupMode ? "edit_group" : "add_group";

    try {
      await fetch(`${API_BASE}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": uid },
        body: JSON.stringify(payload),
      });
      await loadGroups();
    } catch {}

    setShowGroupModal(false);
    setEditGroupMode(false);
  };

  const openCopyModal = () => {
    const rows = {};
    clients.forEach((c) => {
      rows[keyOf(c)] = { selected: false, mult: "1" };
    });
    setCopyForm({ name: "", master: "", rows });
    setShowCopyModal(true);
  };

  const onSubmitCopy = async (e) => {
    e.preventDefault();

    const uid = getUid();
    if (!uid) {
      alert("Login user not detected. Please re-login and try again.");
      return;
    }

    const name = (copyForm.name || "").trim();
    const master = (copyForm.master || "").trim();
    if (!name || !master) {
      alert("Enter name & select master");
      return;
    }

    const children = [];
    const multipliers = {};
    for (const [k, v] of Object.entries(copyForm.rows || {})) {
      if (!v?.selected) continue;
      const [, id] = k.split("::");
      if (!id || id === master) continue;
      children.push(id);
      const mm = parseFloat(v.mult);
      multipliers[id] = !isFinite(mm) || mm <= 0 ? 1 : mm;
    }

    if (children.length === 0) {
      alert("Select at least one Child.");
      return;
    }

    const body = {
      name,
      setup_name: name,
      master,
      master_account: master,
      children,
      child_accounts: children,
      multipliers,
      enabled: false,
    };

    try {
      const r = await fetch(`${API_BASE}/save_copytrading_setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": uid },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        alert(`Error saving: ${r.status}`);
        return;
      }
      setShowCopyModal(false);
    } catch {
      alert("Network error");
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
            <Button variant="success" onClick={openCreateGroup}>
              Create Group
            </Button>
            <Button variant="secondary" disabled={selectedGroups.size !== 1} onClick={openEditGroup}>
              Edit Group
            </Button>
            <Button variant="danger" disabled={selectedGroups.size === 0} onClick={onDeleteGroup}>
              Delete Group
            </Button>
            <Button variant="primary" onClick={openCopyModal}>
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
                  <td>
                    {(g.members || [])
                      .map((m) => `${(m.broker || "").toUpperCase()}:${m.userid || m.client_id}`)
                      .join(", ")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      {/* Modals: keep your existing modals as-is (same UI) */}
      {/* Add/Edit Client Modal */}
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

            {(broker === "dhan" || broker === "motilal") && (
              <>
                <Form.Group className="mb-2">
                  <Form.Label>Mobile Number *</Form.Label>
                  <Form.Control
                    required={broker === "dhan"}
                    value={addForm.mobile}
                    onChange={(e) => setAddForm((p) => ({ ...p, mobile: e.target.value.trim() }))}
                    placeholder={broker === "dhan" ? "Registered Mobile" : "Motilal API Key (unused)"}
                  />
                </Form.Group>

                <Form.Group className="mb-2">
                  <Form.Label>{broker === "dhan" ? "PIN *" : "Password *"}</Form.Label>
                  <Form.Control
                    type="password"
                    required
                    value={addForm.pin}
                    onChange={(e) => setAddForm((p) => ({ ...p, pin: e.target.value.trim() }))}
                    placeholder={broker === "dhan" ? "Trading PIN" : "Motilal Password"}
                  />
                </Form.Group>

                <Form.Group className="mb-2">
                  <Form.Label>API Key *</Form.Label>
                  <Form.Control
                    required
                    value={addForm.apikey}
                    onChange={(e) => setAddForm((p) => ({ ...p, apikey: e.target.value.trim() }))}
                    placeholder={broker === "dhan" ? "Dhan API Key" : "Motilal API Key"}
                  />
                </Form.Group>

                <Form.Group className="mb-2">
                  <Form.Label>{broker === "dhan" ? "API Secret *" : "PAN *"}</Form.Label>
                  <Form.Control
                    type="password"
                    required
                    value={addForm.api_secret}
                    onChange={(e) => setAddForm((p) => ({ ...p, api_secret: e.target.value.trim() }))}
                    placeholder={broker === "dhan" ? "API Secret" : "Motilal PAN"}
                  />
                </Form.Group>

                <Form.Group className="mb-2">
                  <Form.Label>TOTP Key {broker === "dhan" ? "*" : "(optional)"}</Form.Label>
                  <Form.Control
                    type="password"
                    required={broker === "dhan"}
                    value={addForm.totpkey}
                    onChange={(e) => setAddForm((p) => ({ ...p, totpkey: e.target.value.trim() }))}
                    placeholder="Authenticator Secret Key"
                  />
                  <Form.Text muted>Used for auto login OTP generation.</Form.Text>
                </Form.Group>
              </>
            )}

            <Form.Group className="mb-2">
              <Form.Label>Capital</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                min="0"
                value={addForm.capital}
                onChange={(e) => setAddForm((p) => ({ ...p, capital: e.target.value }))}
                placeholder="e.g. 100000"
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
