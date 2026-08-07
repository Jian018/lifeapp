import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { activityAnalysisPrompt, activityDescriptionHasDuration } from "@/lib/activity-ai";
import { assertAiRateLimit } from "@/lib/ai-rate-limit";
import { apiError, ApiError, readJson, requireAdmin } from "@/lib/api";
import { readDatabase } from "@/lib/repository";
import { activityAnalysisSchema, activityAnalyzeInputSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);
    assertAiRateLimit(request);
    const input = await readJson(request, activityAnalyzeInputSchema);
    if (!activityDescriptionHasDuration(input.description)) throw new ApiError(400, "How long did you exercise? Add minutes or hours.", "DURATION_REQUIRED");
    const db = await readDatabase();
    if (!db.settings.activityAiEnabled) throw new ApiError(409, "Activity AI analysis is disabled in Settings.", "AI_DISABLED");
    if (!process.env.OPENAI_API_KEY) throw new ApiError(503, "OpenAI activity analysis is not configured. Enter the activity manually.", "AI_NOT_CONFIGURED");

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.parse({
      model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
      reasoning: { effort: "none" },
      input: activityAnalysisPrompt(input.description, db.settings.bodyWeightKg),
      text: { format: zodTextFormat(activityAnalysisSchema, "activity_analysis") },
    }, { signal: AbortSignal.timeout(20_000) });
    if (!response.output_parsed) throw new ApiError(502, "The activity could not be estimated. Enter it manually or try again.", "AI_EMPTY_RESULT");
    return NextResponse.json({ result: activityAnalysisSchema.parse(response.output_parsed), mode: "openai", weightMode: db.settings.bodyWeightKg === null ? "average" : "personalized", bodyWeightKg: db.settings.bodyWeightKg });
  } catch (error) {
    if (error instanceof OpenAI.APIError || (error instanceof Error && error.name === "TimeoutError")) return NextResponse.json({ error: "Activity analysis is temporarily unavailable. Enter it manually or try again.", code: "AI_ANALYSIS_FAILED" }, { status: 502 });
    return apiError(error);
  }
}
