"""pytest 全局配置 — 测试数据库隔离

conftest 在模块顶层设置 SQLITE_PATH 指向临时目录，
让所有测试文件使用独立数据库，避免污染真实库。
"""
import os, tempfile, shutil
import pytest

_tmp_dir = tempfile.mkdtemp(prefix='supplykit_test_')
os.environ['SQLITE_PATH'] = os.path.join(_tmp_dir, 'test.db')


@pytest.fixture(scope='session', autouse=True)
def _cleanup_tmp():
    """会话结束后清理临时目录"""
    yield
    shutil.rmtree(_tmp_dir, ignore_errors=True)