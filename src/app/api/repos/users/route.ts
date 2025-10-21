import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface UserRepoSearchResult {
  id: string;
  login: string;
  avatar_url: string;
  total_prs: number;
  merged_prs: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");
    const search = searchParams.get("search") || "";
    const startWindow = searchParams.get("start_window");
    const endWindow = searchParams.get("end_window");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "20"), 100);

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "Missing required parameters: owner, repo" },
        { status: 400 }
      );
    }

    const offset = (page - 1) * pageSize;

    // Build time filter conditions
    const timeFilters: string[] = [];
    if (startWindow) {
      timeFilters.push(`pr.merged_at >= '${startWindow}'::timestamptz`);
    }
    if (endWindow) {
      timeFilters.push(`pr.merged_at <= '${endWindow}'::timestamptz`);
    }
    const timeCondition = timeFilters.length > 0 ? `AND ${timeFilters.join(" AND ")}` : "";

    // Build search condition
    const searchCondition = search
      ? `AND LOWER(pr.author) LIKE LOWER('%${search.replace(/'/g, "''")}%')`
      : "";

    const query = `
      SELECT
        pr.author as login,
        pr.author as id,
        COUNT(*) as total_prs,
        COUNT(CASE WHEN pr.merged_at IS NOT NULL THEN 1 END) as merged_prs
      FROM pull_requests pr
      WHERE pr.owner = $1
        AND pr.repo = $2
        ${timeCondition}
        ${searchCondition}
      GROUP BY pr.author
      HAVING COUNT(*) > 0
      ORDER BY merged_prs DESC, total_prs DESC, pr.author ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT pr.author) as count
      FROM pull_requests pr
      WHERE pr.owner = $1
        AND pr.repo = $2
        ${timeCondition}
        ${searchCondition}
    `;

    const [results, countResult] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{
        login: string;
        id: string;
        total_prs: bigint;
        merged_prs: bigint;
      }>>(query, owner, repo),
      prisma.$queryRawUnsafe<Array<{ count: bigint }>>(countQuery, owner, repo),
    ]);

    const totalCount = Number(countResult[0]?.count || 0);

    const items: UserRepoSearchResult[] = results.map((result) => ({
      id: result.id,
      login: result.login,
      avatar_url: `https://github.com/${result.login}.png`,
      total_prs: Number(result.total_prs),
      merged_prs: Number(result.merged_prs),
    }));

    return NextResponse.json({
      items,
      totalCount,
      page,
      pageSize,
      hasNext: totalCount > page * pageSize,
    });

  } catch (error) {
    console.error("Error fetching repo users:", error);
    return NextResponse.json(
      { error: "Failed to fetch repo users" },
      { status: 500 }
    );
  }
}