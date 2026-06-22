"""
Eduai Kafka → MongoDB Aggregator

Consumes events from Kafka topics, performs simple aggregations (per-minute count,
avg duration, success/fail), and saves to MongoDB.
This replaces the need for Spark in low-resource environments like this laptop.

Usage:
    python kafka_mongo_aggregator.py
"""

import asyncio
import json
import os
import sys
import signal
import time
from datetime import datetime, timedelta, timezone
from aiokafka import AIOKafkaConsumer
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure

# ---- Config ----
KAFKA_BOOTSTRAP = "localhost:9094"

# Read MongoDB URI dynamically from backend .env
def load_mongo_uri():
    env_path = "/mnt/hdd/Eduai/backend/.env"
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                if line.startswith("MONGO_URL="):
                    return line.split("=", 1)[1].strip().strip('"')
    # Fallback default
    return "mongodb://localhost:27017"

MONGO_URI = load_mongo_uri()
MONGO_DB = "eduscanner_ai"
MONGO_COLLECTION = "agg_analytics"

TOPICS = [
    "eduai.document.analyze",
    "eduai.quiz.generate",
    "eduai.quiz.grade",
    "eduai.recap.generate",
    "eduai.music.generate",
    "eduai.chat.respond",
    "eduai.quiz.grade.student",
    "eduai.tasks.cleanup",
]

# ---- In-memory Aggregation ----
# Dictionary to hold counts per topic and minute window
# Structure: {{ topic: {{ minute_window_start: {{ 'count': N, 'duration_ms': X, 'success': Y, 'fail': Z }} }} }}
AGGREGATES = {}

# ---- MongoDB Client ----
client = None

def get_mongo_client():
    global client
    if client is None:
        try:
            client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
            # The ismaster command is cheap and does not require auth.
            client.admin.command('ismaster')
            print("[mongo] Connected successfully!")
        except ConnectionFailure as e:
            print(f"[mongo] Connection failed: {e}")
            client = None
    return client

async def save_aggregates():
    """Save current in-memory aggregates to MongoDB."""
    mongo_client = get_mongo_client()
    if not mongo_client:
        print("[mongo] Skipping save: Not connected.")
        return
        
    coll = mongo_client[MONGO_DB][MONGO_COLLECTION]
    now = datetime.now(timezone.utc)
    batch_to_save = []

    for topic, windows in AGGREGATES.items():
        for window_start_ts, data in windows.items():
            window_start = datetime.fromtimestamp(window_start_ts, timezone.utc)
            window_end = window_start + timedelta(minutes=1)
            
            record = {
                "topic": topic,
                "window_start": window_start,
                "window_end": window_end,
                "event_count": data.get('count', 0),
                "avg_duration_ms": data.get('duration_ms', 0) / data.get('count', 1) if data.get('count', 0) > 0 else 0,
                "success_count": data.get('success', 0),
                "failed_count": data.get('fail', 0),
                "ingested_at": now.isoformat()
            }
            batch_to_save.append(record)

    if batch_to_save:
        try:
            result = coll.insert_many(batch_to_save)
            print(f"[mongo] Inserted {len(result.inserted_ids)} aggregate records.")
            # Clear processed aggregates
            for topic in list(AGGREGATES.keys()):
                for window_start_ts in list(AGGREGATES[topic].keys()):
                    del AGGREGATES[topic][window_start_ts]
                if not AGGREGATES[topic]:
                    del AGGREGATES[topic]
        except Exception as e:
            print(f"[mongo] Error saving aggregates: {e}")
    else:
        print("[mongo] No new aggregates to save.")
    
    # Close client after use if it was newly created
    # (We keep it alive in the global var if already connected)
    # client.close() 

async def process_message(message):
    """Process a single Kafka message."""
    topic = "unknown"
    try:
        topic = message.topic
        data = json.loads(message.value.decode('utf-8'))
        
        event_time_ts = int(data.get("timestamp", time.time()))
        event_time = datetime.fromtimestamp(event_time_ts, timezone.utc)
        minute_window = int(event_time.timestamp() / 60) * 60 # Floor to minute start
        
        # Initialize topic/window if not exists
        if topic not in AGGREGATES:
            AGGREGATES[topic] = {}
        if minute_window not in AGGREGATES[topic]:
            AGGREGATES[topic][minute_window] = {
                'count': 0,
                'duration_ms': 0,
                'success': 0,
                'fail': 0
            }
            
        agg = AGGREGATES[topic][minute_window]
        agg['count'] += 1
        agg['duration_ms'] += data.get('duration_ms', 0)
        if data.get('status') == 'success':
            agg['success'] += 1
        elif data.get('status') == 'failed':
            agg['fail'] += 1
            
        # print(f"  -> {topic:32s} [{datetime.fromtimestamp(minute_window).isoformat()}] count={agg['count']} dur={agg['duration_ms']} succ={agg['success']} fail={agg['fail']}")

    except json.JSONDecodeError:
        print(f"[kafka] Failed to decode JSON from topic {topic}: {message.value}")
    except Exception as e:
        print(f"[kafka] Error processing message from {topic}: {e}")

async def consume_kafka():
    """Consume messages from Kafka topics."""
    consumer = AIOKafkaConsumer(
        *TOPICS,
        bootstrap_servers=KAFKA_BOOTSTRAP,
        group_id="eduai-aggregator-group",
        auto_offset_reset='latest',
        enable_auto_commit=False # Commit manually after processing batch
    )
    
    await consumer.start()
    print(f"[kafka] Consumer started. Listening to {len(TOPICS)} topics...")
    try:
        while True:
            try:
                msg = await asyncio.wait_for(consumer.getone(), timeout=30.0)
                await process_message(msg)
            except asyncio.TimeoutError:
                # Timeout occurred, time to save aggregates if any
                await save_aggregates()
            except Exception as e:
                print(f"[kafka] Error getting message: {e}")
                
    finally:
        await consumer.stop()
        print("[kafka] Consumer stopped.")

async def main():
    print("=" * 70)
    print("  Eduai Kafka → MongoDB Aggregator")
    print("=" * 70)
    print(f"Kafka bootstrap: {KAFKA_BOOTSTRAP}")
    print(f"Mongo DB:        {MONGO_DB}.{MONGO_COLLECTION}")
    print(f"Topics watched:  {len(TOPICS)}")
    for t in TOPICS:
        print(f"    - {t}")
    print()

    # Start Kafka consumer and periodic MongoDB saver task
    consumer_task = asyncio.create_task(consume_kafka())
    save_task = asyncio.create_task(periodic_save())

    # Graceful shutdown
    loop = asyncio.get_running_loop()
    stop_event = asyncio.Event()

    def shutdown(*_):
        print("\n[aggregator] Shutting down...")
        stop_event.set()

    loop.add_signal_handler(signal.SIGINT, shutdown)
    loop.add_signal_handler(signal.SIGTERM, shutdown)

    await stop_event.wait()
    consumer_task.cancel()
    save_task.cancel()
    await asyncio.gather(consumer_task, save_task, return_exceptions=True)
    print("[aggregator] All tasks stopped. Exiting.")

async def periodic_save():
    """Periodically save aggregates to MongoDB."""
    while True:
        await asyncio.sleep(60) # Save every 60 seconds
        print("\n[save_timer] Triggering save...")
        await save_aggregates()

if __name__ == "__main__":
    # Ensure MongoDB client is available on first run
    get_mongo_client()
    asyncio.run(main())
