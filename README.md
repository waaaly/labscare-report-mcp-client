# LabFlow MCP Studio

A multi-tenant AI Agent orchestration platform for laboratory workflows, built with Next.js 15, TypeScript, and MCP (Model Context Protocol).

## Features

- **Multi-Tenant Architecture**: Lab-based isolation with complete knowledge base separation
- **Project Workspace**: Complete workflow from document upload to script generation
- **Document Viewer**: Support for Excel/PDF preview with cell selection
- **Annotation Mapping**: Drag-and-drop field mapping from cells to system fields
- **Schema Builder**: Visual JSON Schema editor based on field mappings
- **LIMS Integration**: Query LIMS data via MCP tools
- **Script Generator**: Generate JavaScript extraction scripts based on templates
- **Knowledge Center**: Manage lab-specific knowledge base with version history
- **Execution & Debug**: Built-in script editor with execution and logging

## Tech Stack

- **Framework**: Next.js 15 (App Router + React 19 Server Components)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: Zustand (Lab Store + Project Store)
- **Database**: PostgreSQL + Prisma ORM
- **MCP Integration**: Custom MCP Client wrapper
- **Validation**: Zod
- **Icons**: Lucide React
- **Fonts**: Figtree (headings) + Noto Sans (body)

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd labscare-report-mcp-client
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/labscare-report-mcp-client"
MCP_SERVER_URL="http://localhost:3001"
NEXT_PUBLIC_APP_NAME="LabFlow MCP Studio"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

4. Set up the database:
```bash
npx prisma db push
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
labscare-report-mcp-client/
├── app/                      # Next.js App Router
│   ├── api/                 # API routes
│   │   └── labs/           # Lab-related endpoints
│   ├── dashboard/           # Dashboard page
│   ├── projects/            # Project pages
│   ├── knowledge/          # Knowledge center
│   ├── settings/           # Lab settings
│   └── layout.tsx         # Root layout
├── components/             # React components
│   ├── layout/            # Layout components (Header, Sidebar)
│   ├── ui/               # shadcn/ui components
│   └── workspace/        # Project workspace components
├── lib/                  # Utility functions
│   ├── mcp/             # MCP client wrapper
│   ├── prisma.ts        # Prisma client
│   └── utils.ts        # Helper functions
├── store/              # Zustand stores
│   ├── lab-store.ts    # Lab state management
│   └── project-store.ts # Project state management
├── types/              # TypeScript type definitions
├── prisma/            # Prisma schema and migrations
└── public/            # Static assets
```

## MCP Integration

The application integrates with MCP (Model Context Protocol) for:

- **Tool Calls**: `callMcpTool(name, args)` - Execute MCP tools
- **Resource Reads**: `readMcpResource(uri)` - Read MCP resources
- **Knowledge Base**: Load lab-specific knowledge via MCP resources

### Available MCP Tools

- `getProcessData`: Retrieve process data from LIMS
- `filterSamples`: Filter samples based on criteria
- `buildSignatureUrl`: Generate signed URLs for document access
- `generateScript`: Generate extraction scripts based on schema
- `simulateScript`: Test scripts in sandbox environment

## Design System

The application follows a professional laboratory design system with:

- **Colors**: Calm cyan (#0891B2) + Health green (#059669)
- **Typography**: Figtree (headings) + Noto Sans (body)
- **Accessibility**: WCAG AAA compliant with high contrast
- **Dark Mode**: Full dark mode support

See `design-system/labflow-mcp-studio/MASTER.md` for complete design specifications.

## Database Schema

### Core Models

- **Lab**: Multi-tenant workspace with isolated knowledge base
- **Project**: Data extraction projects within a lab
- **Document**: Uploaded documents (Excel/PDF)
- **Schema**: JSON Schema definitions
- **Script**: Generated extraction scripts
- **LabMember**: Lab members with RBAC

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript type checking
npm run db:push      # Push schema changes to database
npm run db:studio    # Open Prisma Studio
```

## Development Workflow

1. **Create a Lab**: Use the Lab Switcher to create/select a lab
2. **Create a Project**: Navigate to Projects and create a new project
3. **Upload Documents**: Upload Excel/PDF reports in the Document Viewer
4. **Map Fields**: Create field mappings in the Annotation Mapping tab
5. **Build Schema**: Define JSON Schema in the Schema Builder
6. **Query LIMS**: Fetch sample data using the LIMS Data panel
7. **Generate Script**: Generate extraction script based on your configuration
8. **Test & Debug**: Execute and debug scripts in the Execution & Debug panel

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Support

For support, please open an issue in the repository or contact the development team.
