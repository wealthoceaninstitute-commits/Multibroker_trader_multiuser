// CopyTrading.jsx — Create + Edit + Delete + Enable/Disable (multi-user safe)
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, Button, Table, Modal, Form, Badge } from 'react-bootstrap';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:5001";

// localStorage keys used across this project
const LS_KEY_TOKEN = "mb_auth_token_v1";
const LS_KEY_USERID = "mb_logged_in_userid_v1";

function getUseridSafe() {
  if (typeof window === "undefined") return "";
  let uid = localStorage.getItem(LS_KEY_USERID) || localStorage.getItem("mb_user") || "";
  uid = String(uid || "").trim();
  // handle accidental quotes
  if ((uid.startsWith('"') && uid.endsWith('"')) || (uid.startsWith("'") && uid.endsWith("'"))) {
    uid = uid.slice(1, -1).trim();
  }
  return uid;
}

function authHeadersSafe() {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem(LS_KEY_TOKEN) || "";
  const uid = getUseridSafe();
  const h = {};
  if (token) h["Authorization"] = `Bearer ${token}`;
  if (uid) h["x-user-id"] = uid;
  return h;
}

async function fetchJson(url, options = {}) {
  const r = await fetch(url, options);
  let j = null;
  try { j = await r.json(); } catch { j = null; }
  return { ok: r.ok, status: r.status, json: j };
}

