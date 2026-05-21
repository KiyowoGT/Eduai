# Menggunakan image Python resmi dan ringan
FROM python:3.11-slim

# Mencegah Python menulis file .pyc dan memastikan log langsung muncul
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# Hugging Face menempatkan file di /app
ENV HOME=/app
WORKDIR $HOME

# Buat direktori yang dibutuhkan oleh aplikasi (audio, uploads) agar tidak error permission
RUN mkdir -p audio uploads
RUN chmod 777 audio uploads

# Update sistem dan install dependencies dasar (ffmpeg untuk audio jika diperlukan nantinya)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy file requirements dan install
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy seluruh source code backend ke dalam container
COPY . .

# Berikan izin ke seluruh folder agar Hugging Face (yang berjalan sebagai user biasa) bisa menulis file sementara
RUN chmod -R 777 $HOME

# Hugging Face mewajibkan aplikasi berjalan di port 7860
EXPOSE 7860

# Jalankan server FastAPI menggunakan uvicorn di port 7860
CMD ["uvicorn", "server:fastapi_app", "--host", "0.0.0.0", "--port", "7860", "--proxy-headers"]
