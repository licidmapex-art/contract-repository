import {
  GoogleGenerativeAI,
  Part,
} from "@google/generative-ai";
import { isGeminiQuotaError } from "@/lib/gemini/config";
import { getGeminiApiKeys, getGeminiModelName } from "@/lib/gemini/keys";

export {
  DEFAULT_GEMINI_MODEL,
  isGeminiQuotaError,
  parseGeminiApiKeysFromEnv,
} from "@/lib/gemini/config";

function parseRetryDelayMs(message: string): number | null {
  const secondsMatch = message.match(/retry in ([\d.]+)s/i);
  if (secondsMatch) {
    return Math.min(Math.ceil(parseFloat(secondsMatch[1]) * 1000), 60_000);
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatGeminiError(
  err: Error,
  modelName: string,
  keyCount: number
): Error {
  if (isGeminiQuotaError(err.message)) {
    const failoverHint =
      keyCount > 1
        ? " All configured API keys were tried."
        : " Add more keys in Settings → API Keys to fail over automatically.";
    return new Error(
      `Gemini rate limit reached for ${modelName}. Wait about a minute and try again.${failoverHint} ` +
        `Use gemini-2.5-flash (2.0 models have no free quota in the EU).`
    );
  }
  return err;
}

type GeminiContent = string | Array<string | Part>;

async function generateWithGeminiContent(
  content: GeminiContent
): Promise<string> {
  const keys = await getGeminiApiKeys();
  const modelName = await getGeminiModelName();
  const errors: string[] = [];

  for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
    const genAI = new GoogleGenerativeAI(keys[keyIndex]);
    const model = genAI.getGenerativeModel({ model: modelName });

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await model.generateContent(content);
        return result.response.text();
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        if (isGeminiQuotaError(error.message) && attempt === 0) {
          const delayMs = parseRetryDelayMs(error.message);
          if (delayMs) {
            console.warn(
              `Gemini key #${keyIndex + 1} rate limited, retrying in ${delayMs}ms`
            );
            await sleep(delayMs);
            continue;
          }
        }

        if (isGeminiQuotaError(error.message) && keyIndex < keys.length - 1) {
          console.warn(
            `Gemini key #${keyIndex + 1} quota exceeded, trying key #${keyIndex + 2}`
          );
          errors.push(`Key ${keyIndex + 1}: ${error.message}`);
          break;
        }

        throw formatGeminiError(error, modelName, keys.length);
      }
    }
  }

  throw new Error(
    `All ${keys.length} Gemini API key(s) exhausted or rate limited.` +
      (errors.length ? ` ${errors.join(" | ")}` : "")
  );
}

export async function generateGeminiText(prompt: string): Promise<string> {
  return generateWithGeminiContent(prompt);
}

export async function generateGeminiMultimodal(
  parts: Array<string | Part>
): Promise<string> {
  return generateWithGeminiContent(parts);
}
