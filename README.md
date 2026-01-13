# DynoCanvas [![CI](https://github.com/hiroki-kawasaki/dyno-canvas/actions/workflows/ci.yml/badge.svg)](https://github.com/hiroki-kawasaki/dyno-canvas/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Web-based GUI specialized for Single Table Design in Amazon DynamoDB.

## 📢 Project Overview

DynoCanvas is a specialized, web-based Graphical User Interface (GUI) designed for managing Amazon DynamoDB tables, with a specific focus on **Single Table Design** patterns. Built with Next.js, it allows developers to visualize, manipulate, and manage data across both AWS and local DynamoDB environments seamlessly.

DynoCanvas streamlines the workflow for developers working with DynamoDB by providing a robust interface for item management, schema design verification, and access pattern testing. It abstracts the complexity of raw DynamoDB JSON, offering dual editing modes and advanced search capabilities that align with modern single-table architecture strategies.

## ✨ Key Features

### 📦 Table & Data Management
* **Dashboard**: View all available tables in the connected region or local instance.
* **CRUD Operations**: Create, Read, Update, and Delete items. Supports replacement of items when Primary Keys are modified.
* **Batch Operations**: Bulk delete functionality for efficient data cleanup.
* **Table Administration**: Create new tables with standard `PK` and `SK` schema. Delete tables (configurable permissions).

### 🛠 Advanced Item Editor
* **Dual Modes**:
* **Simple JSON**: User-friendly editing for standard JSON objects.
* **DynamoDB JSON**: Full control over DynamoDB types (S, N, B, SS, NS, BS, etc.).
* **Monaco Editor Integration**: Embedded code editor with syntax highlighting, validation, and formatting.
* **Set Support**: specific support for String Sets, Number Sets, and Binary Sets in DynamoDB mode.

### 🔍 Search & Access Patterns
* **Free Search**: Query tables directly using Partition Key (PK) and Sort Key (SK), with optional Global Secondary Index (GSI) selection.
* **Access Pattern Management**: Define, store, and execute application-specific query patterns (e.g., `USER#{userId}`).
* **Admin Table**: Uses an internal table (`dyno-canvas`) to persist access pattern configurations across sessions.

### ⚙️ Configuration & Metadata
* **GSI Management**: View, create, and delete Global Secondary Indexes.
* **TTL Management**: Enable, disable, and configure Time To Live attributes.
* **Import/Export**:
* Export search results or selected items to JSONL or CSV.
* Import data from JSONL files.
* Export/Import Access Pattern definitions for team sharing.

### 🌍 Environment & Security
* **Multi-Environment**: Seamlessly switch between **AWS Regions** and **DynamoDB Local**.
* **AWS Profile Support**: Switch between local AWS profiles defined in credentials files.
* **Read-Only Mode**: Environment-flag based restriction to prevent accidental writes.
* **Basic Authentication**: Optional security layer for hosted deployments.
* **Internationalization**: Full support for English and Japanese interfaces.

## Technology Stack
* **Framework**: [Next.js](https://nextjs.org/) (App Router, Server Actions)
* **Language**: [TypeScript](https://www.typescriptlang.org/)
* **Styling**: [Tailwind CSS](https://tailwindcss.com/)
* **AWS SDK**: [AWS SDK for JavaScript v3](https://aws.amazon.com/sdk-for-javascript/)
* **Editor**: [Monaco Editor](https://microsoft.github.io/monaco-editor/)
* **Validation**: [Zod](https://zod.dev/)
* **Logging**: [Pino](https://getpino.io/)
* **Containerization**: Docker & Docker Compose

## Prerequisites
* **Node.js**: Version 18 or higher.
* **Docker** (Optional): For running via Docker Compose or using DynamoDB Local.
* **AWS Credentials**: Configured in `~/.aws/credentials` or via environment variables.

## 🚀 Installation

### Method 1: Local Development

1. **Clone the repository:**

```bash
git clone git@github.com:hiroki-kawasaki/dyno-canvas.git
```

```bash
cd dyno-canvas
```

2. **Install dependencies:**

```bash
npm install
```

or

```bash
make install
```

3. **Configure Environment:**
Create a `.env.local` file in the root directory.

```env
HOSTNAME=0.0.0.0
AWS_PROFILE=<your_aws_profile>
AWS_REGION=<your_aws_region>
AWS_ACCESS_KEY_ID=<your_aws_access_key_id>
AWS_SECRET_ACCESS_KEY=<your_aws_secret_access_key>
AWS_SDK_LOAD_CONFIG=1
AWS_CONFIG_FILE=/home/nonroot/.aws/config
AWS_SHARED_CREDENTIALS_FILE=/home/nonroot/.aws/credentials
DYNAMODB_ENDPOINT=http://localhost:8000
DYNOCANVAS_ADMIN_TABLE_NAME=dyno-canvas
DYNOCANVAS_REGIONS=<your_regions>
DYNOCANVAS_READONLY=false
DYNOCANVAS_AUTH=basic
DYNOCANVAS_AUTH_USER=<your_auth_user>
DYNOCANVAS_AUTH_PASS=<your_auth_pass>
```

4. **Start the development server:**

```bash
npm run dev
```

or

```bash
make dev
```

Access the application at `http://localhost:3000`.

### Method 2: Docker Compose

The repository includes a `docker-compose.yaml` that sets up both DynoCanvas and a local DynamoDB instance.

1. **Start services:**

```bash
docker-compose up -d
```

or

```bash
make docker-up
```

2. **Access the application:**
* DynoCanvas: `http://localhost:8001`

## 📖 Usage

### Connecting to DynamoDB
* **AWS Mode**: Select your desired AWS Profile and Region from the header dropdowns. The app reads profiles from your local `.aws` configuration.
* **Local Mode**: Switch to "Local" in the environment switcher. Ensure your local DynamoDB instance is running.

### Managing Access Patterns
1. Navigate to **Settings** or the dashboard sidebar.
2. If the Admin Table is missing, click **Create Admin Table**.
3. Define patterns using placeholders (e.g., PK: `ORDER#{orderId}`, SK: `ITEM#{itemId}`).
4. Use these patterns in the **Access Pattern Search** tab to perform structured queries without manually typing keys every time.

### Editing Items
1. Click on an item in the search results or select **New Item**.
2. Use the **Simple JSON** tab for quick edits.
3. Switch to **DynamoDB JSON** if you need to manipulate specific DynamoDB types like Sets (`SS`, `NS`).
4. Click **Save** to commit changes to the database.

## 📄 License

DynoCanvas is [MIT Licensed](https://github.com/hiroki-kawasaki/dyno-canvas/blob/main/LICENSE).

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
- GPT-OSS 128B