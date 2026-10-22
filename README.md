# LittleJoy Toys API

An Express/TypeScript/Mongoose backend for the LittleJoy Toys storefront. This is a functional application foundation, not a claim of production readiness. Before deployment, review operational requirements, privacy obligations, monitoring, backups, cookie/CORS settings, and the security of your hosting environment.

## Setup

1. Use Node.js 20+ and a MongoDB replica set (transactions are required for checkout/cancellation consistency).
2. Copy `.env.example` to `.env`, set a unique random `JWT_SECRET` of at least 32 characters, and configure `MONGODB_URI`, `GOOGLE_CLIENT_ID`, `CORS_ORIGINS`, and cookie settings. The application does not include MongoDB or JWT credential fallbacks; production startup requires explicit values.
3. Run `npm install`, `npm run dev`; the API defaults to port 4000.
4. In separate commands as needed, set `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` (minimum 12 characters) and run `npm run admin:provision`. Provisioning refuses to change an existing admin or promote an existing account.
5. Run `npm run seed` to upsert demo categories/products.
6. For an existing database created by an earlier backend version, back up the database, verify the migration against a staging copy, then run `npm run migrate:storefront` once before deployment. It backfills legacy product fields (including active/featured defaults), category active/image fields, and order numbers/delivery fields without replacing existing product safety text. Do not run it against production without explicit approval. New databases do not need this migration.
7. `npm run build` compiles the application; `npm test` runs focused API and service tests.

Authentication supports email/password and Google Identity Services ID tokens. Google tokens are verified by the backend against `GOOGLE_CLIENT_ID`; unverified Google email addresses are rejected. Sessions use signed JWTs in HTTP-only cookies. The frontend's Next.js `/api` rewrite proxies to the backend so the browser handles these as first-party cookies; production cookies default to `Secure` and `SameSite=Lax`. Keep exact frontend origins in `CORS_ORIGINS`. Admin provisioning is intentionally separate from public registration.

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
| POST | `/api/auth/google` | Public, rate-limited | Verify Google ID credential and sign in/create customer |
| POST | `/api/auth/logout` | Public | Clear auth cookie |
| GET | `/api/auth/me` | Customer/admin | Current signed-in user |
| PATCH | `/api/auth/profile` | Customer/admin | Update only the signed-in user's name and phone |
| POST | `/api/orders` | Customer/admin | COD checkout (`items: [{productId, quantity}]`, `shippingAddress: {fullName, phone, addressLine1, addressLine2?, city, postalCode, country}`, optional `couponCode`) |
| GET | `/api/orders/my-orders` | Customer/admin | Current user's orders |
| GET | `/api/orders/:id` | Customer/admin | Order details, scoped to the signed-in owner |
| GET | `/api/admin/dashboard` | Admin | Live counts, delivered order value, and minimal recent-order summaries |
| GET | `/api/admin/customers` | Admin | Customer-only directory with safe fields and pagination (`page`, `limit`); includes `orderCount`, never password/token fields |
| GET | `/api/admin/products` | Admin | All products, paginated; optional `search`, category ObjectId, `stock`, `featured`, and active/archive `status` filters |
| POST | `/api/admin/products` | Admin | Create product (`name`, optional `slug` generated from name, `description`, `price`, either `stock` or `stockQuantity`, active `category` ObjectId, optional `compareAtPrice`, `images`, legacy `imageUrl`, `featured`, `ageRecommendation`, `safetyInformation`, `active`) |
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

Admin order-list entries include customer and delivery details; dashboard recent-order summaries intentionally omit those details. Dashboard returns `counts: {products,categories,orders,customers}`, matching top-level count aliases, delivered-order value, and the five newest summaries. Product `featured` is an optional boolean that defaults to `false`, including for existing documents. Popular catalog sorting uses sold quantity from non-cancelled orders, then newest as a stable fallback. Checkout and cancellation use MongoDB transactions. Cancelling an order is allowed only from `pending`, `confirmed`, or `processing`; status change, stock restoration, and coupon-use release commit atomically. Repeated cancellation is idempotent and does not restock twice. Delivered orders are eligible for reviews; reviews remain hidden publicly until an admin approves them. A replica-set-capable MongoDB deployment is therefore required; standalone MongoDB instances cannot run checkout or cancellation transactions.

## Checks

`npm run build` compiles the TypeScript application and scripts. `npm test` runs HTTP contract/access-control tests and coupon-calculation unit tests.
