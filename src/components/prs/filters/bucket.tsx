import { useState } from "react";

import { ChartBarIncreasing, ChevronDown, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandList,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { HStack } from "@/components/ui/stack";
import { Suspense } from "@/components/ui/suspense";
import { Skeleton } from "@/components/ui/skeleton";

import { cn } from "@/lib/utils";
import { getScore, getScoreDotClassName } from "@/components/ui/attribution-badge";

import type { Quartile } from "@/lib/attribution";

interface LoadingData<T> {
  data: T | null;
  isLoading: boolean;
}

interface Props {
  selectedBucket: number | undefined;
  setSelectedBucket: (bucket: number | undefined) => void;
  quartiles: LoadingData<Quartile[]>;
}

export const BucketFilter: React.FC<Props> = ({
  selectedBucket,
  setSelectedBucket,
  quartiles,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          size="xs"
          aria-expanded={open}
          className={cn("justify-between px-2")}
        >
          {selectedBucket !== undefined ? (
            <>
              <span>{getScore(selectedBucket)}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedBucket(undefined);
                }}
                className="size-fit p-1"
              >
                <X className="size-3" />
              </Button>
            </>
          ) : (
            <>
              <HStack className="text-xs text-muted-foreground/80 gap-1">
                <ChartBarIncreasing className="size-4" />
                <span>Score</span>
              </HStack>
              <ChevronDown className="size-3" />
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="end">
        <Command shouldFilter={false}>
          <CommandList className="max-h-[300px] h-fit overflow-y-auto">
            <CommandGroup>
              {Array.from({ length: 4 })
                .map((_, index) => 3 - index)
                .map((value) => (
                  <CommandItem
                    key={value}
                    onSelect={() => {
                      setSelectedBucket(value);
                      setOpen(false);
                    }}
                  >
                    <HStack className="gap-2 justify-between w-full">
                      <HStack className="gap-2">
                        <div
                          className={cn(
                            "size-2 rounded-full",
                            getScoreDotClassName(value),
                          )}
                        />
                        <span>{getScore(value)}</span>
                      </HStack>
                      <Suspense
                        value={quartiles.data?.[value]?.count ?? 0}
                        isLoading={quartiles.isLoading}
                        component={(count) => <span>{count}</span>}
                        loadingComponent={<Skeleton className="w-8 h-5" />}
                      />
                    </HStack>
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};