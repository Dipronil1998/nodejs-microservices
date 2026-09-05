import jwt from "jsonwebtoken";

const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.cookies.accessToken;
        console.log(authHeader," authHeader");
        

        if (!authHeader) {
            return res.status(401).json({
                message: "No token provided"
            });
        }


        const decoded = jwt.verify(
            authHeader,
            process.env.JWT_SECRET_ACCESS
        );

        req.user = decoded;

        next();
    } catch (error) {
        return res.status(401).json({
            message: "Invalid token"
        });
    }

};

export default authMiddleware;