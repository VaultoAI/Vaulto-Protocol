# Vaulto Protocol - Claude Code Instructions

## Project Overview

Vaulto Protocol is a trading platform for synthetic tokens representing private companies. The frontend is built with Next.js and displays company data fetched from a PostgreSQL database (Supabase).

## Adding a New Company

When adding a new private company to the platform, follow these steps:

### Step 1: Database Entry

Add the company to the `private_companies` table in Supabase. Required fields:
- `id` (integer) - Unique identifier
- `name` (text) - Company name
- `industry` (text) - Industry category
- `description` (text) - Company description
- `website` (text) - Company website URL
- `valuation_usd` (bigint) - Current valuation in USD
- `valuation_as_of` (text) - Date of valuation
- `total_funding_usd` (bigint) - Total funding raised
- `last_funding_round_type` (text) - e.g., "Series C", "Seed"
- `last_funding_date` (text) - Date of last funding
- `employees` (integer) - Employee count
- `ceo` (text) - CEO name
- `products` (text) - JSON array of products (see format below)

Products JSON format:
```json
[
  {"name": "Product Name", "description": "Product description here."},
  {"name": "Another Product", "description": "Another description."}
]
```

### Step 2: Symbol Override (if needed)

If the company name doesn't generate a clean symbol, add an override in `lib/vaulto/companies.ts`:

```typescript
const SYMBOL_OVERRIDES: Record<string, string> = {
  "Company Name": "vSymbol",
  // ...
};
```

### Step 3: Logo Configuration

1. **Preferred**: Add a static logo file to `/public/companies/` and map it in `lib/utils/companyLogo.ts`:

```typescript
const STATIC_LOGO_MAP: Record<string, string> = {
  companyname: "companyname.png",
  // ...
};
```

2. **Alternative**: Add domain mapping for favicon fallback:

```typescript
const COMPANY_DOMAIN_MAP: Record<string, string> = {
  companyname: "company.com",
  // ...
};
```

### Step 4: Verify Display

After adding, verify the company appears correctly on:
- Company list page
- Individual company detail page
- Swap/trading interface

---

## IMPORTANT: AI Content Rewriting Requirement

**All sentence-length or longer text content MUST be rewritten using AI before being added to the database.**

This applies to:
- Company descriptions
- Product descriptions
- Any other prose content (funding round notes, etc.)

### Why Rewrite Content?

1. **Avoid copyright issues** - Source material may be copyrighted
2. **Maintain consistent voice** - All descriptions should have a similar professional tone
3. **Remove marketing language** - Strip promotional fluff and focus on factual information
4. **Ensure accuracy** - Verify claims while rewriting

### Rewriting Guidelines

When rewriting text content:

1. **Keep the same factual information** - Don't add or remove key facts
2. **Use neutral, professional tone** - Avoid superlatives like "revolutionary", "groundbreaking"
3. **Be concise** - Aim for 2-4 sentences for company descriptions
4. **Focus on what the company does** - Products, services, market position
5. **Include relevant context** - Founding year, headquarters, key differentiators

### Example Transformation

**Original (DO NOT USE):**
> "Acme Corp is a revolutionary AI company that is disrupting the industry with its groundbreaking technology platform. Founded by visionary leaders, Acme is poised to change the world."

**Rewritten (CORRECT):**
> "Acme Corp develops artificial intelligence software for enterprise automation. The company's platform enables businesses to streamline workflows through machine learning models trained on proprietary data. Acme serves customers across manufacturing, logistics, and healthcare sectors."

### Creating Update Scripts

When adding or updating company descriptions, create a script in `scripts/` following this pattern:

```typescript
// scripts/update-company-descriptions.ts
import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// Define rewritten content as constants
const COMPANY_DESCRIPTION = `Rewritten description here.`;

const PRODUCTS = [
  { name: "Product", description: "Rewritten product description." },
];

async function main() {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE private_companies SET description = $1, products = $2 WHERE id = $3`,
      [COMPANY_DESCRIPTION, JSON.stringify(PRODUCTS), COMPANY_ID]
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main();
```

Run with: `npx tsx scripts/update-company-descriptions.ts`

---

## Database Tables

### `private_companies` (main company data)
- Uses snake_case column names
- Products stored as JSON string in `products` column
- Not managed by Prisma (use raw SQL queries)

### `PrivateCompany` (Prisma-managed, legacy)
- Uses PascalCase table name
- Separate `CompanyProduct` table for products
- May have different data than `private_companies`

**Note:** Always use the `private_companies` table for company data operations.

---

## Scripts

- `scripts/migrate-companies.ts` - Migrate from Railway API to Supabase
- `scripts/update-company-descriptions.ts` - Update company/product descriptions
- `scripts/query-ssi.ts` - Query example for SSI company data

Run scripts with: `npx tsx scripts/<script-name>.ts`
