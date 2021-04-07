require('../mongodb/mongoose');
const authentication=require('../User_System/method/authentication');
const express = require('express');
const PostModel = require("./PostModel");
const CommentModel = require("./CommentModel");
const router = new express.Router();

//Missing: login authentication
//Missing: views

/**
 * The user can:
 * 1. Read a post with an optional filter
 * 2. Retrieve a number of posts with an optional filter
 * 3. Create a post
 * 4. Modify a post of its title, content, category, topic, and status
 * 5. Cast a vote only once or cancel a vote
 * 6. Delete a post
 */

//1. Read a post
router.get('/posts/:id', authentication,async (req, res) => {
    try {
        const post = await PostModel.findById(req.params.id);
        if(!post) {
            return res.status(404).send();
        }
        res.send(post);
    } catch(error) {
        res.status(500).send(error);
    }
});

//2. Retrieve a number of posts
/**
 * Mandatory queries:
 * 1. page
 * 2. limit
 * 3. sort
 * Optional queries:
 * 1. category
 * 2. topic
 * 3. time limit (last day, week, month, or year) (to be implemented)
 */
router.get('/posts', async (req, res) => {
    //parsing mandatory queries
    //missing: last 24/week/month/year
    const page = parseInt(req.query.page) - 1;
    const limit = parseInt(req.query.limit);
    switch(req.query.sort) {
        case "timeAsc":
            sort = "+createdAt";
            break;
        case "timeDes":
            sort = "-createdAt";
            break;
        case "voteAsc":
            sort = {
                votes: 1,
                createdAt: -1
            };
            break;
        case "voteDes":
            sort = {
                votes: -1,
                createdAt: -1
            };
            break;
        case "contDsc":
            sort = {
                controversy: -1,
                createdAt: -1
            };
            break;
        default:
            return res.status(400)
            .send({error: "Invalid sort, use timeAsc, timeDes, voteAsc, voteDes, or contDes instead."});
    }

    //parsing optional queries
    var filter = {};
    if(req.query.topic) filter.topic = req.query.topic;
    if(req.query.category) filter.category = req.query.category;
    /* if(req.query.time) {
        switch(req.query.time) {
            case "day":
                Date.now() - 1000 * 60 * 60 * 24;
                break;
            case "week":
                Date.now() - 1000 * 60 * 60 * 24 * 7;
        }

        filter.createdAt = {
            $gt:time
        };
    } */

    //parsing response
    try {
        const posts = await PostModel.find(filter).sort(sort).skip(page * limit).limit(limit);

        res.send(posts);
    }
    catch(error) {
        res.status(500).send(error);
    }
});

//2. Create a post
router.post('/posts', authentication, async (req, res) => {
    const newPost = new PostModel(req.body);
    try {
        await newPost.save();
        res.status(201).send(newPost);
    } catch(error) {
        res.status(400).send(error);
    }
});

//3. Modify a post of its title, content, category, topic, and status
router.patch('/posts/:id', authentication, async (req, res) => {
    //Validating legitimacy of the update request
    updates = Object.keys(req.body);
    allowedUpdates = ["title", "content", "category", "topic", "status"];
    isValidOperation = updates.every((update) => allowedUpdates.includes(update));

    if(!isValidOperation) {
        return res.status(400).send({error: "Invalid update."});
    }

    try {
        const post = await PostModel.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if(!post) { //No post found
            return res.status(404).send();
        }
        res.send(post);
    } catch(error) {
        res.status(500).send();
    }
});

//4. Cast a vote only once or cancel a vote
//The request body must use a vote object
/**
 *   An example vote object:
 *   {
 *       "owner": "username",
 *       "action": "upvote" (this can be "upvote", "downvote", or "cancel")
 *   }
 */
router.patch('/posts/vote/:id', async (req, res) => {
//router.patch('/posts/vote/:id',authentication, async (req, res) => {
    const {owner, action} = req.body;

    try {
        //checking if the post exists
        const post = await PostModel.findById(req.params.id);
        if(!post) {
            return res.status(404).send();
        }
        //cancelling a vote
        if(action === "cancel") {
            if(post.upvoteOwners.includes(owner) || post.downvoteOwners.includes(owner)) {
                //checking if the voter has an upvote or not
                const isUpvote = post.upvoteOwners.includes(owner);
                if(isUpvote) {
                    try {
                        post.upvoteOwners.splice(post.upvoteOwners.indexOf(owner), 1);
                        post.upvotes -= 1;
                        await post.save();
                        return res.send(req.body);
                    } catch(error) {
                        return res.status(500).send();
                    } 
                }
                else {
                    try {
                        post.downvoteOwners.splice(post.downvoteOwners.indexOf(owner), 1);
                        post.downvotes -= 1;
                        await post.save();
                        return res.send(req.body);
                    } catch(error) {
                        return res.status(500).send();
                    } 
                }
            }
            return res.status(404).send({ error: "No owner found." });
        }
        //voting
        else if(action === "upvote" || action === "downvote") {
            //checking if the owner has already voted
            const alreadyVoted = post.upvoteOwners.includes(owner) || post.downvoteOwners.includes(owner);

            if(alreadyVoted) {
                //warning the client that the owner has already voted
                return res.status(400).send({error: "The owner has already casted a vote. Cancel the vote first."});
            }
            else {
                //handling an upvote
                if(action === "upvote") {
                    try {
                        post.upvoteOwners.push(owner);
                        post.upvotes += 1;
                        await post.save();
                        return res.send(req.body);
                    } catch(error) {
                        return res.status(500).send(error);
                    }
                }
                //handling a downvote
                else {
                    try{
                        post.downvoteOwners.push(owner);
                        post.downvotes += 1;
                        await post.save();
                        return res.send(req.body);
                    } catch(error) {
                        return res.status(500).send(error);
                    }
                }
            }
        }
        else return res.status(400).send({ error: "Invalid action. (Use cancel, upvote, or downvote)" });
    } catch(error) {
        return res.status(500).send(error);
    }
});

//5. Delete a post
router.delete('/posts/:id', authentication, async (req, res) => {
    try {
        const post = await PostModel.findByIdAndDelete(req.params.id);
        if(!post) {
            return res.status(404).send();
        }
        await CommentModel.deleteMany( {parentPost: req.params.id });
        res.send(post);
    } catch(error) {
        res.status(500).send(error);
    }
});

module.exports = router;