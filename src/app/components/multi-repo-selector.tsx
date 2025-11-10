'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Repository } from '@/types/github';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Connection = {
  installation_id: number;
  account_login?: string | null;
  account_id?: number | null;
  repositories: Repository[];
};

interface Props {
  defaultRepos?: string[];
}

export default function MultiRepoSelector({ defaultRepos = [] }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<string[]>(defaultRepos);
  const [selectValue, setSelectValue] = useState<string>('');

  // Flatten all repositories across connections
  const allRepos = connections.flatMap(c => c.repositories);

  useEffect(() => {
    let mounted = true;
    fetch('/api/github/connections')
      .then(async r => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then(data => {
        if (!mounted) return;
        setConnections(data.connections ?? []);
      })
      .catch(e => {
        if (!mounted) return;
        setError(e?.message ?? 'Failed to load connections');
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleAddRepo = (value: string) => {
    if (value === '__install__') {
      window.location.href = '/api/github/install';
      return;
    }
    
    if (!selectedRepos.includes(value)) {
      setSelectedRepos([...selectedRepos, value]);
    }
    setSelectValue('');
  };

  const handleRemoveRepo = (repo: string) => {
    setSelectedRepos(selectedRepos.filter(r => r !== repo));
  };

  const handleViewTimeline = () => {
    if (selectedRepos.length === 0) return;
    const reposParam = selectedRepos.join(',');
    router.push(`/timeline-agg?repos=${encodeURIComponent(reposParam)}`);
  };

  if (loading) return <div>Loading repositories…</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  const hasConnections = connections.length > 0;
  const availableRepos = allRepos.filter(
    repo => !selectedRepos.includes(repo.full_name)
  );

  return (
    <div className="w-full space-y-4">
      <div className="text-xl font-semibold">
        Select Multiple Repositories
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Add repositories:</label>
        <Select
          value={selectValue}
          onValueChange={handleAddRepo}
        >
          <SelectTrigger className="w-full max-w-md">
            <SelectValue placeholder="Choose repositories to add..." />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Available repositories</SelectLabel>
              {hasConnections &&
                availableRepos.map(repo => (
                  <SelectItem key={repo.id} value={repo.full_name}>
                    <div className="flex items-center gap-2">
                      <span>{repo.full_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {repo.private ? 'private' : 'public'}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              {availableRepos.length === 0 && hasConnections && (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  All repositories selected
                </div>
              )}
            </SelectGroup>

            <SelectSeparator />
            <SelectItem value="__install__">+ Install GitHub App</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selectedRepos.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Selected repositories ({selectedRepos.length}):
          </label>
          <div className="flex flex-wrap gap-2">
            {selectedRepos.map(repo => (
              <Badge
                key={repo}
                variant="secondary"
                className="pl-2 pr-1 py-1 flex items-center gap-1"
              >
                <span className="text-sm">{repo}</span>
                <button
                  onClick={() => handleRemoveRepo(repo)}
                  className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                  aria-label={`Remove ${repo}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Button
        onClick={handleViewTimeline}
        disabled={selectedRepos.length === 0}
        className="w-full max-w-md"
      >
        View Aggregated Timeline
        {selectedRepos.length > 0 && ` (${selectedRepos.length} repos)`}
      </Button>
    </div>
  );
}

