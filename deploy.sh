#!/bin/bash
# Script deployment otomatis ke server idle (Blue/Green)

LIVE_STATUS_FILE="/mnt/hdd/Eduai/current_live.txt"

# Default live adalah blue jika file belum ada
if [ ! -f "$LIVE_STATUS_FILE" ]; then
    echo "blue" > "$LIVE_STATUS_FILE"
fi

CURRENT_LIVE=$(cat "$LIVE_STATUS_FILE")

if [ "$CURRENT_LIVE" == "blue" ]; then
    TARGET="green"
else
    TARGET="blue"
fi

echo "--- DEPLOYMENT START ---"
echo "Live server saat ini: $CURRENT_LIVE"
echo "Target deploy (idle): $TARGET"

# Rebuild frontend
cd /mnt/hdd/Eduai/frontend
npm run build

# Copy build files ke target
echo "Menyalin file ke /mnt/hdd/Eduai/$TARGET..."
rm -rf /mnt/hdd/Eduai/$TARGET/*
cp -r /mnt/hdd/Eduai/frontend/build/* /mnt/hdd/Eduai/$TARGET/

echo "--- DEPLOYMENT SELESAI ---"
echo "Silakan test di server $TARGET sebelum switch traffic."
