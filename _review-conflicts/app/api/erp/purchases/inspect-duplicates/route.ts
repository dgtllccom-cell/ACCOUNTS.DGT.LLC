import { NextRequest } from "next/server";
import { apiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  return apiError("Not Found", 404);
}
