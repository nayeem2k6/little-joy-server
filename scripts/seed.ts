import { connectDatabase, disconnectDatabase } from "../src/config/database";
import { Category } from "../src/models/Category";
import { Product } from "../src/models/Product";

const demo = [
  { name: "Wooden Toys", slug: "wooden-toys", description: "Thoughtful wooden play essentials.", imageUrl: "https://placehold.co/640x420/f4e8d8/594635?text=Wooden+Toys", products: [
    { name: "Rainbow Stacker", slug: "rainbow-stacker", description: "A colorful wooden stacking toy for open-ended play.", price: 24.99, compareAtPrice: 29.99, stock: 25, images: ["https://placehold.co/640x420/f4e8d8/594635?text=Rainbow+Stacker"], ageRecommendation: "Ages 2+", safetyInformation: "Adult supervision recommended. Inspect before use." },
    { name: "Wooden Animal Set", slug: "wooden-animal-set", description: "A friendly set of wooden animals for imaginative play.", price: 19.5, stock: 18, images: ["https://placehold.co/640x420/e8f0df/40533b?text=Wooden+Animals"], ageRecommendation: "Ages 3+", safetyInformation: "Contains small pieces. Not suitable for children under 3." }
  ] },
  { name: "Building & Creativity", slug: "building-creativity", description: "Create, build, and explore.", imageUrl: "https://placehold.co/640x420/e4ebf4/3d4d63?text=Build+and+Create", products: [
    { name: "Creative Building Blocks", slug: "creative-building-blocks", description: "A sturdy block set for little builders.", price: 32, stock: 14, images: ["https://placehold.co/640x420/e4ebf4/3d4d63?text=Building+Blocks"], ageRecommendation: "Ages 3+", safetyInformation: "Contains small pieces. Not suitable for children under 3." },
    { name: "First Art Kit", slug: "first-art-kit", description: "A simple child-friendly starter kit for creative projects.", price: 15.75, stock: 20, images: ["https://placehold.co/640x420/f8e8e6/704743?text=First+Art+Kit"], ageRecommendation: "Ages 4+", safetyInformation: "Use washable materials as directed. Adult supervision recommended." }
  ] },
  { name: "Puzzles & Games", slug: "puzzles-games", description: "Playful puzzles and family games.", imageUrl: "https://placehold.co/640x420/f2e8d9/61503a?text=Puzzles+and+Games", products: [
    { name: "Garden Picture Puzzle", slug: "garden-picture-puzzle", description: "A colorful beginner puzzle for curious minds.", price: 12.5, stock: 30, images: ["https://placehold.co/640x420/f2e8d9/61503a?text=Garden+Puzzle"], ageRecommendation: "Ages 3+", safetyInformation: "Contains small pieces. Not suitable for children under 3." }
  ] }
];

async function seed(): Promise<void> {
  await connectDatabase();
  try {
    for (const entry of demo) {
      const category = await Category.findOneAndUpdate(
        { slug: entry.slug },
        { $set: { name: entry.name, description: entry.description, imageUrl: entry.imageUrl, active: true }, $setOnInsert: { slug: entry.slug } },
        { upsert: true, new: true }
      );
      for (const item of entry.products) {
        await Product.updateOne(
          { slug: item.slug },
          { $set: { ...item, imageUrl: item.images[0], stockQuantity: item.stock, category: category._id, active: true }, $setOnInsert: { name: item.name, slug: item.slug } },
          { upsert: true }
        );
      }
    }
    console.log("Demo categories and products seeded (existing matching products updated).");
  } finally {
    await disconnectDatabase();
  }
}

void seed().catch((error: unknown) => {
  console.error("Seeding failed:", error);
  process.exitCode = 1;
});
