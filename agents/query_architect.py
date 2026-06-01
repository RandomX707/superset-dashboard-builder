from __future__ import annotations

import json
import re

from models.schemas import QueryPlan, SchemaMap
from tools.llm_client import chat

PASS1_SYSTEM = """\
You are an expert SQL analyst. Write a clean SQL SELECT query that:
- Joins the tables as suggested
- Selects all columns needed for the business requirement
- Uses CTEs if needed to avoid fan-out on multiple 1-to-many joins
- Aliases all columns clearly
- Does NOT use SELECT * — list columns explicitly
- Adds a comment on each CTE explaining what it does
- Does NOT end the SQL with a semicolon

CRITICAL SQL RULE — Postgres does not allow referencing a column alias defined in the \
same SELECT clause. You must repeat the full expression instead of referencing the alias. \
This applies everywhere including CASE WHEN, arithmetic, and OVER() clauses.

WRONG:
    COUNT(r.id) AS total,
    total - SUM(CASE WHEN status=400 THEN 1 ELSE 0 END) AS success

CORRECT:
    COUNT(r.id) AS total,
    COUNT(r.id) - SUM(CASE WHEN status=400 THEN 1 ELSE 0 END) AS success

WRONG:
    ROUND(AVG(ms)::NUMERIC, 2) AS avg_ms,
    CASE WHEN avg_ms > 1000 THEN 1 ELSE 0 END AS is_slow

CORRECT:
    ROUND(AVG(ms)::NUMERIC, 2) AS avg_ms,
    CASE WHEN ROUND(AVG(ms)::NUMERIC, 2) > 1000 THEN 1 ELSE 0 END AS is_slow

WRONG (in OVER clause):
    ROW_NUMBER() OVER (PARTITION BY org_id ORDER BY request_volume DESC)

CORRECT (use the full expression, not the alias):
    ROW_NUMBER() OVER (PARTITION BY o.org_id ORDER BY COUNT(r.id) DESC)

Always use the full original expression. Never use an alias defined earlier in the same SELECT.

JOIN TYPE RULE: When joining on a column that is nullable (i.e. a foreign key that can be \
NULL), always use LEFT JOIN, never INNER JOIN. For example, if api_requests.api_key_id can \
be NULL, the join to api_keys must be LEFT JOIN api_keys ON api_requests.api_key_id = \
api_keys.key_id. Using INNER JOIN on a nullable FK silently drops rows where the FK is NULL. \
Only use INNER JOIN when you are certain the FK column is NOT NULL. \
Each column in the Available columns list is annotated with [null: X%] — if X > 0 and \
that column is used as a join key, it is nullable and must use LEFT JOIN.

DATASET NAME RULE: dataset_name_suggestion must be derived from the primary table name plus \
a short 2-3 word descriptor of what the query measures. Rules:
- Use snake_case
- Maximum 40 characters total
- Base it on the table name, NOT the business prompt text
- Keep it meaningful and readable

GOOD examples:
  api_requests_performance
  invoices_revenue_summary
  projects_usage_overview
  support_tickets_analysis
  users_activity_report

BAD examples (never do these):
  api_requests_we_need_to_understand_api_usag   <- truncated prompt
  query_dataset_1                                <- meaningless
  my_dataset                                     <- too generic

Return ONLY valid JSON:
{"sql": "...", "grain_description": "one row per ...", "dataset_name_suggestion": "table_descriptor"}
No markdown, no preamble.
"""

PASS2_SYSTEM = """\
Given a SQL query and a business requirement, identify what calculated columns
should be added to the SELECT clause.
Examples:
  revenue - cost AS gross_margin
  CASE WHEN status='won' THEN 1 ELSE 0 END AS is_won

Only add columns that cannot be derived later in the BI tool.

CRITICAL: Calculated columns you add must also follow the same rule — never reference an \
alias from the same SELECT, always repeat the full expression.

Return ONLY valid JSON:
{"calculated_columns": [{"name": "...", "expression": "...", "description": "..."}]}
If none needed: {"calculated_columns": []}
No markdown, no preamble.
"""


def _all_columns_description(schema_map: SchemaMap) -> str:
    lines = []
    for table in schema_map.profiled_tables:
        for col in table.columns:
            lines.append(
                f"  {table.table_name}.{col.column_name} ({col.data_type})"
                f" [null: {col.null_pct:.1f}%]"
            )
    return "\n".join(lines)


