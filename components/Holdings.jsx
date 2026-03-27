'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Table, Alert, Spinner } from 'react-bootstrap';
import api from './api';

function getUserid() {
  if (typeof window === 'undefined') return '';
  return (
    localStorage.getItem('mb_logged_in_userid_v1') ||
    localStorage.getItem('mb_user') ||
    localStorage.getItem('userid') ||
    ''
  ).trim();
}

export default function Holdings() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchHoldings = async () => {
    try {
      setLoading(true);
      setError('');

      const userid = getUserid();
      if (!userid) {
        setRows([]);
        setError('Logged-in userid not found in browser storage.');
        return;
      }

      const res = await api.get('/get_holdings', {
        params: { userid },
        headers: {
          'x-user-id': userid,
        },
      });

      if (res?.data?.ok === false) {
        setRows([]);
        setError(res.data?.error || 'Failed to load holdings');
        return;
      }

      setRows(Array.isArray(res?.data?.holdings) ? res.data.holdings : []);
    } catch (e) {
      setRows([]);
      setError(
        e?.response?.data?.error ||
        e?.message ||
        'Failed to load holdings'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHoldings().catch(() => {});
  }, []);

  return (
    <Card className="p-3">
      <div className="mb-3 d-flex gap-2 align-items-center">
        <Button onClick={fetchHoldings} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh Holdings'}
        </Button>
        {loading && <Spinner animation="border" size="sm" />}
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}

      <Table bordered hover size="sm">
        <thead>
          <tr>
            <th>Select</th>
            <th>Name</th>
            <th>Symbol</th>
            <th>Quantity</th>
            <th>Buy Avg</th>
            <th>LTP</th>
            <th>PnL</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="text-center">
                {loading ? 'Loading holdings...' : 'No holdings available'}
              </td>
            </tr>
          ) : (
            rows.map((r, idx) => (
              <tr key={idx}>
                <td><input type="checkbox" /></td>
                <td>{r.name}</td>
                <td>{r.symbol}</td>
                <td>{r.quantity}</td>
                <td>{r.buy_avg}</td>
                <td>{r.ltp}</td>
                <td
                  style={{
                    color: (parseFloat(r.pnl) || 0) < 0 ? 'red' : 'green',
                    fontWeight: 'bold',
                  }}
                >
                  {(parseFloat(r.pnl) || 0).toFixed(2)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </Card>
  );
}
