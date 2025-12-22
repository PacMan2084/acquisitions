#!/bin/bash


echo "🚀 Starting Acquisition App in Development Mode"
echo "================================================"

# Check if .env.development exists
if [ ! -f .env.development ]; then
    echo "❌ Error: .env.development file not found!"
    echo "   Please create .env.development (you can copy from .env.example) and ensure DATABASE_URL matches the local Postgres container (see docker-compose.dev.yml)."
    exit 1
fi

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Error: Docker is not running!"
    echo "   Please start Docker Desktop and try again."
    exit 1
fi

echo ""

# Start (or ensure) Postgres is running
echo "🐘 Starting local Postgres (docker-compose.dev.yml)..."
docker compose -f docker-compose.dev.yml up -d postgres

# Wait for the database to be ready
echo "⏳ Waiting for the database to be ready..."
# Wait for Postgres service defined in docker-compose.dev.yml
until docker compose -f docker-compose.dev.yml exec postgres pg_isready -U postgres -d acquisitions >/dev/null 2>&1; do
  echo "   Waiting for Postgres..."
  sleep 2
done

echo "✅ Database is ready"

# Run migrations with Drizzle
echo "📜 Applying latest schema with Drizzle..."
npm run db:migrate

# Start development environment (app + postgres)
echo "📦 Starting development containers (app + postgres)..."
docker compose -f docker-compose.dev.yml up --build

echo "🎉 Development environment started!"
echo "   Application: http://localhost:3000"
echo "   Database: postgresql://postgres:postgres@localhost:5432/acquisitions"

echo ""
echo "To stop the environment, press Ctrl+C or run: docker compose -f docker-compose.dev.yml down"
