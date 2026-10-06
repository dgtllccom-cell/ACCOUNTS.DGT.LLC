# Repository Directory Architecture

Permanent, standardized folder structure for **ACCOUNTS.DGT.LLC**.

```
ACCOUNTS.DGT.LLC/
├── app/                        # Next.js App Router pages and API endpoints
│   ├── api/                    # Server-side API endpoints (ERP, auth, roznamcha, ledgers, etc.)
│   ├── dashboard/              # Protected ERP web interface pages
│   ├── globals.css             # Design system styling & Tailwind rules
│   └── layout.tsx              # Root HTML & metadata provider layout
├── components/                 # Global shared UI components (buttons, dialogs, layout frames)
├── database/                   # Database resources & migrations
│   └── migrations/             # Dedicated folder for all SQL migration scripts
├── deployment/                 # Dedicated folder for deployment, VPS, SSH, & 1-click batch scripts
│   ├── deploy.bat              # Primary 1-click deployment script
│   ├── double-click-to-deploy.bat # Deployment with build & test verification
│   ├── double-click-to-fix-502.bat # 1-click 502 Bad Gateway recovery tool
│   ├── server-fix-502.ps1      # Remote SSH Nginx / PM2 repair script
│   └── README.md               # Detailed deployment script documentation
├── docs/                       # Complete repository documentation
│   ├── DEPLOYMENT_GUIDE.md     # Production release instructions
│   ├── SERVER_SETUP.md         # Production VPS setup manual
│   ├── RECOVERY_STEPS.md       # Incident & disaster recovery manual
│   ├── ENVIRONMENT_CONFIG.md   # Environment variable guide
│   └── PROJECT_STRUCTURE.md    # Folder structure blueprint (this file)
├── env_backups/                # Environment configuration templates
│   ├── .env.example            # Local development template
│   ├── .env.production.example # Production environment blueprint
│   ├── .env.staging.example    # Staging environment blueprint
│   └── README.md               # Environment setup instructions
├── features/                   # Domain-driven modular business logic
│   ├── accounts/               # Chart of Accounts management
│   ├── branches/               # Multi-country & branch hierarchy management
│   ├── customers/              # Customer master data
│   ├── inventory/              # Goods & stock booking
│   ├── purchases/              # Purchase orders & purchase journal
│   ├── roznamcha/              # Cash journal & daily postings
│   └── users/                  # RBAC user management & profile control
├── lib/                        # Core utilities, DB ORM schemas, & repositories
│   ├── db/                     # Drizzle ORM schemas & connection provider
│   ├── repositories/           # Data access repository layer
│   └── services/               # Core business services
├── public/                     # Static web assets, logos, and icons
├── scripts/                    # Maintenance, seeders, and internal development tools
├── supabase/                   # Supabase integration configurations & migrations mirror
├── tests/                      # Vitest unit tests & Playwright end-to-end test suites
├── .env.example                # Root environment template
├── .gitignore                  # Git tracking exclusion rules
├── deploy.bat                  # Root 1-click deployment shortcut (delegates to deployment/)
├── double-click-to-deploy.bat  # Root deployment shortcut (delegates to deployment/)
├── drizzle.config.ts           # Drizzle Kit configuration
├── ecosystem.config.cjs        # PM2 process configuration for production VPS
├── next.config.ts              # Next.js configuration
├── package.json                # Project dependencies & npm commands
└── README.md                   # Primary repository onboarding guide
```
