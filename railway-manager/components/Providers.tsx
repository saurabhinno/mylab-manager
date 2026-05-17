"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000, // 1 min — won't refetch if data is fresh
        gcTime: 5 * 60_000, // 5 min cache
        refetchOnWindowFocus: false,
      },
    },
  }));

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
