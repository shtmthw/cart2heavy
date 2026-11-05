/** "Gaming Laptops!" -> "gaming-laptops" */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** The short, human friendly number shown for an order id: "#A1B2C3". */
export function shortOrderId(id: string): string {
  return `#${id.slice(-6).toUpperCase()}`;
}
