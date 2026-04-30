"""Інтеграційні тести FastAPI-бекенду.

Запуск з кореня проєкту:
    pytest -v

Тести використовують натреновану модель та CSV — переконайтесь, що
файли car_model.pkl та car_ad.csv присутні (запустіть train_model.py).
"""
import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Додаємо корінь проєкту в sys.path, щоб main.py імпортувався
sys.path.insert(0, str(Path(__file__).parent.parent))

from main import app  # noqa: E402

client = TestClient(app)


# ───── Базові ─────
def test_health_returns_ok():
    r = client.get("/")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["model_loaded"] is True


def test_options_has_cars_and_models():
    r = client.get("/options")
    assert r.status_code == 200
    data = r.json()
    assert "cars" in data and len(data["cars"]) > 0
    assert "models_by_car" in data
    assert "specs_by_model" in data
    assert "limits" in data
    # Хоч одна марка має бути з відомим прикладом
    assert "BMW" in data["models_by_car"]


# ───── /predict — щасливий шлях ─────
@pytest.fixture
def valid_payload():
    return {
        "car": "BMW",
        "model": "X5",
        "year": 2015,
        "engType": "Diesel",
        "body": "crossover",
        "drive": "full",
        "mileage": 120,
        "engV": 3.0,
    }


def test_predict_returns_positive_price(valid_payload):
    r = client.post("/predict", json=valid_payload)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "success"
    assert body["predicted_price_usd"] > 500
    assert body["interval"]["low"] <= body["predicted_price_usd"] <= body["interval"]["high"]
    assert body["confidence"] in ("low", "medium", "high")


def test_predict_includes_extrapolation_warning_for_future_year(valid_payload):
    valid_payload["year"] = 2026
    r = client.post("/predict", json=valid_payload)
    assert r.status_code == 200
    body = r.json()
    # для 2026 X5 у датасеті майже точно немає — має бути попередження
    assert body["extrapolation_warning"] is not None


# ───── /predict — валідація ─────
def test_predict_rejects_year_out_of_range(valid_payload):
    valid_payload["year"] = 1900
    r = client.post("/predict", json=valid_payload)
    assert r.status_code == 422  # Pydantic validation


def test_predict_rejects_engv_out_of_range(valid_payload):
    valid_payload["engV"] = 15.0
    r = client.post("/predict", json=valid_payload)
    assert r.status_code == 422


def test_predict_rejects_negative_mileage(valid_payload):
    valid_payload["mileage"] = -10
    r = client.post("/predict", json=valid_payload)
    assert r.status_code == 422


# ───── Інші ендпоінти ─────
def test_metrics_returns_holdout_results():
    r = client.get("/metrics")
    if r.status_code == 404:
        pytest.skip("model_metrics.json відсутній")
    assert r.status_code == 200
    body = r.json()
    assert "holdout" in body and "mae" in body["holdout"]
    assert body["holdout"]["mae"] > 0


def test_feature_importance_returns_sorted_list():
    r = client.get("/feature-importance")
    if r.status_code == 404:
        pytest.skip("feature_importance відсутній (мабуть, переможець не RF/GB)")
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) > 0
    # Має бути відсортовано за спаданням
    importances = [x["importance"] for x in items]
    assert importances == sorted(importances, reverse=True)


def test_similar_cars_returns_items_for_known_brand():
    r = client.post("/similar-cars", json={
        "car": "BMW", "model": "X5",
        "year": 2015, "engV": 3.0, "mileage": 120,
        "limit": 5,
    })
    assert r.status_code == 200
    body = r.json()
    assert len(body["items"]) > 0
    assert all(item["car"] == "BMW" for item in body["items"])


def test_stats_returns_histogram_and_aggregates():
    r = client.get("/stats")
    assert r.status_code == 200
    body = r.json()
    assert body["totals"]["rows"] > 0
    assert len(body["price_histogram"]) > 0
    assert len(body["avg_price_by_brand"]) > 0
    assert len(body["price_by_year"]) > 0
