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
- **Database**: [PostgreSQL](https://www.postgresql.org/) with [Drizzle ORM](https://orm.drizzle.team/) & [ClickHouse](https://clickhouse.com/)
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

1. **Clone the repository**

    ```bash
    git clone https://github.com/uptimekit/uptimekit.git
    cd uptimekit
    ```

2. **Install dependencies**

    ```bash
    pnpm install
    ```

3. **Environment Setup**

    Copy the `.env.example` files in `apps/dash`, `apps/status-page`, `apps/scheduler`.

4. **Database Setup**

    Push the schema to your local database:

    ```bash
    pnpm run db:push
    ```

5. **Run Development Server**

    Start all applications (Dashboard, Status Page, Marketing/Docs):

    ```bash
    pnpm run dev
    ```

    - **Dashboard**: [http://localhost:3000](http://localhost:3000)
    - **Status Page**: [http://localhost:3001](http://localhost:3001)

## 📂 Project Structure

```bash
uptimekit/
├── apps/
│   ├── dash/          # Main Dashboard application
│   └── status-page/   # Public Status Page application
├── packages/
│   ├── api/           # Shared API definition & logic
│   ├── auth/          # Authentication configuration
│   ├── db/            # Database schema & Drizzle config
│   ├── scheduler/     # Scheduler application
│   └── config/        # Shared configuration (TS, ESLint, etc.)
└── ....
```

<!-- SPONSORS:START -->
## 💝 Sponsors

Thank you to all our amazing sponsors who make this project possible!

### ❤️ Supporters

<div align="center">
  <a href="https://github.com/msikorski26" title="Mateusz Sikorski">
    <img src="https://avatars.githubusercontent.com/u/41286754?u=0d0f70f1292eda8fca8eda57c532aadf7bdf5fca&v=4" width="40" height="40" alt="Mateusz Sikorski" style="border-radius: 50%; margin: 4px;" />
  </a>
  <a href="https://github.com/Xmonpl" title="Xmon">
    <img src="https://avatars.githubusercontent.com/u/31248347?u=2d77e3976ab8885b27d4dacda2f6c804d1fd3914&v=4" width="40" height="40" alt="Xmon" style="border-radius: 50%; margin: 4px;" />
  </a>
  <a href="https://github.com/mscode-pl" title="MsCode.pl">
    <img src="https://avatars.githubusercontent.com/u/116160490?v=4" width="40" height="40" alt="MsCode.pl" style="border-radius: 50%; margin: 4px;" />
  </a>
  <a href="https://github.com/l1806-vex" title="Jakub">
    <img src="https://avatars.githubusercontent.com/u/220633171?u=2ed36eca482294022900ca95f93caa9924515553&v=4" width="40" height="40" alt="Jakub" style="border-radius: 50%; margin: 4px;" />
  </a>
</div>

**[Become a sponsor](https://github.com/sponsors/stripsior)** and get your logo/avatar here!
<!-- SPONSORS:END -->

## 🤝 Contributing

We welcome contributions! Please check out our [Contributing Guide](CONTRIBUTING.md) for details on how to submit pull requests, report issues, and request features.

## 📄 License

This project is licensed under a [MIT License](LICENSE)

---

<div align="center">
  <sub>Built with ❤️ by the UptimeKit Team</sub>
</div>
