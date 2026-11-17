-- Runs once when the postgres container is first created. Jest uses saad_test so tests never touch dev data.
CREATE DATABASE saad_test;
