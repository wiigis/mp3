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



    usersRoute.post(async function(req, res) {
        try {
            const { name, email } = req.body;

            // validating required fields
            if (
                typeof name !== "string" ||
                !name.trim() ||
                typeof email !== "string" ||
                !email.trim()
            ) {
                return res.status(400).json({
                    message: "Name and email are required",
                    data: {}
                });
            }

            // checking whether email already exists
            const existingUser = await User.findOne({
                email: email.trim()
            });

            if (existingUser) {
                return res.status(400).json({
                    message: "Email already exists",
                    data: {}
                });
            }

            // creating new user
            const newUser = new User({
                name: name,
                email: email
            });

            // saving
            const savedUser = await newUser.save();

            res.status(201).json({
                message: "User created successfully",
                data: savedUser
            });

        } catch (error) {
            if (error.code === 11000) {
                return res.status(400).json({
                    message: "Email already exists",
                    data: {}
                });
            }

            res.status(500).json({
                message: "Unable to create user",
                data: {}
            });
        }
    });

    return router;
}; 
