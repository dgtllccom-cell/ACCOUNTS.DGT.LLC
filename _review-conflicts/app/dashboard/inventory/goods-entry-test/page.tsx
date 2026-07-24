import { requireErpSession } from "@/lib/auth/session";
import GoodsEntryTestClient from "./test-client";

export default async function GoodsEntryTestPage() {
  const session = await requireErpSession();
  return <GoodsEntryTestClient session={session} />;
}

