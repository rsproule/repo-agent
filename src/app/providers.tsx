"use client";

import { EchoProvider } from "@merit-systems/echo-next-sdk/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <EchoProvider config={{ appId: process.env.NEXT_PUBLIC_ECHO_APP_ID! }}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </EchoProvider>
  );
}
