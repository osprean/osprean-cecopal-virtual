.PHONY: help install db-up db-down db-logs backend-dev frontend-dev migrate migration test test-cov lint format typecheck build clean

# Cargar .env si existe (no obligatorio).
-include .env
export

IMAGE_NAME ?= cecovi
IMAGE_TAG  ?= local

help: ## Lista de targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Instala dependencias (backend + frontend)
	cd backend && uv sync
	cd frontend && yarn install

db-up: ## Levanta PostgreSQL en local
	docker compose -f docker-compose.dev.yml up -d

db-down: ## Para PostgreSQL local
	docker compose -f docker-compose.dev.yml down

db-logs: ## Logs de PostgreSQL local
	docker compose -f docker-compose.dev.yml logs -f postgres

backend-dev: ## Arranca FastAPI con hot reload
	cd backend && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend-dev: ## Arranca Vite dev server
	cd frontend && yarn dev

migrate: ## Aplica migraciones pendientes
	cd backend && uv run alembic upgrade head

migration: ## Genera nueva migración: make migration name="add_items_table"
	cd backend && uv run alembic revision --autogenerate -m "$(name)"

test: ## Corre tests backend + frontend
	cd backend && uv run pytest
	cd frontend && yarn test --run || echo 'frontend tests: pendientes (paso 3)'

test-cov: ## Tests backend con coverage
	cd backend && uv run pytest --cov=app --cov-report=term-missing --cov-report=xml

lint: ## Lint backend + frontend
	cd backend && uv run ruff check . && uv run ruff format --check .
	cd frontend && yarn lint

format: ## Auto-format backend + frontend
	cd backend && uv run ruff check --fix . && uv run ruff format .
	cd frontend && yarn lint --fix || true

typecheck: ## mypy + tsc
	cd backend && uv run mypy app
	cd frontend && yarn tsc -b

build: ## Builda imagen Docker multi-stage
	docker build -f docker/Dockerfile -t $(IMAGE_NAME):$(IMAGE_TAG) .

clean: ## Limpia artefactos
	find . -type d -name __pycache__ -prune -exec rm -rf {} +
	find . -type d -name .pytest_cache -prune -exec rm -rf {} +
	find . -type d -name .mypy_cache -prune -exec rm -rf {} +
	find . -type d -name .ruff_cache -prune -exec rm -rf {} +
	rm -rf backend/htmlcov backend/.coverage backend/coverage.xml
	rm -rf frontend/dist frontend/node_modules
