package main

import "testing"

func TestPublicarAvisaATodos(t *testing.T) {
	hub := NuevoHub()
	a, b := hub.Suscribir(), hub.Suscribir()
	rev := hub.Publicar()
	if <-a != rev || <-b != rev {
		t.Fatal("los dos navegadores debían recibir la misma revisión")
	}
	hub.Cancelar(a)
	if hub.Conectados() != 1 {
		t.Fatal("al cancelar debe quedar un navegador")
	}
}
