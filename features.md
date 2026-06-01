# Superset Dashboard Builder Features

This application helps analysts move from raw business questions to working Apache Superset dashboards. It combines a guided three-phase workflow, LLM-assisted planning, database profiling, Superset REST API automation, QA checks, version history, audit logging, and a separate CSV/Excel analysis workspace.

## Primary Uses

- Build Superset dashboards from plain-English stakeholder requirements.
- Explore an unknown database schema and identify the right tables for analysis.
- Generate a clean master SQL dataset from selected tables and inferred joins.
- Validate generated SQL before using it for reporting.
- Plan, preview, edit, create, and update Superset charts and dashboards.
- Add native Superset filters and dashboard layouts automatically.
- Generate chart descriptions after a dashboard is live.
- Keep dashboard version history so analysts can roll back when needed.
- Run data quality checks on Superset datasets.
- Analyze CSV or Excel files conversationally without creating a Superset dataset.
- Export lightweight CSV/Excel analysis dashboards to PDF or Excel.
- Keep an audit trail of important workflow events for review and debugging.

## Application Interfaces

- React + TypeScript web UI for the full workflow.
- FastAPI backend exposing REST and Server-Sent Events endpoints.
- Phase 3 CLI path through `main.py` for scripted dashboard generation.
- Apache Superset integration through REST APIs.
- LiteLLM/OpenAI-compatible LLM integration for schema reasoning, query planning, dashboard planning, QA, CSV analysis, and chart descriptions.

## Configuration Features

- Database configuration from the sidebar.
- Supported database types: PostgreSQL, MySQL, and MongoDB.
- Database connection testing before schema exploration.
- Superset URL, username, password, session cookie, and CSRF token configuration.
- LLM model selection/configuration.
- Defaults loaded from backend configuration.
- Debounced configuration sync from the frontend to the backend session.
- Light and dark theme support.
- Persistent browser-side session/config preferences through Zustand persistence.

## Phase 1: Schema Explorer

- Connects to a live database.
- Lists available database tables.
- Profiles tables for row count, columns, sample values, null percentage, and likely semantic flags.
- Detects likely primary key columns.
- Detects likely foreign key columns.
- Detects likely date/time columns.
- Uses the LLM to select relevant tables based on the analyst's business prompt.
- Suggests a primary/fact table.
- Suggests join relationships between selected tables.
- Shows selected tables with column details.
- Shows excluded tables separately.
- Allows excluded tables to be profiled on demand.
- Allows excluded tables to be manually added to the schema map.
- Allows analysts to choose specific columns when adding excluded tables.
- Confirms Phase 1 before query generation.
- Streams progress logs through SSE during schema exploration.

## Phase 1 ERD Diagram

- Interactive entity relationship diagram powered by React Flow.
- Shows selected tables as nodes.
- Lists columns inside each selected table node.
- Highlights primary/fact table.
- Shows inferred join relationships as edges.
- Shows join column labels on edges.
- Shows excluded tables as dimmed background nodes.
- Allows excluded tables to be added to the schema from the diagram.
- Nodes are draggable and the diagram supports zoom/pan controls.
- MiniMap support for larger schemas.
- Hidden by default and loaded on demand to avoid slowing large schemas.
- Refreshes when tables are added to the schema.

## Phase 2: Query Builder

- Generates a master SQL query from the confirmed schema map.
- Uses selected tables, suggested joins, and business context.
- Adds calculated columns where useful.
- Produces a dataset name suggestion for Superset.
- Describes the query grain.
- Runs generated SQL against the live database for QA.
- Checks query execution success.
- Checks row count.
- Checks duplicate rows.
- Reviews likely fan-out and join issues.
- Retries generation on SQL errors.
- Shows QA issues and suggestions.
- Provides an editable SQL review step.
- Confirms Phase 2 before dashboard planning.
- Pre-fills Phase 3 dataset name from the query plan.
- Streams progress logs through SSE.

## Phase 3: Dashboard Builder

