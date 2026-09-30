import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AnthropicVertex } from "@anthropic-ai/vertex-sdk";
import { z } from "zod";

/**
 * Reads a photo of a price list and returns the services on it.
 *
 * Claude is called through Vertex AI so usage bills to the GCP project the app
 * already runs in. On the VM the client authenticates as the instance's service
 * account (Application Default Credentials), so there is no key to store. See
 * DEPLOY.md → "Menu scanning".
 */

const MODEL = "claude-opus-5";

const menuSchema = z.object({
  currency: z
    .string()
    .nullable()
    .describe("ISO 4217 code implied by the price symbols, e.g. GBP for £."),
  items: z.array(
    z.object({
      section: z.string().describe("Heading the item sits under."),
      name: z.string(),
      price: z
        .number()
        .nullable()
        .describe("Lowest price that applies, as a plain number."),
      price_note: z
        .string()
        .nullable()
        .describe("What the menu actually says when it isn't one fixed price."),
      duration_minutes: z
        .number()
        .nullable()
        .describe("Only if the menu states a time for this item."),
    }),
  ),
});

export type ScannedMenu = z.infer<typeof menuSchema>;

const INSTRUCTIONS = `These are photos of a beauty salon's price list. List every bookable service on it, in the order it appears.

- Names: use the wording on the menu, tidied into title case. When the same item appears under two headings (for example "Eyebrows" under both Threading and Waxing), make each name say which one it is, like "Eyebrow Threading" and "Eyebrow Wax". Put helpful qualifiers that are printed next to a name, such as "(full head)", into the name. Keep names under 80 characters.
- Prices: give the lowest price that applies. When the menu shows a range ("£45-£55"), alternatives ("£25/30"), a "from" marker on the item or its whole section, or a word instead of a number ("FREE", "POA"), still give the lowest number (FREE is 0, POA is null) and copy what the menu says into price_note. Otherwise price_note is null.
- Times: only fill duration_minutes when the menu prints a time for that item, like "(1hr)" or "(30 mins)". Never guess one.
- Skip anything that isn't a single bookable service: slogans, "we offer packages" banners, contact details.
- If the photos show no price list at all, return an empty items list.`;

let client: AnthropicVertex | null = null;

function getClient(): AnthropicVertex {
  const projectId = process.env.ANTHROPIC_VERTEX_PROJECT_ID;
  if (!projectId) {
    throw new MenuScanUnavailable(
      "Menu scanning isn't set up on this server yet.",
    );
  }
  client ??= new AnthropicVertex({
    projectId,
    region: process.env.CLOUD_ML_REGION || "global",
  });
  return client;
}

/** Configuration problems, as opposed to a photo that couldn't be read. */
export class MenuScanUnavailable extends Error {}

export interface MenuPhoto {
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  base64: string;
}

export async function scanMenuPhotos(photos: MenuPhoto[]): Promise<ScannedMenu> {
  const response = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    // Transcription more than reasoning; medium keeps the wait short.
    output_config: { effort: "medium", format: zodOutputFormat(menuSchema) },
    messages: [
      {
        role: "user",
        content: [
          ...photos.map(
            (photo): Anthropic.ImageBlockParam => ({
              type: "image",
              source: {
                type: "base64",
                media_type: photo.mediaType,
                data: photo.base64,
              },
            }),
          ),
          { type: "text", text: INSTRUCTIONS },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error(`Menu scan returned no result (${response.stop_reason}).`);
  }

  return response.parsed_output;
}
