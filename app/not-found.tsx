import Link from "next/link";
import { AlertCircle, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-4 p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl">
        <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black tracking-tight">404 - Page Not Found</h1>
        <p className="text-sm text-slate-400">
          The page or resource you requested could not be found or has moved.
        </p>
        <div className="pt-4">
          <Button asChild className="bg-blue-600 hover:bg-blue-500 font-bold gap-2">
            <Link href="/dashboard">
              <Home className="w-4 h-4" /> Go to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
