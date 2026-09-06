import jwt from "jsonwebtoken";

const accessTokenGenerate = (user) =>{
    const token = jwt.sign(
          {
            id: user._id,
            email: user.email,
            role: user.role
          },
          process.env.JWT_SECRET_ACCESS,
          {
            expiresIn: "15m"
          }
        );
    return token;
}

const refreshTokenGenerate = (user) =>{
    const token = jwt.sign(
          {
            id: user._id,
            role: user.role
          },
          process.env.JWT_SECRET_REFRESH,
          {
            expiresIn: "30d"
          }
        );
    return token;
}


export {
    accessTokenGenerate,
    refreshTokenGenerate
}