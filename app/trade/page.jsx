"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "../../src/lib/auth";
import { Container, Tabs, Tab } from "react-bootstrap";
import dynamic from "next/dynamic";

const TradeForm   = dynamic(() => import("../../components/TradeForm"),   { ssr: false });
const Orders      = dynamic(() => import("../../components/Orders"),      { ssr: false });
const Positions   = dynamic(() => import("../../components/Positions"),   { ssr: false });
const Holdings    = dynamic(() => import("../../components/Holdings"),    { ssr: false });
const Summary     = dynamic(() => import("../../components/Summary"),     { ssr: false });
const Clients     = dynamic(() => import("../../components/Clients"),     { ssr: false });
const CopyTrading = dynamic(() => import("../../components/CopyTrading"), { ssr: false });
const Settings    = dynamic(() => import("../../components/Settings"),    { ssr: false });

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  "https://fastapi-supabase-crm-backend-production.up.railway.app";

export default function Page() {
  const [key, setKey] = useState("trade");
  const [userId, setUserId] = useState("");
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    const storedUserId =
      localStorage.getItem("mb_logged_in_userid_v1") ||
      localStorage.getItem("mb_user") ||
      sessionStorage.getItem("mb_logged_in_userid_v1") ||
      sessionStorage.getItem("mb_user") ||
      "";

    setUserId(storedUserId);
  }, [router]);

  return (
    <Container className="mt-4">
      <Tabs
        activeKey={key}
        onSelect={(k) => setKey(k || "trade")}
        id="mainTabs"
        className="mb-3"
        mountOnEnter
        unmountOnExit
      >
        <Tab eventKey="trade" title="Trade">
          <TradeForm />
        </Tab>

        <Tab eventKey="orders" title="Orders">
          <Orders />
        </Tab>

        <Tab eventKey="positions" title="Positions">
          <Positions />
        </Tab>

        <Tab eventKey="holdings" title="Holdings">
          <Holdings />
        </Tab>

        <Tab eventKey="summary" title="Summary">
          <Summary />
        </Tab>

        <Tab eventKey="clients" title="Clients">
          <Clients />
        </Tab>

        <Tab eventKey="copytrading" title="Copy Trading">
          <CopyTrading />
        </Tab>

        <Tab eventKey="settings" title="Settings">
          <Settings userId={userId} apiBase={API_BASE} />
        </Tab>
      </Tabs>
    </Container>
  );
}
