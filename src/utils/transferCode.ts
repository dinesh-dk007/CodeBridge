const transferCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeTransferCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidTransferCode(value: string): boolean {
  return /^CB-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalizeTransferCode(value));
}

export function generateTransferCode(): string {
  const first = generateGroup();
  const second = generateGroup();
  return `CB-${first}-${second}`;
}

function generateGroup(): string {
  let group = "";
  for (let index = 0; index < 4; index += 1) {
    group += transferCodeAlphabet[Math.floor(Math.random() * transferCodeAlphabet.length)];
  }
  return group;
}
