#!/usr/bin/env bash
set -e

/opt/wait-for-it.sh 10.192.2.21:5432
npm run migration:run
npm run seed:run
npm run start:prod
