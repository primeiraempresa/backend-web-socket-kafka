#!/bin/sh

set -e

echo "⏳ Aguardando MinIO..."
sleep 5

mc alias set localminio http://minio:9000 minioadmin minioadmin123

echo "📦 Criando bucket..."
mc mb --ignore-existing localminio/images

echo "⬆️ Subindo imagens para o bucket..."
mc cp /seed/images/* localminio/images

echo "🌐 Tornando bucket público..."
mc anonymous set download localminio/images 