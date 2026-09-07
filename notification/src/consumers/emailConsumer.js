import { getRabbitChannel, connectRabbitMQ } from '../config/rabbitmq.js';
import { sendMail } from '../services/emailService.js';

const QUEUE_NAME = 'email_queue';

/**
 * Start consuming email jobs from RabbitMQ queue
 */
export const startEmailConsumer = async () => {
    try {
        let channel = getRabbitChannel();
        if (!channel) {
            const res = await connectRabbitMQ(5, 5000);
            channel = res?.channel;
        }

        if (!channel) {
            console.error('[RabbitMQ Email Consumer] Cannot start consumer: RabbitMQ channel not available');
            return;
        }

        await channel.assertQueue(QUEUE_NAME, { durable: true });
        channel.prefetch(1);

        console.log(`[RabbitMQ Email Consumer] Listening for messages on queue "${QUEUE_NAME}"...`);

        channel.consume(
            QUEUE_NAME,
            async (msg) => {
                if (!msg) return;

                let data;
                try {
                    data = JSON.parse(msg.content.toString());
                } catch (parseError) {
                    console.error('[RabbitMQ Email Consumer] Failed to parse message JSON:', parseError.message);
                    channel.nack(msg, false, false); // Reject malformed message
                    return;
                }

                try {
                    console.log(`[RabbitMQ Email Consumer] Processing email to "${data.to}" with subject "${data.subject}"`);
                    const info = await sendMail(data);
                    console.log(`[RabbitMQ Email Consumer] Email successfully sent to "${data.to}" (MessageID: ${info.messageId})`);
                    channel.ack(msg);
                } catch (sendError) {
                    console.error(`[RabbitMQ Email Consumer] Error sending email to "${data?.to}":`, sendError.message || sendError);
                    // Discard or dead-letter message to avoid infinite retry loops on bad credentials/emails
                    channel.nack(msg, false, false);
                }
            },
            { noAck: false }
        );
    } catch (error) {
        console.error('[RabbitMQ Email Consumer] Failed to initialize email consumer:', error.message || error);
    }
};
