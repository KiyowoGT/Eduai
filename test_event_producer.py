"""
Eduai Test Event Producer — kirim event dummy ke Kafka biar Spark Analytics
bisa langsung demo ada data masuk.

Usage:
    python test_event_producer.py
"""

import asyncio
import json
import random
import time
from aiokafka import AIOKafkaProducer

KAFKA_BOOTSTRAP = "localhost:9094"
TOPICS = [
    "eduai.document.analyze",
    "eduai.quiz.generate",
    "eduai.quiz.grade",
    "eduai.recap.generate",
    "eduai.music.generate",
    "eduai.chat.respond",
]

USER_IDS = ["user_alstear", "user_syahid", "user_raditya", "user_josua", "user_agung"]
ACTIONS = ["process", "generate", "analyze", "grade", "respond"]


async def main():
    producer = AIOKafkaProducer(bootstrap_servers=KAFKA_BOOTSTRAP)
    await producer.start()
    print(f"[producer] connected to {KAFKA_BOOTSTRAP}")
    print("[producer] sending 30 dummy events across topics...\n")

    try:
        for i in range(30):
            topic = random.choice(TOPICS)
            payload = {
                "user_id": random.choice(USER_IDS),
                "action": random.choice(ACTIONS),
                "status": random.choice(["success", "success", "success", "failed"]),
                "duration_ms": random.randint(120, 4500),
                "timestamp": time.time(),
            }
            value = json.dumps(payload).encode("utf-8")
            await producer.send_and_wait(topic, value)
            print(f"  [{i+1:2d}/30] → {topic:32s}  status={payload['status']:7s}  dur={payload['duration_ms']}ms")
            await asyncio.sleep(0.3)

        print("\n[producer] 30 events sent. Done.")
    finally:
        await producer.stop()


if __name__ == "__main__":
    asyncio.run(main())
