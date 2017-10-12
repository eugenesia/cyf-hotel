DROP TABLE IF EXISTS customers;

CREATE TABLE customers (
    id        INTEGER       PRIMARY KEY AUTOINCREMENT,
    title     VARCHAR(10),
    firstname VARCHAR (50),
    surname   VARCHAR (50),
    email     VARCHAR (255) 
);

DROP TABLE IF EXISTS invoices;

CREATE TABLE invoices (
    id        INTEGER       PRIMARY KEY AUTOINCREMENT,
    reservation_id    INTEGER,
    total             INTEGER,
    surcharges        INTEGER,
    invoice_date_time DATETIME,
    paid              BOOLEAN  DEFAULT false
);

DROP TABLE IF EXISTS room_types;

CREATE TABLE room_types (
    id        INTEGER       PRIMARY KEY AUTOINCREMENT,
    type_name      VARCHAR (50),
    original_price INTEGER,
    current_price  INT
);

DROP TABLE IF EXISTS rooms;

CREATE TABLE rooms (
    id        INTEGER       PRIMARY KEY AUTOINCREMENT,
    room_type_id INTEGER,
    sea_view     BOOLEAN
);

DROP TABLE IF EXISTS reservations;

CREATE TABLE reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    room_id INTEGER,
    check_in_date DATE,
    check_out_date DATE,
    room_price INTEGER
);

DROP TABLE IF EXISTS reviews;

CREATE TABLE reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    room_type_id INTEGER,
    rating INTEGER,
    comment TEXT,
    review_date DATE
);

INSERT INTO customers (title, firstname, surname, email) VALUES ('Mr.', 'Tom', 'Jones', 'tom@jones.com');