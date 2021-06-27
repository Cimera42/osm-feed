export const pad3 = (n: number) => String(n).padStart(3, '0');
export const range = (start: number, size: number) => Array.from(Array(size), (_, i) => i + start);
