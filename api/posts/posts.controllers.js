import stream from 'stream'
import path from 'path'
import mongo from '../utils/mongoUtil.js'
import { ObjectId } from 'mongodb'
import { getStorage } from 'firebase-admin/storage'
import { publishToCurrencyQueue } from '../utils/mqUtil.js'

import * as constants from '../constants/constants.js'

/**
 * This function handles the creation of a post.
 * When a request is made to this endpoint, it checks if the userid making the request is valid.
 * If the userid is not valid or not found, it sends a response message with an appropriate error.
 * If the user exists, it then checks if the user has provided the sufficient post title as the post text.
 * If the user has not provided the sufficient details, it sends a response message that insufficient details have been provided.
 * If the user has has provided sufficient details, it then checks if the user has provided the optional group id and and is posting to a particular group.
 * If the user hasnt, it then creates the post and awards them their reward currency and sends an response message for the same.
 * If the user has provided the groupId as well, it then creates the post to that group and awards them their currency and responds with an appropriate message.
 * 
 * @param {Object} req The post title and the post text.
 * @param {Object} res The result that either the server has succeeded or failed in creating the users post.
 * @param {String} req.body.postTitle The title of the post to be created
 * @param {String} req.body.postText The body text of the post
 * @param {String} req.body.inGroup The optional field to check if the post is being created to a group
 * 
 * @throws {Error} The post details are insufficient
 * @throws {Error} The user is not part of the group they are attempting to create a post in
 */

const createPost = async(req,res) =>
{
    const {postTitle, postText, inGroup} = req.body

    if(postTitle && postText)
    {
        const post = 
        {
            postAuthor: req.userid, // Only storing id when creating. Username can be returned to the client in get requests.
            createdAt: new Date(),
            updatedAt: new Date(),
            postTitle: postTitle,
            postText: postText,
            visible: "true", // All posts visible by default
            inGroup: inGroup,
            likes: 0,
            comments: 0
        }

        const db = await mongo()
        const data = await db
            .collection(constants.postsCollection)
            .insertOne(post)

        if (data.acknowledged = true)
        {
            res.status(200).send(data)

            await publishToCurrencyQueue(constants.currencyQueue, req.userid + '|' + 'createPost')
        }
        else 
        {
            res.status(500).send("Error creating post")
        }
    }
    else
    {
        res.status(400).send("Insufficient details. Ensure postTitle and postText are not empty when creating a post")
    }

}

/**
 * This function handles the uploading of an attachment to a user's post.
 * When a request is made to this endpoint, the server checks if the user if the post exists or not and if the user is authorized to edit the post.
 * If the post does not exist, it sends a response message that no post has been found.
 * If the user is not authorized to edit the post, it sends a response message that the user is unauthorized.
 * If the post exists and the user is authorized it then checks the file selected by the user. 
 * If the user has not selected any file to upload, it sends a response message that no file was selected.
 * If the user has selected a file, that file is then added to the users post and a response message is sent that the file has been uploaded.
 * 
 * @param {Object} req The file that the user wishes to upload.
 * @param {Object} res The result that either the server has been successful or unsuccessful in uploading the file.
 * @param {String} req.body.postId The id of the post the attachment is being added to
 * 
 * @throws {Error} The post does not exist
 * @throws {Error} The user is not authorized to add files to the post
 * @throws {Error} The userhas not selected a file to be added to the posrt
 */

const addAttachmentToPost = async(req,res) =>
{
    const postId = req.body.postId
    if(req.file) 
    {
        const bucket = getStorage().bucket()
        const filename = constants.postsStorage + postId + path.extname(req.file.originalname)
        const file = bucket.file(filename)

        const passthroughStream = new stream.PassThrough()
        passthroughStream.write(req.file.buffer)
        passthroughStream.end()

        async function streamFileUpload() 
        {
            passthroughStream.pipe(file.createWriteStream({ public : true })).on('finish', async () => 
            {
                const db = await mongo()
                const postData = await db
                    .collection(constants.postsCollection)
                    .updateOne({ _id : new ObjectId(postId)}, { $set : { attachment: { fileName : file.metadata.name, fileLink: file.metadata.mediaLink }} })

                res.status(200).send("File successfully uploaded")
            });
        }
        streamFileUpload().catch(console.error)
    }
    else
    {
        res.status(404).send("Error: No files found")
    }
}

