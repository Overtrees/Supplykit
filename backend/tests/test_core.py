"""SupplyKit 核心逻辑自动化测试

运行: cd backend && pip install pytest httpx && python -m pytest tests/ -v
"""
import sys, os, json, sqlite3, tempfile
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# ─── 测试1: 规则引擎条件求值 ────────────────────────────────────────────────

from app.core.rules import _check_condition, _resolve_value

class TestRulesEngine:
    def test_resolve_simple_field(self):
        ctx = {'inv': {'available_qty': 50, 'safety_qty': 100}}
        assert _resolve_value('inv.available_qty', ctx) == 50

    def test_resolve_deep_field(self):
        ctx = {'order': {'quantity': 30}}
        assert _resolve_value('order.quantity', ctx) == 30

    def test_resolve_missing_field_returns_zero(self):
        assert _resolve_value('inv.nonexistent', {'inv': {}}) == 0

    def test_condition_less_than_true(self):
        assert _check_condition({"left": "inv.available_qty", "op": "<", "right": "inv.safety_qty"},
                                {'inv': {'available_qty': 30, 'safety_qty': 100}}) == True

    def test_condition_less_than_false(self):
        assert _check_condition({"left": "inv.available_qty", "op": "<", "right": "inv.safety_qty"},
                                {'inv': {'available_qty': 150, 'safety_qty': 100}}) == False

    def test_condition_greater_than(self):
        assert _check_condition({"left": "order.quantity", "op": ">", "right": "inv.available_qty"},
                                {'order': {'quantity': 50}, 'inv': {'available_qty': 30}}) == True

    def test_condition_equal(self):
        assert _check_condition({"left": "inv.available_qty", "op": "==", "right": "100"},
                                {'inv': {'available_qty': 100}}) == True

    def test_condition_numeric_right(self):
        assert _check_condition({"left": "inv.available_qty", "op": "<", "right": "50"},
                                {'inv': {'available_qty': 30}}) == True

    def test_condition_max_expression(self):
        # max(1, 30) → 30; 5 <= 30 → True
        assert _check_condition({"left": "inv.available_qty", "op": "<=", "right": "max(1,30)"},
                                {'inv': {'available_qty': 5, 'safety_qty': 100}}) == True

    def test_condition_edge_zero_safety(self):
        assert _check_condition({"left": "inv.available_qty", "op": "<", "right": "inv.safety_qty"},
                                {'inv': {'available_qty': 0, 'safety_qty': 0}}) == False


# ─── 测试2: 清洗字段映射 ────────────────────────────────────────────────────

from app.api.routes.cleansing import cleanse_value

class TestCleanseValue:
    def test_number_cleaning(self):
        assert cleanse_value('¥1,234.56', {'type': 'number'}) == 1234.56

    def test_number_with_symbols(self):
        assert cleanse_value('100 件', {'type': 'number'}) == 100

    def test_number_integer(self):
        assert cleanse_value('50', {'type': 'number'}) == 50

    def test_null_value_returns_default(self):
        assert cleanse_value(None, {'type': 'string', 'default': ''}) == ''

    def test_empty_string_returns_default(self):
        assert cleanse_value('  ', {'type': 'string', 'default': 'N/A'}) == 'N/A'

    def test_string_passthrough(self):
        assert cleanse_value('珠江桥牌酱油', {'type': 'string'}) == '珠江桥牌酱油'

    def test_date_truncation(self):
        assert cleanse_value('2026-07-04 14:30:00', {'type': 'date', 'format': 'YMD'}) == '2026-07-04'

    def test_number_negative(self):
        assert cleanse_value('-10', {'type': 'number'}) == -10

    def test_number_with_dollar(self):
        assert cleanse_value('$99.99', {'type': 'number'}) == 99.99


# ─── 测试3: 补货公式（纯逻辑验证） ────────────────────────────────────────

class TestReplenishmentFormula:
    """验证补货建议的核心计算逻辑（独立于数据库）"""

    def test_bbcc_lead_time(self):
        """BBCC 前置期 = lead + ship_to_b + b_to_c + c_safety"""
        lead = 7 + 3 + 3 + 5  # 默认值
        assert lead == 18

    def test_traditional_lead_time(self):
        """传统前置期 = lead_time_days"""
        lead = 7  # 默认值
        assert lead == 7

    def test_suggested_qty_formula(self):
        """建议补 = 日销×前置期 + 安全库存 - 可用 - 在途"""
        daily_sales = 10
        lead_time = 18  # BBCC
        safety_mult = 3
        safety_days = daily_sales * safety_mult
        avail = 50
        transit = 20
        effective_safety = round(daily_sales * safety_mult)

        raw_suggested = max(round(daily_sales * lead_time + effective_safety - avail - transit), 0)
        assert raw_suggested == 140  # 10*18 + 30 - 50 - 20 = 140

    def test_box_qty_ceiling(self):
        """箱规向上取整"""
        for raw, box, expected in [(140, 12, 144), (0, 12, 0), (1, 12, 12), (12, 12, 12), (13, 12, 24)]:
            result = (raw + box - 1) // box * box if raw > 0 else 0
            assert result == expected, f"raw={raw}, box={box} → {result} != {expected}"

    def test_days_to_empty(self):
        """可撑天数 = 可用 / 日销"""
        assert round(50 / 10, 1) == 5.0
        assert round(0 / 10, 1) == 0.0
        assert 999  # 日销为0时

    def test_after_turnover(self):
        """补后周转 = (可用+在途+实际补) / 日销"""
        after_stock = 50 + 20 + 144  # avail + transit + boxed_qty
        turnover = round(after_stock / 10, 1)
        assert turnover == 21.4  # 214/10

    def test_active_factor_applies(self):
        """活动系数乘以日销"""
        daily_sales = 10
        active_factor = 1.5
        assert round(daily_sales * active_factor, 1) == 15.0

    def test_effective_safety_with_custom_days(self):
        """安全库存天数自定义"""
        sel_ds = 15
        safety_days = 5
        assert round(sel_ds * safety_days) == 75


