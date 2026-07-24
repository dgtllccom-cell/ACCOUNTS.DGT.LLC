import { requireErpSession } from "@/lib/auth/session";
import GoodsManagementClient from "./ui-client";

export default async function GoodsManagementPage() {
  const session = await requireErpSession();
  return <GoodsManagementClient session={session} />;
}

