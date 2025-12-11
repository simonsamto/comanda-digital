exports.isAuthenticated = (req, res, next) => {
    if (req.session.usuario) {
        return next();
    }
    res.redirect('/login');
};

exports.hasRole = (roles) => {
    return (req, res, next) => {
        if (!req.session.usuario) {
            return res.redirect('/login');
        }
        
        const userRole = req.session.usuario.rol;
        if (roles.includes(userRole)) {
            return next();
        }
        
        res.status(403).send('Acceso denegado');
    };
};