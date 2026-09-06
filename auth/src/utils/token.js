import jwt from "jsonwebtoken";

const getRoleClaims = (user, roles) => {
    let roleList = [];
    if (Array.isArray(roles) && roles.length > 0) {
        roleList = roles;
    } else if (Array.isArray(user?.roles) && user.roles.length > 0) {
        roleList = user.roles;
    } else if (user?.role) {
        roleList = [user.role];
    } else {
        roleList = ['user'];
    }

    return {
        role: roleList[0],
        roles: roleList
    };
};

const accessTokenGenerate = (user, roles) => {
    const roleClaims = getRoleClaims(user, roles);

    const token = jwt.sign(
        {
            id: user._id,
            email: user.email,
            role: roleClaims.role,
            roles: roleClaims.roles
        },
        process.env.JWT_SECRET_ACCESS,
        {
            expiresIn: "15m"
        }
    );
    return token;
};

const refreshTokenGenerate = (user, roles) => {
    const roleClaims = getRoleClaims(user, roles);

    const token = jwt.sign(
        {
            id: user._id,
            role: roleClaims.role,
            roles: roleClaims.roles
        },
        process.env.JWT_SECRET_REFRESH,
        {
            expiresIn: "30d"
        }
    );
    return token;
};

export {
    accessTokenGenerate,
    refreshTokenGenerate
};