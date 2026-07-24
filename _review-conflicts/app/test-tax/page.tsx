"use client";

import { useEffect } from "react";

export default function Test() {
  useEffect(() => {
    const raw = localStorage.getItem("erp_saved_taxes_v1");
    console.log("Taxes in localStorage:", raw);
  }, []);
  return <div>Test</div>;
}
