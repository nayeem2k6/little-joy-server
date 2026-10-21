export function productIdentifierFilter(identifier: string): { _id: string } | { slug: string } {
  return /^[a-f\d]{24}$/i.test(identifier) ? { _id: identifier } : { slug: identifier.toLowerCase() };
}

export function slugifyProductName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function normalizeProductImages<T extends { imageUrl?: string; images?: string[] }>(input: T): T {
  if (input.images !== undefined) {
    return { ...input, imageUrl: input.imageUrl || input.images[0] || "" };
  }
  if (input.imageUrl !== undefined) {
    return { ...input, images: input.imageUrl ? [input.imageUrl] : [] };
  }
  return input;
}
