"""Nettoyage des données de test — ligne de commande (la suppression compte par compte se fait depuis le Dashboard admin de l’app).

Usage (depuis backend/, avec MONGO_URL et DB_NAME de l'environnement) :
    python3 scripts/cleanup_test_data.py                          # répétition à blanc : rien n'est supprimé
    python3 scripts/cleanup_test_data.py --apply                  # supprime, après sauvegarde JSON dans scripts/
    python3 scripts/cleanup_test_data.py --remove @handle,x@y.com # comptes supplémentaires à supprimer
    python3 scripts/cleanup_test_data.py --keep @handle           # comptes à protéger
Voir backend/cleanup.py pour les critères de détection.
"""
import os
import sys
import asyncio
import argparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402
import cleanup  # noqa: E402

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "manent_db")


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--remove", default="")
    ap.add_argument("--keep", default="")
    args = ap.parse_args()
    extra = {x.strip().lstrip("@").lower() for x in args.remove.split(",") if x.strip()}
    keep = {x.strip().lstrip("@").lower() for x in args.keep.split(",") if x.strip()}
    db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
    res = await cleanup.plan_cleanup(db, extra, keep)
    print(cleanup.report(DB_NAME, res, args.apply)["text"])
    if not args.apply:
        print("\nRelance avec --apply pour supprimer. --keep @handle protège un compte, --remove en ajoute.")
        return
    out = await cleanup.apply_cleanup(db, res, os.path.dirname(os.path.abspath(__file__)))
    for name, n in out["per_collection"].items():
        print(f"  {name:<22} supprimés : {n}")
    print(f"\nTerminé : {out['deleted']} documents supprimés. Sauvegarde : {out['backup']}")


if __name__ == "__main__":
    asyncio.run(main())
