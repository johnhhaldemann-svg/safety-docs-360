"use client";

import { Suspense } from "react";
import { AppLoading } from "@/components/app-shell/AppLoading";
import { CommandCenterWorkspace } from "@/components/command-center/CommandCenterWorkspace";

export default function CommandCenterPage() {
  return (
    <Suspense fallback={<AppLoading label="Loading Command Center…" />}>
      <CommandCenterWorkspace />
    </Suspense>
  );
}
