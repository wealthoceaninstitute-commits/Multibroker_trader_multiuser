function getLoggedInUserId() {
  // We support multiple storage keys so it works with different login pages.
  // Priority order: explicit mb_user_id, then common variants, then JSON blobs.
  const directKeys = ['mb_user_id', 'user_id', 'userid', 'userId', 'uid', 'logged_in_user', 'loggedInUserId'];
  for (const k of directKeys) {
    const v = (typeof window !== 'undefined' && window.localStorage) ? localStorage.getItem(k) : '';
    if (v && String(v).trim()) return String(v).trim();
  }

  // Sometimes login stores a JSON object (e.g., "user" or "profile").
  const jsonKeys = ['user', 'profile', 'auth', 'session'];
  for (const k of jsonKeys) {
    try {
      const raw = (typeof window !== 'undefined' && window.localStorage) ? localStorage.getItem(k) : '';
      if (!raw) continue;
      const obj = JSON.parse(raw);
      const cand =
        obj?.user_id ?? obj?.userid ?? obj?.userId ?? obj?.uid ?? obj?.id ?? obj?.username ?? obj?.mobile ?? obj?.email;
      if (cand && String(cand).trim()) return String(cand).trim();
    } catch {
      // ignore
    }
  }

  return '';
}

    if (!userId) {
      setError('User ID is not set. Please set User ID above and try again.');
      return;
    }


  // Logged-in user id (owner of these clients). We send it in headers (x-user-id).
  const [userId, setUserId] = useState(() => getLoggedInUserId());
  const [userIdDraft, setUserIdDraft] = useState(() => getLoggedInUserId());

  function persistUserId(next) {
    const v = String(next || '').trim();
    setUserId(v);
    setUserIdDraft(v);
    try {
      localStorage.setItem('mb_user_id', v);
    } catch {
      // ignore
    }
  }

"use client";
function getLoggedInUserId() {
  // We support multiple storage keys so it works with different login pages.
  // Priority order: explicit mb_user_id, then common variants, then JSON blobs.
  const directKeys = ['mb_user_id', 'user_id', 'userid', 'userId', 'uid', 'logged_in_user', 'loggedInUserId'];
  for (const k of directKeys) {
    const v = (typeof window !== 'undefined' && window.localStorage) ? localStorage.getItem(k) : '';
    if (v && String(v).trim()) return String(v).trim();
  }

  // Sometimes login stores a JSON object (e.g., "user" or "profile").
  const jsonKeys = ['user', 'profile', 'auth', 'session'];
  for (const k of jsonKeys) {
    try {
      const raw = (typeof window !== 'undefined' && window.localStorage) ? localStorage.getItem(k) : '';
      if (!raw) continue;
      const obj = JSON.parse(raw);
      const cand =
        obj?.user_id ?? obj?.userid ?? obj?.userId ?? obj?.uid ?? obj?.id ?? obj?.username ?? obj?.mobile ?? obj?.email;
      if (cand && String(cand).trim()) return String(cand).trim();
    } catch {
      // ignore
    }
  }

  return '';
}



import { useEffect, useMemo, useState, useRef } from 'react';
import { Card, Button, Modal, Form, Table, Badge, ButtonGroup } from 'react-bootstrap';

// NOTE:
// This component is a full drop‑in replacement for the existing Clients
// component.  It retains all of the original behaviour and form layout
// while enabling support for the Motilal broker.  The modal fields are
// identical to the attached file – Name, Client ID, Mobile Number,
// PIN, API Key, API Secret, TOTP Key and Capital – and these fields
// appear for both Dhan and Motilal accounts.  Internally the values
// entered in these inputs are mapped to the appropriate credential
// properties for each broker.  See the onSubmit handler for details.

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:5001';

// ---------------- logged-in user id (Option 1) ----------------
// We pass the logged-in user's id to the backend via a request header.
// Set this once at login time (recommended):
//   localStorage.setItem('mb_user_id', '<USERID>')
// This component also checks a few fallback keys so it works with older builds.

