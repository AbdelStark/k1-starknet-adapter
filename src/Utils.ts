import { Buffer } from "buffer";

export function toHex(
  value: number | bigint | string | Buffer | null | undefined,
  length: number = 64
): string | null {
  if (value == null) return null;
  switch (typeof value) {
    case "string":
      if (value.startsWith("0x")) {
        return "0x" + value.slice(2).padStart(length, "0");
      } else {
        return "0x" + BigInt(value).toString(16).padStart(length, "0");
      }
    case "number":
    case "bigint":
      return "0x" + value.toString(16).padStart(length, "0");
  }
  return "0x" + value.toString("hex").padStart(length, "0");
}
