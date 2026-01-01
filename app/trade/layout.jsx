"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

export default function TradeLayout({ children }) {
  const router = useRouter();

  useEffect(() => {
    const user = localStorage.getItem("mb_user");
    if (!user) {
      router.push("/login");
    }
  }, [router]);

  return (
    <>
      <Navbar />
      <main>{children}</main>
    </>
  );
}
