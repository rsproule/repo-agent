import { useEffect, useState, useRef } from "react";

import {
  ChevronDown,
  GitPullRequest,
  Loader2,
  SearchX,
  User,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { HStack } from "@/components/ui/stack";

import { cn } from "@/lib/utils";
import { useRepoSearch } from "@/hooks/use-attribution";

interface Repository {
  id: number;
  owner: { login: string };
  name: string;
}

interface UserRepoSearchResult {
  id: string;
  login: string;
  avatar_url: string;
  total_prs: number;
  merged_prs: number;
}

// Simple avatar component
const MinimalGithubAvatar: React.FC<{ login: string; className?: string }> = ({
  login,
  className,
}) => (
  <img
    src={`https://github.com/${login}.png`}
    alt={login}
    className={cn("rounded-full", className)}
  />
);

interface Props {
  repo: Repository;
  selectedUser: UserRepoSearchResult | undefined;
  setSelectedUser: (user: UserRepoSearchResult | undefined) => void;
  startWindow: string;
  endWindow: string;
}

export const UserFilter: React.FC<Props> = ({
  repo,
  selectedUser,
  setSelectedUser,
  startWindow,
  endWindow,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const {
    data: users,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useRepoSearch(repo.owner.login, repo.name, {
    search: debouncedSearch,
    start_window: startWindow,
    end_window: endWindow,
  });

  useEffect(() => {
    const currentRef = loadMoreRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          size="xs"
          aria-expanded={open}
          className="justify-between px-2"
        >
          {selectedUser ? (
            <>
              <HStack className="gap-2">
                <MinimalGithubAvatar
                  login={selectedUser.login}
                  className="size-4"
                />
                <span className="font-bold hidden md:block">
                  {selectedUser.login}
                </span>
              </HStack>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedUser(undefined);
                }}
                className="size-fit p-1"
              >
                <X className="size-3" />
              </Button>
            </>
          ) : (
            <>
              <HStack className="text-xs text-muted-foreground/80 gap-1">
                <User className="size-4" />
                <span>User</span>
              </HStack>
              <ChevronDown className="size-3" />
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="end">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search users..."
            className="h-9"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-[300px] h-fit overflow-y-auto">
            <CommandEmpty>
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="size-4 animate-spin" />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <SearchX className="size-4" />
                </div>
              )}
            </CommandEmpty>
            <CommandGroup>
              {users?.pages
                ?.flatMap((page) => page.items)
                .map((user) => (
                  <CommandItem
                    key={user.id}
                    onSelect={() => {
                      setSelectedUser(user);
                      setOpen(false);
                    }}
                  >
                    <HStack className="gap-2 justify-between items-center w-full min-w-0">
                      <HStack className="gap-2 flex-1 min-w-0 items-center">
                        <MinimalGithubAvatar
                          login={user.login}
                          className="size-4 shrink-0"
                        />
                        <span
                          className="font-bold truncate min-w-0 max-w-[120px] flex-1 block"
                          title={user.login}
                        >
                          {user.login}
                        </span>
                      </HStack>
                      <HStack className="gap-2 flex-shrink-0 items-center">
                        <span className="text-xs text-muted-foreground">
                          {user.merged_prs}
                        </span>
                        <GitPullRequest className="size-3" />
                      </HStack>
                    </HStack>
                  </CommandItem>
                ))}
              {isFetchingNextPage && (
                <HStack className="justify-center py-2">
                  <Loader2 className="size-4 animate-spin text-muted-foreground/60" />
                </HStack>
              )}
              {hasNextPage && <div ref={loadMoreRef} className="h-4" />}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};