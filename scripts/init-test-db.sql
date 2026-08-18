-- Created once, when the Postgres volume is first initialised.
-- Integration and e2e tests run against this database and truncate it freely.
CREATE DATABASE commerce_ops_test OWNER commerce;
