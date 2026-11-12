/** Season numbers in Roman numerals (Season 0 stays "0"). */
export function roman(n: number): string {
  if (!Number.isInteger(n) || n <= 0 || n >= 4000) return String(n);
  const table: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "";
  for (const [v, s] of table) while (n >= v) (out += s), (n -= v);
  return out;
}
