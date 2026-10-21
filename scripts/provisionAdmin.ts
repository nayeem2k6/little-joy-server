import { connectDatabase, disconnectDatabase } from "../src/config/database";
import { User } from "../src/models/User";

async function provision(): Promise<void> {
  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!name || !email || !password || password.length < 12) {
    throw new Error("Set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD (at least 12 characters) before provisioning.");
  }

  await connectDatabase();
  try {
    if (await User.countDocuments({ role: "admin" })) {
      throw new Error("An admin account already exists; provisioning will not modify existing accounts.");
    }
    const existing = await User.findOne({ email });
    if (existing) throw new Error("That email is already registered; provisioning will not change its role.");
    const user = await User.create({ name, email, password, role: "admin" });
    console.log(`Created initial admin account for ${user.email}.`);
  } finally {
    await disconnectDatabase();
  }
}

void provision().catch((error: unknown) => {
  console.error("Admin provisioning failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
