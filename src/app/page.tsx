import { isSignedIn } from "@/echo";
import ImportGithub from "./components/ImportGithub";
import ReadmeSummarizer from "./components/ReadmeSummarizer/readme-summarizer";

type PageProps = {
  searchParams: Promise<{ owner?: string; repo?: string }>;
};

export default async function Home({ searchParams }: PageProps) {
  const signedIn = await isSignedIn();
  if (!signedIn) {
    return null;
  }

  const { owner, repo } = await searchParams;

  return (
    <div className="space-y-2">
      <ImportGithub />
      {owner && repo && <ReadmeSummarizer owner={owner} repo={repo} />}
    
    </div>
  );
}
