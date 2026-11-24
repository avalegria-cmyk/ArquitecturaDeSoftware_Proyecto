FROM rust:1-slim AS build
WORKDIR /app
COPY Cargo.toml Cargo.lock* ./
# Capa de dependencias en caché: se compila un main vacío antes de copiar el código.
RUN mkdir src && echo 'fn main() {}' > src/main.rs && cargo build --release && rm -rf src
COPY src ./src
RUN touch src/main.rs && cargo test --release && cargo build --release

FROM debian:trixie-slim
COPY --from=build /app/target/release/servicio_prestamos /usr/local/bin/servicio_prestamos
EXPOSE 3004
USER nobody
CMD ["servicio_prestamos"]
