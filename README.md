# DynoCanvas

Web-based GUI specialized for Single Table Design in Amazon DynamoDB.

## 📢 Recent Updates (v0.2.0)

- **AWS Profile Switching**: Seamlessly switch between AWS profiles directly from the header dropdown. Profile information and Account IDs are now displayed for better environment awareness.
- **CSV Export Support**: Export search results or selected items to CSV format via the new "Actions" dropdown.
- **Search Settings**: Manage display count preferences (100, 250, 500, 1000 items) with cookie-based persistence through the new Search Settings menu.
- **Reorganized UI Layout**: Pagination controls moved to the top of the item table for improved accessibility. Settings page reorganized into "Table Information" and "System Environment" sections.
- **Actions Dropdown**: New unified dropdown menu for bulk operations including delete and export actions.
- **Read-Only Mode**: Environment-based read-only mode to prevent accidental data modification.
- **Basic Authentication**: Added support for Basic Authentication to secure the application.

## ✨ Features

- **Table Dashboard**: Automatically lists all available DynamoDB tables in your region.
- **Profile, Environment & Region Switching**: 
  - **AWS Profile Switcher**: Switch between AWS profiles from your local credentials file directly via the header dropdown.
  - Seamlessly switch between **AWS** and **DynamoDB Local** environments using a unified dropdown in the global header.
  - **Region Switcher**: Easily switch between AWS regions (e.g. `ap-northeast-1`, `us-east-1`) without restarting.
- **Table Management**: 
  - Create new tables easily with a standard schema (Partition Key: `PK`, Sort Key: `SK`).
  - **Delete Tables & Indexes**: Table and GSI deletion is only available in Local environment, and can be completely disabled via Read-Only Mode.
- **Enhanced UI/UX**:
  - **Modern Interface**: Clean, responsive layout with **Material Symbols** across the platform.
  - **Dynamic Sidebar**: Collapsible sidebar with state persistence via cookies.
  - **Dark Mode**: Support for Light, Dark, and System themes.
  - **Account Context**: Displays the current AWS Account ID for secure environment identification.
- **Security & Access Control**:
  - **Read-Only Mode**: disable all write operations via `DYNOCANVAS_READONLY` environment variable.
  - **Basic Authentication**: Protect the application with Basic Auth using `DYNOCANVAS_AUTH` environment variable.
- **Advanced Search**:
  - **Free Search**: Query items directly using Partition Key and optional Sort Key.
  - **Access Pattern Search**: Search using application-specific access patterns with dynamic parameter inputs.
  - **URL Synchronization**: Search conditions and modes are synced with the URL, making it easy to share search results.
  - **Pagination**: Navigate through large result sets with adjustable page sizes (100, 250, 500, 1000 items).
  - **Typed Attributes**: Search results display item attributes in **DynamoDB JSON** format to clearly visualize data types.
- **Table Settings & Access Patterns**:
  - **Unified Settings Modal**: Centralized management for table configurations.
  - **Access Pattern Management**:
    - Define and manage access patterns directly through the UI.
    - **Account & Region Isolation**: Patterns are stored with isolation by AWS Account ID and Region, supporting multi-account setups.
    - Supports GSI queries by specifying an Index Name.
  - **GSI Management**: 
    - View, Create, and Delete (Local only) Global Secondary Indexes.
  - **TTL Management**:
    - Enable/Disable Time To Live (TTL) on items with a custom attribute name.
- **Item Operations**:
  - **Create & Edit Items**:
    - **Dual Editor Modes**: Switch between **Simple JSON** for easy editing and **DynamoDB JSON** for precise type control (e.g. `{"S": "value"}`).
    - **Set Support**: Fully supports String Sets (`SS`), Number Sets (`NS`), and Binary Sets (`BS`) exclusively in DynamoDB JSON mode.
    - **JSON Formatting**: One-click "Format" button to beautify JSON code.
    - Embedded Monaco Editor (VS Code style) for a powerful editing experience.
  - **Delete Items**: Remove items individually or in bulk from the dashboard.
  - **Bulk Delete**: Select multiple items via checkboxes and delete them all at once with a confirmation modal listing the selected keys.
  - **Safe Key Updates**: Automatically handles Primary Key (PK/SK) changes by transactionally deleting the old item and creating a new one (with user confirmation).
  - **Import & Export**:
    - **Export Items**: Export search results to JSONL (JSON Lines) format with DynamoDB JSON marshalled format.
    - **CSV Export**: Export search results or selected items to CSV format via the Actions dropdown.
    - **Import Items**: Bulk import items from JSONL files with validation and batch processing (25 items per batch).
    - **Export Access Patterns**: Export all access pattern definitions to JSONL format via Settings.
    - **Import Access Patterns**: Import access pattern definitions from JSONL files via Settings.
    - **Timestamped Filenames**: Exported files include timestamps (e.g. `free-search_20250101120000123.jsonl`).
  - Validates JSON before saving to prevent errors.
- **Settings & System Management**:
  - **Settings Page**: View current environment details (Region, Mode).
  - **Admin Table Management**: Export or Import the entire internal admin table (containing Access Patterns) for backup or migration.
  - **Admin Table Deletion**: Reset the system by deleting the admin table (Local mode only).
