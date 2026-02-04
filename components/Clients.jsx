"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { Card, Button, Modal, Form, Table, Badge, ButtonGroup } from "react-bootstrap";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:5001";

// ----- local storage keys -----
const LS_KEY_GROUPS = "mb_groups_v2_groupMultiplier";
const LS_KEY_USERID = "mb_logged_in_userid_v1";

// ---------- helpers ----------
const safeJson = async (r) => {
  try {
    return await r.json();
  } catch {
    return null;
  }
};

const readLSJson = (k, d) => {
  try {
    const v = JSON.parse(localStorage.getItem(k) || "null");
    return v ?? d;
  } catch {
    return d;
  }
};

const writeLSJson = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

const writeLS = (k, v) => {
  try {
    localStorage.setItem(k, String(v ?? ""));
  } catch {}
};

const readLS = (k) => {
  try {
    return (localStorage.getItem(k) || "").trim();
  } catch {
    return "";
  }
};

// Prefer navbar text: "Welcome, <user>"
const detectUserFromWelcomeText = () => {
  if (typeof window === "undefined") return "";
  try {
    const txt = document.body?.innerText || "";
    const m = txt.match(/Welcome,\s*([^\s]+)/i);
    if (m && m[1]) return String(m[1]).trim();
  } catch {}
  return "";
};

