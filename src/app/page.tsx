"use client";

import dynamic from "next/dynamic";
import { useAuthStore } from "@/stores/authStore";
import LoginPage from "@/components/auth/LoginPage";

const CanvasApp = dynamic(() => import("@/components/canvas/CanvasApp"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
        <p className="text-sm text-gray-500">Loading VizCanvas...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  const token = useAuthStore((s) => s.token);
  if (!token) return <LoginPage />;
  return <CanvasApp />;
}
