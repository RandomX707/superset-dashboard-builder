from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path


class DashboardVersionHistory:
    RUNS_DIR = Path("runs")

    def __init__(self) -> None:
        try:
            self.RUNS_DIR.mkdir(exist_ok=True)
        except Exception:
            pass

    def _snapshot_path(self, dashboard_id: int, version: int) -> Path:
        return self.RUNS_DIR / f"dashboard_{dashboard_id}_v{version}.json"

    def _index_path(self, dashboard_id: int) -> Path:
        return self.RUNS_DIR / f"dashboard_{dashboard_id}_history.json"

    def get_next_version(self, dashboard_id: int) -> int:
        try:
            index = self.load_index(dashboard_id)
            if not index:
                return 1
            latest = int(index.get("latest_version") or 0)
            versions = [
                int(v.get("version", 0))
                for v in index.get("versions", [])
                if isinstance(v, dict)
            ]
            return max([latest, *versions], default=0) + 1
        except Exception:
            return 1

    def load_index(self, dashboard_id: int) -> dict | None:
        path = self._index_path(dashboard_id)
        if not path.exists():
            return None
        try:
            with open(path) as f:
                data = json.load(f)
            return data if isinstance(data, dict) else None
        except Exception:
            return None

    def save_snapshot(
        self,
        dashboard_id: int,
        dashboard_title: str,
        dashboard_url: str,
        requirements_prompt: str,
        dataset_name: str,
        position_json: dict,
        charts: list[dict],
        filters: list[dict],
        created_by: str,
        change_summary: str,
    ) -> int:
        try:
            version = self.get_next_version(dashboard_id)
            snapshot = {
                "version": version,
                "dashboard_id": dashboard_id,
                "dashboard_title": dashboard_title,
                "dashboard_url": dashboard_url,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": created_by,
                "requirements_prompt": requirements_prompt,
                "dataset_name": dataset_name,
                "chart_count": len(charts),
                "filter_count": len(filters),
                "position_json": position_json,
                "charts": charts,
                "filters": filters,
                "change_summary": change_summary,
            }

            snap_path = self._snapshot_path(dashboard_id, version)
            with open(snap_path, "w") as f:
                json.dump(snapshot, f, indent=2, default=str)

            index = self.load_index(dashboard_id) or {
                "dashboard_id": dashboard_id,
                "dashboard_title": dashboard_title,
                "dashboard_url": dashboard_url,
                "versions": [],
                "latest_version": 0,
            }
            index["dashboard_title"] = dashboard_title
            index["dashboard_url"] = dashboard_url
            index["latest_version"] = max(int(index.get("latest_version") or 0), version)
            index.setdefault("versions", []).append(
                {
                    "version": version,
                    "created_at": snapshot["created_at"],
                    "chart_count": len(charts),
                    "change_summary": change_summary,
                    "file": snap_path.name,
                }
            )

            with open(self._index_path(dashboard_id), "w") as f:
                json.dump(index, f, indent=2, default=str)
            return version
        except Exception:
            return -1

    def load_snapshot(self, dashboard_id: int, version: int) -> dict | None:
        path = self._snapshot_path(dashboard_id, version)
        if not path.exists():
            return None
        try:
            with open(path) as f:
                data = json.load(f)
            return data if isinstance(data, dict) else None
        except Exception:
            return None

    def list_all_dashboards(self) -> list[dict]:
        results: list[dict] = []
        try:
            paths = list(self.RUNS_DIR.glob("dashboard_*_history.json"))
        except Exception:
            return []

        for path in paths:
            try:
                with open(path) as f:
                    index = json.load(f)
                versions = index.get("versions", [])
                results.append(
                    {
                        "dashboard_id": index["dashboard_id"],
                        "dashboard_title": index["dashboard_title"],
                        "dashboard_url": index.get("dashboard_url", ""),
                        "version_count": len(versions),
                        "latest_version": max(
                            (v["version"] for v in versions),
                            default=0,
                        ),
                        "last_updated": max(
                            (v["created_at"] for v in versions),
                            default="",
                        ),
                    }
                )
            except Exception:
                continue

        return sorted(results, key=lambda x: x["last_updated"], reverse=True)

    def delete_version(self, dashboard_id: int, version: int) -> bool:
        try:
            snap_path = self._snapshot_path(dashboard_id, version)
            if snap_path.exists():
                snap_path.unlink()

            index = self.load_index(dashboard_id)
            if index:
                index["versions"] = [
                    v for v in index.get("versions", [])
                    if v.get("version") != version
                ]
                index["latest_version"] = max(
                    int(index.get("latest_version") or 0),
                    version,
                )
                with open(self._index_path(dashboard_id), "w") as f:
                    json.dump(index, f, indent=2, default=str)
            return True
        except Exception:
            return False