/**
 * This function handles the removing of an attachment from a post.
 * When a request is made to this endpoint, the server checks if the user if the post exists or not and if the user is authorized to edit the post.
 * If the post does not exist, it sends a response message that no post has been found.
 * If the user is not authorized to edit the post, it sends a response message that the user is unauthorized.
 * If the post exists and the user is authorized, it then proceeds to delete the file from the post.
 * If the file is deleted it sends a response message that the file has been successfuly deleted.
 * If the file has not been deleted, it sends a response message that the server has failed to delete the file along with the error due to which the file was not deleted.
 *  
 * @param {Object} req The id of the post from which the attachment is to be removed.
 * @param {Object} res The result that either the attachment file has been successfully removed or has failed.
 * @param {String} req.body.postId The id of the post from which the attachment is to be deleted
 * 
 * @throws {Error} The post does not exist
 * @throws {Error} The user is unauthorized to remove attachments from the post
 * @throws {Error} There is no attachment to the post
 */

const deleteAttachmentFromPost = async(req,res) =>
{
    const {postId} = req.body
    const db = await mongo()

    const postData = await db
        .collection(constants.postsCollection)
        .find({ "_id" : new ObjectId(postId)}).toArray()

    console.log(postData[0].attachment.fileName)

    const removePostAttachmentData = await db
        .collection(constants.postsCollection)
        .updateOne({ "_id" : new ObjectId(postId)}, { $set : { attachment: { fileName : null, fileLink: null }} })

    if(removePostAttachmentData.modifiedCount == 1) // Delete the file from Firebase if the link is successfully deleted
    {
        const bucket = getStorage().bucket()
        const filename = postData[0].attachment.fileName
        const file = bucket.file(filename)

        file.delete().then(() => 
        {
            res.status(200).send("Attachment deleted")
        })
        .catch(err => 
        {
            res.status(500).send(`Failed to delete file: ${err}`)
        })
    }

}

/**
 * This function handles updating a users post.
 * When a request is made to this endpoint, it checks if the post exists and if the user is authorized to edit the post. 
 * If the post does not exist, it sends a response message that no post has been found.
 * If the user is not authorized to edit the post, it sends a response message that the user is unauthorized.
 * If the user is autorized and the post exists, it then checks if the user has provided the updated title and text.
 * If the user has failed to provide either, it sends a response message that insufficient details are provided by the user.
 * If the user has provided them, it then updates the post and sends a response message that the post has been successfully updated.
 * 
 * @param {Object} req The post id, the updated post title and the updated post text.
 * @param {Object} res The result that either the server has either succeeded or failed in updating the post.
 * @param {String} req.body.postId The id of the post being updated
 * @param {String} req.body.postTitle the post title to be updated
 * @param {String} req.body.postText the text to be updated in the post
 * 
 * @throws {Error} The post does not exist
 * @throws {Error} The user is unauthorized to edit the post
 * @throws {Error} The user has provided insufficient details to update the post with
 */

const updatePost = async(req,res) =>
{
    const {postId, postTitle, postText} = req.body

    if(postId && postTitle && postText)
    {
        const post = 
        {
            updatedAt: new Date(),
            postTitle: postTitle,
            postText: postText
        }
        
        const db = await mongo()
        const data = await db
            .collection(constants.postsCollection)
            .updateOne({ "_id" : new ObjectId(postId)}, { $set: post})


        if (data.acknowledged = true)
        {
            if(data.modifiedCount == 0)
            {
                res.status(404).send("Post not found")
            }
            else
            {
                res.status(200).send(post)
            }
        }
        else 
        {
            res.status(500).send("Error updating post")
        }
    }
    else
    {
        res.status(400).send("Insufficient details. Ensure postId, postTitle, and postText are not empty when updating a post")
    }
}

