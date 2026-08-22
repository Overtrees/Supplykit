"""pytest 全局配置 — 测试数据库隔离

问题：database.py 的 DB_PATH 在模块加载时读取 SQLITE_PATH，多个测试文件
共享默认路径 backend/app/supplykit.db → 组合跑时互相污染真实库。

解决：在 conftest 模块顶层（pytest 收集前）设置 SQLITE_PATH 指向临时目录，
让使用默认路径的测试不写真实库。注意必须放在模块顶层——测试模块的
import 语句（如模块级 init_db()）在收集阶段就执行了，此时 fixture 尚未运行。

说明：测试文件内部自行覆盖 SQLITE_PATH（如 test_purchase_channel.py 硬编码
test_purchase_ch.db）是既有设计，conftest 不做干预；组合跑时这些文件使用
各自独立文件，不会污染真实库。同文件多测试共享模块级 seed 数据是既有依赖，
不要在此处加 per-test 清空（会破坏该依赖）。
"""
import os
import tempfile
import shutil

import pytest

# 模块顶层立即生效（早于任何测试模块 import）
_tmp_dir = tempfile.mkdtemp(prefix='supplykit_test_')
os.environ['SQLITE_PATH'] = os.path.join(_tmp_dir, 'test.db')
os.environ['DB_PATH'] = os.environ['SQLITE_PATH']  # 兼容某些硬编码读取


@pytest.fixture(scope='session', autouse=True)
def _cleanup_tmp():
    """会话结束后清理临时目录"""
    yield
    shutil.rmtree(_tmp_dir, ignore_errors=True)
