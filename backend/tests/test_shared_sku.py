"""共享 SKU 渠道隔离测试

历史 bug 链:
1. seed 共享 SKU 复用 jd 的 '-J' 字符串 → other 渠道出现 jd 命名 SKU
2. products.sku 单一 UNIQUE + upsert INSERT OR REPLACE → 两渠道互相覆盖,
   200 个共享 SKU 在 products 只剩 1 行(channel=other 后写胜出)
   → jd 渠道搜不到自己商品, sku_to_channel 恒判 other

运行: cd backend && python -m pytest tests/test_shared_sku.py -v
"""
import os, sys
os.environ['SQLITE_PATH'] = os.path.join(os.path.dirname(__file__), '..', '.test_shared_sku.db')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import sqlite3

DB_PATH = None
get_db = None


def setup_module():
    """本文件测试前：重载 app 模块 + 初始化独立数据库"""
    global DB_PATH, get_db
    for _m in list(sys.modules):
        if _m.startswith('app.'):
            sys.modules.pop(_m, None)
    from app.core.database import DB_PATH as _DB_PATH, init_db, get_db as _get_db
    DB_PATH = _DB_PATH
    get_db = _get_db
    init_db()


def teardown_module():
    try:
        if os.path.exists(DB_PATH):
            os.unlink(DB_PATH)
        for ext in ['-wal', '-shm']:
            if os.path.exists(DB_PATH + ext):
                os.unlink(DB_PATH + ext)
    except Exception:
        pass


class TestSeedSharedSku:
    def test_shared_sku_independent_names(self):
        """共享 SKU 必须独立命名（-J 只在 jd、-O 只在 other），内容共享"""
        from app.api.routes.seed import make_skus
        jd_s = make_skus('-J', 1000)
        shared_skus = jd_s[:200]  # dict 内容模板
        ot_s = make_skus('-O', 1000, shared=shared_skus + [None] * 800)
        jd_names = {s['sku'] for s in jd_s}
        ot_names = {s['sku'] for s in ot_s}
        assert not (jd_names & ot_names), f"跨渠道同名 SKU: {list(jd_names & ot_names)[:5]}"
        assert len(jd_names) == 1000 and len(ot_names) == 1000
        # 内容共享：SKU-0130-O 与 SKU-0130-J 商品名/品类一致
        jd_130 = next(s for s in jd_s if s['sku'] == 'SKU-0130-J')
        ot_130 = next(s for s in ot_s if s['sku'] == 'SKU-0130-O')
        assert jd_130['name'] == ot_130['name']
        assert jd_130['cat'] == ot_130['cat']

    def test_shared_sku_not_in_other_channel(self):
        """other 渠道不得包含任何 -J 命名 SKU"""
        from app.api.routes.seed import make_skus
        jd_s = make_skus('-J', 1000)
        ot_s = make_skus('-O', 1000, shared=jd_s[:200] + [None] * 800)
        assert all(not s['sku'].endswith('-J') for s in ot_s)


class TestHealSharedProducts:
    def _clean(self):
        conn = sqlite3.connect(DB_PATH)
        for t in ['products', 'inventory']:
            try: conn.execute(f'DELETE FROM "{t}"')
            except Exception: pass
        conn.commit()
        conn.close()

    def test_heal_missing_jd_row(self):
        """products 缺 jd 行时自愈补齐（从 other 行复制 + 渠道后缀替换）"""
        self._clean()
        db = get_db()
        db.table('products').insert({'sku':'SKU-0130-J','product_name':'糖果130','store':'北京店',
            'category':'糖果','price':9.9,'box_qty':24,'barcode':'6900000000130','weight':10,
            'volume':0.05,'unit':'包','status':'active','supplier_code':'SUP-004-OTHER','channel':'other'}).execute()
        db.table('inventory').insert({'sku':'SKU-0130-J','warehouse':'北京','warehouse_type':'platform',
            'available_qty':3,'channel':'jd'}).execute()
        db.table('inventory').insert({'sku':'SKU-0130-J','warehouse':'北京','warehouse_type':'platform',
            'available_qty':99,'channel':'other'}).execute()
        from app.core.database import _heal_shared_products
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        _heal_shared_products(conn)
