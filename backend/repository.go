package main

import "database/sql"

type Repository struct {
	db *sql.DB
}
