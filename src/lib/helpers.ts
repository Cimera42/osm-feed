export const pad3 = (n: number): string => String(n).padStart(3, '0');

export const range = (start: number, size: number): number[] => {
    return Array.from(Array(size), (_, i) => i + start);
};

export const arrayChunks = <T>(chunkSize: number, array: T[]): T[][] => {
    const chunks: T[][] = [];
    let i: number;
    let j: number;
    for (i = 0, j = array.length; i < j; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
};
