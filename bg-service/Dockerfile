FROM python:3.12-slim
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# CPU-only PyTorch (the default wheel bundles ~3 GB of CUDA)
RUN pip install --no-cache-dir torch==2.14.1 torchvision==0.29.1 --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# fetch the model at build time so the container starts without a download
RUN python -c "from transparent_background import Remover; Remover(mode='fast', device='cpu')"
COPY app.py .
ENV PORT=8080 TB_MODE=fast THREADS=2
# one worker holds one copy of the model; a removal takes ~6s on 2 CPUs
CMD ["sh", "-c", "gunicorn -w 1 --threads 2 --timeout 120 -b 0.0.0.0:${PORT} app:app"]
