import OpenAI from "openai";

export const llm = new OpenAI({
    apiKey: process.env.LLM_API_KEY!,
    baseURL: process.env.LLM_API_BASE_URL!,
});

// export const MODEL = "claude-sonnet-4-6";
export const MODEL = "gemini-2.5-flash";