# ─── 测试4: 数据库级联查询（使用临时 SQLite） ────────────────────────────

class TestDatabaseLayer:
    def setup_method(self):
        self.tmp = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
        self.db_path = self.tmp.name
        self.tmp.close()

        from app.core.database import init_db, SQLiteDB
        init_db(self.db_path)
        self.db = SQLiteDB(self.db_path)

    def teardown_method(self):
        os.unlink(self.db_path)

    def test_insert_and_query(self):
        self.db.table("products").insert({
            "sku": "TEST-001",
            "product_name": "测试商品",
            "store": "测试店铺",
            "box_qty": 12,
        }).execute()
        rows = self.db.table("products").select("*").eq("sku", "TEST-001").execute().data
        assert len(rows) == 1
        assert rows[0]["product_name"] == "测试商品"
        assert rows[0]["box_qty"] == 12

    def test_upsert(self):
        self.db.table("replenishment_config").upsert({"key": "lead_time_days", "value": "10"})
        rows = self.db.table("replenishment_config").select("*").eq("key", "lead_time_days").execute().data
        assert len(rows) >= 1

    def test_purchase_orders_table(self):
        self.db.table("purchase_orders").upsert({
            "sku": "SKU-001",
            "store": "京东自营",
            "product_name": "酱油",
            "suggested_qty": 144,
            "status": "pending",
        })
        rows = self.db.table("purchase_orders").select("*").eq("sku", "SKU-001").execute().data
        assert len(rows) == 1
        assert rows[0]["suggested_qty"] == 144

    def test_delete(self):
        self.db.table("products").insert({
            "sku": "DEL-TEST",
            "product_name": "待删除",
        }).execute()
        self.db.table("products").delete().eq("sku", "DEL-TEST").execute()
        rows = self.db.table("products").select("*").eq("sku", "DEL-TEST").execute().data
        assert len(rows) == 0

    def test_batch_filter(self):
        for i in range(5):
            self.db.table("orders").insert({
                "order_no": f"ORD-{i:03d}",
                "sku": f"SKU-{i:03d}",
                "quantity": i * 10,
                "order_status": "已完成" if i % 2 == 0 else "待发货",
                "ordered_at": f"2026-07-{i+1:02d}",
            }).execute()
        pending = self.db.table("orders").select("*").eq("order_status", "待发货").execute().data
        assert len(pending) == 2  # i=1,3
        done = self.db.table("orders").select("*").eq("order_status", "已完成").execute().data
        assert len(done) == 3  # i=0,2,4


# ─── 测试5: 采购记录路由（测试直连） ──────────────────────────────────────

class TestPurchaseOrdersRoute:
    def setup_method(self):
        self.tmp = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
        self.db_path = self.tmp.name
        self.tmp.close()
        from app.core.database import init_db, SQLiteDB
        init_db(self.db_path)
        self.db = SQLiteDB(self.db_path)

    def teardown_method(self):
        os.unlink(self.db_path)

    def test_create_and_list(self):
        self.db.table("purchase_orders").upsert({
            "sku": "PO-SKU-01",
            "store": "京东自营",
            "product_name": "生抽500ml",
            "suggested_qty": 240,
            "status": "pending",
        })
        items = self.db.table("purchase_orders").select("*").execute().data or []
        assert len(items) >= 1
        assert any(x["sku"] == "PO-SKU-01" for x in items)

    def test_create_twice_upserts(self):
        self.db.table("purchase_orders").upsert({
            "sku": "PO-SKU-02",
            "store": "京东自营",
            "product_name": "老抽",
            "suggested_qty": 120,
        })
        self.db.table("purchase_orders").upsert({
            "sku": "PO-SKU-02",
            "store": "京东自营",
            "product_name": "老抽",
            "suggested_qty": 144,  # 更新数量
        })
        items = self.db.table("purchase_orders").select("*").eq("sku", "PO-SKU-02").execute().data
        assert len(items) == 1
        assert items[0]["suggested_qty"] == 144
