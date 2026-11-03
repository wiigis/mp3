const Task = require("../models/task.js");
const User = require("../models/user.js");
const mongoose = require("mongoose");

module.exports = function (router) {

    var tasksRoute = router.route('/');

    tasksRoute.get(async function (req, res) {
        try {
            const tasks = await Task.find().limit(100);

            res.status(200).json({
                message: "OK",
                data: tasks
            });

        } catch (error) {
            res.status(500).json({
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

            // Check whether the ID format is valid
            if (!mongoose.isObjectIdOrHexString(taskId)) {
                return res.status(404).json({
                    message: "Task not found",
                    data: {}
                });
            }

            // Search MongoDB for the task
            const task = await Task.findById(taskId);

            // Check whether the task exists
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
            return res.status(500).json({
                message: "Unable to retrieve task",
                data: {}
            });
        }
    });

    return router;
};
