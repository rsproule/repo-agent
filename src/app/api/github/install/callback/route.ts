import { verifyState } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { normalizePrivateKey } from "@/lib/github";
import { App } from "@octokit/app";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const installationId = searchParams.get("installation_id");
    const state = searchParams.get("state");

    if (!installationId || !state) {
      return NextResponse.json(
        { error: "Missing installation_id or state" },
        { status: 400 },
      );
    }

    const secret = process.env.GITHUB_APP_STATE_SECRET as string;
    if (!secret) {
      return NextResponse.json(
        { error: "Missing state secret" },
        { status: 500 },
      );
    }

    const payload = verifyState(state, secret);
    if (!payload || !payload.startsWith("uid=")) {
      return NextResponse.json({ error: "Invalid state" }, { status: 400 });
    }

    const echoUserId = payload.slice(4);

    // Fetch installation details to capture the owning account login/id
    let accountLogin: string | null = null;
    let accountId: number | null = null;

    try {
      const app = new App({
        appId: process.env.GITHUB_APP_ID!,
        privateKey: normalizePrivateKey(process.env.GITHUB_APP_PRIVATE_KEY!),
      });

      const installationResp = await app.octokit.request(
        "GET /app/installations/{installation_id}",
        { installation_id: Number(installationId) },
      );

      const data = installationResp.data as {
        account?: { login?: string | null; id?: number | null };
      };
      accountLogin = data.account?.login ?? null;
      accountId = data.account?.id ?? null;
    } catch (error) {
      console.error("Failed to fetch installation details:", error);
      // Non-fatal; continue without account context
    }

    // Create or update the installation record
    await prisma.githubInstallation.upsert({
      where: {
        echoUserId_installationId: {
          echoUserId,
          installationId: BigInt(installationId),
        },
      },
      create: {
        echoUserId,
        installationId: BigInt(installationId),
        accountLogin,
        accountId: accountId ? BigInt(accountId) : null,
      },
      update: {
        accountLogin,
        accountId: accountId ? BigInt(accountId) : null,
        updatedAt: new Date(),
      },
    });

    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    return NextResponse.redirect(`${origin}/`);
  } catch (error) {
    console.error("GitHub installation callback error:", error);
    return NextResponse.json(
      { error: "Failed to process GitHub installation" },
      { status: 500 },
    );
  }
}
