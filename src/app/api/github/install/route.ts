import { getUser } from "@/echo";
import { signState } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { getGitHubAppInstallUrl } from "@/lib/github";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user already has an installation
    const existingInstall = await prisma.githubInstallation.findFirst({
      where: {
        echoUserId: user.id,
      },
    });

    // If already installed, check if they want to reinstall via force param
    const { searchParams } = new URL(request.url);
    const force = searchParams.get("force");

    if (existingInstall && !force) {
      // Redirect to home page instead of showing error
      const origin =
        process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
      return NextResponse.redirect(`${origin}/?message=already-installed`);
    }

    const url = new URL(getGitHubAppInstallUrl());
    const stateSecret = process.env.GITHUB_APP_STATE_SECRET as string;
    if (!stateSecret) throw new Error("Missing GITHUB_APP_STATE_SECRET");

    const signedState = signState(`uid=${user.id}`, stateSecret);
    url.searchParams.set("state", signedState);

    // Ask GitHub to callback to our handler so we can map echo_user_id
    url.searchParams.set(
      "redirect_url",
      `${
        process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
      }/api/github/install/callback`,
    );

    return NextResponse.redirect(url.toString());
  } catch (e: unknown) {
    console.error("GitHub install error:", e);
    return NextResponse.json(
      {
        error:
          (e as Error)?.message ?? "Failed to initiate GitHub App installation",
      },
      { status: 500 },
    );
  }
}