- Plans dashboards from dataset name, dashboard title, and plain-English requirements.
- Supports dashboard creation and existing dashboard update mode.
- Supports dry-run planning without Superset writes.
- Fetches Superset dataset metadata.
- Grounds dashboard plans to real Superset dataset columns.
- Samples useful column values for filters.
- Uses LLM agents to parse requirements and plan charts.
- Uses catalogue memory from previous successful charts.
- Produces a dashboard plan with chart titles, chart types, metrics, dimensions, time columns, filters, layout widths, and reasoning.
- Shows a plan summary before building.
- Allows charts to be reviewed before build.
- Allows charts to be removed from the plan.
- Allows chart fields to be edited through chart preview cards.
- Allows charts to be added manually.
- Provides chart previews using real Superset SQL Lab query results.
- Restricts chart preview aggregation to safe aggregate functions.
- Syncs edited plans back to the backend before build.
- Creates or updates charts in Superset.
- Upserts charts by title to avoid duplicates.
- Builds Superset dashboard layout automatically.
- Creates or updates dashboards in Superset.
- Adds charts to dashboards.
- Configures Superset native filters.
- Runs Phase 3 QA after build.
- Shows the live dashboard URL after success.
- Includes chart IDs in the build result for follow-up operations.
- Streams build progress through SSE.

## Chart Description Generator

- Available after a Phase 3 dashboard build succeeds.
- Generates one plain-English sentence for every built chart.
- Uses one LLM call for all chart descriptions.
- Uses chart title, visualization type, metrics, dimensions, and time fields as context.
- Updates each chart description in Superset through `PUT /api/v1/chart/{id}`.
- Processes each chart update independently so one failure does not stop the others.
- Shows per-chart success or failure results.
- Supports retrying failed generation/update attempts by re-running the full description generation.
- Resets description generation state when a new plan or build starts.

## Dashboard Version History

- Saves dashboard snapshots to disk under `runs/`.
- Saves snapshots when dashboards are created or updated.
- Stores dashboard title, URL, creation time, creator, requirements prompt, dataset name, chart count, filter count, layout, chart configs, filter configs, and change summary.
- Maintains a dashboard history index file.
- Supports listing all dashboards with version history.
- Supports viewing version history for one dashboard.
- Shows newest versions first.
- Labels the latest version as current.
- Shows chart count and one-line change summary for each version.
- Allows viewing full snapshot details.
- Snapshot detail includes Charts, Filters, Requirements, and Raw JSON views.
- Allows downloading a version snapshot as JSON.
- Allows deleting older versions.
- Allows restoring an older version to Superset.
- Saves the current state as a new version before restore so restore actions can be undone.
- Version history panel slides in from the right and matches the audit panel interaction pattern.
- Version history can be opened from the sidebar or from Phase 3 after a dashboard build.

## Data Quality Reporting

- Runs a data quality report against a Superset dataset.
- Pulls sample data from Superset SQL Lab.
- Profiles row and column quality.
- Reports total rows and columns.
- Reports duplicate row metrics.
- Reports null counts and null percentages.
- Reports distinct counts and distinct percentages.
- Reports numeric summaries such as min, max, mean, standard deviation, zeros, and outliers.
- Reports categorical top values.
- Reports date ranges and future-date counts.
- Produces an overall score and grade.
- Uses the LLM to write a concise quality summary.
- Shows issues with severity levels.
- Exports the data quality report to PDF.

## CSV and Excel Analysis Mode

- Upload CSV, XLS, or XLSX files.
- Enforces a 50 MB upload limit.
- Parses uploaded files with pandas.
- Displays row count and column list.
- Shows column data types and sample values.
- Provides a chat-style interface for asking questions about the uploaded data.
- Uses the LLM to generate DuckDB SQL for the question.
- Enforces read-only SELECT queries before execution.
- Runs SQL locally against the uploaded dataframe through DuckDB.
- Returns query results as rows and columns.
- Automatically selects a chart type: bar, line, pie, table, or big number.
- Renders inline charts with Recharts.
- Shows result tables.
- Keeps recent chat history for follow-up questions.
- Lets users add query results to a dashboard canvas.
- Allows removing charts from the CSV dashboard canvas.
- Exports the CSV dashboard canvas to PDF.
- Exports the CSV dashboard canvas to Excel.

