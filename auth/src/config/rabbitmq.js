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
                console.error('RabbitMQ connection error in Auth service:', err.message);
            });

            connection.on('close', () => {
                console.warn('RabbitMQ connection closed in Auth service. Attempting reconnect in 5s...');
                channel = null;
                connection = null;
                setTimeout(() => connectRabbitMQ(5, 5000), 5000);
            });

            console.log('RabbitMQ connected successfully from Auth service');
            return { connection, channel };
        } catch (error) {
            retries -= 1;
            console.error(`Failed to connect to RabbitMQ from Auth service (${error.message}). Retries remaining: ${retries}`);
            if (retries === 0) {
                console.error('Could not connect to RabbitMQ after multiple attempts.');
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
            // Attempt to connect if channel isn't ready
            await connectRabbitMQ(3, 2000);
        }

        if (!channel) {
            throw new Error('RabbitMQ channel is not available to publish message');
        }

        await channel.assertQueue(queueName, { durable: true });

        const messageBuffer = Buffer.from(JSON.stringify(data));
        const sent = channel.sendToQueue(queueName, messageBuffer, {
            persistent: true,
            ...options
        });

        console.log(`[RabbitMQ Auth Producer] Sent message to ${queueName}:`, {
            to: data.to,
            subject: data.subject
        });

        return sent;
    } catch (error) {
        console.error(`[RabbitMQ Auth Producer] Error publishing to ${queueName}:`, error.message || error);
        throw error;
    }
};
