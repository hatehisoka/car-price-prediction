FROM python:3.13-slim

WORKDIR /app

# Системні залежності для scikit-learn (numpy/scipy)
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

# Залежності окремим шаром, щоб кешувалось
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Копіюємо код і дані
COPY car_ad.csv train_model.py main.py ./

# Тренуємо модель під час білду — образ одразу готовий до використання.
# (Альтернатива: монтувати car_model.pkl зовні через volume.)
RUN python train_model.py

# Створюємо директорію логів
RUN mkdir -p logs

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
