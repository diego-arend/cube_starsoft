// Setup env for messaging tests
// Ensure we don't try to connect to an external broker by default
process.env.RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://127.0.0.1:5672";
