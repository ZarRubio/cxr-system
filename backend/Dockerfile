FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the TorchXRayVision DenseNet weights during build.
RUN python -c "import torchxrayvision as xrv; xrv.models.DenseNet(weights='densenet121-res224-nih')"

COPY . .
RUN mkdir -p artifacts logs && chmod +x startup.sh

EXPOSE 8000
CMD ["./startup.sh"]
