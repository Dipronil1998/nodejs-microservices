import jwt from "jsonwebtoken";

const accessTokenGenerate = (user) =>{
    const token = jwt.sign(
          {
            id: user._id,
            email: user.email
          },
          process.env.JWT_SECRET,
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
          },
          process.env.JWT_SECRET,
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