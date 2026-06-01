from __future__ import annotations

import json
import logging
import urllib.parse
import uuid

import httpx

from models.schemas import ChartSpec, DatasetColumn, DatasetInfo, FilterSpec

logger = logging.getLogger(__name__)

# Map spec viz_type names to Superset 5.x internal names
VIZ_TYPE_MAP = {
    "bar": "bar",
    "scatter": "echarts_scatter",
    "big_number_total": "big_number_total",
    "echarts_timeseries_line": "echarts_timeseries_line",
    "pie": "pie",
    "table": "table",
}

# Enforce width rules post-LLM to prevent row-packing breakage
FORCED_WIDTHS: dict[str, int] = {
    "big_number_total": 3,
    "echarts_timeseries_line": 12,
    "table": 12,
    "echarts_scatter": 12,
    "scatter": 12,
}


def build_chart_params(chart_spec: ChartSpec) -> dict:
    viz = VIZ_TYPE_MAP.get(chart_spec.viz_type, chart_spec.viz_type)

    def single_metric(metrics: list[dict]) -> dict:
        return metrics[0] if metrics else {}

    if viz == "big_number_total":
        return {
            "viz_type": viz,
            "metric": single_metric(chart_spec.metrics),
            "subheader": "",
            "time_range": "No filter",
            "y_axis_format": "SMART_NUMBER",
        }

    if viz == "echarts_timeseries_line":
        return {
            "viz_type": viz,
            "metrics": chart_spec.metrics,
            "groupby": chart_spec.groupby,
            "granularity_sqla": chart_spec.time_column,
            "time_grain_sqla": chart_spec.time_grain or "P1M",
            "time_range": "No filter",
            "rich_tooltip": True,
            "show_legend": True,
        }

    if viz == "bar":
        return {
            "viz_type": viz,
            "metrics": chart_spec.metrics,
            "groupby": chart_spec.groupby,
            "time_range": "No filter",
            "row_limit": chart_spec.row_limit or 50,
            "order_desc": True,
            "show_legend": False,
            "x_axis": chart_spec.groupby[0] if chart_spec.groupby else None,
            "x_axis_sort_asc": False,
            "x_axis_sort_series": "name",
            "x_axis_sort_series_ascending": False,
        }

    if viz == "table":
        return {
            "viz_type": viz,
            "metrics": chart_spec.metrics,
            "groupby": chart_spec.groupby,
            "time_range": "No filter",
            "row_limit": chart_spec.row_limit or 100,
            "order_desc": True,
            "table_timestamp_format": "smart_date",
        }

    if viz == "pie":
        return {
            "viz_type": viz,
            "metric": single_metric(chart_spec.metrics),
            "groupby": chart_spec.groupby,
            "time_range": "No filter",
            "row_limit": chart_spec.row_limit or 10,
            "donut": False,
            "show_legend": True,
            "show_labels": True,
        }

    if viz == "echarts_scatter":
        metrics = chart_spec.metrics
        return {
            "viz_type": viz,
            "metrics": metrics[:1],
            "x_axis": metrics[1]["column"]["column_name"] if len(metrics) > 1 else None,
            "groupby": chart_spec.groupby,
            "time_range": "No filter",
        }

    # Fallback for any unrecognised viz type
    return {
        "viz_type": viz,
        "metrics": chart_spec.metrics,
        "groupby": chart_spec.groupby,
        "time_range": "No filter",
    }


