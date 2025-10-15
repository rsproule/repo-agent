"use client";

import { AIDevtools } from "@ai-sdk-tools/devtools";
import { EchoProvider } from "@merit-systems/echo-next-sdk/client";
import { Provider } from "ai-sdk-tools/client";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <EchoProvider config={{ appId: process.env.NEXT_PUBLIC_ECHO_APP_ID! }}>
      <Provider initialMessages={[]}>
        {children}
        <AIDevtools />
      </Provider>
    </EchoProvider>
  );
}