/**
 * This function handles the deletion of a users post.
 * WHen a request is made to this endpoint it checks if the post exists and the user is authorized to delete the post.
 * If the post does not exist, it sends a response message that no post has been found.
 * If the user is not authorized to edit the post, it sends a response message that the user is unauthorized.
 * If the post exists and the user is authorized it then proceeds to delete the users post and sends a response message that the post has been deleted. 
 * 
 * @param {Object} req The id of the post
 * @param {Object} res The result that either the post has been deleted or the server has failed to delete the post.
 * @param {String} req.body.postId The id of the post being deleted
 * 
 * @throws {Error} The post does not exist
 * @throws {Error} The user is unauthorized to delete the post
 */

const deletePost = async(req,res) =>
{
    const {postId} = req.body

    if(postId)
    {
        const db = await mongo()
        const data = await db
            .collection(constants.postsCollection)
            .deleteOne({ "_id": new ObjectId(postId)})

        if (data.acknowledged = true)
        {
            if(data.deletedCount == 0)
            {
                res.status(404).send("Post not found")
            }
            else
            {
                res.status(200).send("Successfully deleted post")  
            }          
        }
        else 
        {
            res.status(500).send("Error deleting post")
        }
    }
    else
    {
        res.status(400).send("Insufficient details. Ensure postId is not empty when updating a post")
    }
}

/**
 * This function handles changing the visiblity of a post.
 * By deafult the post visibility is set to true, i.e. the post is visibile.
 * When a request is made to this endpoint, it checks if the post exists and if the user is authorised to edit the post visibility settings.
 * If the post does not exist, it sends a response message that no post has been found.
 * If the user is not authorized to edit the post visibilty, it sends a response message that the user is unauthorized.
 * If the post exists and the user is authorized it then checks if the post is visilble.
 * If the post is visible, it changes its settings to make it invisible.
 * If the post is invisible, it change its settings to make it visible. 
 * 
 * @param {Object} req The post id and the post visibility
 * @param {Object} res The result that either the server has succeeded or failed in changing the post visibility.
 * @param {String} req.body.postId The id of the post whose visibility is being changed
 * @param {String} req.body.postVisibility the visibilty of the post to be changed
 * 
 * @throws {Error} The post does not exist
 * @throws {Error} The user is unauthorized to delete the post
 */

const changePostVisibility = async(req,res) =>
{
    const {postId, postVisibility} = req.body

    if(postId && postVisibility)
    {
        const post = 
        {
            visible: postVisibility
        }

        const db = await mongo()
        const data = await db
            .collection(constants.postsCollection)
            .updateOne({ "_id" : new ObjectId(postId)}, { $set: post})

        if (data.acknowledged = true)
        {
            if(data.modifiedCount == 0)
            {
                res.status(404).send("Post not found")
            }
            else
            {
                res.status(500).send("Successfully changed post visibility")
            }
        }
        else 
        {
            res.status(500).send("Error changing post visibility")
        }
    }
    else
    {
        res.status(400).send("Insufficient details. Ensure postId and postVisibility are not empty when changing a post's visibility")
    }
}

/**
 * This function handles getting a post's data.
 * When a request is made to this endpoint, it checks if the post existsand if the user is authenticated.
 * If the post does not exist, it sends a response message that no post has been found.
 * If the user is not authenticated, it sends a response message that the user is not aunthenticated.
 * If the post exists and the user is authenticated it then returns the post along with its data.  
 * 
 * @param {Object} req The post id
 * @param {Object} res The resulted post data or that the server has not found the post.
 * @param {String} req.params.postId the id of the post which is being retrieved
 * 
 * @throws {Error} The post does not exist
 */