def _inject_calculated_columns(sql: str, calc_cols: list[dict]) -> str:
    """Append calculated column expressions into the outermost SELECT clause."""
    if not calc_cols:
        return sql

    expressions = [f"    {c['expression']} AS {c['name']}" for c in calc_cols]
    insert_pos = _find_final_select_from(sql)
    if insert_pos is None:
        return sql

    before_from = sql[:insert_pos].rstrip()
    extra = ",\n" + ",\n".join(expressions) + "\n"
    return before_from + extra + sql[insert_pos:]


def _find_final_select_from(sql: str) -> int | None:
    """Find the FROM that belongs to the final/top-level SELECT."""
    tokens = list(re.finditer(r"\b(SELECT|FROM)\b|[(),]", sql, re.IGNORECASE))
    depth = 0
    top_level_select_seen = False

    for token in tokens:
        value = token.group(0).upper()
        if value == "(":
            depth += 1
        elif value == ")":
            depth = max(0, depth - 1)
        elif depth == 0 and value == "SELECT":
            top_level_select_seen = True
        elif depth == 0 and value == "FROM" and top_level_select_seen:
            return token.start()

    return None


class QueryArchitect:
    """Phase 2, Agent 1.

    Two-pass LLM approach:
      Pass 1 — writes the base JOIN query.
      Pass 2 — identifies and injects calculated columns.
    Returns a QueryPlan.
    """

    def run(self, business_prompt: str, schema_map: SchemaMap) -> QueryPlan:
        columns_desc = _all_columns_description(schema_map)
        joins_desc = "\n".join(schema_map.suggested_joins) or "(no joins — single table)"

        # ── Pass 1: base SQL ──────────────────────────────────────────────────
        pass1_user = (
            f"Business prompt: {business_prompt}\n\n"
            f"Primary table: {schema_map.suggested_primary}\n\n"
            f"Suggested joins:\n{joins_desc}\n\n"
            f"Available columns:\n{columns_desc}"
        )

        sql = ""
        grain_description = ""
        llm_dataset_name = ""
        last_error = ""

        for attempt in range(3):
            msg = pass1_user
            if last_error:
                msg += (
                    f"\n\nYour previous response had a JSON parse error: {last_error}"
                    "\nReturn ONLY valid JSON."
                )

            text = chat(PASS1_SYSTEM, msg, max_tokens=4096)

            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
                text = text.strip()

            try:
                data = json.loads(text)
                sql = data["sql"]
                grain_description = data.get("grain_description", "")
                llm_dataset_name = data.get("dataset_name_suggestion", "")
                break
            except (json.JSONDecodeError, KeyError) as exc:
                last_error = str(exc)

        if not sql:
            raise RuntimeError(
                f"QueryArchitect Pass 1 failed after 3 attempts. Last error: {last_error}"
            )

        # ── Pass 2: calculated columns ────────────────────────────────────────
        pass2_user = (
            f"Business prompt: {business_prompt}\n\n"
            f"Current SQL:\n{sql}"
        )

        calculated_columns: list[dict] = []
        last_error = ""

        for attempt in range(3):
            msg = pass2_user
            if last_error:
                msg += (
                    f"\n\nYour previous response had a JSON parse error: {last_error}"
                    "\nReturn ONLY valid JSON."
                )

            text = chat(PASS2_SYSTEM, msg)

            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
                text = text.strip()

            try:
                data = json.loads(text)
                calculated_columns = data.get("calculated_columns", [])
                break
            except json.JSONDecodeError as exc:
                last_error = str(exc)

        # Merge calculated columns into the SQL SELECT clause
        if calculated_columns:
            sql = _inject_calculated_columns(sql, calculated_columns)

        # Use the LLM-generated name; fall back to a safe primary-table-only slug
        if llm_dataset_name:
            dataset_name_suggestion = re.sub(r"[^a-z0-9_]+", "_", llm_dataset_name.lower()).strip("_")[:40]
        else:
            primary_slug = re.sub(r"[^a-z0-9]+", "_", schema_map.suggested_primary.lower()).strip("_")
            dataset_name_suggestion = f"{primary_slug}_dataset"[:40]

        return QueryPlan(
            sql=sql,
            calculated_columns=calculated_columns,
            dataset_name_suggestion=dataset_name_suggestion,
            grain_description=grain_description,
            agent_reasoning=(
                f"Primary table: {schema_map.suggested_primary}. "
                f"{schema_map.agent_reasoning}"
            ),
        )
