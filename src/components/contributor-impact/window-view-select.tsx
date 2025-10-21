import React from "react";

import { Eye } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const windowViewOptions = [
  { label: "1 Month", months: 1 },
  { label: "3 Months", months: 3 },
  { label: "6 Months", months: 6 },
  { label: "1 Year", months: 12 },
  { label: "2 Years", months: 24 },
  { label: "All", months: 0 },
];

interface Props {
  months: number;
  setMonths: (months: number) => void;
}

export const WindowViewSelect: React.FC<Props> = ({ months, setMonths }) => {
  const currentLabel =
    windowViewOptions.find((t) => t.months === months)?.label || "All";

  return (
    <div className="flex items-center gap-2">
      <Select
        value={currentLabel}
        onValueChange={(value) => {
          const option = windowViewOptions.find((t) => t.label === value);
          if (option) {
            setMonths(option.months);
          }
        }}
      >
        <SelectTrigger className="w-fit gap-2 h-8 text-xs border-none text-muted-foreground/60">
          <Eye className="h-4 w-4" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {windowViewOptions.map((option) => (
            <SelectItem key={option.label} value={option.label}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};