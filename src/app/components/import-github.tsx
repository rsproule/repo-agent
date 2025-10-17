"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Repository } from "@/types/github";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

interface Connection {
  installation_id: number;
  account_login?: string | null;
  account_id?: number | null;
  repositories: Repository[];
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          Loading repositories...
        </span>
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between py-3">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-[60%]" />
              <Skeleton className="h-4 w-[30%]" />
            </div>
            <Skeleton className="h-9 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ImportGithub(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);

  const owner = searchParams.get("owner") ?? "";
  const repo = searchParams.get("repo") ?? "";
  const hasSelectedRepo = owner.length > 0 && repo.length > 0;

  const [open, setOpen] = useState<boolean>(!hasSelectedRepo);
  const [query, setQuery] = useState<string>("");
  const [orgFilter, setOrgFilter] = useState<string>("all");
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/github/connections")
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then((data) => {
        if (!mounted) return;
        setConnections(data.connections ?? []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.message ?? "Failed to load connections");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const orgOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: Array<{ key: string; label: string }> = [];
    for (const c of connections) {
      const key = c.account_login ?? `installation-${c.installation_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      options.push({ key, label: c.account_login ?? "Unknown org" });
    }
    return options;
  }, [connections]);

  const repos = useMemo(() => {
    const all = connections.flatMap((c) =>
      c.repositories.map((r) => ({
        ...r,
        installation_id: c.installation_id,
        account_login: c.account_login ?? `installation-${c.installation_id}`,
      })),
    );
    const filteredByOrg =
      orgFilter === "all"
        ? all
        : all.filter((r) => r.account_login === orgFilter);
    const q = query.trim().toLowerCase();
    return q.length === 0
      ? filteredByOrg
      : filteredByOrg.filter(
          (r) =>
            r.full_name.toLowerCase().includes(q) ||
            r.owner?.login?.toLowerCase().includes(q),
        );
  }, [connections, orgFilter, query]);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  const hasConnections = connections.length > 0;

  return (
    <div className="w-full">
      <div className="w-full space-y-4">
        {!open && hasSelectedRepo ? (
          <div className="w-full rounded-lg border bg-background p-3 flex items-center justify-between">
            <div className="truncate">
              <div className="text-sm text-muted-foreground">Repository</div>
              <div className="font-medium truncate">
                {owner}/{repo}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(true)}
            >
              Change
            </Button>
          </div>
        ) : (
          <>
            <div
              ref={panelRef}
              className="w-full rounded-lg border bg-background p-4 shadow-sm"
            >
              {loading ? (
                <LoadingSkeleton />
              ) : (
                <>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-4">
                    <div className="text-sm text-muted-foreground">
                      Organization
                    </div>
                    <Select
                      value={orgFilter}
                      onValueChange={(value) => {
                        if (value === "__add__") {
                          window.location.href = "/api/github/install?force=1";
                          return;
                        }
                        setOrgFilter(value);
                      }}
                    >
                      <SelectTrigger className="w-full sm:w-[240px]">
                        <SelectValue placeholder="Select org" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {orgOptions.map((o) => (
                          <SelectItem key={o.key} value={o.key}>
                            {o.label}
                          </SelectItem>
                        ))}
                        <SelectItem value="__add__">
                          + Add GitHub Account
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    <div className="w-full sm:ml-auto sm:flex-1 sm:max-w-sm">
                      <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search repositories..."
                      />
                    </div>
                  </div>

                  <div className="divide-y">
                    {repos.slice(0, 5).map((repo) => (
                      <div
                        key={repo.id}
                        className="flex items-center justify-between py-3"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {repo.full_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {repo.private ? "private" : "public"}
                          </div>
                        </div>
                        <Button
                          onClick={() => {
                            const [ownerName, name] = repo.full_name.split("/");
                            router.push(`/?owner=${ownerName}&repo=${name}`);
                            setOpen(false);
                          }}
                          variant="default"
                          className="ml-4"
                        >
                          Import
                        </Button>
                      </div>
                    ))}

                    {repos.length === 0 && !loading && (
                      <div className="py-10 text-center text-sm text-muted-foreground">
                        No repositories found.
                      </div>
                    )}
                  </div>
                </>
              )}

              {!hasConnections && !loading && (
                <div className="mt-4 flex items-center justify-between rounded-md border p-3">
                  <div className="text-sm">No GitHub connections yet.</div>
                  <Button
                    variant="default"
                    onClick={() =>
                      (window.location.href = "/api/github/install?force=1")
                    }
                  >
                    + Install GitHub App
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
