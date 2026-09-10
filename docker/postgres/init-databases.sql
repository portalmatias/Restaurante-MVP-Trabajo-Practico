-- Se ejecuta una sola vez, cuando el volumen de datos está vacío (ver
-- docker-entrypoint-initdb.d en la imagen oficial de postgres). POSTGRES_DB ya crea
-- `reservas_dev`; acá agregamos la segunda base que pide §10 de openspec/config.yaml:
-- una base de test separada de la de desarrollo (D5 en design.md de fundacion-repo).
CREATE DATABASE reservas_test;
