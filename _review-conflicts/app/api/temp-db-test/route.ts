import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient() as any;
    
    // Test loading_ports table
    const { data: loadingData, error: loadingError } = await supabase
      .from("loading_ports")
      .select("*")
      .limit(1);

    // Test received_ports table
    const { data: receivedData, error: receivedError } = await supabase
      .from("received_ports")
      .select("*")
      .limit(1);

    return NextResponse.json({
      success: true,
      loading_ports: {
        success: !loadingError,
        error: loadingError ? loadingError.message : null,
        data: loadingData
      },
      received_ports: {
        success: !receivedError,
        error: receivedError ? receivedError.message : null,
        data: receivedData
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}
