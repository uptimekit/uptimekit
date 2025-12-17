<div align="center">
  <a href="https://uptimekit.dev">
    <img src="https://r2.uptimekit.dev/logos/uptimekit.svg" alt="UptimeKit Logo" width="120" height="120">
  </a>

  <h1 align="center">UptimeKit</h1>

  <p align="center">
    <strong>The modern open-source status page and monitoring solution.</strong>
  </p>

  <p align="center">
    <a href="#features">Features</a> •
    <a href="#getting-started">Getting Started</a> •
    <a href="#tech-stack">Tech Stack</a> •
    <a href="#contributing">Contributing</a>
  </p>

  <br/>

  <img src="https://r2.uptimekit.dev/banners/banner-smaller.png" alt="UptimeKit Banner" width="100%">
</div>

<br/>

> [!CAUTION]
> This project is in early stage of development and some problems can occur. Please open issue for all bugs and feature requests.

## ✨ Features

UptimeKit is designed to be the all-in-one solution for tracking your services' uptime and communicating with your users.

- 📊 **Monitoring** - Real-time uptime monitoring for your HTTP/TCP services.
- 🚦 **Status Pages** - Beautiful, customizable status pages for your users.
- 🔔 **Incidents** - Create and manage incident reports to keep users informed.
- 🏢 **Organizations** - Multi-tenant support with team management.
- 📈 **Analytics** - Detailed uptime and response time metrics.
- 🛠️ **Self-Hostable** - Full control over your data and infrastructure.

## 🚀 Tech Stack

Built with a modern, type-safe stack for maximum performance and developer experience.

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Database**: [PostgreSQL](https://www.postgresql.org/) with [Drizzle ORM](https://orm.drizzle.team/)
- **Styling**: [TailwindCSS](https://tailwindcss.com/) & [shadcn/ui](https://ui.shadcn.com/)
- **Authentication**: [Better-Auth](https://better-auth.com/)
- **API**: [oRPC](https://orpc.unstack.io/) & [OpenAPI](https://www.openapis.org/)
- **Monorepo**: [Turborepo](https://turbo.build/)

## 🛠️ Getting Started

Follow these steps to get UptimeKit running locally on your machine.

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL

### Installation

1.  **Clone the repository**

    ```bash
    git clone https://github.com/stripsior/uptimekit.git
    cd uptimekit
    ```

2.  **Install dependencies**

    ```bash
    pnpm install
    ```

3.  **Environment Setup**

    Copy the `.env.example` files in `apps/dash`.

4.  **Database Setup**

    Push the schema to your local database:

    ```bash
    pnpm run db:push
    ```

5.  **Run Development Server**

    Start all applications (Dashboard, Status Page, Marketing/Docs):

    ```bash
    pnpm run dev
    ```

    - **Dashboard**: [http://localhost:3000](http://localhost:3000)
    - **Status Page**: [http://localhost:3001](http://localhost:3001)
    - **Documentation**: [http://localhost:4000](http://localhost:4000)

## 📂 Project Structure

```bash
uptimekit/
├── apps/
│   ├── dash/          # Main Dashboard application
│   ├── status-page/   # Public Status Page application
│   ├── worker/        # Worker application
│   └── docs/          # Documentation site
├── packages/
│   ├── api/           # Shared API definition & logic
│   ├── auth/          # Authentication configuration
│   ├── db/            # Database schema & Drizzle config
│   └── ui/            # Shared UI components
└── ....
```

## 🤝 Contributing

We welcome contributions! Please check out our [Contributing Guide](CONTRIBUTING.md) for details on how to submit pull requests, report issues, and request features.

## 📄 License

This project is licensed under a modified [MIT License](LICENSE). Please check the file for specific usage restrictions.

---

<div align="center">
  <sub>Built with ❤️ by the UptimeKit Team</sub>
</div>
