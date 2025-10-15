"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ImportGithub from "@/app/components/ImportGithub";
import { Settings } from "lucide-react";

interface GithubConnectionsModalProps {
  trigger?: React.ReactNode;
}

export default function GithubConnectionsModal({
  trigger,
}: GithubConnectionsModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Manage GitHub
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>GitHub Connections</DialogTitle>
          <DialogDescription>
            Manage your GitHub repository connections and import repositories.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <ImportGithub />
        </div>
      </DialogContent>
    </Dialog>
  );
}
