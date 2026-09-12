CREATE TABLE owners (
    id         SERIAL PRIMARY KEY,
    first_name VARCHAR(30) NOT NULL,
    last_name  VARCHAR(30) NOT NULL,
    address    VARCHAR(255),
    city       VARCHAR(80),
    telephone  VARCHAR(20)
);

CREATE TABLE pets (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(30) NOT NULL,
    birth_date DATE,
    owner_id   INTEGER REFERENCES owners (id),
    type_id    INTEGER NOT NULL
);

CREATE INDEX idx_pets_owner ON pets (owner_id);

CREATE VIEW owner_pet_counts AS
SELECT o.id, o.last_name, COUNT(p.id) AS pet_count
FROM owners o
LEFT JOIN pets p ON p.owner_id = o.id
GROUP BY o.id, o.last_name;

ALTER TABLE pets ADD CONSTRAINT fk_pets_types FOREIGN KEY (type_id) REFERENCES types (id);
