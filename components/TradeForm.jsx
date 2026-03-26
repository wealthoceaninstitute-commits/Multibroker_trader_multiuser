'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button, Col, Form, Row, Alert, Card, Spinner,
} from 'react-bootstrap';
import AsyncSelect from 'react-select/async';
import api from './api';
import { getUserid } from '../src/lib/auth';

// helpers
const onlyDigits = (v) => (v ?? '').replace(/[^\d]/g, '');
const toIntOr = (v, fb = 0) => {
  const n = parseInt(String(v ?? '').trim(), 10);
  return Number.isFinite(n) ? n : fb;
};

const todayInputDate = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatGoodTillDate = (yyyyMmDd) => {
  if (!yyyyMmDd) return '';
  const [yyyy, mm, dd] = yyyyMmDd.split('-');
  if (!yyyy || !mm || !dd) return '';
  return `${dd}/${mm}/${yyyy}`;
};

const TRADE_FORM_STORAGE_KEY = 'woi-trade-form-v1';

const detectUserId = () => {
  if (typeof window === 'undefined') return '';

  const a = window.localStorage.getItem('mb_logged_in_userid_v1') || '';
  const c = window.localStorage.getItem('mb_logged_in_userid') || '';
  if (a) return String(a).replace(/(^"|"$)/g, '');
  if (c) return String(c).replace(/(^"|"$)/g, '');

  const raw = window.localStorage.getItem('mb_user') || '';
  if (!raw) return '';

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'string') return parsed;
    return parsed?.userid || parsed?.userId || '';
  } catch {
    return raw.replace(/(^"|"$)/g, '');
  }
};

const normalizeClient = (c) => ({
  client_id: c.client_id ?? c.userid ?? c.user_id ?? c.id ?? '',
  name: c.name ?? c.display_name ?? c.client_name ?? c.client_id ?? '',
  broker: c.broker ?? '',
  ...c,
});

const normalizeGroup = (g) => ({
  group_name: g.group_name ?? g.name ?? '',
  no_of_clients: g.no_of_clients ?? (Array.isArray(g.clients) ? g.clients.length : 0) ?? 0,
  multiplier: g.multiplier ?? 1,
  ...g,
});

