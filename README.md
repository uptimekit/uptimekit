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

<!--![GitHub Stars](https://www.shieldcn.dev/github/stars/uptimekit/uptimekit.svg?variant=secondary) ![Last commit](https://www.shieldcn.dev/github/last-commit/uptimekit/uptimekit.svg?variant=secondary) ![Release](https://www.shieldcn.dev/github/release/uptimekit/uptimekit.svg) ![CI](https://www.shieldcn.dev/github/ci/uptimekit/uptimekit.svg?variant=secondary) ![License](https://www.shieldcn.dev/github/license/uptimekit/uptimekit.svg?variant=branded)-->
![badges](https://shieldcn.dev/group/github/stars/uptimekit/uptimekit+github/forks/uptimekit/uptimekit+github/license/uptimekit/uptimekit.svg?variant=outline)

<br/>

## ✨ Features

UptimeKit is designed to be the all-in-one solution for tracking your services' uptime and communicating with your users.

- 📊 **Monitoring** - Real-time uptime monitoring for your HTTP/TCP services.
- 🚦 **Status Pages** - Beautiful, customizable status pages for your users.
- 🔔 **Incidents** - Create and manage incident reports to keep users informed.
- 🏢 **Organizations** - Multi-tenant support with team management.
- 📈 **Analytics** - Detailed uptime and response time metrics.
- 🛠️ **Self-Hostable** - Full control over your data and infrastructure.

## How it works

Uptimekit is a distributed monitoring solution. You can have as many workers as you want and as many replicas of the app as you want.
The workers check with the app every 15 seconds to get their assigned monitors and run the checks whenever they have to.

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

- pnpm
- Redis
- Clickhouse
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

    Copy the `.env.example` file in `.env`

4. **Database Setup**

    Push the schema to your database:

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
│   ├── worker/        # Probe who actually pings the monitors
│   └── status-page/   # Public Status Page application
├── packages/
│   ├── api/           # Shared API definition & logic
│   ├── auth/          # Authentication configuration
│   ├── db/            # Database schema & Drizzle config
│   ├── scheduler/     # Scheduler application
│   └── config/        # Shared configuration (TS, ESLint, etc.)
└── ....
```

## 💝 Sponsors

Thank you to all our amazing sponsors who make this project possible!


**[Become a sponsor](https://github.com/sponsors/irazvan2745)** and get your logo here!

## 👀 Previews

### Default theme with length bars

![image](https://r2.uptimekit.dev/previews/default-lenght.png)

### Flat theme with length bars

![image](https://r2.uptimekit.dev/previews/flat-lenght.png)

### Signal theme with signal bars

![image](https://r2.uptimekit.dev/previews/signal-signal.png)

## 🤝 Contributing

We welcome contributions! Please check out our [Contributing Guide](CONTRIBUTING.md) for details on how to submit pull requests, report issues, and request features.

## 📄 License

This project is licensed under a [MIT License](LICENSE)

---

<div align="center">
  <sub>Built with ❤️ by the UptimeKit Team</sub>
</div>