const getPost = async(req,res) =>
{
    const db = await mongo()
    const data = await db
        .collection(constants.postsCollection)
        .find({_id : new ObjectId(req.params.postid)}).toArray()

    if(data.length == 0)
    {
        res.status(404).send("Post not found")
    }
    else
    {
        res.status(200).send(data)
    }

}

/**
 * This function handles retrieving all the posts made by a particular user.
 * When a request is made to this endpoint, the server checks if the user exists.
 * If the user does not exist, it sends a response message that the user does not exist.
 * If the user exists, it then retrieves the posts created by the user.
 * If the post created by the user are zero, it sends a response message that no posts by this user were found.
 * 
 * @param {Object} req The user id whose posts are retrieved.
 * @param {Object} res The result that the server has retrieved posts by the user or the user has no posts.
 * @param {String} req.params.userid The id of the user whose posts are being retrieved
 * 
 * @throws {Error} The user does not exist
 */

const getPostsByUser = async(req,res) =>
{    
    const db = await mongo()
    const data = await db
        .collection(constants.postsCollection)
        .aggregate(
            [
                {
                    $match:
                    {
                        postAuthor : req.params.userid
                    }
                },
                {
                    $skip : 10 * req.params.page
                },
                {
                    $limit : 10
                }
            ]
        )

    if (data.length == 0)
    {
        res.status(404).send("No posts found by this user")
    }
    else
    {
        res.status(200).send(data)
    }

    res.status(200).send(data) 
}

/**
 * This function handles retrieving all the posts made in a particular group.
 * When a request is made to this endpoint, the server checks if the group exists.
 * If the group does not exist, it sends a response message that the group does not exist.
 * If the group exists, it then retrieves the posts created to the group.
 * If the post created to the group are zero, it sends a response message that no posts in this group were found.
 * 
 * @param {Object} req The group id whose posts are retrieved.
 * @param {Object} res The result that the server has retrieved posts in the group or the group has no posts.
 * @param {String} req.params.groupid the id of the group whose posts are being retrieved
 * 
 * @throws {Error} The Group does not exist
 */

const getPostsByGroup = async(req,res) =>
{
    const db = await mongo()
    const data = await db
        .collection(constants.postsCollection)
        .aggregate(
            [
                {
                    $match:
                    {
                        inGroup : req.params.groupid
                    }
                },
                {
                    $skip : 10 * req.params.page
                },
                {
                    $limit : 10
                }
            ]
        )

    if (data.length == 0)
    {
        res.status(404).send("No posts found in this group")
    }
    else
    {
        res.status(200).send(data)
    }

    res.status(200).send(data) 
}

/**
 * This function handles liking and unliking a post.
 * When a request is sent to this endpoint, it checks if the post exists.
 * If the post does not exist, it sends a response message that the post was not found.
 * If the post exists, if checks if the user has already liked the post or not. 
 * If they have, it decrements the likes counter and removes their userid from the likedUsers array.
 * If they haven't, it increments the likes counter and adds their userid to the likedUsers array.
 * 
 * @param {Object} req The post request which should contain the post id
 * @param {Object} res The result sent back to the client
 * @param {String} req.body.postId The id of the post being liked by the user
 * 
 * @throws {Error} The post does not exist
 */

