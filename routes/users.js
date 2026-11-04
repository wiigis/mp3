const User = require("../models/user.js");
const Task = require("../models/task.js");
const mongoose = require("mongoose");

module.exports = function (router) {

    var usersRoute = router.route('/');

    
    usersRoute.get(async function(req, res) {
        try {
            const {
                where,
                sort,
                select,
                skip,
                limit,
                count
            } = req.query;

            const filter = where ? JSON.parse(where) : {};
            const sortOptions = sort ? JSON.parse(sort) : {};
            const selectOptions = select ? JSON.parse(select) : {};

            const skipValue = skip !== undefined ? Number(skip) : 0;
            const limitValue = limit !== undefined ? Number(limit) : null;

            if (
                !Number.isSafeInteger(skipValue) ||
                skipValue < 0 ||
                (limitValue !== null &&
                    (!Number.isSafeInteger(limitValue) ||
                    limitValue < 0))
            ) {
                return res.status(400).json({
                    message: "Invalid skip or limit",
                    data: {}
                });
            }

            if (count === "true") {
                const total = await User.countDocuments(filter);

                return res.status(200).json({
                    message: "OK",
                    data: total
                });
            }

            let query = User.find(filter)
                .sort(sortOptions)
                .select(selectOptions)
                .skip(skipValue);

            if (limitValue !== null) {
                query = query.limit(limitValue);
            }

            const users = await query;

            return res.status(200).json({
                message: "OK",
                data: users
            });

        } catch (error) {
            if (
                error instanceof SyntaxError ||
                error.name === "CastError"
            ) {
                return res.status(400).json({
                    message: "Invalid query parameters",
                    data: {}
                });
            }

            console.error(error);

            return res.status(500).json({
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

            const selectOptions = req.query.select
                ? JSON.parse(req.query.select)
                : {};

            const user = await User.findById(userId)
                .select(selectOptions);


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

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return res.status(404).json({
                    message: "User not found",
                    data: {}
                });
            }

            if (!req.body || typeof req.body !== "object" ||
                Array.isArray(req.body)) {
                return res.status(400).json({
                    message: "Invalid request body",
                    data: {}
                });
            }

            const { name, email, pendingTasks } = req.body;

            if (
                (name !== undefined &&
                    (typeof name !== "string" || !name.trim())) ||
                (email !== undefined &&
                    (typeof email !== "string" || !email.trim())) ||
                (pendingTasks !== undefined &&
                    (!Array.isArray(pendingTasks) ||
                    pendingTasks.some(id =>
                        typeof id !== "string" ||
                        !mongoose.isObjectIdOrHexString(id)
                    )))
            ) {
                return res.status(400).json({
                    message: "Invalid user information",
                    data: {}
                });
            }

            if (pendingTasks !== undefined &&
                new Set(pendingTasks.map(id => id.toLowerCase())).size !== pendingTasks.length) {
                return res.status(400).json({
                    message: "Duplicate pending task IDs",
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

                    if (pendingTasks !== undefined) {
                        const requestedIds = pendingTasks.map(id =>
                            id.toLowerCase()
                        );

                        const tasks = await Task.find({
                            _id: { $in: requestedIds }
                        }).session(session);

                        if (tasks.length !== requestedIds.length) {
                            const error = new Error("Task not found");
                            error.status = 404;
                            throw error;
                        }

                        if (tasks.some(task => task.completed)) {
                            const error = new Error(
                                "Completed tasks cannot be pending"
                            );
                            error.status = 400;
                            throw error;
                        }

                        const currentTasks = await Task.find({
                            assignedUser: userId,
                            completed: false
                        }).session(session);

                        const requestedSet = new Set(requestedIds);

                        for (const task of currentTasks) {
                            if (!requestedSet.has(task._id.toString())) {
                                task.assignedUser = "";
                                task.assignedUserName = "unassigned";
                                await task.save({ session });
                            }
                        }

                        for (const task of tasks) {
                            const previousUserId = task.assignedUser;

                            if (previousUserId &&
                                previousUserId !== userId) {
                                await User.updateOne(
                                    { _id: previousUserId },
                                    {
                                        $pull: {
                                            pendingTasks: task._id.toString()
                                        }
                                    },
                                    { session }
                                );
                            }

                            task.assignedUser = userId;
                            task.assignedUserName = user.name;
                            await task.save({ session });
                        }

                        user.pendingTasks = requestedIds;
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
                error.status === 400 ||
                error.code === 11000 ||
                error.name === "ValidationError" ||
                error.name === "CastError"
            ) {
                return res.status(400).json({
                    message: error.message,
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


    
    userRoute.delete(async function(req, res) {
        try {
            const userId = req.params.id;

            if (!mongoose.isObjectIdOrHexString(userId)) {
                return res.status(400).json({
                    message: "Invalid user ID",
                    data: {}
                });
            }

            const session = await mongoose.startSession();

            try {
                await session.withTransaction(async () => {

                    // find user
                    const user = await User.findById(userId)
                        .session(session);

                    if (!user) {
                        const error = new Error("User not found");
                        error.status = 404;
                        throw error;
                    }

                    // Unassign all tasks belonging to this user
                    await Task.updateMany(
                        { assignedUser: userId },
                        {
                            $set: {
                                assignedUser: "",
                                assignedUserName: "unassigned"
                            }
                        },
                        { session }
                    );

                    // Delete the user document
                    await User.deleteOne(
                        { _id: userId },
                        { session }
                    );
                });

            } finally {
                await session.endSession();
            }

            // Successful deletion
            return res.status(204).send();

        } catch (error) {
            if (error.status === 404) {
                return res.status(404).json({
                    message: "User not found",
                    data: {}
                });
            }

            console.error(error);

            return res.status(500).json({
                message: "Unable to delete user",
                data: {}
            });
        }
    });




    return router;
}; 
