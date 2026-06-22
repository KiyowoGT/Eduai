"""
Eduai Apache Spark Analytics — Kafka → Spark → MongoDB pipeline.

Consumes job events from all Eduai Kafka topics (document analyze, quiz generate,
quiz grade, recap generate, music generate, chat respond, etc.), aggregates
per-minute activity, and persists the results into a MongoDB collection
(`spark_analytics_aggregates`) for the admin dashboard.

Architecture:
    [ FastAPI producers ]
            ↓
    [ Kafka topics (eduai.*) ]
            ↓
    [ PySpark Structured Streaming ]   ← this script
            ↓
    [ MongoDB: spark_analytics_aggregates ]

Usage:
    source spark-venv/bin/activate
    python spark_analytics.py

Notes:
    - Runs on a 4GB laptop, so we use `local[1]` mode with a tiny JVM heap.
    - Designed to be run on-demand during demos / screenshots for the thesis.
    - No long-running daemon — kill with Ctrl+C.
"""

from pyspark.sql import SparkSession
from pyspark.sql.functions import (
    col,
    from_json,
    window,
    count,
    avg,
    sum as spark_sum,
    min as spark_min,
    max as spark_max,
    current_timestamp,
)
from pyspark.sql.types import (
    StructType,
    StructField,
    StringType,
    LongType,
    TimestampType,
)
from pymongo import MongoClient
from datetime import datetime
import os
import sys
import signal
import time

# ---- Config ----
KAFKA_BOOTSTRAP = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
MONGO_URI = os.environ.get(
    "MONGO_URI",
    "mongodb+srv://alstear:RAPARmadzA888@cluster0.s0czo9t.mongodb.net/?retryWrites=true",
)
MONGO_DB = "eduai"
MONGO_COLLECTION = "spark_analytics_aggregates"

# Topics we listen to — match Eduai producers
KAFKA_TOPICS = [
    "eduai.document.analyze",
    "eduai.quiz.generate",
    "eduai.quiz.grade",
    "eduai.recap.generate",
    "eduai.music.generate",
    "eduai.chat.respond",
    "eduai.quiz.grade.student",
    "eduai.tasks.cleanup",
]

# ---- Spark Schema for incoming JSON messages ----
EVENT_SCHEMA = StructType([
    StructField("user_id", StringType(), True),
    StructField("action", StringType(), True),
    StructField("status", StringType(), True),
    StructField("duration_ms", LongType(), True),
    StructField("timestamp", StringType(), True),
])


def build_spark():
    return (
        SparkSession.builder.appName("EduaiSparkAnalytics")
        .master("local[1]")
        .config("spark.sql.shuffle.partitions", "1")
        .config("spark.ui.showConsoleProgress", "false")
        .config("spark.driver.memory", "512m")
        .config("spark.executor.memory", "512m")
        .config("spark.sql.streaming.checkpointLocation", "/tmp/spark-checkpoint")
        .getOrCreate()
    )


def mongo_sink(rows):
    """Write aggregated rows to MongoDB."""
    if not rows:
        return 0
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    coll = client[MONGO_DB][MONGO_COLLECTION]
    docs = []
    for r in rows:
        docs.append({
            "topic": r["topic"],
            "window_start": r["window_start"].isoformat() if hasattr(r["window_start"], "isoformat") else str(r["window_start"]),
            "window_end": r["window_end"].isoformat() if hasattr(r["window_end"], "isoformat") else str(r["window_end"]),
            "event_count": int(r["event_count"]),
            "avg_duration_ms": float(r["avg_duration_ms"]) if r["avg_duration_ms"] is not None else None,
            "success_count": int(r["success_count"]),
            "failed_count": int(r["failed_count"]),
            "ingested_at": datetime.utcnow().isoformat(),
        })
    result = coll.insert_many(docs)
    client.close()
    return len(result.inserted_ids)


def main():
    print("=" * 70)
    print("  Eduai Apache Spark Analytics — Kafka → Spark → MongoDB")
    print("=" * 70)
    print(f"Kafka bootstrap: {KAFKA_BOOTSTRAP}")
    print(f"Mongo DB:        {MONGO_DB}.{MONGO_COLLECTION}")
    print(f"Topics watched:  {len(KAFKA_TOPICS)}")
    for t in KAFKA_TOPICS:
        print(f"    - {t}")
    print()

    spark = build_spark()
    spark.sparkContext.setLogLevel("WARN")
    print("[spark] SparkSession ready (local[1], 512m heap)")

    # Read raw stream from Kafka
    raw = (
        spark.readStream.format("kafka")
        .option("kafka.bootstrap.servers", KAFKA_BOOTSTRAP)
        .option("subscribe", ",".join(KAFKA_TOPICS))
        .option("startingOffsets", "latest")
        .option("failOnDataLoss", "false")
        .load()
    )

    # Parse JSON payload
    parsed = (
        raw.selectExpr("topic", "CAST(value AS STRING) AS json_str")
        .withColumn("payload", from_json(col("json_str"), EVENT_SCHEMA))
        .select("topic", "payload.*")
        .withColumn("event_time", current_timestamp())
    )

    # 1-minute tumbling window aggregations
    agg = (
        parsed.withWatermark("event_time", "2 minutes")
        .groupBy(
            col("topic"),
            window(col("event_time"), "1 minute"),
        )
        .agg(
            count("*").alias("event_count"),
            avg("duration_ms").alias("avg_duration_ms"),
            spark_sum((col("status") == "success").cast("int")).alias("success_count"),
            spark_sum((col("status") == "failed").cast("int")).alias("failed_count"),
        )
        .select(
            col("topic"),
            col("window.start").alias("window_start"),
            col("window.end").alias("window_end"),
            "event_count",
            "avg_duration_ms",
            "success_count",
            "failed_count",
        )
    )

    print("[spark] Streaming query started. Listening for events...")
    print("[spark] Press Ctrl+C to stop.\n")

    def process_batch(df, epoch_id):
        rows = [r.asDict() for r in df.collect()]
        if not rows:
            print(f"[batch {epoch_id}] no events in window")
            return
        inserted = mongo_sink(rows)
        print(f"[batch {epoch_id}] wrote {inserted} aggregate row(s) to MongoDB")
        for r in rows[:5]:
            print(f"    topic={r['topic']:32s}  count={r['event_count']:4d}  "
                  f"avg_dur={r['avg_duration_ms']:.1f if r['avg_duration_ms'] else 0}ms")

    query = (
        agg.writeStream.foreachBatch(process_batch)
        .outputMode("update")
        .trigger(processingTime="30 seconds")
        .start()
    )

    # Graceful shutdown
    def shutdown(*_):
        print("\n[spark] Stopping...")
        query.stop()
        spark.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)
    query.awaitTermination()


if __name__ == "__main__":
    main()
