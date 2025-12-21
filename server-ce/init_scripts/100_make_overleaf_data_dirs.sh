#!/bin/bash
set -e

# Create base directories
mkdir -p /var/lib/overleaf/data
chown www-data:www-data /var/lib/overleaf/data

mkdir -p /var/lib/overleaf/tmp
chown www-data:www-data /var/lib/overleaf/tmp

# Create compile directories with recursive ownership fix
# This ensures CLSI can write to compile directories even if volume had wrong permissions
mkdir -p /var/lib/overleaf/data/compiles
chown -R www-data:www-data /var/lib/overleaf/data/compiles

mkdir -p /var/lib/overleaf/data/output
chown -R www-data:www-data /var/lib/overleaf/data/output

mkdir -p /var/lib/overleaf/data/cache
chown -R www-data:www-data /var/lib/overleaf/data/cache

mkdir -p /var/lib/overleaf/data/template_files
chown www-data:www-data /var/lib/overleaf/data/template_files

mkdir -p /var/lib/overleaf/data/history
chown www-data:www-data /var/lib/overleaf/data/history

mkdir -p /var/lib/overleaf/tmp/projectHistories
chown www-data:www-data /var/lib/overleaf/tmp/projectHistories

mkdir -p /var/lib/overleaf/tmp/dumpFolder
chown www-data:www-data /var/lib/overleaf/tmp/dumpFolder

mkdir -p /var/lib/overleaf/tmp/texmf-var
chown -R www-data:www-data /var/lib/overleaf/tmp/texmf-var

mkdir -p /var/lib/overleaf/tmp/uploads
chown www-data:www-data /var/lib/overleaf/tmp/uploads