const loadSavedForm = () => {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(TRADE_FORM_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const extractBrokerResultSummary = (data) => {
  if (!data) return { ok: false, message: 'No response from server.' };

  const rows = Array.isArray(data.results)
    ? data.results
    : Array.isArray(data.message)
      ? data.message.map((x) => ({ message: x }))
      : null;

  if (rows && rows.length) {
    const normalized = rows.map((r, i) => {
      const ok =
        r.success === true ||
        r.ok === true ||
        String(r.status || '').toUpperCase() === 'SUCCESS' ||
        String(r.result || '').toUpperCase() === 'SUCCESS';

      const cid = r.client_id || r.clientid || r.userid || r.userid || r.name || `#${i + 1}`;
      const msg =
        r.message ||
        r.detail ||
        r.error ||
        r.status ||
        r.result ||
        (ok ? 'Success' : 'Failed');

      return {
        ok,
        line: `${ok ? '✅' : '❌'} ${cid}: ${msg}`,
      };
    });

    const successCount = normalized.filter((x) => x.ok).length;
    const failCount = normalized.length - successCount;

    let header = '';
    if (successCount === 0) {
      header = `${failCount} order${failCount > 1 ? 's' : ''} failed`;
    } else if (failCount === 0) {
      header = `${successCount} order${successCount > 1 ? 's' : ''} placed successfully`;
    } else {
      header = `${successCount} order${successCount > 1 ? 's' : ''} placed successfully, ${failCount} order${failCount > 1 ? 's' : ''} failed`;
    }

    return {
      ok: failCount === 0,
      message: `${header}\n\nClient-wise status:\n${normalized.map((x) => x.line).join('\n')}`,
    };
  }

  return {
    ok: false,
    message: data.message || data.error || 'Unexpected response from server.',
  };
};

export default function TradeForm() {
  const saved = loadSavedForm();

  const [action, setAction] = useState(saved?.action ?? 'buy');
  const [productType, setProductType] = useState(saved?.productType ?? 'DELIVERY');
  const [orderType, setOrderType] = useState(saved?.orderType ?? 'LIMIT');
  const [qtySelection, setQtySelection] = useState(saved?.qtySelection ?? 'manual');
  const [groupAcc, setGroupAcc] = useState(saved?.groupAcc ?? false);
  const [diffQty, setDiffQty] = useState(saved?.diffQty ?? false);
  const [multiplier, setMultiplier] = useState(saved?.multiplier ?? false);

  const [qty, setQty] = useState(saved?.qty ?? '1');
  const [exchange, setExchange] = useState(saved?.exchange ?? 'nse');
  const [symbol, setSymbol] = useState(saved?.symbol ?? null);
  const [price, setPrice] = useState(saved?.price ?? 0);
  const [trigPrice, setTrigPrice] = useState(saved?.trigPrice ?? 0);
  const [disclosedQty, setDisclosedQty] = useState(saved?.disclosedQty ?? 0);

  const [timeForce, setTimeForce] = useState(saved?.timeForce ?? 'DAY');
  const [goodTillDate, setGoodTillDate] = useState(saved?.goodTillDate ?? todayInputDate());
  const [amo, setAmo] = useState(saved?.amo ?? false);

  const [clients, setClients] = useState([]);
  const [selectedClients, setSelectedClients] = useState(saved?.selectedClients ?? []);

  const [groups, setGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState(saved?.selectedGroups ?? []);

  const [perClientQty, setPerClientQty] = useState(saved?.perClientQty ?? {});
  const [perGroupQty, setPerGroupQty] = useState(saved?.perGroupQty ?? {});

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [loadingLists, setLoadingLists] = useState(false);

  const _settingsApplied = useRef(false);

  useEffect(() => {
    if (_settingsApplied.current) return;
    const uid = getUserid?.() || detectUserId();
    if (!uid) return;

    api.get('/user_settings', { params: { userid: uid } })
      .then((res) => {
        const d = res?.data;
        if (!d?.success || !d?.trade_defaults) return;

        const td = d.trade_defaults;
        _settingsApplied.current = true;

        if (td.action) setAction(String(td.action).toLowerCase());
        if (td.product_type) setProductType(String(td.product_type).toUpperCase());
        if (td.order_type) setOrderType(String(td.order_type).toUpperCase());
        if (td.order_duration) setTimeForce(String(td.order_duration).toUpperCase());
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const uid = getUserid?.() || detectUserId();
    if (!uid) return;

    setLoadingLists(true);

    const headers = {
      'x-user-id': uid,
    };

    const tryClients = async () => {
      const attempts = [
        () => api.get('/clients', { headers, params: { userid: uid } }),
        () => api.get('/clients', { headers, params: { user_id: uid } }),
        () => api.get('/get_clients', { headers, params: { userid: uid } }),
        () => api.get('/get_clients', { headers, params: { user_id: uid } }),
      ];

      for (const fn of attempts) {
        try {
          const res = await fn();
          const list = res?.data?.clients || res?.data?.data || res?.data || [];
          if (Array.isArray(list)) return list.map(normalizeClient).filter((x) => x.client_id);
        } catch {
          // try next
        }
      }
      return [];
    };

    const tryGroups = async () => {
      const attempts = [
        () => api.get('/groups', { headers, params: { userid: uid } }),
        () => api.get('/groups', { headers, params: { user_id: uid } }),
      ];

      for (const fn of attempts) {
        try {
          const res = await fn();
          const list = res?.data?.groups || res?.data?.data || res?.data || [];
          if (Array.isArray(list)) return list.map(normalizeGroup).filter((x) => x.group_name);
        } catch {
          // try next
        }
      }
      return [];
    };

    Promise.all([tryClients(), tryGroups()])
      .then(([clientRows, groupRows]) => {
        setClients(clientRows);
        setGroups(groupRows);
      })
      .finally(() => setLoadingLists(false));
  }, []);

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(
        TRADE_FORM_STORAGE_KEY,
        JSON.stringify({
          action,
          productType,
          orderType,
          qtySelection,
          groupAcc,
          diffQty,
          multiplier,
          qty,
          exchange,
          symbol,
          price,
          trigPrice,
          disclosedQty,
          timeForce,
          goodTillDate,
          amo,
          selectedClients,
          selectedGroups,
          perClientQty,
          perGroupQty,
        })
      );
    } catch {
      // ignore storage errors
    }
  }, [
    action,
    productType,
    orderType,
    qtySelection,
    groupAcc,
    diffQty,
    multiplier,
    qty,
    exchange,
    symbol,
    price,
    trigPrice,
    disclosedQty,
    timeForce,
    goodTillDate,
    amo,
    selectedClients,
    selectedGroups,
    perClientQty,
    perGroupQty,
  ]);

  useEffect(() => {
    if (!clients.length) return;
    setSelectedClients((prev) =>
      (prev || []).filter((cid) => clients.some((c) => c.client_id === cid))
    );
    setPerClientQty((prev) => {
      const validIds = new Set(clients.map((c) => c.client_id));
      return Object.fromEntries(
        Object.entries(prev || {}).filter(([cid]) => validIds.has(cid))
      );
    });
  }, [clients]);

  useEffect(() => {
    if (!groups.length) return;
    setSelectedGroups((prev) =>
      (prev || []).filter((gn) => groups.some((g) => g.group_name === gn))
    );
    setPerGroupQty((prev) => {
      const validNames = new Set(groups.map((g) => g.group_name));
      return Object.fromEntries(
        Object.entries(prev || {}).filter(([gn]) => validNames.has(gn))
      );
    });
  }, [groups]);

  const loadSymbolOptions = async (inputValue) => {
    if (!inputValue || inputValue.length < 1) return [];
    const res = await api.get('/search_symbols', { params: { q: inputValue, exchange } });
    const results = res?.data?.results || [];
    return results.map((r) => ({
      value: r.id ?? r.value ?? r.symbol ?? r.text,
      label: r.text ?? r.label ?? String(r.id),
    }));
  };

  const isStopOrder = orderType === 'STOPLOSS' || orderType === 'SL-M';

  const selectedClientMap = useMemo(
    () => new Map((clients || []).map((c) => [c.client_id, c])),
    [clients]
  );

  const submit = async (e) => {
    e.preventDefault();

    if (groupAcc) {
      if (selectedGroups.length === 0) {
        setToast({ variant: 'warning', text: 'Please select at least one group.' });
        return;
      }
    } else if (selectedClients.length === 0) {
      setToast({ variant: 'warning', text: 'Please select at least one client.' });
      return;
    }

    if (!symbol || !symbol.value) {
      setToast({ variant: 'warning', text: 'Please select a symbol before placing the order.' });
      return;
    }

    if (timeForce === 'GTD') {
      if (!goodTillDate) {
        setToast({ variant: 'warning', text: 'Please select Good Till Date.' });
        return;
      }
      const today = todayInputDate();
      if (goodTillDate < today) {
        setToast({ variant: 'warning', text: 'Good Till Date cannot be earlier than today.' });
        return;
      }
    }

    const safeSingleQty = qtySelection === 'auto' ? 0 : toIntOr(qty, 1);

    const safePerClientQty = (!groupAcc && diffQty)
      ? Object.fromEntries(selectedClients.map((cid) => [cid, toIntOr(perClientQty[cid], 1)]))
      : {};

    const safePerGroupQty = (groupAcc && diffQty)
      ? Object.fromEntries(selectedGroups.map((gn) => [gn, toIntOr(perGroupQty[gn], 1)]))
      : {};

    setBusy(true);
    try {
      const payload = {
        groupacc: groupAcc,
        groups: selectedGroups,
        clients: selectedClients,
        action: action?.toUpperCase(),
        ordertype: orderType?.toUpperCase(),
        producttype: productType?.toUpperCase(),
        orderduration: timeForce?.toUpperCase(),
        exchange: exchange?.toUpperCase(),
        symbol: symbol?.value || '',
        price: Number(price) || 0,
        triggerprice: Number(trigPrice) || 0,
        disclosedquantity: Number(disclosedQty) || 0,
        amoorder: amo ? 'Y' : 'N',
        goodtilldate: timeForce === 'GTD' ? formatGoodTillDate(goodTillDate) : '',
        qtySelection,
        quantityinlot: safeSingleQty,
        perClientQty: safePerClientQty,
        perGroupQty: safePerGroupQty,
        diffQty,
        multiplier,
      };

      const resp = await api.post('/place_order', payload);
      const summary = extractBrokerResultSummary(resp?.data);

      setToast({
        variant: summary.ok ? 'success' : 'danger',
        text: summary.message,
      });
    } catch (err) {
      const backendMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Unknown error';

      setToast({
        variant: 'danger',
        text: 'Error: ' + backendMsg,
      });
    } finally {
      setBusy(false);
    }
  };

  const resetForm = () => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(TRADE_FORM_STORAGE_KEY);
      }
    } catch {
      // ignore
    }

    setAction('buy');
    setProductType('DELIVERY');
    setOrderType('LIMIT');
    setQtySelection('manual');
    setGroupAcc(false);
    setDiffQty(false);
    setMultiplier(false);
    setQty('1');
    setExchange('nse');
    setSymbol(null);
    setPrice(0);
    setTrigPrice(0);
    setDisclosedQty(0);
    setTimeForce('DAY');
    setGoodTillDate(todayInputDate());
    setAmo(false);
    setSelectedClients([]);
    setSelectedGroups([]);
    setPerClientQty({});
    setPerGroupQty({});
    setToast(null);
  };

  return (
    <Card className="shadow-sm border-0">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="fw-bold fs-5">Trade Form</div>
          <div className="d-flex gap-2">
            <Button variant="outline-secondary" size="sm" onClick={resetForm}>
              Reset
            </Button>
          </div>
        </div>

        {toast && (
          <Alert
            variant={toast.variant}
            onClose={() => setToast(null)}
            dismissible
            style={{ whiteSpace: 'pre-wrap' }}
          >
            {toast.text}
          </Alert>
        )}

        {loadingLists && (
          <div className="mb-3 text-muted d-flex align-items-center gap-2">
            <Spinner animation="border" size="sm" />
            Loading clients and groups...
          </div>
        )}

        <Form onSubmit={submit}>
          <div className="formSection mb-3">
            <Row className="g-3">
              <Col md={4}>
                <Form.Label className="mb-0 fw-semibold">Action</Form.Label>
                <div>
                  {['buy', 'sell'].map((a) => (
                    <Form.Check
                      key={a}
                      inline
                      type="radio"
                      name="action"
                      label={a.toUpperCase()}
                      checked={action === a}
                      onChange={() => setAction(a)}
                    />
                  ))}
                </div>
              </Col>

              <Col md={4}>
                <Form.Label className="mb-0 fw-semibold">Product Type</Form.Label>
                <div>
                  {['DELIVERY', 'NORMAL', 'BTST', 'MTF'].map((pt) => (
                    <Form.Check
                      key={pt}
                      inline
                      type="radio"
                      name="productType"
                      label={pt}
                      checked={productType === pt}
                      onChange={() => setProductType(pt)}
                    />
                  ))}
                </div>
              </Col>

              <Col md={4}>
                <Form.Label className="mb-0 fw-semibold">Order Type</Form.Label>
                <div>
                  {['LIMIT', 'MARKET', 'STOPLOSS', 'SL-M'].map((ot) => (
                    <Form.Check
                      key={ot}
                      inline
                      type="radio"
                      name="orderType"
                      label={ot}
                      checked={orderType === ot}
                      onChange={() => setOrderType(ot)}
                    />
                  ))}
                </div>
              </Col>
            </Row>
          </div>

          <div className="formSection mb-3">
            <Row>
              <Col xs={12}>
                {!groupAcc ? (
                  <>
                    <Form.Label className="label-tight">Select Clients</Form.Label>
                    <Form.Select
                      multiple
                      size={8}
                      value={selectedClients}
                      onChange={(e) =>
                        setSelectedClients(Array.from(e.target.selectedOptions).map((o) => o.value))
                      }
                    >
                      {(clients || []).map((c) => (
                        <option key={c.client_id} value={c.client_id}>
                          {c.name} : {c.client_id}
                        </option>
                      ))}
                    </Form.Select>

                    {diffQty && (
                      <div className="mt-2">
                        <Form.Label className="fw-semibold small text-primary">
                          Enter Quantity per Client
                        </Form.Label>
                        {selectedClients.length === 0 ? (
                          <div className="text-muted small">Select clients to assign quantities.</div>
                        ) : (
                          selectedClients.map((cid) => {
                            const client = selectedClientMap.get(cid);
                            return (
                              <Row key={cid} className="align-items-center mb-1">
                                <Col xs={6}>
                                  <div className="text-muted small">{client?.name || cid}</div>
                                </Col>
                                <Col xs={6}>
                                  <Form.Control
                                    type="number"
                                    min="1"
                                    value={perClientQty[cid] || ''}
                                    onChange={(e) =>
                                      setPerClientQty((prev) => ({ ...prev, [cid]: e.target.value }))
                                    }
                                    placeholder="Qty"
                                  />
                                </Col>
                              </Row>
                            );
                          })
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <Form.Label className="label-tight">Select Groups</Form.Label>
                    <div className="border rounded p-2">
                      {groups.length === 0 ? (
                        <div className="text-muted">No groups found.</div>
                      ) : (
                        groups.map((g) => (
                          <Form.Check
                            key={g.group_name}
                            type="checkbox"
                            id={`group_${g.group_name}`}
                            label={`${g.group_name} (${g.no_of_clients} clients, x${g.multiplier})`}
                            checked={selectedGroups.includes(g.group_name)}
                            onChange={(e) => {
                              const chk = e.target.checked;
                              setSelectedGroups((prev) =>
                                chk ? [...prev, g.group_name] : prev.filter((x) => x !== g.group_name)
                              );
                            }}
                          />
                        ))
                      )}
                    </div>

                    {diffQty && (
                      <div className="mt-2">
                        <Form.Label className="fw-semibold small text-primary">
                          Enter Quantity per Group
                        </Form.Label>
                        {selectedGroups.length === 0 ? (
                          <div className="text-muted small">Select groups to assign quantities.</div>
                        ) : (
                          selectedGroups.map((gn) => (
                            <Row key={gn} className="align-items-center mb-1">
                              <Col xs={6}>
                                <div className="text-muted small">{gn}</div>
                              </Col>
                              <Col xs={6}>
                                <Form.Control
                                  type="number"
                                  min="1"
                                  value={perGroupQty[gn] || ''}
                                  onChange={(e) =>
                                    setPerGroupQty((prev) => ({ ...prev, [gn]: e.target.value }))
                                  }
                                  placeholder="Qty"
                                />
                              </Col>
                            </Row>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
              </Col>
            </Row>
          </div>

          <div className="formSection mb-3">
            <Row className="g-2 mb-2 align-items-end">
              <Col md={5}>
                <Form.Label className="label-tight">Qty</Form.Label>
                <Form.Control
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  disabled={qtySelection === 'auto' || diffQty}
                  value={qty}
                  onChange={(e) => setQty(onlyDigits(e.target.value))}
                  onBlur={() => setQty(String(Math.max(1, parseInt(qty || '1', 10) || 1)))}
                />
                {diffQty && (
                  <div className="form-text">Disabled because “Diff. Qty.” is ON.</div>
                )}
              </Col>

              <Col md={7}>
                <div className="d-flex align-items-center flex-wrap gap-3 mb-1">
                  <Form.Label className="mb-0 fw-semibold">Entity</Form.Label>
                  <Form.Check
                    inline
                    type="checkbox"
                    id="groupAcc"
                    label="Group Acc"
                    checked={groupAcc}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setGroupAcc(checked);
                      setSelectedGroups([]);
                      setSelectedClients([]);
                      setPerGroupQty({});
                      setPerClientQty({});
                    }}
                  />
                  <Form.Check
                    inline
                    type="checkbox"
                    id="diffQty"
                    label="Diff. Qty."
                    checked={diffQty}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setDiffQty(checked);
                      if (!checked) {
                        setPerGroupQty({});
                        setPerClientQty({});
                      }
                    }}
                  />
                  <Form.Check
                    inline
                    type="checkbox"
                    id="multiplier"
                    label="Multiplier"
                    checked={multiplier}
                    onChange={(e) => setMultiplier(e.target.checked)}
                  />
                </div>

                <div className="d-flex align-items-center flex-wrap gap-3">
                  <Form.Label className="mb-0 fw-semibold">Qty Mode</Form.Label>
                  <Form.Check
                    inline
                    type="radio"
                    name="qtySelection"
                    label="Manual"
                    checked={qtySelection === 'manual'}
                    onChange={() => setQtySelection('manual')}
                  />
                  <Form.Check
                    inline
                    type="radio"
                    name="qtySelection"
                    label="Auto"
                    checked={qtySelection === 'auto'}
                    onChange={() => setQtySelection('auto')}
                  />
                </div>
              </Col>
            </Row>

            <Row className="g-2 mb-2">
              <Col md={4}>
                <Form.Label className="label-tight">Exchange</Form.Label>
                <Form.Select value={exchange} onChange={(e) => setExchange(e.target.value)}>
                  <option value="nse">NSE</option>
                  <option value="bse">BSE</option>
                  <option value="nfo">NFO</option>
                  <option value="mcx">MCX</option>
                </Form.Select>
              </Col>

              <Col md={8}>
                <Form.Label className="label-tight">Symbol</Form.Label>
                <AsyncSelect
                  cacheOptions
                  defaultOptions
                  value={symbol}
                  loadOptions={loadSymbolOptions}
                  onChange={setSymbol}
                  placeholder="Search symbol..."
                />
              </Col>
            </Row>

            <Row className="g-2 mb-2">
              <Col md={4}>
                <Form.Label className="label-tight">Price</Form.Label>
                <Form.Control
                  type="number"
                  step="any"
                  value={price}
                  disabled={orderType === 'MARKET' || orderType === 'SL-M'}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </Col>

              <Col md={4}>
                <Form.Label className="label-tight">Trigger Price</Form.Label>
                <Form.Control
                  type="number"
                  step="any"
                  value={trigPrice}
                  disabled={!isStopOrder}
                  onChange={(e) => setTrigPrice(e.target.value)}
                />
              </Col>

              <Col md={4}>
                <Form.Label className="label-tight">Disclosed Qty</Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  value={disclosedQty}
                  onChange={(e) => setDisclosedQty(e.target.value)}
                />
              </Col>
            </Row>

            <Row className="g-2 mb-2">
              <Col md={8}>
                <Form.Label className="mb-0 fw-semibold">Order Duration</Form.Label>
                <div className="mt-1">
                  {['DAY', 'IOC', 'GTC', 'GTD'].map((tf) => (
                    <Form.Check
                      key={tf}
                      inline
                      type="radio"
                      name="timeForce"
                      label={tf}
                      checked={timeForce === tf}
                      onChange={() => setTimeForce(tf)}
                    />
                  ))}
                </div>
              </Col>

              <Col md={4}>
                <Form.Label className="mb-0 fw-semibold">AMO</Form.Label>
                <div className="mt-1">
                  <Form.Check
                    inline
                    type="checkbox"
                    id="amoorder"
                    label="Enable AMO"
                    checked={amo}
                    onChange={(e) => setAmo(e.target.checked)}
                  />
                </div>
              </Col>
            </Row>

            {timeForce === 'GTD' && (
              <Row className="g-2 mb-2">
                <Col md={4}>
                  <Form.Label className="label-tight">Good Till Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={goodTillDate}
                    min={todayInputDate()}
                    onChange={(e) => setGoodTillDate(e.target.value)}
                  />
                </Col>
              </Row>
            )}
          </div>

          <div className="d-flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? 'Placing...' : 'Place Order'}
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
}
