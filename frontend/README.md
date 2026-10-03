# bun-react-tailwind-shadcn-template

To install dependencies:

```bash
bun install
```

To start a development server:

```bash
bun dev
```

By default the app runs on sample data with a pretend sign-in (any email and password), so it
needs nothing else running. To use the BFF in `../server` instead, start it and point the app at it:

```bash
BUN_PUBLIC_API_URL=http://localhost:3001 bun dev
```

The BFF seeds a demo account in development; its credentials are in `server/src/auth.ts`.

To run for production:

```bash
bun start
```

This project was created using `bun init` in bun v1.4.2. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
