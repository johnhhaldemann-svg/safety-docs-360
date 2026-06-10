"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The guided setup now lives in the native SafePredict workspace shell. Keep this legacy
// route working by sending anyone who lands here (old links, bookmarks) to the new page.
export default function GetStartedRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/safe-predict/get-started");
  }, [router]);

  return null;
}
