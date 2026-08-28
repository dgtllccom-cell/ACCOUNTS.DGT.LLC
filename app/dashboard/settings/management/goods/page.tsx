import { requireErpSession } from "@/lib/auth/session";
import GoodsManagementClient from "./ui-client";

export const metadata = { title: "Settings — Management — Goods" };


export default async function GoodsManagementPage() {
  const session = await requireErpSession();
  return <GoodsManagementClient session={session} />;
}

