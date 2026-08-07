import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { apiError, ApiError, readJson, requireAdmin } from "@/lib/api";
import { foodAnalysisSchema } from "@/lib/schemas";
import { readDatabase } from "@/lib/repository";
import { assertAiRateLimit } from "@/lib/ai-rate-limit";

export const runtime = "nodejs";
const inputSchema = z.object({ imageDataUrl: z.string().max(7_500_000).refine((value) => /^data:image\/(jpeg|png|webp);base64,/.test(value), "Use a JPEG, PNG, or WebP image.") });

export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);
    assertAiRateLimit(request);
    const db = await readDatabase();
    if (!db.settings.aiFoodAnalysisEnabled) throw new ApiError(409, "AI food analysis is disabled in Settings.", "AI_DISABLED");
    const { imageDataUrl } = await readJson(request, inputSchema);
    if (!process.env.OPENAI_API_KEY) throw new ApiError(503, "OpenAI food analysis is not configured. Add the meal manually.", "AI_NOT_CONFIGURED");

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.parse({
      model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
      reasoning: { effort: "none" },
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: "Analyze this meal for a personal calorie intake log. Identify visible foods and estimate portions and calories. Be conservative about confidence. Treat calories as estimates, never as exact measurements. Determine whether the meal is primarily a dessert or sweet treat. Return only the requested schema." },
          { type: "input_image", image_url: imageDataUrl, detail: "auto" },
        ],
      }],
      text: { format: zodTextFormat(foodAnalysisSchema, "food_analysis") },
    }, { signal: AbortSignal.timeout(20_000) });
    if (!response.output_parsed) throw new ApiError(502, "The food image could not be analyzed. Try a clearer photo.", "AI_EMPTY_RESULT");
    return NextResponse.json({ result: foodAnalysisSchema.parse(response.output_parsed), mode: "openai" });
  } catch (error) {
    if (error instanceof OpenAI.APIError || (error instanceof Error && error.name === "TimeoutError")) return NextResponse.json({ error: "Food analysis is temporarily unavailable. Please try again or add the meal manually.", code: "AI_ANALYSIS_FAILED" }, { status: 502 });
    return apiError(error);
  }
}
