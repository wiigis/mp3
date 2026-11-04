const Task = require("../models/task.js");
const User = require("../models/user.js");
const mongoose = require("mongoose");

module.exports = function (router) {

    var tasksRoute = router.route('/');

    
    tasksRoute.get(async function(req, res) {
        try {
            const { where, sort, select, skip, limit, count } = req.query;

            const filter = where ? JSON.parse(where) : {};
            const sortOptions = sort ? JSON.parse(sort) : {};
            const selectOptions = select ? JSON.parse(select) : {};

            const skipValue = skip !== undefined ? Number(skip) : 0;
            const limitValue = limit !== undefined ? Number(limit) : 100;

            if (
                !Number.isSafeInteger(skipValue) ||
                skipValue < 0 ||
                !Number.isSafeInteger(limitValue) ||
                limitValue < 0
            ) {
                return res.status(400).json({
                    message: "Invalid skip or limit",
                    data: {}
                });
            }

            if (count === "true") {
                const total = await Task.countDocuments(filter);

                return res.status(200).json({
                    message: "OK",
                    data: total
                });
            }

            const tasks = await Task.find(filter)
                .sort(sortOptions)
                .select(selectOptions)
                .skip(skipValue)
                .limit(limitValue);

            return res.status(200).json({
                message: "OK",
                data: tasks
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
                message: "Unable to retrieve tasks",
                data: {}
            });
        }
    });


    
    tasksRoute.post(async function(req, res) {
        try {
            const { name, description, deadline, completed,
                    assignedUser, assignedUserName } = req.body;

            // validate required fields
            if (
                typeof name !== "string" || !name.trim() ||!deadline ||isNaN(new Date(deadline).getTime())) {
                return res.status(400).json({
                    message: "Valid name and deadline are required",
                    data: {}
                });
            }

            if ((description !== undefined && typeof description !== "string") || (completed !== undefined && typeof completed !== "boolean")) {
                return res.status(400).json({
                    message: "Invalid task field types",
                    data: {}
                });
            }

            
            let user = null;

            if (assignedUser !== undefined && assignedUser !== "") {

                // Check the ID format
                if (
                    typeof assignedUser !== "string" ||
                    !mongoose.isObjectIdOrHexString(assignedUser)
                ) {
                    return res.status(400).json({
                        message: "Invalid assigned user ID",
                        data: {}
                    });
                }

                // Check whether the user exists
                user = await User.findById(assignedUser);

                if (!user) {
                    return res.status(404).json({
                        message: "Assigned user not found",
                        data: {}
                    });
                }

                // Verify the submitted name
                if (
                    assignedUserName !== undefined &&
                    assignedUserName !== user.name
                ) {
                    return res.status(400).json({
                        message: "Assigned user name does not match",
                        data: {}
                    });
                }
            }

            // creating a new task
            const newTask = new Task({
                name: name,
                description: description,
                deadline: deadline,
                completed: completed,
                assignedUser: user ? user._id.toString() : "",
                assignedUserName: user ? user.name : "unassigned"
            });

            // saving to MongoDB
    
            
    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {

            // saving new task
            await newTask.save({ session });

            // update the assigned user pending tasks
            if (user && !newTask.completed) {
                await User.updateOne(
                    { _id: user._id },
                    {
                        $addToSet: {
                            pendingTasks: newTask._id.toString()
                        }
                    },
                    { session }
                );
            }

        });

        } finally {
            await session.endSession();
        }

        return res.status(201).json({
            message: "Task created successfully",
            data: newTask
        });


        } catch (error) {
            if (error.name === "ValidationError" ||
                error.name === "CastError") {
                return res.status(400).json({
                    message: "Invalid task information",
                    data: {}
                });
            }

            return res.status(500).json({
                message: "Unable to create task",
                data: {}
            });
        }
    });

    
    var taskRoute = router.route('/:id');

    
    taskRoute.get(async function(req, res) {
        try {
            const taskId = req.params.id;

            if (!mongoose.isObjectIdOrHexString(taskId)) {
                return res.status(404).json({
                    message: "Task not found",
                    data: {}
                });
            }

            const selectOptions = req.query.select
                ? JSON.parse(req.query.select)
                : {};

            const task = await Task.findById(taskId)
                .select(selectOptions);

            if (!task) {
                return res.status(404).json({
                    message: "Task not found",
                    data: {}
                });
            }

            return res.status(200).json({
                message: "OK",
                data: task
            });

        } catch (error) {
            if (error instanceof SyntaxError) {
                return res.status(400).json({
                    message: "Invalid select parameter",
                    data: {}
                });
            }

            console.error(error);

            return res.status(500).json({
                message: "Unable to retrieve task",
                data: {}
            });
        }
    });


    taskRoute.put(async function(req, res) {
        try {
            const taskId = req.params.id;

            
            if (!mongoose.isObjectIdOrHexString(taskId)) {
                return res.status(404).json({
                    message: "Task not found",
                    data: {}
                });
            }

            const allowedFields = [
                "name",
                "description",
                "deadline",
                "completed",
                "assignedUser",
                "assignedUserName"
            ];

            // Validate the request body
            if (
                !req.body ||
                typeof req.body !== "object" ||
                Array.isArray(req.body)
            ) {
                return res.status(400).json({
                    message: "Invalid request body",
                    data: {}
                });
            }

            // Reject fields that cannot be changed directly
            if (Object.keys(req.body).some(
                field => !allowedFields.includes(field)
            )) {
                return res.status(400).json({
                    message: "Unsupported task field",
                    data: {}
                });
            }

            const {
                name,
                description,
                deadline,
                completed,
                assignedUser,
                assignedUserName
            } = req.body;

            if (
                (name !== undefined && (typeof name !== "string" || !name.trim())) || (description !== undefined && typeof description !== "string") ||
                (completed !== undefined &&
                    typeof completed !== "boolean") ||
                (deadline !== undefined &&
                    (deadline === null ||
                    isNaN(new Date(deadline).getTime()))) ||
                (assignedUser !== undefined &&
                    (typeof assignedUser !== "string" ||
                    (assignedUser !== "" &&
                    !mongoose.isObjectIdOrHexString(assignedUser))))
            ) {
                return res.status(400).json({
                    message: "Invalid task information",
                    data: {}
                });
            }

            const session = await mongoose.startSession();
            let updatedTask;

            try {
                await session.withTransaction(async () => {

                    // Find the existing task
                    const task = await Task.findById(taskId)
                        .session(session);

                    if (!task) {
                        const error = new Error("Task not found");
                        error.status = 404;
                        throw error;
                    }

                    const oldUserId = task.assignedUser;
                    
                    const newUserId = assignedUser !== undefined ? assignedUser : oldUserId;

                    let newUser = null;

                    // Find the new assigned user
                    if (newUserId) {
                        newUser = await User.findById(newUserId)
                            .session(session);

                        if (!newUser) {
                            const error = new Error(
                                "Assigned user not found"
                            );
                            error.status = 404;
                            throw error;
                        }
                    }

                    
                    if (
                        assignedUserName !== undefined &&
                        assignedUserName !== (newUser ? newUser.name : "unassigned")
                    ) {
                        const error = new Error("Assigned user name does not match");
                        error.status = 400;
                        throw error;
                    }


                    // Update regular task fields
                    if (name !== undefined) {
                        task.name = name;
                    }
                    

                    if (description !== undefined) {
                        task.description = description;
                    }

                    if (deadline !== undefined) {
                        task.deadline = deadline;
                    }

                    if (completed !== undefined) {
                        task.completed = completed;
                    }

                    task.assignedUser = newUserId || "";
                    task.assignedUserName = newUser ? newUser.name : "unassigned";

                    await task.save({ session });

                    // Remove task from previous user's pendingTasks
                    if (oldUserId) {
                        await User.updateOne(
                            { _id: oldUserId },
                            {
                                $pull: {
                                    pendingTasks: taskId
                                }
                            },
                            { session }
                        );
                    }

                    // Add task to new user's pendingTasks
                    // only if the task is incomplete
                    if (newUser && !task.completed) {
                        await User.updateOne(
                            { _id: newUser._id },
                            {
                                $addToSet: {
                                    pendingTasks: taskId
                                }
                            },
                            { session }
                        );
                    }

                    updatedTask = task;
                });

            } finally {
                await session.endSession();
            }

            return res.status(200).json({
                message: "Task updated successfully",
                data: updatedTask
            });

        } catch (error) {
            if (error.status === 404) {
                return res.status(404).json({
                    message: error.message,
                    data: {}
                });
            }

            if (error.status === 400) {
                return res.status(400).json({
                    message: error.message,
                    data: {}
                });
            }

            if (
                error.name === "ValidationError" ||
                error.name === "CastError"
            ) {
                return res.status(400).json({
                    message: "Invalid task information",
                    data: {}
                });
            }

            console.error(error);

            return res.status(500).json({
                message: "Unable to update task",
                data: {}
            });
        }
    });

    
    taskRoute.delete(async function(req, res) {
        try {
            const taskId = req.params.id;

            // Validate task ID
            if (!mongoose.isObjectIdOrHexString(taskId)) {
                return res.status(400).json({
                    message: "Task not found",
                    data: {}
                });
            }

            const session = await mongoose.startSession();

            try {
                await session.withTransaction(async () => {

                    // Find the task
                    const task = await Task.findById(taskId)
                        .session(session);

                    if (!task) {
                        const error = new Error("Task not found");
                        error.status = 404;
                        throw error;
                    }

                    // removing task from any users pending tasks
                    await User.updateMany(
                        { pendingTasks: taskId },
                        {
                            $pull: {
                                pendingTasks: taskId
                            }
                        },
                        { session }
                    );

                    // deleting task doc
                    await Task.deleteOne(
                        { _id: taskId },
                        { session }
                    );
                });

            } finally {
                await session.endSession();
            }

            return res.status(204).send();

        } catch (error) {
            if (error.status === 404) {
                return res.status(404).json({
                    message: "Task not found",
                    data: {}
                });
            }

            console.error(error);

            return res.status(500).json({
                message: "Unable to delete task",
                data: {}
            });
        }
    });



    return router;
};
