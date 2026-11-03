const User = require("../models/user.js");

module.exports = function (router) {

    var usersRoute = router.route('/');

    usersRoute.get(async function (req, res) {
        try {
            const users = await User.find();

            res.status(200).json({
                message: "OK",
                data: users
            });

        } catch (error) {
            res.status(500).json({
                message: "Unable to retrieve users",
                data: {}
            });
        }
    });

    return router;
};