import { randomInt } from "node:crypto";

const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeTransferCode(value: string): string {
  return value.trim().toUpperCase();
}

export function generateTransferCode(existingCodes: Iterable<string>): string {
  let candidate = "";
  do {
    const first = generateGroup();
    const second = generateGroup();
    candidate = `CB-${first}-${second}`;
  } while (Array.from(existingCodes).includes(candidate));

  return candidate;
}

function generateGroup(): string {
  let group = "";
  for (let index = 0; index < 4; index += 1) {
    group += codeAlphabet[randomInt(codeAlphabet.length)];
  }
  return group;
}
