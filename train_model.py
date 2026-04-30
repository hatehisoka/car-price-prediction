"""Тренування моделі прогнозу ціни авто.

Порівнюємо 3 алгоритми (LinearRegression, GradientBoosting, RandomForest)
за крос-валідацією, обираємо найкращий, рахуємо честні метрики помилки в $$
і % і зберігаємо разом з моделлю важливість ознак.
"""
import json
import time
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, cross_val_score, KFold
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib


# ───── 1. Дані ─────
df = pd.read_csv('car_ad.csv', encoding='latin1')

# Узгоджена з API фільтрація викидів
df = df[(df['price'] > 500) & (df['price'] < 150000)]
df = df[(df['year'] > 1990) & (df['year'] <= 2025)]
df = df[(df['engV'] >= 0.1) & (df['engV'] <= 10)]
df = df[(df['mileage'] >= 0) & (df['mileage'] <= 999)]
df = df.dropna(subset=['car', 'model'])

categorical_features = ['car', 'model', 'body', 'engType', 'drive']
numeric_features = ['mileage', 'engV', 'year']

X = df[categorical_features + numeric_features]
y = df['price']

print(f"Датасет: {len(df)} рядків, {df['car'].nunique()} брендів, {df['model'].nunique()} моделей")
print(f"Ціновий діапазон: ${y.min():.0f} – ${y.max():.0f} (медіана ${y.median():.0f})\n")


# ───── 2. Препроцесор ─────
def make_preprocessor():
    return ColumnTransformer(transformers=[
        ('num', SimpleImputer(strategy='median'), numeric_features),
        ('cat', Pipeline([
            ('imputer', SimpleImputer(strategy='most_frequent')),
            ('onehot', OneHotEncoder(handle_unknown='ignore')),
        ]), categorical_features),
    ])


# ───── 3. Кандидати ─────
candidates = {
    'LinearRegression': LinearRegression(),
    'GradientBoosting': GradientBoostingRegressor(n_estimators=200, max_depth=5, random_state=42),
    'RandomForest':     RandomForestRegressor(n_estimators=150, random_state=42, n_jobs=-1),
}

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
cv = KFold(n_splits=5, shuffle=True, random_state=42)

results = {}
print("───── Порівняння моделей (5-fold CV на тренувальній вибірці) ─────")
for name, estimator in candidates.items():
    pipeline = Pipeline([
        ('preprocessor', make_preprocessor()),
        ('regressor', estimator),
    ])
    t0 = time.time()
    # neg_mean_absolute_error → інверт. знак, щоб MAE було позитивне в $
    cv_mae = -cross_val_score(pipeline, X_train, y_train, cv=cv,
                              scoring='neg_mean_absolute_error', n_jobs=-1)
    cv_r2 = cross_val_score(pipeline, X_train, y_train, cv=cv, scoring='r2', n_jobs=-1)
    elapsed = time.time() - t0
    results[name] = {
        'cv_mae_mean': float(cv_mae.mean()),
        'cv_mae_std':  float(cv_mae.std()),
        'cv_r2_mean':  float(cv_r2.mean()),
        'cv_r2_std':   float(cv_r2.std()),
        'fit_time_s':  round(elapsed, 1),
    }
    print(f"  {name:18s}  MAE = ${cv_mae.mean():>6.0f} ± ${cv_mae.std():>4.0f}   "
          f"R² = {cv_r2.mean():.3f} ± {cv_r2.std():.3f}   ({elapsed:.1f}s)")


# ───── 4. Обираємо переможця за CV-MAE ─────
winner_name = min(results, key=lambda k: results[k]['cv_mae_mean'])
print(f"\nПереможець за CV-MAE: {winner_name}")

final_model = Pipeline([
    ('preprocessor', make_preprocessor()),
    ('regressor', candidates[winner_name]),
])
final_model.fit(X_train, y_train)


# ───── 5. Оцінка на hold-out ─────
y_pred = final_model.predict(X_test)
mae  = mean_absolute_error(y_test, y_pred)
rmse = np.sqrt(mean_squared_error(y_test, y_pred))
r2   = r2_score(y_test, y_pred)
mape = np.mean(np.abs((y_test - y_pred) / y_test)) * 100

print(f"\n───── Оцінка на тестовій вибірці ({len(X_test)} прикладів) ─────")
print(f"  MAE   : ${mae:.0f}            (середня абсолютна похибка)")
print(f"  RMSE  : ${rmse:.0f}            (корінь з MSE — штрафує великі помилки)")
print(f"  MAPE  : {mape:.1f}%               (середня відносна похибка)")
print(f"  R²    : {r2:.4f}            (коеф. детермінації)")


# ───── 6. Важливість ознак ─────
feature_importance = None
regressor = final_model.named_steps['regressor']
if hasattr(regressor, 'feature_importances_'):
    # Розгортаємо OneHot обернено: підсумовуємо вагу кожної категорії в одну ознаку
    preprocessor = final_model.named_steps['preprocessor']
    feature_names = (
        list(numeric_features)
        + list(preprocessor.named_transformers_['cat']
                            .named_steps['onehot']
                            .get_feature_names_out(categorical_features))
    )
    raw_importance = regressor.feature_importances_

    grouped = {f: 0.0 for f in numeric_features + categorical_features}
    for name, imp in zip(feature_names, raw_importance):
        if name in numeric_features:
            grouped[name] += float(imp)
        else:
            for cat in categorical_features:
                if name.startswith(cat + '_'):
                    grouped[cat] += float(imp)
                    break

    total = sum(grouped.values()) or 1.0
    feature_importance = sorted(
        [{'feature': k, 'importance': round(v / total, 4)} for k, v in grouped.items()],
        key=lambda d: -d['importance'],
    )
    print("\n───── Важливість ознак ─────")
    for item in feature_importance:
        bar = '█' * int(item['importance'] * 40)
        print(f"  {item['feature']:10s} {item['importance']:.3f}  {bar}")


# ───── 7. Збереження ─────
joblib.dump(final_model, 'car_model.pkl')

metrics_payload = {
    'winner': winner_name,
    'cv_comparison': results,
    'holdout': {
        'mae': round(float(mae), 2),
        'rmse': round(float(rmse), 2),
        'mape_percent': round(float(mape), 2),
        'r2': round(float(r2), 4),
        'n_test': int(len(X_test)),
        'n_train': int(len(X_train)),
    },
    'feature_importance': feature_importance,
    'price_stats': {
        'min': float(y.min()),
        'max': float(y.max()),
        'median': float(y.median()),
        'mean': float(y.mean()),
    },
}
with open('model_metrics.json', 'w', encoding='utf-8') as f:
    json.dump(metrics_payload, f, indent=2, ensure_ascii=False)

print("\nЗбережено: car_model.pkl, model_metrics.json")
