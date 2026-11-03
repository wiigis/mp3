
const User = require("../models/user.js");

module.exports = function (router) {

    // Home route
    var homeRoute = router.route('/');

    homeRoute.get(function (req, res) {
        res.json({
            message: "API is running",
            data: {}
        });
    });

    return router;
};
