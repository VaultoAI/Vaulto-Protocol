import { NextRequest, NextResponse } from "next/server";

const SUBGRAPH_URL =
  "https://gateway.thegraph.com/api/subgraphs/id/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, variables } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Missing or invalid query" }, { status: 400 });
    }

    const apiKey =
      process.env.NEXT_PUBLIC_THE_GRAPH_API_KEY ?? process.env.THE_GRAPH_API_KEY;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const res = await fetch(SUBGRAPH_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables: variables ?? {} }),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.errors ?? "Subgraph request failed" },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "GraphQL proxy error" },
      { status: 500 }
    );
  }
}
