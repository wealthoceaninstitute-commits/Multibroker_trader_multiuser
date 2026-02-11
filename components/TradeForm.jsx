// TradeForm.jsx — tighter spacing + buttons nudged right ~1/2" + bluish card tone
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Button, Col, Form, Row, Alert, Card, Spinner,
} from 'react-bootstrap';
import AsyncSelect from 'react-select/async';
import api from './api';

// helpers
const onlyDigits = (v) => (v ?? '').replace(/[^\d]/g, '');
const toIntOr = (v, fallback = 1) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export default function TradeForm() {
  // core state
  const [action, setAction] = useState('buy');
  const [productType, setProductType] = useState('DELIVERY');  // ✅ default changed from VALUEPLUS -> DELIVERY
  const [orderType, setOrderType] = useState('LIMIT');         // LIMIT | MARKET | STOPLOSS | SL MARKET
  const [qtySelection, setQtySelection] = useState('manual');  // manual | auto
  const [groupAcc, setGroupAcc] = useState(false);
  const [diffQty, setDiffQty] = useState(false);
  const [multiplier, setMultiplier] = useState(false);

  const [qty, setQty] = useState('1');
  const [exchange, setExchange] = useState('nse');
  const [symbol, setSymbol] = useState(null);
  const [price, setPrice] = useState(0);
  const [trigPrice, setTrigPrice] = useState(0);
  const [disclosedQty, setDisclosedQty] = useState(0);

  // Order Duration: only DAY/IOC radios; "AMO Order" checkbox
  const [timeForce, setTimeForce] = useState('DAY'); // 'DAY' | 'IOC'
  const [amo, setAmo] = useState(false);

  const [clients, setClients] = useState([]);
  const [selectedClients, setSelectedClients] = useState([]);

  const [groups, setGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);

  const [perClientQty, setPerClientQty] = useState({});
  const [perGroupQty, setPerGroupQty] = useState({});

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  // ---- load user-scoped Clients & Groups (backend compatibility) ----
useEffect(() => {
  const detectUserId = () => {
    if (typeof window === 'undefined') return '';
    // preferred keys used across the app
    const a = window.localStorage.getItem('mb_logged_in_userid_v1') || '';
    const b = window.localStorage.getItem('mb_user') || '';
    const c = window.localStorage.getItem('mb_logged_in_userid') || '';
    return (a || b || c || '').replace(/(^"|"$)/g, '');
  };

  const userid = detectUserId();

  const tryGet = async (path, params = {}) => {
    // attach x-user-id header since some backend builds depend on it
    const headers = userid ? { 'x-user-id': userid } : {};
    return api.get(path, { params, headers });
  };

  const loadClients = async () => {
    const attempts = [
      () => tryGet('/clients', userid ? { userid } : {}),
      () => tryGet('/clients', userid ? { user_id: userid } : {}),
      () => tryGet('/clients', {}), // token-based (backend may infer user)
      () => tryGet('/get_clients', userid ? { userid } : {}), // legacy
      () => tryGet('/get_clients', userid ? { user_id: userid } : {}), // legacy
      () => tryGet('/get_clients', {}), // legacy
    ];

    for (const fn of attempts) {
      try {
        const res = await fn();
        const data = res?.data;
        const list = Array.isArray(data?.clients) ? data.clients : (Array.isArray(data) ? data : []);
        setClients(list);
        return;
      } catch (e) {
        // keep trying
      }
    }
    setClients([]);
  };

  const loadGroups = async () => {
    const attempts = [
      () => tryGet('/groups', userid ? { userid } : {}),
      () => tryGet('/groups', userid ? { user_id: userid } : {}),
      () => tryGet('/groups', {}), // token-based
      () => tryGet('/get_groups', userid ? { userid } : {}), // legacy
      () => tryGet('/get_groups', userid ? { user_id: userid } : {}), // legacy
      () => tryGet('/get_groups', {}), // legacy
    ];

    for (const fn of attempts) {
      try {
        const res = await fn();
        const data = res?.data;
        const list = Array.isArray(data?.groups) ? data.groups : (Array.isArray(data) ? data : []);
        setGroups(list);
        return;
      } catch (e) {
        // keep trying
      }
    }
    setGroups([]);
  };

  loadClients();
  loadGroups();
}, []);


  const loadSymbolOptions = async (inputValue) => {
    if (!inputValue || inputValue.length < 1) return [];
    const res = await api.get('/search_symbols', { params: { q: inputValue, exchange } });
    const results = res.data?.results || [];
    return results.map(r => ({
      value: r.id ?? r.value ?? r.symbol ?? r.text,
      label: r.text ?? r.label ?? String(r.id),
    }));
  };

  // derived
  const isStopOrder = orderType === 'STOPLOSS' || orderType === 'SL MARKET';

  const submit = async (e) => {
    e.preventDefault();

    // basic validations
    if (groupAcc) {
      if (selectedGroups.length === 0) {
        setToast({ variant: 'warning', text: 'Please select at least one group.' });
        return;
      }
    } else if (selectedClients.length === 0) {
      setToast({ variant: 'warning', text: 'Please select at least one client.' });
      return;
    }

    // ✅ NEW: symbol validation to avoid backend crash / network error
    if (!symbol || !symbol.value) {
      setToast({ variant: 'warning', text: 'Please select a symbol before placing the order.' });
      return;
    }

    const safeSingleQty = qtySelection === 'auto' ? 0 : toIntOr(qty, 1);
    const safePerClientQty = (!groupAcc && diffQty)
      ? Object.fromEntries(selectedClients.map(cid => [cid, toIntOr(perClientQty[cid], 1)]))
      : {};
    const safePerGroupQty = (groupAcc && diffQty)
      ? Object.fromEntries(selectedGroups.map(gn => [gn, toIntOr(perGroupQty[gn], 1)]))
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
        qtySelection,
        quantityinlot: safeSingleQty,
        perClientQty: safePerClientQty,
        perGroupQty: safePerGroupQty,
        diffQty,
        multiplier,
      };
      const resp = await api.post('/place_order', payload);
      setToast({ variant: 'success', text: 'Order placed. Response: ' + JSON.stringify(resp.data) });
    } catch (err) {
      // slightly smarter backend error extraction (FastAPI HTTPException uses "detail")
      const backendMsg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message;
      setToast({ variant: 'danger', text: 'Error: ' + backendMsg });
    } finally {
      setBusy(false);
    }
  };

  return (
    // NOTE: blueTone class added here for bluish skin/glow
    <Card className="shadow-sm cardPad blueTone">
      <Form onSubmit={submit}>
        {/* Section: Action */}
        <div className="formSection">
          <Row className="g-2 align-items-center">
            <Col xs="auto" className="d-flex align-items-center flex-wrap gap-3">
              <Form.Label className="mb-0 fw-semibold">Action</Form.Label>
              <Form.Check inline type="radio" name="action" id="buy"  label="BUY"
                checked={action==='buy'}  onChange={()=>setAction('buy')} />
              <Form.Check inline type="radio" name="action" id="sell" label="SELL"
                checked={action==='sell'} onChange={()=>setAction('sell')} />
            </Col>
          </Row>
        </div>

        {/* Section: Product */}
        <div className="formSection">
          <Row className="g-2 align-items-center">
            <Col xs="auto" className="d-flex align-items-center flex-wrap gap-3">
              <Form.Label className="mb-0 fw-semibold">Product</Form.Label>
              {['VALUEPLUS','DELIVERY','NORMAL','SELLFROMDP','BTST','MTF'].map(pt => (
                <Form.Check key={pt} inline type="radio" name="productType"
                  label={pt==='VALUEPLUS' ? 'INTRADAY' : pt}
                  checked={productType===pt} onChange={()=>setProductType(pt)} />
              ))}
            </Col>
          </Row>
        </div>

        {/* Section: Order Type */}
        <div className="formSection">
          <Row className="g-2 align-items-center">
            <Col xs="auto" className="d-flex align-items-center flex-wrap gap-3">
              <Form.Label className="mb-0 fw-semibold">Order Type</Form.Label>
              {['LIMIT','MARKET','STOPLOSS','SL MARKET'].map(ot => (
                <Form.Check key={ot} inline type="radio" name="orderType"
                  label={ot.replace('SL MARKET','SL_MARKET')}
                  checked={orderType===ot} onChange={()=>setOrderType(ot)} />
              ))}
            </Col>
          </Row>
        </div>

        {/* Section: Clients / Groups */}
        <div className="formSection">
          <Row>
            <Col xs={12}>
              {!groupAcc ? (
                <>
                  <Form.Label className="label-tight">Select Clients</Form.Label>
                  <Form.Select
                    multiple
                    size={8}
                    value={selectedClients}
                    onChange={e=>setSelectedClients(Array.from(e.target.selectedOptions).map(o=>o.value))}
                  >
                    {(clients || []).map(c => (
                      <option key={c.client_id} value={c.client_id}>
                        {c.name} : {c.client_id}
                      </option>
                    ))}
                  </Form.Select>

                  {/* Per-Client Quantity inputs when Diff. Qty. is enabled */}
                  {diffQty && (
                    <div className="mt-2">
                      <Form.Label className="fw-semibold small text-primary">
                        Enter Quantity per Client
                      </Form.Label>
                      {selectedClients.length === 0 ? (
                        <div className="text-muted small">Select clients to assign quantities.</div>
                      ) : (
                        selectedClients.map(cid => {
                          const client = clients.find(c => c.client_id === cid);
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
                                  onChange={e =>
                                    setPerClientQty(prev => ({ ...prev, [cid]: e.target.value }))
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
                    {groups.length===0 ? (
                      <div className="text-muted">No groups found.</div>
                    ) : (
                      groups.map(g => (
                        <Form.Check
                          key={g.group_name}
                          type="checkbox"
                          id={`group_${g.group_name}`}
                          label={`${g.group_name} (${g.no_of_clients} clients, x${g.multiplier})`}
                          checked={selectedGroups.includes(g.group_name)}
                          onChange={e=>{
                            const chk = e.target.checked;
                            setSelectedGroups(prev => chk ? [...prev, g.group_name] : prev.filter(x=>x!==g.group_name));
                          }}
                        />
                      ))
                    )}
                  </div>

                  {/* Per-Group Quantity inputs when Diff. Qty. is enabled */}
                  {diffQty && (
                    <div className="mt-2">
                      <Form.Label className="fw-semibold small text-primary">
                        Enter Quantity per Group
                      </Form.Label>
                      {selectedGroups.length === 0 ? (
                        <div className="text-muted small">Select groups to assign quantities.</div>
                      ) : (
                        selectedGroups.map(gn => (
                          <Row key={gn} className="align-items-center mb-1">
                            <Col xs={6}>
                              <div className="text-muted small">{gn}</div>
                            </Col>
                            <Col xs={6}>
                              <Form.Control
                                type="number"
                                min="1"
                                value={perGroupQty[gn] || ''}
                                onChange={e =>
                                  setPerGroupQty(prev => ({ ...prev, [gn]: e.target.value }))
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

        {/* Section: Details Grid */}
        <div className="formSection">
          {/* Row D1 — Qty | Entity + Qty Mode */}
          <Row className="g-2 mb-2 align-items-end">
            <Col md={5}>
              <Form.Label className="label-tight">Qty</Form.Label>
              <Form.Control
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                disabled={qtySelection==='auto' || diffQty}  // disable single qty when using Diff. Qty.
                value={qty}
                onChange={e=>setQty(onlyDigits(e.target.value))}
                onBlur={()=>setQty(String(Math.max(1, parseInt(qty || '1', 10) || 1)))}
              />
              {diffQty && (
                <div className="form-text">Disabled because “Diff. Qty.” is ON.</div>
              )}
            </Col>

            <Col md={7}>
              <div className="d-flex align-items-center flex-wrap gap-3 mb-1">
                <Form.Label className="mb-0 fw-semibold">Entity</Form.Label>
                <Form.Check inline type="checkbox" id="groupAcc" label="Group Acc"
                  checked={groupAcc} onChange={e=>{ setGroupAcc(e.target.checked); setSelectedGroups([]); }} />
                <Form.Check inline type="checkbox" id="diffQty" label="Diff. Qty."
                  checked={diffQty} onChange={e=>setDiffQty(e.target.checked)} />
                <Form.Check inline type="checkbox" id="multiplier" label="Multiplier"
                  checked={multiplier} onChange={e=>setMultiplier(e.target.checked)} />
              </div>

              <div className="d-flex align-items-center flex-wrap gap-3">
                <Form.Label className="mb-0 fw-semibold">Qty Mode</Form.Label>
                <Form.Check inline type="radio" name="qtySel" label="Manual"
                  checked={qtySelection==='manual'} onChange={()=>setQtySelection('manual')} />
                <Form.Check inline type="radio" name="qtySel" label="Auto Calculate"
                  checked={qtySelection==='auto'} onChange={()=>setQtySelection('auto')} />
              </div>
            </Col>
          </Row>

          {/* Row D2 — Exchange | Symbol */}
          <Row className="g-2 mb-2 align-items-end">
            <Col md={5}>
              <Form.Label className="label-tight">Exchange</Form.Label>
              <Form.Select value={exchange} onChange={e=>setExchange(e.target.value)}>
                {['nse','bse','nsefo','nsecd','ncdex','mcx','bsefo','bsecd'].map(x =>
                  <option key={x} value={x}>{x.toUpperCase()}</option>
                )}
              </Form.Select>
            </Col>

            <Col md={7}>
              <Form.Label className="label-tight">Symbol</Form.Label>
              <AsyncSelect
                cacheOptions
                defaultOptions={false}
                loadOptions={loadSymbolOptions}
                value={symbol}
                onChange={setSymbol}
                placeholder="Type to search symbol..."
              />
            </Col>
          </Row>

          {/* Row D3 — Price | Trig. Price & Disclosed Qty */}
          <Row className="g-2 align-items-end">
            <Col md={5}>
              <Form.Label className="label-tight">Price</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                value={price}
                onChange={e=>setPrice(e.target.value)}
              />
            </Col>

            <Col md={7}>
              <Row className="g-2">
                <Col md={6}>
                  <Form.Label className="label-tight">Trig. Price</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01"
                    value={trigPrice}
                    onChange={e=>setTrigPrice(e.target.value)}
                    disabled={!isStopOrder}
                  />
                </Col>
                <Col md={6}>
                  <Form.Label className="label-tight">Disclosed Qty</Form.Label>
                  <Form.Control
                    type="number"
                    value={disclosedQty}
                    onChange={e=>setDisclosedQty(e.target.value)}
                  />
                </Col>
              </Row>
            </Col>
          </Row>
        </div>

        {/* Section: Duration */}
        <div className="formSection">
          <Row className="g-2 align-items-center">
            <Col md="auto" className="d-flex align-items-center flex-wrap gap-3">
              <Form.Label className="mb-0">Order Duration</Form.Label>
              {['DAY','IOC'].map(tf => (
                <Form.Check key={tf} inline type="radio" name="timeForce"
                  label={tf} checked={timeForce===tf} onChange={()=>setTimeForce(tf)} />
              ))}
              <Form.Check inline type="checkbox" id="amo" label="AMO Order"
                checked={amo} onChange={e=>setAmo(e.target.checked)} />
            </Col>
          </Row>
        </div>

        {/* Buttons — bottom-left, nudged ~1/2" right */}
        <Row className="mt-2">
          <Col className="text-start">
            <div className="btn-nudge">
              <Button type="submit" variant={action === 'buy' ? 'success' : 'danger'} disabled={busy}>
                {busy ? <Spinner size="sm" animation="border" className="me-2" /> : null}
                {action.toUpperCase()}
              </Button>{' '}
              <Button type="reset" variant="secondary" onClick={()=>window.location.reload()}>
                Reset
              </Button>
            </div>
          </Col>
        </Row>

        {toast && (
          <Alert variant={toast.variant} onClose={()=>setToast(null)} dismissible className="mt-3">
            {toast.text}
          </Alert>
        )}
      </Form>

      {/* local styles: bluish skin, spacing, and button nudge */}
      <style jsx>{`
        /* more left/right breathing room + extra bottom padding
           so BUY/Reset sit fully inside the card */
        .cardPad { padding: 1rem 2.5rem 2.75rem; }
        @media (min-width: 992px) {
          .cardPad { padding: 1.25rem 2.75rem 3.25rem; }
        }

        /* bluish card skin & soft glow (replaces green look) */
        .blueTone {
          background: linear-gradient(180deg, #f9fbff 0%, #f3f7ff 100%);
          border: 1px solid #d5e6ff;
          box-shadow: 0 0 0 6px rgba(49, 132, 253, 0.12);
          border-radius: 8px;
        }

        /* section spacing + inset dashed divider (bluish) */
        .formSection {
          padding-block: 6px;
          margin: 0 16px 8px;
          border-bottom: 1px dashed #d7e3ff;
        }
        .formSection:last-of-type {
          border-bottom: 0;
          margin-bottom: 0;
          padding-bottom: 0;
        }

        .label-tight { margin-bottom: 4px; }

        /* radios & checkboxes: clearer blue tick */
        :global(input[type="radio"]),
        :global(input[type="checkbox"]) {
          accent-color: #0d6efd; /* Bootstrap primary, good contrast */
        }

        /* nudge buttons ~1/2" to the right + tiny bottom pad */
        .btn-nudge { margin-left: 3rem; padding-bottom: 0.25rem; }

        /* tiny text tweak for per-client/group labels */
        .text-muted.small { font-size: 0.85rem; }
      `}</style>
    </Card>
  );
}