const withUserHeader = (headers = {}) => {
  const uid = userId || getLoggedInUserId();
  return uid ? { ...headers, 'x-user-id': uid } : { ...headers };
};
};


// ----- helpers -----
const LS_KEY_GROUPS = 'mb_groups_v2_groupMultiplier';
const readLS = (k, d) => {
  try {
    const v = JSON.parse(localStorage.getItem(k));
    return v ?? d;
  } catch {
    return d;
  }
};
const writeLS = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [selectedClients, setSelectedClients] = useState(new Set());
  const [subtab, setSubtab] = useState('clients');

  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const [broker, setBroker] = useState('dhan');
  const [addForm, setAddForm] = useState({
    name: '',
    client_id: '',
    mobile: '',
    pin: '',
    apikey: '',
    api_secret: '',
    totpkey: '',
    capital: '',
  });

  const [editingKey, setEditingKey] = useState({ broker: null, client_id: null });

  const [loggingNow, setLoggingNow] = useState(new Set());
  const pollingAbortRef = useRef(false);

  // Groups
  const [groups, setGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState(new Set());
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editGroupMode, setEditGroupMode] = useState(false);

  const [groupForm, setGroupForm] = useState({
    id: null,
    name: '',
    multiplier: '1',
    members: {},
  });

  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyForm, setCopyForm] = useState({
    name: '',
    master: '',
    rows: {},
  });

  // Load clients and groups on mount
  async function loadClients() {
    try {
      const r = await fetch(`${API_BASE}/clients`, {
        cache: 'no-store',
        headers: withUserHeader(),
      });
      const j = await r.json();
      setClients(Array.isArray(j) ? j : j.clients || []);
    } catch {
      setClients([]);
    }
  }

  async function loadGroups() {
    try {
      const r = await fetch(`${API_BASE}/groups`, {
        cache: 'no-store',
        headers: withUserHeader(),
      });
      if (r.ok) {
        const j = await r.json();
        const arr = Array.isArray(j) ? j : j.groups || [];
        setGroups(arr);
        writeLS(LS_KEY_GROUPS, arr);
        return;
      }
      throw new Error('not ready');
    } catch {
      setGroups(readLS(LS_KEY_GROUPS, []));
    }
  }

  useEffect(() => {
    loadClients();
    loadGroups();
  }, []);

  // Key helper: derive a unique key from broker + userid
  const keyOf = (c) => `${(c.broker || '').toLowerCase()}::${c.client_id || c.userid || ''}`;
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

  // Display session status badge
  const statusBadge = (c) => {
    const k = keyOf(c);
    if (loggingNow.has(k)) return <Badge bg="warning">logging…</Badge>;
    const s = c.session_active === true
      ? 'logged_in'
      : c.session_active === false
      ? 'logged_out'
      : c.status || 'pending';
    const v = s === 'logged_in' ? 'success' : s === 'logged_out' ? 'secondary' : s === 'failed' ? 'danger' : 'warning';
    return <Badge bg={v}>{s}</Badge>;
  };

  // Open add modal
  const openAdd = () => {
    setEditMode(false);
    setBroker('dhan');
    setAddForm({ name: '', client_id: '', mobile: '', pin: '', apikey: '', api_secret: '', totpkey: '', capital: '' });
    setEditingKey({ broker: null, client_id: null });
    setShowModal(true);
  };

  // Open edit modal
  const openEdit = () => {
    if (selectedClients.size !== 1) return;
    const k = [...selectedClients][0];
    const row = clients.find((c) => keyOf(c) === k);
    if (!row) return;
    setEditMode(true);
    const b = (row.broker || '').toLowerCase();
    setBroker(b);
    setAddForm({
      name: row.name || row.display_name || '',
      client_id: row.client_id || row.userid || '',
      mobile: row.mobile || '',
      pin: row.pin || '',
      apikey: row.apikey || '',
      api_secret: row.api_secret || row.pan || '',
      totpkey: row.totpkey || '',
      capital: row.capital?.toString?.() || '',
    });
    setEditingKey({ broker: b, client_id: row.client_id || row.userid || '' });
    setShowModal(true);
  };

  // Delete selected clients
  const onDelete = async () => {
    if (!selectedClients.size) return;
    if (!confirm(`Delete ${selectedClients.size} client(s)?`)) return;
    const items = [...selectedClients]
      .map((k) => {
        const r = clients.find((c) => keyOf(c) === k);
        return { broker: (r?.broker || '').toLowerCase(), client_id: r?.client_id || r?.userid || '' };
      })
      .filter(Boolean);
    try {
      await fetch(`${API_BASE}/delete_client`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...withUserHeader() },
        body: JSON.stringify({ items }),
      });
      await loadClients();
    } catch {}
    setSelectedClients(new Set());
  };

  // Poll until client logs in after adding/editing
  async function pollUntilLoggedIn(broker, client_id, { intervalMs = 1000, maxTries = 15 } = {}) {
    const targetKey = `${broker}::${client_id}`;
    setLoggingNow((prev) => new Set(prev).add(targetKey));
    pollingAbortRef.current = false;
    let tries = 0;
    while (!pollingAbortRef.current && tries < maxTries) {
      try {
        const r = await fetch(`${API_BASE}/clients`, {
          cache: 'no-store',
          headers: withUserHeader(),
        });
        const j = await r.json();
        const list = Array.isArray(j) ? j : j.clients || [];
        const hit = list.find(
          (c) => (c.broker || '').toLowerCase() === broker && (c.client_id || c.userid || '') === client_id
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

  // Submit add/edit client
  const onSubmit = async (e) => {
    e.preventDefault();
    // Dhan required fields validation
    if (broker === 'dhan') {
      if (!addForm.mobile || !addForm.pin || !addForm.apikey || !addForm.api_secret || !addForm.totpkey) {
        alert('All Dhan fields are required.');
        return;
      }
    }
    // Motilal required fields validation
    if (broker === 'motilal') {
      if (!addForm.apikey || !addForm.pin || !addForm.api_secret) {
        alert('API Key, Password and PAN are required for Motilal.');
        return;
      }
    }
    const capitalNum = addForm.capital === '' ? undefined : Number(addForm.capital) || 0;
    const creds =
      broker === 'dhan'
        ? {
            mobile: addForm.mobile,
            pin: addForm.pin,
            apikey: addForm.apikey,
            api_secret: addForm.api_secret,
            totpkey: addForm.totpkey,
          }
        : broker === 'motilal'
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
      client_id: addForm.client_id,
      capital: capitalNum,
      creds,
      ...creds,
    };
    if (editMode && editingKey.client_id) {
      bodyBase._original = { broker: editingKey.broker, client_id: editingKey.client_id };
      bodyBase.original_broker = editingKey.broker;
      bodyBase.original_client_id = editingKey.client_id;
    }
    const endpoint = editMode ? 'edit_client' : 'add_client';
    try {
      const r = await fetch(`${API_BASE}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...withUserHeader() },
        body: JSON.stringify(bodyBase),
      });
      setShowModal(false);
      setSelectedClients(new Set());
      await loadClients();
      const b = (editMode ? editingKey.broker : broker) || broker;
      const id = editMode ? editingKey.client_id: addForm.client_id;
      if (b && id) pollUntilLoggedIn(b, id);
      if (!r.ok) {
        console.warn(`/${endpoint} failed`, await r.text().catch(() => ''));
      }
    } catch {
      setShowModal(false);
    }
  };

  // Members array helper for groups
  const membersArrayFromForm = () => {
    const a = [];
    for (const k of Object.keys(groupForm.members || {})) {
      if (!groupForm.members[k]) continue;
      const [b, id] = k.split('::');
      if (!b || !id) continue;
      a.push({ broker: b, client_id: id });
    }
    return a;
  };

  const prefillGroupForm = (g) => {
    const map = {};
    (g.members || []).forEach((m) => {
      const k = `${(m.broker || '').toLowerCase()}::${m.client_id || m.userid || ''}`;
      map[k] = true;
    });
    setGroupForm({
      id: g.id ?? null,
      name: g.name || '',
      multiplier: g.multiplier?.toString?.() || '1',
      members: map,
    });
  };
  const openCreateGroup = () => {
    setEditGroupMode(false);
    setGroupForm({ id: null, name: '', multiplier: '1', members: {} });
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
  async function saveGroupsLocally(next) {
    setGroups(next);
    writeLS(LS_KEY_GROUPS, next);
  }
  const onDeleteGroup = async () => {
    if (!selectedGroups.size) return;
    if (!confirm(`Delete ${selectedGroups.size} group(s)?`)) return;
    const ids = [...selectedGroups];
    let ok = false;
    try {
      const r = await fetch(`${API_BASE}/delete_group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...withUserHeader() },
        body: JSON.stringify({ ids, names: ids }),
      });
      ok = r.ok;
    } catch {}
    if (!ok) {
      const next = groups.filter((g) => !ids.includes(groupKey(g)));
      await saveGroupsLocally(next);
    } else {
      await loadGroups();
    }
    setSelectedGroups(new Set());
  };
  const onSubmitGroup = async (e) => {
    e.preventDefault();
    const members = membersArrayFromForm();
    const m = groupForm.multiplier === '' ? 1 : Number(groupForm.multiplier);
    if (!groupForm.name.trim() || members.length === 0 || !isFinite(m) || m <= 0) {
      alert('Enter name, select members & valid multiplier.');
      return;
    }
    const payload = {
      id: groupForm.id || undefined,
      name: groupForm.name.trim(),
      multiplier: m,
      members,
    };
    const endpoint = editGroupMode ? 'edit_group' : 'add_group';
    let ok = false;
    try {
      const r = await fetch(`${API_BASE}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...withUserHeader() },
        body: JSON.stringify(payload),
      });
      ok = r.ok;
    } catch {}
    if (!ok) {
      if (editGroupMode) {
        const k = payload.id ?? groupForm.name;
        const next = groups.map((g) => (groupKey(g) === k ? { ...payload } : g));
        await saveGroupsLocally(next);
      } else {
        const tid = `g_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const newG = {
          id: tid,
          name: payload.name,
          multiplier: payload.multiplier,
          members: payload.members,
        };
        await saveGroupsLocally([newG, ...groups]);
      }
    } else {
      await loadGroups();
    }
    setShowGroupModal(false);
    setEditGroupMode(false);
  };

  const openCopyModal = () => {
    const rows = {};
    clients.forEach((c) => {
      rows[keyOf(c)] = { selected: false, mult: '1' };
    });
    setCopyForm({ name: '', master: '', rows });
    setShowCopyModal(true);
  };
  const onSubmitCopy = async (e) => {
    e.preventDefault();
    const name = (copyForm.name || '').trim();
    const master = (copyForm.master || '').trim();
    if (!name || !master) {
      alert('Enter name & select master');
      return;
    }
    const children = [];
    const multipliers = {};
    for (const [k, v] of Object.entries(copyForm.rows || {})) {
      if (!v?.selected) continue;
      const [, id] = k.split('::');
      if (!id || id === master) continue;
      children.push(id);
      const m = parseFloat(v.mult);
      multipliers[id] = !isFinite(m) || m <= 0 ? 1 : m;
    }
    if (children.length === 0) {
      alert('Select at least one Child.');
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        alert(`Error saving: ${r.status}`);
        return;
      }
      setShowCopyModal(false);
    } catch {
      alert('Network error');
    }
  };

  // Render component
  return (
    <Card className="p-3">

      {/* Logged-in User (owner) */}
      <div className="mb-3">
        <Card className="p-2">
          <div className="d-flex flex-wrap align-items-center" style={{ gap: 10 }}>
            <div style={{ fontWeight: 600 }}>User ID</div>
            <Form.Control
              size="sm"
              style={{ maxWidth: 220 }}
              placeholder="Enter your User ID"
              value={userIdDraft}
              onChange={(e) => setUserIdDraft(e.target.value)}
            />
            <Button
              size="sm"
              variant="primary"
              onClick={() => persistUserId(userIdDraft)}
              disabled={!String(userIdDraft || '').trim()}
            >
              Set
            </Button>
            <Badge bg={userId ? 'success' : 'warning'}>{userId ? `Active: ${userId}` : 'Not set'}</Badge>
            {!userId && (
              <div className="text-muted" style={{ fontSize: 12 }}>
                Set this once. It will be saved in your browser and sent to backend as <code>x-user-id</code>.
              </div>
            )}
          </div>
        </Card>
      </div>


      {/* Toolbar */}
      <div className="d-flex mb-3" style={{ gap: 10 }}>
        {subtab === 'clients' ? (
          <>
            <Button variant="success" onClick={openAdd}>Add Client</Button>
            <Button
              variant="secondary"
              disabled={selectedClients.size !== 1}
              onClick={openEdit}
            >
              Edit
            </Button>
            <Button
              variant="danger"
              disabled={selectedClients.size === 0}
              onClick={onDelete}
            >
              Delete
            </Button>
          </>
        ) : (
          <>
            <Button variant="success" onClick={openCreateGroup}>Create Group</Button>
            <Button
              variant="secondary"
              disabled={selectedGroups.size !== 1}
              onClick={openEditGroup}
            >
              Edit Group
            </Button>
            <Button
              variant="danger"
              disabled={selectedGroups.size === 0}
              onClick={onDeleteGroup}
            >
              Delete Group
            </Button>
            <Button variant="primary" onClick={openCopyModal}>Copy Setup</Button>
          </>
        )}
      </div>
      {/* Tabs */}
      <ButtonGroup className="mb-3">
        <Button
          variant={subtab === 'clients' ? 'primary' : 'outline-primary'}
          onClick={() => setSubtab('clients')}
        >
          Clients
        </Button>
        <Button
          variant={subtab === 'groups' ? 'primary' : 'outline-primary'}
          onClick={() => setSubtab('groups')}
        >
          Groups
        </Button>
      </ButtonGroup>
      {/* Clients Table */}
      {subtab === 'clients' && (
        <>
          <Table bordered hover responsive size="sm" className="align-middle">
            <thead>
              <tr>
                <th style={{ width: '1%' }}>
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
                  <td colSpan={4} className="text-center">No clients yet.</td>
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
                    <td>{c.name || c.display_name || c.client_id || c.userid}</td>
                    <td>{c.broker || ''}</td>
                    <td>{statusBadge(c)}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </>
      )}
      {/* Groups Table */}
      {subtab === 'groups' && (
        <>
          <Table bordered hover responsive size="sm" className="align-middle">
            <thead>
              <tr>
                <th style={{ width: '1%' }}>
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
                  <td colSpan={4} className="text-center">No groups yet.</td>
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
                        .map((m) => `${(m.broker || '').toUpperCase()}:${m.client_id || m.userid}`)
                        .join(', ')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </>
      )}
      {/* Add/Edit Client Modal */}
      <Modal show={showModal} onHide={() => { setShowModal(false); pollingAbortRef.current = true; }}>
        <Form onSubmit={onSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>{editMode ? 'Edit Client' : 'Add Client'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Broker</Form.Label>
              <Form.Select
                value={broker}
                disabled={editMode}
                onChange={(e) => {
                  setBroker(e.target.value);
                  setAddForm({ name: '', client_id: '', mobile: '', pin: '', apikey: '', api_secret: '', totpkey: '', capital: '' });
                }}
              >
                <option value="dhan">Dhan</option>
                {/* Motilal is now enabled */}
                <option value="motilal">Motilal</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Name</Form.Label>
              <Form.Control
                value={addForm.name}
                onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Client ID *</Form.Label>
              <Form.Control
                required
                disabled={editMode}
                value={addForm.client_id}
                onChange={(e) => setAddForm((p) => ({ ...p, client_id: e.target.value.trim() }))}
              />
            </Form.Group>
            {/* Show Dhan fields or Motilal fields (identical layout) */}
            {(broker === 'dhan' || broker === 'motilal') && (
              <>
                <Form.Group className="mb-2">
                  <Form.Label>Mobile Number *</Form.Label>
                  <Form.Control
                    required={broker === 'dhan'}
                    value={addForm.mobile}
                    onChange={(e) => setAddForm((p) => ({ ...p, mobile: e.target.value.trim() }))}
                    placeholder={broker === 'dhan' ? 'Registered Mobile' : 'Motilal API Key (unused)'}
                  />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>{broker === 'dhan' ? 'PIN *' : 'Password *'}</Form.Label>
                  <Form.Control
                    type="password"
                    required
                    value={addForm.pin}
                    onChange={(e) => setAddForm((p) => ({ ...p, pin: e.target.value.trim() }))}
                    placeholder={broker === 'dhan' ? 'Trading PIN' : 'Motilal Password'}
                  />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>{broker === 'dhan' ? 'API Key *' : 'API Key *'}</Form.Label>
                  <Form.Control
                    required
                    value={addForm.apikey}
                    onChange={(e) => setAddForm((p) => ({ ...p, apikey: e.target.value.trim() }))}
                    placeholder={broker === 'dhan' ? 'Dhan API Key' : 'Motilal API Key'}
                  />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>{broker === 'dhan' ? 'API Secret *' : 'PAN *'}</Form.Label>
                  <Form.Control
                    type="password"
                    required
                    value={addForm.api_secret}
                    onChange={(e) => setAddForm((p) => ({ ...p, api_secret: e.target.value.trim() }))}
                    placeholder={broker === 'dhan' ? 'API Secret' : 'Motilal PAN'}
                  />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>TOTP Key {broker === 'dhan' ? '*' : '(optional)'}</Form.Label>
                  <Form.Control
                    type="password"
                    required={broker === 'dhan'}
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
            <Button
              variant="secondary"
              onClick={() => {
                setShowModal(false);
                pollingAbortRef.current = true;
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {editMode ? 'Save & Login' : 'Save & Login'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
      {/* Group Modal */}
      <Modal show={showGroupModal} onHide={() => setShowGroupModal(false)} size="lg">
        <Form onSubmit={onSubmitGroup}>
          <Modal.Header closeButton>
            <Modal.Title>{editGroupMode ? 'Edit Group' : 'Create Group'}</Modal.Title>
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
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {clients.map((c) => {
                  const k = keyOf(c);
                  return (
                    <Form.Check
                      key={k}
                      type="checkbox"
                      label={`${(c.broker || '').toUpperCase()}:${c.client_id || c.userid}`}
                      checked={groupForm.members[k] || false}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setGroupForm((prev) => {
                          const next = { ...prev };
                          next.members = { ...next.members, [k]: checked };
                          return next;
                        });
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
              {editGroupMode ? 'Save Group' : 'Create Group'}
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
              <Form.Select
                value={copyForm.master}
                onChange={(e) => setCopyForm((p) => ({ ...p, master: e.target.value }))}
              >
                <option value="">Select Master</option>
                {clients.map((c) => {
                  const k = keyOf(c);
                  return (
                    <option key={k} value={c.client_id || c.userid}>
                      {(c.broker || '').toUpperCase()}:{c.client_id || c.userid}
                    </option>
                  );
                })}
              </Form.Select>
            </Form.Group>
            <div className="mb-3">
              <Form.Label>Child Accounts</Form.Label>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {clients.map((c) => {
                  const k = keyOf(c);
                  const row = copyForm.rows[k] || { selected: false, mult: '1' };
                  return (
                    <div key={k} className="d-flex align-items-center mb-1" style={{ gap: '5px' }}>
                      <Form.Check
                        type="checkbox"
                        checked={row.selected}
                        onChange={(e) => {
                          const selected = e.target.checked;
                          setCopyForm((prev) => {
                            const next = { ...prev };
                            next.rows = { ...next.rows, [k]: { ...row, selected } };
                            return next;
                          });
                        }}
                      />
                      <span style={{ flex: 1 }}>
                        {(c.broker || '').toUpperCase()}:{c.client_id || c.userid}
                      </span>
                      <Form.Control
                        style={{ width: '80px' }}
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={row.mult}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCopyForm((prev) => {
                            const next = { ...prev };
                            next.rows = { ...next.rows, [k]: { ...row, mult: val } };
                            return next;
                          });
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
