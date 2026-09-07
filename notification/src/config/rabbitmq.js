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
                console.error('RabbitMQ connection error in Notification service:', err.message);
            });

            connection.on('close', () => {
                console.warn('RabbitMQ connection closed in Notification service. Attempting reconnect in 5s...');
                channel = null;
                connection = null;
                setTimeout(() => connectRabbitMQ(5, 5000), 5000);
            });

            console.log('RabbitMQ connected successfully from Notification service');
            return { connection, channel };
        } catch (error) {
            retries -= 1;
            console.error(`Failed to connect to RabbitMQ from Notification service (${error.message}). Retries remaining: ${retries}`);
            if (retries === 0) {
                console.error('Could not connect to RabbitMQ in Notification service after multiple attempts.');
                return null;
            }
            await new Promise((res) => setTimeout(res, delay));
        }
    }
};

export const getRabbitChannel = () => channel;
