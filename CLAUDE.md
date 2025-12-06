# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Overleaf Extended Community Edition - an open-source online real-time collaborative LaTeX editor. This is a fork with additional features: Template Gallery, Sandboxed Compiles, LDAP/SAML/OIDC authentication, real-time track changes, symbol palette, and "From External URL" feature.

## Development Environment

### Initial Setup
```bash
cd develop
bin/build          # Build all services
bin/up             # Start services (access http://localhost/launchpad)
```

### Development Mode (auto-reload on code changes)
```bash
cd develop
bin/dev                    # Start all services with --watch
bin/dev web webpack        # Start specific services in dev mode
```

### Building Docker Images
```bash
cd server-ce
make build-base      # Build sharelatex/sharelatex-base:ext-ce
make build-community # Build sharelatex/sharelatex:ext-ce
```

### TeX Live for PDF Compilation
```bash
cd develop
docker build texlive -t texlive-full
```

## Testing

### Web Service Tests (from services/web/)
```bash
make test                    # Run all tests
make test_unit               # Unit tests only
make test_unit MOCHA_GREP='AuthorizationManager'  # Filter tests
make test_unit_module MODULE=saas-authentication  # Single module
make test_acceptance         # Acceptance tests
make test_acceptance_module MODULE=saas-authentication
make test_frontend           # Frontend JSDOM tests
make test_frontend_ct        # Cypress component tests
```

### Running Single Test File
```bash
# Unit tests use mocha with --grep for filtering
MOCHA_GREP='specific test name' make test_unit
```

## Linting and Formatting

```bash
npm run lint         # ESLint (root)
npm run lint:fix     # Auto-fix ESLint issues
npm run format       # Check Prettier formatting
npm run format:fix   # Auto-fix formatting
```

For web service (services/web/):
```bash
npm run lint:styles      # Stylelint for SCSS
npm run type-check       # TypeScript frontend
npm run type-check:backend  # TypeScript backend
```

## Architecture

### Monorepo Structure
- **services/**: Microservices (chat, clsi, contacts, docstore, document-updater, filestore, history-v1, linked-url-proxy, notifications, project-history, real-time, references, web)
- **libraries/**: Shared npm packages (@overleaf/logger, @overleaf/metrics, @overleaf/redis-wrapper, etc.)
- **server-ce/**: Docker build files and runit init scripts
- **develop/**: Development environment with docker-compose

### Web Service (services/web/)
The main HTTP frontend handling UI and business logic:
- **app/src/Features/**: Backend feature modules (Authentication, Project, Editor, Compile, etc.)
- **app/src/infrastructure/**: Core infrastructure (Express setup, MongoDB, Redis)
- **frontend/js/**: React frontend code
- **frontend/js/features/**: Frontend feature modules (source-editor, pdf-preview, etc.)
- **modules/**: Optional feature modules (admin-panel, authentication, launchpad, sandboxed-compiles, template-gallery, track-changes)

### Service Communication
- Services communicate via HTTP REST APIs
- Redis for real-time pub/sub and caching
- MongoDB for persistence
- Real-time updates via Socket.IO (real-time service)

### Module System
Web modules in `services/web/modules/` extend functionality:
- Each module has its own `index.mjs` entry point
- Modules can add routes, middleware, and frontend components
- Enabled modules are configured in settings

## Debugging

Development mode exposes debug ports:
| Service | Port |
|---------|------|
| web | 9229 |
| clsi | 9230 |
| chat | 9231 |
| document-updater | 9234 |

Attach debugger at `chrome://inspect` or IDE debugger to `localhost:<port>`.

## Key Configuration Files

- `services/web/config/settings.defaults.js`: Default web service settings
- `develop/dev.env`: Development environment variables
- `docker-compose.yml`: Production compose configuration
- `develop/docker-compose.yml`: Development compose configuration
