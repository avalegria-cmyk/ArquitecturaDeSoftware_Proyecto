package main

import (
	"log"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

const (
	exchange = "uniequipos.eventos"
	cola     = "notificaciones.cambios"
)

// Solo los cambios de datos se avisan al navegador; los inicios de sesión (auth.*) no.
var claves = []string{"equipment.#", "reservation.#", "loan.#", "maintenance.#"}

// consumir escucha la cola de RabbitMQ y avisa a los navegadores por SSE.
// Si el broker se cae, vuelve a conectarse cada 3 segundos.
func consumir(url string, hub *Hub) {
	for {
		if err := escuchar(url, hub); err != nil {
			log.Printf("RabbitMQ no disponible (%v); reintento en 3 s", err)
		}
		time.Sleep(3 * time.Second)
	}
}

func escuchar(url string, hub *Hub) error {
	conexion, err := amqp.Dial(url)
	if err != nil {
		return err
	}
	defer conexion.Close()
	canal, err := conexion.Channel()
	if err != nil {
		return err
	}
	if err := canal.ExchangeDeclare(exchange, "topic", true, false, false, false, nil); err != nil {
		return err
	}
	q, err := canal.QueueDeclare(cola, true, false, false, false, nil)
	if err != nil {
		return err
	}
	for _, clave := range claves {
		if err := canal.QueueBind(q.Name, clave, exchange, false, nil); err != nil {
			return err
		}
	}
	mensajes, err := canal.Consume(q.Name, "notificaciones", false, false, false, false, nil)
	if err != nil {
		return err
	}
	log.Printf("Escuchando eventos en la cola %s", cola)
	for m := range mensajes {
		log.Printf("evento %s desde %s", m.RoutingKey, m.AppId)
		hub.Publicar()
		_ = m.Ack(false)
	}
	return nil
}
