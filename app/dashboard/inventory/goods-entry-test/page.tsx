import { requireErpSession } from "@/lib/auth/session";
import GoodsEntryTestClient from "./test-client";

export const metadata = { title: "Inventory — Goods Entry Test" };


export default async function GoodsEntryTestPage() {
  const session = await requireErpSession();
  return <GoodsEntryTestClient session={session} />;
}

