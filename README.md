# LittleJoy Toys API

An Express/TypeScript/Mongoose backend for the LittleJoy Toys storefront. This is a functional application foundation, not a claim of production readiness. Before deployment, review operational requirements, privacy obligations, monitoring, backups, cookie/CORS settings, and the security of your hosting environment.

## Setup

1. Use Node.js 20+ and a MongoDB replica set (transactions are required for checkout/cancellation consistency).
2. Copy `.env.example` to `.env`, set a unique random `JWT_SECRET` of at least 32 characters, and configure `MONGODB_URI`, `CORS_ORIGINS`, and cookie settings.
3. Run `npm install`, `npm run dev`; the API defaults to port 4000.
4. In separate commands as needed, set `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` (minimum 12 characters) and run `npm run admin:provision`. Provisioning refuses to change an existing admin or promote an existing account.
5. Run `npm run seed` to upsert demo categories/products.
6. For an existing database created by an earlier backend version, stop the API and run `npm run migrate:storefront` once before deployment. It backfills product slugs/stock aliases/images, category images, and order numbers/delivery fields. New databases do not need this migration.
7. `npm run build` compiles the application; `npm test` runs focused API and service tests.

Authentication uses a signed JWT in an HTTP-only cookie; browsers must send credentials on cross-origin requests. `COOKIE_SAME_SITE` defaults to `lax` locally and accepts `lax`, `strict`, or `none`. For separately hosted Vercel and Render origins, configure `COOKIE_SAME_SITE=none`, `COOKIE_SECURE=true`, HTTPS, and exact CORS origins; the API refuses `SameSite=None` without secure cookies. Browser third-party-cookie policies can still block cross-site cookies, so same-site custom domains (for example `shop.example.com` and `api.example.com`) are recommended. Admin provisioning is intentionally separate from public registration.

## Response shape

Successful responses use `{ "success": true, "data": ... }`. Failures use `{ "success": false, "error": { "code": "...", "message": "...", "details"?: ... } }`. List endpoints return `items` and, where applicable, `pagination`.

## Routes

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | Public | Liveness response |
| GET | `/api/products` | Public | Active products; optional `search`, `category` (id or slug), `minPrice`, `maxPrice`, `sort` (`newest`, `price-asc`, `price-desc`, `popular`), `availability` (`all`, `in-stock`, `out-of-stock`; `true`/`false` aliases), `page`, `limit` |
| GET | `/api/products/:id` | Public | Active product details by ObjectId or slug |
| GET | `/api/products/:id/reviews` | Public | Approved product reviews; `:id` accepts ObjectId or slug |
| POST | `/api/products/:id/reviews` | Customer | Submit review (`rating: 1..5`, `comment`); `:id` accepts ObjectId or slug; requires a delivered order containing this product; new reviews await moderation |
| GET | `/api/categories` | Public | Active categories |
| POST | `/api/auth/register` | Public, rate-limited | Register customer (`name`, `email`, `password`, optional `phone`) |
| POST | `/api/auth/login` | Public, rate-limited | Login (`email`, `password`) |
| POST | `/api/auth/logout` | Public | Clear auth cookie |
| GET | `/api/auth/me` | Customer/admin | Current signed-in user |
| POST | `/api/orders` | Customer/admin | COD checkout (`items: [{productId, quantity}]`, `shippingAddress: {fullName, phone, addressLine1, addressLine2?, city, postalCode, country}`, optional `couponCode`) |
| GET | `/api/orders/my-orders` | Customer/admin | Current user's orders |
| GET | `/api/admin/dashboard` | Admin | Summary counts and non-cancelled order revenue |
| GET | `/api/admin/customers` | Admin | Customer-only directory with safe fields and pagination (`page`, `limit`); includes `orderCount`, never password/token fields |
| GET | `/api/admin/products` | Admin | All products, paginated |
| POST | `/api/admin/products` | Admin | Create product (`name`, optional `slug` generated from name, `description`, `price`, either `stock` or `stockQuantity`, `category`, optional `compareAtPrice`, `images`, legacy `imageUrl`, `ageRecommendation`, `safetyInformation`, `active`) |
| PATCH | `/api/admin/products/:id` | Admin | Update product fields; `stock`/`stockQuantity` aliases are synchronized, image arrays and legacy `imageUrl` are kept compatible |
| DELETE | `/api/admin/products/:id` | Admin | Soft-disable a product |
| GET | `/api/admin/categories` | Admin | All categories |
| POST | `/api/admin/categories` | Admin | Create category (`name`, `slug`, optional `description`, `imageUrl`) |
| PATCH | `/api/admin/categories/:id` | Admin | Update provided category fields |
| DELETE | `/api/admin/categories/:id` | Admin | Soft-disable a category |
| GET | `/api/admin/orders` | Admin | All orders, paginated |
| PATCH | `/api/admin/orders/:id/status` | Admin | Set status: `pending`, `confirmed`, `processing`, `shipped`, `delivered`, or `cancelled` |
| GET | `/api/admin/coupons` | Admin | List coupons |
| POST | `/api/admin/coupons` | Admin | Create coupon (`code`, `discountType: "percentage"|"fixed"`, `discountValue`; optional `minSubtotal`, `maxDiscount`, `startsAt`, `expiresAt`, `usageLimit`, `perUserLimit`, `active`) |
| PATCH | `/api/admin/coupons/:id` | Admin | Update provided coupon fields |
| DELETE | `/api/admin/coupons/:id` | Admin | Deactivate coupon |
| GET | `/api/admin/reviews` | Admin | List reviews; optional `status`, `page`, `limit` |
| PATCH | `/api/admin/reviews/:id/status` | Admin | Moderate review (`status: "approved"|"rejected"`) |

