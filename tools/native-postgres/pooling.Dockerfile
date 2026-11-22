# Local/CI synthetic acceptance only; never a hosted deployment image.
FROM postgres:17.7
RUN apt-get update && apt-get install -y --no-install-recommends pgbouncer \
    && rm -rf /var/lib/apt/lists/*
