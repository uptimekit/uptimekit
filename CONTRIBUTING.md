# Contributing to UptimeKit

Thank you for your interest in contributing to UptimeKit! We welcome contributions from the community to help make this project better.

This guide will help you get started with the development workflow and explain how to contribute effectively.

## 🛠️ Tech Stack

Before diving in, it helps to be familiar with the core technologies we use:

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Monorepo**: [Turborepo](https://turbo.build/)
- **Package Manager**: [pnpm](https://pnpm.io/)
- **Database**: [PostgreSQL](https://www.postgresql.org/) & [Drizzle ORM](https://orm.drizzle.team/)
- **Styling**: [TailwindCSS](https://tailwindcss.com/) & [shadcn/ui](https://ui.shadcn.com/)
- **State/Data**: [TanStack Query](https://tanstack.com/query/latest) & [oRPC](https://orpc.unstack.io/)
- **Linting/Formatting**: [Biome](https://biomejs.dev/)

## 🚀 Getting Started

1. **Fork and Clone**
    Fork the repository to your GitHub account and clone it locally:

    ```bash
    git clone https://github.com/yourusername/uptimekit.git
    cd uptimekit
    ```

2. **Install Prerequisites**
    Ensure you have the following installed:
    - Node.js 20+
    - pnpm 9+ (`npm install -g pnpm`)
    - Docker (optional, but recommended for local DB)

3. **Install Dependencies**

    ```bash
    pnpm install
    ```

4. **Environment Setup**
    Copy the `.env.example` file in `apps/dash` to `.env` and configure your environment variables.

    ```bash
    cp apps/dash/.env.example apps/dash/.env
    ```

    You will need a connection string for a PostgreSQL database.

5. **Database Setup**
    Push the database schema:

    ```bash
    pnpm run db:push
    ```

6. **Run Development Server**

    ```bash
    pnpm run dev
    ```

    This will start all applications in the monorepo.
    - Dashboard: `http://localhost:3000`
    - Status Page: `http://localhost:3001`
    - Docs: `http://localhost:4000`

## 📂 Project Structure

```text
uptimekit/
├── apps/
│   ├── dash/          # Main Dashboard application (Next.js)
│   ├── status-page/   # Public Status Page application (Next.js)
│   ├── worker/        # Worker application (Node.js)
│   └── docs/          # Documentation (Next.js)
├── packages/
│   ├── api/           # Shared API definition & logic (oRPC)
│   ├── auth/          # Authentication configuration (Better-Auth)
│   ├── db/            # Database schema & Drizzle config
│   └── config/        # Shared configuration (TS, ESLint, etc.)
└── ...
```

## 💻 Development Workflow

### Creating a Branch

Create a new branch for your feature or fix:

```bash
git checkout -b feature/my-new-feature
# or
git checkout -b fix/bug-description
```

### Code Style

We use **Biome** for linting and formatting. Please ensure your code passes checks before pushing.

```bash
# Check for issues
pnpm run check

# Fix issues automatically
pnpm run check --write
```

Pre-commit hooks (Husky) are configured to run these checks automatically.

### Database Changes

If you modify the database schema (in `packages/db/src/schema.ts`):

1. Run `pnpm run db:push` to apply changes to your local DB.
2. (Optional) Use `pnpm run db:studio` to inspect your database.

### Committing

Please write clear and descriptive commit messages.

### Pull Requests

1. Push your branch to your fork.
2. Open a Pull Request against the `development` branch of the original repository.
3. Provide a clear description of your changes, screenshots (if UI related), and link to any relevant issues.

## 🐛 Reporting Issues

If you find a bug or have a feature request, please open an issue on GitHub.

- Check existing issues to avoid duplicates.
- Provide a detailed description, reproduction steps, and environments.

## 📄 License

By contributing, you agree that your contributions will be licensed under the modified MIT License (see [LICENSE](LICENSE)).