const likePost = async(req,res) =>
{
    const {postId} = req.body

    // Check that postId is not empty
    if(postId)
    {
        const db = await mongo()
        const postData = await db
            .collection(constants.postsCollection)
            .find({_id: new ObjectId(postId), likedUsers: req.userid }).toArray()

        // Check if user has already liked this post, and if not, add the like
        if(postData.length == 0)
        {
            const likedPostData = await db
                .collection(constants.postsCollection)
                .updateOne({ "_id" : new ObjectId(postId)}, { $inc: {"likes" : 1}, $addToSet: {"likedUsers": req.userid}})

            // Check if request was acknowledged
            if (likedPostData.acknowledged = true)
            {
                // Check if update was performed
                if(likedPostData.modifiedCount == 0)
                {
                    res.status(404).send("Post not found")
                }
                else
                {
                    giveCurrency(req.userid, 'postLiked')          
                    res.status(200).send("Post like count updated")
                }
            }
            else 
            {
                res.status(500).send("Error liking post")
            }
        }
        // Check if user has already liked this post, and if yes, remove the like
        else
        {
            const unlikedPostData = await db
                .collection(constants.postsCollection)
                .updateOne({ "_id" : new ObjectId(postId)}, { $inc: {"likes" : -1}, $pull: {"likedUsers": req.userid}})

            if (unlikedPostData.acknowledged = true)
            {
                if(unlikedPostData.modifiedCount == 0)
                {
                    res.status(404).send("Post not found")
                }
                else
                {                
                    res.status(200).send("Post like count updated")
                }
            }
            else 
            {
                res.status(500).send("Error liking post")
            }
        }

    }
    else
    {
        res.status(400).send("Insufficient details. Ensure postId is not empty when liking a post")
    }
}

/**
 * This function handles the creation of a comment to a post.
 * When a request is made to this endpoint, it checks if the post exists.
 * If the post does not exist, it sends a response message that the post was not found.
 * If the post exists it then checks if the user has provided the text to be added as a comment. 
 * If the user has not provided the comment text, the server sends a response message that no comment text was added.
 * If the user has provided the comment text, the text is then added as comment to the post.
 * 
 * @param {Object} req The post id and the text to be added as a comment.
 * @param {Object} res The result that either server has created the comment or failed to create it.
 * @param {String} req.body.postId The id of the post where a comment is being created
 * @param {String} req.body.commentText The text to be added as a comment
 * 
 * @throws {Error} The post does not exist
 * @throws {Error} The comment text field is left blank
 */

const createComment = async(req,res) =>
{
    const {postId, commentText, parentCommentId} = req.body

    if(postId && commentText)
    {
        const db = await mongo()
        const postData = await db
            .collection(constants.postsCollection)
            .find({ "_id" : new ObjectId(postId)}).toArray()

        if(postData.length == 0)
        {
            res.status(404).send("Post not found")
        }
        else
        {
            if(!parentCommentId)
            {
                const comment = 
                {
                    commentAuthor: req.userid, // Only storing id when creating. Username can be returned to the client in get requests.
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    commentText: commentText,
                    inPost: postId,
                    likes: 0,
                    childComments: []
                }

                const commentData = await db
                    .collection(constants.commentsCollection)
                    .insertOne(comment)

                if (commentData.acknowledged = true)
                {
                    await db // Increment comments count for the post
                        .collection(constants.postsCollection)
                        .updateOne({ "_id" : new ObjectId(postId)}, { $inc: {"comments" : 1}})

                    res.status(200).send(comment)
                }
                else 
                {
                    res.status(500).send("Error creating comment")
                }
            }
            else // Will only work for one layer of child comments
            {
                const comment = 
                {
                    _id: new ObjectId(),
                    commentAuthor: req.userid, // Only storing id when creating. Username can be returned to the client in get requests.
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    commentText: commentText,
                    inComment: parentCommentId,
                    likes: 0
                }

                const commentData = await db
                    .collection(constants.commentsCollection)
                    .updateOne({ "_id" : new ObjectId(parentCommentId)}, { $push : { "childComments" :  comment } })

                if (commentData.acknowledged = true)
                {
                    res.status(200).send(comment)
                }
                else 
                {
                    res.status(500).send("Error creating comment")
                }
            }
        }
    }
    else
    {
        res.status(400).send("Insufficient details. Ensure postId and commentText are not empty when creating a post")
    }

}

