const Task = require("../models/task.js");

module.exports = function (router) {

    router.get("/", async function (req, res) {
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

    return router;
};
