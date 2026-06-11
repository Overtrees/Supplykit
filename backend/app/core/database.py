import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

raw_url = os.getenv("DATABASE_URL", "sqlite:///./supplychain.db")

# 自动适配 dialect：psycopg2 需要 postgresql+psycopg2://，但多数人写 postgresql://
# 保留原始 URL 让 SQLAlchemy 自动选择已安装的驱动
DATABASE_URL = raw_url

# PostgreSQL 自动加 sslmode（Supabase 要求 SSL）
if raw_url.startswith("postgresql"):
    connector = "&" if "?" in raw_url else "?"
    if "sslmode" not in raw_url:
        DATABASE_URL = raw_url + connector + "sslmode=require"

engine_kwargs = {"pool_pre_ping": True}
if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # PostgreSQL 连接池建议
    engine_kwargs["pool_size"] = 5
    engine_kwargs["max_overflow"] = 10

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
