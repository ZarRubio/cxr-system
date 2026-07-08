FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Usuario sin privilegios: el proceso nunca corre como root.
RUN useradd --create-home --uid 1001 appuser

# Pre-descarga de pesos DenseNet de TorchXRayVision en el HOME del usuario final,
# para que el runtime los encuentre sin volver a descargarlos.
USER appuser
ENV HOME=/home/appuser
RUN python -c "import torchxrayvision as xrv; xrv.models.DenseNet(weights='densenet121-res224-nih')"

USER root
COPY . .
RUN mkdir -p artifacts logs \
    && chmod +x startup.sh \
    && chown -R appuser:appuser /app

USER appuser
EXPOSE 8000
CMD ["./startup.sh"]