- **Internationalization (i18n)**: Fully localized interface supporting **English** and **Japanese**. Language settings are persisted.
- **Modern UI**: 
  - Clean, responsive interface with Dark Mode support.
  - **Sidebar Navigation**: Quick access to Tables and Settings.

## 🛠 Tech Stack

- **Framework**: [Next.js 16+](https://nextjs.org/) (App Router & Server Actions)
- **Language**: TypeScript
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **AWS SDK**: [AWS SDK for JavaScript v3](https://aws.amazon.com/sdk-for-javascript/)
- **Editor**: [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- **Icons**: [Material Symbols](https://fonts.google.com/icons)
- **Container**: [Distroless Node.js](https://github.com/GoogleContainerTools/distroless)

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- AWS Credentials configured (via environment variables, `~/.aws/credentials`, or IAM roles).
- (Optional) DynamoDB Local running (e.g. via Docker or JAR).

### Installation

```bash
git clone git@github.com:hiroki-kawasaki/dyno-canvas.git
```

```bash
cd dyno-canvas
```

### Configuration

Create a `.env.local` file in the root directory to configure the application:

```env
# AWS Credentials
AWS_PROFILE=your-aws-profile-name
# AWS_ACCESS_KEY_ID=your-access-key-id
# AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_REGION=ap-northeast-1

# DynamoDB Local Endpoint (if using DynamoDB Local)
DYNAMODB_ENDPOINT=http://localhost:8000

# Base Path (e.g. /dynocanvas)
DYNOCANVAS_BASE_PATH=/

# Security: Set to 'true' to enable read-only mode (Disable all write operations)
# DYNOCANVAS_READONLY=false
#
# Authentication: 'none' or 'basic'
# DYNOCANVAS_AUTH=none
#
# Basic Auth Credentials (only used if DYNOCANVAS_AUTH=basic)
# DYNOCANVAS_AUTH_USER=admin
# DYNOCANVAS_AUTH_PASS=dynocanvas

# Available Regions (comma separated)
# Include 'local' to enable DynamoDB Local environment (Always displayed at the top)
# DYNOCANVAS_REGIONS=local,ap-northeast-1,us-east-1

# Custom Table Name for Admin/Metadata (Default: dyno-canvas)
# DYNOCANVAS_ADMIN_TABLE_NAME=dyno-canvas
```

### 🛠 Makefile Commands

The project includes a `Makefile` for common development tasks:

- `make install`: Install dependencies.
- `make dev`: Start the development server.
- `make build`: Build the production bundle.
- `make lint`: Run ESLint.
- `make test`: Run the test suite.
- `make docker-up`: Start the application with Docker Compose.
- `make docker-down`: Stop the Docker Compose services.

### 🐳 Running the Application with Docker

You can easily run DynamoDB Web using Docker.

```bash
docker compose up -d
```

Open [http://localhost:8001](http://localhost:8001) with your browser.


### Running the Application (Development)

Start the development server:

```bash
npm install --omit=dev
```

```bash
npm run build
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.


## 📖 Usage

* **Navigation**: Use the **Sidebar** to navigate between:
  * **Dashboard**: Overview of tables and system status.
  * **Tables**: List of all available DynamoDB tables.
  * **Settings**: System settings and administration.
* **Header**: Use the global header to switch **Language** or **Region**.
* **Create Table**: Click **"New Table"** on the Dashboard or Table List.
* **Admin Table Management**:
  * **Creation**: If the Admin Table is missing, a prompt will appear on the Dashboard to create it.
  * **Deletion**: (Local Only) You can delete the Admin Table from the **Settings** page.
* **Table Settings**: Click the **"Settings"** button on the dashboard to:
  *   **Manage Access Patterns**: Define query templates.
  *   **Manage GSI**: Create or delete Global Secondary Indexes.
  *   **Manage TTL**: Enable or disable Time To Live.
* **Search Items**:
  * **Free Search**: Query using PK/SK.
  * **Access Pattern Search**: (Requires Admin Table) Search using defined patterns.
* **Item Operations**:
  * **Create/Edit/Delete**: Full CRUD operations with support for simple and typed JSON.
  * **Bulk Actions**: Delete multiple items or export results.
* **Import/Export**:
  * **Items**: JSONL import/export for table data.
  * **Access Patterns**: Backup/Restore the entire Admin Table configuration via **Settings**.


## ⚙️ How Access Patterns Work

Access Patterns allow you to map your Single Table Design queries to user-friendly forms. When you define a pattern with a format like `User#{UserId}`, the UI will automatically generate an input field for `UserId`.
Stored patterns use the following structure in the Admin Table (Default: `dyno-canvas`):

* **PK**: `AccountId#<AccountId>#DynoCanvas#AccessPattern`
* **SK**: `Region#<Region>#TableName#<TableName>#AccessPatternId#<AccessPatternId>`

This schema ensures that access patterns are isolated by **AWS Account** and **Region**, preventing conflicts when switching environments.


## 📄 License

This project is licensed under the MIT License.

---

## ℹ️ Disclaimer Regarding the Use of Generative AI
We are using generative AI in development.

The tools used for development are as follows:
- Google Antigravity
- Gemini CLI
- Google Gemini (Web)
- Claude (Web)

The models used for development are as follows.
- Google Gemini 3.0 Pro
- Google Gemini 3.0 Flash
- Claude Opus 4.5