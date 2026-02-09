FROM flink:2.0.1-scala_2.12-java17

# Flink SQL Kafka connector (fat JAR with all dependencies)
RUN wget -q -P /opt/flink/lib \
    https://repo.maven.apache.org/maven2/org/apache/flink/flink-sql-connector-kafka/4.0.1-2.0/flink-sql-connector-kafka-4.0.1-2.0.jar
