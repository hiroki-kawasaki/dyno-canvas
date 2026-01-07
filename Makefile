.PHONY: install dev build start lint test docker-up docker-down docker-build-up

install:
	npm install

dev:
	npm run dev

build:
	npm run build

start:
	npm run start

lint:
	npm run lint

test:
	npm run test

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down