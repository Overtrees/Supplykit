import os
from app.core.database import Base, engine, SessionLocal
from app.services.dashboard_service import seed_data
from app.services.event_service import rebuild_low_stock_alerts


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if os.getenv("APP_ENV", "development") != "production":
            seed_data(db)
            rebuild_low_stock_alerts(db)
            db.commit()
        print("database initialized")
    finally:
        db.close()

if __name__ == "__main__":
    main()
