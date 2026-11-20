package main

import (
	"encoding/json"
	"net/http"
)

type API struct {
	service *Service
}

func NewAPI(service *Service) *API {
	return &API{service: service}
}

func (api *API) Health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}
