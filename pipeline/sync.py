"""Sync the school list (data/coverage.csv from survey.py) into Supabase.

Posts, OCR output and meals are written by crawl.py / process.py directly.
The `active` flag is left alone here: process.py turns it on once a school has a published meal.

Usage: uv run python -m pipeline.sync
"""
import csv

from pipeline import config
from pipeline.store import Store


def main():
    with open(config.DATA_DIR / "coverage.csv", encoding="utf-8") as fh:
        schools = [{
            "code": r["code"], "name": r["name"], "level": r["level"], "ward": r["ward"],
            "coverage_status": r["status"], "last_menu_date": r["last_menu_date"] or None,
        } for r in csv.DictReader(fh)]
    Store().upsert("schools", schools, "code")
    print(f"schools: {len(schools)}")


if __name__ == "__main__":
    main()
