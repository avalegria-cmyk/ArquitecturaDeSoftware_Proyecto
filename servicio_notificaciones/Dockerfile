FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY *.go ./
RUN go test ./... && CGO_ENABLED=0 go build -o /notificaciones .

FROM alpine:3.22
COPY --from=build /notificaciones /usr/local/bin/notificaciones
EXPOSE 3007
USER nobody
CMD ["notificaciones"]
