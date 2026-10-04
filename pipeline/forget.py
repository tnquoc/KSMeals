"""Delete everything the server holds for one device, when a parent asks (privacy page: within 30 days).

The parent sends the id shown by "Hiện mã thiết bị". Removes usage events and Web Push
subscriptions, then the device row; chat_usage and school_requests go with it (on delete cascade).

Usage: uv run python -m pipeline.forget <device-id> [--yes]
"""
import argparse
import uuid

from pipeline.store import Store

TABLES = [("events", "device_id"), ("push_subscriptions", "device_id"), ("chat_usage", "device_id"),
          ("school_requests", "device_id"), ("devices", "id")]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("device_id")
    ap.add_argument("--yes", action="store_true", help="delete without asking")
    args = ap.parse_args()
    device = str(uuid.UUID(args.device_id.strip()))  # rejects typos before touching anything

    store = Store()
    counts = {t: len(store.select(t, select=col, **{col: f"eq.{device}"})) for t, col in TABLES}
    print(f"device {device}: " + ", ".join(f"{t} {n}" for t, n in counts.items()))
    if not any(counts.values()):
        print("nothing stored for this device")
        return
    if not args.yes and input("delete all of it? [y/N] ").strip().lower() != "y":
        print("cancelled")
        return
    for table, col in TABLES:
        if counts[table]:
            store.delete(table, {col: device})
    print("deleted")


if __name__ == "__main__":
    main()
