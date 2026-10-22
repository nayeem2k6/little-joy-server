import { randomUUID } from "node:crypto";
import { connectDatabase, disconnectDatabase } from "../src/config/database";
import { Category } from "../src/models/Category";
import { Order } from "../src/models/Order";
import { Product } from "../src/models/Product";
import { slugifyProductName } from "../src/services/products";

async function migrate(): Promise<void> {
  await connectDatabase();
  try {
    const usedSlugs = new Set((await Product.distinct("slug").exec()).filter((slug): slug is string => typeof slug === "string" && Boolean(slug)));
    const products = await Product.find({ $or: [
      { slug: { $exists: false } },
      { stockQuantity: { $exists: false } },
      { images: { $exists: false } },
      { imageUrl: { $exists: false } },
      { ageRecommendation: { $exists: false } },
      { safetyInformation: { $exists: false } },
      { active: { $exists: false } },
      { featured: { $exists: false } }
    ] }).select("_id name slug stock stockQuantity imageUrl images ageRecommendation safetyInformation active featured");
    for (const product of products) {
      let slug = product.slug || slugifyProductName(product.name) || `product-${product.id}`;
      if (!product.slug) {
        const base = slug;
        let suffix = 2;
        while (usedSlugs.has(slug)) slug = `${base}-${suffix++}`;
        usedSlugs.add(slug);
      }
      const stock = product.stockQuantity ?? product.stock ?? 0;
      const images = product.images?.length ? product.images : (product.imageUrl ? [product.imageUrl] : []);
      await Product.updateOne({ _id: product._id }, {
        $set: {
          slug,
          stock,
          stockQuantity: stock,
          images,
          imageUrl: product.imageUrl || images[0] || "",
          ageRecommendation: product.ageRecommendation ?? "",
          safetyInformation: product.safetyInformation ?? "",
          active: product.active ?? true,
          featured: product.featured ?? false
        }
      });
    }

    await Category.updateMany({ imageUrl: { $exists: false } }, { $set: { imageUrl: "" } });
    await Category.updateMany({ active: { $exists: false } }, { $set: { active: true } });
    await Order.updateMany({ deliveryFee: { $exists: false } }, { $set: { deliveryFee: 0 } });
    await Order.updateMany({ customerPhone: { $exists: false } }, [
      { $set: { customerPhone: { $ifNull: ["$shippingAddress.phone", ""] } } }
    ]);
    const orders = await Order.find({ $or: [{ orderNumber: { $exists: false } }, { orderNumber: "" }] }).select("_id");
    for (const order of orders) {
      await Order.updateOne({ _id: order._id }, {
        $set: { orderNumber: `LJ-${Date.now().toString(36).toUpperCase()}-${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}` }
      });
    }
    console.log(`Storefront migration complete: ${products.length} products and ${orders.length} orders updated.`);
  } finally {
    await disconnectDatabase();
  }
}

void migrate().catch((error: unknown) => {
  console.error("Storefront migration failed:", error);
  process.exitCode = 1;
});