/**
 * This function handles retrieving all the comments made in a particular post.
 * When a request is made to this endpoint, the server checks if the post exists.
 * If the post does not exist, it sends a response message that the post does not exist.
 * If the post exists, it then retrieves the comments made in the group.
 * If the comments made in the post are zero, it sends a response message that no comments were made in this post.
 * 
 * @param {Object} req The post id
 * @param {Object} res The result that either the server has succeeded or failed in retrieving the post comments.
 * @param {String} req.params.postid The id of the post whose comments are being retrieved
 * 
 * @throws {Error} The post does not exist
 */

const getComments = async(req,res) =>
{
    const db = await mongo()
    const data = await db
        .collection(constants.commentsCollection)
        .aggregate(
            [
                {
                    $match:
                    {
                        inPost : req.params.postid
                    }
                },
                {
                    $skip : 10 * req.params.page
                },
                {
                    $limit : 10
                }
            ]
        )

    if(data.length == 0)
    {
        res.status(404).send("No comments for this post")
    }
    else
    {
        res.status(200).send(data)
    }

}

/**
 * This function handles updating a users comment.
 * When a request is made to this endpoint, it checks if the comment exists and if the user is authorized to edit the comment. 
 * If the comment does not exist, it sends a response message that no comment has been found.
 * If the user is not authorized to edit the comment, it sends a response message that the user is unauthorized.
 * If the user is autorized and the comment exists, it then checks if the user has provided the updated comment.
 * If the user has failed to provide the updated comment, it sends a response message that insufficient details are provided by the user.
 * If the user has provided them, it then updates the comment and sends a response message that the comment has been successfully updated.
 * 
 * @param {Object} req The comment id and the text to be updated
 * @param {Object} res The response that either the server has succeeded or failed in updating the comment.
 * @param {String} req.body.commentId the id of the comment to be updated
 * @param {String} req.body.commentText the text of the comment to be updated
 * 
 * @throws {Error} The comment does not exist
 * @throws {Error} The user is unauthorized to update the comment
 */

const updateComment = async(req,res) =>
{
    const {commentId, commentText, parentCommentId} = req.body

    if(commentId && commentText)
    {
        if(!parentCommentId)
        {
            const comment = 
            {
                updatedAt: new Date(),
                commentText: commentText,
            }
            
            const db = await mongo()
            const commentData = await db
                .collection(constants.commentsCollection)
                .updateOne({ "_id" : new ObjectId(commentId)}, { $set: comment})


            if (commentData.acknowledged = true)
            {
                if(commentData.modifiedCount == 0)
                {
                    res.status(404).send("Comment not found")
                }
                else
                {
                    res.status(200).send(comment)
                }
            }
            else 
            {
                res.status(500).send("Error updating comment")
            }
        }
        else
        {
            const db = await mongo()
            const commentData = await db
                .collection(constants.commentsCollection)
                .updateOne(
                    { 
                        '_id' : new ObjectId(parentCommentId), 
                        'childComments' : { $elemMatch : { "_id" : new ObjectId(commentId) } }
                    }, 
                    { $set: { 'childComments.$.updatedAt' : new Date(), 'childComments.$.commentText' : commentText } })


            if (commentData.acknowledged = true)
            {
                if(commentData.modifiedCount == 0)
                {
                    res.status(404).send("Comment not found")
                }
                else
                {
                    res.status(200).send("Successfully updated comment")
                }
            }
            else 
            {
                res.status(500).send("Error updating comment")
            }
        }
    }
    else
    {
        res.status(400).send("Insufficient details. Ensure commentId and commentText are not empty when updating a comment")
    }

}

