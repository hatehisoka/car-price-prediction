"""FastAPI бекенд для прогнозу ціни авто.

Ендпоінти:
  GET  /                    — health check
  GET  /options             — списки марок/моделей/типів + обмеження
  GET  /metrics             — точність моделі (MAE/RMSE/MAPE/R²)
  GET  /feature-importance  — вклад кожної ознаки у прогноз
  POST /predict             — прогноз ціни з довірчим інтервалом
  POST /similar-cars        — N найближчих авто з датасету
  GET  /stats               — агреговані дані для EDA-вкладки
"""
import json
import logging
import os
from datetime import datetime
from functools import lru_cache
from typing import List, Optional

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, field_validator


# ───── Логування ─────
os.makedirs('logs', exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(message)s',
    handlers=[
        logging.FileHandler('logs/api.log', encoding='utf-8'),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger('car-price')


# ───── Додаток ─────
app = FastAPI(
    title="Car Price Prediction API",
    description="ML-прогноз ринкової вартості авто з довірчим інтервалом",
    version="2.0.0",
)

# CORS — обмежено локальним фронтом + типовими портами Vite
ALLOWED_ORIGINS = [
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:5174", "http://127.0.0.1:5174",
    "http://localhost:5175", "http://127.0.0.1:5175",
    "http://localhost:3000", "http://127.0.0.1:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ───── Завантаження моделі та метрик ─────
try:
    ml_model = joblib.load('car_model.pkl')
    log.info("Модель завантажено: car_model.pkl")
except FileNotFoundError:
    raise RuntimeError("car_model.pkl не знайдено. Запустіть python train_model.py")

try:
    with open('model_metrics.json', 'r', encoding='utf-8') as f:
        MODEL_METRICS = json.load(f)
    log.info(f"Метрики моделі: MAE=${MODEL_METRICS['holdout']['mae']:.0f}, "
             f"R²={MODEL_METRICS['holdout']['r2']:.3f}")
except FileNotFoundError:
    MODEL_METRICS = None
    log.warning("model_metrics.json відсутній — /metrics поверне 404")


# ───── Обмеження ─────
LIMITS = {
    "year":    {"min": 1980, "max": datetime.now().year},
    "mileage": {"min": 0,    "max": 999},
    "engV":    {"min": 0.1,  "max": 10.0},
}


# ───── Pydantic-схеми ─────
class CarFeatures(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    car: str = Field(..., min_length=1)
    model: str = Field(..., min_length=1)
    engType: str = Field(...)
    year: int = Field(...)
    mileage: float = Field(default=150.0,
                           ge=LIMITS["mileage"]["min"], le=LIMITS["mileage"]["max"])
    engV: float = Field(default=2.0,
                        ge=LIMITS["engV"]["min"], le=LIMITS["engV"]["max"])
    body: Optional[str] = "crossover"
    drive: Optional[str] = "full"

    @field_validator('year')
    def validate_year(cls, v):
        lo, hi = LIMITS["year"]["min"], LIMITS["year"]["max"]
        if v < lo or v > hi:
            raise ValueError(f'Рік випуску має бути між {lo} та {hi}')
        return v


class SimilarRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    car: str
    model: Optional[str] = None
    year: Optional[int] = None
    engV: Optional[float] = None
    mileage: Optional[float] = None
    limit: int = Field(default=5, ge=1, le=20)


# ───── Допоміжні: завантаження CSV для довідників та EDA ─────
@lru_cache(maxsize=1)
def load_dataset() -> pd.DataFrame:
    df = pd.read_csv('car_ad.csv', encoding='latin1')
    df = df.dropna(subset=['car', 'model'])
    return df


@lru_cache(maxsize=1)
def load_options():
    df = load_dataset()

    grouped = (df.groupby('car')['model']
                 .apply(lambda s: sorted(s.dropna().unique().tolist()))
                 .to_dict())

    specs_by_model = {}
    for (car, model), grp in df.groupby(['car', 'model']):
        eng_v = grp['engV'].dropna()
        years = grp['year'].dropna()
        eng_v_values = sorted({round(float(v), 1) for v in eng_v}) if not eng_v.empty else []
        specs_by_model.setdefault(car, {})[model] = {
            "bodies":     sorted(grp['body'].dropna().unique().tolist()),
            "engTypes":   sorted(grp['engType'].dropna().unique().tolist()),
            "drives":     sorted(grp['drive'].dropna().unique().tolist()),
            "engV_values": eng_v_values,
            "engV_range": [eng_v_values[0], eng_v_values[-1]] if eng_v_values else None,
            "year_range": [int(years.min()), int(years.max())] if not years.empty else None,
        }

    return {
        "cars": sorted(grouped.keys()),
        "models_by_car": grouped,
        "specs_by_model": specs_by_model,
        "bodies":   sorted(df['body'].dropna().unique().tolist()),
        "engTypes": sorted(df['engType'].dropna().unique().tolist()),
        "drives":   sorted(df['drive'].dropna().unique().tolist()),
        "limits": LIMITS,
    }


def predict_with_interval(features_df: pd.DataFrame) -> dict:
    """Прогноз з 95% довірчим інтервалом — через варіансу окремих дерев RF.
    Для не-RF моделей повертає лише точкову оцінку."""
    point = float(ml_model.predict(features_df)[0])
    regressor = ml_model.named_steps['regressor']

    if hasattr(regressor, 'estimators_'):
        # Окремий прогноз кожного дерева через preprocessor
        X_processed = ml_model.named_steps['preprocessor'].transform(features_df)
        tree_preds = np.array([tree.predict(X_processed)[0] for tree in regressor.estimators_])
        mean = float(tree_preds.mean())
        std  = float(tree_preds.std())
        return {
            "mean": mean,
            "std": std,
            "low":  max(0.0, mean - 1.96 * std),
            "high": mean + 1.96 * std,
            "n_trees": len(tree_preds),
        }
    return {"mean": point, "std": 0.0, "low": point, "high": point, "n_trees": 0}


# ───── Ендпоінти ─────
@app.get("/")
def health_check():
    return {
        "status": "ok",
        "version": app.version,
        "model_loaded": ml_model is not None,
        "metrics_loaded": MODEL_METRICS is not None,
    }


@app.get("/options")
def options():
    return load_options()


@app.get("/metrics")
def metrics():
    if MODEL_METRICS is None:
        raise HTTPException(404, "model_metrics.json відсутній. Перетренуйте модель.")
    return MODEL_METRICS


@app.get("/feature-importance")
def feature_importance():
    if not MODEL_METRICS or not MODEL_METRICS.get('feature_importance'):
        raise HTTPException(404, "Дані про важливість ознак відсутні")
    return {"items": MODEL_METRICS['feature_importance']}


@app.post("/predict")
def predict_price(features: CarFeatures):
    try:
        input_df = pd.DataFrame([features.model_dump()])
        interval = predict_with_interval(input_df)
        price = max(500, round(interval['mean']))

        # Оцінка надійності — наскільки введені параметри схожі на тренувальні
        df = load_dataset()
        same_model = df[(df['car'] == features.car) & (df['model'] == features.model)]
        n_similar = len(same_model)
        if n_similar >= 20:
            confidence = "high"
        elif n_similar >= 5:
            confidence = "medium"
        else:
            confidence = "low"

        # Чи рік за межами тренувального розподілу для цієї моделі?
        extrapolation_warning = None
        if not same_model.empty:
            y_min, y_max = same_model['year'].min(), same_model['year'].max()
            if features.year > y_max + 1:
                extrapolation_warning = (
                    f"У датасеті {features.car} {features.model} тільки до {int(y_max)} року. "
                    f"Прогноз для {features.year} — екстраполяція."
                )

        log.info(f"PREDICT {features.car} {features.model} {features.year} → "
                 f"${price} [{interval['low']:.0f}–{interval['high']:.0f}] conf={confidence}")

        return {
            "status": "success",
            "predicted_price_usd": price,
            "interval": {
                "low":  round(interval['low']),
                "high": round(interval['high']),
            },
            "confidence": confidence,
            "n_similar_in_dataset": n_similar,
            "extrapolation_warning": extrapolation_warning,
            "inputs_received": features.model_dump(),
        }
    except HTTPException:
        raise
    except Exception as e:
        log.exception("Predict failed")
        raise HTTPException(500, f"Помилка прогнозування: {e}")


@app.post("/similar-cars")
def similar_cars(req: SimilarRequest):
    """Топ-N найближчих авто з датасету за зваженою евклідовою відстанню."""
    df = load_dataset().copy()
    candidates = df[df['car'] == req.car]
    if req.model:
        m = candidates[candidates['model'] == req.model]
        if not m.empty:
            candidates = m

    if candidates.empty:
        return {"items": [], "total": 0}

    score = pd.Series(0.0, index=candidates.index)
    if req.year is not None:
        score += ((candidates['year'] - req.year).abs() / 5.0) ** 2
    if req.engV is not None:
        score += ((candidates['engV'] - req.engV).abs() / 0.5) ** 2 * 1.5
    if req.mileage is not None:
        score += ((candidates['mileage'] - req.mileage).abs() / 50.0) ** 2 * 0.7

    top = candidates.assign(_score=score).sort_values('_score').head(req.limit)
    items = top.replace({np.nan: None}).to_dict(orient='records')
    for item in items:
        item.pop('_score', None)
    return {"items": items, "total": int(len(candidates))}


@app.get("/stats")
def stats():
    """Агреговані дані для EDA-вкладки фронтенду."""
    df = load_dataset()
    df = df[(df['price'] > 500) & (df['price'] < 150000)]
    df = df[(df['year'] > 1990) & (df['year'] <= datetime.now().year)]

    # 1. Гістограма цін: 30 бінів
    counts, edges = np.histogram(df['price'], bins=30)
    price_hist = [
        {"x": float((edges[i] + edges[i + 1]) / 2),
         "low": float(edges[i]), "high": float(edges[i + 1]),
         "count": int(counts[i])}
        for i in range(len(counts))
    ]

    # 2. Топ-15 марок за середньою ціною
    top_brands = (df.groupby('car')
                    .agg(avg_price=('price', 'mean'),
                         count=('price', 'size'))
                    .query('count >= 30')
                    .sort_values('avg_price', ascending=False)
                    .head(15)
                    .reset_index())
    avg_by_brand = top_brands.to_dict(orient='records')

    # 3. Залежність ціни від року
    by_year = (df.groupby('year')['price']
                 .agg(['mean', 'median', 'count'])
                 .reset_index())
    year_price = by_year.to_dict(orient='records')

    # 4. Залежність ціни від пробігу — біни
    df_m = df[df['mileage'] <= 500].copy()
    df_m['mile_bin'] = (df_m['mileage'] // 25 * 25).astype(int)
    by_mileage = (df_m.groupby('mile_bin')['price']
                      .agg(['mean', 'count'])
                      .reset_index()
                      .rename(columns={'mile_bin': 'mileage'}))
    mileage_price = by_mileage.to_dict(orient='records')

    return {
        "totals": {
            "rows": int(len(df)),
            "brands": int(df['car'].nunique()),
            "models": int(df['model'].nunique()),
        },
        "price_histogram": price_hist,
        "avg_price_by_brand": avg_by_brand,
        "price_by_year": year_price,
        "price_by_mileage": mileage_price,
    }