Coupon date fields are ISO-8601 strings or `null`; codes are normalized to uppercase. Checkout validates the coupon against the server-calculated product subtotal, enforces date, minimum subtotal, global and per-customer use limits, caps discounts, and persists the final discount in the order. Client-supplied prices or totals are ignored. Coupon creation/update responses use `{ coupon }`; admin lists and public reviews use `{ items }`.

Product payloads expose `slug`, `price`, nullable `compareAtPrice`, both `stock` and `stockQuantity`, `images: string[]`, compatibility `imageUrl`, `ageRecommendation`, and `safetyInformation`, along with product/category metadata. A product can be fetched with either its slug or ObjectId. Admin writes require either stock field on create; if both are sent, they must match. If an `images` array is sent, its first URL populates the legacy `imageUrl` unless an explicit `imageUrl` is provided; sending only `imageUrl` creates a one-element `images` array.

Every new order has a unique `orderNumber` (`LJ-...`), `items`, `shippingAddress`, `subtotal`, coupon discount snapshot when used, `deliveryFee`, `total`, `paymentMethod`, `status`, `customerPhone`, and timestamps. Total is product subtotal minus server-validated coupon discount plus server-configured delivery fee. The fee is never accepted from checkout input. `DELIVERY_FEE` is a nonnegative flat amount (default `0`); optional `FREE_DELIVERY_THRESHOLD` makes delivery free when the pre-discount product subtotal meets that amount. Both values use the store's chosen currency units.

Admin order-list and dashboard recent-order entries include both `user` and `customer` populated with `{_id, name, email, phone?}`. Dashboard returns `counts: {products,categories,orders,customers}`, matching top-level count aliases, non-cancelled `revenue`, and the five newest `recentOrders`. Popular catalog sorting uses sold quantity from non-cancelled orders, then newest as a stable fallback. Checkout and cancellation use MongoDB transactions. Cancelling an order is allowed only from `pending`, `confirmed`, or `processing`; status change, stock restoration, and coupon-use release commit atomically. Repeated cancellation is idempotent and does not restock twice. Delivered orders are eligible for reviews; reviews remain hidden publicly until an admin approves them. A replica-set-capable MongoDB deployment is therefore required; standalone MongoDB instances cannot run checkout or cancellation transactions.

## Checks

`npm run build` compiles the TypeScript application and scripts. `npm test` runs HTTP contract/access-control tests and coupon-calculation unit tests.