export default function CopyTrading() {
  const [clients, setClients] = useState([]);
  const [setups, setSetups] = useState([]);
  const [selectedId, setSelectedId] = useState('');

  // modal state
  const [show, setShow] = useState(false);
  const [editingId, setEditingId] = useState(null); // null=create, string=edit
  const [form, setForm] = useState({ name: '', master: '', rows: {} });

  const uid = useMemo(() => getUseridSafe(), []);

  // ---- load data ----
  const loadClients = async () => {
    const headers = authHeadersSafe();
    const enc = encodeURIComponent(uid || "");
    // Try same family of endpoints as Clients tab (robust)
    const urls = [
      `${API_BASE}/get_clients`,
      enc ? `${API_BASE}/get_clients?user_id=${enc}` : "",
      enc ? `${API_BASE}/clients?user_id=${enc}` : "",
      enc ? `${API_BASE}/clients?userid=${enc}` : "",
      `${API_BASE}/clients`,
    ].filter(Boolean);

    for (const u of urls) {
      try {
        const { ok, json } = await fetchJson(u, { headers, cache: 'no-store' });
        if (!ok) continue;
        const arr = Array.isArray(json) ? json : (json?.clients || []);
        if (Array.isArray(arr)) {
          setClients(arr);
          return;
        }
      } catch {}
    }
    setClients([]);
  };

  const loadSetups = async () => {
    const headers = authHeadersSafe();
    const enc = encodeURIComponent(uid || "");
    const urls = [
      `${API_BASE}/list_copytrading_setups`,
      enc ? `${API_BASE}/list_copytrading_setups?userid=${enc}` : "",
      enc ? `${API_BASE}/list_copytrading_setups?user_id=${enc}` : "",
    ].filter(Boolean);

    for (const u of urls) {
      try {
        const { ok, json } = await fetchJson(u, { headers, cache: 'no-store' });
        if (!ok) continue;
        setSetups(json?.setups || []);
        return;
      } catch {}
    }
    setSetups([]);
  };

  useEffect(() => { loadClients(); loadSetups(); }, []);

  // Also refresh clients when opening modal (so it's always in sync with Clients tab)
  useEffect(() => {
    if (show) loadClients();
  }, [show]);

  const keyOf = (c) => `${(c.broker || 'motilal').toLowerCase()}::${c.userid || c.client_id || c.clientId || ''}`;

  // ---- toolbar actions ----
  const openCreate = () => {
    const rows = {};
    clients.forEach(c => { rows[keyOf(c)] = { selected: false, mult: '1' }; });
    setForm({ name: '', master: '', rows });
    setEditingId(null);
    setShow(true);
  };

  const openEdit = () => {
    if (!selectedId) return;
    const s = setups.find(x => (x.id || x.name) === selectedId);
    if (!s) return;

    // seed rows for all clients
    const rows = {};
    clients.forEach(c => { rows[keyOf(c)] = { selected: false, mult: '1' }; });

    // preselect children + multipliers
    const children = s.children || [];
    const mm = s.multipliers || {};
    clients.forEach(c => {
      const k = keyOf(c);
      const cid = (c.userid || c.client_id || "");
      const selected = children.includes(cid) || children.includes(k) || children.includes(c.client_id);
      const mult = String(mm[cid] ?? mm[k] ?? '1');
      rows[k] = { selected, mult };
    });

    setForm({
      name: s.name || s.id || '',
      master: s.master || '',
      rows,
    });
    setEditingId(selectedId);
    setShow(true);
  };

  const saveSetup = async () => {
    const headers = { ...authHeadersSafe(), "Content-Type": "application/json" };

    const children = [];
    const multipliers = {};
    Object.entries(form.rows || {}).forEach(([k, v]) => {
      if (!v?.selected) return;
      const cid = k.split("::")[1] || "";
      if (!cid) return;
      if (cid === form.master) return; // master cannot be child
      children.push(cid);
      multipliers[cid] = Number(v.mult || 1);
    });

    const payload = {
      id: editingId || form.name,
      name: form.name,
      master: form.master,
      children,
      multipliers,
      enabled: true,
    };

    const { ok } = await fetchJson(`${API_BASE}/save_copytrading_setup`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (ok) {
      setShow(false);
      setSelectedId(payload.id || payload.name);
      loadSetups();
    }
  };

  const enableDisable = async (enable) => {
    if (!selectedId) return;
    const headers = { ...authHeadersSafe(), "Content-Type": "application/json" };
    const url = enable ? `${API_BASE}/enable_copy` : `${API_BASE}/disable_copy`;
    const { ok } = await fetchJson(url, { method: "POST", headers, body: JSON.stringify({ id: selectedId }) });
    if (ok) loadSetups();
  };

  const deleteSetup = async () => {
    if (!selectedId) return;
    const headers = { ...authHeadersSafe(), "Content-Type": "application/json" };
    const { ok } = await fetchJson(`${API_BASE}/delete_copy_setup`, { method: "POST", headers, body: JSON.stringify({ id: selectedId }) });
    if (ok) {
      setSelectedId("");
      loadSetups();
    }
  };

  const masterOptions = clients.map(c => ({
    key: keyOf(c),
    id: c.userid || c.client_id || "",
    label: `${c.name || c.userid || c.client_id || ""}`,
    broker: c.broker || "motilal",
  }));

  const badgeVariant = (s) => (s?.enabled ? "success" : "secondary");

  return (
    <Card className="p-3">
      <h5 className="mb-3">Copy Trading Management</h5>

      <div className="d-flex gap-2 mb-2">
        <Button variant="success" onClick={openCreate}>Create Setup</Button>
        <Button variant="secondary" disabled={!selectedId} onClick={openEdit}>Edit Setup</Button>
        <Button variant="outline-success" disabled={!selectedId} onClick={() => enableDisable(true)}>Enable</Button>
        <Button variant="outline-secondary" disabled={!selectedId} onClick={() => enableDisable(false)}>Disable</Button>
        <Button variant="danger" disabled={!selectedId} onClick={deleteSetup}>Delete</Button>
      </div>

      <Table bordered size="sm" className="mt-2">
        <thead>
          <tr>
            <th>Select</th>
            <th>Setup Name</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {setups.length === 0 ? (
            <tr><td colSpan={3}>No setups yet.</td></tr>
          ) : setups.map(s => {
            const id = (s.id || s.name);
            return (
              <tr key={id}>
                <td>
                  <Form.Check
                    type="radio"
                    name="setup"
                    checked={selectedId === id}
                    onChange={() => setSelectedId(id)}
                  />
                </td>
                <td>{s.name || id}</td>
                <td><Badge bg={badgeVariant(s)}>{s.enabled ? "enabled" : "disabled"}</Badge></td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      <Modal show={show} onHide={() => setShow(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>{editingId ? "Edit Copy Trading Setup" : "Create Copy Trading Setup"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Setup Name *</Form.Label>
            <Form.Control
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., morning-copy"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Select Master Account *</Form.Label>
            <Form.Select
              value={form.master}
              onChange={(e) => setForm({ ...form, master: e.target.value })}
            >
              <option value="">-- Select Master --</option>
              {masterOptions.map(o => (
                <option key={o.key} value={o.id}>{o.label}</option>
              ))}
            </Form.Select>
          </Form.Group>

          <Table bordered size="sm">
            <thead>
              <tr>
                <th>Add</th>
                <th>Client</th>
                <th>Broker</th>
                <th>Multiplier</th>
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 ? (
                <tr><td colSpan={4}>No clients.</td></tr>
              ) : clients.map(c => {
                const k = keyOf(c);
                const row = form.rows?.[k] || { selected: false, mult: '1' };
                const cid = c.userid || c.client_id || "";
                const disabled = cid === form.master;
                return (
                  <tr key={k}>
                    <td>
                      <Form.Check
                        type="checkbox"
                        checked={!!row.selected}
                        disabled={disabled}
                        onChange={(e) => setForm({
                          ...form,
                          rows: { ...form.rows, [k]: { ...row, selected: e.target.checked } }
                        })}
                      />
                    </td>
                    <td>{c.name || cid}</td>
                    <td>{(c.broker || "motilal").toUpperCase()}</td>
                    <td style={{ width: 140 }}>
                      <Form.Control
                        value={row.mult}
                        disabled={disabled || !row.selected}
                        onChange={(e) => setForm({
                          ...form,
                          rows: { ...form.rows, [k]: { ...row, mult: e.target.value } }
                        })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>

          <div className="text-muted" style={{ fontSize: 12 }}>
            Master cannot be a child. Each child has its own multiplier.
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShow(false)}>Cancel</Button>
          <Button variant="success" onClick={saveSetup} disabled={!form.name || !form.master}>Save Setup</Button>
        </Modal.Footer>
      </Modal>
    </Card>
  );
}
