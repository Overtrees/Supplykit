"""共享 SKU 渠道隔离测试

历史 bug 链:
1. seed 共享 SKU 复用 jd 的 '-J' 字符串 → other 渠道出现 jd 命名 SKU
2. products.sku 单一 UNIQUE + upsert INSERT OR REPLACE → 两渠道互相覆盖,
   200 个共享 SKU 在 products 只剩 1 行(channel=other 后写胜出)
   → jd 渠道搜不到自己商品, sku_to_channel 恒判 other

运行: cd backend && python -m pytest tests/test_shared_sku.py -v
"""
import os, sys
_db_path = os.path.join(os.path.dirname(__file__), '..', 'test_shared.db')
os.environ['SQLITE_PATH'] = _db_path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import sqlite3
from app.core.database import init_db, get_db

def setup_module():
    init_db()

def teardown_module():
    try:
        if os.path.exists(_db_path):
            os.unlink(_db_path)
        for ext in ['-wal', '-shm']:
            if os.path.exists(_db_path + ext):
                os.unlink(_db_path + ext)
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
        conn = sqlite3.connect(_db_path)
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
        conn = sqlite3.connect(_db_path)
        conn.row_factory = sqlite3.Row
        _heal_shared_products(conn)
        rows = conn.execute("SELECT sku, channel, supplier_code, product_name FROM products WHERE sku='SKU-0130-J'").fetchall()
        conn.close()
        by_ch = {r['channel']: r for r in rows}
        assert 'jd' in by_ch and 'other' in by_ch, f"补齐后应有两渠道行: {[(r['channel']) for r in rows]}"
        assert by_ch['jd']['supplier_code'] == 'SUP-004-JD'
        assert by_ch['jd']['product_name'] == '糖果130'
        assert by_ch['other']['supplier_code'] == 'SUP-004-OTHER'

    def test_heal_idempotent(self):
        """自愈幂等：跑两次不产生重复行"""
        self._clean()
        db = get_db()
        db.table('products').insert({'sku':'SKU-0001-J','product_name':'酱油1','store':'北京店',
            'category':'调味品','price':8.8,'box_qty':12,'barcode':'6900000000001','weight':10,
            'volume':0.05,'unit':'瓶','status':'active','supplier_code':'SUP-001-OTHER','channel':'other'}).execute()
        db.table('inventory').insert({'sku':'SKU-0001-J','warehouse':'北京','warehouse_type':'platform',
            'available_qty':3,'channel':'jd'}).execute()
        from app.core.database import _heal_shared_products
        conn = sqlite3.connect(_db_path)
        _heal_shared_products(conn)
        _heal_shared_products(conn)
        n = conn.execute("SELECT COUNT(*) FROM products WHERE sku='SKU-0001-J'").fetchone()[0]
        assert n == 2, f"自愈应幂等，实际 {n} 行"
        conn.close()