#!/bin/sh
# Fix permissions on data volume
chown -R nuxtjs:nodejs /app/data

# Run as nuxtjs user
exec su-exec nuxtjs "$@"