// POST with fallback paths: tries endpoints until one is NOT 404
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
  // ---------- state ----------
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
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editGroupMode, setEditGroupMode] = useState(false);

  const [groupForm, setGroupForm] = useState({
    id: null,
    name: "",
    multiplier: "1",
    members: {},
  });

  // Copy modal
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyForm, setCopyForm] = useState({
    name: "",
    master: "",
    rows: {},
  });

  // UI unchanged: input remains, but auto-filled from login
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

  // ---- mount: pick correct login user (avoid stale "pra") ----
  useEffect(() => {
    if (typeof window === "undefined") return;

    const w = detectUserFromWelcomeText();
    if (w) {
      setUserIdFromSession(w);
      return;
    }

    const ls = readLS(LS_KEY_USERID);
    if (ls) setUserId(ls);

    let tries = 0;
    const t = setInterval(() => {
      tries += 1;
      const ww = detectUserFromWelcomeText();
      if (ww) {
        if (!userTouchedRef.current) setUserIdFromSession(ww);
        clearInterval(t);
      }
      if (tries >= 16) clearInterval(t);
    }, 500);

    return () => clearInterval(t);
  }, []);

  // watch for account switch (logout/login)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const apply = () => {
      const w = detectUserFromWelcomeText();
      if (!w) return;

      if (!userTouchedRef.current && w !== userId) {
        setUserIdFromSession(w);
      }
    };

    const obs = new MutationObserver(() => apply());
    try {
      obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    } catch {}

    apply();
    return () => obs.disconnect();
  }, [userId]);

  // ---------- robust clients fetch ----------
  async function fetchClientsFor(uid) {
    const headers = uid ? { "x-user-id": uid } : undefined;

    // Try multiple styles your backend might use
    const candidates = [
      `${API_BASE}/clients?user_id=${encodeURIComponent(uid)}`,
      `${API_BASE}/clients?userid=${encodeURIComponent(uid)}`,
      `${API_BASE}/clients`, // header only
    ];

    let lastGood = null;

    for (const url of candidates) {
      try {
        const r = await fetch(url, { cache: "no-store", headers });
        if (!r.ok) continue;

        const j = await safeJson(r);
        const arr = Array.isArray(j) ? j : j?.clients || [];

        // If we got real list, return immediately
        if (Array.isArray(arr) && arr.length > 0) return arr;

        // keep as possible result (in case user truly has no clients)
        lastGood = Array.isArray(arr) ? arr : [];
      } catch {}
    }

    return lastGood ?? [];
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
        writeLSJson(LS_KEY_GROUPS, arr);
        return;
      }
      throw new Error("groups not ready");
    } catch {
      setGroups(readLSJson(LS_KEY_GROUPS, []));
    }
  }

  useEffect(() => {
    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // whenever userId changes, reload (and clear selections)
    setSelectedClients(new Set());
    setSelectedGroups(new Set());
    loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ---------- selection helpers ----------
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

  // ---------- badges ----------
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

  // ---------- client actions ----------
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

    const headers = { "Content-Type": "application/json", "x-user-id": uid };
    const payload = { user_id: uid, items };

    const candidates = [
      "/delete_client",
      "/delete_clients",
      "/clients/delete",
      "/client/delete",
      "/clients/remove",
      "/remove_client",
      "/api/delete_client",
    ];

    const res = await postWithFallback(candidates, payload, headers);

    if (!res || res.status === 404) {
      alert("Delete API not found on backend (404).\n\nTried:\n" + candidates.join("\n"));
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

  // ---------- group actions ----------
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
    const g = groups.find((x) => (x.id || x.name) === k);
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

    if (ok) {
      await loadGroups();
    } else {
      const next = groups.filter((g) => !ids.includes(g.id || g.name));
      setGroups(next);
      writeLSJson(LS_KEY_GROUPS, next);
    }

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
      const r = await fetch(`${API_BASE}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": uid },
        body: JSON.stringify(payload),
      });

      if (r.ok) await loadGroups();
      else {
        const next = readLSJson(LS_KEY_GROUPS, []);
        setGroups(next);
      }
    } catch {
      const next = readLSJson(LS_KEY_GROUPS, []);
      setGroups(next);
    }

    setShowGroupModal(false);
    setEditGroupMode(false);
  };

  // ---------- copy modal ----------
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

  // ---------- render (UI unchanged) ----------
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
              const k = g.id || g.name;
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

      {/* Group Modal */}
      <Modal show={showGroupModal} onHide={() => setShowGroupModal(false)} size="lg">
        <Form onSubmit={onSubmitGroup}>
          <Modal.Header closeButton>
            <Modal.Title>{editGroupMode ? "Edit Group" : "Create Group"}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Group Name</Form.Label>
              <Form.Control
                required
                value={groupForm.name}
                onChange={(e) => setGroupForm((p) => ({ ...p, name: e.target.value }))}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Multiplier</Form.Label>
              <Form.Control
                type="number"
                min="0"
                step="0.01"
                value={groupForm.multiplier}
                onChange={(e) => setGroupForm((p) => ({ ...p, multiplier: e.target.value }))}
              />
            </Form.Group>

            <div className="mb-3">
              <Form.Label>Members</Form.Label>
              <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                {clients.map((c) => {
                  const k = keyOf(c);
                  return (
                    <Form.Check
                      key={k}
                      type="checkbox"
                      label={`${(c.broker || "").toUpperCase()}:${c.userid || c.client_id}`}
                      checked={groupForm.members[k] || false}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setGroupForm((prev) => ({ ...prev, members: { ...prev.members, [k]: checked } }));
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </Modal.Body>

          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowGroupModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {editGroupMode ? "Save Group" : "Create Group"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Copy Trading Modal */}
      <Modal show={showCopyModal} onHide={() => setShowCopyModal(false)} size="lg">
        <Form onSubmit={onSubmitCopy}>
          <Modal.Header closeButton>
            <Modal.Title>Create Copy Trading Setup</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Setup Name</Form.Label>
              <Form.Control
                required
                value={copyForm.name}
                onChange={(e) => setCopyForm((p) => ({ ...p, name: e.target.value }))}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Master Account</Form.Label>
              <Form.Select value={copyForm.master} onChange={(e) => setCopyForm((p) => ({ ...p, master: e.target.value }))}>
                <option value="">Select Master</option>
                {clients.map((c) => {
                  const k = keyOf(c);
                  return (
                    <option key={k} value={c.userid || c.client_id}>
                      {(c.broker || "").toUpperCase()}:{c.userid || c.client_id}
                    </option>
                  );
                })}
              </Form.Select>
            </Form.Group>

            <div className="mb-3">
              <Form.Label>Child Accounts</Form.Label>
              <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                {clients.map((c) => {
                  const k = keyOf(c);
                  const row = copyForm.rows[k] || { selected: false, mult: "1" };
                  return (
                    <div key={k} className="d-flex align-items-center mb-1" style={{ gap: "5px" }}>
                      <Form.Check
                        type="checkbox"
                        checked={row.selected}
                        onChange={(e) => {
                          const selected = e.target.checked;
                          setCopyForm((prev) => ({ ...prev, rows: { ...prev.rows, [k]: { ...row, selected } } }));
                        }}
                      />
                      <span style={{ flex: 1 }}>
                        {(c.broker || "").toUpperCase()}:{c.userid || c.client_id}
                      </span>
                      <Form.Control
                        style={{ width: "80px" }}
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={row.mult}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCopyForm((prev) => ({ ...prev, rows: { ...prev.rows, [k]: { ...row, mult: val } } }));
                        }}
                        disabled={!row.selected}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </Modal.Body>

          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowCopyModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create Setup
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Card>
  );
}
