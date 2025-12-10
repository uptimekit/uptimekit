# Uptimekit Rules

## Project Structure

This is a monorepo with the following structure:

- **`apps/web/`** - Fullstack application (Next.js)


- **`packages/api/`** - Shared API logic and types
- **`packages/auth/`** - Authentication logic and utilities
- **`packages/db/`** - Database schema and utilities


## Available Scripts

- `pnpm run dev` - Start all apps in development mode

## Database Commands

All database operations should be run from the web workspace:

- `pnpm run db:push` - Push schema changes to database
- `pnpm run db:studio` - Open database studio
- `pnpm run db:generate` - Generate Drizzle files
- `pnpm run db:migrate` - Run database migrations

Database schema files are located in `apps/web/src/db/schema/`

## API Structure

- oRPC endpoints are in `packages/api/src/api/`
- Client-side API utils are in `apps/web/src/utils/api.ts`

## Authentication

Authentication is enabled in this project:
- Server auth logic is in `packages/auth/src/lib/auth.ts`
- Web app auth client is in `apps/web/src/lib/auth-client.ts`

## Key Points

- This is a Turborepo monorepo using pnpm workspaces
- Each app has its own `package.json` and dependencies
- Run commands from the root to execute across all workspaces
- Run workspace-specific commands with `pnpm run command-name`
- Turborepo handles build caching and parallel execution

## Code Guidelines

### Formatting & Style
- **Consistency**: Rely on Prettier and ESLint to enforce standard formatting.
- **Imports**: Organize imports logically (External packages -> Internal monorepo packages -> Relative imports).
- **Naming**: Use `camelCase` for functions/variables and `PascalCase` for components/interfaces. Make names descriptive (e.g., `fetchUserData` instead of `getData`).

### Functions
- **Single Responsibility**: Functions should aim to do one thing well.
- **Guard Clauses**: Use early returns to reduce nesting and cognitive load.
- **Size**: Keep functions small. distinct logic blocks should often be extracted into helper functions.
- **Parameters**: Limit the number of arguments (max ~3). Use a configuration object for more complex signatures.

### Comments
- **Explain "Why", Not "What"**: The code itself explains what is happening. Use comments to explain the *intent*, business logic, or complex decisions behind the code.
- **Avoid Clutter**: Do not comment obvious logic (e.g., `// Update count` above `count++`).
- **Function headers**: Use JSDoc/TSDoc for public-facing utilities to document params and return values.
- **TODOs**: Use `// TODO:` to mark areas for improvement, but address them sooner rather than later.
