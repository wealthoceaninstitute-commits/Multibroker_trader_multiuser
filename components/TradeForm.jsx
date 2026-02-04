"use client";

import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Container, Row, Col, Form, Button, Card, Alert, Table
} from 'react-bootstrap';
import api from './api';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:5001';

// --- Logged-in user detection (from navbar "Welcome, <user>") ---
const detectUserFromWelcomeText = () => {
  if (typeof window === 'undefined') return '';
  try {
    const txt = document.body?.innerText || '';
    const m = txt.match(/Welcome,\s*([^\s]+)/i);
    if (m && m[1]) return String(m[1]).trim();
  } catch {}
  return '';
};

const safeJson = async (r) => {
  try { return await r.json(); } catch { return null; }
};

const toIntOr = (v, fallback = 0) => {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
};

export default function TradeForm() {
  const [action, setAction] = useState('BUY');
  const [productType, setProductType] = useState('INTRADAY');
  const [orderType, setOrderType] = useState('LIMIT');
  const [orderDuration, setOrderDuration] = useState('DAY');
  const [exchange, setExchange] = useState('NSE');
  const [symbol, setSymbol] = useState('');
  const [symbolInput, setSymbolInput] = useState('');
  const [price, setPrice] = useState('');
  const [triggerPrice, setTriggerPrice] = useState('');
  const [disclosedQty, setDisclosedQty] = useState('');

  const [qtyMode, setQtyMode] = useState('manual'); // 'manual' | 'auto'
  const [qty, setQty] = useState('1');

  const [groupAcc, setGroupAcc] = useState(false);
  const [diffQty, setDiffQty] = useState(false);
  const [multiplierEnabled, setMultiplierEnabled] = useState(false);

  const [clients, setClients] = useState([]);
  const [groups, setGroups] = useState([]);

  const [selectedClients, setSelectedClients] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);

  const [perClientQty, setPerClientQty] = useState({});
  const [perGroupQty, setPerGroupQty] = useState({});

  const [busy, setBusy] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const [sessionUser, setSessionUser] = useState('');

  // ---------- initial data (user-scoped) ----------
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const apply = () => {
      const u = detectUserFromWelcomeText();
      if (u) setSessionUser(u);
    };

    apply();

    const obs = new MutationObserver(() => apply());
    try { obs.observe(document.body, { childList: true, subtree: true, characterData: true }); } catch {}

    // fallback polling for a few seconds (hydration timing)
    let tries = 0;
    const t = setInterval(() => {
      tries += 1;
      apply();
      if (tries >= 16) clearInterval(t);
    }, 500);

    return () => { obs.disconnect(); clearInterval(t); };
  }, []);

  const getUid = () => (detectUserFromWelcomeText() || sessionUser || '').trim();

  const normalizeClients = (arr) => {
    const list = Array.isArray(arr) ? arr : [];
    return list.map((c) => {
      const broker = String(c.broker || '').toLowerCase();
      const userid = c.userid || c.client_id || '';
      const name = c.name || c.display_name || userid;
      return { ...c, broker, userid, client_id: userid, name, _key: `${broker}::${userid}` };
    });
  };

  const normalizeGroups = (arr) => {
    const list = Array.isArray(arr) ? arr : [];
    return list.map((g) => ({
      group_name: g.name || g.group_name || g.id,
      no_of_clients: (g.members || g.clients || []).length,
      multiplier: Number(g.multiplier ?? 1),
      client_names: (g.members || g.clients || []).map((m) => m.name || m.userid || m.client_id || m),
      _raw: g,
    }));
  };

  const loadClientsForUser = async () => {
    const uid = getUid();
    if (!uid) { setClients([]); return; }
    try {
      const r = await fetch(`${API_BASE}/clients?user_id=${encodeURIComponent(uid)}`, {
        cache: 'no-store',
        headers: { 'x-user-id': uid },
      });
      const j = await safeJson(r);
      const list = Array.isArray(j) ? j : j?.clients || [];
      setClients(normalizeClients(list));
    } catch {
      setClients([]);
    }
  };

  const loadGroupsForUser = async () => {
    const uid = getUid();
    try {
      const r = await fetch(`${API_BASE}/groups`, {
        cache: 'no-store',
        headers: uid ? { 'x-user-id': uid } : undefined,
      });
      const j = await safeJson(r);
      const list = Array.isArray(j) ? j : j?.groups || [];
      setGroups(normalizeGroups(list));
    } catch {
      setGroups([]);
    }
  };

  useEffect(() => {
    loadClientsForUser();
    loadGroupsForUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUser]);

  // Keep per-client qty inputs in sync when selection changes
  useEffect(() => {
    const next = { ...perClientQty };
    (selectedClients || []).forEach((cid) => {
      if (next[cid] == null) next[cid] = '1';
    });
    Object.keys(next).forEach((k) => {
      if (!(selectedClients || []).includes(k)) delete next[k];
    });
    setPerClientQty(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClients]);

  // Keep per-group qty inputs in sync when selection changes
  useEffect(() => {
    const next = { ...perGroupQty };
    (selectedGroups || []).forEach((gn) => {
      if (next[gn] == null) next[gn] = '1';
    });
    Object.keys(next).forEach((k) => {
      if (!(selectedGroups || []).includes(k)) delete next[k];
    });
    setPerGroupQty(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroups]);

  const canUseSingleQty = useMemo(() => !diffQty, [diffQty]);

  // Symbol search suggestions
  const [symbolSuggestions, setSymbolSuggestions] = useState([]);
  useEffect(() => {
    let active = true;
    const q = (symbolInput || '').trim();
    if (!q) { setSymbolSuggestions([]); return; }

    const run = async () => {
      try {
        const res = await api.get('/search_symbol', { params: { q, exchange } });
        const arr = res?.data?.symbols || res?.data || [];
        if (active) setSymbolSuggestions(Array.isArray(arr) ? arr : []);
      } catch {
        if (active) setSymbolSuggestions([]);
      }
    };

    const t = setTimeout(run, 250);
    return () => { active = false; clearTimeout(t); };
  }, [symbolInput, exchange]);

  const onSubmit = async (e) => {
    e.preventDefault();

    if (groupAcc && selectedGroups.length === 0) {
      setToastMsg('Select at least one group.');
      setShowToast(true);
      return;
    }
    if (!groupAcc && selectedClients.length === 0) {
      setToastMsg('Select at least one client.');
      setShowToast(true);
      return;
    }
    if (!symbol) {
      setToastMsg('Select a symbol.');
      setShowToast(true);
      return;
    }

    const safeSingleQty = canUseSingleQty ? toIntOr(qty, 1) : 0;

    // Logged-in user (authoritative)
    const uid = getUid();
    if (!uid) {
      setToastMsg('Logged-in user not detected. Please re-login and try again.');
      setShowToast(true);
      return;
    }

    // Convert UI-selected client keys -> {broker, userid}
    const clientItems = (selectedClients || [])
      .map((k) => {
        const s = String(k || '');
        const parts = s.split('::');
        if (parts.length >= 2) return { broker: parts[0], userid: parts.slice(1).join('::') };
        const hit = (clients || []).find((c) => (c.userid || c.client_id) === s);
        return { broker: String(hit?.broker || '').toLowerCase(), userid: s };
      })
      .filter((x) => x && x.broker && x.userid);

    const groupNames = (selectedGroups || []).map(String);

    // qty maps keyed by userid (backend-friendly)
    const safePerClientQty = (!groupAcc && diffQty)
      ? Object.fromEntries(
          clientItems.map((ci) => [
            ci.userid,
            toIntOr(perClientQty[`${ci.broker}::${ci.userid}`] ?? perClientQty[ci.userid], 1)
          ])
        )
      : {};

    const safePerGroupQty = (groupAcc && diffQty)
      ? Object.fromEntries(groupNames.map((gn) => [gn, toIntOr(perGroupQty[gn], 1)]))
      : {};

    setBusy(true);
    try {
      const payload = {
        user_id: uid,

        groupacc: groupAcc,
        groups: groupNames,

        // IMPORTANT: send broker+userid so backend can find the exact file
        clients: clientItems,

        action,
        ordertype: orderType,
        producttype: productType,
        orderduration: orderDuration,
        exchange,
        symbol,
        qty: safeSingleQty,

        price: price === '' ? 0 : Number(price),
        triggerprice: triggerPrice === '' ? 0 : Number(triggerPrice),
        disclosedquantity: disclosedQty === '' ? 0 : Number(disclosedQty),

        amoorder: 'N',
        qtySelection: qtyMode, // 'manual' | 'auto'
        quantity: safeSingleQty,

        perclientqty: safePerClientQty,
        pergroupqty: safePerGroupQty,

        diffQty,
        multiplier: multiplierEnabled,
      };

      const res = await api.post('/place_order', payload, { headers: { 'x-user-id': uid } });

      setToastMsg(`Order placed. Response: ${JSON.stringify(res.data)}`);
      setShowToast(true);
    } catch (err) {
      setToastMsg(`Error placing order: ${err?.response?.data ? JSON.stringify(err.response.data) : err?.message}`);
      setShowToast(true);
    } finally {
      setBusy(false);
    }
  };

  const onReset = () => {
    setAction('BUY');
    setProductType('INTRADAY');
    setOrderType('LIMIT');
    setOrderDuration('DAY');
    setExchange('NSE');
    setSymbol('');
    setSymbolInput('');
    setPrice('');
    setTriggerPrice('');
    setDisclosedQty('');
    setQty('1');
    setQtyMode('manual');
    setGroupAcc(false);
    setDiffQty(false);
    setMultiplierEnabled(false);
    setSelectedClients([]);
    setSelectedGroups([]);
    setPerClientQty({});
    setPerGroupQty({});
  };

  return (
    <Container fluid className="py-3">
      <Card className="p-3">
        <Form onSubmit={onSubmit}>
          <Row className="mb-2">
            <Col md={12}>
              <strong>Action</strong>
              <div className="d-flex gap-3 mt-1">
                <Form.Check
                  inline
                  type="radio"
                  label="BUY"
                  checked={action === 'BUY'}
                  onChange={() => setAction('BUY')}
                />
                <Form.Check
                  inline
                  type="radio"
                  label="SELL"
                  checked={action === 'SELL'}
                  onChange={() => setAction('SELL')}
                />
              </div>
            </Col>
          </Row>

          <hr />

          <Row className="mb-2">
            <Col md={12}>
              <strong>Product</strong>
              <div className="d-flex flex-wrap gap-3 mt-1">
                {['INTRADAY', 'DELIVERY', 'NORMAL', 'SELLFROMDP', 'BTST', 'MTF'].map(p => (
                  <Form.Check
                    key={p}
                    inline
                    type="radio"
                    label={p}
                    checked={productType === p}
                    onChange={() => setProductType(p)}
                  />
                ))}
              </div>
            </Col>
          </Row>

          <hr />

          <Row className="mb-2">
            <Col md={12}>
              <strong>Order Type</strong>
              <div className="d-flex gap-3 mt-1">
                {['LIMIT', 'MARKET', 'STOPLOSS', 'SL_MARKET'].map(o => (
                  <Form.Check
                    key={o}
                    inline
                    type="radio"
                    label={o}
                    checked={orderType === o}
                    onChange={() => setOrderType(o)}
                  />
                ))}
              </div>
            </Col>
          </Row>

          <hr />

          <Row className="mb-3">
            <Col md={12}>
              <strong>Select Clients</strong>
              <Form.Control
                as="select"
                multiple
                value={selectedClients}
                onChange={(e) => {
                  const options = Array.from(e.target.selectedOptions).map(o => o.value);
                  setSelectedClients(options);
                }}
                disabled={groupAcc}
                style={{ height: 120 }}
              >
                {(clients || []).map(c => (
                  <option key={c._key || c.client_id} value={c._key || c.client_id}>
                    {c.name} : {c.userid || c.client_id}
                  </option>
                ))}
              </Form.Control>
              {groupAcc && <Form.Text muted>Client selection disabled when Group Acc is enabled.</Form.Text>}
            </Col>
          </Row>

          <Row className="mb-3">
            <Col md={4}>
              <strong>Qty</strong>
              <Form.Control
                type="number"
                value={qty}
                min="1"
                onChange={(e) => setQty(e.target.value)}
                disabled={!canUseSingleQty}
              />
            </Col>

            <Col md={8}>
              <div className="d-flex align-items-center flex-wrap gap-4 mt-4">
                <div>
                  <strong>Entity</strong>
                  <div className="d-flex gap-3">
                    <Form.Check
                      type="checkbox"
                      label="Group Acc"
                      checked={groupAcc}
                      onChange={(e) => {
                        const v = e.target.checked;
                        setGroupAcc(v);
                        if (v) setSelectedClients([]);
                      }}
                    />
                    <Form.Check
                      type="checkbox"
                      label="Diff. Qty."
                      checked={diffQty}
                      onChange={(e) => setDiffQty(e.target.checked)}
                    />
                    <Form.Check
                      type="checkbox"
                      label="Multiplier"
                      checked={multiplierEnabled}
                      onChange={(e) => setMultiplierEnabled(e.target.checked)}
                    />
                  </div>
                </div>

                <div>
                  <strong>Qty Mode</strong>
                  <div className="d-flex gap-3">
                    <Form.Check
                      inline
                      type="radio"
                      label="Manual"
                      checked={qtyMode === 'manual'}
                      onChange={() => setQtyMode('manual')}
                    />
                    <Form.Check
                      inline
                      type="radio"
                      label="Auto Calculate"
                      checked={qtyMode === 'auto'}
                      onChange={() => setQtyMode('auto')}
                    />
                  </div>
                </div>
              </div>
            </Col>
          </Row>

          {diffQty && !groupAcc && selectedClients.length > 0 && (
            <Row className="mb-3">
              <Col md={12}>
                <strong>Per Client Qty</strong>
                <Table bordered size="sm" className="mt-2">
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th style={{ width: 180 }}>Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedClients.map((cid) => (
                      <tr key={cid}>
                        <td>{cid}</td>
                        <td>
                          <Form.Control
                            type="number"
                            min="1"
                            value={perClientQty[cid] ?? '1'}
                            onChange={(e) =>
                              setPerClientQty((p) => ({ ...p, [cid]: e.target.value }))
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Col>
            </Row>
          )}

          <Row className="mb-3">
            <Col md={4}>
              <strong>Exchange</strong>
              <Form.Select value={exchange} onChange={(e) => setExchange(e.target.value)}>
                <option value="NSE">NSE</option>
                <option value="BSE">BSE</option>
                <option value="NFO">NFO</option>
                <option value="MCX">MCX</option>
              </Form.Select>
            </Col>

            <Col md={8}>
              <strong>Symbol</strong>
              <Form.Control
                value={symbolInput}
                onChange={(e) => setSymbolInput(e.target.value)}
                placeholder="Type to search symbol..."
                list="symbol-suggestions"
              />
              <datalist id="symbol-suggestions">
                {(symbolSuggestions || []).map((s, idx) => (
                  <option
                    key={`${s.symbol || s}-${idx}`}
                    value={s.symbol || s}
                    onClick={() => setSymbol(s.symbol || s)}
                  />
                ))}
              </datalist>
              <div className="mt-1">
                <Form.Text muted>Selected: {symbol || '-'}</Form.Text>
              </div>
              <Button
                size="sm"
                className="mt-2"
                variant="outline-secondary"
                onClick={() => setSymbol(symbolInput)}
              >
                Use "{symbolInput}"
              </Button>
            </Col>
          </Row>

          <Row className="mb-3">
            <Col md={4}>
              <strong>Price</strong>
              <Form.Control value={price} onChange={(e) => setPrice(e.target.value)} />
            </Col>
            <Col md={4}>
              <strong>Trig. Price</strong>
              <Form.Control value={triggerPrice} onChange={(e) => setTriggerPrice(e.target.value)} />
            </Col>
            <Col md={4}>
              <strong>Disclosed Qty</strong>
              <Form.Control value={disclosedQty} onChange={(e) => setDisclosedQty(e.target.value)} />
            </Col>
          </Row>

          <Row className="mb-3">
            <Col md={12}>
              <strong>Order Duration</strong>
              <div className="d-flex gap-3 mt-1">
                {['DAY', 'IOC', 'AMO Order'].map(d => (
                  <Form.Check
                    key={d}
                    inline
                    type="radio"
                    label={d}
                    checked={orderDuration === (d === 'AMO Order' ? 'AMO' : d)}
                    onChange={() => setOrderDuration(d === 'AMO Order' ? 'AMO' : d)}
                  />
                ))}
              </div>
            </Col>
          </Row>

          <div className="d-flex gap-2">
            <Button type="submit" variant="success" disabled={busy}>
              {busy ? 'Placing...' : action}
            </Button>
            <Button type="button" variant="secondary" onClick={onReset} disabled={busy}>
              Reset
            </Button>
          </div>
        </Form>

        {showToast && (
          <Alert variant="success" className="mt-3 d-flex justify-content-between align-items-center">
            <div>{toastMsg}</div>
            <Button variant="outline-secondary" size="sm" onClick={() => setShowToast(false)}>
              ✕
            </Button>
          </Alert>
        )}
      </Card>
    </Container>
  );
}