/**
 * This function handles deleting a users comment.
 * When a request is made to this endpoint, it checks if the comment exists and if the user is authorized to delete the comment. 
 * If the comment does not exist, it sends a response message that no comment has been found.
 * If the user is not authorized to delete the comment, it sends a response message that the user is unauthorized.
 * If the user is authorized and the comment exists, it then deletes the users comment.
 * 
 * @param {Object} req The comment id
 * @param {Object} res The result that either the server has been successful or unsuccessful in deleting the users comment.
 * @param {String} req.body.commentId the id of the comment to be deleted
 * 
 * @throws {Error} The comment does not exist
 * @throws {Error} The user is unauthorized to delete the comment
 */

const deleteComment = async(req,res) =>
{
    const {commentId, parentCommentId} = req.body

    if(commentId)
    {
        if(!parentCommentId)
        {
            const db = await mongo()
            const commentData = await db
                .collection(constants.commentsCollection)
                .findOneAndDelete({ "_id": new ObjectId(commentId)})

            if (commentData.acknowledged = true)
            {
                if(commentData.deletedCount == 0)
                {
                    res.status(404).send("Comment not found")
                }
                else
                {
                    await db // Increment comments count for the post
                    .collection(constants.postsCollection)
                    .updateOne({ "_id" : new ObjectId(commentData.value.inPost)}, { $inc: {"comments" : -1}})

                    res.status(200).send("Successfully deleted comment")  
                }          
            }
            else 
            {
                res.status(500).send("Error deleting comment")
            }
        }
        else
        {
            const db = await mongo()
            const commentData = await db
                .collection(constants.commentsCollection)
                .updateOne(
                    { 
                        '_id' : new ObjectId(parentCommentId), 
                        // 'childComments' : { $elemMatch : { "_id" : new ObjectId(commentId) } }
                    }, 
                    { $pull: { 'childComments' : { '_id' : new ObjectId(commentId) }} })


            if (commentData.acknowledged = true)
            {
                if(commentData.deletedCount == 0)
                {
                    res.status(404).send("Comment not found")
                }
                else
                {
                    res.status(200).send("Successfully deleted comment")  
                }          
            }
            else 
            {
                res.status(500).send("Error deleting comment")
            }
        }
    }
    else
    {
        res.status(400).send("Insufficient details. Ensure commentId is not empty when deleting a comment")
    }
}

/**
 * This function handles liking of a comment.
 * When a request is sent to this endpoint, it checks if the comment exists.
 * If the comment does not exist, it sends a response message that the comment was not found.
 * If the comment exists, if checks if the user has already liked the comment or not. 
 * If they have, it decrements the likes counter and removes their like.
 * If they haven't, it increments the likes counter and adds their like.
 * 
 * @param {Object} req The comment id
 * @param {Object} res The result that either the server has succeeded or failed in liking a comment
 * @param {String} req.body.commentId The id of the comment that is being liked
 * 
 * @throws {Error} The comment does not exist
 * @throws {Error} The user is trying to like a comment that they have already liked
 */

