import bs58 from "bs58";
import { z } from "zod";
import { FACTION_IDS } from "@/lib/factions";

/** A Solana address: base58, decoding to exactly 32 bytes. */
export const walletSchema = z
  .string()
  .trim()
  .min(32)
  .max(44)
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, "not base58")
  .refine((s) => {
    try {
      return bs58.decode(s).length === 32;
    } catch {
      return false;
    }
  }, "not a 32-byte public key");

export const nonceRequestSchema = z.object({ wallet: walletSchema }).strict();

export const verifyRequestSchema = z
  .object({
    wallet: walletSchema,
    nonce: z.string().regex(/^[A-Za-z0-9_-]{22,64}$/),
    /** ed25519 signature, base64 (64 bytes) */
    signature: z.string().max(200).regex(/^[A-Za-z0-9+/=]+$/),
  })
  .strict();

export const joinRequestSchema = z.object({ factionId: z.enum(FACTION_IDS as [string, ...string[]]) }).strict();

/** Parses a JSON body with a schema; returns null on any malformed input. */
export async function parseJson<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T> | null> {
  if (Number(req.headers.get("content-length") ?? 0) > 4096) return null;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return null;
  }
  const r = schema.safeParse(body);
  return r.success ? r.data : null;
}
