export const pad3 = (n: number): string => String(n).padStart(3, '0');
export const range = (start: number, size: number): number[] => {
    return Array.from(Array(size), (_, i) => i + start);
};
