import { createClient } from "redis";

const redisClient = createClient({
    url: process.env.REDIS_CLIENT_URL,
});

redisClient.on("error", (err) => {
    console.error("Redis Error:", err);
});

async function connectRedis() {
    try {
        await redisClient.connect();
        console.log("Redis connected from address service");
    } catch (error) {
        console.error("Failed to connect Redis:", error);
        throw error;
    }
}

export {
    redisClient,
    connectRedis,
};