def build_position_json(chart_ids: list[int], chart_specs: list[ChartSpec]) -> dict:
    """
    Pack charts into 12-column rows and return a valid Superset v2 position_json.
    """
    position: dict = {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {"type": "ROOT", "id": "ROOT_ID", "children": ["GRID_ID"]},
        "GRID_ID": {
            "type": "GRID",
            "id": "GRID_ID",
            "children": [],
            "parents": ["ROOT_ID"],
        },
    }

    rows: list[list[tuple[int, ChartSpec]]] = []
    current_row: list[tuple[int, ChartSpec]] = []
    remaining = 12

    for chart_id, spec in zip(chart_ids, chart_specs):
        # Enforce width rules
        width = FORCED_WIDTHS.get(
            VIZ_TYPE_MAP.get(spec.viz_type, spec.viz_type), spec.width
        )
        width = width if width in (3, 6, 12) else 6

        if width <= remaining:
            current_row.append((chart_id, spec))
            remaining -= width
        else:
            if current_row:
                rows.append(current_row)
            current_row = [(chart_id, spec)]
            remaining = 12 - width

    if current_row:
        rows.append(current_row)

    row_ids: list[str] = []
    for i, row in enumerate(rows):
        row_id = f"ROW_{i}"
        row_ids.append(row_id)
        chart_entry_ids: list[str] = []

        for chart_id, spec in row:
            width = FORCED_WIDTHS.get(
                VIZ_TYPE_MAP.get(spec.viz_type, spec.viz_type), spec.width
            )
            width = width if width in (3, 6, 12) else 6
            cid = int(chart_id)
            entry_id = f"CHART_{cid}"
            chart_entry_ids.append(entry_id)
            position[entry_id] = {
                "type": "CHART",
                "id": entry_id,
                "children": [],
                "parents": ["ROOT_ID", "GRID_ID", row_id],
                "meta": {
                    "chartId": cid,
                    "width": width,
                    "height": 50,
                },
            }

        position[row_id] = {
            "type": "ROW",
            "id": row_id,
            "children": chart_entry_ids,
            "parents": ["ROOT_ID", "GRID_ID"],
            "meta": {"background": "BACKGROUND_TRANSPARENT"},
        }

    position["GRID_ID"]["children"] = row_ids
    return position


