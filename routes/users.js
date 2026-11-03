const User = require("../models/user.js");
const Task = require("../models/task.js");
const mongoose = require("mongoose");

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

    
    var userRoute = router.route('/:id');

    userRoute.get(async function(req, res) {
        try {
            const userId = req.params.id;

            // Check whether the ID is valid
            if (!mongoose.isObjectIdOrHexString(userId)) {
                return res.status(404).json({
                    message: "User not found",
                    data: {}
                });
            }

            // Find the user in MongoDB
            const user = await User.findById(userId);

            // Check whether the user exists
            if (!user) {
                return res.status(404).json({
                    message: "User not found",
                    data: {}
                });
            }

            // Return the user
            return res.status(200).json({
                message: "OK",
                data: user
            });

        } catch (error) {
            return res.status(500).json({
                message: "Unable to retrieve user",
                data: {}
            });
        }
    });

    
    userRoute.put(async function(req, res) {
        try {
            const userId = req.params.id;
            const { name, email } = req.body;

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return res.status(400).json({
                    message: "Invalid user ID",
                    data: {}
                });
            }

            if (
                (name !== undefined &&
                    (typeof name !== "string" || !name.trim())) ||
                (email !== undefined &&
                    (typeof email !== "string" || !email.trim()))
            ) {
                return res.status(400).json({
                    message: "Invalid name or email",
                    data: {}
                });
            }

            const session = await mongoose.startSession();
            let updatedUser;

            try {
                await session.withTransaction(async () => {

                    const user = await User.findById(userId)
                        .session(session);

                    if (!user) {
                        const error = new Error("User not found");
                        error.status = 404;
                        throw error;
                    }

                    if (name !== undefined) {
                        user.name = name;
                    }

                    if (email !== undefined) {
                        user.email = email;
                    }

                    await user.save({ session });

                    if (name !== undefined) {
                        await Task.updateMany(
                            { assignedUser: userId },
                            {
                                $set: {
                                    assignedUserName: user.name
                                }
                            },
                            { session }
                        );
                    }

                    updatedUser = user;
                });

            } finally {
                await session.endSession();
            }

            return res.status(200).json({
                message: "User updated successfully",
                data: updatedUser
            });

        } catch (error) {
            if (error.status === 404) {
                return res.status(404).json({
                    message: error.message,
                    data: {}
                });
            }

            if (
                error.code === 11000 ||
                error.name === "ValidationError"
            ) {
                return res.status(400).json({
                    message: "Invalid or duplicate user information",
                    data: {}
                });
            }

            console.error(error);

            return res.status(500).json({
                message: "Unable to update user",
                data: {}
            });
        }
    });



    return router;
}; 
