"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  Form,
  Button,
  Row,
  Col,
  Alert,
  Spinner,
  Card,
} from "react-bootstrap";
import api from "./api"; // keep your existing api import

const FORM_STORAGE_KEY = "woi-trade-form-v1";

const LS_KEY_USERID = "mb_logged_in_userid_v1";

// --------- robust user detection ---------
// Prefer the visible navbar text: "Welcome, <user>"
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

const writeLSRaw = (k, v) => {
  try {
    localStorage.setItem(k, String(v ?? ""));
  } catch {}
};

export default function TradeForm() {
  const [clients, setClients] = useState([]);

  // Logged-in user (auto-detected from navbar "Welcome, <user>")
  const [sessionUser, setSessionUser] = useState("");
  const sessionReadyRef = useRef(false);

  const getUid = () => {
    const w = detectUserFromWelcomeText();
    if (w) return w;
    return (sessionUser || "").trim();
  };

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);

  const [action, setAction] = useState("BUY");
  const [producttype, setProducttype] = useState("INTRADAY");
  const [ordertype, setOrdertype] = useState("LIMIT");
  const [orderduration, setOrderduration] = useState("DAY");

  const [selectedClients, setSelectedClients] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [groupacc, setGroupacc] = useState(false);

  const [exchange, setExchange] = useState("NSE");
  const [symbol, setSymbol] = useState("");
  const [price, setPrice] = useState("");
  const [triggerprice, setTriggerprice] = useState("");
  const [disclosedquantity, setDisclosedquantity] = useState("");

  const [qtySelection, setQtySelection] = useState("manual");
  const [quantity, setQuantity] = useState("1");

  const [percentileQty, setPercentileQty] = useState({});
  const [perGroupQty, setPerGroupQty] = useState({});

  const [diffQty, setDiffQty] = useState(false);
  const [multiplier, setMultiplier] = useState(false);

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // Keep sessionUser in sync with navbar text (supports logout/login switching)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const apply = () => {
      const w = detectUserFromWelcomeText();
      if (w) {
        sessionReadyRef.current = true;
        setSessionUser(w);
        writeLSRaw(LS_KEY_USERID, w);
        return true;
      }
      return false;
    };

    // immediate attempt
    if (!apply()) {
      // fallback to last known user (better than blank, until navbar hydrates)
      const ls = (readLSRaw(LS_KEY_USERID) || "").trim();
      if (ls) setSessionUser(ls);

      // short retry loop for hydration delays
      let tries = 0;
      const t = setInterval(() => {
        tries += 1;
        if (apply() || tries >= 16) clearInterval(t); // ~8s
      }, 500);

      return () => clearInterval(t);
    }

    // Observe DOM changes (navbar updates)
    const obs = new MutationObserver(() => apply());
    try {
      obs.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    } catch {}
    return () => obs.disconnect();
  }, []);

  // ---------- initial data ----------
  useEffect(() => {
    const uid = getUid();

    // If navbar hasn't hydrated yet, don't wipe existing UI; just wait.
    if (!uid) return;

    const headers = { "x-user-id": uid };
    setLoading(true);

    Promise.allSettled([
      // Clients for the logged-in user
      api.get("/clients", { params: { user_id: uid }, headers }),
      // Groups (leave behaviour unchanged, but pass uid header if backend uses it)
      api.get("/groups", { headers }),
    ])
      .then((results) => {
        const [cRes, gRes] = results;

        if (cRes.status === "fulfilled") {
          const res = cRes.value;
          const raw = Array.isArray(res.data) ? res.data : res.data?.clients || [];
          const normalized = raw.map((c) => ({
            ...c,
            broker: (c.broker || "").toLowerCase(),
            client_id: c.client_id || c.userid || "",
            name: c.name || c.display_name || c.client_id || c.userid || "",
          }));
          setClients(normalized);
        } else {
          setClients([]);
        }

        if (gRes.status === "fulfilled") {
          const res = gRes.value;
          const normalized = (res.data?.groups || []).map((g) => ({
            group_name: g.name || g.group_name || g.id,
            no_of_clients: (g.members || g.clients || []).length,
            multiplier: Number(g.multiplier ?? 1),
            client_names: (g.members || g.clients || []).map((m) => m.name || m),
          }));
          setGroups(normalized);
        } else {
          setGroups([]);
        }
      })
      .finally(() => setLoading(false));
  }, [sessionUser]);

  // ----- keep your existing memo logic -----
  const groupOptions = useMemo(() => {
    return groups.map((g) => ({
      label: `${g.group_name} (${g.no_of_clients})`,
      value: g.group_name,
      multiplier: g.multiplier || 1,
      client_names: g.client_names || [],
    }));
  }, [groups]);

  // ----- handlers (UI unchanged) -----
  const handleClientSelect = (e) => {
    const options = Array.from(e.target.selectedOptions).map((o) => o.value);
    setSelectedClients(options);
  };

  const handleGroupSelect = (e) => {
    const options = Array.from(e.target.selectedOptions).map((o) => o.value);
    setSelectedGroups(options);
  };

  const resetForm = () => {
    setSuccess("");
    setError("");
    setSelectedClients([]);
    setSelectedGroups([]);
    setGroupacc(false);

    setExchange("NSE");
    setSymbol("");
    setPrice("");
    setTriggerprice("");
    setDisclosedquantity("");

    setQtySelection("manual");
    setQuantity("1");

    setPercentileQty({});
    setPerGroupQty({});

    setDiffQty(false);
    setMultiplier(false);
  };

  // persist form (keep as-is)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = {
      action,
      producttype,
      ordertype,
      orderduration,
      exchange,
      symbol,
      price,
      triggerprice,
      disclosedquantity,
      qtySelection,
      quantity,
      groupacc,
      selectedClients,
      selectedGroups,
      percentileQty,
      perGroupQty,
      diffQty,
      multiplier,
    };
    try {
      localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(payload));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    action,
    producttype,
    ordertype,
    orderduration,
    exchange,
    symbol,
    price,
    triggerprice,
    disclosedquantity,
    qtySelection,
    quantity,
    groupacc,
    selectedClients,
    selectedGroups,
    diffQty,
    multiplier,
    percentileQty,
    perGroupQty,
  ]);

  // load saved form (keep as-is)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(FORM_STORAGE_KEY);
      if (!raw) return;
      const p = JSON.parse(raw);

      setAction(p.action || "BUY");
      setProducttype(p.producttype || "INTRADAY");
      setOrdertype(p.ordertype || "LIMIT");
      setOrderduration(p.orderduration || "DAY");

      setExchange(p.exchange || "NSE");
      setSymbol(p.symbol || "");
      setPrice(p.price || "");
      setTriggerprice(p.triggerprice || "");
      setDisclosedquantity(p.disclosedquantity || "");

      setQtySelection(p.qtySelection || "manual");
      setQuantity(p.quantity || "1");

      setGroupacc(!!p.groupacc);
      setSelectedClients(Array.isArray(p.selectedClients) ? p.selectedClients : []);
      setSelectedGroups(Array.isArray(p.selectedGroups) ? p.selectedGroups : []);

      setPercentileQty(p.percentileQty || {});
      setPerGroupQty(p.perGroupQty || {});

      setDiffQty(!!p.diffQty);
      setMultiplier(!!p.multiplier);
    } catch {}
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const uid = getUid();
    if (!uid) {
      setError("Logged-in user not detected. Please logout/login and try again.");
      return;
    }

    setSuccess("");
    setError("");

    const payload = {
      user_id: uid,
      action,
      ordertype,
      producttype,
      orderduration,
      exchange,
      symbol,
      price,
      triggerprice,
      disclosedquantity,
      qtySelection,
      quantity,
      groupacc,
      groups: selectedGroups,
      clients: selectedClients,
      percentileQty,
      perGroupQty,
      diffQty,
      multiplier,
    };

    try {
      const res = await api.post(
        "/place_order",
        payload,
        { headers: uid ? { "x-user-id": uid } : undefined }
      );
      setSuccess(`Order placed. Response: ${JSON.stringify(res.data)}`);
    } catch (err) {
      const msg =
        err?.response?.data
          ? JSON.stringify(err.response.data)
          : err?.message || "Order failed";
      setError(msg);
    }
  };

  // ---------------- UI (UNCHANGED) ----------------
  return (
    <Card className="p-3">
      {loading && (
        <div className="mb-3">
          <Spinner animation="border" size="sm" /> Loading...
        </div>
      )}

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" dismissible onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      <Form onSubmit={handleSubmit}>
        <div className="mb-3">
          <strong>Action</strong>
          <div>
            <Form.Check
              inline
              type="radio"
              label="BUY"
              checked={action === "BUY"}
              onChange={() => setAction("BUY")}
            />
            <Form.Check
              inline
              type="radio"
              label="SELL"
              checked={action === "SELL"}
              onChange={() => setAction("SELL")}
            />
          </div>
        </div>

        <div className="mb-3">
          <strong>Product</strong>
          <div>
            {["INTRADAY", "DELIVERY", "NORMAL", "SELLFROMDP", "BTST", "MTF"].map((p) => (
              <Form.Check
                key={p}
                inline
                type="radio"
                label={p}
                checked={producttype === p}
                onChange={() => setProducttype(p)}
              />
            ))}
          </div>
        </div>

        <div className="mb-3">
          <strong>Order Type</strong>
          <div>
            {["LIMIT", "MARKET", "STOPLOSS", "SL_MARKET"].map((o) => (
              <Form.Check
                key={o}
                inline
                type="radio"
                label={o}
                checked={ordertype === o}
                onChange={() => setOrdertype(o)}
              />
            ))}
          </div>
        </div>

        <div className="mb-3">
          <strong>Select Clients</strong>
          <Form.Control
            as="select"
            multiple
            value={selectedClients}
            onChange={handleClientSelect}
            style={{ height: 100 }}
          >
            {clients.map((c) => (
              <option key={c.client_id} value={c.client_id}>
                {(c.name || c.client_id) + " : " + c.client_id}
              </option>
            ))}
          </Form.Control>
        </div>

        <Row className="mb-3">
          <Col md={6}>
            <Form.Label>Qty</Form.Label>
            <Form.Control
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </Col>
          <Col md={6}>
            <Form.Label>Entity</Form.Label>
            <div>
              <Form.Check
                inline
                type="checkbox"
                label="Group Acc"
                checked={groupacc}
                onChange={(e) => setGroupacc(e.target.checked)}
              />
              <Form.Check
                inline
                type="checkbox"
                label="Diff. Qty."
                checked={diffQty}
                onChange={(e) => setDiffQty(e.target.checked)}
              />
              <Form.Check
                inline
                type="checkbox"
                label="Multiplier"
                checked={multiplier}
                onChange={(e) => setMultiplier(e.target.checked)}
              />
            </div>

            <Form.Label className="mt-2">Qty Mode</Form.Label>
            <div>
              <Form.Check
                inline
                type="radio"
                label="Manual"
                checked={qtySelection === "manual"}
                onChange={() => setQtySelection("manual")}
              />
              <Form.Check
                inline
                type="radio"
                label="Auto Calculate"
                checked={qtySelection === "auto"}
                onChange={() => setQtySelection("auto")}
              />
            </div>
          </Col>
        </Row>

        <Row className="mb-3">
          <Col md={6}>
            <Form.Label>Exchange</Form.Label>
            <Form.Select value={exchange} onChange={(e) => setExchange(e.target.value)}>
              <option value="NSE">NSE</option>
              <option value="BSE">BSE</option>
            </Form.Select>
          </Col>
          <Col md={6}>
            <Form.Label>Symbol</Form.Label>
            <Form.Control
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="Type to search symbol..."
            />
          </Col>
        </Row>

        <Row className="mb-3">
          <Col md={4}>
            <Form.Label>Price</Form.Label>
            <Form.Control value={price} onChange={(e) => setPrice(e.target.value)} />
          </Col>
          <Col md={4}>
            <Form.Label>Trig. Price</Form.Label>
            <Form.Control
              value={triggerprice}
              onChange={(e) => setTriggerprice(e.target.value)}
            />
          </Col>
          <Col md={4}>
            <Form.Label>Disclosed Qty</Form.Label>
            <Form.Control
              value={disclosedquantity}
              onChange={(e) => setDisclosedquantity(e.target.value)}
            />
          </Col>
        </Row>

        <div className="mb-3">
          <strong>Order Duration</strong>
          <div>
            <Form.Check
              inline
              type="radio"
              label="DAY"
              checked={orderduration === "DAY"}
              onChange={() => setOrderduration("DAY")}
            />
            <Form.Check
              inline
              type="radio"
              label="IOC"
              checked={orderduration === "IOC"}
              onChange={() => setOrderduration("IOC")}
            />
            <Form.Check
              inline
              type="radio"
              label="AMO Order"
              checked={orderduration === "AMO"}
              onChange={() => setOrderduration("AMO")}
            />
          </div>
        </div>

        <div className="d-flex" style={{ gap: 10 }}>
          <Button type="submit" variant="success">
            {action}
          </Button>
          <Button type="button" variant="secondary" onClick={resetForm}>
            Reset
          </Button>
        </div>
      </Form>
    </Card>
  );
}
