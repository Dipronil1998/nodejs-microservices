import { createClient } from "redis";

const redisClient = createClient({
    url: process.env.REDIS_CLIENT_URL || "redis://redis:6379",
});

redisClient.on("error", (err) => {
    console.error("Redis Error in Order service:", err);
});

async function connectRedis() {
    try {
        await redisClient.connect();
        console.log("Redis connected from Order service");
    } catch (error) {
        console.error("Failed to connect Redis in Order service:", error);
    }
}

export {
    redisClient,
    connectRedis,
};
