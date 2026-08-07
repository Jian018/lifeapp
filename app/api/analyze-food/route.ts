import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { apiError, ApiError, readJson, requireAdmin } from "@/lib/api";
import { foodAnalysisSchema } from "@/lib/schemas";
import type { FoodAnalysisResult } from "@/lib/types";
import { readDatabase } from "@/lib/repository";

export const runtime = "nodejs";
const inputSchema = z.object({ imageDataUrl: z.string().max(7_500_000).refine((value) => /^data:image\/(jpeg|png|webp);base64,/.test(value), "Use a JPEG, PNG, or WebP image.") });

const demoResult: FoodAnalysisResult = {
  meal_name: "Chicken grain bowl",
  foods: [
    { name: "Grilled chicken", estimated_portion: "120–150 g", estimated_calories: 260 },
    { name: "Cooked rice", estimated_portion: "1 cup", estimated_calories: 205 },
    { name: "Mixed vegetables", estimated_portion: "1 cup", estimated_calories: 90 },
    { name: "Dressing", estimated_portion: "2 tbsp", estimated_calories: 110 },
  ],
  total_estimated_calories: 665,
  minimum_estimated_calories: 540,
  maximum_estimated_calories: 810,
  meal_type: "lunch",
  is_dessert: false,
  dessert_reason: null,
  confidence: "medium",
  assumptions: ["The bowl is a standard dinner-plate size.", "Oil used during cooking is not fully visible.", "Calories are an estimate, not a measurement."],
};

export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);
    const db = await readDatabase();
    if (!db.settings.aiFoodAnalysisEnabled) throw new ApiError(409, "AI food analysis is disabled in Settings.", "AI_DISABLED");
    const { imageDataUrl } = await readJson(request, inputSchema);
    if (!process.env.OPENAI_API_KEY) {
      await new Promise((resolve) => setTimeout(resolve, 650));
      return NextResponse.json({ result: demoResult, mode: "demo", notice: "Demo estimate — add OPENAI_API_KEY to enable image analysis." });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.parse({
      model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: "Analyze this meal for a personal calorie intake log. Identify visible foods and estimate portions and calories. Be conservative about confidence. Treat calories as estimates, never as exact measurements. Determine whether the meal is primarily a dessert or sweet treat. Return only the requested schema." },
          { type: "input_image", image_url: imageDataUrl, detail: "auto" },
        ],
      }],
      text: { format: zodTextFormat(foodAnalysisSchema, "food_analysis") },
    });
    if (!response.output_parsed) throw new ApiError(502, "The food image could not be analyzed. Try a clearer photo.", "AI_EMPTY_RESULT");
    return NextResponse.json({ result: foodAnalysisSchema.parse(response.output_parsed), mode: "openai" });
  } catch (error) {
    if (error instanceof OpenAI.APIError) return NextResponse.json({ error: "Food analysis is temporarily unavailable. Please try again or add the meal manually.", code: "AI_ANALYSIS_FAILED" }, { status: 502 });
    return apiError(error);
  }
}