## Audit Logging

- Records important events across phases.
- Tracks timestamps, phase numbers, event types, titles, details, structured data, and status.
- Uses statuses such as info, success, warning, and error.
- Shows a compact audit section in the sidebar.
- Opens a full slide-in audit panel.
- Supports exporting audit entries to JSON.
- Supports clearing the audit log.
- Persists build audit logs to disk during Phase 3 dashboard builds.

## Superset Automation

- Authenticates to Superset with username/password or session details.
- Fetches CSRF tokens.
- Retries after authentication failures.
- Finds datasets by name.
- Fetches dataset columns and metrics.
- Normalizes Superset column types into analysis-friendly categories.
- Executes SQL through Superset SQL Lab.
- Fetches existing charts for a dataset.
- Creates charts.
- Updates existing charts.
- Updates chart descriptions.
- Creates dashboards.
- Updates dashboards.
- Adds charts to dashboards.
- Writes dashboard `position_json`.
- Writes native filter configuration through dashboard metadata.
- Fetches full dashboard state for snapshots.
- Restores dashboard layout and chart links from saved snapshots.

## LLM-Assisted Features

- Schema shortlisting for large databases.
- Relevant table selection.
- Join and primary table reasoning.
- SQL query generation.
- Calculated column generation.
- SQL QA and structure review.
- Requirement parsing for dashboard planning.
- Chart strategy and layout planning.
- Dashboard QA coverage review.
- Data quality report summary.
- CSV/Excel natural-language-to-SQL analysis.
- Dashboard version change summaries.
- Chart description generation.

## Safety and Reliability Features

- Backend sessions isolate user workflow state.
- SSE progress logs make long-running operations visible.
- Database connector methods return safe tuple results where possible.
- SQL query profiling wraps table and column identifiers safely.
- Chart preview aggregate functions are restricted to an allowlist.
- CSV chat rejects non-read-only SQL.
- Phase 2 retries query generation on SQL errors.
- Version history failures are non-fatal to dashboard builds.
- Individual chart description update failures do not block other chart updates.
- File operations in version history return safe defaults on failure.
- Dry-run mode lets analysts inspect plans before writing to Superset.

## Export and Download Features

- Export audit log JSON.
- Export data quality report PDF.
- Export CSV analysis canvas PDF.
- Export CSV analysis canvas Excel workbook.
- Download dashboard version snapshots as JSON.

## Typical Workflows

### Build a Dashboard From a Database

1. Configure and test the database connection.
2. Describe the business question in Phase 1.
3. Review selected tables, joins, excluded tables, and ERD.
4. Confirm schema selection.
5. Generate and review the master SQL query in Phase 2.
6. Confirm the query plan.
7. Enter Superset dataset name, dashboard title, and dashboard requirements in Phase 3.
8. Plan the dashboard.
9. Preview, edit, remove, or add charts.
10. Build the dashboard in Superset.
11. Review the live dashboard URL and QA results.
12. Generate chart descriptions.
13. Use version history for rollback if later changes need to be undone.

### Update an Existing Dashboard

1. Enter the existing Superset dashboard ID in Phase 3.
2. Plan changes from new requirements.
3. Review and edit the plan.
4. Build the dashboard update.
5. The app saves version snapshots so the previous version can be restored later.

### Analyze a One-Off File

1. Open CSV / Excel analysis mode in Phase 3.
2. Upload a CSV, XLS, or XLSX file.
3. Ask natural-language questions about the data.
4. Review SQL-backed answers, charts, and result tables.
5. Add useful answers to the dashboard canvas.
6. Export the canvas as PDF or Excel.

## Intended Users

- Data analysts building dashboards for clients or stakeholders.
- BI developers who want faster Superset chart and dashboard creation.
- Analytics engineers exploring unfamiliar schemas.
- Consultants who need repeatable dashboard delivery and rollback history.
- Product, operations, sales, finance, and HR teams that need quick exploratory dashboards.
- Teams that need auditable BI generation with QA and version recovery.
