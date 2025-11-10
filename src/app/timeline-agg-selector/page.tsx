import MultiRepoSelector from '@/app/components/multi-repo-selector';

export default function TimelineAggSelectorPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            Aggregated Timeline Builder
          </h1>
          <p className="text-muted-foreground">
            Select multiple repositories to view their combined contribution timeline.
          </p>
        </div>

        <MultiRepoSelector />
        
        <div className="mt-8 p-4 bg-muted/30 rounded-lg border">
          <h3 className="font-medium mb-2">How it works</h3>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Select multiple repositories from your GitHub installations</li>
            <li>PRs from all repositories are combined into a single timeline</li>
            <li>Timeline is sorted by merge date across all repos</li>
            <li>View how contributors' impact evolves across multiple projects</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

