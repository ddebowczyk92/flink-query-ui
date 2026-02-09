# Flink Query UI

Web-based SQL editor for [Apache Flink](https://flink.apache.org/). Communicates with Flink clusters through the [SQL Gateway REST API (v4)](https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/table/sql-gateway/rest/).

Heavily inspired by [trino-query-ui](https://github.com/trinodb/trino-query-ui).

> **Not ready for production use.**

## Quick Start

```bash
# Start Flink cluster + SQL Gateway + Kafka
docker compose up -d

# Install dependencies and start dev server
npm install
npm run dev
```

The dev server runs at `http://localhost:5173` and proxies SQL Gateway requests to `localhost:8083`.

## Build

```bash
npm run build        # type-check + production build
npm run lint         # eslint
npm run check        # install + lint + format check
```
