package main

import (
	"log"
	"net/http"
)

func main() {
	mux := http.NewServeMux()
	repo := &Repository{}
	service := &Service{repository: repo}
	api := NewAPI(service)

	mux.HandleFunc("GET /api/health", api.Health)

	log.Println("listening on :8080")
	log.Fatal(http.ListenAndServe(":8080", mux))
}
