.PHONY: up down restart logs clean

up:
	docker compose up -d

down:
	docker compose down

restart: down up

logs:
	docker compose logs -f

clean:
	docker compose down -v
