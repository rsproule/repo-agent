import React from "react";

interface SuspenseProps<T> {
  value: T | null | undefined;
  isLoading: boolean;
  component: (value: T) => React.ReactNode;
  loadingComponent: React.ReactNode;
}

export function Suspense<T>({
  value,
  isLoading,
  component,
  loadingComponent,
}: SuspenseProps<T>) {
  if (isLoading || !value) {
    return <>{loadingComponent}</>;
  }

  return <>{component(value)}</>;
}