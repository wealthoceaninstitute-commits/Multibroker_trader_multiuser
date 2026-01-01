"use client";

import { useEffect, useState } from "react";
import { Card, Button, Modal, Form, Table, Badge } from "react-bootstrap";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  "https://multibroker-trader-multiuser-render.onrender.com";

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [broker, setBroker] = useState("dhan");

  const [addForm, setAddForm] = useState({
    userid: "",
    mobile: "",
    pin: "",
    apikey: "",
    api_secret: "",
    totpkey: "",
  });

  // -------------------------
  // Load Clients
  // -------------------------
  const loadClients = async () => {
    try {
      const res = await fetch(`${API_BASE}/clients`);
      const data = await res.json();
      setClients(data || []);
    } catch (e) {
      console.error("Failed to load clients", e);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  // -------------------------
  // Add Client
  // -------------------------
  const submitAddClient = async () => {
    if (!broker || !addForm.userid) {
      alert("Broker and Client ID are required");
      return;
    }

    // Dhan validation
    if (broker === "dhan") {
      if (
        !addForm.mobile ||
        !addForm.pin ||
        !addForm.apikey ||
        !addForm.api_secret ||
        !addForm.totpkey
      ) {
        alert("All Dhan fields are required");
        return;
      }
    }

    // Motilal validation
    if (broker === "motilal") {
      if (!addForm.userid || !addForm.pin) {
        alert("Client Code and Password are required for Motilal");
        return;
      }
    }

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
            client_code: addForm.userid,
            password: addForm.pin,
            totpkey: addForm.totpkey || null,
          }
        : {};

    const payload = {
      broker,
      client_id: addForm.userid,
      creds,
    };

    try {
      const res = await fetch(`${API_BASE}/add_client`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.detail || "Failed to add client");
        return;
      }

      setShowAdd(false);
      setAddForm({
        userid: "",
        mobile: "",
        pin: "",
        apikey: "",
        api_secret: "",
        totpkey: "",
      });
      loadClients();
    } catch (e) {
      console.error("Add client failed", e);
      alert("Error adding client");
    }
  };

  // -------------------------
  // UI
  // -------------------------
  return (
    <>
      <div className="d-flex justify-content-between mb-2">
        <Button variant="success" onClick={() => setShowAdd(true)}>
          Add Client
        </Button>
        <Button variant="outline-secondary" onClick={loadClients}>
          Refresh
        </Button>
      </div>

      <Card>
        <Card.Body>
          <Table bordered hover size="sm">
            <thead>
              <tr>
                <th>Name</th>
                <th>Broker</th>
                <th>Session</th>
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 && (
                <tr>
                  <td colSpan={3}>No clients yet.</td>
                </tr>
              )}
              {clients.map((c) => (
                <tr key={`${c.broker}-${c.client_id}`}>
                  <td>{c.client_id}</td>
                  <td>{c.broker}</td>
                  <td>
                    {c.session_active ? (
                      <Badge bg="success">Active</Badge>
                    ) : (
                      <Badge bg="secondary">Inactive</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      {/* ================= MODAL ================= */}
      <Modal show={showAdd} onHide={() => setShowAdd(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Add Client</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Form>
            <Form.Group className="mb-2">
              <Form.Label>Broker</Form.Label>
              <Form.Select
                value={broker}
                onChange={(e) => setBroker(e.target.value)}
              >
                <option value="dhan">Dhan</option>
                <option value="motilal">Motilal</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-2">
              <Form.Label>Client ID *</Form.Label>
              <Form.Control
                value={addForm.userid}
                onChange={(e) =>
                  setAddForm((p) => ({
                    ...p,
                    userid: e.target.value.trim(),
                  }))
                }
              />
            </Form.Group>

            {broker === "dhan" && (
              <>
                <Form.Group className="mb-2">
                  <Form.Label>Mobile *</Form.Label>
                  <Form.Control
                    value={addForm.mobile}
                    onChange={(e) =>
                      setAddForm((p) => ({
                        ...p,
                        mobile: e.target.value.trim(),
                      }))
                    }
                  />
                </Form.Group>

                <Form.Group className="mb-2">
                  <Form.Label>PIN *</Form.Label>
                  <Form.Control
                    type="password"
                    value={addForm.pin}
                    onChange={(e) =>
                      setAddForm((p) => ({
                        ...p,
                        pin: e.target.value.trim(),
                      }))
                    }
                  />
                </Form.Group>

                <Form.Group className="mb-2">
                  <Form.Label>API Key *</Form.Label>
                  <Form.Control
                    value={addForm.apikey}
                    onChange={(e) =>
                      setAddForm((p) => ({
                        ...p,
                        apikey: e.target.value.trim(),
                      }))
                    }
                  />
                </Form.Group>

                <Form.Group className="mb-2">
                  <Form.Label>API Secret *</Form.Label>
                  <Form.Control
                    type="password"
                    value={addForm.api_secret}
                    onChange={(e) =>
                      setAddForm((p) => ({
                        ...p,
                        api_secret: e.target.value.trim(),
                      }))
                    }
                  />
                </Form.Group>

                <Form.Group className="mb-2">
                  <Form.Label>TOTP *</Form.Label>
                  <Form.Control
                    type="password"
                    value={addForm.totpkey}
                    onChange={(e) =>
                      setAddForm((p) => ({
                        ...p,
                        totpkey: e.target.value.trim(),
                      }))
                    }
                  />
                </Form.Group>
              </>
            )}

            {broker === "motilal" && (
              <>
                <Form.Group className="mb-2">
                  <Form.Label>Password *</Form.Label>
                  <Form.Control
                    type="password"
                    value={addForm.pin}
                    onChange={(e) =>
                      setAddForm((p) => ({
                        ...p,
                        pin: e.target.value.trim(),
                      }))
                    }
                  />
                </Form.Group>

                <Form.Group className="mb-2">
                  <Form.Label>TOTP (optional)</Form.Label>
                  <Form.Control
                    type="password"
                    value={addForm.totpkey}
                    onChange={(e) =>
                      setAddForm((p) => ({
                        ...p,
                        totpkey: e.target.value.trim(),
                      }))
                    }
                  />
                </Form.Group>
              </>
            )}
          </Form>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAdd(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submitAddClient}>
            Save Client
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
