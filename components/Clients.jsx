"use client";

import { useEffect, useMemo, useState, useRef } from 'react';
import { Card, Button, Modal, Form, Table, Badge, ButtonGroup } from 'react-bootstrap';

// NOTE:
// This component is a full drop-in "Clients" page/module.
// - Uses API_BASE env (NEXT_PUBLIC_API_BASE recommended)
// - Loads clients from `${API_BASE}/clients`
// - Adds client via `${API_BASE}/add_client`
// - Keeps UI simple and broker-aware credentials fields
// - Includes lightweight frontend-only "Groups" and "Copy Trading setups" helpers (optional sections)

// ---------------- env / fetch helpers ----------------
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API ||
  '';

const safeJson = async (res) => {
  const txt = await res.text();
  try {
    return JSON.parse(txt);
  } catch (e) {
    return { ok: false, raw: txt, status: res.status };
  }
};

const fetchJson = async (url, opts = {}) => {
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
    cache: 'no-store',
  });
  const data = await safeJson(res);
  if (!res.ok) {
    const msg = (data && (data.detail || data.error || data.message)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
};

// ---------------- small UI helpers ----------------
const nowIso = () => new Date().toISOString();

const toNum = (v) => {
  const n = Number(String(v ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
};

const capStr = (s) => (s ? String(s).trim() : '');

const clientKey = (broker, client_id) => `${broker}-${client_id}`;

// ---------------- Component ----------------
export default function Clients() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  const [clients, setClients] = useState([]);
  const [selectedKey, setSelectedKey] = useState('');

  // Add Client modal
  const [showAdd, setShowAdd] = useState(false);
  const [addBroker, setAddBroker] = useState('dhan');

  // IMPORTANT: Keep shape stable to avoid input state bugs
  const [addForm, setAddForm] = useState({
    // shared
    name: '',
    client_id: '',
    capital: '',
    // broker-specific
    apikey: '', // dhan access token
    password: '', // motilal
    pan: '', // motilal optional
    mpin: '', // motilal optional (or TOTP/MPIN style)
    totp: '', // motilal optional
  });

  // Frontend-only Groups
  const [groups, setGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');

  // Frontend-only Copy setups
  const [copySetups, setCopySetups] = useState([]);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyForm, setCopyForm] = useState({
    name: '',
    leader: '',
    followers: [],
    mode: 'mirror',
    multiplier: '1',
    maxPerTrade: '',
    created_at: '',
  });

  const mounted = useRef(false);

  // ---------------- load / persist (optional local) ----------------
  useEffect(() => {
    mounted.current = true;

    // Load local group + copy setup state (frontend-only)
    try {
      const g = localStorage.getItem('woi_groups_v1');
      if (g) setGroups(JSON.parse(g));
    } catch {}
    try {
      const c = localStorage.getItem('woi_copy_setups_v1');
      if (c) setCopySetups(JSON.parse(c));
    } catch {}

    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('woi_groups_v1', JSON.stringify(groups));
    } catch {}
  }, [groups]);

  useEffect(() => {
    try {
      localStorage.setItem('woi_copy_setups_v1', JSON.stringify(copySetups));
    } catch {}
  }, [copySetups]);

  const loadClients = async () => {
    if (!API_BASE) {
      setErr('Missing API base URL. Set NEXT_PUBLIC_API_BASE in Vercel/ENV.');
      return;
    }
    setErr('');
    setInfo('');
    setLoading(true);
    try {
      const data = await fetchJson(`${API_BASE}/clients`);
      const list = Array.isArray(data) ? data : (data.clients || []);
      setClients(list);
      // Auto-select first client if none selected
      if (!selectedKey && list.length > 0) {
        const c0 = list[0];
        const k0 = clientKey(c0.broker || '', c0.client_id || c0.userid || '');
        setSelectedKey(k0);
      }
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------------- derived data ---------------
  const clientsWithKey = useMemo(() => {
    return (clients || []).map((c) => {
      const broker = c.broker || c.type || '';
      const client_id = c.client_id || c.userid || c.user_id || c.clientCode || '';
      return {
        ...c,
        _broker: broker,
        _client_id: client_id,
        _key: clientKey(broker, client_id),
      };
    });
  }, [clients]);

  const selectedClient = useMemo(() => {
    return clientsWithKey.find((c) => c._key === selectedKey) || null;
  }, [clientsWithKey, selectedKey]);

  const brokerBadge = (b) => {
    const s = String(b || '').toLowerCase();
    if (s.includes('dhan')) return <Badge bg="primary">Dhan</Badge>;
    if (s.includes('motilal') || s.includes('mofsl')) return <Badge bg="warning" text="dark">Motilal</Badge>;
    return <Badge bg="secondary">{b || 'Unknown'}</Badge>;
  };

  const resetAddForm = (broker = addBroker) => {
    setAddBroker(broker);
    setAddForm({
      name: '',
      client_id: '',
      capital: '',
      apikey: '',
      password: '',
      pan: '',
      mpin: '',
      totp: '',
    });
  };

  // --------------- actions ---------------
  const openAdd = () => {
    resetAddForm(addBroker);
    setShowAdd(true);
    setErr('');
    setInfo('');
  };

  const closeAdd = () => {
    setShowAdd(false);
  };

  const submitAdd = async (e) => {
    e.preventDefault();
    setErr('');
    setInfo('');

    if (!API_BASE) {
      setErr('Missing API base URL. Set NEXT_PUBLIC_API_BASE.');
      return;
    }

    const broker = String(addBroker || '').trim().toLowerCase();

    const client_id = capStr(addForm.client_id);
    if (!client_id) {
      setErr('Client ID is required.');
      return;
    }

    // Broker-aware validations
    if (broker === 'dhan') {
      if (!capStr(addForm.apikey)) {
        setErr('Access Token is required for Dhan.');
        return;
      }
    }
    if (broker === 'motilal') {
      if (!capStr(addForm.password)) {
        setErr('Password is required for Motilal.');
        return;
      }
      // PAN optional, API key optional, TOTP optional
    }

    const payload = {
      broker,
      client_id,
      display_name: capStr(addForm.name),
      capital: addForm.capital ? toNum(addForm.capital) : undefined,
      creds:
        broker === 'dhan'
          ? { type: 'dhan', access_token: capStr(addForm.apikey) }
          : {
              type: 'motilal',
              client_code: client_id,
              password: capStr(addForm.password),
              mpin: capStr(addForm.mpin) || capStr(addForm.totp), // allow mpin/totp
              pan: capStr(addForm.pan) || undefined,
            },
    };

    setLoading(true);
    try {
      const out = await fetchJson(`${API_BASE}/add_client`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setInfo(out?.message || 'Client added. Backend will attempt login, then clients list will refresh.');
      setShowAdd(false);
      await loadClients();
      setSelectedKey(clientKey(broker, client_id));
    } catch (e2) {
      setErr(String(e2.message || e2));
    } finally {
      setLoading(false);
    }
  };

  // Groups (frontend-only)
  const addGroup = () => {
    const name = capStr(newGroupName);
    if (!name) return;
    if (groups.some((g) => g.name.toLowerCase() === name.toLowerCase())) {
      setErr('Group already exists.');
      return;
    }
    setErr('');
    setGroups([...groups, { name, created_at: nowIso() }]);
    setNewGroupName('');
  };

  const deleteGroup = (name) => {
    setGroups(groups.filter((g) => g.name !== name));
  };

  // Copy setups (frontend-only)
  const openCopy = () => {
    setCopyForm({
      name: '',
      leader: selectedKey || '',
      followers: [],
      mode: 'mirror',
      multiplier: '1',
      maxPerTrade: '',
      created_at: '',
    });
    setShowCopyModal(true);
    setErr('');
    setInfo('');
  };

  const closeCopy = () => setShowCopyModal(false);

  const toggleFollower = (k) => {
    setCopyForm((p) => {
      const has = p.followers.includes(k);
      const next = has ? p.followers.filter((x) => x !== k) : [...p.followers, k];
      return { ...p, followers: next };
    });
  };

  const submitCopy = (e) => {
    e.preventDefault();
    setErr('');
    setInfo('');

    const name = capStr(copyForm.name);
    if (!name) {
      setErr('Setup name is required.');
      return;
    }
    if (!capStr(copyForm.leader)) {
      setErr('Leader client is required.');
      return;
    }
    if (!copyForm.followers || copyForm.followers.length === 0) {
      setErr('Select at least one follower.');
      return;
    }

    const item = {
      id: `copy_${Date.now()}`,
      name,
      leader: copyForm.leader,
      followers: copyForm.followers,
      mode: capStr(copyForm.mode) || 'mirror',
      multiplier: toNum(copyForm.multiplier || 1),
      maxPerTrade: copyForm.maxPerTrade ? toNum(copyForm.maxPerTrade) : undefined,
      created_at: nowIso(),
    };

    setCopySetups((prev) => [item, ...prev]);
    setShowCopyModal(false);
    setInfo('Copy setup created (frontend-only).');
  };

  const deleteCopySetup = (id) => setCopySetups((prev) => prev.filter((x) => x.id !== id));

  // --------------- UI ---------------
  return (
    <Card className="p-3">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h4 className="mb-1">Clients</h4>
          <div className="text-muted" style={{ fontSize: 13 }}>
            {API_BASE ? (
              <span>API: <code>{API_BASE}</code></span>
            ) : (
              <span className="text-danger">API base missing: set <code>NEXT_PUBLIC_API_BASE</code></span>
            )}
          </div>
        </div>

        <div className="d-flex gap-2">
          <Button variant="outline-secondary" onClick={loadClients} disabled={loading}>
            Refresh
          </Button>
          <Button variant="primary" onClick={openAdd}>
            + Add Client
          </Button>
        </div>
      </div>

      {err ? (
        <div className="mb-3">
          <Badge bg="danger">Error</Badge>
          <div className="mt-2" style={{ whiteSpace: 'pre-wrap' }}>{err}</div>
        </div>
      ) : null}

      {info ? (
        <div className="mb-3">
          <Badge bg="success">Info</Badge>
          <div className="mt-2" style={{ whiteSpace: 'pre-wrap' }}>{info}</div>
        </div>
      ) : null}

      {/* Clients table */}
      <Table bordered hover responsive size="sm">
        <thead>
          <tr>
            <th style={{ width: 70 }}>Select</th>
            <th style={{ width: 120 }}>Broker</th>
            <th>Client ID</th>
            <th>Name</th>
            <th style={{ width: 120 }}>Capital</th>
            <th style={{ width: 120 }}>Session</th>
          </tr>
        </thead>
        <tbody>
          {clientsWithKey.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-center text-muted">
                {loading ? 'Loading…' : 'No clients found.'}
              </td>
            </tr>
          ) : (
            clientsWithKey.map((c) => (
              <tr key={c._key}>
                <td className="text-center">
                  <Form.Check
                    type="radio"
                    name="clientSelect"
                    checked={selectedKey === c._key}
                    onChange={() => setSelectedKey(c._key)}
                  />
                </td>
                <td>{brokerBadge(c._broker)}</td>
                <td>
                  <code>{c._client_id}</code>
                </td>
                <td>{c.name || c.display_name || '-'}</td>
                <td>{c.capital ?? c.balance ?? '-'}</td>
                <td>
                  {c.session_active ? (
                    <Badge bg="success">Active</Badge>
                  ) : (
                    <Badge bg="secondary">Off</Badge>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </Table>

      {/* Selected client details */}
      <div className="mt-3">
        <h5 className="mb-2">Selected</h5>
        {selectedClient ? (
          <div className="p-2 border rounded">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <div className="mb-1">
                  {brokerBadge(selectedClient._broker)}{' '}
                  <span className="ms-2">
                    <strong>{selectedClient.name || selectedClient.display_name || '—'}</strong>
                  </span>
                </div>
                <div className="text-muted" style={{ fontSize: 13 }}>
                  Client: <code>{selectedClient._client_id}</code> | Key: <code>{selectedClient._key}</code>
                </div>
              </div>
              <div className="d-flex gap-2">
                <Button variant="outline-primary" onClick={openCopy} disabled={!selectedKey}>
                  + Copy Setup
                </Button>
              </div>
            </div>

            <div className="mt-2" style={{ fontSize: 13 }}>
              <div><strong>Capital:</strong> {selectedClient.capital ?? '—'}</div>
              <div><strong>Created:</strong> {selectedClient.created_at || '—'}</div>
              <div><strong>Last login:</strong> {selectedClient.last_login_ts || '—'}</div>
            </div>
          </div>
        ) : (
          <div className="text-muted">Select a client above.</div>
        )}
      </div>

      {/* Groups (frontend-only) */}
      <div className="mt-4">
        <h5 className="mb-2">Groups (frontend-only)</h5>
        <div className="d-flex gap-2 mb-2">
          <Form.Control
            placeholder="New group name"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
          />
          <Button variant="outline-success" onClick={addGroup}>
            Add
          </Button>
        </div>

        {groups.length === 0 ? (
          <div className="text-muted">No groups yet.</div>
        ) : (
          <Table bordered size="sm" responsive>
            <thead>
              <tr>
                <th>Group</th>
                <th style={{ width: 180 }}>Created</th>
                <th style={{ width: 120 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.name}>
                  <td>{g.name}</td>
                  <td className="text-muted" style={{ fontSize: 13 }}>
                    {g.created_at}
                  </td>
                  <td>
                    <Button size="sm" variant="outline-danger" onClick={() => deleteGroup(g.name)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      {/* Copy Trading setups (frontend-only) */}
      <div className="mt-4">
        <h5 className="mb-2">Copy Trading Setups (frontend-only)</h5>
        {copySetups.length === 0 ? (
          <div className="text-muted">No copy setups yet.</div>
        ) : (
          <Table bordered size="sm" responsive>
            <thead>
              <tr>
                <th>Name</th>
                <th>Leader</th>
                <th>Followers</th>
                <th style={{ width: 120 }}>Mode</th>
                <th style={{ width: 120 }}>Multiplier</th>
                <th style={{ width: 160 }}>Created</th>
                <th style={{ width: 120 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {copySetups.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong></td>
                  <td><code>{s.leader}</code></td>
                  <td>
                    <div style={{ fontSize: 12 }}>
                      {(s.followers || []).map((f) => (
                        <Badge key={f} bg="secondary" className="me-1">{f}</Badge>
                      ))}
                    </div>
                  </td>
                  <td>{s.mode}</td>
                  <td>{s.multiplier}</td>
                  <td className="text-muted" style={{ fontSize: 12 }}>{s.created_at}</td>
                  <td>
                    <Button size="sm" variant="outline-danger" onClick={() => deleteCopySetup(s.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      {/* Add Client Modal */}
      <Modal show={showAdd} onHide={closeAdd} centered>
        <Modal.Header closeButton>
          <Modal.Title>Add Client</Modal.Title>
        </Modal.Header>

        <Form onSubmit={submitAdd}>
          <Modal.Body>
            <Form.Group className="mb-2">
              <Form.Label>Broker</Form.Label>
              <Form.Select
                value={addBroker}
                onChange={(e) => {
                  const b = e.target.value;
                  resetAddForm(b);
                }}
              >
                <option value="dhan">Dhan</option>
                <option value="motilal">Motilal</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-2">
              <Form.Label>Name (optional)</Form.Label>
              <Form.Control
                value={addForm.name}
                onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Display name"
              />
            </Form.Group>

            <Form.Group className="mb-2">
              <Form.Label>Client ID (required)</Form.Label>
              <Form.Control
                value={addForm.client_id}
                onChange={(e) => setAddForm((p) => ({ ...p, client_id: e.target.value }))}
                placeholder={addBroker === 'dhan' ? 'Dhan Client ID' : 'Motilal Client Code'}
                required
              />
            </Form.Group>

            <Form.Group className="mb-2">
              <Form.Label>Capital (optional)</Form.Label>
              <Form.Control
                value={addForm.capital}
                onChange={(e) => setAddForm((p) => ({ ...p, capital: e.target.value }))}
                placeholder="e.g., 100000"
              />
            </Form.Group>

            {addBroker === 'dhan' ? (
              <>
                <Form.Group className="mb-2">
                  <Form.Label>Access Token (required)</Form.Label>
                  <Form.Control
                    value={addForm.apikey}
                    onChange={(e) => setAddForm((p) => ({ ...p, apikey: e.target.value }))}
                    placeholder="Dhan access token"
                    required
                  />
                </Form.Group>
              </>
            ) : (
              <>
                <Form.Group className="mb-2">
                  <Form.Label>Password (required)</Form.Label>
                  <Form.Control
                    type="password"
                    value={addForm.password}
                    onChange={(e) => setAddForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder="Motilal password"
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-2">
                  <Form.Label>PAN (optional)</Form.Label>
                  <Form.Control
                    value={addForm.pan}
                    onChange={(e) => setAddForm((p) => ({ ...p, pan: e.target.value }))}
                    placeholder="ABCDE1234F"
                  />
                </Form.Group>

                <Form.Group className="mb-2">
                  <Form.Label>MPIN / TOTP Key (optional)</Form.Label>
                  <Form.Control
                    value={addForm.mpin}
                    onChange={(e) => setAddForm((p) => ({ ...p, mpin: e.target.value }))}
                    placeholder="MPIN or TOTP secret"
                  />
                </Form.Group>
              </>
            )}
          </Modal.Body>

          <Modal.Footer>
            <Button variant="secondary" onClick={closeAdd}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Saving…' : 'Add Client'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Copy Setup Modal */}
      <Modal show={showCopyModal} onHide={closeCopy} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Create Copy Setup</Modal.Title>
        </Modal.Header>

        <Form onSubmit={submitCopy}>
          <Modal.Body>
            <div className="row g-3">
              <div className="col-md-6">
                <Form.Group>
                  <Form.Label>Setup Name</Form.Label>
                  <Form.Control
                    value={copyForm.name}
                    onChange={(e) => setCopyForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g., Renko Dwaitha Mirror"
                  />
                </Form.Group>
              </div>

              <div className="col-md-6">
                <Form.Group>
                  <Form.Label>Leader</Form.Label>
                  <Form.Select
                    value={copyForm.leader}
                    onChange={(e) => setCopyForm((p) => ({ ...p, leader: e.target.value }))}
                  >
                    <option value="">Select leader</option>
                    {clientsWithKey.map((c) => (
                      <option key={c._key} value={c._key}>
                        {c._key}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </div>

              <div className="col-md-6">
                <Form.Group>
                  <Form.Label>Mode</Form.Label>
                  <Form.Select
                    value={copyForm.mode}
                    onChange={(e) => setCopyForm((p) => ({ ...p, mode: e.target.value }))}
                  >
                    <option value="mirror">Mirror</option>
                    <option value="inverse">Inverse</option>
                    <option value="signals">Signals only</option>
                  </Form.Select>
                </Form.Group>
              </div>

              <div className="col-md-3">
                <Form.Group>
                  <Form.Label>Multiplier</Form.Label>
                  <Form.Control
                    value={copyForm.multiplier}
                    onChange={(e) => setCopyForm((p) => ({ ...p, multiplier: e.target.value }))}
                    placeholder="1"
                  />
                </Form.Group>
              </div>

              <div className="col-md-3">
                <Form.Group>
                  <Form.Label>Max/Trade (optional)</Form.Label>
                  <Form.Control
                    value={copyForm.maxPerTrade}
                    onChange={(e) => setCopyForm((p) => ({ ...p, maxPerTrade: e.target.value }))}
                    placeholder="e.g., 5000"
                  />
                </Form.Group>
              </div>

              <div className="col-12">
                <Form.Group>
                  <Form.Label>Followers</Form.Label>
                  <div className="d-flex flex-wrap gap-2">
                    {clientsWithKey
                      .filter((c) => c._key !== copyForm.leader)
                      .map((c) => {
                        const checked = copyForm.followers.includes(c._key);
                        return (
                          <Button
                            key={c._key}
                            size="sm"
                            variant={checked ? 'success' : 'outline-secondary'}
                            onClick={() => toggleFollower(c._key)}
                            type="button"
                          >
                            {checked ? '✓ ' : ''}{c._key}
                          </Button>
                        );
                      })}
                  </div>
                </Form.Group>
              </div>

              <div className="col-12">
                <div className="text-muted" style={{ fontSize: 12 }}>
                  This setup is stored in browser localStorage (frontend-only). Hook it to backend later if needed.
                </div>
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
