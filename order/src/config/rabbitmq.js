import amqp from 'amqplib';

let connection = null;
let channel = null;

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';

export const connectRabbitMQ = async (retries = 5, delay = 5000) => {
    while (retries) {
        try {
            connection = await amqp.connect(RABBITMQ_URL);
            channel = await connection.createChannel();

            connection.on('error', (err) => {
                console.error('RabbitMQ connection error in Order service:', err.message);
            });

            connection.on('close', () => {
                console.warn('RabbitMQ connection closed in Order service. Attempting reconnect in 5s...');
                channel = null;
                connection = null;
                setTimeout(() => connectRabbitMQ(5, 5000), 5000);
            });

            console.log('RabbitMQ connected successfully from Order service');
            return { connection, channel };
        } catch (error) {
            retries -= 1;
            console.error(`Failed to connect to RabbitMQ from Order service (${error.message}). Retries remaining: ${retries}`);
            if (retries === 0) {
                console.error('Could not connect to RabbitMQ after multiple attempts in Order service.');
                return null;
            }
            await new Promise((res) => setTimeout(res, delay));
        }
    }
};

export const getRabbitChannel = () => channel;

/**
 * Publish message payload to a durable RabbitMQ queue
 * @param {string} queueName - Name of the target queue
 * @param {Object} data - Message payload
 * @param {Object} [options] - Additional amqplib publish options
 */
export const publishToQueue = async (queueName, data, options = {}) => {
    try {
        if (!channel) {
            await connectRabbitMQ(3, 2000);
        }

        if (!channel) {
            console.warn('RabbitMQ channel is not available. Skipping message dispatch.');
            return false;
        }

        await channel.assertQueue(queueName, { durable: true });

        const messageBuffer = Buffer.from(JSON.stringify(data));
        const sent = channel.sendToQueue(queueName, messageBuffer, {
            persistent: true,
            ...options
        });

        console.log(`[RabbitMQ Order Producer] Sent message to ${queueName}:`, {
            event: data.event || 'message',
            orderId: data.orderId || data.orderNumber
        });

        return sent;
    } catch (error) {
        console.error(`[RabbitMQ Order Producer] Error publishing to ${queueName}:`, error.message || error);
        return false;
    }
};
