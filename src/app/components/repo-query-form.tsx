'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Settings } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface RepoWithWeight {
  repo: string;
  weight: number;
}

export default function RepoQueryForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [repos, setRepos] = useState<RepoWithWeight[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Initialize from URL params
  useEffect(() => {
    const reposParam = searchParams.get('repos');
    if (reposParam) {
      const reposList = reposParam.split(',').map(r => {
        const trimmed = r.trim();
        // Parse format: owner/repo or owner/repo:weight
        const [repo, weightStr] = trimmed.split(':');
        const weight = weightStr ? parseFloat(weightStr) : 1.0;
        return { repo, weight };
      }).filter(r => r.repo);
      setRepos(reposList);
    }
  }, [searchParams]);

  const validateRepoFormat = (repo: string): boolean => {
    // Format should be owner/repo
    const parts = repo.trim().split('/');
    return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0;
  };

  const handleAddRepo = () => {
    setError(null);
    const trimmedInput = inputValue.trim();

    if (!trimmedInput) {
      return;
    }

    if (!validateRepoFormat(trimmedInput)) {
      setError('Invalid format. Use: owner/repo (e.g., facebook/react)');
      return;
    }

    if (repos.some(r => r.repo === trimmedInput)) {
      setError('Repository already added');
      return;
    }

    const newRepos = [...repos, { repo: trimmedInput, weight: 1.0 }];
    setRepos(newRepos);
    setInputValue('');
    updateUrl(newRepos);
  };

  const handleRemoveRepo = (repo: string) => {
    const newRepos = repos.filter(r => r.repo !== repo);
    setRepos(newRepos);
    updateUrl(newRepos);
  };

  const handleWeightChange = (repo: string, weight: number) => {
    const newRepos = repos.map(r => 
      r.repo === repo ? { ...r, weight } : r
    );
    setRepos(newRepos);
    updateUrl(newRepos);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddRepo();
    }
  };

  const updateUrl = (newRepos: RepoWithWeight[]) => {
    if (newRepos.length === 0) {
      router.push('/timeline-agg');
    } else {
      const reposParam = newRepos.map(r => 
        r.weight === 1.0 ? r.repo : `${r.repo}:${r.weight}`
      ).join(',');
      router.push(`/timeline-agg?repos=${encodeURIComponent(reposParam)}`);
    }
  };

  const handleClear = () => {
    setRepos([]);
    setInputValue('');
    setError(null);
    router.push('/timeline-agg');
  };

  return (
    <div className="w-full space-y-4 p-4 border rounded-lg bg-card">
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Add Repository
        </label>
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="owner/repo (e.g., facebook/react)"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setError(null);
            }}
            onKeyPress={handleKeyPress}
            className="flex-1"
          />
          <Button onClick={handleAddRepo} variant="default">
            Add
          </Button>
        </div>
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Format: owner/repo (e.g., facebook/react, vercel/next.js). Adjust weights below after adding.
        </p>
      </div>

      {repos.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              Selected Repositories ({repos.length})
            </label>
            <Button
              onClick={handleClear}
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
            >
              Clear All
            </Button>
          </div>
          <div className="space-y-2">
            {repos.map(({ repo, weight }) => (
              <div
                key={repo}
                className="flex items-center gap-2 p-2 border rounded-lg bg-card"
              >
                <Badge
                  variant="secondary"
                  className="pl-3 pr-2 py-1 flex items-center gap-2"
                >
                  <span className="text-sm">{repo}</span>
                </Badge>
                <div className="flex items-center gap-2 ml-auto">
                  <Settings className="h-3 w-3 text-muted-foreground" />
                  <label className="text-xs text-muted-foreground whitespace-nowrap">
                    Weight:
                  </label>
                  <Input
                    type="number"
                    min="0.1"
                    max="10"
                    step="0.1"
                    value={weight}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val > 0) {
                        handleWeightChange(repo, val);
                      }
                    }}
                    className="w-16 h-7 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">×</span>
                </div>
                <button
                  onClick={() => handleRemoveRepo(repo)}
                  className="rounded-full hover:bg-muted-foreground/20 p-1"
                  aria-label={`Remove ${repo}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