const likeComment = async(req,res) =>
{
    const {commentId, parentCommentId} = req.body
    const db = await mongo()

    if(commentId)
    {
        if(!parentCommentId)
        {
            const commentLikedResponse = await db
                .collection(constants.commentsCollection)
                .find({ likedUsers: req.userid }).toArray()

            if(commentLikedResponse.length == 0)
            {
                const commentData = await db
                    .collection(constants.commentsCollection)
                    .updateOne({ _id : new ObjectId(commentId)}, { $inc: { likes : 1}, $addToSet: { likedUsers: req.userid }})

                if (commentData.acknowledged = true)
                {
                    if(commentData.matchedCount == 0)
                    {
                        res.status(404).send("Comment not found")
                    }
                    else
                    {
                        res.status(200).send("Comment like count updated")
                    }
                }
                else 
                {
                    res.status(500).send("Error liking comment")
                }
            }
            else
            {
                const commentData = await db
                    .collection(constants.commentsCollection)
                    .updateOne({ _id : new ObjectId(commentId)}, { $inc: { likes : -1}, $pull: { likedUsers: req.userid }})
                        
                if (commentData.acknowledged = true)
                {
                    if(commentData.modifiedCount == 0)
                    {
                        res.status(404).send("Comment not found")
                    }
                    else
                    {
                        res.status(200).send("Comment like count updated")
                    }
                }
                else 
                {
                    res.status(500).send("Error liking comment")
                }
            }
        }
        else
        {
            const commentLikedResponse = await db
                .collection(constants.commentsCollection)
                .find(
                    {
                        _id : new ObjectId(parentCommentId),
                        'childComments.likedUsers' : req.userid
                    }).toArray()
            
            if(commentLikedResponse.length == 0)
            {
                const commentData = await db
                    .collection(constants.commentsCollection)
                    .updateOne(
                        { 
                            _id : new ObjectId(parentCommentId),
                            childComments : { $elemMatch : { _id : new ObjectId(commentId) } }
                        }, 
                        { 
                            $inc: { 'childComments.$.likes' : 1}, 
                            $addToSet: { 'childComments.$.likedUsers': req.userid }
                        })

                if (commentData.acknowledged = true)
                {
                    if(commentData.matchedCount == 0)
                    {
                        res.status(404).send("Comment not found")
                    }
                    else
                    {
                        res.status(200).send("Comment like count updated")
                    }
                }
                else 
                {
                    res.status(500).send("Error liking comment")
                }
            }
            else
            {
                const commentData = await db
                    .collection(constants.commentsCollection)
                    .updateOne(
                        { 
                            _id : new ObjectId(parentCommentId),
                            childComments : { $elemMatch : { _id : new ObjectId(commentId) } }
                        }, 
                        { 
                            $inc: { 'childComments.$.likes' : -1}, 
                            $pull: { 'childComments.$.likedUsers': req.userid }
                        })
                        
                if (commentData.acknowledged = true)
                {
                    if(commentData.modifiedCount == 0)
                    {
                        res.status(404).send("Comment not found")
                    }
                    else
                    {
                        res.status(200).send("Comment like count updated")
                    }
                }
                else 
                {
                    res.status(500).send("Error liking comment")
                }
            }
        }
    }
    else
    {
        res.status(400).send("Insufficient details. Ensure commentId is not empty when liking a comment")
    }
}

/**
 * This function handles unliking of a comment.
 * When a request is sent to this endpoint, it checks if the comment exists.
 * If the comment does not exist, it sends a response message that the comment was not found.
 * If the comment exists, if checks if the user has already unliked the comment or not. 
 * If they have, it decrements the unlikes counter and removes their unlike.
 * If they haven't, it increments the unlikes counter and adds their unlike.
 * 
 * @param {Object} req The comment id
 * @param {Object} res he result that either the server has succeeded or failed in unliking a comment
 * @param {String} req.body.commentId The id of the comment that is being unliked
 * 
 * @throws {Error} The comment does not exist
 * @throws {Error} The user is trying to unlike a comment that they have already unliked
 */

const unlikeComment = async(req,res) =>
{
    const {commentId} = req.body

    if(commentId)
    {
        const db = await mongo()
        const commentData = await db
            .collection(constants.commentsCollection)
            .updateOne({ "_id" : new ObjectId(commentId)}, { $inc: {"likes" : -1}, $pull: {"likedUsers": req.userid}})

        if (commentData.acknowledged = true)
        {
            if(commentData.modifiedCount == 0)
            {
                res.status(404).send("Comment not found")
            }
            else
            {
                res.status(200).send("Comment like count updated")
            }
        }
        else 
        {
            res.status(500).send("Error liking comment")
        }
    }
    else
    {
        res.status(400).send("Insufficient details. Ensure commentId is not empty when liking a comment")
    }
}

export  {createPost, addAttachmentToPost, deleteAttachmentFromPost, updatePost, deletePost, changePostVisibility, getPost, getPostsByUser, getPostsByGroup, likePost, createComment, getComments, updateComment, deleteComment, likeComment, unlikeComment }