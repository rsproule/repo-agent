"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { Folder, Github } from "lucide-react";
import { useEffect, useState } from "react";

interface Repository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
}

interface Connection {
  installation_id: number;
  account_login?: string | null;
  repositories: Repository[];
}

function ReposSkeleton() {
  return (
    <SidebarMenu>
      {Array.from({ length: 5 }).map((_, index) => (
        <SidebarMenuItem key={index}>
          <SidebarMenuSkeleton showIcon />
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

export function AppSidebar() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/github/connections")
      .then((r) => r.json())
      .then((data) => {
        setConnections(data.connections ?? []);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const allRepos = connections.flatMap((c) => c.repositories);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <Github className="h-5 w-5" />
          <span className="font-semibold group-data-[collapsible=icon]:hidden">
            GitHub Assistant
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            <Folder className="h-4 w-4" />
            <span>Repositories</span>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {loading ? (
              <ReposSkeleton />
            ) : allRepos.length === 0 ? (
              <div className="px-4 py-2 text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">
                No repositories
              </div>
            ) : (
              <SidebarMenu>
                {allRepos.map((repo) => (
                  <SidebarMenuItem key={repo.id}>
                    <SidebarMenuButton asChild>
                      <a href={repo.html_url} target="_blank" rel="noreferrer">
                        <Folder className="h-4 w-4" />
                        <span>{repo.full_name}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
