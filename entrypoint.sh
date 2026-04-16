#!/bin/sh
set -e
echo "Running prisma db push..."
./node_modules/.bin/prisma db push
echo "Starting app..."
exec node dist/main