class SupersetClient:
    def __init__(
        self,
        base_url: str,
        token: str | None = None,
        username: str | None = None,
        password: str | None = None,
        session_cookie: str | None = None,
        csrf_token: str | None = None,
    ):
        self.base_url = base_url.rstrip("/")
        self._token = token
        self._username = username
        self._password = password
        self._session_cookie = session_cookie
        self._csrf_token = csrf_token
        self._cookie_auth = bool(session_cookie)
        self.superset_version: tuple[int, int, int] = (0, 0, 0)
        # Persistent client — keeps session cookies alive across all requests
        self._session = httpx.Client(timeout=60)
        self._session.headers.update({"Content-Type": "application/json"})
        if token:
            self._session.headers["Authorization"] = f"Bearer {token}"
        if session_cookie:
            self._session.cookies.set("session", session_cookie)
        if csrf_token:
            self._session.headers["X-CSRFToken"] = csrf_token

    def authenticate(self) -> None:
        # Cookie auth — browser session already authenticated via Keycloak
        if self._cookie_auth:
            return

        resp = self._session.post(
            f"{self.base_url}/api/v1/security/login",
            json={
                "username": self._username,
                "password": self._password,
                "provider": "db",
                "refresh": True,
            },
        )
        if resp.status_code != 200:
            raise RuntimeError(
                f"Authentication failed [{resp.status_code}]: {resp.text}"
            )
        data = resp.json()
        jwt = data.get("access_token")
        if not jwt:
            raise RuntimeError(f"No access_token in login response: {resp.text}")
        self._session.headers["Authorization"] = f"Bearer {jwt}"

        csrf = self.get_csrf_token()
        self._session.headers["X-CSRFToken"] = csrf

        try:
            import re
            ver_resp = self._session.get(f"{self.base_url}/api/v1/")
            if ver_resp.status_code == 200:
                ver_str = ver_resp.json().get("version", "") or ""
                m = re.match(r"(\d+)\.(\d+)\.(\d+)", ver_str)
                if m:
                    self.superset_version = (
                        int(m.group(1)), int(m.group(2)), int(m.group(3))
                    )
                else:
                    major = re.match(r"(\d+)", ver_str)
                    if major:
                        self.superset_version = (int(major.group(1)), 0, 0)
        except Exception:
            pass
        logger.debug("Superset version=%s is_v6=%s", self.superset_version, self.is_v6_or_later)

    @property
    def is_v6_or_later(self) -> bool:
        return self.superset_version[0] >= 6

    def get_csrf_token(self) -> str:
        resp = self._session.get(f"{self.base_url}/api/v1/security/csrf_token/")
        if resp.status_code != 200:
            raise RuntimeError(
                f"CSRF token fetch failed [{resp.status_code}]: {resp.text}"
            )
        return resp.json()["result"]

    def _request(self, method: str, path: str, **kwargs) -> httpx.Response:
        url = f"{self.base_url}{path}"
        resp = self._session.request(method, url, **kwargs)

        if resp.status_code == 401 and not self._cookie_auth:
            self.authenticate()
            resp = self._session.request(method, url, **kwargs)

        if not (200 <= resp.status_code < 300):
            raise RuntimeError(
                f"[{method} {path}] HTTP {resp.status_code}: {resp.text}"
            )
        return resp

    def get_dataset_by_name(self, name: str) -> DatasetInfo:
        name = name.strip()
        # Strategy 1: filter by table_name (most reliable)
        encoded = urllib.parse.quote(
            f"(filters:!((col:table_name,opr:eq,value:'{name}')))"
        )
        response = self._request("GET", f"/api/v1/dataset/?q={encoded}")
        data = response.json()
        if data.get("count", 0) > 0:
            return self._parse_dataset(data["result"][0])

        # Strategy 2: filter by schema + table_name
        # (if name includes schema prefix like "public.tablename")
        if "." in name:
            schema, table = name.split(".", 1)
            encoded = urllib.parse.quote(
                f"(filters:!((col:table_name,opr:eq,value:'{table}')"
                f",(col:schema,opr:eq,value:'{schema}')))"
            )
            response = self._request("GET", f"/api/v1/dataset/?q={encoded}")
            data = response.json()
            if data.get("count", 0) > 0:
                return self._parse_dataset(data["result"][0])

        # Strategy 3: fetch all datasets and match by name in Python
        # (fallback for any filter restriction issues — cap at 200 datasets)
        page = 0
        page_size = 100
        while True:
            encoded = urllib.parse.quote(
                f"(page:{page},page_size:{page_size},"
                f"order_column:table_name,order_direction:asc)"
            )
            response = self._request("GET", f"/api/v1/dataset/?q={encoded}")
            data = response.json()
            results = data.get("result", [])

            for item in results:
                table_name = item.get("table_name", "")
                schema = item.get("schema", "")
                full_name = f"{schema}.{table_name}" if schema else table_name
                if (
                    table_name == name
                    or full_name == name
                    or item.get("datasource_name", "") == name
                ):
                    return self._parse_dataset(item)

            if len(results) < page_size:
                break
            page += 1
            if page >= 2:  # cap at 200 datasets (2 pages of 100)
                break

        raise RuntimeError(
            f"Dataset '{name}' not found in Superset. "
            f"Check the dataset name matches exactly what is "
            f"shown in Superset under Datasets. "
            f"The name is case-sensitive."
        )

    def _parse_dataset(self, result: dict) -> DatasetInfo:
        """Fetch full DatasetInfo for a dataset list-API result entry."""
        return self.get_dataset_columns(result["id"])

    def get_dataset_columns(self, dataset_id: int) -> DatasetInfo:
        resp = self._request("GET", f"/api/v1/dataset/{dataset_id}")
        ds = resp.json()["result"]

        columns: list[DatasetColumn] = []
        for col in ds.get("columns", []):
            col_type = (col.get("type") or "STRING").upper()
            if "INT" in col_type or "FLOAT" in col_type or "DOUBLE" in col_type or "DECIMAL" in col_type or "NUMERIC" in col_type:
                normalized = "NUMERIC"
            elif "DATE" in col_type or "TIME" in col_type:
                normalized = "DATETIME"
            else:
                normalized = "STRING"

            columns.append(
                DatasetColumn(
                    column_name=col["column_name"],
                    type=normalized,
                    is_dttm=col.get("is_dttm", False),
                    expression=col.get("expression") or None,
                    distinct_values=None,
                )
            )

        metrics: list[dict] = []
        for m in ds.get("metrics", []):
            metrics.append(
                {
                    "id": m.get("id"),
                    "metric_name": m.get("metric_name"),
                    "expression": m.get("expression"),
                    "verbose_name": m.get("verbose_name"),
                }
            )

        return DatasetInfo(
            id=dataset_id,
            name=ds.get("table_name") or ds.get("datasource_name", ""),
            columns=columns,
            metrics=metrics,
        )

    def get_charts_for_dataset(self, dataset_id: int) -> list[dict]:
        rison_filter = f"(filters:!((col:datasource_id,opr:eq,value:{dataset_id})))"
        encoded = urllib.parse.quote(rison_filter)
        resp = self._request("GET", f"/api/v1/chart/?q={encoded}")
        results = resp.json().get("result", [])
        return [
            {"id": r["id"], "slice_name": r["slice_name"], "viz_type": r["viz_type"]}
            for r in results
        ]

    def _build_chart_payload(self, dataset_id: int, chart_spec: ChartSpec) -> dict:
        viz = VIZ_TYPE_MAP.get(chart_spec.viz_type, chart_spec.viz_type)
        params = build_chart_params(chart_spec)
        return {
            "slice_name": chart_spec.title,
            "viz_type": viz,
            "datasource_id": dataset_id,
            "datasource_type": "table",
            "params": json.dumps(params),
            "query_context": "{}",
        }

    def create_chart(self, dataset_id: int, chart_spec: ChartSpec) -> int:
        payload = self._build_chart_payload(dataset_id, chart_spec)
        resp = self._request("POST", "/api/v1/chart/", json=payload)
        return resp.json()["id"]

    def update_chart(self, chart_id: int, dataset_id: int, chart_spec: ChartSpec) -> int:
        payload = self._build_chart_payload(dataset_id, chart_spec)
        self._request("PUT", f"/api/v1/chart/{chart_id}", json=payload)
        return chart_id

    def upsert_chart(
        self,
        dataset_id: int,
        chart_spec: ChartSpec,
        existing_charts: list[dict],
    ) -> tuple[int, str]:
        match = next(
            (c for c in existing_charts if c["slice_name"] == chart_spec.title),
            None,
        )
        if match:
            chart_id = self.update_chart(match["id"], dataset_id, chart_spec)
            return chart_id, "updated"
        chart_id = self.create_chart(dataset_id, chart_spec)
        return chart_id, "created"

    def create_dashboard(
        self,
        title: str,
        chart_ids: list[int],
        position_json: dict,
    ) -> tuple[int, str]:
        resp = self._request(
            "POST",
            "/api/v1/dashboard/",
            json={"dashboard_title": title, "published": True},
        )
        dashboard_id = resp.json()["id"]
        self._set_dashboard_layout(dashboard_id, chart_ids, position_json)
        # Separate publish PUT — non-fatal; ensures published=True survives the
        # layout PUT on both 5.x and 6.x regardless of what the POST returned
        try:
            self._request(
                "PUT",
                f"/api/v1/dashboard/{dashboard_id}",
                json={"published": True},
            )
        except Exception:
            pass
        url = f"{self.base_url}/superset/dashboard/{dashboard_id}"
        return dashboard_id, url

    def _build_dashboard_put_body(
        self,
        position_json: dict,
        json_metadata: dict | None = None,
    ) -> dict:
        """Build the PUT body for /api/v1/dashboard/{id}.

        position_json is the authoritative source for which charts appear on
        the dashboard — Superset renders from it on both 5.x and 6.x.
        The `slices` field is NOT included: Superset 6.x rejects it with
        HTTP 400 {"slices": ["Unknown field."]}, and it is not needed for
        chart rendering on 5.x either.

        position_json and json_metadata are serialised to JSON strings as
        required by the Superset REST API.
        """
        return {
            "position_json": json.dumps(position_json),
            "json_metadata": json.dumps(
                json_metadata if json_metadata is not None else {"default_filters": "{}"}
            ),
        }

    def _set_dashboard_layout(
        self, dashboard_id: int, chart_ids: list[int], position_json: dict
    ) -> None:
        body = self._build_dashboard_put_body(position_json)
        self._request("PUT", f"/api/v1/dashboard/{dashboard_id}", json=body)
        self._add_charts_to_dashboard(dashboard_id, chart_ids)

    def _add_charts_to_dashboard(
        self, dashboard_id: int, chart_ids: list[int]
    ) -> None:
        ids = [int(c) for c in chart_ids]

        logger.debug("Superset version=%s is_v6=%s", self.superset_version, self.is_v6_or_later)

        # Strategy 1: dedicated /charts endpoint
        try:
            self._request(
                "PUT",
                f"/api/v1/dashboard/{dashboard_id}/charts",
                json={"chart_ids": ids},
            )
            logger.debug("Dashboard charts endpoint succeeded")
            return
        except Exception as exc:
            logger.debug("Dashboard charts endpoint failed: %s", exc)

        # Strategy 2: update each chart's dashboards list individually
        # Works on both 5.x and 6.x — no "slices" field used
        for chart_id in ids:
            try:
                chart_resp = self._session.get(
                    f"{self.base_url}/api/v1/chart/{chart_id}",
                    headers=dict(self._session.headers),
                )
                if chart_resp.status_code == 200:
                    existing = chart_resp.json().get("result", {})
                    current_dash_ids = [
                        d["id"] for d in existing.get("dashboards", [])
                    ]
                    if dashboard_id not in current_dash_ids:
                        current_dash_ids.append(dashboard_id)
                        self._request(
                            "PUT",
                            f"/api/v1/chart/{chart_id}",
                            json={"dashboards": current_dash_ids},
                        )
            except Exception as exc:
                logger.debug("Chart %s dashboard link failed: %s", chart_id, exc)

    def update_dashboard(
        self,
        dashboard_id: int,
        chart_ids: list[int],
        position_json: dict,
    ) -> str:
        self._set_dashboard_layout(dashboard_id, chart_ids, position_json)
        # Separate publish PUT — non-fatal
        try:
            self._request(
                "PUT",
                f"/api/v1/dashboard/{dashboard_id}",
                json={"published": True},
            )
        except Exception:
            pass
        url = f"{self.base_url}/superset/dashboard/{dashboard_id}"
        return url

    def get_dashboard(self, dashboard_id: int) -> dict:
        resp = self._request("GET", f"/api/v1/dashboard/{dashboard_id}")
        return resp.json()["result"]

    def get_dashboard_full_state(self, dashboard_id: int) -> dict:
        """Fetch complete dashboard state from Superset for snapshots."""
        try:
            import json as _json

            resp = self._request("GET", f"/api/v1/dashboard/{dashboard_id}")
            result = resp.json().get("result", {})

            pos = result.get("position_json", "{}")
            if isinstance(pos, str):
                try:
                    pos = _json.loads(pos)
                except Exception:
                    pos = {}

            metadata = result.get("json_metadata", {})
            if isinstance(metadata, str):
                try:
                    metadata = _json.loads(metadata) if metadata else {}
                except Exception:
                    metadata = {}

            slices = []
            for s in result.get("slices", []):
                params = s.get("params", {})
                if isinstance(params, str):
                    try:
                        params = _json.loads(params) if params else {}
                    except Exception:
                        params = {}
                slices.append(
                    {
                        "id": s.get("slice_id") or s.get("id"),
                        "title": s.get("slice_name") or s.get("title", ""),
                        "viz_type": s.get("viz_type", ""),
                        "datasource_id": s.get("datasource_id"),
                        "params": params,
                    }
                )

            return {
                "dashboard_id": dashboard_id,
                "title": result.get("dashboard_title", ""),
                "url": result.get("url", ""),
                "position_json": pos if isinstance(pos, dict) else {},
                "slices": slices,
                "json_metadata": metadata if isinstance(metadata, dict) else {},
            }
        except Exception:
            return {}

    def restore_dashboard_version(self, dashboard_id: int, snapshot: dict) -> bool:
        """Restore a dashboard by re-applying its saved layout and chart links."""
        try:
            import json as _json

            body = {
                "dashboard_title": snapshot["dashboard_title"],
                "position_json": _json.dumps(snapshot["position_json"]),
            }
            self._request("PUT", f"/api/v1/dashboard/{dashboard_id}", json=body)

            chart_ids = []
            for chart in snapshot.get("charts", []):
                chart_id = chart.get("id")
                if not chart_id:
                    continue
                chart_ids.append(chart_id)
                payload = {
                    "slice_name": chart.get("title", ""),
                    "viz_type": chart.get("viz_type", ""),
                    "params": _json.dumps(chart.get("params", {})),
                }
                if chart.get("dataset_id"):
                    payload["datasource_id"] = chart["dataset_id"]
                    payload["datasource_type"] = "table"
                try:
                    self._request("PUT", f"/api/v1/chart/{chart_id}", json=payload)
                except Exception:
                    continue

            if chart_ids:
                self._add_charts_to_dashboard(dashboard_id, chart_ids)
            return True
        except Exception:
            return False

    def set_dashboard_filters(
        self,
        dashboard_id: int,
        filters: list[FilterSpec],
        dataset_id: int,
    ) -> None:
        if not filters:
            return

        native_filters = []
        for f in filters:
            uid = uuid.uuid4().hex[:8].upper()
            filter_id = f"NATIVE_FILTER_{uid}"

            if f.filter_type == "time":
                filter_type = "filter_time"
            elif f.filter_type == "numerical":
                filter_type = "filter_range"
            else:
                filter_type = "filter_select"

            native_filters.append(
                {
                    "id": filter_id,
                    "name": f.label,
                    "filterType": filter_type,
                    "targets": [
                        {
                            "datasetId": dataset_id,
                            "column": {"name": f.column_name},
                        }
                    ],
                    "defaultDataMask": {
                        "filterState": {"value": f.default_value}
                    },
                    "controlValues": {
                        "multiSelect": True,
                        "enableEmptyFilter": False,
                    },
                    "cascadeParentIds": [],
                    "scope": {
                        "rootPath": ["ROOT_ID"],
                        "excluded": [],
                    },
                }
            )

        metadata = json.dumps(
            {
                "native_filter_configuration": native_filters,
                "default_filters": "{}",
            }
        )
        self._request(
            "PUT",
            f"/api/v1/dashboard/{dashboard_id}",
            json={"json_metadata": metadata},
        )

    def get_dataset_database_id(self, dataset_id: int) -> int | None:
        try:
            resp = self._request("GET", f"/api/v1/dataset/{dataset_id}")
            result = resp.json().get("result", {})
            db = result.get("database", {})
            return db.get("id")
        except Exception:
            return None

    def execute_sql(self, database_id: int, sql: str, limit: int = 1000) -> tuple[bool, list[dict], str]:
        try:
            import uuid as _uuid
            payload = {
                "database_id": database_id,
                "sql": sql,
                "runAsync": False,
                "select_as_cta": False,
                "tmp_table_name": "",
                "client_id": str(_uuid.uuid4())[:8],
                "queryLimit": limit,
            }
            resp = self._request("POST", "/api/v1/sqllab/execute/", json=payload)
            data = resp.json()
            columns = [c["name"] for c in data.get("columns", [])]
            rows_raw = data.get("data", [])
            rows = [
                row
                if isinstance(row, dict)
                else dict(zip(columns, row))
                for row in rows_raw
            ]
            return True, rows, ""
        except Exception as e:
            return False, [], str(e)
